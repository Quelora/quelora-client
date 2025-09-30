import UtilsModule from './utils.js';

class Drawer {
    static activeDrawer = null;
    static historyHandled = false;
    static drawerStack = [];
    
    // Global event handlers storage
    static globalEventHandlers = {}; 

    // Static method to subscribe to a global event
    static onGlobal(event, callback) {
        // Input Validation: Ensure the callback is a function before storing it.
        if (typeof callback !== 'function') {
            console.error(`Drawer.onGlobal: The callback provided for event '${event}' is not a function.`);
            return; 
        }
        
        if (!this.globalEventHandlers[event]) this.globalEventHandlers[event] = [];
        this.globalEventHandlers[event].push(callback);
    }

    // Static method to unsubscribe from a global event
    static offGlobal(event, callbackToRemove) {
        if (!this.globalEventHandlers[event]) return;
        this.globalEventHandlers[event] = this.globalEventHandlers[event].filter(cb => cb !== callbackToRemove);
    }
    
    // Static method to emit a global event
    static emitGlobal(event, drawerInstance) {
        if (this.globalEventHandlers[event]) {
            // Pass the drawer instance as an argument
            this.globalEventHandlers[event].forEach(cb => {
                // The error 'cb is not a function' occurs here if validation is absent/bypassed.
                try { cb(drawerInstance); } catch (err) { console.error(`Error in global ${event} handler:`, err); }
            });
        }
    }

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
        return document.querySelector('.drawer.active') !== null;
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
        if (Drawer.isAnyDrawerVisible()) {
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
        if (!UtilsModule.isMobile) {
            this.position = 'right';
            this.height = '100%';
        }
        this.closeOnDrag = config.closeOnDrag || false;
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

        this._boundOnDragging = this.onDragging.bind(this);
        this._boundStopDragging = this.stopDragging.bind(this);

        this.initializeDrawer();
    }

    initializeDrawer() {
        this.createElement();
        this.setupEventListeners();
        if (this.afterRender) this.afterRender();
    }

    setupEventListeners() {
        if (UtilsModule.isMobile) {
            this.header.addEventListener('mousedown', this.startDragging.bind(this));
            this.header.addEventListener('touchstart', this.startDragging.bind(this), { passive: false });
        }
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
        // Create the main container element
        const container = document.createElement('div');
        container.id = this.id;
        container.className = `drawer ${this.position} ${this.customClass}`.trim();
        container.style.zIndex = this.zIndex;
        
        if (UtilsModule.isMobile) {
            container.style.transition = `${this.getPositionProperty()} ${this.transitionSpeed} ease, height ${this.transitionSpeed} ease`;
        } else {
            container.style.transition = `${this.getPositionProperty()} ${this.transitionSpeed} ease`;
        }
        
        container.style.display = 'flex';
        container.style.visibility = 'hidden';
        container.style.pointerEvents = 'none';

        // Add close button only for desktop
        const closeBtn = !UtilsModule.isMobile ? `<button class="drawer-close-btn" aria-label="Close">&times;</button>` : '';
        container.innerHTML = `<div class="drawer-header"><div class="t">${this.title}</div>${closeBtn}</div><div class="drawer-content">${this.content}</div>`;

        document.body.appendChild(container);
        this.element = container;
        this.header = container.querySelector('.drawer-header');
        
        if (!UtilsModule.isMobile) {
            this.header.classList.add('drawer-header--desktop');
            const btn = container.querySelector('.drawer-close-btn');
            if (btn) btn.addEventListener('click', () => this.close());
            const dimension = this.parseSize(this.height, this.getDimension());
            this.element.style[this.getPositionProperty()] = `-${dimension}px`;
            this.element.style.height = '100%';
            this.element.style.maxWidth = '500px';
        } else {
            const dimension = this.parseSize(this.height, this.getDimension());
            this.element.style[this.getPositionProperty()] = `-${dimension}px`;
        }
        
        container.classList.add('no-shadow');
    }

