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

import CommentsModule from './comments.js';
import UtilsModule from './utils.js';
import ProgressInput from './progressInput.js';
import ProfileModule from './profile.js';
import PostsModule from './posts.js';
import I18n from './i18n.js';
import Drawer from './drawer.js';
import CoreModule from './core.js';
import EntityModule from './entity.js';
import ToastModule from './toast.js';
import AnchorModule from './anchor.js';
import IconsModule  from './icons.js';
import StorageModule from './storage.js';

const likesDrawerUI = new Drawer({
    id: 'likes-list',
    customClass: 'quelora-likes-list',
    title: '{{likes}}',
    content: `<div class="profile-stats">
                <div class="stat-item">
                    <span class="quelora-icons-outlined">favorite</span>
                    <span class="stat-count likes-count">0</span>
                </div>
                <div class="stat-item">
                    <span class="quelora-icons-outlined">visibility</span>
                    <span class="stat-count views-count">0</span>
                </div>
                </div>
                <div class="search-container">
                    <span class="quelora-icons-outlined search-icon">search</span>
                    <input type="text" placeholder="{{search}}" class="search-input" id="likes-search">
                </div>
                <div class="quelora-likes-list" id="quelora-likes-list"></div>`,
    height: '100%',
    transitionSpeed: '0.3s',
    zIndex: 9000,
    position: 'bottom'
});

const commentsDrawerUI = new Drawer({
    id: 'quelora-comments',
    customClass: 'quelora-comments',
    title: '{{comments}}',
    content: `<div class="community-threads"></div>
    <div class="comment-bar-container">
        <div class="input-container">
            <div class="comment-avatar profile-settings" style="display:none"></div>
            <span class="quelora-icons-outlined general-settings"></span>
            <input type="text" placeholder="{{addcomment}}" class="comment-input" id="quelora-input" maxlength="200" enterkeyhint="send" >
            <div class="progress-bar" id="quelora-input-bar"></div>
            <span class="quelora-icons-outlined" id="quelora-send">send</span>
            <span class="quelora-icons-outlined emoji-button" data-target-id="quelora-input">add_reaction</span>
        </div>
    </div>
    <div class="comment-disable-container t">{{comments_disabled}}</div>`,
    height: '100%',
    transitionSpeed: '0.3s',
    zIndex: 9000,
    position: 'bottom',
    afterRender: () => {
        const threads = document.querySelector('#quelora-comments .community-threads');
        if (!threads) {
            return;
        }

        threads.style.position = 'relative';
        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        let refreshButton = null;
        let hasTriggered = false;

        function createRefreshButton() {
            refreshButton = document.createElement('button');
            refreshButton.className = 'quelora-button quelora-icons-outlined loop';
            refreshButton.style.position = 'absolute';
            refreshButton.style.top = '20px';
            refreshButton.style.left = '50%';
            refreshButton.style.width = '40px';
            refreshButton.style.height = '40px';
            refreshButton.style.transform = 'translateX(-50%) scale(1)';
            refreshButton.style.opacity = '0.3';
            refreshButton.style.transition = 'transform 0.1s ease-out, opacity 0.1s ease-out';
            refreshButton.innerHTML = '<span class="quelora-icons-outlined">loop</span>';
            threads.appendChild(refreshButton);
        }

        threads.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            isDragging = false;
            hasTriggered = false;
            if (threads.scrollTop <= 2) {
                isDragging = true;
            }
        });

        threads.addEventListener('touchmove', (e) => {
            if (!isDragging || hasTriggered || threads.parentElement.scrollTop !== 0) return;
            currentY = e.touches[0].clientY;
            const dragDistance = currentY - startY;

            if (dragDistance > 0) {
                if (!refreshButton) {
                    createRefreshButton();
                }

                const moveDistance = dragDistance;
                const rotation = Math.min((dragDistance / 180) * 360, 360);
                const opacity = 0.3 + (dragDistance / 180) * 0.7;

                refreshButton.style.transform = `translateX(-50%) translateY(${moveDistance}px) rotate(${rotation}deg) scale(1)`;
                refreshButton.style.opacity = `${opacity}`;

                if (dragDistance >= 180) {
                    hasTriggered = true;
                    refreshButton.style.transition = 'transform 0.5s ease-in-out, opacity 0.5s ease-in-out';
                    refreshButton.style.transform = 'translateX(-50%) translateY(20px) rotate(-360deg) scale(1)';
                    refreshButton.style.opacity = '0';
                    UtilsModule.startTimeout(() => {
                        if (refreshButton) {
                            threads.removeChild(refreshButton);
                            refreshButton = null;
                        }
                        isDragging = false;
                        const threadsContainer = document.querySelector('.community-threads');
                        if (!threadsContainer) return;
                        const currentEntity = threadsContainer.getAttribute('data-threads-entity');
                        CommentsModule.fetchComments(currentEntity, false, false, true);
                    }, 500);
                }
            }
        });

        threads.addEventListener('touchend', () => {
            if (refreshButton && !hasTriggered) {
                refreshButton.style.transition = 'transform 0.5s ease-in-out, opacity 0.5s ease-in-out';
                refreshButton.style.transform = 'translateX(-50%) translateY(20px) rotate(-360deg) scale(1)';
                refreshButton.style.opacity = '0';
                UtilsModule.startTimeout(() => {
                    if (refreshButton) {
                        threads.removeChild(refreshButton);
                        refreshButton = null;
                    }
                }, 500);
            }
            isDragging = false;
        });
    }
});

const settingsDrawerUI = new Drawer({
    id: 'quelora-community-settings',
    customClass: 'quelora-community-settings',
    title: '{{settings}}',
    content: `<div class="settings-menu">
                <div class="settings-header t">{{session}}</div>
                <div class="profile-container">
                    <div class="settings-option remember-session">
                        <span class="t">{{rememberSession}}</span>
                        <label class="switch">
                            <input type="checkbox" id="quelora-remember-session-toggle" checked>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <div class="settings-divider"></div>
                <div class="settings-header t">{{privacySettings}}</div>
                <div class="settings-option settings-column">
                    <div class="privacy-option-text">
                        <span class="t">{{showActivity}}</span>
                    </div>
                    <div class="btn-group">
                        <button class="privacy-button everyone active" data-value="everyone">
                            <span class="t">{{everyone}}</span>
                        </button>
                        <button class="privacy-button followers" data-value="followers">
                            <span class="t">{{onlyFollowers}}</span>
                        </button>
                        <button class="privacy-button onlyme" data-value="onlyme">
                            <span class="t">{{onlyMe}}</span>
                        </button>
                    </div>
                    <div class="option-description t">{{showActivityDescription}}</div>
                </div>
                <div class="settings-option">
                    <div class="privacy-option-text">
                        <span class="t">{{approveFollowers}}</span>
                        <span class="option-description t">{{approveFollowersDescription}}</span>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="quelora-approve-followers-toggle">
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="settings-divider"></div>
                <div class="settings-header t">{{languagePreferences}}</div>
                <div class="language-select-container">
                    <div class="language-select-wrapper">
                        <span class="quelora-icons-outlined">language</span>
                        <select class="language-select" id="quelora-language-select">
                            <option value="auto" class="t">{{autoDetectLanguage}}</option>
                            <option value="es" class="t">{{spanish}}</option>
                            <option value="en" class="t">{{english}}</option>
                            <option value="de" class="t">{{german}}</option>
                            <option value="fr" class="t">{{french}}</option>
                            <option value="it" class="t">{{italian}}</option>
                            <option value="ja" class="t">{{japanese}}</option>
                            <option value="zh" class="t">{{chinese}}</option>
                            <option value="ru" class="t">{{russian}}</option>
                            <option value="ar" class="t">{{arabic}}</option>
                        </select>
                        <span class="quelora-icons-outlined">arrow_drop_down</span>
                    </div>
                </div>
                <div class="settings-divider"></div>
                <div class="settings-header t">{{themePreferences}}</div>
                <div class="settings-option theme-option" id="quelora-theme-profile">
                    <div class="theme-selector-group">
                        <div class="theme-buttons">
                            <button class="theme-button light-theme">
                                <span class="quelora-icons-outlined">wb_sunny</span>
                                <span class="t">{{lightTheme}}</span>
                            </button>
                            <button class="theme-button dark-theme">
                                <span class="quelora-icons-outlined">nights_stay</span>
                                <span class="t">{{darkTheme}}</span>
                            </button>
                            <button class="theme-button system-theme active">
                                <span class="quelora-icons-outlined">devices</span>
                                <span class="t">{{systemTheme}}</span>
                            </button>
                        </div>
                        <div class="theme-description t">{{themeSelectionDescription}}</div>
                    </div>
                </div>
                <div class="settings-divider"></div>
                <div class="settings-header t">{{notificationSettings}}</div>
                <div class="settings-option">
                    <span class="t">{{webNotifications}}</span>
                    <label class="switch">
                        <input type="checkbox" id="quelora-web-notifications-toggle" checked>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="settings-option">
                    <span class="t">{{emailNotifications}}</span>
                    <label class="switch">
                        <input type="checkbox" id="quelora-email-notifications-toggle" checked>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="settings-option">
                    <span class="t">{{pushNotifications}}</span>
                    <label class="switch">
                        <input type="checkbox" id="quelora-push-notifications-toggle" checked>
                        <span class="slider"></span>
                    </label>
                </div>
                <fieldset class="notification-suboptions" id="quelora-notification-suboptions">
                    <legend class="t visually-hidden">{{notificationSuboptions}}</legend>
                    <div class="settings-option suboption">
                        <span class="t">{{notifyReplies}}</span>
                        <label class="switch">
                            <input type="checkbox" id="quelora-notify-replies-toggle" checked>
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="settings-option suboption">
                        <span class="t">{{notifyLikes}}</span>
                        <label class="switch">
                            <input type="checkbox" id="quelora-notify-likes-toggle" checked>
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="settings-option suboption">
                        <span class="t">{{notifyNewFollowers}}</span>
                        <label class="switch">
                            <input type="checkbox" id="quelora-notify-followers-toggle" checked>
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="settings-option suboption">
                        <span class="t">{{notifyNewPosts}}</span>
                        <label class="switch">
                            <input type="checkbox" id="quelora-notify-posts-toggle" checked>
                            <span class="slider"></span>
                        </label>
                    </div>
                </fieldset>
            </div>`,
    transitionSpeed: '0.3s',
    height: '100%',
    zIndex: 9002,
    closeOnDrag: true,
    position: 'bottom'
});

