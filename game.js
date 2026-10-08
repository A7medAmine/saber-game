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

// Tuning knobs for the whole game live here.
const CFG = {
  maxPlayers: 4,
  playerSpread: 0.95, // distance between players' hands
  handY: 1.05,
  handZ: 0.55,
  bladeStart: 0.1,
  bladeLen: 1.25,
  cubeSize: 0.42,
  hitRadius: 0.34,
  bombRadius: 0.25,
  minSwingSpeed: 1.6, // tip speed (m/s) needed for a cut
  spawnZ: -32,
  hitZ: -0.4, // where cubes are meant to be cut, used to line spawns up with the beat
  missZ: 0.7,
  rowY: [0.75, 1.15, 1.55],
  bpm: 112,
  countdown: 3,
  maxHealth: 100,
  dmgMiss: 6,
  dmgBomb: 15,
  healGold: 15,
  teamWindow: 1.2, // seconds: hits by different players inside this window = teamwork bonus
  peerPrefix: 'sabrgamr-',
};
const BLADE_END = CFG.bladeStart + CFG.bladeLen;
const BEAT = 60 / CFG.bpm;
const SLOT_COLORS = ['#5cbcf9', '#ff3b5c', '#3dff7a', '#ffb02e'];
let laneX = [-0.5, -0.1, 0.3, 0.7];

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.localClippingEnabled = true;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
// AFAQ midnight, pushed darker so the neon still pops
scene.background = new THREE.Color(0x02041a);
scene.fog = new THREE.Fog(0x02041a, 10, 38);

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.05, 200);
const camPos = new V3(0.1, 1.65, 1.75);
const camGoal = camPos.clone();
camera.position.copy(camPos);

scene.add(new THREE.HemisphereLight(0x8fa6ff, 0x050a30, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(2, 5, 3);
scene.add(sun);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.4, 0.85));
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- environment
const arches = [];
const RAIL_BASE = new THREE.Color(0.36, 0.74, 2.4); // AFAQ sky
const ARCH_BASE = new THREE.Color(0.14, 0.24, 1.6); // AFAQ blue
const EMBLEM_BASE = new THREE.Color(0.5, 0.8, 2.2);
const railMat = new THREE.MeshBasicMaterial({ color: RAIL_BASE.clone(), toneMapped: false });
const archMat = new THREE.MeshBasicMaterial({ color: ARCH_BASE.clone(), toneMapped: false });
const emblemMat = new THREE.MeshBasicMaterial({
  color: EMBLEM_BASE.clone(), transparent: true, depthWrite: false, fog: false, toneMapped: false,
  map: new THREE.TextureLoader().load('assets/afaq-mark-white-1024.png', (t) => { t.colorSpace = THREE.SRGBColorSpace; }),
});
(function buildEnvironment() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 120),
    new THREE.MeshStandardMaterial({ color: 0x040824, roughness: 0.35, metalness: 0.7 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -40;
  scene.add(floor);

  const grid = new THREE.GridHelper(120, 120, 0x1f34d8, 0x0d1660);
  grid.position.set(0, 0.002, -40);
  scene.add(grid);

  for (const x of [-2.1, 2.3]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 80), railMat);
    rail.position.set(x, 0.02, -38);
    scene.add(rail);
  }

  const W = 5.6, H = 4, T = 0.05;
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
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcae8ff, size: 0.25, fog: false })));

  // AFAQ mark rising over the horizon, past the end of the arch tunnel
  const emblem = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), emblemMat);
  emblem.position.set(0.1, 9, -75);
  emblem.renderOrder = -1;
  scene.add(emblem);
})();

// ---------------------------------------------------------------- sabers
// W3C device orientation: R = Rz(alpha) * Rx(beta) * Ry(gamma), earth frame X=east, Y=north, Z=up.
// Q_EARTH converts earth frame into three.js world (Y up, -Z forward). Device +Y (phone top) == blade.
const Q_EARTH = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -Math.PI / 2);
const Q_IDLE = new THREE.Quaternion().setFromUnitVectors(UP, new V3(0, 0.6, -1).normalize());
const _euler = new THREE.Euler();
const hiltGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.26, 16);
const hiltMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.3 });
const coreGeo = new THREE.CylinderGeometry(0.011, 0.013, CFG.bladeLen, 12);
const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.8, 1.8), toneMapped: false });
const glowGeo = new THREE.CylinderGeometry(0.022, 0.025, CFG.bladeLen + 0.02, 16);
const TRAIL_N = 14;
const trailIndex = [];
for (let i = 0; i < TRAIL_N - 1; i++) {
  const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
  trailIndex.push(a, b, c, b, d, c);
}

