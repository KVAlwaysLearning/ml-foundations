/* ============================================================
   Feature selection for the charts.
   With more than one feature a flat chart can show only one
   feature (or one pair) at a time. This module decides which:
   - a global choice (Controls box: "Feature", "Second feature",
     "Adjust slice points for the other features"), which also
     drives the worked examples, notes and code comments;
   - a per-chart override (a small select in the chart header,
     "global (x₂)" by default).
   Slices: the fitted line for feature j holds every other
   feature at its mean. "Adjusted" points move each row by the
   part of its prediction that comes from the other features,
   y_adj = y − Σ_{k≠j} w_k (x_k − mean_k), so every point sits
   exactly its residual away from the line (partial residuals).
   FS.init(S, onGlobal)          state object and full re-render callback
   FS.cols(names)               numeric feature columns (no categorical)
   FS.global(names)             { j, j2 } from the Controls choice
   FS.pick(names, id, opt)      { j, j2 } for one chart (override or global)
   FS.adj(id)                   adjusted points on for this chart?
   FS.sel(chart, names, id, kind, redraw)   header selects; kind 'one' | 'pair' | 'pairopt' | 'wpair'
   FS.adjBtn(chart, id, redraw) header toggle for adjusted / raw points
   FS.slice(X, y, w, j, opt)    { line(x), y: adjusted ys, c0 } for a slice through feature j
   ============================================================ */
const FS = (() => {
  let S = null, onGlobal = () => {};
  const CAT = ['group', 'A', 'B', 'C'];
  const init = (state, cb) => { S = state; S.ov = S.ov || {}; onGlobal = cb || onGlobal; };
  const isC = nm => GEN.isCat(nm);
  const cols = names => names.map((_, j) => j).filter(j => j > 0 && !isC(names[j]));
  const idx = (names, nm) => { const j = nm == null ? -1 : names.indexOf(nm); return j > 0 && !isC(nm) ? j : -1; };
  const other = (names, j) => cols(names).find(q => q !== j) ?? -1;
  function global(names){
    const c = cols(names); let j = idx(names, S.fx); if (j < 0) j = c[0] ?? 1;
    let j2 = idx(names, S.fy); if (j2 < 0 || j2 === j) j2 = other(names, j);
    return { j, j2 };
  }
  /* opt.second: 'auto' (a second feature when one exists) or 'none' (only when the chart's own select asks for one) */
  function pick(names, id, opt = {}){
    const g = global(names), o = (id && S.ov[id]) || {};
    let j = idx(names, o.a); if (j < 0) j = g.j;
    let j2;
    if (o.b === 'none') j2 = -1;
    else if (idx(names, o.b) > 0) j2 = idx(names, o.b);
    else j2 = opt.second === 'none' ? -1 : g.j2;
    if (j2 === j) j2 = opt.second === 'none' && o.b == null ? -1 : other(names, j);
    return { j, j2 };
  }
  /* a pair of weights (index 0 = intercept) for the loss-surface chart */
  function pickW(names, id){
    const o = (id && S.ov[id]) || {}, g = global(names), p = names.length;
    const ok = v => v != null && v !== '' && +v >= 0 && +v < p;
    let a = ok(o.a) ? +o.a : (g.j2 > 0 ? g.j : 0), b = ok(o.b) ? +o.b : (g.j2 > 0 ? g.j2 : g.j);
    if (a === b) b = a === 0 ? (g.j || 1) : 0;
    return { a, b };
  }
  const adj = id => { const o = (id && S.ov[id]) || {}; return o.adj == null ? S.adj !== false : !!o.adj; };
  const set = (id, k, v) => { S.ov[id] = Object.assign({}, S.ov[id], { [k]: v }); };

  function holder(c){
    const t = c.tabsEl || c.wrap.querySelector('.chart-tabs');
    let h = t.querySelector('.fsel'); if (!h) { h = document.createElement('span'); h.className = 'fsel'; t.prepend(h); }
    return h;
  }
  const opt = (v, label, cur) => `<option value="${esc(String(v))}"${String(v) === String(cur ?? '') ? ' selected' : ''}>${esc(label)}</option>`;
  function sel(c, names, id, kind, redraw){
    const cs = cols(names), g = global(names), o = S.ov[id] || {};
    if (kind === 'wpair') {
      if (names.length < 3) return;
      const wl = j => j === 0 ? 'w̃₀ (intercept)' : `w̃ of ${names[j]}`, cur = pickW(names, id);
      const mk = k => `<select data-k="${k}" aria-label="${k === 'a' ? 'Weight on the across axis' : 'Weight on the up axis'}">${names.map((_, j) => opt(j, wl(j), cur[k])).join('')}</select>`;
      holder(c).innerHTML = `${mk('a')}<span class="fsel-x">×</span>${mk('b')}`;
    } else {
      if (cs.length < 2) return;
      const first = `<select data-k="a" aria-label="Feature on the across axis">${opt('', `global (${names[g.j]})`, o.a)}${cs.map(j => opt(names[j], names[j], o.a)).join('')}</select>`;
      let second = '';
      if (kind === 'pair') second = `<span class="fsel-x">×</span><select data-k="b" aria-label="Second feature">${opt('', `global (${names[g.j2]})`, o.b)}${cs.map(j => opt(names[j], names[j], o.b)).join('')}</select>`;
      if (kind === 'pairopt') second = `<span class="fsel-x">with</span><select data-k="b" aria-label="Second feature">${opt('', 'default', o.b)}${opt('none', 'nothing (one at a time)', o.b)}${cs.map(j => opt(names[j], names[j], o.b)).join('')}</select>`;
      holder(c).innerHTML = first + second;
    }
    holder(c).onchange = e => { const s = e.target.closest('select'); if (!s) return; set(id, s.dataset.k, s.value === '' ? undefined : s.value); redraw(); };
  }
  function adjBtn(c, id, redraw){
    const h = holder(c), b = document.createElement('button'); b.type = 'button'; b.className = 'fsel-adj';
    const lab = () => { const on = adj(id); b.textContent = on ? 'points: adjusted' : 'points: raw y'; b.setAttribute('aria-pressed', String(on)); b.title = on ? 'Each point is moved by the other features’ share of its prediction, so it sits exactly its residual away from the line. Click for the raw y.' : 'Raw y: the other features add vertical scatter. Click to adjust the points for them.'; };
    lab(); b.onclick = () => { set(id, 'adj', !adj(id)); lab(); redraw(); }; h.appendChild(b);
  }
  /* opt.keep: columns left as they are (per-group lines); opt.at: means to hold the other columns at */
  function slice(X, y, w, j, o = {}){
    const p = X[0].length, keep = o.keep || [], m = o.at || X[0].map((_, k) => ST.mean(X.map(r => r[k])));
    const others = [...Array(p).keys()].filter(k => k > 0 && k !== j && !keep.includes(k));
    const c0 = w[0] + others.reduce((s, k) => s + w[k] * m[k], 0);
    const ya = y.map((v, i) => v - others.reduce((s, k) => s + w[k] * (X[i][k] - m[k]), 0));
    return { c0, w: w[j], line: x => c0 + w[j] * x, y: ya, others, means: m };
  }
  /* the categorical columns (kept per group in slice lines) */
  const catCols = names => names.map((n, j) => j).filter(j => j > 0 && isC(names[j]));
  return { init, cols, catCols, global, pick, pickW, adj, sel, adjBtn, slice, setGlobal: (k, v) => { S[k] = v; onGlobal(); } };
})();