const profileDrawerUI = new Drawer({
    id: 'quelora-community-profile',
    customClass: 'quelora-community-profile',
    title: '{{profile}}',
    content: `<div class="quelora-community-profile">
                <div id="profile">
                    <div class="profile-user">
                        <div class="container-avatar">
                            <div class="profile-avatar"></div>
                        </div>
                        <div class="user-info">
                            <div class="user-pill">
                                <div class="user"></div>
                            </div>
                            <div class="user-name"></div>
                            <div class="profile-actions">
                            </div>
                        </div>
                    </div>  
                    <div class="profile-private-account" style="display:none">
                        <div class="info">
                            <span class="t"><span class="quelora-icons-outlined">comment</span><span class="interaction">0</span> {{interactions}}  </span>
                            <span class="t"><span class="quelora-icons-outlined">people</span><span class="followers">0</span> {{followers}}  </span>
                            <span class="t"><span class="quelora-icons-outlined">person</span><span class="following">0</span> {{following}}  </span>
                        </div>    
                        <div class="message">
                            <div class="icon"><span class="quelora-icons-outlined">lock</span></div>
                            <div class="text-content">
                                <div class="t line-1">{{privateAccount}}</div>
                                <div class="t line-2">{{followToSeeContent}}</div>
                            </div>
                        </div>
                    </div>  
                    <div class="profile-tabs">
                        <div class="profile-tab" data-tab="comments">
                            <span class="quelora-icons-outlined">comment</span>
                            <p class="counter">(0)</p>
                        </div>
                        <div class="profile-tab" data-tab="likes">
                            <span class="quelora-icons-outlined">favorite</span>
                            <p class="counter">(0)</p>
                        </div>
                        <div class="profile-tab" data-tab="shares">
                            <span class="quelora-icons-outlined">share</span>
                            <p class="counter">(0)</p>
                        </div>
                        <div class="profile-tab" data-tab="follower">
                            <span class="quelora-icons-outlined">people</span>
                            <p class="counter">(0)</p>
                        </div>
                        <div class="profile-tab" data-tab="followed">
                            <span class="quelora-icons-outlined">person</span>
                            <p class="counter">(0)</p>
                        </div>
                        <div class="profile-tab" data-tab="bookmarks">
                            <span class="quelora-icons-outlined">bookmark</span>
                            <p class="counter">(0)</p>
                        </div>
                    </div>
                    <div class="profile-tab-content comments">
                        <div class="search-container">
                            <span class="quelora-icons-outlined search-icon">search</span>
                            <input type="text" placeholder="{{search-comments}}" class="search-input">
                        </div>
                        <ul></ul>
                    </div>
                    <div class="profile-tab-content likes">
                        <div class="search-container">
                            <span class="quelora-icons-outlined search-icon">search</span>
                            <input type="text" placeholder="{{search-likes}}" class="search-input">
                        </div>
                        <ul></ul>
                    </div>
                    <div class="profile-tab-content shares">
                        <div class="search-container">
                            <span class="quelora-icons-outlined search-icon">search</span>
                            <input type="text" placeholder="{{search-shares}}" class="search-input">
                        </div>
                        <ul></ul>
                    </div>
                    <div class="profile-tab-content follower">
                        <div class="search-container">
                            <span class="quelora-icons-outlined search-icon">search</span>
                            <input type="text" placeholder="{{search-follower}}" class="search-input">
                        </div>
                        <ul></ul>
                    </div>
                    <div class="profile-tab-content followed">
                        <div class="search-container">
                            <span class="quelora-icons-outlined search-icon">search</span>
                            <input type="text" placeholder="{{search-followed}}" class="search-input">
                        </div>
                        <ul></ul>
                    </div>
                    <div class="profile-tab-content bookmarks">
                        <div class="search-container">
                            <span class="quelora-icons-outlined search-icon">search</span>
                            <input type="text" placeholder="{{search-bookmarks}}" class="search-input">
                        </div>
                        <ul></ul>
                    </div>
                </div>
            </div>`,
    height: '100%',
    transitionSpeed: '0.3s',
    zIndex: 9003,
    position: 'bottom',
    closeOnDrag: true
});

const notificationDrawerUI = new Drawer({
    id: 'quelora-notification-list',
    customClass: 'quelora-notification-list',
    title: '{{notifications}}',
    content: `<div class="profile-stats">
                <div class="quelora-notification-list" id="community-quelora-notification-list"></div>`,
    height: '100%',
    transitionSpeed: '0.3s',
    zIndex: 9004,
    position: 'bottom'
});

const generalSettingsDrawerUI = new Drawer({
    id: 'quelora-community-general-settings',
    customClass: 'quelora-community-settings',
    title: '{{settings}}',
    content: `<div class="settings-menu">
                <div class="quelora-login-option"><span class="quelora-icons-outlined">login</span><span class="quelora-login-label t">{{login}}</span></div>
                <div class="settings-divider"></div>
                <div class="settings-header t">{{languagePreferences}}</div>
                <div class="language-select-container">
                    <div class="language-select-wrapper">
                        <span class="quelora-icons-outlined">language</span>
                        <select class="language-select">
                            <option value="auto" class="t">{{autoDetectLanguage}}</option>
                            <option value="es" class="t">{{spanish}}</option>
                            <option value="en" class="t">{{english}}</option>
                            <option value="de" class="t">{{german}}</option>
                            <option value="fr" class="t">{{french}}</option>
                            <option value="it" class="t">{{italian}}</option>
                            <option value="ja" class="t">{{japanese}}</option>
                            <option value="zh" class="t">{{chinese}}</option>
                            <option value="ru" class="t">{{russian}}</option>
                            <option value="ar" class="t">{{arabic}}</option>
                        </select>
                        <span class="quelora-icons-outlined">arrow_drop_down</span>
                    </div>
                </div>
                <div class="settings-divider"></div>
                <div class="settings-header t">{{themePreferences}}</div>
                <div class="settings-option theme-option">
                    <div class="theme-selector-group">
                        <div class="theme-buttons">
                            <button class="theme-button light-theme">
                                <span class="quelora-icons-outlined">wb_sunny</span>
                                <span class="t">{{lightTheme}}</span>
                            </button>
                            <button class="theme-button dark-theme">
                                <span class="quelora-icons-outlined">nights_stay</span>
                                <span class="t">{{darkTheme}}</span>
                            </button>
                            <button class="theme-button system-theme active">
                                <span class="quelora-icons-outlined">devices</span>
                                <span class="t">{{systemTheme}}</span>
                            </button>
                        </div>
                        <div class="theme-description t">{{themeSelectionDescription}}</div>
                    </div>
                </div>
            </div>`,
    transitionSpeed: '0.3s',
    height: '50%',
    zIndex: 9005,
    closeOnDrag: true,
    position: 'bottom'
});

