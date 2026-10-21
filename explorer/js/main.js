/* ============================================================
   Explorer page: state, controls, charts, numbers and matrices.
   ============================================================ */
(() => {
  const ATTRS = CATALOG.flatMap(b => b.attrs), attrById = id => ATTRS.find(a => a.id === id);
  const branchOf = a => CATALOG.find(b => b.id === a.branch);
  const S = { attr: 'linearity', variant: 'linear', view: 'linearity', N: 60, sigma: 2, strength: 1, seed: 1, cmp: true, res: false, diag: null, lr: 0.5, iters: 300, onlyAffected: false, expandAll: false };

  // ---- read the URL hash ----
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.get('a') && attrById(hp.get('a'))?.live) { S.attr = S.view = hp.get('a'); const v = hp.get('v'); S.variant = attrById(S.attr).variants.some(x => x.id === v) ? v : attrById(S.attr).variants[0].id; }
  [['N', 'N'], ['s', 'sigma'], ['k', 'strength'], ['seed', 'seed'], ['lr', 'lr'], ['it', 'iters']].forEach(([k, f]) => { const v = parseFloat(hp.get(k)); if (isFinite(v)) S[f] = v; });
  if (hp.get('cmp') === '0') S.cmp = false;
  const writeHash = () => history.replaceState(null, '', '#' + new URLSearchParams({ a: S.attr, v: S.variant, N: S.N, s: S.sigma, k: S.strength, seed: S.seed, lr: S.lr, it: S.iters, cmp: S.cmp ? 1 : 0 }).toString());

  // ---- layout ----
  const web = new ConceptWeb($('#web'), sel => select(sel));
  const panel = $('#panel'), charts = $('#charts');
  const cData = new Chart(charts, { title: 'Data and fitted model', height: 320 });
  const cDiag = new Chart(charts, { title: 'Diagnostic view', height: 320 });
  const cLoss = new Chart(charts, { title: 'Loss curve: gradient descent', height: 280 });
  const cMC = new Chart(charts, { title: 'Sampling distribution over 200 fresh datasets', height: 280 });
  const lossCtl = document.createElement('div'); lossCtl.className = 'controls tight'; cLoss.wrap.appendChild(lossCtl);
  const sLR = slider(lossCtl, { label: 'Step size η (fraction of the stability limit 2/λ_max)', min: 0.02, max: 1.2, step: 0.01, value: S.lr, onInput: v => { S.lr = v; update(); } });
  const sIt = slider(lossCtl, { label: 'Iterations', min: 10, max: 3000, step: 10, value: S.iters, digits: 0, onInput: v => { S.iters = v; update(); } });
  const lossRO = document.createElement('div'); lossRO.className = 'chart-ro'; cLoss.wrap.appendChild(lossRO);
  const mcRO = document.createElement('div'); mcRO.className = 'chart-ro'; cMC.wrap.appendChild(mcRO);

  // ---- side panel ----
  panel.innerHTML = `<div class="crumb" id="crumb"></div><h2 id="vtitle"></h2><p class="vdesc" id="vdesc"></p>
    <div class="chips" id="chips" role="group" aria-label="Variants"></div><div id="planned"></div>
    <div class="ex-sliders" id="sliders"></div>
    <div class="ex-checks"><label><input type="checkbox" id="cmp"> Compare with the baseline</label><label><input type="checkbox" id="res"> Show residuals</label></div>
    <div class="btns"><button type="button" class="btn" id="resample">New sample</button><span class="seed" id="seedlbl"></span><button type="button" class="btn ghost" id="copylink">Copy link to this view</button></div>
    <a class="to-proc" href="#changed">What changed ↓</a> <a class="to-proc" href="#lookfor">What it looks like ↓</a> <a class="to-proc" href="#process">The process ↓</a> <a class="to-proc" href="#notes">Interview notes ↓</a>`;
  const sl = $('#sliders');
  const sN = slider(sl, { label: 'Sample size N', min: 8, max: 300, step: 1, value: S.N, digits: 0, onInput: v => { S.N = v; update(); } });
  const sS = slider(sl, { label: 'Noise σ', min: 0, max: 5, step: 0.05, value: S.sigma, onInput: v => { S.sigma = v; update(); } });
  const sK = slider(sl, { label: 'Strength', min: 0, max: 1, step: 0.01, value: S.strength, onInput: v => { S.strength = v; update(); } });
  $('#cmp').checked = S.cmp; $('#cmp').onchange = e => { S.cmp = e.target.checked; update(); };
  $('#res').checked = S.res; $('#res').onchange = e => { S.res = e.target.checked; update(); };
  $('#resample').onclick = () => { S.seed += 1; update(); };
  $('#copylink').onclick = e => { navigator.clipboard?.writeText(location.href).then(() => { e.target.textContent = 'Link copied'; setTimeout(() => e.target.textContent = 'Copy link to this view', 1500); }).catch(() => {}); };
  $('#chips').onclick = e => { const b = e.target.closest('button'); if (b) select({ attr: S.view, variant: b.dataset.id }); };

  function select({ attr, variant }){
    const a = attrById(attr);
    S.view = attr;
    if (a.live) {
      if (attr !== S.attr) { S.attr = attr; S.diag = null; S.variant = a.variants[0].id; }
      if (variant) S.variant = variant;
    }
    update();
  }

  // ---- computation ----
  const mcCache = new Map(); let mcTimer = null, R = 200;
  function model(variant, strength){
    const d = GEN.generate(variant, { N: S.N, sigma: S.sigma, strength, seed: S.seed });
    const f = ST.ols(d.X, d.y), dg = ST.diagnostics(d.X, d.y, f);
    const lim = 2 / ST.hessMax(d.X), g = ST.gd(d.X, d.y, S.lr * lim, S.iters);
    return { d, f, dg, lim, g };
  }
  function mcFor(variant, strength, focus, truth){
    const key = [variant, strength, S.N, S.sigma].join('|');
    if (!mcCache.has(key)) {
      mcCache.set(key, ST.monteCarlo(r => GEN.generate(variant, { N: S.N, sigma: S.sigma, strength, seed: 5000 + r }), R, focus, truth));
      if (mcCache.size > 40) mcCache.delete(mcCache.keys().next().value);
    }
    return mcCache.get(key);
  }

  let cur = null, base = null, mcCur = null, mcBase = null;
  function update(){
    const a = attrById(S.attr), v = a.variants.find(x => x.id === S.variant), baseId = a.variants[0].id, isBase = v.id === baseId;
    cur = model(v.id, S.strength); base = isBase ? cur : model(baseId, 0);
    const k1 = [v.id, S.strength, S.N, S.sigma].join('|'), k0 = [baseId, 0, S.N, S.sigma].join('|');
    mcCur = mcCache.get(k1) || null; mcBase = mcCache.get(k0) || null;
    renderPanel(a, v, isBase); renderAll(); renderChanged(a, v, isBase); renderSig(a, v, isBase); renderProcess(a, v, isBase);
    clearTimeout(mcTimer);
    if (!mcCur || (S.cmp && !mcBase)) {
      mcRO.innerHTML = '<span class="muted">Running 200 fresh datasets…</span>';
      mcTimer = setTimeout(() => {
        mcCur = mcFor(v.id, S.strength, cur.d.focus, cur.d.truth.coef);
        mcBase = isBase ? mcCur : mcFor(baseId, 0, base.d.focus, base.d.truth.coef);
        drawMC(); renderNumbers();
      }, 220);
    }
    writeHash();
  }

  // ---- panel ----
  function renderPanel(a, v, isBase){
    const viewA = attrById(S.view), vb = branchOf(viewA);
    web.set({ branch: vb.id, attr: viewA.id, variant: viewA.live ? S.variant : null });
    $('#crumb').textContent = `${vb.name} › ${viewA.name}`;
    if (!viewA.live) {
      $('#vtitle').textContent = viewA.name;
      $('#vdesc').textContent = `Planned for a later step. The simulation below still shows ${a.name} › ${v.name}.`;
      $('#chips').innerHTML = viewA.variants.map((x, i) => `<button type="button" disabled>${esc(x.name)}${i === 0 ? ' · baseline' : ''}</button>`).join('');
      return;
    }
    $('#vtitle').textContent = v.name + (isBase ? ' (baseline)' : '');
    $('#vdesc').textContent = v.desc + (cur.d.note ? ' ' + cur.d.note.replace(/\.$/, '') + '.' : '');
    $('#chips').innerHTML = a.variants.map((x, i) => `<button type="button" data-id="${x.id}" aria-pressed="${x.id === v.id}">${esc(x.name)}${i === 0 ? ' · baseline' : ''}</button>`).join('');
    sK.el.style.display = v.strength ? '' : 'none';
    sK.el.querySelector('label').firstChild.textContent = 'Strength: ' + (v.strength || '');
    sN.set(S.N); sS.set(S.sigma); sK.set(S.strength); sLR.set(S.lr); sIt.set(S.iters);
    $('#cmp').checked = S.cmp; $('#seedlbl').textContent = 'sample #' + S.seed;
  }

  // ---- colours ----
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

  // ---- charts ----
  function drawData(){
    const { d, f } = cur, P = cData, xs = d.px, groups = d.group ? d.groupNames.length : 0;
    const lo = Math.min(...xs), hi = Math.max(...xs), gx = grid(lo, hi);
    const lineGroups = (d.names.includes('group') || d.names.includes('A')) ? [...Array(groups).keys()] : [null];
    const fitLines = lineGroups.map(g => gx.map(x => [x, LA.dot(rowAt(d, x, g ?? 0), f.w)]));
    const trueLines = d.truth.byGroup ? d.truth.byGroup.map(fn => gx.map(x => [x, fn(x)])) : d.truth.fn && d.X[0].length === 2 ? [gx.map(x => [x, d.truth.fn(x, 0)])] : [];
    let baseLine = null;
    if (S.cmp && base !== cur) { const bx = base.d.px, bl = Math.min(...bx), bh = Math.max(...bx); baseLine = grid(bl, bh).map(x => [x, LA.dot(rowAt(base.d, x, 0), base.f.w)]); }
    const ys = [...d.y, ...fitLines.flat().map(p => p[1])];
    P.begin([lo, hi], [Math.min(...ys), Math.max(...ys)], d.xName, 'y');
    if (S.res) xs.forEach((x, i) => P.line([[x, d.y[i]], [x, f.yhat[i]]], css('--residual'), 1, null, 0.7));
    xs.forEach((x, i) => P.dot([x, d.y[i]], ptColor(d, i), 3.4, false, 0.85));
    if (d.X[0].length > 2 && !d.group) xs.forEach((x, i) => P.dot([x, f.yhat[i]], css('--surface'), 3, true, 0.6));
    trueLines.forEach(l => P.line(l, css('--ink'), 1.6, [6, 5], 0.8));
    if (baseLine) P.line(baseLine, css('--muted'), 2, [3, 4]);
    fitLines.forEach((l, k) => P.line(l, lineGroups[k] == null ? css('--surface') : groupColor(lineGroups[k], groups), 2.6));
    P.end();
    const leg = [[css('--surface'), d.X[0].length > 2 && !d.group ? 'fit at the mean of the other features' : 'fitted line']];
    if (trueLines.length) leg.push([css('--ink'), 'true mean E[y | x]', true]);
    if (baseLine) leg.push([css('--muted'), 'baseline fit', true]);
    if (d.group) d.groupNames.slice(0, 4).forEach((n, k) => leg.push([groupColor(k, groups), n]));
    if (d.X[0].length > 2 && !d.group) leg.push([css('--surface'), 'fitted values ŷ (hollow)']);
    P.legend(leg);
  }

  function diagTabs(){
    const t = [['fitted', 'Residuals vs fitted'], ['order', 'Residuals in order'], ['qq', 'Q–Q'], ['hist', 'Histogram'], ['leverage', 'Leverage']];
    if (cur.d.x2) t.push(['x1x2', 'x₁ vs x₂']);
    return t;
  }
  function drawDiag(){
    const { d, f } = cur, P = cDiag, a = attrById(S.attr);
    const tabs = diagTabs(); let mode = S.diag || a.diag; if (!tabs.some(t => t[0] === mode)) mode = 'fitted';
    P.tabs(tabs, mode, id => { S.diag = id; drawDiag(); });
    const e = f.e, s = Math.sqrt(f.SSE / Math.max(1, f.df)) || 1, z = e.map(v => v / s), N = e.length, col = i => ptColor(d, i);
    const msg = t => { P.begin([0, 1], [0, 1], '', ''); P.text(t, [0.03, 0.5], css('--muted'), 0, 0, true); P.end(); };
    if (mode === 'fitted') {
      P.begin([Math.min(...f.yhat), Math.max(...f.yhat)], [Math.min(...e), Math.max(...e)], 'fitted ŷ', 'residual e');
      P.hline(0, css('--ink'), [4, 4]);
      f.yhat.forEach((v, i) => P.dot([v, e[i]], col(i), 3.4, false, 0.85));
      const idx = [...f.yhat.keys()].sort((i, j) => f.yhat[i] - f.yhat[j]), B = Math.max(4, Math.min(12, Math.floor(N / 6)));
      const pts = []; for (let b = 0; b < B; b++) { const sl = idx.slice(Math.floor(b * N / B), Math.floor((b + 1) * N / B)); if (sl.length) pts.push([ST.mean(sl.map(i => f.yhat[i])), ST.mean(sl.map(i => e[i]))]); }
      P.line(pts, css('--normal'), 2.4);
      P.end(); P.legend([[css('--normal'), 'average residual in bins: should hug zero'], [css('--ink'), 'zero', true]]);
    } else if (mode === 'order') {
      P.begin([1, N], [Math.min(...e), Math.max(...e)], 'row (time) order', 'residual e');
      P.hline(0, css('--ink'), [4, 4]); P.line(e.map((v, i) => [i + 1, v]), css('--muted'), 1.2);
      e.forEach((v, i) => P.dot([i + 1, v], col(i), 3, false, 0.9)); P.end();
      P.legend([[css('--muted'), 'consecutive residuals joined: long runs mean positive autocorrelation, zig-zag means negative']]);
    } else if (mode === 'qq') {
      const sz = [...z].sort((x, y) => x - y), q = sz.map((_, i) => invNorm((i + 0.5) / N)), m = Math.max(...q.map(Math.abs), ...sz.map(Math.abs));
      P.begin([-m, m], [-m, m], 'theoretical normal quantile', 'standardised residual');
      P.line([[-m, -m], [m, m]], css('--ink'), 1.4, [5, 4]); sz.forEach((v, i) => P.dot([q[i], v], css('--floor'), 3.2, false, 0.85)); P.end();
      P.legend([[css('--ink'), 'normal errors fall on this line', true], [css('--floor'), 'S-shape: tails too heavy or light; bow: skew']]);
    } else if (mode === 'hist') {
      const B = Math.max(8, Math.min(24, Math.round(Math.sqrt(N) * 1.6))), lo = Math.min(-3.5, ...z), hi = Math.max(3.5, ...z), w = (hi - lo) / B, cnt = new Array(B).fill(0);
      z.forEach(v => cnt[Math.min(B - 1, Math.floor((v - lo) / w))]++);
      const dens = cnt.map(c => c / (N * w)), top = Math.max(...dens, 0.42);
      P.begin([lo, hi], [0, top], 'standardised residual', 'density');
      dens.forEach((h, i) => P.rect(lo + i * w + w * 0.05, 0, lo + (i + 1) * w - w * 0.05, h, css('--residual'), 0.6));
      P.line(grid(lo, hi, 120).map(x => [x, Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)]), css('--ink'), 1.6, [5, 4]); P.end();
      P.legend([[css('--residual'), 'residuals'], [css('--ink'), 'standard normal', true]]);
    } else if (mode === 'leverage') {
      if (!f.lev) { msg('XᵀX is singular, so leverage is not defined.'); P.legend([]); return; }
      const st = e.map((v, i) => v / Math.sqrt(f.s2 * Math.max(1e-12, 1 - f.lev[i]))), thr = 4 / N;
      P.begin([0, Math.max(...f.lev)], [Math.min(...st, -3), Math.max(...st, 3)], 'leverage hᵢᵢ', 'studentised residual');
      P.hline(0, css('--ink'), [4, 4]); [-2, 2].forEach(v => P.hline(v, css('--muted'), [2, 4]));
      f.lev.forEach((h, i) => P.dot([h, st[i]], f.cook[i] > thr ? css('--normal') : col(i), f.cook[i] > thr ? 4.5 : 3.2, false, 0.9)); P.end();
      P.legend([[css('--normal'), `Cook's distance above 4/N = ${num(thr, 3)}`], [css('--muted'), '±2', true]]);
    } else if (mode === 'x1x2') {
      const r = corrOf(d.px, d.x2);
      P.begin([Math.min(...d.px), Math.max(...d.px)], [Math.min(...d.x2), Math.max(...d.x2)], 'x₁', 'x₂');
      d.px.forEach((x, i) => P.dot([x, d.x2[i]], col(i), 3.4, false, 0.85)); P.end();
      P.legend([[css('--floor'), `correlation r = ${num(r, 3)}`]]);
    }
  }
  const corrOf = (a, b) => { const ma = ST.mean(a), mb = ST.mean(b); let sab = 0, saa = 0, sbb = 0; a.forEach((v, i) => { sab += (v - ma) * (b[i] - mb); saa += (v - ma) ** 2; sbb += (b[i] - mb) ** 2; }); return sab / Math.sqrt(saa * sbb); };

  function drawLoss(){
    const P = cLoss, L = cur.g.loss, Lb = S.cmp && base !== cur ? base.g.loss : null, Lmin = cur.f.SSE / cur.f.N, Lbm = base.f.SSE / base.f.N;
    const all = [...L, ...(Lb || []), Lmin].filter(v => isFinite(v) && v > 0), cap = Math.min(Math.max(...all), L[0] * 1e4 || 1e6);
    P.begin([0, S.iters], [Math.max(Math.min(...all) * 0.8, 1e-6), cap], 'iteration', 'MSE (log scale)', { logY: true });
    if (Lb) { P.line(Lb.map((v, i) => [i, Math.min(v, cap * 10)]), css('--muted'), 1.6, [3, 4]); P.hline(Lbm, css('--muted'), [2, 5]); }
    P.hline(Lmin, css('--normal'), [6, 4]);
    P.line(L.map((v, i) => [i, Math.min(v, cap * 10)]), css('--surface'), 2.4);
    P.end();
    const leg = [[css('--surface'), 'gradient descent from w = 0'], [css('--normal'), 'OLS minimum (closed form)', true]];
    if (Lb) leg.push([css('--muted'), 'baseline', true]);
    P.legend(leg);
    const last = L[L.length - 1], diverged = !isFinite(last) || last > L[0] * 10;
    lossRO.innerHTML = `<span>η = <b>${num(S.lr * cur.lim, 5)}</b></span><span>limit 2/λ_max = <b>${num(cur.lim, 5)}</b></span>
      <span>κ of the Hessian = <b>${isFinite(cur.f.kappa) ? num(cur.f.kappa, 0) : '∞'}</b></span><span>final MSE = <b>${diverged ? 'diverged' : num(last, 4)}</b> vs OLS <b>${num(Lmin, 4)}</b></span>`;
  }

  function drawMC(){
    const P = cMC;
    if (!mcCur) { P.begin([0, 1], [0, 1], '', ''); P.end(); P.legend([]); return; }
    const c = mcCur, b = S.cmp && mcBase !== mcCur ? mcBase : null, names = cur.d.names;
    if (c.length > 1) {
      const [m1, m2] = c, pts = m1.est.map((v, i) => [v, m2.est[i]]), bp = b ? b[0].est.map((v, i) => [v, b[1].est[i]]) : [];
      const xs = [...pts, ...bp].map(p => p[0]), ys = [...pts, ...bp].map(p => p[1]);
      if (m1.truth != null) xs.push(m1.truth); if (m2.truth != null) ys.push(m2.truth);
      P.begin([Math.min(...xs), Math.max(...xs)], [Math.min(...ys), Math.max(...ys)], `estimated coefficient of ${names[m1.j]}`, `estimated coefficient of ${names[m2.j]}`);
      bp.forEach(p => P.dot(p, css('--muted'), 2.6, true, 0.6));
      pts.forEach(p => P.dot(p, css('--surface'), 2.8, false, 0.55));
      if (m1.truth != null && m2.truth != null) { P.dot([m1.truth, m2.truth], css('--normal'), 6, true); P.text('true values', [m1.truth, m2.truth], css('--normal'), 8, -8, true); }
      P.end();
      P.legend([[css('--surface'), 'one dot per dataset'], ...(b ? [[css('--muted'), 'baseline (hollow)']] : []), [css('--normal'), 'truth']]);
    } else {
      const m = c[0], bm = b ? b[0] : null, all = [...m.est, ...(bm ? bm.est : [])];
      if (m.truth != null) all.push(m.truth);
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
      P.vrule(cur.f.w[m.j], css('--floor'), [3, 3], 1.8);
      P.end();
      P.legend([[css('--surface'), 'actual spread of the estimate'], [css('--ink'), 'spread OLS claims (± reported SE)', true], [css('--normal'), 'true value'], [css('--floor'), 'this sample', true], ...(hb ? [[css('--muted'), 'baseline (outline)']] : [])]);
    }
    const m = c[0];
    mcRO.innerHTML = c.map(m => `<span>${esc(names[m.j])}: mean <b>${num(m.mean, 3)}</b>${!m.identifiable ? ' (<b>not identifiable</b>)' : m.truth != null ? ` (bias <b>${num(m.mean - m.truth, 3)}</b>)` : ''}, actual SD <b>${num(m.sd, 3)}</b>, average reported SE <b>${isFinite(m.meanSE) ? num(m.meanSE, 3) : 'n/a'}</b>${isFinite(m.coverage) ? `, 95% CI covers the truth <b>${num(100 * m.coverage, 0)}%</b>` : ''}</span>`).join('') +
      (m.singular ? `<span class="msg">XᵀX was singular in ${m.singular} of ${R} datasets. ${m.identifiable ? '' : 'The data cannot tell these coefficients apart: infinitely many combinations give identical predictions, so the solver returns the minimum-norm one and "bias" has no meaning. Only their combined effect is estimable.'}</span>` : '');
  }

  // ---- key numbers ----
  function renderNumbers(){
    const j = cur.d.focus[0], jb = base.d.focus[0], mc = mcCur?.[0], mb = mcBase?.[0];
    const p = v => isFinite(v) ? (v < 0.001 ? '< 0.001' : num(v, 3)) : '—';
    const rows = [
      ['Slope estimate ± SE', o => `${num(o.f.w[o.d.focus[0]], 3)} ± ${isFinite(o.f.se[o.d.focus[0]]) ? num(o.f.se[o.d.focus[0]], 3) : 'n/a'}`],
      ['p-value of the slope', o => p(o.f.pv[o.d.focus[0]]), o => o.f.pv[o.d.focus[0]] >= 0.05],
      ['95% CI of the slope', o => isFinite(o.f.se[o.d.focus[0]]) ? `[${num(o.f.ci[o.d.focus[0]][0], 2)}, ${num(o.f.ci[o.d.focus[0]][1], 2)}]` : 'n/a'],
      ['R² / adjusted R²', o => `${num(o.f.R2, 3)} / ${num(o.f.adjR2, 3)}`],
      ['RMSE', o => num(o.f.rmse, 3)],
      ['Ramsey RESET p (linearity)', o => p(o.dg.reset?.p), o => o.dg.reset?.p < 0.05],
      ['Breusch–Pagan p (constant variance)', o => p(o.dg.bp?.p), o => o.dg.bp?.p < 0.05],
      ['Durbin–Watson (≈ 2 if independent)', o => num(o.dg.dw, 2), o => o.dg.dw < 1.5 || o.dg.dw > 2.5],
      ['Jarque–Bera p (normality)', o => p(o.dg.jb.p), o => o.dg.jb.p < 0.05],
      ['Largest VIF', o => o.dg.vif.length ? (isFinite(Math.max(...o.dg.vif)) ? num(Math.max(...o.dg.vif), 1) : '∞') : '—', o => Math.max(...o.dg.vif) > 10],
      ['Condition number of XᵀX', o => isFinite(o.f.kappa) ? num(o.f.kappa, 0) : '∞'],
      ['rank(X) / columns', o => `${o.f.rank} / ${o.f.p}`, o => o.f.rank < o.f.p],
      ["Largest Cook's distance", o => o.f.cook ? num(Math.max(...o.f.cook), 3) : 'n/a', o => o.f.cook && Math.max(...o.f.cook) > 1]
    ];
    const mcRows = [
      ['Average estimate over 200 datasets', m => m ? num(m.mean, 3) + (!m.identifiable ? ' (not identifiable)' : m.truth != null ? ` (truth ${num(m.truth, 2)})` : '') : '…', m => m && (!m.identifiable || (m.truth != null && Math.abs(m.mean - m.truth) > 2 * m.sd / Math.sqrt(R) + 0.02))],
      ['Actual SD of the estimate', m => m ? num(m.sd, 3) : '…'],
      ['Average reported SE', m => m ? (isFinite(m.meanSE) ? num(m.meanSE, 3) : 'n/a') : '…', m => m && isFinite(m.meanSE) && (m.meanSE / m.sd < 0.8 || m.meanSE / m.sd > 1.25)],
      ['95% CI actually covers the truth', m => m ? (isFinite(m.coverage) ? num(100 * m.coverage, 0) + '%' : 'n/a') : '…', m => m && isFinite(m.coverage) && (m.coverage < 0.9 || m.coverage > 0.99)]
    ];
    const cell = (txt, bad) => `<td class="num${bad ? ' flag' : ''}">${txt}</td>`, showBase = S.cmp && base !== cur;
    $('#numbers').innerHTML = `<h3>Key numbers</h3><div class="tbl"><table><tr><th>Quantity</th>${showBase ? '<th class="num">Baseline</th>' : ''}<th class="num">This variant</th></tr>` +
      rows.map(([n, fn, bad]) => `<tr><td>${n}</td>${showBase ? cell(fn(base), bad && bad(base)) : ''}${cell(fn(cur), bad && bad(cur))}</tr>`).join('') +
      `<tr class="sub"><td colspan="3">Repeated sampling: the truth about the estimator</td></tr>` +
      mcRows.map(([n, fn, bad]) => `<tr><td>${n}</td>${showBase ? cell(fn(mb), bad && bad(mb)) : ''}${cell(fn(mc), bad && bad(mc))}</tr>`).join('') +
      `</table></div><p class="hint-s">Highlighted cells are where a test rejects at 5% or the estimator misbehaves. The repeated-sampling rows use the true model, which you never have in practice; that is how you can see bias and wrong standard errors that no single dataset reveals.</p>`;
  }

  // ---- matrices ----
  function renderMatrices(){
    const { d, f } = cur, N = d.N, show = 6;
    const head = arr => N <= show + 1 ? arr : [...arr.slice(0, show), arr[0].map ? arr[0].map(() => '⋮') : '⋮', arr[N - 1]];
    const rl = N <= show + 1 ? [...Array(N).keys()].map(i => String(i + 1)) : [...[...Array(show).keys()].map(i => String(i + 1)), '', String(N)];
    const truth = d.names.map((_, j) => d.truth.coef[j] ?? '—');
    $('#matrices').innerHTML = `<h3>The matrices behind this fit (live)</h3><div class="mx-grid">` +
      mx(head(d.X), { name: 'X', shape: `${N}×${d.names.length}`, formula: 'design matrix', colLabels: d.names, rowLabels: rl, tone: 'floor', digits: 2 }) +
      mx(head(d.y), { name: 'y', shape: `${N}×1`, formula: 'targets', tone: 'res', digits: 2 }) +
      mx(f.w, { name: 'ŵ', formula: f.full ? '(XᵀX)⁻¹Xᵀy' : 'minimum-norm solution', rowLabels: d.names.map(n => n === '1' ? 'b' : n), tone: 'surface' }) +
      mx(truth, { name: 'β (true)', formula: 'used to generate the data', rowLabels: d.names.map(n => n === '1' ? 'b' : n) }) +
      mx(head(f.yhat), { name: 'ŷ = Xŵ', shape: `${N}×1`, formula: 'predictions', tone: 'surface', digits: 2 }) +
      mx(head(f.e), { name: 'e = y − ŷ', shape: `${N}×1`, formula: 'residuals', tone: 'res', digits: 2 }) +
      mx(f.XtX, { name: 'XᵀX', formula: 'column-by-column dot products', colLabels: d.names, rowLabels: d.names, digits: 1 }) +
      mx(f.Xty, { name: 'Xᵀy', formula: 'each column · y', rowLabels: d.names, digits: 1 }) +
      (f.inv ? mx(f.inv, { name: '(XᵀX)⁻¹', formula: `× s² = ${num(f.s2, 3)} gives Var(ŵ)`, colLabels: d.names, rowLabels: d.names, digits: 4 })
             : scalarBox('(XᵀX)⁻¹', 'does not exist', `det(XᵀX) = ${num(f.det, 4)}, rank ${f.rank} of ${f.p}`, 'normal')) +
      mx(f.se, { name: 'SE(ŵ)', formula: '√ diagonal of s²(XᵀX)⁻¹', rowLabels: d.names.map(n => n === '1' ? 'b' : n), digits: 4 }) +
      scalarBox('eᵀe / N', num(f.SSE / N, 4), 'mean squared error', 'normal') +
      `</div>`;
  }

  // ---- what changed ----
  const chgEl = $('#changed'); let chgCharts = [];
  function renderChanged(a, v, isBase){
    chgCharts.forEach(c => c.dispose()); chgCharts = [];
    try { chgCharts = CHG.render(chgEl, { cur, base, a, v, isBase, S, inf: influence(a.id, v, isBase, S.strength) }); } catch (err) { console.error(err); chgEl.innerHTML = `<p class="pv-note">Could not draw this view: ${esc(err.message)}</p>`; }
  }
  document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (!g) return; e.preventDefault();
    if (g.dataset.diag) { S.diag = g.dataset.diag; drawDiag(); }
    const t = document.getElementById(g.dataset.goto); if (!t) return; t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const hl = g.dataset.diag ? cDiag.wrap : t; hl.classList.remove('flash'); void hl.offsetWidth; hl.classList.add('flash'); setTimeout(() => hl.classList.remove('flash'), 2200); });

  // ---- what to look for ----
  const sigEl = $('#lookfor'), notesEl = $('#notes'); let sigCharts = [];
  function renderSig(a, v, isBase){
    sigCharts.forEach(c => c.dispose()); sigCharts = [];
    try { sigCharts = SIG.render(sigEl, { cur, base, a, v, isBase, S }); } catch (err) { console.error(err); sigEl.innerHTML = `<p class="pv-note">Could not draw this view: ${esc(err.message)}</p>`; }
  }

  // ---- process ----
  const procEl = $('#process'), symEl = $('#symbols'), basicsEl = $('#basics');
  let usedSyms = {}, procCharts = [];
  const openHow = new Set();
  procEl.addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('details.how')) { d.open ? openHow.add(d.dataset.key) : openHow.delete(d.dataset.key); } }, true);
  procEl.addEventListener('click', e => {
    const c = e.target.closest('[data-attr]'); if (c) { select({ attr: c.dataset.attr, variant: c.dataset.variant || undefined }); return; }
    const j = e.target.closest('[data-jump]'); if (j) { e.preventDefault(); document.getElementById('step-' + j.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  procEl.addEventListener('change', e => { if (e.target.id === 'onlyAff') { S.onlyAffected = e.target.checked; update(); } if (e.target.id === 'expandAll') { S.expandAll = e.target.checked; if (!S.expandAll) openHow.clear(); update(); } });
  function renderProcess(a, v, isBase){
    const P = PIPE.run(cur.d, { seed: S.seed }), inf = influence(a.id, v, isBase, S.strength);
    const ctx = { P, d: cur.d, S, attr: a, variant: v, isBase, focus: cur.d.focus[0] };
    const lvOf = id => inf[id] ? inf[id][0] : 'none';
    try { NOTES.render(notesEl, { P, d: cur.d, a, v, isBase, inf, S, cur }); } catch (err) { console.error(err); }
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
        const sel = at.id === a.id, base = `<button type="button" class="pa${at.live ? ' live' : ''}${sel ? ' sel' : ''}" data-attr="${at.id}"${at.live ? '' : ' title="Planned for a later step"'}>${esc(at.name)}</button>`;
        if (!sel) return base;
        return base + `<span class="pv-list">` + at.variants.map((x, i) => `<button type="button" class="pv${x.id === v.id ? ' sel' : ''}" data-attr="${at.id}" data-variant="${x.id}">${esc(x.name)}${i === 0 ? ' · baseline' : ''}</button>`).join('') + `</span>`;
      }).join('');
      const subs = st.subs.map(([sym, label, val], i) => {
        const xf = EXPLAIN[st.id]?.[i], key = st.id + '-' + i;
        let how = '';
        if (xf) { try { const x = xf(ctx);
          how = `<details class="how" data-key="${key}"${S.expandAll || openHow.has(key) ? ' open' : ''}><summary>How is this calculated?</summary>
            <div class="how-body"><div class="hw"><span class="hw-h">In plain words</span><p>${x.plain}</p></div>
            ${x.hyp ? `<div class="hw"><span class="hw-h">Hypotheses</span><p>${x.hyp}</p></div>` : ''}
            <div class="hw"><span class="hw-h">Formula</span><p class="hw-f">${x.formula}</p></div>
            <div class="hw"><span class="hw-h">Worked on this data</span><div>${x.calc}</div></div>
            <div class="hw"><span class="hw-h">How to read it</span><p>${x.read}</p></div>
            ${x.pit ? `<div class="hw"><span class="hw-h">Assumes and misses</span><p>${x.pit}</p></div>` : ''}
            ${x.qa ? `<div class="hw"><span class="hw-h">Interview questions</span><div class="qa">${x.qa.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></div>` : ''}</div></details>`; } catch (err) { console.error(err); } }
        return `<div class="sub"><div class="sub-sym">${sym}</div><div class="sub-lbl">${typeof label === 'function' ? label(ctx) : label}</div><div class="sub-val">${(() => { try { return val(ctx); } catch (err) { return '—'; } })()}</div>${how}</div>`;
      }).join('');
      const html = subs + (inf[st.id] ? inf[st.id][1] : '');
      const byDisp = Object.fromEntries(Object.entries(SYM).map(([k, v]) => [v[0], k]));
      for (const m of html.matchAll(/<abbr class="sym"[^>]*>([^<]+)<\/abbr>/g)) { const k = byDisp[m[1]]; if (k) (usedSyms[k] = usedSyms[k] || new Set()).add(st.id); }
      return `<article class="step ${L.cls}" id="step-${st.id}">
        <header><span class="glyph" title="${L.label}">${L.glyph}</span><span class="sn">${st.id}</span><h3>${esc(st.title)}</h3><span class="lvl">${L.label}</span></header>
        <p class="goal">${esc(st.goal)}</p>
        ${inf[st.id] ? `<p class="why"><b>${isBase ? '' : 'Why: '}</b>${esc(inf[st.id][1])}</p>` : ''}
        <div class="sviz" data-step="${st.id}"></div>
        <div class="subs">${subs}</div>
        <div class="pattrs"><span class="pa-h">Considered at this step:</span>${chips}</div>
      </article>`;
    }).join('');
    procEl.innerHTML = `<div class="proc-head"><h2 id="proc-h">The process, step by step</h2>
      <p>One real run on the current data: an 80/20 split, features standardised with the training mean and SD, a closed-form fit and gradient descent on the training rows, diagnostics, four kinds of standard error, a test score, and coefficients converted back. The charts above use all rows, so their numbers differ slightly.</p>
      <div class="proc-legend">${legend}</div>${summary}
      <div class="flow-wrap"><div class="flow-h">The whole process as a flowchart. Click a box to jump to that step.</div>${flowSVG(lvOf)}</div></div>
      <div class="proc-sticky">${strip}
      <label class="only-aff"><input type="checkbox" id="onlyAff"${S.onlyAffected ? ' checked' : ''}> Show only the steps this variant touches</label>
      <label class="only-aff"><input type="checkbox" id="expandAll"${S.expandAll ? ' checked' : ''}> Open every "How is this calculated?"</label></div>
      <div class="steps">${cards}</div>`;
    procCharts.forEach(c => c.dispose()); procCharts = [];
    procEl.querySelectorAll('.sviz').forEach(el => { const fn = PVIZ[el.dataset.step]; if (!fn) return;
      try { procCharts.push(...(fn(el, ctx) || [])); } catch (err) { console.error(err); el.innerHTML = `<p class="pv-note">This picture could not be drawn: ${esc(err.message)}</p>`; } });
    renderSymbols();
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

  function renderAll(){ drawData(); drawDiag(); drawLoss(); drawMC(); renderNumbers(); renderMatrices(); }
  cData.drawFn = drawData; cDiag.drawFn = drawDiag; cLoss.drawFn = drawLoss; cMC.drawFn = drawMC;
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => update());
  update();
})();
