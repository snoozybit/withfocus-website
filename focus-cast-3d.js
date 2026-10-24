/* focus-cast-3d.js: the cast for "The mark is the machine" (Three.js r128+, reads globalThis.THREE).
   Mark units, Y up, ground y = 0. The mark is centred on the origin: logo x → world X, logo y → world Z
   (a top-down camera with up = (0,0,-1) shows the upright logo). Pairs with focus-ant-3d.js.
   Colour language: MIST = work not done · FOCUS GREEN = done / in focus · FOREST = the world · SAGE = yours (only). */
const THREE = globalThis.THREE;
export const C = { green: 0x6FA585, deep: 0x3D7154, forest: 0x1C2B1E, forest2: 0x243528, forest3: 0x2E4232, mist: 0xF0F4EF, sage: 0xC8D9C4, ink: 0x1C2B1E };
const SPH = new THREE.SphereGeometry(1, 48, 32);
const clay = (color, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .9, metalness: 0 }, extra));

/* ---------- the field: the mark's 3×3 as workstations ---------- */
// F cells end as solid circles (radius r). Frame cells stay as hairline frames (still working). A3 has no hole: the picked dot fits no hole.
export const CELLS = {
  A1: { x: -8.533, z: -4.167, kind: 'frame', h: 1.632, k: .816 }, A2: { x: -1.933, z: -4.167, kind: 'F', r: 2.55 },
  B1: { x: -8.533, z: 2.433, kind: 'frame', h: 1.1, k: .55 },    B2: { x: -1.933, z: 2.433, kind: 'F', r: 1.833 }, B3: { x: 4.667, z: 2.433, kind: 'F', r: 2.55 },
  C1: { x: -8.533, z: 9.033, kind: 'frame', h: .756, k: .378 },  C2: { x: -1.933, z: 9.033, kind: 'F', r: 1.236 }, C3: { x: 4.667, z: 9.033, kind: 'frame', h: 1.632, k: .816 },
};
export const PICK = { x: 7.367, z: -7.867, r: 3.0 };                     // just outside slot A3
for (const c of Object.values(CELLS)) if (c.kind === 'F') { c.h = .89 * c.r; c.k = c.h * .5; }   // a hole's half-side = 0.89 × the circle radius it will hold

function rrPath(p, h, rad) { rad = Math.min(rad, h); p.moveTo(-h + rad, -h); p.lineTo(h - rad, -h); p.quadraticCurveTo(h, -h, h, -h + rad); p.lineTo(h, h - rad); p.quadraticCurveTo(h, h, h - rad, h); p.lineTo(-h + rad, h); p.quadraticCurveTo(-h, h, -h, h - rad); p.lineTo(-h, -h + rad); p.quadraticCurveTo(-h, -h, -h + rad, -h); return p; }
/** Ground with the 8 holes cut into it (forest). */
export function makeGround(size = 160) {
  const s = new THREE.Shape(); s.moveTo(-size, -size); s.lineTo(size, -size); s.lineTo(size, size); s.lineTo(-size, size); s.lineTo(-size, -size);
  for (const c of Object.values(CELLS)) { const p = rrPath(new THREE.Path(), c.h, c.k); p.currentPoint; const pts = p.getPoints(12).map(v => new THREE.Vector2(v.x + c.x, -(v.y) - c.z)); s.holes.push(new THREE.Path(pts)); }
  const g = new THREE.ShapeGeometry(s, 12); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, clay(C.forest, { roughness: 1 })); m.receiveShadow = true; return m;
}
/** One workstation: pit, 0.32u hairline frame at the lip, inner power light, and a small tool plate. */
export function makeHole(id, tool = 'Claude Code', { plate = true } = {}) {
  const c = CELLS[id], g = new THREE.Group(); g.position.set(c.x, 0, c.z); const depth = 2.6;
  const wallMat = clay(C.forest2, { side: THREE.DoubleSide, roughness: 1 });
  const ring = new THREE.Shape(); rrPath(ring, c.h, c.k); const wall = new THREE.ExtrudeGeometry(ring, { depth, bevelEnabled: false, curveSegments: 12 });
  wall.rotateX(Math.PI / 2); const pit = new THREE.Mesh(wall, wallMat); pit.position.y = 0; g.add(pit);   // extruded downward from the lip
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(rrPath(new THREE.Shape(), c.h, c.k), 12), clay(C.forest3)); floor.rotation.x = -Math.PI / 2; floor.position.y = -depth + .01; g.add(floor);
  const power = new THREE.Mesh(new THREE.ShapeGeometry(rrPath(new THREE.Shape(), c.h * .92, c.k * .92), 12), new THREE.MeshBasicMaterial({ color: C.green, transparent: true, opacity: 0 }));
  power.rotation.x = -Math.PI / 2; power.position.y = -depth + .05; g.add(power);
  const fr = new THREE.Shape(); rrPath(fr, c.h, c.k); fr.holes.push(rrPath(new THREE.Path(), c.h - .32, Math.max(c.k - .32, .01)));
  const fg = new THREE.ExtrudeGeometry(fr, { depth: .12, bevelEnabled: false, curveSegments: 12 }); fg.rotateX(-Math.PI / 2);
  const frame = new THREE.Mesh(fg, clay(C.green)); frame.position.y = .01; frame.receiveShadow = true; g.add(frame);
  let tag = null; if (plate) { tag = logoPlate(tool); tag.position.set(0, .02, c.h + 1.0); tag.rotation.x = -Math.PI / 2 + .35; g.add(tag); }
  g.userData = { id, cell: c, power, frame, plate: tag, depth };
  return g;
}
/** Agent power: a soft Focus Green pulse inside a working hole (never sage). t in seconds, on 0..1. */
export function powerHole(hole, t, on = 1) { const p = hole.userData.power; p.material.opacity = on * (.25 + .35 * (.5 + .5 * Math.sin(t * 3.2))); }