const followRequestDrawerUI = new Drawer({
    id: 'quelora-follow-request',
    customClass: 'quelora-follow-request',
    title: '{{followRequest}}',
    content: `<div class="quelora-follow-request-list"></div>`,
    height: '100%',
    transitionSpeed: '0.3s',
    zIndex: 9006,
    position: 'bottom'
});

const searchFollowRequestDrawerUI = new Drawer({
    id: 'quelora-search-follow-request',
    customClass: 'quelora-follow-request',
    title: '{{searchAccounts}}',
    content: `<div class="search-container">
                <span class="quelora-icons-outlined search-icon">search</span>
                <input type="text" placeholder="{{search}}" class="search-input" id="accounts-search">
              </div>
              <div class="quelora-account-request-list"><ul></ul></div>`,
    height: '100%',
    transitionSpeed: '0.3s',
    zIndex: 9007,
    position: 'bottom'
});

const closeModalUI = () => {
    const modal = document.querySelector('.quelora-modal');
    if (!modal) return;

    const blurContainer = modal.dataset.blur;
    modal.style.display = 'none';
    
    if (blurContainer) {
        document.querySelector(blurContainer)?.style.removeProperty('filter');
    }
};

function renderActivitiesUI(activities) {
    try {
        const notificationList = document.querySelector('#community-quelora-notification-list');
        if (!notificationList || !activities || activities.status !== "ok" || !activities.activities?.length) {
        const notificationFloat = document.querySelector('.notification-float');
        if (notificationFloat) notificationFloat.style.display = 'none';
        return;
        }

        let storedActivities = JSON.parse(StorageModule.getSessionItem('quelora_notifications_activities')) || [];
        let lastActivityTime = StorageModule.getSessionItem('quelora_notifications_last_activity_time') || 0;

        const newActivities = activities.activities.filter(activity => 
        new Date(activity.created_at).getTime() > new Date(lastActivityTime).getTime()
        );

        const allActivities = [...new Map([...storedActivities, ...activities.activities]
        .map(item => [item._id, item])).values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const latestActivityTime = activities.activities.reduce((max, activity) => 
        Math.max(max, new Date(activity.created_at).getTime()), new Date(lastActivityTime).getTime()
        );

        StorageModule.setSessionItem('quelora_notifications_activities', JSON.stringify(allActivities));
        StorageModule.setSessionItem('quelora_notifications_last_activity_time', new Date(latestActivityTime).toISOString());

        notificationList.innerHTML = `<ul class="quelora-notification-list">${allActivities.map(activity => {
        const ids = {
            entity: activity.references?.entity,
            commentId: activity.references?.commentId,
            replyId: activity.references?.replyId,
            follow: activity.references?.profileId
        };
        const link = AnchorModule.generateLink({ type: activity.action_type, ids });
        const avatarStyle = activity.author?.picture ? `style="background-image: url('${activity.author.picture}'); background-size: cover;"` : '';
        const avatarContent = activity.author?.picture ? '' : activity.author?.author_username?.charAt(0)?.toUpperCase() || '';
        const actionText = {
            share: I18n.getTranslation('sharedPost'),
            like: activity.entity?.type === 'comment' ? I18n.getTranslation('likedYourComment') : I18n.getTranslation('likedPost'),
            comment: I18n.getTranslation('commentedOnPost'),
            reply: I18n.getTranslation('repliedToYourComment'),
            follow: I18n.getTranslation('isFollow'),
            default: I18n.getTranslation('performedAnAction')
        }[activity.action_type] || I18n.getTranslation('performedAnAction');
        const preview = activity.entity?.preview ? `<span class="notification-preview">${activity.entity.preview}</span>` : '';

        return `<li class="quelora-notification-item" data-link="${link}">
                    <div class="comment-avatar" ${avatarStyle} data-visibility="${activity.author?.visibility}">${avatarContent}</div>
                    <div class="notification-content">
                    <div class="notification-text-container">
                        <span class="notification-message"><strong>${activity.author?.author_username || ''}</strong><span class="t">${actionText}</span></span>
                        <span class="notification-time t">${UtilsModule.getTimeAgo(activity.created_at)}</span>
                    </div>
                    ${preview}
                    </div>
                </li>`;
        }).join('')}</ul>`;

        const handleNotificationClick = (item) => () => {
            window.location.href = item.dataset.link;
            UiModule.notificationDrawerUI.close();
        };

        notificationList.querySelectorAll('.quelora-notification-item').forEach(item => {
            item.removeEventListener('click', handleNotificationClick(item));
            item.addEventListener('click', handleNotificationClick(item));
        });

        if (newActivities.length) {
            ToastModule.info(
                '<span class="quelora-icons-outlined bellRing">notifications</span>',
                I18n.getTranslation('notifications'),
                `${I18n.getTranslation('youHave')} ${newActivities.length} ${I18n.getTranslation(newActivities.length === 1 ? 'notification' : 'notifications')}`,
                () => UiModule.notificationDrawerUI.show()
            );
        }
    } catch (error) {
        console.error('Error rendering activities:', error);
        const notificationList = document.querySelector('#community-quelora-notification-list');
        if (notificationList) {
        notificationList.innerHTML = `<li class="error-message">${I18n.getTranslation('errorLoadingNotifications')}</li>`;
        }
    }
}

function addLoadingMessageUI(container, { type = 'message', position = 'after', empty = false, count = 1 } = {}) {
    if (!container) return console.error('Container not found');
    if (empty) container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'quelora-loading-message';
    
    if (type === 'message') {
        wrapper.innerHTML = `<div class="quelora-loader"></div>{{loadingMessage}}`;
        wrapper.classList.add('t');
    } else {
        wrapper.innerHTML = Array(count).fill(`
            <div class="quelora-skeleton-message quelora-community-thread">
                <div class="comment-header" style="justify-content:left">
                    <div class="comment-avatar quelora-skeleton quelora-skeleton-avatar"></div>
                    <span class="comment-author quelora-skeleton quelora-skeleton-line" style="height:14px;width:200px"></span>
                </div>
                <div class="comment-text quelora-skeleton quelora-skeleton-line" style="width:32px;height:16px;margin-left:47px"></div>
                <div class="quelora-skeleton quelora-skeleton-line" style="width:140px;height:12px;margin-left:47px"></div>
            </div>
        `).join('');
    }

    container[position === 'before' ? 'prepend' : 'append'](wrapper);
}

async function addProfileSkeletoUI() {
    try {
        const profile = document.getElementById('profile');
        if (!profile) throw new Error('Profile container not found');
        profile.dataset.profileMemberId = '';
        const avatar = profile.querySelector('.profile-avatar');
        avatar.style.backgroundColor = '';
        avatar.style.removeProperty('background');
        avatar.textContent = '';
        avatar.classList.add('quelora-skeleton', 'quelora-skeleton-avatar');

        const background = profile.querySelector('.profile-user');
        background.style.backgroundColor = '';
        background.style.removeProperty('background');

        const editIcon = profile.querySelector('.user + .quelora-icons-outlined');
        const avatarBtn = profile.querySelector('.profile-camara-avatar');
        const backgroundBtn = profile.querySelector('.profile-camara');
        const profileAction = document.querySelector('.profile-actions');

        if (profileAction) profileAction.style.display = 'none';
        if (editIcon) editIcon.remove();
        if (avatarBtn) avatarBtn.remove();
        if (backgroundBtn) backgroundBtn.remove();
        
        const user = profile.querySelector('.user');
        const userName = profile.querySelector('.user-name');

        user.textContent = '';
        userName.textContent = '';

        user.innerHTML = '<div class="comment-author quelora-skeleton quelora-skeleton-line" style="height: 32px; width: 150px;"></div>';
        userName.innerHTML = '<div class="comment-author quelora-skeleton quelora-skeleton-line" style="height: 18px; width: 200px;"></div>';

        const counters = profile.querySelectorAll('.counter');
        counters.forEach(counter => counter.textContent = '');

        const tabContents = profile.querySelectorAll('.profile-tab-content');
        tabContents.forEach(tab => {
            const ul = tab.querySelector('ul');
            if (ul) ul.innerHTML = '';
        });

        const firstTab = profile.querySelector('.profile-tab');
        if (firstTab) firstTab.classList.add('active');
        const firstContent = profile.querySelector('.profile-tab-content');

        if (firstContent) firstContent.classList.add('active');

        if (tabContents[0]){
            const container = firstContent.querySelector('ul');
            for (let i = 0; i < 10; i++) {
                const li = document.createElement('li');
                container.appendChild(li);
                addLoadingMessageUI(li, { type:'skeleton', position: 'after', empty :false, count :1 } );
            }
        }
    } catch (error) {
        console.error('Error adding profile skeleton:', error);
    }
}

function renderErrorMessageUI(message) {
    const threadsContainer = document.querySelector('.community-threads');
    if (!threadsContainer) return;

    threadsContainer.querySelector('.quelora-loading-message')?.remove();
    
    const errorElement = document.createElement('div');
    errorElement.className = 'comment-error-message';
    errorElement.textContent = message;
    errorElement.style.cssText = 'opacity:0; transition:opacity 0.5s ease';
    
    threadsContainer.prepend(errorElement);
    requestAnimationFrame(() => errorElement.style.opacity = '1');
    
    UtilsModule.startTimeout(() => {
        errorElement.style.opacity = '0';
        errorElement.addEventListener('transitionend', () => errorElement.remove(), { once: true });
    }, 5000);
}

function renderReportedUI(message) {
    try {
        const editModal = document.querySelector('.quelora-modal');
        if (!editModal) return;

        const reportContent = document.createElement('div');
        reportContent.classList.add('report-content');

        const icon = document.createElement('span');
        icon.className = `interaction-icon quelora-icons-outlined`;
        icon.textContent = 'check_circle';

        const paragraph = document.createElement('p');
        paragraph.className = 't';
        paragraph.textContent = '{{thankYouMessage}}';

        const button = document.createElement('button');
        button.className = 'close-button t';
        button.appendChild(document.createTextNode(`{{ready}}`));
        button.addEventListener('click', closeModalUI);

        reportContent.appendChild(icon);
        reportContent.appendChild(paragraph);
        reportContent.appendChild(button);

        const dialogBody = editModal.querySelector('.quelora-body');
        if (dialogBody) {
            dialogBody.innerHTML = '';
            dialogBody.appendChild(reportContent);
        }
    } catch (error) {
        console.error('Error rendering reported message:', error);
    }
}

const setupModalUI = (bodyContent, buttonConfigs, blurContainer) => {
    try {
        const modal = document.querySelector('.quelora-modal');
        if (!modal) return;

        const modalBody = modal.querySelector('.quelora-body');
        const footer = modal.querySelector('.quelora-modal-footer');
        
        modalBody.innerHTML = '';
        footer.innerHTML = '';

        if (bodyContent) modalBody.appendChild(bodyContent);

        const handleButtonClick = (onClick) => (event) => onClick && onClick(event); // Pass event to onClick
        buttonConfigs.forEach(({ className, textContent, onClick, icon }) => {
            const button = document.createElement('button');
            button.className = className;
            button.innerHTML = `<span class="quelora-icons-outlined">${icon}</span> ${textContent}`;
            if (onClick) {
                button.removeEventListener('click', handleButtonClick(onClick));
                button.addEventListener('click', handleButtonClick(onClick));
            }
            footer.appendChild(button);
        });

        modal.style.display = 'flex';
        modal.setAttribute('data-blur', blurContainer);

        const handleModalClick = (event) => {
            if (event.target === modal) closeModalUI();
        };
        modal.removeEventListener('click', handleModalClick);
        modal.addEventListener('click', handleModalClick, { once: true });

        const handleContextMenu = (event) => event.preventDefault();
        modal.removeEventListener('contextmenu', handleContextMenu);
        modal.addEventListener('contextmenu', handleContextMenu);

        const communityComments = document.querySelector(blurContainer);
        if (communityComments) communityComments.style.filter = 'blur(2px) contrast(1.5) hue-rotate(90deg)';
    } catch (error) {
        console.error('Error setting up modal:', error);
    }
};

function showEditCommentUI(commentElement) {
    try {
        const threadsContainer = document.querySelector('.community-threads');
        if (!threadsContainer) return;

        const currentEntity = threadsContainer.getAttribute('data-threads-entity');
        const commentHeader = commentElement?.querySelector('.comment-header');
        if (!commentHeader) return;

        const commentId = commentHeader.getAttribute('data-comment-id');
        const canEdit = commentHeader.getAttribute('data-can-edit') === 'true';
        const canDelete = commentHeader.getAttribute('data-can-delete') === 'true';
        const isReply = commentHeader.getAttribute('data-is-reply') === 'true';
    
        const bodyContent = document.createElement('div');
        bodyContent.className = 'quelora-to-work';

        const clonedCommentElement = commentElement.cloneNode(true);
        clonedCommentElement.querySelector('.community-thread')?.remove();
        clonedCommentElement.querySelector('.comment-actions')?.remove();
        clonedCommentElement.querySelector('.comment-like')?.remove();
        bodyContent.appendChild(clonedCommentElement);
    
        if (canEdit) {
            const editConteiner = document.createElement('div');
            editConteiner.className = 'edit-container';
            
            const commentText = commentElement.querySelector('.comment-text')?.textContent || '';
            const editInput = document.createElement('input');
            editInput.type = 'text';
            editInput.value = commentText;
            editInput.className = 'comment-input';
            editInput.id = 'quelora-input-edit';
            editInput.setAttribute('placeholder', '{{addcomment}}');
            editInput.setAttribute('enterkeyhint', 'send');

            const limit = isReply ? 
                UtilsModule.getConfig(currentEntity)?.limits?.reply_text : 
                UtilsModule.getConfig(currentEntity)?.limits?.comment_text;
            editInput.maxLength = limit || 200;
    
            const editBar = document.createElement('div');
            editBar.className = 'progress-bar';
            editBar.id = 'quelora-input-edit-bar';
    
            const inputContainer = document.createElement('div');
            inputContainer.className = 'input-container';
            inputContainer.appendChild(editInput);
            inputContainer.appendChild(editBar);
            editConteiner.appendChild(inputContainer);

            if(!UtilsModule.isMobile){
                const emojiButton = document.createElement('span');
                emojiButton.classList.add('quelora-icons-outlined', 'emoji-button');
                emojiButton.setAttribute('data-target-id', 'quelora-input-edit');
                emojiButton.textContent = 'add_reaction';
                editConteiner.appendChild(emojiButton);
            }

            bodyContent.appendChild(editConteiner);

            const handleKeydown = (event) => {
                try {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleConfirmEdit(event);
                    }
                } catch (error) {
                    console.error('Error handling input keydown:', error);
                }
            };

            editInput.removeEventListener('keydown', handleKeydown);
            editInput.addEventListener('keydown', handleKeydown);
        }
    
        const buttons = [];
        
        if (canEdit) {
            buttons.push({
                className: 'save-button t',
                textContent: '{{send}}',
                onClick: (event) => handleConfirmEdit(event),
                icon: 'send'
            });
        }

        buttons.push(
            { className: 'close-button t', textContent: '{{close}}', onClick: () => closeModalUI(), icon: 'close' },
            { className: 'report-button t', textContent: '{{report}}', onClick: () => showReportCommentUI(commentElement), icon: 'flag' }
        );
    
        if (UtilsModule.getConfig(currentEntity)?.editing?.allow_delete && canDelete) {
            buttons.push({
                className: 'delete-button t',
                textContent: '{{delete}}',
                onClick: (event) => handleConfirmDelete(event),
                icon: 'delete'
            });
        }
    
        setupModalUI(bodyContent, buttons, '.quelora-comments');

        ProgressInput("quelora-input-edit", "quelora-input-edit-bar");
    
        function handleConfirmEdit(event) {
            try {
                event.preventDefault();
                const editInput = bodyContent.querySelector('.comment-input');
                if (!editInput) return;
        
                const editComment = editInput.value;
                const pickerContainer = document.getElementById('quelora-picker-container');
                if (pickerContainer) {
                    pickerContainer.style.display = 'none';
                }
        
                CommentsModule.fetchEditComment(currentEntity, commentId, editComment);
                closeModalUI();
            } catch (error) {
                console.error('Error confirming edit:', error);
            }
        }
    
        let deleteTimeout;  
        let deleteCountdown = 5;
        let countdownInterval;
    
        function handleConfirmDelete() {
            try {
                const modal =  document.querySelector('.quelora-modal');
                const deleteButton = modal.querySelector('.delete-button');
        
                const currentState = deleteButton.getAttribute('data-state');
        
                if (currentState === 'cancel') {
                    clearTimeout(deleteTimeout);
                    clearInterval(countdownInterval);
        
                    deleteButton.textContent = '';
        
                    const icon = document.createElement('span');
                    icon.classList.add('quelora-icons-outlined');
                    icon.textContent = 'delete';
                    deleteButton.appendChild(icon);
        
                    const text = document.createTextNode(` ${I18n.getTranslation('delete')}`);
                    deleteButton.appendChild(text);
        
                    deleteButton.classList.remove('counting');
                    deleteButton.setAttribute('data-state', 'delete');
                    deleteCountdown = 5;
                    return;
                }
        
                deleteButton.textContent = I18n.getTranslation('cancel') + ` (${deleteCountdown})`;
                deleteButton.classList.add('counting');
                deleteButton.setAttribute('data-state', 'cancel');
        
                const executeDeleteComment = () => {
                    try {
                        closeModalUI();
                        CommentsModule.fetchDelComment(currentEntity, commentId);
                    } catch (error) {
                        console.error('Error executing delete:', error);
                    }
                };

                deleteTimeout = UtilsModule.startTimeout(executeDeleteComment, deleteCountdown * 1000);

                const updateDeleteCountdown = () => {
                    try {
                        deleteCountdown--;
                        
                        if (deleteCountdown > 0) {
                            deleteButton.textContent = `${I18n.getTranslation('cancel')} (${deleteCountdown})`;
                        } else {
                            clearInterval(countdownInterval);
                            deleteButton.classList.remove('counting');
                            deleteButton.setAttribute('data-state', 'delete');
                        }
                    } catch (error) {
                        console.error('Error in countdown interval:', error);
                        clearInterval(countdownInterval);
                    }
                };

                countdownInterval = setInterval(updateDeleteCountdown, 1000);
                
            } catch (error) {
                console.error('Error confirming delete:', error);
            }
        }
    } catch (error) {
        console.error('Error showing edit comment modal:', error);
    }
}

