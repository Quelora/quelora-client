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

import CoreModule from './core.js';
import UtilsModule from './utils.js';
import UiModule from './ui.js';
import I18n from './i18n.js';
import SessionModule from './session.js';
import StorageModule from './storage.js';
import NotificationModule from './notifications.js';
import IconsModule from './icons.js';
import ToastModule from './toast.js';
import ImageCropper from './cropper.js';
import MentionModule from './mention.js';

let workerInstance, token, cid, userProfile;
let profileFetchLock = null;
let isNotificationRunning = false;
let activityInterval ;
let hiddenAuthorsCache = null;
let originalItemsCache = null;

const _memberProfiles = new Map();
const tabControllers = new WeakMap();

// ==================== CRYPTO HELPERS ====================
const deriveKey = async (token, salt) => {
    try {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(token),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    } catch (error) {
        console.error('Error deriving key:', error);
        throw error;
    }
};

const encryptProfile = async (profileData, token) => {
    try {
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await deriveKey(token, salt);
        const encrypted = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            key,
            encoder.encode(profileData)
        );
        const encryptedArray = new Uint8Array(encrypted);
        const combined = new Uint8Array(salt.length + iv.length + encryptedArray.length);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(encryptedArray, salt.length + iv.length);
        // Encode to base64url to avoid invalid characters
        const base64 = btoa(String.fromCharCode(...combined))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        return base64;
    } catch (error) {
        console.error('Error encrypting profile:', error);
        throw error;
    }
};

const decryptProfile = async (encryptedData, token) => {
    try {
        // Decode base64url
        let binaryString = atob(encryptedData.replace(/-/g, '+').replace(/_/g, '/'));
        const combined = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            combined[i] = binaryString.charCodeAt(i);
        }
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const encrypted = combined.slice(28);
        const key = await deriveKey(token, salt);
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            key,
            encrypted
        );
        return new TextDecoder().decode(decrypted);
    } catch (error) {
        console.error('Error decrypting profile:', error);
        throw error;
    }
};

// ==================== HELPERS ====================
const handleError = (error, context) => {
    console.error(`Error in ${context}:`, error);
    return null;
};

const memberProfiles = {
    get: (key) => {
        try {
            return _memberProfiles.get(key) || null;
        } catch (error) {
            return handleError(error, 'safeProfileStorage get');
        }
    },
    set: (key, value) => {
        try {
            if (value?.author) {
                _memberProfiles.set(key, value);
            }
        } catch (error) {
            handleError(error, 'safeProfileStorage set');
        }
    },
    getAll: () => {
        try {
            return Array.from(_memberProfiles.values());
        } catch (error) {
            return handleError(error, 'safeProfileStorage getAll');
        }
    },
    delete: (key) => {
        try {
            return _memberProfiles.delete(key);
        } catch (error) {
            return handleError(error, 'safeProfileStorage delete');
        }
    }
};

const postMessage = (action, payload) => {
    workerInstance.postMessage({ 
        action, 
        payload: { ...payload, token, cid } 
    });
};

// ==================== CORE FUNCTIONS ====================
async function initializeProfile(dependencies) {
    try {
        ({ worker: workerInstance, token, cid } = dependencies);
    } catch (error) {
        handleError(error, 'ProfileModule.initializeProfile');
        throw error;
    }
}

const setToken = (newToken) => { token = newToken; };

// ==================== PROFILE ACTIONS ====================
const fetchOwnProfile = () => postMessage('getMyProfile', {});
const fetchUpdateProfile = async (name, value) => postMessage('updateProfile', { name, value });

const loadProfileWithUI = async (action, data) => {
    await UiModule.addProfileSkeletoUI();
    UiModule.profileDrawerUI.open();
    token = await CoreModule.getTokenIfNeeded(token);
    // Wait for animation before requesting the profile
    UtilsModule.startTimeout(() => { postMessage(action, data); }, 300);
};

const getProfile = async (member) => {
    clearSearchInputs();
    await loadProfileWithUI('getProfile', { author: member });
};

const clearSearchInputs= async () => {
    document.querySelectorAll('.quelora-community-profile input.search-input').forEach(input => {
        input.value = '';
    });
}

const getMention = async (mention) => {
    await loadProfileWithUI('getMention', { mention });
};

const getMyProfile = async () => {
    const profile = await ProfileModule.getOwnProfile();
    getProfile(profile.author);
};

const fetchFollowingActivities = async (ignoreLastActivity = false) => {
    token = await CoreModule.getTokenIfNeeded(token);
    const lastActivityTime = (!ignoreLastActivity) ? StorageModule.getSessionItem('quelora_notifications_last_activity_time') : null;
    postMessage('getFollowingActivities', { lastActivityTime });
};

// ==================== FOLLOW ACTIONS ====================
const followActions = {
    follow: (memberId) => postMessage('followUser', { memberId }),
    unfollow: (memberId) => postMessage('unfollowUser', { memberId }),
    cancel: (memberId) => postMessage('cancelFollowRequest', { memberId }),
};

// ==================== PROFILE STORAGE ====================
const logout = async () => {
    try {
        SessionModule.logout();
        StorageModule.removeSessionItem('quelora_profile');
        StorageModule.removeSessionItem('quelora_hidden_authors');
        CoreModule.removeToken();
        UiModule.resetCommentLikeIconsUI();
        _memberProfiles.clear();

        //Hide the avatar button and show the settings button again
        const settingBtn = UiModule.getCommunityUI().querySelector('.general-settings');
        if(settingBtn) settingBtn.style.display = 'inline-block';
        const profileBtn = UiModule.getCommunityUI().querySelector('.profile-settings');
        if(profileBtn) profileBtn.style.display = 'none';

    } catch (error) {
        handleError(error, 'ProfileModule.logout');
    }
};

const isLogin = () => {
    const cachedProfile = SessionModule.getTokenIfAvailable();
    return (cachedProfile) ? true : false;
}

/**
 * Return JSON data user
 */
const getOwnProfile = async (forceServerFetch = false, maxAttempts = 5, delayMs = 400) => {
    if (!forceServerFetch) {
        const cachedProfile = StorageModule.getSessionItem('quelora_profile');
        if (cachedProfile) {
            try {
                const decryptedProfile = await decryptProfile(cachedProfile, token);
                return JSON.parse(decryptedProfile);
            } catch (error) {
                handleError(error, 'ProfileModule.getOwnProfile decrypt');
                // Clear invalid cached profile to prevent repeated errors
                StorageModule.removeSessionItem('quelora_profile');
            }
        }
    }

    if (profileFetchLock) {
        return profileFetchLock;
    }

    profileFetchLock = (async () => {
        try {
            let profile;
            let attempt = 0;

            // Always try to fetch from the server if there is no cache or it is forced
            fetchOwnProfile();

            while (attempt < maxAttempts) {
                await UtilsModule.wait(delayMs);
                const cachedProfile = StorageModule.getSessionItem('quelora_profile');
                if (cachedProfile) {
                    try {
                        const decryptedProfile = await decryptProfile(cachedProfile, token);
                        profile = JSON.parse(decryptedProfile);
                        return profile;
                    } catch (error) {
                        handleError(error, 'ProfileModule.getOwnProfile decrypt retry');
                        // Clear invalid cached profile
                        StorageModule.removeSessionItem('quelora_profile');
                    }
                }
                attempt++;

                if (attempt === maxAttempts) {
                    throw new Error(`Failed to get profile after ${maxAttempts} attempts`);
                }
            }
        } finally {
            profileFetchLock = null;
        }
    })();

    return profileFetchLock;
};

/**
 * Save the user profile in session storage and update hidden authors in local storage.
 *
 * @param {Object} profile - The profile object to save.
 * @param {string} [profile.author] - The profile's author ID (required).
 * @param {Array<{_id: string, blocked_id: string}>} [profile.blocked] - List of blocked users.
 * @param {string} [path] - Optional key path to update only part of the profile.
 */
