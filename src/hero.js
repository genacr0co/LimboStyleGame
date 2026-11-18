// Герой: силуэт мальчика из простых фигур, два светящихся глаза, процедурная анимация.
import * as THREE from 'three';

export class Hero {
  constructor(scene, mat) {
    this.hw = 0.22; this.h = 1.15;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.grounded = false;
    this.face = 1; this.phase = 0; this.state = 'lying'; this.t = 0;
    this.grab = null;

    const root = this.root = new THREE.Group();
    const body = this.body = new THREE.Group();
    root.add(body);
    const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 3, 8);

    const torso = new THREE.Mesh(cap(0.16, 0.28), mat); torso.position.y = 0.62; body.add(torso);
    this.torso = torso;
    const head = this.head = new THREE.Group(); head.position.y = 0.98; body.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), mat));
    // взъерошенные волосы — рваный силуэт
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), mat);
      const a = -0.9 + i * 0.4;
      c.position.set(Math.sin(a) * -0.17, Math.cos(a) * 0.17, (i % 2 ? 0.06 : -0.06));
      c.rotation.z = a * 1.1;
      head.add(c);
    }
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    for (const z of [0.12, -0.12]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), eyeMat);
      e.position.set(0.155, 0.03, z); e.scale.set(0.6, 1, 1);
      head.add(e);
    }
    const limb = (y, r, l, z) => {
      const g = new THREE.Group(); g.position.set(0, y, z); body.add(g);
      const m = new THREE.Mesh(cap(r, l), mat); m.position.y = -l / 2 - r * 0.5; g.add(m);
      return g;
    };
    this.legL = limb(0.42, 0.065, 0.3, 0.08);
    this.legR = limb(0.42, 0.065, 0.3, -0.08);
    this.armL = limb(0.78, 0.05, 0.28, 0.17);
    this.armR = limb(0.78, 0.05, 0.28, -0.17);

    // мягкая контактная тень
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.shadowTex = new THREE.CanvasTexture(c);
    this.shadow = Hero.blob(this.shadowTex, 1.0, 0.5);
    scene.add(root, this.shadow);
  }

  static blob(tex, w, d) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  // визуальная часть; ground — высота земли под героем
  animate(dt, ground, speed) {
    this.t += dt;
    const r = this.root, b = this.body;
    r.position.set(this.x, this.y, 0);
    const target = this.face > 0 ? 0 : -Math.PI;
    b.rotation.y += (target - b.rotation.y) * Math.min(1, dt * 9);

    let lL = 0, lR = 0, aL = 0, aR = 0, lean = 0, bob = 0;
    const s = Math.abs(speed);
    if (this.state === 'lying' || this.state === 'waking' || this.state === 'dead') {
      // поза лёжа на боку / падение
      const k = this.state === 'lying' ? 1 : this.state === 'waking' ? Math.max(0, 1 - this.t / 1.4) : Math.min(1, this.t / 0.5);
      const e = k * k * (3 - 2 * k);
      r.rotation.z = (this.state === 'dead' ? -this.face : 1) * e * Math.PI / 2;
      r.position.y = this.y + e * 0.16;
      lL = e * 0.4; lR = -e * 0.2; aL = e * 1.4; aR = e * 0.6;
      if (this.state === 'waking' && k <= 0) this.state = 'play';
    } else {
      r.rotation.z = 0;
      if (!this.grounded) {
        lL = 0.7; lR = -0.35; aL = -1.2; aR = 1.0; lean = 0.1;
      } else if (s > 0.1) {
        this.phase += dt * s * 3.4;
        const sw = Math.sin(this.phase), amt = Math.min(1, s / 2.5);
        lL = sw * 0.75 * amt; lR = -sw * 0.75 * amt; aL = -sw * 0.6 * amt; aR = sw * 0.6 * amt;
        bob = Math.abs(Math.cos(this.phase)) * 0.05 * amt; lean = -0.12 * amt;
      } else {
        const br = Math.sin(this.t * 1.7);
        bob = br * 0.008; aL = br * 0.03; aR = -br * 0.03;
      }
      if (this.grab) {
        const pull = Math.sign(this.grab.x - this.x) !== Math.sign(speed) && s > 0.1;
        aL = aR = 1.35; lean = pull ? 0.28 : -0.3;
      }
    }
    this.legL.rotation.z = lL; this.legR.rotation.z = lR;
    this.armL.rotation.z = aL; this.armR.rotation.z = aR;
    b.position.y = bob;
    this.torso.rotation.z = lean * 0.6;
    this.head.rotation.z = lean * 0.4 + Math.sin(this.t * 0.6) * 0.03;
    this.head.position.x = -lean * 0.12;

    const hgt = Math.max(0, this.y - ground);
    const k = Math.max(0, 1 - hgt / 3);
    this.shadow.visible = ground > -100;
    this.shadow.position.set(this.x, ground + 0.02, 0);
    this.shadow.scale.setScalar(0.4 + k * 0.6);
    this.shadow.material.opacity = k;
  }
}
