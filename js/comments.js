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

import ConfModule from './conf.js';
import CoreModule from './core.js';
import UtilsModule from './utils.js';
import ProgressInput from './progressInput.js';
import UiModule from './ui.js';
import ProfileModule from './profile.js';
import I18n from './i18n.js';
import SessionModule from './session.js';
import AudioRecorderModule from './audioRecorder.js';
import MentionModule from './mention.js';
import AnchorModule from './anchor.js';
import AIModule from './ai.js';

// ==================== MODULE CONSTANTS ====================
const TOUCH_MOVE_THRESHOLD = 10; // pixels
const LONG_PRESS_DURATION = 300; // ms
const MAX_RENDER_ATTEMPTS = 3;
const RENDER_ATTEMPT_INTERVAL = 300; // ms
const DEFAULT_COMMENT_LIMIT = 15;

// ==================== PRIVATE VARIABLES ====================
let workerInstance = null;
let token = null;
let cid = null;
let activeCommentElement = null;
let pressTimer = null;

// ==================== EVENT HANDLER UTILITIES ====================

/**
 * Sets up global event handlers for comment interactions
 * Handles both touch and mouse events for maximum compatibility
 */
function setupGlobalCommentHandlers() {
    // Clean up existing listeners first to avoid duplicates
    const handlers = [
        ['touchstart', handleGlobalTouchStart],
        ['touchend', handleGlobalTouchEnd],
        ['touchmove', handleGlobalTouchMove],
        ['mousedown', handleGlobalMouseDown],
        ['mouseup', handleGlobalMouseUp],
        ['mousemove', handleGlobalMouseMove]
    ];

    // Remove existing listeners
    handlers.forEach(([event, handler]) => {
        document.removeEventListener(event, handler);
    });

    // Add new listeners with proper passive options
    document.addEventListener('touchstart', handleGlobalTouchStart, { passive: true });
    document.addEventListener('touchend', handleGlobalTouchEnd);
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: true });
    document.addEventListener('mousedown', handleGlobalMouseDown);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mousemove', handleGlobalMouseMove);
}

/**
 * Handles comment sharing functionality
 * @param {string} entityId - The entity ID being commented on
 * @param {string} commentId - The comment ID to share
 * @param {string} replyId - Optional reply ID (for nested comments)
 */
async function handleShare(entityId, commentId, replyId = '') {
    try {
        const shareHash = AnchorModule.generateLink({
            type: replyId ? 'reply' : 'comment',
            ids: {
                entity: entityId,
                commentId,
                replyId
            }
        });

        const shareUrl = `${window.location.href.split('#')[0]}${shareHash}`;

        if (navigator.share) {
            await navigator.share({
                title: I18n.getTranslation('shareTitle'),
                text: I18n.getTranslation('shareText'),
                url: shareUrl
            });
            return;
        }

        // Fallback
        const toastContent = `
            <div class="share-url-container">${shareUrl}</div>
            <button class="quelora-btn active" id="quelora-share">
                ${I18n.getTranslation('copy')}
            </button>
        `;

        ToastModule.info(
            'share',
            I18n.getTranslation('copy'),
            toastContent,
            null,
            8000
        );

        UtilsModule.startTimeout(() => {
            const copyBtn = UiModule.getShareButtonUI();
            if (copyBtn) {
                copyBtn.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(shareUrl);
                        copyBtn.textContent = I18n.getTranslation('copied');

                        const toast = copyBtn.closest('.quelora-toast');
                        if (toast) {
                            toast.classList.remove('quelora-toast-visible');
                            setTimeout(() => toast.remove(), 300);
                        }
                    } catch (err) {
                        console.error('Error copying to clipboard:', err);
                    }
                });
            }
        }, 100);
    } catch (error) {
        handleError(error, 'CommentsModule.handleShare');
    }
}

// ==================== TOUCH/MOUSE EVENT HANDLERS ====================

/**
 * Handles touch start events for long press detection
 * @param {TouchEvent} e - Touch event
 */
function handleGlobalTouchStart(e) {
    const commentText = e.target.closest('.comment-text');
    if (!commentText) return;
    
    activeCommentElement = commentText.closest('.community-thread');
    if (!activeCommentElement) return;
    
    // Clear any existing timer
    if (pressTimer) clearTimeout(pressTimer);
    
    // Store initial touch position
    const touch = e.touches[0];
    activeCommentElement._touchStartX = touch.clientX;
    activeCommentElement._touchStartY = touch.clientY;
    
    // Set up long press timer
    pressTimer = setTimeout(() => {
        if (activeCommentElement) {
            UiModule.showEditCommentUI(activeCommentElement);
        }
    }, LONG_PRESS_DURATION);
}

/**
 * Handles touch end events
 */
function handleGlobalTouchEnd() {
    if (pressTimer) clearTimeout(pressTimer);
    activeCommentElement = null;
}

/**
 * Handles touch move events to cancel long press if user scrolls
 * @param {TouchEvent} e - Touch event
 */
function handleGlobalTouchMove(e) {
    if (!activeCommentElement || !pressTimer) return;
    
    const touch = e.touches[0];
    const startX = activeCommentElement._touchStartX || 0;
    const startY = activeCommentElement._touchStartY || 0;
    
    // Cancel long press if movement exceeds threshold
    if (Math.abs(touch.clientX - startX) > TOUCH_MOVE_THRESHOLD || 
        Math.abs(touch.clientY - startY) > TOUCH_MOVE_THRESHOLD) {
        clearTimeout(pressTimer);
        activeCommentElement = null;
    }
}

/**
 * Handles mouse down events for long press detection
 * @param {MouseEvent} e - Mouse event
 */
function handleGlobalMouseDown(e) {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    const commentText = e.target.closest('.comment-text');
    if (!commentText) return;
    
    activeCommentElement = commentText.closest('.community-thread');
    if (!activeCommentElement) return;
    
    if (pressTimer) clearTimeout(pressTimer);
    
    // Store initial mouse position
    activeCommentElement._mouseStartX = e.clientX;
    activeCommentElement._mouseStartY = e.clientY;
    
    // Set up long press timer
    pressTimer = setTimeout(() => {
        if (activeCommentElement && 
            activeCommentElement.querySelector('.comment-header').getAttribute('data-can-edit') === 'true') {
            UiModule.showEditCommentUI(activeCommentElement);
        }
    }, LONG_PRESS_DURATION);
}