const saveMyProfile = async (profile, path) => {
    if (!profile || !profile.author) return;

    // Save profile in session storage
    if (path) {
        let currentProfile = {};
        const cachedProfile = StorageModule.getSessionItem('quelora_profile');
        if (cachedProfile) {
            try {
                const decryptedProfile = await decryptProfile(cachedProfile, token);
                currentProfile = JSON.parse(decryptedProfile);
            } catch (error) {
                handleError(error, 'ProfileModule.saveMyProfile decrypt');
            }
        }
        const updatedProfile = { ...currentProfile, [path]: profile[path] };
        try {
            const encryptedProfile = await encryptProfile(JSON.stringify(updatedProfile), token);
            StorageModule.setSessionItem('quelora_profile', encryptedProfile);
        } catch (error) {
            handleError(error, 'ProfileModule.saveMyProfile encrypt');
        }
    } else {
        try {
            const encryptedProfile = await encryptProfile(JSON.stringify(profile), token);
            StorageModule.setSessionItem('quelora_profile', encryptedProfile);
        } catch (error) {
            handleError(error, 'ProfileModule.saveMyProfile encrypt');
        }
    }

    // Save hidden authors in local storage (overwrite if exists)
    if (Array.isArray(profile.blocked)) {
        const hiddenAuthors = profile.blocked.map(b => b.blocked_author);
        StorageModule.setSessionItem('quelora_hidden_authors', JSON.stringify(hiddenAuthors));
        hiddenAuthors.forEach(authorId => {
            UiModule.destroyElementsByUI(authorId);
        });
    }

    // Update Profile
    if (!path) saveMemberProfile(profile);
};

const saveMemberProfile = (profile) => memberProfiles.set(profile.author, profile);

const updateProfileOptionUI = async () => {
    try {
        const settingBtn = UiModule.getCommunityUI().querySelector('.general-settings');
        if (settingBtn) settingBtn.style.display = 'none';
        const profileBtn = UiModule.getCommunityUI().querySelector('.profile-settings');
        if (profileBtn) profileBtn.style.display = 'flex';

        const ownProfile = await getOwnProfile();

        //It may not be the best place, but it is the most opportune.
        if(ownProfile.settings?.session?.rememberSession){
            SessionModule.rememberSession();
        }

        //If you have pending requests, open a message
        if(ownProfile.followRequests?.length > 0){
            ToastModule.info("person_add", I18n.getTranslation("followRequest"), I18n.getTranslation("pendingRequest"), () => { ProfileModule.renderFollowRequests() });
        }

        if (!ownProfile) return;

        if (ownProfile.picture) {
            profileBtn.style.backgroundImage = `url('${ownProfile.picture}')`;
            profileBtn.style.backgroundSize = 'cover';
            profileBtn.style.backgroundPosition = 'center center';
            profileBtn.style.backgroundRepeat = 'no-repeat';
        } else {
            const initials = ownProfile.name?.split(' ').map(name => name[0]).join('').toUpperCase() || '';
            profileBtn.textContent = initials;
            profileBtn.classList.add('avatar-initials');
        }

        if(ownProfile.settings?.interface?.defaultLanguage && ownProfile.settings?.interface?.defaultLanguage != 'auto'){
            I18n.changeLanguage(ownProfile.settings?.interface?.defaultLanguage);
        }

        if(ownProfile.settings?.interface?.defaultTheme && ownProfile.settings?.interface?.defaultTheme != 'system'){
            document.documentElement.setAttribute('data-theme', ownProfile.settings?.interface?.defaultTheme);
        }

        if(ownProfile.settings?.notifications?.web){ runNotifications(); }

    } catch (error) {
        console.error('Error updating profile option UI:', error);
    }
};

async function runNotifications() {
    if (isNotificationRunning) return;
    isNotificationRunning = true;
    
    await ProfileModule.fetchFollowingActivities();
    activityInterval = setInterval(() => {
        ProfileModule.fetchFollowingActivities();
    }, 20000);
}

async function fetchMention(query) {
    try {
        token = await CoreModule.getTokenIfNeeded(token);
        const payload = { token, query, cid };
        workerInstance.postMessage({
            action: 'searchMention',
            payload
        });
    } catch (error) {
        handleError(error, 'ProfileModule.fetchMention');
    }
}

async function fetchAccounts(query) {
    try {
        token = await CoreModule.getTokenIfNeeded(token);
        const payload = { token, query, cid };
        workerInstance.postMessage({
            action: 'searchAccounts',
            payload
        });
    } catch (error) {
        handleError(error, 'ProfileModule.fetchAccounts');
    }
}

function stopNotifications() {
    if (isNotificationRunning) {
        clearInterval(activityInterval);
        isNotificationRunning = false;
    }
}

const updateProfileSettingsUI = async () => {
    try {
        const ownProfile = await getOwnProfile(true);

        const updateListener = (element, event, handler) => {
            if (!element) return;
            const previousHandler = element.dataset[`${event}Handler`];
            if (previousHandler) {
                element.removeEventListener(event, element[previousHandler]);
            }
            const newHandler = handler.bind(element);
            element.removeEventListener(event, newHandler);
            element.addEventListener(event, newHandler);
            element.dataset[`${event}Handler`] = `handler_${Math.random().toString(36).slice(2)}`;
            element[element.dataset[`${event}Handler`]] = newHandler;
        };

        // --- Helpers ---
        const bindSettingToggle = (selector, settingPath, extraHandler = null) => {
            const el = document.querySelector(selector);
            if (!el) return;
            const value = settingPath.split('.').reduce((o, k) => o?.[k], ownProfile.settings) || false;
            el.checked = value;
            updateListener(el, 'change', function() {
                postMessage('updateSettings', { key: settingPath, value: this.checked });
                if (extraHandler) extraHandler.call(this);
            });
        };

        const bindSettingSelect = (selector, settingPath, defaultValue = 'auto') => {
            const el = document.querySelector(selector);
            if (!el) return;
            const value = settingPath.split('.').reduce((o, k) => o?.[k], ownProfile.settings) || defaultValue;
            el.value = value;
            updateListener(el, 'change', function() {
                postMessage('updateSettings', { key: settingPath, value: this.value });
            });
        };

        // --- Themes ---
        const themeProfile = document.querySelector('#quelora-theme-profile');    
        const themeButtons = {
            light: themeProfile?.querySelector('.light-theme'),
            dark: themeProfile?.querySelector('.dark-theme'),
            system: themeProfile?.querySelector('.system-theme')
        };
        for (const theme in themeButtons) {
            updateListener(themeButtons[theme], 'click', function() {
                postMessage('updateSettings', { key: 'interface.defaultTheme', value: theme });
            });
        }

        // --- Show Activity Buttons ---
        const showActivityButtons = {
            everyone: document.querySelector('.privacy-button.everyone'),
            followers: document.querySelector('.privacy-button.followers'),
            onlyme: document.querySelector('.privacy-button.onlyme')
        };
        const currentVisibility = ownProfile.settings?.privacy?.showActivity || 'everyone';
        for (const visibility in showActivityButtons) {
            showActivityButtons[visibility]?.classList.toggle('active', visibility === currentVisibility);
            updateListener(showActivityButtons[visibility], 'click', function() {
                Object.values(showActivityButtons).forEach(btn => btn?.classList.remove('active'));
                this.classList.add('active');
                postMessage('updateSettings', { key: 'privacy.showActivity', value: this.dataset.value });
            });
        }

        // --- General Toggles ---
        bindSettingToggle('#quelora-remember-session-toggle', 'session.rememberSession');
        bindSettingToggle('#quelora-approve-followers-toggle', 'privacy.followerApproval');
        bindSettingSelect('#quelora-language-select', 'interface.defaultLanguage', 'auto');

        bindSettingToggle('#quelora-web-notifications-toggle', 'notifications.web', function() {
            this.checked ? runNotifications() : stopNotifications();
        });

        bindSettingToggle('#quelora-email-notifications-toggle', 'notifications.email');
        
        // Push notifications necesita extra lógica
        bindSettingToggle('#quelora-push-notifications-toggle', 'notifications.push', function() {
            if (this.checked) {
                NotificationModule.subscribeToPushNotifications(token);
            } else {
                NotificationModule.unsubscribeFromPushNotifications(token);
            }
        });

        bindSettingToggle('#quelora-notify-replies-toggle', 'notifications.comments');
        bindSettingToggle('#quelora-notify-likes-toggle', 'notifications.postLikes');
        bindSettingToggle('#quelora-notify-followers-toggle', 'notifications.newFollowers');
        bindSettingToggle('#quelora-notify-posts-toggle', 'notifications.newPost');

    } catch (error) {
        console.error('Error updating profile option UI:', error);
    }
};

