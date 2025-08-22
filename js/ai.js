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
import CommentsModule from './comments.js';
import UiModule from './ui.js';
import UtilsModule from './utils.js';
import AnchorModule from './anchor.js';

// Global variables to store worker instance, token, client ID, entity ID, and disabled state
let workerInstance;
let token;
let cid;
let entityId;
let isDisabled;

/**
 * Initializes the AI module with provided dependencies
 * @param {Object} dependencies - Object containing worker, token, and client ID
 */
async function initializeAI(dependencies) {
    try {
        workerInstance = dependencies.worker;
        token = dependencies.cid ? dependencies.token : await CoreModule.getTokenIfNeeded();
        cid = dependencies.cid;
    } catch (error) {
        console.error('Error initializing AIModule:', error);
        throw error;
    }
}

/**
 * Adds an AI button to the UI for triggering AI analysis
 */
async function addAIButton() {
    try {
        const iconReferenceElement = UiModule.getCommentInputUI();
        if (iconReferenceElement.parentElement.querySelector('.ai-button')) return;

        const AIButton = UiModule.createElementUI({
            tag: 'span',
            classes: ['quelora-icons-outlined', 'ai-button'],
            content: 'robot'
        });


        if (AIButton) {
            AIButton.onclick = async function () {
                if (isDisabled) return;

                const threadsContainer = UiModule.getCommunityThreadsUI();
                entityId = threadsContainer?.getAttribute('data-threads-entity');

                const bodyContent = UiModule.createElementUI({
                    tag: 'div'
                });
                
                if (bodyContent) {
                    UiModule.addLoadingMessageUI(bodyContent, { type: 'message' });
                    const buttons = [
                        { className: 'quelora-btn close-button t', textContent: '{{close}}', onClick: () => UiModule.closeModalUI(), icon: 'close' }
                    ];
                    UiModule.setupModalUI(bodyContent, buttons, '.quelora-comments');
                }
                
                // Ensure a valid token is available
                token = await CoreModule.getTokenIfNeeded(token);
                workerInstance.postMessage({ action: 'getAnalysis', payload: { token, entityId, cid } });
                isDisabled = true;
            };

            iconReferenceElement.insertAdjacentElement('afterend', AIButton);
        } else {
            console.error('Failed to create AI button');
        }

        iconReferenceElement.insertAdjacentElement('afterend', AIButton);
    } catch (error) {
        console.error('Error adding AI button:', error);
    }
}

/**
 * Renders AI analysis within a modal
 * @param {Object} analysisData - Object containing analysis and highlighted comments
 */
function renderAnalysisModal(analysisData) {
    isDisabled = false;
    UiModule.closeModalUI();
    
    const bodyContent = UiModule.createElementUI({
        tag: 'div',
        classes: 'ai-analysis-modal',
        attributes: {
            'data-threads-entity': entityId
        }
    });

    const title = UiModule.createElementUI({
        tag: 'h2',
        content: analysisData.analysis.title
    });
    bodyContent.appendChild(title);

    const subtitle = UiModule.createElementUI({
        tag: 'p',
        classes: 'ai-analysis-subtitle',
        content: analysisData.analysis.debateSummary
    });
    bodyContent.appendChild(subtitle);

    const sentimentContainer = UiModule.createElementUI({
        tag: 'div',
        classes: 'ai-analysis-sentiment',
        innerHTML: `
            <div class="ai-containter">
                <span class="t">{{opinion}}: ${analysisData.analysis.sentiment.positive} {{positive}},</span> 
                ${analysisData.analysis.sentiment.neutral} <span class="t">{{neutral}},</span>
                ${analysisData.analysis.sentiment.negative} <span class="t">{{negative}}</span>
            </div>
            <div class="ai-containter">
                <div class="ai-sentiment-bar">
                    <div class="positive" style="width:${analysisData.analysis.sentiment.positive};"></div>
                    <div class="neutral" style="width:${analysisData.analysis.sentiment.neutral};"></div>
                    <div class="negative" style="width:${analysisData.analysis.sentiment.negative};"></div>
                </div>
            </div>
        `
    });
    bodyContent.appendChild(sentimentContainer);

    // Render highlighted comments with anchor links
    analysisData.analysis.highlightedComments.forEach(hComment => {
        const container = UiModule.createElementUI({
            tag: 'div',
            classes: 'quelora-to-work'
        });
        
        const commentElement = CommentsModule.createCommentElement(hComment.comment, entityId);
        commentElement.querySelector('.comment-actions')?.remove();

        // Generate link to the comment
        const link = AnchorModule.generateLink({
            type: 'comment',
            ids: {
                entity: entityId,
                commentId: hComment._id
            }
        });

        // Click on comment: closes modal and navigates to anchor
        commentElement.style.cursor = 'pointer';
        commentElement.addEventListener('click', () => {
            UiModule.closeModalUI();
            location.hash = link;
        });

        container.appendChild(commentElement);
        bodyContent.appendChild(container);
    });

    const buttons = [
        { className: 'quelora-btn close-button t', textContent: '{{close}}', onClick: () => UiModule.closeModalUI(), icon: 'close' }
    ];
    UiModule.setupModalUI(bodyContent, buttons, '.quelora-comments');
}

// Export the AI module with its methods
const AIModule = {
    initializeAI,
    addAIButton,
    renderAnalysisModal
}

export default AIModule;