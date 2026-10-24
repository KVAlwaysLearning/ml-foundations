/* ============================================================
   Feature engineering: the datasets each attribute is shown on, and
   the design each variant builds from them in step 5 (learned on the
   training rows only, then applied to every row).
   The raw data (as collected) are kept in r.raw; r.X / r.names become
   the engineered design that every later step uses.
   r.derive tells the charts how to draw a fitted curve against the raw x.
   r.fe holds everything the step-5 explanation needs.
   FE.has(id)  FE.data(id, P, N, sg, s)  FE.apply(r, id, seed)
   ============================================================ */
const FE = (() => {
  const lin = x => 2 + 1.5 * x, SUB = k => String(k).split('').map(ch => '₀₁₂₃₄₅₆₇₈₉'[+ch]).join('');
  const SUP = k => String(k).split('').map(ch => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+ch]).join('');
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length, sdp = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
  /* numpy-style quantile (linear interpolation between order statistics) */
  const quant = (a, q) => { const s = [...a].sort((p, r) => p - r), h = (s.length - 1) * q, lo = Math.floor(h); return s[lo] + (h - lo) * ((s[Math.min(lo + 1, s.length - 1)]) - s[lo]); };
  const skew = a => { const m = mean(a), s = sdp(a); return s > 0 ? mean(a.map(v => ((v - m) / s) ** 3)) : 0; };
  /* Box-Cox and Yeo-Johnson, with λ by maximum likelihood (the same log-likelihood as scipy.stats.boxcox / yeojohnson) */
  const bc = (x, l) => Math.abs(l) < 1e-9 ? Math.log(x) : (x ** l - 1) / l;
  const yj = (x, l) => x >= 0 ? (Math.abs(l) < 1e-9 ? Math.log1p(x) : ((x + 1) ** l - 1) / l) : (Math.abs(l - 2) < 1e-9 ? -Math.log1p(-x) : -(((1 - x) ** (2 - l) - 1) / (2 - l)));
  const varp = a => { const m = mean(a); return mean(a.map(v => (v - m) ** 2)); };
  const llfBC = (x, l) => { const n = x.length; return -n / 2 * Math.log(varp(x.map(v => bc(v, l)))) + (l - 1) * x.reduce((s, v) => s + Math.log(v), 0); };
  const llfYJ = (x, l) => { const n = x.length; return -n / 2 * Math.log(varp(x.map(v => yj(v, l)))) + (l - 1) * x.reduce((s, v) => s + Math.sign(v) * Math.log1p(Math.abs(v)), 0); };
  function argmax(f, lo = -3, hi = 3){ // golden-section search after a coarse grid
    let best = lo, bv = -Infinity; for (let l = lo; l <= hi + 1e-9; l += 0.05) { const v = f(l); if (v > bv) { bv = v; best = l; } }
    let a = best - 0.05, b = best + 0.05; const g = (Math.sqrt(5) - 1) / 2;
    for (let k = 0; k < 80; k++) { const c = b - g * (b - a), d = a + g * (b - a); if (f(c) > f(d)) b = d; else a = c; }
    return (a + b) / 2;
  }
  const sortedX = (P, N) => P.u1.slice(0, N).map(v => 10 * v).sort((a, b) => a - b);
  const one = (x, f, e, extra = {}) => Object.assign({ X: x.map(v => [1, v]), names: ['1', 'x'], y: x.map((v, i) => f(v) + e[i]), px: x, xName: 'x', truth: { coef: {}, fn: (v, i) => f(v), fnRaw: f }, focus: [1] }, extra);

  /* ---------- the dataset each attribute is shown on ---------- */
  const DATA = {
    scaling: (P, N, sg) => { const x1 = P.u1.slice(0, N).map(v => 10 * v), x2 = P.u2.slice(0, N).map(v => 1000 + 4000 * v);
      if (N > 10) x2[N - 1] = 30000; // one very large value of x₂ (it sits on the true plane)
      const y = x1.map((v, i) => 2 + 1.5 * v + 0.002 * x2[i] + sg * P.z1[i]);
      return { X: x1.map((v, i) => [1, v, x2[i]]), names: ['1', 'x₁', 'x₂'], y, px: x1, xName: 'x₁', x2, truth: { coef: { 0: 2, 1: 1.5, 2: 0.002 }, fn: null }, focus: [1, 2],
        note: 'x₁ runs from 0 to 10, x₂ from 1 000 to 5 000 (and one row at 30 000): very different scales' }; },
    xtransform: (P, N, sg) => { const x = P.z2.slice(0, N).map(z => Math.exp(0.9 + 0.7 * z)).sort((a, b) => a - b), f = v => 2 + 3 * Math.log(v);
      return one(x, f, P.z1.map(z => sg * z), { note: 'x is right-skewed (log-normal) and y rises with ln(x)' }); },
    ytransform: (P, N, sg) => { const x = sortedX(P, N), m = 0.15 * Math.max(sg, 0.5), f = v => Math.exp(0.6 + 0.22 * v);
      const r = one(x, f, x.map(() => 0), { note: 'y = e^(0.6 + 0.22x) × multiplicative noise: skewed, and its spread grows with its size', multExtras: true }); r.y = x.map((v, i) => Math.exp(0.6 + 0.22 * v + m * P.z1[i])); return r; },
    degree: (P, N, sg) => { const x = sortedX(P, N), f = v => 2 + 1.5 * v + 0.25 * (v - 5) ** 2 - 0.06 * (v - 5) ** 3; return one(x, f, P.z1.map(z => sg * z), { note: 'the truth is a smooth S-shaped cubic' }); },
    interactions: (P, N, sg) => { const x1 = P.u1.slice(0, N).map(v => 10 * v), x2 = P.u2.slice(0, N).map(v => 10 * v), y = x1.map((v, i) => 2 + 1.5 * v + 1.0 * x2[i] + 0.3 * v * x2[i] + sg * P.z1[i]);
      return { X: x1.map((v, i) => [1, v, x2[i]]), names: ['1', 'x₁', 'x₂'], y, px: x1, xName: 'x₁', x2, truth: { coef: { 0: 2, 1: 1.5, 2: 1.0 }, fn: null, inter: 0.3 }, focus: [1, 2], note: 'y = 2 + 1.5x₁ + 1.0x₂ + 0.3·x₁·x₂ + ε: the effect of x₁ grows with x₂' }; },
    splines: (P, N, sg) => { const x = sortedX(P, N), f = v => 2 + 8 * (1 - Math.exp(-v / 3)); return one(x, f, P.z1.map(z => sg * 0.6 * z), { note: 'y rises fast and then levels off' }); },
    binning: (P, N, sg) => { const x = P.u1.slice(0, N).map(v => 10 * v * v).sort((a, b) => a - b), f = v => 2 + 10 / (1 + Math.exp(-1.8 * (v - 4))); return one(x, f, P.z1.map(z => sg * 0.6 * z), { note: 'x is bunched near 0 (10·u²); y jumps around x = 4' }); },
    encoding: (P, N, sg) => { const x = P.u1.slice(0, N).map(v => 10 * v), g = P.u2.slice(0, N).map(v => Math.min(3, Math.floor(4 * v))), eff = [0, 3, -2, 5], lv = ['East', 'North', 'South', 'West'];
      return { X: x.map(v => [1, v]), names: ['1', 'x'], y: x.map((v, i) => lin(v) + eff[g[i]] + sg * P.z1[i]), px: x, xName: 'x', group: g, groupNames: lv.map((l, q) => q ? l : l + ' (reference)'),
        rawCat: { name: 'region', levels: lv, ref: 'East', keepAll: false, vals: g.map(q => lv[q]) }, truth: { coef: {}, fn: null, byGroup: eff.map(e => v => lin(v) + e) }, focus: [1], eff }; },
    centering: (P, N, sg) => { const x = P.u1.slice(0, N).map(v => 20 + 10 * v).sort((a, b) => a - b), f = v => 2 + 1.5 * (v - 25) + 0.2 * (v - 25) ** 2; return one(x, f, P.z1.map(z => sg * z), { note: 'x lies between 20 and 30, far from 0, and y curves gently' }); },
    selection: (P, N, sg) => { const rng = P.rng2(), u = () => 10 * rng(), x1 = P.u1.slice(0, N).map(v => 10 * v), x2 = P.u2.slice(0, N).map(v => 10 * v), x3 = x1.map(u), x4 = x1.map(u), x5 = x1.map((v, i) => v + 0.3 * P.z2[i]);
      const noise = [0, 1, 2, 3, 4].map(() => x1.map(u)), beta = [1.5, 1.0, -0.8, 0.5, 0, 0, 0, 0, 0, 0];
      const X = x1.map((v, i) => [1, v, x2[i], x3[i], x4[i], x5[i], ...noise.map(c => c[i])]), y = X.map((r, i) => 2 + r.slice(1).reduce((s, t, k) => s + beta[k] * t, 0) + sg * P.z1[i]);
      const coef = { 0: 2 }; beta.forEach((b, k) => coef[k + 1] = b);
      return { X, names: ['1', 'x₁', 'x₂', 'x₃', 'x₄', 'x₅', 'n₁', 'n₂', 'n₃', 'n₄', 'n₅'], y, px: x1, xName: 'x₁', truth: { coef, fn: null }, focus: [1], note: '4 useful features (x₁–x₄), x₅ ≈ a copy of x₁, and 5 noise columns n₁–n₅' }; }
  };
  /* variant → attribute and what it builds */
  const V = { scnone: ['scaling', 'none'], scstd: ['scaling', 'std'], scminmax: ['scaling', 'minmax'], scrobust: ['scaling', 'robust'],
    xtnone: ['xtransform', 'none'], xtlog: ['xtransform', 'log'], xtsqrt: ['xtransform', 'sqrt'], xtboxcox: ['xtransform', 'boxcox'], xtyj: ['xtransform', 'yj'],
    ytnone: ['ytransform', 'none'], ytlog: ['ytransform', 'log'], ytboxcox: ['ytransform', 'boxcox'],
    deg1: ['degree', 1], deg2: ['degree', 2], deg3: ['degree', 3], deg5: ['degree', 5], deg10: ['degree', 10],
    intnone: ['interactions', 'none'], intx: ['interactions', 'x'], spnone: ['splines', 0], sp1: ['splines', 1], spmany: ['splines', 3],
    binnone: ['binning', 'none'], binwidth: ['binning', 'width'], binquant: ['binning', 'quantile'],
    encoh: ['encoding', 'onehot'], encall: ['encoding', 'keepall'], encord: ['encoding', 'ordinal'], enctarget: ['encoding', 'target'],
    cenraw: ['centering', 'raw'], cencent: ['centering', 'centred'],
    selall: ['selection', 'all'], selfwd: ['selection', 'forward'], selbwd: ['selection', 'backward'], selstep: ['selection', 'stepwise'], sellasso: ['selection', 'lasso'], selvif: ['selection', 'vif'], selp: ['selection', 'pvalue'] };
  const has = id => !!V[id], attrOf = id => V[id] && V[id][0], kindOf = id => V[id] && V[id][1];
  const data = (id, P, N, sg, s) => DATA[V[id][0]](P, N, sg, s);

  /* ---------- small OLS helpers for selection (on the training rows, original units) ---------- */
  const fitCols = (r, tr, cols) => ST.ols(tr.map(i => [1, ...cols.map(j => r.X[i][j])]), tr.map(i => r.y[i]));
  const pvals = (r, tr, cols) => { const f = fitCols(r, tr, cols); return cols.map((j, k) => ({ j, p: f.pv ? f.pv[k + 1] : NaN, t: f.t ? f.t[k + 1] : NaN, w: f.w[k + 1] })); };
  const vifs = (r, tr, cols) => cols.map(j => { const o = cols.filter(q => q !== j); if (!o.length) return { j, vif: 1, r2: 0 }; const g = ST.ols(tr.map(i => [1, ...o.map(q => r.X[i][q])]), tr.map(i => r.X[i][j]), true), r2 = 1 - g.SSE / g.SST; return { j, r2, vif: r2 < 1 - 1e-12 ? 1 / (1 - r2) : Infinity }; });
  function lassoCV(r, tr){ // standardised coordinate descent, λ chosen by 5-fold CV on the training rows
    const cols = r.X[0].map((_, j) => j).slice(1), Z = (idx, mu, sd) => idx.map(i => cols.map((j, k) => (r.X[i][j] - mu[k]) / sd[k]));
    const fit = (idx, lam) => { const mu = cols.map(j => mean(idx.map(i => r.X[i][j]))), sd = cols.map((j, k) => sdp(idx.map(i => r.X[i][j])) || 1), X = Z(idx, mu, sd), yv = idx.map(i => r.y[i]), my = mean(yv), n = idx.length, p = cols.length, w = cols.map(() => 0);
      const res = yv.map(v => v - my); // residuals for w = 0; each coordinate update keeps them current
      for (let it = 0; it < 500; it++) { let mx = 0;
        for (let k = 0; k < p; k++) { let rho = 0; for (let i = 0; i < n; i++) rho += X[i][k] * (res[i] + X[i][k] * w[k]); rho /= n;
          const nw = Math.sign(rho) * Math.max(0, Math.abs(rho) - lam), dw = nw - w[k]; if (dw !== 0) { for (let i = 0; i < n; i++) res[i] -= X[i][k] * dw; w[k] = nw; } mx = Math.max(mx, Math.abs(dw)); }
        if (mx < 1e-8) break; }
      return { w, mu, sd, my, predict: i => my + cols.reduce((s, j, k) => s + w[k] * (r.X[i][j] - mu[k]) / sd[k], 0) }; };
    const lams = [2, 1.2, 0.8, 0.5, 0.3, 0.2, 0.12, 0.08, 0.05, 0.03, 0.01], K = 5, folds = tr.map((_, k) => k % K);
    const cv = lams.map(l => { let se = 0; for (let f = 0; f < K; f++) { const a = tr.filter((_, k) => folds[k] !== f), b = tr.filter((_, k) => folds[k] === f), m = fit(a, l); se += b.reduce((s, i) => s + (r.y[i] - m.predict(i)) ** 2, 0); } return se / tr.length; });
    const best = lams[cv.indexOf(Math.min(...cv))], m = fit(tr, best);
    return { lams, cv, best, w: m.w, cols, keep: cols.filter((j, k) => Math.abs(m.w[k]) > 1e-9) };
  }
  function select(r, tr, kind){
    const all = r.X[0].map((_, j) => j).slice(1), path = [];
    if (kind === 'all') return { keep: all, path: [{ step: 'keep every column', cols: all }] };
    if (kind === 'pvalue') { const pv = pvals(r, tr, all); path.push({ step: 'fit with every column; drop every column with p > 0.05 at once', table: pv }); const k = pv.filter(t => t.p <= 0.05).map(t => t.j); return { keep: k.length ? k : [pv.reduce((a, b) => (b.p < a.p ? b : a)).j], path }; }
    if (kind === 'backward') { let cur = [...all]; for (;;) { const pv = pvals(r, tr, cur), worst = pv.reduce((a, b) => (b.p > a.p ? b : a)); path.push({ step: `fit with ${cur.length} columns; largest p = ${num(worst.p, 3)} (${r.names[worst.j]})`, table: pv, drop: worst.p > 0.05 ? worst.j : null }); if (!(worst.p > 0.05) || cur.length === 1) break; cur = cur.filter(j => j !== worst.j); } return { keep: cur, path }; }
    if (kind === 'forward' || kind === 'stepwise') { let cur = []; for (let guard = 0; guard < 20; guard++) { const cand = all.filter(j => !cur.includes(j)).map(j => { const pv = pvals(r, tr, [...cur, j]); return { j, p: pv[pv.length - 1].p }; }); if (!cand.length) break; const b = cand.reduce((a, c) => (c.p < a.p ? c : a));
        path.push({ step: `try adding each remaining column; smallest p = ${num(b.p, 4)} (${r.names[b.j]})`, cand, add: b.p < 0.05 ? b.j : null }); if (!(b.p < 0.05)) break; cur.push(b.j);
        if (kind === 'stepwise') { const pv = pvals(r, tr, cur), w = pv.reduce((a, c) => (c.p > a.p ? c : a)); if (w.p > 0.10 && w.j !== b.j) { path.push({ step: `after adding, ${r.names[w.j]} has p = ${num(w.p, 3)} > 0.10: remove it`, remove: w.j }); cur = cur.filter(j => j !== w.j); } } }
      return { keep: cur.length ? cur.sort((a, b) => a - b) : [all[0]], path }; }
    if (kind === 'vif') { let cur = [...all]; for (;;) { const v = vifs(r, tr, cur), w = v.reduce((a, b) => (b.vif > a.vif ? b : a)); path.push({ step: `largest VIF = ${isFinite(w.vif) ? num(w.vif, 2) : '∞'} (${r.names[w.j]})`, table: v, drop: w.vif > 5 ? w.j : null }); if (!(w.vif > 5) || cur.length === 1) break; cur = cur.filter(j => j !== w.j); } return { keep: cur, path }; }
    if (kind === 'lasso') { const L = lassoCV(r, tr); path.push({ step: `λ chosen by 5-fold cross-validation on the training rows: ${L.best}`, lasso: L }); return { keep: L.keep.length ? L.keep : [all[0]], path, lasso: L }; }
  }

  /* ---------- build the design in step 5 ---------- */
  function apply(r, id, seed){
    const [attr, kind] = V[id], N = r.y.length, tr = PIPE.splitIdx(N, seed, r).tr, raw = { X: r.X.map(row => [...row]), names: [...r.names], y: [...r.y] };
    r.raw = raw; r.fe = { attr, kind, tr };
    const replace = (cols, names, derive) => { r.X = r.X.map((row, i) => cols(row, i)); r.names = names; if (derive) r.derive = derive; };
    const others = r.X[0].map((_, j) => j).filter(j => j > 1); // extra features from the slider stay as they are
    if (attr === 'scaling') { r.scale = kind; return r; }
    if (attr === 'xtransform') {
      const xs = raw.X.map(row => row[1]), xt = tr.map(i => xs[i]);
      if (kind === 'none') { r.derive = { raw: xs, cols: [1], f: v => [v] }; return r; }
      let fn, nm, lam = null;
      if (kind === 'log') { fn = v => Math.log(v); nm = 'ln x'; }
      if (kind === 'sqrt') { fn = v => Math.sqrt(v); nm = '√x'; }
      if (kind === 'boxcox') { lam = argmax(l => llfBC(xt, l)); fn = v => bc(v, lam); nm = 'bc(x)'; }
      if (kind === 'yj') { lam = argmax(l => llfYJ(xt, l)); fn = v => yj(v, lam); nm = 'yj(x)'; }
      Object.assign(r.fe, { lam, nm, fn, skewBefore: skew(xt), skewAfter: skew(xt.map(fn)), grid: kind === 'boxcox' || kind === 'yj' ? [-1, -0.5, 0, 0.5, 1, 1.5].map(l => ({ l, ll: (kind === 'boxcox' ? llfBC : llfYJ)(xt, l) })) : null });
      replace(row => [1, fn(row[1]), ...others.map(j => row[j])], ['1', nm, ...others.map(j => raw.names[j])], { raw: xs, cols: [1], f: v => [fn(v)] });
      return r;
    }
    if (attr === 'ytransform') {
      r.derive = { raw: raw.X.map(row => row[1]), cols: [1], f: v => [v] };
      if (kind === 'none') return r;
      const yt = tr.map(i => raw.y[i]); let fn, back, lam = null;
      if (kind === 'log') { fn = v => Math.log(v); back = v => Math.exp(v); }
      else { lam = argmax(l => llfBC(yt, l)); fn = v => bc(v, lam); back = v => Math.abs(lam) < 1e-9 ? Math.exp(v) : Math.max(0, lam * v + 1) ** (1 / lam); }
      Object.assign(r.fe, { lam, fn, back, skewBefore: skew(yt), skewAfter: skew(yt.map(fn)), grid: lam != null ? [-1, -0.5, 0, 0.5, 1].map(l => ({ l, ll: llfBC(yt, l) })) : null, yName: kind === 'log' ? 'ln y' : 'bc(y)' });
      r.yRaw = raw.y; r.y = raw.y.map(fn); r.yBack = back; r.yName = r.fe.yName;
      const f0 = r.truth.fnRaw; if (f0) { r.truth = Object.assign({}, r.truth, { fn: (v, i) => fn(f0(raw.X[i] ? raw.X[i][1] : v)), fnRaw: v => fn(f0(v)) }); }
      return r;
    }
    if (attr === 'degree') {
      // powers of z = (x − mean) / sd (training rows), the usual practice: powers of a raw x far from 0 are numerically almost collinear
      const d = kind, xs = raw.X.map(row => row[1]), pw = Array.from({ length: d }, (_, k) => k + 1), xt = tr.map(i => xs[i]), m = mean(xt), sd = sdp(xt) || 1, z = v => (v - m) / sd;
      r.fe.zm = m; r.fe.zs = sd;
      replace(row => [1, ...pw.map(k => z(row[1]) ** k), ...others.map(j => row[j])], ['1', ...pw.map(k => k === 1 ? 'z' : 'z' + SUP(k)), ...others.map(j => raw.names[j])], { raw: xs, cols: pw.map(k => k), f: v => pw.map(k => z(v) ** k), axisName: 'x' });
      return r;
    }
    if (attr === 'interactions') {
      const m2 = mean(tr.map(i => raw.X[i][2]));
      if (kind === 'none') { r.derive = { raw: raw.X.map(row => row[1]), cols: [1], f: v => [v], axisName: 'x₁' }; return r; }
      replace(row => [...row, row[1] * row[2]], [...raw.names, 'x₁·x₂'], { raw: raw.X.map(row => row[1]), cols: [1, raw.names.length], f: v => [v, v * m2], axisName: 'x₁' });
      r.truth = Object.assign({}, r.truth, { coef: Object.assign({}, r.truth.coef, { [raw.names.length]: r.truth.inter }) });
      return r;
    }
    if (attr === 'splines') {
      const xs = raw.X.map(row => row[1]), knots = kind === 0 ? [] : kind === 1 ? [5] : [2.5, 5, 7.5], h = (v, k) => Math.max(0, v - k);
      r.fe.knots = knots;
      replace(row => [1, row[1], ...knots.map(k => h(row[1], k)), ...others.map(j => row[j])], ['1', 'x', ...knots.map((k, q) => 'h' + SUB(q + 1)), ...others.map(j => raw.names[j])], { raw: xs, cols: [1, ...knots.map((_, q) => 2 + q)], f: v => [v, ...knots.map(k => h(v, k))] });
      return r;
    }
    if (attr === 'binning') {
      const xs = raw.X.map(row => row[1]);
      if (kind === 'none') { r.derive = { raw: xs, cols: [1], f: v => [v] }; return r; }
      const xt = tr.map(i => xs[i]), lo = Math.min(...xt), hi = Math.max(...xt), B = 5;
      const edges = kind === 'width' ? Array.from({ length: B + 1 }, (_, k) => lo + (hi - lo) * k / B) : Array.from({ length: B + 1 }, (_, k) => quant(xt, k / B));
      const bin = v => { let b = 0; for (let k = 1; k < B; k++) if (v >= edges[k]) b = k; return b; };
      r.fe.edges = edges; r.fe.counts = Array.from({ length: B }, (_, b) => xt.filter(v => bin(v) === b).length); r.fe.bin = bin;
      replace(row => [1, ...Array.from({ length: B - 1 }, (_, k) => +(bin(row[1]) === k + 1)), ...others.map(j => row[j])], ['1', ...Array.from({ length: B - 1 }, (_, k) => 'bin_' + (k + 2)), ...others.map(j => raw.names[j])],
        { raw: xs, cols: Array.from({ length: B - 1 }, (_, k) => k + 1), f: v => Array.from({ length: B - 1 }, (_, k) => +(bin(v) === k + 1)) });
      return r;
    }
    if (attr === 'encoding') {
      const rc = r.rawCat, g = r.group, L = rc.levels.length;
      if (kind === 'onehot' || kind === 'keepall') { const lv = kind === 'keepall' ? [0, 1, 2, 3] : [1, 2, 3], cat = {};
        lv.forEach((q, k) => { cat[2 + k] = q; });
        replace((row, i) => [1, row[1], ...lv.map(q => +(g[i] === q)), ...others.map(j => row[j])], ['1', raw.names[1], ...lv.map(q => `region_${rc.levels[q]}`), ...others.map(j => raw.names[j])]);
        r.cat = cat; rc.keepAll = kind === 'keepall'; rc.ref = kind === 'keepall' ? null : rc.levels[0];
        const coef = { 1: 1.5 }; if (kind === 'onehot') { coef[0] = 2; lv.forEach((q, k) => coef[2 + k] = r.eff[q]); } r.truth = Object.assign({}, r.truth, { coef });
        r.groupNames = rc.levels.map((l, q) => kind === 'keepall' || q ? l : l + ' (reference)');
        return r; }
      if (kind === 'ordinal') { r.fe.codes = rc.levels.map((l, q) => [l, q]);
        replace((row, i) => [1, row[1], g[i], ...others.map(j => row[j])], ['1', raw.names[1], 'code(region)', ...others.map(j => raw.names[j])]); return r; }
      if (kind === 'target') { const m = rc.levels.map((_, q) => { const ys = tr.filter(i => g[i] === q).map(i => raw.y[i]); return ys.length ? mean(ys) : mean(tr.map(i => raw.y[i])); });
        r.fe.means = m; r.fe.counts = rc.levels.map((_, q) => tr.filter(i => g[i] === q).length);
        replace((row, i) => [1, row[1], m[g[i]], ...others.map(j => row[j])], ['1', raw.names[1], 'te(region)', ...others.map(j => raw.names[j])]); return r; }
    }
    if (attr === 'centering') {
      const xs = raw.X.map(row => row[1]), c = kind === 'centred' ? mean(tr.map(i => xs[i])) : 0; r.fe.c = c; r.scale = 'none';
      replace(row => [1, row[1] - c, (row[1] - c) ** 2, ...others.map(j => row[j])], ['1', kind === 'centred' ? 'xc' : 'x', kind === 'centred' ? 'xc²' : 'x²', ...others.map(j => raw.names[j])], { raw: xs, cols: [1, 2], f: v => [v - c, (v - c) ** 2] });
      return r;
    }
    if (attr === 'selection') {
      const S = select(r, tr, kind); r.fe.sel = S;
      const keep = S.keep, coef = { 0: 2 }; keep.forEach((j, k) => { if (raw.names[j] && r.truth.coef[j] != null) coef[k + 1] = r.truth.coef[j]; });
      replace(row => [1, ...keep.map(j => row[j])], ['1', ...keep.map(j => raw.names[j])]);
      r.truth = Object.assign({}, r.truth, { coef: keep.every(j => j <= 10) && [1, 2, 3, 4].every(j => keep.includes(j)) ? coef : {} });
      r.focus = [1]; r.px = r.X.map(row => row[1]); r.xName = r.names[1];
      return r;
    }
    return r;
  }
  /* scaling statistics used in step 5 (location and scale per column) */
  function scaleStats(col, kind){
    if (kind === 'none') return [0, 1];
    if (kind === 'minmax') { const lo = Math.min(...col), hi = Math.max(...col); return [lo, hi - lo > 1e-12 ? hi - lo : 1]; }
    if (kind === 'robust') { const q1 = quant(col, 0.25), q3 = quant(col, 0.75); return [quant(col, 0.5), q3 - q1 > 1e-12 ? q3 - q1 : 1]; }
    const m = mean(col), s = sdp(col); return [m, s > 1e-12 ? s : 1];
  }
  /* aux columns: built from another column in step 5 (not features you can pick on their own) */
  const isAux = nm => typeof nm === 'string' && (/^[xz][²³⁴⁵⁶⁷⁸⁹¹⁰]+$/.test(nm) || /^h[₀-₉]+$/.test(nm) || nm.startsWith('bin_') || nm === 'x₁·x₂' || nm === 'xc²');
  return { has, attrOf, kindOf, data, apply, scaleStats, isAux, quant, bc, yj, llfBC, llfYJ, skew, ATTRS: Object.keys(DATA) };
})();
