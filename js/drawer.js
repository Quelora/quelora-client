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
        // ... (Sin cambios en este método)
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

        const closeBtn = !UtilsModule.isMobile ? `<button class="drawer-close-btn" aria-label="Cerrar">&times;</button>` : '';
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
            this.emit('closed');

            // ANÁLISIS: Lógica mejorada. Se ejecuta después de que la animación de cierre termina.
            // Si no hay un drawer activo (porque se acaba de cerrar) y hay otros en la pila,
            // muestra el anterior.
            if (!Drawer.activeDrawer && Drawer.drawerStack.length > 0) {
                const previousDrawer = Drawer.drawerStack.pop();
                previousDrawer.show(); // 'show' se encargará de reasignar activeDrawer.
            }

            Drawer.updateBodyScrollLock();
        }
    }

    // ... (Sin cambios en getPositionProperty, getDimension, parseSize, startDragging, onDragging, stopDragging, setHeight)
    getPositionProperty() { return this.position === 'bottom' ? 'bottom' : this.position === 'right' ? 'right' : 'left'; }
    getDimension() { return this.position === 'bottom' ? window.innerHeight : window.innerWidth; }
    parseSize(size, dimension) { if (typeof size === 'number') return size; if (size.includes('%')) return dimension * (parseFloat(size) / 100); return parseFloat(size) || dimension; }
    startDragging(e) { if (!UtilsModule.isMobile) return; this.isDragging = true; this.startTime = Date.now(); const clientPos = this.position === 'bottom' ? (e.touches ? e.touches[0].clientY : e.clientY) : (e.touches ? e.touches[0].clientX : e.clientX); this.startY = clientPos; const currentPos = parseFloat(this.element.style[this.getPositionProperty()]) || 0; this.startPosition = currentPos; this.currentPosition = currentPos; this.startHeight = parseFloat(this.element.style.height || this.parseSize(this.height, this.getDimension())); this.currentHeight = this.startHeight; this.element.style.transition = 'none'; this.element.classList.add('dragging'); document.addEventListener('mousemove', this._boundOnDragging); document.addEventListener('touchmove', this._boundOnDragging, { passive: false }); document.addEventListener('mouseup', this._boundStopDragging); document.addEventListener('touchend', this._boundStopDragging); }
    onDragging(e) { if (!this.isDragging) return; e.preventDefault(); const clientPos = this.position === 'bottom' ? (e.touches ? e.touches[0].clientY : e.clientY) : (e.touches ? e.touches[0].clientX : e.clientX); const delta = clientPos - this.startY; const translate = this.position === 'bottom' ? Math.max(delta, -this.parseSize(this.height, this.getDimension())) : Math.max(delta, -this.parseSize(this.height, this.getDimension())); this.element.style.transform = `translateY(${translate}px)`; }
    stopDragging() { if (!this.isDragging) return; this.isDragging = false; const swipeTime = Date.now() - this.startTime; const dimension = this.getDimension(); const halfDimension = dimension * 0.5; const currentTransform = window.getComputedStyle(this.element).getPropertyValue('transform'); const matrix = new DOMMatrix(currentTransform); const distance = this.position === 'bottom' ? matrix.m42 : matrix.m41; if (UtilsModule.isMobile) { this.element.style.transition = `transform ${this.transitionSpeed} ease, height ${this.transitionSpeed} ease`; } else { this.element.style.transition = `${this.getPositionProperty()} ${this.transitionSpeed} ease`; } if (this.position === 'bottom') { if (distance > halfDimension || swipeTime < 300 && distance > 50) { this.close(); } else if (distance < 0) { this.setHeight(dimension); } else { this.setHeight(halfDimension); } } this.element.classList.remove('dragging'); this.element.style.transform = ''; document.removeEventListener('mousemove', this._boundOnDragging); document.removeEventListener('touchmove', this._boundOnDragging); document.removeEventListener('mouseup', this._boundStopDragging); document.removeEventListener('touchend', this._boundStopDragging); }
    setHeight(height) { if (UtilsModule.isMobile) { if (this.position === 'bottom') { this.element.style.height = `${height}px`; } else { this.element.style.width = `${height}px`; } this.element.style[this.getPositionProperty()] = '0'; this.currentPosition = 0; this.currentHeight = height; } }


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

        // FIX: Reasignar el drawer activo cuando se muestra.
        // Esto es crucial para restaurar el estado correctamente desde la pila.
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
        
        if (UtilsModule.isMobile) {
            this.element.style.transition = `${this.getPositionProperty()} ${this.transitionSpeed} ease, transform ${this.transitionSpeed} ease`;
        } else {
            this.element.style.transition = `${this.getPositionProperty()} ${this.transitionSpeed} ease`;
        }
        
        this.element.style[this.getPositionProperty()] = `-${dimension}px`;
        
        if (wasActive) {
            Drawer.activeDrawer = null;
            // ANÁLISIS: Se elimina el setTimeout. La lógica para mostrar
            // el drawer anterior se movió a 'handleTransitionEnd' para mayor fiabilidad.
        }
        
        if (!fromHistory && history.state && history.state.drawerId === this.id) {
            history.back();
        }
        this.emit('close');
    }

    destroy() {
        const wasActive = Drawer.activeDrawer === this;

        // FIX: Eliminar la referencia de la pila si existe.
        // Evita errores de "referencia fantasma".
        const index = Drawer.drawerStack.indexOf(this);
        if (index > -1) Drawer.drawerStack.splice(index, 1);

        if (wasActive) {
            Drawer.activeDrawer = null;
            if (Drawer.drawerStack.length > 0) {
                const previousDrawer = Drawer.drawerStack.pop();
                // FIX: Usar .show() en lugar de .open().
                // .open() corrompe el estado, .show() lo restaura correctamente.
                previousDrawer.show();
            }
        }
        this.element.remove();
        Drawer.updateBodyScrollLock();
    }
}

export default Drawer;