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
    return { gen: dummy ? 'A text column, colour (blue, green, red), is one-hot encoded in step 5 and all three 0/1 columns (colour_blue, colour_green, colour_red) are kept alongside the intercept column of 1s.' : combo ? 'Three features where x₃ = x₁ + x₂ (think: "total spend" kept next to "online spend" and "store spend").' : v.id === 'perfect' ? 'x₂ = 2·x₁ (plus noise that the strength slider removes). Think: the same length recorded in inches and in half-inches.' : `${esc(v.desc)} Think: house size and number of rooms, or age and years of experience.`,
      see: li([dummy ? 'Every row has exactly one 1 among the three colour columns, so colour_blue + colour_green + colour_red = 1 = the intercept column on every row. Nothing in the raw data looks odd: the problem is created by the encoding.' :
          `In the x₁-vs-x₂ scatter the points ${Math.abs(r) > 0.99 ? 'lie on a line' : Math.abs(r) > 0.9 ? 'form a thin cigar' : 'form a tilted cloud'}, instead of filling the square (baseline).`,
        !dummy ? `Correlation r(x₁, x₂): ${vs(r, rb)}. Only √(1 − r²) = <b>${n(Math.sqrt(Math.max(0, 1 - r * r)) * 100, 0)}%</b> of x₂'s spread is independent of x₁ (baseline ${n(Math.sqrt(1 - rb * rb) * 100, 0)}%). That sliver is all the data has to tell the two effects apart.` : '',
        `Largest VIF: ${vs(vmax, vb, 1, t => isFinite(t) ? n(t, 1) : '∞')}. Condition number κ = λ_max / λ_min of X̃ᵀX̃: ${vs(cur.gram?.kappa, base.gram?.kappa, 1, t => isFinite(t) ? n(t, 1) : '∞')}.` + (cur.gram ? EIG.details(cur.gram.A, cur.d.names, 'How these eigenvalues are calculated (this variant)') : ''),
        `Coefficients: ${d.names.slice(1).map((nm, k) => `${nm} ${n(cur.f.w[k + 1], 2)}${isFinite(cur.f.se[k + 1]) ? ` ± ${n(cur.f.se[k + 1], 2)}` : ' (not identifiable)'}`).join(', ')}. True: ${d.names.slice(1).map((nm, k) => `${nm} ${d.truth.coef[k + 1] ?? '—'}`).join(', ')}. Predictions are still fine (R² ${n(cur.f.R2, 3)} vs ${n(base.f.R2, 3)}): only the split of credit between the features is unstable.`]),
      draw: el => { const r1 = row(el), out = [];
        if (!dummy) { out.push(chart(r1, 'Baseline: x₁ vs x₂', 240, c => scatterXY(c, b1, b2, 'x₁', 'x₂')), chart(r1, 'This variant: x₁ vs x₂', 240, c => scatterXY(c, x1, x2, 'x₁', 'x₂'))); }
        else out.push(chart(r1, 'This variant: data by category (the trap is in the columns, not the points)', 240, c => scatterXY(c, d.px, d.y, 'x', 'y', i => gColor(d.group[i], 3))));
        return out; },
      table: table(dummy ? ['row', 'colour (text)', '1', 'colour_blue', 'colour_green', 'colour_red', 'sum of the three'] : combo ? ['row', 'x₁', 'x₂', 'x₃', 'x₃ − x₁ − x₂'] : ['row', 'x₁', 'x₂', 'x₂ − 2·x₁', 'y (true)'],
        d.X.map((rw, i) => dummy ? [i + 1, d.rawCat ? d.rawCat.vals[i] : '', 1, rw[2], rw[3], rw[4], check[i]] : combo ? [i + 1, rw[1], rw[2], rw[3], check[i]] : [i + 1, rw[1], rw[2], check[i], d.y[i]]),
        { hi: i => Math.abs(check[i] - (dummy ? 1 : 0)) < 1e-6 ? 'hl' : '', max: 10, foot: dummy ? 'Highlighted: the three colour columns add up to the intercept column exactly, so one column is redundant.' : combo || v.id === 'perfect' ? 'Highlighted: the identity holds exactly on that row. When it holds on every row, XᵀX has no inverse.' : '' }) };
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

  /* ================= Feature engineering: the same raw data, different columns built in step 5 ================= */
  function feCurve(dd, f, xr){ const dv = dd.derive; if (!dv) return null; const m = dd.X[0].map((_, j) => mean(dd.X.map(r => r[j]))); return Array.from({ length: 121 }, (_, k) => { const xv = xr[0] + (xr[1] - xr[0]) * k / 120, r = [...m]; dv.f(xv).forEach((t, q) => { r[dv.cols[q]] = t; }); return [xv, LA.dot(r, f.w)]; }); }
  function feSig(ctx){ const { cur, base, v, P, Pb, a } = ctx, d = cur.d, F = ctx.full ? ctx.full.cur : d, fe = F.fe, FB = ctx.full ? ctx.full.base : base.d;
    const kap = x => isFinite(x) ? n(x, 1) : '∞', resetP = g => pfmt(g.dg?.reset?.p);
    const rowsNum = [['columns after step 5', P.names.slice(1).join(', '), Pb.names.slice(1).join(', ')], ['train RMSE', n(P.rmseTr, 3), n(Pb.rmseTr, 3)], ['test RMSE', n(P.rmseTe, 3), n(Pb.rmseTe, 3)],
      ...(P.orig || Pb.orig ? [['test RMSE in the units of y', n(P.orig ? P.orig.rmseTe : P.rmseTe, 3), n(Pb.orig ? Pb.orig.rmseTe : Pb.rmseTe, 3)]] : []),
      ['κ of X̃ᵀX̃ (step 6)', kap(P.f.kappa), kap(Pb.f.kappa)], ['RESET p (shape)', resetP(cur), resetP(base)], ['largest VIF', cur.dg.vif?.length ? kap(Math.max(...cur.dg.vif)) : '—', base.dg.vif?.length ? kap(Math.max(...base.dg.vif)) : '—'],
      ['gradient descent: loss after the last iteration vs the minimum', `${n(P.lossHist[P.lossHist.length - 1], 4)} vs ${n(P.f.SSE / P.nTr, 4)}`, `${n(Pb.lossHist[Pb.lossHist.length - 1], 4)} vs ${n(Pb.f.SSE / Pb.nTr, 4)}`]];
    const tbl = `<div class="sig-tbl"><table><tr><th>quantity</th><th>this variant</th><th>baseline (${esc(a.variants[0].name)})</th></tr>${rowsNum.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table></div>`;
    const gen = `${esc(v.desc)} The raw data are identical for every variant of ${esc(a.name.toLowerCase())}; only the columns built in step 5 differ.${F.note ? ' ' + esc(F.note) + '.' : ''}`;
    const see = li([`Columns that reach the model: <b>${P.names.slice(1).join(', ')}</b> (baseline: ${Pb.names.slice(1).join(', ')}).`,
      fe.attr === 'scaling' ? `Predictions are identical to the baseline (train RMSE ${n(P.rmseTr, 4)} vs ${n(Pb.rmseTr, 4)}), but κ is ${kap(P.f.kappa)} vs ${kap(Pb.f.kappa)}, so gradient descent ${P.lossHist[P.lossHist.length - 1] - P.f.SSE / P.nTr < 1e-3 * (P.f.SSE / P.nTr) ? 'reaches the minimum' : 'is still far from the minimum'} after ${P.lossHist.length - 1} iterations.` :
      fe.attr === 'centering' ? `Predictions are identical (train RMSE ${n(P.rmseTr, 4)} vs ${n(Pb.rmseTr, 4)}); what changes is the collinearity: largest VIF ${cur.dg.vif?.length ? kap(Math.max(...cur.dg.vif)) : '—'} vs ${base.dg.vif?.length ? kap(Math.max(...base.dg.vif)) : '—'}, and the SE of the linear term ${n(P.seOrig[1], 4)} vs ${n(Pb.seOrig[1], 4)}.` :
      `Test RMSE ${n(P.orig ? P.orig.rmseTe : P.rmseTe, 3)} vs ${n(Pb.orig ? Pb.orig.rmseTe : Pb.rmseTe, 3)} for the baseline${P.orig ? ' (both back in the units of y)' : ''}; train RMSE ${n(P.rmseTr, 3)} vs ${n(Pb.rmseTr, 3)}.${P.rmseTe > 1.3 * P.rmseTr ? ' The gap between train and test is the sign of overfitting.' : ''}`,
      fe.attr === 'selection' ? `Kept ${P.names.length - 1} of 10 columns. Useful columns kept: ${['x₁', 'x₂', 'x₃', 'x₄'].filter(x => P.names.includes(x)).join(', ') || 'none'}; noise kept: ${P.names.filter(x => /^n/.test(x)).join(', ') || 'none'}; the copy x₅ ${P.names.includes('x₅') ? 'kept' : 'dropped'}.` : '',
      fe.attr === 'encoding' && fe.kind === 'keepall' ? `rank(X̃) = ${P.f.rank} of ${P.P}: the coefficients are not unique (the app shows the shortest solution).` : '',
      `RESET p: ${resetP(cur)} (baseline ${resetP(base)}): a small value means a shape the columns still miss.`]);
    const draw = el => { const r1 = row(el), out = [];
      if (fe.attr === 'scaling') {
        out.push(chart(r1, 'Gradient descent: loss at each iteration (log scale)', 240, c => { const L = P.lossHist.map(x => Math.min(x, 1e12)), Lb = Pb.lossHist.map(x => Math.min(x, 1e12)), m = Math.min(P.f.SSE / P.nTr, ...L, ...Lb);
          c.begin([0, Math.max(L.length, Lb.length) - 1], [Math.max(m * 0.9, 1e-6), Math.max(...L, ...Lb)], 'iteration', 'loss (log)', { logY: true }); c.hline(P.f.SSE / P.nTr, C('--ink'), [5, 4]); c.line(Lb.map((t, i) => [i, t]), BASEC(), 2, [4, 3]); c.line(L.map((t, i) => [i, t]), CUR(), 2.4); c.end();
          c.legend([[CUR(), 'this variant'], [BASEC(), 'baseline', true], [C('--ink'), 'the minimum (closed form)', true]]); }));
        out.push(chart(r1, 'x₂ after scaling (training rows)', 240, c => { const j = 2, z = P.Xtr.map(r => r[j]), lo = Math.min(...z), hi = Math.max(...z), B = 24, w = (hi - lo) / B || 1, k = new Array(B).fill(0); z.forEach(t => k[Math.min(B - 1, Math.floor((t - lo) / w))]++);
          c.begin([lo, hi], [0, Math.max(...k)], `scaled x₂ (${P.scale})`, 'rows'); k.forEach((q, i) => q && c.rect(lo + i * w, 0, lo + (i + 1) * w, q, CUR(), 0.7)); c.end(); }));
        return out; }
      if (fe.attr === 'selection') { const js = P.names.map((nm, j) => j).slice(1), tc = P.f.tc || 1.96;
        out.push(chart(r1, 'Kept columns with 95% intervals (true value as a ring)', Math.max(200, 40 + 26 * js.length), c => { const lo = js.map(j => P.wOrig[j] - tc * P.seOrig[j]), hi = js.map(j => P.wOrig[j] + tc * P.seOrig[j]); c.begin(range([lo, hi, [0]]), [0.4, js.length + 0.6], 'coefficient', '', { noY: true }); c.vrule(0, C('--ink'), [4, 4], 1.2);
          js.forEach((j, k) => { const y = js.length - k, tr = F.truth.coef[j]; c.line([[lo[k], y], [hi[k], y]], /^n/.test(P.names[j]) ? C('--normal') : C('--floor'), 4); c.dot([P.wOrig[j], y], C('--ink'), 3.5); if (tr != null) c.dot([tr, y], C('--surface'), 4.5, true); c.text(P.names[j], [lo[k], y], C('--ink'), -2, -7); }); c.end(); c.legend([[C('--floor'), 'useful or copy'], [C('--normal'), 'noise column'], [C('--surface'), 'true value']]); }));
        return out; }
      const xr = range([F.derive ? F.derive.raw : d.X.map(r => r[1])]), xs = cur.d.derive ? cur.d.derive.raw : d.X.map(r => r[1]), cv = feCurve(cur.d, cur.f, xr), cb = feCurve(base.d, base.f, xr);
      const yl = F.yName || 'y';
      out.push(chart(r1, `Training rows with the fitted model: this variant (solid) vs baseline (dashed)`, 250, c => { const ys = [...d.y, ...(cv || []).map(p => p[1]), ...(cb && !F.yName ? cb.map(p => p[1]) : [])].filter(isFinite); c.begin(xr, range([ys]), `${F.derive?.axisName || 'x'} (raw)`, yl);
        xs.forEach((t, i) => c.dot([t, d.y[i]], d.group ? gColor(d.group[i], d.groupNames.length) : C('--floor'), 3, false, 0.75)); if (cb && !F.yName) c.line(cb, BASEC(), 2, [5, 4]); if (cv) c.line(cv, CUR(), 2.6); if (F.truth.fnRaw) c.line(Array.from({ length: 81 }, (_, k) => { const xv = xr[0] + (xr[1] - xr[0]) * k / 80; return [xv, F.truth.fnRaw(xv)]; }), C('--ink'), 1.4, [2, 3]); c.end();
        c.legend([[CUR(), 'this variant'], ...(cb && !F.yName ? [[BASEC(), 'baseline', true]] : []), ...(F.truth.fnRaw ? [[C('--ink'), 'truth', true]] : [])]); }));
      out.push(chart(r1, 'Residuals against the raw x: this variant', 250, c => residVsX(c, xs, cur.f.e, sym(range([cur.f.e])), { k: 6, xName: `${F.derive?.axisName || 'x'} (raw)` })));
      if (P.orig) out.push(chart(row(el), 'Back on the original scale of y: test rows, predicted vs actual', 240, c => { const all = [...P.orig.yte, ...P.orig.pte]; c.begin(range([all]), range([all]), 'actual y', 'predicted y (turned back)'); const r0 = range([all]); c.line([[r0[0], r0[0]], [r0[1], r0[1]]], C('--ink'), 1.2, [4, 4]); P.orig.yte.forEach((t, i) => c.dot([t, P.orig.pte[i]], C('--residual'), 3.6, true)); c.end(); }));
      return out; };
    const table0 = tbl;
    return { gen, see, draw, table: table0 };
  }
  ['scaling', 'xtransform', 'ytransform', 'degree', 'interactions', 'splines', 'binning', 'encoding', 'centering', 'selection'].forEach(k => { A[k] = feSig; });

  /* ================= Model formulation: the same data, a different model or rule for the weights ================= */
  function mfSig(ctx){ const { v, P, Pb, a } = ctx, F = ctx.full ? ctx.full.cur : ctx.cur.d, A = P.alt, tr = P.tr, y = P.ytr;
    const M = A || { w: P.f.w, wOrig: P.wOrig, yhat: P.f.yhat, rmseTr: P.rmseTr, rmseTe: P.rmseTe, label: 'ordinary least squares', info: {} }, I = M.info || {}, m = I.method || (A ? A.kind : 'ols');
    const BM = Pb.alt || { rmseTe: Pb.rmseTe, rmseTr: Pb.rmseTr, wOrig: Pb.wOrig, label: 'ordinary least squares' };
    const means = F.X[0].map((_, j) => mean(tr.map(i => F.X[i][j])));
    const rowAt = xv => { const r = [...means]; r[1] = xv; if (F.derive) F.derive.f(xv).forEach((t, q) => { r[F.derive.cols[q]] = t; }); return r; };
    const curve = (wO, xr) => Array.from({ length: 101 }, (_, k) => { const xv = xr[0] + (xr[1] - xr[0]) * k / 100; return [xv, LA.dot(rowAt(xv), wO)]; });
    const xs = tr.map(i => F.X[i][1]), xr = range([xs]), flag = new Set(F.flagRows || []), many = ['regularisation', 'lambda', 'alpha', 'otherforms', 'penalisebias', 'penalty'].includes(a.id);
    const e = y.map((t, k) => t - M.yhat[k]);
    const coefRows = P.names.map((nm, j) => [nm === '1' ? 'b (intercept)' : nm, F.truth.coef[j] ?? '—', P.wOrig[j], M.wOrig[j]]);
    const gen = `${esc(v.desc)} The data are the same for every variant of ${esc(a.name.toLowerCase())}; only the model, or the rule that picks its weights, changes.${F.note ? ' ' + esc(F.note) + '.' : ''}`;
    const zeros = M.w ? P.names.slice(1).filter((_, k) => Math.abs(M.w[k + 1]) < 1e-10) : [];
    const see = li([
      `The model: <b>${esc(M.label)}</b>.`,
      `Test RMSE ${vs(M.rmseTe, BM.rmseTe, 3)}${A ? `; OLS on the same rows: ${n(P.rmseTe, 3)}` : ''}. Train RMSE ${n(M.rmseTr, 3)}${A ? ` (OLS ${n(P.rmseTr, 3)}, always the lowest possible training error for these columns)` : ''}.`,
      a.id === 'intercept' ? `Slope ${vs(M.wOrig[1], BM.wOrig[1], 3)} (true 1.0); intercept ${n(M.wOrig[0], 3)} (true 6). Mean training residual ${n(mean(e), 3)}${m === 'origin' ? `: not 0 any more. The uncentred R² = ${n(I.r2u, 3)} vs the usual R² of OLS ${n(P.f.R2, 3)}` : ''}.` : '',
      a.id === 'lossfn' ? `Slope ${vs(M.wOrig[1], BM.wOrig[1], 3)}, intercept ${n(M.wOrig[0], 3)} (the bulk of the data follows 2 + 1.5x). Share of training rows above the line: <b>${n(e.filter(t => t > 1e-9).length / e.length, 3)}</b>${m === 'pinball' ? ' (the target is 0.10)' : m === 'quantile' ? ' (the median line: about 0.5)' : ''}. Mean residual ${n(mean(e), 3)}${m === 'ols' || !A ? ' (exactly 0 for squared loss: the line goes through the mean)' : ''}.` : '',
      a.id === 'robust' ? `Slope ${vs(M.wOrig[1], BM.wOrig[1], 3)} (true 1.5), intercept ${n(M.wOrig[0], 3)} (true 2). ${flag.size} contaminated rows are ringed in the chart.${I.hist ? ` After the last iteration ${I.hist[I.hist.length - 1].down} rows have a weight below 1.` : ''}${I.best ? ` RANSAC left out ${I.outl} rows.` : ''}` : '',
      a.id === 'modeltype' ? `Columns: <b>${P.names.slice(1).join(', ')}</b>. ${m === 'wls' ? `Weights ω range from ${n(Math.min(...I.wt), 3)} (noisy rows, large x₁) to ${n(Math.max(...I.wt), 3)}.` : m === 'gls' ? `Estimated ρ̂ = ${n(I.rho, 3)} (true 0.6); lag-1 correlation of the transformed residuals ${n(lag1(I.ys.map((t, k) => t - LA.dot(I.Xs[k], M.w))), 3)} vs ${n(lag1(P.f.e), 3)} for OLS.` : `RESET p ${pfmt(ctx.cur.dg?.reset?.p)}, Breusch–Pagan p ${pfmt(ctx.cur.dg?.bp?.p)}, Durbin–Watson ${n(ctx.cur.dg?.dw, 2)}.`}` : '',
      many ? `Weights exactly 0: ${zeros.join(', ') || 'none'}. Size of the weights Σ|w̃| = ${n((M.w || []).slice(1).reduce((s2, t) => s2 + Math.abs(t), 0), 3)} (OLS ${n(P.f.w.slice(1).reduce((s2, t) => s2 + Math.abs(t), 0), 3)}). ${a.id === 'penalisebias' ? '' : 'Truth: only x₁, x₂, x₅, x₈ matter.'}${I.lam != null ? ` λ = ${n(I.lam, 4)}.` : ''}${I.K ? ` ${I.K} component${I.K > 1 ? 's' : ''} chosen by CV.` : ''}` : '',
      a.id === 'penalisebias' ? `Intercept ${vs(M.wOrig[0], BM.wOrig[0], 2)} (true 50); mean of y ${n(mean(y), 2)}; mean training residual ${n(mean(e), 3)}${Math.abs(mean(e)) > 0.05 ? ': the predictions are pulled toward 0 on average' : ''}.` : '']);
    const draw = el => { const r1 = row(el), out = [];
      if (!many) {
        out.push(chart(r1, `Training rows: OLS (dashed) and this variant's model (solid)`, 250, c => { const cv = curve(M.wOrig, xr), co = curve(P.wOrig, xr), all = [...y, ...cv.map(p => p[1]), ...co.map(p => p[1])]; c.begin(m === 'origin' ? [0, xr[1]] : xr, range([m === 'origin' ? [...all, 0] : all]), `${F.derive?.axisName || F.xName || 'x'}${P.names.length > 2 ? ' (others at their mean)' : ''}`, 'y');
          if (m === 'origin') c.dot([0, 0], C('--ink'), 4, true);
          xs.forEach((t, k) => c.dot([t, y[k]], flag.has(tr[k]) ? C('--normal') : C('--floor'), flag.has(tr[k]) ? 4 : 3, flag.has(tr[k]), 0.8));
          if (F.truth.fnRaw) { const tx = m === 'origin' ? [0, xr[1]] : xr; c.line(Array.from({ length: 41 }, (_, k) => { const t = tx[0] + (tx[1] - tx[0]) * k / 40; return [t, F.truth.fnRaw(t)]; }), C('--ink'), 1, [2, 3]); }
          if (A) c.line(co, BASEC(), 2, [5, 4]); c.line(m === 'origin' ? curve(M.wOrig, [0, xr[1]]) : cv, CUR(), 2.6); c.end();
          c.legend([[CUR(), A ? 'this variant' : 'OLS (this variant)'], ...(A ? [[BASEC(), 'OLS', true]] : []), ...(F.truth.fnRaw ? [[C('--ink'), 'truth', true]] : []), ...(flag.size ? [[C('--normal'), 'contaminated rows']] : [])]); }));
        if (I.hist && I.hist.length) { const wt = I.hist[I.hist.length - 1].wt;
          out.push(chart(r1, 'Final IRLS weight of each training row', 250, c => { c.begin(xr, [0, Math.max(1.05, ...wt.map(t => Math.min(t, 50)) )], F.xName || 'x', 'weight'); c.hline(1, C('--ink'), [4, 3]); xs.forEach((t, k) => c.dot([t, Math.min(wt[k], 50)], flag.has(tr[k]) ? C('--normal') : C('--floor'), flag.has(tr[k]) ? 4.5 : 3, flag.has(tr[k]), 0.85)); c.end(); c.legend([[C('--floor'), 'clean rows'], [C('--normal'), 'contaminated rows (rings)'], [C('--ink'), 'weight 1 = treated as in OLS', true]]); })); }
        else if (I.best) { const inl = new Set(I.best.inl); out.push(chart(r1, 'RANSAC: inliers (filled) and rows left out (rings)', 250, c => { c.begin(xr, range([y]), F.xName || 'x', 'y'); xs.forEach((t, k) => c.dot([t, y[k]], inl.has(k) ? C('--floor') : C('--normal'), 3.5, !inl.has(k))); c.end(); })); }
        else if (m === 'wls') out.push(chart(r1, 'Weights ω = 1/σ̂² against x₁ (noisier rows count less)', 250, c => { c.begin(xr, [0, Math.max(...I.wt) * 1.05], 'x₁', 'weight ω'); xs.forEach((t, k) => c.dot([t, I.wt[k]], CUR(), 3)); c.end(); }));
        else if (m === 'gls') out.push(chart(r1, 'Residuals in row order: OLS (dashed) vs after the GLS transform (solid)', 250, c => { const r2 = I.ys.map((t, k) => t - LA.dot(I.Xs[k], M.w)), yr = sym(range([P.f.e, r2])); c.begin([1, y.length], yr, 'training row', 'residual'); c.hline(0, C('--ink')); c.line(P.f.e.map((t, k) => [k + 1, t]), BASEC(), 1.4, [4, 3]); c.line(r2.map((t, k) => [k + 1, t]), CUR(), 2); c.end(); c.legend([[CUR(), 'transformed residuals u'], [BASEC(), 'OLS residuals', true]]); }));
        else out.push(chart(r1, `Residuals against ${F.xName || 'x'}: this variant`, 250, c => residVsX(c, xs, e, sym(range([e])), { k: 6, xName: F.xName || 'x' })));
      } else {
        const js = P.names.map((_, j) => j).slice(1);
        out.push(chart(r1, 'Coefficients per feature: truth (ring), OLS (grey), this variant (filled)', 260, c => { const vals = [...js.map(j => P.wOrig[j]), ...js.map(j => M.wOrig[j]), ...js.map(j => F.truth.coef[j] ?? 0)]; c.begin([0.5, js.length + 0.5], range([vals, [0]]), 'feature (1 = x₁ …)', 'coefficient'); c.hline(0, C('--rule'));
          js.forEach((j, k) => { const X0 = k + 1; c.line([[X0 - 0.12, 0], [X0 - 0.12, P.wOrig[j]]], BASEC(), 5); c.line([[X0 + 0.12, 0], [X0 + 0.12, M.wOrig[j]]], CUR(), 5); if (F.truth.coef[j] != null) c.dot([X0, F.truth.coef[j]], C('--ink'), 5, true); }); c.end();
          c.legend([[CUR(), 'this variant'], [BASEC(), 'OLS'], [C('--ink'), 'truth']]); }));
        if (I.path) { const lg = I.path.map(p => Math.log10(p.g)); out.push(chart(r1, 'Weights w̃ as λ grows (the path); the chosen λ marked', 260, c => { c.begin([Math.min(...lg), Math.max(...lg)], range([I.path.flatMap(p => p.w.slice(1))]), 'log₁₀ λ', 'w̃ (standardised)'); c.hline(0, C('--rule'));
          js.forEach((j, k) => c.line(I.path.map((p, q) => [lg[q], p.w[j]]), F.truth.coef[j] ? gColor(k % 4, 4) : C('--muted'), F.truth.coef[j] ? 2.2 : 1.2, F.truth.coef[j] ? null : [3, 3])); if (I.lam > 0) c.vline(Math.log10(I.lam), C('--ink'), [4, 3]); c.end(); c.legend([[C('--floor'), 'features that matter'], [C('--muted'), 'features that do not', true]]); })); }
        else if (I.cv) out.push(chart(r1, 'Cross-validation error for each number of components', 260, c => { c.begin([0.5, I.cv.length + 0.5], range([I.cv.map(t => t.mse)]), 'components k', 'mean CV error'); c.line(I.cv.map(t => [t.g, t.mse]), CUR(), 2.2); I.cv.forEach(t => c.dot([t.g, t.mse], t.g === I.K ? C('--ink') : CUR(), t.g === I.K ? 5 : 3)); c.end(); }));
        else if (I.sdPost) out.push(chart(r1, '95% intervals per standardised weight: Bayesian credible (solid) vs OLS confidence (dashed)', 260, c => { const lo = js.map(j => Math.min(M.w[j] - 1.96 * I.sdPost[j], P.f.w[j] - 1.96 * P.f.se[j])), hi = js.map(j => Math.max(M.w[j] + 1.96 * I.sdPost[j], P.f.w[j] + 1.96 * P.f.se[j])); c.begin([0.5, js.length + 0.5], range([lo, hi]), 'feature', 'w̃'); c.hline(0, C('--rule'));
          js.forEach((j, k) => { c.line([[k + 0.85, P.f.w[j] - 1.96 * P.f.se[j]], [k + 0.85, P.f.w[j] + 1.96 * P.f.se[j]]], BASEC(), 2, [3, 2]); c.line([[k + 1.15, M.w[j] - 1.96 * I.sdPost[j]], [k + 1.15, M.w[j] + 1.96 * I.sdPost[j]]], CUR(), 3); c.dot([k + 1.15, M.w[j]], C('--ink'), 3); }); c.end(); }));
        else out.push(chart(r1, 'Training rows: predicted vs actual y', 260, c => { const all = [...y, ...M.yhat]; c.begin(range([all]), range([all]), 'actual y', 'predicted ŷ'); const r0 = range([all]); c.line([r0, r0].map((_, q) => [r0[q], r0[q]]), C('--ink'), 1, [3, 3]); y.forEach((t, k) => c.dot([t, M.yhat[k]], CUR(), 3, false, 0.8)); c.end(); }));
      }
      return out; };
    const tbl = table(['coefficient', 'true', 'OLS', 'this variant'], coefRows, { max: 12, foot: `Original units. Test RMSE: this variant ${n(M.rmseTe, 3)}, OLS ${n(P.rmseTe, 3)}, baseline (${esc(a.variants[0].name)}) ${n(BM.rmseTe, 3)}.` })
      + table(['row', F.xName || 'x', 'y (true)', 'ŷ OLS', 'ŷ this variant', 'e this variant'], y.map((t, k) => [k + 1, xs[k], t, P.f.yhat[k], M.yhat[k], e[k]]), { hi: k => flag.has(tr[k]) ? 'hl' : '', max: 10, foot: flag.size ? 'Highlighted: contaminated rows.' : '' });
    return { gen, see, draw, table: tbl };
  }
  ['intercept', 'modeltype', 'robust', 'regularisation', 'lambda', 'alpha', 'penalisebias', 'otherforms', 'lossfn', 'penalty'].forEach(k => { A[k] = mfSig; });

  /* ================= Optimisation: the same model, a different way of finding its weights ================= */
  function opSig(ctx){ const { v, P, Pb, a } = ctx, F = ctx.full ? ctx.full.cur : ctx.cur.d, O = P.opt, B = Pb.opt, E2 = OP.ex;
    const iterAxis = O && (O.attr === 'gdtype' || O.attr === 'schedule') ? 'epoch' : 'iteration', perE = o => (o && o.perEpoch && iterAxis === 'epoch') ? o.perEpoch : 1;
    const gen = `${esc(v.desc)} The data, the model (least squares) and the loss are the same for every variant of ${esc(a.name.toLowerCase())}; only the way the weights are found changes.${F.note ? ' ' + esc(F.note) + '.' : ''}`;
    const runTxt = o => !o ? '—' : !o.hist ? 'exact (no iterations)' : `${o.stop.t} ${o.perEpoch > 1 ? 'updates' : o.info.method === 'cd' ? 'sweeps' : 'iterations'}, final L ${o.diverged ? (isFinite(o.Lfinal) ? E2(o.Lfinal) + ', diverging' : '∞') : n(o.Lfinal, 5)}`;
    const see = li(!O ? ['—'] : [
      `The method: <b>${esc(O.label)}</b>.`,
      O.hist ? `It stopped at ${O.stop.t}: ${esc(O.stop.reason)}.` : `Exact: the normal-equation residual ‖X̃ᵀX̃w̃ − X̃ᵀy‖ is ${E2(O.info.resid ?? 0)}, i.e. zero up to rounding.`,
      `Final loss ${O.diverged ? `<b>${isFinite(O.Lfinal) ? E2(O.Lfinal) + ' and still growing' : '∞'} (diverging)</b>` : `<b>${n(O.Lfinal, 6)}</b>`} vs the minimum ${n(O.Lstar, 6)}; largest gap to the least-squares weights (original units) ${O.diverged ? '∞' : E2(O.gap)}.`,
      B && B !== O ? `Baseline (${esc(a.variants[0].name)}): ${runTxt(B)}.` : '',
      O.attr === 'scalegd' ? `Eigenvalues of the curvature H: ${O.info.ev.map(t => E2(t)).join(', ')}, so κ = ${E2(O.info.ev[0] / O.info.ev[O.info.ev.length - 1])}.` : '',
      O.attr === 'solver' && O.info.kX ? `κ(X̃) = ${n(O.info.kX, 2)}, κ(X̃ᵀX̃) = ${n(O.info.kA, 2)}: the normal equations and Cholesky work with the squared one.` : '']);
    const draw = el => { const r1 = row(el), out = [];
      if (O && O.hist) {
        out.push(chart(r1, `Excess loss L − L_min at each ${iterAxis} (log scale)`, 250, c => { const ser = [[O, CUR(), false], ...(B && B !== O && B.hist ? [[B, BASEC(), true]] : [])];
          const pts = ser.map(([o]) => o.hist.map(h => [h.t / perE(o), Math.max(Math.min(h.L - o.Lstar, 1e12), 1e-14)]).filter(q => isFinite(q[1])));
          const all = pts.flat().map(q => q[1]), xm = Math.max(...pts.flat().map(q => q[0]), 1);
          c.begin([0, xm], [Math.max(Math.min(...all), 1e-14), Math.max(...all)], iterAxis === 'epoch' ? 'epoch (passes over the training rows)' : O.info.method === 'cd' ? 'sweep' : 'iteration', 'L − L_min', { logY: true });
          pts.forEach((q, k) => c.line(q, ser[k][1], k ? 2 : 2.4, ser[k][2] ? [5, 4] : null)); c.end();
          c.legend([[CUR(), 'this variant'], ...(ser.length > 1 ? [[BASEC(), `baseline (${esc(a.variants[0].name)})`, true]] : [])]); }));
        out.push(chart(r1, 'The path of (w̃₁, w̃₂) over the loss surface (darker = lower loss)', 250, c => { const X = O.raw ? O.info.Xr : P.Xtr, y = P.ytr, path = O.hist.map(h => h.w).filter(w => w.every(isFinite) && Math.abs(w[1]) < 1e6), wS = O.raw ? O.info.wStarRaw : P.f.w;
          const xs = [...path.map(w => w[1]), wS[1]], ys = [...path.map(w => w[2]), wS[2]], xr = range([xs]), yr = range([ys]), padX = (xr[1] - xr[0]) * 0.15 || 1, padY = (yr[1] - yr[0]) * 0.15 || 1;
          const X0 = [xr[0] - padX, xr[1] + padX], Y0 = [yr[0] - padY, yr[1] + padY], G = 36, Ls = [];
          for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const w = [...wS]; w[1] = X0[0] + (X0[1] - X0[0]) * (i + 0.5) / G; w[2] = Y0[0] + (Y0[1] - Y0[0]) * (j + 0.5) / G; Ls.push([i, j, Math.log10(OP.lossOf(X, y, w) - O.Lstar + 1e-9)]); }
          const lo = Math.min(...Ls.map(t => t[2])), hi = Math.max(...Ls.map(t => t[2]));
          c.begin(X0, Y0, O.raw ? 'w₁ (raw)' : 'w̃₁', O.raw ? 'w₂ (raw)' : 'w̃₂');
          Ls.forEach(([i, j, l]) => c.rect(X0[0] + (X0[1] - X0[0]) * i / G, Y0[0] + (Y0[1] - Y0[0]) * j / G, X0[0] + (X0[1] - X0[0]) * (i + 1) / G, Y0[0] + (Y0[1] - Y0[0]) * (j + 1) / G, C('--floor'), 0.04 + 0.8 * (1 - (l - lo) / (hi - lo || 1)) ** 1.5));
          const step = Math.max(1, Math.floor(path.length / 400)); c.line(path.filter((_, k) => k % step === 0 || k === path.length - 1).map(w => [w[1], w[2]]), CUR(), 1.8);
          c.dot([path[0][1], path[0][2]], C('--normal'), 5); c.dot([wS[1], wS[2]], C('--ink'), 5, true); c.end();
          c.legend([[CUR(), 'path of the run'], [C('--normal'), 'start'], [C('--ink'), 'least-squares minimum']]); }));
      } else if (O) {
        out.push(chart(r1, 'Digits at risk: log₁₀ of the condition number', 250, c => { const kx = O.info.kX || Math.sqrt(P.f.kappa), ka = O.info.kA || P.f.kappa; c.begin([0.4, 2.6], [0, Math.max(Math.log10(ka), 1) * 1.15], '', 'log₁₀ κ');
          c.rect(0.6, 0, 1.4, Math.log10(kx), C('--surface'), 0.8); c.rect(1.6, 0, 2.4, Math.log10(ka), C('--normal'), 0.8); c.text('κ(X̃): QR, SVD', [0.6, Math.log10(kx)], C('--ink')); c.text('κ(X̃ᵀX̃): normal eq., Cholesky', [1.5, Math.log10(ka)], C('--ink')); c.end(); }));
        out.push(chart(r1, 'Training rows and the fitted line (x₂ at its mean)', 250, c => { const xs = P.tr.map(i => F.X[i][1]), yy = P.ytr, xr = range([xs]), m2 = mean(P.tr.map(i => F.X[i][2])), L2 = xv => O.wOrig[0] + O.wOrig[1] * xv + O.wOrig[2] * m2;
          c.begin(xr, range([yy]), 'x₁', 'y'); xs.forEach((t, k) => c.dot([t, yy[k]], C('--floor'), 3, false, 0.7)); c.line([[xr[0], L2(xr[0])], [xr[1], L2(xr[1])]], CUR(), 2.4); c.end(); }));
      }
      return out; };
    const tbl = O && O.hist ? table(['iteration', 'L', '‖∇L‖', ...P.names.map((_, j) => j ? `w̃ (${P.names[j]})` : 'w̃₀')], (() => { const K = O.hist.length - 1, pick = [...new Set(Array.from({ length: 11 }, (_, q) => Math.round(q * K / 10)))]; return pick.map(t => [O.hist[t].t, O.hist[t].L, O.hist[t].gn ?? '—', ...O.hist[t].w]); })(), { max: 12, foot: `Least squares (step 9a): w̃ = ${'[' + P.f.w.map(t => n(t, 4)).join(', ') + ']'}, L = ${n(O.Lstar, 6)}.` })
      : table(['coefficient', 'this solver', 'normal equations', 'difference'], P.names.map((nm, j) => [nm === '1' ? 'w̃₀' : nm, O ? O.w[j] : NaN, P.f.w[j], O ? E2(Math.abs(O.w[j] - P.f.w[j])) : '—']), { max: 12 });
    return { gen, see, draw, table: tbl };
  }
  ['solver', 'gdtype', 'lr', 'schedule', 'optimiser', 'init', 'stopping', 'scalegd'].forEach(k => { A[k] = opSig; });

  /* ================= Validation protocol: the same data and model, a different way of estimating the error ================= */
  function vpSig(ctx){ const { v, P, Pb, a } = ctx, F = ctx.full ? ctx.full.cur : ctx.cur.d, V = P.val, B = Pb.val, I = V ? V.info : {};
    const gen = `${esc(v.desc)} The data and the model are the same for every variant of ${esc(a.name.toLowerCase())}; only the way the error on new rows is estimated changes.${F.note ? ' ' + esc(F.note) + '.' : ''}`;
    const est = V ? (V.attr === 'cv' ? V.estimate : P.rmseTe) : NaN;
    const see = li(!V ? ['—'] : [
      `The protocol: <b>${esc(V.label)}</b>.`,
      `Its estimate of the RMSE on new rows: <b>${n(est, 3)}</b>; the truth, measured on 2 000 fresh rows: <b>${n(V.trueRmse, 3)}</b>.`,
      V.attr !== 'cv' ? `All the re-splits reuse these same ${P.nTr + P.nTe} rows, so they show how much the choice of test rows matters, not how lucky the sample itself is (that is why the truth can sit outside the histogram). Over ${I.S} seeds the test RMSE has sd ${vs(I.sd, B && B.info.sd != null ? B.info.sd : I.sd, 3)} and a middle 90% of [${n(I.q05, 3)}, ${n(I.q95, 3)}]: that is how much one split can mislead.` : '',
      V.kind === 'nested' ? `Nested CV says ${n(Math.sqrt(I.nestedMse), 3)}; the winning inner score taken at face value says ${n(Math.sqrt(I.flatBest), 3)} (optimistic); the chosen degree-${I.bestFlat} model really scores ${n(V.trueSel, 3)} on fresh rows.` : '',
      V.kind === 'ts' ? `Validating only forward in time gives ${n(Math.sqrt(I.C.mse), 3)}, against ${n(Math.sqrt(I.kf), 3)} for ordinary 5-fold, which lets the model peek at the future.` : '',
      V.kind === 'loo' ? `The leave-one-out shortcut Σ(eᵢ/(1 − hᵢᵢ))²/n = ${n(I.press, 4)} equals the ${P.nTr} refits exactly.` : '']);
    const hist = (c, vals, color, lo, hi, B_ = 24, alpha = 0.6) => { const w = (hi - lo) / B_ || 1, k = new Array(B_).fill(0); vals.forEach(t => k[Math.min(B_ - 1, Math.max(0, Math.floor((t - lo) / w)))]++); k.forEach((q2, i) => q2 && c.rect(lo + i * w, 0, lo + (i + 1) * w, q2, color, alpha)); return Math.max(...k); };
    const draw = el => { const r1 = row(el), out = []; if (!V) return out;
      if (V.attr !== 'cv') {
        const r = I.res.map(t => t.rmseTe), rb = B && B !== V && B.info.res ? B.info.res.map(t => t.rmseTe) : [], all = [...r, ...rb, V.trueRmse].filter(isFinite), lo = Math.min(...all), hi = Math.max(...all);
        out.push(chart(r1, `Test RMSE over ${I.S} random splits${rb.length ? ': this variant (filled) vs baseline (grey)' : ''}`, 250, c => { const cnt = (() => { const k1 = Array(24).fill(0), k2 = Array(24).fill(0), w = (hi - lo) / 24 || 1; r.forEach(t => k1[Math.min(23, Math.floor((t - lo) / w))]++); rb.forEach(t => k2[Math.min(23, Math.floor((t - lo) / w))]++); return Math.max(...k1, ...k2, 1); })();
          c.begin([lo, hi], [0, cnt * 1.1], 'test RMSE', 'splits'); if (rb.length) hist(c, rb, BASEC(), lo, hi, 24, 0.35); hist(c, r, CUR(), lo, hi, 24, 0.6); c.vline(V.trueRmse, C('--ink'), [5, 4]); if (V.kind !== 'varied') c.vline(P.rmseTe, C('--normal'), null, 2.4); c.end();
          c.legend([[CUR(), 'this variant'], ...(rb.length ? [[BASEC(), 'baseline']] : []), [C('--ink'), 'true RMSE (fresh rows)', true], ...(V.kind !== 'varied' ? [[C('--normal'), 'this sample’s one split']] : [])]); }));
        out.push(chart(r1, `Fitted slope over the same ${I.S} splits`, 250, c => { const s = I.res.map(t => t.w[1]), lo2 = Math.min(...s, 1.5), hi2 = Math.max(...s, 1.5), w = (hi2 - lo2) / 24 || 1, k = Array(24).fill(0); s.forEach(t => k[Math.min(23, Math.floor((t - lo2) / w))]++);
          c.begin([lo2, hi2], [0, Math.max(...k) * 1.1], 'slope', 'splits'); hist(c, s, CUR(), lo2, hi2); c.vline(1.5, C('--ink'), [5, 4]); c.end(); c.legend([[CUR(), 'slope from each split'], [C('--ink'), 'true slope 1.5', true]]); }));
      } else {
        const per = V.kind === 'nested' ? I.rows.map(t => ({ mse: t.outerMse, lab: `outer ${t.o} (deg ${t.best})` })) : I.C ? I.C.per.map((t, k) => ({ mse: t.mse, lab: k + 1 })) : [];
        if (per.length) out.push(chart(r1, V.kind === 'loo' ? 'Squared leave-one-out error of every training row' : 'Validation MSE of each fold', 250, c => { const m = per.map(t => t.mse), tm = (V.kind === 'nested' ? V.trueSel : V.trueRmse) ** 2, top = Math.max(...m, tm) * 1.1;
          c.begin([0.4, per.length + 0.6], [0, top], V.kind === 'loo' ? 'training row' : 'fold', 'MSE'); per.forEach((t, k) => c.rect(k + 0.6, 0, k + 1.4, t.mse, CUR(), 0.75)); c.hline(mean(m), C('--normal'), null, 2.2); c.hline(tm, C('--ink'), [5, 4]); c.end();
          c.legend([[CUR(), V.kind === 'loo' ? 'each row' : 'each fold'], [C('--normal'), `their mean (the estimate) ${n(mean(m), 3)}`], [C('--ink'), `true MSE ${V.kind === 'nested' ? 'of the tuned procedure ' : ''}${n(tm, 3)}`, true]]); }));
        out.push(chart(r1, '5-fold CV error by polynomial degree (what CV is used to choose)', 250, c => { const dc = I.degCurve; c.begin([0.6, 5.4], range([dc.map(t => t.cv)]), 'degree', 'CV MSE'); c.line(dc.map(t => [t.dg, t.cv]), CUR(), 2.2); dc.forEach(t => c.dot([t.dg, t.cv], CUR(), 3.5)); c.end(); }));
      }
      return out; };
    const tbl = !V ? '' : V.attr !== 'cv' ? table(['seed', 'train rows', 'test rows', 'slope', 'test RMSE'], I.res.map(t => [t.seed, t.nTr, t.nTe, t.w[1], t.rmseTe]), { max: 10, foot: `Mean ${n(I.mean, 3)}, sd ${n(I.sd, 3)} over ${I.S} seeds; true RMSE ${n(V.trueRmse, 3)}.` })
      : table(['protocol', 'estimated RMSE'], [['one test split (step 12)', P.rmseTe], ...(I.C ? [[esc(V.label), Math.sqrt(I.C.mse)]] : []), ...(V.kind === 'nested' ? [['nested CV', Math.sqrt(I.nestedMse)], ['best inner CV, taken at face value', Math.sqrt(I.flatBest)], [`truth for the chosen degree ${I.bestFlat}`, V.trueSel]] : []), ['truth for the straight line (2 000 fresh rows)', V.trueRmse]], { max: 10 });
    return { gen, see, draw, table: tbl };
  }
  ['split', 'cv', 'seed'].forEach(k => { A[k] = vpSig; });

  /* ================= Evaluation ================= */
  function evSig(ctx){ const { v, P, Pb, a } = ctx, F = ctx.full ? ctx.full.cur : ctx.cur.d, E = P.evr, I = E ? E.info : {};
    const gen = `${esc(v.desc)}${F.note ? ' ' + esc(F.note) + '.' : ''}`;
    const xtr = P.tr.map(i => F.X[i][1]), xte = P.te.map(i => F.X[i][1]), xr = range([[...xtr, ...xte]]), grid = Array.from({ length: 121 }, (_, k) => xr[0] + (xr[1] - xr[0]) * k / 120);
    const dataPlot = (c, curves, title) => { const ys = [...P.ytr, ...P.yte, ...curves.flatMap(([f]) => grid.map(f))].filter(t => isFinite(t) && Math.abs(t) < 1e4), lo = Math.min(...P.ytr, ...P.yte), hi = Math.max(...P.ytr, ...P.yte), pad = (hi - lo) * 0.25;
      c.begin(xr, [lo - pad, hi + pad], 'x', 'y'); xtr.forEach((t, k) => c.dot([t, P.ytr[k]], C('--floor'), 3, false, 0.8)); xte.forEach((t, k) => c.dot([t, P.yte[k]], C('--residual'), 3.5, true, 0.9));
      c.line(grid.map(t => [t, EV.truthF(t)]), C('--ink'), 1.2, [3, 3]); curves.forEach(([f, col, w, dash]) => c.line(grid.map(t => [t, Math.max(lo - pad, Math.min(hi + pad, f(t)))]), col, w, dash)); c.end();
      c.legend([[C('--floor'), 'training rows'], [C('--residual'), 'test rows (hollow)'], [C('--ink'), 'truth', true], ...curves.map(([, col, , dash, lab]) => [col, lab, !!dash])]); };
    const see = li(!E ? ['—'] : [
      `What is evaluated: <b>${esc(E.label)}</b>.`,
      E.attr === 'metric' ? `This metric picks <b>degree ${I.pick}</b> (${I.degs.map((dg, k) => `${dg}: ${n(I.vals[k], 3)}`).join(', ')}).` : '',
      E.attr === 'traintest' ? `Train RMSE <b>${n(I.tr, 3)}</b>, test RMSE <b>${n(I.te, 3)}</b>, noise σ = ${n(F.sigmaUsed ?? 1, 3)}: ${I.te > 1.5 * I.tr ? 'a big gap, the mark of overfitting' : I.tr > 1.3 * (F.sigmaUsed ?? 1) ? 'both high, the mark of underfitting' : 'both close to the noise level'}.` : '',
      E.attr === 'learningcurve' ? `With all ${I.pts[I.pts.length - 1].sz} rows: training MSE ${n(I.pts[I.pts.length - 1].tr, 3)}, validation MSE ${n(I.pts[I.pts.length - 1].va, 3)}; noise σ² = ${n(I.sigma2, 3)}.` : '',
      E.attr === 'validationcurve' ? `The validation error is lowest at ${E.kind === 'deg' ? 'degree' : 'λ ='} <b>${I.best.g}</b>.` : '',
      E.attr === 'biasvariance' ? I.rows.map(r => `Degree ${r.dg}: bias² ${n(r.bias2, 3)}, variance ${n(r.variance, 3)}, total ${n(r.total, 3)}.`).join(' ') : '']);
    const draw = el => { const r1 = row(el), out = []; if (!E) return out;
      if (E.attr === 'metric') { out.push(chart(r1, `${esc(E.label.split(' on ')[0])} by degree (${I.better === 'max' ? 'higher' : 'lower'} is better)`, 250, c => { c.begin([0.4, 5.6], range([I.vals, I.better === 'max' ? [] : []]), 'degree', 'metric'); I.vals.forEach((t, k) => c.dot([k + 1, t], k + 1 === I.pick ? C('--normal') : CUR(), k + 1 === I.pick ? 6 : 4)); c.line(I.vals.map((t, k) => [k + 1, t]), CUR(), 1.6); c.end(); }));
        out.push(chart(r1, 'Data, with degree 1 and this metric’s choice', 250, c => dataPlot(c, [[I.rows[0].f.pred, BASEC(), 2, [5, 4], 'degree 1'], [I.rows[I.pick - 1].f.pred, CUR(), 2.4, null, `degree ${I.pick}`]]))); }
      if (E.attr === 'traintest') { out.push(chart(r1, 'Train and test RMSE by degree', 250, c => { c.begin([0.5, 10.5], [0, Math.min(Math.max(...I.all.map(t => t.te)), 6 * (F.sigmaUsed ?? 1) + 2) * 1.05], 'degree', 'RMSE'); c.line(I.all.map(t => [t.dg, t.tr]), C('--floor'), 2.2); c.line(I.all.map(t => [t.dg, Math.min(t.te, 1e3)]), C('--residual'), 2.2); c.vline(I.dg, C('--normal'), [4, 3]); c.end(); c.legend([[C('--floor'), 'training'], [C('--residual'), 'test'], [C('--normal'), 'this variant', true]]); }));
        out.push(chart(r1, `The degree-${I.dg} fit`, 250, c => dataPlot(c, [[I.f.pred, CUR(), 2.4, null, `degree ${I.dg}`]]))); }
      if (E.attr === 'learningcurve') { out.push(chart(r1, 'Learning curve: MSE against the number of training rows', 250, c => { const vals = I.pts.flatMap(t => [t.tr, t.va]).filter(t => t < 1e4); c.begin([0, I.nMax], [0, Math.min(Math.max(...vals), 20 * I.sigma2 + 5) * 1.05], 'training rows', 'MSE');
          c.line(I.pts.map(t => [t.sz, t.tr]), C('--floor'), 2.2); c.line(I.pts.map(t => [t.sz, Math.min(t.va, 1e4)]), C('--residual'), 2.2); c.hline(I.sigma2, C('--ink'), [5, 4]); c.end(); c.legend([[C('--floor'), 'training'], [C('--residual'), 'validation (5-fold)'], [C('--ink'), 'noise σ²', true]]); }));
        out.push(chart(r1, `The degree-${I.dg} fit on all training rows`, 250, c => dataPlot(c, [[E.curve, CUR(), 2.4, null, `degree ${I.dg}`]]))); }
      if (E.attr === 'validationcurve') { const gx = t => E.kind === 'deg' ? t : Math.log10(t);
        out.push(chart(r1, `Validation curve: MSE against ${E.kind === 'deg' ? 'the degree' : 'log₁₀ λ'}`, 250, c => { const vals = I.pts.flatMap(t => [t.tr, t.va]).filter(t => t < 1e4); c.begin([gx(I.grid[0]), gx(I.grid[I.grid.length - 1])], [0, Math.min(Math.max(...vals), 50) * 1.05], E.kind === 'deg' ? 'degree' : 'log₁₀ λ', 'MSE');
          c.line(I.pts.map(t => [gx(t.g), t.tr]), C('--floor'), 2.2); c.line(I.pts.map(t => [gx(t.g), Math.min(t.va, 1e4)]), C('--residual'), 2.2); c.vline(gx(I.best.g), C('--normal'), [4, 3]); c.end(); c.legend([[C('--floor'), 'training'], [C('--residual'), 'validation (5-fold)'], [C('--normal'), 'lowest validation error', true]]); }));
        out.push(chart(r1, 'The chosen model', 250, c => dataPlot(c, [[E.curve, CUR(), 2.4, null, esc(E.curveLabel)]]))); }
      if (E.attr === 'biasvariance') { const r2 = row(el);
        I.rows.forEach((r, q) => out.push(chart(q < 2 ? r1 : r2, `Degree ${r.dg}: 20 of the ${I.R} fits`, 230, c => { const lo = 0, hi = Math.max(...I.grid.map(EV.truthF)) * 1.4; c.begin([1, 10], [lo, hi], 'x', 'ŷ');
          I.sample[q].forEach(f => c.line(I.grid.map(t => [t, Math.max(lo, Math.min(hi, f.pred(t)))]), CUR(), 1, null, 0.35)); c.line(r.at.map(t => [t.x0, t.mean]), C('--normal'), 2.4); c.line(I.grid.map(t => [t, EV.truthF(t)]), C('--ink'), 1.6, [5, 4]); c.end();
          c.legend([[CUR(), 'single fits'], [C('--normal'), 'average fit'], [C('--ink'), 'truth', true]]); })));
        out.push(chart(r2, 'Expected test MSE = bias² + variance + noise', 230, c => { const top = Math.max(...I.rows.map(r => r.total)) * 1.1; c.begin([0.4, I.rows.length + 0.6], [0, top], 'model', 'MSE');
          I.rows.forEach((r, q) => { const x0 = q + 0.65, x1 = q + 1.35; c.rect(x0, 0, x1, r.noise, C('--muted'), 0.6); c.rect(x0, r.noise, x1, r.noise + r.bias2, C('--normal'), 0.75); c.rect(x0, r.noise + r.bias2, x1, r.total, CUR(), 0.75); c.text(`deg ${r.dg}`, [x0, r.total], C('--ink')); }); c.end();
          c.legend([[C('--muted'), 'noise σ²'], [C('--normal'), 'bias²'], [CUR(), 'variance']]); })); }
      return out; };
    const tbl = !E ? '' : E.attr === 'metric' ? table(['degree', 'MSE', 'RMSE', 'MAE', 'MAPE %', 'R²', 'adj. R² (train)', 'AIC (train)', 'BIC (train)'], I.rows.map(r => [r.dg, r.te.mse, r.te.rmse, r.te.mae, r.te.mape, r.te.r2, r.tr.adjr2, r.tr.aic, r.tr.bic]), { max: 6, hi: k => k + 1 === I.pick ? 'hl' : '' })
      : E.attr === 'traintest' ? table(['degree', 'train RMSE', 'test RMSE'], I.all.map(r => [r.dg, r.tr, r.te]), { max: 8, hi: k => I.all[k].dg === I.dg ? 'hl' : '' })
      : E.attr === 'learningcurve' ? table(['training rows', 'training MSE', 'validation MSE'], I.pts.map(t => [t.sz, t.tr, t.va]), { max: 10 })
      : E.attr === 'validationcurve' ? table([E.kind === 'deg' ? 'degree' : 'λ', 'training MSE', 'validation MSE'], I.pts.map(t => [t.g, t.tr, t.va]), { max: 12, hi: k => I.pts[k] === I.best ? 'hl' : '' })
      : table(['degree', 'bias²', 'variance', 'noise', 'total'], I.rows.map(r => [r.dg, r.bias2, r.variance, r.noise, r.total]), { max: 4 });
    return { gen, see, draw, table: tbl };
  }
  ['metric', 'traintest', 'learningcurve', 'validationcurve', 'biasvariance'].forEach(k => { A[k] = evSig; });

  /* ================= Inference: what the numbers mean and how sure we can be ================= */
  function inSig(ctx){ const { v, P, Pb, a } = ctx, F = ctx.full ? ctx.full.cur : ctx.cur.d, R = P.inr, B = Pb.inr, I = R ? R.info : {}, G = R && R.fit;
    const gen = `${esc(v.desc)}${F.note ? ' ' + esc(F.note) + '.' : ''} Every Monte Carlo check re-draws 300 fresh datasets of the training size from the same recipe.`;
    const pf = p => p < 0.001 ? '< 0.001' : n(p, 3);
    const hist = (c, vals, xr, B2, col, lab) => { const w = (xr[1] - xr[0]) / B2, k = new Array(B2).fill(0); vals.forEach(t => { const b = Math.floor((t - xr[0]) / w); if (b >= 0 && b < B2) k[b]++; }); return { k, w }; };
    let see = [], draw = () => [], tbl = '';
    if (!R || !G) return { gen, see: li([R ? esc(R.label) : '—']), draw, table: '' };
    if (R.attr === 'coefinf') { const mc = I.mc;
      see = [`Estimates with their SEs: ${I.rows.slice(1).map(r => `${r.nm} ${n(r.w, 3)} ± ${n(r.se, 3)}`).join(', ')}.`, R.kind === 'ttest' ? `p-values: ${I.rows.slice(1).map(r => `${r.nm} ${pf(r.p)}`).join(', ')}. x₃ truly has no effect; x₂ has a small one.` : R.kind === 'ci' ? `95% CIs: ${I.rows.slice(1).map(r => `${r.nm} [${n(r.lo, 3)}, ${n(r.hi, 3)}]`).join(', ')}.` : `The reported SE of x₁, ${n(I.rows[1].se, 4)}, against the actual spread of x₁’s estimate across ${I.R} fresh datasets, ${n(mc[1].sd, 4)}.`,
        `Across the fresh datasets: ${mc.slice(1).map(m => `${m.nm} ${R.kind === 'ttest' ? `significant in ${n(100 * m.rej, 1)}%` : `CI covers the truth in ${n(100 * m.cov, 1)}%`}`).join(', ')}.`];
      draw = el => { const r1 = row(el), out = [], m1 = mc[1];
        out.push(chart(r1, `x₁’s estimate in ${I.R} fresh datasets, with the normal curve its SE implies`, 250, c => { const xr = range([m1.est]), B2 = 24, H = hist(c, m1.est, xr, B2), mx = Math.max(...H.k); c.begin(xr, [0, mx * 1.15], 'estimate of the x₁ coefficient', 'datasets');
          H.k.forEach((q, i) => q && c.rect(xr[0] + i * H.w, 0, xr[0] + (i + 1) * H.w, q, CUR(), 0.6)); const mu = mean(m1.est), s = m1.meanSE; c.line(Array.from({ length: 81 }, (_, k) => { const t = xr[0] + (xr[1] - xr[0]) * k / 80; return [t, I.R * H.w * Math.exp(-0.5 * ((t - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI))]; }), C('--ink'), 2); c.vline(1.5, C('--normal'), [4, 3]); c.end();
          c.legend([[CUR(), 'estimates'], [C('--ink'), 'normal curve with the average SE'], [C('--normal'), 'true 1.5', true]]); }));
        out.push(chart(r1, R.kind === 'ttest' ? 'Share of datasets with p < 0.05 (5% line = false-alarm rate)' : 'Share of 95% intervals that cover the truth', 250, c => { const vals = mc.map(m => R.kind === 'ttest' ? m.rej : m.cov); c.begin([0.4, mc.length + 0.6], [0, 1.05], 'coefficient (1 = b, 2 = x₁, …)', 'share');
          vals.forEach((t, k) => c.rect(k + 0.65, 0, k + 1.35, t, k === 3 && R.kind === 'ttest' ? C('--normal') : CUR(), 0.75)); c.hline(R.kind === 'ttest' ? 0.05 : 0.95, C('--ink'), [4, 3]); c.end(); }));
        return out; };
      tbl = table(['coefficient', 'estimate', 'SE', 't', 'p', '95% CI', 'true'], I.rows.map(r => [r.nm === '1' ? 'b' : r.nm, r.w, r.se, r.t, pf(r.p), `[${n(r.lo, 3)}, ${n(r.hi, 3)}]`, r.truth ?? '—']), { max: 8 }); }
    if (R.attr === 'ftest') {
      see = [`F = <b>${n(I.F, 3)}</b> on (${I.q}, ${I.df2}) df, p ${pf(I.p)}.`, `SSE of the restricted model ${n(I.sseR, 3)} → full model ${n(I.sseU, 3)}.`, `Rejected in ${n(100 * I.rej, 1)}% of ${I.R} fresh datasets.`];
      draw = el => { const r1 = row(el); return [chart(r1, `F statistic in ${I.R} fresh datasets; dashed: the 5% critical value`, 250, c => { const xr = [0, Math.max(...I.Fs, I.F) * 1.05], B2 = 30, H = hist(c, I.Fs, xr, B2), crit = (() => { let lo = 0, hi = 1e4; for (let k = 0; k < 90; k++) { const m = (lo + hi) / 2; if (ST.fSF(m, I.q, I.df2) > 0.05) lo = m; else hi = m; } return lo; })();
        c.begin(xr, [0, Math.max(...H.k) * 1.15], 'F', 'datasets'); H.k.forEach((q, i) => q && c.rect(xr[0] + i * H.w, 0, xr[0] + (i + 1) * H.w, q, CUR(), 0.6)); c.vline(crit, C('--ink'), [4, 3]); c.vline(I.F, C('--normal'), null, 2.4); c.end(); c.legend([[CUR(), 'fresh datasets'], [C('--ink'), 'critical value', true], [C('--normal'), 'this sample']]); })]; };
      tbl = table(['model', 'columns', 'SSE', 'df'], [['restricted', I.keep.map(j => P.names[j]).join(', '), I.sseR, P.nTr - I.keep.length], ['full', P.names.join(', '), I.sseU, I.df2]], { max: 4 }); }
    if (R.attr === 'intervals') { const pc = R.kind === 'conf';
      see = [`At x = ${I.pts[2].x0}: ${pc ? `mean ${n(I.pts[2].yh, 3)} ± ${n(I.tc * I.pts[2].seM, 3)}` : `new y ${n(I.pts[2].yh, 3)} ± ${n(I.tc * I.pts[2].seP, 3)}`} (the other interval: ± ${n(I.tc * (pc ? I.pts[2].seP : I.pts[2].seM), 3)}).`, `Coverage in ${I.R} fresh datasets: ${I.cov.map((cv, k) => `${I.pts[k].x0}: ${n(100 * (pc ? cv.m : cv.p), 0)}%`).join(', ')}.`];
      draw = el => { const r1 = row(el), xs = P.tr.map(i => F.X[i][1]), out = [];
        out.push(chart(r1, 'Training rows, the fitted line, the confidence band (dark) and the prediction band (light)', 260, c => { const gx = Array.from({ length: 61 }, (_, k) => -0.5 + 13 * k / 60), band = gx.map(x0 => { const r = [1, x0], yh = LA.dot(r, G.w), q = LA.dot(r, LA.mv(G.inv, r)); return [x0, yh, I.tc * Math.sqrt(G.s2 * q), I.tc * Math.sqrt(G.s2 * (1 + q))]; });
          c.begin([gx[0], gx[gx.length - 1]], range([band.map(b => b[1] + b[3]), band.map(b => b[1] - b[3]), P.ytr]), 'x', 'y');
          band.slice(1).forEach((b, k) => { const a0 = band[k]; c.rect(a0[0], Math.min(a0[1] - a0[3], b[1] - b[3]), b[0], Math.max(a0[1] + a0[3], b[1] + b[3]), C('--floor'), pc ? 0.12 : 0.25); c.rect(a0[0], Math.min(a0[1] - a0[2], b[1] - b[2]), b[0], Math.max(a0[1] + a0[2], b[1] + b[2]), C('--surface'), pc ? 0.45 : 0.25); });
          xs.forEach((t, k) => c.dot([t, P.ytr[k]], C('--floor'), 3, false, 0.8)); c.line(band.map(b => [b[0], b[1]]), C('--ink'), 2); c.vline(10, C('--muted'), [3, 3]); c.end(); c.legend([[C('--surface'), 'confidence (mean)'], [C('--floor'), 'prediction (new y)'], [C('--muted'), 'edge of the data', true]]); }));
        out.push(chart(r1, `Coverage of the ${pc ? 'confidence' : 'prediction'} interval in ${I.R} fresh datasets`, 260, c => { c.begin([-1, 13], [0, 1.05], 'x₀', 'share covered'); I.pts.forEach((q, k) => c.rect(q.x0 - 0.5, 0, q.x0 + 0.5, pc ? I.cov[k].m : I.cov[k].p, CUR(), 0.75)); c.hline(0.95, C('--ink'), [4, 3]); c.end(); }));
        return out; };
      tbl = table(['x₀', 'ŷ₀', 'CI (mean)', 'PI (new y)', 'true mean'], I.pts.map(q => [q.x0, q.yh, `[${n(q.ciLo, 3)}, ${n(q.ciHi, 3)}]`, `[${n(q.piLo, 3)}, ${n(q.piHi, 3)}]`, q.truth]), { max: 8 }); }
    if (R.attr === 'robustse') { const nm = { classical: 'classical', hc: 'HC1', nw: 'Newey–West', cl: 'clustered' };
      see = [`Slope ${n(G.w[1], 4)} (true 1.5): the same under every SE.`, `SEs here: ${I.list.map(L => `${nm[L.k]} ${n(L.here, 4)}`).join(', ')}; the true spread across fresh datasets is ${n(I.sdTrue, 4)}.`, `Coverage of the 95% interval: ${I.list.map(L => `${nm[L.k]} ${n(100 * L.cov, 0)}%`).join(', ')}.`];
      draw = el => { const r1 = row(el), xs = P.tr.map(i => F.X[i][1]), out = [];
        out.push(chart(r1, 'Average SE of the slope over fresh datasets; dashed: its true spread', 250, c => { c.begin([0.4, I.list.length + 0.6], [0, Math.max(I.sdTrue, ...I.list.map(L => L.mean)) * 1.25], '', 'SE of the slope'); I.list.forEach((L, k) => { c.rect(k + 0.65, 0, k + 1.35, L.mean, L.k === I.right ? C('--surface') : C('--muted'), 0.8); c.text(nm[L.k], [k + 0.65, L.mean], C('--ink')); }); c.hline(I.sdTrue, C('--ink'), [4, 3]); c.end(); }));
        out.push(chart(r1, 'Training residuals in row order', 250, c => { const e = G.e, yr = sym(range([e])); c.begin([1, e.length], yr, 'training row (in order of x)', 'residual'); c.hline(0, C('--ink')); e.forEach((t, k) => c.dot([k + 1, t], F.group ? gColor(F.group[P.tr[k]] % 4, 4) : C('--floor'), 3)); c.end(); }));
        return out; };
      tbl = table(['standard error', 'this sample', 'average over datasets', 'coverage'], I.list.map(L => [nm[L.k] + (L.k === I.right ? ' (right one)' : ''), L.here, L.mean, L.cov]), { max: 6, foot: `True SD of the slope over ${I.R} datasets: ${n(I.sdTrue, 4)}.` }); }
    if (R.attr === 'reading') { const w = I.w, lg = R.kind === 'loglog' || R.kind === 'loglin';
      see = [R.kind === 'raw' ? `Slope ${n(w[1], 4)} per unit of x; intercept ${n(w[0], 4)}.` : R.kind === 'std' ? `Standardised slope β = ${n(I.beta, 4)}: one SD of x moves ŷ by ${n(I.beta, 3)} SDs of y.` : R.kind === 'loglog' ? `Elasticity ${n(w[1], 4)}: 1% more x → ${n(100 * (1.01 ** w[1] - 1), 3)}% more y.` : `Growth ${n(100 * (Math.exp(w[1]) - 1), 3)}% per unit of x.`, lg ? 'On the log scale the points lie on a straight line; on the raw scale they curve.' : 'Rescaling x changes the raw slope but not β.'];
      draw = el => { const r1 = row(el), out = [], raw = F.raw ? P.tr.map(i => F.raw.X[i][1]) : P.tr.map(i => F.X[i][1]), yR = F.yRaw ? P.tr.map(i => F.yRaw[i]) : P.ytr;
        out.push(chart(r1, lg ? 'Raw scale: y against x, with the fitted curve' : 'y against x with the fitted line', 250, c => { const xr = range([raw]); c.begin(xr, range([yR]), 'x', 'y'); raw.forEach((t, k) => c.dot([t, yR[k]], C('--floor'), 3, false, 0.8)); c.line(Array.from({ length: 81 }, (_, k) => { const t = xr[0] + (xr[1] - xr[0]) * k / 80; return [t, R.kind === 'loglog' ? Math.exp(w[0]) * t ** w[1] : R.kind === 'loglin' ? Math.exp(w[0] + w[1] * t) : w[0] + w[1] * t]; }), CUR(), 2.4); c.end(); }));
        if (lg) out.push(chart(r1, `Log scale: ln y against ${R.kind === 'loglog' ? 'ln x' : 'x'}: a straight line`, 250, c => { const xx = P.tr.map(i => F.X[i][1]), xr = range([xx]); c.begin(xr, range([P.ytr]), R.kind === 'loglog' ? 'ln x' : 'x', 'ln y'); xx.forEach((t, k) => c.dot([t, P.ytr[k]], C('--floor'), 3, false, 0.8)); c.line([[xr[0], w[0] + w[1] * xr[0]], [xr[1], w[0] + w[1] * xr[1]]], CUR(), 2.4); c.end(); }));
        else out.push(chart(r1, 'Standardised: (y − ȳ)/s_y against (x − x̄)/s_x; slope = β', 250, c => { const xx = P.tr.map(i => F.X[i][1]), mx = mean(xx), my = mean(P.ytr), zx = xx.map(t => (t - mx) / I.sx), zy = P.ytr.map(t => (t - my) / I.sy); c.begin(range([zx]), range([zy]), 'z of x', 'z of y'); zx.forEach((t, k) => c.dot([t, zy[k]], C('--floor'), 3, false, 0.8)); const r0 = range([zx]); c.line([[r0[0], I.beta * r0[0]], [r0[1], I.beta * r0[1]]], CUR(), 2.4); c.end(); }));
        return out; };
      tbl = table(['quantity', 'value'], R.kind === 'raw' ? [['intercept b', w[0]], ['slope w (per unit of x)', w[1]]] : R.kind === 'std' ? [['raw slope w', I.w[1]], ['s_x', I.sx], ['s_y', I.sy], ['w·s_x (per SD of x)', I.wStd], ['β = w·s_x/s_y', I.beta]] : R.kind === 'loglog' ? [['a', w[0]], ['b (elasticity)', w[1]], ['e^a', Math.exp(w[0])], ['y × for 1% more x', 1.01 ** w[1]], ['y × for double x', 2 ** w[1]]] : [['a', w[0]], ['b', w[1]], ['e^b (multiplier per unit)', Math.exp(w[1])], ['% change per unit', 100 * (Math.exp(w[1]) - 1)]], { max: 8 }); }
    if (R.attr === 'causal') { const conf = R.kind === 'confounded';
      see = [`Naive slope ${n(I.naive, 3)} ± ${n(I.naiveSE, 3)}; with u controlled ${n(I.ctrl, 3)} ± ${n(I.ctrlSE, 3)}; true effect 1.0.`, `corr(x, u) = ${n(I.corrXU, 3)}; omitted-variable bias 3·cov(x,u)/var(x) = ${n(I.ovb, 3)}.`, conf ? 'The residual plots look perfect: confounding is invisible in the data alone.' : 'With x randomised, the naive slope is already unbiased.'];
      draw = el => { const r1 = row(el), out = [], xs = P.tr.map(i => F.X[i][1]), u = P.tr.map(i => F.confounder[i]), ur = range([u]);
        out.push(chart(r1, 'y against x, coloured by the hidden u (dark = high u)', 250, c => { c.begin(range([xs]), range([P.ytr]), 'x', 'y'); xs.forEach((t, k) => c.dot([t, P.ytr[k]], `hsl(170 50% ${70 - 45 * (u[k] - ur[0]) / (ur[1] - ur[0] || 1)}%)`, 3.4)); const xr = range([xs]); c.line(xr.map(t => [t, G.w[0] + G.w[1] * t]), CUR(), 2.4); c.line(xr.map(t => [t, 2 + t + 3 * mean(u)]), C('--ink'), 1.6, [5, 4]); c.end(); c.legend([[CUR(), `naive slope ${n(G.w[1], 2)}`], [C('--ink'), 'causal effect 1.0', true]]); }));
        out.push(chart(r1, `Slope estimates in ${I.mcNaive.length} fresh datasets: naive vs controlling for u`, 250, c => { const all = [...I.mcNaive, ...I.mcCtrl, 1], xr = range([all]), B2 = 30, A2 = hist(c, I.mcNaive, xr, B2), C2 = hist(c, I.mcCtrl, xr, B2), mx = Math.max(...A2.k, ...C2.k);
          c.begin(xr, [0, mx * 1.15], 'slope of x', 'datasets'); A2.k.forEach((q, i) => q && c.rect(xr[0] + i * A2.w, 0, xr[0] + (i + 1) * A2.w, q, C('--normal'), 0.5)); C2.k.forEach((q, i) => q && c.rect(xr[0] + i * C2.w, 0, xr[0] + (i + 1) * C2.w, q, CUR(), 0.5)); c.vline(1, C('--ink'), [4, 3]); c.end(); c.legend([[C('--normal'), 'naive'], [CUR(), 'with u'], [C('--ink'), 'truth 1.0', true]]); }));
        return out; };
      tbl = table(['regression', 'slope of x', 'SE', 'true'], [['y on x', I.naive, I.naiveSE, 1], ['y on x and u', I.ctrl, I.ctrlSE, 1]], { max: 4 }); }
    return { gen, see: li(see), draw, table: tbl };
  }
  ['coefinf', 'ftest', 'intervals', 'robustse', 'reading', 'causal'].forEach(k => { A[k] = inSig; });

  /* ================= Diagnostics: one plot or test at a time ================= */
  function dgSig(ctx){ const { v, P, Pb, a } = ctx, F0 = ctx.full ? ctx.full.cur : ctx.cur.d, R = P.dgr, B = Pb.dgr;
    const gen = `${esc(v.desc)}${F0.note ? ' ' + esc(F0.note) + '.' : ''} The baseline is the same recipe with the problem switched off (Strength 0).`;
    const pf = p => !isFinite(p) ? '—' : p < 0.001 ? '< 0.001' : n(p, 3);
    if (!R || !R.fit) return { gen, see: li([R ? esc(R.label) : '—']), draw: () => [], table: '' };
    const F = R.fit, I = R.info, x = I.x, N = F.n, k = R.kind, flag = new Set((F0.flagRows || []).map(i => P.tr.indexOf(i)).filter(i => i >= 0));
    const stat = o => { if (!o) return '—'; const J = o.info; const f = { reset: () => `F ${n(J.F, 2)}, p ${pf(J.p)}`, bp: () => `LM ${n(J.LM, 2)}, p ${pf(J.p)}`, white: () => `LM ${n(J.LM, 2)}, p ${pf(J.p)}`, gq: () => `F ${n(J.F, 2)}, p ${pf(J.p)}`, dw: () => `DW ${n(J.dw, 3)}`, lb: () => `Q ${n(J.Q, 2)}, p ${pf(J.p)}`, sw: () => `W ${n(J.sw.W, 4)}, p ${pf(J.sw.p)}`, jb: () => `JB ${n(J.JB, 2)}, p ${pf(J.pJB)}`, ad: () => `A² ${n(J.ad.A2, 3)}, p ${pf(J.ad.p)}`, vif: () => `max VIF ${n(Math.max(...J.vif.map(t => t.vif)), 2)}`, cond: () => `κ ${n(J.kappa, 1)}`, corr: () => `max |r| ${n(Math.max(...J.R.flatMap((rw, i) => rw.filter((_, j) => j !== i).map(Math.abs))), 3)}` }[o.kind]; return f ? f() : ''; };
    const see = li([`The check: <b>${esc(R.label)}</b>.`, R.attr === 'residplots' || R.attr === 'influence' || (R.attr === 'lintest' && k === 'cpr') ? `Largest |standardised residual| ${n(Math.max(...I.r.map(Math.abs)), 2)}, largest leverage ${n(Math.max(...I.h), 3)} (average p/N = ${n(F.p / N, 3)}), largest Cook’s D ${n(Math.max(...I.cook), 3)}.` : `Result: <b>${stat(R)}</b>; the same check on the baseline (no problem): ${stat(ctx.full && ctx.full.base ? (() => { try { return DG.run(v.id, Pb, ctx.full.base); } catch (err) { return null; } })() : B)}.`,
      R.attr === 'influence' ? `${I.flag.length} row${I.flag.length === 1 ? '' : 's'} above the threshold ${n(I.thr, 3)}${I.refit ? `; dropping the most extreme one moves the slope from ${n(F.w[1], 3)} to ${n(I.refit[1], 3)}` : ''}.` : '']);
    const draw = el => { const r1 = row(el), out = [], dot = (c, pt, i) => c.dot(pt, flag.has(i) ? C('--normal') : C('--floor'), flag.has(i) ? 4.5 : 3, false, 0.85);
      const scatter = (title, xs, ys, xl, yl, extra) => chart(r1, title, 260, c => { c.begin(range([xs]), range([ys, [0]]), xl, yl); extra && extra.pre && extra.pre(c); xs.forEach((t, i) => dot(c, [t, ys[i]], i)); extra && extra.post && extra.post(c); c.end(); extra && extra.leg && c.legend(extra.leg); });
      if (R.attr === 'residplots' || R.attr === 'influence') {
        if (k === 'qq') out.push(chart(r1, 'Normal Q–Q plot of the standardised residuals', 260, c => { const th = I.qq.map(q => q.theo), rr = I.qq.map(q => q.r), all = [...th, ...rr], lo = Math.min(...all), hi = Math.max(...all); c.begin([lo, hi], [lo, hi], 'theoretical normal quantile', 'standardised residual'); c.line([[lo, lo], [hi, hi]], C('--ink'), 1.4, [4, 3]); I.qq.forEach(q => dot(c, [q.theo, q.r], q.i)); c.end(); }));
        else if (k === 'scale') out.push(scatter('Scale–location: √|standardised residual| against ŷ', F.yh, I.r.map(t => Math.sqrt(Math.abs(t))), 'fitted ŷ', '√|r|', { post: c => c.line(I.smoothScale, CUR(), 2.4), leg: [[CUR(), 'trend (bin means)']] }));
        else if (k === 'leverage' || R.attr === 'influence') out.push(chart(r1, 'Standardised residuals against leverage, with Cook’s distance contours', 260, c => { const hx = [0, Math.max(...I.h) * 1.1], yr = sym(range([I.r, [3]])); c.begin(hx, yr, 'leverage hᵢᵢ', 'standardised residual');
          [0.5, 1].forEach(D => [1, -1].forEach(sgn => c.line(Array.from({ length: 60 }, (_, q) => { const hh = 0.01 + (hx[1] - 0.01) * q / 59; return [hh, sgn * Math.sqrt(D * F.p * (1 - hh) / hh)]; }).filter(pt => Math.abs(pt[1]) <= yr[1]), C('--normal'), 1.2, [4, 3])));
          c.hline(0, C('--rule')); c.vline(2 * F.p / N, C('--muted'), [2, 3]); I.h.forEach((hh, i) => dot(c, [hh, I.r[i]], i)); c.end(); c.legend([[C('--normal'), 'Cook’s D = 0.5 and 1', true], [C('--muted'), 'leverage 2p/N', true]]); }));
        else out.push(scatter('Residuals against fitted values', F.yh, F.e, 'fitted ŷ', 'residual e', { pre: c => c.hline(0, C('--ink')), post: c => c.line(I.smoothFit, CUR(), 2.4), leg: [[CUR(), 'trend (bin means)']] }));
        if (R.attr === 'influence') out.push(chart(r1, `${{ leverage: 'Leverage', student: 'Studentised residual', cook: 'Cook’s distance', dffits: 'DFFITS', dfbetas: 'DFBETAS (slope)' }[k]} of every training row; dashed: the threshold`, 260, c => { const vals = I.val; c.begin([0.5, N + 0.5], range([vals, [I.thr, -(k === 'leverage' || k === 'cook' ? 0 : I.thr)]]), 'training row (in order of x)', 'value');
          vals.forEach((t, i) => c.line([[i + 1, 0], [i + 1, t]], flag.has(i) || Math.abs(t) > I.thr ? C('--normal') : C('--floor'), 2.2)); c.hline(I.thr, C('--ink'), [4, 3]); if (!(k === 'leverage' || k === 'cook')) c.hline(-I.thr, C('--ink'), [4, 3]); c.end(); }));
        else if (k !== 'fitted') out.push(scatter('Residuals against fitted values (for reference)', F.yh, F.e, 'fitted ŷ', 'residual e', { pre: c => c.hline(0, C('--ink')) }));
        else out.push(scatter('Residuals against x', x, F.e, 'x', 'residual e', { pre: c => c.hline(0, C('--ink')) }));
      }
      if (R.attr === 'lintest') { if (k === 'cpr') out.push(scatter('Component plus residual: w·x + e against x', x, I.cpr, 'x', 'w·x + e', { post: c => { const xr = range([x]); c.line(xr.map(t => [t, F.w[1] * t]), C('--ink'), 1.6, [5, 4]); c.line(I.smooth, CUR(), 2.4); }, leg: [[C('--ink'), 'the model’s straight line', true], [CUR(), 'what the data do (bin means)']] }));
        else out.push(scatter('Residuals against fitted values: the curve RESET picks up', F.yh, F.e, 'fitted ŷ', 'residual e', { pre: c => c.hline(0, C('--ink')) }));
        out.push(scatter('Residuals against x', x, F.e, 'x', 'residual e', { pre: c => c.hline(0, C('--ink')) })); }
      if (R.attr === 'vartest') { out.push(scatter(k === 'gq' ? 'Residuals against x; shaded: the dropped middle' : 'Squared residuals against x (what the auxiliary regression sees)', x, k === 'gq' ? F.e : I.e2, 'x', k === 'gq' ? 'residual e' : 'e²', { pre: c => { if (k === 'gq') { c.rect(x[I.split], c.box.y0, x[Math.min(I.start2, N - 1)], c.box.y1, C('--muted'), 0.15); c.hline(0, C('--ink')); } } }));
        out.push(scatter('Residuals against x', x, F.e, 'x', 'residual e', { pre: c => c.hline(0, C('--ink')) })); }
      if (R.attr === 'indtest') { out.push(chart(r1, 'Residuals in time order', 260, c => { const yr = sym(range([F.e])); c.begin([1, N], yr, 'training row (time order)', 'residual e'); c.hline(0, C('--ink')); c.line(F.e.map((t, i) => [i + 1, t]), C('--muted'), 1); F.e.forEach((t, i) => c.dot([i + 1, t], t >= 0 ? C('--floor') : C('--normal'), 3)); c.end(); }));
        out.push(chart(r1, 'Autocorrelation of the residuals; dashed: ±1.96/√N', 260, c => { c.begin([0.5, I.L + 0.5], [-1, 1], 'lag k', 'ρ̂ₖ'); c.hline(0, C('--ink')); [1, -1].forEach(sg2 => c.hline(sg2 * 1.96 / Math.sqrt(N), C('--normal'), [4, 3])); I.rho.forEach((r2, q) => c.line([[q + 1, 0], [q + 1, r2]], CUR(), 4)); c.end(); })); }
      if (R.attr === 'normtest') { out.push(chart(r1, 'Histogram of the residuals with the normal curve of the same mean and SD', 260, c => { const xr = range([F.e]), B2 = 16, w = (xr[1] - xr[0]) / B2, kk = new Array(B2).fill(0); F.e.forEach(t => kk[Math.min(B2 - 1, Math.floor((t - xr[0]) / w))]++); const sdv = Math.sqrt(F.sse / N);
          c.begin(xr, [0, Math.max(...kk) * 1.2], 'residual e', 'rows'); kk.forEach((q, i) => q && c.rect(xr[0] + i * w, 0, xr[0] + (i + 1) * w, q, CUR(), 0.6)); c.line(Array.from({ length: 81 }, (_, q) => { const t = xr[0] + (xr[1] - xr[0]) * q / 80; return [t, N * w * Math.exp(-0.5 * (t / sdv) ** 2) / (sdv * Math.sqrt(2 * Math.PI))]; }), C('--ink'), 2); c.end(); }));
        out.push(chart(r1, 'Normal Q–Q plot of the residuals', 260, c => { const srt = [...F.e].sort((a2, b2) => a2 - b2), sdv = Math.sqrt(F.sse / N), th = srt.map((_, i) => DG.PhiInv((i + 1) / (N + 1)) * sdv), all = [...th, ...srt], lo = Math.min(...all), hi = Math.max(...all); c.begin([lo, hi], [lo, hi], 'normal quantile × s', 'sorted residual'); c.line([[lo, lo], [hi, hi]], C('--ink'), 1.4, [4, 3]); srt.forEach((t, i) => c.dot([th[i], t], C('--floor'), 3)); c.end(); })); }
      if (R.attr === 'colltest') { const X = P.tr.map(i => F0.X[i]);
        out.push(chart(r1, 'x₂ against x₁ (training rows)', 260, c => { const a1 = X.map(rw => rw[1]), a2 = X.map(rw => rw[2]); c.begin(range([a1]), range([a2]), 'x₁', 'x₂'); a1.forEach((t, i) => c.dot([t, a2[i]], C('--floor'), 3)); c.end(); }));
        out.push(chart(r1, k === 'vif' ? 'VIF of each feature; dashed: 10' : k === 'cond' ? 'Condition index of each eigen-direction; dashed: 30' : 'Correlation of each pair of features', 260, c => { const fn = P.names.slice(1), vals = k === 'vif' ? I.vif.map(t => t.vif) : k === 'cond' ? I.ci : (() => { const o = []; for (let i = 0; i < fn.length; i++) for (let j = i + 1; j < fn.length; j++) o.push(I.R[i][j]); return o; })();
          c.begin([0.4, vals.length + 0.6], [Math.min(0, ...vals), Math.max(...vals, k === 'vif' ? 10 : k === 'cond' ? 30 : 1) * 1.1], k === 'corr' ? 'pair' : k === 'vif' ? 'feature' : 'direction k', k === 'vif' ? 'VIF' : k === 'cond' ? 'condition index' : 'r'); vals.forEach((t, q) => c.rect(q + 0.65, 0, q + 1.35, t, CUR(), 0.75)); c.hline(k === 'vif' ? 10 : k === 'cond' ? 30 : 0.9, C('--ink'), [4, 3]); c.end(); })); }
      return out; };
    const tbl = R.attr === 'colltest' ? table(['feature', ...P.names.slice(1), 'VIF'], P.names.slice(1).map((nm, i) => [nm, ...I.R[i], I.vif[i].vif]), { max: 6 })
      : table(['x', 'y (true)', 'ŷ', 'e', 'hᵢᵢ', 'r (standardised)', 'Cook D'], P.tr.map((ti, i) => [x[i], P.ytr[i], F.yh[i], F.e[i], I.h[i], I.r[i], I.cook[i]]), { hi: i => flag.has(i) ? 'hl' : '', max: 10, foot: flag.size ? 'Highlighted: the rows built to be unusual.' : '' });
    return { gen, see, draw, table: tbl };
  }
  ['residplots', 'influence', 'lintest', 'vartest', 'indtest', 'normtest', 'colltest'].forEach(k => { A[k] = dgSig; });

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
