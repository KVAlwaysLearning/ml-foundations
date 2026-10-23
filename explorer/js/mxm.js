/* ============================================================
   Matrix multiplication, shown the way you would do it by hand.
   A × B = C with one entry of C picked: its row of A and its column
   of B are highlighted, and the entry is written out as a one-line
   sum of products. Click any entry of C to see how it is made.
   Large matrices show their first rows/columns, then ⋯, then the last.
   MXM.html(A, B, opt) -> HTML.   A: m×k rows, B: k×n rows.
   opt: { a, b, c (names), aRows, aCols, bCols (labels), pick: [i, j], why }
   EIG.html(A, names) -> eigenvalues worked from first principles.
   ============================================================ */
const MXM = (() => {
  const reg = new Map(); let next = 1;
  const n = v => typeof v === 'number' ? num(v, Math.abs(v) >= 100 ? 1 : 3) : v;
  const idxs = (len, keep = 5) => len <= keep + 1 ? [...Array(len).keys()] : [...[...Array(keep).keys()], -1, len - 1];
  const mul = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));

  function render(id){
    const { A, B, o } = reg.get(id), C = o.C || mul(A, B), m = A.length, k = B.length, nc = B[0].length;
    let [pi, pj] = o.pick || [Math.min(1, m - 1), Math.min(1, nc - 1)]; pi = Math.min(pi, m - 1); pj = Math.min(pj, nc - 1);
    const R = idxs(m), K = idxs(k, 4), J = idxs(nc), aR = o.aRows || [...Array(m).keys()].map(i => String(i + 1)), aC = o.aCols || [...Array(k).keys()].map(i => String(i + 1)), bC = o.bCols || [...Array(nc).keys()].map(j => String(j + 1));
    const showR = R.includes(pi) ? R : [...R.filter(i => i >= 0).slice(0, -1), pi].sort((a, b) => a - b), showJ = J.includes(pj) ? J : [...J.filter(j => j >= 0).slice(0, -1), pj].sort((a, b) => a - b);
    const cell = (v, cls) => `<td class="${cls}">${n(v)}</td>`, gap = '<td class="mx-gap">⋯</td>';
    const tA = `<table class="mxt"><tr><th></th>${K.map(c => c < 0 ? '<th>⋯</th>' : `<th>${aC[c]}</th>`).join('')}</tr>` + showR.map(i => i < 0 ? `<tr><th>⋮</th>${K.map(() => '<td class="mx-gap">⋮</td>').join('')}</tr>` :
      `<tr class="${i === pi ? 'hl' : ''}"><th>${aR[i]}</th>${K.map(c => c < 0 ? gap : cell(A[i][c], i === pi ? 'on' : '')).join('')}</tr>`).join('') + '</table>';
    const tB = `<table class="mxt"><tr><th></th>${showJ.map(j => j < 0 ? '<th>⋯</th>' : `<th class="${j === pj ? 'onh' : ''}">${bC[j]}</th>`).join('')}</tr>` + K.map(r => r < 0 ? `<tr><th>⋮</th>${showJ.map(() => '<td class="mx-gap">⋮</td>').join('')}</tr>` :
      `<tr><th>${aC[r]}</th>${showJ.map(j => j < 0 ? gap : cell(B[r][j], j === pj ? 'on' : '')).join('')}</tr>`).join('') + '</table>';
    const tC = `<table class="mxt mxc"><tr><th></th>${showJ.map(j => j < 0 ? '<th>⋯</th>' : `<th>${bC[j]}</th>`).join('')}</tr>` + showR.map(i => i < 0 ? `<tr><th>⋮</th>${showJ.map(() => '<td class="mx-gap">⋮</td>').join('')}</tr>` :
      `<tr><th>${aR[i]}</th>${showJ.map(j => j < 0 ? gap : `<td class="pick${i === pi && j === pj ? ' sel' : ''}" data-mxm="${id}" data-i="${i}" data-j="${j}" title="click: how is this entry made?">${n(C[i][j])}</td>`).join('')}</tr>`).join('') + '</table>';
    const terms = [...Array(k).keys()], shown = k <= 6 ? terms : [0, 1, 2, -1, k - 1];
    const line = shown.map(t => t < 0 ? '⋯' : `${n(A[pi][t])}×${n(B[t][pj])}`).join(' + ');
    return `<div class="mxm" id="mxm-${id}">${o.why ? `<p class="mxm-why">${o.why}</p>` : ''}
      <div class="mxm-row"><div class="mxm-m"><div class="mxm-n">${o.a || 'A'} <small>${m}×${k}</small></div>${tA}</div><div class="mxm-op">×</div>
      <div class="mxm-m"><div class="mxm-n">${o.b || 'B'} <small>${k}×${nc}</small></div>${tB}</div><div class="mxm-op">=</div>
      <div class="mxm-m"><div class="mxm-n">${o.c || 'C'} <small>${m}×${nc}</small></div>${tC}</div></div>
      <p class="mxm-sum"><b>Entry (${aR[pi]}, ${bC[pj]})</b> = row <b>${aR[pi]}</b> of ${o.a || 'A'} · column <b>${bC[pj]}</b> of ${o.b || 'B'}: multiply the pairs and add${k > 6 ? ` all ${k} of them` : ''}: ${line} = <b>${n(C[pi][pj])}</b>.${o.note ? ' ' + o.note(pi, pj) : ''} <span class="muted">Click any entry of ${o.c || 'C'} to see how it is made.</span></p></div>`;
  }
  function html(A, B, o = {}){
    if (reg.size > 400) reg.clear();
    const id = next++; reg.set(id, { A, B, o }); return render(id);
  }
  document.addEventListener('click', e => { const t = e.target.closest('[data-mxm]'); if (!t) return; const id = +t.dataset.mxm, r = reg.get(id); if (!r) return;
    r.o.pick = [+t.dataset.i, +t.dataset.j]; const el = document.getElementById('mxm-' + id); if (!el) return;
    const w = document.createElement('div'); w.innerHTML = render(id); const neu = w.firstElementChild; el.replaceWith(neu); if (typeof MATH !== 'undefined') MATH.typeset(neu); });
  return { html, mul };
})();