/* ---------- emoji marks (Lalit: "regular relevant normal emojis … something that can be justified") ----------
   Our own emoji-style glyphs (not vendor art): one colour, chunky and rounded, inlaid in the mist clay so they wash into the plain circles.
   Each kind of work is told by meaning, not by brand. Drawn in a 100-unit box; fills, then cut-outs. */
const rr = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
const cc = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
export const EMOJI = {
  bubble:   { means: '💬 a message', fill: [{ d: rr(8, 12, 84, 60, 20) }, { d: 'M24 66 L14 90 L48 70Z' }], cut: [{ d: cc(32, 42, 6.5) }, { d: cc(50, 42, 6.5) }, { d: cc(68, 42, 6.5) }] },
  reply:    { means: '💬↩ a thread reply', fill: [{ d: rr(8, 8, 84, 58, 20) }, { d: 'M62 60 L80 86 L50 64Z' }], cut: [{ d: 'M68 48 V42 A12 12 0 0 0 56 30 H32', w: 8 }, { d: 'M42 18 L30 30 L42 42', w: 8 }] },
  envelope: { means: '✉️ an email', fill: [{ d: rr(8, 22, 84, 56, 10) }], cut: [{ d: 'M15 30 L50 56 L85 30', w: 8 }] },
  pr:       { means: '🔀 a PR to review', fill: [{ d: 'M30 28 V72', w: 12 }, { d: 'M70 72 V50 Q70 26 46 26', w: 12 }, { d: 'M50 12 L36 26 L50 40', w: 11 }, { d: cc(30, 18, 11) }, { d: cc(30, 82, 11) }, { d: cc(70, 82, 11) }], cut: [] },
  robot:    { means: '🤖 an AI agent works here', fill: [{ d: rr(14, 28, 72, 58, 16) }, { d: 'M50 28 V14', w: 7 }, { d: cc(50, 11, 7) }, { d: rr(5, 46, 9, 22, 4.5) }, { d: rr(86, 46, 9, 22, 4.5) }], cut: [{ d: cc(36, 54, 9) }, { d: cc(64, 54, 9) }, { d: rr(36, 70, 28, 7, 3.5) }] },
};
export const SOURCE_EMOJI = { slack: 'bubble', slackReply: 'reply', gmail: 'envelope', zoho: 'envelope', pr: 'pr' };
function drawEmoji(x, kind, cx, cy, size, color) {
  const E = EMOJI[kind], k = size / 100; x.save(); x.translate(cx - size / 2, cy - size / 2); x.scale(k, k);
  const paint = (el, mode) => { const p = new Path2D(el.d); if (el.w) { x.lineWidth = el.w; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = mode; x.stroke(p); } else { x.fillStyle = mode; x.fill(p); } };
  x.globalCompositeOperation = 'source-over'; E.fill.forEach(el => paint(el, color));
  x.globalCompositeOperation = 'destination-out'; E.cut.forEach(el => paint(el, '#000'));
  x.restore(); x.globalCompositeOperation = 'source-over';
}
/** The emoji mark as a ball decal, front and back, equal pixel aspect at the equator. */
export function emojiCanvas(kind) {
  const W = 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  for (const cx of [W * .25, W * .75]) drawEmoji(x, kind, cx, H / 2, 190, 'rgba(28,43,30,.62)');
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
}
/** 2D emoji mark for stills and the board (SVG string, currentColor; cut-outs via a mask). */
let _eid = 0;
export function emojiSVG(kind, px = 48) {
  const E = EMOJI[kind], id = 'em' + (_eid++);
  const el = (e, col) => e.w ? `<path d="${e.d}" fill="none" stroke="${col}" stroke-width="${e.w}" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="${e.d}" fill="${col}"/>`;
  return `<svg viewBox="0 0 100 100" width="${px}" height="${px}" aria-hidden="true"><mask id="${id}"><rect width="100" height="100" fill="#fff"/>${E.cut.map(e => el(e, '#000')).join('')}</mask><g mask="url(#${id})" fill="currentColor">${E.fill.map(e => el(e, 'currentColor')).join('')}</g></svg>`;
}

