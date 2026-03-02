/**
 * Workshop Town - Main Application
 *
 * Agent movement state machine, Supabase polling, event log, render loop.
 * Agents walk between their buildings and the dispatch center when tasks arrive.
 */

const POLL_INTERVAL = 3000;
const HEALTH_INTERVAL = 5000;
const ACQ_POLL_INTERVAL = 30000;   // acquisition data: every 30s
const CRON_POLL_INTERVAL = 60000;  // cron status: every 60s
const HEALTH_ERROR_THRESHOLD = 5;
const FETCH_TIMEOUT = 10000;

// Estimated minutes a human (average IQ) would need per task, by agent role
const HUMAN_MINUTES_PER_TASK = {
    foreman:    25,   // task decomposition, orchestration, synthesis
    ledger:     20,   // financial data lookups, metric queries
    scout:      30,   // web research, data gathering
    scribe:     45,   // report writing, content generation
    advisor:    35,   // strategic analysis, recommendations
    watchtower: 15,   // monitoring, alerts, status checks
    overseer:   30,   // meta-analysis, prompt updates, tool creation
};

// ═══════════════════════════════════════════════════════
//  AGENT VISUALIZATION STATE
// ═══════════════════════════════════════════════════════

// Visual states for each agent (independent from API state)
// idle -> walk_dispatch -> picking_up -> walk_home -> working -> celebrating -> idle
const VIZ_STATES = {
    IDLE: 'idle',
    WALK_DISPATCH: 'walk_dispatch',
    PICKING_UP: 'picking_up',
    WALK_HOME: 'walk_home',
    WORKING: 'working',
    CELEBRATING: 'celebrating',
    STALLED: 'stalled',
    OFFLINE: 'offline',
};

function createAgentViz(agentKey, initialStatus) {
    const home = HOME_POS[agentKey];
    if (!home) return null;  // Unknown agent key - skip safely
    // If agent is already working on load, place them at their station working
    const isWorking = initialStatus === 'working';
    const viz = {
        vizState: isWorking ? VIZ_STATES.WORKING : VIZ_STATES.IDLE,
        apiStatus: initialStatus || 'idle',
        position: { x: home.x, y: home.y },
        homeX: home.x,
        homeY: home.y,
        path: [],
        pathIndex: 0,
        direction: 'down',
        walkTimer: 0,
        hasScroll: false,
        pickupTimer: 0,
        celebrateTimer: 0,
    };
    // Overseer starts patrolling immediately (he's a traveling consultant)
    if (agentKey === 'overseer' && !isWorking) {
        startOverseerPatrol(viz, 0);
    }
    return viz;
}

// All agent viz states
const agentViz = {};

// Initialize with idle defaults (will be updated on first poll)
for (const key of AGENT_ORDER) {
    agentViz[key] = createAgentViz(key, 'idle');
}

// ═══════════════════════════════════════════════════════
//  MOVEMENT & STATE MACHINE
// ═══════════════════════════════════════════════════════

function setPath(viz, waypoints) {
    viz.path = waypoints.map(p => ({ ...p }));
    viz.pathIndex = 0;
    viz.walkTimer = 0;
}

// ─── Overseer Patrol (continuous walking loop) ───────
function startOverseerPatrol(viz, startIndex) {
    // Build path from startIndex through full loop back to start
    const route = OVERSEER_PATROL;
    const len = route.length;
    const waypoints = [];
    for (let i = 0; i < len; i++) {
        waypoints.push({ ...route[(startIndex + i) % len] });
    }
    viz.vizState = VIZ_STATES.WALK_DISPATCH;  // reuse walking state for animation
    setPath(viz, waypoints);
}

function findNearestPatrolIndex(x, y) {
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < OVERSEER_PATROL.length; i++) {
        const p = OVERSEER_PATROL[i];
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
}

