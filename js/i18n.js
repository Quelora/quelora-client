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

import StorageModule from './storage.js';

const I18N_UPDATE_CHUNK_SIZE = 50;

// ==================== PRIVATE VARIABLES ====================
let _currentLang = '';
let _basePath = '';
let _translations = {};
let _elementsMap = new Map();
let _observer = null;
let _isChangingLanguage = false;

// ==================== HELPERS ====================
const handleError = (error, context) => {
    console.error(`I18n: Error in ${context}:`, error);
    return null;
};

const _replaceKeys = (text) => {
    if (typeof text !== 'string') {
        console.warn('I18n: Invalid text provided to _replaceKeys:', text);
        return '';
    }
    return text.replace(/{{(\w+)}}/g, (_, key) => getTranslation(key));
};

// ==================== CORE FUNCTIONS ====================
const initializeI18N = (lang, basePath) => {
    try {
        _currentLang = lang || 'en';
        _basePath = basePath || '';
        _setSpeechVariant(_currentLang);
        _initMutationObserver();
        loadTranslations(_currentLang);
    } catch (error) {
        handleError(error, 'I18n.init');
    }
};

const clearCache = () => {
    try {
        _translations = {};
        StorageModule.removeLocalItem(`quelora_i18n_${_currentLang}`);
        // Limpiar elementos desconectados de _elementsMap
        console.log('I18n: Clearing _elementsMap');
        for (const [element] of _elementsMap) {
            if (!element || !element.isConnected) {
                _elementsMap.delete(element);
            }
        }
        console.log(`I18n: _elementsMap size after cleanup: ${_elementsMap.size}`);
    } catch (error) {
        handleError(error, 'I18n.clearCache');
    }
};

const loadTranslations = async (lang) => {
    const storageKey = `quelora_i18n_${lang}`;
    try {
        console.log(`I18n: Loading translations for ${lang}`);
        const response = await fetch(`${_basePath}${lang}.json`);
        if (!response.ok) {
            console.warn(`I18n: Falling back to default language 'en'`);
            await loadTranslations('en');
            return;
        }
        _translations = await response.json();
        StorageModule.setLocalItem(storageKey, JSON.stringify(_translations));
        _updateDOM();
    } catch (error) {
        handleError(error, `I18n.loadTranslations "${lang}"`);
        _translations = {};
    }
};

const changeLanguage = async (lang) => {
    try {
        if (!lang || lang === _currentLang || _isChangingLanguage) {
            console.log(`I18n: No language change needed or in progress: ${lang}`);
            return;
        }
        _isChangingLanguage = true;
        console.log(`I18n: Changing language to: ${lang}`);
        if (_observer) {
            _observer.disconnect();
        }
        clearCache();
        _currentLang = lang;
        _setSpeechVariant(lang);
        await loadTranslations(lang);
        console.log(`I18n: Language changed successfully to: ${lang}`);
        // Retrasar la reconexión del observer para estabilizar el DOM
        setTimeout(() => {
            _initMutationObserver();
        }, 100);
    } catch (error) {
        handleError(error, 'I18n.changeLanguage');
        setTimeout(() => {
            _initMutationObserver();
        }, 100);
    } finally {
        _isChangingLanguage = false;
    }
};

const getTranslation = (key) => _translations[key] || `{{${key}}}`;

const _setSpeechVariant = (lang) => {
    try {
        const variant = _defaultSpeechVariants[lang] || 'en-US';
        StorageModule.setLocalItem('quelora_i18n_transcription', variant);
    } catch (error) {
        handleError(error, 'I18n.setSpeechVariant');
    }
};

const getSpeechVariant = () => {
    try {
        return StorageModule.getLocalItem('quelora_i18n_transcription') || 'en-US';
    } catch (error) {
        handleError(error, 'I18n.getSpeechVariant');
        return 'en-US';
    }
};

