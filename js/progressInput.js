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
 * Creates a progress input module that visually shows input progress based on maxlength.
 * @returns {Object} An object with an `init` method to set up the progress bar.
 */
function createProgressInput() {
    let inputElement, progressBar;

    /**
     * Updates the progress bar based on the current input length.
     */
    const updateProgress = () => {
        const maxLength = inputElement.getAttribute('maxlength') ?? 100;  // Default to 100 if maxlength isn't set
        const currentLength = inputElement.value.length;
        const percentage = (currentLength / maxLength) * 100;

        // Set progress bar width proportional to input width
        progressBar.style.width = `${(percentage / 100) * inputElement.offsetWidth}px`;
        
        // Change color based on fill percentage
        progressBar.style.backgroundColor = 
            percentage < 50 ? '#4caf50' :  // Green (<50%)
            percentage < 75 ? '#e5be01' :  // Yellow (50-75%)
            percentage < 100 ? '#ff9800' : // Orange (75-100%)
            '#f44336';                    // Red (100% or over)
        
        // Toggle 'full' class when reaching 100%
        progressBar.classList[percentage < 100 ? 'remove' : 'add']('full');
    };

    return {
        /**
         * Initializes the progress bar for a given input field.
         * @param {string} inputId - ID of the input element to monitor.
         * @param {string} progressBarId - ID for the progress bar element.
         * @returns {boolean} False if input element doesn't exist.
         */
        init: (inputId, progressBarId) => {
            inputElement = document.getElementById(inputId);
            if (!inputElement) return false;

            // Try to get existing progress bar or create a new one
            progressBar = document.getElementById(progressBarId);
            if (!progressBar) {
                progressBar = UiModule.createElementUI({
                    tag: 'div',
                    id: progressBarId,
                    classes: 'progress-bar',
                    styles: {
                        width: '0',
                        height: '4px',
                        backgroundColor: '#4caf50',
                        transition: 'width 0.3s ease, background-color 0.3s ease'
                    }
                });

                if (!progressBar) return false;
                
                // Insert after the input field
                inputElement.parentNode.insertBefore(progressBar, inputElement.nextSibling);
            }

            // Initial update
            updateProgress();

            // Update on input events
            inputElement.addEventListener('input', updateProgress);
        }
    };
}

/**
 * Factory function that creates and initializes a ProgressInput instance.
 * @param {string} inputId - ID of the input element.
 * @param {string} barId - ID for the progress bar.
 * @returns {Object} The ProgressInput instance.
 */
const ProgressInput = (inputId, barId) => {
    const instance = createProgressInput();
    instance.init(inputId, barId);
    return instance;
};

export default ProgressInput;