function updateAgentMovement(key) {
    const viz = agentViz[key];

    // Handle timer-based states
    if (viz.vizState === VIZ_STATES.PICKING_UP) {
        viz.pickupTimer--;
        if (viz.pickupTimer <= 0) {
            viz.hasScroll = true;
            viz.vizState = VIZ_STATES.WALK_HOME;
            // Reverse path: dispatch -> home
            const pathData = AGENT_PATHS[key] || [];
            const homePath = pathData.slice().reverse().map(p => ({ ...p }));
            homePath.push({ x: viz.homeX, y: viz.homeY });
            setPath(viz, homePath);
        }
        return;
    }

    if (viz.vizState === VIZ_STATES.CELEBRATING) {
        viz.celebrateTimer--;
        if (viz.celebrateTimer <= 0) {
            viz.hasScroll = false;
            if (key === 'overseer') {
                // Resume patrol after celebrating
                const idx = findNearestPatrolIndex(viz.position.x, viz.position.y);
                startOverseerPatrol(viz, idx);
            } else {
                viz.vizState = VIZ_STATES.IDLE;
            }
        }
        return;
    }

    // Path following
    if (viz.path.length === 0) return;

    const speed = key === 'overseer' ? OVERSEER_WALK_SPEED : WALK_SPEED;
    const target = viz.path[viz.pathIndex];
    if (!target) { viz.path = []; viz.pathIndex = 0; return; }  // Safety: index out of bounds
    const dx = target.x - viz.position.x;
    const dy = target.y - viz.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < speed) {
        // Reached waypoint
        viz.position.x = target.x;
        viz.position.y = target.y;
        viz.pathIndex++;

        if (viz.pathIndex >= viz.path.length) {
            // Path complete
            viz.path = [];
            onPathComplete(key);
        }
    } else {
        // Move toward target
        viz.position.x += (dx / dist) * speed;
        viz.position.y += (dy / dist) * speed;

        // Update facing direction
        if (Math.abs(dx) > Math.abs(dy)) {
            viz.direction = dx > 0 ? 'right' : 'left';
        } else {
            viz.direction = dy > 0 ? 'down' : 'up';
        }
    }

    viz.walkTimer++;
}

function onPathComplete(key) {
    const viz = agentViz[key];

    // Overseer: loop patrol endlessly
    if (key === 'overseer' && viz.vizState === VIZ_STATES.WALK_DISPATCH) {
        startOverseerPatrol(viz, 0);
        return;
    }

    switch (viz.vizState) {
        case VIZ_STATES.WALK_DISPATCH:
            // Arrived at dispatch, pick up the scroll
            viz.vizState = VIZ_STATES.PICKING_UP;
            viz.pickupTimer = 30;  // ~0.5 second pause
            addEvent('sling', 'Picking up task', key);
            break;

        case VIZ_STATES.WALK_HOME:
            // Arrived back at station, start working
            viz.vizState = VIZ_STATES.WORKING;
            viz.hasScroll = false;
            addEvent('activate', 'Working...', key);
            break;
    }
}

// Triggered when API state changes
function onApiStateChange(key, prevStatus, newStatus) {
    const viz = agentViz[key];
    if (!viz) return;  // Unknown agent
    viz.apiStatus = newStatus;

    if (prevStatus === 'idle' && newStatus === 'working') {
        if (key === 'overseer') {
            // Overseer stops patrolling, works at current position
            viz.vizState = VIZ_STATES.WORKING;
            viz.path = [];
            viz.hasScroll = false;
            addEvent('activate', 'Reviewing agent...', key);
        } else {
            // Agent just got work - start walking to dispatch
            const pathData = AGENT_PATHS[key];
            if (!pathData) return;  // No path defined for this agent
            viz.vizState = VIZ_STATES.WALK_DISPATCH;
            const dispatchPath = pathData.map(p => ({ ...p }));
            setPath(viz, dispatchPath);
            addEvent('sling', 'Heading to dispatch', key);
        }
    }
    else if (prevStatus === 'working' && newStatus === 'idle') {
        // Agent finished work - fireworks celebration!
        viz.vizState = VIZ_STATES.CELEBRATING;
        viz.celebrateTimer = 180;  // 3 seconds for fireworks
        viz.hasScroll = false;
        spawnCompletionBurst(viz.position.x + 8, viz.position.y + 8);
        spawnFireworks(viz.position.x + 16, viz.position.y);
        addEvent('complete', 'Task done!', key);
    }
    else if (newStatus === 'stalled') {
        viz.vizState = VIZ_STATES.STALLED;
        addEvent('warn', 'STALLED', key);
    }
    else if (newStatus === 'idle') {
        if (key === 'overseer') {
            // Overseer resumes patrol from nearest waypoint
            const idx = findNearestPatrolIndex(viz.position.x, viz.position.y);
            startOverseerPatrol(viz, idx);
        } else {
            // Reset to idle at home
            viz.vizState = VIZ_STATES.IDLE;
            viz.position.x = viz.homeX;
            viz.position.y = viz.homeY;
            viz.path = [];
            viz.hasScroll = false;
        }
    }
}

// ═══════════════════════════════════════════════════════
//  EVENT LOG
// ═══════════════════════════════════════════════════════

let eventLog = [];