    handleTransitionEnd() {
        if (!this.element.classList.contains('active')) {
            this.element.style.visibility = 'hidden';
            this.element.style.pointerEvents = 'none';
            
            // Emit instance event 'closed'
            this.emit('closed');
            
            // Emit GLOBAL event 'drawerClosed'
            Drawer.emitGlobal('drawerClosed', this); 

            // Logic to show the previous drawer, runs after the closing animation ends.
            // If there's no active drawer and the stack is not empty, show the previous one.
            if (!Drawer.activeDrawer && Drawer.drawerStack.length > 0) {
                const previousDrawer = Drawer.drawerStack.pop();
                previousDrawer.show(); // 'show' will reassign activeDrawer.
            }

            Drawer.updateBodyScrollLock();
        }
    }

    getPositionProperty() { return this.position === 'bottom' ? 'bottom' : this.position === 'right' ? 'right' : 'left'; }
    getDimension() { return this.position === 'bottom' ? window.innerHeight : window.innerWidth; }
    parseSize(size, dimension) { if (typeof size === 'number') return size; if (size.includes('%')) return dimension * (parseFloat(size) / 100); return parseFloat(size) || dimension; }
    startDragging(e) { 
        if (!UtilsModule.isMobile) return; 
        this.isDragging = true; 
        this.startTime = Date.now(); 
        const clientPos = this.position === 'bottom' ? (e.touches ? e.touches[0].clientY : e.clientY) : (e.touches ? e.touches[0].clientX : e.clientX); 
        this.startY = clientPos; 
        const currentPos = parseFloat(this.element.style[this.getPositionProperty()]) || 0; 
        this.startPosition = currentPos; 
        this.currentPosition = currentPos; 
        this.startHeight = parseFloat(this.element.style.height || this.parseSize(this.height, this.getDimension())); 
        this.currentHeight = this.startHeight; 
        this.element.style.transition = 'none'; 
        this.element.classList.add('dragging'); 
        document.addEventListener('mousemove', this._boundOnDragging); 
        document.addEventListener('touchmove', this._boundOnDragging, { passive: false }); 
        document.addEventListener('mouseup', this._boundStopDragging); 
        document.addEventListener('touchend', this._boundStopDragging); 
    }
    onDragging(e) { 
        if (!this.isDragging) return; 
        e.preventDefault(); 
        const clientPos = this.position === 'bottom' ? (e.touches ? e.touches[0].clientY : e.clientY) : (e.touches ? e.touches[0].clientX : e.clientX); 
        const delta = clientPos - this.startY; 
        // Translate is restricted to avoid pulling the drawer beyond its original position
        const translate = this.position === 'bottom' ? Math.max(delta, -this.parseSize(this.height, this.getDimension())) : Math.max(delta, -this.parseSize(this.height, this.getDimension())); 
        this.element.style.transform = `translateY(${translate}px)`; 
    }
    stopDragging() { 
        if (!this.isDragging) return; 
        this.isDragging = false; 
        const swipeTime = Date.now() - this.startTime; 
        const dimension = this.getDimension(); 
        const halfDimension = dimension * 0.5; 
        const currentTransform = window.getComputedStyle(this.element).getPropertyValue('transform'); 
        const matrix = new DOMMatrix(currentTransform); 
        const distance = this.position === 'bottom' ? matrix.m42 : matrix.m41; 
        
        // Re-enable transitions
        if (UtilsModule.isMobile) { 
            this.element.style.transition = `transform ${this.transitionSpeed} ease, height ${this.transitionSpeed} ease`; 
        } else { 
            this.element.style.transition = `${this.getPositionProperty()} ${this.transitionSpeed} ease`; 
        } 
        
        if (this.position === 'bottom') { 
            // Close if dragged more than halfway or swiped quickly
            if (distance > halfDimension || swipeTime < 300 && distance > 50) { 
                this.close(); 
            } else if (distance < 0) { 
                // Restore to full height if dragged up (negative delta)
                this.setHeight(dimension); 
            } else { 
                // Restore to halfway (or original)
                this.setHeight(halfDimension); 
            } 
        } 
        
        this.element.classList.remove('dragging'); 
        this.element.style.transform = ''; 
        document.removeEventListener('mousemove', this._boundOnDragging); 
        document.removeEventListener('touchmove', this._boundOnDragging); 
        document.removeEventListener('mouseup', this._boundStopDragging); 
        document.removeEventListener('touchend', this._boundStopDragging); 
    }
    setHeight(height) { 
        // Only applies to mobile (bottom/side drawers)
        if (UtilsModule.isMobile) { 
            if (this.position === 'bottom') { 
                this.element.style.height = `${height}px`; 
            } else { 
                this.element.style.width = `${height}px`; 
            } 
            this.element.style[this.getPositionProperty()] = '0'; 
            this.currentPosition = 0; 
            this.currentHeight = height; 
        } 
    }


