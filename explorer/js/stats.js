/* ============================================================
   Statistics engine: distributions, OLS with full inference,
   assumption tests, gradient descent, Monte Carlo.
   Uses LA from ../js/lab/linalg.js.
   ============================================================ */
const ST = (() => {
  function lgamma(x){
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1; let a = c[0]; const t = x + g + 0.5;
    for (let i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function betacf(a, b, x){
    const MAXIT = 300, EPS = 3e-14, FPMIN = 1e-300;
    let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
      const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function betai(a, b, x){
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  function gammq(a, x){ // regularised upper incomplete gamma Q(a, x)
    if (x <= 0) return 1;
    if (x < a + 1) { let sum = 1 / a, del = sum, ap = a; for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 3e-14) break; }
      return 1 - sum * Math.exp(-x + a * Math.log(x) - lgamma(a)); }
    let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
    for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-14) break; }
    return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }
  const tP2 = (t, df) => df > 0 && isFinite(t) ? betai(df / 2, 0.5, df / (df + t * t)) : (isFinite(t) ? NaN : 0);
  const fSF = (F, d1, d2) => d2 > 0 && F >= 0 ? betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * F)) : NaN;
  const chi2SF = (x, k) => k > 0 ? gammq(k / 2, x / 2) : NaN;
  function tCrit(df, alpha = 0.05){ // two-sided critical value
    if (!(df > 0)) return NaN; let lo = 0, hi = 1000;
    for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (tP2(m, df) > alpha) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1)); };

  /* Ordinary least squares with inference. X includes the intercept column. */
  function ols(X, y, light = false){
    const N = X.length, p = X[0].length, XT = LA.T(X), XtX = LA.mul(XT, X), Xty = LA.mv(XT, y);
    const rank = LA.rank(X), full = rank === p;
    const sol = LA.minimizer(XtX, Xty), w = sol.w;
    const yhat = LA.mv(X, w), e = LA.sub(y, yhat);
    const SSE = LA.dot(e, e), ym = mean(y), SST = y.reduce((s, v) => s + (v - ym) ** 2, 0);
    const df = N - rank, s2 = df > 0 ? SSE / df : NaN;
    const inv = full ? LA.inv(XtX) : null;
    const se = w.map((_, j) => inv && df > 0 ? Math.sqrt(Math.max(0, s2 * inv[j][j])) : NaN);
    const R2 = SST > 0 ? 1 - SSE / SST : NaN;
    const out = { N, p, rank, full, XtX, Xty, w, yhat, e, SSE, SST, df, s2, inv, se, R2 };
    if (light) return out;
    const t = w.map((v, j) => v / se[j]), pv = t.map(x => tP2(x, df)), tc = tCrit(df);
    const ci = w.map((v, j) => [v - tc * se[j], v + tc * se[j]]);
    const adjR2 = rank > 1 && N - rank > 0 ? 1 - (1 - R2) * (N - 1) / (N - rank) : NaN;
    const rmse = Math.sqrt(SSE / N), mae = mean(e.map(Math.abs));
    const lev = inv ? X.map(r => LA.dot(r, LA.mv(inv, r))) : null;
    const cook = lev ? e.map((ei, i) => (ei * ei) / (rank * s2) * lev[i] / (1 - lev[i]) ** 2) : null;
    const eig = LA.eigSym(XtX).values, kappa = eig[eig.length - 1] > 1e-12 * eig[0] ? eig[0] / eig[eig.length - 1] : Infinity;
    return Object.assign(out, { t, pv, tc, ci, adjR2, rmse, mae, lev, cook, eig, kappa, det: LA.det(XtX) });
  }

  function diagnostics(X, y, fit){
    const N = fit.N, e = fit.e, out = {};
    // Breusch–Pagan (Koenker, studentised): regress e^2 on X, LM = N R^2 ~ chi2(rank - 1)
    if (fit.rank > 1 && N > fit.rank + 1) {
      const aux = ols(X, e.map(v => v * v), true), k = aux.rank - 1;
      out.bp = { LM: N * aux.R2, df: k, p: chi2SF(N * aux.R2, k) };
    }
    // Durbin–Watson in row (time) order
    let dn = 0; for (let i = 1; i < N; i++) dn += (e[i] - e[i - 1]) ** 2;
    out.dw = fit.SSE > 0 ? dn / fit.SSE : NaN;
    // Jarque–Bera
    const m = mean(e), m2 = mean(e.map(v => (v - m) ** 2)), m3 = mean(e.map(v => (v - m) ** 3)), m4 = mean(e.map(v => (v - m) ** 4));
    const S = m2 > 0 ? m3 / m2 ** 1.5 : 0, K = m2 > 0 ? m4 / (m2 * m2) : 3;
    out.jb = { JB: N / 6 * (S * S + (K - 3) ** 2 / 4), skew: S, kurt: K }; out.jb.p = Math.exp(-out.jb.JB / 2);
    // Ramsey RESET with yhat^2 and yhat^3
    const ym = mean(fit.yhat), ys = sd(fit.yhat) || 1;
    const Xa = X.map((r, i) => { const z = (fit.yhat[i] - ym) / ys; return [...r, z * z, z * z * z]; });
    if (N > fit.rank + 3) {
      const ua = ols(Xa, y, true), q = ua.rank - fit.rank;
      if (q > 0 && ua.SSE > 1e-12) { const F = ((fit.SSE - ua.SSE) / q) / (ua.SSE / (N - ua.rank)); out.reset = { F, p: fSF(F, q, N - ua.rank) }; }
    }
    // VIF for each non-intercept column
    out.vif = [];
    for (let j = 1; j < X[0].length; j++) {
      const others = X.map(r => r.filter((_, k) => k !== j)), col = X.map(r => r[j]);
      const f = ols(others, col, true); out.vif.push(f.R2 >= 1 - 1e-10 ? Infinity : 1 / (1 - f.R2));
    }
    return out;
  }

  /* Batch gradient descent on MSE from w = 0 */
  function gd(X, y, eta, iters){
    const N = X.length, XT = LA.T(X); let w = new Array(X[0].length).fill(0); const loss = [];
    for (let t = 0; t <= iters; t++) {
      const e = LA.sub(y, LA.mv(X, w)), L = LA.dot(e, e) / N; loss.push(L);
      if (!isFinite(L) || L > 1e15) break;
      if (t < iters) w = LA.sub(w, LA.scale(LA.mv(XT, e), -2 * eta / N));
    }
    return { loss, w };
  }
  const hessMax = X => LA.eigSym(LA.mul(LA.T(X), X).map(r => r.map(v => 2 * v / X.length))).values[0];

  /* Sampling distribution of chosen coefficients across R fresh datasets */
  function monteCarlo(makeData, R, focus, truth){
    const est = focus.map(() => []), se = focus.map(() => []), cover = focus.map(() => []);
    let tc = null, df = null, singular = 0;
    for (let r = 0; r < R; r++) {
      const d = makeData(r), f = ols(d.X, d.y, true);
      if (!f.full) singular++;
      if (f.df !== df) { df = f.df; tc = tCrit(df); }
      focus.forEach((j, k) => {
        est[k].push(f.w[j]); se[k].push(f.se[j]);
        const b = truth[j]; if (b != null && isFinite(f.se[j])) cover[k].push(Math.abs(f.w[j] - b) <= tc * f.se[j]);
      });
    }
    return focus.map((j, k) => {
      const e = est[k], s = se[k].filter(isFinite), c = cover[k];
      return { j, est: e, mean: mean(e), sd: sd(e), meanSE: s.length ? mean(s) : NaN, truth: truth[j] ?? null,
        coverage: c.length ? c.filter(Boolean).length / c.length : NaN, singular, identifiable: singular < R / 2 };
    });
  }

  return { ols, diagnostics, gd, hessMax, monteCarlo, tP2, fSF, chi2SF, tCrit, mean, sd, betai };
})();