class Saber {
  constructor(color) {
    this.color = new THREE.Color();
    this.group = new THREE.Group();
    const hilt = new THREE.Mesh(hiltGeo, hiltMat);
    hilt.position.y = -0.03;
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = CFG.bladeStart + CFG.bladeLen / 2;
    this.glowMat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    const glow = new THREE.Mesh(glowGeo, this.glowMat);
    glow.position.y = core.position.y;
    this.light = new THREE.PointLight(0xffffff, 2.5, 4, 1.8);
    this.light.position.y = 0.7;
    this.group.add(hilt, core, glow, this.light);
    scene.add(this.group);

    this.trailPos = new Float32Array(TRAIL_N * 6);
    this.trailCol = new Float32Array(TRAIL_N * 6);
    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.trailGeo.setAttribute('color', new THREE.BufferAttribute(this.trailCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.trailGeo.setIndex(trailIndex);
    this.trailMat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    this.trail = new THREE.Mesh(this.trailGeo, this.trailMat);
    this.trail.frustumCulled = false;
    scene.add(this.trail);
    this.trailHist = Array.from({ length: TRAIL_N }, () => [new V3(), new V3()]);

    this.base = new V3();
    this.tip = new V3();
    this.mid = new V3();
    this.prevBase = new V3();
    this.prevTip = new V3();
    this.speed = 0;
    this.speedEma = 0;
    this.fresh = true;

    this.qDevice = new THREE.Quaternion();
    this.qOffset = new THREE.Quaternion();
    this.qTarget = Q_IDLE.clone();
    this.group.quaternion.copy(Q_IDLE);
    this.needCalib = true;
    this.setColor(color);
  }

  setColor(hex) {
    this.color.set(hex);
    this.glowMat.color.copy(this.color).multiplyScalar(1.3);
    this.light.color.copy(this.color);
  }

  setPivot(v) {
    if (this.group.position.distanceToSquared(v) > 1e-6) this.fresh = true;
    this.group.position.copy(v);
  }

  onOrientation(a, b, g) {
    _euler.set(b * D2R, g * D2R, a * D2R, 'ZXY');
    this.qDevice.setFromEuler(_euler).premultiply(Q_EARTH);
    if (this.needCalib) this.calibrate();
    this.qTarget.copy(this.qDevice).premultiply(this.qOffset);
  }

  // Yaw-only recenter: whatever direction the phone points now becomes "into the screen".
  calibrate() {
    const v = UP.clone().applyQuaternion(this.qDevice);
    if (Math.hypot(v.x, v.z) < 0.15) return; // pointing straight up/down, retry next sample
    this.qOffset.setFromAxisAngle(UP, Math.atan2(v.x, -v.z));
    this.needCalib = false;
  }

  recenter() { this.needCalib = true; }

  pointAt(dir) { this.qTarget.setFromUnitVectors(UP, dir); }

  get swing() { return Math.max(this.speed, this.speedEma); }

  update(dt) {
    // follow input with light smoothing to hide network jitter
    this.group.quaternion.slerp(this.qTarget, 1 - Math.exp(-dt * 38));
    this.group.updateMatrixWorld();
    this.group.localToWorld(this.base.set(0, CFG.bladeStart, 0));
    this.group.localToWorld(this.tip.set(0, BLADE_END, 0));
    this.group.localToWorld(this.mid.set(0, CFG.bladeStart + CFG.bladeLen * 0.35, 0));
    if (this.fresh) {
      this.prevBase.copy(this.base);
      this.prevTip.copy(this.tip);
      for (const h of this.trailHist) { h[0].copy(this.mid); h[1].copy(this.tip); }
      this.fresh = false;
    }
    this.speed = this.tip.distanceTo(this.prevTip) / Math.max(dt, 1e-3);
    this.speedEma += (this.speed - this.speedEma) * Math.min(1, dt * 12);
    this.updateTrail();
  }

  updateTrail() {
    const last = this.trailHist.pop();
    last[0].copy(this.mid);
    last[1].copy(this.tip);
    this.trailHist.unshift(last);
    const strength = clamp((this.swing - 1) / 6, 0, 1);
    const c = this.color;
    for (let i = 0; i < TRAIL_N; i++) {
      const [m, t] = this.trailHist[i];
      this.trailPos.set([m.x, m.y, m.z, t.x, t.y, t.z], i * 6);
      const f = (1 - i / (TRAIL_N - 1)) * strength;
      this.trailCol.set([c.r * f * 0.3, c.g * f * 0.3, c.b * f * 0.3, c.r * f * 1.6, c.g * f * 1.6, c.b * f * 1.6], i * 6);
    }
    this.trailGeo.attributes.position.needsUpdate = true;
    this.trailGeo.attributes.color.needsUpdate = true;
  }

  endFrame() {
    this.prevBase.copy(this.base);
    this.prevTip.copy(this.tip);
  }

  dispose() {
    scene.remove(this.group, this.trail);
    this.glowMat.dispose();
    this.trailMat.dispose();
    this.trailGeo.dispose();
  }
}

// ---------------------------------------------------------------- players
const players = new Map(); // pid -> player (kept after disconnect so stats survive a rejoin)
const connPlayer = new WeakMap();

function activePlayers() {
  return [...players.values()].filter((p) => p.saber).sort((a, b) => a.slot - b.slot);
}

function freeSlot(exceptPid) {
  const used = new Set(activePlayers().filter((p) => p.pid !== exceptPid).map((p) => p.slot));
  for (let i = 0; i < CFG.maxPlayers; i++) if (!used.has(i)) return i;
  return -1;
}

function newStats() { return { hits: 0, misses: 0, score: 0, bombs: 0, perfect: 0 }; }

function addPlayer(pid, color, conn) {
  let p = players.get(pid);
  if (p && p.saber) {
    clearTimeout(p.dropTimer);
    p.conn = conn; // same phone reconnected while still active
  } else {
    const slot = freeSlot(pid);
    if (slot < 0) return null;
    if (!p) {
      p = { pid, stats: newStats(), net: { rtt: 0, count: 0, hz: 0, lastData: 0 } };
      players.set(pid, p);
    }
    p.slot = slot;
    p.name = pid === 'mouse' ? 'Mouse' : 'P' + (slot + 1);
    p.color = color || p.color || SLOT_COLORS[slot];
    p.conn = conn;
    p.saber = new Saber(p.color);
    p.net.lastData = performance.now();
    banner(`${p.name} joined`, p.color);
  }
  p.saber.recenter();
  relayout();
  updatePlayerUi();
  return p;
}

function removePlayer(p) {
  if (!p.saber) return;
  p.saber.dispose();
  p.saber = null;
  p.conn = null;
  relayout();
  updatePlayerUi();
  banner(`${p.name} left`, '#8a90b8');
  if (!activePlayers().length && game.state !== 'lobby') toLobby('Everyone left.');
}

// Spread players' hands across the lane and widen the playfield to match.
function relayout() {
  const list = activePlayers();
  const n = Math.max(1, list.length);
  list.forEach((p, i) => p.saber.setPivot(new V3((i - (n - 1) / 2) * CFG.playerSpread + 0.1, CFG.handY, CFG.handZ)));
  const half = 0.6 + ((n - 1) * CFG.playerSpread) / 2;
  const count = 4 + (n - 1) * 2;
  laneX = Array.from({ length: count }, (_, i) => 0.1 - half + (i * 2 * half) / (count - 1));
  camGoal.set(0.1, 1.65 + (n - 1) * 0.12, 1.75 + (n - 1) * 0.5);
}

let mouseDir = new V3(0, 0.6, -1).normalize();
addEventListener('mousemove', (e) => {
  const mx = (e.clientX / innerWidth) * 2 - 1;
  const my = (e.clientY / innerHeight) * 2 - 1;
  const yaw = mx * 1.15, pitch = -my * 0.95 + 0.15;
  mouseDir = new V3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  const p = players.get('mouse');
  if (p && p.saber) p.saber.pointAt(mouseDir);
});

function toggleMousePlayer() {
  const p = players.get('mouse');
  if (p && p.saber) { removePlayer(p); return; }
  if (!addPlayer('mouse', null, null)) { banner('Room is full', '#ff5a6e'); return; }
  players.get('mouse').saber.pointAt(mouseDir);
}

function recenterAll() {
  for (const p of activePlayers()) p.saber.recenter();
  banner('RECENTER', '#9fe3ff');
}

// ---------------------------------------------------------------- audio (all synthesized)
const audio = { ctx: null };
function unlockAudio() {
  if (audio.ctx) { if (audio.ctx.state !== 'running') audio.ctx.resume(); return; }
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  const musicGain = ctx.createGain();
  musicGain.gain.value = 0.45;
  musicGain.connect(master);
  const humFilter = ctx.createBiquadFilter();
  humFilter.type = 'lowpass';
  humFilter.frequency.value = 350;
  const humGain = ctx.createGain();
  humGain.gain.value = 0;
  humFilter.connect(humGain).connect(master);
  const oscs = [85, 87.5].map((f) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.connect(humFilter);
    o.start();
    return o;
  });
  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const ch = noise.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  Object.assign(audio, { ctx, master, musicGain, humFilter, humGain, oscs, noise });
}

const audioReady = () => audio.ctx && audio.ctx.state === 'running';

function updateHum(speed, anyone) {
  if (!audioReady()) return;
  const t = audio.ctx.currentTime, s = Math.min(speed, 10);
  audio.humGain.gain.setTargetAtTime(anyone ? 0.025 + s * 0.022 : 0, t, 0.03);
  audio.humFilter.frequency.setTargetAtTime(300 + s * 160, t, 0.03);
  audio.oscs[0].frequency.setTargetAtTime(85 + s * 5, t, 0.05);
  audio.oscs[1].frequency.setTargetAtTime(87.5 + s * 5, t, 0.05);
}

function env(t, peak, decay, out) {
  const g = audio.ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  g.connect(out || audio.master);
  return g;
}

function noiseHit(t, type, freq, peak, decay, out) {
  const src = audio.ctx.createBufferSource();
  src.buffer = audio.noise;
  const f = audio.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  src.connect(f).connect(env(t, peak, decay, out));
  src.start(t);
  src.stop(t + decay + 0.02);
  return f;
}

function tone(t, type, f0, f1, peak, decay, out) {
  const o = audio.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + decay * 0.8);
  o.connect(env(t, peak, decay, out));
  o.start(t);
  o.stop(t + decay + 0.02);
}

