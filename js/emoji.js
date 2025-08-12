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


// Private variable to hold the picker container element
let pickerContainer;

/**
 * Loads the Emoji Mart script dynamically from a CDN.
 * Returns a Promise that resolves when the script is loaded.
 */
function loadEmojiMartScript() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/emoji-mart@latest/dist/browser.js';
        script.async = true;

        script.onload = () => {
            if (typeof EmojiMart !== 'undefined') {
                resolve();
            } else {
                reject(new Error('EmojiMart did not load correctly.'));
            }
        };

        script.onerror = () => reject(new Error('Error loading Emoji Mart script.'));

        document.head.appendChild(script);
    }).catch(error => {
        hideEmojiButtons();
        console.error(error.message, 'emoji-mart');
        throw error;
    });
}

/**
 * Hides all emoji buttons in the UI.
 */
function hideEmojiButtons() {
    document.querySelectorAll('.emoji-button').forEach(button => button.style.display = 'none');
}

/**
 * Shows all emoji buttons in the UI.
 */
function showEmojiButtons() {
    document.querySelectorAll('.emoji-button').forEach(button => button.style.display = 'block');
}

/**
 * Creates and renders a new Emoji Mart picker inside the container.
 * Adjusts theme automatically based on the document's `data-theme` attribute.
 */
function createPicker() {
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

    const picker = new EmojiMart.Picker({
        locale: 'es',
        searchPosition: 'none',
        previewPosition: 'none',
        theme,
        onEmojiSelect: (emoji) => insertEmojiIntoTarget(emoji.native)
    });

    pickerContainer.innerHTML = '';
    pickerContainer.appendChild(picker);
}

/**
 * Inserts an emoji into the currently targeted input field.
 * @param {string} emojiChar - The emoji character to insert.
 */
function insertEmojiIntoTarget(emojiChar) {
    const inputId = pickerContainer.dataset.targetInputId;
    if (!inputId) return;

    const input = document.getElementById(inputId);
    if (!input) return;

    const cursorPosition = input.selectionStart;
    input.value = input.value.slice(0, cursorPosition) + emojiChar + input.value.slice(cursorPosition);
    const newCursorPosition = cursorPosition + emojiChar.length;
    input.setSelectionRange(newCursorPosition, newCursorPosition);
    input.focus();
}

/**
 * Adjusts picker position so it remains visible inside the viewport.
 */
function adjustPickerPosition(button) {
    const margin = 20;
    const buttonRect = button.getBoundingClientRect();
    const pickerRect = pickerContainer.getBoundingClientRect();

    let top = buttonRect.bottom + margin;
    let left = buttonRect.left + (buttonRect.width - pickerRect.width) / 2;

    // If picker goes below viewport, show it above the button
    if ((top + pickerRect.height) > window.innerHeight) {
        top = buttonRect.top - pickerRect.height - margin;
    }
    if (top < 0) top = margin;

    // Prevent overflow to the right
    if ((left + pickerRect.width) > window.innerWidth) {
        left = window.innerWidth - pickerRect.width - margin;
    }
    if (left < 0) left = margin;

    pickerContainer.style.top = `${top + window.scrollY}px`;
    pickerContainer.style.left = `${left + window.scrollX}px`;
}

/**
 * Initializes the emoji picker functionality.
 */
function setupEmojiPicker() {
    pickerContainer = document.getElementById('quelora-picker-container');

    if (typeof EmojiMart === 'undefined') {
        hideEmojiButtons();
        return;
    }

    showEmojiButtons();
    createPicker();

    // React to theme changes
    const observer = new MutationObserver(mutations => {
        if (mutations.some(m => m.attributeName === 'data-theme')) {
            createPicker();
        }
    });
    observer.observe(document.documentElement, { attributes: true });

    // Open picker on emoji button click
    document.addEventListener('click', (event) => {
        const button = event.target.closest('.emoji-button');
        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        const targetInputId = button.getAttribute('data-target-id');
        if (!targetInputId || !document.getElementById(targetInputId)) return;

        pickerContainer.dataset.targetInputId = targetInputId;
        pickerContainer.style.display = 'block';
        adjustPickerPosition(button);

        // Continuously adjust position while picker is open
        const intervalId = setInterval(() => {
            if (pickerContainer.style.display === 'none') {
                clearInterval(intervalId);
            } else {
                adjustPickerPosition(button);
            }
        }, 300);
    });

    // Close picker when clicking outside
    document.addEventListener('click', (event) => {
        if (!pickerContainer.contains(event.target) && !event.target.closest('.emoji-button')) {
            pickerContainer.style.display = 'none';
        }
    });

    // Close picker on ESC key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            pickerContainer.style.display = 'none';
        }
    });
}

// ==================== PUBLIC API ====================
const EmojiModule = {
    loadEmojiMartScript,
    setupEmojiPicker
};

export default EmojiModule;