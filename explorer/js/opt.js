/* ============================================================
   Optimisation: the same model and loss (OLS), a different way of
   finding its weights. Every run is recorded iteration by iteration
   so the worked examples, charts and Python can replay it.
   OP.has(id) / OP.data(id, P, N, σ, s) / OP.apply(r, id)
   OP.run(id, P, d) -> { attr, kind, label, w, wOrig, hist, path, T, stop, info, yhat, yhte, rmseTe, diverged }
   ============================================================ */
const OP = (() => {
  const V = {
    slneq: ['solver', 'neq'], slpinv: ['solver', 'pinv'], slqr: ['solver', 'qr'], slchol: ['solver', 'chol'], slgd: ['solver', 'gd'], slcd: ['solver', 'cd'],
    gdbatch: ['gdtype', 'batch'], gdsgd: ['gdtype', 'sgd'], gdmini: ['gdtype', 'mini'],
    lrgood: ['lr', 'good'], lrtiny: ['lr', 'tiny'], lrnear: ['lr', 'near'], lrbig: ['lr', 'big'],
    schconst: ['schedule', 'const'], schstep: ['schedule', 'step'], schexp: ['schedule', 'exp'], schinv: ['schedule', 'inv'],
    opgd: ['optimiser', 'gd'], opmom: ['optimiser', 'mom'], opnest: ['optimiser', 'nest'], oprms: ['optimiser', 'rms'], opadam: ['optimiser', 'adam'],
    inzero: ['init', 'zero'], inrand: ['init', 'rand'], infar: ['init', 'far'],
    stfixed: ['stopping', 'fixed'], stgrad: ['stopping', 'grad'], stloss: ['stopping', 'loss'], stearly: ['stopping', 'early'],
    sgscaled: ['scalegd', 'scaled'], sgunscaled: ['scalegd', 'unscaled']
  };
  const has = id => !!V[id], attrOf = id => V[id] && V[id][0], kindOf = id => V[id] && V[id][1];
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const T_ = A => A[0].map((_, j) => A.map(r => r[j]));

  /* one dataset for the whole branch: two correlated features (r ≈ 0.9), so the loss bowl is a long valley; scalegd puts x₂ in the thousands */
  function data(id, P, N, sg){
    const attr = V[id][0], x1 = P.u1.slice(0, N).map(v => 10 * v), big = attr === 'scalegd';
    const x2 = big ? P.u2.slice(0, N).map(v => 1000 + 4000 * v) : x1.map((v, i) => 0.9 * v + 1.3 * P.z2[i]), b2 = big ? 0.002 : 1.0;
    const y = x1.map((v, i) => 2 + 1.5 * v + b2 * x2[i] + sg * P.z1[i]);
    return { X: x1.map((v, i) => [1, v, x2[i]]), names: ['1', 'x₁', 'x₂'], y, px: x1, xName: 'x₁', x2, truth: { coef: { 0: 2, 1: 1.5, 2: b2 }, fn: null }, focus: [1],
      note: big ? 'y = 2 + 1.5x₁ + 0.002x₂ + ε, with x₁ between 0 and 10 and x₂ between 1 000 and 5 000' : 'y = 2 + 1.5x₁ + 1.0x₂ + ε, with x₂ = 0.9x₁ + 1.3z, so the features are correlated (r ≈ 0.9) and the loss bowl is a long, narrow valley' };
  }
  const apply = (r, id) => { r.opt = id; return r; };

  /* ---------- the loss and its gradient on a design X (rows) ---------- */
  const lossOf = (X, y, w) => { let s = 0; for (let i = 0; i < X.length; i++) { const e = y[i] - LA.dot(X[i], w); s += e * e; } return s / X.length; };
  const gradOf = (X, y, w) => { const g = new Array(w.length).fill(0); for (let i = 0; i < X.length; i++) { const e = y[i] - LA.dot(X[i], w); for (let j = 0; j < w.length; j++) g[j] -= 2 * X[i][j] * e / X.length; } return g; };
  const lmaxOf = X => LA.eigSym(LA.mul(T_(X), X).map(r => r.map(v => 2 * v / X.length))).values;
  const ex = v => v === 0 ? '0' : Math.abs(v) >= 0.01 && Math.abs(v) < 1e4 ? num(v, 4) : (([m, e]) => `${m}×10${e.replace('+', '').split('').map(ch => ({ '-': '⁻' })[ch] || '⁰¹²³⁴⁵⁶⁷⁸⁹'[+ch]).join('')}`)(v.toExponential(2).split('e'));
  const fin = w => w.every(v => isFinite(v) && Math.abs(v) < 1e12);

  /* generic first-order loop. o: { X, y, w0, T, eta(t, epoch), opt, batch, rng, stop, val } */
  function gd(o){
    const { X, y } = o, n = X.length, p = X[0].length, bs = o.batch || n, perEpoch = Math.ceil(n / bs), opt = o.opt || 'gd';
    let w = [...o.w0], v = new Array(p).fill(0), m = new Array(p).fill(0), s2 = new Array(p).fill(0);
    const hist = [{ t: 0, L: lossOf(X, y, w), gn: LA.norm(gradOf(X, y, w)), w: [...w] }], log = [];
    let order = [...Array(n).keys()], stop = null, best = null, bad = 0;
    for (let t = 1; t <= o.T; t++) {
      const epoch = Math.floor((t - 1) / perEpoch), k = (t - 1) % perEpoch;
      if (bs < n && k === 0) { order = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(o.rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } }
      const idx = bs < n ? order.slice(k * bs, (k + 1) * bs) : order, Xb = idx.map(i => X[i]), yb = idx.map(i => y[i]), eta = o.eta(t, epoch);
      let g, step;
      if (opt === 'nest') { const look = w.map((wj, j) => wj + 0.9 * v[j]); g = gradOf(Xb, yb, look); v = v.map((vj, j) => 0.9 * vj - eta * g[j]); step = v; }
      else { g = gradOf(Xb, yb, w);
        if (opt === 'gd') step = g.map(gj => -eta * gj);
        if (opt === 'mom') { v = v.map((vj, j) => 0.9 * vj - eta * g[j]); step = v; }
        if (opt === 'rms') { s2 = s2.map((sj, j) => 0.9 * sj + 0.1 * g[j] * g[j]); step = g.map((gj, j) => -eta * gj / (Math.sqrt(s2[j]) + 1e-8)); }
        if (opt === 'adam') { m = m.map((mj, j) => 0.9 * mj + 0.1 * g[j]); s2 = s2.map((sj, j) => 0.999 * sj + 0.001 * g[j] * g[j]);
          const mh = m.map(mj => mj / (1 - 0.9 ** t)), vh = s2.map(sj => sj / (1 - 0.999 ** t)); step = mh.map((mj, j) => -eta * mj / (Math.sqrt(vh[j]) + 1e-8));
          if (log.length < 4) log.push({ t, rows: idx.length, g: [...g], eta, m: [...m], s: [...s2], mh, vh, step: [...step], wPrev: [...w], wNext: w.map((wj, j) => wj + step[j]) }); }
      }
      if (opt !== 'adam' && log.length < 4) log.push({ t, rows: idx.length, rowIdx: idx.length < n ? idx.slice(0, 8) : null, g: [...g], eta, v: [...v], s: [...s2], step: [...step], wPrev: [...w], wNext: w.map((wj, j) => wj + step[j]) });
      w = w.map((wj, j) => wj + step[j]);
      const L = lossOf(X, y, w), gn = LA.norm(gradOf(X, y, w)), rec = { t, L, gn, w: [...w], eta, epoch };
      if (o.val) { rec.Lv = lossOf(o.val.X, o.val.y, w); if (!best || rec.Lv < best.Lv - 1e-12) { best = { ...rec }; bad = 0; } else bad++; }
      hist.push(rec);
      if (!fin(w) || L > 1e12) { stop = { t, reason: 'diverged: the loss blew up' }; break; }
      if (o.stop === 'grad' && gn < o.tol) { stop = { t, reason: `‖∇L‖ = ${ex(gn)} < ${ex(o.tol)}` }; break; }
      if (o.stop === 'loss' && Math.abs(hist[t - 1].L - L) / Math.max(L, 1e-12) < o.tol) { stop = { t, reason: `relative change of L = ${ex(Math.abs(hist[t - 1].L - L) / Math.max(L, 1e-12))} < ${ex(o.tol)}` }; break; }
      if (o.val && bad >= o.patience) { stop = { t, reason: `validation loss has not improved for ${o.patience} iterations; the best weights (iteration ${best.t}) are kept` }; w = [...best.w]; break; }
    }
    return { w, hist, log, stop: stop || { t: hist[hist.length - 1].t, reason: `fixed budget of ${o.T} ${bs < n ? 'updates' : 'iterations'} used up` }, best, perEpoch };
  }

  /* ---------- the closed-form solvers, worked ---------- */
  function cholesky(A){ const p = A.length, L = A.map(() => new Array(p).fill(0)), steps = [];
    for (let i = 0; i < p; i++) for (let j = 0; j <= i; j++) { let s = 0; const terms = []; for (let k = 0; k < j; k++) { s += L[i][k] * L[j][k]; terms.push([L[i][k], L[j][k]]); }
      if (i === j) { const v = A[i][i] - s; L[i][j] = v > 0 ? Math.sqrt(v) : NaN; steps.push({ i, j, a: A[i][i], terms, val: L[i][j], diag: true }); }
      else { L[i][j] = (A[i][j] - s) / L[j][j]; steps.push({ i, j, a: A[i][j], terms, div: L[j][j], val: L[i][j], diag: false }); } }
    return { L, steps };
  }
  const forward = (L, b) => { const z = []; b.forEach((bi, i) => { let s = bi; for (let k = 0; k < i; k++) s -= L[i][k] * z[k]; z.push(s / L[i][i]); }); return z; };
  const backward = (U, b) => { const p = b.length, w = new Array(p).fill(0); for (let i = p - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < p; k++) s -= U[i][k] * w[k]; w[i] = s / U[i][i]; } return w; };
  function mgs(X){ // modified Gram–Schmidt: X = QR
    const n = X.length, p = X[0].length, Q = X.map(r => [...r]), R = Array.from({ length: p }, () => new Array(p).fill(0)), steps = [];
    for (let j = 0; j < p; j++) { for (let k = 0; k < j; k++) { let s = 0; for (let i = 0; i < n; i++) s += Q[i][k] * Q[i][j]; R[k][j] = s; for (let i = 0; i < n; i++) Q[i][j] -= s * Q[i][k]; steps.push({ k, j, r: s }); }
      let nr = 0; for (let i = 0; i < n; i++) nr += Q[i][j] ** 2; nr = Math.sqrt(nr); R[j][j] = nr; for (let i = 0; i < n; i++) Q[i][j] /= nr; steps.push({ k: j, j, r: nr, norm: true }); }
    return { Q, R, steps };
  }

  function run(id, P, d){
    const [attr, kind] = V[id], X = P.Xtr, y = P.ytr, p = X[0].length, n = X.length, lim = P.lim, out = { id, attr, kind, info: {} };
    const XtX = LA.mul(T_(X), X), Xty = LA.mv(T_(X), y), wStar = P.f.w;
    let R;
    const plain = (frac, T, extra = {}) => gd({ X, y, w0: new Array(p).fill(0), T, eta: () => frac * lim, ...extra });
    if (attr === 'solver') {
      if (kind === 'neq') { out.label = 'normal equations, solved by elimination'; out.w = [...wStar]; out.info = { method: 'neq' }; }
      if (kind === 'chol') { const C = cholesky(XtX), z = forward(C.L, Xty), w = backward(T_(C.L), z); out.label = 'Cholesky: X̃ᵀX̃ = LLᵀ, then two triangular solves'; out.w = w; out.info = { method: 'chol', A: XtX, b: Xty, L: C.L, steps: C.steps, z }; }
      if (kind === 'qr') { const Q = mgs(X), qty = LA.mv(T_(Q.Q), y), w = backward(Q.R, qty); out.label = 'QR: X̃ = QR, then Rw̃ = Qᵀy by back-substitution'; out.w = w; out.info = { method: 'qr', Q: Q.Q, R: Q.R, steps: Q.steps, qty }; }
      if (kind === 'pinv') { const E = LA.eigSym(XtX), sig = E.values.map(v => Math.sqrt(Math.max(v, 0))), tol = 1e-10 * sig[0], Vv = E.vectors;
        const U = Vv.map((vk, k) => sig[k] > tol ? X.map(r => LA.dot(r, vk) / sig[k]) : null), uty = U.map(u => u ? LA.dot(u, y) : 0), coef = uty.map((c, k) => sig[k] > tol ? c / sig[k] : 0);
        const w = new Array(p).fill(0); Vv.forEach((vk, k) => vk.forEach((t, j) => { w[j] += coef[k] * t; }));
        out.label = 'pseudo-inverse via the SVD: w̃ = VΣ⁺Uᵀy'; out.w = w; out.info = { method: 'pinv', sig, V: Vv, U, uty, coef, tol, kX: sig[0] / sig[sig.length - 1], kA: (sig[0] / sig[sig.length - 1]) ** 2 }; }
      if (kind === 'gd') { R = plain(0.5, 200); out.label = 'gradient descent, η = 0.5 × 2/λ_max, 200 iterations'; out.info = { method: 'gd', frac: 0.5, eta: 0.5 * lim }; }
      if (kind === 'cd') { let w = new Array(p).fill(0); const hist = [{ t: 0, L: lossOf(X, y, w), w: [...w] }], log = [], nrm = X[0].map((_, j) => X.reduce((s, r) => s + r[j] * r[j], 0));
        for (let sw = 1; sw <= 500; sw++) { let mx = 0;
          for (let j = 0; j < p; j++) { let num_ = 0; for (let i = 0; i < n; i++) { let rij = y[i]; for (let k = 0; k < p; k++) if (k !== j) rij -= X[i][k] * w[k]; num_ += X[i][j] * rij; }
            const nw = num_ / nrm[j]; if (sw <= 2) log.push({ sw, j, num: num_, den: nrm[j], old: w[j], nw }); mx = Math.max(mx, Math.abs(nw - w[j])); w[j] = nw; }
          hist.push({ t: sw, L: lossOf(X, y, w), w: [...w], gn: LA.norm(gradOf(X, y, w)) }); if (mx < 1e-12) break; }
        out.label = 'coordinate descent: one weight at a time, exactly'; out.w = w; out.info = { method: 'cd', log, nrm }; out.hist = hist; out.stop = { t: hist.length - 1, reason: 'no weight moved by more than 10⁻¹²' }; }
      if (out.w && !R) { out.info.resid = LA.norm(LA.sub(LA.mv(XtX, out.w), Xty)); out.info.diff = Math.max(...out.w.map((v, j) => Math.abs(v - wStar[j]))); }
    }
    if (attr === 'gdtype') { const rng = mulberry32((P.seed || 1) * 977 + 3), bs = { batch: n, sgd: 1, mini: 8 }[kind], eta = { batch: 0.5 * lim, sgd: 0.01, mini: 0.05 }[kind], E = 20;
      R = gd({ X, y, w0: new Array(p).fill(0), T: E * Math.ceil(n / bs), eta: () => eta, batch: bs, rng });
      out.label = kind === 'batch' ? `batch gradient descent: every row in every step, η = ${num(eta, 4)}, ${E} iterations` : `${kind === 'sgd' ? 'stochastic gradient descent: one row per step' : 'mini-batch gradient descent: 8 rows per step'}, η = ${eta}, ${E} epochs (rows reshuffled every epoch)`;
      out.info = { method: 'gdtype', bs, eta, epochs: E, seedRng: (P.seed || 1) * 977 + 3 }; }
    if (attr === 'lr') { const frac = { good: 0.5, tiny: 0.01, near: 0.98, big: 1.05 }[kind]; R = plain(frac, 100);
      out.label = `gradient descent, η = ${frac} × 2/λ_max = ${num(frac * lim, 4)}, 100 iterations`; out.info = { method: 'lr', frac, eta: frac * lim }; }
    if (attr === 'schedule') { const rng = mulberry32((P.seed || 1) * 977 + 3), e0 = 0.03, E = 20;
      const f = { const: () => e0, step: (t, ep) => e0 * 0.5 ** Math.floor(ep / 5), exp: (t, ep) => e0 * 0.9 ** ep, inv: (t, ep) => e0 / (1 + ep / 2) }[kind];
      R = gd({ X, y, w0: new Array(p).fill(0), T: E * n, eta: f, batch: 1, rng });
      out.label = { const: 'SGD, constant η = 0.03', step: 'SGD, step decay: η halves every 5 epochs', exp: 'SGD, exponential decay: η = 0.03 × 0.9^epoch', inv: 'SGD, 1/t decay: η = 0.03 / (1 + epoch/2)' }[kind] + `, ${E} epochs`;
      out.info = { method: 'schedule', e0, epochs: E, etas: Array.from({ length: E }, (_, ep) => f(0, ep)), seedRng: (P.seed || 1) * 977 + 3 }; }
    if (attr === 'optimiser') { const eta = { gd: 0.05 * lim, mom: 0.05 * lim, nest: 0.05 * lim, rms: 0.1, adam: 0.2 }[kind]; R = gd({ X, y, w0: new Array(p).fill(0), T: 200, eta: () => eta, opt: kind });
      out.label = { gd: 'plain gradient descent', mom: 'momentum (β = 0.9)', nest: 'Nesterov momentum (β = 0.9)', rms: 'RMSProp (β = 0.9)', adam: 'Adam (β₁ = 0.9, β₂ = 0.999)' }[kind] + `, η = ${num(eta, 4)}${kind === 'rms' || kind === 'adam' ? '' : ' (= 0.05 × 2/λ_max)'}, 200 iterations`; out.info = { method: 'optimiser', eta }; }
    if (attr === 'init') { const rng = mulberry32((P.seed || 1) * 433 + 1), g = gaussFn(rng), w0 = { zero: new Array(p).fill(0), rand: Array.from({ length: p }, () => 0.01 * g()), far: Array.from({ length: p }, (_, j) => (j % 2 ? -40 : 40)) }[kind];
      R = gd({ X, y, w0, T: 3000, eta: () => 0.5 * lim, stop: 'grad', tol: 1e-6 }); out.label = `gradient descent from w̃₀ = ${vec(w0, 3)}, η = 0.5 × 2/λ_max, until ‖∇L‖ < 10⁻⁶`; out.info = { method: 'init', w0, eta: 0.5 * lim }; }
    if (attr === 'stopping') { const eta = 0.05 * lim;
      if (kind === 'early') { const nv = Math.max(2, Math.round(0.2 * n)), fitX = X.slice(0, n - nv), fitY = y.slice(0, n - nv), val = { X: X.slice(n - nv), y: y.slice(n - nv) };
        R = gd({ X: fitX, y: fitY, w0: new Array(p).fill(0), T: 5000, eta: () => eta, val, patience: 10 }); out.info = { method: 'stopping', eta, nv, nfit: n - nv }; }
      else R = gd({ X, y, w0: new Array(p).fill(0), T: kind === 'fixed' ? 100 : 5000, eta: () => eta, stop: kind === 'fixed' ? null : kind, tol: kind === 'grad' ? 0.01 : 1e-6 });
      out.label = { fixed: 'stop after a fixed 100 iterations', grad: 'stop when ‖∇L‖ < 0.01', loss: 'stop when the loss changes by less than 10⁻⁶ (relative)', early: 'early stopping on a validation split (patience 10)' }[kind] + `; η = 0.05 × 2/λ_max`;
      out.info = Object.assign({ method: 'stopping', eta }, out.info); }
    if (attr === 'scalegd') {
      if (kind === 'scaled') { R = plain(0.9, 200); out.label = 'gradient descent on standardised features, η = 0.9 × 2/λ_max, 200 iterations'; out.info = { method: 'scalegd', eta: 0.9 * lim, ev: lmaxOf(X) }; }
      else { const Xr = P.tr.map(i => d.X[i]), ev = lmaxOf(Xr), limR = 2 / ev[0];
        R = gd({ X: Xr, y, w0: new Array(p).fill(0), T: 200, eta: () => 0.9 * limR }); out.raw = true;
        const wr = LA.minimizer(LA.mul(T_(Xr), Xr), LA.mv(T_(Xr), y)).w;
        out.label = `gradient descent on the RAW features, η = 0.9 × 2/λ_max = ${ex(0.9 * limR)}, 200 iterations`; out.info = { method: 'scalegd', eta: 0.9 * limR, ev, wStarRaw: wr, Xr }; }
    }
    if (R) { out.w = R.w; out.hist = R.hist; out.log = R.log; out.stop = R.stop; out.best = R.best; out.perEpoch = R.perEpoch; }
    out.diverged = !fin(out.w) || (out.hist && out.hist[out.hist.length - 1].L > 10 * out.hist[0].L);
    const back = w => w.map((v, j) => j === 0 ? w[0] - w.slice(1).reduce((s, wj, k) => s + wj * P.mu[k + 1] / P.sd[k + 1], 0) : v / P.sd[j]);
    out.wOrig = out.raw ? [...out.w] : back(out.w);
    const Xte = out.raw ? P.te.map(i => d.X[i]) : P.Xte, Xtr = out.raw ? P.tr.map(i => d.X[i]) : X;
    out.yhat = Xtr.map(r => LA.dot(r, out.w)); out.yhte = Xte.map(r => LA.dot(r, out.w));
    const rm = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / Math.max(1, a.length));
    out.rmseTr = out.diverged ? NaN : rm(y, out.yhat); out.rmseTe = out.diverged ? NaN : rm(P.yte, out.yhte);
    out.Lfinal = fin(out.w) ? lossOf(Xtr, y, out.w) : NaN; out.Lstar = P.f.SSE / n;
    out.gap = out.diverged ? Infinity : Math.max(...out.wOrig.map((v, j) => Math.abs(v - P.wOrig[j])));
    return out;
  }
  return { has, attrOf, kindOf, data, apply, run, lossOf, gradOf, V, ex };
})();
