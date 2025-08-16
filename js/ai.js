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

const AIModule = (function () {
    function handleError(error, context) {
        console.error(`Error in ${context}:`, error);
    }

    /**
     * Adds a AI button next to a reference element.
     * @param {Object} options - Configuration
     * @param {HTMLElement} options.iconReferenceElement - Element to place button after
     * @param {Function} options.onResult - Callback for recording results
     */
    function addAIButton({ iconReferenceElement }) {
        try {

            if (iconReferenceElement.nextElementSibling?.classList.contains('ai-button')) return;
            const AIButton = document.createElement('span');
            AIButton.classList.add('quelora-icons-outlined', 'ai-button');
            AIButton.textContent = 'robot';
            iconReferenceElement.insertAdjacentElement('afterend', AIButton);
        } catch (error) {
            handleError(error, 'addAIButton');
        }
    }

    return {
        addAIButton
    };
})();

export default AIModule;