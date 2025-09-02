import StorageModule from './storage.js';
import UtilsModule from './utils.js';

/**
 * The chunk size for updating the DOM. This prevents the UI from freezing
 * during large translation updates by processing elements in batches.
 * @type {number}
 */
const I18N_UPDATE_CHUNK_SIZE = 50;

/**
 * The internal state and variables for the I18n module.
 * Using a single object for state management improves organization.
 */
const state = {
  currentLang: '',
  basePath: '',
  translations: {},
  elementsMap: new Map(),
  observer: null,
  isChangingLanguage: false,
  pendingLanguageChange: null,
  abortController: null,
  speechVariants: {
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
  }
};

/**
 * Handles and logs errors consistently to the console.
 * @param {Error} error - The error object to be logged.
 * @param {string} context - A descriptive string of where the error occurred.
 * @returns {null}
 */
const handleError = (error, context) => {
  console.error(`I18n: Error in ${context}:`, error);
  return null;
};

/**
 * Replaces placeholder keys (e.g., {{key}}) in a string with their translations.
 * @param {string} text - The string containing the placeholders.
 * @returns {string} The string with all keys replaced by their translations.
 */
const _replaceKeys = (text) => {
  return text.replace(/{{(\w+)}}/g, (_, key) => getTranslation(key));
};

/**
 * Initializes the I18n module with a language and base path.
 * It sets up the initial language, loads translations, and starts the MutationObserver.
 * @param {string} [lang='en'] - The language code to use.
 * @param {string} [basePath=''] - The base path for translation JSON files.
 */
const initializeI18N = async (lang = 'en', basePath = '') => {
  try {
    state.currentLang = lang;
    state.basePath = basePath;
    state.isChangingLanguage = false;
    document.body.dataset.changingLanguage = 'false';

    await loadTranslations(lang);
    _setSpeechVariant(lang);
    _initMutationObserver();
  } catch (error) {
    handleError(error, 'initializeI18N');
  }
};

/**
 * Clears the translation cache for the current language from local storage.
 */
const clearCache = () => {
  try {
    state.translations = {};
    StorageModule.removeLocalItem(`quelora_i18n_${state.currentLang}`);
  } catch (error) {
    handleError(error, 'clearCache');
  }
};

/**
 * Asynchronously loads translations for a given language.
 * It first checks local storage for a cached version before attempting a network request.
 * @param {string} lang - The language code for the translations file.
 * @returns {Promise<boolean>} Resolves to true if translations were loaded, false otherwise.
 */
