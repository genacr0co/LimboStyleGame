// Невидимое управление жестами:
//  удержание левой/правой половины экрана — идти;
//  свайп вверх — прыжок на месте, вверх-вправо / вверх-влево — прыжок в эту сторону
//  (палец можно не отпускать — продолжишь идти туда же);
//  короткий тап — взаимодействие.
// Клавиатура для теста на ПК: A/D/стрелки, W/Пробел/↑ — прыжок, E/Enter — действие.

const HOLD_DELAY = 0.12;   // сек до начала ходьбы (чтобы тап не дёргал героя)
const TAP_TIME = 0.22;
const TAP_DIST = 18;       // px
const SWIPE_DIST = 45;     // px
const REFINE_TIME = 0.25;  // сек: сколько после старта свайпа ещё можно «довернуть» направление

// наклон больше ~14° от вертикали — прыжок в сторону
function swipeDir(dx, dy) { return Math.abs(dx) > -dy * 0.25 ? Math.sign(dx) : 0; }

export class Input {
  constructor(el, fx) {
    this.el = el;
    this.fx = fx;               // canvas для еле заметных следов касаний
    this.ctx = fx.getContext('2d');
    this.ptrs = new Map();
    this.keys = new Set();
    this.jumpDir = 0;           // -1/0/1 — наклон свайпа
    this.jump = false;          // одноразовые события — сбрасываются consume()
    this.act = false;
    this.any = false;
    this.ripples = [];
    this.time = 0;

    const opt = { passive: false };
    el.addEventListener('pointerdown', e => this.down(e), opt);
    window.addEventListener('pointermove', e => this.move(e), opt);
    window.addEventListener('pointerup', e => this.up(e), opt);
    window.addEventListener('pointercancel', e => this.up(e, true), opt);
    el.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code); this.any = true;
      if (['KeyW', 'ArrowUp', 'Space'].includes(e.code)) { this.jump = true; this.jumpDir = 0; }
      if (['KeyE', 'Enter'].includes(e.code)) this.act = true;
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
  }

  down(e) {
    e.preventDefault();
    try { this.el.setPointerCapture(e.pointerId); } catch (_) {}
    this.ptrs.set(e.pointerId, { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY,
      t0: this.time, side: e.clientX < innerWidth / 2 ? -1 : 1, swiped: false });
    this.any = true;
    this.ripple(e.clientX, e.clientY, 0);
  }

  move(e) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    const dx = p.x - p.sx, dy = p.y - p.sy;
    const len = Math.hypot(dx, dy);
    // свайп вверх в пределах ~60° от вертикали; наклон задаёт направление прыжка
    if (!p.swiped && len > SWIPE_DIST && -dy > len * 0.5) {
      p.swiped = true; p.swT = this.time;
      this.jump = true;
      this.jumpDir = swipeDir(dx, dy);
      // шёл этим пальцем и свайпнул прямо вверх — прыгаем вперёд по ходу
      if (!this.jumpDir && p.walked) this.jumpDir = p.side;
      this.ripple(p.x, p.y, 1);
      p.side = this.jumpDir;           // палец остался — идём туда же (прямо вверх — стоим)
      p.t0 = this.time - HOLD_DELAY;
    } else if (p.swiped) this.refine(p, dx, dy);
  }

  // первые доли секунды после старта свайпа уточняем направление по всей траектории пальца
  refine(p, dx, dy) {
    if (this.time - p.swT > REFINE_TIME || this.jumpDir) return;
    const d = swipeDir(dx, dy);
    if (d) { this.jumpDir = d; p.side = d; }
  }

  up(e, cancel) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    this.ptrs.delete(e.pointerId);
    if (p.swiped && !cancel) this.refine(p, e.clientX - p.sx, e.clientY - p.sy);
    if (cancel || p.swiped) return;
    const d = Math.hypot(p.x - p.sx, p.y - p.sy);
    if (this.time - p.t0 < TAP_TIME && d < TAP_DIST) this.act = true;
  }

  // -1, 0, 1
  get dir() {
    let d = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) d -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) d += 1;
    if (d) return d;
    // последний удерживаемый палец главнее
    let last = null;
    for (const p of this.ptrs.values()) {
      if (this.time - p.t0 < HOLD_DELAY) continue;
      if (!p.swiped && p.sy - p.y > TAP_DIST) continue;   // палец уходит вверх — это начинается свайп, не ходьба
      if (!last || p.t0 >= last.t0) last = p;
    }
    if (last && last.side) last.walked = true;
    return last ? last.side : 0;   // side = 0 у пальца после прыжка прямо вверх
  }

  consume() { this.jump = false; this.act = false; this.any = false; }

  ripple(x, y, kind) { this.ripples.push({ x, y, k: kind, a: 0 }); }

  // еле заметная обратная связь — почти прозрачная
  update(dt) {
    this.time += dt;
    const c = this.ctx, dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (this.fx.width !== w || this.fx.height !== h) { this.fx.width = w; this.fx.height = h; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, innerWidth, innerHeight);
    for (const r of this.ripples) {
      r.a += dt;
      const k = r.a / 0.7;
      c.strokeStyle = `rgba(230,228,215,${0.16 * (1 - k)})`;
      c.lineWidth = 1.2;
      c.beginPath();
      if (r.k === 1) { c.moveTo(r.x - 14, r.y + 6 - k * 30); c.lineTo(r.x, r.y - 6 - k * 30); c.lineTo(r.x + 14, r.y + 6 - k * 30); }
      else c.arc(r.x, r.y, 8 + k * 34, 0, Math.PI * 2);
      c.stroke();
    }
    this.ripples = this.ripples.filter(r => r.a < 0.7);
    for (const p of this.ptrs.values()) {
      if (this.time - p.t0 < HOLD_DELAY) continue;
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 46);
      g.addColorStop(0, 'rgba(230,228,215,0.07)');
      g.addColorStop(1, 'rgba(230,228,215,0)');
      c.fillStyle = g;
      c.fillRect(p.x - 46, p.y - 46, 92, 92);
    }
  }
}
