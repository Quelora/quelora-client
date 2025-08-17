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

import PostsModule from './posts.js';
import EntityModule from './entity.js';

// Cache for storing post statistics
const postStatsCache = new Map();

/**
 * Formats a date string into a localized short date (e.g., "Jan 1, 2023").
 * @param {string} dateString - Date in string format.
 * @returns {string} Formatted date or empty string if invalid.
 */
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Intl.DateTimeFormat(navigator.language || 'es-ES', options).format(date);
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
}

/**
 * Calculates time elapsed since a timestamp, returning a human-readable string (e.g., "5 minutes ago").
 * @param {string} timestamp - Timestamp to compare.
 * @returns {string} Human-readable time difference or '{{justNow}}' if invalid.
 */
function getTimeAgo(timestamp) {
    try {
        const now = new Date();
        const commentDate = new Date(timestamp);
        
        if (isNaN(commentDate.getTime())) {
            return '{{justNow}}';
        }

        const diff = now - commentDate;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '{{justNow}}';
        if (minutes < 60) return `${minutes} {{minutesAgo}}`;
        if (hours < 24) return `${hours} {{hoursAgo}}`;
        return `${days} ${days === 1 ? '{{dayAgo}}' : '{{daysAgo}}'}`;
    } catch (error) {
        console.error('Error calculating time ago:', error);
        return '{{justNow}}';
    }
}

/**
 * Starts a timeout with error handling.
 * @param {Function} callback - Function to execute after delay.
 * @param {number} time - Delay in milliseconds.
 * @returns {number|null} Timeout ID or null if error occurs.
 */
function startTimeout(callback, time) {
    try {
        return setTimeout(() => {
            try {
                callback();
            } catch (error) {
                console.error('Error in timeout callback:', error);
            }
        }, time);
    } catch (error) {
        console.error('Error starting timeout:', error);
        return null;
    }
}

/**
 * Cancels a timeout.
 * @param {number} timeoutId - ID of the timeout to cancel.
 */
function cancelTimeout(timeoutId) {
    try {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    } catch (error) {
        console.error('Error canceling timeout:', error);
    }
}

/**
 * Debounces a function, delaying its execution until after a specified wait period.
 * @param {Function} func - Function to debounce.
 * @param {number} delay - Delay in milliseconds.
 * @param {boolean} [immediate=false] - Whether to execute immediately on first call.
 * @returns {Function} Debounced function.
 */
function debounce(func, delay, immediate = false) {
    let timeoutId;
    
    return function(...args) {
        const context = this;
        const later = function() {
            timeoutId = null;
            if (!immediate) func.apply(context, args);
        };
        
        const callNow = immediate && !timeoutId;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(later, delay);
        
        if (callNow) func.apply(context, args);
    };
}

/**
 * Debounced version of PostsModule.fetchStats, delayed by 250ms.
 */
const debouncedFetchStats = debounce(() => {
     PostsModule.fetchStats();
}, 250);

/**
 * Observes DOM for new entities matching the config selector and triggers stats fetching.
 * @returns {MutationObserver|null} Observer instance or null if error occurs.
 */
function observeNewEntities() {
    try {
        const observer = new MutationObserver(async (mutations) => {
            let shouldFetchStats = false;
            const config = await EntityModule.getConfig();

            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches(config.selector) || node.querySelector(config.selector)) {
                                shouldFetchStats = true;
                                break;
                            }
                        }
                    }
                    if (shouldFetchStats) break;
                }
            }
            if (shouldFetchStats) {
                debouncedFetchStats();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return observer;
    } catch (error) {
        console.error('Error in observeNewEntities:', error);
        return null;
    }
}

/**
 * Stores stats configuration in the cache.
 * @param {Object} stat - Stats object with entity and config properties.
 */
function setStatsCache(stat) {
    try {
        if (stat && stat.entity) {
            postStatsCache.set(stat.entity, stat.config);
        }
    } catch (error) {
        console.error('Error setting stats cache:', error);
    }
}

/**
 * Retrieves configuration from cache for a given entity ID.
 * @param {string} entityId - ID of the entity.
 * @returns {Object|null} Cached configuration or null if not found/error.
 */
function getConfig(entityId) {
    try {
        return postStatsCache.get(entityId) || null;
    } catch (error) {
        console.error('Error getting config:', error);
        return null;
    }
}

/**
 * Sets character limit for the QUELORA input element.
 * @param {number} [limits=200] - Maximum number of characters.
 */
function setInputLimit(limits = 200) {
    try {
        const inputElement = document.getElementById('quelora-input');
        if (inputElement) {
            inputElement.setAttribute('maxlength', limits);
        }
    } catch (error) {
        console.error('Error setting input limit:', error);
    }
}

