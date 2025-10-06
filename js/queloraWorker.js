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

let sharedIp = null;
let sharedLocation = null;
let apiUrl = 'https://quelora.localhost.ar:444';
let url = null;
let queryParams = '';
let useCaptcha = '';

const cache = new Map();
const cacheConfig = {
    'fetchStats': 5000,
    'getComments': 15000,
    'getReplies': 15000,
    'getProfile': 60000,
    'getMention': 60000,
    'getFollowingActivities': 60000,
    'getAnalysis': 60000,
};

function hashPayload(payload) {
    const jsonString = JSON.stringify(payload);
    return btoa(unescape(encodeURIComponent(jsonString)));
}

self.addEventListener('message', (event) => {
    const { action, payload } = event.data;

    if (action === 'init') {
        sharedIp = payload.ip;
        sharedLocation = payload.location;
        apiUrl = payload.apiUrl || apiUrl;
        useCaptcha = payload.useCaptcha || false;
        return;
    }

    const handleFetch = async (action, url, options, successAction, responseHandler = null) => {
        const cacheDuration = cacheConfig[action];
        const cacheKey = `${action}[${hashPayload(payload)}]`;
        const forceRefresh = payload.forceRefresh === true;

        if (!forceRefresh && cacheDuration && cache.has(cacheKey)) {
            const cachedEntry = cache.get(cacheKey);
            if (Date.now() - cachedEntry.timestamp < cacheDuration) {
                self.postMessage({ action: successAction, payload: cachedEntry.data, originalPayload: payload });
                return;
            }
        }
        
        try {
            const headersWithData = {
                ...options.headers,
                ...(payload.cid && { 'X-Client-ID': payload.cid }),
                ...(sharedIp && { 'X-IP': sharedIp }),
                ...(payload.captchaToken && { 'X-Captcha-Token': payload.captchaToken }),
                ...(sharedLocation && {
                    'X-Country': sharedLocation.country || '',
                    'X-Country-Code': sharedLocation.countryCode || '',
                    'X-Region': sharedLocation.region || '',
                    'X-Region-Code': sharedLocation.regionCode || '',
                    'X-City': sharedLocation.city || '',
                    'X-Lat': sharedLocation.lat || '',
                    'X-Lon': sharedLocation.lon || '',
                })
            };

            const response = await fetch(url, { ...options, headers: headersWithData });

            if (!response.ok && !responseHandler) throw await parseFetchError(response);
            if (responseHandler) return responseHandler(response, successAction, payload);

            const data = await response.json();

            if (cacheDuration) {
                cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
            }

            self.postMessage({ action: successAction, payload: data, originalPayload: payload });

        } catch (error) {

            if (error.message === 'No internet connection.') {
                self.postMessage({ action: 'offline', payload: { message: error.message } });
            } else if (error.message === 'Invalid token') {
                self.postMessage({ action: 'invalidToken', payload: { message: error.message }, originalPayload: payload, originalAction: action });
            } else if (error.message === 'You have already reported this comment.') {
                self.postMessage({ action: 'reportedComment', payload: { message: error.message } });
            } else {
                self.postMessage({ action: 'error', payload: { action, payload, message: error.message, status: error.status || 'unknown', details: error.details || null } });
            }
        }
    };

    const parseFetchError = async (response) => {
        const text = await response.text();
        const error = new Error(`${response.status} ${response.statusText}`);
        error.status = response.status;

        try {
            error.details = JSON.parse(text);
        } catch {
            error.details = text;
        }

        if (response.status === 401 && text.includes('Invalid token')) {
            error.message = 'Invalid token';
        }

        if (response.status === 401 && text.includes('You have already reported this comment')) {
            error.message = 'You have already reported this comment.';
        }

        if (response.status === 499 && text.includes('Invalid captcha')) {
            error.message = 'Invalid captcha';
        }
        
        return error;
    };

    const handleCommentResponse = async (response, successAction, originalPayload) => {
        const status = response.status;

        if (status === 401) {
            self.postMessage({ action: 'invalidToken', payload: { message: 'Invalid token' }, originalPayload, originalAction: action });
            return;
        }

        if (status === 403) {
            const data = await response.json();
            self.postMessage({ action: 'commentBlocked', payload: { ...data, entityId: originalPayload.entityId, isEdit: originalPayload.isEdit || false } });
            return;
        }

        if (status === 500) {
            const data = await response.json();
            self.postMessage({ action: 'internalError', payload: data });
            return;
        }

        const data = await response.json();
        if (data?.message) {
            self.postMessage({
                action: successAction,
                payload: {
                    ...data,
                    entityId: originalPayload.entityId,
                    replyId: originalPayload.replyId,
                    isEdit: originalPayload.isEdit || false
                }
            });
        }
    };

    switch (action) {
        case 'fetchStats':
            const params = { entities: JSON.stringify(payload.entities) };
            if (payload.mapping && Object.keys(payload.mapping).length > 0) {
                params.mapping = JSON.stringify(payload.mapping);
            }
            handleFetch(action, `${apiUrl}/posts/stats?` + new URLSearchParams(params).toString(), {
                method: "GET",
                headers: authHeaders(payload.token)
            }, 'statsFetched');
            break;

        case 'fetchCommentLikes':
            handleFetch(action, `${apiUrl}/comments/likes/${payload.entityId}?` + new URLSearchParams({
                commentIds: JSON.stringify(payload.commentIds)
            }).toString(), {
                method: "GET",
                headers: authHeaders(payload.token)
            }, 'commentLikesFetched');
            break;

        case 'getCommentLikes':
            handleFetch(action, `${apiUrl}/comments/likes/${payload.entityId}/comments/${payload.commentId}`, {
                method: "GET",
                headers: authHeaders(payload.token)
            }, 'getCommentLikesUpdated');
            break;

        case 'setLike':
            handleFetch(action, `${apiUrl}/posts/${payload.entityId}/like`, {
                method: "PUT",
                headers: authHeaders(payload.token)
            }, 'likeUpdated');
            break;

        case 'setLikeComment':
            handleFetch(action, `${apiUrl}/comments/${payload.entityId}/comment/${payload.commentId}/like`, {
                method: "PUT",
                headers: authHeaders(payload.token)
            }, 'likeCommentUpdated');
            break;

        case 'setShare':
            handleFetch(action, `${apiUrl}/posts/${payload.entityId}/share`, {
                method: "PUT",
                headers: authHeaders(payload.token)
            }, 'shareUpdated');
            break;

        case 'createComment':
            handleFetch(action, payload.replyId
                ? `${apiUrl}/comments/${payload.entityId}/comment/${payload.replyId}/reply`
                : `${apiUrl}/comments/${payload.entityId}/comment`, {
                    method: "POST",
                    headers: authHeaders(payload.token),
                    body: JSON.stringify({ text: payload.comment, audio: payload?.audioBase64, hash: payload?.audioHash })
                }, 'commentCreated', handleCommentResponse);
            break;

        case 'editComment':
            payload.isEdit = true;
            handleFetch(action, `${apiUrl}/comments/${payload.entityId}/comment/${payload.commentId}/edit`, {
                method: "PATCH",
                headers: authHeaders(payload.token),
                body: JSON.stringify({ text: payload.editComment })
            }, 'commentCreated', handleCommentResponse);
            break;

        case 'getComments': {
            url = new URL(`${apiUrl}/posts/${payload.entityId}/thread`);
            if (payload.lastCommentId) url.searchParams.append('lastCommentId', payload.lastCommentId);
            if (payload.includeLast) url.searchParams.append('includeLast', payload.includeLast);
            if (payload.forceRefresh) url.searchParams.append('forceRefresh', payload.forceRefresh);

            handleFetch(action, url.toString(), {
                method: "GET",
                headers: authHeaders(payload.token)
            }, 'commentThread');
            break;
        }

        case 'getReplies': {
            url = new URL(`${apiUrl}/posts/${payload.entityId}/replies/${payload.commentId}`);
            if (payload.lastCommentId) url.searchParams.append('lastCommentId', payload.lastCommentId);
            handleFetch(action, url.toString(), {
                method: "GET",
                headers: authHeaders(payload.token)
            }, 'repliesThread');
            break;
        }

        case 'getNested': {
            url = new URL(`${apiUrl}/posts/${payload.entityId}/nested`);
            if (payload.commentId) url.searchParams.append('commentId', payload.commentId);
            if (payload.replyId) url.searchParams.append('replyId', payload.replyId);
            handleFetch(action, url.toString(), {
                method: "GET",
                headers: authHeaders(payload.token)
            }, 'commentNested');
            break;
        }

        case 'delComment':
            handleFetch(action, `${apiUrl}/comments/${payload.entityId}/comment/${payload.commentId}/delete`, {
                method: "DELETE",
                headers: authHeaders(payload.token)
            }, 'delComment');
            break;

        case 'reportComment':
            handleFetch(action, `${apiUrl}/comments/${payload.entityId}/comment/${payload.commentId}/report`, {
                method: "POST",
                headers: authHeaders(payload.token),
                body: JSON.stringify({ type: payload.type, blocked: payload.hideAuthorContent })
            }, 'reportedComment');
            break;

        case 'translateComment':
            handleFetch(action, `${apiUrl}/comments/${payload.entityId}/comment/${payload.commentId}/translate`, {
                method: "GET",
                headers: authHeaders(payload.token)
            }, 'translatedComment');
            break;

        case 'getProfile':
            handleFetch(action, `${apiUrl}/profile/${payload.author}/get`, {
                method: "GET",
                headers: authHeaders(payload.token)
            }, 'returnProfile');
            break;

        case 'getMyProfile':
            handleFetch(action, `${apiUrl}/profile/get`, {
                method: "GET",
                headers: authHeaders(payload.token)
            }, 'returnMyProfile');
            break;

        case 'getMention':
            handleFetch(action, `${apiUrl}/profile/${payload.mention}/mention`, {
                method: "GET",
                headers: authHeaders(payload.token)
            }, 'returnMention');
            break;

        case 'getLikes':
            url = `${apiUrl}/posts/likes/${payload.entityId}`;
            if (payload.commentId) url += `/comments/${payload.commentId}`;
            handleFetch(action, url, {
                method: "GET",
                headers: authHeaders(payload.token)
            }, 'getLikeUpdated');
            break;

        case 'getAnalysis':
            url = `${apiUrl}/posts/analysis/${payload.entityId}`;
            handleFetch(action, url, {
                method: "GET",
                headers: authHeaders(payload.token)
            }, 'getAnalysisResult');
            break;

        case 'followUser':
            handleFetch(action, `${apiUrl}/profile/${payload.memberId}/follow`, {
                method: 'POST',
                headers: authHeaders(payload.token)
            }, 'userFollowed');
            break;

        case 'unfollowUser':
            handleFetch(action, `${apiUrl}/profile/${payload.memberId}/follow`, {
                method: 'DELETE',
                headers: authHeaders(payload.token)
            }, 'userUnfollowed');
            break;

        case 'cancelFollowRequest':
            handleFetch(action, `${apiUrl}/profile/${payload.memberId}/cancel-follow`, {
                method: 'DELETE',
                headers: authHeaders(payload.token)
            }, 'userUnfollowed');
            break;

        case 'approveFollowUser':
            handleFetch(action, `${apiUrl}/profile/${payload.memberId}/follow/approve`, {
                method: 'PATCH',
                headers: authHeaders(payload.token),
                body: JSON.stringify({ approve: payload.approve })
            }, 'userApprovefollowed');
            break;

        case 'unblockUser':
            handleFetch(action, `${apiUrl}/profile/${payload.memberId}/cancel-block`, {
                method: 'DELETE',
                headers: authHeaders(payload.token)
            }, 'memberBlockStatus');
            break;
            
        case 'blockUser':
            handleFetch(action, `${apiUrl}/profile/${payload.memberId}/block`, {
                method: 'POST',
                headers: authHeaders(payload.token)
            }, 'memberBlockStatus');
            break;

        case 'getBlocked':
            handleFetch(action, `${apiUrl}/profile/blocked`, {
                method: 'GET',
                headers: authHeaders(payload.token)
            }, 'returnBlocked');
            break;

        case 'updateProfile':
            handleFetch(action, `${apiUrl}/profile/update`, {
                method: 'PATCH',
                headers: authHeaders(payload.token),
                body: JSON.stringify({ [payload.name]: payload.value })
            }, 'updatedProfile');
            break;

        case 'searchProfileData':
            queryParams = new URLSearchParams({
                type: payload.searchType,
                query: payload.query
            });
            handleFetch(action, `${apiUrl}/profile/${payload.memberId}/search?${queryParams.toString()}`, {
                method: 'GET',
                headers: authHeaders(payload.token)
            }, 'searchProfileResults');
            break;

        case 'getFollowingActivities':
            url = new URL(`${apiUrl}/profile/following/activities`);
            if (payload.lastActivityTime) url.searchParams.append('lastActivityTime', payload.lastActivityTime);
            handleFetch(action, url.toString(), {
                method: 'GET',
                headers: authHeaders(payload.token),
            }, 'followingActivities');
            break;

        case 'toggleBookmark':
            handleFetch(action, `${apiUrl}/profile/${payload.entityId}/bookmark`, {
                method: "POST",
                headers: authHeaders(payload.token)
            }, 'bookmarkUpdated');
            break;

        case 'getCommentAudio':
            handleFetch(action, `${apiUrl}/comments/audio/${payload.commentId}`, {
                method: "GET",
                headers: authHeaders(payload.token)
            }, 'returnAudio');
            break;

        case 'updateSettings':
            handleFetch(action, `${apiUrl}/profile/settings`, {
                method: 'PATCH',
                headers: authHeaders(payload.token),
                body: JSON.stringify({ key:payload.key, value:payload.value })
            }, 'updatedSettingsProfile');
            break;

        case 'searchMention':
            queryParams = new URLSearchParams({
                query: payload.query
            });
            handleFetch(action, `${apiUrl}/profile/search-followers?${queryParams.toString()}`, {
                method: 'GET',
                headers: authHeaders(payload.token)
            }, 'searchMentionResults');
        break;
       
        case 'searchAccounts':
            queryParams = new URLSearchParams({
                query: payload.query
            });
            handleFetch(action, `${apiUrl}/profile/search-followers?${queryParams.toString()}`, {
                method: 'GET',
                headers: authHeaders(payload.token)
            }, 'searchAccountsResults');
        break;
        default:
            self.postMessage({ action: 'error', payload: 'Unknown action' });
    }

    /**
     * Función de utilidad para construir headers comunes con auth
     */
    function authHeaders(token) {
        return {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        };
    }
});