function addEvent(type, message, agentKey) {
    const agent = agentKey ? AGENTS[agentKey] : null;
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });

    eventLog.unshift({
        time: timestamp,
        type,
        message,
        color: agent ? agent.color : '#888888',
        agentName: agent ? agent.name : null,
    });

    if (eventLog.length > 50) eventLog.pop();
    renderEventLog();
}

function renderEventLog() {
    const container = document.getElementById('event-list');
    if (!container) return;

    container.innerHTML = eventLog.map(ev => {
        const badge = ev.agentName
            ? `<span class="event-badge" style="color:${ev.color}">${ev.agentName}</span>`
            : '';
        return `<div class="event-item event-${ev.type}">
            <span class="event-time">${ev.time}</span>
            ${badge}
            <span class="event-msg">${ev.message}</span>
        </div>`;
    }).join('');
}

function clearEventLog() {
    eventLog = [];
    renderEventLog();
}

// ═══════════════════════════════════════════════════════
//  WORK ITEMS PANEL
// ═══════════════════════════════════════════════════════

let activeWorkItems = [];

function formatWorkTime(isoStr) {
    if (!isoStr) return '---';
    const d = new Date(isoStr);
    const mo = d.toLocaleString('en-US', { month: 'short', timeZone: 'America/Los_Angeles' });
    const day = d.toLocaleString('en-US', { day: 'numeric', timeZone: 'America/Los_Angeles' });
    const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Los_Angeles' });
    return `${mo} ${day} ${time}`;
}

function renderWorkItem(item, showAssignee) {
    const filedBy = escapeHtml(item.filed_by || '---');
    const addedAt = formatWorkTime(item.created_at);
    const safeStatus = escapeHtml(item.status || 'unknown');
    let html = `<div class="work-item status-${safeStatus}">
        <span class="work-status">${safeStatus.toUpperCase()}</span>
        <span class="work-title">${truncate(item.title, 28)}</span>
        <span class="work-filed-by">${filedBy}</span>
        <span class="work-time">${addedAt}</span>`;
    if (showAssignee) {
        html += `<span class="work-assignee">${escapeHtml(item.assignee || '---')}</span>`;
    }
    html += '</div>';
    return html;
}

function renderWorkPanel(data) {
    const container = document.getElementById('work-list');
    if (!container) return;

    const active = data.work_items?.active || [];
    const queued = data.work_items?.queued || [];
    const recent = data.work_items?.recent || [];
    activeWorkItems = active.concat(queued);

    let html = '';

    if (active.length > 0) {
        html += '<div class="work-section-label">IN PROGRESS</div>';
        active.forEach(item => { html += renderWorkItem(item, true); });
    }

    if (queued.length > 0) {
        html += '<div class="work-section-label">QUEUED</div>';
        queued.forEach(item => { html += renderWorkItem(item, true); });
    }

    if (recent.length > 0) {
        html += '<div class="work-section-label">COMPLETED</div>';
        recent.slice(0, 8).forEach(item => { html += renderWorkItem(item, false); });
    }

    if (!html) html = '<div class="work-empty">No work items</div>';
    container.innerHTML = html;
}

function truncate(str, max) {
    if (!str) return '';
    const text = str.length > max ? str.substring(0, max) + '...' : str;
    return escapeHtml(text);
}

// ═══════════════════════════════════════════════════════
//  SCOREBOARD
// ═══════════════════════════════════════════════════════

function computeScoreboard(agents) {
    let totalTasks = 0;
    let totalMinutes = 0;
    const perAgent = {};

    for (const hook of agents) {
        const key = hook.agent_name;
        const count = hook.total_tasks_completed || 0;
        const mins = (HUMAN_MINUTES_PER_TASK[key] || 20) * count;
        totalTasks += count;
        totalMinutes += mins;
        perAgent[key] = { count, mins };
    }

    return { totalTasks, totalMinutes, perAgent };
}

