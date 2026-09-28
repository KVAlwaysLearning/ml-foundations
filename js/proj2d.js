/* ============================================================
   2D view with equal-aspect axes, ticks, axis names, click and
   drag. Used for the top-down projections under each 3D plot and
   for the contour page. Coordinates passed in are data units.
   ============================================================ */
class Proj2D {
  constructor(parent, { title = '', xName = 'x', yName = 'y', height = 'min(52vh, 420px)', aria = '' } = {}){
    const wrap = document.createElement('div'); wrap.className = 'proj';
    wrap.innerHTML = `<div class="proj-head"><b>${title}</b><span class="proj-hint"></span></div>`;
    const cv = document.createElement('canvas'); cv.style.height = height; cv.setAttribute('role', 'img'); if (aria) cv.setAttribute('aria-label', aria);
    wrap.appendChild(cv); parent.appendChild(wrap);
    Object.assign(this, { wrap, cv, xName, yName, drawFn: null, onClick: null, hit: null, onDrag: null, onDragEnd: null, frozen: null });
    this.hintEl = wrap.querySelector('.proj-hint');
    let drag = false, downAt = null;
    cv.addEventListener('pointerdown', e => {
      const [x, y] = this.fromEvent(e); downAt = { x: e.clientX, y: e.clientY };
      if (this.hit && this.hit(x, y, this.pxPerUnit)) { drag = true; this.frozen = this.view; cv.setPointerCapture(e.pointerId); e.preventDefault(); }
    });
    cv.addEventListener('pointermove', e => {
      const [x, y] = this.fromEvent(e);
      cv.style.cursor = drag ? 'grabbing' : (this.hit && this.hit(x, y, this.pxPerUnit)) ? 'grab' : (this.onClick ? 'crosshair' : 'default');
      if (drag && this.onDrag) this.onDrag(x, y);
    });
    const up = e => {
      if (drag) { drag = false; this.frozen = null; this.onDragEnd && this.onDragEnd(); this.redraw(); }
      else if (downAt && e.type === 'pointerup' && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 5 && this.onClick) { const [x, y] = this.fromEvent(e); this.onClick(x, y); }
      downAt = null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    this.ro = new ResizeObserver(() => this.redraw()); this.ro.observe(cv);
  }
  hint(t){ this.hintEl.textContent = t; }
  fromEvent(e){ const r = this.cv.getBoundingClientRect(); return this.inv(e.clientX - r.left, e.clientY - r.top); }
  redraw(){ if (this.drawFn) this.drawFn(); }
  /* Set up the frame for data ranges xr, yr (equal aspect), draw grid, axes, ticks and names. Returns ctx. */
  begin(xr, yr){
    const { ctx, w, h } = prep(this.cv);
    this.ctx = ctx; this.w = w; this.h = h;
    const pad = { l: 50, r: 16, t: 12, b: 42 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
    let view = this.frozen;
    if (!view) {
      const s = Math.min(W / Math.max(xr[1] - xr[0], 1e-9), H / Math.max(yr[1] - yr[0], 1e-9));
      const cx = (xr[0] + xr[1]) / 2, cy = (yr[0] + yr[1]) / 2;
      view = { s, x0: cx - W / 2 / s, x1: cx + W / 2 / s, y0: cy - H / 2 / s, y1: cy + H / 2 / s };
      this.view = view;
    }
    const { s, x0, y0, x1, y1 } = view;
    this.pxPerUnit = s; this.box = { l: pad.l, t: pad.t, r: pad.l + W, b: pad.t + H, x0, x1, y0, y1 };
    this.X = x => pad.l + (x - x0) * s; this.Y = y => pad.t + H - (y - y0) * s;
    this.inv = (px, py) => [x0 + (px - pad.l) / s, y0 + (pad.t + H - py) / s];
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = css('--panel'); ctx.fillRect(pad.l, pad.t, W, H);
    ctx.font = '11.5px "Public Sans", sans-serif'; ctx.lineWidth = 1;
    const tx = niceTicks(x0, x1, Math.max(3, Math.round(W / 90))), ty = niceTicks(y0, y1, Math.max(3, Math.round(H / 70)));
    ctx.strokeStyle = css('--rule');
    for (const v of tx) { ctx.beginPath(); ctx.moveTo(this.X(v), pad.t); ctx.lineTo(this.X(v), pad.t + H); ctx.stroke(); }
    for (const v of ty) { ctx.beginPath(); ctx.moveTo(pad.l, this.Y(v)); ctx.lineTo(pad.l + W, this.Y(v)); ctx.stroke(); }
    ctx.strokeStyle = css('--ink'); ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + H); ctx.lineTo(pad.l + W, pad.t + H); ctx.stroke();
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
    for (const v of tx) { ctx.beginPath(); ctx.moveTo(this.X(v), pad.t + H); ctx.lineTo(this.X(v), pad.t + H + 4); ctx.stroke(); ctx.fillText(fmtTick(v), this.X(v), pad.t + H + 16); }
    ctx.textAlign = 'right';
    for (const v of ty) { ctx.beginPath(); ctx.moveTo(pad.l - 4, this.Y(v)); ctx.lineTo(pad.l, this.Y(v)); ctx.stroke(); ctx.fillText(fmtTick(v), pad.l - 7, this.Y(v) + 4); }
    ctx.font = '600 13px "Public Sans", sans-serif'; ctx.fillStyle = css('--floor');
    ctx.textAlign = 'center'; ctx.fillText(this.xName, pad.l + W / 2, h - 6);
    ctx.save(); ctx.translate(13, pad.t + H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(this.yName, 0, 0); ctx.restore();
    ctx.textAlign = 'left';
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, W, H); ctx.clip();
    return ctx;
  }
  end(){ this.ctx.restore(); }
  line(pts, color, width = 1.5, dash = null, alpha = 1){
    const c = this.ctx; c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width; if (dash) c.setLineDash(dash);
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(this.X(p[0]), this.Y(p[1])) : c.moveTo(this.X(p[0]), this.Y(p[1]))); c.stroke(); c.restore();
  }
  dot(p, color, r = 4.5, ring = false){
    const c = this.ctx; c.beginPath(); c.arc(this.X(p[0]), this.Y(p[1]), r, 0, 7);
    if (ring) { c.strokeStyle = color; c.lineWidth = 2.5; c.stroke(); } else { c.fillStyle = color; c.fill(); }
  }
  text(t, p, color, dx = 6, dy = -6, bold = false){ const c = this.ctx; c.font = `${bold ? '600 ' : ''}12px "Public Sans", sans-serif`; c.fillStyle = color; c.fillText(t, this.X(p[0]) + dx, this.Y(p[1]) + dy); }
  arrow(p, q, color, width = 2.5){ arrow2d(this.ctx, this.X(p[0]), this.Y(p[1]), this.X(q[0]), this.Y(q[1]), color, width); }
  dispose(){ this.ro.disconnect(); }
}

/* Level-value control: a slider over [lo, hi] showing the real value, with a "follow" option. */
function levelControl(parent, { label, onChange, followLabel }){
  const d = document.createElement('div'); d.className = 'ctl level-ctl';
  const id = 'lv' + Math.random().toString(36).slice(2, 8);
  d.innerHTML = `<label for="${id}">${label}<output></output></label><input id="${id}" type="range" min="0" max="1000" step="1">` +
    (followLabel ? `<label class="follow"><input type="checkbox" checked> ${followLabel}</label>` : '');
  parent.appendChild(d);
  const rg = d.querySelector('input[type=range]'), out = d.querySelector('output'), fol = d.querySelector('.follow input');
  let lo = 0, hi = 1;
  rg.addEventListener('input', () => { if (fol) fol.checked = false; onChange(lo + (hi - lo) * rg.value / 1000, false); });
  if (fol) fol.addEventListener('change', () => onChange(null, fol.checked));
  return {
    set(v, a, b){ lo = a; hi = b; rg.value = Math.round(1000 * (v - lo) / Math.max(hi - lo, 1e-12)); out.textContent = num(v); },
    follow(){ return fol ? fol.checked : false; },
    stopFollow(){ if (fol) fol.checked = false; }
  };
}
