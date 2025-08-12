/*!
 * QUELORA – Real-time interaction platform for websites
 * 
 * @author German Zelaya
 * @version 1.0.0
 * @since 2023
 Licensed under the GNU Affero General Public License v3.0
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

import ProfileModule from './profile.js';
import SessionModule from './session.js';
import PostsModule from './posts.js';
import CommentsModule from './comments.js';
import UtilsModule from './utils.js';


// ==================== PRIVATE VARIABLES ====================
let workerInstance;
let token;
let cid;

// ==================== HELPERS ====================
const handleError = (error, context) => {
    console.error(`Error in ${context}:`, error);
    throw error;
};

// ==================== CORE FUNCTIONS ====================
async function initializeCore(dependencies) {
    try {
        workerInstance = dependencies.worker;
        token = dependencies.token;
        cid = dependencies.cid;
        await ProfileModule.initializeProfile(dependencies);
    } catch (error) {
        handleError(error, 'CoreModule.initializeCore');
    }
}

async function removeToken(){
    return await Promise.all([
        PostsModule.setToken(null),
        CommentsModule.setToken(null),
        ProfileModule.setToken(null)
    ]);
}

async function getTokenIfNeeded(existingToken = null, onlyReturnToken = false) {
    try {
        if (existingToken) {
            return existingToken;
        }

        const response = await SessionModule.getToken(onlyReturnToken);
        if (!response || !response.token) {
            return false;
        }

        await Promise.all([
            PostsModule.setToken(response.token),
            CommentsModule.setToken(response.token),
            ProfileModule.setToken(response.token)
        ]);

        if (!onlyReturnToken && !response.isCached) {
            ProfileModule.updateProfileOptionUI();
            UtilsModule.startTimeout(()=> { ProfileModule.getOwnProfile(); } , 100);
            UtilsModule.startTimeout(()=> { PostsModule.updateAllInteractionBars(); } , 300);
            UtilsModule.startTimeout(()=> { CommentsModule.updateAllCommentLikes(); } , 600);
        }

        return response.token;
    } catch (error) {
        handleError(error, 'CoreModule.getTokenIfNeeded');
    }
}

// ==================== PUBLIC API ====================
const CoreModule = {
    initializeCore,
    getTokenIfNeeded,
    removeToken
};

export default CoreModule;