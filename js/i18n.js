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
      },
      translationConfig: []
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
   * @param {Object} [translationConfig=[]] - Configuration for classes and attributes to translate.
   */
  const initializeI18N = async (lang = 'en', basePath = '', translationConfig = []) => {
      try {
          state.currentLang = lang;
          state.basePath = basePath;
          state.isChangingLanguage = false;
          document.body.dataset.changingLanguage = 'false';

          // Almacenar configuración de traducción
          state.translationConfig = Array.isArray(translationConfig) ? translationConfig : [];

          await loadTranslations(lang);
          _setSpeechVariant(lang);
          _initMutationObserver();
          
          // Aplicar configuración de traducción automáticamente
          _applyTranslationConfig();
      } catch (error) {
          handleError(error, 'initializeI18N');
      }
  };

  /**
   * Applies the translation configuration to translate elements by class and attribute.
   */
  const _applyTranslationConfig = () => {
      try {
          state.translationConfig.forEach(config => {
              if (config.className && config.attribute) {
                  translateByClass(config.className, config.attribute);
              } else if (config.className) {
                  translateByClass(config.className);
              }
          });
      } catch (error) {
          handleError(error, '_applyTranslationConfig');
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
   * @returns {string} The translated string or the key itself wrapped in {{ }} if not found.
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
   * Translates a single HTML element. It marks the element with translation metadata.
   * @param {HTMLElement} element - The element to translate.
   * @param {string | null} attribute - The attribute to translate (e.g., 'placeholder').
   * @param {string} className - The CSS class used for translation.
   */
  const translateElement = (element, attribute = null, className = 't') => {
      if (!element?.isConnected || element.dataset.i18nProcessing === 'true') return;

      try {
          element.dataset.i18nProcessing = 'true';

          let key = null;

          if (element.dataset.i18nOriginal) {
              const match = element.dataset.i18nOriginal.match(/^{{(.*?)}}$/);
              if (match) {
                  key = match[1].trim();
              }
          }

          if (!key) {
              key = attribute
                  ? element.getAttribute(attribute)?.replace(/^{{|}}$/g, '')
                  : (element.textContent.trim().match(/^{{(.*?)}}$/)?.[1]?.trim() || null);
          }

          if (!key && element.dataset.i18nKey && element.dataset.i18nKey.includes('{{')) {
              key = element.dataset.i18nKey.replace(/^{{|}}$/g, '');
          }

          // Store original content if not already stored
          if (!element.dataset.i18nOriginal) {
              element.dataset.i18nOriginal = attribute 
                  ? element.getAttribute(attribute) || '' 
                  : element.textContent;
          }

          // Store translation metadata - GUARDAR LA CLAVE CORRECTA, no el texto traducido
          element.dataset.i18nKey = key || '';
          element.dataset.i18nAttribute = attribute || '';
          element.dataset.i18nClass = className;
          element.dataset.i18nLang = state.currentLang;

          const translation = key
              ? getTranslation(key).replace(/{{|}}/g, '')
              : _replaceKeys(element.dataset.i18nOriginal).replace(/{{|}}/g, '');

          if (attribute) {
              element.setAttribute(attribute, translation);
          } else {
              // Preserve child elements when updating text content
              const childNodes = Array.from(element.childNodes);
              const textNodes = childNodes.filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
              
              if (textNodes.length > 0) {
                  // Replace only text nodes, preserve elements
                  textNodes.forEach(node => {
                      if (node.textContent.includes('{{') || key) {
                          node.textContent = translation;
                      }
                  });
              } else {
                  // No text nodes found, check if we need to add translation
                  if (element.dataset.i18nOriginal.includes('{{') || key) {
                      // Create a text node for the translation while preserving existing children
                      const translatedText = document.createTextNode(translation);
                      
                      // Remove any previous translation text nodes we might have added
                      const existingTranslationNodes = Array.from(element.childNodes)
                          .filter(node => node.nodeType === Node.TEXT_NODE && node.dataset?.i18nText === 'true');
                      
                      existingTranslationNodes.forEach(node => node.remove());
                      
                      // Add the new translation as the first child
                      translatedText.dataset.i18nText = 'true';
                      element.insertBefore(translatedText, element.firstChild);
                  }
              }
          }

          element.dataset.i18nProcessing = 'false';
      } catch (error) {
          element.dataset.i18nProcessing = 'false';
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
   * Generates CSS selectors for all configured translation classes
   * @returns {string[]} Array of CSS selectors
   */
  const _getTranslationSelectors = () => {
      return state.translationConfig.map(config => `.${config.className}`);
  };

  /**
   * Finds all translatable elements in the DOM based on their data attributes
   * @returns {HTMLElement[]} Array of elements that need translation
   */
  const _findTranslatableElements = () => {
      const elements = [];
      
      // Find elements with i18n data attributes
      const elementsWithData = document.querySelectorAll('[data-i18n-key]');
      elementsWithData.forEach(el => {
          if (el.isConnected) elements.push(el);
      });
      
      // Find elements with translation classes but no data attributes
      const classSelectors = _getTranslationSelectors();
      classSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
              if (el.isConnected && !el.dataset.i18nKey) {
                  elements.push(el);
              }
          });
      });
      
      return elements;
  };

  /**
   * Gets the translation configuration for a specific class name
   * @param {string} className - The CSS class name
   * @returns {Object|null} The translation configuration or null if not found
   */
  const _getConfigForClass = (className) => {
      return state.translationConfig.find(config => config.className === className) || null;
  };

  /**
   * Asynchronously updates the DOM by translating all tracked elements.
   * This function uses requestAnimationFrame to perform updates in chunks,
   * preventing the main thread from being blocked.
   * @returns {Promise<void>}
   */
  const _updateDOM = () => {
      return new Promise(resolve => {
          try {
              const elements = _findTranslatableElements();
              let i = 0;

              const processChunk = () => {
                  const end = Math.min(i + I18N_UPDATE_CHUNK_SIZE, elements.length);
                  for (; i < end; i++) {
                      const element = elements[i];
                      if (!element.isConnected) continue;
                      
                      try {
                          // Obtener la configuración correcta para el elemento
                          let attribute = element.dataset.i18nAttribute || null;
                          let className = element.dataset.i18nClass || 't';
                          
                          // Si no tenemos atributo en los datos, buscar en la configuración
                          if (!attribute && className) {
                              const config = _getConfigForClass(className);
                              if (config && config.attribute) {
                                  attribute = config.attribute;
                              }
                          }
                          
                          translateElement(element, attribute, className);
                      } catch (e) {
                          console.warn('Failed to translate element:', e);
                      }
                  }
                  
                  if (i < elements.length) {
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
                              // Create an array to collect all translatable elements
                              let translatableElements = [];
                              
                              // Obtener selectores de la configuración
                              const selectors = _getTranslationSelectors();
                              const selectorString = selectors.join(', ');
                              
                              // Check for translatable elements in the added node
                              const elementsFromQuery = node.querySelectorAll?.(selectorString) || [];
                              if (elementsFromQuery.length > 0) {
                                  translatableElements = Array.from(elementsFromQuery);
                              }
                              
                              // Also check if the node itself is translatable
                              if (selectors.some(selector => node.matches?.(selector))) {
                                  translatableElements.push(node);
                              }
                              
                              // Process all translatable elements
                              translatableElements.forEach(element => {
                                  if (element.isConnected) {
                                      const classList = element.classList;
                                      
                                      // Encontrar la clase que coincide con la configuración
                                      const matchingClass = Array.from(classList).find(className => 
                                          state.translationConfig.some(config => config.className === className)
                                      );
                                      
                                      if (matchingClass) {
                                          const config = _getConfigForClass(matchingClass);
                                          const attribute = config?.attribute || null;
                                          translateElement(element, attribute, matchingClass);
                                      }
                                  }
                              });
                          }
                      });
                  }
              });
          });

          state.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false 
          });
          
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