/* ---------- block marks: our own one-colour mosaics that suggest each source's structure (Lalit: "not the copy, more of structure, created using small small blocks") ---------- */
// '#' = rounded cell, 'o' = dot, '.' = empty. Drawn in Focus's own grammar (cells and dots, like the 3×3 mark). Never brand colours.
export const MOSAICS = {
  slack:      ['..#....', '..#....', '..#.###', '.......', '###.#..', '....#..', '....#..'],                                         // pinwheel of four bars around an open centre, no companion squares
  slackReply: ['..#....', '..#....', '..#.###', '.......', '###.#..', '....#..', '....#..', '.......', '.o.o.o.'],                   // the pinwheel + a thread of dots
  gmail:      ['#.....#', '##...##', '#.#.#.#', '#..#..#', '#.....#'],                                                                  // a block M
  zoho:       ['#######', '##...##', '#.#.#.#', '#..#..#', '#######'],                                                                  // a closed block envelope
  pr:         ['.o...o.', '.#...#.', '.#..#..', '.#.#...', '.##....', '.#.....', '.o.....'],                                                // a branch merging, two end dots
  'Claude Code': ['#......', '.#.....', '..#....', '.#.....', '#..####'],                                                              // a block terminal prompt  >_
  Cursor:     ['#......', '##.....', '###....', '####...', '#####..', '##.##..', '#...##.'],                                             // a block pointer
  Codex:      ['.##...##.', '.#.....#.', '#.......#', '.#.....#.', '.##...##.'],                                                         // block braces { }
};
function drawMosaic(x, rows, cx, cy, cell, color) {
  const R = rows.length, Cn = Math.max(...rows.map(r => r.length)); x.fillStyle = color;
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    const px = cx + (i - (Cn - 1) / 2) * cell, py = cy + (j - (R - 1) / 2) * cell, s = cell * .82;
    if (ch === '#') { x.beginPath(); x.roundRect ? x.roundRect(px - s / 2, py - s / 2, s, s, s * .3) : x.rect(px - s / 2, py - s / 2, s, s); x.fill(); }
    if (ch === 'o') { x.beginPath(); x.arc(px, py, cell * .4, 0, 7); x.fill(); }
  }));
}
/** The block mark as a ball decal (inlaid in a deeper tone of the clay), front and back, equal pixel aspect at the equator. */
export function mosaicCanvas(kind) {
  const W = 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const rows = MOSAICS[kind], n = Math.max(rows.length, ...rows.map(r => r.length)), cell = 170 / n;
  for (const cx of [W * .25, W * .75]) drawMosaic(x, rows, cx, H / 2, cell, 'rgba(28,43,30,.62)');
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
}
/** 2D block mark for stills and the board (an SVG string, currentColor). */
export function mosaicSVG(kind, px = 48) {
  const rows = MOSAICS[kind], R = rows.length, Cn = Math.max(...rows.map(r => r.length)), n = Math.max(R, Cn); let b = '';
  rows.forEach((row, j) => [...row].forEach((ch, i) => { const x = i + (n - Cn) / 2, y = j + (n - R) / 2;
    if (ch === '#') b += `<rect x="${(x + .09).toFixed(2)}" y="${(y + .09).toFixed(2)}" width=".82" height=".82" rx=".25"/>`;
    if (ch === 'o') b += `<circle cx="${(x + .5).toFixed(2)}" cy="${(y + .5).toFixed(2)}" r=".4"/>`; }));
  return `<svg viewBox="0 0 ${n} ${n}" width="${px}" height="${px}" fill="currentColor" aria-hidden="true">${b}</svg>`;
}

