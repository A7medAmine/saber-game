import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);
const D2R = Math.PI / 180;
const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Tuning knobs for the whole demo live here.
const CFG = {
  pivot: new V3(0.18, 1.05, 0.55), // where the "hand" holds the saber
  bladeStart: 0.1,
  bladeLen: 1.25,
  cubeSize: 0.42,
  hitRadius: 0.34,
  minSwingSpeed: 1.6, // tip speed (m/s) needed for a cut
  spawnZ: -32,
  missZ: 0.7,
  laneX: [-0.5, -0.1, 0.3, 0.7],
  rowY: [0.75, 1.15, 1.55],
  peerPrefix: 'sabrgamr-',
};
const BLADE_END = CFG.bladeStart + CFG.bladeLen;

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.localClippingEnabled = true;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04050b);
scene.fog = new THREE.Fog(0x04050b, 10, 38);

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.05, 200);
const CAM_POS = new V3(0.1, 1.65, 1.75);
camera.position.copy(CAM_POS);
camera.lookAt(0.1, 1.2, -4);
const camBaseQuat = camera.quaternion.clone();

scene.add(new THREE.HemisphereLight(0x8899ff, 0x120022, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(2, 5, 3);
scene.add(sun);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.4, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- environment
const arches = [];
(function buildEnvironment() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 120),
    new THREE.MeshStandardMaterial({ color: 0x07081a, roughness: 0.35, metalness: 0.7 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -40;
  scene.add(floor);

  const grid = new THREE.GridHelper(120, 120, 0x2b2f7a, 0x14173a);
  grid.position.set(0, 0.002, -40);
  scene.add(grid);

  const railMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.7, 2.4), toneMapped: false });
  for (const x of [-1.4, 1.6]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 80), railMat);
    rail.position.set(x, 0.02, -38);
    scene.add(rail);
  }

  const archMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.1, 0.8), toneMapped: false });
  const W = 5.2, H = 4, T = 0.05;
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(W, T, T), archMat);
    top.position.y = H;
    const left = new THREE.Mesh(new THREE.BoxGeometry(T, H, T), archMat);
    left.position.set(-W / 2, H / 2, 0);
    const right = left.clone();
    right.position.x = W / 2;
    g.add(top, left, right);
    g.position.set(0.1, 0, -4 - i * 6);
    arches.push(g);
    scene.add(g);
  }

  const starPos = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const v = new V3(rand(-1, 1), rand(0.05, 1), rand(-1, 0.2)).normalize().multiplyScalar(rand(60, 90));
    starPos.set([v.x, v.y, v.z], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9aa4ff, size: 0.25, fog: false })));
})();

// ---------------------------------------------------------------- saber
const saberColor = new THREE.Color('#3fb6ff');
const saber = new THREE.Group();
saber.position.copy(CFG.pivot);
scene.add(saber);

const hilt = new THREE.Mesh(
  new THREE.CylinderGeometry(0.022, 0.026, 0.26, 16),
  new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.3 }),
);
hilt.position.y = -0.03;
const core = new THREE.Mesh(
  new THREE.CylinderGeometry(0.011, 0.013, CFG.bladeLen, 12),
  new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.8, 1.8), toneMapped: false }),
);
core.position.y = CFG.bladeStart + CFG.bladeLen / 2;
const glowMat = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
});
const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, CFG.bladeLen + 0.02, 16), glowMat);
glow.position.y = core.position.y;
const saberLight = new THREE.PointLight(saberColor, 2.5, 4, 1.8);
saberLight.position.y = 0.7;
saber.add(hilt, core, glow, saberLight);

function setSaberColor(hex) {
  saberColor.set(hex);
  glowMat.color.copy(saberColor).multiplyScalar(1.3);
  saberLight.color.copy(saberColor);
}
setSaberColor('#3fb6ff');

