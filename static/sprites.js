/**
 * THE GRID - Tron Legacy Style Sprite & Map Data
 *
 * Top-down 3/4 view. Characters are 16x16 base pixels, upscaled 2x to 32x32.
 * Scene is 480x320 pixel-art pixels, rendered at 2x scale (960x640).
 * '.' = transparent pixel.
 */

function decodeSprite(rows, palette) {
    return rows.map(row =>
        Array.from(row).map(ch => palette[ch] || null)
    );
}

// Upscale a decoded pixel grid 2x (each pixel becomes a 2x2 block)
function upscale2x(pixels) {
    const result = [];
    for (const row of pixels) {
        const newRow = [];
        for (const px of row) {
            newRow.push(px, px);
        }
        result.push([...newRow], [...newRow]);
    }
    return result;
}

// ═══════════════════════════════════════════════════════
//  SCENE LAYOUT (480x320 scene, doubled from 240x160)
// ═══════════════════════════════════════════════════════

const DISPATCH = { x: 224, y: 144, w: 48, h: 32 };

const BUILDINGS = {
    ledger:     { x: 40,  y: 24,  w: 44, h: 32, roofColor: '#00FF88', label: 'LEDGER' },
    scout:      { x: 218, y: 24,  w: 44, h: 32, roofColor: '#4488FF', label: 'SCOUT' },
    scribe:     { x: 396, y: 24,  w: 44, h: 32, roofColor: '#CC44FF', label: 'SCRIBE' },
    advisor:    { x: 88,  y: 230, w: 44, h: 32, roofColor: '#FF8800', label: 'ADVISOR' },
    watchtower: { x: 336, y: 230, w: 44, h: 32, roofColor: '#FF3366', label: 'WATCH' },
};

// Agent home positions (in front of their building doors)
const HOME_POS = {
    foreman:    { x: 232, y: 180 },  // At dispatch hub (Foreman IS the hub)
    ledger:     { x: 46,  y: 64 },
    scout:      { x: 224, y: 64 },
    scribe:     { x: 402, y: 64 },
    advisor:    { x: 94,  y: 270 },
    watchtower: { x: 342, y: 270 },
    overseer:   { x: 200, y: 148 },  // Near fountain, no building (traveling consultant)
};

// Dispatch pickup point
const DISPATCH_POS = { x: 232, y: 180 };

// Fountain position (left of dispatch plaza)
const FOUNTAIN = { x: 155, y: 148, r: 20 };

// Paths from each agent's home to dispatch (array of waypoints)
const AGENT_PATHS = {
    foreman:    [{ x: 232, y: 180 }],  // Already at dispatch hub — instant pickup
    ledger:     [{ x: 46, y: 84 }, { x: 46, y: 112 }, { x: 232, y: 112 }, { x: 232, y: 180 }],
    scout:      [{ x: 224, y: 84 }, { x: 224, y: 112 }, { x: 232, y: 112 }, { x: 232, y: 180 }],
    scribe:     [{ x: 402, y: 84 }, { x: 402, y: 112 }, { x: 232, y: 112 }, { x: 232, y: 180 }],
    advisor:    [{ x: 94, y: 262 }, { x: 94, y: 196 }, { x: 232, y: 196 }, { x: 232, y: 180 }],
    watchtower: [{ x: 342, y: 262 }, { x: 342, y: 196 }, { x: 232, y: 196 }, { x: 232, y: 180 }],
    overseer:   [],  // Uses custom patrol route, not standard dispatch path
};

// Overseer patrol route: circular loop visiting all 5 agent buildings along roads
const OVERSEER_PATROL = [
    { x: 46,  y: 64  },   // Ledger's door
    { x: 46,  y: 112 },   // Down to top road
    { x: 224, y: 112 },   // Along top road to Scout
    { x: 224, y: 64  },   // Up to Scout's door
    { x: 224, y: 112 },   // Back down to road
    { x: 402, y: 112 },   // Along top road to Scribe
    { x: 402, y: 64  },   // Up to Scribe's door
    { x: 402, y: 112 },   // Back down to road
    { x: 402, y: 192 },   // Down to bottom road
    { x: 342, y: 192 },   // Along bottom road to Watchtower
    { x: 342, y: 270 },   // Down to Watchtower's door
    { x: 342, y: 192 },   // Back up to road
    { x: 94,  y: 192 },   // Along bottom road to Advisor
    { x: 94,  y: 270 },   // Down to Advisor's door
    { x: 94,  y: 192 },   // Back up to road
    { x: 94,  y: 112 },   // Up to top road
];

