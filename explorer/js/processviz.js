/* ============================================================
   One visual per process step, built from PIPE.run output:
   what the dataset looks like at that step, before and after
   when the step changes it, or the plot a check is based on.
   PVIZ[stepId](el, ctx) fills el and returns charts to dispose.
   ============================================================ */
const PVIZ = (() => {
  const C = n => css(n);
  const TR = () => C('--floor'), TE = () => C('--residual'), FLAG = () => C('--normal');
  const rng = (a, pad = 0) => { const v = a.filter(isFinite); let lo = Math.min(...v), hi = Math.max(...v); if (!(hi > lo)) { lo -= 1; hi += 1; } return [lo - pad, hi + pad]; };
  const grid = (lo, hi, n = 60) => Array.from({ length: n + 1 }, (_, i) => lo + (hi - lo) * i / n);

  function box(el, cls = 'pv-row'){ const d = document.createElement('div'); d.className = cls; el.appendChild(d); return d; }
  function chart(parent, title, height, draw){ const c = new Chart(parent, { title, height }); c.wrap.classList.add('mini'); c.drawFn = () => draw(c); c.drawFn(); return c; }
  function note(parent, html){ const p = document.createElement('p'); p.className = 'pv-note'; p.innerHTML = html; parent.appendChild(p); }

  /* compact table of rows with optional per-row classes and a "…" gap */
  function table(parent, title, cols, rows, { rowCls = () => '', idx = null, max = 8, extra = null } = {}){
    const n = rows.length, show = n <= max + 1 ? [...rows.keys()] : [...[...Array(max - 1).keys()], -1, n - 1];
    let h = `<div class="pv-tbl"><div class="pv-tbl-h">${title}</div><table><tr><th>row</th>${cols.map(c => `<th>${c}</th>`).join('')}${extra ? `<th>${extra.head}</th>` : ''}</tr>`;
    for (const i of show) {
      if (i < 0) { h += `<tr class="gap"><td>⋮</td>${cols.map(() => '<td>⋮</td>').join('')}${extra ? '<td></td>' : ''}</tr>`; continue; }
      h += `<tr class="${rowCls(i)}"><td>${idx ? idx[i] + 1 : i + 1}</td>${rows[i].map(v => `<td>${typeof v === 'number' ? num(v, 2) : v}</td>`).join('')}${extra ? `<td>${extra.cell(i)}</td>` : ''}</tr>`;
    }
    const d = document.createElement('div'); d.innerHTML = h + `</table><div class="pv-tbl-f">${n} rows</div></div>`; parent.appendChild(d.firstChild);
  }
  function hist(c, vals, color, xName, { bins = 16, xr = null, overlay = null } = {}){
    const [lo, hi] = xr || rng(vals), w = (hi - lo) / bins, cnt = new Array(bins).fill(0);
    vals.forEach(v => { const k = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / w))); cnt[k]++; });
    c.begin([lo, hi], [0, Math.max(...cnt, 1)], xName, 'count');
    cnt.forEach((k, i) => k && c.rect(lo + i * w + w * 0.06, 0, lo + (i + 1) * w - w * 0.06, k, color, 0.65));
    if (overlay) overlay(c);
    c.end();
  }
  const firstFeat = ctx => ctx.d.X.map(r => r[1]);
  const fname = ctx => ctx.P.names[1];
  /* the feature a chart shows: its own header choice, else the Controls choice */
  const pick = (ctx, id, o) => FS.pick(ctx.d.names, id, o);
  const col = (X, j) => X.map(r => r[j]);
  const multi = ctx => FS.cols(ctx.d.names).length > 1 || FS.catCols(ctx.d.names).length > 0;
  const selOne = (c, ctx, id, redraw) => { FS.sel(c, ctx.d.names, id, 'one', redraw || c.drawFn); return c; };

  const V = {};
  /* 1. raw data as collected */
  V[1] = (el, ctx) => {
    const { d, P } = ctx, r = box(el), cols = [...P.names.slice(1), 'y'];
    table(r, 'The raw dataset', cols, d.X.map((x, i) => [...x.slice(1), d.y[i]]));
    const ch = chart(r, `y against ${fname(ctx)}, as collected`, 230, c => {
      const { j } = pick(ctx, 'v1'), xs = col(d.X, j); c.title(`y against ${P.names[j]}, as collected`); c.begin(rng(xs), rng(d.y), P.names[j], 'y');
      if (d.truth.fn && P.P === 2) c.line(grid(...rng(xs)).map(x => [x, d.truth.fn(x, 0)]), C('--ink'), 1.4, [5, 4], 0.8);
      xs.forEach((x, i) => c.dot([x, d.y[i]], C('--floor'), 3, false, 0.85)); c.end();
      c.legend([[C('--floor'), 'observations'], ...(d.truth.fn && P.P === 2 ? [[C('--ink'), 'true mean E[y | x]', true]] : [])]);
    });
    selOne(ch, ctx, 'v1');
    return [ch];
  };
  /* 2. cleaning: flagged rows */
  V[2] = (el, ctx) => {
    const { d, P } = ctx, r = box(el), cols = [...P.names.slice(1), 'y'];
    const flag = i => [P.dupFlag[i] && 'duplicate', P.outFlag[i] && '|z| > 3'].filter(Boolean).join(', ');
    const order = [...Array(P.N).keys()].sort((a, b) => (!!flag(b)) - (!!flag(a)) || a - b);
    table(r, 'Rows checked (flagged rows first)', cols, order.map(i => [...d.X[i].slice(1), d.y[i]]), { idx: order, rowCls: k => flag(order[k]) ? 'flag' : '', extra: { head: 'flag', cell: k => flag(order[k]) || '✓' } });
    const ch = chart(r, 'Flagged rows in the data', 230, c => {
      const { j } = pick(ctx, 'v2'), xs = col(d.X, j); c.begin(rng(xs), rng(d.y), P.names[j], 'y');
      xs.forEach((x, i) => c.dot([x, d.y[i]], C('--floor'), 3, false, 0.6));
      xs.forEach((x, i) => { if (flag(i)) c.dot([x, d.y[i]], FLAG(), 6, true); }); c.end();
      c.legend([[C('--floor'), 'clean'], [FLAG(), 'flagged']]);
    });
    selOne(ch, ctx, 'v2');
    note(el, P.dupes || P.outY + P.outX ? `Before: ${P.N} rows. A usual clean-up would remove ${P.dupes} duplicate row(s) and review the outliers, leaving about ${P.N - P.dupes}. Nothing is removed here, so the effect of the selected variant reaches every later step.` : `Before and after: ${P.N} rows. Nothing needed cleaning, so the dataset passes through unchanged.`);
    return [ch];
  };
  /* 3. EDA */
  /* a correlation heatmap of the numeric features and y; clicking a cell picks that pair for the scatter next to it */
  function heat(parent, ctx, onPick){
    const { d } = ctx, cs = FS.cols(d.names), lab = [...cs.map(j => d.names[j]), 'y'], vals = [...cs.map(j => col(d.X, j)), d.y], K = lab.length;
    const cor = (a, b) => { const ma = ST.mean(a), mb = ST.mean(b); let sab = 0, saa = 0, sbb = 0; a.forEach((v, i) => { sab += (v - ma) * (b[i] - mb); saa += (v - ma) ** 2; sbb += (b[i] - mb) ** 2; }); return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN; };
    const R = vals.map(a => vals.map(b => cor(a, b)));
    const cell = (r, a, b) => { const pct = isFinite(r) ? Math.round(Math.abs(r) * 100) : 0, tone = r >= 0 ? 'var(--surface)' : 'var(--normal)';
      return `<td class="hm-c${a === b ? ' hm-d' : ''}" ${a !== b ? `data-a="${a}" data-b="${b}" tabindex="0" role="button" aria-label="Show ${esc(lab[a])} against ${esc(lab[b])}"` : ''} style="background:color-mix(in srgb, ${tone} ${pct}%, var(--panel));${pct > 55 ? 'color:#fff' : ''}" title="r(${esc(lab[a])}, ${esc(lab[b])}) = ${num(r, 3)}">${isFinite(r) ? num(r, 2) : '—'}</td>`; };
    const box2 = document.createElement('div'); box2.className = 'chart mini hm';
    box2.innerHTML = `<div class="chart-head"><b>Correlation of every pair (click a cell to plot it)</b></div><div class="hm-wrap"><table class="hm-t"><tr><th></th>${lab.map(l => `<th>${esc(l)}</th>`).join('')}</tr>${R.map((row, a) => `<tr><th>${esc(lab[a])}</th>${row.map((r, b) => cell(r, a, b)).join('')}</tr>`).join('')}</table></div>
      <div class="chart-foot"><span><i style="border-top:3px solid ${C('--surface')}"></i>positive r</span><span><i style="border-top:3px solid ${C('--normal')}"></i>negative r</span><span>darker = stronger; the y row and column are each feature's r with y</span></div>`;
    parent.appendChild(box2);
    const go = t => { const c = t.closest('[data-a]'); if (!c) return; box2.querySelectorAll('.hm-on').forEach(x => x.classList.remove('hm-on')); c.classList.add('hm-on'); onPick(+c.dataset.a, +c.dataset.b, lab); };
    box2.addEventListener('click', e => go(e.target)); box2.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e.target); } });
    return box2;
  }
  V[3] = (el, ctx) => {
    const { d, P } = ctx, r = box(el, 'pv-row three'), out = [], names = d.names;
    out.push(chart(r, 'Distribution of y', 200, c => hist(c, d.y, C('--residual'), 'y')));
    const hc = chart(r, `Distribution of ${fname(ctx)}`, 200, c => { const { j } = pick(ctx, 'v3h'); c.title(`Distribution of ${names[j]}`); hist(c, col(d.X, j), C('--floor'), names[j]); });
    out.push(selOne(hc, ctx, 'v3h'));
    const yc = chart(r, `y against ${fname(ctx)}, with binned means`, 200, c => {
      const { j } = pick(ctx, 'v3y'), xs = col(d.X, j); c.title(`y against ${names[j]}, with binned means`);
      c.begin(rng(xs), rng(d.y), names[j], 'y'); xs.forEach((x, i) => c.dot([x, d.y[i]], C('--floor'), 2.8, false, 0.7));
      const idx = [...xs.keys()].sort((a, b) => xs[a] - xs[b]), B = 8, pts = [];
      for (let b = 0; b < B; b++) { const s = idx.slice(Math.floor(b * idx.length / B), Math.floor((b + 1) * idx.length / B)); if (s.length) pts.push([ST.mean(s.map(i => xs[i])), ST.mean(s.map(i => d.y[i]))]); }
      c.line(pts, C('--normal'), 2.4); c.end(); c.legend([[C('--normal'), 'average y in 8 bins: a bend means non-linear']]);
    });
    out.push(selOne(yc, ctx, 'v3y'));
    if (FS.cols(names).length > 1) {
      const r2 = box(el, 'pv-row');
      const pc = chart(r2, '', 260, c => {
        const { j, j2 } = pick(ctx, 'v3p'), xs = col(d.X, j), x2 = col(d.X, j2), rr = (() => { const ma = ST.mean(xs), mb = ST.mean(x2); let a = 0, b = 0, q = 0; xs.forEach((v, i) => { a += (v - ma) * (x2[i] - mb); b += (v - ma) ** 2; q += (x2[i] - mb) ** 2; }); return a / Math.sqrt(b * q); })();
        c.title(`${names[j]} against ${names[j2]}`); c.begin(rng(xs), rng(x2), names[j], names[j2]); xs.forEach((x, i) => c.dot([x, x2[i]], C('--surface'), 2.8, false, 0.8)); c.end(); c.legend([[C('--surface'), `r = ${num(rr, 3)}`]]);
      });
      FS.sel(pc, names, 'v3p', 'pair', pc.drawFn);
      heat(r2, ctx, (a, b, lab) => {
        const cs = FS.cols(names), ja = a < cs.length ? cs[a] : -1, jb = b < cs.length ? cs[b] : -1, S0 = ctx.S;
        if (ja > 0 && jb > 0) { S0.ov.v3p = Object.assign({}, S0.ov.v3p, { a: names[ja], b: names[jb] }); FS.sel(pc, names, 'v3p', 'pair', pc.drawFn); pc.drawFn(); pc.wrap.classList.remove('flash'); void pc.wrap.offsetWidth; pc.wrap.classList.add('flash'); }
        else { const jf = ja > 0 ? ja : jb; S0.ov.v3y = Object.assign({}, S0.ov.v3y, { a: names[jf] }); FS.sel(yc, names, 'v3y', 'one', yc.drawFn); yc.drawFn(); yc.wrap.classList.remove('flash'); void yc.wrap.offsetWidth; yc.wrap.classList.add('flash'); }
      });
      r2.appendChild(r2.firstChild); // heatmap first, the pair scatter after it
      out.push(pc);
    }
    note(el, 'Analysis only: the dataset does not change in this step. These pictures are what you look at to decide what the later steps need.' + (FS.cols(names).length > 1 ? ' Click a cell of the heatmap: a feature pair is drawn in the scatter beside it, and a feature-with-y cell switches the "y against" chart to that feature.' : ''));
    return out;
  };
  /* 4. split */
  V[4] = (el, ctx) => {
    const { d, P } = ctx, r = box(el), out = [];
    out.push(selOne(chart(r, 'Which rows went to train and test', 230, c => {
      const { j } = pick(ctx, 'v4'), xs = col(d.X, j); c.begin(rng(xs), rng(d.y), P.names[j], 'y'); xs.forEach((x, i) => c.dot([x, d.y[i]], P.isTrain[i] ? TR() : TE(), 3.2, !P.isTrain[i], 0.9)); c.end();
      c.legend([[TR(), `train (${P.nTr})`], [TE(), `test (${P.nTe}, hollow)`]]);
    }), ctx, 'v4'));
    out.push(chart(r, 'The split along row order (time)', 230, c => {
      c.begin([0.5, P.N + 0.5], [0, 1], 'row number (time order)', '', { noY: true });
      for (let i = 0; i < P.N; i++) c.rect(i + 0.55, P.isTrain[i] ? 0.15 : 0.55, i + 1.45, P.isTrain[i] ? 0.45 : 0.85, P.isTrain[i] ? TR() : TE(), 0.85);
      c.text('train', [1, 0.3], TR(), 4, 4, true); c.text('test', [1, 0.7], TE(), 4, 4, true); c.end();
      c.legend([[C('--muted'), 'random split: test rows sit between train rows, so neighbours share information if errors are correlated']]);
    }));
    note(el, `The dataset is now two datasets: ${P.nTr} training rows used for everything that learns, and ${P.nTe} test rows locked away until step 12.`);
    return out;
  };
  /* 5. standardise */
  V[5] = (el, ctx) => {
    const { P } = ctx, r = box(el), out = [], J = () => pick(ctx, 'v5').j;
    const raw = () => P.tr.map(i => ctx.d.X[i][J()]), rawTe = () => P.te.map(i => ctx.d.X[i][J()]), zTr = () => P.Xtr.map(x => x[J()]), zTe = () => P.Xte.map(x => x[J()]);
    const strip = (c, a, b, xName, m, s) => { const all = [...a, ...b]; c.begin(rng(all), [0, 1], xName, '', { noY: true });
      c.vrule(m, C('--ink'), null, 1.6); c.vrule(m - s, C('--muted'), [4, 4], 1.2); c.vrule(m + s, C('--muted'), [4, 4], 1.2);
      a.forEach((v, i) => c.dot([v, 0.3 + 0.35 * ((i * 0.618) % 1)], TR(), 3, false, 0.8)); b.forEach((v, i) => c.dot([v, 0.3 + 0.35 * ((i * 0.618) % 1)], TE(), 3.4, true));
      c.end(); };
    out.push(chart(r, `Before: raw ${fname(ctx)}`, 150, c => { const j = J(); c.title(`Before: raw ${P.names[j]}`); strip(c, raw(), rawTe(), P.names[j], P.mu[j], P.sd[j]); c.legend([[C('--ink'), `μ = ${num(P.mu[j], 2)}`], [C('--muted'), `μ ± s (s = ${num(P.sd[j], 2)})`, true], [TE(), 'test rows (hollow)']]); }));
    out.push(chart(r, `After: standardised x̃ = (x − μ) / s`, 150, c => { strip(c, zTr(), zTe(), `x̃ (${P.names[J()]})`, 0, 1); c.legend([[C('--ink'), 'mean 0'], [C('--muted'), '±1', true]]); }));
    selOne(out[0], ctx, 'v5', () => out.forEach(c => c.drawFn()));
    const r2 = box(el);
    table(r2, 'Training rows: raw → standardised', [...P.names.slice(1).map(n => n), ...P.names.slice(1).map(n => n + '̃')], P.tr.map((i, k) => [...ctx.d.X[i].slice(1), ...P.Xtr[k].slice(1)]), { idx: P.tr, max: 6 });
    note(el, 'The data changes here: every feature is shifted and rescaled using the training μ and s only. The test rows are transformed with the same numbers, so no information leaks from test into training.');
    return out;
  };
  /* 6. design matrix */
  V[6] = (el, ctx) => {
    const { P } = ctx, r = box(el), head = P.Xtr.slice(0, 6), rl = P.tr.slice(0, 6).map(i => String(i + 1));
    const d = document.createElement('div'); d.className = 'mx-grid';
    d.innerHTML = mx(P.nTr > 7 ? [...head, head[0].map(() => '⋮')] : head, { name: 'X̃', shape: `${P.nTr}×${P.P}`, formula: 'a column of 1s, then the standardised features', colLabels: P.names, rowLabels: P.nTr > 7 ? [...rl, ''] : rl, tone: 'floor', digits: 3 }) +
      mx(P.ytr.slice(0, 6).concat(P.nTr > 7 ? ['⋮'] : []), { name: 'y', shape: `${P.nTr}×1`, formula: 'training targets', tone: 'res', digits: 2 });
    r.appendChild(d);
    note(el, 'The training data is now in the form the algebra needs: one matrix for the inputs and one vector for the targets.');
    return [];
  };
  const partial = (P, w) => x => w[0] + w[1] * x; // standardised: other features at their mean, which is 0
  /* 7. model */
  /* a slice of the standardised fit through feature j: line and (optionally adjusted) points */
  const zslice = (ctx, id) => { const { P } = ctx, { j } = pick(ctx, id), adj = FS.adj(id) && multi(ctx), sl = FS.slice(P.Xtr, P.ytr, P.f.w, j);
    return { j, adj, xs: col(P.Xtr, j), ys: adj ? sl.y : P.ytr, sl, yname: adj ? 'y adjusted for the other features' : 'y' }; };
  const adjControls = (c, ctx, id) => { if (multi(ctx)) { selOne(c, ctx, id); FS.adjBtn(c, id, c.drawFn); } return c; };
  V[7] = (el, ctx) => {
    const { P } = ctx, r = box(el);
    const ch = chart(r, 'Every choice of w̃ is a different line; fitting picks one', 230, c => {
      const rnd = mulberry32(3), z = zslice(ctx, 'v7'), xr = rng(z.xs); c.begin(xr, rng(z.ys), `x̃ (${P.names[z.j]})`, z.yname);
      z.ys.forEach((v, i) => c.dot([z.xs[i], v], TR(), 3, false, 0.75));
      for (let k = 0; k < 7; k++) { const b0 = z.sl.c0 + (rnd() - 0.5) * 6, w1 = z.sl.w * (0.2 + 1.6 * rnd()); c.line(xr.map(x => [x, b0 + w1 * x]), C('--muted'), 1.2, null, 0.5); }
      c.line(xr.map(x => [x, z.sl.line(x)]), C('--surface'), 2.6); c.end();
      c.legend([[C('--muted'), 'other candidate lines'], [C('--surface'), multi(ctx) ? `the least-squares slice through ${P.names[z.j]} (found in step 9), other features at their mean 0` : 'the least-squares line (found in step 9)']]);
    });
    return [adjControls(ch, ctx, 'v7')];
  };
  /* 8. loss */
  V[8] = (el, ctx) => {
    const { P } = ctx, r = box(el), out = [];
    out.push(adjControls(chart(r, 'Residuals e = y − ŷ at the best fit', 230, c => {
      const z = zslice(ctx, 'v8'), xs = z.xs, xr = rng(xs), top = z.adj ? z.ys.map((v, i) => v - P.f.e[i]) : P.f.yhat;
      c.begin(xr, rng([...z.ys, ...top]), `x̃ (${P.names[z.j]})`, z.yname);
      xs.forEach((x, i) => c.line([[x, z.ys[i]], [x, top[i]]], C('--residual'), 1.4, null, 0.8));
      xs.forEach((x, i) => c.dot([x, z.ys[i]], TR(), 3)); if (P.P === 2 || z.adj) c.line(xr.map(x => [x, z.sl.line(x)]), C('--surface'), 2.2); c.end();
      c.legend([[C('--residual'), 'residual of each row'], [C('--surface'), z.adj ? 'fit (slice; adjusted points sit exactly e away from it)' : 'fit']]);
    }), ctx, 'v8'));
    out.push(chart(r, 'Squared residual of each training row', 230, c => {
      const e2 = P.f.e.map(v => v * v), m = ST.mean(e2); c.begin([0.5, e2.length + 0.5], [0, Math.max(...e2, m) * 1.05], 'training row', 'e²');
      e2.forEach((v, i) => c.rect(i + 0.6, 0, i + 1.4, v, C('--residual'), 0.7)); c.hline(m, C('--normal'), [6, 4], 2); c.end();
      c.legend([[C('--normal'), `their mean is the loss L = ${num(m, 3)}`, true]]);
    }));
    return out;
  };
  /* 9a. closed form */
  V['9a'] = (el, ctx) => {
    const { P } = ctx, r = box(el), d = document.createElement('div'); d.className = 'mx-grid';
    d.innerHTML = mx(P.f.XtX, { name: 'X̃ᵀX̃', formula: 'column-by-column dot products', colLabels: P.names, rowLabels: P.names, digits: 2 }) + `<div class="mx-op">·</div>` +
      mx(P.f.w, { name: 'w̃*', formula: P.f.full ? 'the solution' : 'minimum-norm solution', rowLabels: P.names, tone: 'surface' }) + `<div class="mx-op">=</div>` +
      mx(P.f.Xty, { name: 'X̃ᵀy', formula: 'each column · y', rowLabels: P.names, digits: 2 });
    r.appendChild(d);
    note(el, P.f.full ? 'The normal equations X̃ᵀX̃ w̃ = X̃ᵀy, with the solved w̃* in the middle: multiply them out and you get the right-hand side.' : 'X̃ᵀX̃ is singular, so many w̃ satisfy these equations; the solver returns the one with the smallest length.');
    return [];
  };
  /* 9b. gradient descent */
  V['9b'] = (el, ctx) => {
    const { P } = ctx, r = box(el), out = [], xs = P.Xtr.map(x => x[1]), Lmin = P.f.SSE / P.nTr;
    out.push(chart(r, 'Loss at each iteration (log scale)', 230, c => {
      const L = P.lossHist.map(x => isFinite(x) ? Math.min(x, 1e12) : 1e12), top = Math.max(...L); c.begin([0, L.length - 1], [Math.max(Math.min(...L, Lmin) * 0.9, 1e-6), top], 'iteration t', 'L (log scale)', { logY: true });
      c.hline(Lmin, C('--normal'), [6, 4], 1.6); c.line(L.map((v, i) => [i, v]), C('--surface'), 2.4);
      [0, 1, 2, 3].filter(t => t < L.length).forEach(t => c.dot([t, L[t]], C('--ink'), 3.5)); c.end();
      c.legend([[C('--surface'), 'gradient descent'], [C('--normal'), 'closed-form minimum', true]]);
    }));
    out.push(chart(r, P.P === 2 ? `The fitted line after t = 0, 1, 2, 3 and ${P.wHist.length - 1} steps` : 'Each weight across iterations', 230, c => {
      if (P.P === 2) {
        const xr = rng(xs); c.begin(xr, rng(P.ytr), `x̃ (${fname(ctx)})`, 'y'); P.ytr.forEach((v, i) => c.dot([xs[i], v], TR(), 2.6, false, 0.5));
        const last = P.wHist.length - 1; [0, 1, 2, 3, last].filter((t, k, a) => t <= last && a.indexOf(t) === k).forEach((t, k) => { const w = P.wHist[t]; if (!w.every(isFinite)) return; c.line(xr.map(x => [x, w[0] + w[1] * x]), C('--surface'), t === last ? 2.8 : 1.4, t === last ? null : [4, 3], 0.35 + 0.15 * k); });
        c.end();
        c.legend([[C('--surface'), `faint dashed: early steps; solid: after ${P.wHist.length - 1}`, true]]);
      } else {
        const T = 60, W = P.wHist.slice(0, T + 1), all = W.flat(); c.begin([0, T], rng(all), 'iteration t', 'w̃_j');
        P.names.forEach((n, j) => c.line(W.map((w, t) => [t, w[j]]), `hsl(${(j * 360 / P.P + 160) % 360} 55% 45%)`, 2));
        c.end(); c.legend(P.names.map((n, j) => [`hsl(${(j * 360 / P.P + 160) % 360} 55% 45%)`, n === '1' ? 'w̃₀' : n]));
      }
    }));
    if (P.f.XtX && P.wHist.length > 1) {
      const r2 = box(el, 'pv-row one'), N = P.nTr, A = P.f.XtX, bv = P.f.Xty, yy = P.ytr.reduce((s2, v) => s2 + v * v, 0), ws = P.f.w;
      const L = w => (yy - 2 * LA.dot(w, bv) + LA.dot(w, LA.mv(A, w))) / N;
      const lc = chart(r2, '', 300, c => {
        const { a, b } = FS.pickW(P.names, 'v9w'), wl = j => j === 0 ? 'w̃₀ (intercept)' : `w̃ of ${P.names[j]}`;
        const path = P.wHist.filter(w => w.every(isFinite) && Math.abs(w[a]) < 1e6 && Math.abs(w[b]) < 1e6);
        const pa = [...path.map(w => w[a]), ws[a]], pb = [...path.map(w => w[b]), ws[b]];
        let [a0, a1] = rng(pa), [b0, b1] = rng(pb); const sa = Math.max(a1 - a0, 0.5) * 0.25, sb = Math.max(b1 - b0, 0.5) * 0.25; a0 -= sa; a1 += sa; b0 -= sb; b1 += sb;
        c.title(`The loss surface over ${wl(a)} and ${wl(b)}, with the gradient-descent path`);
        c.begin([a0, a1], [b0, b1], wl(a), wl(b));
        const G = 44, vals = [], at = (u, v) => { const w = ws.slice(); w[a] = u; w[b] = v; return L(w); };
        for (let p2 = 0; p2 < G; p2++) for (let q = 0; q < G; q++) vals.push(Math.log(at(a0 + (a1 - a0) * (p2 + 0.5) / G, b0 + (b1 - b0) * (q + 0.5) / G)));
        const lo = Math.min(...vals), hi = Math.max(...vals), lev = 9;
        for (let p2 = 0; p2 < G; p2++) for (let q = 0; q < G; q++) { const t = (vals[p2 * G + q] - lo) / (hi - lo || 1), band = Math.floor(t * lev) / lev;
          c.rect(a0 + (a1 - a0) * p2 / G, b0 + (b1 - b0) * q / G, a0 + (a1 - a0) * (p2 + 1) / G, b0 + (b1 - b0) * (q + 1) / G, C('--surface'), 0.55 * (1 - band) + 0.04); }
        c.line(path.map(w => [w[a], w[b]]), C('--normal'), 2); path.slice(0, 4).forEach(w => c.dot([w[a], w[b]], C('--normal'), 3.4));
        c.dot([ws[a], ws[b]], C('--ink'), 5.5, true); c.text('w̃* (step 9a)', [ws[a], ws[b]], C('--ink'), 8, -8, true); c.end();
        c.legend([[C('--surface'), `darker = lower loss; ${P.P > 2 ? `the other ${P.P - 2} weight(s) held at their best values w̃*` : 'this is the whole loss surface'}`], [C('--normal'), `gradient-descent path (${path.length - 1} steps, first 4 dotted)`], [C('--ink'), 'closed-form minimum']]);
      });
      FS.sel(lc, P.names, 'v9w', 'wpair', lc.drawFn); out.push(lc);
      note(el, P.P > 2 ? `The surface is a slice of the ${P.P}-dimensional bowl through w̃*: the other weights are fixed at their best values. Gradient descent moves all ${P.P} weights at once, so its path (projected onto these two axes) does not have to cross these contours at right angles; it still ends at w̃*. Long, thin contours mean correlated features (a large κ, step 6) and slow progress along the valley.` : 'Each contour band is one level of the loss L(w̃₀, w̃₁). Gradient descent starts far away, moves downhill (at right angles to the contours), and ends at the closed-form minimum. A long, thin bowl would mean a large κ (step 6) and slow progress.');
    }
    note(el, `Each step: predict ŷ = X̃w̃, compute e = y − ŷ, form ∇L = −(2/N)X̃ᵀe, and move w̃ a distance η = ${num(P.eta, 4)} against it. The weights change; the data does not.`);
    return out;
  };
  /* 10. diagnostics */
  V[10] = (el, ctx) => {
    note(el, 'Analysis only: these are the training residuals e from step 8, left by the weights of step 9a. The data do not change here. Each test below comes with the picture it summarises.');
    return [];
  };
  /* 11. inference: confidence intervals under each SE */
  V[11] = (el, ctx) => {
    const { P, d } = ctx, r = box(el), tc = P.f.tc || 1.96;
    const rowsOf = j => [['classical', P.seOrig[j]], ['HC1 (robust)', P.hc?.[j]], [`Newey–West`, P.nw?.se[j]], ...(P.cl ? [['clustered', P.cl.se[j]]] : [])].filter(r => isFinite(r[1]));
    if (!rowsOf(ctx.focus).length) { note(el, 'No interval can be drawn: the coefficient is not identifiable because X̃ᵀX̃ has no inverse.'); return []; }
    const ch = chart(r, `95% confidence interval for the ${P.names[ctx.focus]} slope under each standard error`, 60 + 34 * rowsOf(ctx.focus).length, c => {
      const { j } = pick(ctx, 'v11'), w = P.wOrig[j], truth = d.truth.coef[j], rows = rowsOf(j);
      c.title(`95% confidence interval for the ${P.names[j]} slope under each standard error`);
      if (!rows.length) { c.begin([0, 1], [0, 1], '', '', { noY: true }); c.text('Not identifiable: X̃ᵀX̃ has no inverse.', [0.03, 0.5], C('--muted'), 0, 0, true); c.end(); c.legend([]); return; }
      const ends = rows.flatMap(([, s]) => [w - tc * s, w + tc * s]); if (truth != null) ends.push(truth);
      c.begin(rng(ends, 0), [0.4, rows.length + 0.6], `coefficient of ${P.names[j]}`, '', { noY: true });
      if (truth != null) c.vrule(truth, C('--normal'), null, 2);
      rows.forEach(([lab, s], k) => { const y = rows.length - k, cov = truth == null || (w - tc * s <= truth && truth <= w + tc * s);
        c.line([[w - tc * s, y], [w + tc * s, y]], cov ? C('--floor') : C('--residual'), 4); c.dot([w, y], C('--ink'), 4); c.text(lab, [w - tc * s, y], C('--ink'), 0, -9, true); });
      c.end(); c.legend([[C('--floor'), 'covers the true value'], [C('--residual'), 'misses it'], ...(truth != null ? [[C('--normal'), `true value ${truth}`]] : [])]);
    });
    selOne(ch, ctx, 'v11');
    note(el, 'Same estimate, different uncertainty: each standard error makes a different interval around it. The right one depends on what step 10 found.');
    return [ch];
  };
  /* 12. test */
  V[12] = (el, ctx) => {
    const { P } = ctx, r = box(el), all = [...P.ytr, ...P.yte, ...P.f.yhat, ...P.yhte];
    const ch = chart(r, 'Predicted vs actual: training and test rows', 240, c => {
      const xr = rng(all); c.begin(xr, xr, 'actual y', 'predicted ŷ'); c.line([xr, xr].map((_, k) => [xr[k], xr[k]]), C('--ink'), 1.2, [5, 4]);
      P.ytr.forEach((v, i) => c.dot([v, P.f.yhat[i]], TR(), 2.8, false, 0.7)); P.yte.forEach((v, i) => c.dot([v, P.yhte[i]], TE(), 4, true)); c.end();
      c.legend([[TR(), `train, RMSE ${num(P.rmseTr, 3)}`], [TE(), `test (hollow), RMSE ${num(P.rmseTe, 3)}`], [C('--ink'), 'perfect prediction', true]]);
    });
    note(el, `The ${P.nTe} test rows were standardised with the training μ and s from step 5, then passed through the same w̃.`);
    return [ch];
  };
  /* 13. original scale */
  V[13] = (el, ctx) => {
    const { P, d } = ctx, r = box(el), means = d.X[0].map((_, j) => ST.mean(d.X.map(x => x[j])));
    const ch = chart(r, 'The final model, back in original units', 240, c => {
      const { j } = pick(ctx, 'v13'), adj = FS.adj('v13') && multi(ctx), xs = col(d.X, j), sl = FS.slice(d.X, d.y, P.wOrig, j, { at: means }), ys = adj ? sl.y : d.y;
      const xr = rng(xs); c.begin(xr, rng(ys), P.names[j], adj ? 'y adjusted for the other features' : 'y'); xs.forEach((x, i) => c.dot([x, ys[i]], P.isTrain[i] ? TR() : TE(), 2.8, !P.isTrain[i], 0.7));
      if (d.truth.fn && P.P === 2) c.line(grid(...xr).map(x => [x, d.truth.fn(x, 0)]), C('--ink'), 1.4, [5, 4]);
      c.line(xr.map(x => [x, sl.line(x)]), C('--surface'), 2.6); c.end();
      c.legend([[C('--surface'), P.P > 2 ? `ŷ = ${num(sl.c0, 2)} + ${num(P.wOrig[j], 2)}·${P.names[j]} (every other column at its mean; ${num(sl.c0, 2)} = b + Σ w·mean)` : `ŷ = ${num(P.wOrig[0], 2)} + ${num(P.wOrig[1], 2)}·${P.names[1]}`], ...(adj ? [[TR(), 'points: y − Σ w·(x − mean) over the other columns (hollow = test rows)']] : []), ...(d.truth.fn && P.P === 2 ? [[C('--ink'), 'true mean', true]] : [])]);
    });
    return [adjControls(ch, ctx, 'v13')];
  };
  return V;
})();