/**
 * Formats a number into an abbreviated string (e.g., 1000 -> "1K", 1000000 -> "1M").
 * @param {number} number - Number to format.
 * @returns {string} Abbreviated number string.
 */
function formatNumberAbbreviated(number) {
    if (number >= 1000000) {
        return (number / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    } else if (number >= 1000) {
        return (number / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    } else {
        return number.toString();
    }
}

/**
 * Creates a promise that resolves after a specified delay.
 * @param {number} ms - Delay in milliseconds.
 * @returns {Promise} Promise that resolves after the delay.
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Detects the base path of the QUELORA script.
 * @returns {string} Base path of the script or empty string if not found.
 */
function getCurrentScriptPath() {
    try {
        const scripts = document.getElementsByTagName('script');
        for (let script of scripts) {
            const match = script.src.match(/(quelora(\.min)?\.js)$/);
            if (match) {
                return script.src.substring(0, script.src.lastIndexOf('/') + 1);
            }
        }
        return '';
    } catch (error) {
        console.error('Error detecting script path:', error);
        return '';
    }
}

/**
 * Checks if the user agent indicates a mobile device.
 * @type {boolean}
 */
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);


/**
 * makeEditableDivInput
 * --------------------
 * Transforms a standard <div> into a pseudo-input element with enhanced behavior.
 * 
 * Features:
 *  - Forces plain text on paste (no formatting).
 *  - Allows only letters, numbers, spaces, and emojis.
 *  - Provides value, selectionStart, selectionEnd properties like an <input>.
 *  - Supports setRangeText for inserting text at the current cursor (useful for mentions or emojis).
 *  - Prevents input beyond maxLength if set on the div.
 * 
 * @param {string|HTMLElement} editable - The ID of the div or the div element itself to make editable.
 */
const makeEditableDivInput = (editable) => {
    if (typeof editable === 'string') {
        editable = document.getElementById(editable);
    }
    if (!editable) return;

    if (!editable.style.whiteSpace) {
        editable.style.whiteSpace = 'pre-wrap';
    }

    // === Helpers ===
    const getMaxLength = () => {
        const max = parseInt(editable.getAttribute('maxlength'));
        return isNaN(max) ? -1 : max;
    };

    const getSelectionOffsets = () => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) {
            const len = editable.textContent.length;
            return { start: len, end: len };
        }
        const range = sel.getRangeAt(0);
        return { start: range.startOffset, end: range.endOffset };
    };

    const setCaret = (pos) => {
        const len = editable.textContent.length;
        const p = Math.max(0, Math.min(len, pos));
        const range = document.createRange();
        const sel = window.getSelection();
        if (!editable.firstChild || editable.firstChild.nodeType !== Node.TEXT_NODE) {
            editable.textContent = editable.textContent; // colapsa a un solo text node
        }
        const node = editable.firstChild || editable;
        range.setStart(node, p);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    };

    const setSelectionRangeImpl = (start, end) => {
        const len = editable.textContent.length;
        const s = Math.max(0, Math.min(len, start));
        const e = Math.max(0, Math.min(len, end));
        const range = document.createRange();
        const sel = window.getSelection();
        if (!editable.firstChild || editable.firstChild.nodeType !== Node.TEXT_NODE) {
            editable.textContent = editable.textContent;
        }
        const node = editable.firstChild || editable;
        range.setStart(node, s);
        range.setEnd(node, e);
        sel.removeAllRanges();
        sel.addRange(range);
    };

    const clampToMaxLength = (text) => {
        const maxLength = getMaxLength();
        if (maxLength >= 0 && text.length > maxLength) {
            return text.substring(0, maxLength);
        }
        return text;
    };

    const sanitizeToPlainText = (rawHTMLish) => {
        const div = document.createElement('div');
        div.innerHTML = rawHTMLish;
        let plain = div.textContent || '';
        plain = clampToMaxLength(plain);
        return plain;
    };

    const replaceWithPlainTextPreservingCaret = () => {
        const { start } = getSelectionOffsets();
        const plain = sanitizeToPlainText(editable.innerHTML);
        const delta = plain.length - editable.textContent.length;
        editable.textContent = plain;
        setCaret(start + Math.max(0, delta));
    };

    // === Events ===

    editable.addEventListener('beforeinput', (e) => {
        const maxLength = getMaxLength();
        if (maxLength < 0) return;

        if (e.inputType && e.inputType.startsWith('delete')) return;

        const sel = window.getSelection();
        let selectionLength = 0;
        if (sel && sel.rangeCount) {
            const r = sel.getRangeAt(0);
            selectionLength = Math.abs(r.endOffset - r.startOffset);
        }

        const incoming = (typeof e.data === 'string') ? e.data : '';
        const currentLen = editable.textContent.length;
        const projected = currentLen - selectionLength + incoming.length;

        if (projected > maxLength) {
            e.preventDefault();
            const remaining = maxLength - (currentLen - selectionLength);
            if (remaining > 0 && incoming) {
                document.execCommand('insertText', false, incoming.substring(0, remaining));
            }
        }
    });

    editable.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
        const maxLength = getMaxLength();

        const sel = window.getSelection();
        let selectionLength = 0;
        if (sel && sel.rangeCount) {
            const r = sel.getRangeAt(0);
            selectionLength = Math.abs(r.endOffset - r.startOffset);
        }
        const currentLen = editable.textContent.length;
        const remaining = maxLength >= 0 ? maxLength - (currentLen - selectionLength) : text.length;

        const allowed = maxLength >= 0 ? text.substring(0, Math.max(0, remaining)) : text;
        if (allowed) document.execCommand('insertText', false, allowed);
    });

    editable.addEventListener('drop', (e) => {
        e.preventDefault();
        const data = e.dataTransfer;
        const text = data ? (data.getData('text/plain') || '') : '';
        const maxLength = getMaxLength();

        const sel = window.getSelection();
        let selectionLength = 0;
        if (sel && sel.rangeCount) {
            const r = sel.getRangeAt(0);
            selectionLength = Math.abs(r.endOffset - r.startOffset);
        }
        const currentLen = editable.textContent.length;
        const remaining = maxLength >= 0 ? maxLength - (currentLen - selectionLength) : text.length;

        const allowed = maxLength >= 0 ? text.substring(0, Math.max(0, remaining)) : text;
        if (allowed) document.execCommand('insertText', false, allowed);
    });

    editable.addEventListener('input', () => {
        const html = editable.innerHTML;
        if (html.indexOf('<') === -1 && html.indexOf('>') === -1) {
            const txt = editable.textContent;
            const clamped = clampToMaxLength(txt);
            if (clamped !== txt) {
                const pos = getSelectionOffsets().start;
                editable.textContent = clamped;
                setCaret(Math.min(pos, clamped.length));
            }
            return;
        }
        replaceWithPlainTextPreservingCaret();
    });

    // === API  and inputs ===

    Object.defineProperty(editable, 'value', {
        get() {
            return this.textContent;
        },
        set(v) {
            const s = String(v ?? '');
            const clamped = clampToMaxLength(s);
            this.textContent = clamped;
            setCaret(clamped.length);
        }
    });

    Object.defineProperty(editable, 'selectionStart', {
        get() {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return this.textContent.length;
            return sel.getRangeAt(0).startOffset;
        },
        set(pos) {
            setCaret(pos);
        }
    });

    Object.defineProperty(editable, 'selectionEnd', {
        get() {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return this.textContent.length;
            return sel.getRangeAt(0).endOffset;
        },
        set(pos) {
            const len = this.textContent.length;
            setSelectionRangeImpl(Math.min(this.selectionStart, pos), Math.max(this.selectionStart, pos));
        }
    });

    editable.setSelectionRange = function(start, end, direction = 'forward') {
        setSelectionRangeImpl(start, end);
        if (direction === 'backward') {
            const sel = window.getSelection();
            const node = this.firstChild || this;
            if (sel && sel.extend) {
                sel.collapse(node, end);
                sel.extend(node, start);
            }
        }
    };

    editable.setRangeText = function(replacement) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);

        const currentLen = editable.textContent.length - (range.endOffset - range.startOffset);
        const maxLength = getMaxLength();
        const allowedMax = maxLength > 0 ? maxLength : (currentLen + String(replacement).length);
        const remaining = allowedMax - currentLen;

        const allowedText = String(replacement).substring(0, Math.max(0, remaining));
        range.deleteContents();
        range.insertNode(document.createTextNode(allowedText));
        const newPos = (range.startOffset || 0) + allowedText.length;
        editable.textContent = editable.textContent; 
        setCaret(newPos);
    };

    const observer = new MutationObserver(() => {
        const maxLength = getMaxLength();
        const txt = editable.textContent;
        if (maxLength > 0 && txt.length > maxLength) {
            const pos = getSelectionOffsets().start;
            const clamped = txt.substring(0, maxLength);
            editable.textContent = clamped;
            setCaret(Math.min(pos, clamped.length));
        }
    });

    observer.observe(editable, {
        attributes: true,
        attributeFilter: ['maxlength']
    });
};


/**
 * Utility module for QUELORA platform.
 * @type {Object}
 */
const UtilsModule = {
    getTimeAgo,
    startTimeout,
    cancelTimeout,
    observeNewEntities,
    getConfig,
    setStatsCache,
    setInputLimit,
    formatDate,
    formatNumberAbbreviated,
    wait,
    getCurrentScriptPath,
    debounce,
    isMobile,
    makeEditableDivInput
};

export default UtilsModule;