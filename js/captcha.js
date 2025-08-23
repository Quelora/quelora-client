// =================================================================================
// == DEFINITION OF INTERNAL CLASSES (Core Logic)
// =================================================================================

/**
 * @abstract
 * @class BaseCaptchaProvider
 */
class BaseCaptchaProvider {
    constructor() {
        if (this.constructor === BaseCaptchaProvider) {
            throw new TypeError('Abstract class "BaseCaptchaProvider" cannot be instantiated directly.');
        }
        this.siteKey = null;
        this.widgetId = null;
        this.options = {};
        this.container = null; // #captcha-container
        this.wrapper = null;   // .quelora-captcha
        this.isReady = false;
        this.tokenPromiseResolvers = [];
    }

    async initialize(siteKey, options = {}) {
        if (!siteKey) throw new Error('Site key is required.');
        this.siteKey = siteKey;
        this.options = { containerId: 'captcha-container', size: 'normal', theme: 'auto', ...options };
        this._createContainer();
        await this._loadScript();
        return new Promise((resolve) => {
            const onReady = () => { this._render(); this.isReady = true; resolve(); };
            if (this.apiNamespace) {
                onReady();
            } else {
                resolve(false);
            }
        });
    }

    getToken() { throw new Error('Method "getToken()" must be implemented.'); }
    reset() { throw new Error('Method "reset()" must be implemented.'); }
    
