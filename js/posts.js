/*!
 * QUELORA – Real-time interaction platform for websites
 * 
 * @author German Zelaya
 * @version 1.0.0
 * @since 2023
* @license Licensed under the GNU Affero General Public License v3.0
 * 
 * Copyright (C) 2025 German Zelaya
 * 
 * QUELORA is an open-source platform designed to add real-time comments,
 * posts, and reactions to websites. Its lightweight widget (~170KB uncompressed)
 * integrates easily into any page without the need for frameworks like React
 * or jQuery. It includes support for AI-powered automated moderation,
 * engagement analytics, and a multi-tenant dashboard to manage multiple sites
 * from a single interface.
 * 
 * This script is part of the QUELORA project, available at:
 * https://www.quelora.org/
 * 
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import UtilsModule from './utils.js';
import CommentsModule from './comments.js';
import CoreModule from './core.js';
import UiModule from './ui.js'; 
import EntityModule from './entity.js';
import ToastModule from './toast.js';
import I18n from './i18n.js';
import AnchorModule from './anchor.js';
import CaptchaModule from './captcha.js';

/**
 * Posts Module - Handles post interactions, events, and UI updates
 * @module PostsModule
 */

// ==================== PRIVATE VARIABLES ====================
let workerInstance;    // Web Worker instance for background tasks
let token;             // Authentication token
let cid;               // Client/Community ID
let timeoutId;         // Timeout ID for long-press detection
let longPressAction;   // Flag indicating if a long-press action was triggered

// ==================== HELPERS ====================
/**
 * Handles errors consistently across the module
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 * @returns {null} Always returns null
 */
const handleError = (error, context) => {
    console.error(`Error in ${context}:`, error);
    return null;
};

// ==================== CORE FUNCTIONS ====================
/**
 * Initializes the post module with required dependencies
 * @param {Object} dependencies - Module dependencies
 * @param {Worker} dependencies.worker - Web Worker instance
 * @param {string} [dependencies.token] - Optional authentication token
 * @param {string} [dependencies.cid] - Optional community ID
 * @throws {Error} If initialization fails
 */
async function initializePost(dependencies) {
    try {
        workerInstance = dependencies.worker;
        token = dependencies.cid ? dependencies.token : await CoreModule.getTokenIfNeeded();
        cid = dependencies.cid;
    } catch (error) {
        handleError(error, 'PostsModule.init');
        throw error;
    }
}

/**
 * Updates the authentication token
 * @param {string} newToken - New authentication token
 */
async function setToken(newToken) {
    try {
        token = newToken;
    } catch (error) {
        handleError(error, 'PostsModule.setToken');
    }
}

// ==================== INTERACTION ACTIONS ====================
/**
 * Updates the share count display for a post
 * @param {HTMLElement} interactionElement - The interaction container element
 */
function updateShareCount(interactionElement) {
    try {
        const shareCountElement = interactionElement.querySelector(".share-count");
        if (shareCountElement) {
            let count = parseInt(shareCountElement.textContent, 10) || 0;
            shareCountElement.textContent = count + 1;
        }
    } catch (error) {
        handleError(error, 'PostsModule.updateShareCount');
    }
}

/**
 * Sets or removes a like on a post
 * @param {string} entityId - The ID of the post/entity
 * @param {boolean} liked - Whether to like or unlike
 */
async function setLike(entityId, liked) {
    try {
        token = await CoreModule.getTokenIfNeeded(); 

        const interactionElement = UiModule.getEntityInteractionUI(entityId);
        if (!interactionElement) {
            console.error(`Element with data-entity-interaction "${entityId}" not found.`);
            return;
        }
        
        UiModule.updateLikeUI(interactionElement, liked);
        workerInstance.postMessage({
            action: 'setLike',
            payload: { token, entityId, liked, cid }
        });
    } catch (error) {
        handleError(error, 'PostsModule.setLike');
    }
}

/**
 * Records a share action for a post
 * @param {string} entityId - The ID of the post/entity
 */
async function setShare(entityId) {
    try {
        token = await CoreModule.getTokenIfNeeded();
        workerInstance.postMessage({
            action: 'setShare',
            payload: { token, entityId, cid }
        });
    } catch (error) {
        handleError(error, 'PostsModule.setShare');
    }
}

/**
 * Toggles a bookmark on a post
 * @param {string} entityId - The ID of the post/entity
 * @param {boolean} attached - Whether to add or remove bookmark
 */