/**
 * Handles mouse up events
 */
function handleGlobalMouseUp() {
    if (pressTimer) clearTimeout(pressTimer);
    activeCommentElement = null;
}

/**
 * Handles mouse move events to cancel long press if mouse moves
 * @param {MouseEvent} e - Mouse event
 */
function handleGlobalMouseMove(e) {
    if (!activeCommentElement || !pressTimer) return;
    
    const startX = activeCommentElement._mouseStartX || 0;
    const startY = activeCommentElement._mouseStartY || 0;
    
    // Cancel long press if movement exceeds threshold
    if (Math.abs(e.clientX - startX) > TOUCH_MOVE_THRESHOLD || 
        Math.abs(e.clientY - startY) > TOUCH_MOVE_THRESHOLD) {
        clearTimeout(pressTimer);
        activeCommentElement = null;
    }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Error handler for the module
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred
 * @returns {null} Always returns null for easy error propagation
 */
const handleError = (error, context) => {
    console.error(`Error in ${context}:`, error);
    return null;
};

/**
 * Counts how many reply levels deep a comment is
 * @param {HTMLElement} element - The comment element
 * @returns {number} The nesting level
 */
const countCommentRepliesAbove = (element) => {
    try {
        let count = 0;
        let currentElement = element;
        
        while (currentElement) {
            if (currentElement.classList.contains('comment-replies')) {
                count++;
            }
            currentElement = currentElement.parentElement;
        }
        
        return count;
    } catch (error) {
        handleError(error, 'CommentsModule.countCommentRepliesAbove');
        return 0;
    }
};

// ==================== CORE FUNCTIONS ====================

/**
 * Initializes the comments module
 * @param {Object} dependencies - Required dependencies
 * @param {Worker} dependencies.worker - Web Worker instance
 * @param {string} dependencies.token - Authentication token
 * @param {string} dependencies.cid - Client ID
 */
async function initializeComments(dependencies) {
    try {
        if (!dependencies || !dependencies.worker) {
            throw new Error('Missing required dependencies');
        }
        
        workerInstance = dependencies.worker;
        token = dependencies.token;
        cid = dependencies.cid;
        
        setupGlobalCommentHandlers();
    } catch (error) {
        handleError(error, 'CommentsModule.initializeComments');
    }
}

/**
 * Updates the authentication token
 * @param {string} newToken - The new authentication token
 */
async function setToken(newToken) {
    try {
        if (!newToken) {
            throw new Error('No token provided');
        }
        token = newToken;
    } catch (error) {
        handleError(error, 'CommentsModule.setToken');
    }
}

// ==================== COMMENT ACTIONS ====================

/**
 * Fetches comments for an entity
 * @param {string} entityId - The entity ID to fetch comments for
 * @param {string|null} lastCommentId - ID of the last fetched comment (for pagination)
 * @param {boolean} includeLast - Whether to include the last comment in results
 * @param {boolean} forceRefresh - Whether to force a refresh from server
 */
async function fetchComments(entityId, lastCommentId = null, includeLast = false, forceRefresh = false) {
    try {
        const commentsSection = UiModule.getCommunityThreadsUI();
        
        // Reset scroll position if loading first page
        if (!lastCommentId && commentsSection) {
            commentsSection.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        // Get current token
        token = SessionModule.getTokenIfAvailable();
        const threadsContainer = UiModule.getCommunityThreadsUI();

        // Clear container if loading first page
        if (!lastCommentId) {
            threadsContainer.replaceChildren();
        }

        // Determine how many comments to request
        const commentCount = UiModule.getCounterFromDOMUI(entityId, 'comments');
        const countToSend = lastCommentId ? DEFAULT_COMMENT_LIMIT : Math.min(commentCount || 1, DEFAULT_COMMENT_LIMIT);

        // Show loading indicators
        UiModule.addLoadingMessageUI(threadsContainer, {
            type: 'skeleton',
            position: 'after',
            empty: false,
            count: countToSend
        });

        // Prepare payload
        const payload = { 
            token, 
            entityId, 
            cid,
            ...(lastCommentId && { lastCommentId }),
            ...(includeLast && { includeLast }),
            ...(forceRefresh && { forceRefresh })
        };

        // Delay request slightly to allow animation to play
        UtilsModule.startTimeout(() => {
            workerInstance.postMessage({ 
                action: 'getComments', 
                payload 
            });
        }, 300);
    } catch (error) {
        handleError(error, 'CommentsModule.fetchComments');
    }
}

/**
 * Fetches nested comments for a specific comment
 * @param {string} entityId - The entity ID
 * @param {string} commentId - The parent comment ID
 * @param {string} replyId - The reply ID (optional)
 */
async function fetchNested(entityId, commentId, replyId) {
    try {
        token = SessionModule.getTokenIfAvailable();
        const threadsContainer = UiModule.getCommunityThreadsUI();
        
        // Clear container if no commentId provided
        if (!commentId) {
            threadsContainer?.replaceChildren();
        }
        
        // Show loading message
        UiModule.addLoadingMessageUI(threadsContainer, { type: 'message' });

        // Prepare payload
        const payload = { token, entityId, cid };
        if (commentId) payload.commentId = commentId;
        if (replyId) payload.replyId = replyId;
        
        workerInstance.postMessage({
            action: 'getNested',
            payload
        });
    } catch (error) {
        handleError(error, 'CommentsModule.fetchNested');
    }
}

/**
 * Fetches and creates a new comment
 * @param {string} entityId - The entity ID
 * @param {string} comment - The comment text
 * @param {string|null} replyId - The reply ID if this is a reply
 * @param {string|null} audioBase64 - Base64 encoded audio (optional)
 * @param {string|null} audioHash - Audio hash (optional)
 */
async function fetchComment(entityId, comment, replyId = null, audioBase64 = null, audioHash = null) {
    try {
        // Ensure we have a valid token
        token = await CoreModule.getTokenIfNeeded(token);
        
        // Prepare payload
        const payload = { 
            token, 
            entityId, 
            comment, 
            cid, 
            audioBase64, 
            audioHash 
        };
        
        if (replyId) {
            payload.replyId = replyId;
        }

        // Determine the appropriate container
        const container = UiModule.getCommunityUI();
        const threadsContainer = replyId
            ? UiModule.getCommentRepliesUI(replyId)
            : UiModule.getCommunityThreadsUI();

        // Remove existing quelora-empty-container
        const emptyContainer = container.querySelector('.quelora-empty-container');
        if (emptyContainer) {
            emptyContainer.remove();
        }


        // Add loading indicator
        if (threadsContainer) {
            const position = replyId ? 'after' : 'before';
            UiModule.addLoadingMessageUI(threadsContainer, { 
                type: 'skeleton', 
                position: position, 
                empty: false, 
                count: 1 
            });
        }

        // Send message to worker
        workerInstance.postMessage({
            action: 'createComment',
            payload
        });
    } catch (error) {
        handleError(error, 'CommentsModule.fetchComment');
    }
}

/**
 * Reports a comment
 * @param {string} entityId - The entity ID
 * @param {string} commentId - The comment ID to report
 * @param {string} type - The type of report
 */
async function fetchReportComment(entityId, commentId, type, hideAuthorContent = false) {
    try {
        token = await CoreModule.getTokenIfNeeded(token);
        const payload = { 
            token, 
            entityId, 
            commentId, 
            type, 
            cid,
            hideAuthorContent
        };
        
        workerInstance.postMessage({
            action: 'reportComment',
            payload
        });
    } catch (error) {
        handleError(error, 'CommentsModule.fetchReportComment');
    }
}

/**
 * Deletes a comment
 * @param {string} entityId - The entity ID
 * @param {string} commentId - The comment ID to delete
 */
async function fetchDelComment(entityId, commentId) {
    try {
        token = await CoreModule.getTokenIfNeeded(token);
        
        // Remove comment from DOM immediately
        const commentContainer = UiModule.getCommentHeaderUI(commentId, true);
        
        if (commentContainer) {
            commentContainer.remove();
        }

        // Send delete request
        const payload = { 
            token, 
            entityId, 
            commentId, 
            cid 
        };
        
        workerInstance.postMessage({
            action: 'delComment',
            payload
        });
    } catch (error) {
        handleError(error, 'CommentsModule.fetchDelComment');
    }
}

/**
 * Edits an existing comment
 * @param {string} entityId - The entity ID
 * @param {string} commentId - The comment ID to edit
 * @param {string} editComment - The new comment text
 */
async function fetchEditComment(entityId, commentId, editComment) {
    try {
        token = await CoreModule.getTokenIfNeeded(token);
        const payload = { 
            token, 
            entityId, 
            commentId, 
            editComment, 
            cid 
        };
        
        // Get the comment container
        const threadsContainer = UiModule.getCommentHeaderUI(commentId, true);
        
        threadsContainer.setAttribute('data-comment-id', commentId);

        // Add loading indicator
        if (threadsContainer) {
            UiModule.addLoadingMessageUI(threadsContainer, { 
                type: 'message', 
                position: 'before',
                empty: true 
            });
        }

        workerInstance.postMessage({
            action: 'editComment',
            payload
        });
    } catch (error) {
        handleError(error, 'CommentsModule.fetchEditComment');
    }
}

/**
 * Fetches replies for a comment
 * @param {string} entityId - The entity ID
 * @param {string} commentId - The parent comment ID
 * @param {string|null} lastCommentId - Last fetched comment ID (for pagination)
 */
async function fetchReplies(entityId, commentId, lastCommentId = null) {
    try {
        token = SessionModule.getTokenIfAvailable();
        const repliesContainer = UiModule.getCommentRepliesUI(commentId);
        
        UiModule.addLoadingMessageUI(repliesContainer, { type: 'message' });

        const payload = { 
            token, 
            entityId, 
            commentId, 
            cid 
        };
        
        if (lastCommentId) {
            payload.lastCommentId = lastCommentId;
        }
        
        workerInstance.postMessage({
            action: 'getReplies',
            payload
        });
    } catch (error) {
        handleError(error, 'CommentsModule.fetchReplies');
    }
}

/**
 * Fetches likes for a comment or entity
 * @param {string} entityId - The entity ID
 * @param {string|null} commentId - The comment ID (optional)
 */
async function fetchGetLikes(entityId, commentId = null) {
    try {
        // Open likes drawer
        UiModule.likesDrawerUI.open();
        
        // Get token if needed
        token = await CoreModule.getTokenIfNeeded(token);
        
        // Add loading indicator
        const likesContainer = UiModule.getLikesListUI();
        UiModule.addLoadingMessageUI(likesContainer, { type: 'message' });
        
        // Prepare payload
        const payload = { 
            token, 
            entityId, 
            cid 
        };
        
        if (commentId) {
            payload.commentId = commentId;
        }
        
        workerInstance.postMessage({
            action: 'getCommentLikes',
            payload
        });
    } catch (error) {
        handleError(error, 'CommentsModule.fetchGetLikes');
    }
}

/**
 * Likes or unlikes a comment
 * @param {string} entityId - The entity ID
 * @param {string} commentId - The comment ID
 * @param {boolean} liked - Whether to like or unlike
 */
async function fetchCommentLike(entityId, commentId, liked) {
    try {
        token = await CoreModule.getTokenIfNeeded();
        const payload = { 
            token, 
            entityId, 
            commentId, 
            liked, 
            cid 
        };
        
        workerInstance.postMessage({
            action: 'setLikeComment',
            payload
        });
    } catch (error) {
        handleError(error, 'CommentsModule.fetchCommentLike');
    }
}

/**
 * Updates UI and sends like request
 * @param {string} entityId - The entity ID
 * @param {string} commentId - The comment ID
 * @param {boolean} liked - Whether to like or unlike
 */
async function setCommentLike(entityId, commentId, liked) {
    try {
        const interactionElement = UiModule.getCommentHeaderUI(commentId, false);
        
        if (!interactionElement) {
            console.error(`Element not found.`);
            return;
        }
        
        // Update UI immediately
        UiModule.updateLikeUI(interactionElement, liked);
        
        // Send like request
        fetchCommentLike(entityId, commentId, liked);
    } catch (error) {
        handleError(error, 'CommentsModule.setCommentLike');
    }
}

/**
 * Translates a comment
 * @param {string} entityId - The entity ID
 * @param {string} commentId - The comment ID to translate
 */
async function fetchTranslate(entityId, commentId) {
    try {
        token = await CoreModule.getTokenIfNeeded(token);
        const payload = { 
            token, 
            entityId, 
            commentId, 
            cid 
        };
        
        const threadsContainer = UiModule.getCommentHeaderUI(commentId, true).parentElement;
        
        const textContainer = threadsContainer.querySelector('.comment-text');
        
        // Store original text
        threadsContainer.querySelector('.comment-header')
            .setAttribute('data-text-original', textContainer.textContent);
        
        // Add loading indicator
        if (threadsContainer) {
            UiModule.addLoadingMessageUI(textContainer, { 
                type: 'message', 
                position: 'before',
                empty: true 
            });
        }

        workerInstance.postMessage({
            action: 'translateComment',
            payload
        });
    } catch (error) {
        handleError(error, 'CommentsModule.fetchTranslate');
    }
}

/**
 * Fetches audio for a comment
 * @param {string} commentId - The comment ID
 */
async function fetchAudio(commentId) {
    try {
        token = await CoreModule.getTokenIfNeeded(token);
        const payload = { 
            token, 
            commentId, 
            cid 
        };
        
        workerInstance.postMessage({
            action: 'getCommentAudio',
            payload
        });
    } catch (error) {
        handleError(error, 'CommentsModule.fetchAudio');
    }
}

// ==================== UI COMPONENT CREATION ====================

/**
 * Creates a comment DOM element
 * @param {Object} comment - Comment data
 * @param {Object} entity - Entity data
 * @param {boolean} isReply - Whether this is a reply
 * @returns {HTMLElement|null} The created comment element or null on error
 */
function createCommentElement(comment, entity, isReply) {
    try {
        // Create main container
        const commentElement = UiModule.createElementUI({
            tag: 'div',
            classes: ['community-thread'],
            attributes: { 'data-author-id': comment.author }
        });
        
        // Set default replies count if not provided
        if (comment.repliesCount === undefined) {
            comment.repliesCount = 0;
        }

        // Prepare comment data
        const initials = comment.profile?.name?.split(' ')
            .map(name => name[0])
            .join('')
            .toUpperCase() || '';
            
        const timeAgo = UtilsModule.getTimeAgo(comment.timestamp ?? comment.created_at);
        const repliesText = comment.repliesCount === 1 
            ? "{{answer}}" 
            : "{{answers}}";
            
        const likeIconClass = comment.authorLiked 
            ? 'quelora-icons-outlined active' 
            : 'quelora-icons-outlined';
            
        const likeIcon = comment.authorLiked 
            ? 'favorite' 
            : 'favorite_border';

        // Calculate edit permissions
        const editLimitTime = UtilsModule.getConfig(entity)?.editing?.edit_time_limit;
        const currentTime = new Date();
        const commentTime = new Date(comment.timestamp ?? comment.created_at);
        const timeDiff = (currentTime - commentTime) / (1000 * 60);
        const canEditOrDelete = timeDiff < editLimitTime && 
                              comment.repliesCount === 0 && 
                              !comment.hasAudio;

        // Create comment header
        const commentHeader = UiModule.createElementUI({
            tag: 'div',
            classes: ['comment-header'],
            attributes: {
                'data-is-reply': isReply,
                'data-comment-id': comment._id,
                'data-can-edit': comment.authorOwner && canEditOrDelete,
                'data-can-delete': comment.authorOwner && canEditOrDelete,
                'data-comment-language': comment.language,
                'data-text-original': comment.text,
                'data-owner': comment.authorOwner
            }
        });

        // Create avatar
        const commentAvatar = UiModule.createElementUI({
            tag: 'div',
            classes: ['comment-avatar'],
            content: initials,
            attributes: { 'data-visibility': comment.profile?.visibility }
        });

        // Create comment info section
        const commentInfo = UiModule.createElementUI({
            tag: 'div',
            classes: ['comment-info']
        });

        const commentAuthor = UiModule.createElementUI({
            tag: 'span',
            classes: 'comment-author',
            attributes: {
                'data-author-user': comment.profile.author
            },
            content: comment.profile.name || I18n.getTranslation('user'),
            translate: !comment.profile.name
        });

        const commentTimeElement = UiModule.createElementUI({
            tag: 'span',
            classes: 'comment-time'
        });

        if (comment.isEdited) {
            const editedSpan = UiModule.createElementUI({
                tag: 'span',
                content: '{{edited}}',
                translate: true
            });
            
            const timeAgoSpan = UiModule.createElementUI({
                tag: 'span',
                content: timeAgo,
                translate: true
            });
                
            commentTimeElement.appendChild(editedSpan);
            commentTimeElement.appendChild(document.createTextNode(' - '));
            commentTimeElement.appendChild(timeAgoSpan);
        } else {
            const timeAgoSpan = UiModule.createElementUI({
                tag: 'span',
                classes: 't',
                content: timeAgo,
                translate: true
            });
            commentTimeElement.appendChild(timeAgoSpan);
        }

        commentInfo.appendChild(commentAuthor);
        commentInfo.appendChild(commentTimeElement);

        // Create like section
        const commentLike = UiModule.createElementUI({
            tag: 'div',
            classes: 'comment-like'
        });

        const likeIconElement = UiModule.createElementUI({
            tag: 'span',
            classes: ['like-icon', ...likeIconClass.split(' ')],
            content: likeIcon
        });

        const likeCount = UiModule.createElementUI({
            tag: 'span',
            classes: 'like-count',
            content: comment.likes?.toString()
        });

        commentLike.appendChild(likeIconElement);
        commentLike.appendChild(likeCount);

        // Assemble header
        commentHeader.appendChild(commentAvatar);
        commentHeader.appendChild(commentInfo);
        commentHeader.appendChild(commentLike);

        // Create comment text
        const commentText = UiModule.createElementUI({
            tag: 'div',
            classes: 'comment-text'
        });
        commentText.appendChild(
            MentionModule.processTextWithMentions(
                comment.text, 
                ProfileModule.getMention
            )
        );

        // Add elements to main container
        commentElement.appendChild(commentHeader);
        commentElement.appendChild(commentText);

        // Add audio if available
        if (comment.hasAudio) {
            const audioContainer = UiModule.createElementUI({
                tag: 'div',
                classes: 'comment-audio-container'
            });
            const audioUI = UiModule.audioUI(
                comment.text, 
                null, 
                comment.audioHash, 
                comment._id
            );
            
            if (audioContainer && audioUI) {
                audioContainer.appendChild(audioUI);
                commentElement.appendChild(audioContainer);
            }
        }

        // Create action buttons
        const commentActions = UiModule.createElementUI({ tag: 'div', classes: ['comment-actions'] });
        // Settings button
        const settingsIcon = UiModule.createElementUI({
            tag: 'span',
            classes: ['quelora-icons-outlined', 'setting-comment'],
            attributes: { 'data-comment-id': comment._id },
            content: 'settings'
        });
        commentActions.appendChild(settingsIcon);

        // Reply button if allowed
        if (UtilsModule.getConfig(entity)?.interaction?.allow_replies) {
            const replyLink = UiModule.createElementUI({
                tag: 'span',
                classes: ['reply-text'],
                attributes: { 'data-reply-id': comment._id },
                content: '{{reply}}',
                translate: true
            });
            commentActions.appendChild(replyLink);
        }

        // Translate button if needed
        if (UtilsModule.getConfig(entity)?.language?.auto_translate) {
            const translateLink = UiModule.createElementUI({
                tag: 'span',
                classes: ['translate-text'],
                attributes: { 'data-comment-id': comment._id },
                content: '{{translate}}',
                translate: true
            });
            
            const queloraLanguage = ConfModule.get(
                'quelora.language', 
                navigator.language.substring(0, 2)
            );
            
            if (comment.language !== queloraLanguage) {
                commentActions.appendChild(translateLink);
            }
        } 
        
        // Share button if allowed
        if (UtilsModule.getConfig(entity)?.interaction?.allow_shares) {
            const shareLink = UiModule.createElementUI({
                tag: 'span',
                classes: ['share-text'],
                attributes: { 'data-comment-id': comment._id },
                content: '{{share}}',
                translate: true
            });
            commentActions.appendChild(shareLink);
        }

        // View replies button if there are replies
        if (comment.repliesCount > 0) {
            const viewReplies = UiModule.createElementUI({
                tag: 'span',
                classes: ['view-replies'],
                attributes: { 'data-comment-id': comment._id }
            });
            
            const view = UiModule.createElementUI({
                tag: 'span',
                content: `{{view}}`,
                translate: true
            });

            const counter = UiModule.createElementUI({
                tag: 'span',
                content: ` ${comment.repliesCount} `
            });

            const asware = UiModule.createElementUI({
                tag: 'span',
                content: repliesText,
                translate: true
            });
            
            viewReplies.appendChild(view);
            viewReplies.appendChild(counter);
            viewReplies.appendChild(asware);
            
            commentActions.appendChild(viewReplies);
        }

        commentElement.appendChild(commentActions);

        // Create replies container
        const commentReplies = UiModule.createElementUI({
            tag: 'div',
            classes: ['comment-replies'],
            attributes: { 'data-reply-id': comment._id }
        });
        commentElement.appendChild(commentReplies);
    
        // Add profile picture if available
        if (comment.profile.picture) {
            commentAvatar.style.backgroundImage = `url('${comment.profile.picture}')`;
            commentAvatar.style.backgroundSize = 'cover';
            commentAvatar.style.backgroundPosition = 'center';
            commentAvatar.style.backgroundRepeat = 'no-repeat';
            commentAvatar.innerHTML = '';
        }

        // Attach event listeners
        attachCommentEventListeners(commentElement, comment, entity);

        return commentElement;
    } catch (error) {
        handleError(error, 'CommentsModule.createCommentElement');
        return null;
    }
}

/**
 * Renders translated text for a comment
 * @param {string} commentId - The ID of the comment to translate
 * @param {string} translation - The translated text
 */
async function renderTranslate(commentId, translation) {
    try {
        const threadsContainer = UiModule.getCommentHeaderUI(commentId, true);
        
        if (!threadsContainer) {
            throw new Error(`Comment container not found for ID: ${commentId}`);
        }

        const textContainer = threadsContainer.querySelector('.comment-text');
        
        // Remove loading indicator
        UiModule.getCommunityThreadsUI()
            ?.querySelector('.quelora-loading-message')
            ?.remove();

        // Store original text if not already stored
        if (!threadsContainer.hasAttribute('data-text-original')) {
            threadsContainer.setAttribute(
                'data-text-original', 
                textContainer.textContent
            );
        }

        // Update text content
        if (textContainer) {
            textContainer.textContent = translation;
        }

        // Update translate button text
        const translateLink = threadsContainer.querySelector('.translate-text');
        if (translateLink) {
            translateLink.textContent = I18n.getTranslation('original');
        }
    } catch (error) {
        handleError(error, 'CommentsModule.renderTranslate');
    }
}

/**
 * Renders a list of comments into a container
 * @param {Object} entity - The entity data
 * @param {Array} comments - Array of comment objects
 * @param {HTMLElement} container - DOM element to render into
 */
function renderCommentList(entity, comments, container) {
    const fragment = document.createDocumentFragment();

    const getColorByLevel = (level) => {
        const levels = [
            "level-0", "level-1", "level-2", "level-3", 
            "level-4", "level-5", "level-6", 
            "level-7", "level-8", "level-9"
        ];
        return (typeof level === 'number' && level >= 0 && level < levels.length) 
            ? levels[level] 
            : 'level-default';
    };

    if (!container.classList.contains('comment-replies') && 
        comments.length === 0 && 
        container.children.length === 0) {
        const emptyContainer = UiModule.createElementUI({
            tag: 'div',
            classes: 'quelora-empty-container',
            content: '{{emptyComments}}',
            translate: true
        });
        fragment.appendChild(emptyContainer);
    } else {
        comments.forEach(comment => {
            if (ProfileModule.isBlockedAuthor(comment.author)) return;
            
            const replyCount = countCommentRepliesAbove(container);
            const commentElement = createCommentElement(comment, entity, replyCount !== 0);
            if (!commentElement) return;

            const levelColor = getColorByLevel(replyCount);
            const replyDiv = commentElement.querySelector('.comment-replies');
            if (replyDiv) replyDiv.classList.add(levelColor);

            fragment.appendChild(commentElement);
        });
    }

    container.appendChild(fragment);
}

/**
 * Renders comments payload into the UI
 * @param {Object} payload - Comments data payload
 * @param {string} payload.entity - Entity ID
 * @param {string} payload.commentId - Optional parent comment ID
 * @param {Object} payload.comments - Comments data
 * @param {Array} payload.comments.list - Array of comments
 * @param {boolean} payload.comments.hasMore - Whether more comments are available
 */
function renderComments(payload) {
    try {
        let threadsContainer = payload.commentId
            ? UiModule.getCommentRepliesUI(payload.commentId)
            : UiModule.getCommunityThreadsUI();

        // Clear container if entity changed
        if (!payload.commentId && 
            threadsContainer.getAttribute('data-threads-entity') !== payload.entity) {
            threadsContainer.setAttribute('data-threads-entity', payload.entity);
            threadsContainer.replaceChildren();
        }

        // Remove loading indicator
        UiModule.getCommunityThreadsUI()
            ?.querySelector('.quelora-loading-message')
            ?.remove();

        // Render comments
        renderCommentList(payload.entity, payload.comments.list, threadsContainer);

        // Add "Load More" if there are more comments
        if (payload.comments.hasMore) {
            const loadMoreLink = UiModule.createElementUI({
                tag: 'a',
                attributes: {
                    href: 'javascript:void(0);'
                },
                content: '{{more}}',
                classes: 'load-more-comments',
                translate: true
            });
            
            loadMoreLink.addEventListener('click', (event) => {
                try {
                    event.preventDefault();
                    const comments = threadsContainer.querySelectorAll('.community-thread .comment-header');
                    const lastComment = comments[comments.length - 1];
                    const lastCommentId = lastComment?.getAttribute('data-comment-id');
                    
                    if (threadsContainer.classList.contains('comment-replies')) {
                        const commentId = threadsContainer.getAttribute('data-reply-id');
                        fetchReplies(payload.entity, commentId, lastCommentId);
                    } else {
                        fetchComments(payload.entity, lastCommentId);
                    }
                    
                    loadMoreLink.remove();
                } catch (error) {
                    console.error('Error in load more click handler:', error);
                }
            });

            threadsContainer.appendChild(loadMoreLink);

            // Set up intersection observer for auto-loading
            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    loadMoreLink.click();
                    observer.disconnect();
                }
            }, { threshold: 1.0 });
            
            observer.observe(loadMoreLink);
        }
    } catch (error) {
        handleError(error, 'CommentsModule.renderComments');
    }
}

