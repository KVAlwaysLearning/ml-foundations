/* ============================================================
   Shared feature-space scene: data points, prediction plane,
   residuals. Used by Lab 1 and Lab 3. Draws from LAB.get().
   ============================================================ */
function featureMap(d){
  const x1 = d.S.rows.map(r => r[0]), x2 = d.S.rows.map(r => r[1]), ys = d.S.rows.map(r => r[2]);
  const rng = a => { let lo = Math.min(...a), hi = Math.max(...a); if (hi - lo < 1e-9) { lo -= 1; hi += 1; } const p = (hi - lo) * 0.15; return [lo - p, hi + p]; };
  const [lo1, hi1] = rng(x1), [lo2, hi2] = rng(x2);
  const s = 4.8 / Math.max(hi1 - lo1, hi2 - lo2), c1 = (lo1 + hi1) / 2, c2 = (lo2 + hi2) / 2;
  const yf = Math.min(0, ...ys), top = Math.max(0, ...ys);
  const sv = Math.min(s, 5.6 / Math.max(top - yf, 1e-9));
  const clampH = h => Math.max(-3, Math.min(8.5, h));
  const P = (a, b, y) => V((a - c1) * s, (b - c2) * s, clampH((y - yf) * sv));
  return { lo1, hi1, lo2, hi2, s, sv, c1, c2, yf, top, P, clampH };
}

function planeRange(d, m){
  const [b, w1, w2] = d.w, v = [[m.lo1, m.lo2], [m.lo1, m.hi2], [m.hi1, m.lo2], [m.hi1, m.hi2]].map(([x1, x2]) => b + w1 * x1 + w2 * x2);
  let lo = Math.min(...v), hi = Math.max(...v); if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  return [lo, hi];
}
// points of the line b + w1 x1 + w2 x2 = c inside the rectangle [x0,x1]x[y0,y1]
function levelSegment(w, c, x0, x1, y0, y1){
  const [b, w1, w2] = w, nw = Math.hypot(w1, w2); if (nw < 1e-12) return null;
  const p0 = [(c - b) * w1 / (nw * nw), (c - b) * w2 / (nw * nw)], dir = [-w2 / nw, w1 / nw];
  let t0 = -1e9, t1 = 1e9;
  for (const [k, lo, hi] of [[0, x0, x1], [1, y0, y1]]) {
    if (Math.abs(dir[k]) < 1e-12) { if (p0[k] < lo || p0[k] > hi) return null; continue; }
    let ta = (lo - p0[k]) / dir[k], tb = (hi - p0[k]) / dir[k]; if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
  }
  return t0 < t1 ? [[p0[0] + t0 * dir[0], p0[1] + t0 * dir[1]], [p0[0] + t1 * dir[0], p0[1] + t1 * dir[1]]] : null;
}

