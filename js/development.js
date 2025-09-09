// Importamos los módulos reales
import EntityModule from './entity.js';
import UtilsModule from './utils.js';

(function () {
    'use strict';
    let updateIntervalId;
    // -----------------------
    // Styles
    // -----------------------
    const style = document.createElement('style');
    style.textContent = `
        #quelora-dev-bar {
            position: fixed;
            left: 20px;
            top: 20px;
            background: rgba(0, 0, 0, 0.7); /* Transparencia ajustada */
            color: white;
            border-radius: 10px;
            padding: 10px 14px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, sans-serif;
            font-size: 12px;
            z-index: 999999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5); /* Sombra ajustada */
            border: 1px solid rgba(255,255,255,0.08);
            cursor: move;
            user-select: none;
            backdrop-filter: blur(8px); /* Blur ajustado para mejor efecto */
            min-width: 320px;
            max-width: 360px;
            overflow: hidden;
            touch-action: none;
            transition: width 0.18s ease, height 0.18s ease, border-radius 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease, min-width 0.18s ease;
        }

        #quelora-dev-bar.collapsed {
            width: auto !important;
            height: 48px !important;
            padding: 0 14px !important;
            border-radius: 24px !important;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 150px;
            max-width: 250px;
            cursor: move;
            gap: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.4); /* Sombra para estado colapsado */
        }

        .dev-header {
            display: flex;
            justify-content: flex-end;
            position: absolute;
            top: -6px;
            right: 6px;
            z-index: 10;
        }

        #quelora-dev-bar.collapsed .dev-header,
        #quelora-dev-bar.collapsed .dev-content {
            display: none;
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
            transition: background-color 0.2s ease, color 0.2s ease;
        }

        .dev-expand:hover {
            background: rgba(255,255,255,0.06);
            color: white;
        }

        .dev-collapsed-content {
            display: none;
            width: 100%;
            height: 100%;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }

        #quelora-dev-bar.collapsed .dev-collapsed-content {
            display: flex;
        }

        .collapsed-metrics {
            display: flex;
            gap: 12px;
        }

        .collapsed-metric {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .collapsed-label {
            font-size: 16px;
            line-height: 1;
        }

        .collapsed-value {
            font-weight: 600;
            font-size: 12px;
            color: #6dd5fa;
            white-space: nowrap;
        }
        
        #dev-expand-btn {
            display: none;
            background: #4a90e2; /* Color de fondo del círculo */
            color: white;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            font-size: 20px;
            line-height: 1;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        
        #dev-expand-btn:hover {
            transform: scale(1.1);
            background: #5a9ce7;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        #quelora-dev-bar.collapsed #dev-expand-btn {
            display: flex;
        }
        
        #quelora-dev-bar.collapsed #dev-collapse-btn {
            display: none;
        }

        .metrics-row {
            display: flex;
            gap: 12px;
            margin-bottom: 8px;
        }

        .metrics-fieldset.flex-20 {
            flex: 0 0 20%;
        }
        .metrics-fieldset.flex-70 {
            flex: 0 0 70%;
        }

        .metrics-fieldset {
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            padding: 8px 10px;
            margin-bottom: 8px;
            flex: 1;
        }
        
        .metrics-fieldset.active-fieldset {
            box-shadow: 0 0 15px rgba(109, 213, 250, 0.6);
            border-color: rgba(109, 213, 250, 0.6);
            transition: box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .metrics-fieldset legend {
            font-size: 10px;
            color: #aaa;
            padding: 0 6px;
            margin-left: 4px;
            font-weight: bold;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
            gap: 8px 12px;
            transition: opacity 0.18s ease, max-height 0.18s ease;
            max-height: 220px;
            opacity: 1;
            align-items: flex-end;
        }
        .metrics-grid.cols-4 {
            grid-template-columns: repeat(4, 1fr);
        }
        .metrics-grid.cols-5 {
            grid-template-columns: repeat(5, 1fr);
        }
        .metrics-grid.cols-3 {
            grid-template-columns: repeat(3, 1fr);
        }
        
        .metrics-flex-row {
            display: flex;
            gap: 12px;
            align-items: flex-end;
            justify-content: space-between;
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
            white-space: nowrap;
        }

        .metric-value {
            font-weight: 600;
            font-size: 12px;
            color: #6dd5fa;
            white-space: nowrap;
        }

        .metric-value.heap-value {
            color: #ffcc00;
        }
        
        .dev-chart-container {
            position: relative;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .dev-chart-controls {
            display: flex;
            justify-content: flex-end;
            gap: 15px;
            margin-bottom: 10px;
        }

        .dev-chart-controls label {
            display: flex;
            align-items: center;
            cursor: pointer;
            font-size: 10px;
            color: #ccc;
        }
        
        .dev-chart-controls input[type="checkbox"] {
            margin-right: 4px;
            cursor: pointer;
        }
        
        .dev-chart-controls .mem-label input:checked {
            accent-color: #6dd5fa;
        }
        
        .dev-chart-controls .res-label input:checked {
            accent-color: #ffcc00;
        }

        #quelora-dev-bar.collapsed .dev-chart-container {
            display: none;
        }

        .dev-logs {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .log-tabs {
            display: flex;
            margin-bottom: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .log-tabs button {
            background: transparent;
            border: none;
            color: #aaa;
            font-size: 11px;
            font-weight: bold;
            padding: 8px 12px;
            cursor: pointer;
            transition: color 0.2s ease, background-color 0.2s ease, border-radius 0.2s ease;
            position: relative;
            outline: none;
        }
        .log-tabs button.active {
            color: white;
            background-color: rgba(255, 255, 255, 0.08);
            border-radius: 4px 4px 0 0;
        }

        .log-content-container {
            position: relative;
        }
        .log-content {
            display: none;
        }
        .log-content.active {
            display: block;
        }

        .dev-logs-list {
            max-height: 100px;
            overflow-y: auto;
            border-radius: 4px;
            background: rgba(0,0,0,0.2);
            padding: 6px;
            scrollbar-width: thin;
        }
        
        .dev-logs-list::-webkit-scrollbar {
            width: 6px;
        }

        .dev-logs-list::-webkit-scrollbar-thumb {
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
        }

        .log-entry {
            margin-bottom: 2px;
            font-size: 10px;
            line-height: 1.4;
            word-break: break-all;
        }
        .log-entry.worker {
            color: #aaffaa;
        }
        .log-entry.observer {
            color: #ffcc00;
        }
        
        #quelora-dev-bar.collapsed .dev-logs {
            display: none;
        }

        .dev-chart-grid-line {
            position: absolute;
            background-color: rgba(255, 255, 255, 0.1);
        }
        
        .dev-chart-grid-line.horizontal {
            width: 100%;
            height: 1px;
        }
        
        .dev-chart-grid-line.vertical {
            height: 100%;
            width: 1px;
        }

        .dev-chart-label {
            position: absolute;
            font-size: 9px;
            color: #ccc;
            transform: translateY(-50%);
        }
        .dev-chart-label.right {
            right: 0;
            transform: translateY(-50%) translateX(50%);
        }
        .dev-chart-label.bottom {
            bottom: -5px;
            transform: translateX(-50%);
        }
        .dev-chart-label.bottom.first {
            left: 0;
            transform: none;
        }
        .dev-chart-label.bottom.last {
            right: 0;
            left: auto;
            transform: none;
        }
        
        .dev-chart-label.right-y {
            right: -25px;
            color: #ffcc00;
            font-weight: bold;
        }

        .tooltip {
            position: absolute;
            background: rgba(45, 45, 45, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 10px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s ease, transform 0.2s ease;
            white-space: nowrap;
            z-index: 1000;
            transform: translate(-50%, -10px);
        }
        .tooltip.active {
            opacity: 1;
        }
        .tooltip-value {
            display: block;
        }
        .tooltip-mem {
            color: #6dd5fa;
            font-weight: bold;
        }
        .tooltip-res {
            color: #ffcc00;
            font-weight: bold;
        }
    `;
    document.head.appendChild(style);

    // -----------------------
    // DOM elements
    // -----------------------

    const devBar = document.createElement('div');
    devBar.id = 'quelora-dev-bar';
    devBar.innerHTML = `
        <div class="dev-header">
            <button id="dev-collapse-btn" class="dev-expand" title="Collapse">−︎</button>
        </div>
        <div class="dev-collapsed-content">
            <div class="collapsed-metrics">
                <div class="collapsed-metric">
                    <span class="collapsed-label" id="collapsed-visible-icon">💬</span>
                    <span class="collapsed-value" id="collapsed-visible-count">0</span>
                </div>
                <div class="collapsed-metric">
                    <span class="collapsed-label" id="collapsed-hidden-icon">👻</span>
                    <span class="collapsed-value" id="collapsed-hidden-count">0</span>
                </div>
                <div class="collapsed-metric">
                    <span class="collapsed-label" id="collapsed-dehydrated-icon">💧</span>
                    <span class="collapsed-value" id="collapsed-dehydrated-count">0</span>
                </div>
            </div>
            <button id="dev-expand-btn" class="dev-expand" title="Expand">+</button>
        </div>
        <div class="dev-content">
            <fieldset class="metrics-fieldset">
                <legend>Comments</legend>
                <div class="metrics-grid cols-4">
                    <div class="metric">
                        <span class="metric-label">Visible</span>
                        <span class="metric-value" id="dev-visible-count">0</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Hidden</span>
                        <span class="metric-value" id="dev-hidden-count">0</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Dehydrated</span>
                        <span class="metric-value" id="dev-dehydrated-count">0</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">In Memory</span>
                        <span class="metric-value" id="dev-memory-count">0</span>
                    </div>
                </div>
            </fieldset>

            <div class="metrics-row">
                <fieldset class="metrics-fieldset flex-20" id="posts-fieldset">
                    <legend>Posts</legend>
                    <div class="metric">
                        <span class="metric-label">Posts Count</span>
                        <span class="metric-value" id="dev-posts-count">0</span>
                    </div>
                </fieldset>
                
                <fieldset class="metrics-fieldset flex-70" id="observers-fieldset">
                    <legend>Observers</legend>
                    <div class="metrics-flex-row">
                        <div class="metric">
                            <span class="metric-label">Mutation</span>
                            <span class="metric-value" id="dev-observers-mutation-count">0</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Intersection</span>
                            <span class="metric-value" id="dev-observers-intersection-count">0</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Resize</span>
                            <span class="metric-value" id="dev-observers-resize-count">0</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Observed</span>
                            <span class="metric-value" id="dev-observers-elements-count">0</span>
                        </div>
                    </div>
                </fieldset>
            </div>

            <fieldset class="metrics-fieldset">
                <legend>System</legend>
                <div class="metrics-grid cols-5">
                    <div class="metric">
                        <span class="metric-label">API Calls</span>
                        <span class="metric-value" id="dev-worker-calls">0</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Used Heap</span>
                        <span class="metric-value heap-value" id="dev-used-heap">0 MB</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Max Heap</span>
                        <span class="metric-value heap-value" id="dev-max-heap">0 MB</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Avg. Latency</span>
                        <span class="metric-value" id="dev-worker-avg-latency">0ms</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Avg. Res. Size</span>
                        <span class="metric-value" id="dev-worker-avg-size">0 KB</span>
                    </div>
                </div>
            </fieldset>
            
            <div class="dev-chart-container">
                <div class="dev-chart-controls">
                    <label class="mem-label"><input type="checkbox" id="mem-toggle" checked>Memory</label>
                    <label class="res-label"><input type="checkbox" id="res-toggle" checked>Response Size</label>
                </div>
                <canvas id="dev-memory-chart" width="300" height="60"></canvas>
                <span class="dev-chart-label" id="chart-max-label" style="top: -10px; left: 0;">0 MB</span>
                <span class="dev-chart-label" id="chart-min-label" style="bottom: 0; left: 0;">0 MB</span>
                <span class="dev-chart-label right-y" id="chart-max-res-label" style="top: -10px; right: 0;">0 KB</span>
                <div id="dev-tooltip" class="tooltip"></div>
            </div>
            <div class="dev-logs">
                <div class="log-tabs">
                    <button id="worker-log-tab" class="active">Worker Logs</button>
                    <button id="observer-log-tab">Observer Logs</button>
                </div>
                <div class="log-content-container">
                    <div id="worker-log-content" class="log-content active">
                        <div class="dev-logs-list" id="worker-logs-list"></div>
                    </div>
                    <div id="observer-log-content" class="log-content">
                        <div class="dev-logs-list" id="observer-logs-list"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.prepend(devBar);

    // -----------------------
    // State & Persistence
    // -----------------------
    const POS_KEY = 'quelora-dev-bar-position';
    const COLLAPSED_KEY = 'quelora-dev-bar-collapsed';

    let workerStats = {
        calls: 0,
        latencies: [],
        responseSizes: [],
        postsCreated: 0
    };
    let memoryChart;
    let memoryHistory = [];
    let responseSizeHistory = [];
    let maxHeapSize = 0;
    let maxResponseSize = 0;
    const MAX_CHART_POINTS = 50;

    const collapseBtn = document.getElementById('dev-collapse-btn');
    const expandBtn = document.getElementById('dev-expand-btn');
    const chartCanvas = document.getElementById('dev-memory-chart');
    const tooltip = document.getElementById('dev-tooltip');
    const memToggle = document.getElementById('mem-toggle');
    const resToggle = document.getElementById('res-toggle');
    const observersFieldset = document.getElementById('observers-fieldset');

    // -----------------------
    // Helpers: Position & Collapse
    // -----------------------
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function setInitialPosition() {
        const saved = localStorage.getItem(POS_KEY);
        if (saved) {
            try {
                const { x, y } = JSON.parse(saved);
                if (typeof x === 'number' && typeof y === 'number') {
                    devBar.style.left = x + 'px';
                    devBar.style.top = y + 'px';
                }
            } catch (err) { }
        }
        updatePositionConstraints(false);
    }

    function updatePositionConstraints(save = true) {
        const maxX = Math.max(0, window.innerWidth - devBar.offsetWidth);
        const maxY = Math.max(0, window.innerHeight - devBar.offsetHeight);
        let currentX = parseFloat(devBar.style.left) || devBar.offsetLeft;
        let currentY = parseFloat(devBar.style.top) || devBar.offsetTop;
        currentX = clamp(currentX, 0, maxX);
        currentY = clamp(currentY, 0, maxY);
        devBar.style.left = currentX + 'px';
        devBar.style.top = currentY + 'px';
        if (save) localStorage.setItem(POS_KEY, JSON.stringify({ x: currentX, y: currentY }));
    }

    function initCollapsedFromStorage() {
        const saved = localStorage.getItem(COLLAPSED_KEY);
        const isCollapsed = saved === 'true';
        if (isCollapsed) {
            devBar.classList.add('collapsed');
        } else {
            devBar.classList.remove('collapsed');
        }
        updatePositionConstraints(true);
    }

    // -----------------------
    // Metrics helpers & updates
    // -----------------------
    function updateMetric(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = value;
    }

    function addLog(type, message) {
        const logList = document.getElementById(`${type}-logs-list`);
        if (!logList) return;
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logList.prepend(entry);
        if (logList.children.length > 20) {
            logList.removeChild(logList.lastChild);
        }
    }
    
    function logObserverMutations(mutations) {
        let childListChanges = 0;
        let attributeChanges = 0;
        let otherChanges = 0;

        mutations.forEach(mutation => {
            switch (mutation.type) {
                case 'childList':
                    childListChanges += mutation.addedNodes.length + mutation.removedNodes.length;
                    break;
                case 'attributes':
                    attributeChanges++;
                    break;
                default:
                    otherChanges++;
                    break;
            }
        });

        let message = `Observer triggered: Total changes: ${mutations.length}`;
        if (childListChanges > 0) message += `, DOM nodes: ${childListChanges}`;
        if (attributeChanges > 0) message += `, Attributes: ${attributeChanges}`;
        if (otherChanges > 0) message += `, Other: ${otherChanges}`;
        
        addLog('observer', message);
    }

    function initChart() {
        const ctx = chartCanvas.getContext('2d');
        const dpr = 1; //window.devicePixelRatio || 1;
        chartCanvas.width = 330 * dpr;
        chartCanvas.height = 60 * dpr;
        ctx.scale(dpr, dpr);

        const memoryGradient = ctx.createLinearGradient(0, 0, 0, 60);
        memoryGradient.addColorStop(0, '#6dd5fa');
        memoryGradient.addColorStop(1, 'rgba(41, 128, 185, 0)');

        const responseGradient = ctx.createLinearGradient(0, 0, 0, 60);
        responseGradient.addColorStop(0, '#ffcc00');
        responseGradient.addColorStop(1, 'rgba(243, 156, 18, 0)');

        memoryChart = {
            ctx: ctx,
            data: {
                memory: [],
                responseSizes: []
            },
            draw: function() {
                const { ctx, data } = this;
                const width = chartCanvas.width / dpr;
                const height = chartCanvas.height / dpr;
                const paddedHeight = height - 10;
                const startX = width - (data.memory.length * (width / MAX_CHART_POINTS));
                
                ctx.clearRect(0, 0, width, height);
                
                const maxMemVal = Math.max(
                    maxHeapSize,
                    data.memory.length > 0 ? Math.max(...data.memory) : 0,
                    1
                );
                
                const maxResVal = Math.max(
                    maxResponseSize,
                    data.responseSizes.length > 0 ? Math.max(...data.responseSizes) : 0,
                    1
                );
                
                const scaleFactor = paddedHeight / maxMemVal;
                const scaleResFactor = paddedHeight / maxResVal;
                
                // Draw grid lines
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                for (let i = 1; i < 4; i++) {
                    const y = height * i / 4;
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                }
                ctx.stroke();

                // Draw memory area and line
                if (memToggle.checked) {
                    ctx.beginPath();
                    ctx.moveTo(startX, height);
                    data.memory.forEach((val, i) => {
                        const x = startX + i * (width / MAX_CHART_POINTS);
                        const y = height - (val * scaleFactor);
                        ctx.lineTo(x, y);
                    });
                    ctx.lineTo(width, height);
                    ctx.closePath();
                    ctx.fillStyle = memoryGradient;
                    ctx.fill();

                    ctx.beginPath();
                    ctx.moveTo(startX, height - (data.memory[0] * scaleFactor));
                    data.memory.forEach((val, i) => {
                        const x = startX + i * (width / MAX_CHART_POINTS);
                        const y = height - (val * scaleFactor);
                        ctx.lineTo(x, y);
                    });
                    ctx.shadowColor = 'rgba(109, 213, 250, 0.5)';
                    ctx.shadowBlur = 10;
                    ctx.lineWidth = 1.5;
                    ctx.strokeStyle = '#6dd5fa';
                    ctx.stroke();
                    ctx.shadowBlur = 0; // Reset shadow
                }


                // Draw response size area and line
                if (resToggle.checked) {
                    ctx.beginPath();
                    ctx.moveTo(startX, height);
                    data.responseSizes.forEach((val, i) => {
                        const x = startX + i * (width / MAX_CHART_POINTS);
                        const y = height - (val * scaleResFactor);
                        ctx.lineTo(x, y);
                    });
                    ctx.lineTo(width, height);
                    ctx.closePath();
                    ctx.fillStyle = responseGradient;
                    ctx.fill();

                    ctx.beginPath();
                    ctx.moveTo(startX, height - (data.responseSizes[0] * scaleResFactor));
                    data.responseSizes.forEach((val, i) => {
                        const x = startX + i * (width / MAX_CHART_POINTS);
                        const y = height - (val * scaleResFactor);
                        ctx.lineTo(x, y);
                    });
                    ctx.shadowColor = 'rgba(255, 204, 0, 0.5)';
                    ctx.shadowBlur = 10;
                    ctx.lineWidth = 1.5;
                    ctx.strokeStyle = '#ffcc00';
                    ctx.stroke();
                    ctx.shadowBlur = 0; // Reset shadow
                }

                // Update labels
                document.getElementById('chart-max-label').textContent = `${maxMemVal.toFixed(1)} MB`;
                document.getElementById('chart-min-label').textContent = `0 MB`;
                document.getElementById('chart-max-res-label').textContent = `${maxResVal.toFixed(1)} KB`;
            }
        };

        // Tooltip logic
        chartCanvas.addEventListener('mousemove', (e) => {
            const rect = chartCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const width = chartCanvas.width / dpr;
            const index = Math.floor((x / width) * memoryHistory.length);

            if (index >= 0 && index < memoryHistory.length) {
                const memVal = memoryHistory[index];
                const resVal = responseSizeHistory[index];

                if (memVal !== undefined && resVal !== undefined) {
                    tooltip.innerHTML = `<span class="tooltip-value tooltip-mem">Mem: ${memVal.toFixed(2)} MB</span><span class="tooltip-value tooltip-res">Res: ${resVal.toFixed(2)} KB</span>`;
                    tooltip.style.left = `${x}px`;
                    tooltip.style.top = `${y}px`;
                    tooltip.classList.add('active');
                } else {
                    tooltip.classList.remove('active');
                }
            }
        });

        chartCanvas.addEventListener('mouseleave', () => {
            tooltip.classList.remove('active');
        });
        
        memToggle.addEventListener('change', () => {
            if (memoryChart) {
                memoryChart.draw();
            }
        });
        resToggle.addEventListener('change', () => {
            if (memoryChart) {
                memoryChart.draw();
            }
        });
    }

    function updateMetrics(fromObserver = false, mutations = null) {
        const threadsContainer = document.querySelector('.community-threads');
        if (threadsContainer) {
            const visibleComments = threadsContainer.querySelectorAll('.community-thread[data-comment-visible="true"]').length;
            const hiddenComments = threadsContainer.querySelectorAll('.community-thread[data-comment-visible="false"]:not([data-comment-dehydrated])').length;
            const dehydratedComments = threadsContainer.querySelectorAll('.community-thread[data-comment-dehydrated]').length;
            const memoryCount = visibleComments + hiddenComments;
            
            // Calculate post count based on EntityModule config
            let postsCount = 0;
            const entityConfig = EntityModule.getConfig();
            if (entityConfig && entityConfig.selector) {
                const allPosts = document.querySelectorAll(entityConfig.selector);
                const observedPosts = Array.from(allPosts).filter(post => post.querySelector('.community-interaction-bar'));
                postsCount = observedPosts.length;
            }

            // Actualiza los contadores en la barra expandida
            updateMetric('dev-visible-count', visibleComments);
            updateMetric('dev-hidden-count', hiddenComments);
            updateMetric('dev-dehydrated-count', dehydratedComments);
            updateMetric('dev-memory-count', memoryCount);
            updateMetric('dev-posts-count', postsCount);

            // Actualiza los contadores en la barra colapsada
            updateMetric('collapsed-visible-count', visibleComments);
            updateMetric('collapsed-hidden-count', hiddenComments);
            updateMetric('collapsed-dehydrated-count', dehydratedComments);
        }

        if (UtilsModule && UtilsModule.getRegisteredObservers) {
            const registeredObservers = UtilsModule.getRegisteredObservers();
            let mutationCount = 0;
            let intersectionCount = 0;
            let resizeCount = 0;
            
            // Usa un Set para contar elementos únicos observados
            const observedElements = new Set();

            registeredObservers.forEach(observer => {
                switch (observer.type) {
                    case 'mutation':
                        mutationCount++;
                        break;
                    case 'intersection':
                        intersectionCount++;
                        break;
                    case 'resize':
                        resizeCount++;
                        break;
                }
                if (observer.element) {
                    observedElements.add(observer.element);
                }
            });
            
            updateMetric('dev-observers-mutation-count', mutationCount);
            updateMetric('dev-observers-intersection-count', intersectionCount);
            updateMetric('dev-observers-resize-count', resizeCount);
            updateMetric('dev-observers-elements-count', observedElements.size);
            
            // Indicador visual de actividad
            if (fromObserver) {
                observersFieldset.classList.add('active-fieldset');
                setTimeout(() => {
                    observersFieldset.classList.remove('active-fieldset');
                }, 500); // El color se mantiene por 0.5 segundos
            }
        }
        
        if (mutations && mutations.length > 0) {
            logObserverMutations(mutations);
        }

        if (window.performance && window.performance.memory) {
            const memory = window.performance.memory;
            const usedMB = (memory.usedJSHeapSize / 1048576).toFixed(2);
            
            maxHeapSize = Math.max(maxHeapSize, parseFloat(usedMB));

            updateMetric('dev-used-heap', `${usedMB} MB`);
            updateMetric('dev-max-heap', `${maxHeapSize.toFixed(2)} MB`);
            
            memoryHistory.push(parseFloat(usedMB));
            if (memoryHistory.length > MAX_CHART_POINTS) {
                memoryHistory.shift();
            }
        }
        
        const avgLatency = workerStats.latencies.length ? (workerStats.latencies.reduce((a, b) => a + b) / workerStats.latencies.length).toFixed(2) : '0';
        const avgSize = workerStats.responseSizes.length ? (workerStats.responseSizes.reduce((a, b) => a + b) / workerStats.responseSizes.length).toFixed(2) : '0';

        maxResponseSize = Math.max(maxResponseSize, parseFloat(avgSize));
        responseSizeHistory.push(parseFloat(avgSize));
        if (responseSizeHistory.length > 50) {
            responseSizeHistory.shift();
        }

        // CORRECCIÓN: Las métricas de Worker se actualizan aquí
        updateMetric('dev-worker-calls', workerStats.calls);
        updateMetric('dev-worker-avg-latency', `${avgLatency}ms`);
        updateMetric('dev-worker-avg-size', `${avgSize} KB`);

        if (memoryChart) {
            memoryChart.data.memory = memoryHistory;
            memoryChart.data.responseSizes = responseSizeHistory;
            memoryChart.draw();
        }
    }
    
    // -----------------------
    // Observers & Events
    // -----------------------
    function setupListeners() {
        const threadsContainer = document.querySelector('.community-threads');
        if (!threadsContainer) {
            setTimeout(setupListeners, 800);
            return;
        }
        
        const observer = new MutationObserver((mutations) => updateMetrics(true, mutations));
        observer.observe(threadsContainer, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-comment-visible', 'data-comment-dehydrated']
        });
        
        // Listen for worker messages to update API stats
        const originalPostMessage = window.Worker.prototype.postMessage;
        window.Worker.prototype.postMessage = function(message, transfer) {
            const startTime = performance.now();
            this.addEventListener('message', function onMessage(event) {
                if (event.data && event.data.originalPayload && event.data.originalPayload.id === message.payload.id) {
                    const latency = performance.now() - startTime;
                    workerStats.calls++;
                    workerStats.latencies.push(latency);
                    if (workerStats.latencies.length > 50) {
                        workerStats.latencies.shift();
                    }

                    const responseData = event.data;
                    const jsonString = JSON.stringify(responseData);
                    const sizeInBytes = new TextEncoder().encode(jsonString).length;
                    const sizeInKB = (sizeInBytes / 1024);
                    workerStats.responseSizes.push(sizeInKB);
                    if (workerStats.responseSizes.length > 50) {
                        workerStats.responseSizes.shift();
                    }
                    
                    addLog('worker', `Action: ${message.action} took ${latency.toFixed(2)}ms, Size: ${sizeInKB.toFixed(2)} KB`);

                    if (message.action === 'createPost') {
                        workerStats.postsCreated++;
                    }

                    updateMetrics();
                    this.removeEventListener('message', onMessage);
                }
            });
            originalPostMessage.call(this, message, transfer);
        };
        
        const workerTab = document.getElementById('worker-log-tab');
        const observerTab = document.getElementById('observer-log-tab');
        const workerContent = document.getElementById('worker-log-content');
        const observerContent = document.getElementById('observer-log-content');
        
        function switchTab(activeTab, activeContent) {
            [workerTab, observerTab].forEach(tab => tab.classList.remove('active'));
            [workerContent, observerContent].forEach(content => content.classList.remove('active'));
            activeTab.classList.add('active');
            activeContent.classList.add('active');
        }

        workerTab.addEventListener('click', () => switchTab(workerTab, workerContent));
        observerTab.addEventListener('click', () => switchTab(observerTab, observerContent));

        updateMetrics();
        initChart();
        updateIntervalId = setInterval(updateMetrics, 1500);
    }
    
    // -----------------------
    // Drag & Drop
    // -----------------------
    const DRAG_THRESHOLD = 6;
    let pointerId = null;
    let startClientX = 0;
    let startClientY = 0;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let currentlyDragging = false;
    let suppressClick = false;

    if (collapseBtn) {
        collapseBtn.addEventListener('click', (e) => {
            devBar.classList.add('collapsed');
            localStorage.setItem(COLLAPSED_KEY, 'true');
            setTimeout(() => updatePositionConstraints(true), 40);
        });
    }

    if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
            devBar.classList.remove('collapsed');
            localStorage.setItem(COLLAPSED_KEY, 'false');
            setTimeout(() => updatePositionConstraints(true), 40);
        });
    }

    function startTracking(clientX, clientY) {
        const styleLeft = parseFloat(devBar.style.left) || devBar.offsetLeft;
        const styleTop = parseFloat(devBar.style.top) || devBar.offsetTop;
        startClientX = clientX;
        startClientY = clientY;
        dragOffsetX = clientX - styleLeft;
        dragOffsetY = clientY - styleTop;
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
            } else {
                return;
            }
        }
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
    }

    devBar.addEventListener('pointerdown', (e) => {
        // Ignora el evento si el objetivo es uno de los botones de control
        if (e.target.closest('#dev-collapse-btn, #dev-expand-btn, .log-tabs button')) {
            return;
        }

        // Ignora el botón derecho del mouse
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        pointerId = e.pointerId;
        startTracking(e.clientX, e.clientY);

        // Se captura el puntero para seguir el movimiento fuera del elemento
        try { devBar.setPointerCapture(pointerId); } catch (err) {}

        const moveListener = (ev) => {
            if (ev.pointerId === pointerId) {
                pointerMoveHandler(ev.clientX, ev.clientY);
            }
        };

        const upListener = (ev) => {
            if (ev.pointerId === pointerId) {
                endTracking();
                document.removeEventListener('pointermove', moveListener);
                document.removeEventListener('pointerup', upListener);
                try { devBar.releasePointerCapture(pointerId); } catch (err) {}
            }
        };

        // Escucha los eventos de movimiento y liberación en el documento
        document.addEventListener('pointermove', moveListener);
        document.addEventListener('pointerup', upListener);
    });

    window.addEventListener('resize', () => updatePositionConstraints(true));

    function init() {
        setInitialPosition();
        initCollapsedFromStorage();
        setupListeners();
    }
    
    // Check if the DOM is ready to prevent errors
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();