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
 * Notification Module for handling Web Push Notifications
 * 
 * This module provides functionality for:
 * - Requesting notification permissions
 * - Managing push notification subscriptions
 * - Communicating with the backend service
 * - Handling incoming push messages
 */
import I18n from './i18n.js';
import ToastModule from './toast.js';
import SessionModule from './session.js';
import StorageModule from './storage.js';
import ConfModule from './conf.js';

// Configuration for notification endpoints
const config = {
    backendNotificationsSubscribeUrl: ConfModule.get('apiUrl') ? `${ConfModule.get('apiUrl')}/notifications/subscribe` : '',
    backendNotificationsUnsubscribeUrl: ConfModule.get('apiUrl') ? `${ConfModule.get('apiUrl')}/notifications/unsubscribe` : '',
    backendNotificationsChecksubscribeUrl: ConfModule.get('apiUrl') ? `${ConfModule.get('apiUrl')}/notifications/validate` : '',
};

// Cache for service worker registration
let serviceWorkerRegistration = null;

// Storage constants
const STORAGE_KEYS = {
    SUBSCRIPTION_CACHE: 'quelora_subscription_cache',
    SUBSCRIPTION_ID: 'quelora_suscription'
};

// Time constants
const CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Handles incoming push messages
 * @param {MessageEvent} event - The message event containing notification data
 */
function handleMessage(event) {
    const { title, body, icon, url, type } = event.data;
    
    if (type === 'UPDATE_HASH') {
        // Handle hash update messages
        const newHash = event.data.hash;
        if (newHash && window.location.hash !== newHash) {
            window.location.hash = newHash;
        }
    } else {
        // Display notification toast
        ToastModule.info(icon, title, body, url, 10000);
    }
}

/**
 * Requests notification permission from the user
 * @returns {Promise<boolean>} True if permission was granted, false otherwise
 */
async function requestNotificationPermission() {
    try {
        // Check if browser supports notifications
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return false;
        }

        // Check for Edge browser
        const isEdge = navigator.userAgent.includes('Edg/');
        
        // Return if permission already granted
        if (Notification.permission === 'granted') {
            return true;
        }

        // Use custom UI for Edge browser
        if (Notification.permission === 'default' && isEdge) {
            return await requestNotificationPermissionWithUI();
        }

        // Request permission directly
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    } catch (error) {
        console.error('Error checking notification permission:', error);
        return false;
    }
}

/**
 * Shows a custom UI to request notification permission (used for Edge browser)
 * @returns {Promise<boolean>} True if permission was granted, false otherwise
 */
async function requestNotificationPermissionWithUI() {
    try {
        // Check if permission already granted
        if (Notification.permission === 'granted') {
            return true;
        }

        // Create modal elements
        const permissionModal = document.createElement('div');
        permissionModal.id = 'QueloraPermissionRequest';
        permissionModal.className = 'quelora-permission-modal';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'quelora-permission-content';
        
        const title = document.createElement('h2');
        title.className = 'quelora-permission-title';
        title.textContent = I18n.getTranslation('enableNotifications');
        
        const message = document.createElement('p');
        message.className = 'quelora-permission-message';
        message.textContent = I18n.getTranslation('enableNotificationsMessage');
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'quelora-permission-buttons';
        
        const allowButton = document.createElement('button');
        allowButton.className = 'quelora-permission-allow';
        allowButton.textContent = I18n.getTranslation('allowNotifications');
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'quelora-permission-cancel';
        cancelButton.textContent = I18n.getTranslation('notNow');
        
        // Build modal structure
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(allowButton);
        modalContent.appendChild(title);
        modalContent.appendChild(message);
        modalContent.appendChild(buttonContainer);
        permissionModal.appendChild(modalContent);
        document.body.appendChild(permissionModal);
        
        // Force reflow
        permissionModal.offsetHeight;

        // Return promise that resolves when user makes a choice
        return new Promise((resolve) => {
            allowButton.addEventListener('click', async () => {
                permissionModal.style.display = 'none';
                document.body.removeChild(permissionModal);
                const permission = await Notification.requestPermission();
                resolve(permission === 'granted');
            }, { once: true });
            
            cancelButton.addEventListener('click', () => {
                permissionModal.style.display = 'none';
                document.body.removeChild(permissionModal);
                resolve(false);
            }, { once: true });
        });
    } catch (error) {
        console.error('Error showing permission UI:', error);
        return false;
    }
}