async function fetchBookmark(entityId, attached) {
    try {
        token = await CoreModule.getTokenIfNeeded(); 
        workerInstance.postMessage({
            action: 'toggleBookmark',
            payload: { token, entityId, attached, cid }
        });
    } catch (error) {
        handleError(error, 'PostsModule.fetchBookmark');
    }
}

/**
 * Fetches statistics (likes, shares, etc.) for multiple posts
 */
async function fetchStats() {
    try {
        const [entities, mapping] = await EntityModule.findEntities();

        if (entities.length === 0) return;

        const payload = { entities, cid, token };
        if (Object.keys(mapping).length > 0) {
            payload.mapping = mapping;
        }

        workerInstance.postMessage({
            action: 'fetchStats',
            payload
        });
    } catch (error) {
        handleError(error, 'PostsModule.fetchStats');
    }
}

// ==================== EVENT HANDLERS ====================
/**
 * Handles like button click
 * @param {string} entityId - The ID of the post/entity
 */
async function handleLike(entityId) {
    try {
        const interactionElement = UiModule.getEntityInteractionUI(entityId);
        const likeButton = interactionElement?.querySelector('.like-icon');
        if (!likeButton) {
            console.error(`Like button not found for entity: ${entityId}`);
            return;
        }
        const isLiked = likeButton.getAttribute('data-liked') === 'true';
        await setLike(entityId, !isLiked);  
    } catch (error) {
        handleError(error, 'PostsModule.handleLike');
    }
}

/**
 * Handles share button click
 * @param {string} entityId - The ID of the post/entity
 */
async function handleShare(entityId) {
    try {
        const interactionElement = UiModule.getEntityInteractionUI(entityId);
        const shareButton = interactionElement?.querySelector('.share-icon');

        const shareHash = AnchorModule.generateLink({
            type: 'entity',
            ids: { entity: entityId }
        });

        // Evitar duplicar hashes en la URL
        const shareUrl = `${window.location.href.split('#')[0]}${shareHash}`;

        if (!shareButton) {
            console.error(`Share button not found for entity: ${entityId}`);
            return;
        }

        if (navigator.share) {
            await navigator.share({
                title: I18n.getTranslation('shareTitle'),
                text: I18n.getTranslation('shareText'),
                url: shareUrl
            });
            await setShare(entityId);
            updateShareCount(interactionElement);
        } else {
            const toastContent = `
                <div style="word-break: break-all; margin-bottom: 10px;">${shareUrl}</div>
                <button 
                    class="quelora-btn active" 
                    onclick="navigator.clipboard.writeText('${shareUrl}')
                        .then(() => {
                            this.textContent = '${I18n.getTranslation('copied')}';
                            const toast = this.closest('.quelora-toast');
                            toast.classList.remove('quelora-toast-visible');
                            setTimeout(() => toast.remove(), 300);
                        })
                        .catch(err => console.error('Error copying to clipboard:', err))"
                >
                ${I18n.getTranslation('copy')}
                </button>
            `;
            ToastModule.info(
                'share',
                '{{copy}}',
                toastContent,
                null,
                8000
            );

            await setShare(entityId);
            updateShareCount(interactionElement);
        }
    } catch (error) {
        handleError(error, 'PostsModule.handleShare');
    }
}

/**
 * Handles bookmark button click
 * @param {string} entityId - The ID of the post/entity
 */
async function handleBookmark(entityId) {
    try {
        const interactionElement = UiModule.getEntityInteractionUI(entityId);
        const bookmarkButton = interactionElement?.querySelector('.bookmark');
        if (!bookmarkButton) {
            console.error(`Bookmark button not found for entity: ${entityId}`);
            return;
        }
        const isAttached = bookmarkButton.getAttribute('data-attached') === 'true';
        bookmarkButton.setAttribute('data-attached', !isAttached);
        await fetchBookmark(entityId, !isAttached);
    } catch (error) {
        handleError(error, 'PostsModule.handleBookmark');
    }
}

/**
 * Attaches event listeners to post interaction elements
 * @param {string} entityId - The ID of the post/entity
 */
