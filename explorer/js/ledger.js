/* ============================================================
   Cohesion: how the data flows from step to step.
   For every step: a sentence that picks up from the previous step,
   what comes in (with links to the step that made it), what goes
   out (and which later steps use it), and the running data table:
   the same training rows, gaining a column each time a step creates
   something, with the new columns tinted.
   LEDGER.html(stepId, ctx)  LEDGER.flow(stepId)
   ============================================================ */
const LEDGER = (() => {
  const n = (v, d = 3) => typeof v === 'number' ? num(v, d) : v;
  const L = (label, step) => `<a href="#step-${step}" data-goto="step-${step}" class="ldg-l">${label} <small>(step ${step})</small></a>`;
  const FLOW = {
    1: { bridge: 'Everything starts here. We have inputs X (one column per measured feature) and answers y, and we want two unknown numbers per feature: the intercept b and the slope w in y = b + w·x + ε. ε, the noise, can never be observed.', in: [], out: [['X, y', 2], ['X, y', 3], ['X, y', 4]] },
    2: { bridge: 'Step 1 gave us the raw table X, y. Before anything learns from it, we check that its rows are trustworthy.', in: [['X, y', 1]], out: [['checked X, y', 3], ['checked X, y', 4]] },
    3: { bridge: 'The rows passed the checks in step 2. Now we look at them: shapes, relationships and overlaps, to know what the later steps must handle.', in: [['checked X, y', 2]], out: [['decisions about features', 5]] },
    4: { bridge: 'We know what the data look like (step 3). Before learning any number from them, we hide some rows so the final score is honest.', in: [['checked X, y', 2]], out: [['training rows', 5], ['test rows (held back)', 12]] },
    5: { bridge: 'From now on we work only with the training rows of step 4. Their inputs are put on a common ruler, using the training mean μ and spread s.', in: [['training rows x, y', 4]], out: [['x̃', 6], ['μ, s', 12], ['μ, s', 13]] },
    6: { bridge: 'Step 5 gave each training row its standardised inputs x̃. We stack them, with a column of 1s for the intercept, into one matrix X̃.', in: [['x̃', 5], ['y', 4]], out: [['X̃, y', 7], ['X̃, y', '9a'], ['X̃, y', '9b']] },
    7: { bridge: 'With the matrix X̃ from step 6 we can write the prediction rule. The weights w̃ in it are unknown here: step 9a finds them, and the numbers below already use those values.', in: [['X̃', 6], ['w̃', '9a']], out: [['ŷ', 8]] },
    8: { bridge: 'Step 7 gives a prediction ŷ for every training row. Comparing it with the true y from step 4 tells us how wrong each prediction is.', in: [['y', 4], ['ŷ', 7]], out: [['e, L', '9a'], ['e', 10], ['e', 11]] },
    '9a': { bridge: 'Step 8 defined the score L to minimise. Here we find the w̃ that makes it smallest, directly, by solving equations built from X̃ and y.', in: [['X̃, y', 6], ['L', 8]], out: [['w̃', 7], ['w̃', 10], ['w̃', 11], ['w̃', 12], ['w̃', 13]] },
    '9b': { bridge: 'The same minimum as step 9a, reached by repeated small steps downhill instead of solving equations.', in: [['X̃, y', 6], ['L', 8]], out: [['w̃ (same as 9a)', 10]] },
    10: { bridge: 'The best weights from step 9a leave residuals e (step 8). If the assumptions hold, those leftovers look like pure noise; each test checks one way they could fail to.', in: [['e', 8], ['ŷ', 7], ['X̃', 6]], out: [['which SE to trust', 11], ['a failed check → fix features', 5]] },
    11: { bridge: 'The checks in step 10 say which assumptions hold. Now we put a ± on the weights from step 9a, using the residuals from step 8.', in: [['w̃', '9a'], ['e', 8], ['X̃', 6], ['checks', 10]], out: [['SE, CI, p', 13]] },
    12: { bridge: 'Time for the rows hidden in step 4. They get the training μ and s from step 5 and the weights from step 9a: nothing is re-learned.', in: [['test rows', 4], ['μ, s', 5], ['w̃', '9a']], out: [['test RMSE, R²', 13]] },
    13: { bridge: 'Finally we undo the scaling of step 5 on the weights from step 9a, attach the uncertainty from step 11, and say what the numbers mean.', in: [['w̃', '9a'], ['μ, s', 5], ['SE', 11], ['test score', 12]], out: [] }
  };
  const ORDER = [1, 2, 3, 4, 5, 6, 7, 8, '9a', '9b', 10, 11, 12, 13];
  const at = id => ORDER.indexOf(isNaN(+id) ? id : +id);

  let memo = null;
  function prep(c){
    const P = c.P, d = c.d, key = P; if (memo && memo.key === key) return memo;
    const tr = P.tr, f = P.f, e = f.e, K = Math.min(5, tr.length), feat = d.names.slice(1);
    let bpHat = null, resetHat = null, zc = null;
    try { bpHat = ST.ols(P.Xtr, e.map(v => v * v), true).yhat; } catch (err) {}
    try { const m = ST.mean(f.yhat), s = ST.sd(f.yhat) || 1; zc = f.yhat.map(v => (v - m) / s); resetHat = ST.ols(P.Xtr.map((r, i) => [...r, zc[i] ** 2, zc[i] ** 3]), P.ytr, true).yhat; } catch (err) {}
    const j = d.focus[0], a = f.inv ? P.Xtr.map(r => LA.dot(f.inv[j], r)) : null;
    const cols = [
      ...feat.map((nm, q) => ({ h: nm, s: 1, v: k => d.X[tr[k]][q + 1] })),
      { h: 'y (true)', s: 1, v: k => d.y[tr[k]] },
      { h: 'checks', s: 2, v: k => P.dupFlag[tr[k]] ? 'duplicate' : P.outFlag[tr[k]] ? 'outlier' : 'ok' },
      ...feat.map((nm, q) => ({ h: `x̃ = (${nm} − μ)/s`, s: 5, v: k => P.Xtr[k][q + 1] })),
      { h: '1 (intercept)', s: 6, v: () => 1 },
      { h: 'ŷ = X̃w̃', s: 7, v: k => f.yhat[k] },
      { h: 'e = y − ŷ', s: 8, v: k => e[k] }, { h: 'e²', s: 8, v: k => e[k] ** 2 },
      { h: 'eₜ₋₁ (DW)', s: 10, v: k => k ? e[k - 1] : '—' }, ...(bpHat ? [{ h: 'ê² (BP fit)', s: 10, v: k => bpHat[k] }] : []),
      ...(resetHat ? [{ h: 'z (RESET)', s: 10, v: k => zc[k] }, { h: 'ŷ_with (RESET)', s: 10, v: k => resetHat[k] }] : []),
      ...(f.lev ? [{ h: 'h (leverage)', s: 10, v: k => f.lev[k] }, { h: "D (Cook)", s: 10, v: k => f.cook[k] }] : []),
      ...(a ? [{ h: `aᵢ (weight of the row in w̃ of ${d.names[j]})`, s: 11, v: k => a[k] }] : [])
    ];
    memo = { key, cols, K, tr }; return memo;
  }

  function table(stepId, c){
    const P = c.P, d = c.d, here = at(stepId);
    if (String(stepId) === '4') {
      const k = Math.min(d.y.length, 8);
      return `<div class="wk"><table><tr><th>row</th>${d.names.slice(1).map(x => `<th>${x}</th>`).join('')}<th>y (true)</th><th class="ldg-new">set</th></tr>` +
        [...Array(k).keys()].map(i => `<tr><td>${i + 1}</td>${d.X[i].slice(1).map(v => `<td>${n(v)}</td>`).join('')}<td>${n(d.y[i])}</td><td class="ldg-new">${P.isTrain[i] ? 'train' : '<b>test</b>'}</td></tr>`).join('') + `<tr class="gap"><td>⋮</td><td colspan="${d.names.length + 1}">⋮</td></tr></table></div>`;
    }
    if (String(stepId) === '12') {
      const k = Math.min(P.te.length, 6);
      return `<div class="wk"><table><tr><th>test row</th>${d.names.slice(1).map(x => `<th>${x}</th>`).join('')}<th>y (true)</th>${d.names.slice(1).map(x => `<th class="ldg-new">x̃ (${x}) with training μ, s</th>`).join('')}<th class="ldg-new">ŷ = X̃w̃</th><th class="ldg-new">e = y − ŷ</th></tr>` +
        [...Array(k).keys()].map(i => { const r = P.te[i]; return `<tr><td>${r + 1}</td>${d.X[r].slice(1).map(v => `<td>${n(v)}</td>`).join('')}<td>${n(d.y[r])}</td>${P.Xte[i].slice(1).map(v => `<td class="ldg-new">${n(v)}</td>`).join('')}<td class="ldg-new">${n(P.yhte[i])}</td><td class="ldg-new">${n(P.ete[i])}</td></tr>`; }).join('') + `</table></div>`;
    }
    const M = prep(c), cols = M.cols.filter(col => at(col.s) <= here && !(col.s === 2 && here > at(2) + 1)), K = M.K;
    const isNew = col => String(col.s) === String(stepId);
    return `<div class="wk"><table><tr><th>${here >= at(4) ? 'train row (original #)' : 'row'}</th>${cols.map(col => `<th class="${isNew(col) ? 'ldg-new' : ''}">${col.h}</th>`).join('')}</tr>` +
      [...Array(K).keys()].map(k => `<tr><td>${here >= at(4) ? M.tr[k] + 1 : k + 1}</td>${cols.map(col => `<td class="${isNew(col) ? 'ldg-new' : ''}">${n(col.v(here >= at(4) ? k : k))}</td>`).join('')}</tr>`).join('') +
      `<tr class="gap"><td>⋮</td><td colspan="${cols.length}">⋮</td></tr></table></div>`;
  }

  function html(stepId, c){
    const F = FLOW[stepId]; if (!F) return '';
    const noNew = { 3: 'Nothing new is added: exploring only looks at the data.', '9a': 'No new column: this step produces the weight vector w̃ that steps 7 and 8 use.', '9b': 'No new column: this step produces the same w̃ as step 9a.', 13: 'No new column: the weights are converted back to original units.' }[stepId] || '';
    let tb = ''; try { tb = table(stepId, c); } catch (err) { console.error(err); }
    return `<div class="ldg"><p class="ldg-b">${F.bridge}</p>
      <p class="ldg-io">${F.in.length ? `<span><b>Comes in:</b> ${F.in.map(([l, s]) => L(l, s)).join(' ')}</span>` : ''}${F.out.length ? `<span><b>Goes out:</b> ${F.out.map(([l, s]) => L(l, s)).join(' ')}</span>` : ''}</p>
      <details class="ldg-t"><summary>The data at this step${stepId === 4 ? ' (all rows, with their set)' : stepId === 12 ? ' (the test rows)' : ' (first training rows; the columns this step creates are tinted)'}</summary>${noNew ? `<p class="chg-q">${noNew}</p>` : ''}${tb}</details></div>`;
  }
  return { html, flow: id => FLOW[id] };
})();
