/* ============================================================
   Validation protocol: the same data and model, a different way of
   estimating how well the model will do on new rows.
   VP.has(id) / VP.data(id, P, N, σ, s) / VP.apply(r, id, opts)
   VP.run(id, P, d) -> { attr, kind, label, info } recorded for the worked
   examples, the charts and the Python.
   ============================================================ */
const VP = (() => {
  const V = {
    sp8020: ['split', 0.8], sp7030: ['split', 0.7], sp5050: ['split', 0.5], sptiny: ['split', 'tiny'],
    cvnone: ['cv', 'none'], cvkfold: ['cv', 'kfold'], cvloo: ['cv', 'loo'], cvts: ['cv', 'ts'], cvnested: ['cv', 'nested'],
    sdfixed: ['seed', 'fixed'], sdvaried: ['seed', 'varied']
  };
  const has = id => !!V[id], attrOf = id => V[id] && V[id][0], kindOf = id => V[id] && V[id][1];
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length, sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1)); };
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y), i = p * (s.length - 1), lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };
  const lin = x => 2 + 1.5 * x, curve = x => 2 + 1.5 * x + 0.25 * (x - 5) ** 2;

  function data(id, P, N, sg){
    const attr = V[id][0];
    if (attr === 'cv') { const x = P.u1.slice(0, N).map(v => 10 * v).sort((a, b) => a - b);
      return { X: x.map(v => [1, v]), names: ['1', 'x'], y: x.map((v, i) => curve(v) + sg * P.z1[i]), px: x, xName: 'x', truth: { coef: {}, fn: v => curve(v), fnRaw: curve }, focus: [1],
        note: 'y = 2 + 1.5x + 0.25(x − 5)² + ε, rows in time order (x grows with time); the model is still a straight line unless a degree is chosen' }; }
    const x = P.u1.slice(0, N).map(v => 10 * v);
    return { X: x.map(v => [1, v]), names: ['1', 'x'], y: x.map((v, i) => lin(v) + sg * P.z1[i]), px: x, xName: 'x', truth: { coef: { 0: 2, 1: 1.5 }, fn: v => lin(v), fnRaw: lin }, focus: [1], note: 'y = 2 + 1.5x + ε' };
  }
  function apply(r, id, opts){
    const [attr, kind] = V[id]; r.val = id; r.genOpts = { variant: id, ...opts };
    if (attr === 'split') r.splitFrac = kind === 'tiny' ? Math.max(0.5, 1 - 5 / r.y.length) : kind;
    return r;
  }

  /* ---------- small fitting helpers on raw designs ---------- */
  const T_ = A => A[0].map((_, j) => A.map(r => r[j]));
  const ols = (X, y) => LA.minimizer(LA.mul(T_(X), X), LA.mv(T_(X), y)).w;
  const mse = (X, y, w) => mean(X.map((r, i) => (y[i] - LA.dot(r, w)) ** 2));
  /* polynomial design in the standardised x of the fitting rows (as sklearn's StandardScaler + PolynomialFeatures) */
  const polyFit = (xs, ys, deg) => { const m = mean(xs), s = Math.sqrt(mean(xs.map(v => (v - m) ** 2))) || 1, row = v => { const z = (v - m) / s; return Array.from({ length: deg + 1 }, (_, k) => z ** k); }, w = ols(xs.map(row), ys); return { w, pred: v => LA.dot(row(v), w), m, s }; };
  const kfold = (n, K) => { const sizes = Array.from({ length: K }, (_, k) => Math.floor(n / K) + (k < n % K ? 1 : 0)), out = []; let s = 0; sizes.forEach(z => { out.push([s, s + z]); s += z; }); return out; };

  function run(id, P, d){
    const [attr, kind] = V[id], out = { id, attr, kind, info: {} }, N = d.y.length, Xall = d.X, yall = d.y;
    const Xtr = P.tr.map(i => Xall[i]), ytr = P.ytr, n = Xtr.length;
    /* the "true" error: the fitted model scored on 2 000 fresh rows from the same process */
    let trueRmse = NaN, fresh = null; try { const o = d.genOpts || {}; fresh = GEN.generate(o.variant || id, { N: 2000, sigma: o.sigma ?? 1, strength: o.strength ?? 1, seed: (o.seed || 1) + 7777, k: o.k || 1 });
      trueRmse = Math.sqrt(mse(fresh.X, fresh.y, P.wOrig)); } catch (err) { trueRmse = NaN; }
    out.trueRmse = trueRmse;
    if (attr === 'split' || attr === 'seed') {
      const frac = attr === 'split' ? (d.splitFrac || 0.8) : 0.8, S = 200, res = [];
      for (let s = 1; s <= S; s++) { const sp = PIPE.splitIdx(N, s, { splitFrac: frac }), Xa = sp.tr.map(i => Xall[i]), ya = sp.tr.map(i => yall[i]), w = ols(Xa, ya);
        res.push({ seed: s, nTr: sp.tr.length, nTe: sp.te.length, w, rmseTe: Math.sqrt(mse(sp.te.map(i => Xall[i]), sp.te.map(i => yall[i]), w)), rmseTr: Math.sqrt(mse(Xa, ya, w)) }); }
      const r = res.map(t => t.rmseTe), sl = res.map(t => t.w[1]);
      out.info = { frac, S, res, mean: mean(r), sd: sd(r), q05: q(r, 0.05), q95: q(r, 0.95), slMean: mean(sl), slSd: sd(sl), slQ05: q(sl, 0.05), slQ95: q(sl, 0.95), nTe: res[0].nTe, nTr: res[0].nTr, this: { rmseTe: P.rmseTe, slope: P.wOrig[1], seed: P.seed } };
      out.label = attr === 'split' ? `${Math.round(frac * 100)}/${100 - Math.round(frac * 100)} split: ${res[0].nTr} training rows, ${res[0].nTe} test rows` : kind === 'fixed' ? 'one fixed random split (seed of this sample)' : `the same 80/20 split repeated with 200 different seeds`;
      return out;
    }
    /* cv: always on the training rows; the test rows stay untouched */
    const xs = Xtr.map(r => r[1]);
    const foldsOf = k => k === 'loo' ? Array.from({ length: n }, (_, i) => [i, i + 1]) : kfold(n, 5);
    const cvScore = (fit, folds, list = false) => { const per = folds.map(([a, b]) => { const tr = [...Array(n).keys()].filter(i => i < a || i >= b), te = [...Array(n).keys()].filter(i => i >= a && i < b), m = fit(tr, te);
      return { a, b, nFit: tr.length, nVal: te.length, ...m }; }); return { per, mse: mean(per.map(t => t.mse)) }; };
    const olsFit = (tr, te) => { const w = ols(tr.map(i => Xtr[i]), tr.map(i => ytr[i])); return { w, mse: mse(te.map(i => Xtr[i]), te.map(i => ytr[i]), w) }; };
    if (kind === 'none') { out.label = 'no cross-validation: one train/test split'; out.info = { single: P.rmseTe ** 2 }; }
    if (kind === 'kfold') { const C = cvScore(olsFit, foldsOf('kfold')); out.label = '5-fold cross-validation on the training rows'; out.info = { C, K: 5 }; }
    if (kind === 'loo') { const C = cvScore(olsFit, foldsOf('loo')), w = ols(Xtr, ytr), inv = LA.inv(LA.mul(T_(Xtr), Xtr)), h = Xtr.map(r => LA.dot(r, LA.mv(inv, r))), e = ytr.map((v, i) => v - LA.dot(Xtr[i], w));
      out.label = 'leave-one-out cross-validation (n folds of one row)'; out.info = { C, h, e, press: mean(e.map((v, i) => (v / (1 - h[i])) ** 2)) }; }
    if (kind === 'ts') { const K = 5, ts = Math.floor(n / (K + 1)), folds = Array.from({ length: K }, (_, k) => { const end = n - (K - k) * ts; return [end, end + ts]; });
      const per = folds.map(([a, b]) => { const tr = [...Array(a).keys()], te = [...Array(b - a).keys()].map(i => a + i), m = olsFit(tr, te); return { a, b, nFit: tr.length, nVal: te.length, ...m }; });
      const kf = cvScore(olsFit, foldsOf('kfold'));
      out.label = 'time-series split: 5 expanding windows, always validating on later rows'; out.info = { C: { per, mse: mean(per.map(t => t.mse)) }, ts, kf: kf.mse }; }
    if (kind === 'nested') { const degs = [1, 2, 3, 4, 5], outer = kfold(n, 5), rows = [];
      const polyCV = (idx, deg) => { const F = kfold(idx.length, 5); return mean(F.map(([a, b]) => { const tr = idx.filter((_, k) => k < a || k >= b), te = idx.filter((_, k) => k >= a && k < b), f = polyFit(tr.map(i => xs[i]), tr.map(i => ytr[i]), deg); return mean(te.map(i => (ytr[i] - f.pred(xs[i])) ** 2)); })); };
      outer.forEach(([a, b], o) => { const tr = [...Array(n).keys()].filter(i => i < a || i >= b), te = [...Array(n).keys()].filter(i => i >= a && i < b), inner = degs.map(dg => polyCV(tr, dg)), best = degs[inner.indexOf(Math.min(...inner))];
        const f = polyFit(tr.map(i => xs[i]), tr.map(i => ytr[i]), best); rows.push({ o: o + 1, a, b, inner, best, outerMse: mean(te.map(i => (ytr[i] - f.pred(xs[i])) ** 2)) }); });
      const all = [...Array(n).keys()], flat = degs.map(dg => polyCV(all, dg)), bestFlat = degs[flat.indexOf(Math.min(...flat))];
      let trueSel = NaN; if (fresh) { const f = polyFit(xs, ytr, bestFlat); trueSel = Math.sqrt(mean(fresh.X.map((r, i) => (fresh.y[i] - f.pred(r[1])) ** 2))); }
      out.trueSel = trueSel;
      out.label = 'nested CV: an inner 5-fold CV picks the degree (1–5), an outer 5-fold CV scores that whole procedure'; out.info = { rows, degs, flat, bestFlat, flatBest: Math.min(...flat), nestedMse: mean(rows.map(t => t.outerMse)) }; }
    /* the degree curve, for every cv variant (what CV is usually used to choose) */
    out.info.degCurve = [1, 2, 3, 4, 5].map(dg => ({ dg, cv: mean(kfold(n, 5).map(([a, b]) => { const tr = [...Array(n).keys()].filter(i => i < a || i >= b), te = [...Array(n).keys()].filter(i => i >= a && i < b), f = polyFit(tr.map(i => xs[i]), tr.map(i => ytr[i]), dg); return mean(te.map(i => (ytr[i] - f.pred(xs[i])) ** 2)); })) }));
    out.estimate = kind === 'none' ? P.rmseTe : Math.sqrt(kind === 'nested' ? out.info.nestedMse : out.info.C.mse);
    return out;
  }
  return { has, attrOf, kindOf, data, apply, run, V };
})();