/**
 * Converts a base64 string to a Uint8Array
 * @param {string} base64String - The base64 string to convert
 * @returns {Uint8Array} The converted array
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
}

/**
 * Gets or creates a push subscription
 * @returns {Promise<PushSubscription|null>} The push subscription or null if failed
 */
async function getPushSubscription() {
    try {
        // Check for service worker and push manager support
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('🔕 Push notifications not supported');
            return null;
        }

        // Register service worker if not already done
        if (!serviceWorkerRegistration) {
            const registration = await navigator.serviceWorker.getRegistration('/js/quelora/');
            
            if (registration) {
                serviceWorkerRegistration = registration;
            } else {
                serviceWorkerRegistration = await navigator.serviceWorker.register(
                    '/js/quelora/sw.js', 
                    { scope: '/js/quelora/' }
                );
                console.log('🔧 Registered Service Worker');
            }
            
            // Send icon data to service worker
            if (serviceWorkerRegistration.active) {
                serviceWorkerRegistration.active.postMessage({ 
                    iconBase64: ConfModule.get('vapid.iconBase64', '') 
                });
            }
            
            // Add message event listener
            navigator.serviceWorker.addEventListener('message', handleMessage);
        }

        // Get existing subscription
        let subscription = await serviceWorkerRegistration.pushManager.getSubscription();
        
        // Validate existing subscription
        if (subscription) {
            const authKey = subscription.getKey('auth');
            const p256dhKey = subscription.getKey('p256dh');
            
            // Check for valid keys
            if (!authKey || !p256dhKey) {
                console.warn('🔕 Existing subscription has invalid keys, unsubscribing');
                await subscription.unsubscribe();
                subscription = null;
            } else {
                // Validate with backend
                const isValid = await checkSubscriptionWithBackend(subscription);
                if (!isValid) {
                    await subscription.unsubscribe();
                    subscription = null;
                }
            }
        }

        // Create new subscription if none exists
        if (!subscription) {
            const vapidPublicKey = ConfModule.get('vapid.publicKey', '');
            subscription = await serviceWorkerRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });
            
            // Validate new subscription
            if (!subscription.getKey('auth') || !subscription.getKey('p256dh')) {
                throw new Error('Invalid keys in new subscription');
            }
            
            console.log('🔔 New subscription created');
        }

        return subscription;
    } catch (error) {
        console.error('🔕 Error in getPushSubscription:', error);
        return null;
    }
}

/**
 * Checks if a subscription is valid with the backend
 * @param {PushSubscription} subscription - The subscription to validate
 * @returns {Promise<boolean>} True if subscription is valid
 */