function handleAudioResponseUI(commentId, audioBase64) {
    const audioContainer = document.querySelector(`.quelora-audio-container[data-comment-id="${commentId}"]`);
    if (!audioContainer) return;

    audioContainer.querySelectorAll('.quelora-audio-container').forEach(nested => nested.remove());
    
    const audioEl = audioContainer.querySelector('audio');
    const marquee = audioContainer.querySelector('.quelora-audio-transcript');
    if (!audioEl) return;

    audioEl.src = `data:audio/webm;base64,${audioBase64}`;
    audioEl.dataset.loaded = true;
    
    const playBtn = audioContainer.querySelector('.quelora-audio-play');
    if (playBtn) {
        playBtn.innerHTML = IconsModule.getIconSvg('pause');
        audioContainer.classList.remove('loading');
        
        if (marquee) {
            marquee.style.display = 'inline-block';
            const duration = Math.max(marquee.scrollWidth / 50, 10);
            marquee.style.animation = `marquee ${duration}s linear infinite`;
        }
        
        audioEl.play().catch(() => playBtn.innerHTML = IconsModule.getIconSvg('play_arrow'));
    }
}

function audioUI(transcript, audioBase64, audioHash, commentId) {
    try {
        if (commentId && document.querySelector(`.quelora-audio-container[data-comment-id="${commentId}"]`)) return null;

        const audioContainer = document.createElement('div');
        audioContainer.className = 'quelora-audio-container';
        audioContainer.style.cssText = 'margin-top: var(--spacing-md); position: relative; overflow: hidden;';
        if (commentId) audioContainer.dataset.commentId = commentId;
        if (audioHash) audioContainer.dataset.audioHash = audioHash;

        const audioEl = Object.assign(document.createElement('audio'), { className: 'quelora-audio-element' });
        if (audioBase64) {
        audioEl.src = `data:audio/webm;base64,${audioBase64}`;
        audioEl.dataset.loaded = 'true';
        }

        const mainRow = document.createElement('div');
        mainRow.className = 'quelora-audio-main-row';

        const playBtn = document.createElement('span');
        playBtn.className = 'quelora-audio-play';
        playBtn.innerHTML = IconsModule.getIconSvg('play_arrow');

        const progressWrapper = document.createElement('div');
        progressWrapper.className = 'quelora-audio-progress-wrapper';
        const progressBar = document.createElement('div');
        progressBar.className = 'quelora-audio-progress-bar';
        progressWrapper.appendChild(progressBar);

        const timeDisplay = document.createElement('span');
        timeDisplay.className = 'quelora-audio-time';
        timeDisplay.textContent = '0:00';

        mainRow.append(playBtn, progressWrapper, timeDisplay);

        const marqueeWrapper = document.createElement('div');
        marqueeWrapper.className = 'quelora-audio-marquee-wrapper';
        const marquee = document.createElement('div');
        marquee.className = 'quelora-audio-transcript';
        marquee.textContent = transcript || '';
        marqueeWrapper.appendChild(marquee);

        audioContainer.append(audioEl, mainRow, marqueeWrapper);

        const showError = (message) => {
        const errorElement = document.createElement('span');
        errorElement.classList.add('audio-error', 't', 'comment-error-message');
        errorElement.textContent = message;
        audioContainer.appendChild(errorElement);
        audioContainer.classList.remove('loading');
        playBtn.innerHTML = IconsModule.getIconSvg('play_arrow');
        };
        const handlePlayBtnClick = async () => {
            if (audioEl.paused) {
                if (!audioEl.src && commentId) {
                    audioContainer.classList.add('loading');
                    playBtn.innerHTML = IconsModule.getIconSvg('hourglass_empty');
                    CommentsModule.fetchAudio(commentId);
                } else if (audioEl.src) {
                    try {
                        await audioEl.play();
                        playBtn.innerHTML = IconsModule.getIconSvg('pause');
                        marquee.style.display = 'inline-block';
                        marquee.style.animation = `marquee ${Math.max(marquee.scrollWidth / 50, 10)}s linear infinite`;
                    } catch (error) {
                        showError('{{playback_error}}');
                        console.error('Playback error:', error);
                    }
                }
            } else {
                audioEl.pause();
                playBtn.innerHTML = IconsModule.getIconSvg('play_arrow');
                marquee.style.animationPlayState = 'paused';
            }
        };

        const handleTimeUpdate = () => {
            timeDisplay.textContent = `${Math.floor(audioEl.currentTime / 60)}:${Math.floor(audioEl.currentTime % 60).toString().padStart(2, '0')}`;
            if (audioEl.duration) progressBar.style.width = `${(audioEl.currentTime / audioEl.duration) * 100}%`;
        };

        const handleProgressClick = (e) => {
            if (audioEl.src && audioEl.duration) audioEl.currentTime = (e.offsetX / progressWrapper.offsetWidth) * audioEl.duration;
        };

        const handleAudioEnded = () => {
            playBtn.innerHTML = IconsModule.getIconSvg('play_arrow');
            progressBar.style.width = '0%';
            timeDisplay.textContent = '0:00';
        };

        const handleAudioError = () => showError('{{playback_error}}');

        playBtn.removeEventListener('click', handlePlayBtnClick);
        playBtn.addEventListener('click', handlePlayBtnClick);

        audioEl.removeEventListener('timeupdate', handleTimeUpdate);
        audioEl.addEventListener('timeupdate', handleTimeUpdate);

        progressWrapper.removeEventListener('click', handleProgressClick);
        progressWrapper.addEventListener('click', handleProgressClick);

        audioEl.removeEventListener('ended', handleAudioEnded);
        audioEl.addEventListener('ended', handleAudioEnded);

        audioEl.removeEventListener('error', handleAudioError);
        audioEl.addEventListener('error', handleAudioError);

        return audioContainer;
    } catch (error) {
        console.error('Error in audioUI:', error);
        return null;
    }
}