function sfxSlice(perfect) {
  if (!audioReady()) return;
  const t = audio.ctx.currentTime;
  const f = noiseHit(t, 'bandpass', 3200, 0.6, 0.22);
  f.frequency.exponentialRampToValueAtTime(700, t + 0.2);
  tone(t, 'sine', 900, 110, 0.25, 0.18);
  if (perfect) tone(t, 'triangle', 1320, 1320, 0.12, 0.25);
}

function sfxMiss() {
  if (!audioReady()) return;
  tone(audio.ctx.currentTime, 'triangle', 140, 50, 0.35, 0.3);
}

function sfxBomb() {
  if (!audioReady()) return;
  const t = audio.ctx.currentTime;
  noiseHit(t, 'lowpass', 900, 0.9, 0.6);
  tone(t, 'sine', 90, 30, 0.8, 0.5);
}

function sfxChime(up = true) {
  if (!audioReady()) return;
  const t = audio.ctx.currentTime;
  (up ? [660, 880, 1320] : [520, 390]).forEach((f, i) => tone(t + i * 0.07, 'triangle', f, f, 0.15, 0.3));
}

// Tiny step sequencer: kick / snare / hats / bass / arp at CFG.bpm.
const music = { playing: false, nextTime: 0, step: 0, timer: null };
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const BASS_ROOTS = [33, 29, 36, 31]; // A F C G
const BASS_PATTERN = [0, null, 0, null, 12, null, 0, null, 0, null, 0, 12, null, 0, null, 7];
const ARP = [0, 7, 12, 15, 12, 7];

function musicStart(at) {
  if (!audioReady()) return;
  music.playing = true;
  music.nextTime = at;
  music.step = 0;
  clearInterval(music.timer);
  music.timer = setInterval(musicTick, 25);
}

function musicStop() {
  music.playing = false;
  clearInterval(music.timer);
}

function musicTick() {
  const ctx = audio.ctx, stepDur = BEAT / 4;
  if (music.nextTime < ctx.currentTime - 0.5) { // tab was asleep: skip ahead instead of a burst
    const skip = Math.ceil((ctx.currentTime - music.nextTime) / stepDur);
    music.nextTime += skip * stepDur;
    music.step += skip;
  }
  while (music.nextTime < ctx.currentTime + 0.12) {
    playStep(music.step, music.nextTime);
    music.nextTime += stepDur;
    music.step++;
  }
}

function playStep(step, t) {
  const out = audio.musicGain, s = step % 16, bar = Math.floor(step / 16);
  const intense = bar >= 8;
  if (s % 4 === 0) tone(t, 'sine', 150, 42, 0.9, 0.3, out);
  if (s === 4 || s === 12) { noiseHit(t, 'highpass', 1400, 0.35, 0.16, out); tone(t, 'triangle', 190, 160, 0.2, 0.1, out); }
  if (s % 2 === 1 || intense) noiseHit(t, 'highpass', 7000, s % 4 === 2 ? 0.09 : 0.04, 0.04, out);
  const root = BASS_ROOTS[bar % 4];
  if (BASS_PATTERN[s] !== null) {
    const o = audio.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(midi(root + BASS_PATTERN[s]), t);
    const f = audio.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(220, t + 0.18);
    o.connect(f).connect(env(t, 0.22, 0.2, out));
    o.start(t);
    o.stop(t + 0.22);
  }
  if (bar >= 4) {
    const note = midi(root + 36 + ARP[step % ARP.length]);
    tone(t, 'square', note, note, intense ? 0.05 : 0.03, 0.12, out);
  }
}