// Swing trail: ribbon between mid-blade and tip over the last frames.
const TRAIL_N = 14;
const trailPos = new Float32Array(TRAIL_N * 2 * 3);
const trailCol = new Float32Array(TRAIL_N * 2 * 3);
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3).setUsage(THREE.DynamicDrawUsage));
trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3).setUsage(THREE.DynamicDrawUsage));
const trailIdx = [];
for (let i = 0; i < TRAIL_N - 1; i++) {
  const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
  trailIdx.push(a, b, c, b, d, c);
}
trailGeo.setIndex(trailIdx);
const trailMesh = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({
  vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
  depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
}));
trailMesh.frustumCulled = false;
scene.add(trailMesh);
const trailHist = Array.from({ length: TRAIL_N }, () => [new V3(), new V3()]);

function updateTrail(mid, tip, speed) {
  const last = trailHist.pop();
  last[0].copy(mid);
  last[1].copy(tip);
  trailHist.unshift(last);
  const strength = clamp((speed - 1) / 6, 0, 1);
  for (let i = 0; i < TRAIL_N; i++) {
    const [m, t] = trailHist[i];
    trailPos.set([m.x, m.y, m.z, t.x, t.y, t.z], i * 6);
    const f = (1 - i / (TRAIL_N - 1)) * strength;
    trailCol.set([saberColor.r * f * 0.3, saberColor.g * f * 0.3, saberColor.b * f * 0.3,
      saberColor.r * f * 1.6, saberColor.g * f * 1.6, saberColor.b * f * 1.6], i * 6);
  }
  trailGeo.attributes.position.needsUpdate = true;
  trailGeo.attributes.color.needsUpdate = true;
}

// ---------------------------------------------------------------- orientation input
// W3C device orientation: R = Rz(alpha) * Rx(beta) * Ry(gamma), earth frame X=east, Y=north, Z=up.
// qC converts earth frame into three.js world (Y up, -Z forward). Device +Y (phone top) == blade.
const qC = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -Math.PI / 2);
const _euler = new THREE.Euler();
const qDevice = new THREE.Quaternion();
const qOffset = new THREE.Quaternion();
const qTarget = new THREE.Quaternion().setFromUnitVectors(UP, new V3(0, 0.6, -1).normalize());
let needCalib = true;
let inputMode = 'none'; // 'phone' | 'mouse' | 'none'

function onOrientation(a, b, g) {
  _euler.set(b * D2R, g * D2R, a * D2R, 'ZXY');
  qDevice.setFromEuler(_euler).premultiply(qC);
  if (needCalib) calibrate();
  qTarget.copy(qDevice).premultiply(qOffset);
}

// Yaw-only recenter: whatever direction the phone points now becomes "into the screen".
function calibrate() {
  const v = UP.clone().applyQuaternion(qDevice);
  if (Math.hypot(v.x, v.z) < 0.15) return; // pointing straight up/down, retry next sample
  qOffset.setFromAxisAngle(UP, Math.atan2(v.x, -v.z));
  needCalib = false;
}

function requestRecenter() {
  needCalib = true;
  popupAt('RECENTER', CFG.pivot.clone().add(new V3(0, 0.6, -1)), '#9fe3ff');
}

addEventListener('mousemove', (e) => {
  if (inputMode !== 'mouse') return;
  const mx = (e.clientX / innerWidth) * 2 - 1;
  const my = (e.clientY / innerHeight) * 2 - 1;
  const yaw = mx * 1.15, pitch = -my * 0.95 + 0.15;
  const dir = new V3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  qTarget.setFromUnitVectors(UP, dir);
});

addEventListener('keydown', (e) => {
  unlockAudio();
  if (e.code === 'KeyC' || e.code === 'Space') requestRecenter();
  if (e.code === 'KeyM') startMouseMode();
});
addEventListener('pointerdown', unlockAudio);

// ---------------------------------------------------------------- audio (synthesized, no assets)
const audio = { ctx: null };
function unlockAudio() {
  if (audio.ctx) { audio.ctx.resume(); return; }
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  const humFilter = ctx.createBiquadFilter();
  humFilter.type = 'lowpass';
  humFilter.frequency.value = 350;
  const humGain = ctx.createGain();
  humGain.gain.value = 0.03;
  humFilter.connect(humGain).connect(master);
  const oscs = [85, 87.5].map((f) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.connect(humFilter);
    o.start();
    return o;
  });
  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
  const ch = noise.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  Object.assign(audio, { ctx, master, humFilter, humGain, oscs, noise });
}