function showReportCommentUI(commentElement) {
    try {
        const threadsContainer = document.querySelector('.community-threads');
        if (!threadsContainer) return;

        const currentEntity = threadsContainer.getAttribute('data-threads-entity');
        const commentHeader = commentElement?.querySelector('.comment-header');
        if (!commentHeader) return;

        const commentId = commentHeader.getAttribute('data-comment-id');
    
        const reportContent = document.createElement('div');
        reportContent.classList.add('report-content');
    
        const paragraph = document.createElement('p');
        paragraph.classList.add('t');
        paragraph.textContent = '{{reportReasonQuestion}}';
    
        const advertencia = document.createElement('div');
        advertencia.classList.add('adv', 't');
        advertencia.textContent = '{{anonymousReportWarning}}';
    
        const optionsList = document.createElement('ul');
        optionsList.classList.add('report-options-list');
    
        const options = [
            { id: 'option-spam', text: '{{spam}}', type: 'spam' },
            { id: 'option-abuse', text: '{{abuse}}', type: 'abuse' },
            { id: 'option-offensive', text: '{{offensive}}', type: 'offensive' },
            { id: 'option-political', text: '{{political}}', type: 'political' },
            { id: 'option-other', text: '{{other}}', type: 'other' }
        ];
    
        options.forEach(option => {
            try {
                const listItem = document.createElement('li');
                const handleReportClick = (event) => handleReport(event, currentEntity, commentId);
                listItem.id = option.id;
                listItem.classList.add('report-option', 't');
                listItem.setAttribute('data-type', option.type);
                listItem.textContent = option.text;
                listItem.removeEventListener('click', handleReportClick);
                listItem.addEventListener('click', handleReportClick);
                optionsList.appendChild(listItem);
            } catch (error) {
                console.error('Error creating report option:', error);
            }
        });
    
        reportContent.appendChild(paragraph);
        reportContent.appendChild(advertencia);
        reportContent.appendChild(optionsList);
    
        const buttons = [
            { className: 'close-button t', textContent: '{{close}}', onClick: () => closeModalUI(), icon: 'close' }
        ];
    
        setupModalUI(reportContent, buttons,'.quelora-comments');

        function handleReport(event, currentEntity, commentId) {
            try {
                event.preventDefault();
                const type = event.target.getAttribute('data-type');
                CommentsModule.fetchReportComment(currentEntity, commentId, type);
            } catch (error) {
                console.error('Error handling report:', error);
            }
        }
    } catch (error) {
        console.error('Error showing report comment modal:', error);
    }
}

