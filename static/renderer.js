/**
 * Workshop Town - Stardew Valley Style Renderer (2x Resolution)
 *
 * Top-down 3/4 view. Scene is 480x320 pixel-art pixels at 2x scale (960x640).
 * Buildings have chimneys, textured walls, multi-pane windows, flower boxes.
 * Fountain with animated water effects near dispatch plaza.
 */

const SCENE_W = 480;
const SCENE_H = 320;

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
            '#9B8365',
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
            color || '#FFDD44',
            20 + Math.floor(Math.random() * 15),
            (Math.random() - 0.5) * 0.4,
            -0.15 - Math.random() * 0.25,
            1
        ));
    }
}

function spawnCompletionBurst(x, y) {
    const colors = ['#FFDD44', '#44FF88', '#44DDFF', '#FF88CC'];
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
//  FIREWORKS
// ═══════════════════════════════════════════════════════

const fireworks = [];
const fireworkParticles = [];

const FIREWORK_PALETTES = [
    ['#FF4444', '#FF6666', '#FF8888', '#FFAAAA'],
    ['#44FF44', '#66FF66', '#88FF88', '#AAFFAA'],
    ['#4488FF', '#66AAFF', '#88CCFF', '#AADDFF'],
    ['#FFDD44', '#FFEE66', '#FFFF88', '#FFFFAA'],
    ['#FF44DD', '#FF66EE', '#FF88FF', '#FFAAFF'],
    ['#44FFEE', '#66FFFF', '#88FFFF', '#BBFFFF'],
    ['#FF8844', '#FFAA66', '#FFCC88', '#FFDDAA'],
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
 * GRAND FINALE -- Massive fireworks show across the entire scene.
 * Launches 40+ rockets in waves from multiple positions with staggered timing.
 * Triggered by pressing 'F' key or after all agents complete a convoy.
 */
function spawnGrandFinale() {
    const launchPoints = [
        { x: 60, y: 300 },    // left
        { x: 160, y: 300 },   // center-left
        { x: 240, y: 300 },   // center
        { x: 320, y: 300 },   // center-right
        { x: 420, y: 300 },   // right
        { x: 100, y: 280 },   // mid-left
        { x: 380, y: 280 },   // mid-right
    ];

    let delay = 0;

    // Wave 1: scattered rockets (0-30 frames)
    for (let w = 0; w < 3; w++) {
        for (const pt of launchPoints) {
            const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
            const targetY = 10 + Math.random() * 40;
            const jitterX = pt.x + (Math.random() - 0.5) * 40;
            fireworks.push(new FireworkRocket(jitterX, pt.y, targetY, palette, delay + Math.floor(Math.random() * 10)));
        }
        delay += 30;
    }

    // Wave 2: rapid-fire center burst (90-120 frames)
    for (let i = 0; i < 15; i++) {
        const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
        const x = 160 + Math.random() * 160;
        fireworks.push(new FireworkRocket(x, 310, 8 + Math.random() * 35, palette, delay + i * 3));
    }
    delay += 50;

    // Wave 3: grand crescendo -- everything at once
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
        ctx.fillStyle = color || '#FFFFFF';
        ctx.font = `${size || 10}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(str, x * this.pixel, y * this.pixel);
    }

    // ─── Background: Grass ─────────────────────────

    initGrass() {
        const p = this.pixel;
        const off = document.createElement('canvas');
        off.width = SCENE_W * p;
        off.height = SCENE_H * p;
        const ctx = off.getContext('2d');

        for (let y = 0; y < SCENE_H; y++) {
            for (let x = 0; x < SCENE_W; x++) {
                const ci = ((x * 7 + y * 13) ^ (x * 3 + y * 5)) % GRASS_COLORS.length;
                ctx.fillStyle = GRASS_COLORS[ci];
                ctx.fillRect(x * p, y * p, p, p);
            }
        }

        // More flowers for larger scene
        const rng = this.seededRandom(42);
        for (let i = 0; i < 300; i++) {
            const fx = Math.floor(rng() * SCENE_W);
            const fy = Math.floor(rng() * SCENE_H);
            const fc = GRASS_FLOWER_COLORS[Math.floor(rng() * GRASS_FLOWER_COLORS.length)];
            ctx.fillStyle = fc;
            ctx.fillRect(fx * p, fy * p, p, p);
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

    // ─── Background: Roads ─────────────────────────

    drawRoads() {
        for (const seg of ROAD_SEGMENTS) {
            const x1 = Math.min(seg.x1, seg.x2);
            const y1 = Math.min(seg.y1, seg.y2);
            const x2 = Math.max(seg.x1, seg.x2);
            const y2 = Math.max(seg.y1, seg.y2);
            const hw = Math.floor(seg.w / 2);

            if (x1 === x2) {
                // Vertical road
                this.rect(x1 - hw, y1, seg.w, y2 - y1 + 1, DIRT_COLOR);
                // Edge stones
                this.rect(x1 - hw, y1, 1, y2 - y1 + 1, DIRT_DARK);
                this.rect(x1 + hw, y1, 1, y2 - y1 + 1, DIRT_DARK);
                // Gravel texture (denser)
                const rng = this.seededRandom(x1 * 100 + y1);
                for (let ty = y1; ty < y2; ty += 3) {
                    const tx = x1 - hw + 1 + Math.floor(rng() * (seg.w - 2));
                    this.px(tx, ty, DIRT_LIGHT);
                    // Pebbles
                    if (rng() < 0.35) {
                        const px2 = x1 - hw + 2 + Math.floor(rng() * (seg.w - 4));
                        this.px(px2, ty + 1, '#7a6345');
                    }
                    if (rng() < 0.2) {
                        const px3 = x1 - hw + 1 + Math.floor(rng() * (seg.w - 2));
                        this.px(px3, ty + 2, '#a89375');
                    }
                }
                // Wheel ruts
                if (seg.w >= 8) {
                    for (let ty2 = y1 + 2; ty2 < y2; ty2 += 2) {
                        this.ctx.globalAlpha = 0.12;
                        this.px(x1 - 1, ty2, DIRT_DARK);
                        this.px(x1 + 1, ty2, DIRT_DARK);
                        this.ctx.globalAlpha = 1;
                    }
                }
            } else {
                // Horizontal road
                this.rect(x1, y1 - hw, x2 - x1 + 1, seg.w, DIRT_COLOR);
                this.rect(x1, y1 - hw, x2 - x1 + 1, 1, DIRT_DARK);
                this.rect(x1, y1 + hw, x2 - x1 + 1, 1, DIRT_DARK);
                // Gravel texture
                const rng = this.seededRandom(x1 + y1 * 100);
                for (let tx = x1; tx < x2; tx += 3) {
                    const ty = y1 - hw + 1 + Math.floor(rng() * (seg.w - 2));
                    this.px(tx, ty, DIRT_LIGHT);
                    if (rng() < 0.35) {
                        const py2 = y1 - hw + 2 + Math.floor(rng() * (seg.w - 4));
                        this.px(tx + 1, py2, '#7a6345');
                    }
                    if (rng() < 0.2) {
                        const py3 = y1 - hw + 1 + Math.floor(rng() * (seg.w - 2));
                        this.px(tx + 2, py3, '#a89375');
                    }
                }
                // Wheel ruts
                if (seg.w >= 8) {
                    for (let tx2 = x1 + 2; tx2 < x2; tx2 += 2) {
                        this.ctx.globalAlpha = 0.12;
                        this.px(tx2, y1 - 1, DIRT_DARK);
                        this.px(tx2, y1 + 1, DIRT_DARK);
                        this.ctx.globalAlpha = 1;
                    }
                }
            }
        }

        // Dispatch plaza
        const plx = DISPATCH.x - 12;
        const ply = DISPATCH.y - 8;
        const plw = DISPATCH.w + 24;
        const plh = DISPATCH.h + 16;
        this.rect(plx, ply, plw, plh, DIRT_COLOR);
        // Plaza border stones
        this.rect(plx, ply, plw, 1, DIRT_DARK);
        this.rect(plx, ply + plh - 1, plw, 1, DIRT_DARK);
        this.rect(plx, ply, 1, plh, DIRT_DARK);
        this.rect(plx + plw - 1, ply, 1, plh, DIRT_DARK);
        // Cobblestone pattern
        const plRng = this.seededRandom(999);
        for (let ty = ply + 2; ty < ply + plh - 2; ty += 3) {
            const rowOff = (Math.floor(ty / 3) % 2) * 2;
            for (let tx = plx + 2 + rowOff; tx < plx + plw - 2; tx += 5) {
                this.rect(tx, ty, 3, 2, plRng() > 0.5 ? '#8a7a60' : '#7a6a50');
                this.px(tx + 3, ty, '#6a5a40');
                this.px(tx, ty + 2, '#6a5a40');
            }
        }
    }

    // ─── Buildings (detailed) ─────────────────────

    drawBuilding(cfg) {
        const { x, y, w, h, roofColor, wallColor, label } = cfg;

        // Shadow
        this.rect(x + 3, y + 3, w, h, 'rgba(0,0,0,0.15)');

        // Foundation
        this.rect(x - 1, y + h - 2, w + 2, 3, '#3a2a1a');

        // Walls
        this.rect(x, y + 8, w, h - 8, wallColor);
        // Wall texture (stone/wood grain)
        const rng = this.seededRandom(x * 7 + y * 13);
        for (let ty = y + 9; ty < y + h - 2; ty += 3) {
            for (let tx = x + 1; tx < x + w - 1; tx += 4) {
                const offset = Math.floor(rng() * 3);
                this.px(tx + offset, ty, '#6a5a4a');
            }
        }
        // Wall highlight stripe
        this.rect(x + 1, y + 9, w - 2, 1, '#6a5a4a');

        // Roof (extends past walls)
        this.rect(x - 2, y, w + 4, 9, roofColor);
        // Roof ridge
        this.rect(x, y + 1, w, 1, this.lighten(roofColor, 40));
        this.rect(x - 1, y + 2, w + 2, 1, this.lighten(roofColor, 20));
        // Roof shingle lines
        this.rect(x - 2, y + 4, w + 4, 1, this.darken(roofColor, 15));
        this.rect(x - 2, y + 7, w + 4, 1, this.darken(roofColor, 15));
        // Roof edge shadow
        this.rect(x - 2, y + 8, w + 4, 1, this.darken(roofColor, 50));

        // Chimney
        const cx = x + w - 8;
        this.rect(cx, y - 5, 5, 7, '#6a4a3a');
        this.rect(cx + 1, y - 5, 3, 1, '#7a5a4a');
        this.rect(cx, y - 6, 7, 2, '#5a3a2a');
        // Smoke (animated)
        if (Math.sin(this.time * 1.5 + x) > -0.3) {
            const sy = y - 8 - Math.sin(this.time * 2 + x * 0.1) * 3;
            this.ctx.globalAlpha = 0.25;
            this.px(cx + 2, sy, '#AAAAAA');
            this.px(cx + 3, sy - 1, '#BBBBBB');
            this.px(cx + 1, sy - 2, '#CCCCCC');
            this.ctx.globalAlpha = 1;
        }

        // Door
        const dx = x + Math.floor(w / 2) - 3;
        this.rect(dx, y + h - 10, 7, 10, '#2a1a10');
        this.rect(dx + 1, y + h - 9, 5, 8, '#3a2a1a');
        // Door arch
        this.rect(dx + 1, y + h - 10, 5, 1, '#4a3a2a');
        // Door handle
        this.px(dx + 5, y + h - 5, '#C8A858');

        // Windows (multi-pane with shutters)
        if (w >= 30) {
            this.drawWindow(x + 4, y + 12, roofColor);
            this.drawWindow(x + w - 12, y + 12, roofColor);
        }

        // Label below building (white, larger)
        this.text(label, x + w / 2, y + h + 12, '#FFFFFF', 12);
    }

    drawWindow(wx, wy, accentColor) {
        // Shutters
        this.rect(wx - 1, wy, 1, 7, this.darken(accentColor, 20));
        this.rect(wx + 8, wy, 1, 7, this.darken(accentColor, 20));
        // Window frame
        this.rect(wx, wy, 8, 7, '#445566');
        // Glass panes (2x2 grid)
        this.rect(wx + 1, wy + 1, 3, 2, '#6688aa');
        this.rect(wx + 5, wy + 1, 2, 2, '#6688aa');
        this.rect(wx + 1, wy + 4, 3, 2, '#5577aa');
        this.rect(wx + 5, wy + 4, 2, 2, '#5577aa');
        // Highlight
        this.px(wx + 1, wy + 1, '#88aacc');
        // Flower box
        this.rect(wx - 1, wy + 7, 10, 2, '#5a3a2a');
        // Flowers
        this.px(wx, wy + 7, '#FF6688');
        this.px(wx + 3, wy + 7, '#FFDD44');
        this.px(wx + 6, wy + 7, '#FF6688');
        this.px(wx + 8, wy + 7, '#88DD44');
    }

    drawDispatchHub() {
        const d = DISPATCH;
        const bx = d.x - 4;
        const by = d.y - 16;
        const bw = d.w + 8;
        const bh = d.h + 16;

        // Shadow
        this.rect(bx + 3, by + 3, bw, bh, 'rgba(0,0,0,0.15)');

        // Foundation
        this.rect(bx - 1, by + bh - 2, bw + 2, 3, '#3a2a1a');

        // Walls
        this.rect(bx, by + 10, bw, bh - 10, '#5a4a3a');
        // Wall texture (stone)
        const rng = this.seededRandom(bx * 7 + by * 13);
        for (let ty = by + 11; ty < by + bh - 2; ty += 3) {
            for (let tx = bx + 1; tx < bx + bw - 1; tx += 4) {
                const offset = Math.floor(rng() * 3);
                this.px(tx + offset, ty, '#6a5a4a');
            }
        }
        this.rect(bx + 1, by + 11, bw - 2, 1, '#6a5a4a');

        // Roof (wider, amber/gold to stand out as central building)
        const roofColor = '#8B6B0B';
        this.rect(bx - 3, by, bw + 6, 11, roofColor);
        // Roof ridge
        this.rect(bx - 1, by + 1, bw + 2, 1, this.lighten(roofColor, 40));
        this.rect(bx - 2, by + 2, bw + 4, 1, this.lighten(roofColor, 20));
        // Roof shingle lines
        this.rect(bx - 3, by + 4, bw + 6, 1, this.darken(roofColor, 15));
        this.rect(bx - 3, by + 7, bw + 6, 1, this.darken(roofColor, 15));
        // Roof edge shadow
        this.rect(bx - 3, by + 10, bw + 6, 1, this.darken(roofColor, 50));

        // Bell tower / cupola (centered above roof)
        const tw = 14;
        const tx = bx + Math.floor(bw / 2) - Math.floor(tw / 2);
        const towerTop = by - 18;
        // Tower walls
        this.rect(tx, towerTop + 6, tw, 13, '#6a5a4a');
        this.rect(tx + 1, towerTop + 7, tw - 2, 1, '#7a6a5a');
        // Tower roof (peaked)
        this.rect(tx - 1, towerTop + 4, tw + 2, 3, this.darken(roofColor, 10));
        this.rect(tx + 1, towerTop + 2, tw - 2, 3, roofColor);
        this.rect(tx + 3, towerTop, tw - 6, 3, this.lighten(roofColor, 15));
        // Tower window (arched)
        this.rect(tx + 4, towerTop + 9, tw - 8, 5, '#445566');
        this.rect(tx + 5, towerTop + 10, tw - 10, 3, '#6688aa');
        this.px(tx + 5, towerTop + 10, '#88aacc');
        // Beacon glow on tower top
        const glow = 0.4 + Math.sin(this.time * 2) * 0.25;
        this.ctx.globalAlpha = glow;
        this.rect(tx + 4, towerTop - 2, tw - 8, 3, '#FFDD44');
        this.rect(tx + 5, towerTop - 3, tw - 10, 2, '#FFEE88');
        this.ctx.globalAlpha = 1;

        // Chimney (right side)
        const cx = bx + bw - 8;
        this.rect(cx, by - 5, 5, 7, '#6a4a3a');
        this.rect(cx + 1, by - 5, 3, 1, '#7a5a4a');
        this.rect(cx, by - 6, 7, 2, '#5a3a2a');
        if (Math.sin(this.time * 1.5 + bx) > -0.3) {
            const sy = by - 8 - Math.sin(this.time * 2 + bx * 0.1) * 3;
            this.ctx.globalAlpha = 0.25;
            this.px(cx + 2, sy, '#AAAAAA');
            this.px(cx + 3, sy - 1, '#BBBBBB');
            this.px(cx + 1, sy - 2, '#CCCCCC');
            this.ctx.globalAlpha = 1;
        }

        // Double doors
        const dx = bx + Math.floor(bw / 2) - 5;
        this.rect(dx, by + bh - 12, 10, 12, '#2a1a10');
        this.rect(dx + 1, by + bh - 11, 4, 10, '#3a2a1a');
        this.rect(dx + 6, by + bh - 11, 3, 10, '#3a2a1a');
        // Door arch
        this.rect(dx + 1, by + bh - 12, 8, 1, '#4a3a2a');
        // Door handles
        this.px(dx + 4, by + bh - 6, '#C8A858');
        this.px(dx + 6, by + bh - 6, '#C8A858');

        // Windows (flanking the door)
        this.drawWindow(bx + 4, by + 14, roofColor);
        if (bw >= 40) {
            this.drawWindow(bx + bw - 12, by + 14, roofColor);
        }

        // Label
        this.text('FOREMAN', bx + bw / 2, by + bh + 12, '#CCBB88', 10);
    }

    // ─── Fountain ─────────────────────────────────

    drawFountain() {
        const f = FOUNTAIN;
        const cx = f.x;
        const cy = f.y;
        const r = f.r;

        // Outer stone rim (octagonal, thick)
        this.rect(cx - r, cy - r / 2, r * 2, r, '#6a6a6a');
        this.rect(cx - r + 3, cy - r / 2 - 2, r * 2 - 6, r + 4, '#6a6a6a');
        // Outer rim highlight
        this.rect(cx - r + 1, cy - r / 2, r * 2 - 2, 2, '#8a8a8a');
        this.rect(cx - r + 4, cy - r / 2 - 1, r * 2 - 8, 1, '#9a9a9a');
        // Outer rim shadow
        this.rect(cx - r + 1, cy + r / 2 - 1, r * 2 - 2, 2, '#4a4a4a');
        // Rim texture
        const rimRng = this.seededRandom(cx * 31 + cy * 17);
        for (let a = 0; a < 12; a++) {
            const rx = cx - r + 2 + Math.floor(rimRng() * (r * 2 - 4));
            const ry = cy - r / 2 + Math.floor(rimRng() * r);
            this.px(rx, ry, rimRng() > 0.5 ? '#7a7a7a' : '#5a5a5a');
        }

        // Inner stone rim (second tier)
        const ir = r - 5;
        this.rect(cx - ir, cy - ir / 2, ir * 2, ir, '#7a7a7a');
        this.rect(cx - ir + 2, cy - ir / 2 - 1, ir * 2 - 4, ir + 2, '#7a7a7a');
        this.rect(cx - ir + 1, cy - ir / 2, ir * 2 - 2, 1, '#9a9a9a');

        // Water pool (outer ring)
        this.rect(cx - r + 3, cy - r / 2 + 3, r * 2 - 6, r - 6, '#2255AA');
        this.rect(cx - r + 5, cy - r / 2 + 2, r * 2 - 10, r - 4, '#2255AA');

        // Water pool (inner ring - lighter)
        this.rect(cx - ir + 2, cy - ir / 2 + 2, ir * 2 - 4, ir - 4, '#3366BB');

        // Water shimmer (multiple animated highlights)
        const shimmer1 = Math.sin(this.time * 3) * 0.15;
        const shimmer2 = Math.sin(this.time * 2.3 + 1.5) * 0.12;
        this.ctx.globalAlpha = 0.45 + shimmer1;
        this.rect(cx - r + 6, cy - r / 2 + 4, 5, 1, '#66AADD');
        this.rect(cx + 4, cy - 2, 4, 1, '#66AADD');
        this.rect(cx - 8, cy + 2, 3, 1, '#5599CC');
        this.ctx.globalAlpha = 0.35 + shimmer2;
        this.rect(cx + r - 12, cy - r / 2 + 5, 4, 1, '#77BBEE');
        this.rect(cx - 3, cy + r / 2 - 5, 5, 1, '#5599CC');
        this.ctx.globalAlpha = 1;

        // Center pillar (taller, more detailed)
        const pillarH = r / 2 + 8;
        this.rect(cx - 3, cy - r / 2 - pillarH + 4, 6, pillarH, '#777777');
        this.rect(cx - 2, cy - r / 2 - pillarH + 4, 4, pillarH, '#888888');
        this.rect(cx - 1, cy - r / 2 - pillarH + 5, 2, pillarH - 2, '#999999');
        // Pillar base (wider)
        this.rect(cx - 4, cy - ir / 2 + 1, 8, 3, '#666666');
        this.rect(cx - 5, cy - ir / 2 + 2, 10, 2, '#555555');
        // Pillar cap (ornamental)
        const capY = cy - r / 2 - pillarH + 2;
        this.rect(cx - 5, capY, 10, 3, '#666666');
        this.rect(cx - 4, capY - 1, 8, 2, '#777777');
        this.rect(cx - 3, capY - 2, 6, 2, '#888888');

        // Water spouts (more of them, arcing outward)
        const spoutY = capY;
        for (let i = 0; i < 6; i++) {
            const t = (this.time * 1.8 + i * 0.6) % 3;
            const angle = (i / 6) * Math.PI * 2 + this.time * 0.3;
            const dropY = spoutY + t * 4 + (t > 0.8 ? (t - 0.8) * 3 : 0);
            const dropX = cx + Math.cos(angle) * (3 + t * 2.5);
            const alpha = t < 2.2 ? 0.65 : 0.2;
            this.ctx.globalAlpha = alpha;
            this.px(dropX, dropY, '#88CCFF');
            if (t > 0.5 && t < 2.0) {
                this.px(dropX + (Math.cos(angle) > 0 ? 1 : -1), dropY + 1, '#77BBEE');
            }
            this.ctx.globalAlpha = 1;
        }

        // Splash particles at water surface (more frequent)
        if (Math.random() < 0.1) {
            const splashAngle = Math.random() * Math.PI * 2;
            particles.push(new Particle(
                cx + Math.cos(splashAngle) * (r * 0.5),
                cy + Math.sin(splashAngle) * (r * 0.25),
                '#88CCFF',
                18 + Math.floor(Math.random() * 12),
                (Math.random() - 0.5) * 0.3,
                -0.35 - Math.random() * 0.25,
                1
            ));
        }

        // Decorative corner posts on outer rim
        const posts = [
            { x: cx - r + 1, y: cy - r / 2 },
            { x: cx + r - 2, y: cy - r / 2 },
            { x: cx - r + 1, y: cy + r / 2 - 2 },
            { x: cx + r - 2, y: cy + r / 2 - 2 },
        ];
        for (const p of posts) {
            this.rect(p.x, p.y, 2, 2, '#555555');
            this.px(p.x, p.y, '#8a8a8a');
        }
    }

    drawAllBuildings() {
        for (const key of AGENT_ORDER) {
            if (!BUILDINGS[key]) continue;  // Foreman = dispatch hub, Overseer = no building
            this.drawBuilding(BUILDINGS[key]);
        }
        this.drawDispatchHub();
    }

    // ─── Bushes ──────────────────────────────────────

    drawBush(bx, by, size) {
        const rng = this.seededRandom(bx * 23 + by * 37);
        const colors = ['#2a6a1a', '#327a22', '#1e5e14', '#3a8a2a'];
        const darkColors = ['#1a5a0a', '#225a12', '#164e0c'];
        const flowerColors = ['#FF8899', '#FFDD55', '#FF6688', '#AADDFF'];

        if (size === 1) {
            // Small bush: 6x4 cluster
            for (let dy = 0; dy < 4; dy++) {
                for (let dx = 0; dx < 6; dx++) {
                    if ((dx === 0 || dx === 5) && (dy === 0 || dy === 3)) continue;
                    this.px(bx + dx, by + dy, colors[Math.floor(rng() * colors.length)]);
                }
            }
            // Shadow at base
            this.ctx.globalAlpha = 0.2;
            this.rect(bx + 1, by + 4, 4, 1, '#000000');
            this.ctx.globalAlpha = 1;
            // Highlight
            this.px(bx + 2, by, '#4aaa3a');
        } else {
            // Large bush: 10x6 cluster (two overlapping mounds)
            // Left mound
            for (let dy = 1; dy < 6; dy++) {
                for (let dx = 0; dx < 7; dx++) {
                    if ((dx === 0 || dx === 6) && (dy <= 1 || dy >= 5)) continue;
                    this.px(bx + dx, by + dy, colors[Math.floor(rng() * colors.length)]);
                }
            }
            // Right mound (overlapping)
            for (let dy = 0; dy < 5; dy++) {
                for (let dx = 4; dx < 10; dx++) {
                    if ((dx === 4 || dx === 9) && (dy === 0 || dy >= 4)) continue;
                    this.px(bx + dx, by + dy, colors[Math.floor(rng() * colors.length)]);
                }
            }
            // Dark spots for depth
            for (let i = 0; i < 4; i++) {
                const sx = bx + 1 + Math.floor(rng() * 8);
                const sy = by + 2 + Math.floor(rng() * 3);
                this.px(sx, sy, darkColors[Math.floor(rng() * darkColors.length)]);
            }
            // Highlights
            this.px(bx + 2, by + 1, '#4aaa3a');
            this.px(bx + 6, by, '#4aaa3a');
            // Occasional flower
            if (rng() > 0.4) {
                this.px(bx + 3, by + 1, flowerColors[Math.floor(rng() * flowerColors.length)]);
            }
            if (rng() > 0.5) {
                this.px(bx + 7, by, flowerColors[Math.floor(rng() * flowerColors.length)]);
            }
            // Shadow at base
            this.ctx.globalAlpha = 0.2;
            this.rect(bx + 1, by + 6, 8, 1, '#000000');
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

        // Shadow (wider for 2x sprites)
        this.ctx.globalAlpha = 0.2;
        this.rect(x + 6, y + 28, 20, 3, '#000000');
        this.ctx.globalAlpha = 1;

        // Choose sprite frame (32x32 upscaled)
        const spriteData = (isWalking && bobFrame) ? agent.walkPixels : agent.frontPixels;
        const alpha = viz.vizState === 'offline' ? 0.3 : 1.0;

        if (viz.direction === 'left') {
            this.spriteFlip(spriteData, x, y + dy, alpha);
        } else {
            this.sprite(spriteData, x, y + dy, alpha);
        }

        // Carried scroll
        if (viz.hasScroll) {
            const scrollBob = Math.sin(this.time * 3) * 0.8;
            this.sprite(WORK_ITEM_SPRITE, x + 8, y - 12 + scrollBob);
        }

        // Held tool (idle or working at home)
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
                    this.px(x + 16 + Math.cos(da) * 8, y - 8 + Math.sin(da) * 3, '#FFDD44');
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
                this.text('!', x + 20, y - 6, '#FFDD44', 12);
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
            this.text(`+${activeItems.length - 5}`, d.x + d.w + 8, d.y + 18, '#887744', 10);
        }
    }

    // ─── Stats Bar ─────────────────────────────────

    drawStats(agentStates) {
        const agents = Object.values(agentStates || {});
        const working = agents.filter(a => a.apiStatus === 'working').length;
        const idle = agents.filter(a => a.apiStatus === 'idle').length;

        this.ctx.fillStyle = 'rgba(10, 10, 20, 0.6)';
        this.ctx.fillRect(0, (SCENE_H - 18) * this.pixel, SCENE_W * this.pixel, 18 * this.pixel);

        this.text(
            `${working} WORKING  ${idle} IDLE`,
            SCENE_W / 2, SCENE_H - 5,
            '#888899', 10
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
        // Update and draw rockets
        for (let i = fireworks.length - 1; i >= 0; i--) {
            const fw = fireworks[i];
            const done = fw.update();
            if (done) { fireworks.splice(i, 1); continue; }
            if (fw.delay > 0) continue;

            this.ctx.globalAlpha = 1;
            this.px(fw.x, fw.y, '#FFFFFF');
            this.px(fw.x, fw.y + 1, fw.palette[0]);
        }

        // Update and draw burst particles
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
            const by = agentVizStates[b]?.position?.y || 0;
            return ay - by;
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