// Light trail segments (x1, y1 -> x2, y2, width)
const ROAD_SEGMENTS = [
    // Top row verticals (building doors down to horizontal road)
    { x1: 54, y1: 56, x2: 54, y2: 116, w: 10 },
    { x1: 234, y1: 56, x2: 234, y2: 116, w: 10 },
    { x1: 412, y1: 56, x2: 412, y2: 116, w: 10 },
    // Top horizontal road
    { x1: 44, y1: 108, x2: 424, y2: 108, w: 10 },
    // Center vertical (top road to dispatch)
    { x1: 234, y1: 108, x2: 234, y2: 192, w: 10 },
    // Center vertical (dispatch to bottom road)
    { x1: 234, y1: 168, x2: 234, y2: 200, w: 10 },
    // Bottom horizontal road
    { x1: 84, y1: 192, x2: 424, y2: 192, w: 10 },
    // Bottom row verticals (road down to building doors)
    { x1: 102, y1: 192, x2: 102, y2: 274, w: 10 },
    { x1: 352, y1: 192, x2: 352, y2: 274, w: 10 },
    // Dispatch plaza (wider area)
    { x1: 212, y1: 128, x2: 264, y2: 128, w: 60 },
];

const WALK_SPEED = 1.2;  // pixels per frame (doubled from 0.6)
const OVERSEER_WALK_SPEED = 0.45;  // Overseer strolls slowly

// ═══════════════════════════════════════════════════════
//  AGENT SPRITES - Top-down 3/4 view (Tron program style)
//  Base 16x16, upscaled to 32x32 at decode time
// ═══════════════════════════════════════════════════════

const AGENT_ORDER = ['foreman', 'ledger', 'scout', 'scribe', 'advisor', 'watchtower', 'overseer'];

