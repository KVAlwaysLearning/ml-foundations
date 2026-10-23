/* ============================================================
   "How this regression is run": every time the app says
   "regress A on B" (Breusch–Pagan, RESET, VIF, the F-test's
   intercept-only model, the main fit itself), this block shows
   the same steps as the main fit (6 → 9a) on that regression's
   own numbers: what plays y, what plays X, XᵀX and Xᵀt, the
   solution (by formula or step-by-step elimination), the row-by-
   row predictions and residuals, SSE, SST, R², and the check
   that the residuals are uncorrelated with every column.
   REG.block(X, t, opts) -> HTML.   REG.fit(X, t) -> numbers.
   ============================================================ */
const REG = (() => {
  const n = (v, d = 4) => num(v, d), sum = a => a.reduce((s, v) => s + v, 0);
  const mtx = (M, rl, cl, d = 4) => `<div class="rmx"><table>${cl ? `<tr><th></th>${cl.map(c => `<th>${c}</th>`).join('')}</tr>` : ''}${M.map((r, i) => `<tr><th>${rl ? rl[i] : ''}</th>${(Array.isArray(r) ? r : [r]).map(v => `<td>${typeof v === 'number' ? n(v, d) : v}</td>`).join('')}</tr>`).join('')}</table></div>`;

  /* Gaussian elimination with recorded stages; returns { c, stages, singular } */
  function solve(A, b){
    const p = A.length, M = A.map((r, i) => [...r, b[i]]), stages = [{ note: 'Start: the normal equations written as one table [XᵀX | Xᵀt]', M: M.map(r => [...r]) }];
    for (let k = 0; k < p; k++) {
      let piv = k; for (let i = k + 1; i < p; i++) if (Math.abs(M[i][k]) > Math.abs(M[piv][k])) piv = i;
      if (Math.abs(M[piv][k]) < 1e-9 * Math.max(1, ...A.map(r => Math.max(...r.map(Math.abs))))) return { c: null, stages, singular: true };
      if (piv !== k) { [M[k], M[piv]] = [M[piv], M[k]]; }
      const ops = [];
      for (let i = k + 1; i < p; i++) { const f = M[i][k] / M[k][k]; if (Math.abs(f) < 1e-15) continue; for (let j = k; j <= p; j++) M[i][j] -= f * M[k][j]; ops.push(`row ${i + 1} − ${n(f, 4)} × row ${k + 1}`); }
      if (ops.length) stages.push({ note: `Clear column ${k + 1} below the diagonal${piv !== k ? ` (rows ${k + 1} and ${piv + 1} swapped first, to divide by the larger number)` : ''}: ${ops.join('; ')}`, M: M.map(r => [...r]) });
    }
    const c = new Array(p).fill(0), back = [];
    for (let i = p - 1; i >= 0; i--) { let r = M[i][p]; const terms = []; for (let j = i + 1; j < p; j++) { r -= M[i][j] * c[j]; terms.push(`${n(M[i][j], 4)} × ${n(c[j], 4)}`); }
      c[i] = r / M[i][i]; back.push({ i, txt: `c${'₀₁₂₃₄₅₆₇₈₉'[i] || i} = (${n(M[i][p], 4)}${terms.length ? ' − ' + terms.join(' − ') : ''}) / ${n(M[i][i], 4)} = <b>${n(c[i], 4)}</b>` }); }
    return { c, stages, back: back.reverse(), singular: false };
  }

  function fit(X, t){
    const N = X.length, p = X[0].length, XT = LA.T(X), A = LA.mul(XT, X), b = LA.mv(XT, t), sol = solve(A, b);
    const c = sol.c || LA.minimizer(A, b).w, yh = X.map(r => LA.dot(r, c)), e = t.map((v, i) => v - yh[i]), m = sum(t) / N;
    const SSE = sum(e.map(v => v * v)), SST = sum(t.map(v => (v - m) ** 2));
    return { N, p, A, b, sol, c, yh, e, SSE, SST, R2: SST > 0 ? 1 - SSE / SST : NaN, mean: m, orth: LA.mv(XT, e) };
  }

  /* opts: { cols: names of X columns, target: name of t, from: where t comes from, colsFrom: where the columns come from, title, k } */
  function block(X, t, o = {}){
    const R = fit(X, t), N = R.N, p = R.p, cols = o.cols || X[0].map((_, j) => `col ${j + 1}`), tn = o.target || 't', k = Math.min(o.k || 5, N);
    const show = [...Array(k).keys()], tbl = (head, rows, tot) => `<div class="wk"><table><tr><th>row</th>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map((r, i) => `<tr><td>${i + 1}</td>${r.map(v => `<td>${typeof v === 'number' ? n(v, 4) : v}</td>`).join('')}</tr>`).join('')}${N > k ? `<tr class="gap"><td>⋮</td>${head.map(() => '<td>⋮</td>').join('')}</tr>` : ''}${tot ? `<tr class="tot"><td>Σ</td>${tot.map(v => `<td>${typeof v === 'number' ? n(v, 4) : v}</td>`).join('')}</tr>` : ''}</table></div>`;
    const ent = (a, bb) => { const pr = show.slice(0, 3).map(i => `${n(X[i][a], 3)}×${n(bb === 't' ? t[i] : X[i][bb], 3)}`).join(' + '); return `${pr}${N > 3 ? ' + …' : ''}`; };
    const j1 = p > 1 ? 1 : 0;
    let solveHtml;
    if (p === 1) solveHtml = `With only the column of 1s, the one equation is N·c₀ = Σ${tn}, so <b>c₀ = Σ${tn} / N = ${n(R.b[0], 4)} / ${N} = ${n(R.c[0], 4)}</b>: the mean. Predicting the mean for every row is the best a model with no inputs can do.`;
    else if (p === 2 && !R.sol.singular) { const [[a00, a01], [a10, a11]] = R.A, [b0, b1] = R.b, det = a00 * a11 - a01 * a10;
      solveHtml = `Two equations, two unknowns:<br>${n(a00, 4)}·c₀ + ${n(a01, 4)}·c₁ = ${n(b0, 4)}<br>${n(a10, 4)}·c₀ + ${n(a11, 4)}·c₁ = ${n(b1, 4)}<br>` +
        `Solve the pair (Cramer's rule): determinant = ${n(a00, 4)}×${n(a11, 4)} − ${n(a01, 4)}×${n(a10, 4)} = ${n(det, 4)}. ` +
        `c₁ = (${n(a00, 4)}×${n(b1, 4)} − ${n(a10, 4)}×${n(b0, 4)}) / ${n(det, 4)} = <b>${n(R.c[1], 4)}</b>; c₀ = (${n(b0, 4)} − ${n(a01, 4)}×${n(R.c[1], 4)}) / ${n(a00, 4)} = <b>${n(R.c[0], 4)}</b>.` +
        (Math.abs(a01) < 1e-9 ? ` Because the off-diagonal entry is 0 (the column has mean 0), each equation has one unknown: c₀ = ${n(b0, 4)} / ${n(a00, 4)} and c₁ = ${n(b1, 4)} / ${n(a11, 4)}.` : '');
    } else if (R.sol.singular) solveHtml = `Elimination hits a zero on the diagonal: one column is a combination of the others, so XᵀX has no inverse and infinitely many c fit equally well. The smallest such c is used: ${vec(R.c, 4)}.`;
    else solveHtml = `With ${p} unknowns, solve by elimination: subtract multiples of one equation from the others until each equation has one unknown fewer, then solve from the bottom up.` +
      R.sol.stages.map(st => `<p class="rg-st">${st.note}</p>${mtx(st.M, null, [...cols.map(c => `× ${c}`), '= rhs'])}`).join('') + `<p class="rg-st">Back-substitution, from the last row up:</p><p>${R.sol.back.map(b => b.txt).join('<br>')}</p>`;
    const r0 = X[0], sum0 = R.c.map((cv, j) => `${n(cv, 4)} × ${n(r0[j], 4)}`).join(' + ');
    return `<details class="reg"><summary>${o.title || `How this regression is run: steps 6 → 9a again, with ${tn} as the target`}</summary><div class="reg-body">
      <p class="rg-why">"Regress ${tn} on ${cols.filter(c => c !== '1').join(', ') || 'a constant'}" means: treat ${tn} as if it were y, treat these columns as if they were X, and find the coefficients c that make Σ(${tn} − prediction)² as small as possible, exactly as steps 6 → 9a did for the main model.</p>
      <ol class="wsteps">
        <li><b>What plays y:</b> ${tn}${o.from ? `, ${o.from}` : ''}. <b>What plays X:</b> the columns [${cols.join(', ')}]${o.colsFrom ? `, ${o.colsFrom}` : ''}.${tbl([...cols, tn], show.map(i => [...X[i], t[i]]))}</li>
        <li><b>Normal equations (as in step 9a):</b> XᵀX has one entry per pair of columns, each a sum over all ${N} rows of the two columns multiplied; Xᵀ${tn} has one entry per column. For example, entry (${cols[j1]}, ${cols[j1]}) = ${ent(j1, j1)} = ${n(R.A[j1][j1], 4)}, and (Xᵀ${tn}) for ${cols[j1]} = ${ent(j1, 't')} = ${n(R.b[j1], 4)}.
${MXM.html(LA.T(X), X, { a: 'Xᵀ', b: 'X', c: 'XᵀX', aRows: cols, aCols: [...Array(N).keys()].map(i => `row ${i + 1}`), bCols: cols, pick: [0, Math.min(1, p - 1)] })}${MXM.html(LA.T(X), t.map(v => [v]), { a: 'Xᵀ', b: tn, c: `Xᵀ${tn}`, aRows: cols, aCols: [...Array(N).keys()].map(i => `row ${i + 1}`), bCols: [tn], pick: [Math.min(1, p - 1), 0] })}
          <p>So the equations are XᵀX · c = Xᵀ${tn}.</p></li>
        <li><b>Solve for c:</b> ${solveHtml}</li>
        <li><b>Predict every row:</b> prediction = ${R.c.map((cv, j) => `${n(cv, 4)}·${cols[j] === '1' ? '1' : cols[j]}`).join(' + ')}. Row 1: ${sum0} = <b>${n(R.yh[0], 4)}</b>; residual = ${n(t[0], 4)} − ${n(R.yh[0], 4)} = ${n(R.e[0], 4)}.
          ${tbl([tn, 'prediction', 'residual', 'residual²', `(${tn} − mean)²`], show.map(i => [t[i], R.yh[i], R.e[i], R.e[i] ** 2, (t[i] - R.mean) ** 2]), ['', '', n(sum(R.e), 6), R.SSE, R.SST])}</li>
        <li><b>Summarise:</b> SSE = ${n(R.SSE, 4)} (what is left unexplained), SST = Σ(${tn} − mean)² = ${n(R.SST, 4)} (what there was to explain), so R² = 1 − ${n(R.SSE, 4)} / ${n(R.SST, 4)} = <b>${n(R.R2, 5)}</b>.</li>
        <li><b>Check:</b> at the best c the residuals are uncorrelated with every column, so Xᵀ(residuals) = ${vec(R.orth, 6)} ≈ 0. This is the same condition that defined the solution.</li>
      </ol></div></details>`;
  }
  return { block, fit, solve };
})();
