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


const StorageModule = {
  /**
   * Save a value to sessionStorage under the given key.
   * Automatically serializes objects as JSON strings.
   * Throws an error if an unserialized object is passed.
   * @param {string} key - Storage key
   * @param {string|object} value - Value to store
   */
  setSessionItem(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (err) {
      console.error(`Error setting session item ${key}:`, err);
      throw err;
    }
  },
  /**
   * Retrieve a value from sessionStorage by key.
   * Tries to parse JSON strings automatically.
   * Returns null if key does not exist or error occurs.
   * @param {string} key - Storage key
   * @returns {string|object|null} Stored value or null if missing/error
   */
  getSessionItem(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (err) {
      console.error(`Error getting session item ${key}:`, err);
      return null;
    }
  },
  /**
   * Remove a value from sessionStorage by key.
   * Logs an error if removal fails.
   * @param {string} key - Storage key
   */
  removeSessionItem(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (err) {
      console.error(`Error removing session item ${key}:`, err);
    }
  },
  /**
   * Save a value to localStorage under the given key.
   * Automatically serializes objects as JSON strings.
   * Throws an error if an unserialized object is passed.
   * @param {string} key - Storage key
   * @param {string|object} value - Value to store
   */
  setLocalItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.error(`Error setting local item ${key}:`, err);
      throw err;
    }
  },
  /**
   * Retrieve a value from localStorage by key.
   * Tries to parse JSON strings automatically.
   * Returns null if key does not exist or error occurs.
   * @param {string} key - Storage key
   * @returns {string|object|null} Stored value or null if missing/error
   */
  getLocalItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      console.error(`Error getting local item ${key}:`, err);
      return null;
    }
  },
  /**
   * Remove a value from localStorage by key.
   * Logs an error if removal fails.
   * @param {string} key - Storage key
   */
  removeLocalItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.error(`Error removing local item ${key}:`, err);
    }
  },
  /**
   * Clear SessionStorage data.
   * Logs error if clearing fails.
   */
  clearSession() {
    try {
      sessionStorage.clear();
    } catch (err) {
      console.error('Error clearing session storage:', err);
    }
  },
  /**
   * Clear LocalStorage data.
   * Logs error if clearing fails.
   */
  clearLocal() {
    try {
      localStorage.clear();
    } catch (err) {
      console.error('Error clearing local storage:', err);
    }
  }
};

export default StorageModule;