const AGENTS = {

    // ─── FOREMAN - The Orchestrator ────────────────────
    foreman: {
        name: 'Foreman',
        title: 'The Orchestrator',
        model: 'Sonnet',
        color: '#FFD700',
        desc: 'Master orchestrator. Receives all questions, decomposes into agent tasks, coordinates parallel execution, synthesizes results.',
        palette: {
            'h': '#8B7700', 'H': '#FFD700', 'L': '#D4AA00',
            's': '#F0C8A0',
            'e': '#222244', 'w': '#AACCFF',
            'g': '#6B5500', 'G': '#D4A800', 'v': '#FFE030',
            'p': '#1A1A3A', 'b': '#2A2A4A',
            'm': '#CC6655',
        },
        front: [
            '................',
            '..hhHHHHHHhh....',
            '.hHHHHHHHHHHh...',
            '.LLLLLLLLLLLL...',
            '....ssssssss....',
            '....wesssssew...',
            '....ssssssss....',
            '.....ssmmss.....',
            '....gGGGGGGg....',
            '...gGGvGGvGGg...',
            '...sgGGGGGGgs...',
            '....gggggggg....',
            '.....pp..pp.....',
            '.....pp..pp.....',
            '.....bb..bb.....',
            '................',
        ],
        walk: [
            '................',
            '..hhHHHHHHhh....',
            '.hHHHHHHHHHHh...',
            '.LLLLLLLLLLLL...',
            '....ssssssss....',
            '....wesssssew...',
            '....ssssssss....',
            '.....ssmmss.....',
            '....gGGGGGGg....',
            '...gGGvGGvGGg...',
            '...sgGGGGGGgs...',
            '....gggggggg....',
            '....pp....pp....',
            '.....pp..pp.....',
            '....bb....bb....',
            '................',
        ],
    },

    // ─── LEDGER - The Accountant ─────────────────────
    ledger: {
        name: 'Ledger',
        title: 'The Accountant',
        model: 'Haiku',
        color: '#00FF88',
        desc: 'Financial data lookups, metric queries, and daily numbers. Runs on Haiku for fast, cheap answers.',
        palette: {
            'h': '#2A4A3A', 'H': '#3A6A4A',
            's': '#F0C8A0',
            'e': '#222244', 'w': '#AACCFF',
            'g': '#007A44', 'G': '#00FF88',
            'p': '#1A1A3A', 'b': '#2A2A4A',
            'm': '#CC6655',
        },
        front: [
            '................',
            '.....hHHHHh.....',
            '....hHHHHHHh....',
            '....ssssssss....',
            '....wesssssew...',
            '....ssssssss....',
            '.....ssmmss.....',
            '.....gGGGGg.....',
            '....gGGGGGGg....',
            '....sgGGGGgs....',
            '.....gggggg.....',
            '.....pp..pp.....',
            '.....pp..pp.....',
            '.....bb..bb.....',
            '................',
            '................',
        ],
        walk: [
            '................',
            '.....hHHHHh.....',
            '....hHHHHHHh....',
            '....ssssssss....',
            '....wesssssew...',
            '....ssssssss....',
            '.....ssmmss.....',
            '.....gGGGGg.....',
            '....gGGGGGGg....',
            '....sgGGGGgs....',
            '.....gggggg.....',
            '....pp....pp....',
            '.....pp..pp.....',
            '....bb....bb....',
            '................',
            '................',
        ],
    },

    // ─── SCOUT - The Analyst ─────────────────────────
    scout: {
        name: 'Scout',
        title: 'The Analyst',
        model: 'Sonnet',
        color: '#4488FF',
        desc: 'Web research, data gathering, and competitive analysis. Fetches live data from APIs and the web.',
        palette: {
            'a': '#1144AA', 'A': '#2266DD',
            's': '#F0C8A0',
            'e': '#222244', 'w': '#FFFFFF',
            'c': '#1155CC', 'C': '#4488FF',
            'p': '#1A1A3A', 'b': '#2A2A4A',
            'm': '#CC6655',
        },
        front: [
            '......aAa.......',
            '.....aAAAa......',
            '....aAAAAAa.....',
            '....ssssssss....',
            '....sewssews....',
            '....ssssssss....',
            '.....ssmmss.....',
            '.....cCCCCc.....',
            '....cCCCCCCc....',
            '....scCCCCcs....',
            '.....cccccc.....',
            '.....pp..pp.....',
            '.....pp..pp.....',
            '.....bb..bb.....',
            '................',
            '................',
        ],
        walk: [
            '......aAa.......',
            '.....aAAAa......',
            '....aAAAAAa.....',
            '....ssssssss....',
            '....sewssews....',
            '....ssssssss....',
            '.....ssmmss.....',
            '.....cCCCCc.....',
            '....cCCCCCCc....',
            '....scCCCCcs....',
            '.....cccccc.....',
            '....pp....pp....',
            '.....pp..pp.....',
            '....bb....bb....',
            '................',
            '................',
        ],
    },

    // ─── SCRIBE - Report Writer ──────────────────────
    scribe: {
        name: 'Scribe',
        title: 'Report Writer',
        model: 'Sonnet',
        color: '#CC44FF',
        desc: 'Writes reports, summaries, and long-form content. Generates charts and formatted deliverables.',
        palette: {
            'd': '#2A1A3A', 'D': '#3A2A5A',
            'h': '#2A2035', 'H': '#3A3045',
            's': '#F0C8A0',
            'e': '#222244', 'w': '#FFFFFF',
            'v': '#8800CC', 'V': '#CC44FF',
            'b': '#2A2A4A',
            'm': '#CC6655',
        },
        front: [
            '.....dDDDDd.....',
            '....dDDDDDDd....',
            '....hhhhhhh.....',
            '....ssssssss....',
            '....sewssews....',
            '....ssssssss....',
            '.....ssmmss.....',
            '.....vVVVVv.....',
            '....vVVVVVVv....',
            '....svVVVVvs....',
            '.....vVVVVv.....',
            '.....vv..vv.....',
            '.....vv..vv.....',
            '.....bb..bb.....',
            '................',
            '................',
        ],
        walk: [
            '.....dDDDDd.....',
            '....dDDDDDDd....',
            '....hhhhhhh.....',
            '....ssssssss....',
            '....sewssews....',
            '....ssssssss....',
            '.....ssmmss.....',
            '.....vVVVVv.....',
            '....vVVVVVVv....',
            '....svVVVVvs....',
            '.....vVVVVv.....',
            '....vv....vv....',
            '.....vv..vv.....',
            '....bb....bb....',
            '................',
            '................',
        ],
    },

    // ─── ADVISOR - The Strategist ────────────────────
    advisor: {
        name: 'Advisor',
        title: 'The Strategist',
        model: 'Sonnet',
        color: '#FF8800',
        desc: 'Strategic analysis, recommendations, and action plans. Synthesizes data from other agents into insights.',
        palette: {
            't': '#2A2040', 'T': '#3A3055',
            'r': '#CC5500', 'R': '#FF8800',
            's': '#F0C8A0',
            'e': '#222244', 'w': '#FFFFFF',
            'f': '#AAAAAA', 'F': '#CCCCCC',
            'p': '#1A1A3A', 'b': '#2A2A4A',
            'm': '#CC6655',
        },
        front: [
            '.......t........',
            '......tTt.......',
            '.....tTTTt......',
            '....tTTTTTt.....',
            '....ssssssss....',
            '....sewssews....',
            '....ssfFFfss....',
            '.....rRRRRr.....',
            '....rRRRRRRr....',
            '....srRRRRrs....',
            '.....rrrrrr.....',
            '.....pp..pp.....',
            '.....pp..pp.....',
            '.....bb..bb.....',
            '................',
            '................',
        ],
        walk: [
            '.......t........',
            '......tTt.......',
            '.....tTTTt......',
            '....tTTTTTt.....',
            '....ssssssss....',
            '....sewssews....',
            '....ssfFFfss....',
            '.....rRRRRr.....',
            '....rRRRRRRr....',
            '....srRRRRrs....',
            '.....rrrrrr.....',
            '....pp....pp....',
            '.....pp..pp.....',
            '....bb....bb....',
            '................',
            '................',
        ],
    },

    // ─── WATCHTOWER - Ops Monitor ────────────────────
    watchtower: {
        name: 'Watchtower',
        title: 'Ops Monitor',
        model: 'Haiku',
        color: '#FF3366',
        desc: 'Monitoring, alerts, and status checks. Watches systems and flags anomalies. Runs on Haiku for speed.',
        palette: {
            'k': '#555566', 'K': '#888899',
            's': '#F0C8A0',
            'e': '#222244', 'w': '#FFFFFF',
            'a': '#CC0033', 'A': '#FF3366',
            'y': '#FF6100',
            'p': '#1A1A3A', 'b': '#2A2A4A',
            'm': '#CC6655',
        },
        front: [
            '....kKKKKKk.....',
            '...kKKKKKKKk....',
            '...kkKkkKkKk....',
            '....ssssssss....',
            '....sewssews....',
            '....ssssssss....',
            '.....ssmmss.....',
            '...aAAAAAAAAAa..',
            '..aAAAAAAAAAAAA.',
            '..saAAAAAAAAAsy.',
            '...aaaaaaaaaa...',
            '....pp...pp.....',
            '....pp...pp.....',
            '....bb...bb.....',
            '................',
            '................',
        ],
        walk: [
            '....kKKKKKk.....',
            '...kKKKKKKKk....',
            '...kkKkkKkKk....',
            '....ssssssss....',
            '....sewssews....',
            '....ssssssss....',
            '.....ssmmss.....',
            '...aAAAAAAAAAa..',
            '..aAAAAAAAAAAAA.',
            '..saAAAAAAAAAsy.',
            '...aaaaaaaaaa...',
            '...pp.....pp....',
            '....pp...pp.....',
            '...bb.....bb....',
            '................',
            '................',
        ],
    },

    // --- OVERSEER - The Consultant -----------------------
    overseer: {
        name: 'Overseer',
        title: 'The Consultant',
        model: 'Sonnet',
        color: '#00DFFC',
        desc: 'Self-improvement engine. Watches other agents, updates prompts, creates tools, retries failed tasks. Always patrolling.',
        palette: {
            'h': '#1A1A2A', 'H': '#2A2A3A',     // dark blue-black hair
            's': '#F0C8A0',                        // skin
            'e': '#222244', 'w': '#00DFFC',        // eyes glow cyan
            'o': '#00DFFC',                        // monocle cyan
            't': '#0A0A1A', 'T': '#111122',       // dark blue-black coat
            'L': '#00DFFC',                        // coat highlights = cyan circuit lines
            'p': '#0A0A1A', 'b': '#111122',       // dark boots
            'm': '#CC6655',                        // mouth
        },
        front: [
            '................',
            '.....hHHHHh.....',
            '....hHHHHHHh....',
            '....ssssssss....',
            '....wessssoew...',
            '....ssssssss....',
            '.....ssmmss.....',
            '....tTTTTTTt....',
            '...tTTLTTLTTt...',
            '...sTTTTTTTTs...',
            '...tTTTTTTTTt...',
            '....tttttttt....',
            '.....pp..pp.....',
            '.....pp..pp.....',
            '.....bb..bb.....',
            '................',
        ],
        walk: [
            '................',
            '.....hHHHHh.....',
            '....hHHHHHHh....',
            '....ssssssss....',
            '....wessssoew...',
            '....ssssssss....',
            '.....ssmmss.....',
            '....tTTTTTTt....',
            '...tTTLTTLTTt...',
            '...sTTTTTTTTs...',
            '...tTTTTTTTTt...',
            '....tttttttt....',
            '....pp....pp....',
            '.....pp..pp.....',
            '....bb....bb....',
            '................',
        ],
    },
};