    destroy() {
        if (this.widgetId && this.apiNamespace && this.apiNamespace.remove) {
            this.apiNamespace.remove(this.widgetId);
        }
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }
        this.isReady = false;
        this.widgetId = null;
        this.container = null;
        this.wrapper = null;
    }
    
    _render() { throw new Error('Method "_render()" must be implemented.'); }
    get scriptSrc() { throw new Error('Getter "scriptSrc" must be implemented.'); }
    get apiNamespace() { throw new Error('Getter "apiNamespace" must be implemented.'); }

    _loadScript() {
        return new Promise((resolve, reject) => {
            if (this.apiNamespace) return resolve();
            const scriptUrl = this.scriptSrc;

            const isTurnstile = scriptUrl.includes('challenges.cloudflare.com/turnstile');
            const existingScripts = document.querySelectorAll(`script[src^="https://challenges.cloudflare.com/turnstile"]`);
            existingScripts.forEach(s => s.parentNode.removeChild(s));

            const script = document.createElement('script');
            script.src = scriptUrl;
            if (!isTurnstile) {
                script.async = true;
                script.defer = true;
            }
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load CAPTCHA script from ${scriptUrl}`));
            document.head.appendChild(script);
        });
    }

    _createContainer() {
        // Destroy previous wrapper if exists
        const existingWrapper = document.getElementById('quelora-captcha');
        if (existingWrapper) existingWrapper.remove();

        // Create wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'quelora-captcha';
        this.wrapper.id = 'quelora-captcha';
        this.wrapper.style.display = 'none';

        this.wrapper.addEventListener('click', (e) => {
            console.log("Click");
            if (e.target !== this.wrapper) {
                // reject any pending promises
                console.log("while");
                while (this.tokenPromiseResolvers.length) {
                    const p = this.tokenPromiseResolvers.shift();
                    p.reject(new Error('Captcha cancelled by user.'));
                }
                console.log("Close");
                this.hide();
                this.reset();
            }
        });

        
        // Inner container
        const inner = document.createElement('div');
        inner.className = 'quelora-container';

        // Actual captcha container
        this.container = document.createElement('div');
        this.container.id = this.options.containerId;

        inner.appendChild(this.container);
        this.wrapper.appendChild(inner);
        document.body.appendChild(this.wrapper);
    }

    show() {
        if (this.wrapper) this.wrapper.style.display = 'block';
    }

    hide() {
        if (this.wrapper) this.wrapper.style.display = 'none';
    }
}

class TurnstileProvider extends BaseCaptchaProvider {
    get scriptSrc() { 
        return 'https://challenges.cloudflare.com/turnstile/v0/api.js'; 
    }
    get apiNamespace() { return window.turnstile; }
    
    getToken() {
        return new Promise((resolve, reject) => {
            if (!this.isReady || !this.widgetId) return reject(new Error('Turnstile provider not initialized.'));
            this.tokenPromiseResolvers.push({ resolve, reject });
            this.show(); // show wrapper when challenge may appear
            this.apiNamespace.execute(this.widgetId);
        });
    }

    reset() { 
        if (this.isReady && this.widgetId) { 
            this.apiNamespace.reset(this.widgetId); 
        } 
    }
    
    _render() {
        this.widgetId = this.apiNamespace.render(this.container, {
            sitekey: this.siteKey,
            size: this.options.size,
            theme: this.options.theme,
            execution: 'execute',
            callback: (token) => {
                const p = this.tokenPromiseResolvers.shift();
                if (p) p.resolve(token);
                this.hide(); // hide after success
                this.reset(); // 🔑 Reiniciar el widget para que un nuevo token sea generado en la siguiente llamada.
            },
            'error-callback': () => {
                const p = this.tokenPromiseResolvers.shift();
                if (p) p.reject(new Error('Turnstile challenge failed.'));
                this.hide(); // hide after error
                this.reset(); // 🔑 Reiniciar en caso de error para evitar reintentos con el mismo estado.
            },       
            'expired-callback': () => {
                // reject any pending promise if exists
                while (this.tokenPromiseResolvers.length) {
                    const p = this.tokenPromiseResolvers.shift();
                    p.reject(new Error('Turnstile token expired.'));
                }
                this.hide(); 
                this.reset(); 
            }
        });
    }
}

class RecaptchaProvider extends BaseCaptchaProvider {
    get scriptSrc() { 
        // Usa el script de reCAPTCHA Enterprise con el parámetro render
        return `https://www.google.com/recaptcha/enterprise.js?render=${this.siteKey}`; 
    }
    
    get apiNamespace() { 
        return window.grecaptcha && window.grecaptcha.enterprise; 
    }

    getToken() {
        if (!this.isReady) return Promise.reject(new Error('El proveedor de reCAPTCHA no está inicializado.'));
        return this.apiNamespace.execute(this.siteKey, { action: this.options.action || 'submit' });
    }
    
    reset() { 
        if (this.isReady && this.widgetId) {
            this.apiNamespace.reset(this.widgetId);
        } else if (this.isReady) {
            // Para reCAPTCHA invisible, no hay widget que resetear
            console.log('reCAPTCHA Enterprise (invisible) no requiere reset del widget');
        }
    }
    
    _render() { 
        if (this.options.size !== 'invisible') {
            try {
                this.widgetId = this.apiNamespace.render(this.container, {
                    sitekey: this.siteKey,
                    size: this.options.size,
                    theme: this.options.theme,
                    callback: (token) => {
                        const p = this.tokenPromiseResolvers.shift();
                        if (p) p.resolve(token);
                    },
                    'error-callback': () => {
                        const p = this.tokenPromiseResolvers.shift();
                        if (p) p.reject(new Error('reCAPTCHA challenge failed.'));
                    },
                });
            } catch (error) {
                console.warn('reCAPTCHA render error (may be expected for invisible mode):', error);
            }
        }
    }

    // Override destroy para reCAPTCHA invisible
    destroy() {
        // Solo intentar remover widget si existe (modo visible)
        if (this.widgetId && this.apiNamespace && this.apiNamespace.remove) {
            this.apiNamespace.remove(this.widgetId);
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.isReady = false;
        this.widgetId = null;
        this.container = null;
    }
}

class CaptchaService {
    constructor(type) {
        if (type === 'turnstile') { this.provider = new TurnstileProvider(); } 
        else if (type === 'recaptcha') { this.provider = new RecaptchaProvider(); } 
        else { throw new Error(`Unsupported CAPTCHA provider type: ${type}`); }
        this.type = type;
        this.initialized = false;
    }

    async initialize(siteKey, options = {}) {
        if (this.initialized) return true;
        try {
            await this.provider.initialize(siteKey, options);
            this.initialized = true;
            return true;
        } catch (error) {
            console.error(`Failed to initialize ${this.type} CAPTCHA service:`, error);
            this.initialized = false;
            return false;
        }
    }

    async getToken() {
        if (!this.initialized) throw new Error('CaptchaService is not initialized.');
        return this.provider.getToken();
    }

    reset() { if (this.initialized) this.provider.reset(); }
    destroy() { if (this.initialized) { this.provider.destroy(); this.initialized = false; } }
    isEnabled() { return this.initialized; }
}

// =================================================================================
// == SINGLETON MODULE (PUBLIC API)
// =================================================================================

const CaptchaModule = {
    /** @type {CaptchaService | null} */
    _serviceInstance: null,

    /**
     * Initializes the CAPTCHA module with a specific provider.
     * Can only be initialized once unless destroy() is called first.
     * @param {'turnstile' | 'recaptcha'} type - The type of provider to use.
     * @param {string} siteKey - The site key for the provider.
     * @param {object} [options={}] - Additional configuration options.
     * @returns {Promise<boolean>} True if initialization was successful.
     */
    async initialize(type, siteKey, options = {}) {
        if (this._serviceInstance) {
            console.warn('CaptchaModule is already initialized. Call destroy() first to reinitialize.');
            return this._serviceInstance.isEnabled();
        }
        
        // Create and store the instance internally
        this._serviceInstance = new CaptchaService(type);
        
        // Call its initialization method
        return this._serviceInstance.initialize(siteKey, options);
    },

    /**
     * Retrieves a CAPTCHA token from the configured provider.
     * @returns {Promise<string>} A promise that resolves with the token.
     */
    async getToken() {
        if (!this._serviceInstance || !this._serviceInstance.isEnabled()) {
            throw new Error('CaptchaModule is not initialized or failed to initialize. Call initialize() first.');
        }
        try {
            const token = await this._serviceInstance.getToken();
            return token;
        } catch (error) {
            console.error('Failed to get CAPTCHA token:', error);
            throw error;
        }
    },

    /**
     * Resets the current CAPTCHA widget.
     */
    reset() {
        if (this._serviceInstance) {
            this._serviceInstance.reset();
        } else {
            console.warn('Cannot reset, CaptchaModule is not initialized.');
        }
    },

    /**
     * Unmounts and cleans up CAPTCHA resources, allowing reinitialization.
     */
    destroy() {
        if (this._serviceInstance) {
            this._serviceInstance.destroy();
            this._serviceInstance = null;
        }
    },
    
    /**
     * Checks if the service is enabled and initialized.
     * @returns {boolean}
     */
    isEnabled() {
        return this._serviceInstance ? this._serviceInstance.isEnabled() : false;
    }
};

// Export the object as the module's default export
export default CaptchaModule;