/* eigenvalues from first principles */
const EIG = (() => {
  const n = (v, d = 4) => num(v, d);
  const det = M => LA.det(M);
  function html(A, names){
    const p = A.length, E = LA.eigSym(A), lam = E.values, V = E.vectors, tr = A.reduce((s, r, i) => s + r[i], 0), dt = det(A);
    const intro = `<p>An ${g('eigen', 'eigenvalue')} λ of a square matrix A is a stretch factor: there is a direction v that A only stretches, A·v = λ·v. Rewrite it as (A − λI)·v = 0. A non-zero v can solve that only if A − λI squashes some direction to nothing, which happens exactly when its ${g('det', 'determinant')} is 0. So the eigenvalues are the solutions of <b>det(A − λI) = 0</b>, the characteristic equation.</p>`;
    let body = '';
    if (p === 2) {
      const [[a, b], [c, d]] = A, disc = (a + d) ** 2 - 4 * (a * d - b * c), l1 = ((a + d) + Math.sqrt(Math.max(0, disc))) / 2, l2 = ((a + d) - Math.sqrt(Math.max(0, disc))) / 2;
      const vec_ = l => { const v = Math.abs(b) > 1e-12 ? [b, l - a] : Math.abs(c) > 1e-12 ? [l - d, c] : (Math.abs(l - a) < Math.abs(l - d) ? [1, 0] : [0, 1]); const s = Math.hypot(...v); return v.map(x => x / s); };
      const v1 = vec_(l1), v2 = vec_(l2), Av = (v) => [a * v[0] + b * v[1], c * v[0] + d * v[1]];
      body = ol2([
        `A = [[${n(a)}, ${n(b)}], [${n(c)}, ${n(d)}]], so A − λI = [[${n(a)} − λ, ${n(b)}], [${n(c)}, ${n(d)} − λ]].`,
        `Its determinant: (${n(a)} − λ)(${n(d)} − λ) − ${n(b)}×${n(c)} = λ² − (${n(a)} + ${n(d)})λ + (${n(a)}×${n(d)} − ${n(b)}×${n(c)}) = <b>λ² − ${n(a + d)}λ + ${n(a * d - b * c)} = 0</b>.`,
        `Quadratic formula: λ = [${n(a + d)} ± √(${n(a + d)}² − 4×${n(a * d - b * c)})] / 2 = [${n(a + d)} ± √${n(disc)}] / 2 = [${n(a + d)} ± ${n(Math.sqrt(Math.max(0, disc)))}] / 2, so <b>λ₁ = ${n(l1)}</b> and <b>λ₂ = ${n(l2)}</b>.`,
        `Directions: solve (A − λI)v = 0. For λ₁, v₁ = ${vec(v1, 4)}; check A·v₁ = ${vec(Av(v1), 4)} = ${n(l1)} × v₁ ✓. For λ₂, v₂ = ${vec(v2, 4)}; A·v₂ = ${vec(Av(v2), 4)} = ${n(l2)} × v₂ ✓.`,
        `Two quick checks: λ₁ + λ₂ = ${n(l1 + l2)} equals the trace (sum of the diagonal) ${n(tr)}, and λ₁ × λ₂ = ${n(l1 * l2)} equals the determinant ${n(dt)}.`]);
    } else {
      const c2 = p === 3 ? (A[0][0] * A[1][1] - A[0][1] * A[1][0]) + (A[0][0] * A[2][2] - A[0][2] * A[2][0]) + (A[1][1] * A[2][2] - A[1][2] * A[2][1]) : null;
      const poly = l => det(A.map((r, i) => r.map((v, j) => v - (i === j ? l : 0))));
      body = ol2([
        p === 3 ? `For a 3×3 matrix, det(A − λI) expands to a cubic: −λ³ + (trace)λ² − (sum of the 2×2 principal minors)λ + det(A) = 0, i.e. −λ³ + ${n(tr)}λ² − ${n(c2)}λ + ${n(dt)} = 0.` : `For a ${p}×${p} matrix, det(A − λI) is a polynomial of degree ${p} in λ. Writing it out by hand gets long, so software finds its roots numerically (for symmetric matrices like this one, by Jacobi rotations: repeatedly rotating to zero out the off-diagonal entries until only the eigenvalues remain on the diagonal).`,
        `Its ${p} solutions are λ = ${lam.map(l => n(l, 4)).join(', ')}. Check each by plugging it back in: det(A − λI) = ${lam.map(l => n(poly(l), 4)).join(', ')} (all ≈ 0 ✓).`,
        `Each has a direction v with A·v = λ·v:` + `<div class="wk"><table><tr><th>λ</th><th>v</th><th>A·v</th><th>λ·v</th></tr>${lam.map((l, k) => { const v = V[k], Av = LA.mv(A, v); return `<tr><td>${n(l)}</td><td>${vec(v, 3)}</td><td>${vec(Av, 3)}</td><td>${vec(v.map(x => x * l), 3)}</td></tr>`; }).join('')}</table></div>`,
        `Checks: the eigenvalues add up to the trace, ${n(lam.reduce((s, l) => s + l, 0))} = ${n(tr)}, and multiply to the determinant, ${n(lam.reduce((s, l) => s * l, 1))} ≈ ${n(dt)}.`]);
    }
    const lo = lam[lam.length - 1], vlo = V[V.length - 1];
    const equal = lam[0] - lo < 1e-6 * Math.max(1, lam[0]);
    return intro + body + `<p><b>What they mean here.</b> Each eigenvalue says how much information the data carry along its direction v (a combination of the weights). ${equal ? `All of them are equal (${n(lo, 4)}): every direction is equally well determined, which is what standardised, uncorrelated columns give. Compare a multicollinearity variant, where one eigenvalue collapses toward 0.` : `The smallest, λ_min = ${n(lo, 6)}, is the least-pinned-down direction ${vec(vlo, 3)}${names ? ` over [${names.join(', ')}]` : ''}. If λ_min = 0, moving the weights along that direction changes no prediction at all.`}</p>`;
  }
  const ol2 = items => `<ol class="wsteps">${items.map(s => `<li>${s}</li>`).join('')}</ol>`;
  return { html };
})();
