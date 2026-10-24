/* ============================================================
   Diagnostics: the same OLS fit, checked one way at a time.
   Each attribute has data with the problem its checks look for
   (the Strength slider sets how strong it is), and each variant
   computes one plot or test from first principles, on the
   training rows in original units, the way statsmodels / SciPy do.
   DG.has(id) / DG.data(id, P, N, σ, s) / DG.apply(r, id)
   DG.run(id, P, d) -> { attr, kind, label, info }
   ============================================================ */
const DG = (() => {
  const V = {
    rpfit: ['residplots', 'fitted'], rpqq: ['residplots', 'qq'], rpscale: ['residplots', 'scale'], rplev: ['residplots', 'leverage'],
    inlev: ['influence', 'leverage'], instud: ['influence', 'student'], incook: ['influence', 'cook'], indffits: ['influence', 'dffits'], indfbetas: ['influence', 'dfbetas'],
    ltreset: ['lintest', 'reset'], ltcpr: ['lintest', 'cpr'],
    vtbp: ['vartest', 'bp'], vtwhite: ['vartest', 'white'], vtgq: ['vartest', 'gq'],
    itdw: ['indtest', 'dw'], itlb: ['indtest', 'lb'],
    ntsw: ['normtest', 'sw'], ntjb: ['normtest', 'jb'], ntad: ['normtest', 'ad'],
    ctvif: ['colltest', 'vif'], ctcond: ['colltest', 'cond'], ctcorr: ['colltest', 'corr']
  };
  const has = id => !!V[id], attrOf = id => V[id] && V[id][0], kindOf = id => V[id] && V[id][1];
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length, lin = x => 2 + 1.5 * x;

  /* ---------- normal distribution: Φ (erfc, |error| < 1.2e-7) and Φ⁻¹ (Acklam + one Newton step) ---------- */
  function erfc(x){ const z = Math.abs(x), t = 1 / (1 + 0.5 * z), r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
  const Phi = x => 0.5 * erfc(-x / Math.SQRT2);
  function PhiInv(p){ const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239], b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1], c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
    let x; if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else if (p > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else { const q = p - 0.5, r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
    const e = Phi(x) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2); return x - u / (1 + x * u / 2); }

  function data(id, P, N, sg, s){
    const attr = V[id][0], x = P.u1.slice(0, N).map(v => 10 * v).sort((a, b) => a - b), z = P.z1, out = { names: ['1', 'x'], px: x, xName: 'x', focus: [1], truth: { coef: { 0: 2, 1: 1.5 }, fn: v => lin(v), fnRaw: lin } };
    if (attr === 'residplots') { const f = v => lin(v) + 0.12 * s * (v - 5) ** 2, xx = [...x]; xx[N - 1] = 10 + 4 * s; const y = xx.map((v, i) => f(v) + sg * (1 + s * (0.12 * v - 0.6)) * z[i]);
      return Object.assign(out, { X: xx.map(v => [1, v]), y, px: xx, truth: { coef: {}, fn: v => f(v), fnRaw: f }, flagRows: [N - 1], forceTrain: [N - 1], note: `y = 2 + 1.5x + ${(0.12 * s).toFixed(2)}(x − 5)² + ε, error spread growing with x, and the last row far out at x = ${(10 + 4 * s).toFixed(1)}: a little of everything for the residual plots to show` }); }
    if (attr === 'influence') { const xx = [...x], y = xx.map((v, i) => lin(v) + sg * z[i]), mid = Math.floor(N / 2); y[mid] += 6 * Math.max(sg, 0.5) * s; xx[N - 1] = 10 + 6 * s; y[N - 1] = lin(xx[N - 1]) - 8 * Math.max(sg, 0.5) * s;
      return Object.assign(out, { X: xx.map(v => [1, v]), y, px: xx, flagRows: [mid, N - 1], forceTrain: [mid, N - 1], note: `y = 2 + 1.5x + ε; row ${mid + 1} is pushed up (an outlier in y with ordinary x) and the last row sits far out at x = ${(10 + 6 * s).toFixed(1)} and far below the line (high leverage and an outlier)` }); }
    if (attr === 'lintest') { const f = v => lin(v) + 0.25 * s * (v - 5) ** 2; return Object.assign(out, { X: x.map(v => [1, v]), y: x.map((v, i) => f(v) + sg * z[i]), truth: { coef: {}, fn: v => f(v), fnRaw: f }, note: `y = 2 + 1.5x + ${(0.25 * s).toFixed(2)}(x − 5)² + ε: a curve fitted with a straight line` }); }
    if (attr === 'vartest') return Object.assign(out, { X: x.map(v => [1, v]), y: x.map((v, i) => lin(v) + sg * ((1 - s) + s * (0.15 + 0.3 * v)) * z[i]), note: `y = 2 + 1.5x + ε with error spread σ·(${(1 - s).toFixed(2)} + ${s.toFixed(2)}·(0.15 + 0.3x)): it grows with x` });
    if (attr === 'indtest') { const rho = 0.7 * s, e = []; for (let i = 0; i < N; i++) e[i] = i ? rho * e[i - 1] + Math.sqrt(1 - rho * rho) * sg * z[i] : sg * z[i];
      return Object.assign(out, { X: x.map(v => [1, v]), y: x.map((v, i) => lin(v) + e[i]), note: `y = 2 + 1.5x + ε, rows in time order, εₜ = ${rho.toFixed(2)}·εₜ₋₁ + new noise` }); }
    if (attr === 'normtest') return Object.assign(out, { X: x.map(v => [1, v]), y: x.map((v, i) => lin(v) + sg * ((1 - s) * z[i] + s * (P.ex[i] - 1))), note: `y = 2 + 1.5x + ε with ε = σ·(${(1 - s).toFixed(2)}·z + ${s.toFixed(2)}·(exponential − 1)): skewed to the right` });
    if (attr === 'colltest') { const x2 = x.map((v, i) => 5 + 0.95 * (v - 5) + (0.15 + 2 * (1 - s)) * P.z2[i]), x3 = P.u2.slice(0, N).map(v => 10 * v);
      return Object.assign(out, { X: x.map((v, i) => [1, v, x2[i], x3[i]]), names: ['1', 'x₁', 'x₂', 'x₃'], y: x.map((v, i) => 2 + 1.5 * v + 1.0 * x2[i] + 0.5 * x3[i] + sg * z[i]), xName: 'x₁', x2, truth: { coef: { 0: 2, 1: 1.5, 2: 1.0, 3: 0.5 }, fn: null }, note: 'y = 2 + 1.5x₁ + 1.0x₂ + 0.5x₃ + ε, where x₂ is x₁ plus a little noise (r close to 1) and x₃ is independent' }); }
  }
  const apply = (r, id) => { r.dgv = id; return r; };

  /* ---------- OLS with the pieces every diagnostic needs ---------- */
  function fitAll(X, y){
    const n = X.length, p = X[0].length, XT = LA.T(X), inv = LA.inv(LA.mul(XT, X)); if (!inv) return null;
    const w = LA.mv(inv, LA.mv(XT, y)), yh = X.map(r => LA.dot(r, w)), e = y.map((v, i) => v - yh[i]), sse = e.reduce((s, v) => s + v * v, 0), s2 = sse / (n - p), ybar = mean(y), sst = y.reduce((s, v) => s + (v - ybar) ** 2, 0);
    return { n, p, w, yh, e, sse, s2, sst, r2: 1 - sse / sst, inv, h: X.map(r => LA.dot(r, LA.mv(inv, r))) };
  }
  const aux = (Z, t) => { const g = fitAll(Z, t); return g; };

  /* Shapiro–Wilk by Royston (1995), as in SciPy's swilk */
  function shapiro(xs){
    const x = [...xs].sort((a, b) => a - b), n = x.length, m = Array.from({ length: n }, (_, i) => PhiInv((i + 1 - 0.375) / (n + 0.25))), mm = m.reduce((s, v) => s + v * v, 0), u = 1 / Math.sqrt(n), c = m.map(v => v / Math.sqrt(mm));
    const a = new Array(n).fill(0), an = c[n - 1] + 0.221157 * u - 0.147981 * u ** 2 - 2.071190 * u ** 3 + 4.434685 * u ** 4 - 2.706056 * u ** 5;
    let phi;
    if (n > 5) { const an1 = c[n - 2] + 0.042981 * u - 0.293762 * u ** 2 - 1.752461 * u ** 3 + 5.682633 * u ** 4 - 3.582633 * u ** 5; phi = (mm - 2 * m[n - 1] ** 2 - 2 * m[n - 2] ** 2) / (1 - 2 * an ** 2 - 2 * an1 ** 2);
      for (let i = 2; i < n - 2; i++) a[i] = m[i] / Math.sqrt(phi); a[n - 1] = an; a[n - 2] = an1; a[0] = -an; a[1] = -an1; }
    else { phi = (mm - 2 * m[n - 1] ** 2) / (1 - 2 * an ** 2); for (let i = 1; i < n - 1; i++) a[i] = m[i] / Math.sqrt(phi); a[n - 1] = an; a[0] = -an; }
    const xb = mean(x), ss = x.reduce((s, v) => s + (v - xb) ** 2, 0), num_ = a.reduce((s, ai, i) => s + ai * x[i], 0), W = num_ * num_ / ss;
    let mu, sgm, yv; const ln = Math.log(n);
    if (n >= 12) { yv = Math.log(1 - W); mu = 0.0038915 * ln ** 3 - 0.083751 * ln ** 2 - 0.31082 * ln - 1.5861; sgm = Math.exp(0.0030302 * ln ** 2 - 0.082676 * ln - 0.4803); }
    else { const gma = 0.459 * n - 2.273; yv = -Math.log(gma - Math.log(1 - W)); mu = 0.5440 - 0.39978 * n + 0.025054 * n ** 2 - 0.0006714 * n ** 3; sgm = Math.exp(1.3822 - 0.77857 * n + 0.062767 * n ** 2 - 0.0020322 * n ** 3); }
    const zz = (yv - mu) / sgm; return { W, p: 1 - Phi(zz), a, m, x, ss, num: num_, z: zz, mu, sgm, yv };
  }
  function anderson(xs){
    const n = xs.length, xb = mean(xs), s = Math.sqrt(xs.reduce((t, v) => t + (v - xb) ** 2, 0) / (n - 1)), w = [...xs].sort((a, b) => a - b).map(v => (v - xb) / s), z = w.map(Phi);
    let S = 0; const terms = []; for (let i = 0; i < n; i++) { const t = (2 * (i + 1) - 1) / n * (Math.log(z[i]) + Math.log(1 - z[n - 1 - i])); S += t; if (i < 6) terms.push({ i: i + 1, w: w[i], z: z[i], zr: z[n - 1 - i], t }); }
    const A2 = -n - S, A2a = A2 * (1 + 0.75 / n + 2.25 / n ** 2);
    const p = A2a < 0.2 ? 1 - Math.exp(-13.436 + 101.14 * A2a - 223.73 * A2a ** 2) : A2a < 0.34 ? 1 - Math.exp(-8.318 + 42.796 * A2a - 59.938 * A2a ** 2) : A2a < 0.6 ? Math.exp(0.9177 - 4.279 * A2a - 1.38 * A2a ** 2) : A2a <= 13 ? Math.exp(1.2937 - 5.709 * A2a + 0.0186 * A2a ** 2) : 0;
    return { A2, A2a, p, S, terms, xb, s };
  }
  const bins = (x, v, B = 8) => { const idx = [...x.keys()].sort((a, b) => x[a] - x[b]), n = x.length, out = []; for (let b = 0; b < B; b++) { const s = idx.slice(Math.floor(b * n / B), Math.floor((b + 1) * n / B)); if (s.length) out.push([mean(s.map(i => x[i])), mean(s.map(i => v[i]))]); } return out; };

  function run(id, P, d){
    const [attr, kind] = V[id], out = { id, attr, kind, info: {} }, X = P.tr.map(i => d.X[i]), y = P.ytr, F = fitAll(X, y);
    if (!F) { out.label = 'not available: XᵀX has no inverse'; return out; }
    const { n, p, e, h, s2 } = F; out.fit = F;
    const r = e.map((v, i) => v / Math.sqrt(s2 * (1 - h[i])));                           // internally studentised
    const s2i = e.map((v, i) => ((n - p) * s2 - v * v / (1 - h[i])) / (n - p - 1)), t = e.map((v, i) => v / Math.sqrt(s2i[i] * (1 - h[i])));   // externally studentised
    const cook = r.map((v, i) => v * v * h[i] / (p * (1 - h[i]))), dffits = t.map((v, i) => v * Math.sqrt(h[i] / (1 - h[i])));
    const dfbetas = X.map((xi, i) => { const c = LA.mv(F.inv, xi); return c.map((cj, j) => cj * e[i] / (1 - h[i]) / Math.sqrt(s2i[i] * F.inv[j][j])); });
    const common = { r, t, cook, h, s2i, dffits, dfbetas, x: X.map(rw => rw[1]) };
    if (attr === 'residplots') {
      const order = [...e.keys()].sort((a, b) => r[a] - r[b]), theo = order.map((_, k) => PhiInv((k + 1) / (n + 1)));
      out.info = Object.assign(common, { method: kind, smoothFit: bins(F.yh, e), smoothScale: bins(F.yh, r.map(v => Math.sqrt(Math.abs(v)))), qq: order.map((i, k) => ({ i, theo: theo[k], r: r[i] })) });
      out.label = { fitted: 'residuals against fitted values', qq: 'normal Q–Q plot of the standardised residuals', scale: 'scale–location plot: √|standardised residual| against fitted', leverage: 'residuals against leverage, with Cook’s distance contours' }[kind]; }
    if (attr === 'influence') { const thr = { leverage: 2 * p / n, student: 2, cook: 4 / n, dffits: 2 * Math.sqrt(p / n), dfbetas: 2 / Math.sqrt(n) }[kind];
      const val = { leverage: h, student: t, cook, dffits, dfbetas: dfbetas.map(rw => rw[1]) }[kind], flag = val.map((v, i) => Math.abs(v) > thr ? i : -1).filter(i => i >= 0);
      const top = [...val.keys()].sort((a, b) => Math.abs(val[b]) - Math.abs(val[a]))[0], keep = X.map((_, i) => i).filter(i => i !== top), G = fitAll(keep.map(i => X[i]), keep.map(i => y[i]));
      out.info = Object.assign(common, { method: kind, thr, val, flag, top, refit: G ? G.w : null });
      out.label = { leverage: 'leverage hᵢᵢ (diagonal of the hat matrix)', student: 'studentised residuals (externally, row left out)', cook: 'Cook’s distance', dffits: 'DFFITS', dfbetas: 'DFBETAS for the slope' }[kind] + `, threshold ${num(thr, 3)}`; }
    if (attr === 'lintest') {
      if (kind === 'reset') { const Z = X.map((rw, i) => [...rw, F.yh[i] ** 2, F.yh[i] ** 3]), U = fitAll(Z, y), q = 2, Fs = ((F.sse - U.sse) / q) / (U.sse / (n - p - q));
        out.info = Object.assign(common, { method: 'reset', U, q, F: Fs, df2: n - p - q, p: ST.fSF(Fs, q, n - p - q) }); out.label = 'Ramsey RESET: do ŷ² and ŷ³ add anything?'; }
      else { const comp = X.map(rw => F.w[1] * rw[1]), cpr = comp.map((v, i) => v + e[i]); out.info = Object.assign(common, { method: 'cpr', comp, cpr, smooth: bins(X.map(rw => rw[1]), cpr) }); out.label = 'component-plus-residual plot for x'; } }
    if (attr === 'vartest') { const e2 = e.map(v => v * v);
      if (kind === 'bp' || kind === 'white') { const Z = kind === 'bp' ? X : X.map(rw => { const xs = rw.slice(1), cross = []; for (let a = 0; a < xs.length; a++) for (let b = a; b < xs.length; b++) cross.push(xs[a] * xs[b]); return [1, ...xs, ...cross]; }), A = fitAll(Z, e2), df = Z[0].length - 1, LM = n * A.r2;
        out.info = Object.assign(common, { method: kind, e2, A, df, LM, p: ST.chi2SF(LM, df), Fst: (A.r2 / df) / ((1 - A.r2) / (n - df - 1)), pF: ST.fSF((A.r2 / df) / ((1 - A.r2) / (n - df - 1)), df, n - df - 1), cols: Z[0].length }); out.label = kind === 'bp' ? 'Breusch–Pagan: regress e² on the features' : 'White: regress e² on the features, their squares and products'; }
      else { const split = Math.floor(n / 2), start2 = split + Math.floor(n * 0.2), A1 = fitAll(X.slice(0, split), y.slice(0, split)), A2 = fitAll(X.slice(start2), y.slice(start2)), df1 = split - p, df2 = n - start2 - p, Fs = (A2.sse / df2) / (A1.sse / df1);
        out.info = Object.assign(common, { method: 'gq', split, start2, A1, A2, df1, df2, F: Fs, p: ST.fSF(Fs, df1, df2) }); out.label = 'Goldfeld–Quandt: error variance of the high-x rows vs the low-x rows'; } }
    if (attr === 'indtest') { const ss = e.reduce((s, v) => s + v * v, 0), acf = k => e.slice(k).reduce((s, v, i) => s + v * e[i], 0) / ss, dw = e.slice(1).reduce((s, v, i) => s + (v - e[i]) ** 2, 0) / ss, L = Math.min(10, Math.floor(n / 5));
      const rho = Array.from({ length: L }, (_, k) => acf(k + 1)), Q = n * (n + 2) * rho.reduce((s, r2, k) => s + r2 * r2 / (n - k - 1), 0);
      out.info = Object.assign(common, { method: kind, ss, dw, num: e.slice(1).reduce((s, v, i) => s + (v - e[i]) ** 2, 0), rho, L, Q, p: ST.chi2SF(Q, L) }); out.label = kind === 'dw' ? 'Durbin–Watson statistic' : `Ljung–Box Q over ${L} lags`; }
    if (attr === 'normtest') { const S = mean(e.map(v => v ** 3)) / mean(e.map(v => v * v)) ** 1.5, K = mean(e.map(v => v ** 4)) / mean(e.map(v => v * v)) ** 2, JB = n / 6 * (S * S + (K - 3) ** 2 / 4);
      out.info = Object.assign(common, { method: kind, S, K, JB, pJB: ST.chi2SF(JB, 2), sw: shapiro(e), ad: anderson(e), m2: mean(e.map(v => v * v)), m3: mean(e.map(v => v ** 3)), m4: mean(e.map(v => v ** 4)) });
      out.label = { sw: 'Shapiro–Wilk test', jb: 'Jarque–Bera test', ad: 'Anderson–Darling test' }[kind]; }
    if (attr === 'colltest') { const k = p - 1, cols = Array.from({ length: k }, (_, j) => X.map(rw => rw[j + 1])), mu = cols.map(mean), sd = cols.map((c, j) => Math.sqrt(mean(c.map(v => (v - mu[j]) ** 2))));
      const Rm = cols.map((a, i) => cols.map((b, j) => mean(a.map((v, q) => (v - mu[i]) * (b[q] - mu[j]))) / (sd[i] * sd[j])));
      const vif = cols.map((_, j) => { const Z = X.map(rw => [1, ...rw.slice(1).filter((_, q) => q !== j)]), A = fitAll(Z, cols[j]); return { j, r2: A.r2, vif: 1 / (1 - A.r2), w: A.w }; });
      const E = LA.eigSym(Rm); out.info = Object.assign(common, { method: kind, R: Rm, vif, eig: E.values, vecs: E.vectors, kappa: E.values[0] / E.values[E.values.length - 1], ci: E.values.map(l => Math.sqrt(E.values[0] / l)), mu, sd });
      out.label = { vif: 'variance inflation factors', cond: 'condition number of the correlation matrix', corr: 'correlation matrix of the features' }[kind]; }
    return out;
  }
  return { has, attrOf, kindOf, data, apply, run, V, Phi, PhiInv, fitAll };
})();
