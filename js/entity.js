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


/**
 * Entity Module - Handles entity detection and configuration in the DOM
 * Provides functionality to:
 * - Find and mark entities based on client-provided tag path
 * - Extract entity ID from specified attribute
 * - Generate unique hashes for entities when needed
 * - Create interaction controls in specified placement
 */
import ConfModule from './conf.js';


// Default configuration
const defaultConfig = {
    selector: '[data-entity]', // Default selector for entities
    entityIdAttribute: 'data-entity', // Default attribute for entity ID
    entityId: (element) => element.getAttribute('data-entity'), // Function to extract entity ID
    interactionPlacement: {
        position: 'inside', // Default position for interaction elements
        relativeTo: '[data-entity-interaction-containter]' // Default placement selector
    }
};

/**
 * Generates a 24-character hash from an input string
 * @param {string} input - The string to hash
 * @returns {string|null} - 24-character uppercase hash or null on error
 */
async function generateHash(input) {
    try {
        if (!input) return null;
        
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex.substring(0, 24).toLowerCase();
    } catch (error) {
        console.error('Error generating hash:', error);
        return null;
    }
}

/**
 * Gets entity configuration from ConfModule or uses defaults
 * @returns {object} - Merged configuration object
 */
function getConfig() {
    try {
        const config = ConfModule.get('entityConfig', {});

        return {
            selector: config.selector || defaultConfig.selector,
            entityIdAttribute: config.entityIdAttribute || defaultConfig.entityIdAttribute,
            entityId: config.entityIdAttribute 
                ? (element) => element.getAttribute(config.entityIdAttribute)
                : defaultConfig.entityId,
            interactionPlacement: {
                position: config.interactionPlacement?.position || defaultConfig.interactionPlacement.position,
                relativeTo: config.interactionPlacement?.relativeTo || defaultConfig.interactionPlacement.relativeTo
            }
        };
    } catch (error) {
        console.error('Error getting entity config:', error);
        return defaultConfig;
    }
}

/**
 * Gets the position of interaction placement for a given entity
 * @param {HTMLElement} element - The entity element
 * @returns {string} - Position of interaction placement
 */
function getInteractionPosition() {
    try {
        const config = getConfig();
        return config.interactionPlacement.position;
    } catch (error) {
        console.error('Error getting interaction position:', error);
        return defaultConfig.interactionPlacement.position;
    }
}

/**
 * Finds and marks entities in the DOM with full URL-safe encoding
 * @returns {[string[], Record<string, string>]} - [hashedIds, originalMapping]
 */
async function findEntities() {
    try {
        const config = getConfig();
        const elements = Array.from(document.querySelectorAll(config.selector))
            .filter(element => !element.hasAttribute('data-entity-ready'));

        const hashedIds = [];
        const originalMap = {};
        let needsMapping = false;

        await Promise.all(
            elements.map(async (element) => {
                const originalId = config.entityId(element);
                if (!originalId) return;

                // URL-encode the original ID to prevent breakage
                const encodedOriginalId = encodeURIComponent(originalId);
                
                // Determine if we need to hash (only if not using default attribute)

                const shouldHash = config.entityIdAttribute != 'data-entity';
                const finalId = shouldHash 
                    ? await generateHash(originalId) 
                    : originalId;

                // Mark the element
                element.setAttribute('data-entity', finalId);
                element.setAttribute('data-entity-original', encodedOriginalId);
                element.setAttribute('data-entity-ready', 'true');

                // Collect results
                hashedIds.push(finalId);
                
                // Only store mapping if hashing was actually needed
                if (shouldHash || finalId !== originalId) {
                    originalMap[finalId] = encodedOriginalId;
                    needsMapping = true;
                }
            })
        );

        return [hashedIds, needsMapping ? originalMap : {}];
    } catch (error) {
        console.error('Error finding entities:', error);
        return [[], {}];
    }
}

/**
 * Determines where to place interaction elements for a given entity
 * @param {HTMLElement} element - The entity element
 * @param {string} entityId - The entity ID
 * @returns {object} - Placement info {targetElement, position}
 */
function getInteractionPlacement(element, entityId) {
    try {
        const config = getConfig();
        const { position, relativeTo } = config.interactionPlacement;
        let targetElement = document.querySelector(relativeTo);

        if (!targetElement) {
            console.warn(`Interaction placement element ${relativeTo} not found for entity ${entityId}. Using data-entity as fallback.`);
            targetElement = element;
        }

        return { targetElement, position };
    } catch (error) {
        console.error('Error getting interaction placement:', error);
        return { targetElement: element, position: 'inside' };
    }
}

/**
 * Determines where to place interaction elements for a given entity by ID
 * @param {string} entityId - The entity ID
 * @returns {object} - Placement info {targetElement, position}
 */
function getInteractionPlacementByEntity(entityId) {
    try {
        const config = getConfig();
        const { position, relativeTo } = config.interactionPlacement;
        
        // Primero encontrar el elemento principal con el data-entity
        const mainElement = document.querySelector(`${config.selector}[data-entity="${entityId}"]`);
        
        if (!mainElement) {
            console.warn(`Entity element not found for ID: ${entityId}`);
            return { targetElement: null, position };
        }
        
        // Buscar el contenedor de interacción dentro del elemento principal
        let targetElement = mainElement.querySelector(relativeTo);
        
        // Si no se encuentra, usar el elemento principal como fallback
        if (!targetElement) {
            targetElement = mainElement;
        }
        
        return  targetElement;
    } catch (error) {
        console.error('Error getting interaction placement:', error);
        const config = getConfig();
        const mainElement = document.querySelector(`${config.selector}[data-entity="${entityId}"]`);
        return { 
            targetElement: mainElement || null, 
            position: config.interactionPlacement.position 
        };
    }
}

/**
 * Gets all placement elements
 * @returns {HTMLElement[]} - Array of placement elements
 */
function getAllPlacementElements() {
    const elements = [];
    const entities = document.querySelectorAll(getConfig().selector);
    
    entities.forEach(entity => {
        const entityId = entity.getAttribute('data-entity');
        if (entityId) {
            const placement = getInteractionPlacement(entity, entityId);
            if (placement.targetElement && !elements.includes(placement.targetElement)) {
                elements.push(placement.targetElement);
            }
        }
    });
    
    return elements;
}

/**
 * Gets the default selector element for a given entity ID
 * @param {string} entityId - The entity ID
 * @returns {HTMLElement|null} - The default selector element or null if not found
 */
function getDefaultSelectorElement(entityId) {
    try {
        const config = getConfig();
        const selectorElement = document.querySelector(`${config.selector}[data-entity="${entityId}"]`);
        
        if (!selectorElement) {
            console.warn(`Default selector element not found for entity: ${entityId}`);
            return null;
        }
        
        return selectorElement;
    } catch (error) {
        console.error('Error getting default selector element:', error);
        return null;
    }
}

// PUBLIC API
const EntityModule = {
    getInteractionPosition,
    findEntities,
    getDefaultSelectorElement,
    getInteractionPlacement,
    getInteractionPlacementByEntity,
    getConfig,
    generateHash,
    getAllPlacementElements
};

export default EntityModule;