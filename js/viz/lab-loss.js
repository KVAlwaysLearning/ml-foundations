/* ============================================================
   Lab 2: the loss surface over (w1, w2) with b held at its
   current value, a top-down contour view, and every matrix used
   to find the minimum. Optional ridge penalty lambda*(w1^2 + w2^2).
   ============================================================ */
VIZ['lab-loss'] = function(fig){
  const opt = { contours: true, tangent: true, normal: true, field: false, eig: true, ridge: 0, level: null, follow: true };
  const stage = new Stage(fig, { target: [0, 0, 1.2], r: 13, theta: 0.95, phi: 1.12 });
  stage.el.setAttribute('aria-label', '3D loss surface over the weights w1 and w2');
  const proj = new Proj2D(fig, { title: 'Top-down view of the floor: contours of L', xName: 'w₁', yName: 'w₂', aria: 'Contour map of the loss over w1 and w2' });
  proj.hint('Click to highlight a contour · drag the black point to change w₁, w₂');
  const ctl = panel(fig, 'lab-controls');
  const u1 = dataEditor(ctl), u2 = weightEditor(ctl, { fitLabel: 'Jump to the minimum' });
  const vbox = document.createElement('div'); vbox.className = 'lab-editor'; vbox.innerHTML = `<div class="ed-head"><b>Show</b></div>`; ctl.appendChild(vbox);
  const lvl = levelControl(vbox, { label: 'Highlight the contour L =', followLabel: 'Follow the current point',
    onChange: (c, follow) => { if (c != null) { opt.level = c; opt.follow = false; } else opt.follow = follow; draw(LAB.get()); } });
  slider(vbox, { label: 'Ridge penalty λ', min: 0, max: 2, step: 0.01, value: 0, onInput: v => { opt.ridge = v; draw(LAB.get()); } });
  checks(vbox, [['contours','Contours'], ['eig','Eigen axes (2D)'], ['tangent','Tangent plane'], ['normal','Normal'], ['field','Gradient field']], opt, () => draw(LAB.get()));
  const calc = panel(fig, 'calc-wrap');
  const grid = mxGrid(fig, 'The matrices behind this picture (live)');
  const ro = panel(fig, 'readout');
  caption(fig, [['--floor','Weights (w₁, w₂), gradient, contours'], ['--surface','Loss surface L'], ['--normal','Highlighted contour, normal, minimum']],
    'The floor is the (w₁, w₂) plane with b held at its current value; change b and the whole surface moves. The 3D heights are scaled to fit the box; the top-down view uses equal scales on both axes.');

  const fitBtn = ctl.querySelector('.lab-editor:nth-of-type(2) .btn');
  fitBtn.onclick = () => { const q = quant(LAB.get()); LAB.setW(q.opt.w.map(v => +v.toFixed(6))); };

  function quant(d){
    const lam = opt.ridge, N = d.N, D = [0, 1, 1];
    const M = d.XtX.map((r, i) => r.map((v, j) => v + (i === j ? N * lam * D[i] : 0)));
    const H = M.map(r => r.map(v => 2 * v / N));
    const Lf = w => { const e = LA.sub(d.y, LA.mv(d.X, w)); return LA.dot(e, e) / N + lam * (w[1] ** 2 + w[2] ** 2); };
    const gradF = w => LA.scale(LA.sub(LA.mv(M, w), d.Xty), 2 / N);
    const optm = LA.minimizer(M, d.Xty);
    return { lam, M, H, Lf, gradF, opt: optm, Lopt: Lf(optm.w), eig: LA.eigSym(H), det: LA.det(M) };
  }
  function geometry(d, q){
    const b = d.w[0], v = [d.w[1], d.w[2]];
    const Hs = [[q.H[1][1], q.H[1][2]], [q.H[2][1], q.H[2][2]]];
    const g0 = q.gradF([b, 0, 0]).slice(1), sl = LA.minimizer(Hs, LA.scale(g0, -1)), vS = sl.w;
    const Ls = p => q.Lf([b, p[0], p[1]]), gv = p => q.gradF([b, p[0], p[1]]).slice(1);
    const R = proj.frozen && G ? G.R : Math.max(1, 1.3 * Math.max(Math.abs(v[0] - vS[0]), Math.abs(v[1] - vS[1])));
    const C = proj.frozen && G ? G.C : vS;
    const sc = 2.8 / R, toS = p => [(p[0] - C[0]) * sc, (p[1] - C[1]) * sc], toV = (a, bb) => [C[0] + a / sc, C[1] + bb / sc];
    let maxL = 0, gmax = 0;
    for (let i = 0; i <= 20; i++) for (let j = 0; j <= 20; j++) { const p = toV(-2.8 + 5.6 * i / 20, -2.8 + 5.6 * j / 20); maxL = Math.max(maxL, Ls(p)); gmax = Math.max(gmax, Math.hypot(...gv(p))); }
    const ev = eig2(Hs[0][0], Hs[0][1], Hs[1][1]), Lmin = Ls(vS), singular = !sl.unique;
    // level set L = Lmin + c in (w1, w2) coordinates, as polylines
    const contour = c => {
      if (c < 0) return [];
      const lo = [C[0] - R, C[1] - R], hi = [C[0] + R, C[1] + R], inside = p => p[0] >= lo[0] - 1e-9 && p[0] <= hi[0] + 1e-9 && p[1] >= lo[1] - 1e-9 && p[1] <= hi[1] + 1e-9;
      if (!singular) {
        const r1 = Math.sqrt(2 * c / ev.l1), r2 = Math.sqrt(2 * c / ev.l2), pts = [];
        for (let i = 0; i <= 160; i++) { const t = 2 * Math.PI * i / 160, a = r1 * Math.cos(t), bb = r2 * Math.sin(t); pts.push([vS[0] + a * ev.v1[0] + bb * ev.v2[0], vS[1] + a * ev.v1[1] + bb * ev.v2[1]]); }
        const runs = []; let cur = [];
        for (const p of pts) { if (inside(p)) cur.push(p); else { if (cur.length > 1) runs.push(cur); cur = []; } }
        if (cur.length > 1) runs.push(cur);
        if (runs.length > 1 && inside(pts[0]) && inside(pts[pts.length - 1])) { const f = runs.shift(); runs[runs.length - 1] = runs[runs.length - 1].concat(f); }
        return runs;
      }
      const r1 = Math.sqrt(2 * c / ev.l1), out = [];
      for (const sg of [-1, 1]) {
        const p0 = [vS[0] + sg * r1 * ev.v1[0], vS[1] + sg * r1 * ev.v1[1]];
        const t = clipLine([p0[0] - C[0], p0[1] - C[1]], ev.v2, R);
        if (t) out.push([[p0[0] + t[0] * ev.v2[0], p0[1] + t[0] * ev.v2[1]], [p0[0] + t[1] * ev.v2[0], p0[1] + t[1] * ev.v2[1]]]);
      }
      return out;
    };
    return { b, v, Hs, vS, C, R, sc, toS, toV, Ls, gv, maxL, gmax, ev, Lmin, singular, contour, k: 3 / Math.max(maxL, 1e-12) };
  }

  let G = null, Q = null, surf = null, D = null;
  stage.onPick = ndc => {
    if (!surf) return; const hit = stage.pick(ndc, [surf]); if (!hit) return;
    const p = G.toV(hit.point.x, -hit.point.z); opt.level = G.Ls(p); opt.follow = false; draw(LAB.get());
  };
  proj.onClick = (x, y) => { if (!G) return; opt.level = G.Ls([x, y]); opt.follow = false; draw(LAB.get()); };
  proj.hit = (x, y, s) => G && Math.hypot(x - G.v[0], y - G.v[1]) * s < 12;
  proj.onDrag = (x, y) => { const w = LAB.get().w; LAB.setW([w[0], +x.toFixed(3), +y.toFixed(3)]); };

  function draw3D(d){
    stage.clearStat(); stage.clearDyn();
    const g = stage.dyn, { toS, toV, Ls, k, v, vS, ev, singular, Lmin, maxL } = G;
    const H1 = 3;
    mkAxes3D(stage, { A0: -2.8, A1: 2.8, B0: -2.8, B1: 2.8, H1, a: [G.C[0] - G.R, G.C[0] + G.R, 'w₁'], b: [G.C[1] - G.R, G.C[1] + G.R, 'w₂'], h: [0, maxL, 'L'] });
    surf = mkSurface(g, (a, bb) => k * Ls(toV(a, bb)), -2.8, 2.8, -2.8, 2.8, 44, '--surface', 0.28, 4);
    if (opt.contours) for (const f of [0.02, 0.07, 0.15, 0.28, 0.45, 0.68]) {
      const c = f * (maxL - Lmin);
      for (const run of G.contour(c)) {
        const sp = run.map(toS);
        mkLine(g, sp.map(p => V(p[0], p[1], 0.01)), '--floor', { opacity: 0.7 });
        mkLine(g, sp.map(p => V(p[0], p[1], k * (Lmin + c))), '--surface', { opacity: 0.75 });
      }
    }
    // highlighted contour
    if (opt.level != null && opt.level >= Lmin - 1e-12) {
      const hc = k * opt.level;
      const sl = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), new THREE.MeshBasicMaterial({ color: col('--normal'), transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
      sl.rotation.x = -Math.PI / 2; sl.position.copy(V(0, 0, hc)); g.add(sl);
      const runs = G.contour(opt.level - Lmin);
      runs.forEach((run, i) => {
        const sp = run.map(toS);
        mkTube(g, sp.map(p => V(p[0], p[1], hc)), '--normal', 0.03);
        mkLine(g, sp.map(p => V(p[0], p[1], 0.02)), '--normal');
        if (i === 0) stage.label(`L = ${num(opt.level, 3)}`, V(sp[0][0], sp[0][1], hc + 0.25), '--normal');
      });
    }
    const hm = k * Lmin, s0 = toS(vS);
    if (!singular) {
      mkSphere(g, V(s0[0], s0[1], hm), '--normal', 0.08);
      if (hm > 0.03) mkLine(g, [V(s0[0], s0[1], 0), V(s0[0], s0[1], hm)], '--normal', { dashed: true, dash: 0.07 });
      const best = Q.opt.unique && Math.abs(G.b - Q.opt.w[0]) < 1e-6;
      stage.label(best ? `overall minimum, L = ${num(Q.Lopt)}` : `lowest point at this b, L = ${num(Lmin)}`, V(s0[0], s0[1], hm - 0.3), '--normal');
    } else {
      const t = clipLine(s0, ev.v2, 2.8);
      if (t) { mkLine(g, [V(s0[0] + t[0] * ev.v2[0], s0[1] + t[0] * ev.v2[1], hm + 0.01), V(s0[0] + t[1] * ev.v2[0], s0[1] + t[1] * ev.v2[1], hm + 0.01)], '--normal');
        stage.label('line of minima', V(s0[0] + t[1] * ev.v2[0] * 0.8, s0[1] + t[1] * ev.v2[1] * 0.8, hm + 0.35), '--normal'); }
    }
    if (opt.field) for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const a = -2.4 + 4.8 * i / 6, bb = -2.4 + 4.8 * j / 6, gr = G.gv(toV(a, bb)), gl = Math.hypot(...gr); if (gl < 1e-9) continue;
      const len = 0.6 * gl / G.gmax; mkArrow(g, V(a, bb, 0.02), V(a + len * gr[0] / gl, bb + len * gr[1] / gl, 0.02), '--floor', 0.016);
    }
    const p0 = toS(v), hv = k * Ls(v), gr = G.gv(v), gl = Math.hypot(...gr);
    mkSphere(g, V(p0[0], p0[1], 0), '--floor', 0.08);
    mkLine(g, [V(p0[0], p0[1], 0), V(p0[0], p0[1], hv)], '--muted', { dashed: true, dash: 0.08 });
    mkSphere(g, V(p0[0], p0[1], hv), '--surface', 0.08);
    if (gl > 1e-9) {
      const len = 1.4 * gl / G.gmax;
      mkArrow(g, V(p0[0], p0[1], 0.03), V(p0[0] + len * gr[0] / gl, p0[1] + len * gr[1] / gl, 0.03), '--floor', 0.035);
      stage.label('∂L/∂(w₁,w₂)', V(p0[0] + (len + 0.45) * gr[0] / gl, p0[1] + (len + 0.45) * gr[1] / gl, 0.05), '--floor');
    }
    const slope = [k * gr[0] / G.sc, k * gr[1] / G.sc];
    if (opt.tangent) mkSurface(g, (a, bb) => hv + slope[0] * (a - p0[0]) + slope[1] * (bb - p0[1]), p0[0] - 0.7, p0[0] + 0.7, p0[1] - 0.7, p0[1] + 0.7, 2, '--surface', 0.45, 2);
    if (opt.normal) { const n = [slope[0], slope[1], -1], nn = Math.hypot(...n), tip = V(p0[0] + 1.3 * n[0] / nn, p0[1] + 1.3 * n[1] / nn, hv + 1.3 * n[2] / nn);
      mkArrow(g, V(p0[0], p0[1], hv), tip, '--normal', 0.03); stage.label('N', tip, '--normal'); }
    stage.render();
  }

  function drawProj(){
    if (!G) return;
    const P = proj, { C, R, vS, ev, v, singular, Lmin, maxL } = G;
    P.begin([C[0] - R, C[0] + R], [C[1] - R, C[1] + R]);
    const bx = P.box, half = Math.max(bx.x1 - bx.x0, bx.y1 - bx.y0);
    if (opt.eig) for (const [e, name] of [[ev.v1, 'steep axis'], [ev.v2, 'gentle axis']]) {
      if (singular && name === 'gentle axis') continue;
      P.line([[vS[0] - half * e[0], vS[1] - half * e[1]], [vS[0] + half * e[0], vS[1] + half * e[1]]], css('--muted'), 1, [5, 5]);
    }
    if (opt.contours) for (const f of [0.02, 0.07, 0.15, 0.28, 0.45, 0.68]) {
      const c = f * (maxL - Lmin), runs = G.contour(c);
      runs.forEach((run, i) => { P.line(run, css('--floor'), 1.3, null, 0.8); if (i === 0) P.text(fmtTick(+(Lmin + c).toPrecision(3)), run[Math.floor(run.length * 0.1)], css('--floor'), 4, -4); });
    }
    if (opt.level != null) G.contour(opt.level - Lmin).forEach((run, i) => { P.line(run, css('--normal'), 3.2); if (i === 0) P.text(`L = ${num(opt.level, 3)}`, run[Math.floor(run.length * 0.35)], css('--normal'), 6, -8, true); });
    if (!singular) { P.dot(vS, css('--normal'), 5.5); P.text(Q.opt.unique && Math.abs(G.b - Q.opt.w[0]) < 1e-6 ? 'w*' : 'lowest at this b', vS, css('--normal'), 8, 16, true); }
    else { const t = clipLine([vS[0] - C[0], vS[1] - C[1]], ev.v2, R); if (t) P.line([[vS[0] + t[0] * ev.v2[0], vS[1] + t[0] * ev.v2[1]], [vS[0] + t[1] * ev.v2[0], vS[1] + t[1] * ev.v2[1]]], css('--normal'), 3); }
    const gr = G.gv(v), gl = Math.hypot(...gr);
    if (!singular) P.line([v, vS], css('--muted'), 1.2, [4, 4]);
    if (gl > 1e-9) { const L = 0.22 * half * gl / G.gmax + 0.03 * half; const tip = [v[0] + L * gr[0] / gl, v[1] + L * gr[1] / gl]; P.arrow(v, tip, css('--floor'), 3); P.text('∇L', tip, css('--floor'), 6, -4, true); }
    P.dot(v, css('--ink'), 6); P.text(`(${num(v[0], 2)}, ${num(v[1], 2)})`, v, css('--ink'), 9, 16);
    P.end();
  }
  proj.drawFn = drawProj;

  function draw(d){
    D = d; Q = quant(d); G = geometry(d, Q);
    if (opt.follow) opt.level = G.Ls(G.v);
    lvl.set(opt.level ?? G.Lmin, G.Lmin, G.maxL);
    draw3D(d); drawProj();
    const q = Q, w = d.w, G2 = q.gradF(w), gl = Math.hypot(G2[1], G2[2]);
    calc.innerHTML = `<div class="calc"><b>Gradient at the current w:</b> ∇L = (2/N)(${q.lam > 0 ? 'M' : 'XᵀX'}·w − Xᵀy) = (2/${d.N})·([${LA.mv(q.M, w).map(x => num(x)).join(', ')}] − [${d.Xty.map(x => num(x)).join(', ')}]) = <b>[${G2.map(x => num(x)).join(', ')}]</b>.
      The floor arrow shows its last two entries; ∂L/∂b = ${num(G2[0])} has no axis in this picture.</div>`;
    const lamRows = q.lam > 0 ? mx(q.M, { name: 'M = XᵀX + Nλ·D', formula: 'D = diag(0, 1, 1): the bias is not penalised', rowLabels: ['b','w₁','w₂'], colLabels: ['b','w₁','w₂'] }) : '';
    const [l1, , l3] = q.eig.values, kappa = l3 > 1e-12 * Math.abs(l1) ? l1 / l3 : Infinity;
    grid.innerHTML =
      mx(d.XtX, { name: 'XᵀX', formula: 'entry (j,k) = column j · column k', rowLabels: ['1','x₁','x₂'], colLabels: ['1','x₁','x₂'], tone: 'floor' }) +
      mx(d.Xty, { name: 'Xᵀy', formula: 'each column · y', rowLabels: ['1','x₁','x₂'] }) + lamRows +
      mx(q.H, { name: 'H = (2/N)' + (q.lam > 0 ? 'M' : 'XᵀX'), formula: 'Hessian: curvature, same everywhere', rowLabels: ['b','w₁','w₂'], colLabels: ['b','w₁','w₂'], tone: 'surface', note: 'lower-right 2×2 block = curvature of the surface drawn' }) +
      mx(q.eig.values, { name: 'eigenvalues of H', formula: `κ = λ_max/λ_min = ${isFinite(kappa) ? num(kappa, 1) : '∞'}`, rowLabels: ['λ₁','λ₂','λ₃'] }) +
      mx(G2, { name: '∇L(w)', formula: 'gradient at the current w', rowLabels: ['∂/∂b','∂/∂w₁','∂/∂w₂'], tone: 'floor' }) +
      (q.opt.unique
        ? mx(q.opt.w, { name: 'w*', formula: `solves ${q.lam > 0 ? 'M' : 'XᵀX'}·w = Xᵀy`, rowLabels: ['b*','w₁*','w₂*'], tone: 'normal' })
        : scalarBox('w*', 'not unique', `det(${q.lam > 0 ? 'M' : 'XᵀX'}) = 0: infinitely many minimisers`, 'normal')) +
      scalarBox(`det(${q.lam > 0 ? 'M' : 'XᵀX'})`, num(q.det), 'zero means no inverse') +
      scalarBox('L(w)', num(q.Lf(w)), q.lam > 0 ? 'MSE + λ(w₁² + w₂²)' : 'MSE at the current w') +
      scalarBox('L(w*)', num(q.Lopt), 'lowest possible loss', 'normal');
    const msgs = [];
    if (!q.opt.unique) msgs.push(`XᵀX is singular (X has rank ${d.rank}), so the minimum is not a single point. Raise λ to make it unique.`);
    if (q.opt.unique && LA.norm(G2) < 1e-6) msgs.push(`At the minimum the gradient is zero but the residuals are not: RMS residual = ${num(Math.sqrt(d.L))}. What remains is orthogonal to every column of X (Xᵀe = 0).`);
    else if (q.opt.unique && Math.abs(w[0] - q.opt.w[0]) > 1e-6) msgs.push(`b = ${num(w[0])} is not the best bias (b* = ${num(q.opt.w[0])}), so the lowest point of this surface is not the overall minimum. Press "Jump to the minimum".`);
    if (opt.follow && gl > 1e-9) msgs.push('The highlighted contour passes through the current point, and the gradient arrow crosses it at a right angle (see the top-down view).');
    ro.innerHTML = `<span>λ = <b>${num(q.lam)}</b></span><span>highlighted L = <b>${num(opt.level ?? 0)}</b></span><span>‖∇L‖ = <b>${num(LA.norm(G2))}</b></span><span>rank(X) = <b>${d.rank}</b></span>` + msgs.map(m => `<span class="msg">${m}</span>`).join('');
  }
  proj.onDragEnd = () => draw(LAB.get());
  const u3 = LAB.subscribe(draw);
  return () => { u1(); u2(); u3(); stage.dispose(); proj.dispose(); };
};
