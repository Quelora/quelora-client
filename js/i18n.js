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

// ==================== PRIVATE VARIABLES ====================
let _currentLang = '';
let _basePath = '';
let _translations = {};
let _elementsMap = new Map();
let _observer = null;

const _defaultSpeechVariants = {
    'en': 'en-US',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'pt': 'pt-PT',
    'it': 'it-IT',
    'ja': 'ja-JP',
    'ru': 'ru-RU',
    'zh': 'zh-CN',
    'ar': 'ar-SA'
};

// ==================== HELPERS ====================
const handleError = (error, context) => {
    console.error(`I18n: Error in ${context}:`, error);
    return null;
};

const _replaceKeys = (text) => {
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
    } catch (error) {
        handleError(error, 'I18n.clearCache');
    }
};

const loadTranslations = async (lang) => {
    const storageKey = `quelora_i18n_${lang}`;
    try {
        const response = await fetch(`${_basePath}${lang}.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
        if (lang === _currentLang) return;
        clearCache();
        _currentLang = lang;
        _setSpeechVariant(lang);
        await loadTranslations(lang);
    } catch (error) {
        handleError(error, 'I18n.changeLanguage');
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
        if (!element?.nodeType) {
            console.error('I18n: Invalid element provided');
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

        attribute
            ? element.setAttribute(attribute, translation)
            : (element.innerHTML = translation);
    } catch (error) {
        handleError(error, 'I18n.translateElement');
    }
};

const translateByClass = (className, attribute = null) => {
    try {
        document.querySelectorAll(`.${className}`).forEach(element => {
            translateElement(element, attribute, className);
        });
    } catch (error) {
        handleError(error, 'I18n.translateByClass');
    }
};

const _updateDOM = () => {
    try {
        _elementsMap.forEach(({ key, attribute, className }, element) => {
            if (element.isConnected) {
                let translation = key ? (_translations[key] || `{{${key}}}`) : _replaceKeys(element.innerHTML);
                translation = translation.replace(/{{|}}/g, '');

                if (attribute) {
                    element.setAttribute(attribute, translation);
                } else {
                    element.innerHTML = translation;
                }
            } else {
                _elementsMap.delete(element);
            }
        });
    } catch (error) {
        handleError(error, 'I18n.updateDOM');
    }
};

// ==================== EVENT HANDLERS ====================
const _initMutationObserver = () => {
    try {
        _observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            _elementsMap.forEach(({ className, attribute }) => {
                                if (node.classList.contains(className)) {
                                    translateElement(node, attribute, className);
                                }
                                node.querySelectorAll(`.${className}`).forEach(child => {
                                    translateElement(child, attribute, className);
                                });
                            });
                        }
                    });
                }
            });
        });

        _observer.observe(document.body, {
            childList: true,
            subtree: true
        });
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