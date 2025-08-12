/*!
 * QUELORA – Real-time interaction platform for websites
 *  * @author German Zelaya
 * @version 1.0.1
 * @since 2023
 Licensed under the GNU Affero General Public License v3.0
 *  * Copyright (C) 2025 German Zelaya
 *  * QUELORA is an open-source platform designed to add real-time comments,
 * posts, and reactions to websites. Its lightweight widget (~170KB uncompressed)
 * integrates easily into any page without the need for frameworks like React
 * or jQuery. It includes support for AI-powered automated moderation,
 * engagement analytics, and a multi-tenant dashboard to manage multiple sites
 * from a single interface.
 *  * This script is part of the QUELORA project, available at:
 * https://www.quelora.org/
 *  * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *  * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *  * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import UtilsModule from './utils.js';

class Drawer {
    /** @type {Drawer|null} Tracks the currently active drawer */
    static activeDrawer = null;
    /** @type {boolean} Indicates if history handling is set up */
    static historyHandled = false;
    /** @type {Drawer[]} Stack of drawers for navigation */
    static drawerStack = [];

    /**
     * Sets up browser history handling for drawer navigation.
     */
    static setupHistoryHandling() {
        if (this.historyHandled) return;
        this.historyHandled = true;

        window.addEventListener('popstate', () => {
            if (Drawer.activeDrawer) {
                Drawer.activeDrawer.close(true);
            }
        });
    }

    /**
     * NEW: Checks if any drawer is currently visible or animating open.
     * @returns {boolean} True if any drawer has the 'active' class.
     */
    static isAnyDrawerVisible() {
        // Find the first drawer that is active. If none, querySelector returns null.
        return document.querySelector('.drawer.active') !== null;
    }

    /**
     * Locks body scroll when a drawer is open.
     */
    static lockBodyScroll() {
        if (!UtilsModule.isMobile) return;
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
    }

    /**
     * Unlocks body scroll when all drawers are closed.
     */
    static unlockBodyScroll() {
        if (!UtilsModule.isMobile) return;
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
    }

    /**
     * NEW: Central method to manage body scroll lock based on visible drawers.
     * This method checks the current state and decides whether to lock or unlock.
     */
    static updateBodyScrollLock() {
        if (Drawer.isAnyDrawerVisible()) {
            Drawer.lockBodyScroll();
        } else {
            Drawer.unlockBodyScroll();
        }
    }

    /**
     * @param {Object} [config={}] - Drawer configuration
     */
    constructor(config = {}) {
        this.id = config.id || `drawer-${Math.random().toString(36).substr(2, 9)}`;
        this.customClass = config.customClass || '';
        this.title = config.title || 'Quelora';
        this.content = config.content || '<div class="drawer-content"></div>';
        this.height = config.height || '100%';
        this.transitionSpeed = config.transitionSpeed || '0.3s';
        this.zIndex = config.zIndex || 9000;
        this.position = config.position || 'bottom';
        this.closeOnDrag = config.closeOnDrag || false;
        this.afterRender = config.afterRender || null;

        /** @type {HTMLElement|null} Drawer DOM element */
        this.element = null;
        /** @type {HTMLElement|null} Drawer header element */
        this.header = null;
        /** @type {boolean} Tracks if the drawer is being dragged */
        this.isDragging = false;
        /** @type {number} Initial Y position of drag */
        this.startY = 0;
        /** @type {number} Current Y position during drag */
        this.currentY = 0;
        /** @type {number} Initial position of drawer */
        this.startPosition = 0;
        /** @type {number} Current position during drag */
        this.currentPosition = 0;
        /** @type {number} Initial height of drawer */
        this.startHeight = 0;
        /** @type {number} Current height during drag */
        this.currentHeight = 0;
        /** @type {number} Start time of drag */
        this.startTime = 0;
        /** @type {Object.<string, Function[]>} Event handlers */
        this.eventHandlers = {};

        this.initializeDrawer();
    }

    /**
     * Initializes the drawer by creating its DOM and setting up listeners.
     */
    initializeDrawer() {
        this.createElement();
        this.setupEventListeners();
        if (this.afterRender) this.afterRender();
    }

    /**
     * Attaches event listeners for drag and transition events.
     */
    setupEventListeners() {
        this.header.addEventListener('mousedown', this.startDragging.bind(this));
        this.header.addEventListener('touchstart', this.startDragging.bind(this), { passive: false });
        document.addEventListener('mousemove', this.onDragging.bind(this));
        document.addEventListener('touchmove', this.onDragging.bind(this), { passive: false });
        document.addEventListener('mouseup', this.stopDragging.bind(this));
        document.addEventListener('touchend', this.stopDragging.bind(this));
        this.element.addEventListener('transitionend', this.handleTransitionEnd.bind(this));
    }

    /**
     * Registers an event handler.
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.eventHandlers[event]) this.eventHandlers[event] = [];
        this.eventHandlers[event].push(callback);
    }

    /**
     * Removes an event handler.
     * @param {string} event - Event name
     * @param {Function} callbackToRemove - Callback to remove
     */
    off(event, callbackToRemove) {
        if (!this.eventHandlers[event]) return;
        this.eventHandlers[event] = this.eventHandlers[event].filter(
            cb => cb !== callbackToRemove
        );
    }

    /**
     * Emits an event to all registered handlers.
     * @param {string} event - Event name
     */
    emit(event) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(cb => {
                try {
                    cb();
                } catch (err) {
                    console.error(`Error in ${event} handler:`, err);
                }
            });
        }
    }

    /**
     * Creates the drawer's DOM structure.
     */
    createElement() {
        const container = document.createElement('div');
        container.id = this.id;
        container.className = `drawer ${this.position} ${this.customClass}`.trim();
        container.style.zIndex = this.zIndex;
        container.style.transition = `${this.getPositionProperty()} ${this.transitionSpeed} ease, height ${this.transitionSpeed} ease`;
        container.style.display = 'flex';
        container.style.visibility = 'hidden';
        container.style.pointerEvents = 'none';

        container.innerHTML = `<div class="drawer-header"><div class="t">${this.title}</div></div><div class="drawer-content">${this.content}</div>`;

        document.body.appendChild(container);
        this.element = container;
        this.header = container.querySelector('.drawer-header');
        container.classList.add('no-shadow');
    }

    /**
     * Handles the end of CSS transitions.
     */
    handleTransitionEnd() {
        // This event fires when any transition ends (e.g., open or close).
        // We only care about when a drawer finishes closing.
        if (!this.element.classList.contains('active')) {
            this.element.style.visibility = 'hidden';
            this.element.style.pointerEvents = 'none';
            this.emit('closed');
            Drawer.updateBodyScrollLock();
        }
    }

    /**
     * Gets the CSS property for positioning based on drawer position.
     * @returns {string} CSS property (bottom, right, or left)
     */
    getPositionProperty() {
        return this.position === 'bottom' ? 'bottom' :
               this.position === 'right' ? 'right' : 'left';
    }

    /**
     * Gets the window dimension based on drawer position.
     * @returns {number} Window height or width
     */
    getDimension() {
        return this.position === 'bottom' ? window.innerHeight : window.innerWidth;
    }

    /**
     * Parses size string or number to pixels.
     * @param {string|number} size - Size value
     * @param {number} dimension - Window dimension
     * @returns {number} Parsed size in pixels
     */
    parseSize(size, dimension) {
        if (typeof size === 'number') return size;
        if (size.includes('%')) return dimension * (parseFloat(size) / 100);
        return parseFloat(size) || dimension;
    }

    /**
     * Starts dragging the drawer.
     * @param {Event} e - Mouse or touch event
     */
    startDragging(e) {
        this.isDragging = true;
        this.startTime = Date.now();
        const clientPos = this.position === 'bottom' ?
            (e.type.includes('touch') ? e.touches[0].clientY : e.clientY) :
            (e.type.includes('touch') ? e.touches[0].clientX : e.clientX);

        this.startY = clientPos;
        const currentPos = parseFloat(this.element.style[this.getPositionProperty()]) || 0;
        this.startPosition = currentPos;
        this.currentPosition = currentPos;
        this.startHeight = parseFloat(this.element.style.height || this.parseSize(this.height, this.getDimension()));
        this.currentHeight = this.startHeight;

        this.element.style.transition = 'none';
        this.element.classList.add('dragging');
    }

    /**
     * Handles dragging movement.
     * @param {Event} e - Mouse or touch event
     */
    onDragging(e) {
        if (!this.isDragging) return;
        e.preventDefault();

        const clientPos = this.position === 'bottom' ?
            (e.type.includes('touch') ? e.touches[0].clientY : e.clientY) :
            (e.type.includes('touch') ? e.touches[0].clientX : e.clientX);

        const delta = clientPos - this.startY;
        const isMovingUp = delta < 0;

        if (this.position === 'bottom') {
            if (isMovingUp && this.currentPosition === 0) {
                let newHeight = this.startHeight + Math.abs(delta);
                const maxHeight = this.getDimension();
                newHeight = Math.min(newHeight, maxHeight);
                this.element.style.height = `${newHeight}px`;
                this.currentHeight = newHeight;
            } else {
                let newPosition = this.startPosition - delta;
                const maxTravel = this.parseSize(this.height, this.getDimension());
                newPosition = Math.min(Math.max(newPosition, -maxTravel), 0);
                this.element.style[this.getPositionProperty()] = `${newPosition}px`;
                this.currentPosition = newPosition;
            }
        } else {
            let newPosition = this.startPosition - delta;
            const maxTravel = this.parseSize(this.height, this.getDimension());
            newPosition = Math.min(Math.max(newPosition, -maxTravel), 0);
            this.element.style[this.getPositionProperty()] = `${newPosition}px`;
            this.currentPosition = newPosition;
        }
    }

    /**
     * Stops dragging and determines final drawer state.
     */
    stopDragging() {
        if (!this.isDragging) return;
        this.isDragging = false;

        const swipeTime = Date.now() - this.startTime;
        const distance = Math.abs(this.currentPosition - this.startPosition);
        const swipeSpeed = distance / Math.max(swipeTime, 1);
        const dimension = this.getDimension();
        const halfDimension = dimension * 0.5;

        this.element.style.transition = `${this.getPositionProperty()} ${this.transitionSpeed} ease, height ${this.transitionSpeed} ease`;

        const isMovingDown = this.currentPosition < this.startPosition;

        if (this.closeOnDrag && isMovingDown) {
            this.close();
        } else if (this.position === 'bottom') {
            if (isMovingDown && swipeSpeed > 0.8) {
                this.close();
            } else if (isMovingDown) {
                this.setHeight(halfDimension);
            } else if (this.currentHeight > halfDimension) {
                this.setHeight(dimension);
            } else {
                this.setHeight(halfDimension);
            }
        } else {
            if (isMovingDown && swipeSpeed > 0.8) {
                this.close();
            } else if (isMovingDown) {
                this.setHeight(halfDimension);
            } else if (this.currentHeight > halfDimension) {
                this.setHeight(dimension);
            } else {
                this.setHeight(halfDimension);
            }
        }

        this.element.classList.remove('dragging');
    }

    /**
     * Sets the drawer's height or width based on position.
     * @param {number} height - New size in pixels
     */
    setHeight(height) {
        if (this.position === 'bottom') {
            this.element.style.height = `${height}px`;
        } else {
            this.element.style.width = `${height}px`;
        }
        this.element.style[this.getPositionProperty()] = '0';
        this.currentPosition = 0;
        this.currentHeight = height;
    }

    /**
     * Opens the drawer, pushing current active drawer to stack.
     */
    open() {
        if (Drawer.activeDrawer) {
            Drawer.drawerStack.push(Drawer.activeDrawer);
            Drawer.activeDrawer.hide();
        }

        Drawer.activeDrawer = this;
        Drawer.setupHistoryHandling();
        history.pushState({ drawerId: this.id }, '', window.location.href);

        this.element.style.visibility = 'visible';
        this.element.style.pointerEvents = 'auto';

        if (this.position === 'bottom') {
            this.element.style.height = this.height;
        } else {
            this.element.style.width = this.height;
        }

        this.element.classList.add('active', 'shadow');
        this.element.classList.remove('no-shadow');
        this.element.style[this.getPositionProperty()] = '0';
        this.currentPosition = 0;

        Drawer.updateBodyScrollLock();
        this.emit('open');
    }

    /**
     * Hides the drawer without removing it from the stack.
     */
    hide() {
        this.element.classList.remove('active', 'shadow');
        this.element.classList.add('no-shadow');
        const dimension = this.parseSize(this.height, this.getDimension());
        this.element.style[this.getPositionProperty()] = `-${dimension}px`;
        this.currentPosition = -dimension;
        this.emit('hide');
    }

    /**
     * Shows a previously hidden drawer.
     */
    show() {
        this.element.style.visibility = 'visible';
        this.element.style.pointerEvents = 'auto';

        if (this.position === 'bottom') {
            this.element.style.height = this.height;
        } else {
            this.element.style.width = this.height;
        }

        this.element.classList.add('active', 'shadow');
        this.element.classList.remove('no-shadow');
        this.element.style[this.getPositionProperty()] = '0';
        this.currentPosition = 0;
        
        Drawer.updateBodyScrollLock();
        this.emit('show');
    }

    /**
     * Closes the drawer and restores the previous one if available.
     * @param {boolean} [fromHistory=false] - Indicates if triggered by history navigation
     */
    close(fromHistory = false) {
        const wasActive = Drawer.activeDrawer === this;

        this.element.classList.remove('active', 'shadow');
        this.element.classList.add('no-shadow');
        const dimension = this.parseSize(this.height, this.getDimension());
        this.element.style[this.getPositionProperty()] = `-${dimension}px`;
        this.currentPosition = -dimension;

        if (wasActive) {
            Drawer.activeDrawer = null;
            if (Drawer.drawerStack.length > 0) {
                const previousDrawer = Drawer.drawerStack.pop();

                previousDrawer.open();
            }
        }

        if (!fromHistory && history.state && history.state.drawerId === this.id) {
            history.back();
        }
        this.emit('close');
    }

    /**
     * Removes the drawer from DOM and stack, restoring previous drawer if needed.
     */
    destroy() {
        const wasActive = Drawer.activeDrawer === this;
        const index = Drawer.drawerStack.indexOf(this);

        if (index > -1) Drawer.drawerStack.splice(index, 1);

        if (wasActive) {
            Drawer.activeDrawer = null;
            if (Drawer.drawerStack.length > 0) {
                const previousDrawer = Drawer.drawerStack.pop();
                previousDrawer.open();
            }
        }

        this.element.remove();
        Drawer.updateBodyScrollLock();
    }
}

export default Drawer;