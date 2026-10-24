/* ============================================================
   Data generators for every simulated variant.
   All variants draw from the same random pools for a given seed,
   so a variant and its baseline differ only in the property that
   was changed.
   Returned object:
     X       design matrix rows (first column is 1)
     names   column names
     y       targets
     px      values on the horizontal axis of the scatter plot
     xName   label for px
     group   optional group index per row (for colour) and groupNames
     x2      optional second feature (for the x₁ vs x₂ view)
     truth   { coef: {colIndex: value}, fn(x, row) -> E[y] or null }
     focus   column indices whose sampling distribution is shown
   ============================================================ */
const GEN = (() => {
  function pools(N, seed){
    const rng = mulberry32(seed * 7919 + 13), g = gaussFn(rng), K = Math.max(N, 16);
    const u1 = Array.from({ length: K }, rng), u2 = Array.from({ length: K }, rng), grp = Array.from({ length: K }, () => rng() < 0.5 ? 1 : 0);
    const z1 = Array.from({ length: K }, g), z2 = Array.from({ length: K }, g), z3 = Array.from({ length: K }, g);
    const ex = Array.from({ length: K }, () => -Math.log(1 - rng()));
    const t3 = Array.from({ length: K }, () => { const c = g() ** 2 + g() ** 2 + g() ** 2; return g() / Math.sqrt(c / 3); });
    return { u1, u2, grp, z1, z2, z3, ex, t3, seed, rng2: () => mulberry32(seed * 31337 + 5) };
  }
  const sortedX = (P, N) => P.u1.slice(0, N).map(v => 10 * v).sort((a, b) => a - b);
  const lin = x => 2 + 1.5 * x;

  /* a categorical feature as it is recorded: text. The 0/1 columns are what step 5 makes from it
     (named like pandas.get_dummies / OneHotEncoder: "region_North"); the reference level (alphabetically first) gets no column unless keepAll. */
  function rawCat(name, levels, g, keepAll = false){
    const lv = keepAll ? levels.map((_, q) => q) : levels.map((_, q) => q).slice(1), cat = {}, base = 2;
    lv.forEach((q, k) => { cat[base + k] = q; });
    return { names: lv.map(q => `${name}_${levels[q]}`), cols: i => lv.map(q => +(g[i] === q)), cat,
      raw: { name, levels, ref: keepAll ? null : levels[0], keepAll, vals: g.map(q => levels[q]) },
      groupNames: levels.map((l, q) => keepAll || q ? l : `${l} (reference)`) };
  }
  function oneFeature(x, f, e, extra = {}){
    const y = x.map((v, i) => f(v, i) + e[i]);
    return Object.assign({ X: x.map(v => [1, v]), names: ['1', 'x'], y, px: x, xName: 'x', truth: { coef: { 0: 2, 1: 1.5 }, fn: f }, focus: [1] }, extra);
  }

  const G = {};
  /* ---------- linearity ---------- */
  const blend = (s, g) => (x, i) => (1 - s) * lin(x) + s * g(x, i);
  G.linear = (P, N, sg) => { const x = sortedX(P, N); return oneFeature(x, lin, P.z1.map(z => sg * z)); };
  G.quadratic = (P, N, sg, s) => { const x = sortedX(P, N); return oneFeature(x, v => lin(v) + s * 0.3 * (v - 5) ** 2, P.z1.map(z => sg * z), { truth: { coef: {}, fn: v => lin(v) + s * 0.3 * (v - 5) ** 2 } }); };
  G.log = (P, N, sg, s) => { const x = sortedX(P, N), f = blend(s, v => 2 + 7 * Math.log(1 + v)); return oneFeature(x, f, P.z1.map(z => sg * z), { truth: { coef: {}, fn: f } }); };
  G.sshape = (P, N, sg, s) => { const x = sortedX(P, N), f = blend(s, v => 2 + 15 / (1 + Math.exp(-1.5 * (v - 5)))); return oneFeature(x, f, P.z1.map(z => sg * z), { truth: { coef: {}, fn: f } }); };
  G.step = (P, N, sg, s) => { const x = sortedX(P, N), f = blend(s, v => 3 + 0.3 * v + (v > 5 ? 9 : 0)); return oneFeature(x, f, P.z1.map(z => sg * z), { truth: { coef: {}, fn: f } }); };
  G.periodic = (P, N, sg, s) => { const x = sortedX(P, N), f = v => lin(v) + s * 4 * Math.sin(1.6 * v); return oneFeature(x, f, P.z1.map(z => sg * z), { truth: { coef: {}, fn: f } }); };
  G.interaction = (P, N, sg, s) => {
    const x = sortedX(P, N), g = P.grp.slice(0, N), f = (v, i) => lin(v) + s * (1.4 * v - 7) * g[i];
    const y = x.map((v, i) => f(v, i) + sg * P.z1[i]), rc = rawCat('customer', ['new', 'returning'], g);
    return { X: x.map((v, i) => [1, v, ...rc.cols(i)]), names: ['1', 'x', ...rc.names], y, px: x, xName: 'x', group: g, groupNames: rc.groupNames, cat: rc.cat, rawCat: rc.raw,
      truth: { coef: {}, fn: f, byGroup: [v => lin(v), v => lin(v) + s * (1.4 * v - 7)] }, focus: [1] };
  };
  /* ---------- independence ---------- */
  G.indep = G.linear;
  const ar = rho => (P, N, sg) => { const x = sortedX(P, N), e = []; e[0] = sg * P.z1[0];
    for (let i = 1; i < N; i++) e[i] = rho * e[i - 1] + Math.sqrt(1 - rho * rho) * sg * P.z1[i];
    return oneFeature(x, lin, e); };
  G.posar = (P, N, sg, s) => ar(0.9 * s)(P, N, sg);
  G.negar = (P, N, sg, s) => ar(-0.8 * s)(P, N, sg);
  G.cluster = (P, N, sg, s) => {
    const C = 8, q = 0.8 * s, cl = Array.from({ length: N }, (_, i) => Math.floor(i * C / N));
    const centre = Array.from({ length: C }, (_, k) => 10 * P.u2[k]);
    const x = cl.map((k, i) => centre[k] * s + (1 - s) * 10 * P.u1[i] + 0.4 * s * P.z2[i]);
    const e = cl.map((k, i) => sg * (Math.sqrt(q) * P.z3[k] + Math.sqrt(1 - q) * P.z1[i]));
    return oneFeature(x, lin, e, { group: cl, groupNames: centre.map((_, k) => 'cluster ' + (k + 1)) });
  };
  G.dupes = (P, N, sg, s) => {
    const k = 1 + Math.round(2 * s), m = Math.ceil(N / k), xu = sortedX(P, m), x = [], e = [];
    const src = [];
    for (let i = 0; i < m && x.length < N; i++) for (let r = 0; r < k && x.length < N; r++) { x.push(xu[i]); e.push(sg * P.z1[i]); src.push(i); }
    return oneFeature(x, lin, e, { note: `${m} unique observations, each repeated ${k}×`, src });
  };
  /* ---------- homoscedasticity ---------- */
  const het = mult => (P, N, sg, s) => { const x = sortedX(P, N); return oneFeature(x, lin, x.map((v, i) => sg * ((1 - s) + s * mult(v, P, i)) * P.z1[i])); };
  G.constant = G.linear;
  G.increasing = het(v => 0.15 + 1.7 * v / 10);
  G.decreasing = het(v => 0.15 + 1.7 * (10 - v) / 10);
  G.bowtie = het(v => 0.2 + 1.6 * Math.abs(v - 5) / 5);
  G.groupvar = (P, N, sg, s) => { const r = het((v, P2, i) => P2.grp[i] ? 1.7 : 0.3)(P, N, sg, s); return Object.assign(r, { group: P.grp.slice(0, N), groupNames: ['small-error group', 'large-error group'] }); };
  /* ---------- normality ---------- */
  const nonNormal = d => (P, N, sg, s) => { const x = sortedX(P, N); return oneFeature(x, lin, x.map((_, i) => sg * (Math.sqrt(Math.max(0, 1 - s * s)) * P.z1[i] + s * d(P, i)))); };
  G.normal = G.linear;
  G.rskew = nonNormal((P, i) => P.ex[i] - 1);
  G.lskew = nonNormal((P, i) => 1 - P.ex[i]);
  G.heavy = nonNormal((P, i) => P.t3[i] / Math.sqrt(3));
  G.light = nonNormal((P, i) => (P.u2[i] - 0.5) * Math.sqrt(12));
  G.bimodal = nonNormal((P, i) => (P.grp[i] ? 0.95 : -0.95) + 0.31 * P.z2[i]);
  /* ---------- multicollinearity ---------- */
  function twoFeatures(P, N, sg, x2of){
    const x1 = P.u1.slice(0, N).map(v => 10 * v), x2 = x1.map((v, i) => x2of(v, i));
    const y = x1.map((v, i) => 2 + 1.5 * v + 1.0 * x2[i] + sg * P.z1[i]);
    return { X: x1.map((v, i) => [1, v, x2[i]]), names: ['1', 'x₁', 'x₂'], y, px: x1, xName: 'x₁', x2, truth: { coef: { 0: 2, 1: 1.5, 2: 1.0 }, fn: null }, focus: [1, 2] };
  }
  const corr = rho => (P, N, sg) => twoFeatures(P, N, sg, (v, i) => 5 + rho * (v - 5) + Math.sqrt(1 - rho * rho) * (10 * P.u2[i] - 5));
  G.uncorr = (P, N, sg) => corr(0)(P, N, sg);
  G.moderate = (P, N, sg, s) => corr(0.6 * s)(P, N, sg);
  G.high = (P, N, sg, s) => corr(0.97 * s)(P, N, sg);
  G.perfect = (P, N, sg, s) => twoFeatures(P, N, sg, (v, i) => 2 * v + (1 - s) * 2 * P.z2[i]);
  G.combo = (P, N, sg, s) => {
    const x1 = P.u1.slice(0, N).map(v => 10 * v), x2 = P.u2.slice(0, N).map(v => 10 * v), x3 = x1.map((v, i) => v + x2[i] + (1 - s) * 1.5 * P.z2[i]);
    const y = x1.map((v, i) => 2 + 1.5 * v + 1.0 * x2[i] + 0.5 * x3[i] + sg * P.z1[i]);
    return { X: x1.map((v, i) => [1, v, x2[i], x3[i]]), names: ['1', 'x₁', 'x₂', 'x₃'], y, px: x1, xName: 'x₁', x2, truth: { coef: { 0: 2, 1: 1.5, 2: 1.0, 3: 0.5 }, fn: null }, focus: [1, 2] };
  };
  G.dummytrap = (P, N, sg) => {
    const x1 = P.u1.slice(0, N).map(v => 10 * v), c = P.u2.slice(0, N).map(v => Math.min(2, Math.floor(3 * v)));
    const y = x1.map((v, i) => 2 + 1.5 * v + [0, 3, 6][c[i]] + sg * P.z1[i]), rc = rawCat('colour', ['blue', 'green', 'red'], c, true);
    return { X: x1.map((v, i) => [1, v, ...rc.cols(i)]), names: ['1', 'x', ...rc.names], y, px: x1, xName: 'x', cat: rc.cat, rawCat: rc.raw,
      group: c, groupNames: rc.groupNames, truth: { coef: { 1: 1.5 }, fn: null, byGroup: [0, 3, 6].map(k => v => 2 + 1.5 * v + k) }, focus: [1, 2] };
  };
  /* ---------- exogeneity ---------- */
  G.exo = G.linear;
  G.confounder = (P, N, sg, s) => {
    const z = P.z2.slice(0, N), x = z.map((v, i) => 5 + 2 * s * v + 2.2 * P.z3[i]);
    return oneFeature(x, lin, x.map((_, i) => 3 * s * z[i] + sg * P.z1[i]), { note: 'The dashed line is the causal effect (slope 1.5); the omitted z is in the error.' });
  };
  G.measerr = (P, N, sg, s) => {
    const xt = P.u1.slice(0, N).map(v => 10 * v), x = xt.map((v, i) => v + 3 * s * P.z2[i]);
    const r = oneFeature(x, lin, xt.map((v, i) => 0), {});
    r.y = xt.map((v, i) => lin(v) + sg * P.z1[i]); return r;
  };
  G.reverse = (P, N, sg, s) => {
    const gm = 0.4 * s, e = P.z1.slice(0, N).map(z => sg * z), x = e.map((ei, i) => 10 * P.u1[i] + gm / (1 - 1.5 * gm) * ei);
    return oneFeature(x, lin, e);
  };


  /* ================= Data properties branch ================= */
  /* outliers: a few rows are changed after drawing; they are always kept in the training rows (forceTrain) */
  const nOut = N => Math.max(1, Math.round(N / 60));
  const pickMid = (x, k) => { const N = x.length, out = []; for (let q = 0; q < k; q++) out.push(Math.min(N - 1, Math.floor(N * (0.35 + 0.3 * (q + 0.5) / k)))); return out; };
  G.outnone = G.linear;
  G.outy = (P, N, sg, s) => { const r = G.linear(P, N, sg), idx = pickMid(r.px, nOut(N)), sh = s * 6 * Math.max(sg, 1);
    idx.forEach(i => r.y[i] += sh); return Object.assign(r, { forceTrain: idx, flagRows: idx, note: `${idx.length} row(s) pushed up by ${num(sh, 2)} in y (6 × max(σ, 1) × s)` }); };
  const lever = off => (P, N, sg, s) => { const r = G.linear(P, N, sg), i = N - 1, x = 10 + 15 * s;
    r.X[i][1] = x; r.px[i] = x; r.y[i] = lin(x) + sg * P.z1[i] - (off ? 20 * s : 0);
    return Object.assign(r, { forceTrain: [i], flagRows: [i], note: off ? `the last row moved to x = ${num(x, 1)} and ${num(20 * s, 1)} below the true line` : `the last row moved to x = ${num(x, 1)}, still on the true line` }); };
  G.levon = lever(false); G.levoff = lever(true);
  G.outcluster = (P, N, sg, s) => { const r = G.linear(P, N, sg), m = Math.max(3, Math.round(N / 12)), idx = [];
    for (let q = 0; q < m; q++) { const i = N - 1 - 2 * q; if (i < 0) break; idx.push(i); const x = r.px[i]; r.y[i] = lin(x) + sg * P.z1[i] - s * 8 * Math.max(sg, 1); }
    return Object.assign(r, { forceTrain: idx, flagRows: idx, note: `${idx.length} rows at the top of the x range pulled down together by ${num(s * 8 * Math.max(sg, 1), 2)}` }); };
  /* sample size: N is set by the variant (see fixedN) */
  G.nlarge = G.linear; G.nmod = G.linear; G.nsmall = G.linear; G.nap = G.linear; G.nlp = G.linear;
  /* noise level: σ is set by the variant (see sigmaOf) */
  G.nslow = G.linear; G.nszero = G.linear; G.nsmod = G.linear; G.nshigh = G.linear;
  G.nspure = (P, N, sg) => { const x = sortedX(P, N), sy = Math.sqrt(1.5 * 1.5 * 100 / 12 + sg * sg);
    return oneFeature(x, () => 9.5, P.z1.map(z => sy * z), { truth: { coef: { 0: 9.5, 1: 0 }, fn: () => 9.5 }, note: `y = 9.5 + ${num(sy, 2)}·z: the same spread as the baseline y, but no link to x` }); };
  /* feature range */
  G.rwide = G.linear;
  G.rrestrict = (P, N, sg, s) => { const x = sortedX(P, N).map(v => 5 + (v - 5) * (1 - 0.8 * s)); return oneFeature(x, lin, P.z1.map(z => sg * z), { note: `x squeezed into [${num(5 - 5 * (1 - 0.8 * s), 1)}, ${num(5 + 5 * (1 - 0.8 * s), 1)}]` }); };
  const bump = s => v => lin(v) + s * 4 * Math.exp(-((v - 5.5) ** 2) / 0.8);
  G.rgap = (P, N, sg, s) => { const x = sortedX(P, N).map(v => (1 - s) * v + s * (v < 5 ? 0.8 * v : 7 + 0.6 * (v - 5))), f = bump(s);
    return oneFeature(x, f, P.z1.map(z => sg * z), { truth: { coef: {}, fn: f }, note: 'no rows with x between 4 and 7; the true curve has a bump hidden in the gap' }); };
  G.rextrap = (P, N, sg, s) => { const x = sortedX(P, N), cut = 10 - 4 * s, f = v => lin(v) + s * 0.35 * Math.max(0, v - 6) ** 2;
    const te = x.map((v, i) => v > cut ? i : -1).filter(i => i >= 0);
    return oneFeature(x, f, P.z1.map(z => sg * z), { truth: { coef: {}, fn: f }, testIdx: te.length >= 2 ? te : null, note: `test rows are the ${te.length} rows with x > ${num(cut, 1)}; the training rows never go that far` }); };
  /* irrelevant features: columns with true coefficient 0 */
  const noiseCols = (r, m, P, nameOf) => { const rng = P.rng2(); for (let q = 0; q < m; q++) { const nm = nameOf(q); r.names.push(nm); r.X.forEach(row => row.push(10 * rng())); r.truth.coef[r.X[0].length - 1] = 0; } return r; };
  G.irnone = G.linear;
  G.irfew = (P, N, sg) => noiseCols(G.linear(P, N, sg), 3, P, q => 'n' + SUBS[q]);
  G.irmany = (P, N, sg) => noiseCols(G.linear(P, N, sg), 8, P, q => 'n' + SUBS2(q + 1));
  G.ircopy = (P, N, sg, s) => { const r = G.linear(P, N, sg), sd = 0.05 + 2 * (1 - s); r.names.push('x_copy'); r.X.forEach((row, i) => row.push(row[1] + sd * P.z2[i])); r.truth.coef[2] = 0;
    return Object.assign(r, { note: `x_copy = x + ${num(sd, 2)}·z: the same information again` }); };
  /* missing data: values of y are lost; the affected rows are dropped (complete-case analysis) after the extras are added */
  const dropY = prob => (P, N, sg, s) => { const r = G.linear(P, N, sg); r.post = rr => {
      const rng = P.rng2(), my = ST.mean(rr.y), sy = ST.sd(rr.y) || 1, lose = rr.y.map((y, i) => rng() < prob(rr, i, s, (y - my) / sy));
      const keep = lose.map((l, i) => l ? -1 : i).filter(i => i >= 0);
      if (keep.length < rr.X[0].length + 4) return; // never drop so many that nothing can be fitted
      rr.dropped = { idx: lose.map((l, i) => l ? i : -1).filter(i => i >= 0) }; rr.dropped.X = rr.dropped.idx.map(i => rr.X[i]); rr.dropped.y = rr.dropped.idx.map(i => rr.y[i]);
      rr.full = { X: rr.X, y: rr.y, px: rr.px };
      rr.X = keep.map(i => rr.X[i]); rr.y = keep.map(i => rr.y[i]); rr.px = keep.map(i => rr.px[i]); rr.orig = keep;
      if (rr.x2) rr.x2 = keep.map(i => rr.x2[i]);
      rr.note = `${rr.dropped.idx.length} of ${keep.length + rr.dropped.idx.length} rows lost their y and were dropped`;
    }; return r; };
  G.mnone = G.linear;
  G.mcar = dropY((r, i, s) => 0.3 * s);
  G.mar = dropY((r, i, s) => s * 0.7 * (r.X[i][1] / 10) ** 2);
  G.mnar = dropY((r, i, s, zy) => s * 0.85 / (1 + Math.exp(-2.2 * zy)));
  /* target type */
  G.tcont = G.linear;
  G.tskew = (P, N, sg, s) => { const x = sortedX(P, N), y = x.map((v, i) => (1 - s) * (lin(v) + sg * P.z1[i]) + s * Math.exp(0.6 + 0.25 * v + 0.12 * Math.max(sg, 0.3) * P.z1[i])), f = v => (1 - s) * lin(v) + s * Math.exp(0.6 + 0.25 * v + 0.5 * (0.12 * Math.max(sg, 0.3)) ** 2);
    const r = oneFeature(x, f, x.map(() => 0), { truth: { coef: {}, fn: f } }); r.y = y; return r; };
  G.tbound = (P, N, sg) => { const x = sortedX(P, N), sgm = t => 20 / (1 + Math.exp(-t)), y = x.map((v, i) => sgm(-3 + 0.6 * v + 0.25 * Math.max(sg, 0.3) * P.z1[i])), f = v => sgm(-3 + 0.6 * v);
    const r = oneFeature(x, f, x.map(() => 0), { truth: { coef: {}, fn: f }, bounds: [0, 20] }); r.y = y; return r; };
  G.tcount = (P, N) => { const x = sortedX(P, N), lam = v => Math.exp(0.3 + 0.25 * v), u = P.u2;
    const pois = (l, q) => { let k = 0, p = Math.exp(-l), c = p; while (q > c && k < 200) { k++; p *= l / k; c += p; } return k; };
    const y = x.map((v, i) => pois(lam(v), u[i])); const r = oneFeature(x, lam, x.map(() => 0), { truth: { coef: {}, fn: lam }, bounds: [0, Infinity], counts: true }); r.y = y; return r; };
  /* categorical features: one-hot columns (reference level dropped) */
  const catData = (P, N, sg, L, effect, name, levels) => { const x = P.u1.slice(0, N).map(v => 10 * v), rng = P.rng2();
    // with many levels, the first 2L rows hold every level twice and are kept in training, so every dummy column has rows
    const g = Array.from({ length: N }, (_, i) => L > 6 && i < 2 * L ? i % L : Math.min(L - 1, Math.floor(L * (L > 6 ? rng() : P.u2[i]))));
    const y = x.map((v, i) => lin(v) + effect[g[i]] + sg * P.z1[i]), rc = rawCat(name, levels, g);
    const X = x.map((v, i) => [1, v, ...rc.cols(i)]);
    const coef = { 0: 2 + effect[0], 1: 1.5 }; for (let q = 1; q < L; q++) coef[q + 1] = effect[q] - effect[0];
    return { X, names: ['1', 'x', ...rc.names], y, px: x, xName: 'x', group: g, groupNames: rc.groupNames, cat: rc.cat, rawCat: rc.raw, forceTrain: L > 6 ? [...Array(Math.min(N, 2 * L)).keys()] : undefined,
      truth: { coef, fn: null, byGroup: effect.map(e => v => lin(v) + e) }, focus: [1, 2] };
  };
  G.cnone = G.linear;
  G.cbin = (P, N, sg, s) => catData(P, N, sg, 2, [0, 4 * s], 'segment', ['basic', 'premium']);
  G.cmulti = (P, N, sg, s) => catData(P, N, sg, 4, [0, 3 * s, -2 * s, 5 * s], 'region', ['East', 'North', 'South', 'West']);
  G.chigh = (P, N, sg, s) => { const L = 25, rng = mulberry32(P.seed * 911 + 3), gz = gaussFn(rng), eff = Array.from({ length: L }, (_, q) => q ? 3 * s * gz() : 0);
    return catData(P, N, sg, L, eff, 'branch', Array.from({ length: L }, (_, q) => 'B' + String(q + 1).padStart(2, '0'))); };
  /* hidden subgroups: the group is real but not a column of X */
  const hidden = (P, N, sg, s, fns) => { const x0 = P.u1.slice(0, N).map(v => 10 * v), g = P.grp.slice(0, N);
    const x = x0.map((v, i) => fns.x ? fns.x(v, g[i], i) : v), y = x.map((v, i) => fns.f[g[i]](v) + sg * P.z1[i]);
    return { X: x.map(v => [1, v]), names: ['1', 'x'], y, px: x, xName: 'x', group: g, groupNames: ['group 0', 'group 1'], hiddenGroup: true,
      truth: { coef: {}, fn: null, byGroup: fns.f }, focus: [1] }; };
  G.sgnone = G.linear;
  G.sgint = (P, N, sg, s) => hidden(P, N, sg, s, { f: [v => lin(v), v => lin(v) + 7 * s], x: (v, g) => g ? 3 + 0.7 * v : v * 0.8 });
  G.sgslope = (P, N, sg, s) => hidden(P, N, sg, s, { f: [v => lin(v), v => lin(v) - 2 * s * (v - 5)] });
  G.simpson = (P, N, sg, s) => hidden(P, N, sg, s, { f: [v => lin(v) + 18 * s, v => lin(v)], x: (v, g) => g ? 5 + 0.5 * v : 0.5 * v });
  /* distribution shift: the test rows come from a different place */
  G.shnone = G.linear;
  G.shfeat = (P, N, sg, s) => { const nTe = Math.max(2, Math.round(0.2 * N)), x = P.u1.slice(0, N).map((v, i) => i >= N - nTe ? (1 - s) * 10 * v + s * (7.5 + 1.2 * P.z2[i]) : 10 * v);
    return oneFeature(x, lin, P.z1.map(z => sg * z), { testIdx: [...Array(nTe).keys()].map(q => N - nTe + q), note: `the last ${nTe} rows (the test set) have x around 7.5 instead of spread over 0–10` }); };
  G.shrel = (P, N, sg, s) => { const nTe = Math.max(2, Math.round(0.2 * N)), x = P.u1.slice(0, N).map(v => 10 * v), late = i => i >= N - nTe;
    const f = (v, i) => late(i) ? 2 + (1.5 - 1.2 * s) * v + 3 * s : lin(v);
    return oneFeature(x, f, P.z1.map(z => sg * z), { truth: { coef: {}, fn: f }, testIdx: [...Array(nTe).keys()].map(q => N - nTe + q), note: `in the last ${nTe} rows (the test period) the slope drops from 1.5 to ${num(1.5 - 1.2 * s, 2)}` }); };
  /* leakage */
  G.lknone = G.linear;
  G.lktarget = (P, N, sg, s) => { const r = G.linear(P, N, sg); r.post = rr => { const sd = 0.3 + 4 * (1 - s); rr.names.push('leak'); rr.X.forEach((row, i) => row.push(rr.y[i] + sd * P.z3[i])); rr.truth.coef[rr.X[0].length - 1] = 0; rr.leakCol = rr.X[0].length - 1;
      rr.note = `"leak" = y + ${num(sd, 2)}·z: recorded after the outcome, so it will not exist when a real prediction is needed`; }; return r; };
  G.lkprep = (P, N, sg, s) => { const r = G.linear(P, N, sg); r.post = rr => {
      // an ID-like category (about one row per level) with NO effect on y, target-encoded (mean y of its level) using every row, before the split
      const n0 = rr.y.length, L = Math.max(4, n0), rng = P.rng2(), lev = rr.y.map(() => Math.floor(L * rng())), sp = PIPE.splitIdx(n0, P.seed, rr);
      const enc = idx => { const m = new Map(); idx.forEach(i => { const o = m.get(lev[i]) || [0, 0]; o[0] += rr.y[i]; o[1]++; m.set(lev[i], o); }); return m; };
      const all = enc([...rr.y.keys()]), trm = enc(sp.tr), gm = ST.mean(sp.tr.map(i => rr.y[i]));
      const leaky = rr.y.map((_, i) => { const o = all.get(lev[i]); return (1 - s) * gm + s * o[0] / o[1]; });
      const honest = rr.y.map((_, i) => { const o = trm.get(lev[i]); return (1 - s) * gm + s * (o ? o[0] / o[1] : gm); });
      rr.names.push('enc'); rr.X.forEach((row, i) => row.push(leaky[i])); rr.truth.coef[rr.X[0].length - 1] = 0; rr.encCol = rr.X[0].length - 1;
      rr.prep = { L, lev, honest, leaky, sp, gm, rowsPer: n0 / L };
      rr.note = `a category with ${L} levels and no effect on y, replaced by the mean y of its level computed on ALL rows (test rows included)`; }; return r; };

  /* extra independent features, from their own random numbers (shared by a variant and its baseline) */
  const EXTRA_BETA = [0.8, -0.6, 0.5, -0.4, 0.3, 0.7, -0.5, 0.4, -0.3];
  const SUBS = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₁₀'];
  const SUBS2 = k => String(k).split('').map(ch => '₀₁₂₃₄₅₆₇₈₉'[+ch]).join('');
  const BASE_COUNT = { uncorr: 2, moderate: 2, high: 2, perfect: 2, combo: 3, nlarge: 5, nmod: 5, nsmall: 5, nap: 5, nlp: 5, irfew: 4, irmany: 9, ircopy: 2, interaction: 2, dummytrap: 2, cbin: 2, cmulti: 2, chigh: 2, lktarget: 2, lkprep: 2,
    scnone: 2, scstd: 2, scminmax: 2, scrobust: 2, intnone: 2, intx: 2, encoh: 2, encall: 2, encord: 2, enctarget: 2, selall: 10, selfwd: 10, selbwd: 10, selstep: 10, sellasso: 10, selvif: 10, selp: 10 };
  /* 0/1 columns made from a categorical feature (named "feature_level") */
  const CAT_NAMES = ['customer', 'colour', 'segment', 'region', 'branch'];
  const isCat = nm => typeof nm === 'string' && CAT_NAMES.some(c => nm.startsWith(c + '_'));
  /* columns of the design matrix including categorical ones (for the minimum N) */
  /* extra design-matrix columns beyond one per feature: a category with L levels is one feature but L − 1 columns (chigh also needs every level twice in training) */
  const P_EXTRA = { cbin: 0, cmulti: 2, chigh: 40, dummytrap: 2, interaction: 0, deg2: 1, deg3: 2, deg5: 4, deg10: 9, sp1: 1, spmany: 3, binwidth: 3, binquant: 3, encoh: 2, encall: 3, intx: 1, cenraw: 1, cencent: 1 };
  const pCount = (variant, k) => Math.max(k, baseCount(variant)) + 1 + (P_EXTRA[variant] || 0);
  /* sample-size variants fix N themselves: p = features + 1 */
  const fixedN = (variant, k) => { const p = Math.max(k, baseCount(variant)) + 1;
    return { nlarge: 200, nmod: 60, nsmall: 15, nap: Math.ceil((p + 1) / 0.8) + 0, nlp: Math.max(3, Math.round((p - 2) / 0.8)) }[variant] ?? null; };
  /* noise variants set σ themselves */
  const sigmaOf = (variant, sg) => ({ nszero: 0, nsmod: 2.5 * Math.max(sg, 1), nshigh: 6 * Math.max(sg, 1) }[variant] ?? sg);
  const baseCount = variant => BASE_COUNT[variant] || 1;
  function addFeatures(r, k, seed){
    const numeric = r.names.slice(1).filter(nm => !isCat(nm)).length, feats = numeric + (r.rawCat ? 1 : 0);
    const add = Math.max(0, Math.min(10, k) - feats);
    r.m = numeric; r.extra = add;
    // rename a lone 'x' to 'x₁' so the extras can be x₂, x₃, … (also when the variant's own columns fill the k features, so names match its baseline)
    if (!add) return r;
    if (r.names.includes('x')) { r.names = r.names.map(nm => nm === 'x' ? 'x₁' : nm); if (r.xName === 'x') r.xName = 'x₁'; }
    const rng = mulberry32(seed * 104729 + 77), K = Math.max(r.y.length, 16), U = Array.from({ length: add }, () => Array.from({ length: K }, () => 10 * rng()));
    const idx = i => r.src ? r.src[i] : i, start = r.names.filter(nm => /^x/.test(nm)).length;
    for (let q = 0; q < add; q++) {
      const nm = 'x' + SUBS[start + q], beta = EXTRA_BETA[q], col = r.X.length;
      r.names.push(nm);
      // a multiplicative target (Transform of y) takes the extra features in its exponent, so y stays positive
      r.X.forEach((row, i) => { const v = U[q][idx(i)]; row.push(v); if (r.multExtras) r.y[i] *= Math.exp(0.1 * beta * v); else r.y[i] += beta * v; });
      r.truth.coef[r.X[0].length - 1] = r.multExtras ? null : beta;
    }
    if (r.truth.fn) { const f0 = r.truth.fn, cols = r.X[0].length, from = cols - add, X = r.X, B = EXTRA_BETA;
      r.truth.fn = (v, i) => f0(v, i) + (X[i] ? X[i].slice(from).reduce((s, x, q) => s + B[q] * x, 0) : 0); r.truth.partial = true; }
    if (r.truth.byGroup) { r.truth.byGroupPartial = true; }
    if (!r.x2 && !r.names.slice(1).some(isCat)) r.x2 = r.X.map(row => row[2]);
    return r;
  }
  function generate(variant, { N, sigma, strength, seed, k = 1 }){
    const P = pools(N, seed), fn = G[variant] || (FE.has(variant) ? (P2, N2, sg2, s2) => FE.data(variant, P2, N2, sg2, s2) : null);
    if (!fn) throw new Error('No generator for ' + variant);
    const r = addFeatures(fn(P, N, sigmaOf(variant, sigma), strength), k, seed);
    if (r.post) { r.post(r); delete r.post; }
    if (FE.has(variant)) FE.apply(r, variant, seed);   // feature engineering: the design is built in step 5 from the raw columns
    r.N = r.y.length; r.sigmaUsed = sigmaOf(variant, sigma); return r;
  }
  /* the same feature in two datasets: 'x' and 'x₁' are one feature (x is renamed x₁ only when extra features are added) */
  /* columns left unscaled in step 5: 0/1 columns from a category or from bins */
  const noScale = nm => isCat(nm) || (typeof nm === 'string' && nm.startsWith('bin_'));
  /* a column you can pick as a feature on its own (not a category column, not built from another column) */
  const isFeat = nm => !isCat(nm) && !FE.isAux(nm);
  const colIn = (names, nm) => { let j = names.indexOf(nm); if (j < 0 && (nm === 'x' || nm === 'x₁')) j = names.indexOf(nm === 'x' ? 'x₁' : 'x'); return j; };
  return { generate, has: id => !!G[id], baseCount, EXTRA_BETA, isCat, pCount, fixedN, sigmaOf, CAT_NAMES, colIn, noScale, isFeat };
})();
