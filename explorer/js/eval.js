/* ============================================================
   Evaluation: how good is a model, and why. One feature x, a gently
   curved truth, polynomial models of different degree (and ridge),
   scored on training, validation and test rows.
   EV.has(id) / EV.data(id, P, N, σ, s) / EV.apply(r, id, opts)
   EV.run(id, P, d) -> { attr, kind, label, info, curve(x) }
   ============================================================ */
const EV = (() => {
  const V = {
    mtmse: ['metric', 'mse'], mtrmse: ['metric', 'rmse'], mtmae: ['metric', 'mae'], mtmape: ['metric', 'mape'], mtr2: ['metric', 'r2'], mtadjr2: ['metric', 'adjr2'], mtaic: ['metric', 'aic'], mtbic: ['metric', 'bic'],
    ttgood: ['traintest', 'good'], ttover: ['traintest', 'over'], ttunder: ['traintest', 'under'],
    lcbias: ['learningcurve', 'bias'], lcvar: ['learningcurve', 'var'], lcgood: ['learningcurve', 'good'],
    vcdeg: ['validationcurve', 'deg'], vclam: ['validationcurve', 'lam'],
    bvdecomp: ['biasvariance', 'decomp']
  };
  const has = id => !!V[id], attrOf = id => V[id] && V[id][0], kindOf = id => V[id] && V[id][1];
  const FIXED_N = { ttgood: 20, ttover: 20, ttunder: 20, lcbias: 100, lcvar: 100, lcgood: 100, vcdeg: 60, vclam: 60, bvdecomp: 30 };
  const DEG = { ttgood: 2, ttover: 10, ttunder: 1, lcbias: 1, lcvar: 10, lcgood: 2 };
  const truthF = x => 2 + 1.5 * x + 0.45 * (x - 5) ** 2;
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;

  function data(id, P, N, sg){
    const x = P.u1.slice(0, N).map(v => 1 + 9 * v);
    return { X: x.map(v => [1, v]), names: ['1', 'x'], y: x.map((v, i) => truthF(v) + sg * P.z1[i]), px: x, xName: 'x', truth: { coef: {}, fn: v => truthF(v), fnRaw: truthF }, focus: [1],
      note: 'y = 2 + 1.5x + 0.45(x − 5)² + ε with x between 1 and 10: a gentle curve, so a straight line is too simple and a high-degree polynomial too flexible' };
  }
  const apply = (r, id, opts) => { r.ev = id; r.genOpts = { variant: id, ...opts }; return r; };

  /* ---------- polynomial models in the standardised x of the fitting rows (StandardScaler → PolynomialFeatures → LinearRegression / Ridge) ---------- */
  function polyFit(xs, ys, deg, lam = 0){
    const m = mean(xs), s = Math.sqrt(mean(xs.map(v => (v - m) ** 2))) || 1, row = v => { const z = (v - m) / s; return Array.from({ length: deg + 1 }, (_, k) => z ** k); };
    const X = xs.map(row), A = LA.mul(LA.T(X), X).map((r, i) => r.map((v, j) => v + (i === j && i > 0 ? lam : 0))), w = LA.minimizer(A, LA.mv(LA.T(X), ys)).w;
    return { w, m, s, deg, pred: v => LA.dot(row(v), w) };
  }
  const mseOf = (f, xs, ys) => mean(xs.map((v, i) => (ys[i] - f.pred(v)) ** 2));
  const kfold = (n, K = 5) => { const sizes = Array.from({ length: K }, (_, k) => Math.floor(n / K) + (k < n % K ? 1 : 0)), out = []; let s = 0; sizes.forEach(z => { out.push([s, s + z]); s += z; }); return out; };
  const cvIdx = n => kfold(n).map(([a, b]) => ({ tr: [...Array(n).keys()].filter(i => i < a || i >= b), te: [...Array(n).keys()].filter(i => i >= a && i < b) }));
  /* metrics; p = number of coefficients incl. the intercept */
  function metrics(y, yh, p, nFit){
    const n = y.length, e = y.map((v, i) => v - yh[i]), sse = e.reduce((s, v) => s + v * v, 0), ybar = mean(y), sst = y.reduce((s, v) => s + (v - ybar) ** 2, 0);
    const out = { mse: sse / n, rmse: Math.sqrt(sse / n), mae: mean(e.map(Math.abs)), mape: 100 * mean(e.map((v, i) => Math.abs(v / y[i]))), r2: 1 - sse / sst };
    out.adjr2 = 1 - (1 - out.r2) * (n - 1) / (n - p);
    const llf = -n / 2 * (Math.log(2 * Math.PI) + Math.log(sse / n) + 1); out.llf = llf; out.aic = -2 * llf + 2 * p; out.bic = -2 * llf + Math.log(n) * p; out.sse = sse; out.sst = sst;
    return out;
  }

  function run(id, P, d){
    const [attr, kind] = V[id], out = { id, attr, kind, info: {} }, xtr = P.tr.map(i => d.X[i][1]), ytr = P.ytr, xte = P.te.map(i => d.X[i][1]), yte = P.yte, n = xtr.length;
    if (attr === 'metric') { const degs = [1, 2, 3, 4, 5], rows = degs.map(dg => { const f = polyFit(xtr, ytr, dg), tr = metrics(ytr, xtr.map(f.pred), dg + 1), te = metrics(yte, xte.map(f.pred), dg + 1); return { dg, f, tr, te }; });
      const onTrain = ['adjr2', 'aic', 'bic'].includes(kind), better = kind === 'r2' || kind === 'adjr2' ? 'max' : 'min', vals = rows.map(r => (onTrain ? r.tr : r.te)[kind]);
      const pick = degs[vals.indexOf(better === 'max' ? Math.max(...vals) : Math.min(...vals))];
      out.info = { degs, rows, onTrain, better, pick, vals, worked: metrics(onTrain ? ytr : yte, (onTrain ? xtr : xte).map(rows[0].f.pred), 2), wy: onTrain ? ytr : yte, wyh: (onTrain ? xtr : xte).map(rows[0].f.pred) };
      out.label = `${({ mse: 'MSE', rmse: 'RMSE', mae: 'MAE', mape: 'MAPE', r2: 'R²', adjr2: 'adjusted R²', aic: 'AIC', bic: 'BIC' })[kind]} ${onTrain ? 'on the training rows' : 'on the test rows'}, for polynomials of degree 1–5`;
      out.curve = rows[pick - 1].f.pred; out.curveLabel = `degree ${pick}, the choice of this metric`; }
    if (attr === 'traintest') { const dg = DEG[id], f = polyFit(xtr, ytr, dg), all = [1, 2, 3, 5, 8, 10].map(k => { const g = polyFit(xtr, ytr, k); return { dg: k, tr: Math.sqrt(mseOf(g, xtr, ytr)), te: Math.sqrt(mseOf(g, xte, yte)) }; });
      out.info = { dg, f, tr: Math.sqrt(mseOf(f, xtr, ytr)), te: Math.sqrt(mseOf(f, xte, yte)), all, p: dg + 1, nTr: n };
      out.label = `polynomial of degree ${dg} (${dg + 1} coefficients for ${n} training rows)`; out.curve = f.pred; out.curveLabel = `degree ${dg}`; }
    if (attr === 'learningcurve') { const dg = DEG[id], folds = cvIdx(n), nMax = folds[0].tr.length, sizes = [...new Set([0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1].map(fr => Math.floor(fr * nMax)))].filter(s => s > dg + 1);
      const pts = sizes.map(sz => { const per = folds.map(F => { const fit = F.tr.slice(0, sz), f = polyFit(fit.map(i => xtr[i]), fit.map(i => ytr[i]), dg); return { tr: mseOf(f, fit.map(i => xtr[i]), fit.map(i => ytr[i])), va: mseOf(f, F.te.map(i => xtr[i]), F.te.map(i => ytr[i])) }; });
        return { sz, tr: mean(per.map(t => t.tr)), va: mean(per.map(t => t.va)), per }; });
      const f = polyFit(xtr, ytr, dg); out.info = { dg, sizes, pts, nMax, sigma2: (d.sigmaUsed ?? 1) ** 2 };
      out.label = `learning curve of a degree-${dg} polynomial (5-fold CV on the training rows)`; out.curve = f.pred; out.curveLabel = `degree ${dg}`; }
    if (attr === 'validationcurve') { const folds = cvIdx(n);
      const grid = kind === 'deg' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [1e-4, 1e-3, 1e-2, 0.1, 1, 10, 100, 1000];
      const pts = grid.map(g => { const per = folds.map(F => { const f = polyFit(F.tr.map(i => xtr[i]), F.tr.map(i => ytr[i]), kind === 'deg' ? g : 10, kind === 'deg' ? 0 : g); return { tr: mseOf(f, F.tr.map(i => xtr[i]), F.tr.map(i => ytr[i])), va: mseOf(f, F.te.map(i => xtr[i]), F.te.map(i => ytr[i])) }; });
        return { g, tr: mean(per.map(t => t.tr)), va: mean(per.map(t => t.va)), per }; });
      const best = pts.reduce((a, b) => (b.va < a.va ? b : a)), f = polyFit(xtr, ytr, kind === 'deg' ? best.g : 10, kind === 'deg' ? 0 : best.g);
      out.info = { grid, pts, best, testRmse: Math.sqrt(mseOf(f, xte, yte)) };
      out.label = kind === 'deg' ? 'validation curve over the polynomial degree 1–10 (5-fold CV)' : 'validation curve over the ridge λ for a degree-10 polynomial (5-fold CV)';
      out.curve = f.pred; out.curveLabel = kind === 'deg' ? `degree ${best.g}, chosen by the curve` : `degree 10 with ridge λ = ${best.g}`; }
    if (attr === 'biasvariance') { const o = d.genOpts || {}, R = 200, degs = [1, 2, 6], grid = Array.from({ length: 19 }, (_, k) => 1 + 0.5 * k), sg = d.sigmaUsed ?? (o.sigma ?? 1);
      const preds = degs.map(() => grid.map(() => [])), sample = [];
      for (let r = 1; r <= R; r++) { const dd = GEN.generate(id, { N: d.y.length, sigma: o.sigma ?? 1, strength: o.strength ?? 1, seed: 1000 + r, k: 1 }), xs = dd.X.map(rw => rw[1]);
        degs.forEach((dg, q) => { const f = polyFit(xs, dd.y, dg); grid.forEach((x0, k) => preds[q][k].push(f.pred(x0))); if (r <= 20) (sample[q] = sample[q] || []).push(f); }); }
      const rows = degs.map((dg, q) => { const bias2 = mean(grid.map((x0, k) => (mean(preds[q][k]) - truthF(x0)) ** 2)), variance = mean(grid.map((x0, k) => { const m = mean(preds[q][k]); return mean(preds[q][k].map(t => (t - m) ** 2)); }));
        return { dg, bias2, variance, noise: sg * sg, total: bias2 + variance + sg * sg, at: grid.map((x0, k) => ({ x0, mean: mean(preds[q][k]), sd: Math.sqrt(mean(preds[q][k].map(t => (t - mean(preds[q][k])) ** 2))), truth: truthF(x0) })) }; });
      out.info = { R, degs, grid, rows, sample, sigma: sg, N: d.y.length };
      out.label = `bias–variance decomposition: degrees 1, 2 and 6, each fitted to ${R} fresh datasets of ${d.y.length} rows`; out.curve = null; }
    return out;
  }
  return { has, attrOf, kindOf, data, apply, run, V, FIXED_N, polyFit, metrics, truthF };
})();
