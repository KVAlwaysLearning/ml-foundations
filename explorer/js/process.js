/* ============================================================
   The Process view: every step of fitting a linear regression,
   with substeps, live values from PIPE.run, and how strongly the
   selected variant touches each step.
   ============================================================ */
const LEVELS = {
  origin: { glyph: '◆', label: 'Originates here', cls: 'lv-origin' },
  major:  { glyph: '▲', label: 'Major influence', cls: 'lv-major' },
  minor:  { glyph: '△', label: 'Minor influence', cls: 'lv-minor' },
  none:   { glyph: '○', label: 'Unaffected', cls: 'lv-none' }
};
const MARKS = { pass: ['✓', 'check passes'], fail: ['✗', 'check fails'], warn: ['⚠', 'needs attention'] };

/* Symbol index: key -> [display, meaning, shape] */
const SYM = {
  N: ['N', 'number of rows (observations)', 'scalar'], Ntr: ['N_train', 'rows used for fitting', 'scalar'], Nte: ['N_test', 'rows held out for testing', 'scalar'],
  p: ['p', 'number of columns of X, including the intercept', 'scalar'],
  x: ['x_j', 'feature j (raw)', 'N×1'], y: ['y', 'target values', 'N×1'], X: ['X', 'design matrix: a column of 1s, then the features', 'N×p'],
  beta: ['β', 'true coefficients used to generate the data', 'p×1'], eps: ['ε', 'true error (noise) in the data-generating process', 'N×1'], sigma: ['σ_ε', 'standard deviation of the true error', 'scalar'],
  z: ['z', 'z-score (v − mean) / sd, used to flag outliers', 'scalar'], rho: ['r', 'Pearson correlation', 'scalar'], g1: ['γ₁', 'skewness (0 for symmetric)', 'scalar'],
  mu: ['μ_j', 'mean of feature j on the training rows', 'scalar'], sd: ['s_j', 'standard deviation of feature j on the training rows', 'scalar'],
  Xt: ['X̃', 'standardised design matrix: (x_j − μ_j) / s_j, intercept column kept as 1', 'N_train×p'],
  wt: ['w̃', 'weights on the standardised scale', 'p×1'], w: ['w', 'weights on the original scale (b, w₁, …)', 'p×1'], b: ['b', 'intercept (bias)', 'scalar'],
  yhat: ['ŷ', 'predictions X̃w̃', 'N×1'], e: ['e', 'residuals y − ŷ', 'N×1'], L: ['L', 'loss: mean squared error (1/N)eᵀe', 'scalar'],
  lam: ['λ', 'regularisation strength (penalty weight)', 'scalar'],
  XtX: ['X̃ᵀX̃', 'Gram matrix: column-by-column dot products', 'p×p'], Xty: ['X̃ᵀy', 'each column dotted with y', 'p×1'],
  det: ['det', 'determinant: 0 means no inverse', 'scalar'], rank: ['rank', 'number of linearly independent columns', 'scalar'], kappa: ['κ', 'condition number λ_max / λ_min', 'scalar'],
  H: ['H', 'Hessian (2/N)X̃ᵀX̃: curvature of the loss', 'p×p'], lmax: ['λ_max', 'largest eigenvalue of H', 'scalar'],
  eta: ['η', 'gradient-descent step size (learning rate)', 'scalar'], grad: ['∇L', 'gradient −(2/N)X̃ᵀe', 'p×1'], t: ['t', 'iteration number (or t-statistic in inference)', 'scalar'],
  s2: ['s²', 'unbiased error variance SSE / (N − p)', 'scalar'], se: ['SE', 'standard error of a coefficient', 'scalar'],
  hc: ['SE_HC1', 'heteroscedasticity-robust (sandwich) standard error', 'scalar'], nw: ['SE_NW', 'Newey–West standard error (robust to autocorrelation)', 'scalar'], cl: ['SE_CL', 'cluster-robust standard error', 'scalar'],
  pv: ['p-value', 'probability of a result this extreme if the true coefficient were 0', 'scalar'], ci: ['CI', '95% confidence interval', 'interval'],
  reset: ['RESET', 'Ramsey test for missing non-linear terms', 'p-value'], bp: ['BP', 'Breusch–Pagan test for non-constant variance', 'p-value'],
  dw: ['DW', 'Durbin–Watson statistic, ≈ 2 when errors are independent', 'scalar'], jb: ['JB', 'Jarque–Bera test for normal residuals', 'p-value'],
  vif: ['VIF', 'variance inflation factor 1 / (1 − R²_j)', 'scalar'], cook: ['D_i', "Cook's distance: influence of row i", 'scalar'],
  F: ['F', 'F statistic: drop in SSE per added term ÷ noise variance (nested-model test)', 'scalar'],
  rmse: ['RMSE', 'root mean squared error', 'scalar'], r2: ['R²', 'share of variance in y explained', 'scalar']
};
const sy = k => { const s = SYM[k]; return `<abbr class="sym" title="${esc(s[1])} (${s[2]})">${s[0]}</abbr>`; };
const mark = (ok, warn) => { const m = ok ? MARKS.pass : warn ? MARKS.warn : MARKS.fail; return `<span class="mk mk-${ok ? 'pass' : warn ? 'warn' : 'fail'}" title="${m[1]}">${m[0]}</span>`; };
const vec = (a, d = 3) => '[' + a.map(v => isFinite(v) ? num(v, d) : '—').join(', ') + ']';
const pf = v => !isFinite(v) ? '—' : v < 0.001 ? '< 0.001' : num(v, 3);
const pEq = v => !isFinite(v) ? 'p = —' : v < 0.001 ? 'p < 0.001' : 'p = ' + num(v, 3);