function renderStatsUI(stats) {
    try {
        if (!Array.isArray(stats)) return;

        stats.forEach(stat => {
        if (!stat?.entity) return;

        const container = EntityModule.getInteractionPlacementByEntity(stat.entity);
        const position = EntityModule.getInteractionPosition();
        let interactionElement = document.querySelector(`[data-entity-interaction="${stat.entity}"]`);

        if (!interactionElement && container) {
            interactionElement = createCommunityInteractionBarUI(stat.entity);
            if (interactionElement) {
            const positions = {
                inside: 'appendChild',
                before: 'insertBefore',
                after: 'appendChild',
                replace: 'replaceWith'
            };
            container[positions[position] || 'appendChild'](interactionElement);
            }
        }

        if (!interactionElement) return;

        UtilsModule.setStatsCache(stat);

        if (UtilsModule.getConfig(stat.entity)?.visibility !== 'public') {
            interactionElement.style.display = 'none';
        }

        updateInteractionCounts(interactionElement, stat);
        updateLikeUI(interactionElement, stat.authorLiked);
        updateBookmarkUI(interactionElement, stat.authorBookmarked);
        
        PostsModule.attachEventListeners(stat.entity);
        UtilsModule.setInputLimit(UtilsModule.getConfig(stat.entity)?.limits?.comment_text);

        const dataEntityElement = document.querySelector(`[data-entity="${stat.entity}"]`);
        if (dataEntityElement) dataEntityElement.setAttribute("data-entity-ready", "true");
        });
    } catch (error) {
        console.error('Error rendering stats:', error);
    }
}

function filterListItemsUI(inputId, listSelector) {
    try {
        const searchInput = document.getElementById(inputId);
        const list = document.querySelector(listSelector);
        if (!searchInput || !list) return;

        if (searchInput.dataset.listenerAttached === 'true') return;
        searchInput.dataset.listenerAttached = 'true';

        const handleSearchInput = () => {
            const searchTerm = searchInput.value.toLowerCase();
            const items = list.querySelectorAll('li');
            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        };

        searchInput.removeEventListener('input', handleSearchInput);
        searchInput.addEventListener('input', handleSearchInput);
    } catch (error) {
        console.error('Error filtering list items:', error);
    }
}

function filterListAccountUI() {
    try {
        const searchInput = document.getElementById('accounts-search');
        if (!searchInput) return;

        const handleSearch = async (e) => {
            try {
                const query = e.target.value;
                await ProfileModule.fetchAccounts(query.trim());
            } catch (error) {
                console.error('Error fetching accounts:', error);
            }
        };
        const debouncedHandleSearch = UtilsModule.debounce(handleSearch, 800);
        searchInput.addEventListener('input', debouncedHandleSearch);
        return () => {
            searchInput.removeEventListener('input', debouncedHandleSearch);
        };
    } catch (error) {
        console.error('Error filtering list items:', error);
    }
}

function updateIconUI(selector, activeIcon, inactiveIcon, activeState, activeClass = 'active') {
    const element = this.classList.contains(selector.slice(1)) 
        ? this 
        : this.querySelector?.(selector);
    
    if (element) {
        element.textContent = activeState ? activeIcon : inactiveIcon;
        element.dataset.state = activeState;
        activeState ? element.classList.add(activeClass) : element.classList.remove(activeClass);
    }
}

const updateLikeUI = (el, liked) => updateIconUI.call(el, '.like-icon', 'favorite', 'favorite_border', liked);
const updateBookmarkUI = (el, attached) => updateIconUI.call(el, '.bookmark', 'bookmark', 'bookmark_border', attached);

function updateCounterUI(interactionElement, likesCount, isLikeAdded) {
    try {
        const likeIcon = interactionElement?.classList.contains("like-icon")
            ? interactionElement
            : interactionElement?.querySelector(".like-icon");

        if (likeIcon) {
            likeIcon.textContent = isLikeAdded ? "favorite" : "favorite_border";
            likeIcon.setAttribute('data-liked', isLikeAdded);
            isLikeAdded ? likeIcon.classList.add("active") : likeIcon.classList.remove("active");
        }

        const likeCountElement = interactionElement?.querySelector(".like-count");
        if (!likeCountElement) return;

        let currentCount = parseInt(likeCountElement.textContent, 10) || 0;

        if (isLikeAdded === undefined) {
            likeCountElement.textContent = UtilsModule.formatNumberAbbreviated(likesCount);
        } else if (likesCount < 1000) {
            currentCount = isLikeAdded ? currentCount + 1 : Math.max(0, currentCount - 1);
            likeCountElement.textContent = UtilsModule.formatNumberAbbreviated(currentCount);
        } else {
            likeCountElement.textContent = UtilsModule.formatNumberAbbreviated(likesCount);
        }
    } catch (error) {
        console.error('Error updating counter UI:', error);
    }
}

function updateInteractionCounts(interactionElement, stat) {
    try {
        const entityId = interactionElement.getAttribute("data-entity-interaction");
        const config = UtilsModule.getConfig(entityId)?.interaction;

        const handleInteractionType = (type, allowFlag, countSelector, countValue) => {
            const iconSelector = `.${type}-icon`;
            const iconElement = interactionElement.querySelector(iconSelector);

            if (!config?.[allowFlag]) {
                const itemToHide = iconElement?.closest('.interaction-item') || iconElement;
                if (itemToHide) {
                    itemToHide.style.display = 'none';
                }
            } else if (countSelector && countValue !== undefined) {
                const countElement = interactionElement.querySelector(countSelector);
                if (countElement) {
                    countElement.textContent = countValue;
                }
            }
        };

        handleInteractionType('like', 'allow_likes', '.like-count', stat.likesCount);
        handleInteractionType('share', 'allow_shares', '.share-count', stat.sharesCount);
        handleInteractionType('comment', 'allow_comments', '.comment-count', stat.commentsCount);
        
        // El manejo de bookmarks es ligeramente diferente ya que no tiene un contador de texto
        const bookmarkIcon = interactionElement.querySelector(".bookmark");
        if (!config?.allow_bookmarks && bookmarkIcon) {
            const bookmarkItem = bookmarkIcon.closest('.interaction-actions') || bookmarkIcon;
            if (bookmarkItem) {
                bookmarkItem.style.display = 'none';
            }
        }

    } catch (error) {
        console.error('Error updating interaction counts:', error);
    }
}

function updateCommentUI(entityId, commentData) {
    try {
        let threadsContainer = document.querySelector('.community-threads');
        if (commentData.replyId) {
            threadsContainer = threadsContainer.querySelector(`.comment-replies[data-reply-id="${commentData.replyId}"]`);
        }

        if (commentData.isEdit) {
            threadsContainer = threadsContainer.querySelector(`.community-thread[data-comment-id="${commentData.comment._id}"]`);
        }

        if (!threadsContainer) return;

        const loadingMessage = threadsContainer.querySelector('.quelora-loading-message');
        loadingMessage?.remove();

        const commentElement = CommentsModule.createCommentElement(commentData.comment, entityId, Boolean(commentData.replyId));

        if (commentData.isEdit) {
            threadsContainer.replaceWith(commentElement);
        } else {
            threadsContainer[commentData.replyId ? 'appendChild' : 'insertBefore'](
                commentElement,
                commentData.replyId ? null : threadsContainer.firstChild
            );
        }
    } catch (error) {
        console.error('Error updating comment UI:', error);
    }
}

function wrapCommentElementUI(commentElement) {
    try {
    } catch (error) {
        console.error('Error wrapping comment element:', error);
    }
}

function unwrapCommentElementUI(commentElement) {
    try {
    } catch (error) {
        console.error('Error unwrapping comment element:', error);
    }
}