// ---------------------------------------------------------------- particles
const MAXP = 1200;
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

function burst(at, color, push, count = 45, power = 3.5) {
  for (let n = 0; n < count; n++) {
    const i = pNext;
    pNext = (pNext + 1) % MAXP;
    const v = new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.8, power)).addScaledVector(push, rand(0.5, 2));
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
const S = CFG.cubeSize;
const cubeGeo = new THREE.BoxGeometry(S, S, S);
const edgeGeo = new THREE.EdgesGeometry(cubeGeo);
const markMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.2), toneMapped: false });
const arrowShape = new THREE.Shape();
arrowShape.moveTo(-0.13, -0.05);
arrowShape.lineTo(0, 0.1);
arrowShape.lineTo(0.13, -0.05);
arrowShape.lineTo(0, 0.0);
arrowShape.closePath();
const arrowGeo = new THREE.ShapeGeometry(arrowShape);
const dotGeo = new THREE.CircleGeometry(0.05, 20);
const bombGeo = new THREE.IcosahedronGeometry(0.21, 0);
const bombEdgeGeo = new THREE.EdgesGeometry(bombGeo);

const kindStyle = (body, edge, emissive = 0.7) => ({
  edge,
  bodyMat: new THREE.MeshStandardMaterial({ color: body, emissive: body, emissiveIntensity: emissive, metalness: 0.3, roughness: 0.35 }),
  edgeMat: new THREE.LineBasicMaterial({ color: edge, toneMapped: false }),
});
const CUBE_STYLES = [
  kindStyle(0x5a0d22, new THREE.Color(3, 0.45, 0.8)),
  kindStyle(0x0d2a5e, new THREE.Color(0.45, 1.3, 3)),
];
const GOLD_STYLE = kindStyle(0x6a4a00, new THREE.Color(3, 2.2, 0.4), 1.1);
const BOMB_STYLE = kindStyle(0x140306, new THREE.Color(2.6, 0.15, 0.1), 0.4);

const targets = [];
const halves = [];

// dir: null for "any direction" (dot), otherwise the angle of the arrow in screen space.
function spawnTarget(kind, x, y, z, speed, dir = null) {
  let mesh, style;
  if (kind === 'bomb') {
    style = BOMB_STYLE;
    mesh = new THREE.Mesh(bombGeo, style.bodyMat);
    mesh.add(new THREE.LineSegments(bombEdgeGeo, style.edgeMat));
  } else {
    style = kind === 'gold' ? GOLD_STYLE : pick(CUBE_STYLES);
    mesh = new THREE.Mesh(cubeGeo, style.bodyMat);
    mesh.add(new THREE.LineSegments(edgeGeo, style.edgeMat));
    const mark = new THREE.Mesh(dir === null ? dotGeo : arrowGeo, markMat);
    mark.position.z = S / 2 + 0.003;
    mesh.add(mark);
    if (dir !== null) mesh.rotation.z = dir;
  }
  mesh.position.set(x, y, z);
  scene.add(mesh);
  targets.push({ mesh, kind, dir, style, vel: new V3(0, 0, speed), spin: kind === 'cube' ? 0 : rand(1.5, 3) });
}

function removeTarget(i) {
  scene.remove(targets[i].mesh);
  targets.splice(i, 1);
}

function clearTargets() {
  while (targets.length) removeTarget(0);
}

