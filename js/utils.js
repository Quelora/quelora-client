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

import PostsModule from './posts.js';
import EntityModule from './entity.js';

const postStatsCache = new Map();

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Intl.DateTimeFormat(navigator.language || 'es-ES', options).format(date);
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
}

function getTimeAgo(timestamp) {
    try {
        const now = new Date();
        const commentDate = new Date(timestamp);
        
        if (isNaN(commentDate.getTime())) {
            return '{{justNow}}';
        }

        const diff = now - commentDate;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '{{justNow}}';
        if (minutes < 60) return `${minutes} {{minutesAgo}}`;
        if (hours < 24) return `${hours} {{hoursAgo}}`;
        return `${days} ${days === 1 ? '{{dayAgo}}' : '{{daysAgo}}'}`;
    } catch (error) {
        console.error('Error calculating time ago:', error);
        return '{{justNow}}';
    }
}

function startTimeout(callback, time) {
    try {
        return setTimeout(() => {
            try {
                callback();
            } catch (error) {
                console.error('Error in timeout callback:', error);
            }
        }, time);
    } catch (error) {
        console.error('Error starting timeout:', error);
        return null;
    }
}

function cancelTimeout(timeoutId) {
    try {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    } catch (error) {
        console.error('Error canceling timeout:', error);
    }
}

function debounce(func, delay, immediate = false) {
    let timeoutId;
    
    return function(...args) {
        const context = this;
        const later = function() {
            timeoutId = null;
            if (!immediate) func.apply(context, args);
        };
        
        const callNow = immediate && !timeoutId;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(later, delay);
        
        if (callNow) func.apply(context, args);
    };
}

const debouncedFetchStats = debounce(() => {
     PostsModule.fetchStats();
}, 250);

function observeNewEntities() {
    try {
        const observer = new MutationObserver(async (mutations) => {
            let shouldFetchStats = false;
            const config = await EntityModule.getConfig();

            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches(config.selector) || node.querySelector(config.selector)) {
                                shouldFetchStats = true;
                                break;
                            }
                        }
                    }
                    if (shouldFetchStats) break;
                }
            }
            if (shouldFetchStats) {
                debouncedFetchStats();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return observer;
    } catch (error) {
        console.error('Error in observeNewEntities:', error);
        return null;
    }
}

function setStatsCache(stat) {
    try {
        if (stat && stat.entity) {
            postStatsCache.set(stat.entity, stat.config);
        }
    } catch (error) {
        console.error('Error setting stats cache:', error);
    }
}

function getConfig(entityId) {
    try {
        return postStatsCache.get(entityId) || null;
    } catch (error) {
        console.error('Error getting config:', error);
        return null;
    }
}

function setInputLimit(limits = 200) {
    try {
        const inputElement = document.getElementById('quelora-input');
        if (inputElement) {
            inputElement.maxLength = limits;
        }
    } catch (error) {
        console.error('Error setting input limit:', error);
    }
}

function formatNumberAbbreviated(number) {
    if (number >= 1000000) {
        return (number / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    } else if (number >= 1000) {
        return (number / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    } else {
        return number.toString();
    }
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getCurrentScriptPath() {
    try {
        const scripts = document.getElementsByTagName('script');
        for (let script of scripts) {
            const match = script.src.match(/(quelora(\.min)?\.js)$/);
            if (match) {
                return script.src.substring(0, script.src.lastIndexOf('/') + 1);
            }
        }
        return '';
    } catch (error) {
        console.error('Error detecting script path:', error);
        return '';
    }
}

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const UtilsModule = {
    getTimeAgo,
    startTimeout,
    cancelTimeout,
    observeNewEntities,
    getConfig,
    setStatsCache,
    setInputLimit,
    formatDate,
    formatNumberAbbreviated,
    wait,
    getCurrentScriptPath,
    debounce,
    isMobile
};

export default UtilsModule;