/* ---------- third-party logos (official files only; see focus-brand/third-party/SOURCES.md) ---------- */
export const LOGOS = {};   // source or tool key → HTMLImageElement
/** Preload official logo files: loadLogos({ pr: 'third-party/github-invertocat-black.svg', ... }). Missing keys fall back to our glyphs/text. */
export function loadLogos(map) { return Promise.all(Object.entries(map).map(([k, url]) => new Promise(res => { const im = new Image(); im.onload = () => { LOGOS[k] = im; res(); }; im.onerror = () => res(); im.src = url; }))); }

/* ---------- work balls ---------- */
// Size = effort, and effort maps to the circle the ball becomes: small (C2 1.236) · medium (B2 1.833) · large (A2/B3 2.55).
export const EFFORT = { small: 1.236, medium: 1.833, large: 2.55 };
export const SOURCES = {
  slack: { name: 'Slack', glyph: 'bubble' }, slackReply: { name: 'Slack reply', glyph: 'reply' },
  gmail: { name: 'Gmail', glyph: 'envelope' }, zoho: { name: 'Zoho Mail', glyph: 'envelope' }, pr: { name: 'PR review', glyph: 'review' },
};
function glyphCanvas(kind) {   // our own neutral pictograms (not brand logos), drawn on the ball's front and back
  const W = 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const draw = (cx) => { x.save(); x.translate(cx, H / 2); x.strokeStyle = '#4A5E4C'; x.fillStyle = '#4A5E4C'; x.lineWidth = 16; x.lineJoin = 'round'; x.lineCap = 'round';
    const rr = (X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
    if (kind === 'bubble' || kind === 'reply') { rr(-70, -58, 140, 96, 30); x.stroke(); x.beginPath(); x.moveTo(-30, 38); x.lineTo(-48, 70); x.lineTo(2, 38); x.stroke();
      if (kind === 'reply') { x.beginPath(); x.moveTo(20, -14); x.lineTo(-18, -14); x.moveTo(-6, -30); x.lineTo(-22, -14); x.lineTo(-6, 2); x.stroke(); } }
    if (kind === 'envelope') { rr(-74, -50, 148, 100, 14); x.stroke(); x.beginPath(); x.moveTo(-66, -40); x.lineTo(0, 12); x.lineTo(66, -40); x.stroke(); }
    if (kind === 'review') { x.beginPath(); x.arc(-36, -40, 16, 0, 7); x.stroke(); x.beginPath(); x.arc(-36, 46, 16, 0, 7); x.stroke(); x.beginPath(); x.moveTo(-36, -24); x.lineTo(-36, 30); x.stroke();
      x.beginPath(); x.arc(40, 46, 16, 0, 7); x.stroke(); x.beginPath(); x.moveTo(40, 30); x.lineTo(40, -10); x.quadraticCurveTo(40, -40, 10, -40); x.lineTo(-4, -40); x.stroke(); x.beginPath(); x.moveTo(8, -54); x.lineTo(-6, -40); x.lineTo(8, -26); x.stroke(); }
    x.restore(); };
  draw(W * .25); draw(W * .75);
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
}
function logoCanvas(img) {   // the official logo as an undistorted decal: equal pixel aspect at the equator (W = 2H), front and back
  const W = 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const hh = 190, ww = Math.min(300, hh * (img.naturalWidth || img.width) / (img.naturalHeight || img.height)), h = ww * (img.naturalHeight || img.height) / (img.naturalWidth || img.width);
  for (const cx of [W * .25, W * .75]) x.drawImage(img, cx - ww / 2, H / 2 - h / 2, ww, h);
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
}
/** Clay whose decal can be washed off by light: uWash 0 = logo painted on, 1 = plain base colour (the mark). */
function washableClay(color, map) {
  const m = clay(color, { map }); const wash = { value: 0 }; m.userData.wash = wash;
  m.onBeforeCompile = sh => { sh.uniforms.uWash = wash; sh.fragmentShader = 'uniform float uWash;\n' + sh.fragmentShader.replace('#include <map_fragment>',
    '#ifdef USE_MAP\n vec4 texelColor = texture2D( map, vUv );\n texelColor = mapTexelToLinear( texelColor );\n diffuseColor.rgb = mix( diffuseColor.rgb, texelColor.rgb, texelColor.a * ( 1.0 - uWash ) );\n#endif'); };
  return m;
}
/** State marks, painted on the ball as a small flat camera-facing badge in mist (never sage). At most one per ball. */
export const STATES = { urgent: '!', question: '?', waiting: 'pause', done: 'check' };
function stateCanvas(kind) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d');
  x.fillStyle = '#F0F4EF'; x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 6, 0, 7); x.fill();
  x.strokeStyle = 'rgba(28,43,30,.18)'; x.lineWidth = 6; x.stroke();
  x.fillStyle = '#1C2B1E'; x.strokeStyle = '#1C2B1E'; x.lineCap = 'round'; x.lineJoin = 'round';
  if (kind === '!') { x.fillRect(S / 2 - 13, 58, 26, 92); x.beginPath(); x.arc(S / 2, 186, 15, 0, 7); x.fill(); }
  if (kind === '?') { x.lineWidth = 24; x.beginPath(); x.arc(S / 2, 104, 40, Math.PI * 1.05, Math.PI * .45, false); x.stroke(); x.beginPath(); x.moveTo(S / 2, 140); x.lineTo(S / 2, 150); x.stroke(); x.beginPath(); x.arc(S / 2, 190, 14, 0, 7); x.fill(); }
  if (kind === 'pause') { x.fillRect(S / 2 - 38, 74, 24, 108); x.fillRect(S / 2 + 14, 74, 24, 108); }
  if (kind === 'check') { x.lineWidth = 26; x.beginPath(); x.moveTo(78, 132); x.lineTo(114, 168); x.lineTo(182, 92); x.stroke(); }
  return new THREE.CanvasTexture(cv);
}
/** Set (or clear) a ball's state mark. */
export function setBallState(b, state) {
  const u = b.userData; if (u.badge) { b.remove(u.badge); u.badge = null; } u.state = state || null; if (!state) return;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: stateCanvas(STATES[state]), transparent: true, depthTest: false })); sp.renderOrder = 10;
  const k = Math.max(1.05, u.r * .62); sp.scale.set(k, k, 1); sp.position.set(u.r * .55, u.r * .72, u.r * .5); b.add(sp); u.badge = sp;
}
/** A work ball, painted with its source. mode 'logo' (official decal, Lalit's pick) or 'glyph' (our pictogram, the fallback). No floating labels: everything is on the ball. */
export function makeBall(source = 'slack', effort = 'medium', { mode = 'emoji', state = null } = {}) {
  const r = EFFORT[effort], src = SOURCES[source], g = new THREE.Group();
  const img = mode === 'logo' ? LOGOS[source] : null;
  const tex = mode === 'emoji' && SOURCE_EMOJI[source] ? emojiCanvas(SOURCE_EMOJI[source]) : mode === 'mosaic' && MOSAICS[source] ? mosaicCanvas(source) : img ? logoCanvas(img) : glyphCanvas(src.glyph);
  const mat = washableClay(C.mist, tex);
  const ball = new THREE.Mesh(SPH, mat); ball.scale.setScalar(r); ball.castShadow = true; ball.receiveShadow = true; g.add(ball);
  g.userData = { r, ball, source, effort, mat, wash: mat.userData.wash, logo: !!img, rolled: 0, badge: null };
  if (state) setBallState(g, state);
  return g;
}
/** Wash the painted logo off with light (scene 7): 0 painted → 1 plain. */
export function washBall(b, w) { b.userData.wash.value = Math.min(1, Math.max(0, w)); }
/** Roll a ball along the ground by distance d in direction (dx, dz). */
export function rollBall(b, dx, dz) { const d = Math.hypot(dx, dz); if (!d) return; b.position.x += dx; b.position.z += dz; const axis = new THREE.Vector3(dz, 0, -dx).normalize(); b.userData.ball.rotateOnWorldAxis(axis, d / b.userData.r); }
/** Done: the ball settles into its hole and becomes the solid Focus Green dome at the cell's radius. t 0→1. */
/** Done: … also pass the hole, and its frame dissolves as the ball becomes the circle (a frame turns solid only when its work is done). */
export function settleBall(b, id, t, hole = null) {
  const c = CELLS[id], u = b.userData; const k = Math.min(1, Math.max(0, t)), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  b.position.x = c.x; b.position.z = c.z;
  b.position.y = THREE.MathUtils.lerp(u.r, .02, e);                     // sinks into the opening until its equator meets the ground: from above, exactly the mark's circle
  u.mat.color.lerpColors(new THREE.Color(C.mist), new THREE.Color(C.green), e);   // the painted logo stays until washBall()
  if (k > .55 && k < .95) { if (u.state !== 'done') setBallState(b, 'done'); } else if (k >= .95 && u.state) setBallState(b, null);   // done balls carry no mark   // ✓ flashes as it settles
  if (hole) { const f = hole.userData.frame, k2 = 1 - Math.min(1, Math.max(0, (t - .55) / .35)); f.scale.set(Math.max(k2, .001), 1, Math.max(k2, .001)); f.visible = k2 > .01; if (hole.userData.plate) hole.userData.plate.visible = k2 > .01; }
}
/** Major ball: a thin pause ring around it at the hole's lip, until the person nods. */
export function makePauseRing(r) { const m = new THREE.Mesh(new THREE.TorusGeometry(r * 1.18, .1, 10, 64), clay(C.mist, { roughness: .8 })); m.rotation.x = Math.PI / 2; m.position.y = .15; return m; }