// Split a target into two halves with clipping planes that follow each half as it flies.
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
    const mats = [];
    h.traverse((o) => {
      if (!o.material) return;
      o.material = o.material.clone();
      o.material.clippingPlanes = [clip];
      o.material.transparent = true;
      o.material.side = THREE.DoubleSide;
      mats.push(o.material);
    });
    scene.add(h);
    const vel = t.vel.clone().multiplyScalar(0.3).addScaledVector(normal, 1.5 * sign).addScaledVector(swingDir, 2);
    vel.y += 1;
    halves.push({
      mesh: h, local, clip, vel, life: 1.3, mats,
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

// ---------------------------------------------------------------- game state
const game = {
  state: 'lobby', // lobby | countdown | playing | over
  useAudioClock: false,
  startAt: 0,
  songTime: 0,
  nextBeat: 4,
  practiceTimer: 1,
  score: 0, combo: 0, bestCombo: 0, hits: 0, misses: 0,
  health: CFG.maxHealth,
  lastHitBy: null, lastHitAt: -99,
};
let shake = 0;

const clockNow = () => (game.useAudioClock && audioReady() ? audio.ctx.currentTime : performance.now() / 1000);
const multiplier = () => Math.min(1 + Math.floor(game.combo / 8), 4);

function setState(s) {
  game.state = s;
  broadcast({ t: 'state', s });
  $('lobby').classList.toggle('hidden', s !== 'lobby');
  $('results').classList.toggle('hidden', s !== 'over');
  $('countdown').classList.toggle('hidden', s !== 'countdown');
  $('miniJoin').classList.toggle('hidden', s === 'lobby');
  $('hud').classList.toggle('off', s === 'lobby');
}

function requestStart() {
  if (game.state !== 'lobby' && game.state !== 'over') return;
  if (!activePlayers().length) return;
  clearTargets();
  for (const p of players.values()) p.stats = newStats();
  Object.assign(game, {
    score: 0, combo: 0, bestCombo: 0, hits: 0, misses: 0, health: CFG.maxHealth,
    nextBeat: 4, lastHitBy: null, lastHitAt: -99,
  });
  game.useAudioClock = audioReady();
  game.startAt = clockNow() + CFG.countdown;
  game.songTime = -CFG.countdown;
  musicStart(game.startAt);
  updateHud();
  setState('countdown');
}

function toLobby(msg = '') {
  musicStop();
  clearTargets();
  $('lobbyMsg').textContent = msg;
  setState('lobby');
}

function gameOver() {
  musicStop();
  sfxChime(false);
  for (const t of targets) burst(t.mesh.position, t.style.edge, new V3(0, 1, 0), 20);
  clearTargets();
  const total = game.hits + game.misses;
  $('resScore').textContent = game.score.toLocaleString();
  $('resMeta').textContent = `${Math.max(0, Math.floor(game.songTime))}s survived · best combo ${game.bestCombo} · accuracy ${total ? Math.round((game.hits / total) * 100) : 0}%`;
  const rows = [...players.values()].filter((p) => p.stats.hits || p.stats.bombs || p.saber)
    .sort((a, b) => b.stats.score - a.stats.score)
    .map((p) => `<tr><td><span class="chip"><i style="background:${p.color}"></i>${p.name}</span></td>
      <td>${p.stats.score.toLocaleString()}</td><td>${p.stats.hits}</td><td>${p.stats.perfect}</td><td>${p.stats.bombs}</td></tr>`);
  $('resPlayers').innerHTML = '<tr><th>Player</th><th>Score</th><th>Cuts</th><th>Perfect</th><th>Bombs</th></tr>' + rows.join('');
  setState('over');
}

function updateHud() {
  $('score').textContent = game.score.toLocaleString();
  $('combo').textContent = game.combo;
  $('mult').textContent = 'x' + multiplier();
  const total = game.hits + game.misses;
  $('acc').textContent = total ? Math.round((game.hits / total) * 100) + '%' : '-';
  const hp = clamp(game.health / CFG.maxHealth, 0, 1);
  $('healthFill').style.width = hp * 100 + '%';
}

function popupAt(text, worldPos, color, cls = '') {
  const v = worldPos.clone().project(camera);
  const el = document.createElement('div');
  el.className = 'pop ' + cls;
  el.textContent = text;
  el.style.left = ((v.x + 1) / 2) * innerWidth + 'px';
  el.style.top = ((1 - v.y) / 2) * innerHeight + 'px';
  if (color) el.style.color = color;
  $('popups').appendChild(el);
  setTimeout(() => el.remove(), 850);
}

let bannerTimer = 0;
function banner(text, color = '#fff') {
  const el = $('banner');
  el.textContent = text;
  el.style.color = color;
  el.classList.add('on');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.remove('on'), 1300);
}

function flashVignette() {
  const v = $('vignette');
  v.style.opacity = 1;
  setTimeout(() => { v.style.opacity = 0; }, 160);
}

function damage(n) {
  game.health = Math.max(0, game.health - n);
  flashVignette();
  updateHud();
  if (game.health <= 0) gameOver();
}

function onHit(t, p, point, normal, swingDir) {
  const scoring = game.state === 'playing';
  if (t.kind === 'bomb') {
    burst(point, t.style.edge, swingDir, 90, 5);
    sfxBomb();
    shake = 0.12;
    sendTo(p, { t: 'bomb' });
    popupAt('BOMB!', point, '#ff5a6e', 'big');
    if (scoring) {
      p.stats.bombs++;
      game.combo = 0;
      damage(CFG.dmgBomb);
    }
    return;
  }

  sliceTarget(t, point, normal, swingDir);
  let pts = 100, label = '', perfect = false;
  if (t.kind === 'gold') {
    pts = 300;
    label = 'HEAL';
  } else if (t.dir !== null) {
    // arrow cubes want a cut along the arrow (screen-space direction)
    const want = new THREE.Vector2(-Math.sin(t.dir), Math.cos(t.dir));
    const got = new THREE.Vector2(swingDir.x, swingDir.y).normalize();
    perfect = want.dot(got) > 0.45;
    pts = perfect ? 150 : 40;
    label = perfect ? 'PERFECT' : 'WRONG WAY';
  }
  burst(point, t.style.edge.clone().lerp(p.saber.color, 0.4), swingDir);
  sfxSlice(perfect);
  if (t.kind === 'gold') sfxChime(true);
  shake = Math.min(shake + 0.035, 0.08);
  sendTo(p, { t: 'h' });

  if (!scoring) {
    popupAt(label || 'NICE', point, '#' + p.saber.color.getHexString(), 'small');
    return;
  }
  if (label !== 'WRONG WAY') game.combo++;
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  game.hits++;
  pts *= multiplier();

  // teamwork: back-to-back cuts by different players
  if (game.lastHitBy && game.lastHitBy !== p && game.songTime - game.lastHitAt < CFG.teamWindow) {
    pts += 50 * multiplier();
    popupAt('TEAM +' + 50 * multiplier(), point.clone().add(new V3(0, 0.35, 0)), '#ffe066', 'small');
  }
  game.lastHitBy = p;
  game.lastHitAt = game.songTime;

  game.health = Math.min(CFG.maxHealth, game.health + (t.kind === 'gold' ? CFG.healGold : 1));
  if (perfect) p.stats.perfect++;
  p.stats.hits++;
  p.stats.score += pts;
  game.score += pts;
  popupAt('+' + pts + (label ? ' ' + label : ''), point, label === 'WRONG WAY' ? '#ff9a6e' : '#' + p.saber.color.getHexString());
  if (game.combo > 0 && game.combo % 25 === 0) { banner(`${game.combo} COMBO!`, '#ffe066'); sfxChime(true); }
  updateHud();
}

function onMiss(t) {
  game.combo = 0;
  game.misses++;
  popupAt('MISS', t.mesh.position.clone().setZ(-0.5), null, 'miss');
  sfxMiss();
  damage(game.songTime < 20 ? CFG.dmgMiss / 2 : CFG.dmgMiss); // gentler warm-up
}

// ---------------------------------------------------------------- spawning
const speedAt = (t) => 7 + (clamp(t, 0, 150) / 150) * 4;
const randomDir = () => ((Math.random() * 8) | 0) * (Math.PI / 4);

// Difficulty ramps with song time; more players means more targets per beat.
// Returns how many beats until the next spawn.
function spawnBeat(beatTime) {
  const t = beatTime, n = Math.max(1, activePlayers().length);
  const speed = speedAt(t);
  const z = CFG.hitZ - speed * (beatTime - game.songTime);
  let count = 1;
  if (Math.random() < Math.min(0.1 + t / 200, 0.4) + (n - 1) * 0.15) count++;
  if (n >= 3 && Math.random() < 0.35) count++;
  const lanes = [...laneX].sort(() => Math.random() - 0.5).slice(0, count);
  for (const x of lanes) {
    const r = Math.random();
    let kind = 'cube';
    if (t > 25 && r < 0.12) kind = 'bomb';
    else if (t > 10 && r > 0.97) kind = 'gold';
    const dir = kind === 'cube' && t > 12 && Math.random() < 0.45 ? randomDir() : null;
    spawnTarget(kind, x, pick(CFG.rowY), z, speed, dir);
  }
  if (t < 16) return 2;
  if (t < 45) return 1;
  return Math.random() < 0.35 ? 0.5 : 1;
}

function updateSpawning(dt) {
  if (game.state === 'countdown' || game.state === 'playing') {
    if (game.nextBeat * BEAT < game.songTime - 0.5) game.nextBeat = Math.ceil(game.songTime / BEAT) + 1; // tab slept
    for (let guard = 0; guard < 8; guard++) {
      const beatTime = game.nextBeat * BEAT;
      if (beatTime - game.songTime > (CFG.hitZ - CFG.spawnZ) / speedAt(beatTime)) break;
      game.nextBeat += spawnBeat(beatTime);
    }
  } else if (game.state === 'lobby' && activePlayers().length) {
    // slow practice cubes while waiting
    game.practiceTimer -= dt;
    if (game.practiceTimer <= 0 && targets.length < 4) {
      spawnTarget('cube', pick(laneX), pick(CFG.rowY), CFG.spawnZ * 0.6, 5, Math.random() < 0.4 ? randomDir() : null);
      game.practiceTimer = 1.7;
    }
  }
}

// ---------------------------------------------------------------- hit detection
const _a = new V3(), _b = new V3(), _cp = new V3(), _seg = new V3(), _tmp = new V3();

function closestOnSegment(p, a, b, out) {
  _seg.subVectors(b, a);
  const t = clamp(_tmp.subVectors(p, a).dot(_seg) / _seg.lengthSq(), 0, 1);
  return out.copy(a).addScaledVector(_seg, t);
}

// Sweep the blade from last frame to this one and test every target against it.
function checkHits(p) {
  const s = p.saber;
  if (s.swing < CFG.minSwingSpeed) return;
  const swing = new V3().subVectors(s.tip, s.prevTip);
  const swingDir = swing.lengthSq() > 1e-8 ? swing.normalize() : new V3(1, 0, 0);
  const SUB = 8;
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    if (!t) continue; // list shrank mid-loop (e.g. a bomb ended the game)
    const c = t.mesh.position;
    if (c.z < -2.5 || c.z > 1.2) continue;
    const r = t.kind === 'bomb' ? CFG.bombRadius : CFG.hitRadius;
    for (let k = 0; k <= SUB; k++) {
      const f = k / SUB;
      _a.lerpVectors(s.prevBase, s.base, f);
      _b.lerpVectors(s.prevTip, s.tip, f);
      closestOnSegment(c, _a, _b, _cp);
      if (_cp.distanceTo(c) < r) {
        const bladeDir = _b.clone().sub(_a).normalize();
        let normal = new V3().crossVectors(bladeDir, swingDir);
        if (normal.lengthSq() < 1e-6) normal = new V3(0, 1, 0);
        normal.normalize();
        const point = c.clone();
        removeTarget(i);
        onHit(t, p, point, normal, swingDir);
        break;
      }
    }
  }
}

