/* ============================================================
   Interview notes: the whole regression process in plain words,
   rewritten for the selected variant with live numbers.
   NOTES.render(el, ctx) where ctx = { P, d, a, v, isBase, inf, S, cur }.
   ============================================================ */
const NOTES = (() => {
  const n = (v, d = 2) => num(v, d), pv = p => !isFinite(p) ? '—' : p < 0.001 ? 'below 0.001' : n(p, 3);

  /* what each assumption means, said simply */
  const ASSUME = {
    linearity: { rule: 'On average, y changes by the same amount for every one-unit step in x. The true relationship is a straight line (or a flat plane with several features).', why: 'The model can only draw straight lines. If the truth bends, the line is systematically wrong in some ranges, and its slope is an average of different effects.' },
    independence: { rule: 'Each row\'s error tells you nothing about any other row\'s error.', why: 'The standard error assumes every row is a fresh, independent piece of information. If rows share information, the model is more confident than it should be.' },
    homoscedasticity: { rule: 'The errors have the same spread everywhere: the scatter around the line is a band of even width.', why: 'The classical standard error uses one number for the noise. If the noise is bigger in some places, that one number is wrong, and so are the p-values and intervals.' },
    normality: { rule: 'The errors follow a bell curve.', why: 'This is only needed for exact small-sample t tests, F tests and prediction intervals. It is the least important assumption: with a few dozen rows the central limit theorem makes the tests approximately right anyway.' },
    multicollinearity: { rule: 'No feature can be predicted (almost) perfectly from the other features.', why: 'If two features move together, the data cannot say which one deserves the credit. The individual coefficients become unstable, or impossible to compute.' },
    exogeneity: { rule: 'The error is unrelated to x: nothing that is left out of the model moves together with x.', why: 'This is the assumption that makes the slope mean what we want it to mean. If it fails, the slope is biased, and more data does not fix it.' }
  };

  /* plain-language card per variant */
  const V = {
    linear: { what: 'The true relationship is a straight line, so the model is the right shape.', line: 'The line fits: residuals are random around zero all along x, and RESET does not reject.' },
    quadratic: { what: 'The truth curves upward (convex), but we fit a straight line.', real: 'Fuel use vs speed, cost vs volume beyond capacity, medical risk vs dose.', see: 'Residuals form a U: positive at both ends, negative in the middle.', breaks: 'Predictions are systematically off by region, worst at the edges and when extrapolating. The slope is an average of a changing effect.', fine: 'The solver still finds the best straight line exactly.', detect: 'Scatter plot in EDA, residual-vs-x or residual-vs-fitted plot, Ramsey RESET.', fix: 'Add x², use a log or other transform, or use splines.', line: 'If the residual plot shows a U-shape, the linearity assumption fails; I would add a squared term or transform x, refit and re-check RESET.' },
    log: { what: 'y rises quickly and then levels off, but we fit a straight line.', real: 'Returns to advertising spend, learning curves, diminishing returns in general.', see: 'Residuals form an upside-down U: the line is too high at both ends and too low in the middle.', breaks: 'Predictions are biased by region, and extrapolating to large x overshoots badly.', fine: 'The fitting machinery itself.', detect: 'Scatter plot, residual plot, RESET.', fix: 'Use log(x) as the feature, or a spline.', line: 'The effect of x shrinks as x grows, so I would model log(x) instead of x.' },
    sshape: { what: 'y is flat, then rises steeply, then flattens again.', real: 'Adoption of a technology over time, dose–response curves.', see: 'Residuals follow a wave across x.', breaks: 'One slope cannot describe three different regimes.', fine: 'The fitting machinery.', detect: 'Scatter and residual plots, RESET.', fix: 'Splines, a logistic-shaped feature, or a non-linear model.', line: 'An S-shaped relationship needs splines or a non-linear model; a single slope averages three regimes.' },
    step: { what: 'The mean of y jumps at a threshold.', real: 'Eligibility cut-offs, tax brackets, policy changes on a date.', see: 'Residuals are one sign below the threshold and the other above it.', breaks: 'The line smears the jump into a slope that is not really there.', fine: 'The fitting machinery.', detect: 'Scatter plot, residuals vs x, RESET.', fix: 'Add a 0/1 indicator for "above the threshold", or a piecewise model.', line: 'A jump needs an indicator variable; a straight line turns it into a fake gradual slope.' },
    periodic: { what: 'A straight trend plus a repeating wave.', real: 'Seasonality in sales, daily temperature cycles.', see: 'Residuals oscillate in a regular wave.', breaks: 'The wave is left in the errors, so the errors are also autocorrelated.', fine: 'The overall trend can still be estimated.', detect: 'Residuals in order, RESET, Durbin–Watson.', fix: 'Add sine and cosine terms or seasonal dummies.', line: 'Seasonality left in the residuals shows up as a wave; I would add seasonal terms.' },
    interaction: { what: 'Two groups have different slopes, but the model gives them one shared slope.', real: 'The effect of training hours on output differs between junior and senior staff.', see: 'Each group\'s residuals tilt in opposite directions: a cross shape.', breaks: 'The single slope is wrong for both groups.', fine: 'The intercept shift between groups is captured.', detect: 'Plot the residuals by group; RESET can also fire.', fix: 'Add the interaction term x × group.', line: 'If the effect of x depends on the group, I add an x-times-group interaction; otherwise the one slope is wrong for everyone.' },
    indep: { what: 'Each row\'s error is drawn fresh.', line: 'Independent errors: Durbin–Watson near 2, no streaks in the residuals.' },
    posar: { what: 'Each error carries over part of the previous one (positive autocorrelation).', real: 'Time series: monthly sales, stock prices, temperatures, anything where today resembles yesterday.', see: 'Long streaks of residuals on the same side of the line; the lag plot tilts upward; Durbin–Watson well below 2.', breaks: 'The classical standard errors are too small, so p-values are too small and intervals too narrow. A random train/test split leaks neighbouring rows.', fine: 'The coefficients stay unbiased.', detect: 'Residuals in time order, a lag plot, Durbin–Watson, Breusch–Godfrey.', fix: 'Newey–West (HAC) standard errors, adding lags or trends, GLS (Cochrane–Orcutt), and a time-ordered split.', line: 'With autocorrelated errors the slope is still unbiased but the classical SEs are overconfident; I would use Newey–West SEs and split by time.' },
    negar: { what: 'Errors tend to flip sign from one row to the next (negative autocorrelation).', real: 'Over-correcting processes: inventory that is over-ordered then under-ordered.', see: 'Residuals zig-zag; Durbin–Watson above 2.', breaks: 'The classical SEs are wrong (here usually too large, so the model is too cautious).', fine: 'The coefficients stay unbiased.', detect: 'Residuals in order, Durbin–Watson.', fix: 'Newey–West standard errors, or model the dynamics.', line: 'Zig-zag residuals mean negative autocorrelation; the estimates are fine, the SEs need a HAC correction.' },
    cluster: { what: 'Rows come in groups that share a common shock.', real: 'Students in the same class, patients in the same hospital, repeated measurements of the same customer.', see: 'Whole clusters sit above or below the line; a large share of the residual variance is between clusters.', breaks: 'The classical SEs are far too small, because the effective sample size is closer to the number of clusters than to the number of rows.', fine: 'The coefficients stay unbiased.', detect: 'Plot residuals by group and compute the intraclass correlation.', fix: 'Cluster-robust SEs, a mixed (random-effects) model, and a group-wise train/test split.', line: 'Clustered data need clustered standard errors and a split by group; otherwise I am counting one shock many times.' },
    dupes: { what: 'The same observations appear several times.', real: 'A bad join, repeated form submissions, data appended twice.', see: 'Identical rows; residuals come in identical blocks.', breaks: 'N looks bigger than the real information, so SEs shrink by about √(copies), and copies land in both train and test.', fine: 'The coefficients are unchanged.', detect: 'A duplicate check in cleaning.', fix: 'Remove duplicates before anything else.', line: 'Duplicates do not move the line but they fake extra evidence; I remove them in cleaning.' },
    constant: { what: 'The errors have the same spread everywhere.', line: 'Constant variance: an even band of residuals, Breusch–Pagan does not reject.' },
    increasing: { what: 'The error spread grows with x.', real: 'Spending vs income, house price vs size: bigger values vary more.', see: 'A funnel opening to the right in the residual plot.', breaks: 'The classical SEs, p-values and intervals; OLS is no longer the most efficient estimator.', fine: 'The coefficients stay unbiased.', detect: 'Residual-vs-fitted plot, Breusch–Pagan, White test.', fix: 'HC (robust) standard errors, weighted least squares, or a log transform of y.', line: 'A funnel means heteroscedasticity; the slope is still unbiased, but I would report HC-robust SEs or model log y.' },
    decreasing: { what: 'The error spread shrinks as x grows.', real: 'Measurements that get relatively more precise for larger quantities.', see: 'A funnel narrowing to the right.', breaks: 'The classical SEs.', fine: 'The coefficients stay unbiased.', detect: 'Residual plot, Breusch–Pagan.', fix: 'Robust SEs or WLS.', line: 'A narrowing spread is still heteroscedasticity: robust SEs.' },
    bowtie: { what: 'Small spread in the middle of x, large at both ends.', real: 'A process tightly controlled around its set point.', see: 'A bow-tie shape in the residual plot.', breaks: 'The classical SEs. Breusch–Pagan may miss it because the variance is not linear in x.', fine: 'The coefficients stay unbiased.', detect: 'The residual plot; the White test (it includes x²).', fix: 'Robust SEs or WLS.', line: 'Variance that depends on x² can slip past Breusch–Pagan; the White test or the plot catches it.' },
    groupvar: { what: 'One group has small errors, the other large ones.', real: 'Two machines or two labs, one precise and one sloppy.', see: 'Residuals by group: one tight, one wide.', breaks: 'The classical SEs. Breusch–Pagan on x misses it, because the variance depends on the group, not on x.', fine: 'The coefficients stay unbiased.', detect: 'Plot residuals by group and test variance by group.', fix: 'Robust SEs, or WLS with per-group weights.', line: 'Always look at residuals by group; a variance test on x alone can miss group differences.' },
    normal: { what: 'The errors follow a bell curve.', line: 'Normal errors: Q–Q plot on the diagonal, Jarque–Bera does not reject.' },
    rskew: { what: 'Most errors are slightly negative, with a few large positive ones.', real: 'Waiting times, delivery delays, incomes.', see: 'A histogram with a right tail; the Q–Q plot bends up at the right.', breaks: 'Exact small-sample intervals; prediction intervals in the tail.', fine: 'Unbiased, BLUE coefficients; with moderate N the tests are approximately right.', detect: 'Histogram of residuals, Q–Q plot, Jarque–Bera, Shapiro–Wilk.', fix: 'Often a log transform of y; or bootstrap intervals.', line: 'Skewed errors do not bias OLS; with enough data the CLT covers the tests, and a log of y often fixes it.' },
    lskew: { what: 'A few large negative errors.', real: 'Scores near a ceiling.', see: 'A left tail in the histogram.', breaks: 'Exact small-sample intervals.', fine: 'The coefficients.', detect: 'Q–Q plot, Jarque–Bera.', fix: 'Transform y, or bootstrap.', line: 'Normality matters least: it only affects exact small-sample inference.' },
    heavy: { what: 'Occasional extreme errors (heavy tails).', real: 'Financial returns, sensor glitches.', see: 'Points far out on both ends of the Q–Q plot; kurtosis well above 3.', breaks: 'Extreme rows pull the line (OLS squares big errors); intervals in the tails.', fine: 'The coefficients are still unbiased.', detect: 'Q–Q plot, kurtosis, Jarque–Bera, Cook\'s distance.', fix: 'Robust regression (Huber), check the outliers, bootstrap.', line: 'Heavy tails make OLS sensitive to a few rows; I would check them and consider Huber loss.' },
    light: { what: 'Errors never stray far from 0 (light tails).', real: 'Rounding errors, bounded noise.', see: 'A flat-topped histogram; the Q–Q ends flatten.', breaks: 'Very little.', fine: 'Almost everything.', detect: 'Q–Q plot; Jarque–Bera often misses it.', fix: 'Usually nothing.', line: 'Light tails are a harmless departure; tests often do not even detect it.' },
    bimodal: { what: 'Errors cluster around +σ and −σ.', real: 'Two hidden subpopulations mixed together.', see: 'Two humps in the histogram; a step in the Q–Q plot.', breaks: 'Exact small-sample inference, and it hints at a missing grouping variable.', fine: 'The coefficients.', detect: 'Histogram of residuals.', fix: 'Find and add the missing group variable.', line: 'Two humps in the residuals usually mean a missing categorical feature.' },
    uncorr: { what: 'The features are unrelated to each other.', line: 'No multicollinearity: VIFs near 1.' },
    moderate: { what: 'Two features are moderately correlated (r ≈ 0.6).', real: 'Age and income.', see: 'A tilted cloud in the x₁-vs-x₂ scatter; VIF around 1.5.', breaks: 'Slightly larger SEs.', fine: 'Nearly everything.', detect: 'The correlation matrix and VIF.', fix: 'Usually nothing.', line: 'Some correlation between features is normal; it only becomes a problem above about VIF 5–10.' },
    high: { what: 'Two features are almost the same (r ≈ 0.97).', real: 'House size and number of rooms, height in cm and shoe size.', see: 'A thin cigar in the x₁-vs-x₂ scatter; VIF above 10; large condition number.', breaks: 'Individual coefficients swing wildly between samples and can flip sign; their SEs inflate by √VIF.', fine: 'Predictions inside the data range, the overall F test and R².', detect: 'VIF, condition number, unstable coefficients.', fix: 'Drop or combine features, PCA, ridge regression.', line: 'High multicollinearity inflates the SEs of the individual coefficients but leaves predictions fine; ridge or dropping one feature helps.' },
    perfect: { what: 'One feature is an exact multiple of another.', real: 'The same quantity recorded in two units.', see: 'Points on an exact line in the x₁-vs-x₂ scatter; VIF infinite; det(XᵀX) = 0.', breaks: 'There is no unique solution: infinitely many weight pairs give identical predictions.', fine: 'Predictions.', detect: 'Rank of X below p, singular XᵀX.', fix: 'Drop the duplicate feature.', line: 'With perfect collinearity XᵀX is singular, so the coefficients are not identifiable; drop one column.' },
    combo: { what: 'One feature is an exact sum of others.', real: 'Total spend kept next to its parts.', see: 'No single pair looks perfectly correlated, but the rank of X is below p and VIF is infinite.', breaks: 'There is no unique solution.', fine: 'Predictions.', detect: 'Rank or VIF; pairwise correlations miss it.', fix: 'Drop the total or one of its parts.', line: 'Pairwise correlations can miss a combination of three features; VIF or the rank catches it.' },
    dummytrap: { what: 'All dummies of a category are kept alongside the intercept.', real: 'One-hot encoding without dropping a level.', see: 'A + B + C = 1 on every row, the same as the intercept column.', breaks: 'XᵀX is singular; the category coefficients have no unique meaning.', fine: 'Predictions, and the slope of x.', detect: 'Rank of X, VIF.', fix: 'Drop one dummy: it becomes the reference level.', line: 'With an intercept, keep k − 1 dummies for k categories; the dropped one is the baseline the others are compared with.' },
    exo: { what: 'The errors are unrelated to x.', line: 'Exogeneity holds: the slope estimates the causal effect.' },
    confounder: { what: 'A hidden variable drives both x and y.', real: 'Ice-cream sales and drownings (both driven by hot weather); education and income (both driven by family background).', see: 'Nothing in the residuals. The residuals are always uncorrelated with x, so the plots look perfect.', breaks: 'The slope is biased (omitted-variable bias), and more data does not fix it. Confidence intervals are centred on the wrong value.', fine: 'Predictive accuracy on similar data can still be good.', detect: 'Domain knowledge about what else drives x and y; comparing results with and without plausible controls.', fix: 'Include the confounder, use instrumental variables, or run an experiment.', line: 'Omitted-variable bias cannot be seen in the residuals; correlation is not causation, so I would add the confounder or find an instrument.' },
    measerr: { what: 'x is measured with random error.', real: 'Self-reported income, noisy sensors.', see: 'Nothing obvious; the slope is just flatter than it should be.', breaks: 'The slope is shrunk toward 0 (attenuation bias).', fine: 'Predictions from noisy x, if the future x is just as noisy.', detect: 'Repeated measurements or knowledge of the measurement process.', fix: 'Better measurement, errors-in-variables models, instruments.', line: 'Noise in x biases the slope toward zero; noise in y only adds variance.' },
    reverse: { what: 'y also influences x.', real: 'Police numbers and crime, price and demand.', see: 'Nothing in the residuals.', breaks: 'The slope mixes the effect of x on y with the effect of y on x.', fine: 'Prediction of y from x, if the system does not change.', detect: 'Thinking about the timing and the mechanism.', fix: 'Instrumental variables, a structural model, or lagged x.', line: 'With feedback from y to x, OLS cannot separate cause from effect; an instrument or a natural experiment is needed.' }
  };

  function elevator(c){
    const { P, a, v, isBase } = c, j = c.d.focus[0], nm = c.d.names[j], k = V[v.id] || {};
    let s = `Linear regression predicts a number as a weighted sum of the inputs plus a starting value. It picks the weights that make the average squared error as small as possible, which can be solved exactly (the normal equations) or approached step by step (gradient descent). I split the data first, so I can test on rows the model never saw. After fitting, I check that the leftover errors look like random noise, because the uncertainty numbers (standard errors, p-values, intervals) rely on that. Here the slope for ${nm} is ${n(P.wOrig[j], 3)}${isFinite(P.seOrig[j]) ? ` ± ${n(P.seOrig[j], 3)}` : ''}, and the test error is ${n(P.rmseTe)}.`;
    if (!isBase) s += ` In this data <b>${esc(a.name.toLowerCase())}</b> is violated: ${esc((k.what || '').replace(/\.$/, '').toLowerCase())}. ${esc(k.breaks || '')} ${k.fine ? `What still works: ${esc(k.fine.charAt(0).toLowerCase() + k.fine.slice(1))}` : ''} ${k.fix ? `The fix: ${esc(k.fix)}` : ''}`;
    return s;
  }

  function card(c){
    const { a, v, isBase } = c, k = V[v.id] || {}, A = ASSUME[a.id];
    const rows = isBase ? [['The assumption', A.rule], ['Why it matters', A.why], ['Here', k.line]] :
      [['The assumption', A.rule], ['What is different here', k.what], ['Where it happens in real data', k.real], ['What you would see', k.see], ['What it breaks', k.breaks], ['What still works', k.fine], ['How to detect it', k.detect], ['How to fix it', k.fix], ['One line for the interview', k.line]];
    return `<dl class="nt-card">${rows.filter(r => r[1]).map(([t, d]) => `<div><dt>${t}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>`;
  }

  const FOLLOW = [
    ['What are the assumptions of linear regression?', 'Linearity in the parameters; independent errors; constant error variance; errors with mean zero that are unrelated to x (exogeneity); no perfect multicollinearity; and, for exact small-sample tests, normal errors. A common short form is LINE: Linear, Independent, Normal, Equal variance.'],
    ['Which assumption violations bias the coefficients, and which only the standard errors?', 'Bias: non-linearity (wrong model) and endogeneity (confounders, measurement error in x, reverse causality). Only the SEs: autocorrelation, clustering, heteroscedasticity, duplicates. Neither, mostly: non-normal errors with moderate N. Instability rather than bias: multicollinearity.'],
    ['What does Gauss–Markov say?', 'If the errors have mean zero, constant variance, and are uncorrelated, and X has full rank, then OLS has the smallest variance among all linear unbiased estimators (BLUE). Normality is not needed.'],
    ['Closed form or gradient descent?', 'The closed form is exact and fast for a modest number of features, but costs about p³ and needs XᵀX to be invertible. Gradient descent scales to huge data and many features, and works in streaming or mini-batch form, but needs a learning rate and scaled features.'],
    ['Why scale features?', 'For plain OLS the predictions do not change. Scaling makes gradient descent converge much faster (the loss bowl becomes round), makes regularisation penalties fair across features, and makes coefficients comparable.'],
    ['R² vs adjusted R²?', 'R² is the share of variation explained, and it never drops when you add a feature. Adjusted R² penalises extra features and can drop.'],
    ['How do you know the model generalises?', 'Hold out data before fitting (or cross-validate), fit every preprocessing step on the training rows only, and compare the train and test error.']
  ];

  /* ---------- the deep walk-through: one collapsible block per step ---------- */
  const ul = a => `<ul>${a.filter(Boolean).map(s => `<li>${s}</li>`).join('')}</ul>`;
  const sec = (h, body) => body ? `<div class="nt-sec"><h5>${h}</h5>${body}</div>` : '';
  function W(c, id, i, title){
    const fn = EXPLAIN[id]?.[i]; if (!fn) return ''; let x; try { x = fn(c.ex); } catch (err) { console.error(err); return ''; }
    return `<div class="nt-w"><h6>${title}</h6>${x.hyp ? `<p><b>Hypotheses.</b> ${x.hyp}</p>` : ''}<p><b>The idea.</b> ${x.plain}</p><p class="hw-f">${x.formula}</p><div class="nt-calc">${x.calc}</div><p><b>How to read it.</b> ${x.read}</p>` +
      (x.pit ? `<p><b>What it assumes and can miss.</b> ${x.pit}</p>` : '') + (x.qa ? `<div class="qa">${x.qa.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>` : '') +
      `<p class="nt-link"><a href="#sub-${id}-${i}" data-goto="sub-${id}-${i}">${String(id) === '10' ? 'See its chart in the process ↑' : 'See it in the process ↑'}</a></p></div>`;
  }

  function stepDefs(c){
    const { P, d, v, isBase } = c, f = P.f, j = d.focus[0], nm = d.names[j], dg = P.dg || {}, fn = d.names.slice(1);
    const vifMax = dg.vif?.length ? Math.max(...dg.vif) : NaN;
    const need = isBase || v.id === 'dupes' ? null : c.a.id === 'independence' ? (v.id === 'cluster' ? 'clustered' : 'Newey–West') : c.a.id === 'homoscedasticity' ? 'HC1' : null;
    return [
      { id: '0', title: 'What problem are we solving?', sum: 'y = b + w·x + ε: estimate b and w, and say how sure we are.',
        why: 'We want a rule that turns an input x into a guess for y, and that tells us how x and y are related.',
        fp: ul(['y is never fully decided by x: two houses of the same size sell for different prices. So split y into a part explained by x and a part that is not.',
          'Linear regression assumes the explained part is a straight line, so <b>y = b + w·x + ε</b>. b (intercept) is the predicted y when x = 0. w (slope) is how much y changes on average when x goes up by 1. ε (error) is everything else: noise, causes we did not measure, measurement slips.',
          'We never see b, w or ε, only x and y. The job is to <b>estimate</b> b and w from data, and to say how sure we are.',
          `In this simulation we chose the truth ourselves (${d.truth.coef[1] != null ? `slope ${d.truth.coef[1]}` : 'a curved rule'}), so we can check whether the method recovers it.`]),
        ip: ['"Linear" means linear in the <i>weights</i>: y = b + w·x² is still linear regression, because w just multiplies something and gets added.'] },
      { id: 1, title: 'Collect the data', sum: `N = ${P.N} rows, p = ${P.P} coefficients, ${P.N - P.P} rows to spare.`,
        why: 'Every estimate is learned from examples, so the examples decide what we can learn.',
        what: `A table with one row per observation: the input${fn.length > 1 ? 's' : ''} ${fn.join(', ')} and the answer y.`,
        fp: ul([`Each row is one equation, yᵢ = b + w·xᵢ + εᵢ. We have N = ${P.N} equations and p = ${P.P} unknowns.`,
          'We need N > p, and preferably many more rows. With N = p the line passes exactly through the points and we learn nothing about the noise.',
          `The leftover N − p rows (here ${P.N - P.P}) are what lets us measure the noise. They are the <b>degrees of freedom</b>.`]),
        work: [[1, 0, 'N and p'], [1, 1, 'The true rule (known only in a simulation)'], [1, 2, 'How the errors were made']],
        ip: ['Precision grows with √N: four times the data halves the uncertainty.'] },
      { id: 2, title: 'Clean the data', sum: `duplicates ${P.dupes}, missing 0, outliers ${P.outY + P.outX}, leakage none.`,
        why: 'If the rows are wrong, everything after is wrong.',
        what: 'Four checks: duplicates, missing values, outliers and leakage.',
        fp: ul(['<b>Duplicates.</b> Turn each row into a text key (all its values joined). A key seen before is a copy. A copy adds no information, but the model counts it as new evidence and becomes overconfident.',
          '<b>Missing values.</b> Count empty cells per column. Rows with gaps cannot be used as they are, so drop them or fill them in, and know <i>why</i> they are missing.',
          '<b>Outliers.</b> A z-score z = (value − mean)/sd says how many standard deviations a value is from the average. For bell-shaped data |z| > 3 happens only 0.27% of the time, so flag it and look at it.',
          '<b>Leakage.</b> Ask of every input: is it computed from y, or known only after y? Such an input makes the model look brilliant in testing and useless in real use.']),
        work: [[2, 0, 'Duplicate rows'], [2, 2, 'Outliers by z-score']],
        ip: ['A flag means "investigate", not "delete": an outlier can be a typo or the most informative point you have.'] },
      { id: 3, title: 'Explore the data (EDA)', sum: `r(${d.names[1]}, y) = ${n(P.eda.corrXY[0], 3)}, skewness of y = ${n(P.eda.skewY)}.`,
        why: 'Look before you fit. A picture shows curves, funnels and clusters that a single number hides.',
        what: 'Plot y against each input, then summarise the relationship (correlation) and the shape of y (skewness).',
        fp: ul(['<b>Correlation.</b> For each row, multiply x\'s deviation from its mean by y\'s deviation. The product is positive when both are on the same side of their means (they agree) and negative when they disagree. Add them up, then divide by both spreads so the answer always lies between −1 and 1.',
          '<b>Skewness.</b> The average of d is always 0, so it is useless. The average of d² loses the direction (it is the spread). The average of d³ keeps the sign and makes big deviations count far more, so a long tail on one side wins. Dividing by sd³ removes the units.',
          '<b>Correlation between inputs.</b> The same formula on two inputs: a high value warns that their effects will be hard to separate.']),
        work: [[3, 0, 'Skewness γ₁'], [3, 1, 'Correlation of x with y'], [3, 2, 'Largest correlation between two inputs']],
        ip: ['r only measures straight-line association: a perfect U-shape can have r = 0.', 'Skewness of y is a hint, not a verdict. The assumption is about the errors, re-checked in step 10.'] },
      { id: 4, title: 'Split into training and test data', sum: `${P.nTr} rows to learn from, ${P.nTe} hidden for the final exam.`,
        why: 'A model always looks good on the data it learned from. To know how it does on new data, some data must be hidden before anything is learned: a student who saw the exam questions proves nothing.',
        what: 'Shuffle the rows, keep 80% for learning (training) and 20% for the final check (test).',
        fp: ul(['Every step that <i>learns numbers from data</i> (means for scaling, the weights, any choice about the model) must use training rows only. Otherwise information leaks from the test rows and the test score becomes optimistic.',
          'A random shuffle is fair only if rows are independent. With time series, train on the past and test on the future; with groups, keep a whole group on one side.']),
        work: [[4, 0, 'The 80 / 20 split'], [4, 1, 'Is a random split appropriate?']],
        ip: ['Fit scaling, imputation and feature selection on the training set only, then <i>apply</i> them to the test set.'] },
      { id: 5, title: 'Put the inputs on the same ruler (scaling)', sum: `x̃ = (x − ${n(P.mu[1])}) / ${n(P.sd[1])}.`,
        why: 'Inputs come in different units, and the arithmetic of fitting (especially gradient descent) works best when every input is on a similar scale.',
        what: 'Standardise each input: x̃ = (x − μ)/s, with μ and s from the training rows.',
        fp: ul(['Subtracting μ moves the centre to 0; dividing by s makes the typical spread 1. Both only change the ruler, not the shape of the data.',
          '<b>Predictions do not change.</b> Only the weights are expressed in different units ("per standard deviation"), and step 13 converts them back.',
          'Why it helps: the loss surface becomes a round bowl instead of a long narrow valley, so one step size suits every direction (see step 9b).']),
        work: [[5, 0, 'Training mean and standard deviation'], [5, 1, 'Standardising a row'], [5, 2, 'Categories']],
        ip: ['Scaling does not matter for plain OLS predictions. It matters a lot for gradient descent and for ridge and lasso, whose penalties compare weight sizes.'] },
      { id: 6, title: 'Build the design matrix', sum: `${P.nTr} × ${P.P}, rank ${f.rank}, κ = ${isFinite(f.kappa) ? n(f.kappa, 1) : '∞'}.`,
        why: 'Writing all N equations at once as one matrix equation lets one formula solve them all.',
        what: 'Stack the rows into X̃: a column of 1s first, then one column per input. Stack y into a column.',
        fp: ul(['The column of 1s is how the intercept gets in: row i of X̃ times [w̃₀, w̃₁, …] = 1·w̃₀ + x̃ᵢ₁·w̃₁ + …, which is exactly the prediction.',
          '<b>Rank.</b> If one column can be built from the others (x₂ = 2·x₁, or dummies adding up to the 1s), the data cannot tell their effects apart and there is no single best answer.',
          '<b>Condition number κ.</b> Even without an exact copy, nearly dependent columns make some combination of weights barely pinned down. κ measures how uneven that is.']),
        work: [[6, 1, 'Full column rank?'], [6, 2, 'Condition number']] },
      { id: 7, title: 'Write the prediction rule', sum: 'ŷ = X̃w̃: start value + weight × each input.',
        why: 'We need an exact rule for a prediction before we can say how wrong it is.',
        fp: ul(['A prediction is a <b>weighted sum</b>: start at the intercept and add each input times its weight. For all rows at once this is a matrix times a vector.']),
        work: [[7, 0, 'One prediction, worked']] },
      { id: 8, title: 'Define "best": the loss', sum: `L = mean of e² = ${n(f.SSE / P.nTr, 4)} at the best line.`,
        why: 'Infinitely many lines could be drawn. We need one number that scores how wrong a line is, so that "best" means "lowest score".',
        what: 'Residual e = y − ŷ for each row, square it, average: the mean squared error. The sum of squares is called SSE.',
        fp: ul(['Squaring makes positive and negative errors both count, and makes one big error count more than two small ones.',
          'Why squares rather than absolute values: squares are smooth, so calculus finds the minimum exactly; the best constant guess under squares is the mean; and if the noise is bell-shaped, least squares is the statistically optimal (maximum-likelihood) choice.',
          'With an intercept, the residuals of the best line always add up to 0.']),
        work: [[8, 0, 'Residuals'], [8, 1, 'Mean squared error']] },
      { id: '9a', title: 'Find the best weights by solving equations', sum: `slope ${n(P.wOrig[j], 3)} for ${nm}${f.full ? '' : ' (not unique)'}.`,
        why: 'We want the weights that make L as small as possible.',
        fp: ul(['At the bottom of a bowl the ground is flat: nudging any weight neither raises nor lowers L. So set the slope of L with respect to each weight to zero.',
          '<b>For the intercept</b>: ∂L/∂b = −(2/N) Σ(yᵢ − b − w·xᵢ) = 0, so Σe = 0 and <b>b = ȳ − w·x̄</b>: the line passes through the point of averages.',
          '<b>For the slope</b>: ∂L/∂w = −(2/N) Σ xᵢ(yᵢ − b − w·xᵢ) = 0. Substituting b gives <b>w = Σ(x − x̄)(y − ȳ) / Σ(x − x̄)²</b>: how much x and y move together, divided by how much x moves on its own.',
          'For any number of inputs, all these equations together are <b>X̃ᵀX̃ w̃ = X̃ᵀy</b> (the normal equations), so w̃ = (X̃ᵀX̃)⁻¹X̃ᵀy.']),
        work: [['9a', 0, 'X̃ᵀX̃ and its determinant'], ['9a', 1, 'Solving the normal equations'], ['9a', 2, 'Loss at the solution']],
        ip: ['Exact, but (X̃ᵀX̃)⁻¹ costs about p³ and needs X̃ᵀX̃ to be invertible, which is why the rank check in step 6 matters.'] },
      { id: '9b', title: 'Or walk downhill (gradient descent)', sum: `η = ${n(P.eta, 4)}, ${P.iters[P.iters.length - 1].t} steps, same answer.`,
        why: 'With millions of rows or features, solving the equations directly is too expensive. Walking downhill works at any size, even on data that do not fit in memory.',
        what: 'Start with all weights at 0. Repeat: predict → residuals → gradient → small step against the gradient.',
        fp: ul([`<b>The landscape.</b> Every choice of weights has a loss, so the loss is a surface over the weights. For linear regression it is a bowl. At w̃ = 0 the loss is ${n(P.iters[0].L, 3)}: high up the bowl wall.`,
          '<b>Which way is downhill.</b> One row\'s squared error is u² with u = y − b − w·x̃. By the chain rule its derivative is 2u × (derivative of u): u falls by 1 when b rises by 1, and by x̃ when w rises by 1. Averaging gives ∂L/∂b = −(2/N)Σe and ∂L/∂w = −(2/N)Σx̃·e. The gradient points uphill, so we step the other way.',
          '<b>The update.</b> w̃ ← w̃ − η·∇L. η, the learning rate, is the step size.',
          '<b>Why η matters.</b> Along each direction of the bowl with curvature λ, a step multiplies the remaining distance by (1 − η·λ). If that factor exceeds 1 in size, each overshoot is bigger than the last and the run blows up. Hence η < 2/λ_max.',
          '<b>When to stop.</b> When the gradient is tiny, when the loss stops changing, or after a maximum number of steps.']),
        work: [['9b', 0, 'Curvature and the largest safe step'], ['9b', 1, 'Step size used'], ['9b', 2, 'Iteration 1, row by row'], ['9b', 3, 'How fast it converges, and other step sizes']] },
      { id: 10, title: 'Check the leftovers (diagnostics)', sum: `RESET p ${pv(dg.reset?.p)}, BP p ${pv(dg.bp?.p)}, DW ${n(dg.dw)}, JB p ${pv(dg.jb?.p)}, VIF ${isFinite(vifMax) ? n(vifMax, 1) : '∞'}, Cook ${f.cook ? n(Math.max(...f.cook), 2) : '—'}.`,
        why: 'The weights are always "the best straight line". But the uncertainty numbers in step 11 are only right if the residuals behave like pure random noise. So we check every way they could fail to.',
        what: 'Look at the residual pictures first, then run one test per assumption.',
        fp: ul(['<b>The logic every test shares.</b> (1) Assume the boring explanation, H₀ ("nothing is wrong"). (2) Compute a number, the test statistic, that would be small if H₀ were true and large if not. (3) Work out how that number is distributed when H₀ is true (an F, χ² or t distribution). (4) The p-value is the probability of a value at least this extreme under H₀. (5) If p < 0.05, reject H₀.',
          '<b>Two kinds of mistakes.</b> Type I: rejecting a true H₀ (a false alarm), which happens 5% of the time by design. Type II: missing a real problem. Power is the chance of catching a real problem; it grows with N, so small samples miss things and huge samples flag trivia.',
          '<b>Pictures first.</b> Residuals vs fitted (a pattern means a wrong shape or uneven spread), residuals in order (streaks mean dependence), Q–Q plot (bends mean non-normal tails), leverage plot (lone far-out points).',
          '<b>Which failures matter how.</b> A wrong shape or errors related to x <i>bias the coefficients</i>. Dependence, uneven spread and duplicates <i>only break the standard errors</i>. Non-normal errors matter least.']),
        work: [[10, 0, 'Is a straight line the right shape? Ramsey RESET'], [10, 1, 'Is the spread even? Breusch–Pagan'], [10, 2, 'Are neighbouring errors unrelated? Durbin–Watson'], [10, 3, 'Are the errors bell-shaped? Jarque–Bera'], [10, 4, 'Do the inputs overlap? VIF'], [10, 5, "Does one row dominate? Cook's distance"]] },
      { id: 11, title: 'Say how sure we are (inference)', sum: isFinite(P.seOrig[j]) ? `slope ${n(P.wOrig[j], 3)} ± ${n(P.seOrig[j], 3)}, p ${pv(f.pv[j])}.` : 'standard errors undefined.',
        why: 'Another sample would give a slightly different slope. We need to know how much it would wobble, and whether it is really different from 0.',
        fp: ul(['<b>The key fact.</b> The slope is a weighted sum of the y values, w = Σaᵢyᵢ, with weights aᵢ that depend only on x. So all its uncertainty comes from the noise in y, and two variance rules finish the job: Var(c·Y) = c²·Var(Y), and the variance of a sum of independent pieces is the sum of their variances.',
          '<b>Estimate the noise.</b> s² = SSE/(N − p). Divide by N − p because the residuals are forced to satisfy p equations (Σe = 0, Σx̃·e = 0, …), so only N − p of them are free.',
          '<b>Test and interval.</b> t = estimate/SE counts how many standard errors the estimate is from 0. The t distribution (not the normal curve) is used because s is itself estimated. The CI is estimate ± t_crit × SE.',
          '<b>Robust versions.</b> Classical assumes equal, independent noise. HC1 lets each row have its own noise size, Newey–West also lets nearby rows be related, and clustered lets a group share shocks. Each changes only the assumption about the noise.',
          `<b>Which one to trust here:</b> ${need ? `<b>${need}</b>, because of the selected variant.` : v.id === 'dupes' ? 'none of them fixes duplicated rows: remove the copies first.' : c.a.id === 'exogeneity' && !isBase ? 'none: the slope itself is biased.' : 'classical is fine when the step-10 checks pass.'}`]),
        work: [[11, 0, 'The noise level s²'], [11, 1, 'Standard errors: classical, HC1, Newey–West, clustered'], [11, 2, 't-test and confidence interval for the slope'], [11, 3, 't-test for the intercept'], [11, 4, 'Overall F-test']],
        ip: ['A p-value is not the probability that H₀ is true.', 'A 95% CI means 95% of intervals built this way contain the truth, and only if the step-10 checks passed.'] },
      { id: 12, title: 'Take the final exam (test data)', sum: `test RMSE ${n(P.rmseTe)} vs train ${n(P.rmseTr)}, test R² ${n(P.r2Te, 3)}.`,
        why: 'This is the honest score, on rows the model never saw.',
        what: 'Scale the test rows with the training μ and s, predict with the trained weights, and summarise the errors.',
        fp: ul(['<b>RMSE</b> = √(mean e²): a typical error, in the units of y.', '<b>R²</b> = 1 − SSE/SST: the share of variation explained, against the simplest rival (always guessing the mean).', 'Test error well above training error means the model learned noise (overfitting), or the split leaked.']),
        work: [[12, 0, 'Test RMSE'], [12, 1, 'Test R²']],
        ip: ['Test R² can be negative: the model is then worse than guessing the mean.'] },
      { id: 13, title: 'Explain the result', sum: `one more unit of ${nm} → ${n(P.wOrig[j], 3)} more y.`,
        why: 'Turn the numbers back into a statement about the world.',
        fp: ul(['Undo the scaling: a weight per standard deviation divided by s is a weight per original unit; the intercept absorbs the shifts by μ.',
          `Say it as: "each extra unit of ${nm} goes with ${n(P.wOrig[j], 3)} more y on average${isFinite(P.seOrig[j]) ? `, 95% interval ${n(P.wOrig[j] - f.tc * P.seOrig[j], 2)} to ${n(P.wOrig[j] + f.tc * P.seOrig[j], 2)}` : ''}, holding the other inputs fixed".`,
          'That is an <b>association</b>. Calling it a cause needs exogeneity: nothing left out may move together with x.']),
        work: [[13, 0, 'Back to the original units']] }
    ];
  }

  const openSet = new Set(); let bound = false, lastCtx = null;
  function body(c, st){
    const call = c.inf[st.id] && c.inf[st.id][0] !== 'none' && !c.isBase ? `<p class="nt-call ${LEVELS[c.inf[st.id][0]].cls}"><b>${LEVELS[c.inf[st.id][0]].glyph} With ${esc(c.v.name)}:</b> ${esc(c.inf[st.id][1])}</p>` : '';
    const F = LEDGER.flow(st.id), io = F ? `<p class="ldg-b">${F.bridge}</p><p class="ldg-io">${F.in.length ? `<span><b>Comes in:</b> ${F.in.map(([l, s]) => `<a href="#step-${s}" data-goto="step-${s}" class="ldg-l">${l} <small>(step ${s})</small></a>`).join(' ')}</span>` : ''}${F.out.length ? `<span><b>Goes out:</b> ${F.out.map(([l, s]) => `<a href="#step-${s}" data-goto="step-${s}" class="ldg-l">${l} <small>(step ${s})</small></a>`).join(' ')}</span>` : ''}</p>` : '';
    return call + io + sec('Why this step exists', `<p>${st.why}</p>`) + sec('What we do', st.what ? `<p>${st.what}</p>` : '') + sec('From first principles', st.fp) +
      sec('Worked on this data', (st.work || []).map(([id, i, t]) => W(c, id, i, t)).join('')) + sec('Interview points', st.ip ? ul(st.ip) : '') +
      (st.id !== '0' ? `<p class="nt-link"><a href="#step-${st.id}">See step ${st.id} in the process ↑</a></p>` : '');
  }
  function steps(c){
    return stepDefs(c).map(st => { const hit = c.inf[st.id] && c.inf[st.id][0] !== 'none' && !c.isBase, L = hit ? LEVELS[c.inf[st.id][0]] : null, open = openSet.has(String(st.id));
      return `<li class="${hit ? 'nt-hit' : ''}"><details class="nt-d" data-id="${st.id}"${open ? ' open' : ''}><summary><span class="nt-n">${st.id}</span><span class="nt-t">${st.title}</span>${hit ? `<span class="lv ${L.cls}"><b>${L.glyph}</b></span>` : ''}<span class="nt-s">${st.sum}</span></summary><div class="nt-body">${open ? body(c, st) : ''}</div></details></li>`; }).join('');
  }

  function render(el, c){
    c.ex = { P: c.P, d: c.d, S: c.S, attr: c.a, variant: c.v, isBase: c.isBase, focus: c.d.focus[0] }; lastCtx = c;
    el.innerHTML = `<div class="nt-head"><h2 id="notes-h">Interview notes</h2><span><button type="button" class="btn ghost" id="ntAll">Open all steps</button> <button type="button" class="btn ghost" id="ntCopy">Copy notes</button></span></div>
      <p class="hint-s">The whole process from first principles, rewritten for <b>${esc(c.a.name)} › ${esc(c.v.name)}</b>${c.isBase ? ' (baseline)' : ''} with the numbers from the current sample. Every step opens to: why it exists, what we do, the reasoning from scratch, the calculation on this data, and interview points. Steps this variant affects are marked.</p>
      <div class="nt-grid"><section class="nt-box"><h3>The 60-second answer</h3><p>${elevator(c)}</p></section>
      <section class="nt-box"><h3>${c.isBase ? 'The assumption behind this view' : 'This variant, in plain words'}</h3>${card(c)}</section></div>
      <h3 class="nt-h3">Walk through the process</h3><ol class="nt-steps">${steps(c)}</ol>
      <h3 class="nt-h3">Likely follow-up questions</h3><div class="qa">${FOLLOW.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>`;
    const defs = stepDefs(c);
    if (!bound) { bound = true;
      el.addEventListener('toggle', e => { const dd = e.target; if (!dd.matches || !dd.matches('details.nt-d')) return; const id = dd.dataset.id;
        if (dd.open) { openSet.add(id); const b = dd.querySelector('.nt-body'); if (!b.innerHTML) { const st = stepDefs(lastCtx).find(s => String(s.id) === id); b.innerHTML = body(lastCtx, st); } } else openSet.delete(id); }, true); }
    el.querySelector('#ntAll').onclick = () => { const all = [...el.querySelectorAll('details.nt-d')], openAll = all.some(dd => !dd.open); all.forEach(dd => { dd.open = openAll; }); };
    el.querySelector('#ntCopy').onclick = e => { const tmp = document.createElement('div'); tmp.innerHTML = el.innerHTML; tmp.querySelectorAll('details.nt-d').forEach((dd, k) => { dd.open = true; dd.querySelector('.nt-body').innerHTML = body(c, defs[k]); });
      tmp.style.cssText = 'position:fixed;left:-99999px;top:0;width:900px'; document.body.appendChild(tmp); const txt = tmp.innerText.replace(/Open all steps\s*Copy notes\s*/, ''); tmp.remove();
      navigator.clipboard?.writeText(txt).then(() => { e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy notes', 1500); }).catch(() => {}); };
  }
  return { render };
})();
