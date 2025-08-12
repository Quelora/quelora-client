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

import StorageModule from './storage.js';

// ==================== CONSTANTS ====================
const STORAGE_KEY = 'quelora_user_location';
const HOURS_24_MS = 24 * 60 * 60 * 1000;

const PROVIDERS = {
  ipapi: {
    url: 'https://ipapi.co/json/',
    keyParam: null,
    fields: {
      country: 'country_name',
      region: 'region',
      city: 'city',
      ip: 'ip',
      countryCode: 'country',
      lat: 'latitude',
      lon: 'longitude'
    }
  }
};

// ==================== STATE ====================
let currentProvider = 'ipapi';
let apiKey = null;
let cachedData = null;

// ==================== CONFIGURATION ====================
/**
 * Configure the active geolocation provider.
 * @param {string} providerName - Name of the provider to use.
 * @param {string|null} key - Optional API key.
 */
function configure(providerName, key = null) {
  if (!PROVIDERS[providerName]) {
    throw new Error(`Provider "${providerName}" not supported. Available: ${Object.keys(PROVIDERS).join(', ')}`);
  }
  currentProvider = providerName;
  apiKey = key;
}

// ==================== HELPERS ====================
/**
 * Builds the API URL for the current provider.
 * @returns {string} - Full API request URL.
 */
function buildApiUrl() {
  const provider = PROVIDERS[currentProvider];
  if (!provider.keyParam || !apiKey) return provider.url;

  const separator = provider.url.includes('?') ? '&' : '?';
  return `${provider.url}${separator}${provider.keyParam.replace('{key}', apiKey)}`;
}

/**
 * Normalizes the API response to a standard format.
 * @param {Object} data - Raw API response data.
 * @returns {Object} - Normalized location object.
 */
function normalizeData(data) {
  const fields = PROVIDERS[currentProvider].fields;
  return {
    country: data[fields.country],
    region: data[fields.region],
    city: data[fields.city],
    ip: data[fields.ip],
    countryCode: data[fields.countryCode],
    lat: data[fields.lat],
    lon: data[fields.lon],
    timestamp: Date.now(),
    provider: currentProvider
  };
}

/**
 * Checks if the cached location data is still fresh.
 * @param {number} timestamp - Timestamp from the cached data.
 * @returns {boolean} - True if the data is less than 24h old.
 */
function isDataFresh(timestamp) {
  return Boolean(timestamp) && (Date.now() - timestamp < HOURS_24_MS);
}

/**
 * Formats stored or fetched location data into a standardized response.
 * @param {Object} data - Location data.
 * @returns {Object} - Formatted location data with freshness flag.
 */
function getLocationData(data) {
  return {
    country: data.country,
    region: data.region,
    city: data.city,
    ip: data.ip,
    countryCode: data.countryCode,
    lat: data.lat,
    lon: data.lon,
    fresh: isDataFresh(data.timestamp),
    provider: data.provider
  };
}

// ==================== CORE FETCH ====================
/**
 * Fetches location data from the API and stores it locally.
 * @returns {Promise<Object>} - Normalized location data.
 */
async function fetchAndStoreLocation() {
  const res = await fetch(buildApiUrl());
  if (!res.ok) throw new Error(`${currentProvider} API failed: ${res.status}`);

  const location = normalizeData(await res.json());
  StorageModule.setLocalItem(STORAGE_KEY, JSON.stringify(location));
  cachedData = location;
  return location;
}

// ==================== PUBLIC METHODS ====================
/**
 * Retrieves the user's location, from cache if available, otherwise from API.
 * @returns {Promise<Object>} - Location data.
 */
async function getLocation() {
  if (cachedData) return getLocationData(cachedData);

  const stored = StorageModule.getLocalItem(STORAGE_KEY);
  if (stored) {
    cachedData = JSON.parse(stored);
    return getLocationData(cachedData);
  }

  return getLocationData(await fetchAndStoreLocation());
}

/**
 * Retrieves the user's IP address only.
 * @returns {Promise<string>} - IP address.
 */
async function getIp() {
  if (cachedData?.ip) return cachedData.ip;

  const stored = StorageModule.getLocalItem(STORAGE_KEY);
  if (stored) {
    cachedData = JSON.parse(stored);
    if (cachedData.ip) return cachedData.ip;
  }

  return (await fetchAndStoreLocation()).ip;
}

/**
 * Clears stored location data.
 */
function clearStorage() {
  StorageModule.removeLocalItem(STORAGE_KEY);
  cachedData = null;
}

/**
 * Forces a fresh API request, bypassing cache.
 * @returns {Promise<Object>} - Fresh location data.
 */
async function forceRefresh() {
  clearStorage();
  return getLocationData(await fetchAndStoreLocation());
}

/**
 * Returns the list of available providers.
 * @returns {string[]} - Provider names.
 */
function getAvailableProviders() {
  return Object.keys(PROVIDERS);
}

// ==================== EXPORT ====================
const GeoStorage = {
  configure,
  getLocation,
  getIp,
  clearStorage,
  forceRefresh,
  getCurrentProvider: () => currentProvider,
  getAvailableProviders
};

export default GeoStorage;