// ---------------------------------------------------------------- networking (PeerJS / WebRTC)
let peer = null, roomCode = '', idRetries = 0;
const ROOM_KEY = 'sabr-room';

function loadRoom() { try { return sessionStorage.getItem(ROOM_KEY); } catch { return null; } }
function saveRoom(c) { try { sessionStorage.setItem(ROOM_KEY, c); } catch { /* storage blocked */ } }

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
  const src = qr.createDataURL(6, 2);
  $('qr').innerHTML = `<img alt="QR code" src="${src}">`;
  $('miniQr').src = src;
  $('code').textContent = roomCode;
  $('miniCode').textContent = roomCode;
  $('url').textContent = url;
  $('url').href = url;
  if (/^(localhost|127\.)/.test(location.hostname)) {
    $('lobbyMsg').textContent = 'Running on localhost: phones need the deployed HTTPS URL.';
  }
}

// The room code survives a reload of this page so phones can reconnect to the same room.
function startHost(code = loadRoom() || makeCode()) {
  roomCode = code;
  peer = new Peer(CFG.peerPrefix + code);
  peer.on('open', () => {
    idRetries = 0;
    saveRoom(code);
    renderQr();
    updateNetHud();
  });
  peer.on('connection', onConnection);
  peer.on('disconnected', () => {
    if (peer.destroyed) return;
    setNet('Signaling server lost. Reconnecting...');
    setTimeout(() => { if (!peer.destroyed && peer.disconnected) peer.reconnect(); }, 1000);
  });
  peer.on('error', (e) => {
    console.warn('peer error', e.type, e);
    if (e.type === 'unavailable-id') {
      // usually our own previous session that the server has not released yet
      peer.destroy();
      if (++idRetries <= 4) setTimeout(() => startHost(code), 1500);
      else { idRetries = 0; startHost(makeCode()); }
    } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) {
      setNet('Signaling server problem (' + e.type + '). Retrying...');
    }
  });
}