// ==================== UI COMPONENTS ====================
const createButton = (type, user, extraClasses = '') => {
    const button = document.createElement('button');
    button.className = `${type}-button ${extraClasses}`;
    button.dataset.memberId = user.author;

    return button;
};

const createFollowButton = async (user, options = {}) => {
    const {
        isFollowing = user.isFollowing || false,
        isPendingRequest = user.isFollowRequestSent || false
    } = options;

    const ownProfile = await getOwnProfile();

    if (ownProfile?.author === user.author) {
        const placeholder = document.createElement('span');
        placeholder.classList.add('follow-placeholder');
        return placeholder;
    }

    const button = createButton('follow', user);
    const buttonState = isPendingRequest ? 'pending' : (isFollowing ? 'active' : '');
    const followState = isPendingRequest ? 'pending' : (isFollowing ? 'following' : 'not-following');
    const buttonIcon = isPendingRequest ? IconsModule.getIconSvg('schedule_send') : (isFollowing ? IconsModule.getIconSvg('people') : IconsModule.getIconSvg('person_add'));
    const buttonText = isPendingRequest ? 'pending' : (isFollowing ? 'following' : 'follow');

    button.innerHTML = `
        <span class="quelora-icons-outlined">${buttonIcon}</span>
        <span class="legend">${I18n.getTranslation(buttonText)}</span>
    `;

    if (buttonState) button.classList.add(buttonState);
    button.dataset.memberApproval = user.followerApproval ?? false;
    button.dataset.followState = followState;

    button.removeEventListener('click', handleFollowClick);
    button.addEventListener('click', handleFollowClick);

    return button;
};

const handleFollowClick = async (event) => {
    event.preventDefault();
    const button = event.currentTarget;
    
    const memberId = button.dataset.memberId;
    const followState = button.dataset.followState;

    document.querySelectorAll(`.follow-button[data-member-id="${memberId}"]`).forEach(btn => {
        btn.disabled = true;
    });

    StorageModule.removeSessionItem('quelora_profile');

    followActions[followState === 'following' ? 'unfollow' : followState === 'pending' ? 'cancel' : 'follow'](memberId);
};

const updateFollowState = async (memberId, action, requiresApproval = false) => {
    const isFollowing = action === 'userFollowed';

    document.querySelectorAll(`.follow-button[data-member-id="${memberId}"]`).forEach(btn => {
        const icon = btn.querySelector('.quelora-icons-outlined');
        const legend = btn.querySelector('.legend');
        
        let followState, buttonState, buttonIcon, buttonText;
        
        if (isFollowing) {
            if (requiresApproval) {
                followState = 'pending';
                buttonState = 'pending';
                buttonIcon = IconsModule.getIconSvg('schedule_send');
                buttonText = 'pending';
            } else {
                followState = 'following';
                buttonState = 'active';
                buttonIcon = IconsModule.getIconSvg('people');
                buttonText = 'following';
            }
        } else {
            followState = 'not-following';
            buttonState = '';
            buttonIcon = IconsModule.getIconSvg('person_add');
            buttonText = 'follow';
        }

        if (icon) icon.innerHTML = buttonIcon;
        if (legend) legend.textContent = I18n.getTranslation(buttonText);
        
        btn.classList.remove('active', 'pending');
        if (buttonState) btn.classList.add(buttonState);
        
        document.querySelectorAll(`.follow-button[data-member-id="${memberId}"]`).forEach(btn => {
            btn.disabled = false;
        });

        btn.dataset.followState = followState;
    });
};

const attachProfileClickListeners = () => {
    document.querySelectorAll('.comment-avatar[data-member-id]:not([data-listener-attached])').forEach(avatar => {
        const handleAvatarClick = () => {
            ProfileModule.getProfile(avatar.dataset.memberId);
        };
        avatar.addEventListener('click', handleAvatarClick);
        avatar.dataset.listenerAttached = 'true';
    });
};

const attachFollowButtonListeners = () => {
    document.querySelectorAll('.follow-button').forEach(button => {
        if (!button.dataset.eventAdded) {
            button.removeEventListener('click', handleFollowClick);
            button.addEventListener('click', handleFollowClick);
            button.dataset.eventAdded = "true";
        }
    });
};

// ==================== PROFILE RENDERING ====================
const updateCounter = (tab, count) => {
    const counter = document.querySelector(`.profile-tab[data-tab="${tab}"] .counter`);
    if (counter) {
        counter.textContent = ` ${UtilsModule.formatNumberAbbreviated(count || 0)}`;
    }
};

const updatePrivateCounter = (object, count) => {
    const counter = document.querySelector(`#quelora-profile .profile-private-account .${object}`);
    if (counter) {
        // Asegurarnos de usar counts para los totales reales
        let realCount = count;
        if (object === 'interaction') {
            realCount = userProfile?.counts?.comments || count;
        } else if (object === 'followers') {
            realCount = userProfile?.counts?.followers || count;
        } else if (object === 'following') {
            realCount = userProfile?.counts?.following || count;
        }
        counter.textContent = ` ${UtilsModule.formatNumberAbbreviated(realCount || 0)}`;
    }
}

const createEmptyState = (message) => `
    <ul><div class="quelora-empty-container t">${I18n.getTranslation(message) || message}</div></ul>
`;

const createFollowerItem = async (user, options = {}) => {
    const {
        requestId = null,
        showRequestActions = false,
        showFollowButton = true,
        requestTime = null,
        isFollowing = user.isFollowing,
        isPendingRequest = user.isFollowRequestSent || false,
        isBlocked = false
    } = options;

    const ownProfile = await getOwnProfile();
    const isOwnProfile = user.author === ownProfile?.author;

    let actionButtons = '';
    if (showRequestActions && !isOwnProfile) {
        actionButtons = `
            <div class="request-actions">
                <button class="quelora-button accept-request" data-request-id="${requestId}" data-member-id="${user.author}">
                    <span class="quelora-icons-outlined">check</span>
                </button>
                <button class="quelora-button reject-request" data-request-id="${requestId}" data-member-id="${user.author}">
                    <span class="quelora-icons-outlined">close</span>
                </button>
            </div>
        `;
    } else if (showFollowButton && !isOwnProfile) {
        const followButton = await createFollowButton(user, { isFollowing, isPendingRequest });
        actionButtons = followButton.outerHTML;
    }

    if (isBlocked) {
        actionButtons = `
            <button class="unblock-button" data-member-id="${user.author}">
                <span class="quelora-icons-outlined">unlock</span>
                <span class="legend">${I18n.getTranslation('unblock')}</span>
            </button>
        `;
    }

    const li = document.createElement('li');
    li.className = 'follower-item';
    li.tabIndex = -1;
    li.dataset.memberId = user.author;
    li.dataset.memberName = user.name || '';
    li.dataset.memberApproval = user.followerApproval ?? false;
    if (requestId) li.dataset.requestId = requestId;

    li.innerHTML = `
        <div class="comment-avatar" data-member-id="${user.author}" 
             style="background-image: ${user.picture ? `url('${user.picture}')` : 'none'}">
        </div>
        <div class="user-info">
            <span class="user-name">
                ${user.name || I18n.getTranslation('user')}
            </span>
            <span class="user-full-name">
                ${`${user.given_name || ''} ${user.family_name || ''}`.trim() || I18n.getTranslation('nameNotAvailable')}
            </span>
        </div>
        ${actionButtons}
    `;
    return li.outerHTML;
};

