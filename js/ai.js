// ==================== AIModule ====================
/*!
 * QUELORA – Real-time interaction platform for websites
 * AI Analysis Modal Renderer
 */

import CommentsModule from './comments.js';
import UiModule from './ui.js';
import UtilsModule from './utils.js';

let workerInstance;
let token;
let cid;
let entityId;
let isDisabled;
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

async function addAIButton() {
    try {
        const iconReferenceElement = document.getElementById('quelora-input');
        if (iconReferenceElement.nextElementSibling?.classList.contains('ai-button')) return;

        const AIButton = document.createElement('span');
        AIButton.classList.add('quelora-icons-outlined', 'ai-button');
        AIButton.textContent = 'robot';

        AIButton.onclick = async function () {
            if (isDisabled) return;

            const threadsContainer = document.querySelector(".community-threads");
            entityId = threadsContainer?.getAttribute('data-threads-entity');

            const bodyContent = document.createElement('div');
            UiModule.addLoadingMessageUI(bodyContent, { type: 'message' });
            const buttons = [
                { className: 'quelora-btn close-button t', textContent: '{{close}}', onClick: () => UiModule.closeModalUI(), icon: 'close' }
            ];
            UiModule.setupModalUI(bodyContent, buttons, '.quelora-comments');
            await UtilsModule.wait(1500);
            workerInstance.postMessage({ action: 'getAnalysis', payload: { token, entityId, cid } });
            isDisabled = true;
        };

        iconReferenceElement.insertAdjacentElement('afterend', AIButton);
    } catch (error) {
        console.error('Error adding AI button:', error);
    }
}

/**
 * Renderiza un análisis de IA dentro de un modal
 * @param {Object} analysisData - Objeto con análisis y comentarios destacados
 */
function renderAnalysisModal(analysisData) {
    isDisabled = false;
    UiModule.closeModalUI();
    const bodyContent = document.createElement('div');
    bodyContent.className = 'ai-analysis-modal';
    bodyContent.setAttribute('data-threads-entity', entityId);

    const title = document.createElement('h2');
    title.textContent = analysisData.analysis.title;
    bodyContent.appendChild(title);


    const subtitle = document.createElement('p');
    subtitle.className = 'ai-analysis-subtitle';
    subtitle.textContent = analysisData.analysis.debateSummary;
    bodyContent.appendChild(subtitle);


    const sentimentContainer = document.createElement('div');
    sentimentContainer.className = 'ai-analysis-sentiment';
    sentimentContainer.innerHTML = `
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
    `;
    bodyContent.appendChild(sentimentContainer);

    // Comentarios destacados
    analysisData.analysis.highlightedComments.forEach(hComment => {
        const container = document.createElement('div');
        container.className = 'quelora-to-work';
        const commentElement = CommentsModule.createCommentElement(hComment.comment, entityId);
        commentElement.querySelector('.comment-actions')?.remove();
        container.appendChild(commentElement);
        bodyContent.appendChild(container);
    });

    const buttons = [
        { className: 'quelora-btn close-button t', textContent: '{{close}}', onClick: () => UiModule.closeModalUI(), icon: 'close' }
    ];
    UiModule.setupModalUI(bodyContent, buttons, '.quelora-comments');
}

// ==================== EXPORT ====================
const AIModule = {
    initializeAI,
    addAIButton,
    renderAnalysisModal
}

export default AIModule;
