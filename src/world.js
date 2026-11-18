// Декорации: многослойный лес в тумане, небо, лучи света, туман у земли, пыль, великан вдали.
// Глубина = настоящая 3D-перспектива + туман: чем дальше слой, тем он светлее и бледнее.
import * as THREE from 'three';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';

export const PAL = {
  fog: 0x9a9b93, horizon: 0xc2c2b8, top: 0x30322f, glow: 0xfffbea, ink: 0x101010,
};

export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// плита земли по профилю: ломаная сверху, вниз до bottom, толщиной по z
export function slab(points, zBack, zFront, bottom = -40) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], bottom);
  for (const p of points) s.lineTo(p[0], p[1]);
  s.lineTo(points[points.length - 1][0], bottom);
  const g = new THREE.ExtrudeGeometry(s, { depth: zFront - zBack, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, zBack);
  return g;
}

function noiseProfile(r, x0, x1, step, base, amp, shape) {
  const pts = [];
  let a = r() * 10, b = r() * 10;
  for (let x = x0; x <= x1; x += step) {
    let y = base + Math.sin(x * 0.045 + a) * amp + Math.sin(x * 0.13 + b) * amp * 0.4 + (r() - 0.5) * amp * 0.25;
    if (shape) y = shape(x, y);
    pts.push([x, y]);
  }
  return pts;
}

function tree(out, r, x, y, z, h, rad) {
  const lean = (r() - 0.5) * 0.12;
  const t = new THREE.CylinderGeometry(rad * 0.55, rad, h, 7, 1);
  t.translate(0, h / 2, 0);
  t.rotateZ(lean);
  t.translate(x, y - 0.5, z);
  out.push(t);
  // корни
  for (let i = 0; i < 3; i++) {
    const rl = rad * (1.4 + r());
    const g = new THREE.ConeGeometry(rad * 0.35, rl, 4);
    g.rotateZ((i - 1) * 1.6 + (r() - 0.5) * 0.4 + Math.PI);
    g.translate(x + (i - 1) * rad * 0.9, y + 0.1, z + (r() - 0.5) * rad);
    out.push(g);
  }
  // сухие ветки
  const n = 1 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const by = h * (0.25 + r() * 0.6);
    const bl = rad * (6 + r() * 10);
    const side = r() < 0.5 ? -1 : 1;
    const g = new THREE.CylinderGeometry(rad * 0.04, rad * 0.22, bl, 4, 1);
    g.translate(0, bl / 2, 0);
    g.rotateZ(-side * (0.6 + r() * 0.7));
    g.translate(x + Math.sin(lean) * -by, y + by, z + (r() - 0.5) * rad);
    out.push(g);
  }
}

function grass(out, r, x, y, z, s) {
  const n = 3 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const h = s * (0.4 + r());
    const g = new THREE.ConeGeometry(s * 0.06, h, 3);
    g.translate(0, h / 2, 0);
    g.rotateZ((r() - 0.5) * 0.9);
    g.translate(x + (r() - 0.5) * s * 0.6, y - 0.03, z + (r() - 0.5) * s * 0.3);
    out.push(g);
  }
}

function merge(list, mat) {
  const m = new THREE.Mesh(mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g)), mat);
  list.forEach(g => g.dispose());
  return m;
}

export class World {
  constructor(scene, phys, mat) {
    this.scene = scene; this.phys = phys; this.mat = mat;
    this.anim = [];
    const r = this.r = rng(7);
    scene.fog = new THREE.Fog(PAL.fog, 7, 105);
    scene.background = new THREE.Color(PAL.fog);

    this.sky();
    this.lights();
  }