/* Which steps each attribute's non-baseline variants touch, and why. */
const INF = {
  linearity: {
    1: ['origin', 'The true mean of y is not a straight line in x.'],
    3: ['major', 'The y-vs-x scatter shows the bend: EDA is where you should first catch it.'],
    5: ['major', 'The fix lives here: add polynomial, log, spline or interaction terms.'],
    7: ['minor', 'A straight-line model is misspecified for this data.'],
    '9a': ['none', 'The solver still finds the best straight line exactly; it is just the wrong model.'],
    '9b': ['none', 'Gradient descent converges to the same best straight line.'],
    10: ['major', 'RESET rejects and residuals vs fitted show a systematic pattern.'],
    11: ['major', 'Coefficients and SEs describe a misspecified model, so they answer the wrong question.'],
    12: ['major', 'Errors are systematic: too high in some ranges, too low in others, worst when extrapolating.'],
    13: ['major', 'A single slope misdescribes an effect that changes with x.']
  },
  independence: {
    1: ['origin', 'Errors of nearby rows are related, so rows are not independent pieces of information.'],
    4: ['major', 'A random split puts correlated neighbours in both train and test: use a time-ordered or group split.'],
    '9a': ['none', 'The slope estimate stays unbiased.'], '9b': ['none', 'Gradient descent reaches the same unbiased estimate.'],
    10: ['major', 'Durbin–Watson and the residuals-in-order plot reveal it. Other tests (RESET, Breusch–Pagan) can also fire falsely, because they assume independent errors.'],
    11: ['major', 'Classical SEs are wrong (usually too small): use Newey–West or clustered SEs.'],
    12: ['minor', 'With a random split the test error looks better than it will on new periods or groups.'],
    13: ['minor', 'Confidence intervals and p-values cannot be trusted as reported.']
  },
  homoscedasticity: {
    1: ['origin', 'The spread of the errors changes across the data.'],
    3: ['minor', 'The scatter fans out (or tightens) along x.'],
    5: ['minor', 'A log transform of y often stabilises the variance.'],
    7: ['minor', 'Weighted least squares would be more efficient.'],
    '9a': ['none', 'Estimates stay unbiased.'], '9b': ['none', 'Gradient descent is unaffected.'],
    10: ['major', 'Breusch–Pagan rejects and the residual plot shows a funnel.'],
    11: ['major', 'Classical SEs are off: use heteroscedasticity-robust (HC) SEs.'],
    12: ['minor', 'Prediction intervals are too wide in calm regions and too narrow in noisy ones.']
  },
  normality: {
    1: ['origin', 'The errors are not bell-shaped.'],
    3: ['minor', 'The distribution of y looks skewed or heavy-tailed.'],
    '9a': ['none', 'OLS is still the best linear unbiased estimator: Gauss–Markov does not need normality.'], '9b': ['none', 'Gradient descent is unaffected.'],
    10: ['major', 'The Q–Q plot bends and Jarque–Bera may reject.'],
    11: ['minor', 'Exact t-tests need normality, but with N ≈ 60 the central limit theorem keeps 95% CIs close to 95% (see the sampling distribution).'],
    12: ['minor', 'Prediction intervals based on a normal error are off in the tails.']
  },
  multicollinearity: {
    1: ['origin', 'Two or more features carry overlapping information.'],
    3: ['major', 'The correlation matrix and VIF flag it before you model.'],
    5: ['major', 'Drop or combine features, use PCA, or plan for ridge.'],
    6: ['major', 'X loses (or nearly loses) full column rank.'],
    7: ['minor', 'Ridge regularisation is the standard remedy.'],
    '9a': ['major', 'X̃ᵀX̃ is ill-conditioned (large κ) or singular: no unique solution.'],
    '9b': ['major', 'Gradient descent crawls along the flat direction, or settles on one of many equal solutions.'],
    10: ['major', 'VIF and the condition number are the diagnostics.'],
    11: ['major', 'SEs inflate, or are undefined when the collinearity is exact.'],
    12: ['none', 'Predictions inside the data range are still fine.'],
    13: ['major', 'Individual coefficients cannot be interpreted separately.']
  },
  exogeneity: {
    1: ['origin', 'x is correlated with the error term.'],
    3: ['none', 'Nothing looks unusual in the data.'],
    7: ['major', 'The model needs a fix: include the confounder, or use instrumental variables or an errors-in-variables model.'],
    '9a': ['major', 'ŵ is biased, and more data does not remove the bias.'], '9b': ['major', 'Gradient descent converges to the same biased value.'],
    10: ['none', 'Residual diagnostics look fine: that is exactly the trap.'],
    11: ['major', 'The CI is centred on the wrong value and almost never covers the true effect.'],
    12: ['none', 'Predictive accuracy on similar data can still be good.'],
    13: ['major', 'Reading the slope as a causal effect is wrong.']
  }
};
const INF_V = {
  interaction: { 5: ['major', 'Add the x · group interaction term.'], 13: ['major', 'The effect of x differs by group, so one slope is wrong for both.'] },
  negar: { 11: ['major', 'Classical SEs are too large here (overly conservative): use Newey–West.'] },
  cluster: { 4: ['major', 'Split by cluster so a whole group is either in train or test.'], 11: ['major', 'Classical SEs are far too small: use clustered SEs.'] },
  dupes: { 1: ['origin', 'The same observations were recorded several times.'], 2: ['major', 'The duplicate check finds the repeated rows: removing them is the fix.'],
    4: ['major', 'Copies of a row can land in both train and test, which leaks information.'], 11: ['major', 'N looks larger than the real information, so SEs are too small.'] },
  groupvar: { 10: ['major', 'Breusch–Pagan on x may miss it, because the variance depends on group, not x: plot residuals by group.'] },
  light: { 10: ['minor', 'Light tails are hard to detect: Jarque–Bera often passes.'] },
  high: { 6: ['minor', 'X keeps full rank, but only just: the condition number is large.'] },
  perfect: { 6: ['major', 'rank(X) < p: one column is an exact multiple of another.'] },
  combo: { 6: ['major', 'rank(X) < p: one column is an exact sum of others.'] },
  dummytrap: { 1: ['none', 'The raw data are fine.'], 3: ['none', 'Nothing unusual in the raw features.'], 5: ['origin', 'Keeping all three one-hot columns together with the intercept creates the trap.'],
    6: ['major', 'The dummies add up to the intercept column, so rank(X) < p.'], 13: ['major', 'Category coefficients have no unique meaning until one level is dropped.'] },
  confounder: { 7: ['major', 'Include the confounder z (or an instrument for x).'] },
  measerr: { 2: ['minor', 'Better measurement of x is the real fix.'], 7: ['major', 'Use an errors-in-variables model or instruments.'], '9a': ['major', 'ŵ is shrunk toward 0 (attenuation bias).'] },
  reverse: { 7: ['major', 'Needs an instrument or a structural (simultaneous-equation) model.'] }
};
function influence(attrId, variant, isBase, strength){
  const out = {};
  if (isBase) return out;
  Object.assign(out, INF[attrId] || {}, INF_V[variant.id] || {});
  const weak = variant.id === 'moderate' || (variant.strength && strength < 0.3);
  if (weak) for (const k in out) if (out[k][0] === 'major') out[k] = ['minor', out[k][1]];
  return out;
}