// Decode and upscale all agent sprites to 32x32
for (const [key, agent] of Object.entries(AGENTS)) {
    agent.frontPixels = upscale2x(decodeSprite(agent.front, agent.palette));
    agent.walkPixels  = upscale2x(decodeSprite(agent.walk, agent.palette));
}

// ═══════════════════════════════════════════════════════
//  UTILITY SPRITES (decoded then upscaled)
// ═══════════════════════════════════════════════════════

// Data disc (Tron identity disc)
const WORK_ITEM_SPRITE = upscale2x(decodeSprite([
    '..cccc..',
    '.cCCCCc.',
    'cCCiiCCc',
    'cCCiiCCc',
    'cCCiiCCc',
    'cCCCCCCc',
    '.cccccc.',
    '..cccc..',
], { 'c': '#004A5A', 'C': '#00DFFC', 'i': '#001A2A' }));

const ALERT_SPRITE = upscale2x(decodeSprite([
    '.rrr.',
    '.rrr.',
    '.rrr.',
    '..r..',
    '.....',
    '..r..',
    '..r..',
], { 'r': '#FF3366' }));

const CHECK_SPRITE = upscale2x(decodeSprite([
    '....g',
    '...gg',
    'g.gg.',
    'ggg..',
    'gg...',
], { 'g': '#00FF88' }));

