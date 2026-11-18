import * as THREE from 'three';
import { t } from './i18n.js';
import { Input } from './input.js';
import { Post } from './post.js';
import { Audio } from './audio.js';
import { Physics } from './physics.js';
import { Hero } from './hero.js';
import { World, PAL } from './world.js';

THREE.ColorManagement.enabled = false;

const $ = id => document.getElementById(id);
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const post = new Post(renderer);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 600);
const input = new Input(canvas, $('fx'));
const audio = new Audio();
const phys = new Physics();
const ink = new THREE.MeshLambertMaterial({ color: PAL.ink });

$('titleName').textContent = t('title');
$('titleTap').textContent = t('tap_to_start');
$('rotate').textContent = t('rotate');

// ---------- Пролог: лес ----------
const SEG_A = [[-40, 0], [5, 0], [8, 0.3], [11, 0.1], [13, 0.1], [18, 0.4], [22, 0.2], [26, 0.2]];
const SEG_B = [[27.8, 0.2], [30, 0.1], [37.6, 0], [37.61, 2.2], [44, 2.35], [50, 2.3], [55, 2.2], [55.01, 0], [62, 0]];
const SEG_C = [[70, 0], [78, 0.3], [86, 0], [95, 0.2], [104, 0.2], [160, 0]];
const world = new World(scene, phys, ink);
world.clearing = 92;
world.ground([SEG_A, SEG_B, SEG_C], [[...SEG_A, ...SEG_B], SEG_C]);
world.layers(-30, 140, [61.5, 70.5, 16]);
world.rays(-20, 130);
world.mist(-30, 140);
world.dust();
world.giant(93, -40);

// бревно (препятствие для прыжка)
const logY = phys.heightAt(14);
phys.bodies.push({ x: 14, y: logY, hw: 0.42, h: 0.8, vx: 0, vy: 0, grounded: true, movable: false });
{
  const g = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 6, 9), ink);
  g.rotation.set(Math.PI / 2, 0, 0.05); g.position.set(14, logY + 0.38, -1.2); scene.add(g);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.06, 0.9, 4), ink);
    b.position.set(14 + (i - 1.5) * 0.15, logY + 0.9, 1 - i * 0.9); b.rotation.z = (i - 1.5) * 0.5; scene.add(b);
  }
}

// ящик
const box = { x: 33, y: phys.heightAt(33), hw: 0.55, h: 1.1, vx: 0, vy: 0, grounded: false, movable: true };
phys.bodies.push(box);
const boxMesh = new THREE.Group();
{
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), ink); m.position.y = 0.55; boxMesh.add(m);
  for (const y of [0.15, 0.95]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.12, 1.16), ink); p.position.y = y; boxMesh.add(p);
  }
  scene.add(boxMesh);
}
const boxShadow = Hero.blob(new THREE.CanvasTexture((() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
})()), 2.2, 2.0);
scene.add(boxShadow);

// капкан
const trapX = 46.5, trapY = phys.heightAt(46.5);
const trap = { snapped: false, jaws: [] };
{
  const G = new THREE.Group(); G.position.set(trapX, trapY, 0); scene.add(G);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.06, 8), ink); G.add(base);
  for (const s of [-1, 1]) {
    const j = new THREE.Group(); G.add(j);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 4, 12, Math.PI), ink);
    arc.rotation.y = Math.PI / 2; j.add(arc);
    for (let i = 1; i < 6; i++) {
      const a = i / 6 * Math.PI;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.09, 3), ink);
      tooth.position.set(0, Math.sin(a) * 0.3, Math.cos(a) * 0.3); tooth.rotation.x = a + Math.PI / 2; j.add(tooth);
    }
    j.userData.s = s; j.rotation.z = s * Math.PI / 2 * 0.98;
    trap.jaws.push(j);
  }
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 3), ink);
  chain.rotation.z = Math.PI / 2; chain.position.set(-0.5, 0.02, -0.2); G.add(chain);
}