/* ---------- beads, data, wall, person, picked dot ---------- */
export function makeQuestionBead() { const m = new THREE.Mesh(SPH, clay(C.mist)); m.scale.setScalar(.6); m.castShadow = true; return m; }
export function makeAnswerBead() { const m = new THREE.Mesh(SPH, clay(C.mist)); m.scale.setScalar(.45); m.castShadow = true; return m; }
export function makeSageSpark() { const m = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: C.sage })); m.scale.setScalar(.32); return m; }   // the Relay answer passed to your ant
export function makeDataBall() { const m = new THREE.Mesh(SPH, clay(0x14201A, { roughness: .95 })); m.scale.setScalar(2.6); m.position.y = 2.6; m.castShadow = true; return m; }
export function makeWall(r = 7) { const g = new THREE.Group(); const wall = new THREE.Mesh(new THREE.TorusGeometry(r, .7, 16, 96), clay(C.forest2)); wall.rotation.x = Math.PI / 2; wall.scale.z = 1.5; wall.position.y = .5; wall.castShadow = wall.receiveShadow = true; g.add(wall); return g; }
/** The owner: a simple soft figure in mist (not a character, a person-shaped marker). */
export function makePerson() {
  const g = new THREE.Group(), m = clay(C.mist);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.1, 6.2, 32), m); body.position.y = 3.1; const shoulders = new THREE.Mesh(SPH, m); shoulders.scale.set(1.5, .9, 1.5); shoulders.position.y = 6.2;
  const head = new THREE.Mesh(SPH, m); head.scale.setScalar(1.45); head.position.y = 8.3;
  [body, shoulders, head].forEach(o => { o.castShadow = o.receiveShadow = true; g.add(o); }); g.userData = { head };
  return g;
}
/** The nod: a small head dip, t 0→1. */
export function nod(person, t) { person.userData.head.position.y = 8.3 - Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) * .6; }
/** The picked dot: faint in the empty grid → sage glow while your ant carries it → plain Focus Green once placed. state: 'faint' | 'carried' | 'placed' (or a 0..1 blend via setPicked). */
export function makePickedDot() { const m = new THREE.Mesh(SPH, clay(C.green, { transparent: true })); m.scale.setScalar(PICK.r); m.castShadow = true; m.userData = {}; return m; }
export function setPicked(dot, state) {
  const mat = dot.material;
  if (state === 'faint') { mat.color.setHex(C.green); mat.emissive.setHex(0); mat.opacity = .18; dot.castShadow = false; }
  if (state === 'carried') { mat.color.setHex(C.sage); mat.emissive.setHex(C.sage); mat.emissiveIntensity = .35; mat.opacity = 1; dot.castShadow = true; }
  if (state === 'placed') { mat.color.setHex(C.green); mat.emissive.setHex(0); mat.opacity = 1; dot.castShadow = true; }
}