function onConnection(c) {
  c.on('data', (d) => {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'hello') {
      const pid = String(d.pid || '').slice(0, 40) || 'anon-' + Math.random().toString(36).slice(2);
      const prev = players.get(pid);
      if (prev && prev.conn && prev.conn !== c) {
        // same phone came back on a new connection: hand the slot over without a leave/join
        const old = prev.conn;
        prev.conn = c;
        old.close();
      }
      const pl = addPlayer(pid, typeof d.color === 'string' ? d.color : null, c);
      if (!pl) {
        c.send({ t: 'full' });
        setTimeout(() => c.close(), 500);
        return;
      }
      connPlayer.set(c, pl);
      c.send({ t: 'welcome', name: pl.name, color: pl.color, state: game.state });
      return;
    }
    const p = connPlayer.get(c);
    if (p && p.conn === c) onData(p, d);
  });
  c.on('close', () => {
    const p = connPlayer.get(c);
    if (!p || p.conn !== c) return;
    // grace period: a phone that reconnects quickly keeps its saber without a leave/join flicker
    p.conn = null;
    clearTimeout(p.dropTimer);
    p.dropTimer = setTimeout(() => { if (!p.conn) removePlayer(p); }, 4000);
  });
  c.on('error', (e) => console.warn('conn error', e));
}

function onData(p, d) {
  switch (d.t) {
    case 'o':
      p.net.count++;
      p.net.lastData = performance.now();
      if (p.saber) p.saber.onOrientation(+d.a || 0, +d.b || 0, +d.g || 0);
      break;
    case 'r':
      if (p.saber) {
        p.saber.recenter();
        popupAt('RECENTER', p.saber.group.position.clone().add(new V3(0, 0.7, -1)), '#' + p.saber.color.getHexString(), 'small');
      }
      break;
    case 'c':
      if (typeof d.c !== 'string') break;
      p.color = d.c;
      if (p.saber) p.saber.setColor(d.c);
      updatePlayerUi();
      break;
    case 'start': requestStart(); break;
    case 'lobby': if (game.state === 'over') toLobby(); break;
    case 'q': p.net.rtt = performance.now() - d.ts; break;
  }
}

function sendTo(p, msg) {
  if (p && p.conn && p.conn.open) p.conn.send(msg);
}

function broadcast(msg) {
  for (const p of players.values()) sendTo(p, msg);
}

function setNet(html) { $('net').innerHTML = html; }

function updateNetHud() {
  const list = activePlayers();
  if (!list.length) {
    setNet(roomCode ? `Waiting for players · room <b>${roomCode}</b>` : 'Connecting to server...');
    return;
  }
  setNet(list.map((p) => {
    if (!p.conn) return `<i style="background:${p.color}"></i><b>${p.name}</b>`;
    const stale = performance.now() - p.net.lastData > 1500;
    return `<i style="background:${p.color}"></i><b>${p.name}</b> ${Math.round(p.net.rtt)} ms · ${p.net.hz} Hz${stale ? ' · <b>no motion</b>' : ''}`;
  }).join(' &nbsp;&nbsp; '));
}

function updatePlayerUi() {
  const list = activePlayers();
  $('players').innerHTML = list.length
    ? list.map((p) => `<span class="chip"><i style="background:${p.color}"></i>${p.name}</span>`).join('')
    : '<span class="empty">No players yet. Scan to join.</span>';
  $('startBtn').disabled = !list.length;
  $('mouseBtn').textContent = players.get('mouse')?.saber ? 'Remove mouse player' : 'Add mouse player';
  updateCalBtn();
  updateNetHud();
}

setInterval(() => {
  for (const p of players.values()) {
    p.net.hz = p.net.count;
    p.net.count = 0;
    sendTo(p, { t: 'p', ts: performance.now() });
  }
  updateNetHud();
}, 1000);

setInterval(() => {
  for (const p of activePlayers()) {
    sendTo(p, { t: 'stats', score: game.score, combo: game.combo, health: Math.round(game.health), mine: p.stats.hits, state: game.state });
  }
}, 500);

// ---------------------------------------------------------------- UI wiring
$('mouseBtn').addEventListener('click', () => { unlockAudio(); toggleMousePlayer(); });
$('startBtn').addEventListener('click', () => { unlockAudio(); requestStart(); });
$('againBtn').addEventListener('click', () => { unlockAudio(); requestStart(); });
$('lobbyBtn').addEventListener('click', () => toLobby());
addEventListener('pointerdown', unlockAudio);
addEventListener('keydown', (e) => {
  unlockAudio();
  if (e.code === 'KeyC' || e.code === 'Space') { e.preventDefault(); recenterAll(); }
  if (e.code === 'KeyM') toggleMousePlayer();
  if (e.code === 'KeyN' && !$('calPanel').classList.contains('hidden')) calGo();
  if (e.code === 'Enter') requestStart();
  if (e.code === 'Escape' && game.state !== 'lobby') toLobby();
});

// ---------------------------------------------------------------- hardware controllers (ESP8266 via the local bridge)
// Only active when the page is served from localhost / a LAN address by bridge/server.js.
// The ESP sends the same messages a phone does ('o' orientation, 'r' recenter, 'start'),
// so each ESP simply becomes one more player.
const BRIDGE_HOST = /^(localhost|127\.|\[::1\]|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);
let bridgeWs = null;

function bridgeSend(msg) {
  if (bridgeWs && bridgeWs.readyState === 1) bridgeWs.send(JSON.stringify(msg));
}

function hwPlayer(id) {
  const pid = 'hw-' + id;
  let p = players.get(pid);
  if (p && p.saber && p.conn) return p;
  const conn = {
    open: true,
    // haptic events from the game are forwarded to the ESP (it blinks its LED)
    send(m) { if (m && (m.t === 'h' || m.t === 'bomb')) bridgeSend({ t: m.t, id }); },
    close() {},
  };
  p = addPlayer(pid, null, conn);
  if (p) {
    connPlayer.set(conn, p);
    p.hw = true;
    // The ESP already reports angles relative to its own zero (recenter button), so skip the
    // game-side yaw calibration; otherwise a keyboard recenter would shift a tilted stick's "forward".
    p.saber.needCalib = false;
    p.saber.recenter = () => {};
    updateCalBtn();
  }
  return p;
}

