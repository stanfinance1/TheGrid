/**
 * THE GRID - Tron Legacy Style Renderer (2x Resolution)
 *
 * Top-down 3/4 view. Scene is 480x320 pixel-art pixels at 2x scale (960x640).
 * Wireframe towers, light trail roads, data portal, neon circuit aesthetic.
 */

const SCENE_W = 480;
const SCENE_H = 320;

// ═══════════════════════════════════════════════════════
//  TRON COLOR CONSTANTS
// ═══════════════════════════════════════════════════════

const TRON = {
    BLACK:      '#000000',
    VOID:       '#000510',
    PANEL:      '#050510',
    GRID_DIM:   '#0a1a2a',
    GRID_LINE:  '#0a2a3a',
    GRID_BRIGHT:'#1a3a4a',
    CYAN:       '#00DFFC',
    CYAN_DIM:   '#004A5A',
    CYAN_DARK:  '#003040',
    CYAN_DEEP:  '#001a2a',
    ORANGE:     '#FF6100',
    GREEN:      '#00FF88',
    PINK:       '#FF3366',
    TEXT:        '#7FDBFF',
    TEXT_DIM:    '#3a6a7a',
};

// ═══════════════════════════════════════════════════════
//  PARTICLES
// ═══════════════════════════════════════════════════════

const particles = [];

class Particle {
    constructor(x, y, color, life, vx, vy, size) {
        this.x = x; this.y = y;
        this.color = color;
        this.life = life; this.maxLife = life;
        this.vx = vx || 0; this.vy = vy || -0.2;
        this.size = size || 1;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life--; }
    get alpha() { return Math.max(0, this.life / this.maxLife); }
    get dead() { return this.life <= 0; }
}

function spawnDust(x, y) {
    for (let i = 0; i < 3; i++) {
        particles.push(new Particle(
            x + (Math.random() - 0.5) * 8,
            y + 12 + Math.random() * 4,
            Math.random() > 0.5 ? TRON.CYAN : TRON.CYAN_DIM,
            12 + Math.floor(Math.random() * 8),
            (Math.random() - 0.5) * 0.3,
            -0.1 - Math.random() * 0.15,
            1
        ));
    }
}

function spawnSparkle(x, y, color) {
    for (let i = 0; i < 5; i++) {
        particles.push(new Particle(
            x + (Math.random() - 0.5) * 20,
            y + (Math.random() - 0.5) * 20,
            color || TRON.CYAN,
            20 + Math.floor(Math.random() * 15),
            (Math.random() - 0.5) * 0.4,
            -0.15 - Math.random() * 0.25,
            1
        ));
    }
}

function spawnCompletionBurst(x, y) {
    const colors = [TRON.CYAN, TRON.GREEN, TRON.ORANGE, TRON.PINK];
    for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        particles.push(new Particle(
            x, y,
            colors[i % colors.length],
            30 + Math.floor(Math.random() * 15),
            Math.cos(angle) * 0.9,
            Math.sin(angle) * 0.9,
            1
        ));
    }
}

// ═══════════════════════════════════════════════════════
//  FIREWORKS (Tron palette)
// ═══════════════════════════════════════════════════════

const fireworks = [];
const fireworkParticles = [];

const FIREWORK_PALETTES = [
    ['#00DFFC', '#33E8FF', '#66F0FF', '#99F5FF'],     // cyan
    ['#00FF88', '#33FFAA', '#66FFCC', '#99FFDD'],     // neon green
    ['#FF6100', '#FF8133', '#FF9E66', '#FFBB99'],     // neon orange
    ['#FF3366', '#FF6688', '#FF99AA', '#FFCCCC'],     // hot pink
    ['#CC44FF', '#DD77FF', '#EE99FF', '#FFBBFF'],     // neon purple
    ['#4488FF', '#77AAFF', '#99CCFF', '#BBDDFF'],     // neon blue
    ['#FFFFFF', '#CCEFFF', '#99DFFF', '#66CFFF'],     // white-to-cyan
];

class FireworkRocket {
    constructor(x, y, targetY, palette, delay) {
        this.x = x;
        this.y = y;
        this.targetY = targetY;
        this.vy = -2.0 - Math.random() * 0.8;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.palette = palette;
        this.exploded = false;
        this.delay = delay || 0;
        this.trailTimer = 0;
    }