  sky() {
    const m = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color(PAL.top) }, hor: { value: new THREE.Color(PAL.horizon) },
        glow: { value: new THREE.Color(PAL.glow) }, sun: { value: new THREE.Vector2(0.62, 0.62) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform vec3 top, hor, glow; uniform vec2 sun; varying vec2 vUv;
        void main(){
          vec3 c = mix(hor, top, smoothstep(0.3, 0.95, vUv.y));
          vec2 d = (vUv - sun) * vec2(2.8, 1.0);
          float l = length(d);
          c += glow * (exp(-l * 9.0) * 0.55 + exp(-l * 2.5) * 0.18);
          gl_FragColor = vec4(c, 1.);
        }`,
      depthWrite: false,
    });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1600, 520), m);
    p.position.set(60, 90, -320);
    this.scene.add(p);
    this.skyMesh = p;
  }

  lights() {
    this.scene.add(new THREE.HemisphereLight(0xc8c8bc, 0x0a0a0a, 0.55));
    const d = new THREE.DirectionalLight(0xfff8e8, 0.9);
    d.position.set(-0.4, 1, -0.8);
    this.scene.add(d);
  }

  // уровень: ломаные земли для физики и визуала
  ground(segments, backSegments) {
    const geos = [];
    for (const s of segments) { this.phys.terrain.push(s); geos.push(slab(s, -2, 2.5)); }
    for (const s of backSegments) geos.push(slab(s, -7, -2));
    const r = this.r;
    // трава по краю игровой земли
    for (const s of segments) {
      const x0 = s[0][0], x1 = s[s.length - 1][0];
      for (let x = x0 + 0.3; x < x1 - 0.3; x += 0.35 + r() * 0.6) {
        const y = this.phys.heightAt(x);
        if (Math.abs(this.phys.heightAt(x + 0.3) - y) > 0.3 || Math.abs(this.phys.heightAt(x - 0.3) - y) > 0.3) continue;
        grass(geos, r, x, y, 1.8 + r() * 0.6, 0.35 + r() * 0.3);
        if (r() < 0.5) grass(geos, r, x, y, -1.5 - r() * 3, 0.4 + r() * 0.4);
      }
    }
    this.scene.add(merge(geos, this.mat));
  }

  // слои глубины
  layers(xMin, xMax, lowZone) {
    const r = this.r, mat = this.mat;
    const shape = (x, y) => lowZone && x > lowZone[0] && x < lowZone[1] ? y - lowZone[2] : y;
    const defs = [
      // zFront, zBack, base, amp, trees density, h, rad
      { zf: -8, zb: -16, base: 0.2, amp: 1.0, dens: 0.16, h: [22, 30], rad: [0.35, 0.6] },
      { zf: -16, zb: -30, base: 0.8, amp: 2.0, dens: 0.13, h: [28, 38], rad: [0.5, 0.9] },
      { zf: -30, zb: -52, base: 1.5, amp: 4.0, dens: 0.09, h: [35, 50], rad: [0.7, 1.2] },
      { zf: -52, zb: -95, base: 3.0, amp: 9.0, dens: 0.05, h: [45, 70], rad: [1.0, 1.8] },
    ];
    for (const d of defs) {
      const geos = [];
      const span = (14 - d.zb) * 0.85;
      const prof = noiseProfile(r, xMin - span, xMax + span, 2, d.base, d.amp, shape);
      geos.push(slab(prof, d.zb, d.zf, -60));
      const hAt = x => { const i = Math.max(0, Math.min(prof.length - 1, Math.round((x - prof[0][0]) / 2))); return prof[i][1]; };
      for (let x = xMin - span; x < xMax + span; x += 1 / d.dens * (0.4 + r() * 1.2)) {
        if (this.clearing && d.zb < -20 && Math.abs(x - this.clearing) < 16 + (-d.zf) * 0.15) continue;
        const z = d.zb + 1 + r() * (d.zf - d.zb - 2);
        tree(geos, r, x, hAt(x), z, d.h[0] + r() * (d.h[1] - d.h[0]), d.rad[0] + r() * (d.rad[1] - d.rad[0]));
        if (d.zf > -20) for (let i = 0; i < 2; i++) grass(geos, r, x + (r() - 0.5) * 4, hAt(x), z + 1, 0.6 + r() * 0.5);
      }
      this.scene.add(merge(geos, mat));
    }
    // ближний слой: деревья у самой игровой линии (за героем)
    const near = [];
    for (let x = xMin; x < xMax; x += 5 + r() * 9) {
      const y = this.phys.heightAt(x);
      if (y < -5 || Math.abs(this.phys.heightAt(x + 1) - y) > 0.3) continue;
      tree(near, r, x, y, -3 - r() * 3, 18 + r() * 6, 0.25 + r() * 0.3);
    }
    this.scene.add(merge(near, mat));

    // передний план: тёмная кромка земли, толстые стволы, трава — проплывают перед камерой
    const fg = [];
    const fgProf = noiseProfile(r, xMin - 20, xMax + 20, 1.5, -1.6, 0.5, (x, y) => (lowZone && x > lowZone[0] && x < lowZone[1]) ? -14 : y);
    fg.push(slab(fgProf, 2.5, 10, -40));
    for (let x = xMin - 10; x < xMax + 10; x += 2 + r() * 3) {
      const ok = !(lowZone && x > lowZone[0] - 1 && x < lowZone[1] + 1);
      if (ok) grass(fg, r, x, -1.5, 3.4 + r() * 2.5, 0.9 + r() * 0.9);
    }
    for (let x = xMin + 6; x < xMax; x += 14 + r() * 16) tree(fg, r, x, -1.8, 5.5 + r() * 2, 20, 0.6 + r() * 0.5);
    // свисающие корни/лианы
    for (let x = xMin; x < xMax; x += 4 + r() * 9) {
      const len = 6 + r() * 8, z = -1 - r() * 6 + (r() < 0.25 ? 7 : 0);
      const g = new THREE.CylinderGeometry(0.015, 0.04, len, 3);
      g.translate(x, 16 - len / 2, z);
      fg.push(g);
    }
    this.scene.add(merge(fg, mat));
  }

  rays(xMin, xMax) {
    const tex = canvasTex(64, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-in';
      const v = g.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.3, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = v; g.fillRect(0, 0, w, h);
    });
    const r = this.r;
    for (let x = xMin; x < xMax; x += 6 + r() * 10) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2 + r() * 4, 40),
        new THREE.MeshBasicMaterial({ map: tex, color: 0xfffbe8, transparent: true, opacity: 0, depthWrite: false,
          blending: THREE.AdditiveBlending, fog: false }));
      m.position.set(x, 10, -4 - r() * 26);
      m.rotation.z = -0.38;
      const base = 0.05 + r() * 0.07, ph = r() * 10;
      this.anim.push(t => { m.material.opacity = base * (0.6 + 0.4 * Math.sin(t * 0.3 + ph)); });
      this.scene.add(m);
    }
  }

  mist(xMin, xMax) {
    const tex = canvasTex(512, 64, (g, w, h) => {
      const r = rng(3);
      for (let i = 0; i < 70; i++) {
        const x = r() * w, y = h * (0.45 + r() * 0.2), rad = 10 + r() * 30;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        // бесшовность по горизонтали
        g.save(); g.translate(x > w / 2 ? -w : w, 0); g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.restore();
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    for (const [z, y, op, sp] of [[-1.2, 0.2, 0.35, 0.004], [-6, 0.6, 0.45, 0.003], [-14, 1.2, 0.55, 0.002], [-28, 2.2, 0.6, 0.0015], [4.5, -1.2, 0.25, 0.006]]) {
      const t = tex.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.x = 4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(xMax - xMin + 160, 5),
        new THREE.MeshBasicMaterial({ map: t, color: PAL.horizon, transparent: true, opacity: op, depthWrite: false, fog: false }));
      m.position.set((xMin + xMax) / 2, y, z);
      this.anim.push(tt => { t.offset.x = tt * sp; });
      this.scene.add(m);
    }
  }

  dust() {
    const n = 500, p = new Float32Array(n * 3), r = this.r;
    for (let i = 0; i < n; i++) { p[i * 3] = (r() - 0.5) * 40; p[i * 3 + 1] = r() * 14 - 2; p[i * 3 + 2] = r() * 14 - 8; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const tex = canvasTex(32, 32, (c) => {
      const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, 32, 32);
    });
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.07, map: tex, color: 0xf2efe0, transparent: true,
      opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.scene.add(pts);
    this.dustPts = pts;
    this.anim.push((t, cam) => {
      const a = g.attributes.position.array;
      for (let i = 0; i < n; i++) {
        let x = a[i * 3] + Math.sin(t * 0.3 + i) * 0.003 + 0.004;
        const cx = cam.position.x;
        if (x - cx > 20) x -= 40; if (x - cx < -20) x += 40;
        a[i * 3] = x;
        a[i * 3 + 1] += Math.sin(t * 0.5 + i * 1.7) * 0.002 - 0.0015;
        if (a[i * 3 + 1] < cam.position.y - 9) a[i * 3 + 1] += 16;
      }
      g.attributes.position.needsUpdate = true;
    });
  }

  // великан далеко в тумане — медленно поворачивает голову за героем
  giant(x, z) {
    const m = this.mat, G = new THREE.Group();
    const add = (geo, px, py, pz, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.rotation.z = rz; G.add(o); return o; };
    add(new THREE.CylinderGeometry(0.9, 1.3, 30, 6), -2.2, 15, 0, 0.03);
    add(new THREE.CylinderGeometry(0.9, 1.3, 30, 6), 2.2, 15, 0, -0.03);
    add(new THREE.CapsuleGeometry(4.2, 14, 4, 8), 0, 38, 0);
    const armL = new THREE.Group(); armL.position.set(-5, 45, 0); G.add(armL);
    const armR = new THREE.Group(); armR.position.set(5, 45, 0); G.add(armR);
    for (const a of [armL, armR]) { const o = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 30, 5), m); o.position.y = -15; a.add(o); }
    const head = new THREE.Group(); head.position.set(0, 52, 0); G.add(head);
    const hm = new THREE.Mesh(new THREE.SphereGeometry(3.6, 12, 10), m); hm.scale.set(0.9, 1.25, 0.9); head.add(hm);
    G.position.set(x, -3, z); G.scale.setScalar(0.42);
    G.rotation.y = 0.4;
    this.scene.add(G);
    this.giantObj = { G, head, armL, armR };
  }

  update(t, cam, heroX) {
    for (const f of this.anim) f(t, cam);
    this.skyMesh.position.x = cam.position.x * 0.9;
    if (this.giantObj) {
      const { G, head, armL, armR } = this.giantObj;
      const look = THREE.MathUtils.clamp((heroX - G.position.x) * 0.02, -0.7, 0.7);
      head.rotation.y += (look - head.rotation.y) * 0.004;
      head.rotation.z = Math.sin(t * 0.21) * 0.05 + 0.12;
      armL.rotation.z = Math.sin(t * 0.17) * 0.02;
      armR.rotation.z = -Math.sin(t * 0.19 + 1) * 0.02;
    }
  }
}
