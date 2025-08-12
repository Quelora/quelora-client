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

import UtilsModule from "./utils.js";

/**
 * ToastModule manages transient notification toasts on the page.
 * Supports different types, icons, swipe to dismiss, and auto-dismiss timing.
 */
const ToastModule = (() => {
  'use strict';

  // Maximum number of toasts visible simultaneously
  const MAX_TOASTS = 4;

  // Array holding active toast objects { element, duration }
  let toasts = [];

  // Container DOM element for all toasts
  let container = null;

  /**
   * Create and append the container div to document.body if not already present
   */
  const createContainer = () => {
    container = document.createElement('div');
    container.className = 'quelora-toast-container';
    document.body.appendChild(container);
  };

  /**
   * Validates whether a string is a base64-encoded image data URL
   * @param {string} str
   * @returns {boolean}
   */
  const isValidBase64 = (str) => {
    try {
      if (!str.startsWith('data:image/')) return false;
      // Decode base64 part and re-encode to verify correctness
      return btoa(atob(str.split(',')[1])).length > 0;
    } catch {
      return false;
    }
  };

  /**
   * Validates if a string is a valid URL (simple regex)
   * @param {string} str
   * @returns {boolean}
   */
  const isValidUrl = (str) => {
    const pattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?(\?[&\w=.-]*)?(#[\w\-]*)?$/i;
    return pattern.test(str);
  };

  /**
   * Checks if a string contains valid HTML content
   * @param {string} str
   * @returns {boolean}
   */
  const isValidHtml = (str) => {
    const div = document.createElement('div');
    div.innerHTML = str;
    return div.childNodes.length > 0;
  };

  /**
   * Creates the toast DOM element with icon, title, body, and close/action handlers.
   * Also handles swipe-to-dismiss gesture on touch devices.
   * @param {string} icon - base64, url, or HTML string for icon
   * @param {string} title - Toast title text
   * @param {string} body - Toast body HTML content
   * @param {function|string} action - Function or URL string to execute on click
   * @param {string} type - Toast type for styling ('info', 'success', 'error', 'warning')
   * @returns {{element: HTMLElement, toastObj: object}} Toast element and wrapper object
   */
  const createToastElement = (icon, title, body, action, type) => {
    const toast = document.createElement('div');
    toast.className = `quelora-toast quelora-toast-${type}`;

    if (icon) {
      const iconEl = document.createElement('div');

      if (isValidBase64(icon) || isValidUrl(icon)) {
        const img = document.createElement('img');
        img.src = icon;
        img.alt = `${type} icon`;
        img.className = 'quelora-toast-icon';
        iconEl.appendChild(img);
      } else if (isValidHtml(icon)) {
        iconEl.className = 'quelora-icons-outlined';
        iconEl.innerHTML = icon;
      } else {
        console.warn('Invalid icon format provided to ToastModule');
      }

      toast.appendChild(iconEl);
    }

    // Content wrapper
    const content = document.createElement('div');
    content.className = 'quelora-toast-content';

    // Title element
    const titleEl = document.createElement('div');
    titleEl.className = 'quelora-toast-title t';
    titleEl.textContent = title;
    content.appendChild(titleEl);

    // Body with clickable link
    const bodyEl = document.createElement('div');
    bodyEl.className = 'quelora-toast-body';

    const linkEl = document.createElement('a');
    linkEl.innerHTML = body;  // assumes safe HTML input
    linkEl.className = 'quelora-toast-link';
    linkEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof action === 'function') {
        action();
      } else if (typeof action === 'string' && action) {
        window.location.href = action;
      }
      removeToast(toastObj);
    });
    bodyEl.appendChild(linkEl);
    content.appendChild(bodyEl);
    toast.appendChild(content);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'quelora-toast-close';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeToast(toastObj);
    });
    toast.appendChild(closeBtn);

    // Swipe-to-dismiss support for touch devices
    let touchStartX = 0;
    let touchCurrentX = 0;
    let isSwiping = false;

    toast.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      isSwiping = true;
      toast.style.transition = 'none';
    });

    toast.addEventListener('touchmove', (e) => {
      if (!isSwiping) return;
      touchCurrentX = e.changedTouches[0].screenX;
      const translateX = Math.max(0, touchCurrentX - touchStartX);
      toast.style.transform = `translateX(${translateX}px)`;
    });

    toast.addEventListener('touchend', () => {
      isSwiping = false;
      toast.style.transition = 'all 0.3s ease-out';
      if (touchCurrentX - touchStartX > 100) {
        removeToast(toastObj);
      } else {
        toast.style.transform = 'translateX(0)';
      }
    });

    const toastObj = { element: toast, duration: 0 };
    return { element: toast, toastObj };
  };

  /**
   * Remove a toast from DOM and from active toasts list
   * @param {object} toast - Toast object containing element and duration
   */
  const removeToast = (toast) => {
    if (!toast) return;

    const index = toasts.indexOf(toast);
    if (index > -1) {
      toasts.splice(index, 1);
    }

    toast.element.classList.remove('quelora-toast-visible');
    UtilsModule.startTimeout(() => {
      if (toast.element.parentNode) {
        toast.element.remove();
      }
    }, 300);
  };

  return {
    /**
     * Initialize Toast container if not yet created
     */
    init() {
      if (!container) {
        createContainer();
      }
    },

    /**
     * Show a new toast notification
     * @param {string} icon - Icon data (base64, url, or html)
     * @param {string} title - Toast title text
     * @param {string} body - Toast body HTML content
     * @param {function|string} action - Callback or URL on toast click
     * @param {number} duration - Duration in ms, 0 means persistent until closed
     * @param {string} type - Toast type ('info' default, 'success', 'error', 'warning')
     */
    show(icon, title, body, action, duration = 0, type = 'info') {
      this.init();

      const { element: toastElement, toastObj } = createToastElement(icon, title, body, action, type);
      toastObj.duration = duration;
      container.prepend(toastElement);
      toasts.unshift(toastObj);

      // Remove oldest if exceeding max toasts count
      if (toasts.length > MAX_TOASTS) {
        removeToast(toasts.pop());
      }

      // Animate toast in shortly after insertion
      UtilsModule.startTimeout(() => {
        toastElement.classList.add('quelora-toast-visible');
      }, 10);

      // Auto-remove toast after duration (if > 0)
      if (duration > 0) {
        UtilsModule.startTimeout(() => {
          removeToast(toastObj);
        }, duration);
      }
    },

    /**
     * Convenience methods for specific toast types
     */
    success(icon, title, body, action, duration = 0) {
      this.show(icon, title, body, action, duration, 'success');
    },

    error(icon, title, body, action, duration = 0) {
      this.show(icon, title, body, action, duration, 'error');
    },

    warning(icon, title, body, action, duration = 0) {
      this.show(icon, title, body, action, duration, 'warning');
    },

    info(icon, title, body, action, duration = 0) {
      this.show(icon, title, body, action, duration, 'info');
    },

    /**
     * Remove all toasts and clean up container
     */
    destroy() {
      toasts.forEach(toast => {
        if (toast.element.parentNode) {
          toast.element.remove();
        }
      });
      toasts = [];
      if (container && container.parentNode) {
        container.remove();
        container = null;
      }
    }
  };
})();

export default ToastModule;
