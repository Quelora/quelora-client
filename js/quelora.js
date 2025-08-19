/*!
 * QUELORA – Real-time interaction platform for websites
 * 
 * @author German Zelaya
 * @version 1.0.0
 * @since 2025
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
import EmojiModule from './emoji.js';
import UtilsModule from './utils.js';
import CoreModule from './core.js';
import ProfileModule from './profile.js';
import PostsModule from './posts.js';
import CommentsModule from './comments.js';
import UiModule from './ui.js';
import I18n from './i18n.js';
import SessionModule from './session.js';
import IconsModule from './icons.js';
import StorageModule from './storage.js';
import AIModule from './ai.js';

//import WORKER_CONTENT from './queloraWorker.js'; //Just for compile!!

const Quelora = (() => {
    // ==================== STATE & CONFIGURATION ====================
    let instance;
    let worker;
    let token = null;
    let cid = null;
    let currentScriptPath;
    let apiUrl;

    const DEFAULT_LANGUAGE = 'en';

    // ==================== HELPERS ====================
    const handleError = (error, context) => {
        console.error(`Error in ${context}:`, error);
        return null;
    };

    /**
     * Validates the Client ID (cid) from the configuration.
     * @returns {string|null} The validated Client ID in uppercase, or null if invalid.
     */
    const getValidatedClientId = (ConfModule) => {
        try {
            const clientId = ConfModule.get('cid');
            if (!clientId?.trim()) {
                throw new Error('Client ID parameter is required.');
            }
            if (!/^QU-[A-Z0-9]{8}-[A-Z0-9]{5}$/i.test(clientId)) {
                throw new Error('Invalid Client ID format. Expected pattern: QU-XXXXXXXX-XXXXX');
            }
            return clientId.toUpperCase();
        } catch (error) {
            console.log(`%cQuelora %cError - ${error.message} ${window.location.href}`, "color: black; font-weight: bold;", "background-color: red; font-weight: bold; border-radius: 2px; padding:3px;");
            return null;
        }
    };

    /**
     * Initializes the Web Worker, either from inline content or a path.
     */
    const initWorker = (ConfModule) => {
        try {
            if (typeof WORKER_CONTENT !== 'undefined') {
                const blob = new Blob([WORKER_CONTENT], { type: 'application/javascript' });
                const workerUrl = URL.createObjectURL(blob);
                return new Worker(workerUrl, { type: 'module' });
            }
            const workerPath = ConfModule.get('workerPath',currentScriptPath + 'queloraWorker.js');
            return new Worker(workerPath, { type: 'module' });
        } catch (error) {
            handleError(error, 'Quelora.initWorker');
            throw error;
        }
    };

    /**
     * Initializes geolocation logic.
     */
    const initializeGeolocation = async (ConfModule) => {
        if (!ConfModule.get('geolocation.enabled')) return [null, null];

        try {
            const { default: GeoStorage } = await import('./geoStorage.js');
            GeoStorage.configure(
                ConfModule.get('geolocation.provider'),
                ConfModule.get('geolocation.apiKey', '')
            );
            return await Promise.all([
                GeoStorage.getIp(),
                GeoStorage.getLocation()
            ]);
        } catch (error) {
            handleError(error, 'Quelora.initializeGeolocation');
            return [null, null];
        }
    };

    /**
     * Initializes the emoji picker.
     */
    const initializeEmojiPicker = async (enable, EmojiModule, UtilsModule) => {
        if (enable && !UtilsModule.isMobile) {
            try {
                await EmojiModule.loadEmojiMartScript();
                EmojiModule.setupEmojiPicker();
            } catch (error) {
                handleError(error, 'Quelora.initializeEmojiPicker');
            }
        } else {
            document.querySelectorAll('.emoji-button').forEach(btn => btn.style.display = 'none');
        }
    };

    /**
     * Appends base modal and picker elements to the DOM.
     */
    const appendQueloraToDocument = () => {
        try {
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = `
                <div id="quelora-picker-container"></div>
                <div class="quelora-modal">
                    <div class="quelora-container">
                        <div class="quelora-body quelora-modal-content"></div>
                        <div class="quelora-modal-footer"></div>
                    </div>
                </div>`;
            while (tempContainer.children.length > 0) {
                document.body.appendChild(tempContainer.children[0]);
            }
        } catch (error) {
            handleError(error, 'Quelora.appendQueloraToDocument');
        }
    };

    /**
     * Sets up and applies initial translations.
     */
    const i18nRun = (I18n, StorageModule) => {
        try {
            I18n.translateByClass('t');
            I18n.translateByClass('comment-input', 'placeholder');
            I18n.translateByClass('search-input', 'placeholder');

            const savedLanguage = StorageModule.getLocalItem('quelora_language');
            const browserLanguage = (navigator.language || navigator.userLanguage).substring(0, 2);

            let langToUse = savedLanguage || browserLanguage || DEFAULT_LANGUAGE;
            const supportedLanguages = ['es', 'en'];

            if (!supportedLanguages.includes(langToUse)) {
                langToUse = DEFAULT_LANGUAGE;
            }
            I18n.changeLanguage(langToUse);
        } catch (error) {
            handleError(error, 'Quelora.i18nRun');
        }
    };

    // ==================== EVENT HANDLERS & LISTENERS ====================

    /**
     * Map of handlers for Worker actions.
     * Replaces `switch` with an object for clarity and scalability.
     */
    const getWorkerMessageHandlers = ({ CommentsModule, ProfileModule, UiModule, SessionModule }) => ({
        commentNested: (payload, originalPayload) => CommentsModule.renderNestedComments(payload, originalPayload.replyId || originalPayload.commentId),
        userFollowed: (payload, originalPayload) => {
            ProfileModule.saveMyProfile(payload.profile);
            ProfileModule.updateFollowState(originalPayload.memberId, 'userFollowed', payload?.requiresApproval || false);
        },
        userUnfollowed: (payload, originalPayload) => {
            ProfileModule.saveMyProfile(payload.profile);
            ProfileModule.updateFollowState(originalPayload.memberId, 'userUnfollowed', payload?.requiresApproval || false);
        },
        userApprovefollowed: (payload, originalPayload) => {
            ProfileModule.saveMyProfile(payload.profile);
            ProfileModule.updateFollowState(originalPayload.memberId, 'userApprovefollowed', payload);
        },
        followingActivities: (payload) => UiModule.renderActivitiesUI(payload),
        statsFetched: (payload) => UiModule.renderStatsUI(payload.posts),
        likeUpdated: (payload, originalPayload) => UiModule.updateCounterUI(document.querySelector(`[data-entity-interaction="${originalPayload.entityId}"]`), payload.likesCount, payload.liked),
        bookmarkUpdated: (payload, originalPayload) => UiModule.updateBookmarkUI(document.querySelector(`[data-entity-interaction="${originalPayload.entityId}"]`), payload.attach),
        commentThread: (payload) => CommentsModule.renderComments(payload),
        repliesThread: (payload) => CommentsModule.renderComments(payload),
        commentCreated: (payload) => {
            UiModule.updateCommentUI(payload.entityId, payload);
            UiModule.updateCommentCountUI(payload.entityId, true);
        },
        commentBlocked: (payload) => UiModule.renderErrorMessageUI(payload.message),
        internalError: (payload) => UiModule.renderErrorMessageUI(payload.message),
        likeCommentUpdated: (payload, originalPayload) => UiModule.updateCounterUI(document.querySelector(`.comment-header[data-comment-id="${originalPayload.commentId}"]`), payload.likesCount, payload.liked),
        getCommentLikesUpdated: (payload) => ProfileModule.renderProfileListLikes(payload),
        getLikeUpdated: (payload) => ProfileModule.renderProfileListLikes(payload),
        shareUpdated: (payload) => UiModule.updateCommentCountUI(payload.entityId, false),
        delComment: (payload) => UiModule.updateCommentCountUI(payload.entityId, false),
        returnProfile: (payload) => ProfileModule.renderProfile(payload.profile),
        returnMyProfile: (payload) => ProfileModule.saveMyProfile(payload.profile),
        offline: (payload) => console.error('No internet connection:', payload),
        invalidToken: () => SessionModule.logout(),
        reportedComment: (payload) => UiModule.renderReportedUI(payload),
        translatedComment: (payload, originalPayload) => CommentsModule.renderTranslate(originalPayload.commentId, payload.translation),
        commentLikesFetched: (payload) => payload.forEach(stat => UiModule.updateCommentLikeUI(stat.commentId, stat.likesCount, stat.authorLiked)),
        updatedProfile: (payload) => {
            UiModule.updateUserUI(payload.profile.author, payload.profile.name);
            UiModule.updateProfileUI(payload.profile);
        },
        searchProfileResults: (payload, op) => ProfileModule.handleSearchResults(op.searchType, payload.result),
        returnAudio: (payload) => UiModule.handleAudioResponseUI(payload.commentId, payload.audio),
        updatedSettingsProfile: (payload) => ProfileModule.saveMyProfile(payload.profile),
        returnMention: (payload) => ProfileModule.renderProfile(payload.profile),
        error: (payload) => console.error(payload?.details?.message || payload?.message, 'Fetch/XHR', payload),
        searchMentionResults: (payload) => ProfileModule.renderMentionResults(payload.result),
        searchAccountsResults: (payload) => ProfileModule.renderSearchAccountsResults(payload.result),
        returnBlocked: (payload) => ProfileModule.renderBlockedUsers(payload.result),
        memberBlockStatus: (payload) => ProfileModule.memberBlockStatus(payload),
        getAnalysisResult: (payload) => AIModule.renderAnalysisModal(payload),
    });

    const handleWorkerMessage = (event, handlers) => {
        try {
            const { action, payload, originalPayload } = event.data;
            const handler = handlers[action];

            if (handler) {
                handler(payload, originalPayload);
            } else {
                console.error(`Unknown worker action: ${action}`, 'general');
            }
        } catch (error) {
            handleError(error, 'Quelora.handleWorkerMessage');
        }
    };

    /**
     * Map of handlers for anchor/hash actions.
     */
    const getAnchorHandlers = ({ PostsModule, ProfileModule, UiModule }) => {

        const handleQuoteOrLike = async (params) => {
            const [entityId, lastCommentId, replyId = ''] = params;
            UiModule.getCommunityThreadsUI()?.replaceChildren();
            if (lastCommentId && replyId) {
                await PostsModule.loadThread(entityId, lastCommentId, true);
                await UtilsModule.wait(500);
                await PostsModule.loadNested(entityId, lastCommentId, replyId);
            } else {
                await PostsModule.loadThread(entityId, lastCommentId, true);
            }
        };

        return {
            'Q': handleQuoteOrLike, // Quote
            'U': async (params) => ProfileModule.getProfile(params[0]), // User
            'E': async (params) => console.log('Action: Engage', params), // Engage
            'L': handleQuoteOrLike, // Listen/Like
            'O': async (params) => console.log('Action: Opinion', params), // Opinion
            'R': async (params) => ProfileModule.getMention(params[0]), // React/Mention
            'A': async (params) => console.log('Action: Archive', params), // Archive
        };
    };

    const checkAndHandleAnchor = async (handlers) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const hash = window.location.hash.substring(1);
            if (!hash.startsWith('QUELORA-') || hash.length > 1000) return;

            const parts = hash.split('-').map(decodeURIComponent);
            const [prefix, action, ...params] = parts;

            const handler = handlers[action];
            if (prefix !== 'QUELORA' || !handler) return;

            const safeParams = params.map(p => p.replace(/[^a-zA-Z0-9]/g, '').substring(0, 50)).filter(Boolean);

            // Clear the anchor from the URL to prevent repeated executions
            history.replaceState(null, null, window.location.pathname + window.location.search);

            await handler(safeParams);
        } catch (error) {
            handleError(error, 'Quelora.checkAndHandleAnchor');
        }
    };

    const initConnectionListeners = (PostsModule) => {
        window.addEventListener('online', () => PostsModule.fetchStats());
        window.addEventListener('offline', () => console.error("No internet connection.", 'error'));
    };

    // ==================== INITIALIZATION ====================
    async function init(enableEmojiPicker = true) {
        try {
         

            // Set configuration and global variables
            currentScriptPath = UtilsModule.getCurrentScriptPath();
            apiUrl = ConfModule.get('apiUrl');
            if (!(cid = getValidatedClientId(ConfModule))) return;

            appendQueloraToDocument();

            const [ip, location] = await initializeGeolocation(ConfModule);

            // Initialize Worker and listeners
            worker = initWorker(ConfModule);
            const workerMessageHandlers = getWorkerMessageHandlers({ CommentsModule, ProfileModule, UiModule, SessionModule });
            worker.addEventListener('message', (e) => handleWorkerMessage(e, workerMessageHandlers));
            worker.postMessage({ action: 'init', payload: { ip, location, apiUrl } });

            initConnectionListeners(PostsModule);
            const anchorHandlers = getAnchorHandlers({ PostsModule, ProfileModule, UiModule });
            window.addEventListener('popstate', () => checkAndHandleAnchor(anchorHandlers));

            // Initialize main modules
            I18n.initializeI18N('en', currentScriptPath + 'locales/');
            token = await CoreModule.getTokenIfNeeded(token, true);
            await IconsModule.initializeIcons();

            // Initialize UI
            UiModule.initializeUI();

            // Common configuration for modules that require it
            const moduleConfig = { worker, token, cid };
            await ProfileModule.initializeProfile(moduleConfig);
            await CoreModule.initializeCore(moduleConfig);
            await PostsModule.initializePost(moduleConfig);
            await CommentsModule.initializeComments(moduleConfig);
            await AIModule.initializeAI(moduleConfig);

            // Initialize UI and background tasks
            await initializeEmojiPicker(enableEmojiPicker, EmojiModule, UtilsModule);
            i18nRun(I18n, StorageModule);
            UtilsModule.observeNewEntities();
            PostsModule.fetchStats();

            await checkAndHandleAnchor(anchorHandlers);

            if (ProfileModule.isLogin()) {
                ProfileModule.updateProfileOptionUI();
            }

            console.log("%c\uD83D\uDCAC Quelora %cActive", "color: #4a4a4a; font-weight: bold; font-size: 12px;", "background-color: #4a4a4a; color: #ff5a5f; font-weight: bold; border-radius: 4px; padding: 3px 6px; font-size: 12px;");
        } catch (error) {
            handleError(error, 'Quelora.init');
            throw error; // Rethrow the error to notify the caller of initialization failure
        }
    }

    // ==================== PUBLIC API ====================
    return {
        /**
         * Retrieves the singleton instance of Quelora.
         * @param {boolean} [enableEmojiPicker=true] Enables or disables the emoji picker.
         * @returns {Promise} A promise that resolves when initialization is complete.
         */
        getInstance: function (enableEmojiPicker = true) {
            if (!instance) {
                instance = init(enableEmojiPicker);
            }
            return instance;
        }
    };
})();

// ==================== INITIAL RUN ====================
document.addEventListener("DOMContentLoaded", () => {
    try {
        Quelora.getInstance(true);
    } catch (error) {
        console.error('Error initializing Quelora on DOM load:', error);
    }
});