// ---- controller calibration (ESP8266 accelerometer): guided from this page
let calId = null, calTimer = 0;
function hwId() {
  const p = activePlayers().find((q) => q.hw);
  return p ? p.pid.slice(3) : calId;
}
function updateCalBtn() { $('calBtn').classList.toggle('hidden', !activePlayers().some((p) => p.hw)); }
function calShow(on) { $('calPanel').classList.toggle('hidden', !on); }
function calOnStatus(m) {
  clearInterval(calTimer);
  $('calCount').textContent = '';
  const go = $('calGo');
  if (m.st === 'prompt') {
    calShow(true);
    $('calStep').textContent = `Step ${m.step} of 6`;
    $('calText').textContent = m.text;
    go.disabled = false;
  } else if (m.st === 'ok') {
    $('calText').textContent = 'Captured ✓';
    go.disabled = true;
  } else if (m.st === 'error' || m.st === 'failed') {
    $('calText').textContent = m.text;
    go.disabled = m.st === 'failed';
    if (m.st === 'failed') setTimeout(() => calShow(false), 3000);
  } else if (m.st === 'done') {
    $('calStep').textContent = 'Done';
    $('calText').textContent = 'Calibration saved on the controller ✓';
    go.disabled = true;
    banner('Controller calibrated', '#4fffa0');
    setTimeout(() => calShow(false), 1800);
  } else if (m.st === 'cancel') {
    calShow(false);
  }
}
function calGo() {
  const go = $('calGo');
  if (go.disabled) return;
  go.disabled = true;
  let n = 3;
  $('calCount').textContent = n;
  clearInterval(calTimer);
  calTimer = setInterval(() => {
    n--;
    if (n > 0) { $('calCount').textContent = n; return; }
    clearInterval(calTimer);
    $('calCount').textContent = 'Hold still...';
    bridgeSend({ t: 'cal-next', id: hwId() });
  }, 1000);
}
$('calBtn').addEventListener('click', () => {
  const id = hwId();
  if (!id) return;
  $('calStep').textContent = 'Starting...';
  $('calText').textContent = 'Waiting for the controller...';
  $('calGo').disabled = true;
  calShow(true);
  bridgeSend({ t: 'cal-start', id });
});
$('calGo').addEventListener('click', calGo);
$('calCancel').addEventListener('click', () => {
  clearInterval(calTimer);
  bridgeSend({ t: 'cal-cancel', id: hwId() });
  calShow(false);
});

function startBridge() {
  if (!BRIDGE_HOST) return;
  let ws;
  try { ws = new WebSocket(`ws://${location.host}/ws?role=game`); } catch { return; }
  bridgeWs = ws;
  ws.onmessage = (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (!m || !m.id) return;
    if (m.t === 'cal') { calId = m.id; calOnStatus(m); return; }
    if (m.t === 'ctrl-join') { hwPlayer(m.id); return; }
    if (m.t === 'ctrl-leave') {
      const p = players.get('hw-' + m.id);
      if (p && p.saber) {
        p.conn = null; // same grace period as a dropped phone
        clearTimeout(p.dropTimer);
        p.dropTimer = setTimeout(() => { if (!p.conn) removePlayer(p); }, 4000);
      }
      return;
    }
    const p = hwPlayer(m.id);
    if (p) onData(p, m);
  };
  ws.onclose = () => { if (bridgeWs === ws) bridgeWs = null; setTimeout(startBridge, 3000); };
  ws.onerror = () => { try { ws.close(); } catch {} };
}

startBridge();
startHost();
relayout();

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();

function step(dt) {
  if (game.state === 'countdown' || game.state === 'playing') {
    game.songTime = clockNow() - game.startAt;
    if (game.state === 'countdown') {
      const left = Math.ceil(-game.songTime);
      $('countdown').textContent = left > 0 ? left : 'GO';
      if (game.songTime >= 0) {
        setState('playing');
        banner('GO!', '#5cbcf9');
      }
    }
  }

  const list = activePlayers();
  let maxSwing = 0;
  for (const p of list) {
    p.saber.update(dt);
    maxSwing = Math.max(maxSwing, p.saber.speedEma);
  }
  updateHum(maxSwing, list.length > 0);

  updateSpawning(dt);
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    if (!t) continue; // a miss can end the game and clear the list mid-loop
    t.mesh.position.addScaledVector(t.vel, dt);
    if (t.spin) t.mesh.rotation.y += t.spin * dt;
    if (t.mesh.position.z > CFG.missZ) {
      removeTarget(i);
      if (game.state === 'playing' && t.kind !== 'bomb') onMiss(t);
    }
  }
  for (const p of list) if (p.saber) checkHits(p);
  updateHalves(dt);
  updateParticles(dt);

  // environment pulses on the beat while the song plays
  const playing = game.state === 'playing' || game.state === 'countdown';
  const phase = playing ? ((game.songTime % BEAT) + BEAT) % BEAT / BEAT : 1;
  const pulse = playing ? Math.exp(-phase * 5) : 0;
  railMat.color.copy(RAIL_BASE).multiplyScalar(1 + pulse * 0.8);
  archMat.color.copy(ARCH_BASE).multiplyScalar(1 + pulse * 1.2);
  emblemMat.color.copy(EMBLEM_BASE).multiplyScalar(1 + pulse * 0.6);
  const archSpeed = game.state === 'playing' ? 4 : 1.2;
  for (const a of arches) {
    a.position.z += archSpeed * dt;
    if (a.position.z > 3) a.position.z -= 60;
  }

  shake *= Math.exp(-dt * 10);
  camPos.lerp(camGoal, 1 - Math.exp(-dt * 3));
  camera.position.set(camPos.x + rand(-1, 1) * shake, camPos.y + rand(-1, 1) * shake, camPos.z);
  camera.lookAt(0.1, 1.2, -4);

  for (const p of list) if (p.saber) p.saber.endFrame();
  composer.render();
}

function frame() {
  step(Math.min(clock.getDelta(), 0.05));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ?debug exposes internals for automated testing in the console.
if (new URLSearchParams(location.search).has('debug')) {
  window.__sabr = { step, game, targets, players, addPlayer, removePlayer, requestStart, toLobby, toggleMousePlayer, activePlayers };
}
