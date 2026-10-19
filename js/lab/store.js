/* ============================================================
   Shared lab state. Every lab page reads and edits the same
   dataset and weights, so a change made in one lab shows up in
   the others. Saved in the browser between visits.
   Model: y_hat = b + w1*x1 + w2*x2,  w = [b, w1, w2]
   Loss:  L(w) = (1/N) * sum (y - y_hat)^2  (mean squared error)
   ============================================================ */
const LAB_PRESETS = {
  worked:    { name: 'Worked example (4 students)', rows: [[1,0,3],[2,0,6],[3,1,6],[4,3,13]] },
  perfect:   { name: 'Perfect fit: no noise',       rows: [[1,0,3.5],[2,0,4.5],[3,1,7.5],[4,3,12.5],[2,2,8.5]] },
  noisy:     { name: 'Ten noisy points',            rows: [[0.5,1,2.9],[1,3,4.4],[1.5,0.5,2.6],[2,2,5.6],[2.5,4,6.9],[3,1,5.4],[3.5,3,7.3],[4,0.5,6.1],[4.5,2.5,8.0],[5,3.5,9.9]] },
  collinear: { name: 'Collinear features: x₂ = 2x₁', rows: [[1,2,4],[2,4,5],[3,6,8],[4,8,9]] },
  tooFew:    { name: 'Too few points: N = 2',        rows: [[1,0,3],[3,2,8]] }
};

const LAB = (() => {
  const KEY = 'mlf-lab-v1';
  let S = { preset: 'worked', rows: LAB_PRESETS.worked.rows.map(r => [...r]), w: [0, 0, 0], sel: -1 };
  try { const saved = JSON.parse(localStorage.getItem(KEY)); if (saved && Array.isArray(saved.rows) && saved.rows.length) S = { ...S, ...saved }; } catch (e) {}
  const listeners = new Set(); let queued = false, structural = false, cache = null;

  function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function emit(isStructural){
    cache = null; structural = structural || !!isStructural; save();
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; const st = structural; structural = false; const d = derive(); listeners.forEach(f => f(d, st)); });
  }

  function derive(){
    if (cache) return cache;
    const rows = S.rows, N = rows.length, w = S.w;
    const X = rows.map(r => [1, r[0], r[1]]), y = rows.map(r => r[2]);
    const XT = LA.T(X), yhat = LA.mv(X, w), e = LA.sub(y, yhat);
    const SSE = LA.dot(e, e), L = SSE / N;
    const XtX = LA.mul(XT, X), Xty = LA.mv(XT, y), Xte = LA.mv(XT, e);
    const grad = LA.scale(Xte, -2 / N);
    const H = XtX.map(r => r.map(v => 2 * v / N));
    const det = LA.det(XtX), rank = LA.rank(X);
    const opt = LA.minimizer(XtX, Xty);
    const eOpt = LA.sub(y, LA.mv(X, opt.w)), Lopt = LA.dot(eOpt, eOpt) / N;
    const eigH = LA.eigSym(H);
    cache = { S, N, X, y, w, yhat, e, SSE, L, XtX, Xty, Xte, grad, H, det, rank, opt, Lopt, eigH };
    return cache;
  }

  return {
    get: derive,
    state: () => S,
    subscribe(fn){ listeners.add(fn); fn(derive(), true); return () => listeners.delete(fn); },
    setW(w){ S.w = w.map(Number); emit(); },
    setWi(i, v){ S.w = S.w.map((x, j) => j === i ? v : x); emit(); },
    setCell(i, j, v){ S.rows[i][j] = v; S.preset = 'custom'; emit(); },
    addRow(){
      const r = S.rows, last = r[r.length - 1] || [0, 0, 0];
      S.rows = [...r, [+(last[0] + 1).toFixed(2), last[1], last[2]]]; S.preset = 'custom'; emit(true);
    },
    removeRow(i){ if (S.rows.length <= 1) return; S.rows = S.rows.filter((_, k) => k !== i); S.sel = -1; S.preset = 'custom'; emit(true); },
    load(key){ S.rows = LAB_PRESETS[key].rows.map(r => [...r]); S.preset = key; S.sel = -1; emit(true); },
    select(i){ S.sel = S.sel === i ? -1 : i; emit(); },
    fit(){ const d = derive(); S.w = d.opt.w.map(v => +v.toFixed(6)); emit(); return d.opt.unique; }
  };
})();