function updateHum(speed) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime, s = Math.min(speed, 10);
  audio.humGain.gain.setTargetAtTime(0.025 + s * 0.022, t, 0.03);
  audio.humFilter.frequency.setTargetAtTime(300 + s * 160, t, 0.03);
  audio.oscs[0].frequency.setTargetAtTime(85 + s * 5, t, 0.05);
  audio.oscs[1].frequency.setTargetAtTime(87.5 + s * 5, t, 0.05);
}

function sfxSlice() {
  if (!audio.ctx) return;
  const { ctx, master, noise } = audio, t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(3200, t);
  bp.frequency.exponentialRampToValueAtTime(700, t + 0.2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.6, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.25);
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(110, t + 0.16);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.25, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(og).connect(master);
  o.start(t);
  o.stop(t + 0.2);
}

function sfxMiss() {
  if (!audio.ctx) return;
  const { ctx, master } = audio, t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.32);
}

// ---------------------------------------------------------------- particles
const MAXP = 900;
const pPos = new Float32Array(MAXP * 3).fill(-999);
const pCol = new Float32Array(MAXP * 3);
const pBase = new Float32Array(MAXP * 3);
const pVel = new Float32Array(MAXP * 3);
const pLife = new Float32Array(MAXP);
let pNext = 0;
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3).setUsage(THREE.DynamicDrawUsage));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
  size: 0.045, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
  depthWrite: false, toneMapped: false,
}));
particles.frustumCulled = false;
scene.add(particles);

function burst(at, color, push, count = 45) {
  for (let n = 0; n < count; n++) {
    const i = pNext;
    pNext = (pNext + 1) % MAXP;
    const v = new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.8, 3.5)).addScaledVector(push, rand(0.5, 2));
    pPos.set([at.x, at.y, at.z], i * 3);
    pVel.set([v.x, v.y, v.z], i * 3);
    pBase.set([color.r * 2, color.g * 2, color.b * 2], i * 3);
    pLife[i] = rand(0.35, 0.8);
  }
}

