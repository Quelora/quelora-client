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

import ProfileModule from "./profile.js";
import UtilsModule from "./utils.js"; 
import UiModule from "./ui.js";

/**
 * Manages mention functionality for input elements, enabling @username suggestions and replacements.
 */
class MentionModule {
    /**
     * Creates a MentionModule instance.
     * @param {HTMLInputElement|HTMLTextAreaElement} inputElement - The input element to monitor for mentions.
     * @param {Function} searchMentionsFn - Function to handle mention search logic.
     * @param {Object} [config={}] - Configuration options.
     * @param {number} [config.debounceTime=600] - Debounce time for mention search in milliseconds.
     */
    constructor(inputElement, searchMentionsFn, config = {}) {
        this.inputElement = inputElement;
        this.searchMentionsFn = searchMentionsFn;
        this.debounceTime = config.debounceTime || 600;
        this.debouncedHandleMention = null;
        this.initializeMention();
    }

    /**
     * Initializes mention functionality by setting up debounced search and input listener.
     */
    initializeMention() {
        this.debouncedHandleMention = UtilsModule.debounce(
            this.handleMentionSearch.bind(this),
            this.debounceTime
        );
        this.inputElement.addEventListener('input', this.handleInput.bind(this));
        MentionModule.ensureGlobalClickListener();
    }

    /**
     * Handles input events to detect and process @mentions.
     * @param {Event} event - The input event.
     */
    handleInput(event) {
        const value = event.target.value;
        const cursorPosition = event.target.selectionStart;
        const textBeforeCursor = value.slice(0, cursorPosition);
        const mentionMatch = textBeforeCursor.match(/@(\w+)$/);

        if (mentionMatch && !/\s/.test(mentionMatch[1])) {
            this.debouncedHandleMention(mentionMatch[1]);
        }
    }

    /**
     * Triggers the mention search function with the provided username.
     * @param {string} username - The username to search for.
     */
    handleMentionSearch(username) {
        this.searchMentionsFn(this.inputElement, username);
    }

    /**
     * Replaces a detected mention with a selected username in the input element.
     * @param {string} selectedMention - The username to insert.
     */
    replaceMention(selectedMention) {
        const value = this.inputElement.value;
        const cursorPosition = this.inputElement.selectionEnd;
        const textBeforeCursor = value.slice(0, cursorPosition);
        const mentionMatch = textBeforeCursor.match(/@(\w+)$/);

        if (mentionMatch) {
            const startIndex = textBeforeCursor.lastIndexOf(mentionMatch[0]);
            const newValue = value.slice(0, startIndex) + `@${selectedMention} ` + value.slice(cursorPosition);
            this.inputElement.value = newValue;
            this.inputElement.selectionStart = this.inputElement.selectionEnd = startIndex + selectedMention.length + 2;
            this.inputElement.focus();
        }
    }

    /**
     * Stores callback functions for mention clicks.
     * @private
     */
    static _callbackRegistry = {};

    /**
     * Tracks whether the global click listener is initialized.
     * @private
     */
    static _listenerInitialized = false;

    /**
     * Registers a callback function for a specific key.
     * @param {string} key - The callback identifier.
     * @param {Function} fn - The callback function.
     */
    static registerCallback(key, fn) {
        this._callbackRegistry[key] = fn;
    }

    /**
     * Retrieves a callback function by its key.
     * @param {string} key - The callback identifier.
     * @returns {Function|undefined} The callback function, if found.
     */
    static getCallback(key) {
        return this._callbackRegistry[key];
    }

    /**
     * Sets up a global click listener for mention links, if not already initialized.
     */
    static ensureGlobalClickListener() {
        if (this._listenerInitialized) return;
        document.addEventListener('click', (event) => {
            const target = event.target.closest('[data-callback]');
            if (target) {
                const key = target.getAttribute('data-callback');
                const callback = MentionModule.getCallback(key);
                if (typeof callback === 'function') {
                    callback();
                    event.preventDefault();
                }
            }
        });
        this._listenerInitialized = true;
    }

    /**
     * Processes text to convert @mentions into clickable links.
     * @param {string} text - The text containing mentions.
     * @param {Function} [callback=ProfileModule.getMention] - Function to handle mention click actions.
     * @returns {DocumentFragment} A document fragment with processed mention links.
     */
    static processTextWithMentions(text, callback = ProfileModule.getMention) {
        this.ensureGlobalClickListener();
        const mentionRegex = /@(\w+)/g;
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        text.replace(mentionRegex, (match, username, index) => {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex, index)));

            const anchor = UiModule.createElementUI({
                tag: 'a',
                attributes: {
                    href: 'javascript:void(0)',
                    'data-callback': `mention:${username}`
                },
                content: `@${username}`
            });

            const callbackKey = `mention:${username}`;
            this.registerCallback(callbackKey, () => callback(username));

            fragment.appendChild(anchor);
            lastIndex = index + match.length;
            return match;
        });

        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        return fragment;
    }
}

export default MentionModule;