/* ============================================================
   Model formulation: the datasets each attribute is shown on, the
   design (for model type), and the alternative model each variant
   fits next to ordinary least squares (step 9a, "this variant").
   Every alternative is fitted on the same standardised training rows
   (X̃, y) as the OLS backbone and keeps the details its worked
   explanation needs (iterations, paths, cross-validation tables).
   MF.has(id)  MF.data(id, P, N, sg, s)  MF.apply(r, id, seed)  MF.fit(id, P, d)
   ============================================================ */
const MF = (() => {
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length, med = a => { const s = [...a].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const lin = x => 2 + 1.5 * x;

  /* ---------- datasets ---------- */
  function corrFeatures(P, N, sg){ // 8 features in two correlated groups; sparse truth
    const rng = P.rng2(), g = gaussFn(rng), f1 = Array.from({ length: N }, () => g()), f2 = Array.from({ length: N }, () => g());
    const X = Array.from({ length: N }, (_, i) => [1, ...[0, 1, 2, 3].map(() => 5 + 2 * (0.95 * f1[i] + 0.31 * g())), ...[0, 1, 2, 3].map(() => 5 + 2 * (0.6 * f2[i] + 0.8 * g()))]);
    const beta = [1.0, 0.5, 0, 0, 0.8, 0, 0, 0.3], y = X.map((r, i) => 2 + r.slice(1).reduce((s, v, k) => s + beta[k] * v, 0) + sg * 1.5 * P.z1[i]);
    const coef = { 0: 2 }; beta.forEach((b, k) => coef[k + 1] = b);
    return { X, names: ['1', ...[1, 2, 3, 4, 5, 6, 7, 8].map(k => 'x' + '₀₁₂₃₄₅₆₇₈₉'[k])], y, px: X.map(r => r[1]), xName: 'x₁', truth: { coef, fn: null }, focus: [1],
      note: 'x₁–x₄ move together (r ≈ 0.9), x₅–x₈ a little; only x₁, x₂, x₅, x₈ matter (1.0, 0.5, 0.8, 0.3)' };
  }
  const DATA = {
    intercept: (P, N, sg) => { const x = P.u1.slice(0, N).map(v => 10 * v).sort((a, b) => a - b), f = v => 6 + 1.0 * v;
      return { X: x.map(v => [1, v]), names: ['1', 'x'], y: x.map((v, i) => f(v) + sg * P.z1[i]), px: x, xName: 'x', truth: { coef: { 0: 6, 1: 1.0 }, fn: (v) => f(v), fnRaw: f }, focus: [1], note: 'y = 6 + 1.0·x + ε: the line does not pass through 0' }; },
    modeltype: (P, N, sg) => { const x1 = P.u1.slice(0, N).map(v => 10 * v).sort((a, b) => a - b), x2 = P.u2.slice(0, N).map(v => 10 * v), e = [];
      for (let i = 0; i < N; i++) { const z = Math.max(sg, 0.5) * (0.3 + 0.17 * x1[i]) * P.z1[i]; e[i] = i ? 0.6 * e[i - 1] + 0.8 * z : z; }
      const y = x1.map((v, i) => 2 + 1.0 * v + 1.0 * x2[i] + 0.1 * v * v + e[i]);
      return { X: x1.map((v, i) => [1, v, x2[i]]), names: ['1', 'x₁', 'x₂'], y, px: x1, xName: 'x₁', x2, truth: { coef: {}, fn: null, full: { 0: 2, 1: 1, 2: 1, sq: 0.1 } }, focus: [1],
        note: 'y = 2 + 1.0x₁ + 1.0x₂ + 0.1x₁² + ε, with errors whose spread grows with x₁ and that carry over 60% from row to row' }; },
    robust: (P, N, sg, s) => { const x = P.u1.slice(0, N).map(v => 10 * v).sort((a, b) => a - b), y = x.map((v, i) => lin(v) + sg * P.z1[i]), bad = [];
      for (let i = 3; i < N; i += 12) { y[i] += s * (12 + 3 * Math.abs(P.z2[i])); bad.push(i); }
      const k = N - 1; x[k] = 10 + 4 * s; y[k] = lin(10) - 10 * s; bad.push(k);
      return { X: x.map(v => [1, v]), names: ['1', 'x'], y, px: x, xName: 'x', truth: { coef: { 0: 2, 1: 1.5 }, fn: v => lin(v), fnRaw: lin }, focus: [1], flagRows: bad, forceTrain: bad,
        note: `${bad.length} contaminated rows: ${bad.length - 1} pushed far above the line and one far out in x and far below it` }; },
    regularisation: corrFeatures, lambda: corrFeatures, alpha: corrFeatures, otherforms: corrFeatures, penalty: corrFeatures,
    lossfn: (P, N, sg, s) => { const x = P.u1.slice(0, N).map(v => 10 * v).sort((a, b) => a - b), bad = [];
      const y = x.map((v, i) => { let e = sg * P.z1[i]; if (P.u2[i] < 0.12) { e += s * (8 + 4 * Math.abs(P.z2[i])); bad.push(i); } return lin(v) + e; });
      return { X: x.map(v => [1, v]), names: ['1', 'x'], y, px: x, xName: 'x', truth: { coef: { 0: 2, 1: 1.5 }, fn: v => lin(v), fnRaw: lin }, focus: [1], flagRows: bad,
        note: `y = 2 + 1.5x + ε; about 12% of the rows (${bad.length} here) get an extra error of +${num(8 * s, 1)} or more, all upward, so the error distribution is skewed with a long right tail` }; },
    penalisebias: (P, N, sg) => { const x1 = P.u1.slice(0, N).map(v => 10 * v), x2 = P.u2.slice(0, N).map(v => 10 * v), rng = P.rng2(), x3 = x1.map(() => 10 * rng());
      const y = x1.map((v, i) => 50 + 1.5 * v + 1.0 * x2[i] - 0.5 * x3[i] + sg * P.z1[i]);
      return { X: x1.map((v, i) => [1, v, x2[i], x3[i]]), names: ['1', 'x₁', 'x₂', 'x₃'], y, px: x1, xName: 'x₁', x2, truth: { coef: { 0: 50, 1: 1.5, 2: 1.0, 3: -0.5 }, fn: null }, focus: [1], note: 'y = 50 + 1.5x₁ + 1.0x₂ − 0.5x₃ + ε: a large intercept' }; }
  };
  const V = { intin: ['intercept', 'ols'], intorigin: ['intercept', 'origin'],
    mtsimple: ['modeltype', 'simple'], mtmultiple: ['modeltype', 'multiple'], mtpoly: ['modeltype', 'poly'], mtwls: ['modeltype', 'wls'], mtgls: ['modeltype', 'gls'],
    rbols: ['robust', 'ols'], rbhuber: ['robust', 'huber'], rbransac: ['robust', 'ransac'], rbtheil: ['robust', 'theil'], rbquant: ['robust', 'quantile'],
    rgnone: ['regularisation', 'ols'], rgridge: ['regularisation', 'ridge'], rglasso: ['regularisation', 'lasso'], rgenet: ['regularisation', 'enet'],
    lam0: ['lambda', 0], lamsmall: ['lambda', 'small'], lamcv: ['lambda', 'cv'], lamlarge: ['lambda', 'large'], lamhuge: ['lambda', 'huge'],
    alridge: ['alpha', 0], albal: ['alpha', 0.5], allasso: ['alpha', 1],
    pbno: ['penalisebias', 'no'], pbyes: ['penalisebias', 'yes'],
    lfmse: ['lossfn', 'ols'], lfmae: ['lossfn', 'mae'], lfhuber: ['lossfn', 'huber'], lfquant: ['lossfn', 'pinball'], lflogcosh: ['lossfn', 'logcosh'],
    pnnone: ['penalty', 'ols'], pnl2: ['penalty', 'ridge'], pnl1: ['penalty', 'lasso'], pnl1l2: ['penalty', 'enet'],
    ofpcr: ['otherforms', 'pcr'], ofpls: ['otherforms', 'pls'], ofbayes: ['otherforms', 'bayes'] };
  const has = id => !!V[id], attrOf = id => V[id] && V[id][0], kindOf = id => V[id] && V[id][1];
  const data = (id, P, N, sg, s) => DATA[V[id][0]](P, N, sg, s);
  function apply(r, id){
    const [attr, kind] = V[id]; r.mf = { attr, kind }; r.alt = id;
    if (attr === 'modeltype') { const raw = { X: r.X.map(row => [...row]), names: [...r.names] }, others = r.X[0].map((_, j) => j).filter(j => j > 2); r.raw = raw;
      if (kind === 'simple') { r.X = r.X.map(row => [1, row[1], ...others.map(j => row[j])]); r.names = ['1', 'x₁', ...others.map(j => raw.names[j])]; }
      if (kind === 'poly' || kind === 'wls' || kind === 'gls') { r.X = r.X.map(row => [1, row[1], row[2], row[1] * row[1], ...others.map(j => row[j])]); r.names = ['1', 'x₁', 'x₂', 'x₁²', ...others.map(j => raw.names[j])];
        r.truth = Object.assign({}, r.truth, { coef: { 0: 2, 1: 1, 2: 1, 3: 0.1 } }); r.derive = { raw: raw.X.map(row => row[1]), cols: [1, 3], f: v => [v, v * v], axisName: 'x₁' }; }
      if (kind === 'multiple') r.truth = Object.assign({}, r.truth, { coef: {} });
      if (kind === 'simple') r.truth = Object.assign({}, r.truth, { coef: {} });
    }
    if (kind === 'ols' || (attr === 'modeltype' && !['wls', 'gls'].includes(kind))) r.alt = null; // OLS itself: nothing to put next to it
    return r;
  }

  /* ---------- linear-algebra helpers on the standardised design (column 0 = 1) ---------- */
  const T = A => A[0].map((_, j) => A.map(r => r[j])), mul = (A, B) => LA.mul(A, B), mv = (A, v) => LA.mv(A, v);
  const solve = (A, b) => LA.minimizer(A, b).w;
  const ridgeSolve = (X, y, lam, penB = false) => { const A = mul(T(X), X).map((r, i) => r.map((v, j) => v + (i === j && (i > 0 || penB) ? lam : 0))); return { w: solve(A, mv(T(X), y)), A, b: mv(T(X), y) }; };
  /* coordinate descent for elastic net in scikit-learn's form: (1/2n)‖y − Xw‖² + λ(α‖w‖₁ + (1 − α)/2 ‖w‖²); the columns are centred inside each fit, the intercept is not penalised */
  function enet(X, y, lam, alpha, log = false){
    const n = X.length, p = X[0].length - 1, cm = Array.from({ length: p }, (_, k) => mean(X.map(r => r[k + 1]))), ym = mean(y);
    const Z = X.map(r => r.slice(1).map((v, k) => v - cm[k])), yc = y.map(v => v - ym), nrm = Array.from({ length: p }, (_, k) => Z.reduce((s, r) => s + r[k] * r[k], 0) / n);
    const w = new Array(p).fill(0), res = [...yc], hist = [];
    for (let it = 0; it < 2000; it++) { let mx = 0;
      for (let k = 0; k < p; k++) { let rho = 0; for (let i = 0; i < n; i++) rho += Z[i][k] * (res[i] + Z[i][k] * w[k]); rho /= n;
        const nw = Math.sign(rho) * Math.max(0, Math.abs(rho) - lam * alpha) / (nrm[k] + lam * (1 - alpha)), dw = nw - w[k];
        if (log && it < 2) hist.push({ it: it + 1, k: k + 1, rho, nw });
        if (dw) { for (let i = 0; i < n; i++) res[i] -= Z[i][k] * dw; w[k] = nw; } mx = Math.max(mx, Math.abs(dw)); }
      if (mx < 1e-10) { if (log) hist.sweeps = it + 1; break; } }
    return { w: [ym - w.reduce((s, v, k) => s + v * cm[k], 0), ...w], hist };
  }
  const kfold = (n, K = 5) => { const sizes = Array.from({ length: K }, (_, k) => Math.floor(n / K) + (k < n % K ? 1 : 0)), out = []; let s = 0; sizes.forEach(z => { out.push([s, s + z]); s += z; }); return out; }; // like sklearn KFold(5), no shuffle
  function cv(X, y, fitFn, grid){
    const F = kfold(X.length);
    return grid.map(g => { const errs = F.map(([a, b]) => { const tr = X.map((_, i) => i).filter(i => i < a || i >= b), te = X.map((_, i) => i).filter(i => i >= a && i < b), w = fitFn(tr.map(i => X[i]), tr.map(i => y[i]), g);
      return mean(te.map(i => (y[i] - LA.dot(X[i], w)) ** 2)); }); return { g, mse: mean(errs), folds: errs }; });
  }
  const pick = tab => tab.reduce((a, b) => (b.mse < a.mse ? b : a));
  /* iteratively reweighted least squares, for Huber (statsmodels RLM, HuberT c = 1.345, scale = median|e| / 0.6745) and least absolute deviations (median regression) */
  function irls(X, y, weightFn, scaleFn, maxit = 200){
    let w = solve(mul(T(X), X), mv(T(X), y)); const hist = [];
    for (let it = 0; it < maxit; it++) { const r = y.map((v, i) => v - LA.dot(X[i], w)), s = scaleFn(r), wt = r.map(v => weightFn(v, s));
      const A = X[0].map((_, a) => X[0].map((_, b) => X.reduce((t, row, i) => t + wt[i] * row[a] * row[b], 0))), bb = X[0].map((_, a) => X.reduce((t, row, i) => t + wt[i] * row[a] * y[i], 0)), nw = solve(A, bb);
      hist.push({ it: it + 1, s, w: nw, down: wt.filter(t => t < 0.999).length, wt }); const dd = Math.max(...nw.map((v, k) => Math.abs(v - w[k]))); w = nw; if (dd < 1e-9) break; }
    return { w, hist };
  }
  const madScale = r => med(r.map(Math.abs)) / 0.6745; // statsmodels RLM: MAD about 0 of the residuals
  const madC = r => { const m = med(r); return med(r.map(v => Math.abs(v - m))) / 0.6745; };
  /* principal components of the standardised features (the intercept column left out) */
  function pca(Xf){ const n = Xf.length, cm = Xf[0].map((_, k) => mean(Xf.map(r => r[k]))), Zc = Xf.map(r => r.map((v, k) => v - cm[k])), C = mul(T(Zc), Zc).map(r => r.map(v => v / n)), E = LA.eigSym(C); return { vals: E.values, vecs: E.vectors }; } // centred within each fit, like sklearn's PCA
  function plsFit(Xf, y, K){ // NIPALS PLS1 on centred data
    const n = Xf.length, p = Xf[0].length, xm = Array.from({ length: p }, (_, k) => mean(Xf.map(r => r[k]))), ym = mean(y);
    let E = Xf.map(r => r.map((v, k) => v - xm[k])), f = y.map(v => v - ym); const W = [], Pm = [], Q = [], steps = [];
    for (let a = 0; a < K; a++) { let w = Array.from({ length: p }, (_, k) => E.reduce((s, r, i) => s + r[k] * f[i], 0)); const wn = Math.sqrt(w.reduce((s, v) => s + v * v, 0)) || 1; w = w.map(v => v / wn);
      const t = E.map(r => LA.dot(r, w)), tt = t.reduce((s, v) => s + v * v, 0) || 1, pl = Array.from({ length: p }, (_, k) => E.reduce((s, r, i) => s + r[k] * t[i], 0) / tt), q = t.reduce((s, v, i) => s + v * f[i], 0) / tt;
      E = E.map((r, i) => r.map((v, k) => v - t[i] * pl[k])); f = f.map((v, i) => v - q * t[i]); W.push(w); Pm.push(pl); Q.push(q); steps.push({ a: a + 1, w, q, t0: t[0] }); }
    // coefficients B = W (PᵀW)⁻¹ q
    const Wm = T(W), PtW = mul(Pm, Wm), inv = LA.inv(PtW), B = mv(mul(Wm, inv), Q);
    return { B, b0: ym - B.reduce((s, v, k) => s + v * xm[k], 0), steps };
  }

  /* ---------- the alternative fit for a variant ---------- */
  function fit(id, P, d){
    const [attr, kind] = V[id], X = P.Xtr, y = P.ytr, Xte = P.Xte, yte = P.yte, n = X.length, p = X[0].length; let attr2 = attr;
    const out = { id, attr, kind, info: {} };
    const back = w => w.map((v, j) => j === 0 ? w[0] - w.slice(1).reduce((s, wj, k) => s + wj * P.mu[k + 1] / P.sd[k + 1], 0) : v / P.sd[j]);
    let w;
    if (attr === 'intercept') { // through the origin, on the raw x (centring would bring an intercept back)
      const xs = P.tr.map(i => d.X[i]), sxy = xs.reduce((s, r, k) => s + r.slice(1).reduce((t, v) => t + v, 0) * y[k], 0);
      const Xr = xs.map(r => r.slice(1)), A = mul(T(Xr), Xr), b = mv(T(Xr), y), wr = solve(A, b);
      const pr = r => LA.dot(r.slice(1), wr), yh = xs.map(pr), yt = P.te.map(i => pr(d.X[i]));
      out.label = 'regression through the origin'; out.wOrig = [0, ...wr]; out.yhat = yh; out.yhte = yt; out.info = { A, b, wr, sumY: y.reduce((s, v) => s + v, 0), r2u: 1 - y.reduce((s, v, k) => s + (v - yh[k]) ** 2, 0) / y.reduce((s, v) => s + v * v, 0) };
      return finish(out, y, yte);
    }
    if (attr === 'modeltype' && kind === 'wls') { // feasible WLS: model the variance from the OLS residuals, then weight each row by 1 / variance
      const e = P.f.e, Z = X.map(r => [1, r[1]]), lg = e.map(v => Math.log(v * v + 1e-12)), g = solve(mul(T(Z), Z), mv(T(Z), lg)), v2 = Z.map(r => Math.exp(LA.dot(r, g))), wt = v2.map(v => 1 / v);
      const A = X[0].map((_, a) => X[0].map((_, b) => X.reduce((t, row, i) => t + wt[i] * row[a] * row[b], 0))), bb = X[0].map((_, a) => X.reduce((t, row, i) => t + wt[i] * row[a] * y[i], 0));
      w = solve(A, bb); const inv = LA.inv(A), r = y.map((v, i) => v - LA.dot(X[i], w)), s2 = r.reduce((s, v, i) => s + wt[i] * v * v, 0) / (n - p);
      out.label = 'weighted least squares (weights 1 / estimated variance)'; out.info = { g, wt, A, bb, se: inv ? inv.map((row, j) => Math.sqrt(s2 * row[j])) : null };
    }
    if (attr === 'modeltype' && kind === 'gls') { // Prais–Winsten: estimate ρ from the OLS residuals in row order, transform, refit
      const e = P.f.e, rho = e.slice(1).reduce((s, v, i) => s + v * e[i], 0) / e.slice(0, -1).reduce((s, v) => s + v * v, 0), c0 = Math.sqrt(1 - rho * rho);
      const Xs = X.map((r, i) => i ? r.map((v, j) => v - rho * X[i - 1][j]) : r.map(v => c0 * v)), ys = y.map((v, i) => i ? v - rho * y[i - 1] : c0 * v);
      const A = mul(T(Xs), Xs); w = solve(A, mv(T(Xs), ys)); const inv = LA.inv(A), r = ys.map((v, i) => v - LA.dot(Xs[i], w)), s2 = r.reduce((s, v) => s + v * v, 0) / (n - p);
      out.label = 'generalised least squares (AR(1), Prais–Winsten)'; out.info = { rho, Xs, ys, se: inv ? inv.map((row, j) => Math.sqrt(s2 * row[j])) : null };
    }
    if (attr === 'robust') {
      if (kind === 'huber') { const c = 1.345, R = irls(X, y, (r, s) => Math.abs(r / s) <= c ? 1 : c / Math.abs(r / s), madScale); w = R.w; out.label = 'Huber M-estimation (IRLS, c = 1.345)'; out.info = { hist: R.hist, c }; }
      if (kind === 'quantile') { const R = irls(X, y, (r) => 1 / Math.max(Math.abs(r), 1e-6), () => 1, 500); w = R.w; out.label = 'median (least absolute deviations) regression'; out.info = { hist: R.hist }; }
      if (kind === 'theil') { const xs = X.map(r => r[1]), sl = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (xs[j] !== xs[i]) sl.push({ i, j, s: (y[j] - y[i]) / (xs[j] - xs[i]) });
        const s = med(sl.map(t => t.s)), b = med(y.map((v, i) => v - s * xs[i])); w = [b, s]; out.label = 'Theil–Sen (median of pairwise slopes)'; out.info = { pairs: sl.length, sample: sl.slice(0, 6), s, b }; }
      if (kind === 'ransac') { const rng = mulberry32(17), thr = med(y.map(v => Math.abs(v - med(y)))), trials = []; let best = null;
        for (let t = 0; t < 100; t++) { const a = Math.floor(rng() * n); let b2 = Math.floor(rng() * n); if (b2 === a) b2 = (a + 1) % n; const sub = [a, b2];
          const ws = solve(mul(T(sub.map(i => X[i])), sub.map(i => X[i])), mv(T(sub.map(i => X[i])), sub.map(i => y[i]))), inl = y.map((v, i) => Math.abs(v - LA.dot(X[i], ws)) < thr ? i : -1).filter(i => i >= 0);
          if (t < 5) trials.push({ t: t + 1, sub, inl: inl.length }); if (!best || inl.length > best.inl.length) best = { t: t + 1, sub, inl, ws }; }
        const I = best.inl; w = solve(mul(T(I.map(i => X[i])), I.map(i => X[i])), mv(T(I.map(i => X[i])), I.map(i => y[i]))); out.label = 'RANSAC (100 random pairs, refit on the inliers)'; out.info = { thr, trials, best, outl: n - I.length }; }
      if (kind === 'ols') w = P.f.w, out.label = 'ordinary least squares';
    }
    if (attr === 'lossfn') {
      if (kind === 'mae') { const R = irls(X, y, (r) => 1 / Math.max(Math.abs(r), 1e-6), () => 1, 500); w = R.w; out.label = 'MAE loss (least absolute deviations)'; out.info = { hist: R.hist, method: 'quantile' }; }
      if (kind === 'huber') { const c = 1.345, R = irls(X, y, (r, s) => Math.abs(r / s) <= c ? 1 : c / Math.abs(r / s), madScale); w = R.w; out.label = 'Huber loss (c = 1.345, IRLS)'; out.info = { hist: R.hist, c, method: 'huber' }; }
      if (kind === 'pinball') { const q = 0.9, R = irls(X, y, (r) => (r >= 0 ? q : 1 - q) / Math.max(Math.abs(r), 1e-6), () => 1, 500); w = R.w; out.label = 'quantile (pinball) loss, q = 0.9'; out.info = { hist: R.hist, q, method: 'pinball' }; }
      if (kind === 'logcosh') { const R = irls(X, y, (r) => Math.abs(r) < 1e-8 ? 1 : Math.tanh(r) / r, () => 1, 500); w = R.w; out.label = 'log-cosh loss (IRLS)'; out.info = { hist: R.hist, method: 'logcosh' }; }
    }
    if (attr === 'penalty') attr2 = { ridge: 'regularisation', lasso: 'regularisation', enet: 'regularisation' }[kind];
    if (['regularisation', 'lambda', 'alpha', 'penalisebias'].includes(attr2)) {
      const grid = [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000];
      const lgrid = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2];
      const ridgeW = (Xa, ya, l) => ridgeSolve(Xa, ya, l).w;
      if (attr2 === 'regularisation' && kind === 'ols') { w = P.f.w; out.label = 'ordinary least squares (no penalty)'; }
      if ((attr2 === 'regularisation' && kind === 'ridge') || attr === 'lambda' || attr === 'penalisebias') {
        const tab = cv(X, y, ridgeW, grid), best = pick(tab).g;
        const lam = attr === 'lambda' ? { 0: 0, small: 0.1, cv: best, large: 300, huge: 30000 }[kind] : attr === 'penalisebias' ? 10 : best;
        const R = ridgeSolve(X, y, lam, attr === 'penalisebias' && kind === 'yes'); w = R.w;
        out.label = attr === 'penalisebias' ? `ridge, λ = 10, ${kind === 'yes' ? 'intercept penalised too' : 'intercept not penalised'}` : `ridge, λ = ${num(lam, 4)}${kind === 'cv' || attr2 === 'regularisation' ? ' (chosen by 5-fold CV)' : ''}`;
        out.info = { lam, A: R.A, b: R.b, cv: tab, best, path: grid.map(g => ({ g, w: ridgeSolve(X, y, g).w })), method: 'ridge', penB: attr === 'penalisebias' && kind === 'yes' };
      }
      if ((attr2 === 'regularisation' && (kind === 'lasso' || kind === 'enet')) || attr === 'alpha') {
        const al = attr === 'alpha' ? kind : kind === 'lasso' ? 1 : 0.5;
        if (al === 0) { const tab = cv(X, y, ridgeW, grid), best = pick(tab).g, R = ridgeSolve(X, y, best); w = R.w; out.label = `α = 0 (pure ridge), λ = ${num(best, 4)} by CV`; out.info = { lam: best, cv: tab, best, method: 'ridge', A: R.A, b: R.b, path: grid.map(g => ({ g, w: ridgeSolve(X, y, g).w })) }; }
        else { const fn = (Xa, ya, l) => enet(Xa, ya, l, al).w, tab = cv(X, y, fn, lgrid), best = pick(tab).g, R = enet(X, y, best, al, true); w = R.w;
          out.label = `${al === 1 ? 'lasso' : 'elastic net (α = 0.5)'}, λ = ${num(best, 4)} by 5-fold CV`; out.info = { lam: best, alpha: al, cv: tab, best, hist: R.hist, method: al === 1 ? 'lasso' : 'enet', path: lgrid.map(g => ({ g, w: enet(X, y, g, al).w })) }; }
      }
    }
    if (attr === 'otherforms') {
      const Xf = X.map(r => r.slice(1)), pf = Xf[0].length, ym = mean(y);
      if (kind === 'pcr') { const E = pca(Xf), Ks = Array.from({ length: pf }, (_, k) => k + 1);
        const fitK = (Xa, ya, K) => { const Xfa = Xa.map(r => r.slice(1)), Ea = pca(Xfa), V2 = Xfa[0].map((_, k) => Ea.vecs.slice(0, K).map(v => v[k])), Sc = Xfa.map(r => V2[0].map((_, q) => r.reduce((s, v, k) => s + v * V2[k][q], 0))), Zs = Sc.map(r => [1, ...r]), g = solve(mul(T(Zs), Zs), mv(T(Zs), ya));
          return [g[0], ...V2.map(row => row.reduce((s, v, q) => s + v * g[q + 1], 0))]; };
        const tab = cv(X, y, fitK, Ks), K = pick(tab).g; w = fitK(X, y, K);
        out.label = `principal-component regression, ${K} component${K > 1 ? 's' : ''} (chosen by 5-fold CV)`; out.info = { vals: E.vals, vecs: E.vecs, cv: tab, K, explained: E.vals.map(v => v / E.vals.reduce((s, t) => s + t, 0)) }; }
      if (kind === 'pls') { const Ks = Array.from({ length: pf }, (_, k) => k + 1), fitK = (Xa, ya, K) => { const R = plsFit(Xa.map(r => r.slice(1)), ya, K); return [R.b0, ...R.B]; };
        const tab = cv(X, y, fitK, Ks), K = pick(tab).g, R = plsFit(Xf, y, K); w = [R.b0, ...R.B]; out.label = `partial least squares, ${K} component${K > 1 ? 's' : ''} (chosen by 5-fold CV)`; out.info = { cv: tab, K, steps: R.steps }; }
      if (kind === 'bayes') { const tau2 = 1, s2 = P.f.s2, lam = s2 / tau2, R = ridgeSolve(X, y, lam), inv = LA.inv(R.A); w = R.w;
        out.label = `Bayesian linear regression (prior w̃ ~ N(0, ${tau2}), posterior mean)`; out.info = { tau2, s2, lam, A: R.A, b: R.b, sdPost: inv ? inv.map((row, j) => Math.sqrt(s2 * row[j])) : null }; }
    }
    if (!w) return null;
    out.w = w; out.wOrig = back(w); out.yhat = X.map(r => LA.dot(r, w)); out.yhte = Xte.map(r => LA.dot(r, w));
    return finish(out, y, yte);
  }
  function finish(o, y, yte){
    const rm = (a, b) => Math.sqrt(mean(a.map((v, i) => (v - b[i]) ** 2)));
    o.rmseTr = rm(y, o.yhat); o.rmseTe = yte.length ? rm(yte, o.yhte) : NaN; const mt = mean(yte);
    o.r2Te = yte.length > 1 ? 1 - yte.reduce((s, v, i) => s + (v - o.yhte[i]) ** 2, 0) / yte.reduce((s, v) => s + (v - mt) ** 2, 0) : NaN; return o;
  }
  return { has, attrOf, kindOf, data, apply, fit, enet, ridgeSolve, ATTRS: Object.keys(DATA) };
})();
