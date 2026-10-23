/* ============================================================
   A small rotatable 3D view for exactly two features: the data
   points (x₁, x₂, y), the fitted plane, and optionally the true
   plane. Drag to rotate. No library: a plain orthographic
   projection drawn on a canvas.
   P3D.mount(parent, { title, height, x1, x2, y, fit:[b,w1,w2], truth:[b,w1,w2]|null, names }) -> chart-like { wrap, dispose }
   ============================================================ */
const P3D = (() => {
  function mount(parent, o){
    const wrap = document.createElement('div'); wrap.className = 'chart mini';
    wrap.innerHTML = `<div class="chart-head"><b>${o.title}</b><span class="chart-tabs"><button type="button" data-v="reset">reset view</button></span></div>`;
    const cv = document.createElement('canvas'); cv.style.height = (o.height || 320) + 'px'; cv.style.cursor = 'grab'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', o.title);
    const foot = document.createElement('div'); foot.className = 'chart-foot';
    wrap.append(cv, foot); parent.appendChild(wrap);
    let yaw = -0.7, pitch = 0.45, drag = null;
    const rng = a => { let lo = Math.min(...a), hi = Math.max(...a); if (!(hi > lo)) { lo -= 1; hi += 1; } return [lo, hi]; };
    const [a0, a1] = rng(o.x1), [b0, b1] = rng(o.x2), ysAll = [...o.y, ...[[a0, b0], [a1, b0], [a0, b1], [a1, b1]].map(([p, q]) => o.fit[0] + o.fit[1] * p + o.fit[2] * q)], [c0, c1] = rng(ysAll);
    const nx = v => 2 * (v - a0) / (a1 - a0) - 1, ny = v => 2 * (v - b0) / (b1 - b0) - 1, nz = v => 2 * (v - c0) / (c1 - c0) - 1;
    function draw(){
      const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
      cv.width = w * dpr; cv.height = h * dpr; const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = css('--panel'); ctx.fillRect(0, 0, w, h);
      const s = Math.min(w * 0.42, h * 0.4), cx = w / 2, cy = h / 2 + 18, cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      // world: X = x1, Y = x2 (depth), Z = y (up)
      const P = (X, Y, Z) => { const xr = X * cyw - Y * syw, yr = X * syw + Y * cyw; return [cx + s * xr, cy - s * (Z * cp - yr * sp), yr * cp + Z * sp]; };
      const line = (p, q, col, wdt = 1, dash = null) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = wdt; if (dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.restore(); };
      // box floor and axes
      const R = css('--rule'), I = css('--ink'), M = css('--muted');
      [[-1, -1, -1, 1, -1, -1], [-1, -1, -1, -1, 1, -1], [1, -1, -1, 1, 1, -1], [-1, 1, -1, 1, 1, -1], [-1, -1, -1, -1, -1, 1]].forEach(([x, y, z, X, Y, Z]) => line(P(x, y, z), P(X, Y, Z), R, 1));
      ctx.font = '600 12.5px "Public Sans", sans-serif'; ctx.fillStyle = I;
      const lab = (t, p) => ctx.fillText(t, p[0] + 4, p[1] + 4);
      lab(o.names[0], P(1.15, -1, -1)); lab(o.names[1], P(1, 1.15, -1)); lab('y', P(-1, -1, 1.15));
      [[-1, -1, -1, 1, -1, -1], [1, -1, -1, 1, 1, -1], [-1, -1, -1, -1, -1, 1]].forEach(([x, y, z, X, Y, Z]) => line(P(x, y, z), P(X, Y, Z), I, 1.4));
      // planes as grids
      const plane = (cf, col, dash, wdt) => { for (let t = 0; t <= 6; t++) { const u = a0 + (a1 - a0) * t / 6, v = b0 + (b1 - b0) * t / 6;
        line(P(nx(u), -1, nz(cf[0] + cf[1] * u + cf[2] * b0)), P(nx(u), 1, nz(cf[0] + cf[1] * u + cf[2] * b1)), col, wdt, dash);
        line(P(-1, ny(v), nz(cf[0] + cf[1] * a0 + cf[2] * v)), P(1, ny(v), nz(cf[0] + cf[1] * a1 + cf[2] * v)), col, wdt, dash); } };
      if (o.truth) plane(o.truth, I, [4, 4], 0.8);
      ctx.globalAlpha = 0.85; plane(o.fit, css('--surface'), null, 1.3); ctx.globalAlpha = 1;
      // points with residual sticks, far ones first
      const pts = o.y.map((yv, i) => { const fy = o.fit[0] + o.fit[1] * o.x1[i] + o.fit[2] * o.x2[i]; return { p: P(nx(o.x1[i]), ny(o.x2[i]), nz(yv)), q: P(nx(o.x1[i]), ny(o.x2[i]), nz(fy)), up: yv >= fy }; }).sort((A, B) => A.p[2] - B.p[2]);
      pts.forEach(t => { line(t.p, t.q, css('--residual'), 1); ctx.beginPath(); ctx.arc(t.p[0], t.p[1], 3.4, 0, 7); ctx.fillStyle = t.up ? css('--floor') : css('--normal'); ctx.fill(); });
      ctx.fillStyle = M; ctx.font = '12px "Public Sans", sans-serif'; ctx.fillText('drag to rotate', 10, h - 10);
    }
    foot.innerHTML = `<span><i style="border-top:3px solid ${css('--surface')}"></i>fitted plane ŷ = ${num(o.fit[0], 2)} + ${num(o.fit[1], 2)}·${o.names[0]} + ${num(o.fit[2], 2)}·${o.names[1]}</span>` + (o.truth ? `<span><i style="border-top:2px dashed ${css('--ink')}"></i>true plane</span>` : '') +
      `<span><i style="border-top:3px solid ${css('--floor')}"></i>above the plane</span><span><i style="border-top:3px solid ${css('--normal')}"></i>below</span><span><i style="border-top:3px solid ${css('--residual')}"></i>residual</span>`;
    cv.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY, yaw, pitch]; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', e => { if (!drag) return; yaw = drag[2] + (e.clientX - drag[0]) * 0.01; pitch = Math.max(-0.2, Math.min(1.45, drag[3] + (e.clientY - drag[1]) * 0.01)); draw(); });
    cv.addEventListener('pointerup', () => { drag = null; cv.style.cursor = 'grab'; });
    wrap.querySelector('[data-v="reset"]').onclick = () => { yaw = -0.7; pitch = 0.45; draw(); };
    const ro = new ResizeObserver(draw); ro.observe(cv); draw();
    return { wrap, dispose(){ ro.disconnect(); }, titleEl: wrap.querySelector('b'), title(t){ this.titleEl.textContent = t; } };
  }
  return { mount };
})();
