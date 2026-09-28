/* ============================================================
   Statistics: residual diagnostics playground
   ============================================================ */
VIZ.diagnostics = function(fig){
  const S = { scen: 'good', seed: 3 };
  const box = panel(fig, 'plot2d');
  const c1 = canvas2d(box, 'Data and fit'), c2 = canvas2d(box, 'Residuals vs fitted'), c3 = canvas2d(box, 'Residual histogram');
  const ctl = panel(fig, 'controls');
  select(ctl, { label: 'How the data are generated', value: S.scen, options: [
    ['good','All assumptions hold'], ['curved','Curved relationship'], ['hetero','Variance grows with x'], ['auto','Autocorrelated errors'], ['skew','Skewed errors']],
    onChange: v => { S.scen = v; gen(); } });
  buttons(ctl, [['Draw a new sample', () => { S.seed++; gen(); }]]);
  const ro = panel(fig, 'readout');
  caption(fig, [['--floor','Observations'], ['--surface','Fitted line'], ['--residual','Residuals']],
    'Points are in increasing x order, so in the autocorrelated case x plays the role of time. A single sample can trigger a flag by chance (about 5% of the time at p < 0.05).');
  let D;

  function gen(){
    const rng = mulberry32(1000 + S.seed * 17), gs = gaussFn(rng), N = 60;
    const x = Array.from({ length: N }, () => rng() * 10).sort((a, b) => a - b);
    let prev = 0;
    const y = x.map(xi => {
      switch (S.scen) {
        case 'curved': return 1 + 0.3 * xi * xi + gs();
        case 'hetero': return 2 + 1.5 * xi + (0.2 + 0.45 * xi) * gs();
        case 'auto': prev = 0.85 * prev + 0.9 * gs(); return 2 + 1.5 * xi + prev;
        case 'skew': return 2 + 1.5 * xi + 2 * (-Math.log(1 - rng()) - 1);
        default: return 2 + 1.5 * xi + 1.5 * gs();
      }
    });
    // OLS with intercept
    const mx = x.reduce((s, v) => s + v, 0) / N, my = y.reduce((s, v) => s + v, 0) / N;
    let sxx = 0, sxy = 0; for (let i = 0; i < N; i++) { sxx += (x[i] - mx)**2; sxy += (x[i] - mx)*(y[i] - my); }
    const b1 = sxy / sxx, b0 = my - b1 * mx;
    const yh = x.map(v => b0 + b1 * v), e = y.map((v, i) => v - yh[i]);
    const sse = e.reduce((s, v) => s + v*v, 0), sst = y.reduce((s, v) => s + (v - my)**2, 0);
    const s2mle = sse / N;
    // Breusch–Pagan: regress g = e^2/s2 on x
    const g = e.map(v => v*v / s2mle);
    let sxg = 0; for (let i = 0; i < N; i++) sxg += (x[i] - mx) * (g[i] - 1);
    const ess = sxg * sxg / sxx, LM = ess / 2, pBP = erfc(Math.sqrt(LM / 2));
    let dnum = 0; for (let i = 1; i < N; i++) dnum += (e[i] - e[i-1])**2;
    const DW = dnum / sse;
    const sd = Math.sqrt(s2mle), skew = e.reduce((s, v) => s + (v/sd)**3, 0) / N;
    // curvature: correlation of residuals with (x - mean)^2
    const q = x.map(v => (v - mx)**2), mq = q.reduce((s, v) => s + v, 0) / N;
    let sqe = 0, sqq = 0; for (let i = 0; i < N; i++) { sqe += (q[i] - mq) * e[i]; sqq += (q[i] - mq)**2; }
    const rc = sqe / Math.sqrt(sqq * sse);
    D = { x, y, yh, e, b0, b1, R2: 1 - sse/sst, LM, pBP, DW, skew, rc, sum: e.reduce((s, v) => s + v, 0) };
    draw();
  }

  function frame(ctx, w, h, xr, yr){
    const pad = { l: 40, r: 14, t: 30, b: 26 };
    const X = v => pad.l + (v - xr[0]) / (xr[1] - xr[0]) * (w - pad.l - pad.r);
    const Y = v => h - pad.b - (v - yr[0]) / (yr[1] - yr[0]) * (h - pad.t - pad.b);
    ctx.strokeStyle = css('--rule'); ctx.lineWidth = 1;
    ctx.strokeRect(pad.l, pad.t, w - pad.l - pad.r, h - pad.t - pad.b);
    ctx.fillStyle = css('--muted'); ctx.font = '11.5px "Public Sans", sans-serif';
    ctx.fillText(fmt(yr[1], 1), 4, pad.t + 10); ctx.fillText(fmt(yr[0], 1), 4, h - pad.b);
    ctx.fillText(fmt(xr[0], 1), pad.l, h - 8); const t = fmt(xr[1], 1); ctx.fillText(t, w - pad.r - ctx.measureText(t).width, h - 8);
    return { X, Y };
  }
  const range = (a, m = 0.08) => { let lo = Math.min(...a), hi = Math.max(...a); const d = (hi - lo) || 1; return [lo - d*m, hi + d*m]; };

  function draw(){
    if (!D) return;
    const fl = css('--floor'), su = css('--surface'), re = css('--residual'), mu = css('--muted');
    // 1: data and fit
    let { ctx, w, h } = prep(c1); ctx.clearRect(0, 0, w, h);
    let f = frame(ctx, w, h, [0, 10], range(D.y));
    ctx.fillStyle = fl; D.x.forEach((xi, i) => { ctx.beginPath(); ctx.arc(f.X(xi), f.Y(D.y[i]), 3.2, 0, 2*Math.PI); ctx.fill(); });
    ctx.strokeStyle = su; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(D.b0)); ctx.lineTo(f.X(10), f.Y(D.b0 + 10*D.b1)); ctx.stroke();
    // 2: residuals vs fitted
    ({ ctx, w, h } = prep(c2)); ctx.clearRect(0, 0, w, h);
    const er = range(D.e.concat([0])); f = frame(ctx, w, h, range(D.yh, 0.03), er);
    ctx.strokeStyle = mu; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(f.X(range(D.yh, 0.03)[0]), f.Y(0)); ctx.lineTo(f.X(range(D.yh, 0.03)[1]), f.Y(0)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = re; D.yh.forEach((v, i) => { ctx.beginPath(); ctx.arc(f.X(v), f.Y(D.e[i]), 3.2, 0, 2*Math.PI); ctx.fill(); });
    // 3: histogram
    ({ ctx, w, h } = prep(c3)); ctx.clearRect(0, 0, w, h);
    const [lo, hi] = range(D.e, 0.02), bins = 12, cnt = new Array(bins).fill(0);
    D.e.forEach(v => cnt[Math.min(bins - 1, Math.floor((v - lo) / (hi - lo) * bins))]++);
    f = frame(ctx, w, h, [lo, hi], [0, Math.max(...cnt) * 1.1]);
    ctx.fillStyle = re; ctx.globalAlpha = 0.75;
    cnt.forEach((c, i) => { const x0 = f.X(lo + (hi - lo) * i / bins), x1 = f.X(lo + (hi - lo) * (i + 1) / bins); ctx.fillRect(x0 + 1, f.Y(c), x1 - x0 - 2, f.Y(0) - f.Y(c)); });
    ctx.globalAlpha = 1;

    const flags = [];
    if (Math.abs(D.rc) > 0.3) flags.push('Residuals follow a curve in x: the linearity assumption looks violated.');
    if (D.pBP < 0.05) flags.push(`Breusch–Pagan rejects constant variance (p = ${fmt(D.pBP, 3)}): the spread changes with x.`);
    if (D.DW < 1.5) flags.push(`Durbin–Watson is ${fmt(D.DW)}, well below 2: neighbouring residuals move together.` + (Math.abs(D.rc) > 0.3 ? ' Here the runs come from the missing curve, not from dependent errors: a misspecified shape also produces them.' : ''));
    if (Math.abs(D.skew) > 0.8) flags.push(`Residual skewness is ${fmt(D.skew)}: the errors are not symmetric, so small-sample t-tests are unreliable.`);
    ro.innerHTML = `<span>ŷ = <b>${fmt(D.b0)} + ${fmt(D.b1)}x</b></span><span>R² = <b>${fmt(D.R2, 3)}</b></span><span>sum of residuals = <b>${fmt(D.sum, 6)}</b></span>
      <span>Breusch–Pagan LM = <b>${fmt(D.LM)}</b> (p = <b>${fmt(D.pBP, 3)}</b>)</span><span>Durbin–Watson = <b>${fmt(D.DW)}</b></span><span>skewness = <b>${fmt(D.skew)}</b></span>` +
      (flags.length ? flags : ['No diagnostic flags a problem in this sample.']).map(m => `<span class="msg">${m}</span>`).join('');
  }
  const obs = new ResizeObserver(draw); [c1, c2, c3].forEach(c => obs.observe(c));
  gen();
  return () => obs.disconnect();
};
