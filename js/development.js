(function() {
    'use strict';

    // -----------------------
    // Styles
    // -----------------------
    const style = document.createElement('style');
    style.textContent = `
        #quelora-dev-bar {
            position: fixed; /* stays visible while scrolling */
            left: 20px;
            top: 20px;
            background: rgba(0, 0, 0, 0.78);
            color: white;
            border-radius: 10px;
            padding: 10px 14px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, sans-serif;
            font-size: 12px;
            z-index: 999999;
            box-shadow: 0 2px 12px rgba(0,0,0,0.35);
            border: 1px solid rgba(255,255,255,0.08);
            cursor: move;
            user-select: none;
            backdrop-filter: blur(4px);
            max-width: 320px;
            overflow: hidden;
            touch-action: none;
            transform: none;
            /* animate visual changes but NOT position (left/top) */
            transition: width 0.18s ease, height 0.18s ease, border-radius 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
        }

        /* Collapsed: compact circular button */
        #quelora-dev-bar.collapsed {
            width: 48px !important;
            height: 48px !important;
            padding: 0 !important;
            border-radius: 50% !important;
            display: flex;
            align-items: center;
            justify-content: center;
            max-width: none;
        }

        #quelora-dev-bar h3 {
            margin: 0 0 8px 0;
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            color: #6dd5fa;
        }

        #quelora-dev-bar.collapsed h3 {
            margin: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .dev-expand {
            background: transparent;
            border: none;
            color: #ddd;
            cursor: pointer;
            font-size: 14px;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            line-height: 1;
            padding: 0;
        }

        #quelora-dev-bar.collapsed .dev-expand {
            font-size: 20px;
            width: 36px;
            height: 36px;
            color: white;
            background: transparent;
        }

        .dev-expand:hover {
            background: rgba(255,255,255,0.06);
            color: white;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            transition: opacity 0.18s ease, max-height 0.18s ease;
            max-height: 220px;
            opacity: 1;
        }

        #quelora-dev-bar.collapsed .metrics-grid {
            display: none;
        }

        .metric {
            display: flex;
            flex-direction: column;
        }

        .metric-label {
            font-size: 10px;
            color: #aaa;
            margin-bottom: 2px;
        }

        .metric-value {
            font-weight: 600;
            font-size: 12px;
            color: white;
        }

        .metric-value.updating {
            color: #6dd5fa;
        }

        .quelora-dev-indicator {
            position: fixed;
            top: 10px;
            right: 10px;
            background: #ff4757;
            color: white;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 3px;
            z-index: 1000000;
            font-weight: bold;
        }
    `;
    document.head.appendChild(style);

    // -----------------------
    // DOM elements
    // -----------------------
    const devIndicator = document.createElement('div');
    devIndicator.className = 'quelora-dev-indicator';
    devIndicator.textContent = 'DEV MODE';
    document.body.appendChild(devIndicator);

    const devBar = document.createElement('div');
    devBar.id = 'quelora-dev-bar';
    devBar.innerHTML = `
        <h3><button class="dev-expand" title="Expand/Collapse">−</button></h3>
        <div class="metrics-grid">
            <div class="metric">
                <span class="metric-label">Visible comments</span>
                <span class="metric-value" id="dev-visible-count">0</span>
            </div>
            <div class="metric">
                <span class="metric-label">Hidden comments</span>
                <span class="metric-value" id="dev-hidden-count">0</span>
            </div>
            <div class="metric">
                <span class="metric-label">Dehydrated comments</span>
                <span class="metric-value" id="dev-dehydrated-count">0</span>
            </div>
            <div class="metric">
                <span class="metric-label">Comments in memory</span>
                <span class="metric-value" id="dev-memory-count">0</span>
            </div>
            <div class="metric">
                <span class="metric-label">DOM nodes</span>
                <span class="metric-value" id="dev-dom-nodes">0</span>
            </div>
            <div class="metric">
                <span class="metric-label">Direct children</span>
                <span class="metric-value" id="dev-direct-children">0</span>
            </div>
        </div>
    `;
    document.body.prepend(devBar);

    // -----------------------
    // Persistence keys
    // -----------------------
    const POS_KEY = 'quelora-dev-bar-position';
    const COLLAPSED_KEY = 'quelora-dev-bar-collapsed';

    // -----------------------
    // Helpers: position & constraints
    // -----------------------
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function setInitialPosition() {
        let left = Math.max(10, window.innerWidth - devBar.offsetWidth - 20);
        let top = Math.max(10, window.innerHeight - devBar.offsetHeight - 20);

        const saved = localStorage.getItem(POS_KEY);
        if (saved) {
            try {
                const { x, y } = JSON.parse(saved);
                if (typeof x === 'number' && typeof y === 'number') {
                    left = x;
                    top = y;
                }
            } catch (err) {
                console.warn('quelora: invalid saved position');
            }
        }

        const maxX = Math.max(0, window.innerWidth - devBar.offsetWidth);
        const maxY = Math.max(0, window.innerHeight - devBar.offsetHeight);

        left = clamp(left, 0, maxX);
        top = clamp(top, 0, maxY);

        devBar.style.left = left + 'px';
        devBar.style.top = top + 'px';
    }

    function updatePositionConstraints(save = true) {
        const maxX = Math.max(0, window.innerWidth - devBar.offsetWidth);
        const maxY = Math.max(0, window.innerHeight - devBar.offsetHeight);

        let currentX = parseFloat(devBar.style.left);
        let currentY = parseFloat(devBar.style.top);
        if (Number.isNaN(currentX)) currentX = devBar.offsetLeft;
        if (Number.isNaN(currentY)) currentY = devBar.offsetTop;

        currentX = clamp(currentX, 0, maxX);
        currentY = clamp(currentY, 0, maxY);

        devBar.style.left = currentX + 'px';
        devBar.style.top = currentY + 'px';

        if (save) localStorage.setItem(POS_KEY, JSON.stringify({ x: currentX, y: currentY }));
    }

    // Init position (short timeout to allow layout)
    setTimeout(setInitialPosition, 40);

    // -----------------------
    // Collapse state from storage
    // -----------------------
    const expandBtn = devBar.querySelector('.dev-expand');
    function initCollapsedFromStorage() {
        const saved = localStorage.getItem(COLLAPSED_KEY);
        if (saved === 'true') {
            devBar.classList.add('collapsed');
            expandBtn.textContent = '+';
        } else {
            devBar.classList.remove('collapsed');
            expandBtn.textContent = '−';
        }
        // ensure inside viewport
        updatePositionConstraints(true);
    }
    setTimeout(initCollapsedFromStorage, 80);

    // -----------------------
    // Metrics helpers
    // -----------------------
    function updateMetric(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        const cur = el.textContent;
        if (String(cur) !== String(value)) {
            el.classList.add('updating');
            el.textContent = value;
            setTimeout(() => el.classList.remove('updating'), 300);
        } else {
            el.textContent = value;
        }
    }

    function countCommentNodes(container) {
        if (!container) return 0;
        return container.querySelectorAll('*').length;
    }

    function countDirectThreadChildren(container) {
        if (!container) return 0;
        // prefer :scope if available, otherwise manual children counting
        try {
            const n = container.querySelectorAll(':scope > .community-thread').length;
            if (n >= 0) return n;
        } catch (err) { /* ignore */ }
        let count = 0;
        for (let i = 0; i < container.children.length; i++) {
            const c = container.children[i];
            if (c.classList && c.classList.contains('community-thread')) count++;
        }
        return count;
    }

    function updateMetrics() {
        const threadsContainer = document.querySelector('.community-threads');
        if (!threadsContainer) return;

        const visibleComments = threadsContainer.querySelectorAll('.community-thread[data-comment-visible="true"]');
        updateMetric('dev-visible-count', visibleComments.length);

        // Hidden but NOT dehydrated
        const hiddenComments = threadsContainer.querySelectorAll('.community-thread[data-comment-visible="false"]:not([data-comment-dehydrated])');
        updateMetric('dev-hidden-count', hiddenComments.length);

        const dehydratedComments = threadsContainer.querySelectorAll('.community-thread[data-comment-dehydrated]');
        updateMetric('dev-dehydrated-count', dehydratedComments.length);

        const memoryCount = visibleComments.length + hiddenComments.length;
        updateMetric('dev-memory-count', memoryCount);

        const domNodes = countCommentNodes(threadsContainer);
        updateMetric('dev-dom-nodes', domNodes);

        const directChildren = countDirectThreadChildren(threadsContainer);
        updateMetric('dev-direct-children', directChildren);
    }

    // -----------------------
    // Observers & periodic updates
    // -----------------------
    function setupObservers() {
        const threadsContainer = document.querySelector('.community-threads');
        if (!threadsContainer) {
            // retry later
            setTimeout(setupObservers, 800);
            return;
        }

        const observer = new MutationObserver(updateMetrics);
        observer.observe(threadsContainer, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-comment-visible', 'data-comment-dehydrated']
        });

        updateMetrics();
        setInterval(updateMetrics, 1500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupObservers);
    } else {
        setupObservers();
    }

    // -----------------------
    // Drag / pointer logic (PointerEvents + fallback)
    // -----------------------
    const DRAG_THRESHOLD = 6; // px to consider a drag (prevents click->drag)
    let pointerId = null;
    let startClientX = 0;
    let startClientY = 0;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let currentlyDragging = false;
    let suppressClick = false;

    // click suppression: intercept clicks so when user dragged we don't trigger button action
    devBar.addEventListener('click', (ev) => {
        if (suppressClick) {
            ev.stopPropagation();
            ev.preventDefault();
            suppressClick = false;
        }
    }, true); // capture

    expandBtn.addEventListener('click', (e) => {
        // if this click was suppressed by drag, ignore toggle
        if (suppressClick) {
            e.stopPropagation();
            e.preventDefault();
            suppressClick = false;
            return;
        }
        e.stopPropagation();
        devBar.classList.toggle('collapsed');
        const collapsedNow = devBar.classList.contains('collapsed');
        expandBtn.textContent = collapsedNow ? '+' : '−';
        localStorage.setItem(COLLAPSED_KEY, collapsedNow ? 'true' : 'false');
        // ensure position is still valid after layout change
        setTimeout(() => updatePositionConstraints(true), 40);
    });

    function startTracking(clientX, clientY) {
        // compute baseLeft/baseTop from style.left/top (fixed position => viewport coords)
        const styleLeft = parseFloat(devBar.style.left);
        const styleTop = parseFloat(devBar.style.top);
        const baseLeft = Number.isNaN(styleLeft) ? devBar.offsetLeft : styleLeft;
        const baseTop = Number.isNaN(styleTop) ? devBar.offsetTop : styleTop;

        startClientX = clientX;
        startClientY = clientY;
        dragOffsetX = clientX - baseLeft;
        dragOffsetY = clientY - baseTop;
        currentlyDragging = false;
        suppressClick = false;
    }

    function pointerMoveHandler(clientX, clientY) {
        const dx = Math.abs(clientX - startClientX);
        const dy = Math.abs(clientY - startClientY);

        if (!currentlyDragging) {
            if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
                currentlyDragging = true;
                devBar.style.cursor = 'grabbing';
                suppressClick = true;
            } else {
                return; // still within threshold
            }
        }

        // move
        let newX = clientX - dragOffsetX;
        let newY = clientY - dragOffsetY;

        const maxX = Math.max(0, window.innerWidth - devBar.offsetWidth);
        const maxY = Math.max(0, window.innerHeight - devBar.offsetHeight);

        newX = clamp(newX, 0, maxX);
        newY = clamp(newY, 0, maxY);

        devBar.style.left = newX + 'px';
        devBar.style.top = newY + 'px';
    }

    function endTracking() {
        if (currentlyDragging) {
            devBar.style.cursor = 'move';
            const curX = parseFloat(devBar.style.left) || devBar.offsetLeft;
            const curY = parseFloat(devBar.style.top) || devBar.offsetTop;
            localStorage.setItem(POS_KEY, JSON.stringify({ x: curX, y: curY }));
        }
        currentlyDragging = false;
        pointerId = null;
        // keep suppressClick true for one tick so click event gets blocked (already installed)
        setTimeout(() => { suppressClick = false; }, 0);
    }

    // PointerEvents path
    if (window.PointerEvent) {
        devBar.addEventListener('pointerdown', (e) => {
            // only primary pointer (mouse left / touch / pen)
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            pointerId = e.pointerId;
            startTracking(e.clientX, e.clientY);
            // capture pointer to keep receiving events even if pointer leaves
            try { devBar.setPointerCapture(pointerId); } catch (err) {}
            const move = (ev) => {
                if (ev.pointerId !== pointerId) return;
                pointerMoveHandler(ev.clientX, ev.clientY);
            };
            const up = (ev) => {
                if (ev.pointerId !== pointerId) return;
                endTracking();
                // cleanup
                document.removeEventListener('pointermove', move, { passive: false });
                document.removeEventListener('pointerup', up);
                try { devBar.releasePointerCapture(pointerId); } catch (err) {}
            };
            // attach listeners on document so we don't miss events
            document.addEventListener('pointermove', move, { passive: false });
            document.addEventListener('pointerup', up);
        });
    } else {
        // Fallback: mouse + touch
        // Mouse
        devBar.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            startTracking(e.clientX, e.clientY);
            const move = (ev) => pointerMoveHandler(ev.clientX, ev.clientY);
            const up = (ev) => {
                endTracking();
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });

        // Touch
        devBar.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            if (!t) return;
            startTracking(t.clientX, t.clientY);
            const move = (ev) => {
                const tt = ev.touches[0];
                if (!tt) return;
                pointerMoveHandler(tt.clientX, tt.clientY);
            };
            const up = (ev) => {
                endTracking();
                document.removeEventListener('touchmove', move);
                document.removeEventListener('touchend', up);
            };
            document.addEventListener('touchmove', move, { passive: false });
            document.addEventListener('touchend', up);
        }, { passive: true });
    }

    // Ensure bar stays in viewport on resize
    window.addEventListener('resize', () => updatePositionConstraints(true));

    // -----------------------
    // Expand/collapse: also allow toggling by keyboard on focused button
    // -----------------------
    expandBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            expandBtn.click();
        }
    });

    // -----------------------
    // Public small API (optional)
    // -----------------------
    devBar._quelora = {
        updateMetrics,
        setPosition: (x, y) => {
            devBar.style.left = x + 'px';
            devBar.style.top = y + 'px';
            updatePositionConstraints(true);
        },
        collapse: (flag) => {
            if (flag) devBar.classList.add('collapsed');
            else devBar.classList.remove('collapsed');
            localStorage.setItem(COLLAPSED_KEY, devBar.classList.contains('collapsed') ? 'true' : 'false');
            updatePositionConstraints(true);
        }
    };

    // initial metrics update
    setTimeout(updateMetrics, 120);
})();