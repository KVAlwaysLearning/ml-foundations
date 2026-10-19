/* ============================================================
   "What to look for": the fingerprint a variant leaves in the
   data. For the selected variant: how the data were generated,
   what you should see (live numbers next to the baseline drawn
   from the same random sample), side-by-side pictures, and a
   table of rows with the tell-tale pattern highlighted.
   SIG.render(el, ctx) fills el and returns charts to dispose.
   ctx = { cur, base, a, v, isBase, S } where cur/base = { d, f, dg }.
   ============================================================ */
const SIG = (() => {
  const C = n => css(n), n = (v, d = 3) => num(v, d);
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const sdp = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
  const corr = (a, b) => { const ma = mean(a), mb = mean(b); let ab = 0, aa = 0, bb = 0; a.forEach((v, i) => { ab += (v - ma) * (b[i] - mb); aa += (v - ma) ** 2; bb += (b[i] - mb) ** 2; }); return aa > 0 && bb > 0 ? ab / Math.sqrt(aa * bb) : NaN; };
  const range = (arrs, pad = 0) => { const v = arrs.flat().filter(isFinite); let lo = Math.min(...v), hi = Math.max(...v); if (!(hi > lo)) { lo -= 1; hi += 1; } return [lo - pad, hi + pad]; };
  const sym = r => { const m = Math.max(Math.abs(r[0]), Math.abs(r[1])); return [-m, m]; };
  function chart(parent, title, height, draw){ const c = new Chart(parent, { title, height }); c.wrap.classList.add('mini'); c.drawFn = () => draw(c); c.drawFn(); return c; }
  const row = el => { const d = document.createElement('div'); d.className = 'pv-row'; el.appendChild(d); return d; };
  const POS = () => C('--floor'), NEG = () => C('--normal'), BASEC = () => C('--muted'), CUR = () => C('--surface');

  /* ---------- measurements ---------- */
  function runs(e){ let same = 0, longest = 1, run = 1; for (let i = 1; i < e.length; i++) { if (Math.sign(e[i]) === Math.sign(e[i - 1])) { same++; run++; longest = Math.max(longest, run); } else run = 1; } return { same, pairs: e.length - 1, longest }; }
  const lag1 = e => { let a = 0, b = 0; for (let i = 0; i < e.length; i++) { b += e[i] * e[i]; if (i) a += e[i] * e[i - 1]; } return a / b; };
  function bins(x, e, k = 5){ const idx = [...x.keys()].sort((a, b) => x[a] - x[b]), out = [];
    for (let b = 0; b < k; b++) { const part = idx.slice(Math.round(b * idx.length / k), Math.round((b + 1) * idx.length / k)); if (!part.length) continue;
      const es = part.map(i => e[i]); out.push({ lo: x[part[0]], hi: x[part[part.length - 1]], mid: mean(part.map(i => x[i])), n: part.length, m: mean(es), sd: sdp(es) }); }
    return out; }
  function trueErr(d){
    const c = d.truth.coef, ks = Object.keys(c);
    if (ks.length === d.X[0].length) return d.y.map((y, i) => y - d.X[i].reduce((s, v, j) => s + v * c[j], 0));
    if (d.truth.fn) return d.y.map((y, i) => y - d.truth.fn(d.X[i][1], i));
    return null;
  }
  const signTxt = v => v > 0 ? '+' : '−';

  /* ---------- reusable pictures ---------- */
  function orderBars(c, e, title, yr){ c.begin([0.5, e.length + 0.5], yr, 'row (time order)', 'residual e'); c.hline(0, C('--ink'));
    e.forEach((v, i) => c.line([[i + 1, 0], [i + 1, v]], v >= 0 ? POS() : NEG(), Math.max(1.2, Math.min(5, 280 / e.length)), null, 0.9)); c.end(); }
  function lagPlot(c, e, yr){ const r = lag1(e); c.begin(yr, yr, 'eₜ₋₁ (previous residual)', 'eₜ'); c.hline(0, C('--rule')); c.vrule(0, C('--rule'));
    for (let i = 1; i < e.length; i++) c.dot([e[i - 1], e[i]], Math.sign(e[i]) === Math.sign(e[i - 1]) ? POS() : NEG(), 3.2, false, 0.8);
    c.line([[yr[0], r * yr[0]], [yr[1], r * yr[1]]], C('--ink'), 1.6, [5, 4]); c.text(`r₁ = ${n(r, 2)}`, [yr[0], yr[1]], C('--ink'), 8, 16, true); c.end(); }
  function residVsX(c, x, e, yr, { band = false, k = 6, colorOf = null, xName = 'x' } = {}){ const B = bins(x, e, k), xr = range([x]);
    c.begin(xr, yr, xName, 'residual e'); c.hline(0, C('--ink'));
    if (band) B.forEach(b => c.rect(b.lo, b.m - 2 * b.sd, b.hi, b.m + 2 * b.sd, C('--residual'), 0.14));
    x.forEach((v, i) => c.dot([v, e[i]], colorOf ? colorOf(i) : C('--floor'), 3, false, 0.75));
    if (!band) c.line(B.map(b => [b.mid, b.m]), C('--normal'), 2.4);
    c.end(); }
  function histN(c, e, xr){ const s = sdp(e), m = mean(e), K = 16, w = (xr[1] - xr[0]) / K, cnt = new Array(K).fill(0);
    e.forEach(v => { const k = Math.min(K - 1, Math.max(0, Math.floor((v - xr[0]) / w))); cnt[k]++; });
    const pdf = x => e.length * w * Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI)), top = Math.max(...cnt, pdf(m));
    c.begin(xr, [0, top], 'residual e', 'count'); cnt.forEach((k, i) => k && c.rect(xr[0] + i * w + w * 0.05, 0, xr[0] + (i + 1) * w - w * 0.05, k, C('--floor'), 0.6));
    c.line(Array.from({ length: 81 }, (_, i) => { const x = xr[0] + (xr[1] - xr[0]) * i / 80; return [x, pdf(x)]; }), C('--normal'), 2); c.end(); }
  function qq(c, e, lim){ const s = sdp(e) || 1, z = e.map(v => v / s).sort((a, b) => a - b), N = z.length;
    c.begin([-lim, lim], [-lim, lim], 'normal quantile', 'standardised e'); c.line([[-lim, -lim], [lim, lim]], C('--ink'), 1.4, [5, 4]);
    z.forEach((v, i) => c.dot([invNorm((i + 0.5) / N), v], Math.abs(v) > 2 ? C('--normal') : C('--floor'), 3, false, 0.8)); c.end(); }
  function scatterXY(c, x, y, xName, yName, colorOf, line){ c.begin(range([x]), range([y]), xName, yName);
    x.forEach((v, i) => c.dot([v, y[i]], colorOf ? colorOf(i) : C('--floor'), 3, false, 0.75)); if (line) c.line(line, C('--ink'), 1.8, [5, 4]); c.end(); }
  const gColor = (k, nG) => nG <= 4 ? C(['--floor', '--residual', '--surface', '--normal'][k]) : `hsl(${(k * 360 / nG + 160) % 360} 55% 45%)`;

  /* small table with highlighted rows */
  function table(cols, rows, { hi = () => '', max = 12, foot = '' } = {}){
    const show = rows.slice(0, max);
    return `<div class="sig-tbl"><table><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>` + show.map((r, i) => `<tr class="${hi(i)}">${r.map(v => `<td>${typeof v === 'number' ? n(v, 3) : v}</td>`).join('')}</tr>`).join('') +
      (rows.length > max ? `<tr class="gap">${cols.map(() => '<td>⋮</td>').join('')}</tr>` : '') + `</table>${foot ? `<p class="sig-tf">${foot}</p>` : ''}</div>`;
  }
  const li = items => `<ul class="sig-see">${items.filter(Boolean).map(s => `<li>${s}</li>`).join('')}</ul>`;
  let ONE = false;
  const vs = (v, b, d = 2, fmt = null) => ONE ? `<b>${fmt ? fmt(v) : n(v, d)}</b>` : `<b>${fmt ? fmt(v) : n(v, d)}</b> <span class="sig-b">(baseline ${fmt ? fmt(b) : n(b, d)})</span>`;
  const pfmt = p => !isFinite(p) ? '—' : p < 0.001 ? '< 0.001' : n(p, 3);

  /* ---------- one entry per attribute ---------- */
  const A = {};

  A.independence = ctx => { const { cur, base, v, S } = ctx, e = cur.f.e, eb = base.f.e, N = e.length;
    if (v.id === 'cluster') {
      const g = cur.d.group, G = Math.max(...g) + 1, by = (ee) => Array.from({ length: G }, (_, k) => ee.filter((_, i) => g[i] === k));
      const icc = ee => { const parts = by(ee), tot = sdp(ee) ** 2, between = mean(parts.filter(p => p.length).map(p => (mean(p) - mean(ee)) ** 2)); return between / tot; };
      const m = N / G, ic = icc(e), icb = icc(eb), neff = N / (1 + (m - 1) * Math.max(0, ic));
      return { gen: `Rows belong to ${G} clusters (think: students in the same class, sales in the same store). Every row in cluster g shares one random shift u_g: εᵢ = σ·(√q·u_g + √(1 − q)·zᵢ), with q = 0.8 × strength = ${n(0.8 * S.strength, 2)}, the share of the noise that is shared. x also sits near a cluster centre.`,
        see: li([`Residuals of the same cluster sit together, all above or all below the line, instead of scattering evenly around 0.`,
          `Share of the residual variance that is <i>between</i> clusters (intraclass correlation): ${vs(ic, icb)}. For independent rows it is close to 1/(rows per cluster) by chance alone.`,
          `So ${N} rows carry roughly the information of N / (1 + (m − 1)·ICC) = ${N} / (1 + ${n(m - 1, 1)} × ${n(Math.max(0, ic), 2)}) ≈ <b>${n(neff, 0)}</b> independent rows. The classical SE pretends there are ${N}.`]),
        draw: el => { const yr = sym(range([e, eb])), r1 = row(el), out = [];
          const strip = (c, ee) => { c.begin([0.5, G + 0.5], yr, 'cluster', 'residual e'); c.hline(0, C('--ink')); ee.forEach((v2, i) => c.dot([g[i] + 1 + ((i * 37) % 11 - 5) * 0.03, v2], gColor(g[i], G), 3, false, 0.8));
            by(ee).forEach((p, k) => p.length && c.line([[k + 0.65, mean(p)], [k + 1.35, mean(p)]], C('--ink'), 3)); c.end(); };
          out.push(chart(r1, 'Baseline: residuals grouped by cluster', 240, c => strip(c, eb)), chart(r1, 'This variant: residuals grouped by cluster', 240, c => strip(c, e)));
          out.push(chart(row(el), 'This variant: the data, coloured by cluster', 240, c => scatterXY(c, cur.d.px, cur.d.y, 'x', 'y', i => gColor(g[i], G)))); return out; },
        table: table(['cluster', 'rows', 'mean residual', 'baseline mean residual', 'all same sign?'], Array.from({ length: G }, (_, k) => { const p = e.filter((_, i) => g[i] === k), pb = eb.filter((_, i) => g[i] === k);
          const all = p.every(x => x > 0) || p.every(x => x < 0); return [k + 1, p.length, mean(p), mean(pb), all ? '✓ yes' : 'no']; }), { hi: k => { const p = e.filter((_, i) => g[i] === k); return p.every(x => x > 0) || p.every(x => x < 0) ? 'hl' : ''; }, max: 8,
          foot: 'Black bars in the chart are the cluster means. A whole cluster above or below 0 is the signature.' }) };
    }
    if (v.id === 'dupes') {
      const d = cur.d, keys = d.X.map((r, i) => [...r.slice(1), d.y[i]].map(t => t.toFixed(9)).join('|')), first = new Map(); keys.forEach((k, i) => first.has(k) || first.set(k, i));
      const uniq = [...first.values()], fu = ST.ols(uniq.map(i => d.X[i]), uniq.map(i => d.y[i]), true), k = Math.round(N / uniq.length);
      return { gen: `Each real observation was recorded ${k} times (think: a join that duplicated rows, or the same survey submitted again). εᵢ is identical within every set of copies.`,
        see: li([`Identical rows: only <b>${uniq.length}</b> of ${N} rows are distinct. In the scatter, each dot hides ${k} copies stacked on top of each other.`,
          `The fitted line is exactly the same as on the distinct rows (copies add no new information about the slope): slope ${n(cur.f.w[1], 3)} vs ${n(fu.w[1], 3)}.`,
          `But the classical SE of the slope is ${n(cur.f.se[1], 4)} with copies and <b>${n(fu.se[1], 4)}</b> on the ${uniq.length} distinct rows: about √${k} = ${n(Math.sqrt(k), 2)}× too confident.`,
          `In row order, residuals come in identical blocks of ${k}: the "autocorrelation" Durbin–Watson sees (DW = ${n(cur.dg.dw, 2)}).`]),
        draw: el => { const r1 = row(el), yr = sym(range([e])); return [chart(r1, 'This variant: residuals in row order (blocks of copies)', 240, c => orderBars(c, e, '', yr)),
          chart(r1, 'This variant: the data (ring size = number of copies)', 240, c => { c.begin(range([d.px]), range([d.y]), 'x', 'y'); uniq.forEach(i => { const cnt = keys.filter(q => q === keys[i]).length; c.dot([d.px[i], d.y[i]], C('--floor'), 2.5 + 1.6 * cnt, true, 0.8); }); c.end(); })]; },
        table: table(['row', 'x', 'y (true)', 'ŷ', 'e = y − ŷ', 'copy of row'], d.X.map((r, i) => [i + 1, r[1], d.y[i], cur.f.yhat[i], e[i], first.get(keys[i]) === i ? '— (original)' : `row ${first.get(keys[i]) + 1}`]), { hi: i => first.get(keys[i]) !== i ? 'hl' : '', max: 12 }) };
    }
    const R = runs(e), Rb = runs(eb), r = lag1(e), rb = lag1(eb), rho = v.id === 'posar' ? 0.9 * S.strength : v.id === 'negar' ? -0.8 * S.strength : 0;
    return { gen: v.id === 'indep' ? 'Each error is drawn fresh: εₜ = σ·zₜ, with no memory of the previous row. Rows are in time order.' :
        `Each error keeps a share ρ of the previous one and adds a fresh shock: εₜ = ρ·εₜ₋₁ + √(1 − ρ²)·σ·zₜ, with ρ = ${n(rho, 2)}. ${rho > 0 ? 'Think: a monthly sales series where a good month tends to be followed by another good month, or a sensor that drifts slowly.' : 'Think: an over-correcting process, such as stock that is over-ordered one week and under-ordered the next.'}`,
      see: li([
        rho > 0 ? 'Residuals come in <b>long streaks</b> above or below the line: the data snake around the fitted line instead of scattering randomly.' : rho < 0 ? 'Residuals <b>zig-zag</b>: above the line, then below, then above, almost every row.' : 'Residuals flip sign at random: streaks are short.',
        `Neighbouring residuals with the same sign: ${vs(R.same, Rb.same, 0)} of ${R.pairs} pairs. Pure chance gives about half, ${n(R.pairs / 2, 0)}.`,
        `Longest streak of same-sign residuals: ${vs(R.longest, Rb.longest, 0)} rows.`,
        `Lag-1 correlation of the residuals, r₁ = corr(eₜ, eₜ₋₁): ${vs(r, rb)}. In the lag plot the cloud tilts ${r > 0.2 ? 'upward' : r < -0.2 ? 'downward' : 'neither way'}. Durbin–Watson ≈ 2(1 − r₁) = ${vs(cur.dg.dw, base.dg.dw)}.`,
        rho !== 0 ? `The fitted line itself barely moves (slope ${n(cur.f.w[1], 3)} vs ${n(base.f.w[1], 3)}). What is wrong is the <i>confidence</i>: the classical SE treats ${N} rows as independent when ${rho > 0 ? 'neighbours repeat much of the same information' : 'errors partly cancel out'}.` : '']),
      draw: el => { const yr = sym(range([e, eb])), r1 = row(el), r2 = row(el);
        return [chart(r1, 'Baseline: residuals in time order', 220, c => orderBars(c, eb, '', yr)), chart(r1, 'This variant: residuals in time order', 220, c => orderBars(c, e, '', yr)),
          chart(r2, 'Baseline: lag plot (each residual vs the previous one)', 240, c => lagPlot(c, eb, yr)), chart(r2, 'This variant: lag plot', 240, c => lagPlot(c, e, yr))]; },
      table: table(['t', 'x', 'y (true)', 'ŷ', 'e = y − ŷ', 'sign', 'same sign as previous?'], e.map((v2, i) => [i + 1, cur.d.px[i], cur.d.y[i], cur.f.yhat[i], v2, signTxt(v2), i ? (Math.sign(v2) === Math.sign(e[i - 1]) ? '✓ same' : 'flip') : '—']),
        { hi: i => i && Math.sign(e[i]) === Math.sign(e[i - 1]) ? 'hl' : '', max: 14, foot: 'Highlighted rows continue a streak. Teal bars are positive residuals, pink negative.' }) };
  };

  A.linearity = ctx => { const { cur, base, v } = ctx, x = cur.d.px, e = cur.f.e, eb = base.f.e, B = bins(x, e, 5), Bb = bins(base.d.px, eb, 5), d = cur.d;
    const pat = B.map(b => signTxt(b.m)).join(' '), shape = { quadratic: 'a U: positive at both ends, negative in the middle', log: 'an upside-down U: negative at both ends, positive in the middle', sshape: 'an S-shaped wave', step: 'a jump: one sign below the threshold and the other above it', periodic: 'a wave', interaction: 'a cross: the residuals of each group tilt in opposite directions' }[v.id];
    const grp = d.group, nG = grp ? Math.max(...grp) + 1 : 0, gSlope = k => { const ii = x.map((_, i) => i).filter(i => grp[i] === k); const xs = ii.map(i => x[i]), es = ii.map(i => e[i]); return corr(xs, es) * sdp(es) / sdp(xs); };
    return { gen: `${esc(v.desc)} The model still fits a straight line${grp ? ' with one slope shared by both groups' : ''}.`,
      see: li([v.id === 'linear' ? 'Residuals scatter evenly around 0 all along x: no region where the line is systematically too high or too low.' : `The residual-vs-x cloud is not flat: it traces <b>${shape}</b>. The line is too low in some ranges of x and too high in others.`,
        `Average residual in each fifth of the x range (left → right): ${B.map(b => n(b.m, 2)).join(', ')}, signs <b>${pat}</b>. Baseline: ${Bb.map(b => n(b.m, 2)).join(', ')}. A correct shape gives small averages of random sign.`,
        grp ? `Slope of the residuals within each group: ${Array.from({ length: nG }, (_, k) => `${d.groupNames[k]} ${n(gSlope(k), 2)}`).join(', ')}. One common slope is too steep for one group and too flat for the other.` : '',
        `Ramsey RESET p-value: ${vs(cur.dg.reset?.p, base.dg.reset?.p, 3, pfmt)}. R² of the straight line: ${vs(cur.f.R2, base.f.R2, 3)}.`,
        v.id !== 'linear' ? 'Where you would see it first: the y-vs-x scatter in EDA (step 3), then the residual plot. Errors are largest at the edges, so extrapolating is the most dangerous use of this model.' : '']),
      draw: el => { const yr = sym(range([e, eb])), r1 = row(el), r2 = row(el), xr = range([x]), gx = Array.from({ length: 61 }, (_, i) => xr[0] + (xr[1] - xr[0]) * i / 60);
        const cOf = grp ? (i => gColor(grp[i], nG)) : null;
        return [chart(r1, 'This variant: data, straight-line fit, true curve (dashed)', 240, c => { c.begin(xr, range([d.y]), 'x', 'y'); x.forEach((v2, i) => c.dot([v2, d.y[i]], cOf ? cOf(i) : C('--floor'), 3, false, 0.75));
            if (d.truth.byGroup) d.truth.byGroup.forEach((fn, k) => c.line(gx.map(t => [t, fn(t)]), gColor(k, nG), 1.6, [5, 4])); else if (d.truth.fn) c.line(gx.map(t => [t, d.truth.fn(t, 0)]), C('--ink'), 1.6, [5, 4]);
            if (!grp) c.line(xr.map(t => [t, cur.f.w[0] + cur.f.w[1] * t]), C('--surface'), 2.4); c.end(); }),
          chart(r2, 'Baseline: residuals vs x (pink = average per fifth)', 230, c => residVsX(c, base.d.px, eb, yr, { k: 5 })),
          chart(r2, 'This variant: residuals vs x', 230, c => residVsX(c, x, e, yr, { k: 5, colorOf: cOf }))]; },
      table: table(['fifth of x', 'x from', 'x to', 'rows', 'mean residual', 'baseline mean residual'], B.map((b, i) => [i + 1, b.lo, b.hi, b.n, b.m, Bb[i]?.m]), { hi: i => Math.abs(B[i].m) > 2 * B[i].sd / Math.sqrt(B[i].n) ? 'hl' : '', max: 5,
        foot: 'Highlighted: the average residual is more than 2 standard errors from 0, so the line is systematically off in that range.' }) };
  };

  A.homoscedasticity = ctx => { const { cur, base, v } = ctx, x = cur.d.px, e = cur.f.e, eb = base.f.e, B = bins(x, e, 5), Bb = bins(base.d.px, eb, 5), d = cur.d;
    const grp = v.id === 'groupvar' ? d.group : null, sds = B.map(b => b.sd), ratio = Math.max(...sds) / Math.min(...sds), ratioB = Math.max(...Bb.map(b => b.sd)) / Math.min(...Bb.map(b => b.sd));
    return { gen: v.id === 'constant' ? 'εᵢ = σ·zᵢ: the same spread σ everywhere.' : `εᵢ = σ·m(xᵢ)·zᵢ: the typical size of the error is multiplied by m, which ${v.id === 'increasing' ? 'grows with x' : v.id === 'decreasing' ? 'shrinks with x' : v.id === 'bowtie' ? 'is small in the middle of x and large at both ends' : 'depends on the group'}. Think: ${v.id === 'increasing' ? 'spending vs income: rich households vary far more than poor ones' : v.id === 'decreasing' ? 'a measurement that becomes more precise for larger objects' : v.id === 'bowtie' ? 'a process that is tightly controlled near its set point' : 'two machines, one precise and one sloppy'}.`,
      see: li([v.id === 'constant' ? 'The residual cloud is a band of even thickness.' : `The residual cloud ${v.id === 'increasing' ? 'fans out to the right like a funnel' : v.id === 'decreasing' ? 'narrows to the right' : v.id === 'bowtie' ? 'is pinched in the middle, like a bow tie' : 'is thin for one group and wide for the other'}. The centre stays on 0: the line is still right on average.`,
        `Residual SD in each fifth of x (left → right): ${B.map(b => n(b.sd, 2)).join(', ')}. Largest ÷ smallest = ${vs(ratio, ratioB)}. Even spread gives a ratio near 1 (chance alone pushes it a little higher).`,
        grp ? `Residual SD by group: ${[0, 1].map(k => `${d.groupNames[k]} ${n(sdp(e.filter((_, i) => grp[i] === k)), 2)}`).join(', ')}. Because the spread depends on the group and not on x, a test that regresses e² on x (Breusch–Pagan) can miss it.` : '',
        `Breusch–Pagan p-value: ${vs(cur.dg.bp?.p, base.dg.bp?.p, 3, pfmt)}. Slope: ${n(cur.f.w[1], 3)} (unbiased). Classical SE ${n(cur.f.se[1], 4)}: one number for an uncertainty that really differs across x.`]),
      draw: el => { const yr = sym(range([e, eb])), r1 = row(el), cOf = grp ? (i => gColor(grp[i], 2)) : null;
        return [chart(r1, 'Baseline: residuals vs x (band = ±2 SD per fifth)', 240, c => residVsX(c, base.d.px, eb, yr, { band: true, k: 5 })),
          chart(r1, 'This variant: residuals vs x', 240, c => residVsX(c, x, e, yr, { band: true, k: 5, colorOf: cOf })),
          chart(row(el), 'Residual SD in each fifth of x', 200, c => { const top = Math.max(...sds, ...Bb.map(b => b.sd)); c.begin([0.5, 5.5], [0, top], 'fifth of x (left → right)', 'SD of e');
            B.forEach((b, i) => { c.rect(i + 0.62, 0, i + 1, Bb[i].sd, BASEC(), 0.45); c.rect(i + 1, 0, i + 1.38, b.sd, CUR(), 0.75); }); c.end(); c.legend([[BASEC(), 'baseline'], [CUR(), 'this variant']]); })]; },
      table: table(['fifth of x', 'x from', 'x to', 'rows', 'SD of residuals', 'baseline SD'], B.map((b, i) => [i + 1, b.lo, b.hi, b.n, b.sd, Bb[i]?.sd]), { hi: i => sds[i] === Math.max(...sds) || sds[i] === Math.min(...sds) ? 'hl' : '', max: 5, foot: 'Highlighted: the widest and the narrowest fifth.' }) };
  };

  A.normality = ctx => { const { cur, base, v } = ctx, e = cur.f.e, eb = base.f.e, N = e.length;
    const shape = ee => { const m = mean(ee), s = sdp(ee), z = ee.map(t => (t - m) / s); return { S: mean(z.map(t => t ** 3)), K: mean(z.map(t => t ** 4)), o2: z.filter(t => Math.abs(t) > 2).length, o3: z.filter(t => Math.abs(t) > 3).length, z }; };
    const a = shape(e), b = shape(eb), s = sdp(e), top = [...e.keys()].sort((i, j) => Math.abs(e[j]) - Math.abs(e[i])).slice(0, 8);
    return { gen: v.id === 'normal' ? 'εᵢ = σ·zᵢ with z from the bell curve.' : `${esc(v.desc)} Mixed with a normal component by the strength slider. Think: ${{ rskew: 'delivery times or waiting times: mostly on time, sometimes very late', lskew: 'exam scores near the maximum: most high, a few very low', heavy: 'financial returns: mostly calm, with occasional crashes', light: 'rounding errors: never far from 0', bimodal: 'two hidden populations mixed together' }[v.id]}.`,
      see: li([v.id === 'normal' ? 'The histogram follows the bell curve and the Q–Q points lie on the diagonal.' : `The histogram ${{ rskew: 'has a long tail to the right', lskew: 'has a long tail to the left', heavy: 'has a tall narrow peak and a few far-away points', light: 'is flat-topped with no tails', bimodal: 'has two humps with a dip at 0' }[v.id]}. On the Q–Q plot the points ${{ rskew: 'bend upward at the right end', lskew: 'bend downward at the left end', heavy: 'curl away from the line at both ends (an S lying on its side)', light: 'flatten at both ends (the opposite S)', bimodal: 'form a step in the middle' }[v.id]}.`,
        `Skewness: ${vs(a.S, b.S)} (bell curve: 0). Kurtosis: ${vs(a.K, b.K)} (bell curve: 3).`,
        `Residuals beyond 2 SD: ${vs(a.o2, b.o2, 0)} of ${N} (a bell curve gives about 4.6%, ${n(0.0455 * N, 1)}). Beyond 3 SD: ${vs(a.o3, b.o3, 0)} (bell curve: ${n(0.0027 * N, 2)}).`,
        `Jarque–Bera p-value: ${vs(cur.dg.jb.p, base.dg.jb.p, 3, pfmt)}. The line and its slope (${n(cur.f.w[1], 3)}) are unaffected: normality only matters for exact small-sample intervals and for prediction intervals in the tails.`]),
      draw: el => { const xr = sym(range([e, eb])), lim = Math.max(3.2, ...a.z.map(Math.abs), ...b.z.map(Math.abs)) * 1.02, r1 = row(el), r2 = row(el);
        return [chart(r1, 'Baseline: histogram of residuals + bell curve', 220, c => histN(c, eb, xr)), chart(r1, 'This variant: histogram of residuals', 220, c => histN(c, e, xr)),
          chart(r2, 'Baseline: normal Q–Q', 240, c => qq(c, eb, lim)), chart(r2, 'This variant: normal Q–Q (pink beyond ±2 SD)', 240, c => qq(c, e, lim))]; },
      table: table(['row', 'x', 'y (true)', 'ŷ', 'e = y − ŷ', 'z = e / SD', 'beyond 2 SD?'], top.map(i => [i + 1, cur.d.px[i], cur.d.y[i], cur.f.yhat[i], e[i], e[i] / s, Math.abs(e[i] / s) > 2 ? '✓' : '']), { hi: k => Math.abs(e[top[k]] / s) > 2 ? 'hl' : '', max: 8, foot: 'The eight largest residuals, largest first.' }) };
  };

  A.multicollinearity = ctx => { const { cur, base, v } = ctx, d = cur.d, db = base.d, x1 = d.X.map(r => r[1]), x2 = d.X.map(r => r[2]), b1 = db.X.map(r => r[1]), b2 = db.X.map(r => r[2]);
    const r = corr(x1, x2), rb = corr(b1, b2), vmax = Math.max(...cur.dg.vif), vb = Math.max(...base.dg.vif);
    const dummy = v.id === 'dummytrap', combo = v.id === 'combo';
    const check = dummy ? d.X.map(rw => rw[2] + rw[3] + rw[4]) : combo ? d.X.map(rw => rw[3] - rw[1] - rw[2]) : d.X.map(rw => rw[2] - 2 * rw[1]);
    return { gen: dummy ? 'A category with three levels (A, B, C) is one-hot encoded and all three 0/1 columns are kept alongside the intercept column of 1s.' : combo ? 'Three features where x₃ = x₁ + x₂ (think: "total spend" kept next to "online spend" and "store spend").' : v.id === 'perfect' ? 'x₂ = 2·x₁ (plus noise that the strength slider removes). Think: the same length recorded in inches and in half-inches.' : `${esc(v.desc)} Think: house size and number of rooms, or age and years of experience.`,
      see: li([dummy ? 'Every row has exactly one 1 among A, B, C, so A + B + C = 1 = the intercept column on every row. Nothing in the raw data looks odd: the problem is created by the encoding.' :
          `In the x₁-vs-x₂ scatter the points ${Math.abs(r) > 0.99 ? 'lie on a line' : Math.abs(r) > 0.9 ? 'form a thin cigar' : 'form a tilted cloud'}, instead of filling the square (baseline).`,
        !dummy ? `Correlation r(x₁, x₂): ${vs(r, rb)}. Only √(1 − r²) = <b>${n(Math.sqrt(Math.max(0, 1 - r * r)) * 100, 0)}%</b> of x₂'s spread is independent of x₁ (baseline ${n(Math.sqrt(1 - rb * rb) * 100, 0)}%). That sliver is all the data has to tell the two effects apart.` : '',
        `Largest VIF: ${vs(vmax, vb, 1, t => isFinite(t) ? n(t, 1) : '∞')}. Condition number of XᵀX: ${vs(cur.f.kappa, base.f.kappa, 0, t => isFinite(t) ? n(t, 0) : '∞')}.`,
        `Coefficients: ${d.names.slice(1).map((nm, k) => `${nm} ${n(cur.f.w[k + 1], 2)}${isFinite(cur.f.se[k + 1]) ? ` ± ${n(cur.f.se[k + 1], 2)}` : ' (not identifiable)'}`).join(', ')}. True: ${d.names.slice(1).map((nm, k) => `${nm} ${d.truth.coef[k + 1] ?? '—'}`).join(', ')}. Predictions are still fine (R² ${n(cur.f.R2, 3)} vs ${n(base.f.R2, 3)}): only the split of credit between the features is unstable.`]),
      draw: el => { const r1 = row(el), out = [];
        if (!dummy) { out.push(chart(r1, 'Baseline: x₁ vs x₂', 240, c => scatterXY(c, b1, b2, 'x₁', 'x₂')), chart(r1, 'This variant: x₁ vs x₂', 240, c => scatterXY(c, x1, x2, 'x₁', 'x₂'))); }
        else out.push(chart(r1, 'This variant: data by category (the trap is in the columns, not the points)', 240, c => scatterXY(c, d.px, d.y, 'x', 'y', i => gColor(d.group[i], 3))));
        return out; },
      table: table(dummy ? ['row', '1', 'A', 'B', 'C', 'A + B + C'] : combo ? ['row', 'x₁', 'x₂', 'x₃', 'x₃ − x₁ − x₂'] : ['row', 'x₁', 'x₂', 'x₂ − 2·x₁', 'y (true)'],
        d.X.map((rw, i) => dummy ? [i + 1, 1, rw[2], rw[3], rw[4], check[i]] : combo ? [i + 1, rw[1], rw[2], rw[3], check[i]] : [i + 1, rw[1], rw[2], check[i], d.y[i]]),
        { hi: i => Math.abs(check[i] - (dummy ? 1 : 0)) < 1e-6 ? 'hl' : '', max: 10, foot: dummy ? 'Highlighted: A + B + C equals the intercept column exactly, so one column is redundant.' : combo || v.id === 'perfect' ? 'Highlighted: the identity holds exactly on that row. When it holds on every row, XᵀX has no inverse.' : '' }) };
  };

  A.exogeneity = ctx => { const { cur, base, v, S } = ctx, d = cur.d, x = d.px, e = cur.f.e, eps = trueErr(d), epsb = trueErr(base.d);
    const r = corr(x, eps), rb = corr(base.d.px, epsb), re = corr(x, e);
    return { gen: { exo: 'εᵢ = σ·zᵢ, drawn independently of x. The slope is the causal effect, 1.5.', confounder: `A hidden variable z pushes x up and pushes y up: x = 5 + 2·s·z + noise, y = 2 + 1.5x + 3·s·z + σ·ε. The model leaves z out, so 3·s·z sits inside the error and rises with x. Think: ice-cream sales and drownings, both driven by temperature.`,
        measerr: `y depends on the true x, but we record x with error: x_observed = x_true + 3·s·u. The model's error then contains −1.5·(x_observed − x_true), which is large exactly when x_observed is far from x_true. Think: self-reported income.`,
        reverse: `y depends on x, and x also responds to y (x = a + γ·y + u, γ = ${n(0.4 * S.strength, 2)}). A high error raises y, which raises x. Think: police numbers and crime rates.` }[v.id],
      see: li([v.id === 'exo' ? 'The true errors show no trend against x.' : '<b>The trap: the residuals look perfectly healthy.</b> OLS forces the residuals to be uncorrelated with x, so no residual plot or test can show this problem.',
        `Correlation between x and the residuals e: <b>${n(re, 3)}</b> (always 0 by construction).`,
        `Correlation between x and the <i>true</i> error ε (visible only because this is a simulation): ${vs(r, rb)}. This is the violation.`,
        `So the slope absorbs part of the error: estimated ${n(cur.f.w[1], 3)} vs the true causal 1.5 (baseline estimate ${n(base.f.w[1], 3)}). ${v.id === 'measerr' ? 'Measurement error shrinks the slope toward 0 (attenuation).' : v.id === 'exo' ? '' : 'More data only makes the wrong number more precise.'}`,
        v.id !== 'exo' ? 'How you find it in practice: by thinking about how the data were produced (what else drives both x and y? is x measured precisely? can y influence x?), not from the residuals.' : '']),
      draw: el => { const r1 = row(el), yr = sym(range([eps || [], epsb || [], e])), fit = (xx, yy) => { const b = corr(xx, yy) * sdp(yy) / sdp(xx), m = mean(yy) - b * mean(xx), xr = range([xx]); return xr.map(t => [t, m + b * t]); };
        return [chart(r1, 'Baseline: x vs the true error ε', 230, c => { c.begin(range([base.d.px]), yr, 'x', 'true error ε'); c.hline(0, C('--rule')); base.d.px.forEach((t, i) => c.dot([t, epsb[i]], C('--floor'), 3, false, 0.75)); c.line(fit(base.d.px, epsb), C('--ink'), 1.8, [5, 4]); c.end(); }),
          chart(r1, 'This variant: x vs the true error ε', 230, c => { c.begin(range([x]), yr, 'x', 'true error ε'); c.hline(0, C('--rule')); x.forEach((t, i) => c.dot([t, eps[i]], C('--normal'), 3, false, 0.75)); c.line(fit(x, eps), C('--ink'), 1.8, [5, 4]); c.end(); }),
          chart(row(el), 'This variant: x vs the residual e (what you can actually see)', 220, c => { c.begin(range([x]), yr, 'x', 'residual e'); c.hline(0, C('--ink')); x.forEach((t, i) => c.dot([t, e[i]], C('--floor'), 3, false, 0.75)); c.end(); })]; },
      table: table(['row', 'x', 'y (true)', 'ŷ', 'e = y − ŷ (residual)', 'ε (true error)'], [...x.keys()].sort((i, j) => x[i] - x[j]).map(i => [i + 1, x[i], d.y[i], cur.f.yhat[i], e[i], eps[i]]), { max: 12,
        foot: 'Sorted by x. Read down the last column: the true error drifts with x. The residual column does not, because the slope has already absorbed that drift.' }) };
  };

  function render(el, ctx){
    const fn = A[ctx.a.id]; if (!fn) { el.innerHTML = ''; return []; }
    ONE = !!ctx.isBase; const r = fn(ctx);
    el.innerHTML = `<h2 id="sig-h">What to look for in the data</h2>
      <p class="hint-s">${ctx.isBase ? `Baseline selected: this is what <b>healthy</b> data look like for ${esc(ctx.a.name.toLowerCase())}. Pick a variant to see its fingerprint next to this one.` : `<b>${esc(ctx.a.name)} › ${esc(ctx.v.name)}</b>, compared with the baseline drawn from the same random sample, so the only difference is this property. Residuals are from the fit on all rows, as in the charts above.`}</p>
      <div class="sig-grid"><div class="sig-card"><h3>How these data were made</h3><p>${r.gen}</p></div><div class="sig-card"><h3>What you should see</h3>${r.see}</div></div>
      <div class="sig-pics"></div><h3 class="sig-th">In the rows</h3>${r.table}`;
    let charts = [];
    try { charts = r.draw(el.querySelector('.sig-pics')) || []; } catch (err) { console.error(err); }
    if (ONE) charts = charts.filter(c => { const t = c.titleEl.textContent; if (t.startsWith('Baseline:')) { c.dispose(); c.wrap.remove(); return false; } if (t.startsWith('This variant:')) c.title(t.replace('This variant:', 'Baseline:')); return true; });
    return charts;
  }
  return { render, trueErr, runs, lag1, bins };
})();
