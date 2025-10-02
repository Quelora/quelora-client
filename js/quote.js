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

import Drawer from './drawer.js';

export class QuoteSelector {
    static initialized = false;
    static styleElement = null;
    static startHandle = null;
    static endHandle = null;
    static popup = null;
    static quoteButton = null;
    static closeButton = null;
    static activeRange = null;
    static isDraggingHandle = false;
    static quoteCallback = null;
    static scrollContainer = null;
    static activeElement = null; // el .comment-text activo
    static observer = null;

    constructor(quoteCallback) {
        if (!QuoteSelector.initialized) {
            QuoteSelector.initUI();
        }
        QuoteSelector.quoteCallback = quoteCallback;
    }

    // --- INIT SOLO UNA VEZ ---
    static initUI() {
        QuoteSelector.initialized = true;

        const MAX_Z_INDEX = '2147483647';
        const css = `
            .comment-text, .comment-text * {
                user-select: text !important;
                -webkit-user-select: text !important;
                touch-action: manipulation;
            }
            .quote-handle {
                position: absolute;
                width: 14px;
                height: 22px;
                background-color: var(--quelora-primary-color, #1fa8f5);
                border-radius: 4px;
                cursor: col-resize;
                z-index: ${MAX_Z_INDEX};
                user-select: none;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2), inset 0 1px 1px var(--quelora-follow-button-shadow);
                transform: scaleY(1.1);
            }
            .quote-handle::after {
                content: '';
                position: absolute;
                top: -3px;
                left: 3px;
                width: 8px;
                height: 4px;
                background-color: var(--quelora-primary-color, #1fa8f5);
                border-radius: 2px;
            }
            .quote-popup {
                position: absolute;
                background-color: var(--quelora-secondary-color, #404040);
                color: var(--quelora-primary-text-color, #fefefe);
                border-radius: var(--quelora-follow-button-radius, 18px);
                padding: var(--spacing-xs, 4px);
                display: flex;
                gap: var(--spacing-xs, 4px);
                z-index: ${MAX_Z_INDEX};
                user-select: none;
                box-shadow: var(--quelora-shadow, 0 2px 8px rgba(0,0,0,0.3));
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            }
            .quote-popup button {
                border: none;
                padding: 6px 12px;
                border-radius: var(--quelora-follow-button-radius, 18px);
                cursor: pointer;
                font-size: var(--font-size-md, 14px);
                transition: background-color 0.2s, color 0.2s;
            }
            .quote-popup button.quote-button {
                background-color: var(--quelora-success-color, #3897f0);
                color: var(--quelora-background-color, #313131);
                font-weight: bold;
            }
            .quote-popup button.quote-button:hover { opacity: 0.9; }
            .quote-popup button.close-button {
                background-color: var(--quelora-background-color, #313131);
                color: var(--quelora-text-color, #dbdbdb);
                font-size: 12px;
            }
            .quote-popup button.close-button:hover {
                background-color: var(--quelora-light-background-color, #202020);
            }
        `;
        QuoteSelector.styleElement = document.createElement("style");
        QuoteSelector.styleElement.textContent = css;
        document.head.appendChild(QuoteSelector.styleElement);

        // UI Elements
        QuoteSelector.startHandle = document.createElement("div");
        QuoteSelector.startHandle.className = "quote-handle";
        QuoteSelector.startHandle.style.display = "none";

        QuoteSelector.endHandle = document.createElement("div");
        QuoteSelector.endHandle.className = "quote-handle";
        QuoteSelector.endHandle.style.display = "none";

        QuoteSelector.popup = document.createElement("div");
        QuoteSelector.popup.className = "quote-popup";
        QuoteSelector.popup.style.display = "none";

        QuoteSelector.quoteButton = document.createElement("button");
        QuoteSelector.quoteButton.textContent = "Quote";
        QuoteSelector.quoteButton.className = "quote-button";

        QuoteSelector.closeButton = document.createElement("button");
        QuoteSelector.closeButton.innerHTML = "&#10005;";
        QuoteSelector.closeButton.className = "close-button";

        QuoteSelector.popup.appendChild(QuoteSelector.quoteButton);
        QuoteSelector.popup.appendChild(QuoteSelector.closeButton);
        document.body.appendChild(QuoteSelector.startHandle);
        document.body.appendChild(QuoteSelector.endHandle);
        document.body.appendChild(QuoteSelector.popup);

        QuoteSelector.scrollContainer = document.querySelector("#quelora-comments .drawer-content");

        // Eventos
        if (QuoteSelector.scrollContainer) {
            QuoteSelector.scrollContainer.addEventListener("scroll", QuoteSelector.hideUI);
        }
        QuoteSelector.startHandle.addEventListener("mousedown", e => QuoteSelector.handleDrag(e, QuoteSelector.startHandle));
        QuoteSelector.startHandle.addEventListener("touchstart", e => QuoteSelector.handleDrag(e, QuoteSelector.startHandle));
        QuoteSelector.endHandle.addEventListener("mousedown", e => QuoteSelector.handleDrag(e, QuoteSelector.endHandle));
        QuoteSelector.endHandle.addEventListener("touchstart", e => QuoteSelector.handleDrag(e, QuoteSelector.endHandle));

        QuoteSelector.quoteButton.addEventListener("click", () => {
            if (QuoteSelector.activeRange) {
                const selectedText = QuoteSelector.activeRange.toString();
                let author = undefined;

                if (QuoteSelector.activeElement) {
                    const commentContainer = QuoteSelector.activeElement.closest(".community-threads > *");
                    if (commentContainer) {
                        const authorEl = commentContainer.querySelector(".comment-header .comment-author");
                        if (authorEl) {
                            author = authorEl.textContent.trim();
                        }
                    }
                }

                if (QuoteSelector.quoteCallback) {
                    QuoteSelector.quoteCallback(selectedText, author);
                }
                QuoteSelector.hideAndDeselect();
            }
        });
        QuoteSelector.closeButton.addEventListener("click", QuoteSelector.hideAndDeselect);

        if (typeof Drawer !== "undefined" && Drawer.onGlobal) {
            Drawer.onGlobal('drawerClosed', () => {
                QuoteSelector.hideAndDeselect();
            });
        }
    }