/**
 * Renders nested comments with retry logic
 * @param {Object} nestedData - Nested comments data
 * @param {string} nestedData.entityId - Entity ID
 * @param {string} nestedData.commentId - Parent comment ID
 * @param {Array} nestedData.list - Array of nested comments
 * @param {string} scrollTo - Comment ID to scroll to
 */
async function renderNestedComments(nestedData, scrollTo) {
    let attemptCount = 0;

    const tryRender = async () => {
        const threadRoot = UiModule.getCommunityThreadsUI().querySelector(
            `.community-thread [data-comment-id="${nestedData.commentId}"]`
        )?.closest('.community-thread');

        if (!threadRoot) {
            attemptCount++;
            if (attemptCount >= MAX_RENDER_ATTEMPTS) {
                console.error(
                    `Thread root for comment ${nestedData.commentId} not found after ${MAX_RENDER_ATTEMPTS} attempts`
                );
                await shakeComment(scrollTo);
                return;
            }
            UtilsModule.startTimeout(tryRender, RENDER_ATTEMPT_INTERVAL);
            return;
        }

        UiModule.getCommunityThreadsUI()
            ?.querySelector('.quelora-loading-message')
            ?.remove();

        renderCommentList(nestedData.entityId, nestedData.list, threadRoot);

        /**
         * Recursively renders nested replies
         * @param {Array} comments - Comments to render
         * @param {HTMLElement} parentContainer - Parent DOM element
         */
        const renderRepliesRecursively = (comments, parentContainer) => {
            comments.forEach(comment => {
                const replyContainer = parentContainer.querySelector(
                    `.comment-replies[data-reply-id="${comment._id}"]`
                );

                if (replyContainer && comment.replies?.list?.length > 0) {
                    renderCommentList(
                        nestedData.entityId,
                        comment.replies.list,
                        replyContainer
                    );
                    renderRepliesRecursively(comment.replies.list, replyContainer);
                }
            });
        };

        renderRepliesRecursively(nestedData.list, threadRoot);
        threadRoot.querySelectorAll(
            `.view-replies[data-comment-id], .view-replies`
        ).forEach(el => el.remove());

        await shakeComment(scrollTo);
    };

    tryRender();
}