    open() {
        if (Drawer.activeDrawer) {
            // Push current active drawer to stack and hide it
            Drawer.drawerStack.push(Drawer.activeDrawer);
            Drawer.activeDrawer.hide();
        }

        Drawer.activeDrawer = this;
        Drawer.setupHistoryHandling();
        history.pushState({ drawerId: this.id }, '', window.location.href);

        this.element.style.visibility = 'visible';
        this.element.style.pointerEvents = 'auto';

        if (UtilsModule.isMobile) {
            if (this.position === 'bottom') {
                this.element.style.height = this.height;
            } else {
                this.element.style.width = this.height;
            }
        }

        this.element.classList.add('active', 'shadow');
        this.element.classList.remove('no-shadow');
        this.element.style[this.getPositionProperty()] = '0';
        this.currentPosition = 0;
        this.element.style.transform = '';

        Drawer.updateBodyScrollLock();
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

        if (UtilsModule.isMobile) {
            if (this.position === 'bottom') {
                this.element.style.height = this.height;
            } else {
                this.element.style.width = this.height;
            }
        }

        // Reassign active drawer when showing.
        Drawer.activeDrawer = this;

        this.element.classList.add('active', 'shadow');
        this.element.classList.remove('no-shadow');
        this.element.style[this.getPositionProperty()] = '0';
        this.currentPosition = 0;

        Drawer.updateBodyScrollLock();
        this.emit('show');
    }

    close(fromHistory = false) {
        const wasActive = Drawer.activeDrawer === this;
        this.element.classList.remove('active', 'shadow');
        this.element.classList.add('no-shadow');
        const dimension = this.parseSize(this.height, this.getDimension());
        
        // Re-enable transitions for closing animation
        if (UtilsModule.isMobile) {
            this.element.style.transition = `${this.getPositionProperty()} ${this.transitionSpeed} ease, transform ${this.transitionSpeed} ease`;
        } else {
            this.element.style.transition = `${this.getPositionProperty()} ${this.transitionSpeed} ease`;
        }
        
        this.element.style[this.getPositionProperty()] = `-${dimension}px`;
        
        if (wasActive) {
            Drawer.activeDrawer = null;
            // The logic to show the previous drawer was moved to 'handleTransitionEnd'
        }
        
        // If not closing from a history event and the history state is ours, trigger history.back()
        if (!fromHistory && history.state && history.state.drawerId === this.id) {
            history.back();
        }
        this.emit('close');
    }

    destroy() {
        const wasActive = Drawer.activeDrawer === this;

        // Remove reference from the stack if it exists.
        const index = Drawer.drawerStack.indexOf(this);
        if (index > -1) Drawer.drawerStack.splice(index, 1);

        if (wasActive) {
            Drawer.activeDrawer = null;
            if (Drawer.drawerStack.length > 0) {
                const previousDrawer = Drawer.drawerStack.pop();
                // Use .show() instead of .open() to restore state correctly.
                previousDrawer.show();
            }
        }
        this.element.remove();
        Drawer.updateBodyScrollLock();
    }
}

export default Drawer;