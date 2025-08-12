/*!
 * QUELORA – Real-time interaction platform for websites
 * 
 * @author German Zelaya
 * @version 1.0.0
 * @since 2023
 Licensed under the GNU Affero General Public License v3.0
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

// ==================== PRIVATE VARIABLES ====================
/** @type {Object} Current configuration object */
let config = {};
/** @type {boolean} Tracks initialization status */
let isInitialized = false;

// ==================== DEFAULT CONFIGURATION ====================
/** @type {Object} Default configuration values */
const DEFAULT_CONFIG = {
    cid: null,
    apiUrl: "https://quelora.localhost.ar:444",
    login: {
        baseUrl: "https://quelora.localhost.ar",
        providers: ["Default"],
        providerDetails: {
            Default: {
                clientId: "default-client-id"
            }
        }
    },
    audio: {
        enable_mic_transcription: false,
        save_comment_audio: false,
        max_recording_seconds: 30
    },
    geolocation: {
        enabled: false,
        provider: "none"
    },
    vapid: {
        publicKey: "default-public-key",
        iconBase64: "data:image/png;base64,default-icon"
    }
};

// ==================== HELPERS ====================
/**
 * Logs and throws an error with context.
 * @param {Error} error - Error object
 * @param {string} context - Context of the error
 * @throws {Error} The provided error
 */
const handleError = (error, context) => {
    console.error(`Error in ${context}:`, error);
    throw error;
};

/**
 * Deep merges two objects, preserving nested structures.
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
const deepMerge = (target, source) => {
    const output = { ...target };
    
    for (const key in source) {
        if (source[key] instanceof Object && key in target) {
            output[key] = deepMerge(target[key], source[key]);
        } else {
            output[key] = source[key];
        }
    }
    
    return output;
};

/**
 * Retrieves a value from a configuration object using a dot-notated path.
 * @param {string} keyPath - Dot-separated key path (e.g., 'login.baseUrl')
 * @param {Object} configObj - Configuration object to search
 * @param {*} defaultValue - Fallback value if key is not found
 * @returns {*} Value at the key path or default value
 */
const getValueFromConfig = (keyPath, configObj, defaultValue) => {
    const keys = keyPath.split('.');
    let value = configObj;
    
    for (const key of keys) {
        if (value[key] === undefined) return defaultValue;
        value = value[key];
    }
    
    return value !== undefined ? value : defaultValue;
};

// ==================== AUTO-INITIALIZATION ====================
/**
 * Initializes the module by merging global and default configurations.
 */
const autoInit = () => {
    try {
        const globalConfig = typeof window !== 'undefined' && window.QUELORA_CONFIG 
            ? window.QUELORA_CONFIG 
            : {};
        
        config = deepMerge(DEFAULT_CONFIG, globalConfig);
        
        if (!config.cid) {
            config.cid = DEFAULT_CONFIG.cid;
            console.warn('Using default cid as none was provided');
        }
        
        isInitialized = true;
        console.debug('ConfModule auto-initialized successfully');
    } catch (error) {
        handleError(error, 'ConfModule.autoInit');
        config = { ...DEFAULT_CONFIG };
        isInitialized = true;
    }
};

autoInit();

// ==================== PUBLIC METHODS ====================
/**
 * Gets a configuration value by key path.
 * @param {string} keyPath - Dot-notated key path
 * @param {*} [defaultValue=null] - Fallback value
 * @returns {*} Configuration value or default
 */
const get = (keyPath, defaultValue = null) => {
    if (!isInitialized) {
        console.warn('ConfModule initialization failed. Using default values.');
        return getValueFromConfig(keyPath, DEFAULT_CONFIG, defaultValue);
    }

    try {
        return getValueFromConfig(keyPath, config, defaultValue);
    } catch (error) {
        console.warn(`Failed to get config for path: ${keyPath}`, error);
        return getValueFromConfig(keyPath, DEFAULT_CONFIG, defaultValue);
    }
};

/**
 * Returns a deep copy of the current configuration.
 * @returns {Object} Current configuration
 */
const getAll = () => {
    if (!isInitialized) {
        console.warn('ConfModule initialization failed. Returning default configuration.');
        return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
    return JSON.parse(JSON.stringify(config));
};

/**
 * Updates the configuration by merging with new values.
 * @param {Object} customConfig - New configuration values
 * @returns {boolean} Success status
 */
const updateConfig = (customConfig) => {
    try {
        if (!isInitialized) {
            console.warn('ConfModule was not properly initialized. Performing initialization now.');
            autoInit();
        }
        
        config = deepMerge(config, customConfig);
        return true;
    } catch (error) {
        handleError(error, 'ConfModule.updateConfig');
        return false;
    }
};

// ==================== PUBLIC API ====================
/** @type {Object} Public API for configuration management */
const ConfModule = {
    get,
    getAll,
    updateConfig,
    /** @returns {boolean} Initialization status */
    isInitialized: () => isInitialized,
    /** @returns {Object} Deep copy of default configuration */
    getDefaultConfig: () => JSON.parse(JSON.stringify(DEFAULT_CONFIG))
};

export default ConfModule;