/**
 * Attaches event listeners to comment input elements
 * @param {string} entityId - The entity ID these comments belong to
 */
function attachCommentInputListener(entityId) {
    try {
        const communityThreads = UiModule.getCommunityThreadsUI();
        const commentSection = UiModule.getCommunityUI();
        const commentBarContainer = commentSection?.querySelector('.comment-bar-container');
        const commentBarContainerDisable = commentSection?.querySelector('.comment-disable-container');

        // Check if comments are closed for this entity
        const config = UtilsModule.getConfig(entityId);
        if (config?.comment_status === 'closed') {
            if (commentBarContainerDisable) commentBarContainerDisable.style.display = 'block';
            if (commentBarContainer) commentBarContainer.style.display = 'none';
            return;
        }

        // Show comment input if not closed
        if (commentBarContainerDisable) commentBarContainerDisable.style.display = 'none';
        if (commentBarContainer) commentBarContainer.style.display = '';

        // Get input elements
        const commentInput = UiModule.getCommentInputUI();
        const sendInput = UiModule.getSendButtonUI();
        
        if (!commentInput) return;

        // Initialize mention functionality
        new MentionModule(
            commentInput, 
            ProfileModule.findMention, 
            { debounceTime: 600 }
        );

        // Initialize progress bar for input
        ProgressInput("quelora-input", "quelora-input-bar");

        // Handle Enter key submission
        commentInput.addEventListener('keydown', (event) => {
            try {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submitComment();
                    commentInput.blur();
                }
            } catch (error) {
                handleError(error, 'CommentsModule.commentInputKeydown');
            }
        });

        // Handle send button click
        if (sendInput) {
            sendInput.addEventListener('click', (event) => {
                try {
                    event.preventDefault();
                    submitComment();
                    commentInput.blur();
                    
                    // Hide emoji picker if visible
                    const pickerContainer = UiModule.getPickerContainerUI();
                    if (pickerContainer) pickerContainer.style.display = 'none';
                } catch (error) {
                    handleError(error, 'CommentsModule.sendInputClick');
                }
            });
        }

        // Blur input when clicking on threads
        if (communityThreads) {
            communityThreads.addEventListener('click', () => {
                if (document.activeElement === commentInput) {
                    commentInput.blur();
                }
            });
        }

        // Add voice recording if enabled
        if (ConfModule.get('audio.enable_mic_transcription', false)) {
            AudioRecorderModule.addVoiceButton({
                iconReferenceElement: commentInput,
                transcriptReferenceElement: commentInput,
                onResult: (transcript, audioBase64, audioHash) => {
                    CommentsModule.callbackRecord(transcript, audioBase64, audioHash);
                }
            });
        }

        AIModule.addAIButton();
        
    } catch (error) {
        handleError(error, 'CommentsModule.attachCommentInputListener');
    }
}

