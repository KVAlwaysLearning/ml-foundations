/* ============================================================
   Explorer page: state, floating controls, and every chart drawn
   inside the step that uses it. All step numbers and charts come
   from one run (PIPE) on the training rows.
   ============================================================ */
(() => {
  const ATTRS = CATALOG.flatMap(b => b.attrs), attrById = id => ATTRS.find(a => a.id === id);
  const branchOf = a => CATALOG.find(b => b.id === a.branch);
  const S = { attr: 'linearity', variant: 'linear', view: 'linearity', N: 60, sigma: 2, strength: 1, seed: 1, cmp: true, res: false, lr: 0.2, iters: 400, k: 1, onlyAffected: false, expandAll: false };

  // ---- read the URL hash ----
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.get('a') && attrById(hp.get('a'))?.live) { S.attr = S.view = hp.get('a'); const v = hp.get('v'); S.variant = attrById(S.attr).variants.some(x => x.id === v) ? v : attrById(S.attr).variants[0].id; }
  [['N', 'N'], ['s', 'sigma'], ['k', 'strength'], ['seed', 'seed'], ['lr', 'lr'], ['it', 'iters'], ['f', 'k']].forEach(([k, f]) => { const v = parseFloat(hp.get(k)); if (isFinite(v)) S[f] = v; });
  if (hp.get('cmp') === '0') S.cmp = false;
  const writeHash = () => history.replaceState(null, '', '#' + new URLSearchParams({ a: S.attr, v: S.variant, N: S.N, s: S.sigma, k: S.strength, seed: S.seed, lr: S.lr, it: S.iters, f: S.k, cmp: S.cmp ? 1 : 0 }).toString());
  const store = { get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v){ try { localStorage.setItem(k, v); } catch (e) {} } };

  // ---- layout ----
  const web = new ConceptWeb($('#web'), sel => select(sel));
  const panel = $('#panel');
  panel.innerHTML = `<div class="crumb" id="crumb"></div><h2 id="vtitle"></h2><p class="vdesc" id="vdesc"></p>
    <div class="chips" id="chips" role="group" aria-label="Variants"></div><div id="planned"></div>
    <p class="hint-s">Sliders are in the floating <b>Controls</b> box at the bottom right of the screen.</p>
    <a class="to-proc" href="#changed">What changed and how to see it ↓</a> <a class="to-proc" href="#process">The process ↓</a> <a class="to-proc" href="#notes">Interview notes ↓</a> <a class="to-proc" href="#code">Python code ↓</a>`;
  $('#chips').onclick = e => { const b = e.target.closest('button'); if (b) select({ attr: S.view, variant: b.dataset.id }); };

  // ---- floating controls ----
  const box = document.createElement('aside'); box.className = 'ctlbox'; box.setAttribute('aria-label', 'Controls');
  box.innerHTML = `<div class="ctlbox-h"><b>Controls</b><span class="ctlbox-v" id="fboxV"></span><button type="button" class="ctlbox-x" id="fboxX" aria-expanded="true" title="Collapse or expand">−</button></div>
    <div class="ctlbox-b"><div id="fboxS"></div>
    <div class="ctlbox-r"><label><input type="checkbox" id="cmp"> Compare with the baseline</label><label><input type="checkbox" id="res"> Show residuals in step 9a</label></div>
    <div class="ctlbox-r"><button type="button" class="btn" id="resample">New sample</button><span class="seed" id="seedlbl"></span><button type="button" class="btn ghost" id="copylink">Copy link</button></div>
    <div class="ctlbox-r ctlbox-fs"><span>Text size</span><button type="button" class="btn ghost" id="fsm" aria-label="Smaller text">A−</button><button type="button" class="btn ghost" id="fsp" aria-label="Larger text">A+</button></div></div>`;
  document.body.appendChild(box);
  const sl = $('#fboxS', box);
  const sF = slider(sl, { label: 'Number of features k', min: 1, max: 10, step: 1, value: S.k, digits: 0, onInput: v => { S.k = v; update(); } });
  const sN = slider(sl, { label: 'Sample size N', min: 8, max: 300, step: 1, value: S.N, digits: 0, onInput: v => { S.N = v; update(); } });
  const sS = slider(sl, { label: 'Noise σ', min: 0, max: 5, step: 0.05, value: S.sigma, onInput: v => { S.sigma = v; update(); } });
  const sK = slider(sl, { label: 'Strength', min: 0, max: 1, step: 0.01, value: S.strength, onInput: v => { S.strength = v; update(); } });
  const sLR = slider(sl, { label: 'Gradient-descent step (fraction of 2/λ_max), step 9b', min: 0.02, max: 1.2, step: 0.01, value: S.lr, onInput: v => { S.lr = v; update(); } });
  const sIt = slider(sl, { label: 'Gradient-descent iterations, step 9b', min: 10, max: 2000, step: 10, value: S.iters, digits: 0, onInput: v => { S.iters = v; update(); } });
  $('#cmp').checked = S.cmp; $('#cmp').onchange = e => { S.cmp = e.target.checked; update(); };
  $('#res').checked = S.res; $('#res').onchange = e => { S.res = e.target.checked; update(); };
  $('#resample').onclick = () => { S.seed += 1; update(); };
  $('#copylink').onclick = e => { navigator.clipboard?.writeText(location.href).then(() => { e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy link', 1500); }).catch(() => {}); };
  const setCollapsed = c => { box.classList.toggle('collapsed', c); $('#fboxX').textContent = c ? '+' : '−'; $('#fboxX').setAttribute('aria-expanded', String(!c)); store.set('ctlbox-collapsed', c ? '1' : '0'); };
  $('#fboxX').onclick = () => setCollapsed(!box.classList.contains('collapsed'));
  setCollapsed(store.get('ctlbox-collapsed') === '1' || (store.get('ctlbox-collapsed') == null && matchMedia('(max-width: 760px)').matches));
  let zoom = parseFloat(store.get('ex-zoom')) || 1;
  const applyZoom = () => { document.documentElement.style.setProperty('--ex-zoom', zoom); store.set('ex-zoom', zoom); };
  $('#fsm').onclick = () => { zoom = Math.max(0.85, +(zoom - 0.1).toFixed(2)); applyZoom(); };
  $('#fsp').onclick = () => { zoom = Math.min(1.5, +(zoom + 0.1).toFixed(2)); applyZoom(); };
  applyZoom();

  function select({ attr, variant }){
    const a = attrById(attr);
    S.view = attr;
    if (a.live) {
      if (attr !== S.attr) { S.attr = attr; S.variant = a.variants[0].id; }
      if (variant) S.variant = variant;
    }
    update();
  }

  // ---- computation: one dataset, one split, one run ----
  const mcCache = new Map(); let mcTimer = null, R = 200;
  const kEff = variant => Math.max(S.k, GEN.baseCount(variant));
  /* enough rows for the coefficients and the tests: N_train ≥ p + 6, where p = features + 1 (+ categorical columns) */
  const nMin = variant => Math.max(8, Math.ceil((kEff(variant) + 1 + 3 + 6) / 0.8));
  const nEff = variant => Math.max(S.N, nMin(variant));
  const gen = (variant, strength) => GEN.generate(variant, { N: nEff(variant), sigma: S.sigma, strength, seed: S.seed, k: kEff(variant) });
  /* the training rows of a dataset, fitted in original units (same predictions and diagnostics as the standardised run) */
  function view(d, tr){
    tr = tr.filter(i => i < d.y.length);
    const X = tr.map(i => d.X[i]), y = tr.map(i => d.y[i]);
    const dd = Object.assign({}, d, { X, y, px: tr.map(i => d.px[i]), x2: d.x2 ? tr.map(i => d.x2[i]) : undefined, group: d.group ? tr.map(i => d.group[i]) : undefined, N: tr.length,
      truth: Object.assign({}, d.truth, { fn: d.truth.fn ? (v, k) => d.truth.fn(v, tr[k]) : null }) });
    const f = ST.ols(X, y); let dg = null; try { dg = ST.diagnostics(X, y, f); } catch (err) {}
    // the standardised design and its Gram matrix, exactly as in steps 5 and 6
    const mu = X[0].map((_, j) => j ? ST.mean(X.map(r => r[j])) : 0), sd = X[0].map((_, j) => { if (!j) return 1; const s = Math.sqrt(ST.mean(X.map(r => (r[j] - mu[j]) ** 2))); return s > 1e-12 ? s : 1; });
    const Z = X.map(r => r.map((v, j) => j ? (v - mu[j]) / sd[j] : 1)), A = LA.mul(LA.T(Z), Z), ev = LA.eigSym(A).values;
    const gram = { A, eig: ev, kappa: ev[ev.length - 1] > 1e-12 * ev[0] ? ev[0] / ev[ev.length - 1] : Infinity };
    return { d: dd, f, dg: dg || { vif: [], jb: {}, dw: NaN }, gram };
  }
  function mcFor(variant, strength, focus, truth){
    const key = [variant, strength, nEff(variant), S.sigma, kEff(variant)].join('|');
    if (!mcCache.has(key)) {
      const kk = kEff(variant), NN = nEff(variant);
      mcCache.set(key, ST.monteCarlo(r => GEN.generate(variant, { N: NN, sigma: S.sigma, strength, seed: 5000 + r, k: kk }), R, focus, truth));
      if (mcCache.size > 40) mcCache.delete(mcCache.keys().next().value);
    }
    return mcCache.get(key);
  }

  let cur = null, base = null, mcCur = null, mcBase = null, mcChart = null, mcRO = null;
  function update(){
    const a = attrById(S.attr), v = a.variants.find(x => x.id === S.variant), baseId = a.variants[0].id, isBase = v.id === baseId;
    const d = gen(v.id, S.strength), db = isBase ? d : gen(baseId, 0);
    const P = PIPE.run(d, { seed: S.seed, lr: S.lr, iters: S.iters });
    const tv = view(d, P.tr), tb = isBase ? tv : view(db, P.tr);
    cur = { d, P, tv }; base = { d: db, tv: tb };
    const inf = influence(a.id, v, isBase, S.strength);
    const k1 = [v.id, S.strength, nEff(v.id), S.sigma, kEff(v.id)].join('|'), k0 = [baseId, 0, nEff(baseId), S.sigma, kEff(baseId)].join('|');
    mcCur = mcCache.get(k1) || null; mcBase = mcCache.get(k0) || null;
    renderPanel(a, v, isBase); renderChanged(a, v, isBase, inf); renderProcess(a, v, isBase, inf);
    clearTimeout(mcTimer);
    if (!mcCur || (S.cmp && !mcBase)) {
      if (mcRO) mcRO.innerHTML = '<span class="muted">Running 200 fresh datasets…</span>';
      mcTimer = setTimeout(() => {
        mcCur = mcFor(v.id, S.strength, d.focus, d.truth.coef);
        mcBase = isBase ? mcCur : mcFor(baseId, 0, db.focus, db.truth.coef);
        drawMC();
      }, 220);
    }
    writeHash();
  }

  // ---- panel ----
  function renderPanel(a, v, isBase){
    const viewA = attrById(S.view), vb = branchOf(viewA);
    web.set({ branch: vb.id, attr: viewA.id, variant: viewA.live ? S.variant : null });
    $('#crumb').textContent = `${vb.name} › ${viewA.name}`;
    $('#fboxV').textContent = `${a.name} › ${v.name}`;
    sK.el.style.display = v.strength ? '' : 'none';
    sK.el.querySelector('label').firstChild.textContent = 'Strength: ' + (v.strength || '');
    sF.set(kEff(v.id)); sF.el.querySelector('label').firstChild.textContent = GEN.baseCount(v.id) > 1 ? `Number of features k (this variant has ${GEN.baseCount(v.id)} built in)` : 'Number of features k';
    sN.set(nEff(v.id)); sN.el.querySelector('label').firstChild.textContent = nMin(v.id) > 8 ? `Sample size N (at least ${nMin(v.id)} for ${kEff(v.id)} features)` : 'Sample size N';
    sS.set(S.sigma); sK.set(S.strength); sLR.set(S.lr); sIt.set(S.iters);
    $('#cmp').checked = S.cmp; $('#seedlbl').textContent = 'sample #' + S.seed;
    if (!viewA.live) {
      $('#vtitle').textContent = viewA.name;
      $('#vdesc').textContent = `Planned for a later step. The simulation below still shows ${a.name} › ${v.name}.`;
      $('#chips').innerHTML = viewA.variants.map((x, i) => `<button type="button" disabled>${esc(x.name)}${i === 0 ? ' · baseline' : ''}</button>`).join('');
      return;
    }
    $('#vtitle').textContent = v.name + (isBase ? ' (baseline)' : '');
    $('#vdesc').textContent = v.desc + (cur.d.note ? ' ' + cur.d.note.replace(/\.$/, '') + '.' : '');
    $('#chips').innerHTML = a.variants.map((x, i) => `<button type="button" data-id="${x.id}" aria-pressed="${x.id === v.id}">${esc(x.name)}${i === 0 ? ' · baseline' : ''}</button>`).join('');
    MATH.typeset(panel);
  }

  // ---- colours and helpers ----
  const groupColor = (k, n) => n <= 4 ? css(['--floor', '--residual', '--surface', '--normal'][k]) : `hsl(${(k * 360 / n + 160) % 360} 55% 45%)`;
  const ptColor = (d, i) => d.group ? groupColor(d.group[i], d.groupNames.length) : css('--floor');
  const colMeans = X => X[0].map((_, j) => ST.mean(X.map(r => r[j])));
  function rowAt(d, x, g){
    const r = colMeans(d.X); r[1] = x;
    const gi = d.names.indexOf('group'); if (gi >= 0) r[gi] = g;
    if (d.names.includes('A')) ['A', 'B', 'C'].forEach((n, k) => r[d.names.indexOf(n)] = +(k === g));
    return r;
  }
  const grid = (lo, hi, n = 80) => Array.from({ length: n + 1 }, (_, i) => lo + (hi - lo) * i / n);
  const corrOf = (a, b) => { const ma = ST.mean(a), mb = ST.mean(b); let sab = 0, saa = 0, sbb = 0; a.forEach((v, i) => { sab += (v - ma) * (b[i] - mb); saa += (v - ma) ** 2; sbb += (b[i] - mb) ** 2; }); return sab / Math.sqrt(saa * sbb); };
  function mount(parent, title, height, draw, cls = ''){
    const c = new Chart(parent, { title, height }); c.wrap.classList.add('mini'); if (cls) c.wrap.classList.add(cls); c.drawFn = () => draw(c); c.drawFn(); return c;
  }

  // ---- step 9a: the data and the fitted line ----
  function drawFit(P, isBase){
    const { d, f } = cur.tv, xs = d.px, groups = d.group ? d.groupNames.length : 0;
    const lo = Math.min(...xs), hi = Math.max(...xs), gx = grid(lo, hi);
    const lineGroups = (d.names.includes('group') || d.names.includes('A')) ? [...Array(groups).keys()] : [null];
    const fitLines = lineGroups.map(g => gx.map(x => [x, LA.dot(rowAt(d, x, g ?? 0), f.w)]));
    const trueLines = d.truth.byGroup && !d.truth.byGroupPartial ? d.truth.byGroup.map(fn => gx.map(x => [x, fn(x)])) : d.truth.fn && d.X[0].length === 2 ? [gx.map(x => [x, d.truth.fn(x, 0)])] : [];
    let baseLine = null;
    if (S.cmp && !isBase) { const bd = base.tv.d, bx = bd.px; baseLine = grid(Math.min(...bx), Math.max(...bx)).map(x => [x, LA.dot(rowAt(bd, x, 0), base.tv.f.w)]); }
    const ys = [...d.y, ...fitLines.flat().map(p => p[1])];
    P.begin([lo, hi], [Math.min(...ys), Math.max(...ys)], d.xName, 'y');
    if (S.res) xs.forEach((x, i) => P.line([[x, d.y[i]], [x, f.yhat[i]]], css('--residual'), 1, null, 0.7));
    xs.forEach((x, i) => P.dot([x, d.y[i]], ptColor(d, i), 3.4, false, 0.85));
    if (d.X[0].length > 2 && !d.group) xs.forEach((x, i) => P.dot([x, f.yhat[i]], css('--surface'), 3, true, 0.6));
    trueLines.forEach(l => P.line(l, css('--ink'), 1.6, [6, 5], 0.8));
    if (baseLine) P.line(baseLine, css('--muted'), 2, [3, 4]);
    fitLines.forEach((l, k) => P.line(l, lineGroups[k] == null ? css('--surface') : groupColor(lineGroups[k], groups), 2.6));
    P.end();
    const leg = [[css('--surface'), d.X[0].length > 2 && !d.group ? 'fitted line at the mean of the other features' : 'fitted line (weights from this step)']];
    if (trueLines.length) leg.push([css('--ink'), 'true mean E[y | x]', true]);
    if (baseLine) leg.push([css('--muted'), 'baseline fit (same rows of the baseline data)', true]);
    if (S.res) leg.push([css('--residual'), 'residuals e = y − ŷ']);
    if (d.group) d.groupNames.slice(0, 4).forEach((n, k) => leg.push([groupColor(k, groups), n]));
    P.legend(leg);
  }

  // ---- step 10: the picture behind each test ----
  function drawDiag(P, mode){
    const { d, f } = cur.tv, e = f.e, s = Math.sqrt(f.SSE / Math.max(1, f.df)) || 1, z = e.map(v => v / s), N = e.length, col = i => ptColor(d, i);
    const msg = t => { P.begin([0, 1], [0, 1], '', ''); P.text(t, [0.03, 0.5], css('--muted'), 0, 0, true); P.end(); P.legend([]); };
    if (mode === 'fitted') {
      P.begin([Math.min(...f.yhat), Math.max(...f.yhat)], [Math.min(...e), Math.max(...e)], 'fitted ŷ (step 7)', 'residual e (step 8)');
      P.hline(0, css('--ink'), [4, 4]); f.yhat.forEach((v, i) => P.dot([v, e[i]], col(i), 3.4, false, 0.85));
      const idx = [...f.yhat.keys()].sort((i, j) => f.yhat[i] - f.yhat[j]), B = Math.max(4, Math.min(12, Math.floor(N / 6))), pts = [];
      for (let b = 0; b < B; b++) { const sl2 = idx.slice(Math.floor(b * N / B), Math.floor((b + 1) * N / B)); if (sl2.length) pts.push([ST.mean(sl2.map(i => f.yhat[i])), ST.mean(sl2.map(i => e[i]))]); }
      P.line(pts, css('--normal'), 2.4); P.end();
      P.legend([[css('--normal'), 'average residual in bins: a bend means a missing curve'], [css('--ink'), 'zero', true]]);
    } else if (mode === 'e2') {
      const x = d.px, e2 = e.map(v => v * v), fit = ST.ols(x.map(v => [1, v]), e2, true), xr = [Math.min(...x), Math.max(...x)];
      P.begin(xr, [0, Math.max(...e2)], `${d.xName} (step 1)`, 'e² (squared residual)'); x.forEach((v, i) => P.dot([v, e2[i]], col(i), 3.2, false, 0.8));
      P.line(xr.map(v => [v, fit.w[0] + fit.w[1] * v]), css('--normal'), 2.4); P.hline(ST.mean(e2), css('--ink'), [4, 4]); P.end();
      P.legend([[css('--normal'), 'auxiliary regression line of e² on x: a slope means the spread changes'], [css('--ink'), 'average e² (constant variance)', true]]);
    } else if (mode === 'order') {
      P.begin([1, N], [Math.min(...e), Math.max(...e)], 'training row, in time order', 'residual e'); P.hline(0, css('--ink'), [4, 4]);
      P.line(e.map((v, i) => [i + 1, v]), css('--muted'), 1.2); e.forEach((v, i) => P.dot([i + 1, v], v >= 0 ? css('--floor') : css('--normal'), 3, false, 0.9)); P.end();
      P.legend([[css('--floor'), 'positive'], [css('--normal'), 'negative'], [css('--muted'), 'long same-colour runs: positive autocorrelation; zig-zag: negative']]);
    } else if (mode === 'lag') {
      const r = SIG.lag1(e), m = Math.max(...e.map(Math.abs)) * 1.05;
      P.begin([-m, m], [-m, m], 'previous residual eₜ₋₁', 'residual eₜ'); P.hline(0, css('--rule')); P.vrule(0, css('--rule'));
      for (let i = 1; i < N; i++) P.dot([e[i - 1], e[i]], css('--floor'), 3, false, 0.8);
      P.line([[-m, -r * m], [m, r * m]], css('--ink'), 1.6, [5, 4]); P.end(); P.legend([[css('--ink'), `slope ≈ r₁ = ${num(r, 2)} (0 if independent)`, true]]);
    } else if (mode === 'qq') {
      const sz = [...z].sort((x, y) => x - y), q = sz.map((_, i) => invNorm((i + 0.5) / N)), m = Math.max(...q.map(Math.abs), ...sz.map(Math.abs));
      P.begin([-m, m], [-m, m], 'normal quantile', 'standardised residual'); P.line([[-m, -m], [m, m]], css('--ink'), 1.4, [5, 4]);
      sz.forEach((v, i) => P.dot([q[i], v], css('--floor'), 3.2, false, 0.85)); P.end();
      P.legend([[css('--ink'), 'bell-shaped errors fall on this line', true], [css('--floor'), 'S-shape: heavy or light tails; bow: skew']]);
    } else if (mode === 'hist') {
      const B = Math.max(8, Math.min(24, Math.round(Math.sqrt(N) * 1.6))), lo = Math.min(-3.5, ...z), hi = Math.max(3.5, ...z), w = (hi - lo) / B, cnt = new Array(B).fill(0);
      z.forEach(v => cnt[Math.min(B - 1, Math.floor((v - lo) / w))]++);
      const dens = cnt.map(c => c / (N * w)), top = Math.max(...dens, 0.42);
      P.begin([lo, hi], [0, top], 'standardised residual', 'density');
      dens.forEach((h, i) => P.rect(lo + i * w + w * 0.05, 0, lo + (i + 1) * w - w * 0.05, h, css('--residual'), 0.6));
      P.line(grid(lo, hi, 120).map(x => [x, Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)]), css('--ink'), 1.6, [5, 4]); P.end();
      P.legend([[css('--residual'), 'residuals'], [css('--ink'), 'bell curve', true]]);
    } else if (mode === 'leverage') {
      if (!f.lev) { msg('X̃ᵀX̃ is singular, so leverage is not defined.'); return; }
      const st = e.map((v, i) => v / Math.sqrt(f.s2 * Math.max(1e-12, 1 - f.lev[i]))), thr = 4 / N;
      P.begin([0, Math.max(...f.lev)], [Math.min(...st, -3), Math.max(...st, 3)], 'leverage h', 'studentised residual r');
      P.hline(0, css('--ink'), [4, 4]); [-2, 2].forEach(v => P.hline(v, css('--muted'), [2, 4]));
      f.lev.forEach((h, i) => P.dot([h, st[i]], f.cook[i] > thr ? css('--normal') : col(i), f.cook[i] > thr ? 4.5 : 3.2, false, 0.9)); P.end();
      P.legend([[css('--normal'), `Cook's D above 4/N = ${num(thr, 3)}`], [css('--muted'), '±2', true]]);
    } else if (mode === 'x1x2') {
      if (!d.x2) { msg('With one feature there is nothing for it to overlap with: VIF = 1.'); return; }
      const r = corrOf(d.px, d.x2);
      P.begin([Math.min(...d.px), Math.max(...d.px)], [Math.min(...d.x2), Math.max(...d.x2)], 'x₁', 'x₂');
      d.px.forEach((x, i) => P.dot([x, d.x2[i]], col(i), 3.4, false, 0.85)); P.end(); P.legend([[css('--floor'), `correlation r = ${num(r, 3)}`]]);
    }
  }
  const DIAG = { 0: [['fitted', 'Residuals vs fitted: what RESET puts a number on']], 1: [['e2', 'Squared residuals vs x: what Breusch–Pagan regresses']], 2: [['order', 'Residuals in time order'], ['lag', 'Lag plot: each residual against the previous one']],
    3: [['qq', 'Normal Q–Q plot'], ['hist', 'Histogram of residuals vs the bell curve']], 4: [['x1x2', 'x₁ against x₂: the overlap VIF measures']], 5: [['leverage', "Leverage vs residual: Cook's distance combines both"]] };

  // ---- step 11: the sampling distribution over 200 fresh datasets ----
  function drawMC(){
    const P = mcChart; if (!P || !P.wrap.isConnected) return;
    if (!mcCur) { P.begin([0, 1], [0, 1], '', ''); P.end(); P.legend([]); if (mcRO) mcRO.innerHTML = '<span class="muted">Running 200 fresh datasets…</span>'; return; }
    const c = mcCur, b = S.cmp && mcBase !== mcCur ? mcBase : null, names = cur.d.names;
    if (c.length > 1) {
      const [m1, m2] = c, pts = m1.est.map((v, i) => [v, m2.est[i]]), bp = b ? b[0].est.map((v, i) => [v, b[1].est[i]]) : [];
      const xs = [...pts, ...bp].map(p => p[0]), ys = [...pts, ...bp].map(p => p[1]);
      if (m1.truth != null) xs.push(m1.truth); if (m2.truth != null) ys.push(m2.truth);
      P.begin([Math.min(...xs), Math.max(...xs)], [Math.min(...ys), Math.max(...ys)], `estimated coefficient of ${names[m1.j]}`, `estimated coefficient of ${names[m2.j]}`);
      bp.forEach(p => P.dot(p, css('--muted'), 2.6, true, 0.6)); pts.forEach(p => P.dot(p, css('--surface'), 2.8, false, 0.55));
      if (m1.truth != null && m2.truth != null) { P.dot([m1.truth, m2.truth], css('--normal'), 6, true); P.text('true values', [m1.truth, m2.truth], css('--normal'), 8, -8, true); }
      P.end(); P.legend([[css('--surface'), 'one dot per dataset'], ...(b ? [[css('--muted'), 'baseline (hollow)']] : []), [css('--normal'), 'truth']]);
    } else {
      const m = c[0], bm = b ? b[0] : null, all = [...m.est, ...(bm ? bm.est : [])]; if (m.truth != null) all.push(m.truth);
      const lo = Math.min(...all), hi = Math.max(...all), B = 28, w = (hi - lo) / B || 1;
      const hist = arr => { const h = new Array(B).fill(0); arr.forEach(v => h[Math.min(B - 1, Math.max(0, Math.floor((v - lo) / w)))]++); return h.map(x => x / (arr.length * w)); };
      const h = hist(m.est), hb = bm ? hist(bm.est) : null;
      const claim = isFinite(m.meanSE) ? grid(lo, hi, 140).map(x => [x, Math.exp(-(((x - m.mean) / m.meanSE) ** 2) / 2) / (m.meanSE * Math.sqrt(2 * Math.PI))]) : null;
      const top = Math.max(...h, ...(hb || [0]), ...(claim ? claim.map(p => p[1]) : [0]));
      P.begin([lo, hi], [0, top], `estimated slope of ${names[m.j]} (one per dataset)`, 'density');
      if (hb) hb.forEach((v, i) => v && P.line([[lo + i * w, 0], [lo + i * w, v], [lo + (i + 1) * w, v], [lo + (i + 1) * w, 0]], css('--muted'), 1.2));
      h.forEach((v, i) => P.rect(lo + i * w + w * 0.04, 0, lo + (i + 1) * w - w * 0.04, v, css('--surface'), 0.55));
      if (claim) P.line(claim, css('--ink'), 1.6, [5, 4]);
      if (m.truth != null) { P.vrule(m.truth, css('--normal'), null, 2.2); P.text('true value', [m.truth, top], css('--normal'), 5, 14, true); }
      P.end(); P.legend([[css('--surface'), 'actual spread of the estimate'], [css('--ink'), 'spread the classical SE claims', true], [css('--normal'), 'true value'], ...(hb ? [[css('--muted'), 'baseline']] : [])]);
    }
    if (mcRO) { mcRO.innerHTML = c.map(m => `<span>${esc(names[m.j])}: average estimate <b>${num(m.mean, 3)}</b>${!m.identifiable ? ' (<b>not identifiable</b>)' : m.truth != null ? ` (truth ${num(m.truth, 2)}, bias <b>${num(m.mean - m.truth, 3)}</b>)` : ''}; actual SD <b>${num(m.sd, 3)}</b> vs average reported SE <b>${isFinite(m.meanSE) ? num(m.meanSE, 3) : 'n/a'}</b>; 95% CI covers the truth <b>${isFinite(m.coverage) ? num(100 * m.coverage, 0) + '%' : 'n/a'}</b> of the time</span>`).join('') +
      `<span class="muted">Each of the 200 datasets has N = ${cur.d.y.length} rows from the same recipe and is fitted on all its rows by the closed form of step 9a. A trustworthy SE matches the actual SD, and a valid 95% interval covers the truth about 95% of the time.</span>`; MATH.typeset(mcRO); }
  }

  // ---- what changed and how to see it ----
  const chgEl = $('#changed'), notesEl = $('#notes'); let chgCharts = [];
  function renderChanged(a, v, isBase, inf){
    chgCharts.forEach(c => c.dispose()); chgCharts = [];
    try { chgCharts = CHG.render(chgEl, { cur: cur.tv, base: base.tv, full: { cur: cur.d, base: base.d }, a, v, isBase, S, inf }); } catch (err) { console.error(err); chgEl.innerHTML = `<p class="pv-note">Could not draw this view: ${esc(err.message)}</p>`; }
    const sp = chgEl.querySelector('#sig-part');
    if (sp) try { chgCharts.push(...SIG.render(sp, { cur: cur.tv, base: base.tv, a, v, isBase, S, embedded: true })); } catch (err) { console.error(err); }
    MATH.typeset(chgEl);
  }
  document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (!g) return; e.preventDefault();
    const t = document.getElementById(g.dataset.goto); if (!t) return;
    t.closest('details:not([open])')?.setAttribute('open', '');
    t.scrollIntoView({ behavior: 'smooth', block: 'start' }); t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 2200); });
  document.addEventListener('toggle', e => { const dd = e.target; if (dd.tagName === 'DETAILS' && dd.open) setTimeout(() => MATH.typeset(dd), 0); }, true);

  // ---- process ----
  const procEl = $('#process'), symEl = $('#symbols'), basicsEl = $('#basics');
  let usedSyms = {}, procCharts = [];
  const openHow = new Set();
  const howBuild = new Map();
  procEl.addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('details.how')) { d.open ? openHow.add(d.dataset.key) : openHow.delete(d.dataset.key);
    if (d.open) { const b = d.querySelector('.how-body'); if (b && !b.dataset.built) { const fn = howBuild.get(d.dataset.key); if (fn) { b.innerHTML = fn(); b.dataset.built = '1'; } } } } }, true);
  procEl.addEventListener('click', e => {
    const c = e.target.closest('[data-attr]'); if (c) { select({ attr: c.dataset.attr, variant: c.dataset.variant || undefined }); return; }
    const j = e.target.closest('[data-jump]'); if (j) { e.preventDefault(); document.getElementById('step-' + j.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  procEl.addEventListener('change', e => { if (e.target.id === 'onlyAff') { S.onlyAffected = e.target.checked; update(); } if (e.target.id === 'expandAll') { S.expandAll = e.target.checked; if (!S.expandAll) openHow.clear(); update(); } });
  function renderProcess(a, v, isBase, inf){
    const P = cur.P, d = cur.d;
    const ctx = { P, d, S, attr: a, variant: v, isBase, focus: d.focus[0] };
    const lvOf = id => inf[id] ? inf[id][0] : 'none';
    try { NOTES.render(notesEl, { P, d, a, v, isBase, inf, S, cur }); MATH.typeset(notesEl); } catch (err) { console.error(err); }
    try { CODE.render($('#code'), { P, d, a, v, isBase, inf, S }); } catch (err) { console.error(err); $('#code').innerHTML = `<p class="pv-note">The code could not be generated: ${esc(err.message)}</p>`; }
    const groupsBy = { origin: [], major: [], minor: [], none: [] }; STEPS.forEach(st => groupsBy[lvOf(st.id)].push(st.id));
    const legend = Object.entries(LEVELS).map(([k, L]) => `<span class="lv ${L.cls}"><b>${L.glyph}</b> ${L.label}</span>`).join('') +
      Object.entries(MARKS).map(([k, m]) => `<span class="lv"><span class="mk mk-${k}">${m[0]}</span> ${m[1]}</span>`).join('');
    const summary = isBase ? `<p class="proc-sum">Baseline selected: every step works as standard. Pick a variant on the web to see which steps it touches.</p>`
      : `<p class="proc-sum"><b>${esc(a.name)} › ${esc(v.name)}</b> ` + ['origin', 'major', 'minor', 'none'].filter(k => groupsBy[k].length)
        .map(k => `<span class="lv ${LEVELS[k].cls}"><b>${LEVELS[k].glyph}</b> ${LEVELS[k].label.toLowerCase()}: ${groupsBy[k].join(', ')}</span>`).join(' ') + `</p>`;
    const strip = `<div class="proc-strip">` + STEPS.map(st => { const L = LEVELS[lvOf(st.id)]; return `<a href="#step-${st.id}" data-jump="${st.id}" class="pill ${L.cls}" title="${esc(st.title)}: ${L.label}"><b>${L.glyph}</b> ${st.id}</a>`; }).join('') + `</div>`;
    usedSyms = {};
    const cards = STEPS.map(st => {
      const lv = lvOf(st.id), L = LEVELS[lv];
      if (S.onlyAffected && lv === 'none' && !isBase) return '';
      const chips = st.attrs.map(id => attrById(id)).filter(Boolean).map(at => {
        const sel = at.id === a.id, b0 = `<button type="button" class="pa${at.live ? ' live' : ''}${sel ? ' sel' : ''}" data-attr="${at.id}"${at.live ? '' : ' title="Planned for a later step"'}>${esc(at.name)}</button>`;
        if (!sel) return b0;
        return b0 + `<span class="pv-list">` + at.variants.map((x, i) => `<button type="button" class="pv${x.id === v.id ? ' sel' : ''}" data-attr="${at.id}" data-variant="${x.id}">${esc(x.name)}${i === 0 ? ' · baseline' : ''}</button>`).join('') + `</span>`;
      }).join('');
      const subs = st.subs.map(([sym, label, val], i) => {
        const xf = EXPLAIN[st.id]?.[i], key = st.id + '-' + i;
        let how = '';
        if (xf) {
          const build = () => { try { const x = xf(ctx);
            return `<div class="hw"><span class="hw-h">In plain words</span><p>${x.plain}</p></div>
            ${x.hyp ? `<div class="hw"><span class="hw-h">Hypotheses</span><p>${x.hyp}</p></div>` : ''}
            <div class="hw"><span class="hw-h">Formula</span><div class="hw-f">${x.formula}</div></div>
            <div class="hw"><span class="hw-h">Worked on this data</span><div>${x.calc}</div></div>
            <div class="hw"><span class="hw-h">How to read it</span><p>${x.read}</p></div>
            ${x.pit ? `<div class="hw"><span class="hw-h">Assumes and misses</span><p>${x.pit}</p></div>` : ''}
            ${x.qa ? `<div class="hw"><span class="hw-h">Interview questions</span><div class="qa">${x.qa.map(([q, a2]) => `<details><summary>${q}</summary><p>${a2}</p></details>`).join('')}</div></div>` : ''}`; } catch (err) { console.error(err); return '<p class="pv-note">This explanation could not be built.</p>'; } };
          howBuild.set(key, build); const open = S.expandAll || openHow.has(key);
          how = `<details class="how" data-key="${key}"${open ? ' open' : ''}><summary>How is this calculated?</summary><div class="how-body"${open ? ' data-built="1"' : ''}>${open ? build() : ''}</div></details>`; }
        const viz = String(st.id) === '10' && DIAG[i] ? `<div class="sub-viz pv-row" data-viz="${i}"></div>` : '';
        return `<div class="sub" id="sub-${st.id}-${i}"><div class="sub-sym">${sym}</div><div class="sub-lbl">${typeof label === 'function' ? label(ctx) : label}</div><div class="sub-val">${(() => { try { return val(ctx); } catch (err) { return '—'; } })()}</div>${viz}${how}</div>`;
      }).join('');
      const html = subs + (inf[st.id] ? inf[st.id][1] : '');
      const byDisp = Object.fromEntries(Object.entries(SYM).map(([k, s]) => [s[0], k]));
      for (const m of html.matchAll(/<abbr class="sym"[^>]*>([^<]+)<\/abbr>/g)) { const k = byDisp[m[1]]; if (k) (usedSyms[k] = usedSyms[k] || new Set()).add(st.id); }
      return `<article class="step ${L.cls}" id="step-${st.id}">
        <header><span class="glyph" title="${L.label}">${L.glyph}</span><span class="sn">${st.id}</span><h3>${esc(st.title)}</h3><span class="lvl">${L.label}</span></header>
        <p class="goal">${esc(st.goal)}</p>
        ${inf[st.id] ? `<p class="why"><b>${isBase ? '' : 'Why: '}</b>${esc(inf[st.id][1])}</p>` : ''}
        ${LEDGER.html(st.id, ctx)}
        <div class="sviz" data-step="${st.id}"></div>
        <div class="subs">${subs}</div>
        <div class="pattrs"><span class="pa-h">Considered at this step:</span>${chips}</div>
      </article>`;
    }).join('');
    procEl.innerHTML = `<div class="proc-head"><h2 id="proc-h">The process, step by step</h2>
      <p>One real run on the current data: an 80/20 split, features standardised with the training mean and SD, a closed-form fit and gradient descent on the training rows, diagnostics, four kinds of standard error, a test score, and coefficients converted back. Every chart and number below comes from this same run on the same training rows.</p>
      <div class="proc-legend">${legend}</div>${summary}
      <div class="flow-wrap"><div class="flow-h">The whole process as a flowchart. Click a box to jump to that step.</div>${flowSVG(lvOf)}</div></div>
      <div class="proc-sticky">${strip}
      <label class="only-aff"><input type="checkbox" id="onlyAff"${S.onlyAffected ? ' checked' : ''}> Show only the steps this variant touches</label>
      <label class="only-aff"><input type="checkbox" id="expandAll"${S.expandAll ? ' checked' : ''}> Open every "How is this calculated?"</label></div>
      <div class="steps">${cards}</div>`;
    procCharts.forEach(c => c.dispose()); procCharts = []; mcChart = null; mcRO = null;
    procEl.querySelectorAll('.sviz').forEach(el => { const fn = PVIZ[el.dataset.step]; if (!fn) return;
      try { procCharts.push(...(fn(el, ctx) || [])); } catch (err) { console.error(err); el.innerHTML = `<p class="pv-note">This picture could not be drawn: ${esc(err.message)}</p>`; } });
    const sv = id => procEl.querySelector(`.sviz[data-step="${id}"]`);
    const feats = d.names.slice(1), numeric = feats.filter(nm => !['group', 'A', 'B', 'C'].includes(nm)), kNum = numeric.length, cat = feats.length > kNum;
    const dimNote = kNum <= 1 ? '' : kNum === 2 && !cat ? `With 2 features the fitted model is a <b>plane</b> in 3 dimensions (x₁, x₂, y), drawn below and rotatable. The flat chart is a slice: y against ${d.names[1]} with ${d.names[2]} held at its mean.`
      : `With ${kNum} features${cat ? ' plus categorical columns' : ''} the fitted model is a hyperplane in ${feats.length + 1} dimensions, so it <b>cannot be drawn</b> (a picture is possible only up to 3 dimensions: two features and y). The flat chart is a slice: y against ${d.names[1]}, with every other feature held at its mean. The residual charts of step 10 work in any number of dimensions, because residuals are one number per row.`;
    try { const el = sv('9a'); if (el) { const r = document.createElement('div'); r.className = 'pv-row one'; el.prepend(r);
      procCharts.push(mount(r, kNum > 1 ? `A slice: y against ${d.names[1]}, other features at their means` : 'The training data and the line these weights give (compare with the baseline and the truth)', 300, c => drawFit(c, isBase)));
      if (dimNote) { const p = document.createElement('p'); p.className = 'pv-note'; p.innerHTML = dimNote; r.after(p); }
      if (kNum === 2 && !cat) { const r3 = document.createElement('div'); r3.className = 'pv-row one'; (el.querySelector('.pv-note') || r).after(r3); const tv = cur.tv, tc = d.truth.coef;
        procCharts.push(P3D.mount(r3, { title: 'The training data and the fitted plane in 3D (drag to rotate)', height: 340, x1: tv.d.X.map(rw => rw[1]), x2: tv.d.X.map(rw => rw[2]), y: tv.d.y, fit: tv.f.w.slice(0, 3), truth: [0, 1, 2].every(q => tc[q] != null) ? [tc[0], tc[1], tc[2]] : null, names: [d.names[1], d.names[2]] })); } } } catch (err) { console.error(err); }
    try { const el = sv(1); if (el && kNum > 1) { const p = document.createElement('p'); p.className = 'pv-note'; p.innerHTML = `This dataset has ${kNum} features${cat ? ' and categorical columns' : ''}: ${feats.join(', ')}. The scatter shows y against ${d.names[1]} only; the other features also move y, which is part of the vertical spread you see.${kNum > 2 ? ' A single picture of all of them is not possible beyond 3 dimensions.' : ''}`; el.appendChild(p); } } catch (err) { console.error(err); }
    procEl.querySelectorAll('.sub-viz').forEach(el => { (DIAG[el.dataset.viz] || []).forEach(([mode, title]) => { try { procCharts.push(mount(el, title, 230, c => drawDiag(c, mode))); } catch (err) { console.error(err); } }); });
    try { const el = sv(11); if (el) { const r = document.createElement('div'); r.className = 'pv-row one'; el.appendChild(r);
      mcChart = mount(r, 'Is the standard error honest? The slope across 200 fresh datasets', 260, () => drawMC()); procCharts.push(mcChart);
      mcRO = document.createElement('div'); mcRO.className = 'chart-ro'; mcChart.wrap.appendChild(mcRO); drawMC(); } } catch (err) { console.error(err); }
    renderSymbols();
    MATH.typeset(procEl); MATH.typeset(symEl); MATH.typeset(basicsEl);
  }
  function renderSymbols(){
    basicsEl.innerHTML = `<h2 id="basics-h">Basics: every idea the explanations use</h2><p class="hint-s">Each one is explained from scratch, with a tiny example. Words linked in the explanations jump here.</p><dl class="gloss">` +
      Object.entries(GLOSSARY).map(([k, [t, d]]) => `<div id="g-${k}"><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('') + `</dl>`;
    symEl.innerHTML = `<h2 id="sym-h">Symbol index</h2>
      <h3>Influence and check marks</h3><div class="tbl"><table><tr><th>Symbol</th><th>Meaning</th></tr>` +
      Object.values(LEVELS).map(L => `<tr><td class="${L.cls}"><b class="glyph-l">${L.glyph}</b></td><td>${L.label}: ${{ 'Originates here': 'the selected variant enters the process at this step', 'Major influence': 'its consequence shows up, or has to be handled, at this step', 'Minor influence': 'it matters a little here', 'Unaffected': 'this step works exactly as usual; often the interview point' }[L.label]}</td></tr>`).join('') +
      Object.entries(MARKS).map(([k, m]) => `<tr><td><span class="mk mk-${k}">${m[0]}</span></td><td>${m[1]} (live, for the current data)</td></tr>`).join('') +
      `</table></div><h3>Mathematical symbols</h3><div class="tbl"><table><tr><th>Symbol</th><th>Meaning</th><th>Shape</th><th>Used in steps</th></tr>` +
      Object.entries(SYM).map(([k, s]) => `<tr><td class="sym-cell">${s[0]}</td><td>${esc(s[1])}</td><td>${s[2]}</td><td>${(usedSyms[k] ? [...usedSyms[k]] : []).map(id => `<a href="#step-${id}">${id}</a>`).join(', ') || 'charts and matrices'}</td></tr>`).join('') +
      `</table></div><p class="hint-s">Hover any symbol in the process to see its meaning.</p>`;
  }

  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => update());
  update();
})();
