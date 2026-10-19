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

  const V = {};
  /* 1. raw data as collected */
  V[1] = (el, ctx) => {
    const { d, P } = ctx, r = box(el), cols = [...P.names.slice(1), 'y'];
    table(r, 'The raw dataset', cols, d.X.map((x, i) => [...x.slice(1), d.y[i]]));
    const ch = chart(r, `y against ${fname(ctx)}, as collected`, 230, c => {
      const xs = firstFeat(ctx); c.begin(rng(xs), rng(d.y), fname(ctx), 'y');
      if (d.truth.fn && P.P === 2) c.line(grid(...rng(xs)).map(x => [x, d.truth.fn(x, 0)]), C('--ink'), 1.4, [5, 4], 0.8);
      xs.forEach((x, i) => c.dot([x, d.y[i]], C('--floor'), 3, false, 0.85)); c.end();
      c.legend([[C('--floor'), 'observations'], ...(d.truth.fn && P.P === 2 ? [[C('--ink'), 'true mean E[y | x]', true]] : [])]);
    });
    return [ch];
  };
  /* 2. cleaning: flagged rows */
  V[2] = (el, ctx) => {
    const { d, P } = ctx, r = box(el), cols = [...P.names.slice(1), 'y'];
    const flag = i => [P.dupFlag[i] && 'duplicate', P.outFlag[i] && '|z| > 3'].filter(Boolean).join(', ');
    const order = [...Array(P.N).keys()].sort((a, b) => (!!flag(b)) - (!!flag(a)) || a - b);
    table(r, 'Rows checked (flagged rows first)', cols, order.map(i => [...d.X[i].slice(1), d.y[i]]), { idx: order, rowCls: k => flag(order[k]) ? 'flag' : '', extra: { head: 'flag', cell: k => flag(order[k]) || '✓' } });
    const ch = chart(r, 'Flagged rows in the data', 230, c => {
      const xs = firstFeat(ctx); c.begin(rng(xs), rng(d.y), fname(ctx), 'y');
      xs.forEach((x, i) => c.dot([x, d.y[i]], C('--floor'), 3, false, 0.6));
      xs.forEach((x, i) => { if (flag(i)) c.dot([x, d.y[i]], FLAG(), 6, true); }); c.end();
      c.legend([[C('--floor'), 'clean'], [FLAG(), 'flagged']]);
    });
    note(el, P.dupes || P.outY + P.outX ? `Before: ${P.N} rows. A usual clean-up would remove ${P.dupes} duplicate row(s) and review the outliers, leaving about ${P.N - P.dupes}. Nothing is removed here, so the effect of the selected variant reaches every later step.` : `Before and after: ${P.N} rows. Nothing needed cleaning, so the dataset passes through unchanged.`);
    return [ch];
  };
  /* 3. EDA */
  V[3] = (el, ctx) => {
    const { d, P } = ctx, r = box(el, 'pv-row three'), xs = firstFeat(ctx), out = [];
    out.push(chart(r, 'Distribution of y', 200, c => hist(c, d.y, C('--residual'), 'y')));
    out.push(chart(r, `Distribution of ${fname(ctx)}`, 200, c => hist(c, xs, C('--floor'), fname(ctx))));
    if (P.P > 2 && d.x2) out.push(chart(r, `${P.names[1]} against ${P.names[2]}`, 200, c => { c.begin(rng(xs), rng(d.x2), P.names[1], P.names[2]); xs.forEach((x, i) => c.dot([x, d.x2[i]], C('--surface'), 2.8, false, 0.8)); c.end(); c.legend([[C('--surface'), `r = ${num(P.eda.maxFeatCorr, 3)}`]]); }));
    else out.push(chart(r, `y against ${fname(ctx)}, with binned means`, 200, c => {
      c.begin(rng(xs), rng(d.y), fname(ctx), 'y'); xs.forEach((x, i) => c.dot([x, d.y[i]], C('--floor'), 2.8, false, 0.7));
      const idx = [...xs.keys()].sort((a, b) => xs[a] - xs[b]), B = 8, pts = [];
      for (let b = 0; b < B; b++) { const s = idx.slice(Math.floor(b * idx.length / B), Math.floor((b + 1) * idx.length / B)); if (s.length) pts.push([ST.mean(s.map(i => xs[i])), ST.mean(s.map(i => d.y[i]))]); }
      c.line(pts, C('--normal'), 2.4); c.end(); c.legend([[C('--normal'), 'average y in 8 bins: a bend means non-linear']]);
    }));
    note(el, 'Analysis only: the dataset does not change in this step. These pictures are what you look at to decide what the later steps need.');
    return out;
  };
  /* 4. split */
  V[4] = (el, ctx) => {
    const { d, P } = ctx, r = box(el), out = [], xs = firstFeat(ctx);
    out.push(chart(r, 'Which rows went to train and test', 230, c => {
      c.begin(rng(xs), rng(d.y), fname(ctx), 'y'); xs.forEach((x, i) => c.dot([x, d.y[i]], P.isTrain[i] ? TR() : TE(), 3.2, !P.isTrain[i], 0.9)); c.end();
      c.legend([[TR(), `train (${P.nTr})`], [TE(), `test (${P.nTe}, hollow)`]]);
    }));
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
    const { P } = ctx, r = box(el), out = [], j = 1;
    const raw = P.tr.map(i => ctx.d.X[i][j]), rawTe = P.te.map(i => ctx.d.X[i][j]), zTr = P.Xtr.map(x => x[j]), zTe = P.Xte.map(x => x[j]);
    const strip = (c, a, b, xName, m, s) => { const all = [...a, ...b]; c.begin(rng(all), [0, 1], xName, '', { noY: true });
      c.vrule(m, C('--ink'), null, 1.6); c.vrule(m - s, C('--muted'), [4, 4], 1.2); c.vrule(m + s, C('--muted'), [4, 4], 1.2);
      a.forEach((v, i) => c.dot([v, 0.3 + 0.35 * ((i * 0.618) % 1)], TR(), 3, false, 0.8)); b.forEach((v, i) => c.dot([v, 0.3 + 0.35 * ((i * 0.618) % 1)], TE(), 3.4, true));
      c.end(); };
    out.push(chart(r, `Before: raw ${fname(ctx)}`, 150, c => { strip(c, raw, rawTe, fname(ctx), P.mu[j], P.sd[j]); c.legend([[C('--ink'), `μ = ${num(P.mu[j], 2)}`], [C('--muted'), `μ ± s (s = ${num(P.sd[j], 2)})`, true], [TE(), 'test rows (hollow)']]); }));
    out.push(chart(r, `After: standardised x̃ = (x − μ) / s`, 150, c => { strip(c, zTr, zTe, `x̃ (${fname(ctx)})`, 0, 1); c.legend([[C('--ink'), 'mean 0'], [C('--muted'), '±1', true]]); }));
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
  V[7] = (el, ctx) => {
    const { P } = ctx, r = box(el), xs = P.Xtr.map(x => x[1]), rnd = mulberry32(3);
    const ch = chart(r, 'Every choice of w̃ is a different line; fitting picks one', 230, c => {
      const xr = rng(xs); c.begin(xr, rng(P.ytr), `x̃ (${fname(ctx)})`, 'y');
      P.ytr.forEach((v, i) => c.dot([xs[i], v], TR(), 3, false, 0.75));
      for (let k = 0; k < 7; k++) { const w = [P.f.w[0] + (rnd() - 0.5) * 6, P.f.w[1] * (0.2 + 1.6 * rnd())]; c.line(xr.map(x => [x, partial(P, w)(x)]), C('--muted'), 1.2, null, 0.5); }
      c.line(xr.map(x => [x, partial(P, P.f.w)(x)]), C('--surface'), 2.6); c.end();
      c.legend([[C('--muted'), 'other candidate lines'], [C('--surface'), 'the least-squares line (found in step 9)']]);
    });
    return [ch];
  };
  /* 8. loss */
  V[8] = (el, ctx) => {
    const { P } = ctx, r = box(el), xs = P.Xtr.map(x => x[1]), out = [];
    out.push(chart(r, 'Residuals e = y − ŷ at the best fit', 230, c => {
      const xr = rng(xs); c.begin(xr, rng([...P.ytr, ...P.f.yhat]), `x̃ (${fname(ctx)})`, 'y');
      xs.forEach((x, i) => c.line([[x, P.ytr[i]], [x, P.f.yhat[i]]], C('--residual'), 1.4, null, 0.8));
      xs.forEach((x, i) => c.dot([x, P.ytr[i]], TR(), 3)); if (P.P === 2) c.line(xr.map(x => [x, partial(P, P.f.w)(x)]), C('--surface'), 2.2); c.end();
      c.legend([[C('--residual'), 'residual of each row'], [C('--surface'), 'fit']]);
    }));
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
      const L = P.lossHist; c.begin([0, L.length - 1], [Math.max(Math.min(...L, Lmin) * 0.9, 1e-6), L[0]], 'iteration t', 'L', { logY: true });
      c.hline(Lmin, C('--normal'), [6, 4], 1.6); c.line(L.map((v, i) => [i, v]), C('--surface'), 2.4);
      [0, 1, 2, 3].forEach(t => c.dot([t, L[t]], C('--ink'), 3.5)); c.end();
      c.legend([[C('--surface'), 'gradient descent'], [C('--normal'), 'closed-form minimum', true]]);
    }));
    out.push(chart(r, P.P === 2 ? 'The fitted line after t = 0, 1, 2, 3 and 400 steps' : 'Each weight across iterations', 230, c => {
      if (P.P === 2) {
        const xr = rng(xs); c.begin(xr, rng(P.ytr), `x̃ (${fname(ctx)})`, 'y'); P.ytr.forEach((v, i) => c.dot([xs[i], v], TR(), 2.6, false, 0.5));
        [0, 1, 2, 3, 400].forEach((t, k) => { const w = P.wHist[t]; c.line(xr.map(x => [x, w[0] + w[1] * x]), C('--surface'), t === 400 ? 2.8 : 1.4, t === 400 ? null : [4, 3], 0.35 + 0.15 * k); });
        c.end();
        c.legend([[C('--surface'), 'faint dashed: early steps; solid: after 400', true]]);
      } else {
        const T = 60, W = P.wHist.slice(0, T + 1), all = W.flat(); c.begin([0, T], rng(all), 'iteration t', 'w̃_j');
        P.names.forEach((n, j) => c.line(W.map((w, t) => [t, w[j]]), `hsl(${(j * 360 / P.P + 160) % 360} 55% 45%)`, 2));
        c.end(); c.legend(P.names.map((n, j) => [`hsl(${(j * 360 / P.P + 160) % 360} 55% 45%)`, n === '1' ? 'w̃₀' : n]));
      }
    }));
    note(el, `Each step: predict ŷ = X̃w̃, compute e = y − ŷ, form ∇L = −(2/N)X̃ᵀe, and move w̃ a distance η = ${num(P.eta, 4)} against it. The weights change; the data does not.`);
    return out;
  };
  /* 10. diagnostics */
  V[10] = (el, ctx) => {
    const { P } = ctx, r = box(el, 'pv-row three'), e = P.f.e, yh = P.f.yhat, n = e.length, out = [];
    out.push(chart(r, 'Residuals vs fitted', 190, c => { c.begin(rng(yh), rng(e), 'ŷ', 'e'); c.hline(0, C('--ink'), [4, 4]); yh.forEach((v, i) => c.dot([v, e[i]], TR(), 2.8, false, 0.8)); c.end(); c.legend([[C('--muted'), 'pattern → linearity or variance problem']]); }));
    out.push(chart(r, 'Residuals in row (time) order', 190, c => { c.begin([1, n], rng(e), 'training row, in time order', 'e'); c.hline(0, C('--ink'), [4, 4]); c.line(e.map((v, i) => [i + 1, v]), C('--muted'), 1); e.forEach((v, i) => c.dot([i + 1, v], TR(), 2.6)); c.end(); c.legend([[C('--muted'), 'long runs → autocorrelation']]); }));
    out.push(chart(r, 'Normal Q–Q', 190, c => {
      const s = Math.sqrt(P.f.s2) || 1, z = e.map(v => v / s).sort((a, b) => a - b), q = z.map((_, i) => invNorm((i + 0.5) / n)), m = Math.max(...z.map(Math.abs), ...q.map(Math.abs));
      c.begin([-m, m], [-m, m], 'normal quantile', 'standardised e'); c.line([[-m, -m], [m, m]], C('--ink'), 1.2, [4, 4]); z.forEach((v, i) => c.dot([q[i], v], TR(), 2.6)); c.end(); c.legend([[C('--muted'), 'bends away → non-normal errors']]);
    }));
    note(el, 'Analysis only: these are the training residuals from step 9. The data does not change; the tests in this step summarise these pictures in numbers.');
    return out;
  };
  /* 11. inference: confidence intervals under each SE */
  V[11] = (el, ctx) => {
    const { P, d } = ctx, j = ctx.focus, r = box(el), w = P.wOrig[j], tc = P.f.tc || 1.96, truth = d.truth.coef[j];
    const rows = [['classical', P.seOrig[j]], ['HC1 (robust)', P.hc?.[j]], [`Newey–West`, P.nw?.se[j]], ...(P.cl ? [['clustered', P.cl.se[j]]] : [])].filter(r => isFinite(r[1]));
    if (!rows.length) { note(el, 'No interval can be drawn: the coefficient is not identifiable because X̃ᵀX̃ has no inverse.'); return []; }
    const ch = chart(r, `95% confidence interval for the ${P.names[j]} slope under each standard error`, 60 + 34 * rows.length, c => {
      const ends = rows.flatMap(([, s]) => [w - tc * s, w + tc * s]); if (truth != null) ends.push(truth);
      c.begin(rng(ends, 0), [0.4, rows.length + 0.6], `coefficient of ${P.names[j]}`, '', { noY: true });
      if (truth != null) c.vrule(truth, C('--normal'), null, 2);
      rows.forEach(([lab, s], k) => { const y = rows.length - k, cov = truth == null || (w - tc * s <= truth && truth <= w + tc * s);
        c.line([[w - tc * s, y], [w + tc * s, y]], cov ? C('--floor') : C('--residual'), 4); c.dot([w, y], C('--ink'), 4); c.text(lab, [w - tc * s, y], C('--ink'), 0, -9, true); });
      c.end(); c.legend([[C('--floor'), 'covers the true value'], [C('--residual'), 'misses it'], ...(truth != null ? [[C('--normal'), `true value ${truth}`]] : [])]);
    });
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
    const { P, d } = ctx, r = box(el), xs = firstFeat(ctx), means = d.X[0].map((_, j) => ST.mean(d.X.map(x => x[j])));
    const ch = chart(r, 'The final model, back in original units', 240, c => {
      const xr = rng(xs); c.begin(xr, rng(d.y), fname(ctx), 'y'); xs.forEach((x, i) => c.dot([x, d.y[i]], P.isTrain[i] ? TR() : TE(), 2.8, !P.isTrain[i], 0.7));
      const at = x => P.wOrig[0] + P.wOrig[1] * x + P.wOrig.slice(2).reduce((s, w, k) => s + w * means[k + 2], 0);
      if (d.truth.fn && P.P === 2) c.line(grid(...xr).map(x => [x, d.truth.fn(x, 0)]), C('--ink'), 1.4, [5, 4]);
      c.line(xr.map(x => [x, at(x)]), C('--surface'), 2.6); c.end();
      c.legend([[C('--surface'), `ŷ = ${num(P.wOrig[0], 2)} + ${num(P.wOrig[1], 2)}·${fname(ctx)}${P.P > 2 ? ' + …' : ''}`], ...(d.truth.fn && P.P === 2 ? [[C('--ink'), 'true mean', true]] : [])]);
    });
    return [ch];
  };
  return V;
})();