async function checkSubscriptionWithBackend(subscription) {
    try {
        const subscriptionId = await generateSubscriptionHash(subscription);

        // Check cache first
        const cachedData = StorageModule.getLocalItem(STORAGE_KEYS.SUBSCRIPTION_CACHE);
        let cache = cachedData ? JSON.parse(cachedData) : null;

        if (cache && 
            cache.subscriptionId === subscriptionId && 
            Date.now() - cache.timestamp < CACHE_TTL) {
            return cache.isValid;
        }

        // Validate with backend
        const response = await fetch(config.backendNotificationsChecksubscribeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SessionModule.getTokenIfAvailable()}`,
                'X-Client-Id': ConfModule.get('cid', '') || ''
            },
            body: JSON.stringify({ subscriptionId })
        });

        const isValid = response.ok;
        const responseData = await response.json().catch(() => ({}));

        // Update cache
        const newCache = {
            subscriptionId,
            isValid,
            timestamp: Date.now(),
            expires: responseData.expires || (Date.now() + CACHE_TTL)
        };

        StorageModule.setLocalItem(STORAGE_KEYS.SUBSCRIPTION_CACHE, JSON.stringify(newCache));
        
        return isValid;
    } catch (error) {
        console.error('Error checking subscription with backend:', error);
        return false;
    }
}

/**
 * Generates a unique hash for a subscription
 * @param {PushSubscription} subscription - The subscription to hash
 * @returns {Promise<string>} The generated hash
 */
async function generateSubscriptionHash(subscription) {
    try {
        const authKey = subscription.getKey('auth');
        const p256dhKey = subscription.getKey('p256dh');
        
        if (!subscription.endpoint || !authKey || !p256dhKey) {
            throw new Error('Subscription data is incomplete');
        }
        
        // Create data string to hash
        const dataToHash = subscription.endpoint + 
                         arrayBufferToBase64(authKey) + 
                         arrayBufferToBase64(p256dhKey);
        
        // Generate SHA-256 hash
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(dataToHash);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return hashHex;
    } catch (error) {
        console.error('🔕 Error generating hash:', error);
        throw new Error('Cannot generate subscription ID: ' + error.message);
    }
}

/**
 * Converts an ArrayBuffer to a base64 string
 * @param {ArrayBuffer} buffer - The buffer to convert
 * @returns {string} The base64 encoded string
 */
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    
    return window.btoa(binary);
}

/**
 * Subscribes to push notifications with the backend
 * @param {string} token - The authentication token
 * @returns {Promise<string|null>} The subscription ID or null if failed
 */
async function subscribeToPushNotifications(token) {
    try {
        // Request permission first
        const hasPermission = await requestNotificationPermission();
        if (!hasPermission) {
            console.log('🔕 Notification permission not granted');
            return null;
        }

        // Get or create subscription
        const subscription = await getPushSubscription();
        if (!subscription) {
            console.warn('🔕 No valid push subscription available');
            return null;
        }

        // Prepare subscription data
        const subscriptionId = await generateSubscriptionHash(subscription);
        const subscriptionData = {
            subscriptionId,
            platform: 'web',
            permissionGranted: hasPermission,
            endpoint: subscription.endpoint,
            keys: {
                p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
                auth: arrayBufferToBase64(subscription.getKey('auth'))
            }
        };

        // Send to backend
        const response = await fetch(config.backendNotificationsSubscribeUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Client-Id': ConfModule.get('cid', '')|| ''
            },
            body: JSON.stringify(subscriptionData)
        });

        if (!response.ok) {
            throw new Error(`Subscription failed: ${response.status}`);
        }

        // Store subscription ID
        StorageModule.setLocalItem(STORAGE_KEYS.SUBSCRIPTION_ID, subscriptionId);

        console.log('🔔 Successfully subscribed to notifications.');
        return subscriptionId;
    } catch (error) {
        console.error('🔕 Error subscribing to push notifications:', error.message);
        return null;
    }
}

/**
 * Unsubscribes from push notifications
 * @param {string} token - The authentication token
 * @returns {Promise<boolean>} True if unsubscribed successfully
 */
async function unsubscribeFromPushNotifications(token) {
    try {
        // Get current subscription
        const subscription = await serviceWorkerRegistration?.pushManager.getSubscription();
        if (!subscription) return false;

        // Notify backend
        const subscriptionId = await generateSubscriptionHash(subscription);
        const response = await fetch(config.backendNotificationsUnsubscribeUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Client-Id': ConfModule.get('cid', '')|| ''
            },
            body: JSON.stringify({ subscriptionId })
        });

        if (!response.ok) {
            throw new Error(`Unsubscribe failed: ${response.status}`);
        }

        // Unsubscribe and clean up
        await subscription.unsubscribe();
        
        if (serviceWorkerRegistration) {
            await serviceWorkerRegistration.unregister();
            serviceWorkerRegistration = null;
        }

        navigator.serviceWorker.removeEventListener('message', handleMessage);
        StorageModule.removeLocalItem(STORAGE_KEYS.SUBSCRIPTION_ID);

        console.log('🔕 Successfully unsubscribed from notifications.');
        return true;
    } catch (error) {
        console.error('🔕 Error unsubscribing from push notifications:', error);
        return false;
    }
}

/**
 * Checks if user is subscribed to push notifications
 * @returns {Promise<boolean>} True if subscribed
 */
async function isSubscribedPushNotifications() {
    try {
        const subscription = StorageModule.getLocalItem(STORAGE_KEYS.SUBSCRIPTION_ID);
        return subscription !== null && subscription !== undefined;
    } catch (error) {
        return false;
    }
}

// Public API
const NotificationModule = {
    requestNotificationPermission,
    getPushSubscription,
    subscribeToPushNotifications,
    unsubscribeFromPushNotifications,
    isSubscribedPushNotifications
};

export default NotificationModule;