// рычаг и подъёмный мост через пропасть
const leverX = 59.6;
const lever = { pulled: false, a: -0.6 };
const leverPivot = new THREE.Group();
{
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.0, 6), ink);
  post.position.set(leverX, 0.5, -0.5); scene.add(post);
  leverPivot.position.set(leverX, 1.0, -0.3); scene.add(leverPivot);
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5), ink); h.position.y = 0.4; leverPivot.add(h);
  const k = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), ink); k.position.y = 0.8; leverPivot.add(k);
}
const bridge = { a: -Math.PI / 2, v: 0, state: 'up', plat: { x0: 61.7, x1: 70.3, top: 0, on: false } };
phys.platforms.push(bridge.plat);
const bridgePivot = new THREE.Group(); bridgePivot.position.set(70.3, 0, 0); scene.add(bridgePivot);
{
  for (let i = 0; i < 3; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 8.7, 7), ink);
    l.rotation.z = Math.PI / 2; l.position.set(-4.35, -0.17, (i - 1) * 0.42); bridgePivot.add(l);
  }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 4), ink);
  top.rotation.x = Math.PI / 2; top.position.set(-8.4, -0.1, 0); bridgePivot.add(top);
}
// столб на той стороне
{
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 4.5, 6), ink);
  p.position.set(70.8, 2.2, -0.8); scene.add(p);
}

// финальный свет — тусклый фонарь на столбе
const lampX = 101;
{
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 3.4, 6), ink);
  p.position.set(lampX, phys.heightAt(lampX) + 1.7, -1.2); scene.add(p);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff3d0, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    map: new THREE.CanvasTexture((() => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
    })()) }));
  glow.position.set(lampX, phys.heightAt(lampX) + 3.4, -1.2); glow.scale.setScalar(3);
  scene.add(glow);
  world.anim.push(tt => { glow.material.opacity = 0.65 + Math.sin(tt * 7) * 0.05 + (Math.random() < 0.02 ? -0.4 : 0); });
}

// ---------- Герой ----------
const hero = new Hero(scene, ink);
const START_X = 2;
hero.x = START_X; hero.y = phys.heightAt(START_X); hero.grounded = true;

const checkpoints = [2, 20, 31, 41, 57, 74];
let cp = { x: START_X, box: { x: box.x } };
const hints = [
  { x: -999, key: 'hint_move', shown: false },
  { x: 10.5, key: 'hint_jump', shown: false },
  { x: 31.2, key: 'hint_grab', shown: false },
  { x: 58, key: 'hint_lever', shown: false },
];

const textEl = $('text');
let textTimer = 0;
function say(s, dur = 4) { textEl.textContent = s; textEl.style.opacity = 1; textTimer = dur; }

let state = 'title', time = 0, fade = 1, fadeTarget = 0, deadT = 0, endT = 0, wakeDelay = 0;
const camPos = new THREE.Vector3(hero.x + 1, 3, 15), camLook = new THREE.Vector3(hero.x + 1, 1.2, 0);

function start() {
  state = 'play';
  $('title').style.opacity = 0;
  audio.start();
  const el = document.documentElement;
  if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  wakeDelay = 2.0;
}

function die(kind) {
  if (hero.state === 'dead') return;
  hero.state = 'dead'; hero.t = 0; hero.grab = null; deadT = 0;
  if (kind === 'trap') { audio.snap(); trap.snapped = true; } else audio.land();
}

function respawn() {
  hero.state = 'play';
  hero.x = cp.x; hero.y = phys.heightAt(cp.x) + 0.01; hero.vx = hero.vy = 0; hero.grounded = true; hero.face = 1;
  hero.body.rotation.y = 0;
  if (!bridge.plat.on) { box.x = cp.box.x; box.y = phys.heightAt(box.x) + 0.3; box.vy = 0; box.grounded = false; }
  trap.snapped = false;
}

function nearestInteract() {
  if (!lever.pulled && Math.abs(leverX - hero.x) < 1.1) return 'lever';
  const gap = Math.abs(box.x - hero.x) - box.hw - hero.hw;
  if (gap < 0.35 && Math.abs(box.y - hero.y) < 0.4) return 'box';
  return null;
}