/**
 * Handles audio recording callback and shows preview modal
 * @param {string} transcript - Transcribed text from audio
 * @param {string} audioBase64 - Base64 encoded audio data
 * @param {string} audioHash - Unique hash for the audio
 */
async function callbackRecord(transcript, audioBase64, audioHash) {
    try {
        const commentInput = UiModule.getCommentInputUI();
        if (!commentInput) return;

        // Set transcript in input field
        commentInput.value = transcript;
        
        // Store audio data if configured
        if (ConfModule.get('audio.save_comment_audio', false)) {
            commentInput.setAttribute('quelora-audio-data', audioBase64);
            commentInput.setAttribute('quelora-audio-hash', audioHash);
        }

        // Get user profile for preview
        const ownProfile = await ProfileModule.getOwnProfile();
        const initials = ownProfile?.name?.split(' ')
            .map(name => name[0])
            .join('')
            .toUpperCase() || '';

        // Create preview modal content
        const editContainer = UiModule.createElementUI({
            tag: 'div',
            classes: 'edit-comment-container'
        });

        const avatarTextContainer = UiModule.createElementUI({
            tag: 'div',
            classes: 'avatar'
        });

        const avatar = UiModule.createElementUI({
            tag: 'div',
            classes: 'comment-avatar',
            content: initials
        });

        // Set profile picture if available
        if (ownProfile?.picture) {
            avatar.style.backgroundImage = `url('${ownProfile.picture}')`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
            avatar.style.backgroundRepeat = 'no-repeat';
            avatar.textContent = '';
        }

        const transcriptText = UiModule.createElementUI({
            tag: 'p',
            classes: 'transcript-text',
            content: transcript
        });

        avatarTextContainer.appendChild(avatar);
        avatarTextContainer.appendChild(transcriptText);

        // Add audio player
        const audioContainer = UiModule.audioUI(transcript, audioBase64, audioHash);

        editContainer.appendChild(avatarTextContainer);
        editContainer.appendChild(audioContainer);

        // Modal action buttons
        const buttons = [
            {
                className: 'quelora-btn send-button t',
                textContent: '{{send}}',
                icon: 'send',
                onClick: () => {
                    submitComment();
                    UiModule.closeModalUI();
                }
            },
            {
                className: 'quelora-btn close-button t',
                textContent: '{{close}}',
                icon: 'close',
                onClick: () => {
                    const commentInput = UiModule.getCommentInputUI();
                    if (commentInput) {
                        commentInput.value = '';
                        commentInput.removeAttribute('quelora-audio-data');
                        commentInput.removeAttribute('quelora-audio-hash');
                        commentInput.removeAttribute('data-reply-id');
                    }
                    UiModule.closeModalUI();
                }
            }
        ];

        // Show preview modal
        UiModule.setupModalUI(editContainer, buttons, '.quelora-comments');
    } catch (error) {
        handleError(error, 'CommentsModule.callbackRecord');
    }
}

