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
    static activeDrawer = null;
    static historyHandled = false;
    static drawerStack = [];

    static setupHistoryHandling() {
        if (this.historyHandled) return;
        this.historyHandled = true;
        window.addEventListener('popstate', () => {
            if (Drawer.activeDrawer) {
                Drawer.activeDrawer.close(true);
            }
        });
    }

    static isAnyDrawerVisible() {
        return !!(Drawer.activeDrawer && Drawer.activeDrawer.element && Drawer.activeDrawer.element.classList.contains('active'));
    }

    static lockBodyScroll() {
        if (!UtilsModule.isMobile) return;
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
    }

    static unlockBodyScroll() {
        if (!UtilsModule.isMobile) return;
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
    }

    static updateBodyScrollLock() {
        const ad = Drawer.activeDrawer;
        if (ad && ad.element.classList.contains('drawer--full')) {
            Drawer.lockBodyScroll();
        } else {
            Drawer.unlockBodyScroll();
        }
    }

    constructor(config = {}) {
        this.id = config.id || `drawer-${Math.random().toString(36).substr(2, 9)}`;
        this.customClass = config.customClass || '';
        this.title = config.title || 'Quelora';
        this.content = config.content || '<div class="drawer-content"></div>';
        this.height = config.height || '100%';
        this.transitionSpeed = config.transitionSpeed || '0.3s';
        this.zIndex = config.zIndex || 9000;
        this.position = config.position || 'bottom';
        this.closeOnDrag = !!config.closeOnDrag;
        this.afterRender = config.afterRender || null;

        this.element = null;
        this.header = null;
        this.isDragging = false;
        this.startY = 0;
        this.currentY = 0;
        this.startPosition = 0;
        this.currentPosition = 0;
        this.startHeight = 0;
        this.currentHeight = 0;
        this.startTime = 0;
        this.eventHandlers = {};

        this._boundOnDragging = null;
        this._boundStopDragging = null;

        this.initializeDrawer();
    }

    initializeDrawer() {
        this.createElement();
        this.setupEventListeners();
        if (this.afterRender) this.afterRender();
    }

    setupEventListeners() {
        this.header.addEventListener('mousedown', this.startDragging.bind(this));
        this.header.addEventListener('touchstart', this.startDragging.bind(this), { passive: true });
        this.element.addEventListener('transitionend', this.handleTransitionEnd.bind(this));
        this.element.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    on(event, callback) {
        if (!this.eventHandlers[event]) this.eventHandlers[event] = [];
        this.eventHandlers[event].push(callback);
    }

    off(event, callbackToRemove) {
        if (!this.eventHandlers[event]) return;
        this.eventHandlers[event] = this.eventHandlers[event].filter(cb => cb !== callbackToRemove);
    }

    emit(event) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(cb => {
                try { cb(); } catch (err) { console.error(`Error in ${event} handler:`, err); }
            });
        }
    }

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

    handleTransitionEnd() {
        if (!this.element.classList.contains('active')) {
            this.element.style.visibility = 'hidden';
            this.element.style.pointerEvents = 'none';
            this.emit('closed');
            Drawer.updateBodyScrollLock();
        }
    }

    getPositionProperty() {
        return this.position === 'bottom' ? 'bottom' : this.position === 'right' ? 'right' : 'left';
    }

    getDimension() {
        return this.position === 'bottom' ? window.innerHeight : window.innerWidth;
    }

    parseSize(size, dimension) {
        if (typeof size === 'number') return size;
        if (typeof size === 'string' && size.includes('%')) return dimension * (parseFloat(size) / 100);
        return parseFloat(size) || dimension;
    }

    startDragging(e) {
        this.isDragging = true;
        this.startTime = Date.now();
        const clientPos = this.position === 'bottom'
            ? (e.touches ? e.touches[0].clientY : e.clientY)
            : (e.touches ? e.touches[0].clientX : e.clientX);

        this.startY = clientPos;
        const currentPos = parseFloat(this.element.style[this.getPositionProperty()]) || 0;
        this.startPosition = currentPos;
        this.currentPosition = currentPos;
        this.startHeight = parseFloat(this.element.style.height || this.parseSize(this.height, this.getDimension()));
        this.currentHeight = this.startHeight;

        this.element.style.transition = 'none';
        this.element.classList.add('dragging');

        this._boundOnDragging = this.onDragging.bind(this);
        this._boundStopDragging = this.stopDragging.bind(this);

        document.addEventListener('mousemove', this._boundOnDragging);
        document.addEventListener('mouseup', this._boundStopDragging);
        document.addEventListener('touchmove', this._boundOnDragging, { passive: false });
        document.addEventListener('touchend', this._boundStopDragging);
    }

    onDragging(e) {
        if (!this.isDragging) return;
        if (e.cancelable) e.preventDefault();

        const clientPos = this.position === 'bottom'
            ? (e.touches ? e.touches[0].clientY : e.clientY)
            : (e.touches ? e.touches[0].clientX : e.clientX);

        const delta = clientPos - this.startY;
        const isMovingUp = delta < 0;

        if (this.position === 'bottom') {
            if (isMovingUp && this.currentPosition === 0) {
                let newHeight = this.startHeight + Math.abs(delta);
                const maxHeight = this.getDimension();
                newHeight = Math.min(newHeight, maxHeight);
                this.element.style.height = `${newHeight}px`;
                this.currentHeight = newHeight;
                this.element.style.transform = '';
            } else {
                const translate = Math.max(delta, -this.parseSize(this.height, this.getDimension()));
                this.element.style.transform = `translateY(${translate}px)`;
            }
        } else {
            const translate = Math.max(delta, -this.parseSize(this.height, this.getDimension()));
            const axis = this.position === 'right' ? 1 : -1;
            this.element.style.transform = `translateX(${translate * axis}px)`;
        }
    }

    stopDragging(e) {
        if (!this.isDragging) return;
        this.isDragging = false;

        const swipeTime = Date.now() - this.startTime;
        const endPos = this.position === 'bottom'
            ? (e.changedTouches ? e.changedTouches[0].clientY : e.clientY)
            : (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);

        const delta = endPos - this.startY;
        const distance = Math.abs(delta);
        const swipeSpeed = distance / Math.max(swipeTime, 1);
        const dimension = this.getDimension();
        const halfDimension = dimension * 0.5;

        this.element.style.transition = `${this.getPositionProperty()} ${this.transitionSpeed} ease, height ${this.transitionSpeed} ease`;
        this.element.style.transform = '';

        const isMovingDown = delta > 0;

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

        document.removeEventListener('mousemove', this._boundOnDragging);
        document.removeEventListener('mouseup', this._boundStopDragging);
        document.removeEventListener('touchmove', this._boundOnDragging);
        document.removeEventListener('touchend', this._boundStopDragging);

        this._boundOnDragging = null;
        this._boundStopDragging = null;
    }

    setHeight(height) {
        if (this.position === 'bottom') {
            this.element.style.height = `${height}px`;
        } else {
            this.element.style.width = `${height}px`;
        }
        this.element.style[this.getPositionProperty()] = '0';
        this.currentPosition = 0;
        this.currentHeight = height;

        const dimension = this.getDimension();
        const half = dimension * 0.5;
        const TOL = 3;

        const isHalf = Math.abs(height - half) <= TOL;
        const isFull = Math.abs(height - dimension) <= TOL;

        this.element.classList.toggle('drawer--half', isHalf);
        this.element.classList.toggle('drawer--full', isFull);
        if (!isHalf && !isFull) {
            this.element.classList.remove('drawer--half', 'drawer--full');
        }

        Drawer.updateBodyScrollLock();
    }

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

        const sizePx = this.parseSize(this.height, this.getDimension());
        this.setHeight(sizePx);

        this.element.classList.add('active', 'shadow');
        this.element.classList.remove('no-shadow');

        this.emit('open');
    }

    hide() {
        this.element.classList.remove('active', 'shadow');
        this.element.classList.add('no-shadow');
        const dimension = this.parseSize(this.height, this.getDimension());
        this.element.style[this.getPositionProperty()] = `-${dimension}px`;
        this.currentPosition = -dimension;
        this.emit('hide');
    }

    show() {
        this.element.style.visibility = 'visible';
        this.element.style.pointerEvents = 'auto';

        const sizePx = this.parseSize(this.height, this.getDimension());
        this.setHeight(sizePx);

        this.element.classList.add('active', 'shadow');
        this.element.classList.remove('no-shadow');

        this.emit('show');
    }

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