const loadTranslations = async (lang) => {
  const storageKey = `quelora_i18n_${lang}`;
  try {
    const cached = StorageModule.getLocalItem(storageKey);
    if (cached) {
      state.translations = JSON.parse(cached);
      return true;
    }

    if (state.abortController) state.abortController.abort();
    state.abortController = new AbortController();

    const response = await fetch(`${state.basePath}${lang}.json`, { signal: state.abortController.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const newTranslations = await response.json();
    state.translations = newTranslations;
    StorageModule.setLocalItem(storageKey, JSON.stringify(newTranslations));
    return true;
  } catch (error) {
    if (error.name === 'AbortError') return false;
    handleError(error, `loadTranslations "${lang}"`);
    
    const cached = StorageModule.getLocalItem(storageKey);
    if (cached) {
      state.translations = JSON.parse(cached);
      return true;
    }
    
    state.translations = {};
    return false;
  }
};

/**
 * Changes the current language of the application. Handles pending requests and DOM updates.
 * @param {string} lang - The new language code.
 * @param {boolean} [updateDOM=true] - If true, re-translates the entire DOM after the language change.
 * @returns {Promise<boolean>} True if the language was changed successfully, false otherwise.
 */
const changeLanguage = async (lang, updateDOM = true) => {
  if (state.isChangingLanguage) {
    state.pendingLanguageChange = { lang, updateDOM };
    return false;
  }
  if (!lang || lang === state.currentLang) return false;
  
  state.isChangingLanguage = true;
  const previousLang = state.currentLang;
  state.currentLang = lang;
  document.body.dataset.changingLanguage = 'true';
  document.dispatchEvent(new CustomEvent('i18n:languageChangeStart'));
  UtilsModule.pauseObservers('mutation');

  try {
    const success = await loadTranslations(lang);
    if (success) {
      _setSpeechVariant(lang);
      if (updateDOM) await _updateDOM();
      document.body.dataset.changingLanguage = 'false';
      UtilsModule.resumeObservers('mutation');
      document.dispatchEvent(new CustomEvent('i18n:languageChangeEnd'));
      return true;
    } else {
      state.currentLang = previousLang;
      document.body.dataset.changingLanguage = 'false';
      UtilsModule.resumeObservers('mutation');
      return false;
    }
  } catch (error) {
    handleError(error, 'changeLanguage');
    document.body.dataset.changingLanguage = 'false';
    UtilsModule.resumeObservers('mutation');
    return false;
  } finally {
    state.isChangingLanguage = false;
    if (state.pendingLanguageChange) {
      const pending = state.pendingLanguageChange;
      state.pendingLanguageChange = null;
      setTimeout(() => changeLanguage(pending.lang, pending.updateDOM), 50);
    }
  }
};

/**
 * Retrieves the translation for a given key.
 * @param {string} key - The translation key.
 * @returns {string} The translated string or the key itself wrapped in `{{ }}` if not found.
 */
const getTranslation = (key) => {
  return state.translations[key] || `{{${key}}}`;
};

/**
 * Sets the transcription speech variant for the current language in local storage.
 * @param {string} lang - The language code.
 */
const _setSpeechVariant = (lang) => {
  try {
    const variant = state.speechVariants[lang] || 'en-US';
    StorageModule.setLocalItem('quelora_i18n_transcription', variant);
  } catch (error) {
    handleError(error, 'setSpeechVariant');
  }
};

/**
 * Retrieves the stored transcription speech variant from local storage.
 * @returns {string} The speech variant code.
 */
const getSpeechVariant = () => {
  try {
    return StorageModule.getLocalItem('quelora_i18n_transcription') || 'en-US';
  } catch (error) {
    handleError(error, 'getSpeechVariant');
    return 'en-US';
  }
};

/**
 * Translates a single HTML element. It caches the element and its original content.
 * @param {HTMLElement} element - The element to translate.
 * @param {string | null} attribute - The attribute to translate (e.g., 'placeholder').
 * @param {string} className - The CSS class used for translation.
 */
const translateElement = (element, attribute = null, className = 't') => {
  if (!element?.isConnected) return;

  try {
    let key = attribute
      ? element.getAttribute(attribute)?.replace(/^{{|}}$/g, '')
      : (element.innerHTML.trim().match(/^{{(.*?)}}$/)?.[1]?.trim() || null);

    if (!state.elementsMap.has(element)) {
      state.elementsMap.set(element, {
        key,
        attribute,
        className,
        originalContent: attribute ? element.getAttribute(attribute) : element.innerHTML
      });
    }

    const translation = key
      ? getTranslation(key).replace(/{{|}}/g, '')
      : _replaceKeys(element.innerHTML).replace(/{{|}}/g, '');

    if (attribute) {
      element.setAttribute(attribute, translation);
    } else {
      element.innerHTML = translation;
    }
  } catch (error) {
    handleError(error, 'translateElement');
  }
};

/**
 * Translates all elements on the page with a specific CSS class.
 * @param {string} className - The CSS class used to identify elements to be translated.
 * @param {string | null} attribute - The attribute to translate.
 */
const translateByClass = (className, attribute = null) => {
  try {
    const elements = document.querySelectorAll(`.${className}`);
    elements.forEach(element => {
      if (element.isConnected) {
        translateElement(element, attribute, className);
      }
    });
  } catch (error) {
    handleError(error, 'translateByClass');
  }
};

/**
 * Asynchronously updates the DOM by translating all tracked elements.
 * This function uses `requestAnimationFrame` to perform updates in chunks,
 * preventing the main thread from being blocked.
 * @returns {Promise<void>}
 */
const _updateDOM = () => {
  return new Promise(resolve => {
    try {
      const entries = Array.from(state.elementsMap.entries());
      let i = 0;

      const processChunk = () => {
        const end = Math.min(i + I18N_UPDATE_CHUNK_SIZE, entries.length);
        for (; i < end; i++) {
          const [element, data] = entries[i];
          if (!element.isConnected) {
            state.elementsMap.delete(element);
            continue;
          }
          try {
            let translation = data.key
              ? (state.translations[data.key] || `{{${data.key}}}`)
              : _replaceKeys(element.textContent || element.innerHTML);

            translation = translation.replace(/{{|}}/g, '');

            if (data.attribute) {
              element.setAttribute(data.attribute, translation);
            } else {
              element.textContent = translation;
            }
          } catch (e) {
            state.elementsMap.delete(element);
          }
        }
        if (i < entries.length) {
          requestAnimationFrame(processChunk);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(processChunk);
    } catch (error) {
      handleError(error, '_updateDOM');
      resolve();
    }
  });
};

/**
 * Initializes a MutationObserver to automatically translate newly added DOM elements.
 */
const _initMutationObserver = () => {
  try {
    if (state.observer) state.observer.disconnect();
    
    state.observer = new MutationObserver((mutations) => {
      if (document.body.dataset.changingLanguage === 'true') return;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && node.isConnected) {
              state.elementsMap.forEach(({ className, attribute }) => {
                if (node.classList.contains(className)) {
                  translateElement(node, attribute, className);
                }
                node.querySelectorAll(`.${className}`).forEach(child => {
                  if (child.isConnected) {
                    translateElement(child, attribute, className);
                  }
                });
              });
            }
          });
        }
      });
    });
    
    state.observer.observe(document.body, { childList: true, subtree: true });
  } catch (error) {
    handleError(error, '_initMutationObserver');
  }
};

/**
 * Exported public API for the I18n module.
 * This object provides a clear interface for interacting with the module.
 */
const I18n = {
  initializeI18N,
  changeLanguage,
  translateByClass,
  getTranslation,
  clearCache,
  getSpeechVariant
};

export default I18n;