const createCommentItem = async (comment) => {
    if (isBlockedAuthor(comment.author.author)) return '';
    const user = comment.author;
    const initials = user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '';
    const isOwnProfile = user.author === getOwnProfile()?.author;
    const userProfile = memberProfiles.get(user.author) || user;
    
    const followButtonHTML = !isOwnProfile 
        ? (await createFollowButton(userProfile)).outerHTML 
        : '';

    const refererHTML = renderRefererStructure({
        date: comment.created_at,
        link: comment.referer?.link,
        title: comment.referer?.title,
    });

    return `
        <li>
            ${refererHTML}
            ${renderCommentStructure(comment, user, initials, followButtonHTML)}
        </li>
    `;
};

const createLikeItem = async (like) => {
    if (!like.author || isBlockedAuthor(like.author.author)) return '';

    const user = like.author;
    const initials = user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '';
    const isOwnProfile = user.author === getOwnProfile()?.author;
    const userProfile = memberProfiles.get(user.author) || user;
    
    const followButtonHTML = !isOwnProfile 
        ? (await createFollowButton(userProfile)).outerHTML 
        : '';

    const refererHTML = renderRefererStructure({
        date: like.created_at,
        link: like.referer?.link || like.link,
        title: like.referer?.title || like.title,
        timeAgo: like.created_at,
        extraClass: 'like-time-container',
        icon: 'schedule',
        extraTimeClass: 'like-time'
    });

    return `
        <li>
            ${refererHTML}
            ${like.fk_type === 'comment' ? renderCommentStructure(like, user, initials, followButtonHTML) : ''}
        </li>
    `;
};

const createShareItem = async (share) => {
    const refererHTML = renderRefererStructure({
        date: share.entity?.created_at,
        link: share.entity?.link,
        title: share.entity?.title,
        timeAgo: share.madeAt,
        extraClass: 'share-time-container',
        icon: 'schedule',
        extraTimeClass: 'share-time'
    });

    return `
        <li>${refererHTML}</li>
    `;
};

const createBookmarkItem = async (bookmark) => {
    const refererHTML = renderRefererStructure({
        date: bookmark.post?.created_at,
        link: 'javascript:void(0);',
        title: bookmark.post?.title,
        timeAgo: bookmark.created_at,
        extraClass: 'bookmark-time-container',
        icon: 'schedule',
        extraTimeClass: 'bookmark-time'
    });

    return `
        <li>${refererHTML}</li>
    `;
};

const renderRefererStructure = ({ 
    date, 
    link = 'javascript:void(0);', 
    title, 
    timeAgo, 
    extraClass = '', 
    icon = '', 
    extraTimeClass = '' 
}) => {
    return `
        <div class="referer-info">
            <span class="comment-time t">${UtilsModule.formatDate(date)}</span>
            | <a class="referer-link" href="${link}">
                ${title || I18n.getTranslation('noDescription')}
            </a>
            ${timeAgo ? `
                <div class="${extraClass}">
                    ${icon ? `<span class="quelora-icons-outlined">${icon}</span>` : ''}
                    <span class="${extraTimeClass} t">${UtilsModule.getTimeAgo(timeAgo)}</span>
                </div>
            ` : ''}
        </div>
    `;
};

