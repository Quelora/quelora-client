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

import I18n from './i18n.js';
import NotificationModule from './notifications.js';
import StorageModule from './storage.js';
import ConfModule from './conf.js';
import UtilsModule from './utils.js';

/**
 * Configuration object for authentication providers and backend URLs.
 * @private
 */
const config = {
  googleClientId: ConfModule.get('login.providerDetails.Google.clientId', ''),
  facebookAppId: ConfModule.get('login.providerDetails.Facebook.appId', ''),
  appleClientId: ConfModule.get('login.providerDetails.Apple.clientId', ''),
  xClientId: ConfModule.get('login.providerDetails.X.clientId', ''),
  backendLoginUrl: ConfModule.get('login.baseUrl', ''),
  backendRenewTokenUrl: ConfModule.get('apiUrl') ? `${ConfModule.get('apiUrl')}/login/renew-token` : '',
  pollInterval: ConfModule.get('pollInterval', 2000),
  timeout: ConfModule.get('timeout', 120000),
};

/**
 * Module for managing user authentication sessions.
 * @module Session
 */
const Session = (function () {
  let modal = null;
  let pendingCallbacks = [];
  let registerCheckbox;
  let token = null;
  let isModalOpen = false;
  let googleScriptLoaded = false;
  let facebookScriptLoaded = false;

  /**
   * Loads Google and Facebook authentication scripts if configured.
   * @private
   */
  function loadAuthScripts() {
    console.log(config);
    if (!googleScriptLoaded && config.googleClientId) {
      const googleScript = document.createElement('script');
      googleScript.src = 'https://accounts.google.com/gsi/client';
      googleScript.async = true;
      googleScript.defer = true;
      googleScript.onload = () => {
        googleScriptLoaded = true;
        initializeAuthProviders();
      };
      googleScript.onerror = () => console.error('Failed to load Google Identity Services');
      document.body.appendChild(googleScript);
    }

    if (!facebookScriptLoaded && config.facebookAppId) {
      const facebookScript = document.createElement('script');
      facebookScript.src = 'https://connect.facebook.net/en_US/sdk.js';
      facebookScript.async = true;
      facebookScript.defer = true;
      facebookScript.onload = () => {
        FB.init({
          appId: config.facebookAppId,
          cookie: true,
          xfbml: true,
          version: 'v18.0',
        });
        facebookScriptLoaded = true;
        initializeAuthProviders();
      };
      facebookScript.onerror = () => console.error('Failed to load Facebook SDK');
      document.body.appendChild(facebookScript);
    }
  }

  /**
   * Creates the authentication modal UI.
   * @private
   */
  function createModal() {
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'QueloraSession';
    const modalContent = document.createElement('div');
    modalContent.classList.add('quelora-modal-content');

    const closeButton = document.createElement('button');
    closeButton.classList.add('quelora-btn', 'quelora-close-button');
    closeButton.innerHTML = '×';
    closeButton.addEventListener('click', closeModalUI);

    const title = document.createElement('h2');
    title.classList.add('quelora-title');
    title.textContent = I18n.getTranslation('login') || 'Sign in to your account';

    const providersContainer = document.createElement('div');
    providersContainer.classList.add('quelora-providers-container');

    if (config.googleClientId) {
      const googleContainer = document.createElement('div');
      googleContainer.id = 'google-sign-in-button';
      googleContainer.classList.add('quelora-provider-button', 'google');
      providersContainer.appendChild(googleContainer);
    }

    if (config.facebookAppId) {
      const fbContainer = document.createElement('div');
      fbContainer.id = 'facebook-sign-in-button';
      fbContainer.classList.add('quelora-provider-button', 'facebook');
      fbContainer.innerHTML = `
        <button class="fb-login-button">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="white" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
          </svg>
          <span>Sign in with Facebook</span>
        </button>
      `;
      fbContainer.addEventListener('click', () =>
        FB.login(
          (response) =>
            response.authResponse
              ? handleFacebookResponse(response).catch((error) => {
                  console.error('Error handling Facebook response:', error);
                  handleLoginError();
                })
              : null,
          { scope: 'public_profile,email' }
        )
      );
      providersContainer.appendChild(fbContainer);
    }

    if (config.appleClientId) {
      const appleContainer = document.createElement('div');
      appleContainer.id = 'apple-sign-in-button';
      appleContainer.classList.add('quelora-provider-button', 'apple');
      appleContainer.innerHTML = `
        <button class="apple-login-button">
            <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="white" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
          <span>Sign in with Apple</span>
        </button>
      `;
      appleContainer.addEventListener('click', handleAppleLogin);
      providersContainer.appendChild(appleContainer);
    }

    if (config.xClientId) {
      const xContainer = document.createElement('div');
      xContainer.id = 'x-sign-in-button';
      xContainer.classList.add('quelora-provider-button', 'x');
      xContainer.innerHTML = `
        <button class="x-login-button">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="white" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          <span>Sign in with X</span>
        </button>
      `;
      xContainer.addEventListener('click', handleXLogin);
      providersContainer.appendChild(xContainer);
    }

    const termsText = document.createElement('p');
    termsText.classList.add('quelora-terms');
    termsText.innerHTML = I18n.getTranslation('termsAndConditionsText') || 'By continuing, you agree to our Terms of Service and Privacy Policy.';

    const registerSection = document.createElement('div');
    registerSection.classList.add('quelora-register-section');

    const registerTitle = document.createElement('h3');
    registerTitle.classList.add('quelora-register-title');
    registerTitle.textContent = I18n.getTranslation('dontHaveAccount') || "Don't have an account?";

    const registerButtonsContainer = document.createElement('div');
    registerButtonsContainer.classList.add('quelora-register-buttons-container');

    if (config.googleClientId) {
      const googleRegisterButton = document.createElement('div');
      googleRegisterButton.id = 'google-register-button';
      googleRegisterButton.classList.add('quelora-register-button', 'quelora-disabled', 'google');
      registerButtonsContainer.appendChild(googleRegisterButton);
    }

    registerCheckbox = document.createElement('label');
    registerCheckbox.classList.add('quelora-checkbox');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.classList.add('quelora-checkbox-input');
    checkbox.addEventListener('change', function () {
      document.querySelectorAll('.quelora-register-button').forEach((button) => {
        button.classList.toggle('quelora-disabled', !this.checked);
      });
    });

    const checkboxText = document.createElement('span');
    checkboxText.innerHTML = I18n.getTranslation('acceptTermsAndConditions') || 'I accept the Terms and Conditions';

    registerSection.appendChild(registerTitle);
    registerSection.appendChild(registerButtonsContainer);
    registerSection.appendChild(registerCheckbox);
    registerCheckbox.appendChild(checkbox);
    registerCheckbox.appendChild(checkboxText);

    modalContent.appendChild(closeButton);
    modalContent.appendChild(title);
    modalContent.appendChild(providersContainer);
    modalContent.appendChild(termsText);
    modalContent.appendChild(registerSection);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
  }

  /**
   * Closes and removes the authentication modal.
   * @private
   */
  function closeModalUI() {
    if (modal) {
      modal.remove();
      modal = null;
    }
    isModalOpen = false;
  }

  /**
   * Initializes Google authentication provider if available.
   * @private
   */
  function initializeAuthProviders() {
    if (!window.google?.accounts?.id || !config.googleClientId) return;

    try {
      window.google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: (response) =>
          handleCredentialResponse(response, 'google').catch((error) => {
            console.error('Error handling Google credential response:', error);
            handleLoginError();
          }),
        ux_mode: 'popup',
        auto_select: false,
      });

      const signInButton = document.getElementById('google-sign-in-button');
      const signUpButton = document.getElementById('google-register-button');

      if (signInButton) {
        window.google.accounts.id.renderButton(signInButton, {
          theme: 'filled_blue',
          size: 'large',
          width: '300',
          text: 'signin',
          type: 'standard',
        });
      }

      if (signUpButton) {
        window.google.accounts.id.renderButton(signUpButton, {
          theme: 'outline',
          size: 'large',
          width: '300',
          text: 'signup_with',
          type: 'standard',
        });
      }
    } catch (error) {
      console.error('Error initializing Google Auth:', error);
      handleLoginError();
    }
  }

  /**
   * Handles credential response from Google authentication.
   * @private
   * @param {Object} response - Google authentication response.
   * @param {string} provider - Authentication provider ('google').
   * @returns {Promise<string>} Authentication token.
   */
  async function handleCredentialResponse(response, provider) {
    if (!response?.credential) throw new Error('Invalid credential response');

    const requestData = {
      credential: response.credential,
      provider,
    };

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': ConfModule.get('cid', ''),
      },
      body: JSON.stringify(requestData),
    };

    return await processLoginResponse(config.backendLoginUrl, requestOptions);
  }

  /**
   * Handles Facebook authentication response.
   * @private
   * @param {Object} response - Facebook authentication response.
   * @returns {Promise<string>} Authentication token.
   */
  async function handleFacebookResponse(response) {
    const authResponse = response.authResponse;
    const accessToken = authResponse.accessToken;

    const requestData = {
      access_token: accessToken,
      provider: 'facebook',
    };

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': ConfModule.get('cid', ''),
      },
      body: JSON.stringify(requestData),
    };

    return await processLoginResponse(config.backendLoginUrl, requestOptions);
  }

  /**
   * Generates a code verifier for OAuth.
   * @private
   * @returns {string} Code verifier string.
   */
  function generateCodeVerifier() {
    const array = new Uint32Array(28);
    crypto.getRandomValues(array);
    return Array.from(array, (dec) => ('0' + dec.toString(16)).slice(-2)).join('');
  }

  /**
   * Generates a code challenge from a code verifier.
   * @private
   * @param {string} verifier - Code verifier string.
   * @returns {Promise<string>} Code challenge string.
   */
  async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Generates a random state string for OAuth.
   * @private
   * @returns {string} State string.
   */
  function generateState() {
    return Math.random().toString(36).substring(2);
  }

  /**
   * Handles X (Twitter) OAuth login flow.
   * @private
   * @returns {Promise<string>} Authentication token.
   */
  async function handleXLogin() {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();
    const redirectUri = encodeURIComponent(window.location.origin + '/');

    sessionStorage.setItem('x_oauth_state', state);
    sessionStorage.setItem('x_code_verifier', codeVerifier);

    const authUrl =
      `https://twitter.com/i/oauth2/authorize?` +
      `response_type=code&` +
      `client_id=${config.xClientId}&` +
      `redirect_uri=${redirectUri}&` +
      `scope=users.read%20tweet.read%20offline.access&` +
      `state=${state}&` +
      `code_challenge=${codeChallenge}&` +
      `code_challenge_method=S256`;

    const popup = window.open(authUrl, 'x_login', 'width=600,height=700');

    return new Promise((resolve, reject) => {
      window.addEventListener('message', async (event) => {
        if (event.origin !== window.location.origin || event.data.type !== 'x_oauth_callback') return;

        const { code, state: receivedState } = event.data;
        if (receivedState !== sessionStorage.getItem('x_oauth_state')) {
          reject(new Error('Invalid state'));
          return;
        }

        const tokenUrl = 'https://api.twitter.com/2/oauth2/token';
        const body = new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: config.xClientId,
          redirect_uri: window.location.origin + '/',
          code_verifier: sessionStorage.getItem('x_code_verifier'),
        });

        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });

        if (!response.ok) throw new Error('Token exchange failed');
        const data = await response.json();
        const accessToken = data.access_token;

        sessionStorage.removeItem('x_oauth_state');
        sessionStorage.removeItem('x_code_verifier');

        const requestData = {
          access_token: accessToken,
          provider: 'x',
        };

        const requestOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Id': ConfModule.get('cid', ''),
          },
          body: JSON.stringify(requestData),
        };

        resolve(await processLoginResponse(config.backendLoginUrl, requestOptions));
      });
    });
  }

  /**
   * Handles Apple authentication (mock implementation).
   * @private
   * @returns {Promise<string>} Authentication token.
   */
  async function handleAppleLogin() {
    const mockToken = 'apple_mock_token_' + Math.random().toString(36).substring(2);

    const requestData = {
      access_token: mockToken,
      provider: 'apple',
    };

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': ConfModule.get('cid', ''),
      },
      body: JSON.stringify(requestData),
    };

    return await processLoginResponse(config.backendLoginUrl, requestOptions);
  }

  /**
   * Processes login response from the backend and handles token storage.
   * @private
   * @param {string} url - Backend login URL.
   * @param {Object} requestOptions - Fetch request options.
   * @returns {Promise<string>} Authentication token.
   */
  async function processLoginResponse(url, requestOptions) {
    try {
      const response = await fetch(url, requestOptions);
      if (!response.ok) throw new Error(`Backend responded with ${response.status}: ${await response.text()}`);

      const data = await response.json();
      if (!data.token) throw new Error('No token in backend response');

      token = data.token;
      StorageModule.setSessionItem('quelora_sso_token', token);
      StorageModule.setSessionItem('quelora_sso_token_expires', (Date.now() + (data.expires_in || 3600) * 1000).toString());

      await NotificationModule.subscribeToPushNotifications(token);
      await NotificationModule.requestNotificationPermission();

      const callbacks = [...pendingCallbacks];
      pendingCallbacks = [];
      callbacks.forEach((callback) => {
        try {
          callback({ token, isCached: false, source: 'new_authentication' });
        } catch (e) {
          console.error('Error executing callback:', e);
        }
      });

      closeModalUI();
      return token;
    } catch (error) {
      handleLoginError();
      throw error;
    }
  }

  /**
   * Handles login errors by notifying callbacks and closing the modal.
   * @private
   */
  function handleLoginError() {
    const callbacks = [...pendingCallbacks];
    pendingCallbacks = [];
    callbacks.forEach((callback) => callback(null));
    closeModalUI();
  }

  /**
   * Retrieves or initiates authentication token.
   * @param {boolean} [silent=false] - If true, returns null if no valid token exists without opening modal.
   * @param {boolean} [force=false] - If true, forces new authentication even if valid token exists.
   * @returns {Promise<Object|null>} Token object or null.
   */
  async function getToken(silent = false, force = false) {
    if (isModalOpen) {
      return new Promise((resolve) => pendingCallbacks.push((response) => resolve(response || null)));
    }

    const storedToken = StorageModule.getLocalItem('quelora_sso_token') || StorageModule.getSessionItem('quelora_sso_token');
    const storedExpires =
      StorageModule.getLocalItem('quelora_sso_token_expires') || StorageModule.getSessionItem('quelora_sso_token_expires');
    const isValid = storedToken && storedExpires && !isNaN(parseInt(storedExpires)) && Date.now() < parseInt(storedExpires);

    if (isValid && !force) {
      const source = StorageModule.getLocalItem('quelora_sso_token') ? 'localStorage' : 'sessionStorage';
      return { token: storedToken, isCached: true, source };
    }

    if (silent) return null;

    isModalOpen = true;
    createModal();
    loadAuthScripts();

    return new Promise((resolve, reject) => {
      const authTimeout = UtilsModule.startTimeout(() => {
        if (isModalOpen) {
          closeModalUI();
          reject(new Error('Login timeout'));
        }
      }, config.timeout);

      const checkInterval = setInterval(() => {
        if ((!config.googleClientId || window.google?.accounts?.id) && (!config.facebookAppId || window.FB)) {
          clearInterval(checkInterval);
          initializeAuthProviders();
        }
      }, config.pollInterval);

      pendingCallbacks.push((response) => {
        clearTimeout(authTimeout);
        clearInterval(checkInterval);
        isModalOpen = false;
        response?.token ? resolve(response) : reject(new Error('Login failed'));
      });
    });
  }

  /**
   * Renews the authentication token if available.
   * @returns {Promise<Object>} Renewed token object.
   */
  async function renewToken() {
    const currentToken = getTokenIfAvailable();
    if (!currentToken) throw new Error('No token available');

    const response = await fetch(config.backendRenewTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`,
        'X-Client-Id': ConfModule.get('cid', ''),
      },
    });

    if (!response.ok) throw new Error('Error renewing token');
    const data = await response.json();
    token = data.token;
    StorageModule.setLocalItem('quelora_sso_token', token);
    StorageModule.setLocalItem('quelora_sso_token_expires', (Date.now() + data.expires_in * 1000).toString());
    return { token, isCached: false, source: 'renewed' };
  }

  /**
   * Retrieves available token if valid.
   * @returns {string|null} Token or null if unavailable or expired.
   */
  function getTokenIfAvailable() {
    if (token) return token;
    const storedToken = StorageModule.getLocalItem('quelora_sso_token') || StorageModule.getSessionItem('quelora_sso_token');
    const storedExpires =
      StorageModule.getLocalItem('quelora_sso_token_expires') || StorageModule.getSessionItem('quelora_sso_token_expires');
    if (storedToken && storedExpires && Date.now() < parseInt(storedExpires)) return storedToken;
    return null;
  }

  /**
   * Persists session token to local storage.
   * @returns {boolean} True if session was persisted, false otherwise.
   */
  function rememberSession() {
    const sessionToken = StorageModule.getSessionItem('quelora_sso_token');
    const sessionExpires = StorageModule.getSessionItem('quelora_sso_token_expires');
    if (sessionToken && sessionExpires) {
      StorageModule.setLocalItem('quelora_sso_token', sessionToken);
      StorageModule.setLocalItem('quelora_sso_token_expires', sessionExpires);
      return true;
    }
    return false;
  }

  /**
   * Logs out the user and clears tokens.
   * @returns {Promise<void>}
   */
  async function logout() {
    try {
      const currentToken = getTokenIfAvailable();
      if (currentToken) await NotificationModule.unsubscribeFromPushNotifications(currentToken);
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      token = null;
      StorageModule.removeLocalItem('quelora_sso_token');
      StorageModule.removeLocalItem('quelora_sso_token_expires');
      StorageModule.removeSessionItem('quelora_sso_token');
      StorageModule.removeSessionItem('quelora_sso_token_expires');
    }
  }

  // Handle OAuth callback
  window.addEventListener ('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    if (code && state && window.opener) {
      window.opener.postMessage({ type: 'x_oauth_callback', code, state }, window.location.origin);
      window.close();
    }
  });

  return {
    getToken,
    renewToken,
    getTokenIfAvailable,
    rememberSession,
    logout,
  };
})();

export default Session;