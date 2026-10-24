/* ============================================================
   Inference: how sure can we be, and what do the numbers mean.
   IN.has(id) / IN.data(id, P, N, σ, s) / IN.apply(r, id, opts)
   IN.run(id, P, d) -> { attr, kind, label, info } with Monte Carlo checks
   (300 fresh datasets of the training size) for coverage, power and SEs.
   ============================================================ */
const IN = (() => {
  const V = {
    cise: ['coefinf', 'se'], citt: ['coefinf', 'ttest'], cici: ['coefinf', 'ci'],
    ftall: ['ftest', 'overall'], ftpart: ['ftest', 'partial'],
    ivconf: ['intervals', 'conf'], ivpred: ['intervals', 'pred'],
    rsclass: ['robustse', 'classical'], rshc: ['robustse', 'hc'], rscl: ['robustse', 'cluster'], rsnw: ['robustse', 'nw'],
    rdraw: ['reading', 'raw'], rdstd: ['reading', 'std'], rdloglog: ['reading', 'loglog'], rdloglin: ['reading', 'loglin'],
    cscorrect: ['causal', 'correct'], csconf: ['causal', 'confounded']
  };
  const has = id => !!V[id], attrOf = id => V[id] && V[id][0], kindOf = id => V[id] && V[id][1];
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length, sdv = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1)); };
  const lin = x => 2 + 1.5 * x;

  function data(id, P, N, sg, s){
    const [attr, kind] = V[id];
    if (attr === 'coefinf' || attr === 'ftest') { const rng = P.rng2(), x1 = P.u1.slice(0, N).map(v => 10 * v), x2 = P.u2.slice(0, N).map(v => 10 * v), x3 = x1.map(() => 10 * rng());
      const y = x1.map((v, i) => 2 + 1.5 * v + 0.3 * x2[i] + 0 * x3[i] + sg * P.z1[i]);
      return { X: x1.map((v, i) => [1, v, x2[i], x3[i]]), names: ['1', 'x₁', 'x₂', 'x₃'], y, px: x1, xName: 'x₁', x2, truth: { coef: { 0: 2, 1: 1.5, 2: 0.3, 3: 0 }, fn: null }, focus: [1],
        note: 'y = 2 + 1.5x₁ + 0.3x₂ + 0·x₃ + ε: one strong effect, one weak effect, and one feature with no effect at all' }; }
    if (attr === 'intervals') { const x = P.u1.slice(0, N).map(v => 10 * v);
      return { X: x.map(v => [1, v]), names: ['1', 'x'], y: x.map((v, i) => lin(v) + sg * P.z1[i]), px: x, xName: 'x', truth: { coef: { 0: 2, 1: 1.5 }, fn: v => lin(v), fnRaw: lin }, focus: [1], note: 'y = 2 + 1.5x + ε' }; }
    if (attr === 'robustse') { const x = P.u1.slice(0, N).map(v => 10 * v).sort((a, b) => a - b), G = 10, group = x.map((_, i) => Math.min(G - 1, Math.floor(i * G / N))), ug = Array.from({ length: G }, (_, g) => P.z3[g]), e = [];
      for (let i = 0; i < N; i++) { const z = P.z1[i];
        e[i] = kind === 'hc' ? sg * (0.15 + 0.3 * x[i]) * z : kind === 'cluster' ? sg * (Math.sqrt(0.7) * ug[group[i]] + Math.sqrt(0.3) * z) : kind === 'nw' ? (i ? 0.8 * e[i - 1] + sg * 0.6 * z : sg * z) : sg * z; }
      const r = { X: x.map(v => [1, v]), names: ['1', 'x'], y: x.map((v, i) => lin(v) + e[i]), px: x, xName: 'x', truth: { coef: { 0: 2, 1: 1.5 }, fn: v => lin(v), fnRaw: lin }, focus: [1],
        note: { classical: 'y = 2 + 1.5x + ε with independent, equal-spread errors; rows in time order', hc: 'y = 2 + 1.5x + ε, error spread growing with x', cluster: 'y = 2 + 1.5x + ε, rows in 10 groups that share a group shock (70% of the error variance)', nw: 'y = 2 + 1.5x + ε, errors carrying 80% over from row to row (rows in time order)' }[kind] };
      if (kind === 'cluster') { r.group = group; r.groupNames = Array.from({ length: G }, (_, g) => 'group ' + (g + 1)); r.groupCol = 'cluster'; }
      return r; }
    if (attr === 'reading') { const x = P.u1.slice(0, N).map(v => 1 + 9 * v);
      if (kind === 'loglog' || kind === 'loglin') { const yraw = x.map((v, i) => Math.exp(kind === 'loglog' ? 0.5 + 0.8 * Math.log(v) + 0.15 * Math.max(sg, 0.3) * P.z1[i] : 0.5 + 0.1 * v * 2 + 0.15 * Math.max(sg, 0.3) * P.z1[i]));
        return { X: x.map(v => [1, v]), names: ['1', 'x'], y: yraw, px: x, xName: 'x', truth: { coef: {}, fn: null }, focus: [1], yRawOrig: yraw,
          note: kind === 'loglog' ? 'y = e^0.5 · x^0.8 · e^ε: ln y = 0.5 + 0.8·ln x + ε, so 1% more x gives about 0.8% more y' : 'y = e^(0.5 + 0.2x + ε): ln y = 0.5 + 0.2x + ε, so each unit of x multiplies y by e^0.2 ≈ 1.22' }; }
      return { X: x.map(v => [1, v]), names: ['1', 'x'], y: x.map((v, i) => lin(v) + sg * P.z1[i]), px: x, xName: 'x', truth: { coef: { 0: 2, 1: 1.5 }, fn: v => lin(v), fnRaw: lin }, focus: [1], note: 'y = 2 + 1.5x + ε, with x between 1 and 10' }; }
    if (attr === 'causal') { const u = P.z2.slice(0, N), x = kind === 'confounded' ? u.map((v, i) => 5 + 2 * v + 1.2 * P.z3[i]) : P.u1.slice(0, N).map(v => 10 * v);
      const y = x.map((v, i) => 2 + 1.0 * v + 3 * u[i] + sg * P.z1[i]);
      return { X: x.map(v => [1, v]), names: ['1', 'x'], y, px: x, xName: 'x', truth: { coef: { 0: 2, 1: 1.0 }, fn: v => 2 + v, fnRaw: v => 2 + v }, focus: [1], confounder: u,
        note: kind === 'confounded' ? 'y = 2 + 1.0x + 3u + ε, where the hidden u also pushes x up (x = 5 + 2u + noise): x and u move together' : 'y = 2 + 1.0x + 3u + ε, with x set at random (independent of the hidden u), as in an experiment' }; }
  }
  function apply(r, id, opts){
    const [attr, kind] = V[id]; r.inf = id; r.genOpts = { variant: id, ...opts };
    if (attr === 'reading' && (kind === 'loglog' || kind === 'loglin')) { // the model is fitted on the log scale; step 12 also scores it back in the units of y
      const raw = r.X.map(rw => rw[1]); r.yRaw = [...r.y]; r.y = r.y.map(Math.log); r.yBack = Math.exp; r.yName = 'ln y';
      if (kind === 'loglog') { r.raw = { X: r.X.map(rw => [...rw]), names: [...r.names] }; r.X = raw.map(v => [1, Math.log(v)]); r.names = ['1', 'ln x']; r.derive = { raw, cols: [1], f: v => [Math.log(v)], axisName: 'x' }; r.truth = { coef: { 0: 0.5, 1: 0.8 }, fn: null, fnRaw: v => 0.5 + 0.8 * Math.log(v) }; }
      else r.truth = { coef: { 0: 0.5, 1: 0.2 }, fn: v => 0.5 + 0.2 * v, fnRaw: v => 0.5 + 0.2 * v };
    }
    return r;
  }

  /* ---------- OLS with every kind of SE, on a raw design (original units) ---------- */
  function olsAll(X, y, group){
    const n = X.length, p = X[0].length, XT = LA.T(X), inv = LA.inv(LA.mul(XT, X)); if (!inv) return null;
    const w = LA.mv(inv, LA.mv(XT, y)), e = y.map((v, i) => v - LA.dot(X[i], w)), sse = e.reduce((s, v) => s + v * v, 0), s2 = sse / (n - p);
    const sand = (M, c) => { const A = LA.mul(LA.mul(inv, M), inv); return A.map((r, j) => Math.sqrt(Math.max(0, c * r[j]))); };
    const outer = (a, b) => a.map(u => b.map(v => u * v)), add = (A, B, k = 1) => A.map((r, i) => r.map((v, j) => v + k * B[i][j]));
    const se = inv.map((r, j) => Math.sqrt(s2 * r[j]));
    let meat = X[0].map(() => new Array(p).fill(0)); X.forEach((x, i) => { meat = add(meat, outer(x, x), e[i] ** 2); });
    const hc = sand(meat, n / (n - p)), Lg = Math.max(1, Math.floor(4 * (n / 100) ** (2 / 9)));
    let S = meat.map(r => [...r]); for (let l = 1; l <= Lg; l++) { const wl = 1 - l / (Lg + 1); for (let t = l; t < n; t++) { const o = outer(X[t], X[t - l]); S = add(S, add(o, LA.T(o)), wl * e[t] * e[t - l]); } }
    const nw = sand(S, n / (n - p)); let cl = null;
    if (group) { const Gm = new Map(); X.forEach((x, i) => { const g = group[i]; if (!Gm.has(g)) Gm.set(g, new Array(p).fill(0)); Gm.set(g, Gm.get(g).map((v, j) => v + x[j] * e[i])); });
      let M = X[0].map(() => new Array(p).fill(0)); Gm.forEach(u => { M = add(M, outer(u, u)); }); const G = Gm.size; cl = G > 1 ? sand(M, G / (G - 1) * (n - 1) / (n - p)) : null; }
    return { w, e, sse, s2, se, hc, nw, cl, inv, n, p, df: n - p, lag: Lg };
  }
  const tCrit = df => ST.tCrit(df), pT = (t, df) => ST.tP2(t, df);

  function run(id, P, d){
    const [attr, kind] = V[id], out = { id, attr, kind, info: {} }, o = d.genOpts || {}, nTr = P.nTr;
    const fresh = r => GEN.generate(id, { N: nTr, sigma: o.sigma ?? 1, strength: o.strength ?? 1, seed: 5000 + r, k: o.k || 1 }), R = 300;
    const Xtr = P.tr.map(i => d.X[i]), ytr = P.ytr, group = d.group ? P.tr.map(i => d.group[i]) : null, F = olsAll(Xtr, ytr, group);
    out.fit = F;
    if (!F) { out.label = 'not available: XᵀX has no inverse'; return out; }
    const tc = tCrit(F.df);
    if (attr === 'coefinf') { const p = F.p, rows = P.names.map((nm, j) => { const t = F.w[j] / F.se[j]; return { nm, w: F.w[j], se: F.se[j], t, p: pT(t, F.df), lo: F.w[j] - tc * F.se[j], hi: F.w[j] + tc * F.se[j], truth: d.truth.coef[j] }; });
      const mc = P.names.map(() => ({ est: [], se: [], rej: 0, cov: 0 })); let used = 0;
      for (let r = 1; r <= R; r++) { const dd = fresh(r), G = olsAll(dd.X, dd.y); if (!G) continue; used++; const tcr = tCrit(G.df);
        P.names.forEach((_, j) => { const m = mc[j]; m.est.push(G.w[j]); m.se.push(G.se[j]); if (Math.abs(G.w[j] / G.se[j]) > tcr) m.rej++; const tr = d.truth.coef[j]; if (tr != null && Math.abs(G.w[j] - tr) <= tcr * G.se[j]) m.cov++; }); }
      out.info = { rows, tc, df: F.df, s2: F.s2, inv: F.inv, mc: mc.map((m, j) => ({ nm: P.names[j], sd: sdv(m.est), meanSE: mean(m.se), rej: m.rej / used, cov: m.cov / used, est: m.est, truth: d.truth.coef[j] })), R: used };
      out.label = { se: 'standard errors from s²(XᵀX)⁻¹', ttest: 't-tests and p-values for every coefficient', ci: '95% confidence intervals for every coefficient' }[kind]; }
    if (attr === 'ftest') { const n = F.n, p = F.p, ybar = mean(ytr), sst = ytr.reduce((s, v) => s + (v - ybar) ** 2, 0), keep = kind === 'overall' ? [0] : [0, 1], q = p - keep.length;
      const Xr = Xtr.map(r => keep.map(j => r[j])), Rf = olsAll(Xr, ytr), sseR = kind === 'overall' ? sst : Rf.sse, Fst = ((sseR - F.sse) / q) / (F.sse / (n - p)), pv = ST.fSF(Fst, q, n - p);
      let rej = 0, used = 0, Fs = []; for (let r = 1; r <= R; r++) { const dd = fresh(r), G = olsAll(dd.X, dd.y); if (!G) continue; const yb = mean(dd.y), sR = kind === 'overall' ? dd.y.reduce((s, v) => s + (v - yb) ** 2, 0) : olsAll(dd.X.map(rw => keep.map(j => rw[j])), dd.y).sse, Fr = ((sR - G.sse) / q) / (G.sse / (G.n - p)); Fs.push(Fr); used++; if (ST.fSF(Fr, q, G.n - p) < 0.05) rej++; }
      out.info = { sst, sseR, sseU: F.sse, q, df2: n - p, F: Fst, p: pv, keep, wR: Rf ? Rf.w : null, rej: rej / used, Fs, R: used, tested: P.names.filter((_, j) => !keep.includes(j)) };
      out.label = kind === 'overall' ? 'overall F-test: are all the slopes zero?' : `partial F-test: are the coefficients of ${P.names.slice(2).join(' and ')} both zero?`; }
    if (attr === 'intervals') { const xs = [0, 2.5, 5, 7.5, 10, 12], pts = xs.map(x0 => { const r = [1, x0], yh = LA.dot(r, F.w), q = LA.dot(r, LA.mv(F.inv, r)), seM = Math.sqrt(F.s2 * q), seP = Math.sqrt(F.s2 * (1 + q)); return { x0, yh, q, seM, seP, ciLo: yh - tc * seM, ciHi: yh + tc * seM, piLo: yh - tc * seP, piHi: yh + tc * seP, truth: lin(x0) }; });
      const cov = xs.map(() => ({ m: 0, p: 0 })); let used = 0; const rng = mulberry32((P.seed || 1) * 811 + 9), g = gaussFn(rng), sg = d.sigmaUsed ?? (o.sigma ?? 1);
      for (let r = 1; r <= R; r++) { const dd = fresh(r), G = olsAll(dd.X, dd.y); if (!G) continue; used++; const tcr = tCrit(G.df);
        xs.forEach((x0, k) => { const rw = [1, x0], yh = LA.dot(rw, G.w), q = LA.dot(rw, LA.mv(G.inv, rw)); if (Math.abs(yh - lin(x0)) <= tcr * Math.sqrt(G.s2 * q)) cov[k].m++; const ynew = lin(x0) + sg * g(); if (Math.abs(ynew - yh) <= tcr * Math.sqrt(G.s2 * (1 + q))) cov[k].p++; }); }
      out.info = { pts, tc, s2: F.s2, inv: F.inv, cov: cov.map(c => ({ m: c.m / used, p: c.p / used })), R: used, xbar: mean(Xtr.map(r => r[1])) };
      out.label = kind === 'conf' ? '95% confidence interval for the mean of y at a new x' : '95% prediction interval for one new y at a new x'; }
    if (attr === 'robustse') { const est = [], ses = { classical: [], hc: [], nw: [], cl: [] }, cov = { classical: 0, hc: 0, nw: 0, cl: 0 }; let used = 0;
      for (let r = 1; r <= R; r++) { const dd = fresh(r), G = olsAll(dd.X, dd.y, dd.group); if (!G) continue; used++; const tcr = tCrit(G.df); est.push(G.w[1]);
        [['classical', G.se], ['hc', G.hc], ['nw', G.nw], ['cl', G.cl]].forEach(([k, s]) => { if (!s) return; ses[k].push(s[1]); if (Math.abs(G.w[1] - 1.5) <= tcr * s[1]) cov[k]++; }); }
      const sdTrue = sdv(est), list = ['classical', 'hc', 'nw', 'cl'].filter(k => ses[k].length).map(k => ({ k, here: k === 'classical' ? F.se[1] : F[k] ? F[k][1] : NaN, mean: mean(ses[k]), cov: cov[k] / used }));
      out.info = { list, sdTrue, est, R: used, lag: F.lag, groups: group ? new Set(group).size : 0, right: { classical: 'classical', hc: 'hc', cluster: 'cl', nw: 'nw' }[kind] };
      out.label = `${{ classical: 'classical', hc: 'heteroscedasticity-robust (HC1)', cluster: 'cluster-robust', nw: 'Newey–West (HAC)' }[kind]} standard errors are the right ones here`; }
    if (attr === 'reading') { const xs = Xtr.map(r => r[1]);
      if (kind === 'raw' || kind === 'std') { const sx = Math.sqrt(mean(xs.map(v => (v - mean(xs)) ** 2))), sy = Math.sqrt(mean(ytr.map(v => (v - mean(ytr)) ** 2)));
        out.info = { w: F.w, sx, sy, wStd: F.w[1] * sx, beta: F.w[1] * sx / sy, x0: 5 }; out.label = kind === 'raw' ? 'reading the slope in raw units' : 'reading the slope per standard deviation'; }
      else { const w = F.w; out.info = { w, x0: kind === 'loglog' ? 4 : 5, back: kind === 'loglog' ? { a: Math.exp(w[0]), b: w[1] } : { a: Math.exp(w[0]), m: Math.exp(w[1]) } }; out.label = kind === 'loglog' ? 'log–log model: the slope is an elasticity' : 'log–linear model: the slope is a growth rate per unit of x'; } }
    if (attr === 'causal') { const u = P.tr.map(i => d.confounder[i]), Xc = Xtr.map((r, k) => [...r, u[k]]), C = olsAll(Xc, ytr);
      const naive = [], ctrl = []; for (let r = 1; r <= R; r++) { const dd = fresh(r), G = olsAll(dd.X, dd.y), H = olsAll(dd.X.map((rw, k) => [...rw, dd.confounder[k]]), dd.y); if (G) naive.push(G.w[1]); if (H) ctrl.push(H.w[1]); }
      const xs = Xtr.map(r => r[1]), cxu = mean(xs.map((v, k) => (v - mean(xs)) * (u[k] - mean(u)))), vx = mean(xs.map(v => (v - mean(xs)) ** 2));
      out.info = { naive: F.w[1], naiveSE: F.se[1], ctrl: C ? C.w[1] : NaN, ctrlSE: C ? C.se[1] : NaN, wu: C ? C.w[2] : NaN, ovb: 3 * cxu / vx, cxu, vx, mcNaive: naive, mcCtrl: ctrl, corrXU: cxu / Math.sqrt(vx * mean(u.map(v => (v - mean(u)) ** 2))) };
      out.label = kind === 'confounded' ? 'the slope read as a causal effect, with a hidden confounder' : 'the slope read as a causal effect, with x assigned at random'; }
    return out;
  }
  return { has, attrOf, kindOf, data, apply, run, V, olsAll };
})();
