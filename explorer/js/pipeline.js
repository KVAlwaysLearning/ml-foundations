/* ============================================================
   A real end-to-end run on the current dataset, used by the
   Process view: clean-up checks, EDA, 80/20 split, standardise
   with train statistics, fit (closed form and gradient descent),
   diagnostics, classical / robust / Newey–West / clustered SEs,
   test metrics, and coefficients back on the original scale.
   ============================================================ */
const PIPE = (() => {
  const skew = a => { const m = ST.mean(a), s2 = ST.mean(a.map(v => (v - m) ** 2)); return s2 > 0 ? ST.mean(a.map(v => (v - m) ** 3)) / s2 ** 1.5 : 0; };
  const corr = (a, b) => { const ma = ST.mean(a), mb = ST.mean(b); let sab = 0, saa = 0, sbb = 0; a.forEach((v, i) => { sab += (v - ma) * (b[i] - mb); saa += (v - ma) ** 2; sbb += (b[i] - mb) ** 2; }); return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN; };
  const outer = (a, b) => a.map(x => b.map(y => x * y));
  const addM = (A, B, k = 1) => A.map((r, i) => r.map((v, j) => v + k * B[i][j]));
  const sandwich = (inv, meat, k) => LA.mul(LA.mul(inv, meat), inv).map(r => r.map(v => v * k));

  function run(d, { seed, ar = false }){
    const N = d.N, P = d.X[0].length, names = d.names;
    const rows = d.X.map((r, i) => [...r.slice(1), d.y[i]]);
    // ---- 2. cleaning checks ----
    const seen = new Map(); let dupes = 0;
    rows.forEach(r => { const k = r.map(v => v.toFixed(9)).join('|'); if (seen.has(k)) dupes++; else seen.set(k, 1); });
    const zcount = col => { const m = ST.mean(col), s = ST.sd(col) || 1; return col.filter(v => Math.abs((v - m) / s) > 3).length; };
    const dupFlag = new Array(N).fill(false), outFlag = new Array(N).fill(false);
    { const s2 = new Set(); rows.forEach((r, i) => { const k = r.map(v => v.toFixed(9)).join('|'); if (s2.has(k)) dupFlag[i] = true; else s2.add(k); }); }
    [d.y, ...d.X[0].slice(1).map((_, k) => d.X.map(r => r[k + 1]))].forEach(col => { const m = ST.mean(col), s = ST.sd(col) || 1; col.forEach((v, i) => { if (Math.abs((v - m) / s) > 3) outFlag[i] = true; }); });
    const cols = names.map((_, j) => d.X.map(r => r[j]));
    const outY = zcount(d.y), outX = cols.slice(1).reduce((s, c) => s + zcount(c), 0);
    // ---- 3. EDA ----
    const eda = {
      skewY: skew(d.y), skewX: cols.slice(1).map(skew),
      corrXY: cols.slice(1).map(c => corr(c, d.y)),
      maxFeatCorr: (() => { let m = 0; for (let a = 1; a < P; a++) for (let b = a + 1; b < P; b++) { const r = Math.abs(corr(cols[a], cols[b])); if (isFinite(r)) m = Math.max(m, r); } return P > 2 ? m : NaN; })()
    };
    // ---- 4. split (random 80/20) ----
    const rng = mulberry32(seed * 131 + 7), order = [...Array(N).keys()];
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const nTr = Math.max(2, Math.round(0.8 * N)), tr = order.slice(0, nTr).sort((a, b) => a - b), te = order.slice(nTr).sort((a, b) => a - b);
    // ---- 5. standardise with train statistics ----
    const mu = [0], sd = [1];
    for (let j = 1; j < P; j++) { const c = tr.map(i => d.X[i][j]); mu.push(ST.mean(c)); const s = Math.sqrt(ST.mean(c.map(v => (v - mu[j]) ** 2))); sd.push(s > 1e-12 ? s : 1); }
    const z = r => r.map((v, j) => j === 0 ? 1 : (v - mu[j]) / sd[j]);
    const Xtr = tr.map(i => z(d.X[i])), ytr = tr.map(i => d.y[i]), Xte = te.map(i => z(d.X[i])), yte = te.map(i => d.y[i]);
    // ---- 6–9. fit ----
    const f = ST.ols(Xtr, ytr), dg = nTr > f.rank + 1 ? ST.diagnostics(Xtr, ytr, f) : null;
    const H = LA.mul(LA.T(Xtr), Xtr).map(r => r.map(v => 2 * v / nTr)), eigH = LA.eigSym(H).values;
    const lim = 2 / eigH[0], eta = 0.2 * lim, XT = LA.T(Xtr);
    let w = new Array(P).fill(0); const iters = [], lossHist = [], wHist = [];
    for (let t = 0; t <= 400; t++) {
      const yh = LA.mv(Xtr, w), e = LA.sub(ytr, yh), L = LA.dot(e, e) / nTr, g = LA.scale(LA.mv(XT, e), -2 / nTr);
      lossHist.push(L); wHist.push([...w]);
      if (t < 4 || t === 400) iters.push({ t, w: [...w], yh0: yh[0], e0: e[0], L, g, gn: LA.norm(g), next: LA.sub(w, LA.scale(g, eta)) });
      w = LA.sub(w, LA.scale(g, eta));
    }
    // ---- 11. standard errors ----
    let hc = null, nw = null, cl = null;
    if (f.inv && f.df > 0) {
      let meat = Xtr[0].map(() => new Array(P).fill(0));
      Xtr.forEach((x, i) => { meat = addM(meat, outer(x, x), f.e[i] ** 2); });
      hc = sandwich(f.inv, meat, nTr / (nTr - P)).map((r, j) => Math.sqrt(Math.max(0, r[j])));
      const Lg = Math.max(1, Math.floor(4 * (nTr / 100) ** (2 / 9)));
      let S = meat.map(r => [...r]);
      for (let l = 1; l <= Lg; l++) { const wl = 1 - l / (Lg + 1);
        for (let t = l; t < nTr; t++) { const o = outer(Xtr[t], Xtr[t - l]); S = addM(S, addM(o, LA.T(o)), wl * f.e[t] * f.e[t - l]); } }
      nw = { se: sandwich(f.inv, S, nTr / (nTr - P)).map((r, j) => Math.sqrt(Math.max(0, r[j]))), lag: Lg };
      if (d.group) {
        const G = new Map(); tr.forEach((i, k) => { const g = d.group[i]; if (!G.has(g)) G.set(g, new Array(P).fill(0)); G.set(g, LA.add(G.get(g), LA.scale(Xtr[k], f.e[k]))); });
        let M = Xtr[0].map(() => new Array(P).fill(0)); G.forEach(u => { M = addM(M, outer(u, u)); });
        const g = G.size; if (g > 1) cl = { se: sandwich(f.inv, M, g / (g - 1) * (nTr - 1) / (nTr - P)).map((r, j) => Math.sqrt(Math.max(0, r[j]))), groups: g };
      }
    }
    // ---- 12. test ----
    const yhte = LA.mv(Xte, f.w), ete = LA.sub(yte, yhte);
    const rmseTe = te.length ? Math.sqrt(LA.dot(ete, ete) / te.length) : NaN;
    const myTe = te.length ? ST.mean(yte) : NaN, sstTe = yte.reduce((s, v) => s + (v - myTe) ** 2, 0);
    const r2Te = te.length > 1 && sstTe > 0 ? 1 - LA.dot(ete, ete) / sstTe : NaN;
    // ---- 13. back to the original scale ----
    const wOrig = f.w.map((v, j) => j === 0 ? f.w[0] - f.w.slice(1).reduce((s, wj, k) => s + wj * mu[k + 1] / sd[k + 1], 0) : v / sd[j]);
    const seOrig = f.se.map((v, j) => j === 0 ? NaN : v / sd[j]), unscale = a => a ? a.map((v, j) => j === 0 ? NaN : v / sd[j]) : null;
    const isTrain = new Array(N).fill(false); tr.forEach(i => isTrain[i] = true);
    return { N, P, names, dupes, outY, outX, eda, nTr, nTe: te.length, mu, sd, Xtr, ytr, Xte, yte, yhte, ete, tr, te, isTrain, dupFlag, outFlag, lossHist, wHist, f, dg, eigH, lim, eta, iters,
      hc: unscale(hc), nw: nw && { se: unscale(nw.se), lag: nw.lag }, cl: cl && { se: unscale(cl.se), groups: cl.groups },
      rmseTr: Math.sqrt(f.SSE / nTr), rmseTe, r2Te, wOrig, seOrig, ar };
  }
  return { run };
})();