function formatTimeSaved(minutes) {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function renderScoreboard(agents) {
    if (!agents) return;
    const sb = computeScoreboard(agents);
    const container = document.getElementById('scoreboard-stats');
    if (!container) return;

    const totalHours = (sb.totalMinutes / 60).toFixed(1);

    const rows = AGENT_ORDER.map(key => {
        const agent = AGENTS[key];
        const data = sb.perAgent[key] || { count: 0, mins: 0 };
        return `<div class="sb-row">
            <span class="sb-agent" style="color:${agent.color}">${agent.name.toUpperCase()}</span>
            <span class="sb-count">${data.count}</span>
            <span class="sb-time">${formatTimeSaved(data.mins)}</span>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="sb-totals">
            <div class="sb-total-box">
                <div class="sb-total-val">${sb.totalTasks}</div>
                <div class="sb-total-label">TASKS SOLVED</div>
            </div>
            <div class="sb-total-box">
                <div class="sb-total-val">${totalHours}h</div>
                <div class="sb-total-label">TIME SAVED</div>
            </div>
        </div>
        <div class="sb-divider"></div>
        ${rows}
    `;

    // Update compact header stat
    const headerStats = document.getElementById('header-stats');
    if (headerStats) {
        headerStats.textContent = `${sb.totalTasks} SOLVED / ${totalHours}h SAVED`;
    }
}

// ═══════════════════════════════════════════════════════
//  CONTROL CENTER
// ═══════════════════════════════════════════════════════

function getAgentLightClass(apiStatus, lastHeartbeat) {
    if (apiStatus === 'offline') return 'light-red';
    if (apiStatus === 'stalled') return 'light-amber';
    if (lastHeartbeat) {
        const ageMs = Date.now() - new Date(lastHeartbeat).getTime();
        if (ageMs > 60000) return 'light-amber';
    }
    return 'light-green';
}

let expandedAgent = null;

function renderControlCenter() {
    const container = document.getElementById('agent-status-list');
    if (!container) return;

    const statusLabels = { idle: 'IDLE', working: 'WORKING', stalled: 'STALLED', offline: 'OFFLINE' };
    let html = '';

    AGENT_ORDER.forEach((key, idx) => {
        const agent = AGENTS[key];
        const apiData = previousApiStates[key];
        const apiStatus = apiData?.status || 'offline';
        const lastHeartbeat = apiData?.last_heartbeat || null;
        const tasksCompleted = apiData?.total_tasks_completed || 0;
        const lightClass = getAgentLightClass(apiStatus, lastHeartbeat);
        const statusLabel = statusLabels[apiStatus] || apiStatus.toUpperCase();
        const isExpanded = expandedAgent === key;

        html += `<div class="cc-agent-row cc-status-${apiStatus}" data-agent="${key}">
            <div class="cc-agent-header">
                <div class="cc-status-light ${lightClass}"></div>
                <span class="cc-agent-name" style="color:${agent.color}">${agent.name.toUpperCase()}</span>
            </div>
            <div class="cc-agent-detail">${statusLabel} / ${tasksCompleted} DONE</div>
            ${isExpanded ? `<div class="cc-agent-desc">
                <div class="cc-agent-title">${agent.title} (${agent.model})</div>
                <div class="cc-agent-desc-text">${agent.desc}</div>
            </div>` : ''}
        </div>`;
        if (idx < AGENT_ORDER.length - 1) html += '<div class="cc-divider"></div>';
    });

    container.innerHTML = html;

    const activeCount = AGENT_ORDER.filter(key => {
        const s = previousApiStates[key]?.status;
        return s === 'idle' || s === 'working';
    }).length;
    const footerEl = document.getElementById('cc-footer-text');
    if (footerEl) footerEl.textContent = `${activeCount}/${AGENT_ORDER.length} ONLINE`;
}

// ═══════════════════════════════════════════════════════
//  TODO LIST (localStorage)
// ═══════════════════════════════════════════════════════

const TODO_STORAGE_KEY = 'workshoptown_todos';
let todos = [];
let selectedUrgency = 'low';

function todosLoad() {
    try { return JSON.parse(localStorage.getItem(TODO_STORAGE_KEY)) || []; }
    catch (e) { return []; }
}

function todosSave() {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
}

function todoAdd(text, urgency) {
    text = text.trim();
    if (!text) return;
    todos.unshift({
        id: String(Date.now()),
        text,
        urgency: urgency || 'low',
        done: false,
        createdAt: new Date().toISOString(),
    });
    todosSave();
    renderTodoList();
}

function todoToggleDone(id) {
    const item = todos.find(t => t.id === id);
    if (!item) return;
    item.done = !item.done;
    todosSave();
    renderTodoList();
}

function todoDelete(id) {
    todos = todos.filter(t => t.id !== id);
    todosSave();
    renderTodoList();
}

const URGENCY_ORDER = { high: 0, med: 1, low: 2 };

function todosSorted() {
    const undone = todos
        .filter(t => !t.done)
        .sort((a, b) => (URGENCY_ORDER[a.urgency] ?? 2) - (URGENCY_ORDER[b.urgency] ?? 2));
    const done = todos.filter(t => t.done);
    return [...undone, ...done];
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderTodoList() {
    const container = document.getElementById('todo-list');
    if (!container) return;

    const sorted = todosSorted();
    if (sorted.length === 0) {
        container.innerHTML = '<div class="work-empty">NO TASKS</div>';
        return;
    }

    container.innerHTML = sorted.map(item => {
        const doneClass = item.done ? 'todo-done' : '';
        const displayText = item.text.length > 50 ? item.text.slice(0, 50) + '...' : item.text;
        return `<div class="todo-item todo-urgency-${item.urgency} ${doneClass}" data-id="${item.id}">
            <button class="todo-check" data-action="toggle" data-id="${item.id}">${item.done ? 'X' : ''}</button>
            <div class="todo-urgency-pip todo-urgency-${item.urgency}"></div>
            <span class="todo-text" title="${escapeHtml(item.text)}">${escapeHtml(displayText)}</span>
            <button class="todo-del" data-action="delete" data-id="${item.id}">X</button>
        </div>`;
    }).join('');
}

// ═══════════════════════════════════════════════════════
//  ACQUISITION DASHBOARD
// ═══════════════════════════════════════════════════════

function fmtDollar(v) {
    if (v == null) return '--';
    return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDecimal(v, dec) {
    if (v == null) return '--';
    return Number(v).toLocaleString('en-US', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
}

function fmtPct(v) {
    if (v == null) return '--';
    return Number(v).toFixed(2) + '%';
}

function acqTrendClass(yest, avg, lowerIsBetter) {
    if (yest == null || avg == null) return 'acq-val-neutral';
    if (lowerIsBetter) {
        return yest < avg ? 'acq-val-up' : yest > avg ? 'acq-val-down' : 'acq-val-neutral';
    }
    return yest > avg ? 'acq-val-up' : yest < avg ? 'acq-val-down' : 'acq-val-neutral';
}

function renderAcquisition(data) {
    const container = document.getElementById('acquisition-data');
    const dot = document.getElementById('acq-status');
    if (!container) return;

    if (data.error) {
        container.innerHTML = '<div class="work-empty">NO CONNECTION</div>';
        return;
    }

    const yd = data.yesterday || {};
    const avg = data.trailing_7d_avg || {};
    const meta = yd.meta;
    const metaAvg = avg.meta;
    const shop = yd.shopify;
    const shopAvg = avg.shopify;

    // Status dot: green if yesterday has data, amber if stale
    if (dot) {
        if (meta || shop) {
            dot.className = 'acq-status-dot acq-live';
        } else {
            dot.className = 'acq-status-dot acq-stale';
        }
    }

    const na = '<span class="acq-val-na">--</span>';

    function cell(val, avgVal, fmt, lowerIsBetter) {
        const yStr = val != null ? fmt(val) : na;
        const aStr = avgVal != null ? fmt(avgVal) : na;
        const cls = acqTrendClass(val, avgVal, lowerIsBetter);
        return `<td class="${cls}">${yStr}</td><td>${aStr}</td>`;
    }

    let html = '';

    // META ADS
    html += '<div class="acq-source-label acq-meta">META ADS</div>';
    html += '<table class="acq-table">';
    html += '<tr><th></th><th>YEST</th><th>7D AVG</th></tr>';
    html += '<tr><td>Spend</td>' + cell(meta?.spend, metaAvg?.spend, fmtDollar, true) + '</tr>';
    html += '<tr><td>CPA</td>' + cell(meta?.cpa, metaAvg?.cpa, fmtDollar, true) + '</tr>';
    html += '<tr><td>Purchases</td>' + cell(meta?.conversions, metaAvg?.conversions, v => fmtDecimal(v, 1), false) + '</tr>';
    html += '<tr><td>CTR</td>' + cell(meta?.ctr, metaAvg?.ctr, fmtPct, false) + '</tr>';
    html += '<tr><td>CPM</td>' + cell(meta?.cpm, metaAvg?.cpm, fmtDollar, true) + '</tr>';
    html += '</table>';

    // SHOPIFY DTC
    html += '<div class="acq-source-label acq-shopify">SHOPIFY DTC</div>';
    html += '<table class="acq-table">';
    html += '<tr><th></th><th>YEST</th><th>7D AVG</th></tr>';
    html += '<tr><td>Revenue</td>' + cell(shop?.total_sales, shopAvg?.total_sales, fmtDollar, false) + '</tr>';
    html += '<tr><td>Orders</td>' + cell(shop?.orders, shopAvg?.orders, v => fmtDecimal(v, 1), false) + '</tr>';
    html += '<tr><td>AOV</td>' + cell(shop?.aov, shopAvg?.aov, fmtDollar, false) + '</tr>';
    html += '<tr><td>Net Sales</td>' + cell(shop?.net_sales, shopAvg?.net_sales, fmtDollar, false) + '</tr>';
    html += '</table>';

    // STAN'S CORNER (inline below Shopify DTC)
    const sc = data.stans_corner;
    if (sc) {
        const syd = sc.yesterday || {};
        const st7 = sc.trailing_7d || {};

        function scClass(val, thresholds, lowerIsBetter) {
            if (val == null) return 'sc-na';
            if (lowerIsBetter) {
                return val <= thresholds[0] ? 'sc-good' : val <= thresholds[1] ? 'sc-warn' : 'sc-bad';
            }
            return val >= thresholds[0] ? 'sc-good' : val >= thresholds[1] ? 'sc-warn' : 'sc-bad';
        }

        html += '<div class="acq-source-label acq-stan">STAN\'S CORNER</div>';
        html += '<div class="sc-row"><span class="sc-label"></span><div class="sc-vals">';
        html += '<span class="sc-val-header">YEST</span><span class="sc-val-header">7D TOT</span></div></div>';

        const ncY = syd.new_customers, ncT = st7.new_customers;
        html += `<div class="sc-row"><span class="sc-label">New Customers</span><div class="sc-vals">`;
        html += `<span class="sc-val ${scClass(ncY, [15, 8], false)}">${ncY != null ? ncY : '--'}</span>`;
        html += `<span class="sc-val ${scClass(ncT, [100, 50], false)}">${ncT != null ? ncT : '--'}</span></div></div>`;

        const cacY = syd.bcac, cacT = st7.bcac;
        html += `<div class="sc-row"><span class="sc-label">NC bCAC</span><div class="sc-vals">`;
        html += `<span class="sc-val ${scClass(cacY, [45, 65], true)}">${cacY != null ? '$' + cacY.toFixed(0) : '--'}</span>`;
        html += `<span class="sc-val ${scClass(cacT, [45, 65], true)}">${cacT != null ? '$' + cacT.toFixed(0) : '--'}</span></div></div>`;

        const subY = syd.new_subscribers, subT = st7.new_subscribers;
        html += `<div class="sc-row"><span class="sc-label">New Subs</span><div class="sc-vals">`;
        html += `<span class="sc-val ${scClass(subY, [5, 2], false)}">${subY != null ? subY : '--'}</span>`;
        html += `<span class="sc-val ${scClass(subT, [35, 15], false)}">${subT != null ? subT : '--'}</span></div></div>`;
    }

    // Footer
    const dMeta = avg.days_with_data?.meta || 0;
    const dShop = avg.days_with_data?.shopify || 0;
    html += `<div class="acq-footer">${yd.date || '--'} | ${dMeta}d meta, ${dShop}d shop</div>`;

    container.innerHTML = html;
}

async function pollAcquisition() {
    try {
        const res = await fetchWithTimeout('/api/acquisition', FETCH_TIMEOUT);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        renderAcquisition(data);
    } catch (err) {
        console.warn('Acquisition poll failed:', err.message);
    }
}

// ═══════════════════════════════════════════════════════
//  RECURRING TASKS
// ═══════════════════════════════════════════════════════

function renderCronJobs(data) {
    const container = document.getElementById('cron-list');
    if (!container) return;

    const tasks = data.tasks || [];
    if (tasks.length === 0) {
        container.innerHTML = '<div class="work-empty">NO TASKS</div>';
        return;
    }

    container.innerHTML = tasks.map(t => {
        let nextLabel = '--';
        if (t.next_run) {
            const d = new Date(t.next_run);
            nextLabel = d.toLocaleString('en-US', {
                month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit',
                hour12: true, timeZone: 'America/Los_Angeles',
            });
        }
        const lastLabel = t.last_run
            ? new Date(t.last_run).toLocaleString('en-US', {
                month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit',
                hour12: true, timeZone: 'America/Los_Angeles',
            })
            : 'never';

        return `<div class="cron-item">
            <span class="cron-icon">></span>
            <div class="cron-details">
                <div class="cron-name">${escapeHtml(t.name)}</div>
                <div class="cron-schedule">${t.schedule} | last: ${lastLabel}</div>
            </div>
            <span class="cron-next">NEXT ${nextLabel}</span>
        </div>`;
    }).join('');
}

async function pollCronStatus() {
    try {
        const res = await fetchWithTimeout('/api/cron-status', FETCH_TIMEOUT);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        renderCronJobs(data);
    } catch (err) {
        console.warn('Cron status poll failed:', err.message);
    }
}

// ═══════════════════════════════════════════════════════
//  OVERSEER AUDIT LOG
// ═══════════════════════════════════════════════════════

const OVERSEER_POLL_INTERVAL = 30000;  // 30s -- low frequency

const IMPROVEMENT_TYPE_LABELS = {
    prompt_update:    'PROMPT',
    model_change:     'MODEL',
    tool_created:     'TOOL+',
    tool_assigned:    'ASSIGN',
    tool_removed:     'REMOVE',
    workflow_created: 'WORKFLOW',
    task_retry:       'RETRY',
};

const IMPROVEMENT_TYPE_COLORS = {
    prompt_update:    '#9B59B6',
    model_change:     '#E8A838',
    tool_created:     '#00CED1',
    tool_assigned:    '#3A7BD5',
    tool_removed:     '#E05555',
    workflow_created: '#4A9E4A',
    task_retry:       '#FF8844',
};

function renderOverseerLog(data) {
    const container = document.getElementById('overseer-log-list');
    const badge = document.getElementById('overseer-log-count');
    if (!container) return;

    const items = data.improvements || [];
    if (badge) badge.textContent = items.length;

    if (items.length === 0) {
        container.innerHTML = '<div class="work-empty">No changes yet</div>';
        return;
    }

    container.innerHTML = items.map(item => {
        const typeLabel = IMPROVEMENT_TYPE_LABELS[item.improvement_type] || item.improvement_type;
        const typeColor = IMPROVEMENT_TYPE_COLORS[item.improvement_type] || '#888';
        const agentColor = AGENTS[item.agent_name]?.color || '#888';
        const time = item.created_at
            ? new Date(item.created_at).toLocaleString('en-US', {
                month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit',
                hour12: true, timeZone: 'America/Los_Angeles',
            })
            : '--';
        const desc = item.description?.length > 80
            ? item.description.slice(0, 80) + '...'
            : (item.description || '');
        const rolled = item.rolled_back ? ' <span class="ov-rolled">ROLLED BACK</span>' : '';

        return `<div class="ov-item">
            <div class="ov-item-top">
                <span class="ov-type" style="color:${typeColor}">${typeLabel}</span>
                <span class="ov-agent" style="color:${agentColor}">${(item.agent_name || '').toUpperCase()}</span>
                <span class="ov-time">${time}</span>
            </div>
            <div class="ov-desc">${escapeHtml(desc)}${rolled}</div>
        </div>`;
    }).join('');
}

async function pollOverseerLog() {
    try {
        const res = await fetchWithTimeout('/api/overseer-log', FETCH_TIMEOUT);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        renderOverseerLog(data);
    } catch (err) {
        console.warn('Overseer log poll failed:', err.message);
    }
}

// ═══════════════════════════════════════════════════════
//  POLLING
// ═══════════════════════════════════════════════════════

let previousApiStates = {};
let connected = false;
let healthErrors = 0;

/**
 * Fetch with an AbortController timeout so slow responses
 * don't hang indefinitely and count as failures.
 */
function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

/**
 * Lightweight health check - hits /health (no Supabase).
 * Manages the connection indicator independently from data polling.
 */
async function checkHealth() {
    const connEl = document.getElementById('conn-status');
    try {
        const res = await fetchWithTimeout('/health', FETCH_TIMEOUT);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        healthErrors = 0;
        if (!connected) {
            connected = true;
            addEvent('system', 'Connected to Hive');
            if (connEl) { connEl.textContent = 'LIVE'; connEl.className = 'conn-live'; }
        }
    } catch (err) {
        healthErrors++;
        if (healthErrors >= HEALTH_ERROR_THRESHOLD && connected) {
            connected = false;
            const reason = err.name === 'AbortError' ? 'timeout' : (err.message || 'unknown');
            addEvent('error', `Connection lost: ${reason}`);
            if (connEl) { connEl.textContent = 'OFFLINE'; connEl.className = 'conn-offline'; }
        }
    }
}

/**
 * Data poll - fetches full state from /api/state (includes Supabase queries).
 * Failures here do NOT affect the connection indicator; health check handles that.
 */
async function pollState() {
    try {
        const res = await fetchWithTimeout('/api/state', FETCH_TIMEOUT);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Detect state changes
        if (data.agents) {
            for (const hook of data.agents) {
                const key = hook.agent_name;

                // Initialize viz if first time (skip agents we don't know about)
                if (!agentViz[key]) {
                    const viz = createAgentViz(key, hook.status);
                    if (!viz) {
                        // Unknown agent (not in HOME_POS) - track API state only
                        previousApiStates[key] = { ...hook };
                        continue;
                    }
                    agentViz[key] = viz;
                }

                const prev = previousApiStates[key];
                const prevStatus = prev?.status || 'idle';
                const newStatus = hook.status;

                // Handle transitions
                if (prev && prevStatus !== newStatus) {
                    onApiStateChange(key, prevStatus, newStatus);
                } else if (!prev && newStatus === 'working') {
                    // First load and agent is already working - show at station
                    agentViz[key].vizState = VIZ_STATES.WORKING;
                    agentViz[key].apiStatus = 'working';
                }

                previousApiStates[key] = { ...hook };
            }
        }

        renderWorkPanel(data);
        renderScoreboard(data.agents);
        renderControlCenter();

    } catch (err) {
        // Silent - data poll failures don't affect connection indicator
        console.warn('Data poll failed:', err.message);
    }
}

// ═══════════════════════════════════════════════════════
//  RENDER LOOP
// ═══════════════════════════════════════════════════════

let renderer = null;

function gameLoop() {
    try {
        // Update all agent movements
        for (const key of AGENT_ORDER) {
            if (agentViz[key]) updateAgentMovement(key);
        }

        // Render
        renderer.render(agentViz, activeWorkItems);
    } catch (err) {
        console.error('Game loop error:', err);
    }

    requestAnimationFrame(gameLoop);
}

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('town-canvas');
    renderer = new TownRenderer(canvas);

    // Responsive resize
    const canvasWrap = document.getElementById('canvas-wrap');
    let resizeTimer = null;
    function onResize() {
        const w = canvasWrap.clientWidth - 16;  // subtract padding
        const h = canvasWrap.clientHeight - 16;
        if (w > 0 && h > 0) renderer.resize(w, h);
    }
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(onResize, 100);
    });
    onResize();

    // Clear button
    document.getElementById('btn-clear-log').addEventListener('click', clearEventLog);

    // Control center: click agent to expand description
    document.getElementById('agent-status-list').addEventListener('click', e => {
        const row = e.target.closest('.cc-agent-row');
        if (!row) return;
        const key = row.dataset.agent;
        expandedAgent = expandedAgent === key ? null : key;
        renderControlCenter();
    });

    // Todo: urgency selector
    document.querySelectorAll('.urgency-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.urgency-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedUrgency = btn.dataset.urgency;
        });
    });

    // Todo: add item
    function submitTodo() {
        const input = document.getElementById('todo-input');
        todoAdd(input.value, selectedUrgency);
        input.value = '';
        input.focus();
    }
    document.getElementById('todo-btn-add').addEventListener('click', submitTodo);
    document.getElementById('todo-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') submitTodo();
    });

    // Todo: toggle/delete via delegation
    document.getElementById('todo-list').addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.dataset.action === 'toggle') todoToggleDone(id);
        if (btn.dataset.action === 'delete') todoDelete(id);
    });

    // Todo: load from localStorage
    todos = todosLoad();
    renderTodoList();

    // Clock updater (NYC + CA)
    const tzNycEl = document.getElementById('tz-nyc');
    const tzCaEl = document.getElementById('tz-ca');
    const clockOpts = { hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' };
    function updateClocks() {
        const now = new Date();
        tzNycEl.textContent = now.toLocaleTimeString('en-US', { ...clockOpts, timeZone: 'America/New_York' });
        tzCaEl.textContent = now.toLocaleTimeString('en-US', { ...clockOpts, timeZone: 'America/Los_Angeles' });
    }
    updateClocks();
    setInterval(updateClocks, 1000);

    // Grand finale keyboard shortcut: press F for fireworks!
    document.addEventListener('keydown', e => {
        if (e.key === 'f' || e.key === 'F') {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            addEvent('system', 'GRAND FINALE!');
            spawnGrandFinale();
        }
    });

    // Start
    addEvent('system', 'Workshop Town starting...');
    gameLoop();
    checkHealth();
    pollState();
    pollAcquisition();
    pollCronStatus();
    pollOverseerLog();
    setInterval(checkHealth, HEALTH_INTERVAL);
    setInterval(pollState, POLL_INTERVAL);
    setInterval(pollAcquisition, ACQ_POLL_INTERVAL);
    setInterval(pollCronStatus, CRON_POLL_INTERVAL);
    setInterval(pollOverseerLog, OVERSEER_POLL_INTERVAL);
});