function updateParticles(dt) {
  for (let i = 0; i < MAXP; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt;
    const k = i * 3;
    if (pLife[i] <= 0) { pPos[k + 1] = -999; continue; }
    pVel[k + 1] -= 5 * dt;
    pPos[k] += pVel[k] * dt;
    pPos[k + 1] += pVel[k + 1] * dt;
    pPos[k + 2] += pVel[k + 2] * dt;
    const f = Math.min(1, pLife[i] * 2.5);
    pCol[k] = pBase[k] * f;
    pCol[k + 1] = pBase[k + 1] * f;
    pCol[k + 2] = pBase[k + 2] * f;
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
}

// ---------------------------------------------------------------- targets
const cubeGeo = new THREE.BoxGeometry(CFG.cubeSize, CFG.cubeSize, CFG.cubeSize);
const edgeGeo = new THREE.EdgesGeometry(cubeGeo);
const PALETTE = [
  { body: 0x5a0d22, edge: new THREE.Color(3, 0.45, 0.8) },
  { body: 0x0d2a5e, edge: new THREE.Color(0.45, 1.3, 3) },
].map((p) => ({
  ...p,
  bodyMat: new THREE.MeshStandardMaterial({ color: p.body, emissive: p.body, emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.35 }),
  edgeMat: new THREE.LineBasicMaterial({ color: p.edge, toneMapped: false }),
}));

const targets = [];
const halves = [];

function spawnTarget(speed, lane) {
  const p = pick(PALETTE);
  const mesh = new THREE.Mesh(cubeGeo, p.bodyMat);
  mesh.add(new THREE.LineSegments(edgeGeo, p.edgeMat));
  mesh.position.set(CFG.laneX[lane], pick(CFG.rowY), CFG.spawnZ);
  mesh.rotation.z = pick([0, Math.PI / 4]);
  scene.add(mesh);
  targets.push({ mesh, palette: p, vel: new V3(0, 0, speed) });
}

function removeTarget(i) {
  scene.remove(targets[i].mesh);
  targets.splice(i, 1);
}

// Split a cube into two halves with clipping planes that follow each half as it flies.
function sliceTarget(t, point, normal, swingDir) {
  const m = t.mesh;
  m.updateMatrixWorld();
  const inv = m.matrixWorld.clone().invert();
  const worldPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
  for (const sign of [1, -1]) {
    const local = worldPlane.clone();
    if (sign < 0) local.negate();
    local.applyMatrix4(inv);
    const clip = new THREE.Plane();
    const h = m.clone();
    const bodyMat = t.palette.bodyMat.clone();
    const edgeMat = t.palette.edgeMat.clone();
    for (const mat of [bodyMat, edgeMat]) {
      mat.clippingPlanes = [clip];
      mat.transparent = true;
    }
    bodyMat.side = THREE.DoubleSide;
    h.material = bodyMat;
    h.children[0].material = edgeMat;
    scene.add(h);
    const vel = t.vel.clone().multiplyScalar(0.3).addScaledVector(normal, 1.5 * sign).addScaledVector(swingDir, 2);
    vel.y += 1;
    halves.push({
      mesh: h, local, clip, vel, life: 1.3, mats: [bodyMat, edgeMat],
      spin: new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(7),
    });
  }
}

function updateHalves(dt) {
  for (let i = halves.length - 1; i >= 0; i--) {
    const h = halves[i];
    h.life -= dt;
    if (h.life <= 0) {
      scene.remove(h.mesh);
      h.mats.forEach((m) => m.dispose());
      halves.splice(i, 1);
      continue;
    }
    h.vel.y -= 9.8 * dt;
    h.mesh.position.addScaledVector(h.vel, dt);
    h.mesh.rotation.x += h.spin.x * dt;
    h.mesh.rotation.y += h.spin.y * dt;
    h.mesh.rotation.z += h.spin.z * dt;
    h.mesh.updateMatrixWorld();
    h.clip.copy(h.local).applyMatrix4(h.mesh.matrixWorld);
    const op = Math.min(1, h.life / 0.4);
    h.mats.forEach((m) => { m.opacity = op; });
  }
}

// ---------------------------------------------------------------- game state / HUD
const game = { state: 'lobby', time: 0, spawnTimer: 1.5, score: 0, combo: 0, maxCombo: 0, hits: 0, misses: 0 };
let shake = 0;

function multiplier() { return Math.min(1 + Math.floor(game.combo / 8), 4); }

function updateHud() {
  $('score').textContent = game.score.toLocaleString();
  $('combo').textContent = game.combo;
  $('mult').textContent = 'x' + multiplier();
  const total = game.hits + game.misses;
  $('acc').textContent = total ? Math.round((game.hits / total) * 100) + '%' : '-';
}

function startGame() {
  while (targets.length) removeTarget(0);
  Object.assign(game, { state: 'playing', time: 0, spawnTimer: 1.5, score: 0, combo: 0, maxCombo: 0, hits: 0, misses: 0 });
  updateHud();
  $('lobby').classList.add('hidden');
}

function showLobby(msg = '') {
  game.state = 'lobby';
  $('lobbyMsg').textContent = msg;
  $('lobby').classList.remove('hidden');
}

function startMouseMode() {
  if (inputMode === 'phone') return;
  inputMode = 'mouse';
  unlockAudio();
  setNet('<b>Mouse mode</b> · move the mouse to swing');
  startGame();
}
$('mouseBtn').addEventListener('click', startMouseMode);

function popupAt(text, worldPos, color, cls = '') {
  const v = worldPos.clone().project(camera);
  const el = document.createElement('div');
  el.className = 'pop ' + cls;
  el.textContent = text;
  el.style.left = ((v.x + 1) / 2) * innerWidth + 'px';
  el.style.top = ((1 - v.y) / 2) * innerHeight + 'px';
  if (color) el.style.color = color;
  $('popups').appendChild(el);
  setTimeout(() => el.remove(), 750);
}

function onHit(t, point, normal, swingDir) {
  game.combo++;
  game.hits++;
  game.maxCombo = Math.max(game.maxCombo, game.combo);
  const pts = 100 * multiplier();
  game.score += pts;
  sliceTarget(t, point, normal, swingDir);
  burst(point, t.palette.edge.clone().lerp(saberColor, 0.4), swingDir);
  popupAt('+' + pts, point, '#' + t.palette.edge.clone().multiplyScalar(0.4).getHexString());
  sfxSlice();
  shake = Math.min(shake + 0.035, 0.08);
  sendToPhone({ t: 'h' });
  updateHud();
}

function onMiss(t) {
  game.combo = 0;
  game.misses++;
  popupAt('MISS', t.mesh.position.clone().setZ(-0.5), null, 'miss');
  sfxMiss();
  const v = $('vignette');
  v.style.opacity = 1;
  setTimeout(() => { v.style.opacity = 0; }, 160);
  updateHud();
}

// ---------------------------------------------------------------- hit detection
const base = new V3(), tip = new V3(), mid = new V3();
const prevBase = new V3(), prevTip = new V3();
const _a = new V3(), _b = new V3(), _cp = new V3(), _seg = new V3(), _tmp = new V3();
let speedEma = 0;

function closestOnSegment(p, a, b, out) {
  _seg.subVectors(b, a);
  const t = clamp(_tmp.subVectors(p, a).dot(_seg) / _seg.lengthSq(), 0, 1);
  return out.copy(a).addScaledVector(_seg, t);
}

function checkHits(tipSpeed) {
  if (tipSpeed < CFG.minSwingSpeed) return;
  const swing = new V3().subVectors(tip, prevTip);
  const swingDir = swing.lengthSq() > 1e-8 ? swing.clone().normalize() : new V3(1, 0, 0);
  const SUB = 8;
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    const c = t.mesh.position;
    if (c.z < -2.5 || c.z > 1.2) continue;
    for (let s = 0; s <= SUB; s++) {
      const f = s / SUB;
      _a.lerpVectors(prevBase, base, f);
      _b.lerpVectors(prevTip, tip, f);
      closestOnSegment(c, _a, _b, _cp);
      if (_cp.distanceTo(c) < CFG.hitRadius) {
        const bladeDir = _b.clone().sub(_a).normalize();
        let normal = new V3().crossVectors(bladeDir, swingDir);
        if (normal.lengthSq() < 1e-6) normal = new V3(0, 1, 0);
        normal.normalize();
        onHit(t, c.clone(), normal, swingDir);
        removeTarget(i);
        break;
      }
    }
  }
}

