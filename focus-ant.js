/* focus-ant.js: the Focus ant mascot (option A, "Soft legs"). No dependencies.
   Draws into any <svg> or <g>, in currentColor, so CSS sets the colour.
   Geometry is in the Focus mark's units (u): the body is the F's stem
   (abdomen = A2, thorax = C2, head = B2 grown slightly), legs and antennae are soft strokes.
   The walk is procedural: feet stay planted on the page while the body moves, and they step
   in alternating tripods only when stretched. Call update(dt) every frame; you own the wander logic. */

export const ANT = {
  body: { abd: [-3.95, 2.55], tho: [0, 1.236], head: [3.5, 2.05] },   // [x along the body, radius], thorax at 0,0, facing +x
  eyes: [[1.0, 0.8], [1.0, -0.8]], eyeR: 0.44,                         // cut-outs, relative to the head centre
  hips: [[0.5, 0.85], [0, 1.0], [-0.5, 0.85]],                         // front, mid, hind (y mirrored on the left)
  feet: [[2.75, 3.0], [0.15, 3.55], [-2.85, 3.15]],                    // neutral foot positions
  legW: 0.6, antW: 0.48, tipR: 0.55, crumbR: 1.35, crumbGap: 2.05,
  variants: { soft: [0, 1, 2], four: [0, 2] },                          // which leg pairs are drawn ("pips" is drawn as foot dots)
};

const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a) * t, rnd = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const f2 = v => v.toFixed(2);
const circ = (x, y, r) => `M${f2(x - r)} ${f2(y)}a${f2(r)} ${f2(r)} 0 1 0 ${f2(2 * r)} 0a${f2(r)} ${f2(r)} 0 1 0 ${f2(-2 * r)} 0Z`;
const ell = (x, y, rx, ry, deg) => { const a = deg * Math.PI / 180, dx = Math.cos(a) * rx, dy = Math.sin(a) * rx;
  return `M${f2(x - dx)} ${f2(y - dy)}A${f2(rx)} ${f2(ry)} ${f2(deg)} 1 0 ${f2(x + dx)} ${f2(y + dy)}A${f2(rx)} ${f2(ry)} ${f2(deg)} 1 0 ${f2(x - dx)} ${f2(y - dy)}Z`; };
const GROUP = (side, i) => ((i % 2 === 0) === (side > 0)) ? 0 : 1;      // tripods: R1 L2 R3 | L1 R2 L3
const mk = (p, t, a = {}) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };

export class FocusAnt {
  /** parent: <svg> or <g> in page pixels. scale: px per mark unit (3.2 ≈ 32px long, 2.1 ≈ 24px). */
  constructor(parent, { x = 0, y = 0, heading = 0, scale = 3.2, variant = 'soft' } = {}) {
    Object.assign(this, { x, y, h: heading, s: scale, v: variant, speed: 0, cruise: 1, target: null, state: 'idle', timer: 0,
      hop: 0, wag: 0, bob: 0, blink: 1, look: [0, 0], lookTarget: null, crumb: null, onDone: null });
    this.g = mk(parent, 'g', { 'aria-hidden': 'true' });
    this.feet = [];
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) { const w = this.toWorld(ANT.feet[i][0], ANT.feet[i][1] * s); this.feet.push({ s, i, x: w[0], y: w[1], fx: w[0], fy: w[1], tx: w[0], ty: w[1], t: 1 }); }
    this.abd = this.toWorld(ANT.body.abd[0], 0);
    this.ant = [{ a: 0, v: 0, t: 0 }, { a: 0, v: 0, t: 0 }]; this.antClock = 0; this.blinkT = rnd(1500, 4000); this.blinkAnim = null;
    this.build(); this.draw();
  }
  toWorld(lx, ly) { const c = Math.cos(this.h), s = Math.sin(this.h), k = this.s * (1 + this.hop * .12); return [this.x + (lx * c - ly * s) * k, this.y + (lx * s + ly * c) * k]; }
  build() {
    const g = this.g; g.innerHTML = ''; const P = this.P = { legs: [], pips: [], ants: [], tips: [] };
    if (this.v === 'pips') for (let k = 0; k < 6; k++) P.pips.push(mk(g, 'circle', { fill: 'currentColor', r: .62 * this.s }));
    else for (let k = 0; k < 6; k++) P.legs.push(mk(g, 'line', { stroke: 'currentColor', 'stroke-width': ANT.legW * this.s, 'stroke-linecap': 'round' }));
    for (let k = 0; k < 2; k++) { P.ants.push(mk(g, 'path', { fill: 'none', stroke: 'currentColor', 'stroke-width': ANT.antW * this.s, 'stroke-linecap': 'round' })); P.tips.push(mk(g, 'circle', { fill: 'currentColor', r: ANT.tipR * this.s })); }
    P.abd = mk(g, 'circle', { fill: 'currentColor' }); P.tho = mk(g, 'circle', { fill: 'currentColor' }); P.head = mk(g, 'path', { fill: 'currentColor', 'fill-rule': 'evenodd' });
    P.crumb = mk(g, 'circle', { fill: 'currentColor', r: 0 });
  }
  setVariant(v) { this.v = v; this.build(); this.draw(); }

  /* ---- vocabulary ---- */
  walkTo(x, y, speed = 1) { this.target = [x, y]; this.cruise = speed; this.state = 'walk'; return this; }
  turn(angle) { this.state = 'turn'; this.turnTo = this.h + angle; this.timer = 500; return this; }
  pause(ms = 800) { this.state = 'pause'; this.timer = ms; return this; }
  sniff(ms = 900) { this.state = 'sniff'; this.timer = ms; return this; }
  pickUp(item = {}) { this.crumb = item; this.hop = 1; this.wag = 1; return this; }   // item gets {x,y} kept in front of the head
  drop() { const c = this.crumb; if (!c) return null; const p = this.toWorld(ANT.body.head[0] + ANT.body.head[1] + ANT.crumbGap, 0); c.x = p[0]; c.y = p[1]; this.crumb = null; return c; }
  lookAt(x, y) { this.lookTarget = (x == null) ? null : [x, y]; return this; }
  blinkNow() { this.blinkAnim = 0; return this; }
  rest() { this.target = null; this.state = 'idle'; return this; }                    // stops, feet planted. In the nav, show focus-mark.svg instead.
  destroy() { this.g.remove(); }

  /** Advance by dt seconds. onDone(ant) fires when walk/turn/pause/sniff finishes. */
  update(dt) {
    let want = 0;
    if (this.state === 'walk' && this.target) {
      const dx = this.target[0] - this.x, dy = this.target[1] - this.y, d = Math.hypot(dx, dy), df = angDiff(this.h, Math.atan2(dy, dx));
      this.h += clamp(df, -4.2 * dt, 4.2 * dt);
      want = this.cruise * 16 * this.s * clamp(d / (9 * this.s), 0, 1) * clamp(1 - Math.abs(df) / 2.2, .15, 1);
      if (d < 1.2 * this.s) { this.target = null; this.state = 'idle'; this.onDone && this.onDone(this); }
    } else if (this.state === 'turn') {
      const df = angDiff(this.h, this.turnTo); this.h += clamp(df, -7 * dt, 7 * dt); this.timer -= dt * 1000;
      if (Math.abs(df) < .02 || this.timer < 0) { this.state = 'idle'; this.onDone && this.onDone(this); }
    } else if (this.state === 'pause' || this.state === 'sniff') {
      this.timer -= dt * 1000; if (this.timer <= 0) { this.state = 'idle'; this.onDone && this.onDone(this); }
    }
    this.speed = lerp(this.speed, want, 1 - Math.exp(-dt * (want > this.speed ? 5 : 9)));
    this.x += Math.cos(this.h) * this.speed * dt; this.y += Math.sin(this.h) * this.speed * dt;
    // feet: planted; one tripod steps when stretched, never both at once
    const swing = clamp(.15 - this.speed / (280 * this.s), .07, .15);
    for (const f of this.feet) if (f.t < 1) { f.t = Math.min(1, f.t + dt / swing); const e = f.t < .5 ? 2 * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 2) / 2; f.x = lerp(f.fx, f.tx, e); f.y = lerp(f.fy, f.ty, e); }
    const lead = clamp(this.speed / (16 * this.s), 0, 1.3) * .9;
    if (!this.feet.some(f => f.t < 1)) for (const gID of [0, 1]) {
      const grp = this.feet.filter(f => GROUP(f.s, f.i) === gID);
      const st = Math.max(...grp.map(f => { const n = this.toWorld(ANT.feet[f.i][0], ANT.feet[f.i][1] * f.s); return Math.hypot(f.x - n[0], f.y - n[1]) / this.s; }));
      if (st > .95) { for (const f of grp) { const n = this.toWorld(ANT.feet[f.i][0] + lead + rnd(-.1, .1), ANT.feet[f.i][1] * f.s + rnd(-.1, .1)); Object.assign(f, { fx: f.x, fy: f.y, tx: n[0], ty: n[1], t: 0 }); } break; }
    }
    // abdomen trails on a spring (sway) and wags when happy; the hop decays
    this.wag = Math.max(0, this.wag - dt * 1.4); const now = performance.now(), wagO = Math.sin(now / 55) * this.wag * .9;
    const back = this.toWorld(ANT.body.abd[0], wagO), k = 1 - Math.exp(-dt * 13); this.abd = [lerp(this.abd[0], back[0], k), lerp(this.abd[1], back[1], k)];
    this.hop = Math.max(0, this.hop - dt * 4);
    // antennae: springy bob toward random twitch targets; sniffing sweeps fast
    const sniffing = this.state === 'sniff'; this.antClock -= dt * 1000;
    if (this.antClock <= 0) { this.ant.forEach(a => a.t = rnd(-.22, .32) * (sniffing ? 2 : 1) + (this.hop > 0 ? -.3 : 0)); this.antClock = sniffing ? rnd(70, 140) : rnd(160, 600); }
    const walkBob = Math.sin(now / 90) * .05 * clamp(this.speed / (16 * this.s), 0, 1);
    this.ant.forEach((a, i) => { const acc = (a.t + walkBob * (i ? 1 : -1) - a.a) * 170 - a.v * 13; a.v += acc * dt; a.a += a.v * dt; });
    this.bob = sniffing ? Math.sin(now / 70) * .22 : 0;
    // eyes: blink every few seconds, sometimes twice; look toward a target when not walking
    this.blinkT -= dt * 1000; if (this.blinkT <= 0) { this.blinkAnim = 0; this.blinkT = Math.random() < .2 ? 220 : rnd(2200, 5200); }
    if (this.blinkAnim != null) { this.blinkAnim += dt * 1000; const t = this.blinkAnim / 130; this.blink = t < 1 ? Math.abs(1 - 2 * t) * .92 + .08 : 1; if (t >= 1) this.blinkAnim = null; }
    let lt = [0, 0];
    if (this.lookTarget && this.state !== 'walk') { const c = Math.cos(-this.h), s = Math.sin(-this.h), dx = this.lookTarget[0] - this.x, dy = this.lookTarget[1] - this.y, lx = dx * c - dy * s, ly = dx * s + dy * c, L = Math.hypot(lx, ly) || 1; lt = [lx / L * .16, ly / L * .16]; }
    else if (this.target) lt = [.12, 0];
    this.look = [lerp(this.look[0], lt[0], 1 - Math.exp(-dt * 10)), lerp(this.look[1], lt[1], 1 - Math.exp(-dt * 10))];
    if (this.crumb) { const p = this.toWorld(ANT.body.head[0] + ANT.body.head[1] + ANT.crumbGap + this.bob, 0); this.crumb.x = p[0]; this.crumb.y = p[1]; }
    this.draw();
  }
  draw() {
    const P = this.P, sc = this.s * (1 + this.hop * .12), deg = this.h * 180 / Math.PI, B = ANT.body, hx = B.head[0] + this.bob, head = this.toWorld(hx, 0);
    P.abd.setAttribute('cx', f2(this.abd[0])); P.abd.setAttribute('cy', f2(this.abd[1])); P.abd.setAttribute('r', f2(B.abd[1] * sc));
    P.tho.setAttribute('cx', f2(this.x)); P.tho.setAttribute('cy', f2(this.y)); P.tho.setAttribute('r', f2(B.tho[1] * sc));
    let d = circ(head[0], head[1], B.head[1] * sc);
    for (const e of ANT.eyes) { const p = this.toWorld(hx + e[0] + this.look[0], e[1] + this.look[1]); d += ell(p[0], p[1], ANT.eyeR * sc, ANT.eyeR * sc * this.blink, deg + 90); }
    P.head.setAttribute('d', d);
    const shown = ANT.variants[this.v] || [0, 1, 2];
    this.feet.forEach((f, k) => {
      if (this.v === 'pips') { P.pips[k].setAttribute('cx', f2(f.x)); P.pips[k].setAttribute('cy', f2(f.y)); return; }
      const h = this.toWorld(ANT.hips[f.i][0], ANT.hips[f.i][1] * f.s), L = P.legs[k];
      L.setAttribute('x1', f2(h[0])); L.setAttribute('y1', f2(h[1])); L.setAttribute('x2', f2(f.x)); L.setAttribute('y2', f2(f.y)); L.setAttribute('opacity', shown.includes(f.i) ? 1 : 0);
    });
    [1, -1].forEach((sd, k) => { const a = (.62 + this.ant[k].a) * sd, base = [hx + B.head[1] * .62, .62 * sd];
      const mid = [base[0] + Math.cos(a) * 1.3, base[1] + Math.sin(a) * 1.3], tip = [mid[0] + Math.cos(a * .55) * 1.4, mid[1] + Math.sin(a * .55) * 1.4];
      const Bw = this.toWorld(...base), M = this.toWorld(...mid), T = this.toWorld(...tip);
      P.ants[k].setAttribute('d', `M${f2(Bw[0])} ${f2(Bw[1])}Q${f2(M[0])} ${f2(M[1])} ${f2(T[0])} ${f2(T[1])}`); P.tips[k].setAttribute('cx', f2(T[0])); P.tips[k].setAttribute('cy', f2(T[1])); });
    const c = this.crumb; P.crumb.setAttribute('r', c ? f2(ANT.crumbR * this.s) : 0); if (c) { P.crumb.setAttribute('cx', f2(c.x)); P.crumb.setAttribute('cy', f2(c.y)); }
  }
  /** A still pose (for stills, reduced motion, no-JS exports). stride: 0 standing … 1 full stride. */
  pose({ stride = 0, blink = 1, carrying = false, look = [.1, 0] } = {}) {
    this.feet.forEach(f => { const off = GROUP(f.s, f.i) === 0 ? stride * .6 : -stride * .6; const n = this.toWorld(ANT.feet[f.i][0] + off, ANT.feet[f.i][1] * f.s); Object.assign(f, { x: n[0], y: n[1], t: 1 }); });
    this.abd = this.toWorld(ANT.body.abd[0], 0); this.blink = blink; this.look = look; this.ant.forEach(a => { a.a = 0; a.v = 0; });
    if (carrying) { this.crumb = this.crumb || {}; const p = this.toWorld(ANT.body.head[0] + ANT.body.head[1] + ANT.crumbGap, 0); this.crumb.x = p[0]; this.crumb.y = p[1]; } else this.crumb = null;
    this.draw(); return this;
  }
}