/* Steps. attrs = catalog attributes that are decided or handled at this step. */
const STEPS = [
  { id: 1, title: 'Data collection', goal: 'What was measured, how much, and how the data were generated.',
    attrs: ['linearity', 'independence', 'homoscedasticity', 'normality', 'exogeneity', 'multicollinearity', 'samplesize', 'noise', 'range', 'target', 'subgroups', 'categorical'],
    subs: [
      [`${sy('N')} and ${sy('p')}`, 'Rows collected, and columns of the design matrix', c => `${sy('N')} = ${c.P.N}, features: ${c.P.names.slice(1).join(', ')}, so ${sy('p')} = ${c.P.P}`],
      [sy('beta'), 'True coefficients (known only because this is a simulation)', c => { const t = c.d.truth.coef, k = Object.keys(t); return k.length ? c.P.names.map((n, j) => `${n === '1' ? 'b' : n} = ${t[j] ?? '—'}`).join(', ') : 'no single true slope: the relationship is not a straight line'; }],
      [`${sy('eps')}, ${sy('sigma')}`, 'How the errors were generated', c => `${esc(c.variant.name)}${c.isBase ? ' (baseline)' : ''}; ${sy('sigma')} = ${num(c.S.sigma, 2)}`]
    ]},
  { id: 2, title: 'Cleaning', goal: 'Find duplicates, missing values, outliers and leakage before anything is learned from the data.',
    attrs: ['outliers', 'missing', 'leakage'],
    subs: [
      ['', 'Duplicate rows', c => c.P.dupes ? `${mark(false, true)} ${c.P.dupes} duplicate rows found. Kept here so you can see their effect downstream; normally you would remove them.` : `${mark(true)} none found`],
      ['', 'Missing values', () => `${mark(true)} none (this generator never drops values)`],
      [sy('z'), 'Outliers with |z| > 3', c => `${c.P.outY + c.P.outX ? mark(false, true) : mark(true)} y: ${c.P.outY}, features: ${c.P.outX}`],
      ['', 'Leakage check', () => `${mark(true)} no feature is built from y`]
    ]},
  { id: 3, title: 'Exploratory analysis', goal: 'Look before you fit: distributions, shape of the relationship, correlated features.',
    attrs: ['subgroups', 'multicollinearity', 'linearity', 'target', 'colltest'],
    subs: [
      [sy('g1'), 'Skewness of y and of each feature', c => `y: ${num(c.P.eda.skewY, 2)}; ${c.P.names.slice(1).map((n, k) => `${n}: ${num(c.P.eda.skewX[k], 2)}`).join(', ')}`],
      [sy('rho'), 'Correlation of each feature with y', c => c.P.names.slice(1).map((n, k) => `r(${n}, y) = ${num(c.P.eda.corrXY[k], 3)}`).join(', ')],
      [sy('rho'), 'Largest correlation between two features', c => isFinite(c.P.eda.maxFeatCorr) ? `${c.P.eda.maxFeatCorr > 0.9 ? mark(false) : c.P.eda.maxFeatCorr > 0.7 ? mark(false, true) : mark(true)} |r| = ${num(c.P.eda.maxFeatCorr, 3)}` : 'only one feature'],
      ['', 'Pictures', () => 'The charts at the top of this step: the distributions and the y-vs-x scatter. Residual pictures come later, in step 10, once there is a fit.']
    ]},
  { id: 4, title: 'Train / test split', goal: 'Hold data back before any step that learns from the data, so the test score is honest.',
    attrs: ['split', 'cv', 'seed', 'shift'],
    subs: [
      [`${sy('Ntr')}, ${sy('Nte')}`, 'Random 80 / 20 split', c => `${sy('Ntr')} = ${c.P.nTr}, ${sy('Nte')} = ${c.P.nTe} (shuffled with sample #${c.S.seed})`],
      ['', 'Split method used', c => c.variant.id === 'dupes' ? `${mark(false, true)} random shuffle; copies of the same row land on both sides, so remove duplicates (or split by unique observation) first` : c.attr.id === 'independence' && !c.isBase ? `${mark(false, true)} random shuffle; this variant needs a ${c.variant.id === 'cluster' ? 'group' : 'time-ordered'} split instead` : `${mark(true)} random shuffle, appropriate for independent rows`],
      ['', 'Cross-validation', () => 'not used here (covered in the Validation branch)']
    ]},
  { id: 5, title: 'Feature engineering', goal: 'Transform and scale inputs using statistics from the training rows only.',
    attrs: ['scaling', 'xtransform', 'ytransform', 'degree', 'interactions', 'splines', 'binning', 'encoding', 'centering', 'selection', 'irrelevant'],
    subs: [
      [`${sy('mu')}, ${sy('sd')}`, 'Training mean and SD of each feature', c => c.P.names.slice(1).map((n, k) => `${n}: ${sy('mu')} = ${num(c.P.mu[k + 1], 3)}, ${sy('sd')} = ${num(c.P.sd[k + 1], 3)}`).join('; ')],
      [sy('Xt'), 'Standardise: x̃ = (x − μ) / s, first training row', c => `${vec(c.P.Xtr[0], 3)}`],
      ['', 'Categorical encoding', c => c.P.names.includes('A') ? `${mark(false)} all three dummies A, B, C kept alongside the intercept` : c.P.names.includes('group') ? `${mark(true)} one binary group column` : 'no categorical features'],
      ['', 'Transforms, polynomials, selection', () => 'none applied (covered in the Feature engineering branch)']
    ]},
  { id: 6, title: 'Design matrix', goal: 'Assemble X̃ with the intercept column and check it can be solved.',
    attrs: ['intercept', 'multicollinearity'],
    subs: [
      [sy('Xt'), 'Shape and columns', c => `${c.P.nTr} × ${c.P.P}: [${c.P.names.join(', ')}]`],
      [sy('XtX'), 'The Gram matrix X̃ᵀX̃ (column-by-column sums)', c => `${c.P.P}×${c.P.P}: ` + c.P.f.XtX.map(r => vec(r, 1)).join(' ')],
      [sy('rank'), 'Eigenvalues of X̃ᵀX̃ and full column rank', c => `${c.P.f.rank === c.P.P ? mark(true) : mark(false)} rank = ${c.P.f.rank} of ${c.P.P}`],
      [sy('kappa'), 'Condition number of X̃ᵀX̃', c => `${!isFinite(c.P.f.kappa) || c.P.f.kappa > 1000 ? mark(false) : c.P.f.kappa > 30 ? mark(false, true) : mark(true)} ${sy('kappa')} = ${isFinite(c.P.f.kappa) ? num(c.P.f.kappa, 1) : '∞'}`]
    ]},
  { id: 7, title: 'Model', goal: 'Write down how a prediction is made.',
    attrs: ['modeltype', 'robust', 'regularisation', 'otherforms', 'intercept'],
    subs: [
      [sy('yhat'), 'Prediction rule', c => `${sy('yhat')} = ${sy('Xt')}${sy('wt')} = w̃₀ + ${c.P.names.slice(1).map((n, k) => `w̃${k + 1}·x̃_${n}`).join(' + ')}`],
      ['', 'Formulation', () => 'ordinary least squares with an intercept']
    ]},
  { id: 8, title: 'Loss', goal: 'Decide what "best" means.',
    attrs: ['lossfn', 'penalty', 'lambda', 'alpha', 'penalisebias'],
    subs: [
      [sy('e'), 'Residuals', () => `${sy('e')} = ${sy('y')} − ${sy('yhat')}`],
      [sy('L'), 'Mean squared error', c => `${sy('L')}(${sy('wt')}) = (1/${c.P.nTr}) ${sy('e')}ᵀ${sy('e')}; at ${sy('wt')} = 0 it is ${num(c.P.iters[0].L, 3)}`],
      [sy('lam'), 'Penalty', () => `${sy('lam')} = 0 (no regularisation)`]
    ]},
  { id: '9a', title: 'Optimise: closed form', goal: 'Set the gradient to zero and solve the normal equations.',
    attrs: ['solver'],
    subs: [
      [`${sy('XtX')}, ${sy('det')}`, 'From the loss to the normal equations X̃ᵀX̃ w̃ = X̃ᵀy', c => `${c.P.P}×${c.P.P}, ${sy('det')} = ${num(c.P.f.det, 4)}`],
      [sy('wt'), 'Solve them: w̃ = (X̃ᵀX̃)⁻¹X̃ᵀy', c => `${c.P.f.full ? mark(true) : mark(false)} ${sy('wt')}* = ${vec(c.P.f.w)}${c.P.f.full ? '' : ' (minimum-norm: the solution is not unique)'}`],
      [sy('L'), 'Loss at the solution', c => `${sy('L')}(${sy('wt')}*) = ${num(c.P.f.SSE / c.P.nTr, 4)}`]
    ]},
  { id: '9b', title: 'Optimise: gradient descent', goal: 'Reach the same minimum by repeated downhill steps.',
    attrs: ['gdtype', 'lr', 'schedule', 'optimiser', 'init', 'stopping', 'scalegd'],
    subs: [
      [`${sy('H')}, ${sy('lmax')}`, 'Curvature sets the largest safe step', c => `${sy('lmax')} = ${num(c.P.eigH[0], 4)}, so steps diverge above 2/${sy('lmax')} = ${num(c.P.lim, 4)}`],
      [sy('eta'), 'Step size used', c => `${sy('eta')} = ${num(c.P.frac, 2)} × 2/${sy('lmax')} = ${num(c.P.eta, 4)}${c.P.diverged ? ' (too big: the run diverges)' : ''}`],
      [`${sy('t')}, ${sy('grad')}`, 'Loop: predict → residual → loss → gradient → update', c => `<div class="it-tbl"><table><tr><th>${sy('t')}</th><th>${sy('wt')}_t</th><th>${sy('L')}</th><th>‖${sy('grad')}‖</th><th>${sy('wt')}_t − ${sy('eta')}${sy('grad')}</th></tr>` +
        c.P.iters.map(i => `<tr><td>${i.t}</td><td>${vec(i.w, 3)}</td><td>${num(i.L, 4)}</td><td>${num(i.gn, 4)}</td><td>${vec(i.next, 3)}</td></tr>`).join('') + `</table></div>`],
      ['', 'Compared with the closed form', c => { const last = c.P.iters[c.P.iters.length - 1], gap = Math.abs(last.L - c.P.f.SSE / c.P.nTr); return `${gap < 1e-6 ? mark(true) : mark(false, true)} after ${last.t} iterations ${sy('L')} = ${num(last.L, 4)} vs ${num(c.P.f.SSE / c.P.nTr, 4)}`; }]
    ]},
  { id: 10, title: 'Diagnostics', goal: 'Check the assumptions on the training residuals.',
    attrs: ['residplots', 'influence', 'lintest', 'vartest', 'indtest', 'normtest', 'colltest'],
    subs: [
      [sy('reset'), 'Linearity (Ramsey RESET)', c => c.P.dg?.reset ? `${c.P.dg.reset.p >= 0.05 ? mark(true) : mark(false)} ${pEq(c.P.dg.reset.p)}` : '—'],
      [sy('bp'), 'Constant variance (Breusch–Pagan)', c => c.P.dg?.bp ? `${c.P.dg.bp.p >= 0.05 ? mark(true) : mark(false)} ${pEq(c.P.dg.bp.p)}` : '—'],
      [sy('dw'), 'Independence (Durbin–Watson, rows in order)', c => c.P.dg ? `${c.P.dg.dw > 1.5 && c.P.dg.dw < 2.5 ? mark(true) : mark(false)} ${sy('dw')} = ${num(c.P.dg.dw, 2)}` : '—'],
      [sy('jb'), 'Normality (Jarque–Bera)', c => c.P.dg ? `${c.P.dg.jb.p >= 0.05 ? mark(true) : mark(false)} ${pEq(c.P.dg.jb.p)}` : '—'],
      [sy('vif'), 'Collinearity (largest VIF)', c => c.P.dg?.vif.length ? (v => `${v <= 5 ? mark(true) : v <= 10 ? mark(false, true) : mark(false)} ${isFinite(v) ? num(v, 1) : '∞'}`)(Math.max(...c.P.dg.vif)) : '—'],
      [sy('cook'), "Influence (largest Cook's distance)", c => c.P.f.cook ? (v => `${v < 1 ? mark(true) : mark(false)} ${num(v, 3)}`)(Math.max(...c.P.f.cook)) : '—']
    ]},
  { id: 11, title: 'Inference', goal: 'How uncertain is each coefficient, and which standard error is right for this data?',
    attrs: ['coefinf', 'ftest', 'robustse', 'intervals'],
    subs: [
      [sy('s2'), 'Error variance', c => `${sy('s2')} = SSE / (${c.P.nTr} − ${c.P.f.rank}) = ${num(c.P.f.s2, 4)}`],
      [sy('se'), c => `Standard errors of the ${c.P.names[c.focus]} slope (original scale)`, c => {
        const j = c.focus, P = c.P, need = c.isBase || c.variant.id === 'dupes' ? null : c.attr.id === 'independence' ? (c.variant.id === 'cluster' ? 'cl' : 'nw') : c.attr.id === 'homoscedasticity' ? 'hc' : null;
        const row = (k, label, v) => `<span class="se-opt${k === need ? ' pick' : ''}"${k === need ? ' title="the right standard error for this variant"' : ''}>${label} ${isFinite(v) ? num(v, 4) : 'n/a'}</span>`;
        return row('classical', 'classical', P.seOrig[j]) + row('hc', sy('hc'), P.hc?.[j]) + row('nw', `${sy('nw')} (lag ${P.nw?.lag ?? '—'})`, P.nw?.se[j]) + (P.cl ? row('cl', `${sy('cl')} (${P.cl.groups} groups)`, P.cl.se[j]) : '');
      }],
      [`${sy('t')}, ${sy('pv')}, ${sy('ci')}`, 'Classical test of the slope', c => { const j = c.focus, f = c.P.f; if (!isFinite(f.se[j])) return `${mark(false)} undefined: X̃ᵀX̃ has no inverse`;
        const lo = f.ci[j][0] / c.P.sd[j], hi = f.ci[j][1] / c.P.sd[j], tr = c.d.truth.coef[j];
        return `${sy('t')} = ${num(f.t[j], 2)}, ${sy('pv')} ${pEq(f.pv[j]).slice(2)}, ${sy('ci')} = [${num(lo, 3)}, ${num(hi, 3)}]` +
          (tr != null ? ` ${lo <= tr && tr <= hi ? mark(true) + ' covers' : mark(false) + ' misses'} the true ${tr}` : ''); }],
      [sy('b'), 'Classical test of the intercept', c => { const P = c.P, f = P.f; if (!f.inv) return `${mark(false)} undefined: X̃ᵀX̃ has no inverse`;
        const cv = P.mu.map((m, k) => k === 0 ? 1 : -m / P.sd[k]), q = cv.reduce((s2, ci, a) => s2 + ci * cv.reduce((s3, cj, b) => s3 + f.inv[a][b] * cj, 0), 0), se = Math.sqrt(f.s2 * q), b = P.wOrig[0], t = b / se;
        return `${sy('b')} = ${num(b, 3)}, ${sy('se')} = ${num(se, 3)}, ${sy('t')} = ${num(t, 2)}, ${pEq(ST.tP2(t, f.df))}, ${sy('ci')} = [${num(b - f.tc * se, 3)}, ${num(b + f.tc * se, 3)}]`; }],
      [sy('F'), 'Overall F-test: do the features explain anything?', c => { const f = c.P.f, q = f.rank - 1, d2 = c.P.nTr - f.rank; if (q < 1 || !(d2 > 0)) return '—';
        const F = ((f.SST - f.SSE) / q) / (f.SSE / d2), p = ST.fSF(F, q, d2); return `${p < 0.05 ? mark(true) : mark(false, true)} ${sy('F')} = ${num(F, 2)} on (${q}, ${d2}) df, ${pEq(p)}; training ${sy('r2')} = ${num(1 - f.SSE / f.SST, 3)}`; }],
      ['', 'Which standard error fixes it?', c => c.isBase ? 'classical SEs are valid for the baseline' :
        c.variant.id === 'dupes' ? 'none needed: remove the duplicate rows in step 2, then classical SEs are fine' : c.attr.id === 'independence' ? `${c.variant.id === 'cluster' ? 'clustered' : 'Newey–West'} (highlighted above)` : c.attr.id === 'homoscedasticity' ? 'heteroscedasticity-robust HC1 (highlighted above)' :
        c.attr.id === 'exogeneity' ? `${mark(false)} none: the estimate itself is biased, so no standard error can rescue the interval` :
        c.attr.id === 'multicollinearity' ? 'none: the SEs are correct but large (or undefined); the fix is in the features or ridge' :
        c.attr.id === 'normality' ? 'classical is fine in large samples; bootstrap if N is small' : 'none: the model itself is misspecified, so fix the features first']
    ]},
  { id: 12, title: 'Evaluation on test data', goal: 'Score the model on rows it never saw, transformed with the training μ and s.',
    attrs: ['metric', 'traintest', 'learningcurve', 'validationcurve', 'biasvariance', 'shift'],
    subs: [
      [sy('rmse'), 'Train vs test error', c => `train ${num(c.P.rmseTr, 3)}, test ${num(c.P.rmseTe, 3)}${c.P.rmseTe > 1.3 * c.P.rmseTr ? ` ${mark(false, true)} test noticeably worse` : ''}`],
      [sy('r2'), 'Test R²', c => num(c.P.r2Te, 3)]
    ]},
  { id: 13, title: 'Interpretation', goal: 'Undo the scaling and say what the coefficients mean.',
    attrs: ['reading', 'causal', 'intervals'],
    subs: [
      [sy('w'), 'Back to the original scale: w_j = w̃_j / s_j, b = w̃₀ − Σ w̃_j μ_j / s_j', c => c.P.names.map((n, j) => `${n === '1' ? 'b' : n}: ${num(c.P.wOrig[j], 3)}${c.d.truth.coef[j] != null ? ` (true ${c.d.truth.coef[j]})` : ''}`).join(', ')],
      ['', 'Reading the slope', c => { const j = c.focus; return `one unit more of ${c.P.names[j]} changes ${sy('yhat')} by ${num(c.P.wOrig[j], 3)}, holding the other features fixed`; }]
    ]}
];