/**
 * Handles comment submission
 */
async function submitComment() {
    try {
        const commentInput = UiModule.getCommentInputUI();
        if (!commentInput) return;

        const commentText = commentInput.value.trim();
        if (!commentText) return;

        const replyId = commentInput.getAttribute('data-reply-id');
        const threadsContainer = UiModule.getCommunityThreadsUI();
        const currentEntity = threadsContainer?.getAttribute('data-threads-entity');
        
        if (!currentEntity) {
            throw new Error('Could not determine current entity');
        }

        // Get audio data if configured
        let audioBase64 = null;
        let audioHash = null;
        if (ConfModule.get('audio.save_comment_audio', false)) {
            audioBase64 = commentInput.getAttribute('quelora-audio-data');
            audioHash = commentInput.getAttribute('quelora-audio-hash');
        }

        // Submit comment
        fetchComment(currentEntity, commentText, replyId, audioBase64, audioHash);
        
        // Reset input
        commentInput.value = '';
        commentInput.removeAttribute('data-reply-id');
        commentInput.removeAttribute('quelora-audio-data');
        commentInput.removeAttribute('quelora-audio-hash');
        
        // Update UI
        UiModule.removeHeaderUI();
        UtilsModule.setInputLimit(
            UtilsModule.getConfig(currentEntity)?.limits?.comment_text
        );
        ProgressInput("quelora-input", "quelora-input-bar");

        // Hide picker if visible
        const pickerContainer = UiModule.getPickerContainerUI();
        if (pickerContainer) pickerContainer.style.display = 'none';
    } catch (error) {
        handleError(error, 'CommentsModule.submitComment');
    }
}