function attachEventListeners(entityId) {
    try {
        const interactionContainer = UiModule.getEntityInteractionUI(entityId);
        if (!interactionContainer) {
            console.warn(`Interaction container not found for entity: ${entityId}`);
            return;
        }

        // Clone and replace buttons to prevent duplicate event listeners
        const likeButton = interactionContainer.querySelector('.like-icon');
        if (likeButton) {
            const newLikeButton = likeButton.cloneNode(true);
            likeButton.parentNode.replaceChild(newLikeButton, likeButton);

            // Set up long-press and click handlers
            ['mousedown', 'touchstart'].forEach(event => {
                newLikeButton.addEventListener(event, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    timeoutId = UtilsModule.startTimeout(() => {
                        longPressAction = true;
                        UiModule.likesDrawerUI.open();
                        workerInstance.postMessage({
                            action: 'getLikes',
                            payload: { token, entityId, cid }
                        });
                    }, 300);
                    longPressAction = false;
                });
            });

            ['mouseup', 'touchend'].forEach(event => {
                newLikeButton.addEventListener(event, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    UtilsModule.cancelTimeout(timeoutId);
                    const liked = newLikeButton.textContent === "favorite_border";
                    if (!longPressAction) setLike(entityId, liked);
                    longPressAction = false;
                });
            });

            newLikeButton.addEventListener('mouseleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                UtilsModule.cancelTimeout(timeoutId);
                longPressAction = false;
            });

            // Prevent default click behavior
            newLikeButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        }

        // Comment button
        const commentButton = interactionContainer.querySelector('.comment-icon');
        if (commentButton) {
            const newCommentButton = commentButton.cloneNode(true);
            commentButton.parentNode.replaceChild(newCommentButton, commentButton);
            newCommentButton.addEventListener('click', (e) => {
                e.stopPropagation();
                loadThread(entityId);
            });
        }

        // Share button
        const shareButton = interactionContainer.querySelector('.share-icon');
        if (shareButton) {
            const newShareButton = shareButton.cloneNode(true);
            shareButton.parentNode.replaceChild(newShareButton, shareButton);
            newShareButton.addEventListener('click', (e) => {
                e.stopPropagation();
                handleShare(entityId);
            });
        }

        // Bookmark button
        const bookmarkButton = interactionContainer.querySelector('.bookmark');
        if (bookmarkButton) {
            const newBookmarkButton = bookmarkButton.cloneNode(true);
            bookmarkButton.parentNode.replaceChild(newBookmarkButton, bookmarkButton);
            newBookmarkButton.addEventListener('click', (e) => {
                e.stopPropagation();
                handleBookmark(entityId);
            });
        }
    } catch (error) {
        handleError(error, 'PostsModule.attachEventListeners');
    }
}

/**
 * Loads the comment thread for a post
 * @param {string} entityId - The ID of the post/entity
 * @param {string} [lastCommentId] - Optional ID of the last loaded comment
 * @param {boolean} [includeLast] - Whether to include the last comment in results
 */
async function loadThread(entityId, lastCommentId = null, includeLast = false) {
    const threadsContainer = UiModule.getCommunityThreadsUI();
    if (threadsContainer) {
        threadsContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
    CommentsModule.fetchComments(entityId, lastCommentId, includeLast);
    CommentsModule.attachCommentInputListener(entityId);
    UiModule.createEmojiPickerBarUI();
    UtilsModule.setInputLimit(
        UtilsModule.getConfig(entityId)?.limits?.comment_text
    );
    UiModule.commentsDrawerUI.open();
}

/**
 * Loads nested comments/replies
 * @param {string} entityId - The ID of the post/entity
 * @param {string} commentId - The ID of the parent comment
 * @param {string} replyId - The ID of the reply to focus on
 */
async function loadNested(entityId, commentId, replyId) {
    CommentsModule.fetchNested(entityId, commentId, replyId);
}

// ==================== UI UPDATES ====================
/**
 * Updates all interaction bars on the page with fresh data
 */
async function updateAllInteractionBars() {
    try {
        const entities = Array.from(UiModule.getEntityInteractionUI())
            .map(el => el.getAttribute("data-entity-interaction"));

        if (entities.length === 0) return;

        token = await CoreModule.getTokenIfNeeded(token, true);

        workerInstance.postMessage({
            action: 'fetchStats',
            payload: { entities, cid, token, forceRefresh: true }
        });
    } catch (error) {
        handleError(error, 'PostsModule.updateAllInteractionBars');
    }
}

// ==================== PUBLIC API ====================
const PostsModule = {
    initializePost,
    fetchStats,
    setLike,
    fetchBookmark,
    attachEventListeners,
    setToken,
    updateShareCount,
    handleShare,
    handleLike,
    handleBookmark,
    updateAllInteractionBars,
    loadThread,
    loadNested
};

export default PostsModule;