    update() {
        if (this.exploded) return true;
        if (this.delay > 0) { this.delay--; return false; }

        this.trailTimer++;
        if (this.trailTimer % 2 === 0) {
            fireworkParticles.push({
                x: this.x + (Math.random() - 0.5) * 2,
                y: this.y,
                color: this.palette[0],
                life: 10 + Math.floor(Math.random() * 6),
                maxLife: 16,
                vx: (Math.random() - 0.5) * 0.3,
                vy: 0.3 + Math.random() * 0.2,
                size: 1,
                gravity: 0.01,
            });
        }

        this.x += this.vx;
        this.y += this.vy;

        if (this.y <= this.targetY) {
            this.explode();
            return true;
        }
        return false;
    }

    explode() {
        this.exploded = true;
        const count = 30 + Math.floor(Math.random() * 20);
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const speed = 0.6 + Math.random() * 1.4;
            const color = this.palette[Math.floor(Math.random() * this.palette.length)];
            fireworkParticles.push({
                x: this.x,
                y: this.y,
                color,
                life: 40 + Math.floor(Math.random() * 30),
                maxLife: 70,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() > 0.6 ? 2 : 1,
                gravity: 0.015 + Math.random() * 0.01,
            });
        }
        // White flash at burst center
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.3 + Math.random() * 0.5;
            fireworkParticles.push({
                x: this.x,
                y: this.y,
                color: '#FFFFFF',
                life: 8 + Math.floor(Math.random() * 8),
                maxLife: 16,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 1,
                gravity: 0,
            });
        }
    }
}

function spawnFireworks(x, y) {
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
        const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
        const targetY = 15 + Math.random() * 50;
        const startX = x + (Math.random() - 0.5) * 60;
        const startY = y + 10;
        fireworks.push(new FireworkRocket(startX, startY, targetY, palette, i * 15));
    }
}

/**
 * LIGHT SHOW -- Massive fireworks across the entire scene.
 */
function spawnGrandFinale() {
    const launchPoints = [
        { x: 60, y: 300 },
        { x: 160, y: 300 },
        { x: 240, y: 300 },
        { x: 320, y: 300 },
        { x: 420, y: 300 },
        { x: 100, y: 280 },
        { x: 380, y: 280 },
    ];

    let delay = 0;

    // Wave 1: scattered rockets
    for (let w = 0; w < 3; w++) {
        for (const pt of launchPoints) {
            const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
            const targetY = 10 + Math.random() * 40;
            const jitterX = pt.x + (Math.random() - 0.5) * 40;
            fireworks.push(new FireworkRocket(jitterX, pt.y, targetY, palette, delay + Math.floor(Math.random() * 10)));
        }
        delay += 30;
    }

    // Wave 2: rapid-fire center burst
    for (let i = 0; i < 15; i++) {
        const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
        const x = 160 + Math.random() * 160;
        fireworks.push(new FireworkRocket(x, 310, 8 + Math.random() * 35, palette, delay + i * 3));
    }
    delay += 50;

    // Wave 3: grand crescendo
    for (let i = 0; i < 20; i++) {
        const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
        const x = 30 + Math.random() * 420;
        const targetY = 5 + Math.random() * 50;
        fireworks.push(new FireworkRocket(x, 310, targetY, palette, delay + Math.floor(Math.random() * 8)));
    }

    // Bonus: completion bursts at each building
    for (const key of Object.keys(HOME_POS)) {
        const pos = HOME_POS[key];
        setTimeout(() => {
            spawnCompletionBurst(pos.x + 16, pos.y + 16);
        }, (delay * 16) + Math.random() * 1000);
    }
}

// ═══════════════════════════════════════════════════════
//  RENDERER
// ═══════════════════════════════════════════════════════

class TownRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.pixel = 2;
        canvas.width = SCENE_W * this.pixel;
        canvas.height = SCENE_H * this.pixel;
        this.ctx.imageSmoothingEnabled = false;

        this.time = 0;
        this.grassCache = null;
        this.initGrass();
    }

    resize(containerW, containerH) {
        const newPixel = Math.max(1, Math.floor(Math.min(containerW / SCENE_W, containerH / SCENE_H)));
        if (newPixel === this.pixel) return;
        this.pixel = newPixel;
        this.canvas.width = SCENE_W * this.pixel;
        this.canvas.height = SCENE_H * this.pixel;
        this.ctx.imageSmoothingEnabled = false;
        this.initGrass();
    }

    // ─── Primitives ────────────────────────────────

    px(x, y, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(Math.floor(x) * this.pixel, Math.floor(y) * this.pixel, this.pixel, this.pixel);
    }

    rect(x, y, w, h, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(Math.floor(x) * this.pixel, Math.floor(y) * this.pixel, w * this.pixel, h * this.pixel);
    }

    sprite(data, px, py, alpha) {
        const ctx = this.ctx;
        const prev = ctx.globalAlpha;
        if (alpha !== undefined) ctx.globalAlpha = alpha;
        for (let y = 0; y < data.length; y++) {
            for (let x = 0; x < data[y].length; x++) {
                if (data[y][x]) this.px(px + x, py + y, data[y][x]);
            }
        }
        ctx.globalAlpha = prev;
    }

    spriteFlip(data, px, py, alpha) {
        const ctx = this.ctx;
        const prev = ctx.globalAlpha;
        if (alpha !== undefined) ctx.globalAlpha = alpha;
        const w = data[0].length;
        for (let y = 0; y < data.length; y++) {
            for (let x = 0; x < data[y].length; x++) {
                if (data[y][x]) this.px(px + (w - 1 - x), py + y, data[y][x]);
            }
        }
        ctx.globalAlpha = prev;
    }

    text(str, x, y, color, size) {
        const ctx = this.ctx;
        ctx.fillStyle = color || TRON.CYAN;
        ctx.font = `${size || 10}px "Orbitron", "Rajdhani", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(str, x * this.pixel, y * this.pixel);
    }

    // ─── Background: Grid Void ──────────────────────

    initGrass() {
        const p = this.pixel;
        const off = document.createElement('canvas');
        off.width = SCENE_W * p;
        off.height = SCENE_H * p;
        const ctx = off.getContext('2d');

        // Pure black void
        ctx.fillStyle = TRON.BLACK;
        ctx.fillRect(0, 0, SCENE_W * p, SCENE_H * p);

        const GRID_SPACING = 16;

        // Draw subtle grid lines
        for (let y = 0; y < SCENE_H; y++) {
            const isMajor = (y % (GRID_SPACING * 5)) === 0;
            const isMinor = (y % GRID_SPACING) === 0;
            if (!isMinor && !isMajor) continue;
            ctx.fillStyle = isMajor ? TRON.GRID_BRIGHT : TRON.GRID_DIM;
            ctx.fillRect(0, y * p, SCENE_W * p, Math.max(1, Math.floor(p * 0.5)));
        }

        for (let x = 0; x < SCENE_W; x++) {
            const isMajor = (x % (GRID_SPACING * 5)) === 0;
            const isMinor = (x % GRID_SPACING) === 0;
            if (!isMinor && !isMajor) continue;
            ctx.fillStyle = isMajor ? TRON.GRID_BRIGHT : TRON.GRID_DIM;
            ctx.fillRect(x * p, 0, Math.max(1, Math.floor(p * 0.5)), SCENE_H * p);
        }

        this.grassCache = off;
    }

    seededRandom(seed) {
        return function() {
            seed = (seed * 16807 + 0) % 2147483647;
            return seed / 2147483647;
        };
    }

    drawGrass() {
        this.ctx.drawImage(this.grassCache, 0, 0);
    }

    // ─── Background: Light Trail Roads ──────────────

    drawRoads() {
        const TRAIL_FILL = TRON.CYAN_DEEP;
        const TRAIL_EDGE = TRON.CYAN;
        const TRAIL_CENTER = TRON.CYAN_DARK;
        const glowAlpha = 0.12 + Math.sin(this.time * 1.5) * 0.04;

        for (const seg of ROAD_SEGMENTS) {
            const x1 = Math.min(seg.x1, seg.x2);
            const y1 = Math.min(seg.y1, seg.y2);
            const x2 = Math.max(seg.x1, seg.x2);
            const y2 = Math.max(seg.y1, seg.y2);
            const hw = Math.floor(seg.w / 2);

            if (x1 === x2) {
                // Vertical light trail
                this.rect(x1 - hw, y1, seg.w, y2 - y1 + 1, TRAIL_FILL);
                // Neon edges
                this.rect(x1 - hw, y1, 1, y2 - y1 + 1, TRAIL_EDGE);
                this.rect(x1 + hw, y1, 1, y2 - y1 + 1, TRAIL_EDGE);
                // Center pulse line
                this.rect(x1, y1, 1, y2 - y1 + 1, TRAIL_CENTER);
                // Edge glow bleed
                this.ctx.globalAlpha = glowAlpha;
                this.rect(x1 - hw - 2, y1, 3, y2 - y1 + 1, TRON.CYAN);
                this.rect(x1 + hw, y1, 3, y2 - y1 + 1, TRON.CYAN);
                this.ctx.globalAlpha = 1;
                // Data pulse traveling along trail
                const pulsePos = ((this.time * 40 + x1 * 3) % (y2 - y1)) + y1;
                this.ctx.globalAlpha = 0.6;
                this.rect(x1 - hw + 1, pulsePos, seg.w - 2, 2, TRON.CYAN);
                this.ctx.globalAlpha = 1;
            } else {
                // Horizontal light trail
                this.rect(x1, y1 - hw, x2 - x1 + 1, seg.w, TRAIL_FILL);
                this.rect(x1, y1 - hw, x2 - x1 + 1, 1, TRAIL_EDGE);
                this.rect(x1, y1 + hw, x2 - x1 + 1, 1, TRAIL_EDGE);
                this.rect(x1, y1, x2 - x1 + 1, 1, TRAIL_CENTER);
                // Edge glow bleed
                this.ctx.globalAlpha = glowAlpha;
                this.rect(x1, y1 - hw - 2, x2 - x1 + 1, 3, TRON.CYAN);
                this.rect(x1, y1 + hw, x2 - x1 + 1, 3, TRON.CYAN);
                this.ctx.globalAlpha = 1;
                // Data pulse
                const pulsePos = ((this.time * 40 + y1 * 3) % (x2 - x1)) + x1;
                this.ctx.globalAlpha = 0.6;
                this.rect(pulsePos, y1 - hw + 1, 2, seg.w - 2, TRON.CYAN);
                this.ctx.globalAlpha = 1;
            }
        }

        // Dispatch nexus platform
        const plx = DISPATCH.x - 12;
        const ply = DISPATCH.y - 8;
        const plw = DISPATCH.w + 24;
        const plh = DISPATCH.h + 16;
        this.rect(plx, ply, plw, plh, TRON.VOID);
        // Nexus border
        this.rect(plx, ply, plw, 1, TRON.CYAN);
        this.rect(plx, ply + plh - 1, plw, 1, TRON.CYAN);
        this.rect(plx, ply, 1, plh, TRON.CYAN);
        this.rect(plx + plw - 1, ply, 1, plh, TRON.CYAN);
        // Interior crosshairs
        this.ctx.globalAlpha = 0.15;
        this.rect(plx + Math.floor(plw / 2), ply + 1, 1, plh - 2, TRON.CYAN);
        this.rect(plx + 1, ply + Math.floor(plh / 2), plw - 2, 1, TRON.CYAN);
        this.ctx.globalAlpha = 1;
        // Corner nodes
        const cn = [[plx, ply], [plx + plw - 3, ply], [plx, ply + plh - 3], [plx + plw - 3, ply + plh - 3]];
        for (const [cx, cy] of cn) {
            this.rect(cx, cy, 3, 3, TRON.CYAN);
        }
    }

    // ─── Buildings: Wireframe Towers ─────────────────

    drawBuilding(cfg) {
        const { x, y, w, h, roofColor, label } = cfg;

        // Dark tower fill
        this.rect(x, y, w, h, TRON.VOID);

        // Wireframe outline in agent's neon color
        this.rect(x, y, w, 1, roofColor);
        this.rect(x, y + h - 1, w, 1, roofColor);
        this.rect(x, y, 1, h, roofColor);
        this.rect(x + w - 1, y, 1, h, roofColor);

        // Interior circuit lines (horizontal data streams)
        this.ctx.globalAlpha = 0.12;
        for (let ty = y + 4; ty < y + h - 2; ty += 6) {
            this.rect(x + 1, ty, w - 2, 1, roofColor);
        }
        // Vertical circuit lines
        for (let tx = x + 6; tx < x + w - 2; tx += 8) {
            this.rect(tx, y + 1, 1, h - 2, roofColor);
        }
        this.ctx.globalAlpha = 1;

        // Corner accent nodes (3x3)
        this.rect(x, y, 3, 3, roofColor);
        this.rect(x + w - 3, y, 3, 3, roofColor);
        this.rect(x, y + h - 3, 3, 3, roofColor);
        this.rect(x + w - 3, y + h - 3, 3, 3, roofColor);

        // Data display panels (windows)
        if (w >= 30) {
            this.drawWindow(x + 5, y + 12, roofColor);
            this.drawWindow(x + w - 13, y + 12, roofColor);
        }

        // Top antenna/spire
        const spireX = x + Math.floor(w / 2);
        this.rect(spireX, y - 8, 1, 8, roofColor);
        this.rect(spireX - 2, y - 10, 5, 2, roofColor);
        // Spire glow pulse
        const spireGlow = 0.4 + Math.sin(this.time * 2 + x * 0.05) * 0.25;
        this.ctx.globalAlpha = spireGlow;
        this.rect(spireX - 1, y - 11, 3, 3, roofColor);
        this.ctx.globalAlpha = spireGlow * 0.3;
        this.rect(spireX - 3, y - 13, 7, 5, roofColor);
        this.ctx.globalAlpha = 1;

        // Label
        this.text(label, x + w / 2, y + h + 12, roofColor, 10);
    }

    drawWindow(wx, wy, accentColor) {
        // Data display panel
        this.rect(wx, wy, 8, 7, '#000a14');
        // Frame edges
        this.rect(wx, wy, 8, 1, accentColor);
        this.rect(wx, wy + 6, 8, 1, accentColor);
        this.rect(wx, wy, 1, 7, accentColor);
        this.rect(wx + 7, wy, 1, 7, accentColor);
        // Data readout lines
        this.ctx.globalAlpha = 0.4;
        this.rect(wx + 2, wy + 2, 4, 1, accentColor);
        this.rect(wx + 2, wy + 4, 2, 1, accentColor);
        this.ctx.globalAlpha = 1;
    }

    drawDispatchHub() {
        const d = DISPATCH;
        const bx = d.x - 4;
        const by = d.y - 16;
        const bw = d.w + 8;
        const bh = d.h + 16;

        const NC = TRON.CYAN;        // nexus color
        const ND = TRON.CYAN_DIM;    // nexus dim

        // Main body: dark fill
        this.rect(bx, by, bw, bh, TRON.VOID);

        // Double border: outer bright, inner dim
        this.rect(bx, by, bw, 1, NC);
        this.rect(bx, by + bh - 1, bw, 1, NC);
        this.rect(bx, by, 1, bh, NC);
        this.rect(bx + bw - 1, by, 1, bh, NC);
        // Inner border (inset 2px)
        this.rect(bx + 2, by + 2, bw - 4, 1, ND);
        this.rect(bx + 2, by + bh - 3, bw - 4, 1, ND);
        this.rect(bx + 2, by + 2, 1, bh - 4, ND);
        this.rect(bx + bw - 3, by + 2, 1, bh - 4, ND);

        // Circuit interior pattern
        this.ctx.globalAlpha = 0.1;
        for (let ty = by + 4; ty < by + bh - 2; ty += 5) {
            this.rect(bx + 3, ty, bw - 6, 1, NC);
        }
        for (let tx = bx + 6; tx < bx + bw - 2; tx += 7) {
            this.rect(tx, by + 3, 1, bh - 6, NC);
        }
        this.ctx.globalAlpha = 1;

        // Corner accent nodes (4x4)
        this.rect(bx, by, 4, 4, NC);
        this.rect(bx + bw - 4, by, 4, 4, NC);
        this.rect(bx, by + bh - 4, 4, 4, NC);
        this.rect(bx + bw - 4, by + bh - 4, 4, 4, NC);

        // Data panels (flanking center)
        this.drawWindow(bx + 5, by + 6, NC);
        if (bw >= 40) {
            this.drawWindow(bx + bw - 13, by + 6, NC);
        }

        // Central spire / data core
        const tw = 6;
        const tx = bx + Math.floor(bw / 2) - 3;
        const towerTop = by - 24;
        // Spire shaft
        this.rect(tx + 2, towerTop, 2, 24, NC);
        // Horizontal crossbars
        this.rect(tx, towerTop + 6, tw, 1, ND);
        this.rect(tx - 2, towerTop + 12, tw + 4, 1, ND);
        this.rect(tx - 4, towerTop + 18, tw + 8, 2, NC);

        // Pulsing beacon at spire tip
        const beacon = 0.5 + Math.sin(this.time * 3) * 0.4;
        this.ctx.globalAlpha = beacon;
        this.rect(tx + 1, towerTop - 3, 4, 4, NC);
        this.ctx.globalAlpha = beacon * 0.35;
        this.rect(tx - 1, towerTop - 5, 8, 8, NC);
        this.ctx.globalAlpha = 1;

        // Energy beam emanations (rotating dots around hub)
        const cx = bx + Math.floor(bw / 2);
        const cy = by + Math.floor(bh / 2);
        for (let i = 0; i < 6; i++) {
            const angle = this.time * 0.8 + (i / 6) * Math.PI * 2;
            const beamR = 10 + Math.sin(this.time * 2 + i) * 3;
            const ex = cx + Math.cos(angle) * beamR;
            const ey = cy + Math.sin(angle) * beamR * 0.5;
            this.ctx.globalAlpha = 0.5;
            this.px(ex, ey, NC);
            this.ctx.globalAlpha = 0.2;
            this.px(ex + Math.cos(angle), ey + Math.sin(angle) * 0.5, NC);
            this.ctx.globalAlpha = 1;
        }

        // Label
        this.text('FOREMAN', bx + bw / 2, by + bh + 12, NC, 10);
    }

    // ─── Data Portal (fountain replacement) ──────────

    drawFountain() {
        const f = FOUNTAIN;
        const cx = f.x;
        const cy = f.y;
        const r = f.r;

        const PC = TRON.CYAN;
        const PD = TRON.CYAN_DIM;
        const PI = '#001020';

        // Outer ring (elliptical top-down)
        const rh = Math.floor(r * 0.5);
        this.rect(cx - r, cy - rh, r * 2, r, PD);
        // Inner void
        const ir = r - 5;
        const irh = Math.floor(ir * 0.5);
        this.rect(cx - ir + 1, cy - irh + 1, ir * 2 - 2, ir - 2, PI);

        // Outer ring neon border
        this.rect(cx - r, cy - rh, r * 2, 1, PC);
        this.rect(cx - r, cy + rh - 1, r * 2, 1, PC);
        this.rect(cx - r, cy - rh, 1, r, PC);
        this.rect(cx + r - 1, cy - rh, 1, r, PC);

        // Inner ring border
        this.ctx.globalAlpha = 0.5;
        this.rect(cx - ir, cy - irh, ir * 2, 1, PC);
        this.rect(cx - ir, cy + irh - 1, ir * 2, 1, PC);
        this.rect(cx - ir, cy - irh, 1, ir, PC);
        this.rect(cx + ir - 1, cy - irh, 1, ir, PC);
        this.ctx.globalAlpha = 1;

        // Rotating ring data streams (outer)
        for (let i = 0; i < 10; i++) {
            const angle = this.time * 1.5 + (i / 10) * Math.PI * 2;
            const arcX = cx + Math.cos(angle) * (r - 3);
            const arcY = cy + Math.sin(angle) * ((r - 3) * 0.5);
            const alpha = 0.3 + (Math.sin(angle * 2) + 1) * 0.25;
            this.ctx.globalAlpha = alpha;
            this.px(arcX, arcY, PC);
            this.ctx.globalAlpha = 1;
        }

        // Counter-rotating inner ring (orange)
        for (let i = 0; i < 8; i++) {
            const angle = -this.time * 2.3 + (i / 8) * Math.PI * 2;
            const arcX = cx + Math.cos(angle) * (ir - 2);
            const arcY = cy + Math.sin(angle) * ((ir - 2) * 0.5);
            this.ctx.globalAlpha = 0.45;
            this.px(arcX, arcY, TRON.ORANGE);
            this.ctx.globalAlpha = 1;
        }

        // Portal core glow (center pulse)
        const coreGlow = 0.2 + Math.sin(this.time * 2.5) * 0.15;
        this.ctx.globalAlpha = coreGlow;
        this.rect(cx - 3, cy - 2, 6, 4, PC);
        this.ctx.globalAlpha = coreGlow * 0.4;
        this.rect(cx - 5, cy - 3, 10, 6, PC);
        this.ctx.globalAlpha = 1;

        // Data fragment particle emissions
        if (Math.random() < 0.1) {
            const angle = Math.random() * Math.PI * 2;
            particles.push(new Particle(
                cx + Math.cos(angle) * (ir * 0.6),
                cy + Math.sin(angle) * (ir * 0.3),
                Math.random() > 0.5 ? TRON.CYAN : TRON.ORANGE,
                20 + Math.floor(Math.random() * 15),
                (Math.random() - 0.5) * 0.2,
                -0.4 - Math.random() * 0.3,
                1
            ));
        }
    }

    drawAllBuildings() {
        for (const key of AGENT_ORDER) {
            if (!BUILDINGS[key]) continue;  // Foreman = dispatch hub, Overseer = no building
            this.drawBuilding(BUILDINGS[key]);
        }
        this.drawDispatchHub();
    }

    // ─── Data Nodes (bush replacement) ──────────────

    drawBush(bx, by, size) {
        const NC = TRON.CYAN;
        const ND = TRON.CYAN_DARK;

        if (size === 1) {
            // Small data terminal: 6x4 diamond
            this.rect(bx + 2, by, 2, 1, NC);
            this.rect(bx + 1, by + 1, 4, 1, ND);
            this.rect(bx + 1, by + 2, 4, 1, ND);
            this.rect(bx + 2, by + 3, 2, 1, NC);
            // Center glow pulse
            const g = 0.3 + Math.sin(this.time * 2 + bx * 0.1) * 0.25;
            this.ctx.globalAlpha = g;
            this.px(bx + 2, by + 1, NC);
            this.px(bx + 3, by + 2, NC);
            this.ctx.globalAlpha = 1;
        } else {
            // Large data terminal: 10x6 hexagonal node
            this.rect(bx + 3, by, 4, 1, NC);
            this.rect(bx + 1, by + 1, 8, 1, ND);
            this.rect(bx, by + 2, 10, 1, ND);
            this.rect(bx, by + 3, 10, 1, ND);
            this.rect(bx + 1, by + 4, 8, 1, ND);
            this.rect(bx + 3, by + 5, 4, 1, NC);
            // Left/right edges
            this.rect(bx, by + 2, 1, 2, NC);
            this.rect(bx + 9, by + 2, 1, 2, NC);
            // Pulsing center
            const g = 0.4 + Math.sin(this.time * 1.8 + bx * 0.07) * 0.35;
            this.ctx.globalAlpha = g;
            this.rect(bx + 4, by + 2, 2, 2, NC);
            this.ctx.globalAlpha = 1;
        }
    }

    drawBushes() {
        for (const bush of BUSH_POSITIONS) {
            this.drawBush(bush.x, bush.y, bush.size);
        }
    }

    // ─── Agent Rendering ───────────────────────────

    drawAgent(agentKey, viz) {
        const agent = AGENTS[agentKey];
        if (!agent) return;

        const x = viz.position.x;
        const y = viz.position.y;
        const isWalking = viz.vizState.startsWith('walk') || viz.vizState === 'delivering';
        const isWorking = viz.vizState === 'working';

        let dy = 0;
        let bobFrame = false;

        if (isWalking) {
            bobFrame = Math.floor(viz.walkTimer / 8) % 2 === 1;
            dy = bobFrame ? -1 : 0;
            if (viz.walkTimer % 10 === 0) spawnDust(x + 16, y + 28);
        } else if (isWorking) {
            dy = Math.sin(this.time * 4) * 1.5;
            if (Math.random() < 0.04) spawnSparkle(x + 16, y, agent.color);
        } else if (viz.vizState === 'idle') {
            dy = Math.sin(this.time * 1.2 + x * 0.05) * 0.8;
        } else if (viz.vizState === 'stalled') {
            const shake = Math.sin(this.time * 10) * 2;
            viz.position.x = viz.homeX + shake;
        }

        // Shadow glow (cyan-tinted)
        this.ctx.globalAlpha = 0.15;
        this.rect(x + 6, y + 28, 20, 3, TRON.CYAN);
        this.ctx.globalAlpha = 1;

        // Choose sprite frame
        const spriteData = (isWalking && bobFrame) ? agent.walkPixels : agent.frontPixels;
        const alpha = viz.vizState === 'offline' ? 0.3 : 1.0;

        if (viz.direction === 'left') {
            this.spriteFlip(spriteData, x, y + dy, alpha);
        } else {
            this.sprite(spriteData, x, y + dy, alpha);
        }

        // Carried data disc
        if (viz.hasScroll) {
            const scrollBob = Math.sin(this.time * 3) * 0.8;
            this.sprite(WORK_ITEM_SPRITE, x + 8, y - 12 + scrollBob);
        }

        // Held tool
        if (!viz.hasScroll && (viz.vizState === 'idle' || viz.vizState === 'working')) {
            this.drawAgentTool(agentKey, x, y + dy);
        }

        // Status indicator
        this.drawStatusBubble(agentKey, viz, x, y + dy);

        // Working glow
        if (isWorking) {
            const glowAlpha = 0.08 + Math.sin(this.time * 2) * 0.04;
            this.ctx.fillStyle = `rgba(${this.hexToRgb(agent.color)}, ${glowAlpha})`;
            this.ctx.fillRect((x - 4) * this.pixel, (y + 22) * this.pixel, 40 * this.pixel, 10 * this.pixel);
        }
    }

    drawAgentTool(agentKey, x, y) {
        const toolSprite = AGENT_TOOLS[agentKey];
        if (!toolSprite) return;
        const toolBob = Math.sin(this.time * 2.5 + x * 0.1) * 0.8;
        this.sprite(toolSprite, x + 26, y + 12 + toolBob);
    }

    drawStatusBubble(agentKey, viz, x, y) {
        switch (viz.vizState) {
            case 'idle': {
                const agent = AGENTS[agentKey];
                if (Math.sin(this.time * 2 + x * 0.3) > 0.85) {
                    this.px(x + 28 + Math.random() * 5, y + 8 + Math.random() * 5, agent.color);
                }
                break;
            }
            case 'working': {
                const a = this.time * 3;
                for (let i = 0; i < 3; i++) {
                    const da = a + (i * Math.PI * 2 / 3);
                    this.px(x + 16 + Math.cos(da) * 8, y - 8 + Math.sin(da) * 3, TRON.CYAN);
                }
                break;
            }
            case 'stalled': {
                if (Math.sin(this.time * 5) > 0) {
                    this.sprite(ALERT_SPRITE, x + 12, y - 18);
                }
                break;
            }
            case 'picking_up': {
                this.text('!', x + 20, y - 6, TRON.CYAN, 12);
                break;
            }
            case 'celebrating': {
                this.sprite(CHECK_SPRITE, x + 12, y - 14);
                break;
            }
        }
    }

    // ─── Work Queue Display ────────────────────────

    drawWorkQueue(activeItems) {
        if (!activeItems || activeItems.length === 0) return;

        const d = DISPATCH;
        const max = Math.min(activeItems.length, 5);
        for (let i = 0; i < max; i++) {
            const sx = d.x - 20 + i * 18;
            const sy = d.y + 8;
            const bob = Math.sin(this.time * 2 + i) * 1;
            this.sprite(WORK_ITEM_SPRITE, sx, sy + bob);
        }

        if (activeItems.length > 5) {
            this.text(`+${activeItems.length - 5}`, d.x + d.w + 8, d.y + 18, TRON.TEXT_DIM, 10);
        }
    }

    // ─── Stats Bar ─────────────────────────────────

    drawStats(agentStates) {
        const agents = Object.values(agentStates || {});
        const working = agents.filter(a => a.apiStatus === 'working').length;
        const idle = agents.filter(a => a.apiStatus === 'idle').length;

        // Dark transparent bar
        this.ctx.fillStyle = 'rgba(0, 5, 16, 0.75)';
        this.ctx.fillRect(0, (SCENE_H - 18) * this.pixel, SCENE_W * this.pixel, 18 * this.pixel);

        // Cyan top border
        this.ctx.fillStyle = 'rgba(0, 223, 252, 0.25)';
        this.ctx.fillRect(0, (SCENE_H - 18) * this.pixel, SCENE_W * this.pixel, 1 * this.pixel);

        this.text(
            `${working} ACTIVE  ${idle} STANDBY`,
            SCENE_W / 2, SCENE_H - 5,
            TRON.TEXT_DIM, 10
        );
    }

    // ─── Particles ─────────────────────────────────

    drawParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.update();
            if (p.dead) { particles.splice(i, 1); continue; }
            this.ctx.globalAlpha = p.alpha;
            this.px(p.x, p.y, p.color);
        }
        this.ctx.globalAlpha = 1;
    }

    // ─── Utility ───────────────────────────────────

    lighten(hex, amt) {
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);
        r = Math.min(255, r + amt); g = Math.min(255, g + amt); b = Math.min(255, b + amt);
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    }

    darken(hex, amt) { return this.lighten(hex, -amt); }

    hexToRgb(hex) {
        return `${parseInt(hex.slice(1,3),16)}, ${parseInt(hex.slice(3,5),16)}, ${parseInt(hex.slice(5,7),16)}`;
    }

    // ─── Fireworks ──────────────────────────────────

    updateAndDrawFireworks() {
        for (let i = fireworks.length - 1; i >= 0; i--) {
            const fw = fireworks[i];
            const done = fw.update();
            if (done) { fireworks.splice(i, 1); continue; }
            if (fw.delay > 0) continue;

            this.ctx.globalAlpha = 1;
            this.px(fw.x, fw.y, '#FFFFFF');
            this.px(fw.x, fw.y + 1, fw.palette[0]);
        }

        for (let i = fireworkParticles.length - 1; i >= 0; i--) {
            const p = fireworkParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.99;
            p.life--;

            if (p.life <= 0) { fireworkParticles.splice(i, 1); continue; }

            const alpha = Math.max(0, p.life / p.maxLife);
            this.ctx.globalAlpha = alpha;

            if (p.size >= 2) {
                this.rect(p.x, p.y, 2, 2, p.color);
            } else {
                this.px(p.x, p.y, p.color);
            }
        }

        this.ctx.globalAlpha = 1;
    }

    // ─── Main Render ───────────────────────────────

    render(agentVizStates, activeWorkItems) {
        this.time += 0.016;

        this.drawGrass();
        this.drawRoads();
        this.drawFountain();
        this.drawAllBuildings();
        this.drawBushes();

        this.drawWorkQueue(activeWorkItems);

        // Agents sorted by Y for depth
        const sorted = AGENT_ORDER.slice().sort((a, b) => {
            const ay = agentVizStates[a]?.position?.y || 0;
            const by2 = agentVizStates[b]?.position?.y || 0;
            return ay - by2;
        });
        for (const key of sorted) {
            const viz = agentVizStates[key];
            if (viz) this.drawAgent(key, viz);
        }

        this.drawParticles();
        this.updateAndDrawFireworks();
        this.drawStats(agentVizStates);
    }
}