/**
 * Applies shake animation to a comment
 * @param {string} commentId - ID of the comment to shake
 */
async function shakeComment(commentId) {
    try {
        const commentElement = UiModule.getCommentHeaderUI(commentId);
        
        if (commentElement) {
            const elementPosition = commentElement.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({ top: elementPosition - 100,behavior: 'smooth'});
            commentElement.classList.add('shake-animation');
            UtilsModule.startTimeout(() => { commentElement.classList.remove('shake-animation');}, 2500);
        }
    } catch (error) {
        handleError(error, 'CommentsModule.shakeComment');
    }
}

/**
 * Attaches event listeners to comment elements
 * @param {HTMLElement} commentElement - The comment DOM element
 * @param {Object} comment - The comment data
 * @param {Object} entity - The entity data
 */
async function attachCommentEventListeners(commentElement, comment, entity) {
    try {
        // Cache profile data
        ProfileModule.memberProfiles.set(comment.author, comment?.profile);

        // View replies button
        const viewRepliesButton = commentElement.querySelector('.view-replies');
        if (viewRepliesButton) {
            viewRepliesButton.addEventListener('click', (event) => {
                event.preventDefault();
                fetchReplies(entity, comment._id);
                viewRepliesButton.remove();
            });
        }

        // Profile view button
        const viewProfileButton = commentElement.querySelector('.comment-avatar');
        if (viewProfileButton) {
            viewProfileButton.addEventListener('click', (event) => {
                event.preventDefault();
                ProfileModule.getProfile(comment.author);
            });
        }

        // Like button handlers
        const viewLikeButton = commentElement.querySelector('.comment-like');
        const likeButton = commentElement.querySelector('.like-icon');

        if (likeButton && viewLikeButton) {
            let pressTimer = null;
            let longPressAction = false;
            let startX, startY;

            const handlePressStart = (event) => {
                longPressAction = false;
                
                // Store initial position for touch events
                if (event.type === 'touchstart') {
                    startX = event.touches[0].clientX;
                    startY = event.touches[0].clientY;
                }

                const handleLongPress = () => {
                    longPressAction = true;
                    const commentId = commentElement.getAttribute('data-comment-id') || 
                                      commentElement.querySelector('.comment-header')
                                        .getAttribute('data-comment-id');
                    
                    fetchGetLikes(entity, commentId);
                };

                pressTimer = UtilsModule.startTimeout(handleLongPress, LONG_PRESS_DURATION);
            };

            const handlePressEnd = (event) => {
                clearTimeout(pressTimer);
                if (!longPressAction) {
                    const liked = likeButton.textContent === "favorite_border";
                    setCommentLike(entity, comment._id, liked);
                }
                event.preventDefault();
            };

            const handlePressMove = (event) => {
                if (event.type === 'touchmove') {
                    const moveX = event.touches[0].clientX;
                    const moveY = event.touches[0].clientY;
                    if (Math.abs(moveX - startX) > TOUCH_MOVE_THRESHOLD || 
                        Math.abs(moveY - startY) > TOUCH_MOVE_THRESHOLD) {
                        clearTimeout(pressTimer);
                    }
                }
            };

            // Add event listeners
            viewLikeButton.addEventListener('touchstart', handlePressStart, { passive: true });
            viewLikeButton.addEventListener('touchend', handlePressEnd);
            viewLikeButton.addEventListener('touchmove', handlePressMove, { passive: true });
            
            viewLikeButton.addEventListener('mousedown', handlePressStart);
            viewLikeButton.addEventListener('mouseup', handlePressEnd);
            viewLikeButton.addEventListener('mouseleave', () => clearTimeout(pressTimer));
        }

        // Settings button
        const settingsButton = commentElement.querySelector('.setting-comment');
        if (settingsButton) {
            settingsButton.addEventListener('click', (event) => {
                event.preventDefault();
                const commentElement = event.target.closest('.community-thread');
                if (commentElement) {
                    UiModule.showEditCommentUI(commentElement);
                }
            });
        }

        // Reply button
        const replyLink = commentElement.querySelector('.reply-text');
        if (replyLink) {
            replyLink.addEventListener('click', (event) => {
                event.preventDefault();
                UtilsModule.setInputLimit(
                    UtilsModule.getConfig(entity)?.limits?.reply_text
                );
                
                const replyId = replyLink.getAttribute('data-reply-id');
                const commentInput = UiModule.getCommentInputUI();
                const commentHeader = commentElement.querySelector('.comment-header');
                
                if (commentInput && commentHeader) {
                    commentInput.setAttribute('data-reply-id', replyId);
                    UiModule.addReplyHeaderUI(commentHeader, replyId);
                    commentInput.focus();
                }
            });
        }

        // Translate button
        const translateLink = commentElement.querySelector('.translate-text');
        if (translateLink) {
            translateLink.addEventListener('click', (event) => {
                event.preventDefault();
                const currentText = commentElement.querySelector('.comment-text').textContent;
                const originalText = commentElement.querySelector('.comment-header')
                    .getAttribute('data-text-original');
                
                if (currentText === originalText) {
                    fetchTranslate(entity, comment._id);
                } else {
                    commentElement.querySelector('.comment-text').textContent = originalText;
                    translateLink.textContent = I18n.getTranslation('translate');
                }
            });
        }

        function findOriginalComment(element, lastCommentId = '') {
            if (!element) return lastCommentId;
            if (element.classList.contains('community-threads')) {
                return lastCommentId;
            }
            if (element.classList.contains('community-thread')) {
                const header = element.querySelector('.comment-header');
                if (header) {
                    lastCommentId = header.getAttribute('data-comment-id') || lastCommentId;
                }
            }
            return findOriginalComment(element.parentElement, lastCommentId);
        }

        // Share button
        const shareButton = commentElement.querySelector('.share-text');
        if (shareButton) {
            shareButton.addEventListener('click', (event) => {
                event.preventDefault();
                const commentId = event.target.getAttribute('data-comment-id');
                const originalComment = findOriginalComment(event.target.closest('.community-thread'));
                const currentEntity = event.target.closest('.community-threads')?.getAttribute('data-threads-entity');
                handleShare(
                    currentEntity,
                    originalComment || commentId,
                    originalComment ? commentId : ''
                );
            });
        }
    } catch (error) {
        handleError(error, 'CommentsModule.attachCommentEventListeners');
    }
}