    // --- Activación manual ---
    activateWithElement(element) {
        if (!element || !element.classList.contains("comment-text")) {
            console.error("Invalid element");
            return;
        }

        QuoteSelector.activeElement = element;

        // Seleccionar todo el contenido del párrafo
        const range = document.createRange();
        range.selectNodeContents(element);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        QuoteSelector.activeRange = range;
        QuoteSelector.updateUIPosition();

        // Observar si el element desaparece o se oculta
        if (QuoteSelector.observer) QuoteSelector.observer.disconnect();
        QuoteSelector.observer = new MutationObserver(() => {
            if (!document.body.contains(element) || element.offsetParent === null) {
                QuoteSelector.hideAndDeselect();
            }
        });
        QuoteSelector.observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
    }

    // --- Posicionar UI ---
    static updateUIPosition() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            QuoteSelector.hideUI();
            return;
        }
        const range = selection.getRangeAt(0);

        // Limitar la selección al elemento activo
        if (QuoteSelector.activeElement && !QuoteSelector.activeElement.contains(range.startContainer) || !QuoteSelector.activeElement.contains(range.endContainer)) {
            QuoteSelector.hideAndDeselect();
            return;
        }

        QuoteSelector.activeRange = range.cloneRange();
        const rects = range.getClientRects();
        if (!rects.length) return;

        const startRect = rects[0];
        const endRect = rects[rects.length - 1];
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        // Posicionar handles
        QuoteSelector.startHandle.style.left = `${startRect.left + scrollX - QuoteSelector.startHandle.offsetWidth}px`;
        QuoteSelector.startHandle.style.top = `${startRect.top + scrollY}px`;
        QuoteSelector.endHandle.style.left = `${endRect.right + scrollX}px`;
        QuoteSelector.endHandle.style.top = `${endRect.bottom + scrollY - QuoteSelector.endHandle.offsetHeight}px`;

        // Popup siempre arriba
        const popupLeft = startRect.left + scrollX + (endRect.right - startRect.left) / 2 - QuoteSelector.popup.offsetWidth / 2;
        const popupTop = startRect.top + scrollY - QuoteSelector.popup.offsetHeight - 12;

        QuoteSelector.popup.style.left = `${popupLeft}px`;
        QuoteSelector.popup.style.top = `${popupTop}px`;

        QuoteSelector.startHandle.style.display = "block";
        QuoteSelector.endHandle.style.display = "block";
        QuoteSelector.popup.style.display = "flex";
    }

    // --- Ocultar ---
    static hideUI() {
        QuoteSelector.startHandle.style.display = "none";
        QuoteSelector.endHandle.style.display = "none";
        QuoteSelector.popup.style.display = "none";
        QuoteSelector.activeRange = null;
        QuoteSelector.activeElement = null;
    }

    static hideAndDeselect() {
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
        QuoteSelector.hideUI();
        if (QuoteSelector.observer) {
            QuoteSelector.observer.disconnect();
            QuoteSelector.observer = null;
        }
    }

    destroy() {
        QuoteSelector.hideAndDeselect();
        QuoteSelector.quoteCallback = null;
    }

    // --- Dragging handles ---
    static handleDrag(e, handle) {
        e.preventDefault();
        e.stopPropagation();
        QuoteSelector.isDraggingHandle = true;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || !QuoteSelector.activeRange) return;

        const onMove = (ev) => {
            const x = ev.clientX || ev.touches?.[0]?.clientX;
            const y = ev.clientY || ev.touches?.[0]?.clientY;
            const pos = document.caretPositionFromPoint?.(x, y);
            if (!pos) return;

            // Limitar al element activo
            if (!QuoteSelector.activeElement || !QuoteSelector.activeElement.contains(pos.offsetNode)) return;

            try {
                if (handle === QuoteSelector.startHandle) {
                    QuoteSelector.activeRange.setStart(pos.offsetNode, pos.offset);
                } else {
                    QuoteSelector.activeRange.setEnd(pos.offsetNode, pos.offset);
                }
                selection.removeAllRanges();
                selection.addRange(QuoteSelector.activeRange);
                QuoteSelector.updateUIPosition();
            } catch {}
        };
        const onUp = () => {
            QuoteSelector.isDraggingHandle = false;
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.removeEventListener("touchmove", onMove);
            document.removeEventListener("touchend", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        document.addEventListener("touchmove", onMove);
        document.addEventListener("touchend", onUp);
    }
}
