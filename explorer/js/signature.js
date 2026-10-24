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
    if (d.truth.byGroup && d.group) return d.y.map((y, i) => y - d.truth.byGroup[d.group[i]](d.X[i][1]));
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
            if (d.truth.byGroup && !d.truth.byGroupPartial) d.truth.byGroup.forEach((fn, k) => c.line(gx.map(t => [t, fn(t)]), gColor(k, nG), 1.6, [5, 4])); else if (d.truth.fn && !d.truth.partial) c.line(gx.map(t => [t, d.truth.fn(t, 0)]), C('--ink'), 1.6, [5, 4]);
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
        `Largest VIF: ${vs(vmax, vb, 1, t => isFinite(t) ? n(t, 1) : '∞')}. Condition number κ = λ_max / λ_min of X̃ᵀX̃: ${vs(cur.gram?.kappa, base.gram?.kappa, 1, t => isFinite(t) ? n(t, 1) : '∞')}.` + (cur.gram ? EIG.details(cur.gram.A, cur.d.names, 'How these eigenvalues are calculated (this variant)') : ''),
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

  /* ================= Data properties ================= */
  const fitXY = (x, y) => { const mx = mean(x), my = mean(y); let a = 0, b = 0; x.forEach((v, i) => { a += (v - mx) * (y[i] - my); b += (v - mx) ** 2; }); const w = b > 0 ? a / b : 0; return [my - w * mx, w]; };
  const seg = (bw, xr) => xr.map(t => [t, bw[0] + bw[1] * t]);
  const testRows = ctx => { const P = ctx.P, F = ctx.full ? ctx.full.cur : ctx.cur.d; return { idx: P.te, x: P.te.map(i => F.X[i][1]), y: P.yte, yh: P.yhte, e: P.ete }; };
  const rmse = e => Math.sqrt(mean(e.map(t => t * t)));
  const pIdx = (P, j) => j; // column index is the same in P and in the view

  A.outliers = ctx => { const { cur, base, v, P } = ctx, d = cur.d, f = cur.f, x = d.X.map(r => r[1]), N = x.length;
    const flagged = (ctx.full ? ctx.full.cur : d).flagRows || [], fl = new Set(flagged.map(i => P.tr.indexOf(i)).filter(k => k >= 0));
    const s = Math.sqrt(f.s2), lev = f.lev || x.map(() => NaN), stud = f.e.map((t, i) => t / (s * Math.sqrt(Math.max(1e-12, 1 - lev[i])))), cook = f.cook || x.map(() => NaN);
    const fb = base.f, sb = Math.sqrt(fb.s2), studB = fb.e.map((t, i) => t / (sb * Math.sqrt(Math.max(1e-12, 1 - (fb.lev ? fb.lev[i] : 0)))));
    const keep = x.map((_, i) => i).filter(i => !fl.has(i)), w0 = fitXY(keep.map(i => x[i]), keep.map(i => d.y[i])), wAll = fitXY(x, d.y);
    const mx = a => Math.max(...a.filter(isFinite)), top = [...x.keys()].sort((i, j) => (cook[j] || 0) - (cook[i] || 0)).slice(0, 8);
    const gen = { outnone: 'Every row follows the same line: y = 2 + 1.5x + σ·z.', outy: 'One row in about 60, at an ordinary x, has its y pushed far up: think of a typo (an extra digit) or a one-off event.', levon: 'The last row is moved far out in x but kept on the true line: an unusual but genuine observation, like one very large house that is priced exactly as the trend says.', levoff: 'The last row is moved far out in x and far below the line: an unusual x with an unusual y, like a data-entry error in both columns.', outcluster: 'A small group of rows at high x is pulled down together: a sub-population or a batch with a recording problem.' }[v.id];
    return { gen,
      see: li([fl.size ? `The changed row(s) are training rows ${[...fl].map(k => P.tr[k] + 1).join(', ')} (highlighted in pink in the charts and the table).` : 'No row stands apart.',
        `Largest |studentised residual| r = e / (s√(1 − h)): ${vs(mx(stud.map(Math.abs)), mx(studB.map(Math.abs)))}. For bell-shaped errors |r| > 3 is rare.`,
        `Largest leverage h (how far a row's x is from the centre; the average is p/N = ${n(f.rank / N, 3)}): ${vs(mx(lev), fb.lev ? mx(fb.lev) : NaN, 3)}.`,
        `Largest Cook's distance (influence = residual × leverage): ${vs(mx(cook), fb.cook ? mx(fb.cook) : NaN, 3)}. Above 1, or above 4/N = ${n(4 / N, 3)}, deserves a look.`,
        fl.size ? `Refit without the changed row(s): intercept ${n(wAll[0], 3)} → ${n(w0[0], 3)}, slope ${n(wAll[1], 3)} → ${n(w0[1], 3)} (true 1.5). ${v.id === 'levon' ? 'Almost no change: the far-out row agrees with the others, and it actually makes the slope more precise.' : v.id === 'outcluster' ? 'The cluster moves the line as a block; removing any one of its rows alone would hardly change the fit (masking).' : 'This is the influence the diagnostics measure.'}` : '',
        v.id === 'outy' ? 'At a typical x the outlier mostly lifts the line (intercept) and inflates s², so every standard error grows.' : '']),
      draw: el => { const r1 = row(el), xr = range([x]), col = i => fl.has(i) ? C('--normal') : C('--floor');
        return [chart(r1, 'This variant: the fit with and without the changed rows', 240, c => { c.begin(xr, range([d.y]), 'x', 'y'); x.forEach((t, i) => c.dot([t, d.y[i]], col(i), fl.has(i) ? 5 : 3, fl.has(i), 0.85));
            c.line(seg(wAll, xr), C('--surface'), 2.4); if (fl.size) c.line(seg(w0, xr), C('--ink'), 1.6, [5, 4]); c.end();
            c.legend([[C('--surface'), 'fit on all training rows'], ...(fl.size ? [[C('--ink'), 'fit without the changed rows', true], [C('--normal'), 'changed rows']] : [])]); }),
          chart(r1, 'This variant: leverage vs studentised residual', 240, c => { c.begin([0, Math.max(mx(lev), 0.2)], range([stud, [-3, 3]]), 'leverage h', 'studentised residual r'); [-2, 2].forEach(t => c.hline(t, C('--muted'), [3, 4])); c.hline(0, C('--ink'));
            x.forEach((_, i) => c.dot([lev[i], stud[i]], col(i), fl.has(i) ? 5 : 3, false, 0.85)); c.end(); c.legend([[C('--muted'), '±2', true], [C('--normal'), 'changed rows']]); }),
          chart(row(el), "Baseline: leverage vs studentised residual", 220, c => { const lb = fb.lev || []; c.begin([0, Math.max(mx(lb), 0.2)], range([studB, [-3, 3]]), 'leverage h', 'studentised residual r'); [-2, 2].forEach(t => c.hline(t, C('--muted'), [3, 4])); lb.forEach((h, i) => c.dot([h, studB[i]], C('--floor'), 3, false, 0.8)); c.end(); })]; },
      table: table(['train row', 'x', 'y (true)', 'ŷ', 'e = y − ŷ', 'h', 'r', "Cook's D"], top.map(i => [P.tr[i] + 1, x[i], d.y[i], f.yhat[i], f.e[i], lev[i], stud[i], cook[i]]), { hi: k => fl.has(top[k]) ? 'hl' : '', max: 8, foot: 'The eight rows with the largest Cook’s distance. Highlighted: the rows this variant changed.' }) };
  };

  A.samplesize = ctx => { const { cur, base, v, P, Pb, S } = ctx, f = cur.f, N = P.N, p = P.P, k = p - 1;
    const grid = [p + 1, p + 3, 15, 25, 40, 60, 100, 150, 200].filter((t, i, a) => t > p && a.indexOf(t) === i).sort((a, b) => a - b);
    const curve = grid.map(nn => { const dd = GEN.generate('nlarge', { N: Math.ceil(nn / 0.8), sigma: S.sigma, strength: 0, seed: S.seed, k }), PP = PIPE.run(dd, { seed: S.seed, iters: 50 });
      return { n: PP.nTr, tr: PP.rmseTr, te: PP.rmseTe, se: PP.seOrig[1], df: PP.f.df }; });
    const se = P.seOrig[1], seB = Pb.seOrig[1];
    return { gen: `${P.N} rows in total, ${P.nTr} for training, for p = ${p} coefficients (an intercept and ${k} features). Each row is one equation; the model has ${p} unknowns.`,
      see: li([`Spare training rows (degrees of freedom) N_train − p = ${P.nTr} − ${f.rank} = ${vs(P.f.df, Pb.f.df, 0)}.`,
        P.f.df > 0 ? `Classical SE of the x slope: ${vs(se, seB, 4)}. It shrinks like 1/√N: four times the rows, half the SE.` : `<b>No spare rows:</b> s² = SSE / (N − p) would divide by ${P.f.df}, so s², the SEs, t-tests and intervals are undefined. With N < p the equations have infinitely many exact solutions; the app reports the one with the smallest length.`,
        P.f.df > 0 ? `t critical value for a 95% interval: ${vs(P.f.tc, Pb.f.tc, 2)} (it is about 2 only when there are plenty of spare rows).` : '',
        `Train RMSE ${n(P.rmseTr, 3)} vs test RMSE ${n(P.rmseTe, 3)} (baseline ${n(Pb.rmseTr, 3)} vs ${n(Pb.rmseTe, 3)}). With few rows the model fits the training noise, so training error is optimistic.`,
        f.rank < p ? `rank(X̃) = ${f.rank} < p = ${p}: X̃ᵀX̃ has ${p - f.rank} zero eigenvalue(s) (step 6).` : '']),
      draw: el => { const r1 = row(el), xs = curve.map(t => t.n);
        return [chart(r1, 'Learning curve: train and test RMSE as N grows', 240, c => { const ys = curve.flatMap(t => [t.tr, t.te]).filter(isFinite); c.begin([Math.min(...xs), Math.max(...xs)], [0, Math.min(Math.max(...ys), 6 * Math.max(S.sigma, 0.5))], 'training rows', 'RMSE');
            c.hline(S.sigma, C('--ink'), [5, 4]); c.line(curve.map(t => [t.n, t.tr]), C('--floor'), 2.2); c.line(curve.map(t => [t.n, Math.min(t.te, 1e6)]), C('--normal'), 2.2); c.vrule(P.nTr, C('--muted'), [3, 3], 1.4); c.end();
            c.legend([[C('--floor'), 'train RMSE'], [C('--normal'), 'test RMSE'], [C('--ink'), `σ = ${n(S.sigma, 2)} (the floor)`, true], [C('--muted'), 'this variant', true]]); }),
          chart(r1, 'Standard error of the slope as N grows', 240, c => { const ok = curve.filter(t => isFinite(t.se)); c.begin([Math.min(...xs), Math.max(...xs)], [0, Math.max(...ok.map(t => t.se), 0.01)], 'training rows', 'SE of the x slope');
            c.line(ok.map(t => [t.n, t.se]), C('--surface'), 2.2); ok.forEach(t => c.dot([t.n, t.se], C('--surface'), 3)); c.vrule(P.nTr, C('--muted'), [3, 3], 1.4); c.end(); c.legend([[C('--surface'), 'SE on a fresh sample of that size'], [C('--muted'), 'this variant', true]]); })]; },
      table: table(['training rows', 'spare rows N − p', 'train RMSE', 'test RMSE', 'SE of slope'], curve.map(t => [t.n, t.df, t.tr, t.te, isFinite(t.se) ? t.se : 'undefined']), { hi: i => curve[i].n === P.nTr ? 'hl' : '', max: 10, foot: 'Each row: a fresh dataset of that size from the same recipe, run through the same process.' }) };
  };

  A.noise = ctx => { const { cur, base, v, P, Pb, S } = ctx, d = cur.d, f = cur.f, x = d.X.map(r => r[1]), sg = ctx.full ? ctx.full.cur.sigmaUsed : S.sigma, k = P.P - 1;
    const sgs = [0, 0.5, 1, 2, 4, 8].map(t => { const dd = GEN.generate('nslow', { N: P.N, sigma: t, strength: 0, seed: S.seed, k }), PP = PIPE.run(dd, { seed: S.seed, iters: 50 }); return { s: t, r2: 1 - PP.f.SSE / PP.f.SST, te: PP.rmseTe, se: PP.seOrig[1] }; });
    return { gen: v.id === 'nspure' ? `y = 9.5 + noise: the noise has the same spread as the whole baseline y, but x plays no part. The true slope is 0.` : `y = 2 + 1.5x + σ·z with σ = ${n(sg, 2)}${v.id === 'nszero' ? ': every point lies exactly on the line' : ''}.`,
      see: li([`Estimated noise s = √(SSE / (N − p)): ${vs(Math.sqrt(f.s2), Math.sqrt(base.f.s2), 3)} (it estimates σ = ${n(sg, 2)}).`,
        `R² (share of the spread of y the line explains): ${vs(f.R2, base.f.R2, 3)}. More noise, lower R², even though the slope is still right on average.`,
        v.id === 'nszero' ? '<b>Perfect fit:</b> every residual is 0, so s² = 0, every SE is 0 and t is infinite. The diagnostics in step 10 have nothing to test and say so. Real data always have some noise.' : `SE of the slope: ${vs(P.seOrig[1], Pb.seOrig[1], 4)}: it grows in proportion to σ.`,
        `Test RMSE: ${vs(P.rmseTe, Pb.rmseTe, 3)}. No model can beat σ on new data: the noise is irreducible.`,
        v.id === 'nspure' ? `Estimated slope ${n(P.wOrig[1], 3)} with p-value ${pfmt(P.f.pv?.[1])}: in 5% of samples it will look "significant" by chance alone. Test R² ${n(P.r2Te, 3)}: no better than predicting the mean.` : '']),
      draw: el => { const r1 = row(el), xr = range([x, base.d.X.map(r => r[1])]);
        return [chart(r1, 'Baseline: data and fit', 230, c => { const bx = base.d.X.map(r => r[1]); c.begin(xr, range([d.y, base.d.y]), 'x', 'y'); bx.forEach((t, i) => c.dot([t, base.d.y[i]], C('--floor'), 3, false, 0.75)); c.line(seg(fitXY(bx, base.d.y), xr), C('--surface'), 2.2); c.end(); }),
          chart(r1, 'This variant: data and fit', 230, c => { c.begin(xr, range([d.y, base.d.y]), 'x', 'y'); x.forEach((t, i) => c.dot([t, d.y[i]], C('--floor'), 3, false, 0.75)); c.line(seg(fitXY(x, d.y), xr), C('--surface'), 2.2); c.end(); }),
          chart(row(el), 'R² and test RMSE as the noise grows (same rows, same x)', 220, c => { c.begin([0, 8], [0, Math.max(...sgs.map(t => t.te), 1)], 'noise σ', 'test RMSE'); c.line(sgs.map(t => [t.s, t.te]), C('--normal'), 2.2); c.line([[0, 0], [8, 8]], C('--ink'), 1.2, [4, 4]);
            sgs.forEach(t => { c.dot([t.s, t.te], C('--normal'), 3); c.text(`R² ${n(t.r2, 2)}`, [t.s, t.te], C('--muted'), 4, -6); }); c.end(); c.legend([[C('--normal'), 'test RMSE (labels: training R²)'], [C('--ink'), 'RMSE = σ', true]]); })]; },
      table: table(['noise σ', 'training R²', 'test RMSE', 'SE of slope'], sgs.map(t => [t.s, t.r2, t.te, t.se]), { max: 6, foot: 'A fresh sample at each noise level, same x values: the slope stays right on average, but R² falls and every uncertainty grows with σ.' }) };
  };

  A.range = ctx => { const { cur, base, v, P, Pb } = ctx, d = cur.d, f = cur.f, x = d.X.map(r => r[1]), xb = base.d.X.map(r => r[1]), F = ctx.full ? ctx.full.cur : d, T = testRows(ctx);
    const sxx = a => a.reduce((s2, t) => s2 + (t - mean(a)) ** 2, 0), fn = F.truth.fn && !F.truth.partial ? F.truth.fn : null;
    return { gen: { rwide: 'x is spread evenly over 0–10.', rrestrict: 'Only a narrow slice of x was ever observed, like a study that recruited only middle-aged people.', rgap: 'No observations between x = 4 and 7, like a sensor that was off for a while; the true curve happens to have a bump there.', rextrap: 'The model is trained on x below 6 and used on x above 6, like a demand model trained in normal years and used in a boom.' }[v.id],
      see: li([`Training range of x: ${n(Math.min(...x), 2)} to ${n(Math.max(...x), 2)} (baseline ${n(Math.min(...xb), 2)} to ${n(Math.max(...xb), 2)}). SD of x: ${vs(sdp(x), sdp(xb), 3)}.`,
        `SE of the slope = s / √Σ(x − x̄)² = ${n(Math.sqrt(f.s2), 3)} / √${n(sxx(x), 1)} = ${vs(f.se[1], base.f.se[1], 4)}. A narrow range of x gives the data little leverage on the slope.`,
        v.id === 'rgap' ? `Inside the gap the true curve rises by up to ${n(4 * ctx.S.strength, 2)} above the line, but no training row shows it: the fitted line passes straight through, and the confidence band is even narrow there because the gap is near the centre.` : '',
        v.id === 'rextrap' ? `Test rows (x from ${n(Math.min(...T.x), 2)} to ${n(Math.max(...T.x), 2)}) lie entirely beyond the training rows. Test RMSE ${vs(P.rmseTe, Pb.rmseTe, 3)} vs train ${n(P.rmseTr, 3)}: the line keeps going straight where the truth bends.` : `Test RMSE ${vs(P.rmseTe, Pb.rmseTe, 3)} (test rows come from the same range as training here).`]),
      draw: el => { const all = [...x, ...T.x], xr = range([all]), gx = Array.from({ length: 81 }, (_, i) => xr[0] + (xr[1] - xr[0]) * i / 80), bw = [f.w[0], f.w[1]];
        return [chart(row(el), 'This variant: training rows (filled), test rows (hollow), fit and truth', 250, c => { c.begin(xr, range([d.y, T.y]), 'x', 'y');
            x.forEach((t, i) => c.dot([t, d.y[i]], C('--floor'), 3, false, 0.8)); T.x.forEach((t, i) => c.dot([t, T.y[i]], C('--residual'), 3.6, true, 0.9));
            if (fn) c.line(gx.map(t => [t, fn(t, 0)]), C('--ink'), 1.6, [5, 4]); else c.line(gx.map(t => [t, 2 + 1.5 * t]), C('--ink'), 1.6, [5, 4]);
            c.line(seg(bw, xr), C('--surface'), 2.4); c.rect(Math.min(...x), c.box.y0, Math.max(...x), c.box.y1, C('--floor'), 0.05); c.end();
            c.legend([[C('--floor'), 'training rows (shaded: their x range)'], [C('--residual'), 'test rows'], [C('--surface'), 'fitted line'], [C('--ink'), 'true mean', true]]); }),
          chart(row(el), 'Where the rows are: histogram of x', 180, c => { const B = 20, lo = xr[0], w = (xr[1] - lo) / B, h = a => { const k2 = new Array(B).fill(0); a.forEach(t => k2[Math.min(B - 1, Math.floor((t - lo) / w))]++); return k2; }, ht = h(x), hb = h(T.x);
            c.begin(xr, [0, Math.max(...ht, ...hb, 1)], 'x', 'rows'); ht.forEach((q, i) => q && c.rect(lo + i * w, 0, lo + (i + 0.5) * w, q, C('--floor'), 0.7)); hb.forEach((q, i) => q && c.rect(lo + (i + 0.5) * w, 0, lo + (i + 1) * w, q, C('--residual'), 0.7)); c.end(); c.legend([[C('--floor'), 'training'], [C('--residual'), 'test']]); })]; },
      table: table(['test row', 'x', 'y (true)', 'ŷ', 'e = y − ŷ'], T.idx.map((i, k) => [i + 1, T.x[k], T.y[k], T.yh[k], T.e[k]]), { hi: k => Math.abs(T.e[k]) > 2 * Math.sqrt(f.s2) ? 'hl' : '', max: 10, foot: 'Test rows. Highlighted: errors larger than 2s, more than the noise alone explains.' }) };
  };

  A.irrelevant = ctx => { const { cur, base, v, P, Pb } = ctx, f = P.f, names = P.names, p = P.P, Nn = P.nTr;
    const noise = names.map((nm, j) => j).filter(j => /^n[₀-₉]/.test(names[j]) || names[j] === 'x_copy'), sig = noise.filter(j => f.pv?.[j] < 0.05);
    const adj = r2 => 1 - (1 - r2) * (Nn - 1) / Math.max(1, Nn - p), r2 = 1 - f.SSE / f.SST, r2b = 1 - Pb.f.SSE / Pb.f.SST;
    const nested = [0, ...noise.map((_, q) => q + 1)].map(m => { const cols = [...Array(p).keys()].filter(j => !noise.includes(j) || noise.indexOf(j) < m), g = ST.ols(P.Xtr.map(r => cols.map(j => r[j])), P.ytr, true), te = P.Xte.map(r => cols.map(j => r[j])), e = P.yte.map((t, i) => t - LA.dot(te[i], g.w));
      return { m, tr: Math.sqrt(g.SSE / Nn), te: rmse(e), r2: 1 - g.SSE / g.SST, adj: 1 - (g.SSE / Math.max(1, Nn - cols.length)) / (g.SST / (Nn - 1)) }; });
    return { gen: v.id === 'ircopy' ? 'x_copy is x measured a second time with a little noise: it carries no new information.' : `${noise.length} columns of pure noise (random numbers that y does not use) are added next to x. Think: dozens of fields copied into a dataset "just in case".`,
      see: li([`Training R² ${vs(r2, r2b, 3)} vs adjusted R² ${vs(adj(r2), 1 - (1 - r2b) * (Pb.nTr - 1) / Math.max(1, Pb.nTr - Pb.P), 3)}. R² can only go up when columns are added; adjusted R² charges for each one.`,
        `Train RMSE ${n(P.rmseTr, 3)} vs test RMSE ${n(P.rmseTe, 3)} (baseline ${n(Pb.rmseTr, 3)} vs ${n(Pb.rmseTe, 3)}): the extra columns fit training noise and hurt on new rows.`,
        v.id === 'ircopy' ? `x and x_copy share the credit: slopes ${n(P.wOrig[1], 3)} and ${n(P.wOrig[2], 3)} (they add up to about 1.5), with SEs ${n(P.seOrig[1], 3)} and ${n(P.seOrig[2], 3)} (baseline SE ${n(Pb.seOrig[1], 3)}).` : `Noise columns with p < 0.05: <b>${sig.length}</b> of ${noise.length} (${sig.map(j => names[j]).join(', ') || 'none'}). Each has a 5% chance by luck alone, so with many columns some will "look significant".`,
        `Spare rows N − p: ${vs(f.df, Pb.f.df, 0)}.`]),
      draw: el => { const r1 = row(el), cols = [...Array(p).keys()].slice(1), tc = f.tc || 1.96;
        return [chart(r1, 'Every coefficient with its 95% interval (true value as a dot)', Math.max(220, 40 + 22 * cols.length), c => { const lo = cols.map(j => P.wOrig[j] - tc * P.seOrig[j]), hi = cols.map(j => P.wOrig[j] + tc * P.seOrig[j]);
            c.begin(range([lo, hi, [0]]), [0.4, cols.length + 0.6], 'coefficient (original units)', '', { noY: true }); c.vrule(0, C('--ink'), [4, 4], 1.2);
            cols.forEach((j, k) => { const y = cols.length - k, tr = cur.d.truth.coef[j]; c.line([[lo[k], y], [hi[k], y]], noise.includes(j) ? (sig.includes(j) ? C('--normal') : C('--muted')) : C('--floor'), 4); c.dot([P.wOrig[j], y], C('--ink'), 3.5); if (tr != null) c.dot([tr, y], C('--surface'), 4, true); c.text(names[j], [lo[k], y], C('--ink'), -2, -7); });
            c.end(); c.legend([[C('--floor'), 'real features'], [C('--muted'), 'noise columns'], [C('--normal'), 'noise that looks significant'], [C('--surface'), 'true value']]); }),
          chart(r1, 'Adding the noise columns one by one', 240, c => { const ys = nested.flatMap(t => [t.tr, t.te]); c.begin([0, nested.length - 1], [0, Math.max(...ys)], 'noise columns included', 'RMSE');
            c.line(nested.map(t => [t.m, t.tr]), C('--floor'), 2.2); c.line(nested.map(t => [t.m, t.te]), C('--normal'), 2.2); c.end(); c.legend([[C('--floor'), 'train RMSE (always falls)'], [C('--normal'), 'test RMSE']]); })]; },
      table: table(['noise columns', 'train RMSE', 'test RMSE', 'R²', 'adjusted R²'], nested.map(t => [t.m, t.tr, t.te, t.r2, t.adj]), { max: 16, foot: 'The same training and test rows, refitted with more and more of the noise columns.' }) };
  };

  A.missing = ctx => { const { cur, base, v, P, Pb, S } = ctx, F = ctx.full ? ctx.full.cur : cur.d, dr = F.dropped, d = cur.d;
    const allX = F.full ? F.full.X.map(r => r[1]) : F.X.map(r => r[1]), allY = F.full ? F.full.y : F.y, lost = new Set(dr ? dr.idx : []);
    const obsX = allX.filter((_, i) => !lost.has(i)), obsY = allY.filter((_, i) => !lost.has(i)), wObs = fitXY(obsX, obsY), wAll = fitXY(allX, allY);
    const fifths = [0, 1, 2, 3, 4].map(q => { const ii = allX.map((t, i) => i).filter(i => allX[i] >= 2 * q && (q === 4 ? allX[i] <= 10.0001 : allX[i] < 2 * q + 2)); return { q, n: ii.length, lost: ii.filter(i => lost.has(i)).length, my: ii.length ? mean(ii.map(i => allY[i])) : NaN }; });
    return { gen: { mnone: 'Every y was recorded.', mcar: 'Each y was lost by pure chance (a dropped form, a server hiccup): missing completely at random (MCAR).', mar: 'High-x rows lose their y more often, but given x the loss is random: missing at random (MAR), because the cause (x) is observed.', mnar: 'Rows with high y lose their y more often, like high earners leaving income blank: missing not at random (MNAR), because the cause is the missing value itself.' }[v.id],
      see: li([dr ? `${dr.idx.length} of ${allY.length} rows lost their y (${n(100 * dr.idx.length / allY.length, 0)}%) and were dropped (complete-case analysis). ${P.N} rows remain.` : 'No values are missing.',
        `Share lost in each fifth of x: ${fifths.map(t => t.n ? n(100 * t.lost / t.n, 0) + '%' : '—').join(', ')}. ${v.id === 'mcar' ? 'About the same everywhere.' : v.id === 'mar' ? 'Rising with x.' : v.id === 'mnar' ? 'Rising with x too, because y rises with x, but the real cause is y.' : ''}`,
        `Slope on the rows that were kept: <b>${n(wObs[1], 3)}</b>; on every row (known only in a simulation): ${n(wAll[1], 3)}; true 1.5. ${v.id === 'mnar' ? 'Biased: the high-y rows that are gone would have pulled the line up at high x.' : v.id === 'mnone' ? '' : 'Unbiased: the loss does not depend on y once x is known, so the kept rows still follow the same line.'}`,
        dr ? `SE of the slope: ${vs(P.seOrig[1], Pb.seOrig[1], 4)}: fewer rows, more uncertainty.` : '',
        'Filling the gaps with the mean of y would be worse: it pulls the slope toward 0 and makes the SE too small. Multiple imputation, or modelling why values are missing, is the principled fix.']),
      draw: el => { const r1 = row(el), xr = range([allX]);
        return [chart(r1, 'All rows: kept (filled) and lost (hollow; their y is known only in a simulation)', 250, c => { c.begin(xr, range([allY]), 'x', 'y'); allX.forEach((t, i) => c.dot([t, allY[i]], lost.has(i) ? C('--normal') : C('--floor'), lost.has(i) ? 3.6 : 3, lost.has(i), 0.85));
            c.line(seg(wAll, xr), C('--ink'), 1.6, [5, 4]); c.line(seg(wObs, xr), C('--surface'), 2.4); c.end(); c.legend([[C('--surface'), 'fit on the kept rows'], [C('--ink'), 'fit on all rows', true], [C('--normal'), 'lost rows']]); }),
          chart(r1, 'Share of y lost in each fifth of x', 250, c => { c.begin([0.5, 5.5], [0, 100], 'fifth of x (left → right)', '% lost'); fifths.forEach((t, i) => t.n && c.rect(i + 0.65, 0, i + 1.35, 100 * t.lost / t.n, C('--normal'), 0.7)); c.end(); })]; },
      table: table(['fifth of x', 'rows', 'lost', '% lost', 'mean y of all rows'], fifths.map(t => [t.q + 1, t.n, t.lost, t.n ? 100 * t.lost / t.n : NaN, t.my]), { max: 5, foot: 'Under MAR the % lost changes with x; under MNAR it changes with y, which here also rises with x, so the two look alike in this table. Only knowledge of how the data were collected separates them.' }) };
  };

  A.target = ctx => { const { cur, base, v, P, Pb } = ctx, d = cur.d, f = cur.f, F = ctx.full ? ctx.full.cur : d, y = d.y, bnd = F.bounds;
    const sk = a => { const m = mean(a), s = sdp(a); return s > 0 ? mean(a.map(t => ((t - m) / s) ** 3)) : 0; }, yhAll = [...f.yhat, ...P.yhte];
    const out = bnd ? yhAll.filter(t => t < bnd[0] || t > bnd[1]).length : 0, ints = y.every(t => Math.abs(t - Math.round(t)) < 1e-9);
    return { gen: { tcont: 'y = 2 + 1.5x + σ·z: any real value, bell-shaped noise.', tskew: 'y grows by a fixed percentage per unit of x, with percentage noise: think prices, incomes, file sizes.', tbound: 'y is a score that cannot go below 0 or above 20 and follows an S-curve: think exam marks or a percentage.', tcount: 'y counts events: whole numbers 0, 1, 2, …, whose spread grows with their mean: think visits per day or defects per batch.' }[v.id],
      see: li([`Skewness of y: ${vs(sk(y), sk(base.d.y), 2)}.${ints ? ' Every y is a whole number.' : ''}`,
        `Breusch–Pagan p (constant spread): ${vs(cur.dg.bp?.p, base.dg.bp?.p, 3, pfmt)}; RESET p (straight line): ${vs(cur.dg.reset?.p, base.dg.reset?.p, 3, pfmt)}; Jarque–Bera p (bell shape): ${vs(cur.dg.jb?.p, base.dg.jb?.p, 3, pfmt)}.`,
        bnd ? `Predictions outside the possible range [${bnd[0]}, ${isFinite(bnd[1]) ? bnd[1] : '∞'}): <b>${out}</b> of ${yhAll.length}. A straight line does not know about the bounds.` : '',
        v.id === 'tskew' ? 'Taking log(y) turns the exponential curve into a straight line and the percentage noise into constant noise.' : v.id === 'tcount' ? 'A Poisson regression models log(mean) as a line, so predictions stay positive and the spread grows with the mean.' : v.id === 'tbound' ? 'A logistic-type model (or regression on log(y / (20 − y))) keeps predictions inside the bounds.' : '']),
      draw: el => { const r1 = row(el), yr = range([y, base.d.y]);
        const hist = (c, a, col) => { const B = 20, lo = yr[0], w = (yr[1] - lo) / B, k = new Array(B).fill(0); a.forEach(t => k[Math.min(B - 1, Math.max(0, Math.floor((t - lo) / w)))]++); c.begin(yr, [0, Math.max(...k, 1)], 'y', 'rows'); k.forEach((q, i) => q && c.rect(lo + i * w + w * 0.05, 0, lo + (i + 1) * w - w * 0.05, q, col, 0.7)); c.end(); };
        return [chart(r1, 'Baseline: distribution of y', 200, c => hist(c, base.d.y, C('--muted'))), chart(r1, 'This variant: distribution of y', 200, c => hist(c, y, C('--residual'))),
          chart(row(el), 'This variant: residuals vs fitted', 230, c => { c.begin(range([f.yhat]), sym(range([f.e])), 'fitted ŷ', 'residual e'); c.hline(0, C('--ink')); if (bnd) { c.vrule(bnd[0], C('--normal'), [3, 3], 1.2); if (isFinite(bnd[1])) c.vrule(bnd[1], C('--normal'), [3, 3], 1.2); }
            f.yhat.forEach((t, i) => c.dot([t, f.e[i]], C('--floor'), 3, false, 0.75)); c.end(); c.legend([[C('--floor'), 'a curve or a funnel here means y is the wrong shape for a straight line'], ...(bnd ? [[C('--normal'), 'possible range of y', true]] : [])]); })]; },
      table: table(['train row', 'x', 'y (true)', 'ŷ', 'e = y − ŷ', 'possible?'], [...y.keys()].sort((i, j) => f.yhat[i] - f.yhat[j]).map(i => [P.tr[i] + 1, d.X[i][1], y[i], f.yhat[i], f.e[i], bnd && (f.yhat[i] < bnd[0] || f.yhat[i] > bnd[1]) ? '✗ outside' : '✓']), { hi: k => '', max: 12, foot: 'Sorted by the prediction ŷ: read the residual column for the systematic pattern.' }) };
  };

  A.categorical = ctx => { const { cur, base, v, P } = ctx, d = cur.d, F = ctx.full ? ctx.full.cur : d, g = d.group, L = d.groupNames ? d.groupNames.length : 0, x = d.X.map(r => r[1]);
    if (!g) return { gen: 'Only the numeric x: y = 2 + 1.5x + σ·z.', see: li(['No categorical column: one line describes every row.', `Slope ${n(cur.f.w[1], 3)}.`]), draw: el => [chart(row(el), 'This variant: data and fit', 230, c => scatterXY(c, x, d.y, 'x', 'y', null, seg([cur.f.w[0], cur.f.w[1]], range([x]))))], table: '' };
    const lev = Array.from({ length: L }, (_, q) => { const ii = g.map((t, i) => t === q ? i : -1).filter(i => i >= 0), jk = q ? Object.keys(F.cat || {}).find(c2 => F.cat[c2] === q) : null, j = jk != null ? +jk : 0;
      return { q, n: ii.length, my: ii.length ? mean(ii.map(i => d.y[i])) : NaN, mx: ii.length ? mean(ii.map(i => x[i])) : NaN, j, w: q && j > 0 ? P.wOrig[j] : 0, se: q && j > 0 ? P.seOrig[j] : 0, tr: q && j > 0 ? d.truth.coef[j] : 0 }; });
    return { gen: `A category with ${L} levels. Each level is turned into its own 0/1 column (one-hot encoding), except the reference level (${esc(d.groupNames[0])}), whose effect is absorbed by the intercept.${L > 6 ? ' With this many levels, most of them have only a handful of rows.' : ''}`,
      see: li([`Rows per level: ${lev.map(t => t.n).join(', ')} (training rows).`,
        `Each dummy coefficient is the gap between its level and the reference at the same x: ${lev.slice(1, 7).map(t => `${esc(d.groupNames[t.q])} ${n(t.w, 2)} ± ${n(t.se, 2)}${t.tr != null ? ` (true ${n(t.tr, 2)})` : ''}`).join('; ')}${L > 7 ? '; …' : ''}.`,
        L > 6 ? `Levels with 1–2 rows get coefficients with huge SEs: the model memorises them. Test RMSE ${n(P.rmseTe, 3)} vs train ${n(P.rmseTr, 3)}. Target encoding with cross-fitting, or a mixed model with a random effect per level, shrinks rare levels toward the overall mean.` : 'A one-hot column with all levels kept would add up to the intercept column: the dummy-variable trap (see Multicollinearity).']),
      draw: el => { const r1 = row(el), xr = range([x]);
        return [chart(r1, 'This variant: y against x, coloured by level, one line per level', 250, c => { c.begin(xr, range([d.y]), 'x', 'y'); x.forEach((t, i) => c.dot([t, d.y[i]], gColor(g[i], L), 3, false, 0.8));
            if (L <= 6) lev.forEach(t => c.line(seg([P.wOrig[0] + (t.q ? t.w : 0) + P.wOrig.slice(2).reduce((s2, w, k) => s2 + (F.cat[k + 2] != null ? 0 : w * mean(d.X.map(r => r[k + 2]))), 0), P.wOrig[1]], xr), gColor(t.q, L), 2.2)); c.end();
            c.legend(L <= 6 ? lev.map(t => [gColor(t.q, L), esc(d.groupNames[t.q])]) : [[C('--muted'), `${L} levels (lines not drawn)`]]); }),
          chart(r1, 'Level coefficient ± 2 SE against rows in that level', 250, c => { const ls = lev.slice(1).filter(t => isFinite(t.se)); c.begin([0, Math.max(...ls.map(t => t.n), 2) + 1], range([ls.map(t => t.w - 2 * t.se), ls.map(t => t.w + 2 * t.se)]), 'training rows in the level', 'coefficient');
            ls.forEach(t => { c.line([[t.n, t.w - 2 * t.se], [t.n, t.w + 2 * t.se]], C('--muted'), 1.6); c.dot([t.n, t.w], gColor(t.q, L), 3.6); }); c.end(); c.legend([[C('--muted'), 'fewer rows, wider interval']]); })]; },
      table: table(['level', 'training rows', 'mean y', 'mean x', 'coefficient (vs reference)', 'SE', 'true gap'], lev.map(t => [esc(d.groupNames[t.q]), t.n, t.my, t.mx, t.q ? t.w : '— reference', t.q ? t.se : '—', t.q ? t.tr : 0]), { hi: k => lev[k].n <= 2 ? 'hl' : '', max: 26, foot: 'Highlighted: levels with two training rows or fewer.' }) };
  };

  A.subgroups = ctx => { const { cur, base, v, P } = ctx, d = cur.d, g = d.group, x = d.X.map(r => r[1]), e = cur.f.e;
    if (!g) return { gen: 'One population: every row follows the same line.', see: li(['No hidden groups.', `Slope ${n(cur.f.w[1], 3)}.`]), draw: el => [chart(row(el), 'Data and fit', 230, c => scatterXY(c, x, d.y, 'x', 'y', null, seg([cur.f.w[0], cur.f.w[1]], range([x]))))], table: '' };
    const gi = k => x.map((_, i) => i).filter(i => g[i] === k), ws = [0, 1].map(k => fitXY(gi(k).map(i => x[i]), gi(k).map(i => d.y[i]))), wp = [cur.f.w[0], cur.f.w[1]];
    return { gen: { sgint: 'Two groups with different baselines (7 units apart), and group 1 also tends to have higher x. The group was not recorded.', sgslope: 'Two groups where x matters differently (slope 1.5 vs a flatter or negative slope). The group was not recorded.', simpson: 'Within each group, more x means more y (slope +1.5). But the group with high x starts 18 units lower. The group was not recorded.' }[v.id],
      see: li([`Pooled slope (the model): <b>${n(wp[1], 3)}</b>. Slope inside group 0: ${n(ws[0][1], 3)}; inside group 1: ${n(ws[1][1], 3)}.${v.id === 'simpson' && Math.sign(wp[1]) !== Math.sign(ws[0][1]) ? ' <b>The sign is reversed</b>: Simpson’s paradox.' : ''}`,
        `Mean residual by group: group 0 ${n(mean(gi(0).map(i => e[i])), 2)}, group 1 ${n(mean(gi(1).map(i => e[i])), 2)}. A hidden group shows up as residuals that are systematically on one side for that group.`,
        `Jarque–Bera p ${pfmt(cur.dg.jb?.p)} and RESET p ${pfmt(cur.dg.reset?.p)}: the residuals can look bimodal or curved, but only colouring by the group makes the cause obvious.`,
        'The fix is to record the group and add it to the model (and the group × x interaction if the slopes differ). Then each group gets its own line.']),
      draw: el => { const r1 = row(el), xr = range([x]);
        return [chart(r1, 'This variant: the data coloured by the hidden group', 250, c => { c.begin(xr, range([d.y]), 'x', 'y'); x.forEach((t, i) => c.dot([t, d.y[i]], gColor(g[i], 2), 3, false, 0.85));
            ws.forEach((w, k) => c.line(seg(w, range([gi(k).map(i => x[i])])), gColor(k, 2), 2, [5, 4])); c.line(seg(wp, xr), C('--ink'), 2.6); c.end();
            c.legend([[C('--ink'), `pooled line (slope ${n(wp[1], 2)})`], [gColor(0, 2), `group 0 (slope ${n(ws[0][1], 2)})`, true], [gColor(1, 2), `group 1 (slope ${n(ws[1][1], 2)})`, true]]); }),
          chart(r1, 'Residuals of the pooled model, by group', 250, c => { c.begin([0.4, 2.6], sym(range([e])), 'group', 'residual e'); c.hline(0, C('--ink')); e.forEach((t, i) => c.dot([g[i] + 1 + ((i * 37) % 11 - 5) * 0.03, t], gColor(g[i], 2), 3, false, 0.8));
            [0, 1].forEach(k => { const m = mean(gi(k).map(i => e[i])); c.line([[k + 0.7, m], [k + 1.3, m]], C('--ink'), 3); }); c.end(); })]; },
      table: table(['group', 'rows', 'mean x', 'slope inside the group', 'intercept inside the group', 'mean pooled residual'], [0, 1].map(k => [k, gi(k).length, mean(gi(k).map(i => x[i])), ws[k][1], ws[k][0], mean(gi(k).map(i => e[i]))]), { max: 2 }) };
  };

  A.shift = ctx => { const { cur, base, v, P, Pb } = ctx, d = cur.d, x = d.X.map(r => r[1]), T = testRows(ctx), wt = fitXY(T.x, T.y);
    return { gen: { shnone: 'The test rows are a random 20% of the same population.', shfeat: 'The test rows are a later period in which x is mostly high (around 7.5). The rule linking x to y has not changed: covariate shift.', shrel: 'The test rows are a later period in which the effect of x has weakened (slope 0.3 instead of 1.5): concept drift.' }[v.id],
      see: li([`Mean x: training ${n(mean(x), 2)}, test ${n(mean(T.x), 2)}; SD of x: ${n(sdp(x), 2)} vs ${n(sdp(T.x), 2)}.`,
        `Train RMSE ${n(P.rmseTr, 3)} vs test RMSE ${vs(P.rmseTe, Pb.rmseTe, 3)}.`,
        `A line fitted to the test rows alone has slope ${n(wt[1], 3)} (the model uses ${n(P.wOrig[1], 3)}).`,
        v.id === 'shfeat' ? 'Because the rule is the same and the model is the right shape, the predictions are still good: covariate shift only hurts a model that is wrong in the region the new data move to.' : v.id === 'shrel' ? 'The model learned a rule that no longer holds. No amount of training data from the past fixes this: retrain on recent data and monitor errors over time.' : '']),
      draw: el => { const r1 = row(el), xr = range([x, T.x]);
        return [chart(r1, 'Training rows (filled) and test rows (hollow) with the fitted line', 250, c => { c.begin(xr, range([d.y, T.y]), 'x', 'y'); x.forEach((t, i) => c.dot([t, d.y[i]], C('--floor'), 3, false, 0.7)); T.x.forEach((t, i) => c.dot([t, T.y[i]], C('--residual'), 3.8, true, 0.95));
            c.line(seg([cur.f.w[0], cur.f.w[1]], xr), C('--surface'), 2.4); c.line(seg(wt, range([T.x])), C('--residual'), 1.6, [5, 4]); c.end(); c.legend([[C('--surface'), 'model (trained on the training rows)'], [C('--residual'), 'what the test rows actually follow', true]]); }),
          chart(r1, 'Test errors against x', 250, c => residVsX(c, T.x, T.e, sym(range([T.e, cur.f.e])), { k: 4 }))]; },
      table: table(['test row', 'x', 'y (true)', 'ŷ', 'e = y − ŷ'], T.idx.map((i, k) => [i + 1, T.x[k], T.y[k], T.yh[k], T.e[k]]), { max: 12 }) };
  };

  A.leakage = ctx => { const { cur, base, v, P, Pb, S } = ctx, d = cur.d, F = ctx.full ? ctx.full.cur : d, names = P.names;
    if (v.id === 'lktarget') { const j = names.indexOf('leak'), r = corr(d.X.map(rw => rw[j]), d.y);
      const prod = P.Xte.map(rw => rw.map((t, q) => q === j ? 0 : t)), eP = P.yte.map((t, i) => t - LA.dot(prod[i], P.f.w)), rP = rmse(eP);
      return { gen: 'A column called "leak" is y plus a little noise: for example "total paid" when predicting "amount owed", or a field filled in after the outcome was known. It exists in the historical data, so it is in both train and test.',
        see: li([`Correlation between leak and y: <b>${n(r, 3)}</b>. A single feature that predicts the target almost perfectly is a warning sign, not a success.`,
          `Coefficients: leak ${n(P.wOrig[j], 3)}, x ${n(P.wOrig[1], 3)} (true effect of x: 1.5). The model leans on the leak and nearly ignores x.`,
          `Test RMSE ${vs(P.rmseTe, Pb.rmseTe, 3)}: the test set contains the leak too, so the score is too good to be true.`,
          `At prediction time the leak is not known yet. Replace it with its training mean (the best you can do without it) and the test RMSE becomes <b>${n(rP, 3)}</b>, worse than the honest model without the leak (${n(Pb.rmseTe, 3)}).`]),
        draw: el => { const r1 = row(el); return [chart(r1, 'y against the leak column', 230, c => scatterXY(c, d.X.map(rw => rw[j]), d.y, 'leak', 'y')),
          chart(r1, 'Test RMSE: what the report says vs what happens', 230, c => { const vals = [['train', P.rmseTr], ['test (leak present)', P.rmseTe], ['real use (no leak)', rP], ['honest model', Pb.rmseTe]], top = Math.max(...vals.map(t => t[1]));
            c.begin([0.4, vals.length + 0.6], [0, top * 1.1], '', 'RMSE'); vals.forEach(([lab, t], k) => { c.rect(k + 0.65, 0, k + 1.35, t, k === 2 ? C('--normal') : C('--surface'), 0.7); c.text(lab, [k + 0.6, t], C('--ink'), 0, -6); }); c.end(); })]; },
        table: table(['test row', 'x', 'leak', 'y (true)', 'ŷ with the leak', 'ŷ without it'], P.te.map((i, k) => [i + 1, F.X[i][1], F.X[i][j], P.yte[k], P.yhte[k], P.yte[k] - eP[k]]), { max: 10 }) };
    }
    if (v.id === 'lkprep') { const pr = F.prep, jE = names.indexOf('enc'), tr = pr.sp.tr, te = pr.sp.te;
      // honest pipeline: the same model with the encoding learned on the training rows only
      const Xh = idx => idx.map(i => [1, F.X[i][1], pr.honest[i]]), gH = ST.ols(Xh(tr), tr.map(i => F.y[i]), true), eH = te.map(i => F.y[i] - LA.dot(Xh([i])[0], gH.w));
      const yt = te.map(i => F.y[i]), mt = mean(yt), r2H = 1 - eH.reduce((s2, t) => s2 + t * t, 0) / yt.reduce((s2, t) => s2 + (t - mt) ** 2, 0), selfShare = 1 / pr.rowsPer;
      return { gen: `An ID-like category with ${pr.L} possible levels (about ${n(pr.rowsPer, 1)} row each, many levels seen only once) that has no effect on y. Before splitting, each level was replaced by the mean y of its rows, computed on all rows. A test row's own y is part of its level's mean, so the test rows leaked into their own feature.`,
        see: li([`Each enc value contains the row's own y with weight 1 / (rows in its level): for a level seen only once, enc is exactly the row's own y. A test row "sees" its answer.`,
          `Coefficient on enc: ${n(P.wOrig[jE], 3)} (p ${pfmt(P.f.pv?.[jE])}), although the category does nothing.`,
          `Test RMSE of the leaky pipeline: <b>${n(P.rmseTe, 3)}</b>; test R² ${n(P.r2Te, 3)}. Honest pipeline (encoding learned on the training rows, then applied to the test rows): RMSE <b>${n(rmse(eH), 3)}</b>, R² ${n(r2H, 3)}. Baseline without the category: RMSE ${n(Pb.rmseTe, 3)}.`,
          'Scaling with the mean and SD of all rows (instead of the training rows) is also leakage, but for plain least squares it changes nothing: the predictions are identical. Steps that use y (target encoding, feature selection, imputation from y) are the ones that really leak.']),
        draw: el => { const r1 = row(el), tx = te.map(i => pr.leaky[i]), th = te.map(i => pr.honest[i]);
          return [chart(r1, 'Test rows: y against enc (leaky vs honest encoding)', 240, c => { c.begin(range([tx, th]), range([yt]), 'enc (mean y of the level)', 'y'); th.forEach((t, k) => c.dot([t, yt[k]], C('--muted'), 3.4, true, 0.85)); tx.forEach((t, k) => c.dot([t, yt[k]], C('--normal'), 3.4, false, 0.85)); c.end();
              c.legend([[C('--normal'), 'leaky: encoded with all rows (tracks y)'], [C('--muted'), 'honest: encoded with training rows only']]); }),
            chart(r1, 'Test RMSE: leaky vs honest', 240, c => { const vals = [['leaky pipeline', P.rmseTe], ['honest pipeline', rmse(eH)], ['no category', Pb.rmseTe]], top = Math.max(...vals.map(t => t[1]));
              c.begin([0.4, vals.length + 0.6], [0, top * 1.15], '', 'test RMSE'); vals.forEach(([lab, t], k) => { c.rect(k + 0.65, 0, k + 1.35, t, k === 0 ? C('--normal') : C('--surface'), 0.7); c.text(`${lab} ${n(t, 2)}`, [k + 0.6, t], C('--ink'), 0, -6); }); c.end(); })]; },
        table: table(['test row', 'level', 'y (true)', 'enc leaky', 'enc honest', 'ŷ leaky', 'ŷ honest'], te.map((i, k) => [i + 1, pr.lev[i] + 1, F.y[i], pr.leaky[i], pr.honest[i], P.yhte[k], F.y[i] - eH[k]]), { max: 10, foot: 'The leaky encoding of a test row moves toward that row’s own y; the honest one cannot.' }) };
    }
    return { gen: 'Every feature is known before y, and nothing is learned from the data before the split.', see: li(['Nothing leaks: the test score is an honest estimate of performance on new rows.', `Test RMSE ${n(P.rmseTe, 3)}.`]), draw: el => [chart(row(el), 'Data and fit', 230, c => scatterXY(c, d.X.map(r => r[1]), d.y, 'x', 'y'))], table: '' };
  };

  function howFit(v){
    const d = v.d, f = v.f;
    if (d.X[0].length !== 2) return `the weights solve the normal equations X̃ᵀX̃ w̃ = X̃ᵀy, exactly as in <a href="#step-9a" data-goto="step-9a">step 9a</a>`;
    const x = d.X.map(r => r[1]), mx_ = mean(x), my = mean(d.y), sxy = x.reduce((s2, t, i) => s2 + (t - mx_) * (d.y[i] - my), 0), sxx = x.reduce((s2, t) => s2 + (t - mx_) ** 2, 0);
    return `slope w = Σ(x − x̄)(y − ȳ) / Σ(x − x̄)² = ${n(sxy, 3)} / ${n(sxx, 3)} = <b>${n(sxy / sxx, 3)}</b>, intercept b = ȳ − w·x̄ = ${n(my, 3)} − ${n(sxy / sxx, 3)} × ${n(mx_, 3)} = <b>${n(my - sxy / sxx * mx_, 3)}</b> (the formulas derived in <a href="#step-9a" data-goto="step-9a">step 9a</a>)`;
  }
  function render(el, ctx){
    const fn = A[ctx.a.id]; if (!fn) { el.innerHTML = ''; return []; }
    ONE = !!ctx.isBase; const r = fn(ctx);
    const head = ctx.embedded ? `<h3 class="sig-h3" id="sig-h">${ctx.isBase ? 'What healthy data look like' : '3. What it looks like in the data'}</h3>` : `<h2 id="sig-h">What to look for in the data</h2>`;
    el.innerHTML = `${head}
      <p class="hint-s">${ctx.isBase ? `Baseline selected: this is what <b>healthy</b> data look like for ${esc(ctx.a.name.toLowerCase())}. Pick a variant to see its fingerprint next to this one.` : `Compared with the baseline built from the same random numbers, so the only difference is this property.`} Everything here uses the training rows, the same as the process steps.</p>
      <p class="sig-fit"><b>Where the fitted numbers come from.</b> The residuals are e = y − ŷ, with ŷ from the least-squares fit on these rows: ${howFit(ctx.cur)}.${ctx.isBase ? '' : ` Baseline: ${howFit(ctx.base)}.`}</p>
      <div class="sig-grid"><div class="sig-card"><h3>How these data were made</h3><p>${r.gen}</p></div><div class="sig-card"><h3>What you should see</h3>${r.see}</div></div>
      <div class="sig-pics"></div><h3 class="sig-th">In the rows</h3>${r.table}`;
    let charts = [];
    try { charts = r.draw(el.querySelector('.sig-pics')) || []; } catch (err) { console.error(err); }
    if (ONE) charts = charts.filter(c => { const t = c.titleEl.textContent; if (t.startsWith('Baseline:')) { c.dispose(); c.wrap.remove(); return false; } if (t.startsWith('This variant:')) c.title(t.replace('This variant:', 'Baseline:')); return true; });
    return charts;
  }
  return { render, trueErr, runs, lag1, bins };
})();