function createCommunityInteractionBarUI(entity) {
    try {
        const interactionBar = document.createElement('div');
        interactionBar.className = 'community-interaction-bar';
        interactionBar.setAttribute('data-entity-interaction', entity);

        const interactionActions = document.createElement('div');
        interactionActions.className = 'interaction-actions';

        const posts = [
            { icon: 'favorite_border', countClass: 'like-count', iconClass: 'like-icon' },
            { icon: 'chat_bubble_outline', countClass: 'comment-count', iconClass: 'comment-icon' },
            { icon: 'share', countClass: 'share-count', iconClass: 'share-icon' }
        ];

        posts.forEach(interaction => {
            const interactionItem = document.createElement('div');
            interactionItem.className = 'interaction-item';

            const interactionIcon = document.createElement('span');
            interactionIcon.className = `interaction-icon quelora-icons-outlined ${interaction.iconClass}`;
            interactionIcon.textContent = interaction.icon;
            if (interaction.iconClass === 'like-icon') {
                interactionIcon.setAttribute('data-liked', 'false');
            } else if (interaction.iconClass === 'share-icon') {
                interactionIcon.setAttribute('data-shared', 'false');
            }

            const interactionCount = document.createElement('span');
            interactionCount.className = `interaction-count ${interaction.countClass}`;
            interactionCount.textContent = '0';

            interactionItem.appendChild(interactionIcon);
            interactionItem.appendChild(interactionCount);
            interactionActions.appendChild(interactionItem);
        });

        const saveBookmark = document.createElement('span');
        saveBookmark.className = 'bookmark quelora-icons-outlined';
        saveBookmark.textContent = 'bookmark_border';
        saveBookmark.setAttribute('data-attached', false);

        interactionBar.appendChild(interactionActions);
        interactionBar.appendChild(saveBookmark);

        return interactionBar;
    } catch (error) {
        console.error('Error creating interaction bar:', error);
        return null;
    }
}

function addReplyHeaderUI(commentHeader) {
    try {
        const commentBarContainer = document.querySelector('.comment-bar-container');
        const existingReplyHeader = commentBarContainer.querySelector('.reply-header');
        if (existingReplyHeader) {
            existingReplyHeader.remove();
        }

        const commentContainer = commentHeader.closest('.community-thread');
        const commentText = commentContainer.querySelector('.comment-text');
        
        const replyHeader = document.createElement('div');
        replyHeader.classList.add('reply-header');
        
        const clonedHeader = commentHeader.cloneNode(true);
        clonedHeader.querySelector('.comment-like')?.remove();
        const clonedText = commentText.cloneNode(true);
        
        const interactiveElements = clonedHeader.querySelectorAll('.comment-like, .like-icon, .like-count');
        interactiveElements.forEach(element => {
            element.style.pointerEvents = 'none';
            element.style.opacity = '0.5';
        });

        const closeButton = document.createElement('span');
        closeButton.classList.add('quelora-icons-outlined', 'reply-close');
        closeButton.textContent = 'close';
        closeButton.style.cursor = 'pointer';

        const handleCloseButtonClick = () => {
            removeHeaderUI();
            const commentInput = document.getElementById('quelora-input');
            commentInput.removeAttribute('data-reply-id');
            commentInput.value = '';
            commentInput.focus();
            ProgressInput("quelora-input", "quelora-input-bar");
        };

        closeButton.removeEventListener('click', handleCloseButtonClick);
        closeButton.addEventListener('click', handleCloseButtonClick);

        replyHeader.appendChild(closeButton);
        replyHeader.appendChild(clonedHeader);
        replyHeader.appendChild(clonedText);
        addElementHeaderUI(replyHeader);
    } catch (error) {
        console.error('Error adding reply header:', error);
    }
}

function getCounterFromDOMUI(entityId, indicator) {
    const interactionElement = document.querySelector(`[data-entity-interaction="${entityId}"]`);
    if (!interactionElement) return null;

    let selector = '';
    switch (indicator) {
        case 'likes':
            selector = '.like-count';
            break;
        case 'shares':
            selector = '.share-count';
            break;
        case 'comments':
            selector = '.comment-count';
            break;
        case 'bookmarks':
            selector = '.bookmark-count';
            break;
        default:
            return 0;
    }

    const counterElement = interactionElement.querySelector(selector);
    if (!counterElement) return 0;

    // Devolvemos el número parseado del texto del contador
    const count = parseInt(counterElement.textContent, 10);
    return isNaN(count) ? 0 : count;
}

function addElementHeaderUI(element, anchor = false) {
    try {
        const commentBarContainer = document.querySelector('.comment-bar-container');
        if(!anchor) element.classList.add('ui-header');
        commentBarContainer.insertBefore(element, commentBarContainer.querySelector('.input-container'));
    } catch (error) {
        console.error('Error adding reply header:', error);
    }
}

function createEmojiPickerBarUI() {
    let existing = document.querySelector('.quelora-emoji-picker-container');
    if (existing) {
        return;
    }

    const container = document.createElement('div');
    container.className = 'quelora-emoji-picker-container';
    container.id = 'quelora-emoji-picker-container';

    const emojis = ['😀','😂','😎','🥺','🔥','💯','👍','👎','❤️','😡','😱'];
    container.innerHTML = emojis
        .map(emoji => `<button class="quelora-emoji-option" type="button" tabindex="-1">${emoji}</button>`)
        .join('');

    const setupEmojiPicker = () => {
        const input = document.getElementById('quelora-input');
        const emojiPicker = container;

        const handleEmojiPickerInteraction = (e) => {
            if (e.target.classList.contains('quelora-emoji-option')) {
                e.preventDefault();
                e.stopImmediatePropagation();

                const emoji = e.target.textContent;
                const scrollY = window.scrollY;

                insertAtCursor(input, emoji);
                input.focus();
                setTimeout(() => {
                    window.scrollTo(0, scrollY);
                }, 0);
            }
        };

        emojiPicker.removeEventListener('pointerdown', handleEmojiPickerInteraction);
        emojiPicker.addEventListener('pointerdown', handleEmojiPickerInteraction);
    };

    UtilsModule.startTimeout(setupEmojiPicker, 50);

    addElementHeaderUI(container, true);
}

function insertAtCursor(inputElement, text) {
    const start = inputElement.selectionStart;
    const end = inputElement.selectionEnd;
    const currentText = inputElement.value;
    const newText = currentText.substring(0, start) + text + currentText.substring(end);

    inputElement.value = newText;
    inputElement.selectionStart = inputElement.selectionEnd = start + text.length;
}

function removeHeaderUI() {
    try {
        const commentBarContainer = document.querySelector('.comment-bar-container');
        const replyHeader = commentBarContainer.querySelector('.ui-header');
        if (replyHeader) {
            replyHeader.remove();
        }
    } catch (error) {
        console.error('Error removing reply header:', error);
    }
}

function updateUserUI(dataAuthorUser, newText) {
    try {
        document.querySelectorAll(`[data-author-user="${dataAuthorUser}"]`).forEach(element => {
            element.textContent = newText;
        });
    } catch (error) {
        console.error('Error updating user UX:', error);
    }
}

function updateCommentLikeUI(commentId, likesCount, authorLiked) {
    try {
        const commentElements = document.querySelectorAll(`.comment-header[data-comment-id="${commentId}"]`);
        if (!commentElements) return;

        commentElements.forEach(commentElement => {
            const likeIcon = commentElement.querySelector('.like-icon');
            const likeCountElement = commentElement.querySelector('.like-count');

            if (likeIcon) {
                likeIcon.textContent = authorLiked ? 'favorite' : 'favorite_border';
                likeIcon.setAttribute('data-liked', authorLiked);
                authorLiked ? likeIcon.classList.add('active') : likeIcon.classList.remove('active');
            }

            if (likeCountElement) {
                likeCountElement.textContent = UtilsModule.formatNumberAbbreviated(likesCount);
            }
        });
    } catch (error) {
        console.error('Error updating comment like UI:', error);
    }
}

function resetCommentLikeIconsUI() {
    try {
        const likeIcons = document.querySelectorAll('.like-icon');
        likeIcons.forEach(likeIcon => {
            likeIcon.textContent = 'favorite_border';
            likeIcon.setAttribute('data-liked', 'false');
            likeIcon.classList.remove('active');
        });
    } catch (error) {
        console.error('Error resetting like icons:', error);
    }
}

function updateCommentCountUI(entityId, isAdded) {
    try {
        const interactionElement = document.querySelector(`[data-entity-interaction="${entityId}"]`);
        if (!interactionElement) return;

        const commentCountElement = interactionElement.querySelector('.comment-count');
        if (!commentCountElement) return;

        let currentCount = parseInt(commentCountElement.textContent, 10) || 0;
        currentCount = isAdded ? currentCount + 1 : Math.max(0, currentCount - 1);
        commentCountElement.textContent = UtilsModule.formatNumberAbbreviated(currentCount);
    } catch (error) {
        console.error('Error updating comment count:', error);
    }
}