// ==================== UI COMPONENTS ====================
const translateElement = (element, attribute = null, className = 't') => {
    try {
        if (!element || element.nodeType !== Node.ELEMENT_NODE || !element.isConnected) {
            console.warn('I18n: Invalid or disconnected element provided');
            return;
        }

        let key = null;
        if (attribute) {
            key = element.getAttribute(attribute)?.replace(/^{{|}}$/g, '');
        } else {
            const content = element.innerHTML.trim();
            key = content.match(/^{{(.*?)}}$/)?.[1]?.trim() || null;
        }

        if (!_elementsMap.has(element)) {
            _elementsMap.set(element, {
                key,
                attribute,
                className,
                originalContent: attribute ? element.getAttribute(attribute) : element.innerHTML
            });
        }

        const translation = key ? getTranslation(key).replace(/{{|}}/g, '') : _replaceKeys(element.innerHTML).replace(/{{|}}/g, '');

        console.log(`I18n: Translating element with key "${key}" to "${translation}"`);
        attribute
            ? element.setAttribute(attribute, translation)
            : (element.innerHTML = translation);
    } catch (error) {
        handleError(error, 'I18n.translateElement');
    }
};

const translateByClass = (className, attribute = null) => {
    try {
        console.log(`I18n: Translating elements with class "${className}"`);
        document.querySelectorAll(`.${className}`).forEach(element => {
            translateElement(element, attribute, className);
        });
    } catch (error) {
        handleError(error, 'I18n.translateByClass');
    }
};

const _updateDOM = () => {
    try {
        console.log('I18n: Starting DOM update');
        if (_observer) {
            _observer.disconnect();
        }
        const entries = Array.from(_elementsMap.entries());
        console.log(`I18n: Processing ${entries.length} elements in _elementsMap`);
        let i = 0;

        const processChunk = () => {
            const end = Math.min(i + I18N_UPDATE_CHUNK_SIZE, entries.length);
            for (; i < end; i++) {
                const [element, { key, attribute }] = entries[i];
                if (!element || !element.isConnected) {
                    console.log(`I18n: Removing disconnected element from _elementsMap`);
                    _elementsMap.delete(element);
                    continue;
                }
                let translation = key 
                    ? (_translations[key] || `{{${key}}}`)
                    : _replaceKeys(element.textContent || element.innerHTML || '');

                translation = translation.replace(/{{|}}/g, '');

                try {
                    console.log(`I18n: Updating element with key "${key}" to "${translation}"`);
                    if (attribute) {
                        if (element.getAttribute(attribute) !== translation) {
                            element.setAttribute(attribute, translation);
                        }
                    } else {
                        if (element.textContent !== translation) {
                            element.textContent = translation;
                        }
                    }
                } catch (err) {
                    console.warn(`I18n: Failed to update element:`, err);
                    _elementsMap.delete(element);
                }
            }
            if (i < entries.length) {
                requestAnimationFrame(processChunk);
            } else {
                console.log('I18n: DOM update completed');
                setTimeout(() => {
                    _initMutationObserver();
                }, 100);
            }
        };

        requestAnimationFrame(processChunk);
    } catch (error) {
        handleError(error, 'I18n.updateDOM');
        setTimeout(() => {
            _initMutationObserver();
        }, 100);
    }
};

const _initMutationObserver = () => {
    try {
        if (_observer) {
            _observer.disconnect();
        }

        let pendingNodes = [];
        let scheduled = false;

        const processPending = () => {
            scheduled = false;

            pendingNodes.forEach(({ node, className, attribute }) => {
                if (node.nodeType !== Node.ELEMENT_NODE || !node.isConnected) {
                    return;
                }
                if (node.classList.contains(className)) {
                    translateElement(node, attribute, className);
                }
                node.querySelectorAll(`.${className}`).forEach(child => {
                    translateElement(child, attribute, className);
                });
            });

            pendingNodes = [];
        };

        _observer = new MutationObserver((mutations) => {
            if (_isChangingLanguage) return;
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.isConnected) {
                            _elementsMap.forEach(({ className, attribute }) => {
                                pendingNodes.push({ node, className, attribute });
                            });
                        }
                    });
                }
            });

            if (!scheduled && pendingNodes.length) {
                scheduled = true;
                requestAnimationFrame(processPending);
            }
        });

        _observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        console.log('I18n: MutationObserver initialized');
    } catch (error) {
        handleError(error, 'I18n.initMutationObserver');
    }
};

// ==================== PUBLIC API ====================
const I18n = {
    initializeI18N,
    changeLanguage,
    translateByClass,
    getTranslation,
    clearCache,
    getSpeechVariant
};

export default I18n;