/**
 * Updates like counts for all visible comments
 */
async function updateAllCommentLikes() {
    try {
        const threadsContainer = UiModule.getCommunityThreadsUI();
        if (!threadsContainer) return;

        const entityId = threadsContainer.getAttribute('data-threads-entity');
        if (!entityId) return;

        const commentHeaders = UiModule.getCommentHeaderUI();
        const commentIds = Array.from(commentHeaders)
            .map(header => header.getAttribute('data-comment-id'));

        if (commentIds.length === 0) return;

        // Get fresh token if needed
        token = await CoreModule.getTokenIfNeeded(token, true);
        
        workerInstance.postMessage({
            action: 'fetchCommentLikes',
            payload: { token, entityId, commentIds, cid }
        });
    } catch (error) {
        handleError(error, 'CommentsModule.updateAllCommentLikes');
    }
}

// ==================== PUBLIC API ====================
const CommentsModule = {
    initializeComments,
    fetchComments,
    fetchNested,
    fetchAudio,
    attachCommentInputListener,
    fetchReportComment,
    fetchDelComment,
    fetchEditComment,
    createCommentElement,
    renderComments,
    renderNestedComments,
    renderTranslate,
    setToken,
    updateAllCommentLikes,
    fetchGetLikes,
    setCommentLike,
    fetchReplies,
    fetchCommentLike,
    fetchTranslate,
    shakeComment,
    callbackRecord
};

export default CommentsModule;