function getCommunityThreadsUI(){
    return document.querySelector('#quelora-comments .community-threads');
}

async function addProfileOptionUI() {
    try {
        const profileButton = document.querySelector('#quelora-comments .general-settings');
        if (!profileButton) return;
        const openDrawer = () => {
            generalSettingsDrawerUI.open(); 
        };
        profileButton.innerHTML = '';
        profileButton.classList.add('profile-button');
        profileButton.innerHTML = '<span class="quelora-icons-outlined">settings</span>';
        profileButton.removeEventListener('click', openDrawer);
        profileButton.addEventListener('click', openDrawer);
    } catch (error) {
        console.error('Error adding profile option:', error);
    }
}

async function setupSettingsOptions() {
    try {
        const settingsMenus = document.querySelectorAll('#quelora-community-settings .settings-menu, #quelora-community-general-settings .settings-menu');
        if (!settingsMenus.length) return;

        const generalSettingsMenus = document.querySelector('#quelora-community-general-settings');  
    
        const handleLoginOptionClick = async () => {
            await CoreModule.getTokenIfNeeded();
            ProfileModule.updateProfileOptionUI();
            UiModule.generalSettingsDrawerUI.close();
        };

        generalSettingsMenus.querySelector('.quelora-login-option').removeEventListener('click', handleLoginOptionClick);
        generalSettingsMenus.querySelector('.quelora-login-option').addEventListener('click', handleLoginOptionClick);
        
        settingsMenus.forEach(settingsMenu => {
            const themeButtons = {
                light: settingsMenu.querySelector('.light-theme'),
                dark: settingsMenu.querySelector('.dark-theme'),
                system: settingsMenu.querySelector('.system-theme')
            };

            if (themeButtons.light && themeButtons.dark && themeButtons.system) {
                const applyTheme = (theme) => {
                    let actualTheme = theme;
                    if (theme === 'system') {
                        document.documentElement.removeAttribute('data-theme');
                        actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                    }
                    document.documentElement.setAttribute('data-theme', actualTheme);
                    StorageModule.setLocalItem('quelora_theme', theme);

                    settingsMenus.forEach(menu => {
                        const buttons = {
                            light: menu.querySelector('.light-theme'),
                            dark: menu.querySelector('.dark-theme'),
                            system: menu.querySelector('.system-theme')
                        };
                        Object.values(buttons).forEach(button => button?.classList.remove('active'));
                        buttons[theme]?.classList.add('active');
                    });
                };

                for (const theme in themeButtons) {
                    themeButtons[theme].addEventListener('click', () => applyTheme(theme));
                }

                const handleThemeChange = () => {
                    if (StorageModule.getLocalItem('quelora_theme') === 'system') {
                        applyTheme('system');
                    }
                };

                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                mediaQuery.removeEventListener('change', handleThemeChange);
                mediaQuery.addEventListener('change', handleThemeChange);

                const savedTheme = StorageModule.getLocalItem('quelora_theme');
                applyTheme(savedTheme || 'system');
            }

            // Configurar select de idiomas
            const languageSelect = settingsMenu.querySelector('.language-select');
            if (languageSelect) {
                const handleLanguageChange = async () => {
                    try {
                        const lang = languageSelect.value;
                        StorageModule.setLocalItem('quelora_language', lang);
                        await I18n.changeLanguage(lang);
                        settingsMenus.forEach(menu => {
                            const select = menu.querySelector('.language-select');
                            if (select) select.value = lang;
                        });
                    } catch (error) {
                        console.error('Error changing language:', error);
                    }
                };

                languageSelect.removeEventListener('change', handleLanguageChange);
                languageSelect.addEventListener('change', handleLanguageChange);
                // Establecer el valor inicial del select si hay un idioma guardado
                const savedLanguage = StorageModule.getLocalItem('quelora_language');
                if (savedLanguage) languageSelect.value = savedLanguage;
            }
        });

    } catch (error) {
        console.error('Error setting up settings options:', error);
    }
}

async function updateProfileUI(ownProfile) {
    const avatarsItems = document.querySelectorAll(`.comment-avatar[data-member-id="${ownProfile.author}"]`);
    const authorsItems = document.querySelectorAll(`.comment-author[data-member-user="${ownProfile.author}"]`);
    
    avatarsItems.forEach(item => {
        item.style.backgroundImage = `url(${ownProfile.picture}?${Math.random()})`;
    });
    
    authorsItems.forEach(item => {
        item.textContent = ownProfile.name;
    });
}

function createProfileDropupUI() {
    try {
        const existingDropup = document.querySelector('.quelora-profile-dropup');
        if (existingDropup) return;

        const dropup = document.createElement('div');
        dropup.className = 'quelora-profile-dropup';
        dropup.style.display = 'none';
        dropup.innerHTML = `
            <ul class="quelora-dropup-menu">
                <li class="dropup-item" data-action="view-profile">
                    <span class="quelora-icons-outlined">person</span>
                    <span class="t">{{myProfile}}</span>
                </li>
                <li class="dropup-item" data-action="settings">
                    <span class="quelora-icons-outlined">settings</span>
                    <span class="t">{{settings}}</span>
                </li>
                <li class="dropup-item" data-action="activity">
                    <span class="quelora-icons-outlined">notifications</span>
                    <span class="t">{{showActivity}}</span>
                </li>
                <li class="divider"></li>
                <li class="dropup-item" data-action="followers">
                    <span class="quelora-icons-outlined">person_search</span>
                    <span class="t">{{searchAccounts}}</span>
                </li>
                <li class="divider"></li>
                <li class="dropup-item" data-action="logout">
                    <span class="quelora-icons-outlined">logout</span>
                    <span class="t">{{logout}}</span>
                </li>
            </ul>
        `;

        const profileButton = document.querySelector('#quelora-comments .profile-settings');
        if (!profileButton) return;

        profileButton.appendChild(dropup);

        const toggleDropup = () => {
            dropup.style.display = dropup.style.display === 'none' ? 'block' : 'none';
        };

        profileButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropup();
        });

        dropup.querySelectorAll('.dropup-item').forEach(item => {
            const handleItemClick = async (e) => {
                e.stopPropagation();
                const action = item.dataset.action;
                if (action === 'view-profile') {
                    ProfileModule.getMyProfile();
                } else if (action === 'settings') {
                    ProfileModule.updateProfileSettingsUI();
                    UiModule.settingsDrawerUI.open();
                } else if (action === 'activity') {
                    await ProfileModule.fetchFollowingActivities(true);
                    notificationDrawerUI.open();
                } else if (action === 'followers') {
                    searchFollowRequestDrawerUI.open();
                } else if (action === 'logout') {
                    await ProfileModule.logout();
                }
                dropup.style.display = 'none';
            };

            item.removeEventListener('click', handleItemClick);
            item.addEventListener('click', handleItemClick);
        });

        const handleOutsideClick = (e) => {
            if (!dropup.contains(e.target) && e.target !== profileButton) {
                dropup.style.display = 'none';
            }
        };

        document.removeEventListener('click', handleOutsideClick);
        document.addEventListener('click', handleOutsideClick);
    } catch (error) {
        console.error('Error creating profile dropup:', error);
    }
}

const initializeUI = () => {
    try {
        filterListItemsUI('likes-search', '#quelora-likes-list');
        addProfileOptionUI();
        setupSettingsOptions();
        createProfileDropupUI();
        filterListAccountUI();
    } catch (error) {
        console.error('Error initializing likes search or settings:', error);
    }
};

const UiModule = {
        initializeUI,
        createProfileDropupUI,
        getCommunityThreadsUI,
        addLoadingMessageUI,
        addProfileSkeletoUI,
        renderReportedUI,
        setupModalUI,
        showEditCommentUI,
        showReportCommentUI,
        renderErrorMessageUI,
        renderStatsUI,
        renderActivitiesUI,
        closeModalUI,
        likesDrawerUI,
        commentsDrawerUI,
        settingsDrawerUI,
        generalSettingsDrawerUI,
        profileDrawerUI,
        notificationDrawerUI,
        followRequestDrawerUI,
        filterListItemsUI,
        updateLikeUI,
        updateBookmarkUI,
        updateCounterUI,
        updateCommentUI,
        updateProfileUI,
        unwrapCommentElementUI,
        wrapCommentElementUI,
        addReplyHeaderUI,
        removeHeaderUI,
        updateUserUI,
        addProfileOptionUI,
        updateCommentLikeUI,
        updateCommentCountUI,
        resetCommentLikeIconsUI,
        addElementHeaderUI,
        handleAudioResponseUI,
        getCounterFromDOMUI,
        createEmojiPickerBarUI,
        audioUI
};

export default UiModule;