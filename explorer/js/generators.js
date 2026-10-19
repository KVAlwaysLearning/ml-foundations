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
    return { u1, u2, grp, z1, z2, z3, ex, t3 };
  }
  const sortedX = (P, N) => P.u1.slice(0, N).map(v => 10 * v).sort((a, b) => a - b);
  const lin = x => 2 + 1.5 * x;

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
    const y = x.map((v, i) => f(v, i) + sg * P.z1[i]);
    return { X: x.map((v, i) => [1, v, g[i]]), names: ['1', 'x', 'group'], y, px: x, xName: 'x', group: g, groupNames: ['group 0', 'group 1'],
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
    for (let i = 0; i < m && x.length < N; i++) for (let r = 0; r < k && x.length < N; r++) { x.push(xu[i]); e.push(sg * P.z1[i]); }
    return oneFeature(x, lin, e, { note: `${m} unique observations, each repeated ${k}×` });
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
    const y = x1.map((v, i) => 2 + 1.5 * v + [0, 3, 6][c[i]] + sg * P.z1[i]);
    return { X: x1.map((v, i) => [1, v, +(c[i] === 0), +(c[i] === 1), +(c[i] === 2)]), names: ['1', 'x', 'A', 'B', 'C'], y, px: x1, xName: 'x',
      group: c, groupNames: ['category A', 'category B', 'category C'], truth: { coef: { 1: 1.5 }, fn: null, byGroup: [0, 3, 6].map(k => v => 2 + 1.5 * v + k) }, focus: [1, 2] };
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

  function generate(variant, { N, sigma, strength, seed }){
    const P = pools(N, seed), fn = G[variant];
    if (!fn) throw new Error('No generator for ' + variant);
    const r = fn(P, N, sigma, strength);
    r.N = r.y.length; return r;
  }
  return { generate, has: id => !!G[id] };
})();