// ---------------------------------------------------------------- networking (PeerJS / WebRTC)
let peer = null, conn = null, roomCode = '';
const net = { rtt: 0, count: 0, hz: 0, lastData: 0 };

function setNet(html) { $('net').innerHTML = html; }

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[(Math.random() * chars.length) | 0]).join('');
}

function controllerUrl() {
  const dir = location.pathname.replace(/[^/]*$/, '');
  return `${location.origin}${dir}controller.html?room=${roomCode}`;
}

function renderQr() {
  const url = controllerUrl();
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  $('qr').innerHTML = `<img alt="QR code" src="${qr.createDataURL(6, 2)}">`;
  $('code').textContent = roomCode;
  $('url').textContent = url;
  $('url').href = url;
  if (/^(localhost|127\.)/.test(location.hostname)) {
    $('lobbyMsg').textContent = 'Running on localhost: phones need the deployed HTTPS URL.';
  }
}

function startHost() {
  roomCode = makeCode();
  peer = new Peer(CFG.peerPrefix + roomCode);
  peer.on('open', () => {
    renderQr();
    if (inputMode !== 'mouse') setNet('Waiting for controller · room <b>' + roomCode + '</b>');
  });
  peer.on('connection', (c) => {
    if (conn) conn.close();
    conn = c;
    c.on('open', () => {
      inputMode = 'phone';
      needCalib = true;
      setNet('<b>Phone connected</b>');
      startGame();
    });
    c.on('data', onData);
    c.on('close', () => {
      if (conn !== c) return;
      conn = null;
      inputMode = 'none';
      setNet('Controller disconnected · room <b>' + roomCode + '</b>');
      showLobby('Controller disconnected. Scan again or reopen the phone page.');
    });
  });
  peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
  peer.on('error', (e) => {
    if (e.type === 'unavailable-id') { peer.destroy(); startHost(); return; }
    console.warn('peer error', e.type, e);
    if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') {
      setNet('Signaling server problem (' + e.type + '). Retrying...');
    }
  });
}