const renderCommentStructure = (item, user, initials, followButtonHTML) => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
        <div class="comment-to-profile" data-member-id="${user.author}">
            <div class="comment-header" data-comment-id="${item._id || ''}">
                <div class="comment-avatar" data-member-id="${user.author}" style="background-image: ${user.picture ? `url('${user.picture}')` : 'none'}">
                    ${user.picture ? '' : initials}
                </div>
                <div class="comment-info">
                    <span class="comment-author" data-member-user="${user.author || ''}">
                        ${user.name || I18n.getTranslation('user')}
                    </span>
                    <span class="comment-time t">
                        ${UtilsModule.getTimeAgo(item.created_at || new Date())}
                    </span>
                </div>
                ${followButtonHTML}
            </div>
            <div class="comment-text"></div>
        </div>
    `;

    const commentTextContainer = wrapper.querySelector('.comment-text');
    if (item.text) {
        const processed = MentionModule.processTextWithMentions(item.text, ProfileModule.getMention);
        commentTextContainer.appendChild(processed);
    } else {
        commentTextContainer.textContent = I18n.getTranslation('noContent');
    }

    return wrapper.innerHTML;
};

const renderProfileSection = async (items, container, createItemFn, emptyMessage) => {
    if (!container) return;
    if (items?.length) {
        // Filter out blocked authors

        const filteredItems = items.filter(item => {
            const authorId = item.author?.author || item.author;
            if (!authorId) return true;
            return authorId && !isBlockedAuthor(authorId);
        });

        const htmlItems = await Promise.all(filteredItems.map(async (item) => {
            const html = await createItemFn(item);
            const { author } = item;
            if (author) {
                const key = typeof author.author === 'string' ? author.author : author;
                const value = typeof author.author === 'string' ? author : item;
                memberProfiles.set(key, value);
            }
            return html;
        }));

        container.innerHTML = htmlItems.length ? htmlItems.join('') : createEmptyState(emptyMessage);
    } else {
        container.innerHTML = createEmptyState(emptyMessage);
    }

    if (createItemFn === createFollowerItem) {
        attachFollowButtonListeners();
    }
}

const setupSearchHandlers = () => {
    document.querySelectorAll('.profile-tab-content .search-input').forEach(input => {
        // Remove previous listener if it exists
        if (input._searchHandler) {
            input.removeEventListener('input', input._searchHandler);
        }

        const handleSearchInput = UtilsModule.debounce((e) => {
            const searchTerm = e.target.value.trim().toLowerCase();
            const tabContent = e.target.closest('.profile-tab-content');
            const tabType = tabContent.classList[1];
            const memberId = UiModule.getProfileContainerUI().getAttribute('data-profile-member-id');
            const list = tabContent.querySelector('ul');

            if (!originalItemsCache) {
                originalItemsCache = Array.from(list.children).map(item => item.cloneNode(true));
            }

            const existingMessage = list.querySelector('.quelora-empty-container.t');
            if (existingMessage) existingMessage.remove();

            list.innerHTML = '';
            originalItemsCache.forEach(item => {
                const clonedItem = item.cloneNode(true);
                const avatars = clonedItem.querySelectorAll('.comment-avatar');
                avatars.forEach(avatar => avatar.removeAttribute('data-listener-attached'));
                const followButton = clonedItem.querySelectorAll('.follow-button');
                followButton.forEach(avatar => avatar.removeAttribute('data-event-added'));
                list.appendChild(clonedItem);
            });

            const items = Array.from(list.querySelectorAll('li:not(.quelora-empty-container)'));

            if (searchTerm.length === 0) {
                attachProfileClickListeners();
                attachFollowButtonListeners();
                return;
            }

            if (searchTerm.length < 4) {
                let hasMatches = false;
                
                items.forEach(item => {
                    const text = item.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
                    const matches = text.includes(searchTerm);
                    item.style.display = matches ? '' : 'none';
                    if (matches) hasMatches = true;
                });

                if (!hasMatches) {
                    const message = document.createElement('div');
                    message.className = 'quelora-empty-container t';
                    message.textContent = '{{search_min_chars}}';
                    list.innerHTML = '';
                    list.appendChild(message);
                }

                attachFollowButtonListeners();
                attachProfileClickListeners();
                return;
            }

            let visibleCount = 0;
            items.forEach(item => {
                const text = item.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
                const visible = text.includes(searchTerm);
                item.style.display = visible ? '' : 'none';
                if (visible) visibleCount++;
            });
            
            attachFollowButtonListeners();
            attachProfileClickListeners();
            
            if (visibleCount < 10) {
                UiModule.addLoadingMessageUI(list, {
                    type: 'profile',
                    position: 'after',
                    empty: true,
                    count: 10
                });
                executeSearch(memberId, tabType, searchTerm);
            }
        }, 1000);

        // Store the function reference directly on the element
        input._searchHandler = handleSearchInput;
        input.addEventListener('input', handleSearchInput);
    });
};

const executeSearch = (memberId, tabType, searchTerm) => {
    const payload = {
        memberId: memberId,
        searchType: tabType,
        query: searchTerm,
    };
    postMessage('searchProfileData', payload);
};

const handleSearchResults = async (searchType, results) => {
    try {
        const tabContent = document.querySelector(`.profile-tab-content.${searchType}`);
        if (!tabContent) return;
        
         tabContent.querySelector('ul').querySelector('.quelora-loading-message')?.remove();

        switch(searchType) {
            case 'comments':
                await renderProfileSection(
                    results,
                    tabContent.querySelector('ul'),
                    createCommentItem,
                    'noResultsForQuery'
                );
                break;

            case 'likes':
                await renderProfileSection(
                    results,
                    tabContent.querySelector('ul'),
                    createLikeItem,
                    'noResultsForQuery'
                );
                break;

            case 'shares':
                await renderProfileSection(
                    results,
                    tabContent.querySelector('ul'),
                    createShareItem,
                    'noResultsForQuery'
                );
                break;

            case 'follower':
                await renderProfileSection(
                    results,
                    tabContent.querySelector('ul'),
                    createFollowerItem,
                    'noResultsForQuery'
                );
                break;

            case 'followed':
                await renderProfileSection(
                    results,
                    tabContent.querySelector('ul'),
                    createFollowerItem,
                    'noResultsForQuery'
                );
                break;

            case 'bookmarks':
                await renderProfileSection(
                    results,
                    tabContent.querySelector('ul'),
                    createBookmarkItem,
                    'noResultsForQuery'
                );
                break;

            default:
                console.warn(`Uncontrolled search type: ${searchType}`);
                break;
        }

        //Attach avatar event
        attachProfileClickListeners();

        tabContent.querySelector('ul')?.scrollTo(0, 0);
    } catch (error) {
        handleError(error, 'handleSearchResults');
    }
};

// ==================== IMAGE HANDLING ====================
const updateAvatarImage = async (e) => {
    if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (event) => {
            ImageCropper.create({
                imageSrc: event.target.result,
                type: 'avatar',
                onConfirm: async (croppedImage) => {
                    const communityProfile = document.getElementById('quelora-community-profile');
                    const avatar = communityProfile.querySelector('.profile-avatar');
                    if (avatar) {
                        avatar.style.backgroundImage = `url('${croppedImage}')`;
                        avatar.textContent = '';
                        avatar.classList.remove('avatar-initials');
                    }
                    await ProfileModule.fetchUpdateProfile('picture', croppedImage);

                },
                onCancel: () => {
                    e.target.value = '';
                }
            });
        };
        reader.readAsDataURL(e.target.files[0]);
    }
};

const updateBackgroundImage = async (e) => {
    if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (event) => {
            ImageCropper.create({
                imageSrc: event.target.result,
                type: 'background',
                onConfirm: async (croppedImage) => {
                    const communityProfile = document.getElementById('quelora-community-profile');
                    const profileUser = communityProfile.querySelector('.profile-user');
                    if (profileUser) {
                        profileUser.style.backgroundImage = `url('${croppedImage}')`;
                    }
                    await ProfileModule.fetchUpdateProfile('background', croppedImage);
                },
                onCancel: () => {
                    e.target.value = '';
                }
            });
        };
        reader.readAsDataURL(e.target.files[0]);
    }
};

const renderProfile = async (userProfile) => {
    try {
        if(!userProfile){
            ToastModule.error('error',I18n.getTranslation('profileNotFound'), I18n.getTranslation('profileNotFoundDescription'), null, 4000);
            UiModule.profileDrawerUI.close();
            return;
        }
        originalItemsCache = null;
        const ownProfile = await getOwnProfile();

        const isOwnProfile = ownProfile?.author === userProfile.author;
        if(isOwnProfile)  saveMyProfile(userProfile);

        memberProfiles.set(userProfile.author, userProfile);

        const profile = UiModule.getProfileContainerUI();
        if (!profile) throw new Error('Profile container not found');

        // Set profile data
        profile.dataset.profileMemberId = userProfile.author;
        setProfileText(profile, userProfile);
        setProfileImages(profile, userProfile);

        // Handle edit functionality
        handleEditButtons(profile, isOwnProfile, userProfile);
        // Handle profile actions
        handleProfileActions(profile, isOwnProfile, userProfile);

        // Handle profile visibility
        handleProfileVisibility(profile, isOwnProfile, userProfile);

        // Setup tabs
        setupTabs(profile, isOwnProfile, userProfile);

        // Render profile sections
        await renderSections(profile, userProfile);

        // Update tab counts
        updateTabCounts(profile, userProfile);

        // Update tabs private count
        updatePrivateCounter('interaction', userProfile?.commentsCount || 0);
        updatePrivateCounter('following', userProfile?.followingCount || 0);
        updatePrivateCounter('followers', userProfile?.followersCount || 0);

        // Initialize interactions
        initializeInteractions();
    } catch (error) {
        handleError(error, 'renderProfile');
    }
};

const handleProfileVisibility = (profile, isOwnProfile, userProfile) => {
    const tabs = profile.querySelector('.profile-tabs');
    const tabContents = profile.querySelectorAll('.profile-tab-content');
    const privateAccount = profile.querySelector('.profile-private-account');

    if (!isOwnProfile && (userProfile.visibility === 'private' && !userProfile.isFollowing)) {
        tabs.style.display = 'none';
        tabContents.forEach(content => content.style.display = 'none');
        if (privateAccount) privateAccount.style.display = 'flex';
    } else {
        tabs.style.display = 'flex';
        tabContents.forEach(content => content.style.display = '');
        if (privateAccount) privateAccount.style.display = 'none';
    }
};

const setProfileText = (profile, userProfile) => {
    const initials = userProfile.name?.split(' ').map(name => name[0]).join('').toUpperCase() || '';
    profile.querySelector('.user').textContent = userProfile.name || I18n.getTranslation('user');
    profile.querySelector('.user-name').textContent = 
        `${userProfile.given_name || ''} ${userProfile.family_name || ''}`.trim() || 
        I18n.getTranslation('nameNotAvailable');
    return initials;
};

const setProfileImages = (profile, userProfile, initials) => {
    const avatar = profile.querySelector('.profile-avatar');
    avatar.classList.remove('quelora-skeleton', 'quelora-skeleton-avatar');
    
    avatar.style.backgroundImage = userProfile.picture ? `url('${userProfile.picture}')` : '';
    avatar.textContent = userProfile.picture ? '' : initials;

    const background = profile.querySelector('.profile-user');
    background.style.backgroundImage = userProfile.background ? `url('${userProfile.background}')` : '';
};

const handleEditButtons = (profile, isOwnProfile, userProfile) => {
    const editIcon = profile.querySelector('.user + .quelora-icons-outlined');
    const avatarBtn = profile.querySelector('.profile-camara-avatar');
    const backgroundBtn = profile.querySelector('.profile-camara');

    if (isOwnProfile && !editIcon) {
        addEditButton(profile, userProfile);
        addImageUploadButtons(profile);
    } else if (!isOwnProfile && editIcon) {
        [editIcon, avatarBtn, backgroundBtn].forEach(btn => btn?.remove());
        profile.querySelectorAll('.container-avatar input[type="file"], .profile-user + input[type="file"]').forEach(input => input.remove());
    }
};

const addEditButton = (profile, userProfile) => {
    const editBtn = document.createElement('button');
    editBtn.className = 'quelora-icons-outlined profile-edit quelora-button';
    editBtn.textContent = 'edit';
    editBtn.onclick = () => handleNameEdit(profile, editBtn, userProfile.name);
    profile.querySelector('.user').insertAdjacentElement('afterend', editBtn);
};

const handleNameEdit = (profile, editBtn, currentName) => {
    const userElement = profile.querySelector('.user');
    editBtn.style.display = 'none';
    userElement.innerHTML = `
        <input type="text" class="quelora-inline-edit-input" id="quelora-inline-edit-input" value="${currentName}" maxlength="15" minlength="3">
        <button class="quelora-icons-outlined quelora-inline-edit-save quelora-button">${IconsModule.getIconSvg('save')}</button>
        <button class="quelora-icons-outlined quelora-inline-edit-cancel quelora-button">${IconsModule.getIconSvg('close')}</button>
    `;

    const input = userElement.querySelector('.quelora-inline-edit-input');
    input.focus();
    input.select();

    input.addEventListener('input', (e) => {
        const nameRegex = /^[a-zA-Z0-9]{0,15}$/;
        if (!nameRegex.test(e.target.value)) e.target.value = e.target.value.slice(0, -1);
    });

    input.addEventListener('paste', (e) => {
        e.preventDefault();
    });

    userElement.querySelector('.quelora-inline-edit-save').addEventListener('click', async () => {
        const newName = input.value.trim();
        const nameRegex = /^[a-zA-Z0-9]{3,15}$/;
        if (nameRegex.test(newName)) {
            if (newName !== currentName) {
                await ProfileModule.fetchUpdateProfile('name', newName);
                userElement.textContent = newName;
            }
            editBtn.style.display = '';
        } else {
            ToastModule.info(null, I18n.getTranslation('error'), I18n.getTranslation('invalidNameFormat'), null, 10000);
        }
    });

    userElement.querySelector('.quelora-inline-edit-cancel').addEventListener('click', () => {
        userElement.textContent = currentName;
        editBtn.style.display = '';
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') userElement.querySelector('.quelora-inline-edit-save').click();
        if (e.key === 'Escape') userElement.querySelector('.quelora-inline-edit-cancel').click();
    });
};

const addImageUploadButtons = (profile) => {
    ['avatar', 'background'].forEach(type => {
        const btn = document.createElement('button');
        btn.className = `quelora-icons-outlined profile-camara${type === 'avatar' ? '-avatar' : ''} quelora-button`;
        btn.textContent = 'photo';
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        input.addEventListener('change', type === 'avatar' ? updateAvatarImage : updateBackgroundImage);
        
        btn.onclick = () => input.click();
        
        const container = type === 'avatar' ? '.container-avatar' : '.profile-user';
        profile.querySelector(container).insertAdjacentElement('afterend', input);
        profile.querySelector(container).appendChild(btn);
    });
};

const handleProfileActions = (profile, isOwnProfile, userProfile) => {
    const profileAction = profile.querySelector('.profile-actions');
    if (profileAction) {
        profileAction.style.display = isOwnProfile ? 'none' : 'flex';
        profileAction.innerHTML = '';
        if (!isOwnProfile) {
            createFollowButton(userProfile).then(followButton => profileAction.appendChild(followButton));
        }
    }
};

const setupTabs = (profile, isOwnProfile, userProfile) => {
    if (tabControllers.has(profile)) {
        tabControllers.get(profile).abort();
    }
    const controller = new AbortController();
    tabControllers.set(profile, controller);

    const tabs = profile.querySelectorAll('.profile-tab[data-tab]');
    const tabContents = profile.querySelectorAll('.profile-tab-content');
    const followTab = profile.querySelector('.profile-tab[data-tab="follow"]');
    const followDropdown = followTab?.querySelector('.follow-dropdown');

    const shouldHideActivity = !userProfile?.activity && !isOwnProfile;

    const handleDropdownItemClick = (e) => {
        const target = e.target.closest('.dropdown-item');
        if (!target) return;

        e.preventDefault();
        
        if (target.dataset.action === 'followers') {
            UiModule.searchFollowRequestDrawerUI.open();
        } else if (target.dataset.action === 'follow-request') {
            ProfileModule.renderFollowRequests();
        }
        activateTab(target);
    };

    if (followDropdown) {
        followDropdown.addEventListener('click', handleDropdownItemClick, { 
            signal: controller.signal 
        });
    }

    const activateTab = (targetElement) => {
        const targetId = targetElement?.dataset.tab;
        if (!targetId) return;

        const isFollowSubItem = followDropdown?.contains(targetElement);

        tabs.forEach(tab => {
            const isMainFollowTab = tab.dataset.tab === 'follow';
            const isDirectTarget = tab === targetElement;
            tab.classList.toggle('active', isDirectTarget || (isFollowSubItem && isMainFollowTab));
        });

        tabContents.forEach(content => {
            content.classList.toggle('active', content.classList.contains(targetId));
        });

        if (followDropdown) {
            followDropdown.style.display = 'none';
        }
    };

    const handleInteraction = (e) => {
        const target = e.target.closest('[data-tab]');
        if (!target) return;

        e.preventDefault();
        
        if (target === followTab) {
            const isVisible = followDropdown.style.display === 'block';
            followDropdown.style.display = isVisible ? 'none' : 'block';
        } else {
            activateTab(target);
            if (target.dataset.tab === 'blocked') {
                const containter = profile.querySelector('.profile-tab-content.blocked ul');
                UiModule.addLoadingMessageUI( containter, {
                    type: 'profile',
                    position: 'after',
                    empty: true,
                    count: userProfile?.blocked?.length || 1
                });
                postMessage('getBlocked', {});
            }
        }
    };
    
    const handleClickOutside = (e) => {
        if (followDropdown && !followTab.contains(e.target)) {
            followDropdown.style.display = 'none';
        }
    };

    profile.addEventListener('click', handleInteraction, { signal: controller.signal });
    document.addEventListener('click', handleClickOutside, { signal: controller.signal });

    const activityTabs = ['comments', 'likes', 'shares'];
    tabs.forEach(tab => {
        const tabType = tab.dataset.tab;
        if (activityTabs.includes(tabType)) {
            tab.style.display = shouldHideActivity ? 'none' : '';
        } else if (tabType === 'bookmarks') {
            tab.style.display = isOwnProfile ? '' : 'none';
        }
    });

    const itemsToToggle = ['blocked', 'follow-request'];
    itemsToToggle.forEach(name => {
        const selector = `[data-tab="${name}"], [data-action="${name}"]`;
        profile.querySelectorAll(selector).forEach(el => {
            el.style.display = isOwnProfile ? 'flex' : 'none';
        });
    });

    const defaultTabName = shouldHideActivity ? 'followers' : 'comments';
    let defaultTabElement = profile.querySelector(`[data-tab="${defaultTabName}"]`);

    if (defaultTabElement) {
        activateTab(defaultTabElement);
    } else if (tabs.length > 0) {
        const firstVisibleTab = Array.from(tabs).find(t => t.style.display !== 'none');
        if (firstVisibleTab && firstVisibleTab.dataset.tab !== 'follow') {
            activateTab(firstVisibleTab);
        } else {
            const fallbackFollowers = followDropdown?.querySelector('[data-tab="followers"]');
            if (fallbackFollowers) {
                activateTab(fallbackFollowers);
            }
        }
    }
};

const renderSections = async (profile, userProfile) => {
    const sections = [
        { data: userProfile?.activity?.comments, selector: '.comments ul', creator: createCommentItem, empty: 'noComments' },
        { data: userProfile?.activity?.likes, selector: '.likes ul', creator: createLikeItem, empty: 'noLikes' },
        { data: userProfile?.activity?.shares, selector: '.shares ul', creator: createShareItem, empty: 'noShares' },
        { data: userProfile?.followers?.filter(Boolean), selector: '.profile-tab-content.follower ul', creator: createFollowerItem, empty: 'noFollowers' },
        { data: userProfile?.following?.filter(Boolean), selector: '.profile-tab-content.followed ul', creator: createFollowerItem, empty: 'noFollowing' },
        { data: userProfile?.bookmarks, selector: '.profile-tab-content.bookmarks ul', creator: createBookmarkItem, empty: 'noBookmarks' }
    ];

    await Promise.all(sections.map(({ data, selector, creator, empty }) => 
        renderProfileSection(data, profile.querySelector(selector), creator, empty)
    ));
};

const renderBlockedUsers = async (blockedUsers) => {
    try {
        const container = document.querySelector('.profile-tab-content.blocked ul');
        if (!container) return;

        if (!blockedUsers?.length) {
            container.innerHTML = createEmptyState('noBlockedUsers');
            return;
        }

        const htmlItems = await Promise.all(
            blockedUsers.map(user => 
                createFollowerItem(user, {
                    showFollowButton: true,
                    isBlocked: true,
                    isFollowing: false,
                    showRequestActions: false
                })
            )
        );

        container.innerHTML = htmlItems.join('');
        document.querySelectorAll('.unblock-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const clickedButton = e.currentTarget;
                clickedButton.disabled = true;
                const memberId = clickedButton.dataset.memberId;
                postMessage('unblockUser', { memberId });
            });
        });

        attachProfileClickListeners();

    } catch (error) {
        handleError(error, 'renderBlockedUsers');
    }
};

const updateTabCounts = (profile, userProfile) => {
    const tabCountMap = {
        comments: userProfile?.counts?.comments || 0,
        likes: userProfile?.counts?.likes || 0,
        shares: userProfile?.counts?.shares || 0,
        follower: userProfile?.counts?.followers || 0,
        followed: userProfile?.counts?.following || 0,
        blocked: userProfile?.blocked?.length || 0,
        bookmarks: userProfile?.counts?.bookmarks || 0
    };

    Object.keys(tabCountMap).forEach(tab => {
        if (tab === 'follower' || tab === 'followed' || tab === 'blocked') {
            const dropdownItem = profile.querySelector(`.follow-dropdown .dropdown-item[data-tab="${tab}"] .counter`);
            if (dropdownItem) {
                dropdownItem.textContent = `${UtilsModule.formatNumberAbbreviated(tabCountMap[tab])}`;
            }
        } else {
            updateCounter(tab, tabCountMap[tab]);
        }
    });
};

const initializeInteractions = () => {
    attachProfileClickListeners();
    attachFollowButtonListeners();
    setupSearchHandlers();
};

const renderProfileListLikes = async (payload) => {
    try {
        const likesContainer = UiModule.getLikesListUI();
        if (!likesContainer) return;

        likesContainer.innerHTML = '';

        // Procesar los datos de likes
        const likesData = payload?.likes || [];
        const totalLikes = payload?.totalLikes;
        const viewsCount = payload?.viewsCount;

        const likesCountElement = document.querySelector('.likes-count');
        const viewsCountElement = document.querySelector('.views-count');
        const likesCountParent = likesCountElement?.parentElement;
        const viewsCountParent = viewsCountElement?.parentElement;

        // Manejar el contador de likes según las nuevas reglas
        if (likesCountElement) {
            if (typeof totalLikes !== 'undefined') {
                likesCountElement.textContent = UtilsModule.formatNumberAbbreviated(totalLikes);
                likesCountParent.style.removeProperty('display');
            } else if (likesData.length < 100) {
                likesCountElement.textContent = UtilsModule.formatNumberAbbreviated(likesData.length);
                likesCountParent.style.removeProperty('display');
            } else {
                likesCountParent.style.display = 'none';
            }
        }

        if (viewsCountElement) {
            if (typeof viewsCount !== 'undefined') {
                viewsCountElement.textContent = UtilsModule.formatNumberAbbreviated(viewsCount);
                viewsCountParent.style.removeProperty('display');
            } else {
                viewsCountParent.style.display = 'none';
            }
        }

        if (!likesData.length) {
            likesContainer.innerHTML = createEmptyState('noLikes');
            return;
        }

        const likesList = document.createElement('ul');
        let likesHTML = '';
        
        for (const user of likesData) {
            const likeItem = await createLikeProfileItem(user);
            likesHTML += likeItem;
            memberProfiles.set(user.author, user); // Cachear perfil
        }

        likesList.innerHTML = likesHTML;

        likesContainer.appendChild(likesList);

        attachProfileClickListeners();
        attachFollowButtonListeners();

    } catch (error) {
        handleError(error, 'renderProfileListLikes');
        const likesContainer = UiModule.getLikesListUI();
        if (likesContainer) {
            likesContainer.innerHTML = createEmptyState('errorLoadingLikes');
        }
    }
};

const createLikeProfileItem = async (user) => {
    const isFollowing = user.isFollowing || false;
    return await createFollowerItem(user, {
        showFollowButton: true,
        isFollowing: isFollowing,
        showRequestActions: false
    });
};

const renderProfileLikes = async (payload) => {
    try {
        const likesList = UiModule.getLikesListUI();
        if (!likesList) throw new Error('Community-quelora-likes-list element not found');

        const ulLikes = document.createElement('ul');
        const likes = payload?.likes || [];

        const likesCount = likesList.parentElement.querySelector('.likes-count');
        if (likesCount) {
            likesCount.textContent = UtilsModule.formatNumberAbbreviated(likes.length);
        }

        if (likes.length) {
            const htmlItems = await Promise.all(likes.map(async (like) => {
                const html = await createLikeItem(like);
                const { author } = like;
                if (author) {
                    const key = typeof author.author === 'string' ? author.author : author;
                    const value = typeof author.author === 'string' ? author : like;
                    memberProfiles.set(key, value);
                }
                return html;
            }));
            ulLikes.innerHTML = htmlItems.join('');
        } else {
            ulLikes.innerHTML = createEmptyState('noLikes');
        }

        likesList.innerHTML = '';
        likesList.appendChild(ulLikes);
        attachProfileClickListeners();
        attachFollowButtonListeners();
        UiModule.likesDrawerUI.open();
    } catch (error) {
        handleError(error, 'renderProfileLikes');
    }
};

const renderFollowRequests = async () => {
    try {
        const container = document.querySelector('#quelora-follow-request .quelora-follow-request-list');
        if (!container) return;

        const ownProfile = await getOwnProfile();
        const requests = ownProfile?.followRequests || [];

        if (!requests.length) {
            container.innerHTML = createEmptyState('noFollowRequests');
            UiModule.followRequestDrawerUI.open();
            return;
        }

        let html = '<ul>';

        for (const request of requests) {
            const item = !isBlockedAuthor(request.requester.author)
                ? await createFollowerItem(request.requester, {
                    requestId: request._id,
                    showRequestActions: true,
                    showFollowButton: false,
                    requestTime: request.created_at,
                    animationClasses: {
                        accept: 'flip-out-hor-top',
                        reject: 'flip-out-hor-bottom'
                    }
                })
                : null;
            
            if (item) html += item;
        }

        html += '</ul>';
        container.innerHTML = html;

        const checkEmptyFollowRequests = () => {
            const remaining = container.querySelectorAll('.follower-item');
            if (remaining.length === 0) {
                container.innerHTML = createEmptyState('noFollowRequests');
            }
        };

        document.querySelectorAll('.accept-request').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const requestId = e.currentTarget.dataset.requestId;
                const memberId = e.currentTarget.dataset.memberId;
                const item = e.currentTarget.closest('.follower-item');
                item.classList.add('swing-out-top-bck');

                item.addEventListener('animationend', () => {
                    item.remove();
                    StorageModule.removeSessionItem('quelora_profile');
                    postMessage('approveFollowUser', { requestId, memberId, approve: true });
                    checkEmptyFollowRequests();
                }, { once: true });
            });
        });

        document.querySelectorAll('.reject-request').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const requestId = e.currentTarget.dataset.requestId;
                const memberId = e.currentTarget.dataset.memberId;
                const item = e.currentTarget.closest('.follower-item');
                if (item) {
                    item.classList.add('swing-out-top-bck');
                    item.addEventListener('animationend', () => {
                        item.remove();
                        StorageModule.removeSessionItem('quelora_profile');
                        postMessage('approveFollowUser', { requestId, memberId, approve: false });
                        checkEmptyFollowRequests();
                    }, { once: true });
                }
            });
        });

        UiModule.followRequestDrawerUI.open();

    } catch (error) {
        handleError(error, 'renderFollowRequests');
    }
};

const findMention = async (inputElement, query) => {
    try {
        const previousContainer = document.querySelector('.mention-suggestions');
        if (previousContainer) {
            previousContainer.remove();
        }

        const ownProfile = await getOwnProfile(true);
        const profiles = ownProfile.following || [];
        const uniqueProfiles = Array.from(new Map(profiles.map(p => [p.author, p])).values());

        const localResults = uniqueProfiles.filter(p => 
            p.name?.toLowerCase().includes(query.toLowerCase()) ||
            p.given_name?.toLowerCase().includes(query.toLowerCase()) ||
            p.family_name?.toLowerCase().includes(query.toLowerCase())
        );

        if (localResults.length <= 5) {
            await fetchMention(query);
        } else {
            await renderCombinedMentionResults(localResults, inputElement);
        }

    } catch (error) {
        console.error('findMention: Error:', error);
        handleError(error, 'findMention');
    }
};

const renderCombinedMentionResults = async (profiles, inputElement) => {
    try {
        let container = document.querySelector('.mention-suggestions');
        if (!container) {
            container = document.createElement('div');
            container.className = 'mention-suggestions';
            container.innerHTML = '<ul></ul>';
            document.body.appendChild(container);
        }

        const ul = container.querySelector('ul');
        if (!ul) {
            container.innerHTML = '<ul></ul>';
        }

        const calculateMaxHeight = () => {
            const drawerContent = UiModule.getCommunityUI().querySelector('.drawer-content');
            const inputContainer = UiModule.getCommunityUI().querySelector('.input-container');
            
            if (drawerContent && inputContainer) {
                const drawerHeight = drawerContent.getBoundingClientRect().height;
                const inputHeight = inputContainer.getBoundingClientRect().height;
                const availableHeight = drawerHeight - inputHeight - 50;
                container.style.maxHeight = `${Math.max(100, availableHeight)}px`;
                container.style.overflowY = 'auto';
            }
        };
        
        calculateMaxHeight();

        const drawerContent = UiModule.getCommunityUI().querySelector('.drawer-content');
        if (drawerContent) {
            const resizeObserver = new ResizeObserver(() => {
                calculateMaxHeight();
            });
            resizeObserver.observe(drawerContent);
        }

        const existingItems = Array.from(ul.querySelectorAll('.follower-item'));
        const existingAuthors = new Set(existingItems.map(item => item.dataset.memberId));

        const newProfiles = profiles.filter(profile => !existingAuthors.has(profile.author));
        
        newProfiles.forEach(profile => memberProfiles.set(profile.author, profile));
        
        const newItems = await Promise.all(
            newProfiles.map(user => 
                !isBlockedAuthor(user.author) 
                    ? createFollowerItem(user, { showFollowButton: false }) 
                    : null
            ).filter(Boolean)
        );
        
        if (newItems.length > 0) {
            const fragment = document.createDocumentFragment();
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newItems.join('');
            while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
            }
            ul.appendChild(fragment);
        }else{
            ul.remove();
            const fragment = document.createDocumentFragment();
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML =  createEmptyState('noResultsForQuery');
            while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
            }
            container.appendChild(fragment);
        }
        
        const allItems = Array.from(ul.querySelectorAll('.follower-item'));
        allItems.sort((a, b) => a.dataset.memberName.toLowerCase().localeCompare(b.dataset.memberName.toLowerCase()));
        allItems.forEach(item => ul.appendChild(item));
        allItems.forEach(item => {
            const newItem = item.cloneNode(true);
            item.replaceWith(newItem);
            
            const user = profiles.find(p => p.author === newItem.dataset.memberId) || 
                        memberProfiles.get(newItem.dataset.memberId);
            
            newItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                MentionModule.prototype.replaceMention.call(
                    { inputElement: inputElement },
                    user.name
                );
                container.remove();
            });
        });
        
        const handleInput = () => {
            const value = inputElement.value;
            const cursorPosition = inputElement.selectionStart;
            const textBeforeCursor = value.slice(0, cursorPosition);
            if (!textBeforeCursor.includes('@')) {
                container.remove();
                inputElement.removeEventListener('input', handleInput);
            }
        };
        
        inputElement.removeEventListener('input', handleInput);
        inputElement.addEventListener('input', handleInput);
        
        UiModule.addElementHeaderUI(container);
    } catch (error) {
        handleError(error, 'renderCombinedMentionResults');
    }
};

const renderMentionResults = async (payload) => {
    const profiles = Array.isArray(payload) ? payload : payload.result;
    const inputElement = document.querySelector('.comment-input');
    if (inputElement) {
        await renderCombinedMentionResults(profiles, inputElement);
    }
};

const renderSearchAccountsResults = async (payload) => {
    try {
        const profiles = Array.isArray(payload) ? payload : payload.result;
        const container = document.querySelector('.quelora-account-request-list');
        if (!container) return;

        const ul = container.querySelector('ul');
        if (!ul) return;
        
        ul.replaceChildren();

        const htmlStrings = await Promise.all(
            profiles.map(user => 
                !isBlockedAuthor(user.author) 
                    ? createFollowerItem(user) 
                    : null
            ).filter(Boolean)
        );

        if (!htmlStrings.length) {
            container.innerHTML = createEmptyState('noResultsForQuery');
            return;
        }

        const fragment = document.createDocumentFragment();
        
        htmlStrings.forEach(html => {
            const template = document.createElement('template');
            template.innerHTML = html.trim();
            fragment.appendChild(template.content.firstChild);
        });
        
        ul.appendChild(fragment);
        attachFollowButtonListeners();
        attachProfileClickListeners();
        
    } catch (error) {
        handleError(error, 'renderSearchResults');
    }
};

const isBlockedAuthor = (author) => {
  if (!hiddenAuthorsCache) {
    try {
      hiddenAuthorsCache = JSON.parse(StorageModule.getSessionItem('quelora_hidden_authors')) ?? [];
    } catch {
      hiddenAuthorsCache = [];
    }
  }
  return hiddenAuthorsCache.includes(author);
};

const refreshBlockedAuthors = () => { hiddenAuthorsCache = null; };

const memberBlockStatus = async (payload) => {
try {
        const { memberId, block } = payload;
        const buttonSelector = `#quelora-profile > div.profile-tab-content.blocked button[data-member-id="${memberId}"]`;
        const originalButton = document.querySelector(buttonSelector);
        if (!originalButton) {
            console.warn(`Button not found for memberId: ${memberId}`);
            return;
        }
        const newButton = originalButton.cloneNode(true);
        const isBlocked = block;
        const config = {
            action: isBlocked ? 'unblockUser' : 'blockUser',
            newClass: isBlocked ? 'unblock-button' : 'block-button',
            oldClass: isBlocked ? 'block-button' : 'unblock-button',
            icon: isBlocked ? 'unlock' : 'lock',
            textKey: isBlocked ? 'unblock' : 'block'
        };
        newButton.classList.replace(config.oldClass, config.newClass);
        newButton.innerHTML = `
            <span class="quelora-icons-outlined">${IconsModule.getIconSvg(config.icon)}</span>
            <span class="legend t">${I18n.getTranslation(config.textKey)}</span>
        `;
        newButton.onclick = () => postMessage(config.action, { memberId });
        newButton.disabled = false;
        originalButton.replaceWith(newButton);

    } catch (error) {
        handleError(error, 'updateUserBlockStatus');
    }
};

const ProfileModule = {
    isBlockedAuthor,
    refreshBlockedAuthors,
    initializeProfile,
    findMention,
    setToken,
    logout,
    isLogin,
    getOwnProfile,
    saveMyProfile,
    getMyProfile,
    saveMemberProfile,
    getProfile,
    getMention,
    memberProfiles,
    fetchOwnProfile,
    fetchUpdateProfile,
    fetchFollowingActivities,
    followActions,
    fetchAccounts,
    updateFollowState,
    renderFollowRequests,
    renderProfile,
    renderProfileLikes,
    renderProfileListLikes,
    renderMentionResults,
    renderSearchAccountsResults,
    updateProfileOptionUI,
    updateProfileSettingsUI,
    handleSearchResults,
    renderBlockedUsers,
    memberBlockStatus
};

export default ProfileModule;