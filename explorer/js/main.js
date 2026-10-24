/* ============================================================
   Explorer page: state, floating controls, and every chart drawn
   inside the step that uses it. All step numbers and charts come
   from one run (PIPE) on the training rows.
   ============================================================ */
(() => {
  const ATTRS = CATALOG.flatMap(b => b.attrs), attrById = id => ATTRS.find(a => a.id === id);
  const branchOf = a => CATALOG.find(b => b.id === a.branch);
  const S = { attr: 'linearity', variant: 'linear', view: 'linearity', N: 60, sigma: 2, strength: 1, seed: 1, cmp: true, res: false, lr: 0.2, iters: 400, k: 1, fx: null, fy: null, adj: true, ov: {}, onlyAffected: false, expandAll: false };

  // ---- read the URL hash ----
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.get('a') && attrById(hp.get('a'))?.live) { S.attr = S.view = hp.get('a'); const v = hp.get('v'); S.variant = attrById(S.attr).variants.some(x => x.id === v) ? v : attrById(S.attr).variants[0].id; }
  [['N', 'N'], ['s', 'sigma'], ['k', 'strength'], ['seed', 'seed'], ['lr', 'lr'], ['it', 'iters'], ['f', 'k']].forEach(([k, f]) => { const v = parseFloat(hp.get(k)); if (isFinite(v)) S[f] = v; });
  if (hp.get('cmp') === '0') S.cmp = false;
  if (hp.get('fx')) S.fx = hp.get('fx'); if (hp.get('fy')) S.fy = hp.get('fy'); if (hp.get('adj') === '0') S.adj = false;
  const writeHash = () => history.replaceState(null, '', '#' + new URLSearchParams({ a: S.attr, v: S.variant, N: S.N, s: S.sigma, k: S.strength, seed: S.seed, lr: S.lr, it: S.iters, f: S.k, cmp: S.cmp ? 1 : 0, ...(S.fx ? { fx: S.fx } : {}), ...(S.fy ? { fy: S.fy } : {}), ...(S.adj ? {} : { adj: 0 }) }).toString());
  const store = { get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v){ try { localStorage.setItem(k, v); } catch (e) {} } };

  // ---- layout ----
  const web = new ConceptWeb($('#web'), sel => select(sel));
  const panel = $('#panel');
  panel.innerHTML = `<div class="crumb" id="crumb"></div><h2 id="vtitle"></h2><p class="vdesc" id="vdesc"></p>
    <div class="chips" id="chips" role="group" aria-label="Variants"></div><div id="planned"></div>
    <p class="hint-s">Sliders are in the floating <b>Controls</b> box at the bottom right of the screen.</p>
    <a class="to-proc" href="#variant-sec">The variant at a glance ↓</a> <a class="to-proc" href="#changed">What changed and how to see it ↓</a> <a class="to-proc" href="#process">The process ↓</a> <a class="to-proc" href="#notes">Interview notes ↓</a> <a class="to-proc" href="#code">Python code ↓</a>`;
  $('#chips').onclick = e => { const b = e.target.closest('button'); if (b) select({ attr: S.view, variant: b.dataset.id }); };

  // ---- floating controls ----
  const box = document.createElement('aside'); box.className = 'ctlbox'; box.setAttribute('aria-label', 'Controls');
  box.innerHTML = `<div class="ctlbox-h"><b>Controls</b><span class="ctlbox-v" id="fboxV"></span><button type="button" class="ctlbox-x" id="fboxX" aria-expanded="true" title="Collapse or expand">−</button></div>
    <div class="ctlbox-b"><div id="fboxS"></div><div class="ctlbox-r ctlbox-feat" id="fboxF"></div>
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
  FS.init(S, () => update());
  $('#fboxF', box).addEventListener('change', e => { const t = e.target;
    if (t.id === 'gfx') S.fx = t.value; if (t.id === 'gfy') S.fy = t.value; if (t.id === 'gadj') { S.adj = t.checked; Object.values(S.ov).forEach(o => delete o.adj); } update(); });
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
  const kEff = variant => { const mx = GEN.maxCount(variant); return mx ? mx[0] : Math.max(S.k, GEN.baseCount(variant)); };
  /* enough rows for the coefficients and the tests: N_train ≥ p + 6, where p = features + 1 (+ categorical columns) */
  const nMin = variant => Math.max(8, Math.ceil((GEN.pCount(variant, S.k) + 3 + 6) / 0.8));
  /* the sample-size variants set N themselves (N ≈ p and N < p are below the usual minimum on purpose) */
  const nEff = variant => GEN.fixedN(variant, S.k) ?? Math.max(S.N, nMin(variant));
  const gen = (variant, strength) => GEN.generate(variant, { N: nEff(variant), sigma: S.sigma, strength, seed: S.seed, k: kEff(variant) });
  /* the training rows of a dataset, fitted in original units (same predictions and diagnostics as the standardised run) */
  function view(d, tr){
    tr = tr.filter(i => i < d.y.length);
    const X = tr.map(i => d.X[i]), y = tr.map(i => d.y[i]);
    const dd = Object.assign({}, d, { X, y, px: tr.map(i => d.px[i]), derive: d.derive ? Object.assign({}, d.derive, { raw: tr.map(i => d.derive.raw[i]) }) : undefined, x2: d.x2 ? tr.map(i => d.x2[i]) : undefined, group: d.group ? tr.map(i => d.group[i]) : undefined, N: tr.length,
      truth: Object.assign({}, d.truth, { fn: d.truth.fn ? (v, k) => d.truth.fn(v, tr[k]) : null }) });
    const f = ST.ols(X, y); let dg = null; try { dg = ST.diagnostics(X, y, f); } catch (err) {}
    // the standardised design and its Gram matrix, exactly as in steps 5 and 6
    const ms = X[0].map((_, j) => !j || GEN.noScale(d.names[j]) ? [0, 1] : FE.scaleStats(X.map(r => r[j]), d.scale || 'std')), mu = ms.map(t => t[0]), sd = ms.map(t => t[1]);
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
    // the chosen feature (Controls) drives the worked examples, notes and code: it becomes the focus column
    [d, db].forEach(dd => { const g = FS.global(dd.names); dd.focus0 = dd.focus; dd.focus = [g.j, ...(dd.focus.length > 1 && g.j2 > 0 ? [g.j2] : [])]; });
    const P = PIPE.run(d, { seed: S.seed, lr: S.lr, iters: S.iters });
    const Pb = isBase ? P : PIPE.run(db, { seed: S.seed, lr: S.lr, iters: S.iters });
    const tv = view(d, P.tr), tb = isBase ? tv : view(db, Pb.tr);
    cur = { d, P, tv }; base = { d: db, tv: tb, P: Pb };
    const inf = influence(a.id, v, isBase, S.strength);
    const k1 = [v.id, S.strength, nEff(v.id), S.sigma, kEff(v.id)].join('|'), k0 = [baseId, 0, nEff(baseId), S.sigma, kEff(baseId)].join('|');
    mcCur = mcCache.get(k1) || null; mcBase = mcCache.get(k0) || null;
    renderPanel(a, v, isBase); renderChanged(a, v, isBase, inf); renderProcess(a, v, isBase, inf);
    clearTimeout(mcTimer);
    if (!mcCur || (S.cmp && !mcBase)) {
      if (mcRO) mcRO.innerHTML = '<span class="muted">Running 200 fresh datasets…</span>';
      mcTimer = setTimeout(() => {
        mcCur = mcFor(v.id, S.strength, FS.cols(d.names), d.truth.coef);
        mcBase = isBase ? mcCur : mcFor(baseId, 0, FS.cols(db.names), db.truth.coef);
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
    { // the slider counts input features (a text category is one feature, however many 0/1 columns it becomes); the variant's own features are a frozen minimum
      const base = GEN.baseCount(v.id), dd = cur.d, rc = dd.rawCat, featNames = [...(dd.raw ? dd.raw.names : dd.names).slice(1).filter(nm => GEN.isFeat(nm)), ...(rc ? [rc.name] : [])], nCols = dd.names.length - 1;
      sF.set(kEff(v.id));
      sF.el.querySelector('label').firstChild.textContent = base > 1 ? `Number of features k (this variant has ${base} built in${rc ? `: ${featNames.slice(0, base).join(', ')} → ${nCols} column${nCols > 1 ? 's' : ''} after encoding` : ''})` : 'Number of features k';
      let lock = sF.el.querySelector('.lock'), note = sF.el.querySelector('.lock-note'); const inp = sF.el.querySelector('input');
      if (!lock) { lock = document.createElement('div'); lock.className = 'lock'; inp.before(lock); note = document.createElement('div'); note.className = 'lock-note'; inp.after(note); }
      const mxC = GEN.maxCount(v.id);
      lock.style.display = note.style.display = base > 1 || mxC ? '' : 'none';
      if (mxC) { lock.style.width = '100%'; note.textContent = `🔒 Locked at ${mxC[0]}: ${mxC[1]}.`; }
      if (base > 1 && !mxC) { lock.style.width = `calc(${(base - 1) / 9 * 100}% )`; note.textContent = `🔒 Locked at ${base} or more: this variant needs ${featNames.slice(0, base).join(', ')}.${featNames.length > base ? ' Extra features are added from the slider.' : ''}`; }
    }
    sN.set(nEff(v.id)); sN.el.querySelector('label').firstChild.textContent = GEN.fixedN(v.id, S.k) != null ? `Sample size N (set by this variant: ${nEff(v.id)})` : nMin(v.id) > 8 ? `Sample size N (at least ${nMin(v.id)} for ${GEN.pCount(v.id, S.k)} coefficients)` : 'Sample size N';
    sS.el.querySelector('label').firstChild.textContent = GEN.sigmaOf(v.id, S.sigma) !== S.sigma ? `Noise σ (this variant uses σ = ${num(GEN.sigmaOf(v.id, S.sigma), 2)})` : 'Noise σ';
    sS.set(S.sigma); sK.set(S.strength); sLR.set(S.lr); sIt.set(S.iters);
    $('#cmp').checked = S.cmp; $('#seedlbl').textContent = 'sample #' + S.seed;
    { const nm = cur.d.names, cs = FS.cols(nm), g = FS.global(nm), fb = $('#fboxF');
      fb.style.display = cs.length > 1 ? '' : 'none';
      if (cs.length > 1) fb.innerHTML = `<label title="The feature every slice chart, worked example, note and code comment uses (each chart can override it in its header)">Feature <select id="gfx">${cs.map(j => `<option${j === g.j ? ' selected' : ''}>${esc(nm[j])}</option>`).join('')}</select></label>` +
        `<label title="The second feature for pair charts (3D view, pair scatter, loss surface)">Second <select id="gfy">${cs.filter(j => j !== g.j).map(j => `<option${j === g.j2 ? ' selected' : ''}>${esc(nm[j])}</option>`).join('')}</select></label>` +
        `<label title="Partial residuals: move each point by the other features' share of its prediction, so it sits exactly its residual away from the slice line"><input type="checkbox" id="gadj"${S.adj ? ' checked' : ''}> Adjust slice points for the other features</label>`; }
    if (!viewA.live) {
      if (topChart) { topChart.dispose(); topChart = null; } $('#topviz').innerHTML = ''; $('#about').innerHTML = '';
      $('#vtitle').textContent = viewA.name;
      $('#vdesc').textContent = `Planned for a later step. The simulation below still shows ${a.name} › ${v.name}.`;
      $('#chips').innerHTML = viewA.variants.map((x, i) => `<button type="button" disabled>${esc(x.name)}${i === 0 ? ' · baseline' : ''}</button>`).join('');
      return;
    }
    $('#vtitle').textContent = v.name + (isBase ? ' (baseline)' : '');
    $('#vdesc').textContent = v.desc + (cur.d.note ? ' ' + cur.d.note.replace(/\.$/, '') + '.' : '');
    $('#chips').innerHTML = a.variants.map((x, i) => `<button type="button" data-id="${x.id}" aria-pressed="${x.id === v.id}">${esc(x.name)}${i === 0 ? ' · baseline' : ''}</button>`).join('');
    try { $('#about').innerHTML = ABOUT.html(a, v, isBase, cur, aboutOpen); } catch (err) { console.error(err); $('#about').innerHTML = ''; }
    renderTop(a, v, isBase);
    MATH.typeset(panel);
  }

  // ---- the characteristic picture at the top: y against x for the whole dataset ----
  let topChart = null, aboutOpen = false;
  document.addEventListener('toggle', e => { if (e.target.id === 'aboutD') aboutOpen = e.target.open; }, true);
  function renderTop(a, v, isBase){
    if (topChart) { topChart.dispose(); topChart = null; }
    const el = $('#topviz'); el.innerHTML = '';
    topChart = new Chart(el, { title: '', height: 330 }); topChart.wrap.classList.add('wide');
    topChart.drawFn = () => drawTop(topChart, a, v, isBase); topChart.drawFn();
    const names = cur.d.names; if (FS.cols(names).length > 1) { FS.sel(topChart, names, 'top', 'one', topChart.drawFn); FS.adjBtn(topChart, 'top', topChart.drawFn); }
    const bb = document.createElement('button'); bb.type = 'button'; bb.className = 'fsel-adj';
    const lab = () => { const on = S.ov.top?.base !== false; bb.textContent = on ? 'baseline: shown' : 'baseline: hidden'; bb.setAttribute('aria-pressed', String(on)); };
    lab(); bb.onclick = () => { S.ov.top = Object.assign({}, S.ov.top, { base: S.ov.top?.base === false }); lab(); topChart.drawFn(); };
    if (!isBase) (topChart.tabsEl.querySelector('.fsel') || topChart.tabsEl).appendChild(bb);
    const cap = document.createElement('p'); cap.className = 'pv-note top-cap'; cap.innerHTML = topCaption(a, v, isBase); el.appendChild(cap);
  }
  function topCaption(a, v, isBase){
    if (isBase) return `The baseline: what healthy data look like for ${esc(a.name.toLowerCase())}. Pick a variant to see it change.`;
    const C2 = {
      independence: { posar: 'Points are coloured by the sign of their residual (above or below the fitted line). Long runs of one colour along x are the signature of positive autocorrelation.', negar: 'Points are coloured by the sign of their residual. Colours that alternate almost every row are the signature of negative autocorrelation.', cluster: 'Points are coloured by cluster: whole clusters sit above or below the line together.', dupes: 'Each dot hides several identical copies stacked on top of each other: the picture looks normal, the row count does not.' },
      multicollinearity: { dummytrap: 'Coloured by colour level. Nothing looks wrong here: the trap is in the encoded columns (step 5 and step 6), not in the points.', _: 'The trouble is between the features, not between x and y: compare the x₁ against x₂ picture in step 3 and step 10.' },
      exogeneity: { _: 'Compare the fitted line with the dashed true line: the gap is the bias. The residuals around the fitted line look perfectly healthy, which is the trap.' },
      outliers: { _: 'The changed rows are drawn larger in pink. Compare the fitted line with the dashed true line to see how much they pull it.' },
      missing: { _: 'Hollow pink points are the rows whose y was lost (their y is known only because this is a simulation). The fitted line uses the filled points only.' },
      range: { rextrap: 'Hollow points are the test rows, beyond the training range. The line keeps going straight where the dashed truth bends.', rgap: 'No rows between x = 4 and 7: the dashed truth has a bump there that the fitted line cannot see.' },
      shift: { _: 'Hollow points are the test rows: compare where they sit with the training rows.' },
      subgroups: { _: 'Coloured by the hidden group (which the model never sees). The single fitted line is compared with each group\u2019s true line (dashed).' },
      categorical: { _: 'Coloured by level, one fitted line per level (the 0/1 columns from step 5 shift the line up or down).' },
      leakage: { _: 'Nothing unusual in y against x: the leak is in another column. See the fingerprint below and step 2.' },
      scaling: { _: 'Scaling never changes this picture: the fitted plane is the same. The difference is in step 6 (κ) and step 9b (gradient descent), and in the fingerprint below.' },
      xtransform: { _: 'Drawn against the raw x: with a transform, the straight-line model becomes a curve on this axis.' },
      ytransform: { _: 'y here is on the scale the model is fitted on. Step 12 scores the predictions back in the units of y.' },
      degree: { _: 'Each extra power lets the fitted curve bend once more; watch the edges for overfitting at high degrees.' },
      interactions: { _: 'A slice through x₁ with x₂ at its mean; with the product term, the slope of x₁ changes with x₂.' },
      splines: { _: 'The fitted line is made of straight pieces joined at the knots.' },
      binning: { _: 'Drawn against the raw x: a binned model is a staircase, one level per bin.' },
      encoding: { _: 'Coloured by region. Compare how each encoding places the four groups.' },
      centering: { _: 'The fitted curve is identical with or without centring; only the columns (and their VIF and SEs) differ.' },
      selection: { _: 'A slice through the first kept feature. The selection itself is shown in step 5 and in the fingerprint below.' },
      intercept: { intorigin: 'Solid: OLS with an intercept. Dashed orange: the model forced through (0, 0), which must tilt to reach the data.' },
      modeltype: { mtsimple: 'One straight line in x₁: x₂ and the curve are left in the errors.', mtmultiple: 'A slice through x₁ with x₂ at its mean: still straight.', mtpoly: 'The fitted curve against the raw x₁ (x₂ at its mean): the shape of the truth.', _: 'Solid: OLS on the same columns. Dashed orange: this variant’s model; the two curves almost coincide, the difference is in the precision (steps 11 and 13).' },
      robust: { rbols: 'The large pink points are the contaminated rows; compare the fitted line with the dashed truth.', _: 'Large pink points: contaminated rows. Solid: OLS, pulled by them. Dashed orange: the robust model.' },
      regularisation: { _: 'A slice through x₁ with the other 7 features at their means. Solid: OLS; dashed orange: the penalised model. The difference shows in the coefficients (fingerprint below and step 13).' },
      lambda: { _: 'A slice through x₁. Solid: OLS; dashed orange: ridge with this λ. A large λ flattens the slice toward the mean.' },
      alpha: { _: 'A slice through x₁. Solid: OLS; dashed orange: the elastic net with this α.' },
      penalisebias: { _: 'A slice through x₁. Solid: OLS; dashed orange: ridge. With the intercept penalised the whole line drops toward 0.' },
      otherforms: { _: 'A slice through x₁. Solid: OLS; dashed orange: this variant’s model.' },
      lossfn: { lfmse: 'Pink points carry the extra upward error. The squared loss pulls the line up toward them: it estimates the mean, not the bulk.', lfquant: 'Solid: the mean line (MSE). Dashed orange: the 90th-percentile line, which about 10% of the points lie above.', _: 'Pink points carry the extra upward error. Solid: the MSE line, pulled up by them. Dashed orange: the line this loss chooses.' },
      penalty: { _: 'A slice through x₁ with the other 7 features at their means. Solid: no penalty; dashed orange: the penalised model.' },
      residplots: { _: 'The fitted line through data with a slight curve, a spread that grows with x, and one far-out row (pink). The residual plots below show each problem.' },
      influence: { _: 'Pink: the two rows built to be unusual, one with an ordinary x and a large residual, one far out in x and below the line. Compare the fitted line with the dashed truth.' },
      lintest: { _: 'A straight line through a curve: the residuals bend, and RESET or the CPR plot picks it up.' },
      vartest: { _: 'The spread of the points grows with x: the variance tests detect it.' },
      indtest: { _: 'Rows in time order; the points stay on one side of the line for runs.' },
      normtest: { _: 'Most points sit a little below the line and a few far above: a right-skewed error.' },
      colltest: { _: 'A slice through x₁; x₂ follows x₁ closely, so their separate effects are hard to tell apart.' },
      coefinf: { _: 'A slice through x₁ (x₂, x₃ at their means). The uncertainty of the coefficients is in step 11 and the fingerprint below.' },
      ftest: { _: 'A slice through x₁. The F-test compares this fit with a smaller model; see step 11.' },
      intervals: { _: 'The line is the same; step 11 and the fingerprint show its confidence and prediction bands.' },
      robustse: { rshc: 'The spread of the points grows with x: classical SEs understate the uncertainty.', rscl: 'Coloured by group: points of a group sit together above or below the line.', rsnw: 'Points stay on one side of the line for long runs: errors carry over in time.', _: 'Independent, equal-spread errors: classical SEs are right.' },
      reading: { rdloglog: 'The model is fitted on ln y and ln x; drawn against the raw x it is a power curve.', rdloglin: 'The model is fitted on ln y (vertical axis).', _: 'The same line; the reading of its slope changes (step 13).' },
      causal: { csconf: 'Compare the fitted line with the dashed causal line: the gap is the confounding bias.', _: 'x was randomised: the fitted line follows the causal effect.' },
      solver: { _: 'Every exact solver gives the same line as the normal equations: the difference is in how the numbers are computed (step 9a) and how accurate they stay when the features are nearly collinear.', slgd: 'After 200 iterations gradient descent sits on the least-squares line.', slcd: 'Coordinate descent converges to the least-squares line.' },
      gdtype: { _: 'A slice through x₁ (x₂ at its mean). Solid: least squares. Dashed orange, if visible: where this run stopped, short of the minimum.' },
      lr: { lrtiny: 'Dashed orange: where gradient descent got to in 100 tiny steps, far from the least-squares line (solid).', lrbig: 'The run diverged, so it has no line: its weights grew without limit.', _: 'Solid: least squares. Dashed orange, if visible: where this run stopped.' },
      schedule: { _: 'Solid: least squares. Dashed orange: where SGD ended after 20 epochs; a decaying η ends closer.' },
      optimiser: { _: 'Solid: least squares. Dashed orange, if visible: where this optimiser was after 200 iterations.' },
      init: { _: 'Every start reaches the same least-squares line: the loss is a convex bowl.' },
      stopping: { _: 'Solid: least squares. Dashed orange: where the run stopped under this rule.' },
      metric: { _: 'Solid: the straight line every pipeline step uses. Dashed orange: the degree this metric prefers among degrees 1–5.' },
      traintest: { ttover: 'Dashed orange: a degree-10 polynomial that bends through the training points and swings between them.', ttunder: 'Dashed orange (on the solid line): a straight line through a curve.', _: 'Dashed orange: the degree-2 fit, close to the truth.' },
      learningcurve: { _: 'Dashed orange: the model whose learning curve is shown below, fitted on all training rows.' },
      validationcurve: { _: 'Dashed orange: the setting with the lowest validation error, refitted on all training rows.' },
      biasvariance: { _: 'One dataset of the 200 used for the decomposition; the fingerprint below shows 20 fits of each model.' },
      split: { _: 'The same data for every split ratio. Hollow points would be test rows; the picture barely changes: the difference is in how steady the test score is (fingerprint below).' },
      cv: { _: 'A gentle curve fitted with a straight line. Cross-validation does not change the line: it changes how its error on new rows is estimated (steps 4 and 12, and the fingerprint below).' },
      seed: { _: 'One fitted line from one split. Another seed would move it a little: the fingerprint below shows 200 of them.' },
      scalegd: { sgunscaled: 'Dashed orange: after 200 steps on the raw features gradient descent is still far from the least-squares line.', _: 'On standardised features gradient descent reaches the least-squares line.' }
    }[a.id] || {};
    return C2[v.id] || C2._ || 'The variant (filled) against the baseline built from the same random numbers (small grey dots), with the fitted line and the true mean (dashed).';
  }
  function drawTop(Pc, a, v, isBase){
    if (useDer(cur.d, FS.pick(cur.d.names, 'top').j)) return drawDerived(Pc, cur.d, cur.tv.f, { alt: cur.P.alt, adj: FS.adj('top'), base: base.d, baseF: base.tv.f, showBase: !isBase && S.ov.top?.base !== false, title: `${v.name}${isBase ? ' (baseline)' : ''}: y against the raw ${cur.d.derive.axisName || 'x'}, with the fitted model` });
    const d = cur.d, P = cur.P, f = cur.tv.f, names = d.names, { j } = FS.pick(names, 'top'), multi = FS.cols(names).length > 1, adj = FS.adj('top') && multi;
    const xs = d.X.map(r => r[j]), groups = d.group ? d.groupNames.length : 0, grouped = !!d.cat && groups <= 6;
    const sl = FS.slice(d.X, d.y, f.w, j, { keep: FS.catCols(names) }), yp = adj ? sl.y : d.y;
    const dr = d.dropped, dx = dr ? dr.X.map(r => r[j]) : [], dy = dr ? dr.y.map((t, k) => adj ? t - sl.others.reduce((s2, q) => s2 + f.w[q] * (dr.X[k][q] - sl.means[q]), 0) : t) : [];
    const bd = base.d, jb = GEN.colIn(bd.names, names[j]), showBase = !isBase && S.ov.top?.base !== false && jb > 0, bx = showBase ? bd.X.map(r => r[jb]) : [], by = showBase ? bd.y : [];
    const all = [...xs, ...dx, ...bx], lo = Math.min(...all), hi = Math.max(...all), gx = grid(lo, hi);
    const lineGroups = grouped ? [...Array(groups).keys()] : [null];
    const fitLines = lineGroups.map(g => gx.map(x => [x, LA.dot(rowAt(d, x, g ?? 0, j), f.w)]));
    const tf = d.truth.fn && !d.truth.partial ? d.truth.fn : null;
    const trueLines = j !== 1 ? [] : d.truth.byGroup && !d.truth.byGroupPartial ? d.truth.byGroup.map(fn => gx.map(x => [x, fn(x)])) : tf && d.X[0].length === 2 ? (d.testIdx && v.id === 'shrel' ? [gx.map(x => [x, tf(x, 0)]), gx.map(x => [x, tf(x, d.y.length - 1)])] : [gx.map(x => [x, tf(x, 0)])]) : (d.truth.coef[1] != null && d.X[0].length === 2 ? [gx.map(x => [x, d.truth.coef[0] + d.truth.coef[1] * x])] : []);
    const ys = [...yp, ...dy, ...by, ...fitLines.flat().map(p => p[1])].filter(isFinite);
    const flag = new Set(d.flagRows || []), sign = a.id === 'independence' && (v.id === 'posar' || v.id === 'negar') ? d.y.map((t, i) => t - LA.dot(d.X[i], f.w)) : null;
    const colOf = i => sign ? (sign[i] >= 0 ? css('--floor') : css('--normal')) : d.group ? groupColor(d.group[i], groups) : css('--floor');
    Pc.title(`${v.name}${isBase ? ' (baseline)' : ''}: y against ${names[j]}${adj ? ' (points adjusted for the other features)' : ''}`);
    Pc.begin([lo, hi], [Math.min(...ys), Math.max(...ys)], names[j], adj ? 'y adjusted for the other features' : 'y');
    if (showBase) bx.forEach((x, i) => Pc.dot([x, by[i]], css('--muted'), 2.2, false, 0.45));
    if (sign) { const ord = xs.map((_, i) => i); for (let k = 1; k < ord.length; k++) { const i0 = ord[k - 1], i1 = ord[k]; if (Math.sign(sign[i0]) === Math.sign(sign[i1])) Pc.line([[xs[i0], yp[i0]], [xs[i1], yp[i1]]], colOf(i1), 1, null, 0.35); } }
    xs.forEach((x, i) => { const te = !P.isTrain[i] && P.splitFixed, fl = flag.has(i); Pc.dot([x, yp[i]], fl ? css('--normal') : te ? css('--residual') : colOf(i), fl ? 6 : 3.6, te, 0.9); });
    dx.forEach((x, k) => Pc.dot([x, dy[k]], css('--normal'), 3.6, true, 0.9));
    trueLines.forEach((l, k) => Pc.line(l, trueLines.length > 1 ? groupColor(k, groups) : css('--ink'), 1.6, [6, 5], 0.85));
    fitLines.forEach((l, k) => Pc.line(l, lineGroups[k] == null ? css('--surface') : groupColor(lineGroups[k], groups), 2.8));
    const AL = cur.P.alt; if (AL) Pc.line(gx.map(x => [x, LA.dot(rowAt(d, x, 0, j), AL.wOrig)]), css('--residual'), 2.6, [8, 4]);
    const EVC = cur.P.evr && cur.P.evr.curve ? cur.P.evr : null; if (EVC) { const yl = [Math.min(...d.y), Math.max(...d.y)], pd = (yl[1] - yl[0]) * 0.3; Pc.line(gx.map(x => [x, Math.max(yl[0] - pd, Math.min(yl[1] + pd, EVC.curve(x)))]), css('--residual'), 2.6, [8, 4]); }
    const OPR = cur.P.opt && cur.P.opt.hist && !cur.P.opt.diverged && cur.P.opt.gap > 1e-3 ? cur.P.opt : null; if (OPR) Pc.line(gx.map(x => [x, LA.dot(rowAt(d, x, 0, j), OPR.wOrig)]), css('--residual'), 2.6, [8, 4]);
    if (P.splitFixed) { const trx = P.tr.map(i => xs[i]); Pc.rect(Math.min(...trx), Pc.box.y0, Math.max(...trx), Pc.box.y1, css('--floor'), 0.05); }
    Pc.end();
    const leg = [[css('--surface'), grouped ? 'fitted lines (one per level)' : `fitted line (slope ${num(f.w[j], 3)})`]];
    if (AL) leg.push([css('--residual'), `this variant's model: ${esc(AL.label)} (slope ${num(AL.wOrig[j], 3)})`, true]);
    if (EVC) leg.push([css('--residual'), `this variant's model: ${esc(EVC.curveLabel)}`, true]);
    if (OPR) leg.push([css('--residual'), `where this run stopped (slope ${num(OPR.wOrig[j], 3)})`, true]);
    if (cur.P.opt && cur.P.opt.diverged) leg.push([css('--normal'), 'this run diverged: its weights are not finite, so no line']);
    if (trueLines.length) leg.push([css('--ink'), trueLines.length > 1 ? 'true line of each group' : 'true mean E[y | x]', true]);
    if (showBase) leg.push([css('--muted'), 'baseline data (same random numbers)']);
    if (sign) leg.push([css('--floor'), 'above the line'], [css('--normal'), 'below the line']);
    else if (d.group && groups <= 6) d.groupNames.forEach((nm, k) => leg.push([groupColor(k, groups), esc(nm)]));
    if (flag.size) leg.push([css('--normal'), 'changed rows']);
    if (dr) leg.push([css('--normal'), 'rows whose y was lost (hollow)']);
    if (P.splitFixed) leg.push([css('--residual'), 'test rows (hollow); shaded: training x range']);
    Pc.legend(leg);
  }

  // ---- colours and helpers ----
  const groupColor = (k, n) => n <= 4 ? css(['--floor', '--residual', '--surface', '--normal'][k]) : `hsl(${(k * 360 / n + 160) % 360} 55% 45%)`;
  const ptColor = (d, i) => d.group ? groupColor(d.group[i], d.groupNames.length) : css('--floor');
  const colMeans = X => X[0].map((_, j) => ST.mean(X.map(r => r[j])));
  function rowAt(d, x, g, j = 1){
    const r = colMeans(d.X); r[j] = x;
    if (d.cat) Object.entries(d.cat).forEach(([col, lev]) => { r[+col] = +(lev === g); });
    return r;
  }
  const bins = (x, e, B) => { const idx = [...x.keys()].sort((a, b) => x[a] - x[b]), n = x.length, out = []; for (let b = 0; b < B; b++) { const s2 = idx.slice(Math.floor(b * n / B), Math.floor((b + 1) * n / B)); if (s2.length) out.push([ST.mean(s2.map(i => x[i])), ST.mean(s2.map(i => e[i]))]); } return out; };
  const grid = (lo, hi, n = 80) => Array.from({ length: n + 1 }, (_, i) => lo + (hi - lo) * i / n);
  const corrOf = (a, b) => { const ma = ST.mean(a), mb = ST.mean(b); let sab = 0, saa = 0, sbb = 0; a.forEach((v, i) => { sab += (v - ma) * (b[i] - mb); saa += (v - ma) ** 2; sbb += (b[i] - mb) ** 2; }); return sab / Math.sqrt(saa * sbb); };
  function mount(parent, title, height, draw, cls = ''){
    const c = new Chart(parent, { title, height }); c.wrap.classList.add('mini'); if (cls) c.wrap.classList.add(cls); c.drawFn = () => draw(c); c.drawFn(); return c;
  }

  // ---- step 9a: the data and the fitted line (a slice through the chosen feature) ----
  /* feature engineering: the fitted model drawn as a curve against the raw x (e.g. a polynomial, a log, splines, bins) */
  const useDer = (d, j) => !!d.derive && (d.derive.cols.includes(j) || !FS.cols(d.names).some(q => !d.derive.cols.includes(q)));
  function drawDerived(Pc, d, f, o = {}){
    const dv = d.derive, xs = dv.raw, m = colMeans(d.X), cat = new Set(FS.catCols(d.names)), others = d.X[0].map((_, q) => q).filter(q => q > 0 && !dv.cols.includes(q) && !cat.has(q));
    const yp = o.adj && others.length ? d.y.map((v, i) => v - others.reduce((s2, q) => s2 + f.w[q] * (d.X[i][q] - m[q]), 0)) : d.y;
    const rowOf = (xv, g) => { const r = [...m]; dv.f(xv).forEach((t, k) => { r[dv.cols[k]] = t; }); if (d.cat && g != null) Object.entries(d.cat).forEach(([c, lev]) => { r[+c] = +(lev === g); }); return r; };
    const bxs = o.base ? (o.base.derive ? o.base.derive.raw : o.base.X.map(r => r[1])) : [], all = [...xs, ...bxs], lo = Math.min(...all), hi = Math.max(...all), gx = grid(lo, hi, 160);
    const curve = gx.map(xv => [xv, LA.dot(rowOf(xv), f.w)]), tf = d.truth.fnRaw;
    const bcurve = o.base && o.baseF ? gx.map(xv => [xv, o.base.derive ? LA.dot((() => { const mb = colMeans(o.base.X), r = [...mb]; o.base.derive.f(xv).forEach((t, k) => { r[o.base.derive.cols[k]] = t; }); return r; })(), o.baseF.w) : LA.dot(colMeans(o.base.X).map((t, q) => q === 1 ? xv : t), o.baseF.w)]) : null;
    const ys = [...yp, ...curve.map(p => p[1]), ...(o.showBase ? o.base.y : [])].filter(isFinite), an = dv.axisName || (d.raw ? d.raw.names[1] : 'x');
    Pc.title(o.title || `y against ${an}, with the fitted curve`);
    Pc.begin([lo, hi], [Math.min(...ys), Math.max(...ys)], `${an} (raw)`, o.adj && others.length ? `${d.yName || 'y'} adjusted for the other features` : (d.yName || 'y'));
    if (o.showBase) bxs.forEach((x, i) => Pc.dot([x, o.base.y[i]], css('--muted'), 2.2, false, 0.45));
    if (tf) Pc.line(gx.map(xv => [xv, tf(xv)]), css('--ink'), 1.6, [6, 5], 0.85);
    if (bcurve) Pc.line(bcurve, css('--muted'), 2, [3, 4]);
    xs.forEach((x, i) => Pc.dot([x, yp[i]], d.group ? groupColor(d.group[i], d.groupNames.length) : css('--floor'), 3.4, false, 0.85));
    if (o.res) xs.forEach((x, i) => Pc.line([[x, yp[i]], [x, yp[i] - f.e[i]]], css('--residual'), 1, null, 0.7));
    const acurve = o.alt ? gx.map(xv => [xv, LA.dot(rowOf(xv), o.alt.wOrig)]) : null; if (acurve) Pc.line(acurve, css('--residual'), 2.6, [8, 4]);
    Pc.line(curve, css('--surface'), 2.8); Pc.end();
    Pc.legend([...(acurve ? [[css('--residual'), `this variant's model: ${esc(o.alt.label)}`, true]] : []), [css('--surface'), `${acurve ? 'OLS: ' : ''}fitted model (columns ${d.names.slice(1).filter((_, k) => dv.cols.includes(k + 1)).join(', ')} all move with ${an})`], ...(tf ? [[css('--ink'), 'true mean', true]] : []), ...(bcurve ? [[css('--muted'), 'baseline fit', true]] : []), ...(o.showBase ? [[css('--muted'), 'baseline data']] : [])]);
  }
  function drawFit(P, isBase, id = 'fit'){
    if (useDer(cur.tv.d, FS.pick(cur.tv.d.names, id).j)) return drawDerived(P, cur.tv.d, cur.tv.f, { alt: cur.P.alt, adj: FS.adj(id), res: S.res, base: S.cmp && !isBase ? base.tv.d : null, baseF: base.tv.f, title: `The training data and the fitted ${cur.tv.d.derive.cols.length > 1 ? 'curve' : 'line'} (step 9a), against the raw ${cur.tv.d.derive.axisName || 'x'}` });
    const { d, f } = cur.tv, { j } = FS.pick(d.names, id), adj = FS.adj(id), xs = d.X.map(r => r[j]), groups = d.group ? d.groupNames.length : 0;
    const lo = Math.min(...xs), hi = Math.max(...xs), gx = grid(lo, hi), multi = FS.cols(d.names).length > 1 || FS.catCols(d.names).length > 0, adjN = FS.cols(d.names).length > 1;
    const grouped = !!d.cat && groups <= 6;
    const lineGroups = grouped ? [...Array(groups).keys()] : [null];
    const fitLines = lineGroups.map(g => gx.map(x => [x, LA.dot(rowAt(d, x, g ?? 0, j), f.w)]));
    // adjusted points: remove the other numeric features' share of each prediction (categorical columns stay, so points match their group's line)
    const sl = FS.slice(d.X, d.y, f.w, j, { keep: FS.catCols(d.names) }), yp = adj && adjN ? sl.y : d.y, yh = adj && adjN ? sl.y.map((v, i) => v - f.e[i]) : f.yhat;
    const trueLines = j !== 1 ? [] : d.truth.byGroup && !d.truth.byGroupPartial ? d.truth.byGroup.map(fn => gx.map(x => [x, fn(x)])) : d.truth.fn && d.X[0].length === 2 ? [gx.map(x => [x, d.truth.fn(x, 0)])] : [];
    let baseLine = null;
    if (S.cmp && !isBase) { const bd = base.tv.d, jb = GEN.colIn(bd.names, d.names[j]); if (jb > 0) { const bx = bd.X.map(r => r[jb]); baseLine = grid(Math.min(...bx), Math.max(...bx)).map(x => [x, LA.dot(rowAt(bd, x, 0, jb), base.tv.f.w)]); } }
    const ys = [...yp, ...fitLines.flat().map(p => p[1])];
    P.title(multi ? `A slice: y against ${d.names[j]}, other features at their means${adj && adjN ? ' (points adjusted)' : ''}` : 'The training data and the line these weights give (compare with the baseline and the truth)');
    P.begin([lo, hi], [Math.min(...ys), Math.max(...ys)], d.names[j], adj && adjN ? `y adjusted for the other features` : 'y');
    if (S.res) xs.forEach((x, i) => P.line([[x, yp[i]], [x, yh[i]]], css('--residual'), 1, null, 0.7));
    xs.forEach((x, i) => P.dot([x, yp[i]], ptColor(d, i), 3.4, false, 0.85));
    if (d.X[0].length > 2 && !d.group && !(adj && adjN)) xs.forEach((x, i) => P.dot([x, f.yhat[i]], css('--surface'), 3, true, 0.6));
    trueLines.forEach(l => P.line(l, css('--ink'), 1.6, [6, 5], 0.8));
    if (baseLine) P.line(baseLine, css('--muted'), 2, [3, 4]);
    fitLines.forEach((l, k) => P.line(l, lineGroups[k] == null ? css('--surface') : groupColor(lineGroups[k], groups), 2.6));
    const AL = cur.P.alt; if (AL) P.line(gx.map(x => [x, LA.dot(rowAt(d, x, 0, j), AL.wOrig)]), css('--residual'), 2.6, [8, 4]);
    P.end();
    const leg = [[css('--surface'), d.X[0].length > 2 && !d.group ? `fitted line: slope w = ${num(f.w[j], 3)} for ${d.names[j]}, every other feature at its mean` : 'fitted line (weights from this step)']];
    if (adjN && adj) leg.push([css('--floor'), `points: y − Σ w·(x − mean) over the other features, so each sits its residual e away from the line`]);
    else if (d.X[0].length > 2 && !d.group) leg.push([css('--surface'), 'hollow: the model’s ŷ for each row (it uses every feature)']);
    if (AL) leg.push([css('--residual'), `this variant's model: ${esc(AL.label)} (slope ${num(AL.wOrig[j], 3)})`, true]);
    if (trueLines.length) leg.push([css('--ink'), 'true mean E[y | x]', true]);
    if (baseLine) leg.push([css('--muted'), 'baseline fit (same rows of the baseline data)', true]);
    if (S.res) leg.push([css('--residual'), 'residuals e = y − ŷ']);
    if (d.group) d.groupNames.slice(0, 4).forEach((n, k) => leg.push([groupColor(k, groups), n]));
    P.legend(leg);
  }
  /* the rotatable 3D view for any pair of numeric features; the other columns sit at their means */
  function mount3D(holder){
    const build = () => {
      holder.querySelectorAll('.chart').forEach(w => w._dispose && w._dispose()); holder.innerHTML = '';
      const tv = cur.tv, d = tv.d, { j, j2 } = FS.pick(d.names, 'p3d'), adj = FS.adj('p3d'), w = tv.f.w, X = d.X, tc = d.truth.coef, p = X[0].length;
      const m = colMeans(X), others = [...Array(p).keys()].filter(k => k > 0 && k !== j && k !== j2);
      const c0 = w[0] + others.reduce((s2, k) => s2 + w[k] * m[k], 0), ya = adj && others.length ? d.y.map((v, i) => v - others.reduce((s2, k) => s2 + w[k] * (X[i][k] - m[k]), 0)) : d.y;
      const tOK = [...Array(p).keys()].every(k => tc[k] != null) && !d.truth.byGroup;
      const truth = tOK ? [tc[0] + others.reduce((s2, k) => s2 + tc[k] * m[k], 0), tc[j], tc[j2]] : null;
      const ch = P3D.mount(holder, { title: `The training data and the fitted ${others.length ? 'model, sliced through' : 'plane over'} ${d.names[j]} and ${d.names[j2]} in 3D (drag to rotate)`, height: 340, x1: X.map(r => r[j]), x2: X.map(r => r[j2]), y: ya, fit: [c0, w[j], w[j2]], truth, names: [d.names[j], d.names[j2]] });
      ch.wrap._dispose = () => ch.dispose(); procCharts.push(ch);
      FS.sel(ch, d.names, 'p3d', 'pair', build); if (others.length) FS.adjBtn(ch, 'p3d', build);
      if (others.length) { const p2 = document.createElement('div'); p2.className = 'chart-ro'; p2.innerHTML = `<span class="muted">${others.length} other column(s) (${others.map(k => d.names[k]).join(', ')}) are held at their training means: the plane is ŷ = ${num(c0, 3)} + ${num(w[j], 3)}·${d.names[j]} + ${num(w[j2], 3)}·${d.names[j2]}, where ${num(c0, 3)} = b + Σ w·mean over the other columns.${adj ? ' Each point is y minus the other columns’ share Σ w·(x − mean), so its stick to the plane is exactly its residual e.' : ' The points are raw y, so the other columns add scatter around the plane.'}</span>`; ch.wrap.appendChild(p2); MATH.typeset(p2); }
    };
    build();
  }

  // ---- step 10: the picture behind each test ----
  function drawDiag(P, mode, id){
    const { d, f } = cur.tv, e = f.e, s = Math.sqrt(f.SSE / Math.max(1, f.df)) || 1, z = e.map(v => v / s), N = e.length, col = i => ptColor(d, i);
    const msg = t => { P.begin([0, 1], [0, 1], '', ''); P.text(t, [0.03, 0.5], css('--muted'), 0, 0, true); P.end(); P.legend([]); };
    if (mode === 'fitted') {
      P.begin([Math.min(...f.yhat), Math.max(...f.yhat)], [Math.min(...e), Math.max(...e)], 'fitted ŷ (step 7)', 'residual e (step 8)');
      P.hline(0, css('--ink'), [4, 4]); f.yhat.forEach((v, i) => P.dot([v, e[i]], col(i), 3.4, false, 0.85));
      const idx = [...f.yhat.keys()].sort((i, j) => f.yhat[i] - f.yhat[j]), B = Math.max(4, Math.min(12, Math.floor(N / 6))), pts = [];
      for (let b = 0; b < B; b++) { const sl2 = idx.slice(Math.floor(b * N / B), Math.floor((b + 1) * N / B)); if (sl2.length) pts.push([ST.mean(sl2.map(i => f.yhat[i])), ST.mean(sl2.map(i => e[i]))]); }
      P.line(pts, css('--normal'), 2.4); P.end();
      P.legend([[css('--normal'), 'average residual in bins: a bend means a missing curve'], [css('--ink'), 'zero', true]]);
    } else if (mode === 'xj') {
      const { j } = FS.pick(d.names, id), x = d.X.map(r => r[j]), B = bins(x, e, Math.max(4, Math.min(10, Math.floor(N / 6))));
      P.title(`Residuals vs ${d.names[j]}: a bend here says this feature needs a curve`);
      P.begin([Math.min(...x), Math.max(...x)], [Math.min(...e), Math.max(...e)], `${d.names[j]} (step 1)`, 'residual e (step 8)');
      P.hline(0, css('--ink'), [4, 4]); x.forEach((v, i) => P.dot([v, e[i]], col(i), 3.4, false, 0.85)); P.line(B, css('--normal'), 2.4); P.end();
      P.legend([[css('--normal'), `average residual in bins of ${d.names[j]}`], [css('--ink'), 'zero', true]]);
    } else if (mode === 'e2') {
      const { j } = FS.pick(d.names, id), x = d.X.map(r => r[j]), e2 = e.map(v => v * v), fit = ST.ols(x.map(v => [1, v]), e2, true), xr = [Math.min(...x), Math.max(...x)];
      if (FS.cols(d.names).length > 1) P.title(`Squared residuals vs ${d.names[j]}: what Breusch–Pagan regresses (one feature at a time here; the test uses all of them)`);
      P.begin(xr, [0, Math.max(...e2)], `${d.names[j]} (step 1)`, 'e² (squared residual)'); x.forEach((v, i) => P.dot([v, e2[i]], col(i), 3.2, false, 0.8));
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
      const { j, j2 } = FS.pick(d.names, id);
      if (j2 < 0) { msg('With one feature there is nothing for it to overlap with: VIF = 1.'); return; }
      const a1 = d.X.map(r => r[j]), a2 = d.X.map(r => r[j2]), r = corrOf(a1, a2);
      P.title(`${d.names[j]} against ${d.names[j2]}: the overlap VIF measures`);
      P.begin([Math.min(...a1), Math.max(...a1)], [Math.min(...a2), Math.max(...a2)], d.names[j], d.names[j2]);
      a1.forEach((x, i) => P.dot([x, a2[i]], col(i), 3.4, false, 0.85)); P.end(); P.legend([[css('--floor'), `correlation r = ${num(r, 3)}`]]);
    } else if (mode === 'vifj') {
      const { j } = FS.pick(d.names, id), p = d.X[0].length;
      if (p < 3) { msg('With one feature there is nothing to predict it from: R²ⱼ = 0 and VIF = 1.'); return; }
      const t = d.X.map(r => r[j]), Xo = d.X.map(r => r.filter((_, k) => k !== j)), R = REG.fit(Xo, t), vif = R.R2 < 1 - 1e-12 ? 1 / (1 - R.R2) : Infinity;
      P.title(`${d.names[j]} against its prediction from the other columns: R²ⱼ behind VIF`);
      const all = [...t, ...R.yh], lo = Math.min(...all), hi = Math.max(...all);
      P.begin([lo, hi], [lo, hi], `${d.names[j]} predicted from the other columns`, `${d.names[j]} (actual)`);
      P.line([[lo, lo], [hi, hi]], css('--ink'), 1.4, [5, 4]); R.yh.forEach((v, i) => P.dot([v, t[i]], col(i), 3.4, false, 0.85)); P.end();
      P.legend([[css('--floor'), `R²ⱼ = ${num(R.R2, 3)}, VIF = 1 / (1 − R²ⱼ) = ${isFinite(vif) ? num(vif, 2) : '∞'}`], [css('--ink'), 'on this line: perfectly predictable (VIF = ∞)', true]]);
    }
  }
  const DIAG = { 0: [['fitted', 'Residuals vs fitted: what RESET puts a number on'], ['xj', 'Residuals vs a feature']], 1: [['e2', 'Squared residuals vs x: what Breusch–Pagan regresses']], 2: [['order', 'Residuals in time order'], ['lag', 'Lag plot: each residual against the previous one']],
    3: [['qq', 'Normal Q–Q plot'], ['hist', 'Histogram of residuals vs the bell curve']], 4: [['vifj', 'A feature against its prediction from the others: what VIF measures'], ['x1x2', 'x₁ against x₂: the overlap VIF measures']], 5: [['leverage', "Leverage vs residual: Cook's distance combines both"]] };

  // ---- step 11: the sampling distribution over 200 fresh datasets ----
  function drawMC(){
    const P = mcChart; if (!P || !P.wrap.isConnected) return;
    if (!mcCur) { P.begin([0, 1], [0, 1], '', ''); P.end(); P.legend([]); if (mcRO) mcRO.innerHTML = '<span class="muted">Running 200 fresh datasets…</span>'; return; }
    const names = cur.d.names, pk = FS.pick(names, 'mc', { second: cur.d.focus0.length > 1 ? 'auto' : 'none' }), want = [pk.j, ...(pk.j2 > 0 ? [pk.j2] : [])];
    const choose = arr => { const out = want.map(j => arr.find(m => m.j === j)).filter(Boolean); return out.length ? out : arr.slice(0, 1); };
    if (!mcCur.length) { P.title('Sampling distribution'); P.begin([0, 1], [0, 1], '', ''); P.text('No single numeric feature to follow here (the columns are bins or categories).', [0.03, 0.5], css('--muted'), 0, 0, true); P.end(); P.legend([]); if (mcRO) mcRO.innerHTML = ''; return; }
    const c = choose(mcCur), bn = S.cmp && mcBase !== mcCur ? mcBase : null, b = bn ? want.map(j => bn.find(m => m.j === GEN.colIn(base.d.names, names[j]))).filter(Boolean) : null;
    const bb = b && b.length === c.length ? b : null;
    P.title(c.length > 1 ? `Is the standard error honest? The ${names[c[0].j]} and ${names[c[1].j]} coefficients across 200 fresh datasets` : `Is the standard error honest? The ${names[c[0].j]} slope across 200 fresh datasets`);
    if (c.length > 1) {
      const [m1, m2] = c, pts = m1.est.map((v, i) => [v, m2.est[i]]), bp = bb ? bb[0].est.map((v, i) => [v, bb[1].est[i]]) : [];
      const xs = [...pts, ...bp].map(p => p[0]), ys = [...pts, ...bp].map(p => p[1]);
      if (m1.truth != null) xs.push(m1.truth); if (m2.truth != null) ys.push(m2.truth);
      P.begin([Math.min(...xs), Math.max(...xs)], [Math.min(...ys), Math.max(...ys)], `estimated coefficient of ${names[m1.j]}`, `estimated coefficient of ${names[m2.j]}`);
      bp.forEach(p => P.dot(p, css('--muted'), 2.6, true, 0.6)); pts.forEach(p => P.dot(p, css('--surface'), 2.8, false, 0.55));
      if (m1.truth != null && m2.truth != null) { P.dot([m1.truth, m2.truth], css('--normal'), 6, true); P.text('true values', [m1.truth, m2.truth], css('--normal'), 8, -8, true); }
      P.end(); P.legend([[css('--surface'), 'one dot per dataset'], ...(bp.length ? [[css('--muted'), 'baseline (hollow)']] : []), [css('--normal'), 'truth']]);
    } else {
      const m = c[0], bm = bb ? bb[0] : null, all = [...m.est, ...(bm ? bm.est : [])]; if (m.truth != null) all.push(m.truth);
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
    try { chgCharts = CHG.render(chgEl, { cur: cur.tv, base: base.tv, full: { cur: cur.d, base: base.d }, a, v, isBase, S, inf, P: cur.P, Pb: base.P }); } catch (err) { console.error(err); chgEl.innerHTML = `<p class="pv-note">Could not draw this view: ${esc(err.message)}</p>`; }
    const sp = chgEl.querySelector('#sig-part');
    if (sp) try { chgCharts.push(...SIG.render(sp, { cur: cur.tv, base: base.tv, a, v, isBase, S, embedded: true, P: cur.P, Pb: base.P, full: { cur: cur.d, base: base.d } })); } catch (err) { console.error(err); }
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
    const ctx = { P, d, S, attr: a, variant: v, isBase, focus: d.focus[0], FS, makeData: N => GEN.generate(v.id, { N, sigma: S.sigma, strength: S.strength, seed: S.seed, k: kEff(v.id) }) };
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
    const feats = d.names.slice(1), numeric = feats.filter(nm => GEN.isFeat(nm)), kNum = numeric.length, cat = feats.length > kNum;
    const gsel = FS.global(d.names), gj = d.names[gsel.j], gj2 = gsel.j2 > 0 ? d.names[gsel.j2] : '';
    const dimNote = kNum <= 1 ? '' : kNum === 2 && !cat ? `With 2 features the fitted model is a <b>plane</b> in 3 dimensions (${d.names[1]}, ${d.names[2]}, y), drawn below and rotatable. The flat chart is a slice: y against ${gj} with the other feature held at its mean. Pick the feature in the chart header (or for every chart in the Controls box); "points: adjusted" moves each point by the other feature's share of its prediction, so the vertical gap to the line is exactly the residual.`
      : `With ${kNum} features${cat ? ' plus categorical columns' : ''} the fitted model is a hyperplane in ${feats.length + 1} dimensions, so it <b>cannot be drawn</b> whole (a picture is possible only up to 3 dimensions: two features and y). The flat chart is a slice: y against ${gj}, with every other feature held at its mean; the 3D view is a slice through two features, ${gj} and ${gj2}. Pick the features in each chart header (or for every chart in the Controls box). With "points: adjusted", each point is y − Σ w·(x − mean) over the other features (a <b>partial residual</b>), so it sits exactly its residual away from the slice; with raw y the other features add vertical scatter. The residual charts of step 10 work in any number of dimensions, because residuals are one number per row.`;
    try { const el = sv('9a'); if (el) { const r = document.createElement('div'); r.className = 'pv-row one'; el.prepend(r);
      const fc = mount(r, '', 300, c => drawFit(c, isBase, 'fit')); procCharts.push(fc);
      if (kNum > 1) { FS.sel(fc, d.names, 'fit', 'one', fc.drawFn); FS.adjBtn(fc, 'fit', fc.drawFn); }
      if (dimNote) { const p = document.createElement('p'); p.className = 'pv-note'; p.innerHTML = dimNote; r.after(p); }
      if (kNum >= 2) { const r3 = document.createElement('div'); r3.className = 'pv-row one'; (el.querySelector('.pv-note') || r).after(r3); mount3D(r3); } } } catch (err) { console.error(err); }
    try { const el = sv(1); if (el && kNum > 1) { const p = document.createElement('p'); p.className = 'pv-note'; p.innerHTML = `This dataset has ${kNum} features${cat ? ' and categorical columns' : ''}: ${feats.join(', ')}. The scatter shows y against one feature at a time (choose it in the chart header); the other features also move y, which is part of the vertical spread you see.${kNum > 2 ? ' A single picture of all of them is not possible beyond 3 dimensions.' : ''}`; el.appendChild(p); } } catch (err) { console.error(err); }
    const DSEL = { e2: 'one', xj: 'one', x1x2: 'pair', vifj: 'one' };
    procEl.querySelectorAll('.sub-viz').forEach(el => { (DIAG[el.dataset.viz] || []).forEach(([mode, title]) => { try {
      if (kNum < 2 && (mode === 'xj' || mode === 'x1x2')) return;
      const id = 'd-' + mode, c = mount(el, title, 230, cc => drawDiag(cc, mode, id)); procCharts.push(c);
      if (DSEL[mode]) FS.sel(c, d.names, id, DSEL[mode], c.drawFn); } catch (err) { console.error(err); } }); });
    try { const el = sv(11); if (el) { const r = document.createElement('div'); r.className = 'pv-row one'; el.appendChild(r);
      mcChart = mount(r, 'Is the standard error honest? The slope across 200 fresh datasets', 260, () => drawMC()); procCharts.push(mcChart);
      if (kNum > 1) FS.sel(mcChart, d.names, 'mc', 'pairopt', () => drawMC());
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