function updatePlay(dt) {
  let dir = input.dir;
  if (!hero.grounded && !dir) dir = hero.airDir || 0;   // направленный прыжок держит курс в воздухе
  if (hero.state === 'lying') {
    if (wakeDelay > 0) wakeDelay -= dt;
    else if (input.any || dir) { hero.state = 'waking'; hero.t = 0; }
    else if (!hints[0].shown && wakeDelay <= 0) { hints[0].shown = true; say(t('hint_move'), 6); }
    return;
  }
  if (hero.state === 'waking') return;
  if (hero.state === 'dead') {
    deadT += dt;
    if (deadT > 1.2) fadeTarget = 1;
    if (deadT > 2.4) { respawn(); fadeTarget = 0; }
    return;
  }

  // взаимодействие
  if (input.act) {
    if (hero.grab) hero.grab = null;
    else {
      const it = nearestInteract();
      if (it === 'box' && hero.grounded) { hero.grab = box; hero.face = Math.sign(box.x - hero.x); audio.hit(300, 0.1, 0.2); }
      if (it === 'lever') { lever.pulled = true; audio.creak(); bridge.state = 'falling'; bridge.v = 0.35; }
    }
  }

  // ходьба
  const maxV = hero.grab ? 1.6 : 3.6;
  const targetV = dir * maxV;
  hero.vx += (targetV - hero.vx) * Math.min(1, dt * (hero.grounded ? 10 : 4));
  if (dir && !hero.grab) hero.face = dir;
  if (input.jump && hero.grounded && !hero.grab) {
    hero.vy = 8.2; hero.grounded = false; audio.step();
    hero.airDir = input.jumpDir;
    if (input.jumpDir) { hero.face = input.jumpDir; hero.vx = input.jumpDir * maxV; }
  }
  if (hero.grounded && hero.vy <= 0) hero.airDir = 0;

  const dx = hero.vx * dt;
  if (hero.grab) {
    const b = hero.grab, toward = Math.sign(b.x - hero.x) === Math.sign(dx);
    if (toward) { const m = phys.moveH(b, dx); phys.moveH(hero, m); }
    else { const m = phys.moveH(hero, dx); phys.moveH(b, m); }
    if (Math.abs(b.x - hero.x) > b.hw + hero.hw + 0.5 || !b.grounded) hero.grab = null;
  } else {
    const before = hero.x;
    phys.moveH(hero, dx);
    const hit = phys.blockedH(hero, hero.x + Math.sign(dx) * 0.01);
    if (dx && hit && hit.movable && hero.grounded) {
      // толкание без захвата — медленнее
      const m = phys.moveH(hit, dx * 0.45);
      phys.moveH(hero, m);
      hero.vx *= 0.8;
    }
    if (Math.abs(hero.x - before) < 1e-4 && hit) hero.vx *= 0.5;
  }

  const impact = phys.stepV(hero, dt);
  if (impact > 13) die('fall');
  else if (impact > 3) audio.land();

  // шаги
  if (hero.grounded && Math.abs(hero.vx) > 0.5) {
    const p = Math.floor(hero.phase / Math.PI);
    if (p !== hero.lastStep) { hero.lastStep = p; audio.step(); }
  }

  // опасности
  if (!trap.snapped && hero.grounded && Math.abs(hero.x - trapX) < 0.3) die('trap');
  if (hero.y < -7) die('fall');

  // чекпойнты и подсказки
  for (const c of checkpoints) if (hero.x > c && c > cp.x && hero.grounded) cp = { x: c, box: { x: box.x } };
  for (const h of hints) if (!h.shown && hero.x > h.x) { h.shown = true; say(t(h.key)); }

  if (hero.x > lampX - 1.5 && state === 'play') { state = 'end'; endT = 0; }
}