function drawFeatureScene(stage, d, opt){
  stage.clearStat(); stage.clearDyn();
  const m = featureMap(d), g = stage.dyn, [b, w1, w2] = d.w;
  const A0 = (m.lo1 - m.c1) * m.s, A1 = (m.hi1 - m.c1) * m.s, B0 = (m.lo2 - m.c2) * m.s, B1 = (m.hi2 - m.c2) * m.s;
  const hTop = (m.top - m.yf) * m.sv;
  mkAxes3D(stage, { A0, A1, B0, B1, H1: hTop, a: [m.lo1, m.hi1, 'x₁'], b: [m.lo2, m.hi2, 'x₂'], h: [m.yf, m.top, 'ŷ and y'] });

  // prediction plane
  const toX = (a, bb) => [a / m.s + m.c1, bb / m.s + m.c2];
  const planeH = (a, bb) => { const [x1, x2] = toX(a, bb); return m.clampH((b + w1 * x1 + w2 * x2 - m.yf) * m.sv); };
  const plane = mkSurface(g, planeH, A0, A1, B0, B1, 12, '--surface', 0.26, 3);
  plane.userData.kind = 'plane';

  // highlighted level ŷ = c: line on the plane, its shadow on the floor, and a horizontal slice
  if (opt.level != null) {
    const seg = levelSegment(d.w, opt.level, m.lo1, m.hi1, m.lo2, m.hi2), hc = m.clampH((opt.level - m.yf) * m.sv);
    const sl = new THREE.Mesh(new THREE.PlaneGeometry(A1 - A0, B1 - B0), new THREE.MeshBasicMaterial({ color: col('--normal'), transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
    sl.rotation.x = -Math.PI / 2; sl.position.copy(V((A0 + A1) / 2, (B0 + B1) / 2, hc)); g.add(sl);
    if (seg) {
      mkTube(g, [m.P(seg[0][0], seg[0][1], opt.level), m.P(seg[1][0], seg[1][1], opt.level)], '--normal', 0.035);
      mkLine(g, [m.P(seg[0][0], seg[0][1], m.yf), m.P(seg[1][0], seg[1][1], m.yf)], '--normal', { dashed: true, dash: 0.12 });
      stage.label(`ŷ = ${num(opt.level, 2)}`, m.P(seg[1][0], seg[1][1], opt.level), '--normal');
    }
  }

  // plane meets the floor (only meaningful when the floor is y = 0)
  const nw = Math.hypot(w1, w2);
  if (m.yf === 0 && nw > 1e-6) {
    const seg = levelSegment(d.w, 0, m.lo1, m.hi1, m.lo2, m.hi2);
    if (seg) { mkLine(g, [m.P(seg[0][0], seg[0][1], 0), m.P(seg[1][0], seg[1][1], 0)], '--ink', { dashed: true, dash: 0.14 }); stage.label('ŷ = 0', m.P(seg[1][0], seg[1][1], 0), '--ink'); }
  }

  // observations
  const pickables = [plane];
  d.S.rows.forEach(([x1, x2, y], i) => {
    const yh = d.yhat[i], hi = i === d.S.sel, r = hi ? 1.6 : 1;
    pickables.push(Object.assign(mkSphere(g, m.P(x1, x2, m.yf), '--floor', 0.075 * r), { userData: { row: i } }));
    mkLine(g, [m.P(x1, x2, m.yf), m.P(x1, x2, yh)], '--muted', { dashed: true, opacity: 0.6, dash: 0.08 });
    mkSphere(g, m.P(x1, x2, yh), '--surface', 0.05 * r);
    if (opt.res) { pickables.push(Object.assign(mkSphere(g, m.P(x1, x2, y), '--residual', 0.07 * r), { userData: { row: i } })); mkLine(g, [m.P(x1, x2, yh), m.P(x1, x2, y)], '--residual'); }
    if (opt.labels || hi) stage.label(hi ? `row ${i + 1}: e = ${num(d.e[i], 2)}` : `${i + 1}`, m.P(x1, x2, Math.max(y, yh)).add(new THREE.Vector3(0, 0.3, 0)), hi ? '--residual' : '--muted');
    if (opt.field && nw > 1e-6) {
      const L = Math.min(1.1, 0.35 * nw), a = m.P(x1, x2, m.yf);
      mkArrow(g, a, a.clone().add(V(L * w1 / nw, L * w2 / nw, 0)), '--floor', 0.018);
    }
  });

  if (opt.normal && nw > 1e-6) {
    const k = m.sv / m.s, u = [w1 / nw, w2 / nw], Ls = 1.2;
    const cx = (A0 + A1) / 2, cy = (B0 + B1) / 2, h0 = planeH(cx, cy);
    mkArrow(g, V(cx, cy, 0.02), V(cx + Ls * u[0], cy + Ls * u[1], 0.02), '--floor', 0.035);
    mkArrow(g, V(cx, cy, h0), V(cx + Ls * u[0], cy + Ls * u[1], h0 + Ls * nw * k), '--surface', 0.035);
    const n = [w1 * k, w2 * k, -1], nn = Math.hypot(...n);
    const tip = V(cx + 1.2 * n[0] / nn, cy + 1.2 * n[1] / nn, h0 + 1.2 * n[2] / nn);
    mkArrow(g, V(cx, cy, h0), tip, '--normal', 0.03); stage.label('N', tip, '--normal');
    stage.label('steepest climb', V(cx + Ls * u[0], cy + Ls * u[1], h0 + Ls * nw * k + 0.3), '--surface');
  }
  if (!stage.targetSet) { stage.home.target = V(0, 0, Math.min(3.2, hTop / 2)); stage.orbit.target = stage.home.target.clone(); stage.targetSet = true; }
  stage.render();
  return { m, pickables, toX };
}

/* 3D feature view + 2D top-down projection + level control, shared by Lab 1 and Lab 3 */
function featureViews(fig, opt){
  const stage = new Stage(fig, { target: [0, 0, 2], r: 14, theta: 0.95, phi: 1.2 });
  stage.el.setAttribute('aria-label', '3D view of the data points and the prediction plane');
  const proj = new Proj2D(fig, { title: 'Top-down view of the floor: contour lines of ŷ', xName: 'x₁', yName: 'x₂',
    aria: 'Top-down view of the feature plane with contour lines of the prediction' });
  proj.hint('Click to highlight a level · drag a data point to move it');
  let last = null, lvl = null, dragRow = -1;
  const setLevel = c => { opt.level = c; if (opt.afterLevel) opt.afterLevel(); else if (last) update(last.d); };

  stage.onPick = ndc => {
    if (!last) return;
    const hit = stage.pick(ndc, last.scene.pickables); if (!hit) return;
    if (hit.object.userData.row != null) { LAB.select(hit.object.userData.row); return; }
    const [x1, x2] = last.scene.toX(hit.point.x, -hit.point.z);
    setLevel(last.d.w[0] + last.d.w[1] * x1 + last.d.w[2] * x2);
  };
  proj.onClick = (x, y) => { if (last) setLevel(last.d.w[0] + last.d.w[1] * x + last.d.w[2] * y); };
  proj.hit = (x, y, s) => {
    if (!last) return false;
    dragRow = last.d.S.rows.findIndex(r => Math.hypot(r[0] - x, r[1] - y) * s < 10);
    return dragRow >= 0;
  };
  proj.onDrag = (x, y) => { if (dragRow < 0) return; LAB.setCell(dragRow, 0, +x.toFixed(2)); LAB.setCell(dragRow, 1, +y.toFixed(2)); };

  function drawProj(){
    if (!last) return;
    const { d, scene: { m } } = last, [b, w1, w2] = d.w, P = proj, nw = Math.hypot(w1, w2);
    P.begin([m.lo1, m.hi1], [m.lo2, m.hi2]);
    const bx = P.box, [lo, hi] = planeRange(d, { lo1: bx.x0, hi1: bx.x1, lo2: bx.y0, hi2: bx.y1 });
    if (nw > 1e-9) for (const c of niceTicks(lo, hi, 7)) {
      const seg = levelSegment(d.w, c, bx.x0, bx.x1, bx.y0, bx.y1); if (!seg) continue;
      P.line(seg, css('--surface'), 1.2, null, 0.55);
      const q = seg[1][1] >= bx.y1 - 1e-9 ? [seg[1][0], seg[1][1]] : seg[1]; P.text(fmtTick(c), q, css('--surface'), 4, 14);
    }
    if (nw > 1e-9) { const z = levelSegment(d.w, 0, bx.x0, bx.x1, bx.y0, bx.y1); if (z) { P.line(z, css('--ink'), 1.2, [6, 5]); P.text('ŷ = 0', z[0], css('--ink'), 6, -6); } }
    if (opt.level != null && nw > 1e-9) {
      const seg = levelSegment(d.w, opt.level, bx.x0, bx.x1, bx.y0, bx.y1);
      if (seg) { P.line(seg, css('--normal'), 3.2); P.text(`ŷ = ${num(opt.level, 2)}`, seg[0], css('--normal'), 8, -8, true); }
    }
    if (nw > 1e-9) {
      const cx = (bx.x0 + bx.x1) / 2, cy = (bx.y0 + bx.y1) / 2, L = 0.16 * (bx.x1 - bx.x0);
      P.arrow([cx, cy], [cx + L * w1 / nw, cy + L * w2 / nw], css('--floor'), 3);
      P.text('∇ₓŷ = (w₁, w₂)', [cx + L * w1 / nw, cy + L * w2 / nw], css('--floor'), 6, -4, true);
    }
    d.S.rows.forEach((r, i) => {
      P.dot([r[0], r[1]], css('--floor'), 5);
      if (i === d.S.sel) P.dot([r[0], r[1]], css('--residual'), 9, true);
      P.text(String(i + 1), [r[0], r[1]], css('--muted'), 7, -7);
    });
    P.end();
  }
  proj.drawFn = drawProj;

  function update(d){
    const scene = drawFeatureScene(stage, d, opt);
    last = { d, scene };
    if (lvl) { const [lo, hi] = planeRange(d, scene.m); if (opt.level == null || opt.level < lo || opt.level > hi) opt.level = +((lo + hi) / 2).toFixed(3); lvl.set(opt.level, lo, hi); }
    drawProj();
    return scene;
  }
  return {
    stage, proj, update,
    attachLevel(parent){
      lvl = levelControl(parent, { label: 'Highlight the level ŷ =', onChange: c => { if (c != null) setLevel(c); } });
      if (last) update(last.d);
    },
    dispose(){ stage.dispose(); proj.dispose(); }
  };
}

function rowCalc(d){
  const i = d.S.sel;
  if (i < 0 || i >= d.N) return `<div class="calc muted">Click a row number in the data table, or a row of X, ŷ, y or e, to see that row worked out.</div>`;
  const [x1, x2, y] = d.S.rows[i], [b, w1, w2] = d.w, k = i + 1;
  return `<div class="calc"><b>Row ${k}:</b> ŷ<sub>${k}</sub> = 1·b + x<sub>${k}1</sub>·w₁ + x<sub>${k}2</sub>·w₂ = 1·${num(b)} + ${num(x1)}·${num(w1)} + ${num(x2)}·${num(w2)} = <b>${num(d.yhat[i])}</b>
    &nbsp;&nbsp; e<sub>${k}</sub> = y<sub>${k}</sub> − ŷ<sub>${k}</sub> = ${num(y)} − ${num(d.yhat[i])} = <b class="c-res">${num(d.e[i])}</b></div>`;
}

/* Lab 1: data, weights, prediction plane */
VIZ['lab-feature'] = function(fig){
  const opt = { res: true, field: false, normal: false, labels: true, level: null };
  const views = featureViews(fig, opt);
  const ctl = panel(fig, 'lab-controls');
  const u1 = dataEditor(ctl), u2 = weightEditor(ctl);
  const vbox = document.createElement('div'); vbox.className = 'lab-editor'; vbox.innerHTML = `<div class="ed-head"><b>Show</b></div>`; ctl.appendChild(vbox);
  views.attachLevel(vbox);
  checks(vbox, [['res','Targets and residuals'], ['labels','Row numbers'], ['field','Gradient ∇ₓŷ = (w₁, w₂) on the floor'], ['normal','Steepest line and normal']], opt, () => views.update(LAB.get()));
  const calc = panel(fig, 'calc-wrap');
  const grid = mxGrid(fig, 'The matrices behind this picture (live)');
  const ro = panel(fig, 'readout');
  caption(fig, [['--floor','Observations (x₁, x₂)'], ['--surface','Plane ŷ = b + w₁x₁ + w₂x₂'], ['--residual','Targets y and residuals e'], ['--normal','Highlighted level and normal']],
    'Click the plane (3D) or the floor view (2D) to highlight the contour line through that point; click a sphere to trace its row. Edit any number and everything updates together.');

  function draw(d){
    const { m } = views.update(d);
    const labels = d.S.rows.map((_, i) => String(i + 1));
    calc.innerHTML = rowCalc(d);
    grid.innerHTML =
      mx(d.X, { name: 'X', formula: 'design matrix: a column of 1s, then x₁, x₂', colLabels: ['1','x₁','x₂'], rowLabels: labels, rowHi: d.S.sel, selectable: true, tone: 'floor' }) +
      mx(d.w, { name: 'w', formula: 'weights', rowLabels: ['b','w₁','w₂'] }) +
      mx(d.yhat, { name: 'ŷ = Xw', formula: 'each row: that row of X · w', rowHi: d.S.sel, selectable: true, tone: 'surface' }) +
      mx(d.y, { name: 'y', formula: 'targets', rowHi: d.S.sel, selectable: true, tone: 'res' }) +
      mx(d.e, { name: 'e = y − ŷ', formula: 'residuals', rowHi: d.S.sel, selectable: true, tone: 'res' }) +
      scalarBox('eᵀe', num(d.SSE), 'sum of squared residuals') +
      scalarBox('L = eᵀe / N', num(d.L), `mean squared error, N = ${d.N}`, 'normal');
    const nw = Math.hypot(d.w[1], d.w[2]);
    ro.innerHTML = `<span>‖(w₁, w₂)‖ = <b>${num(nw)}</b></span><span>tilt of the plane θ = arctan‖w‖ = <b>${num(Math.atan(nw) * 180 / Math.PI, 1)}°</b></span>
      <span>highlighted level ŷ = <b>${num(opt.level ?? 0)}</b></span><span>least-squares L = <b>${num(d.Lopt)}</b></span>` +
      (m.sv < m.s * 0.999 ? `<span class="msg">In 3D, heights are drawn at ${num(m.sv / m.s, 2)}× the horizontal scale so the data fits the box, so the drawn tilt looks gentler than θ. The top-down view uses equal scales, so right angles there are true.</span>` : '') +
      (d.rank < 3 ? `<span class="msg">X has rank ${d.rank} &lt; 3: more than one plane fits equally well, so "Fit" picks the one with the smallest weights.</span>` : '') +
      (Math.abs(d.L - d.Lopt) < 1e-9 ? `<span class="msg">These are the least-squares weights: no other plane gives a smaller L.</span>` : '');
  }
  opt.afterLevel = () => draw(LAB.get());
  const u3 = LAB.subscribe(draw);
  return () => { u1(); u2(); u3(); views.dispose(); };
};
