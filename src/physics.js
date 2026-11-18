// Простая 2D-физика в плоскости игры (x, y). Мир трёхмерный, но игрок живёт на z = 0.
// Земля — ломаные (heightfield); резкий подъём выше STEP — стена.
export const GRAV = -24;
export const STEP = 0.35;

export class Physics {
  constructor() {
    this.terrain = [];    // массив ломаных [[x,y],...]
    this.bodies = [];     // ящики, брёвна: {x,y,hw,h,vx,vy,grounded,movable}
    this.platforms = [];  // {x0,x1,top,on}
  }

  heightAt(x) {
    let h = -Infinity;
    for (const s of this.terrain) {
      if (x < s[0][0] || x > s[s.length - 1][0]) continue;
      for (let i = 0; i < s.length - 1; i++) {
        const a = s[i], b = s[i + 1];
        if (x >= a[0] && x <= b[0]) {
          const k = b[0] - a[0] > 1e-6 ? (x - a[0]) / (b[0] - a[0]) : 1;
          h = Math.max(h, a[1] + (b[1] - a[1]) * k);
          break;
        }
      }
    }
    return h;
  }

  // все высоты земли под отрезком [xl, xr]
  terrainSamples(xl, xr) {
    const out = [this.heightAt(xl), this.heightAt((xl + xr) / 2), this.heightAt(xr)];
    for (const s of this.terrain) for (const p of s) if (p[0] > xl && p[0] < xr) out.push(p[1]);
    return out;
  }

  blockedH(b, nx) {
    const xl = nx - b.hw, xr = nx + b.hw;
    for (const h of this.terrainSamples(xl, xr)) if (h > b.y + STEP) return 'wall';
    for (const o of this.bodies) {
      if (o === b) continue;
      if (xr > o.x - o.hw && xl < o.x + o.hw && b.y < o.y + o.h - STEP && b.y + b.h > o.y + 0.02) return o;
    }
    return null;
  }

  support(b) {
    const xl = b.x - b.hw * 0.9, xr = b.x + b.hw * 0.9, lim = b.y + STEP;
    let s = -Infinity;
    for (const h of this.terrainSamples(xl, xr)) if (h <= lim && h > s) s = h;
    for (const o of this.bodies) {
      if (o === b) continue;
      const top = o.y + o.h;
      if (xr > o.x - o.hw && xl < o.x + o.hw && top <= lim && top > s) s = top;
    }
    for (const p of this.platforms) if (p.on && xr > p.x0 && xl < p.x1 && p.top <= lim && p.top > s) s = p.top;
    return s;
  }

  // возвращает реально пройденное смещение
  moveH(b, dx) {
    if (!dx) return 0;
    let hit = this.blockedH(b, b.x + dx);
    if (!hit) { b.x += dx; return dx; }
    // подойти вплотную
    let lo = 0, hi = 1;
    for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2; if (this.blockedH(b, b.x + dx * m)) hi = m; else lo = m; }
    b.x += dx * lo;
    b.lastHit = hit;
    return dx * lo;
  }

  // возвращает скорость удара о землю (0 если не приземлился)
  stepV(b, dt) {
    b.vy = Math.max(b.vy + GRAV * dt, -30);
    let ny = b.y + b.vy * dt;
    const s = this.support(b);
    if (b.grounded && b.vy <= 0 && b.y - s < STEP) ny = s;   // прилипаем к склону
    let impact = 0;
    if (ny <= s) {
      if (!b.grounded) impact = -b.vy;
      ny = s; b.vy = 0; b.grounded = true;
    } else b.grounded = false;
    b.y = ny;
    return impact;
  }
}