/* ---------- flat text (tags and plates) ---------- */
function textCanvas(text, { bg = '#F0F4EF', fg = '#1C2B1E', w = 512, h = 128, radius = 48, size = 60 } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d');
  x.fillStyle = bg; x.beginPath(); x.roundRect ? x.roundRect(4, 4, w - 8, h - 8, radius) : x.rect(4, 4, w - 8, h - 8); x.fill();
  x.fillStyle = fg; x.font = `600 ${size}px Geist, Inter, system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2);
  return new THREE.CanvasTexture(cv);
}
export function textSprite(text, o = {}) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textCanvas(text, o), transparent: true, depthWrite: false })); s.scale.set(4.4, 1.1, 1); return s; }
/** Option B placeholder: where an official, unmodified badge would sit. Ships only with the brand's permission / within its guidelines. */
export function badgeSprite(name) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textCanvas(`${name} badge · needs OK`, { bg: '#FFFFFF', fg: '#7A5A12', size: 40, w: 640, h: 120 }), transparent: true, depthWrite: false })); s.scale.set(5.6, 1.05, 1); return s; }
/** Tool plate: the tool's official logo (if loaded under its name), else its name in text. */
export function logoPlate(tool, { mark = 'emoji' } = {}) {
  if (mark === 'emoji') {   // 🤖 on every workstation: an AI agent works here
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const x = cv.getContext('2d');
    x.fillStyle = '#243528'; x.beginPath(); x.roundRect ? x.roundRect(4, 4, 504, 120, 40) : x.rect(4, 4, 504, 120); x.fill();
    drawEmoji(x, 'robot', 256, 64, 96, '#F0F4EF');
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: 1, transparent: true })); m.receiveShadow = true; return m;
  }
  if (MOSAICS[tool]) {   // our block mark for the tool, in mist on the forest plate
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const x = cv.getContext('2d');
    x.fillStyle = '#243528'; x.beginPath(); x.roundRect ? x.roundRect(4, 4, 504, 120, 40) : x.rect(4, 4, 504, 120); x.fill();
    const rows = MOSAICS[tool]; drawMosaic(x, rows, 256, 64, 84 / Math.max(rows.length, ...rows.map(r => r.length)) * 1.1, '#F0F4EF');
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: 1, transparent: true })); m.receiveShadow = true; return m;
  }
  const img = LOGOS[tool]; if (!img) return textPlate(tool, { w: 4.2, h: 1.0, bg: C.forest2, fg: C.mist });
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = '#243528'; x.beginPath(); x.roundRect ? x.roundRect(4, 4, 504, 120, 40) : x.rect(4, 4, 504, 120); x.fill();
  const ih = 84, iw = Math.min(440, ih * img.naturalWidth / img.naturalHeight), h = iw * img.naturalHeight / img.naturalWidth; x.drawImage(img, 256 - iw / 2, 64 - h / 2, iw, h);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: 1, transparent: true })); m.receiveShadow = true; return m;
}
export function textPlate(text, { w = 4, h = 1, bg = C.forest2, fg = C.mist } = {}) {
  const hex = n => '#' + n.toString(16).padStart(6, '0');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: textCanvas(text, { bg: hex(bg), fg: hex(fg), size: 58 }), roughness: 1, transparent: true }));
  m.receiveShadow = true; return m;
}