function updateObjects(dt) {
  // ящик
  if (box.movable) phys.stepV(box, dt);
  boxMesh.position.set(box.x, box.y, 0);
  const bg = phys.support(box);
  boxShadow.position.set(box.x, Math.max(bg, box.y) + 0.015, 0);
  boxShadow.material.opacity = Math.max(0, 1 - (box.y - bg) / 3);

  // капкан
  for (const j of trap.jaws) {
    const target = trap.snapped ? 0.08 * j.userData.s : j.userData.s * Math.PI / 2 * 0.98;
    j.rotation.z += (target - j.rotation.z) * Math.min(1, dt * 30);
  }

  // рычаг
  lever.a += ((lever.pulled ? 0.7 : -0.6) - lever.a) * Math.min(1, dt * 6);
  leverPivot.rotation.z = -lever.a;

  // мост падает
  if (bridge.state === 'falling') {
    bridge.v += dt * 4.5 * Math.cos(bridge.a);
    bridge.a += bridge.v * dt;
    if (bridge.a >= 0) {
      bridge.a = 0;
      if (bridge.v > 0.4) { audio.thud(); shake = 0.6; bridge.v = -bridge.v * 0.25; }
      else { bridge.v = 0; bridge.state = 'down'; bridge.plat.on = true; }
    }
  }
  bridgePivot.rotation.z = bridge.a;
}

let shake = 0;
function updateCamera(dt) {
  const ahead = hero.face * 1.6 + hero.vx * 0.25;
  const tx = hero.x + ahead, ty = Math.max(hero.y, -2) + 1.9;
  camLook.x += (tx - camLook.x) * Math.min(1, dt * 2.2);
  camLook.y += (ty - 0.9 - camLook.y) * Math.min(1, dt * 2.5);
  // чем ближе к великану, тем дальше камера — ощущение масштаба
  const wide = THREE.MathUtils.smoothstep(hero.x, 72, 90) * (1 - THREE.MathUtils.smoothstep(hero.x, 94, 100));
  const dist = 15 + wide * 7;
  camPos.x += (camLook.x - camPos.x) * Math.min(1, dt * 3);
  camPos.y += (camLook.y + 0.35 + wide * 1.2 - camPos.y) * Math.min(1, dt * 2.5);
  camPos.z += (dist - camPos.z) * Math.min(1, dt * 1.2);
  const sw = Math.sin(time * 0.5) * 0.08, sh = shake * shake;
  camera.position.set(camPos.x + sw + (Math.random() - 0.5) * sh, camPos.y + Math.sin(time * 0.37) * 0.06 + (Math.random() - 0.5) * sh, camPos.z);
  camera.lookAt(camLook.x, camLook.y, 0);
  shake = Math.max(0, shake - dt);
}

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  post.setSize(Math.round(w * dpr), Math.round(h * dpr));
  camera.aspect = w / h;
  // в узком окне чуть шире угол, чтобы герой не терялся
  camera.fov = w / h < 1.4 ? 48 : 38;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  time += dt;
  input.update(dt);

  if (state === 'title') {
    if (input.any || input.act || input.jump) start();
  } else if (state === 'play') {
    updatePlay(dt);
  } else if (state === 'end') {
    endT += dt;
    hero.vx *= 0.9;
    if (endT > 0.5) fadeTarget = 1;
    if (endT > 3 && !textEl.dataset.end) { textEl.dataset.end = 1; say(t('end_prologue') + ' · ' + t('end_sub'), 999); }
    if (endT > 4 && (input.act || input.any)) location.reload();
  }
  input.consume();

  updateObjects(dt);
  hero.animate(dt, phys.support(hero), hero.vx);
  updateCamera(dt);
  world.update(time, camera, hero.x);
  audio.update(time, THREE.MathUtils.smoothstep(hero.x, 70, 95));

  fade += (fadeTarget - fade) * Math.min(1, dt * (state === 'title' ? 0.6 : 2.2));
  if (textTimer > 0) { textTimer -= dt; if (textTimer <= 0) textEl.style.opacity = 0; }

  post.render(scene, camera, time, fade);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// отладка из консоли
window.game = { hero, phys, box, bridge, setState: s => (state = s) };