// ═══════════════════════════════════════════════════════
//  AGENT TOOLS (held items, role-relevant, upscaled)
// ═══════════════════════════════════════════════════════

const AGENT_TOOLS = {
    // Foreman: data clipboard (neon gold)
    foreman: upscale2x(decodeSprite([
        '.CC.',
        'CPPC',
        'CiiC',
        'CiiC',
        'CPPC',
    ], { 'C': '#FFD700', 'P': '#1A1500', 'i': '#332A00' })),

    // Ledger: data grid (neon green)
    ledger: upscale2x(decodeSprite([
        'GGG',
        'GwG',
        'GGG',
        'GwG',
        'GGG',
    ], { 'G': '#00FF88', 'w': '#003322' })),

    // Scout: scanner (neon blue)
    scout: upscale2x(decodeSprite([
        'cc..',
        'cCCc',
        '.ccc',
    ], { 'c': '#1155CC', 'C': '#4488FF' })),

    // Scribe: light pen (neon purple)
    scribe: upscale2x(decodeSprite([
        '..w',
        '.Vw',
        '.V.',
        'V..',
    ], { 'V': '#CC44FF', 'w': '#EE99FF' })),

    // Advisor: data cube (neon orange)
    advisor: upscale2x(decodeSprite([
        '.RR.',
        'RGGR',
        'RGGR',
        '.RR.',
    ], { 'R': '#FF8800', 'G': '#331A00' })),

    // Watchtower: alert beacon (neon pink)
    watchtower: upscale2x(decodeSprite([
        '.k.',
        'kYk',
        'kYk',
        '.k.',
    ], { 'k': '#CC0033', 'Y': '#FF3366' })),

    // Overseer: identity disc (cyan - Tron signature)
    overseer: upscale2x(decodeSprite([
        '.TT.',
        'TCCT',
        'TCCT',
        '.TT.',
        '..T.',
        '...T',
    ], { 'T': '#004A5A', 'C': '#00DFFC' })),
};

// ═══════════════════════════════════════════════════════
//  DATA NODE POSITIONS
// ═══════════════════════════════════════════════════════

const BUSH_POSITIONS = [
    // Near ledger building
    { x: 26, y: 50, size: 2 },
    { x: 88, y: 48, size: 1 },
    // Near scout building
    { x: 204, y: 48, size: 1 },
    { x: 266, y: 50, size: 2 },
    // Near scribe building
    { x: 382, y: 48, size: 1 },
    { x: 444, y: 50, size: 2 },
    // Along top road edges
    { x: 142, y: 96, size: 2 },
    { x: 302, y: 100, size: 1 },
    { x: 378, y: 96, size: 2 },
    // Near fountain
    { x: 126, y: 128, size: 2 },
    { x: 126, y: 170, size: 1 },
    // Near advisor building
    { x: 68, y: 246, size: 1 },
    { x: 142, y: 252, size: 2 },
    // Near watchtower building
    { x: 316, y: 248, size: 2 },
    { x: 390, y: 252, size: 1 },
    // Scene edges and corners
    { x: 6, y: 78, size: 2 },
    { x: 8, y: 182, size: 1 },
    { x: 460, y: 118, size: 2 },
    { x: 458, y: 198, size: 1 },
    { x: 198, y: 288, size: 2 },
    { x: 400, y: 286, size: 1 },
    { x: 10, y: 286, size: 2 },
    { x: 450, y: 286, size: 2 },
];
