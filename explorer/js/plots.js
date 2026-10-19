/* ============================================================
   2D charts with independent axes, ticks and axis names.
   ============================================================ */
function niceTicksX(lo, hi, n = 5){
  const span = hi - lo; if (!(span > 0)) return [lo];
  const raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag, out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
const tickFmt = v => { const a = Math.abs(v); return (a >= 1e4 || (a > 0 && a < 1e-3) ? v.toExponential(0) : String(+v.toFixed(4))).replace('-', '−'); };
function invNorm(p){ // Acklam's approximation
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239],
        b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572],
        c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783],
        d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416], pl = 0.02425;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  if (p > 1 - pl) return -invNorm(1 - p);
  const q = p - 0.5, r = q * q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

class Chart {
  constructor(parent, { title = '', height = 300 } = {}){
    const wrap = document.createElement('div'); wrap.className = 'chart';
    wrap.innerHTML = `<div class="chart-head"><b>${title}</b><span class="chart-tabs"></span></div>`;
    const cv = document.createElement('canvas'); cv.style.height = height + 'px'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', title);
    const foot = document.createElement('div'); foot.className = 'chart-foot';
    wrap.append(cv, foot); parent.appendChild(wrap);
    Object.assign(this, { wrap, cv, foot, tabsEl: wrap.querySelector('.chart-tabs'), titleEl: wrap.querySelector('b'), drawFn: null });
    this.ro = new ResizeObserver(() => this.drawFn && this.drawFn()); this.ro.observe(cv);
  }
  title(t){ this.titleEl.textContent = t; }
  tabs(items, active, onPick){
    this.tabsEl.innerHTML = items.map(([id, label]) => `<button type="button" data-id="${id}" aria-pressed="${id === active}">${label}</button>`).join('');
    this.tabsEl.onclick = e => { const b = e.target.closest('button'); if (b) onPick(b.dataset.id); };
  }
  begin(xr, yr, xName, yName, { logY = false, noY = false } = {}){
    const { ctx, w, h } = prep(this.cv); this.ctx = ctx;
    const pad = { l: 54, r: 14, t: 10, b: 40 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
    const ty = logY ? v => Math.log10(Math.max(v, 1e-300)) : v => v;
    let [x0, x1] = xr, [y0, y1] = yr.map(ty);
    if (!(x1 > x0)) { x0 -= 1; x1 += 1; } if (!(y1 > y0)) { y0 -= 1; y1 += 1; }
    const px = (x1 - x0) * 0.04, py = (y1 - y0) * 0.06; x0 -= px; x1 += px; y0 -= py; y1 += py;
    this.X = x => pad.l + (x - x0) / (x1 - x0) * W; this.Y = y => pad.t + H - (ty(y) - y0) / (y1 - y0) * H;
    this.box = { l: pad.l, r: pad.l + W, t: pad.t, b: pad.t + H, x0, x1, y0, y1 };
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = css('--panel'); ctx.fillRect(pad.l, pad.t, W, H);
    ctx.font = '11.5px "Public Sans", sans-serif'; ctx.lineWidth = 1;
    const tx = niceTicksX(x0, x1, Math.max(3, Math.round(W / 80)));
    const tyv = logY ? (() => { const out = []; for (let k = Math.floor(y0); k <= Math.ceil(y1); k++) for (const m of (y1 - y0 < 2.5 ? [1, 2, 5] : [1])) { const v = k + Math.log10(m); if (v >= y0 && v <= y1) out.push(v); } return out; })() : niceTicksX(y0, y1, Math.max(3, Math.round(H / 55)));
    ctx.strokeStyle = css('--rule');
    tx.forEach(v => { ctx.beginPath(); ctx.moveTo(this.X(v), pad.t); ctx.lineTo(this.X(v), pad.t + H); ctx.stroke(); });
    if (!noY) tyv.forEach(v => { const Y = pad.t + H - (v - y0) / (y1 - y0) * H; ctx.beginPath(); ctx.moveTo(pad.l, Y); ctx.lineTo(pad.l + W, Y); ctx.stroke(); });
    ctx.strokeStyle = css('--ink'); ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + H); ctx.lineTo(pad.l + W, pad.t + H); ctx.stroke();
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
    tx.forEach(v => ctx.fillText(tickFmt(v), this.X(v), pad.t + H + 15));
    ctx.textAlign = 'right';
    if (!noY) tyv.forEach(v => { const Y = pad.t + H - (v - y0) / (y1 - y0) * H; ctx.fillText(logY ? tickFmt(10 ** v) : tickFmt(v), pad.l - 6, Y + 4); });
    ctx.font = '600 12.5px "Public Sans", sans-serif'; ctx.fillStyle = css('--ink'); ctx.textAlign = 'center';
    ctx.fillText(xName, pad.l + W / 2, h - 6);
    ctx.save(); ctx.translate(13, pad.t + H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yName, 0, 0); ctx.restore();
    ctx.textAlign = 'left'; ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, W, H); ctx.clip();
    return ctx;
  }
  end(){ this.ctx.restore(); }
  line(pts, color, width = 1.6, dash = null, alpha = 1){
    const c = this.ctx; c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width; if (dash) c.setLineDash(dash);
    c.beginPath(); let started = false;
    pts.forEach(p => { if (!isFinite(p[1])) { started = false; return; } started ? c.lineTo(this.X(p[0]), this.Y(p[1])) : c.moveTo(this.X(p[0]), this.Y(p[1])); started = true; });
    c.stroke(); c.restore();
  }
  dot(p, color, r = 3.6, hollow = false, alpha = 1){
    const c = this.ctx; c.save(); c.globalAlpha = alpha; c.beginPath(); c.arc(this.X(p[0]), this.Y(p[1]), r, 0, 7);
    if (hollow) { c.strokeStyle = color; c.lineWidth = 1.6; c.stroke(); } else { c.fillStyle = color; c.fill(); } c.restore();
  }
  vline(x, color, dash = null, width = 1.8){ this.line([[x, this.box.y0 - 1e9], [x, this.box.y1 + 1e9]].map(p => [p[0], p[1]]), color, width, dash); }
  hline(y, color, dash = null, width = 1.2){ const c = this.ctx; c.save(); c.strokeStyle = color; c.lineWidth = width; if (dash) c.setLineDash(dash); c.beginPath(); c.moveTo(this.box.l, this.Y(y)); c.lineTo(this.box.r, this.Y(y)); c.stroke(); c.restore(); }
  vrule(x, color, dash = null, width = 1.8){ const c = this.ctx; c.save(); c.strokeStyle = color; c.lineWidth = width; if (dash) c.setLineDash(dash); c.beginPath(); c.moveTo(this.X(x), this.box.t); c.lineTo(this.X(x), this.box.b); c.stroke(); c.restore(); }
  rect(x0, y0, x1, y1, color, alpha = 0.7){ const c = this.ctx; c.save(); c.globalAlpha = alpha; c.fillStyle = color; c.fillRect(this.X(x0), this.Y(y1), this.X(x1) - this.X(x0), this.Y(y0) - this.Y(y1)); c.restore(); }
  text(t, p, color, dx = 5, dy = -5, bold = false){ const c = this.ctx; c.font = `${bold ? '600 ' : ''}12px "Public Sans", sans-serif`; c.fillStyle = color; c.fillText(t, this.X(p[0]) + dx, this.Y(p[1]) + dy); }
  legend(items){ this.foot.innerHTML = items.map(([color, label, dash]) => `<span><i style="background:${dash ? 'transparent' : color};border-top:2px ${dash ? 'dashed' : 'solid'} ${color}"></i>${label}</span>`).join(''); }
  dispose(){ this.ro.disconnect(); }
}
