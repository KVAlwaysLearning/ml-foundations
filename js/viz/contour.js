/* ============================================================
   Contours of L(w) = 1/2 (w - w*)^T A (w - w*), with w* at the origin.
   A = R(θ) diag(λ1, λ2) R(θ)^T. Drag the point to move it, drag
   anywhere else to rotate the ellipse; sliders do the same.
   ============================================================ */
VIZ.contour = function(fig){
  const S = { l1: 3, l2: 0.8, th: 25, d: [0.55, 0.75] };
  const proj = new Proj2D(fig, { title: 'Contours of L around w* = (0, 0)', xName: 'w₁ − w₁*', yName: 'w₂ − w₂*', height: 'min(62vh, 520px)',
    aria: 'Elliptical contours with the gradient at a draggable point' });
  proj.hint('Drag the black point to move it · drag anywhere else to rotate the ellipse');
  const ctl = panel(fig, 'controls');
  const sl1 = slider(ctl, { label: 'λ₁: curvature along v₁', min: 0.2, max: 6, step: 0.05, value: S.l1, onInput: v => { S.l1 = v; draw(); } });
  const sl2 = slider(ctl, { label: 'λ₂: curvature along v₂', min: 0.2, max: 6, step: 0.05, value: S.l2, onInput: v => { S.l2 = v; draw(); } });
  const sth = slider(ctl, { label: 'Rotation θ of the ellipse (degrees)', min: -180, max: 180, step: 1, value: S.th, digits: 0, onInput: v => { S.th = v; draw(); } });
  const sL  = slider(ctl, { label: 'Level of the point: L(w)', min: 0.02, max: 4, step: 0.01, value: 1, onInput: v => { setLevel(v); draw(); } });
  const sang = slider(ctl, { label: 'Direction of the point from w* (degrees)', min: -180, max: 180, step: 1, value: 0, digits: 0, onInput: v => { setAngle(v); draw(); } });
  const grid = mxGrid(fig, 'The matrices behind this picture (live)');
  const ro = panel(fig, 'readout');
  caption(fig, [['--floor','Contours and the gradient ∇L = A(w − w*)'], ['--normal','Highlighted contour through the point, and the line to w*'], ['--muted','Eigenvector axes and the tangent']],
    'Both axes use the same scale, so right angles on screen are real right angles. The gradient arrow length is proportional to ‖∇L‖.');

  const Amat = () => { const t = S.th * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
    return [[S.l1 * c * c + S.l2 * s * s, (S.l1 - S.l2) * c * s], [(S.l1 - S.l2) * c * s, S.l1 * s * s + S.l2 * c * c]]; };
  const Lof = d => 0.5 * LA.dot(d, LA.mv(Amat(), d));
  function setLevel(c){ const cur = Lof(S.d); if (cur < 1e-12) S.d = [0.3, 0]; S.d = LA.scale(S.d, Math.sqrt(c / Math.max(Lof(S.d), 1e-12))); }
  function setAngle(deg){ const r = Math.hypot(...S.d) || 0.5, t = deg * Math.PI / 180; S.d = [r * Math.cos(t), r * Math.sin(t)]; }

  let rot = null;
  proj.hit = (x, y, s) => { if (Math.hypot(x - S.d[0], y - S.d[1]) * s < 14) { rot = null; return true; } rot = { a: Math.atan2(y, x), th: S.th }; return true; };
  proj.onDrag = (x, y) => {
    if (rot) { let th = rot.th + (Math.atan2(y, x) - rot.a) * 180 / Math.PI; th = ((th + 180) % 360 + 360) % 360 - 180; S.th = th; sth.set(Math.round(th)); }
    else S.d = [x, y];
    draw();
  };
  proj.onDragEnd = () => { rot = null; };

  function draw(){
    const A = Amat(), ev = LA.eigSym(A), [l1, l2] = [S.l1, S.l2], t = S.th * Math.PI / 180;
    const v1 = [Math.cos(t), Math.sin(t)], v2 = [-Math.sin(t), Math.cos(t)];
    const d = S.d, g = LA.mv(A, d), gn = LA.norm(g), dn = LA.norm(d), c = Lof(d);
    sL.set(Math.min(4, Math.max(0.02, c))); sang.set(Math.round(Math.atan2(d[1], d[0]) * 180 / Math.PI));
    const ell = (lev, n = 200) => Array.from({ length: n + 1 }, (_, i) => { const a = 2 * Math.PI * i / n, r1 = Math.sqrt(2 * lev / l1), r2 = Math.sqrt(2 * lev / l2);
      return [r1 * Math.cos(a) * v1[0] + r2 * Math.sin(a) * v2[0], r1 * Math.cos(a) * v1[1] + r2 * Math.sin(a) * v2[1]]; });
    const P = proj; P.begin([-2.2, 2.2], [-2.2, 2.2]);
    const B = 6;
    P.line([LA.scale(v1, -B), LA.scale(v1, B)], css('--muted'), 1, [5, 5]);
    P.line([LA.scale(v2, -B), LA.scale(v2, B)], css('--muted'), 1, [5, 5]);
    P.text(`v₁ (λ₁ = ${num(l1, 2)})`, LA.scale(v1, 1.85), css('--muted'), 4, -6, true);
    P.text(`v₂ (λ₂ = ${num(l2, 2)})`, LA.scale(v2, 1.85), css('--muted'), 4, -6, true);
    for (const lev of [0.25, 0.5, 1, 1.5, 2, 3, 4]) { const e = ell(lev); P.line(e, css('--floor'), 1.1, null, 0.5); P.text(fmtTick(lev), e[25], css('--floor'), 3, -3); }
    if (c > 1e-9) { P.line(ell(c), css('--normal'), 3); P.text(`L = ${num(c, 3)}`, ell(c)[70], css('--normal'), 6, -6, true); }
    if (dn > 1e-9) {
      P.line([[0, 0], LA.scale(d, 1.8 / dn * Math.max(dn, 1))], css('--normal'), 1.4, [6, 5]);
      const tg = [-g[1] / gn, g[0] / gn]; P.line([LA.add(d, LA.scale(tg, -0.7)), LA.add(d, LA.scale(tg, 0.7))], css('--muted'), 1.2, [3, 4]);
      const L = 0.2 + 0.4 * gn / Math.max(Math.sqrt(2 * c * Math.max(l1, l2)), 1e-9), tip = LA.add(d, LA.scale(g, L / gn));
      P.arrow(d, tip, css('--floor'), 3); P.text('∇L', tip, css('--floor'), 6, -4, true);
      const dt = LA.add(d, LA.scale(g, -L / gn)); P.line([d, dt], css('--normal'), 1.6, [2, 3]); P.text('−∇L', dt, css('--normal'), 6, 12);
    }
    P.dot([0, 0], css('--normal'), 5.5); P.text('w*', [0, 0], css('--normal'), 8, 16, true);
    P.dot(d, css('--ink'), 6.5);
    P.end();

    const ang = dn > 1e-9 && gn > 1e-12 ? Math.acos(Math.max(-1, Math.min(1, LA.dot(g, d) / (gn * dn)))) * 180 / Math.PI : 0;
    grid.innerHTML =
      mx(A, { name: 'A = V Λ Vᵀ', formula: 'curvature (Hessian) matrix', tone: 'surface' }) +
      mx([l1, l2], { name: 'Λ', formula: 'eigenvalues: curvature along each axis', rowLabels: ['λ₁','λ₂'] }) +
      mx([[v1[0], v2[0]], [v1[1], v2[1]]], { name: 'V = [v₁ v₂]', formula: `eigenvectors, rotated by θ = ${num(S.th, 0)}°`, colLabels: ['v₁','v₂'] }) +
      mx(d, { name: 'd = w − w*', formula: 'where the point sits', tone: 'normal' }) +
      mx(g, { name: '∇L = A·d', formula: `= [${num(A[0][0], 2)}·${num(d[0], 2)} + ${num(A[0][1], 2)}·${num(d[1], 2)}, ${num(A[1][0], 2)}·${num(d[0], 2)} + ${num(A[1][1], 2)}·${num(d[1], 2)}]`, tone: 'floor' }) +
      scalarBox('L = ½ dᵀAd', num(c, 3), 'level of the highlighted contour', 'normal') +
      scalarBox('angle(∇L, d)', num(ang, 1) + '°', 'zero only on the eigenvector axes');
    const onAxis = Math.min(Math.abs(LA.dot(d, v2)), Math.abs(LA.dot(d, v1))) / Math.max(dn, 1e-12) < 0.01;
    const circle = Math.abs(l1 - l2) < 1e-6;
    ro.innerHTML = `<span>‖∇L‖ here = <b>${num(gn, 3)}</b></span><span>on this contour ‖∇L‖ ranges from <b>${num(Math.sqrt(2 * c * Math.min(l1, l2)), 3)}</b> (gentle ends) to <b>${num(Math.sqrt(2 * c * Math.max(l1, l2)), 3)}</b> (steep sides)</span>` +
      `<span class="msg">${circle ? 'λ₁ = λ₂: A is a multiple of I, every direction is an eigenvector, and the gradient always points straight away from w*.'
        : onAxis ? 'd lies on an eigenvector axis, so A·d is just λ·d: the gradient points straight away from w*.'
        : 'd is not an eigenvector, so A·d turns it toward the steeper axis: the gradient is perpendicular to the contour and misses w*. Gradient descent (−∇L) therefore does not head straight for w*.'}</span>`;
  }
  proj.drawFn = draw; draw();
  return () => proj.dispose();
};
