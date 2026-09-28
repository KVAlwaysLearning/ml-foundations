/* ============================================================
   Lab 3: gradient descent, one step at a time. Each step moves
   the shared weights, so the plane (and Labs 1 and 2) follow.
   ============================================================ */
VIZ['lab-gd'] = function(fig){
  const opt = { res: true, field: false, normal: false, labels: false, level: null };
  let eta = null, hist = [], lastW = null, status = '';
  const views = featureViews(fig, opt);
  opt.afterLevel = () => views.update(LAB.get());
  const ctl = panel(fig, 'lab-controls');
  const u1 = dataEditor(ctl), u2 = weightEditor(ctl, { title: 'Current weights w_t = [b, w₁, w₂]' });
  const gbox = document.createElement('div'); gbox.className = 'lab-editor'; gbox.innerHTML = `<div class="ed-head"><b>Gradient descent</b><span>w ← w − η∇L(w)</span></div>`; ctl.appendChild(gbox);
  const sEta = slider(gbox, { label: 'Step size η', min: 0.001, max: 0.3, step: 0.001, value: 0.05, digits: 3, onInput: v => { eta = v; render(LAB.get()); } });
  buttons(gbox, [['1 step', () => run(1)], ['10 steps', () => run(10)], ['100 steps', () => run(100)]]);
  views.attachLevel(gbox);
  buttons(gbox, [['Use half the stable limit', () => { const d = LAB.get(); eta = +(1 / d.eigH.values[0]).toFixed(4); sEta.set(eta); render(d); }, true],
                 ['Restart from zero', () => { hist = []; status = ''; LAB.setW([0, 0, 0]); }, true]]);
  const plots = panel(fig, 'plot2d'); plots.style.gridTemplateColumns = '1fr';
  const cv = canvas2d(plots, 'Loss L(w_t) at each step (log scale)'); cv.style.height = '220px';
  const calc = panel(fig, 'calc-wrap');
  const grid = mxGrid(fig, 'One step, as matrices (live)');
  const tbl = panel(fig, 'tbl gd-table');
  const ro = panel(fig, 'readout');
  caption(fig, [['--surface','Prediction plane at the current step'], ['--residual','Residuals'], ['--normal','Loss curve']],
    'Every step updates the shared weights, so Labs 1 and 2 show the same plane. Moving a slider by hand restarts the history from that point.');

  const step = (d, w) => { const e = LA.sub(d.y, LA.mv(d.X, w)), gr = LA.scale(LA.mv(LA.T(d.X), e), -2 / d.N); return { e, gr, L: LA.dot(e, e) / d.N }; };
  function run(n){
    const d = LAB.get(); let w = [...d.w];
    if (!hist.length) hist.push({ w: [...w], L: d.L, gn: LA.norm(d.grad) });
    for (let i = 0; i < n; i++) {
      const { gr } = step(d, w); w = LA.sub(w, LA.scale(gr, eta));
      const s = step(d, w);
      if (!isFinite(s.L) || s.L > 1e12) { status = 'diverged'; break; }
      hist.push({ w: [...w], L: s.L, gn: LA.norm(s.gr) });
      if (LA.norm(s.gr) < 1e-8) { status = 'converged'; break; }
    }
    lastW = w.map(v => +v.toFixed(10)); LAB.setW(lastW);
  }

  function render(d){
    if (eta === null) { const lim = 2 / d.eigH.values[0]; eta = 0.05 < 0.9 * lim ? 0.05 : +(lim / 2).toFixed(4); sEta.set(eta); }
    if (lastW && d.w.some((v, i) => Math.abs(v - lastW[i]) > 1e-9)) { hist = []; status = ''; }
    lastW = [...d.w];
    views.update(d);
    const { e, gr, L } = step(d, d.w), next = LA.sub(d.w, LA.scale(gr, eta));
    const lmax = d.eigH.values[0], limit = 2 / lmax;
    calc.innerHTML = `<div class="calc"><b>Step ${hist.length ? hist.length - 1 : 0}:</b> ∇L = −(2/N)·Xᵀe = −(2/${d.N})·[${LA.mv(LA.T(d.X), e).map(x => num(x)).join(', ')}] = [${gr.map(x => num(x)).join(', ')}]
      &nbsp; → &nbsp; w<sub>t+1</sub> = w<sub>t</sub> − ${num(eta)}·∇L = <b>[${next.map(x => num(x)).join(', ')}]</b></div>`;
    grid.innerHTML =
      mx(d.w, { name: 'w_t', formula: 'current weights', rowLabels: ['b','w₁','w₂'] }) +
      mx(d.yhat, { name: 'ŷ = Xw_t', formula: 'predictions', tone: 'surface' }) +
      mx(e, { name: 'e = y − ŷ', formula: 'residuals', tone: 'res' }) +
      mx(gr, { name: '∇L = −(2/N)Xᵀe', formula: 'which way is uphill', rowLabels: ['∂/∂b','∂/∂w₁','∂/∂w₂'], tone: 'floor' }) +
      mx(LA.scale(gr, eta), { name: 'η∇L', formula: `η = ${num(eta)}`, rowLabels: ['b','w₁','w₂'] }) +
      mx(next, { name: 'w_{t+1} = w_t − η∇L', formula: 'the next weights', rowLabels: ['b','w₁','w₂'], tone: 'normal' }) +
      scalarBox('L(w_t)', num(L), 'current loss') + scalarBox('L(w*)', num(d.Lopt), 'target', 'normal');

    // loss curve
    const { ctx, w, h } = prep(cv); ctx.clearRect(0, 0, w, h);
    const pad = { l: 46, r: 14, t: 30, b: 24 }, pts = hist.length ? hist : [{ L }];
    const lv = pts.map(p => Math.log10(Math.max(p.L, 1e-12))), lo = Math.min(...lv, Math.log10(Math.max(d.Lopt, 1e-12))) - 0.1, hi = Math.max(...lv) + 0.1;
    const X = i => pad.l + (pts.length > 1 ? i / (pts.length - 1) : 0.5) * (w - pad.l - pad.r), Y = v => h - pad.b - (v - lo) / Math.max(hi - lo, 1e-9) * (h - pad.t - pad.b);
    ctx.strokeStyle = css('--rule'); ctx.strokeRect(pad.l, pad.t, w - pad.l - pad.r, h - pad.t - pad.b);
    ctx.fillStyle = css('--muted'); ctx.font = '11.5px "Public Sans", sans-serif';
    ctx.fillText(num(10 ** hi, 2), 4, pad.t + 10); ctx.fillText(num(10 ** lo, 2), 4, h - pad.b);
    ctx.fillText('step 0', pad.l, h - 6); const tl = `step ${pts.length - 1}`; ctx.fillText(tl, w - pad.r - ctx.measureText(tl).width, h - 6);
    if (d.Lopt > 0) { ctx.setLineDash([5, 4]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(pad.l, Y(Math.log10(d.Lopt))); ctx.lineTo(w - pad.r, Y(Math.log10(d.Lopt))); ctx.stroke(); ctx.setLineDash([]); ctx.fillText('L(w*)', w - pad.r - 38, Y(Math.log10(d.Lopt)) - 4); }
    ctx.strokeStyle = css('--normal'); ctx.lineWidth = 2; ctx.beginPath(); lv.forEach((v, i) => i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))); ctx.stroke();
    ctx.fillStyle = css('--normal'); lv.forEach((v, i) => { if (pts.length < 60) { ctx.beginPath(); ctx.arc(X(i), Y(v), 2.5, 0, 7); ctx.fill(); } });

    // history table (last 8 steps)
    const rows = hist.slice(-8), off = hist.length - rows.length;
    tbl.innerHTML = hist.length ? `<table><tr><th class="num">t</th><th class="num">b</th><th class="num">w₁</th><th class="num">w₂</th><th class="num">L(w_t)</th><th class="num">‖∇L‖</th></tr>` +
      rows.map((r, i) => `<tr><td class="num">${off + i}</td>${r.w.map(v => `<td class="num">${num(v, 4)}</td>`).join('')}<td class="num">${num(r.L, 4)}</td><td class="num">${num(r.gn, 4)}</td></tr>`).join('') + `</table>` : '';
    const msgs = [];
    if (eta >= limit) msgs.push(`η = ${num(eta)} is at or above 2/λ_max = ${num(limit)}: steps overshoot along the steepest direction and the loss grows.`);
    if (status === 'diverged') msgs.push('Stopped: the loss blew up.');
    if (status === 'converged') msgs.push('Converged: the gradient is essentially zero.');
    const kappa = d.eigH.values[2] > 1e-12 * lmax ? lmax / d.eigH.values[2] : Infinity;
    if (isFinite(kappa) && kappa > 50) msgs.push(`κ = ${num(kappa, 0)}: the stable η is set by the steepest direction, so progress along the flattest one is slow. Expect many steps.`);
    if (!d.opt.unique) msgs.push('XᵀX is singular: gradient descent still lowers the loss but settles on one of many equally good weight vectors, depending on where it starts.');
    ro.innerHTML = `<span>η = <b>${num(eta)}</b></span><span>stable if η &lt; 2/λ_max = <b>${num(limit)}</b></span><span>steps taken = <b>${Math.max(0, hist.length - 1)}</b></span>` + msgs.map(m => `<span class="msg">${m}</span>`).join('');
  }
  const u3 = LAB.subscribe(render);
  const obs = new ResizeObserver(() => render(LAB.get())); obs.observe(cv);
  return () => { u1(); u2(); u3(); obs.disconnect(); views.dispose(); };
};