function sendToPhone(msg) {
  if (conn && conn.open) conn.send(msg);
}

function onData(d) {
  if (!d || typeof d !== 'object') return;
  switch (d.t) {
    case 'o':
      net.count++;
      net.lastData = performance.now();
      onOrientation(d.a, d.b, d.g);
      break;
    case 'r': requestRecenter(); break;
    case 'c': setSaberColor(d.c); break;
    case 'q': net.rtt = performance.now() - d.ts; break;
  }
}

setInterval(() => {
  net.hz = net.count;
  net.count = 0;
  if (inputMode === 'phone' && conn) {
    sendToPhone({ t: 'p', ts: performance.now() });
    const stale = performance.now() - net.lastData > 1000;
    setNet(`<b>Phone connected</b> · ping ${Math.round(net.rtt)} ms · ${net.hz} Hz` + (stale ? ' · <b>no motion data</b>' : ''));
  }
}, 1000);

startHost();

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();
saber.quaternion.copy(qTarget);
saber.updateMatrixWorld();
saber.localToWorld(prevBase.set(0, CFG.bladeStart, 0));
saber.localToWorld(prevTip.set(0, BLADE_END, 0));

function step(dt) {

  // saber follows input with light smoothing to hide network jitter
  saber.quaternion.slerp(qTarget, 1 - Math.exp(-dt * 38));
  saber.updateMatrixWorld();
  saber.localToWorld(base.set(0, CFG.bladeStart, 0));
  saber.localToWorld(tip.set(0, BLADE_END, 0));
  saber.localToWorld(mid.set(0, CFG.bladeStart + CFG.bladeLen * 0.35, 0));
  const tipSpeed = tip.distanceTo(prevTip) / Math.max(dt, 1e-3);
  speedEma += (tipSpeed - speedEma) * Math.min(1, dt * 12);
  updateTrail(mid, tip, Math.max(tipSpeed, speedEma));
  updateHum(speedEma);

  if (game.state === 'playing') {
    game.time += dt;
    const speed = Math.min(6 + game.time * 0.04, 10);
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      const lane = (Math.random() * CFG.laneX.length) | 0;
      spawnTarget(speed, lane);
      if (game.time > 20 && Math.random() < 0.25) spawnTarget(speed, (lane + 2) % CFG.laneX.length);
      game.spawnTimer = Math.max(1.0 - game.time * 0.006, 0.45);
    }
  }

  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    t.mesh.position.addScaledVector(t.vel, dt);
    if (t.mesh.position.z > CFG.missZ) {
      if (game.state === 'playing') onMiss(t);
      removeTarget(i);
    }
  }
  checkHits(Math.max(tipSpeed, speedEma));
  updateHalves(dt);
  updateParticles(dt);

  const archSpeed = game.state === 'playing' ? 4 : 1.2;
  for (const a of arches) {
    a.position.z += archSpeed * dt;
    if (a.position.z > 3) a.position.z -= 60;
  }

  shake *= Math.exp(-dt * 10);
  camera.position.set(CAM_POS.x + rand(-1, 1) * shake, CAM_POS.y + rand(-1, 1) * shake, CAM_POS.z);
  camera.quaternion.copy(camBaseQuat);

  prevBase.copy(base);
  prevTip.copy(tip);
  composer.render();
}

function frame() {
  step(Math.min(clock.getDelta(), 0.05));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ?debug exposes internals for automated testing in the console.
if (new URLSearchParams(location.search).has('debug')) {
  window.__sabr = { step, game, targets, qTarget, startMouseMode };
}
