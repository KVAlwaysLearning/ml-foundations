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
  },
  /* ---------- Data properties ---------- */
  outliers: {
    1: ['origin', 'A few rows do not follow the pattern of the rest.'],
    2: ['major', 'The |z| > 3 check flags unusual values; each flag means "investigate", not "delete".'],
    3: ['minor', 'The scatter shows a point far from the cloud.'],
    '9a': ['major', 'Squared errors give a far-away point a large pull on the fitted line.'], '9b': ['minor', 'Gradient descent reaches the same pulled line.'],
    10: ['major', "Leverage, studentised residuals and Cook's distance single out the row; refit without it to see how much it moves the fit."],
    11: ['major', 'One large residual inflates s², so every SE grows; a pulled slope can also move the interval.'],
    12: ['minor', 'Test error depends on whether test rows look like the outlier or like the rest.'],
    13: ['minor', 'Report the result with and without the influential row.']
  },
  samplesize: {
    1: ['origin', 'How many rows were collected, compared with the number of coefficients p.'],
    4: ['minor', 'With few rows, a 20% test set is only a handful of rows: the test score itself is noisy.'],
    6: ['minor', 'X̃ᵀX̃ needs at least p rows to be invertible.'],
    '9a': ['minor', 'The estimate is unbiased but swings a lot from sample to sample.'],
    10: ['minor', 'Tests have little power with few rows: "no problem found" means little.'],
    11: ['major', 'SE shrinks like 1/√N; with few spare rows the t critical value grows too.'],
    12: ['major', 'Test error is much larger than training error when N is close to p.'],
    13: ['minor', 'Coefficients are hard to interpret when their intervals are wide.']
  },
  noise: {
    1: ['origin', 'How large the random errors are compared with the signal.'],
    '9a': ['none', 'The least-squares estimate stays unbiased at any noise level.'],
    10: ['minor', 'The tests still work, but with more noise each pattern is harder to see.'],
    11: ['major', 'SE grows in proportion to σ: s² estimates σ².'],
    12: ['major', 'The test RMSE cannot go below σ: noise is the irreducible error.'],
    13: ['minor', 'With a lot of noise the slope is real but explains little (low R²).']
  },
  range: {
    1: ['origin', 'Which x values were observed decides where the model has information.'],
    3: ['minor', 'The histogram of x shows the narrow range or the gap.'],
    11: ['major', 'SE of the slope is σ / √Σ(x − x̄)²: a narrow range of x means a large SE.'],
    12: ['minor', 'Test rows from the same range score as usual.'],
    13: ['major', 'Predictions are only supported inside the observed range of x.']
  },
  irrelevant: {
    1: ['origin', 'Some columns have nothing to do with y.'],
    5: ['major', 'Feature selection (or regularisation) should remove them.'],
    6: ['minor', 'More columns: p grows and the spare rows N − p shrink.'],
    '9a': ['minor', 'The fit uses the noise columns to chase noise in y: training error drops.'],
    11: ['major', 'Each noise column has a 5% chance of looking significant; adjusted R² and the F-test account for the extra columns.'],
    12: ['major', 'Test error rises: the noise columns add variance, not information.'],
    13: ['minor', 'The noise coefficients are not zero in the sample, but they mean nothing.']
  },
  missing: {
    1: ['origin', 'Some values of y were never recorded.'],
    2: ['major', 'The missing-value check counts them; here the incomplete rows are dropped (complete-case analysis).'],
    4: ['minor', 'Fewer rows are left to split.'],
    '9a': ['minor', 'Fewer rows; whether the estimate is biased depends on why the values are missing.'],
    11: ['major', 'Fewer rows means larger SEs.'],
    13: ['minor', 'The result describes the rows that were recorded.']
  },
  target: {
    1: ['origin', 'y is not an unbounded measurement with bell-shaped noise.'],
    3: ['major', 'The histogram of y is skewed, piled up at a bound, or made of whole numbers.'],
    5: ['major', 'Transform y (log), or choose a model made for this kind of y.'],
    7: ['major', 'A generalised linear model (log link, logistic, Poisson) matches the shape of y.'],
    10: ['major', 'Residuals curve, fan out and are skewed: RESET, Breusch–Pagan and Jarque–Bera react.'],
    11: ['major', 'Classical SEs assume constant variance, which this y does not have.'],
    12: ['minor', 'Some predictions fall outside the possible range of y.'],
    13: ['major', 'One constant slope cannot describe a y that grows multiplicatively or saturates.']
  },
  categorical: {
    1: ['origin', 'A feature is a category, not a number.'],
    3: ['minor', 'Plot y by category: each level has its own average.'],
    5: ['major', 'One-hot encode with one level dropped: each column is 1 for its level and 0 otherwise.'],
    6: ['minor', 'Each level adds one column to X̃.'],
    '9a': ['minor', 'Each dummy coefficient is a level’s difference from the reference level.'],
    11: ['minor', 'Test the levels together with a partial F-test, not one dummy at a time.'],
    13: ['major', 'Read each dummy coefficient as "compared with the reference level, holding x fixed".']
  },
  subgroups: {
    1: ['origin', 'The rows come from two groups that behave differently, and the group is not recorded as a column.'],
    3: ['major', 'Colour the scatter by any candidate grouping: two clouds appear.'],
    7: ['major', 'Add the group (and, if needed, group × x) to the model.'],
    '9a': ['major', 'One pooled line averages two different relationships, and can even reverse the sign (Simpson’s paradox).'],
    10: ['major', 'Residuals form two bands, or two different trends.'],
    11: ['major', 'The interval is centred on the pooled slope, which is not the slope in either group.'],
    13: ['major', 'The pooled slope is the wrong reading for both groups.']
  },
  shift: {
    1: ['origin', 'The test rows do not come from the same place as the training rows.'],
    4: ['major', 'The test rows are a later period or a different population, not a random 20%.'],
    12: ['major', 'Test error reflects the shift, not just noise.'],
    13: ['minor', 'Monitor the inputs and the errors in production.']
  },
  leakage: {
    1: ['origin', 'Information about y reaches the model in a way that will not be available at prediction time.'],
    2: ['major', 'The leakage check asks of each column and step: was it known before y, and was it decided without the test rows?'],
    4: ['major', 'The split must come before anything that learns from the data.'],
    12: ['major', 'The test score is too good to be true.'],
    13: ['major', 'The model will disappoint in real use.']
  },
  /* ---------- Feature engineering: the choice is made in step 5 ---------- */
  scaling: {
    5: ['origin', 'The scaling method is chosen and learned here, from the training rows.'],
    6: ['major', 'The Gram matrix X̃ᵀX̃ and its condition number κ change with the scaling.'],
    '9a': ['none', 'Predictions are identical under any of these scalings: only the units of w̃ change.'],
    '9b': ['major', 'Gradient descent speed depends on κ: unscaled features make it crawl.'],
    13: ['none', 'Converted back to original units, the coefficients are the same.']
  },
  xtransform: {
    3: ['minor', 'The histogram of x is skewed: a hint that a transform may help.'],
    5: ['origin', 'x is replaced by a transformed version, learned here from the training rows.'],
    '9a': ['major', 'The line is fitted on the new scale, so its shape on the raw x changes.'],
    10: ['major', 'RESET and the residual plot show whether the bend is gone.'],
    12: ['major', 'Test error drops when the transform matches the true shape.'],
    13: ['major', 'The slope now reads "per unit of the transformed x" (for ln x: per 1% change in x, w/100).']
  },
  ytransform: {
    3: ['minor', 'The histogram of y is skewed.'],
    5: ['origin', 'y is replaced by a transformed version; predictions are turned back at the end.'],
    8: ['major', 'The loss is now measured on the transformed scale.'],
    10: ['major', 'Constant spread and bell-shaped residuals are judged on the transformed scale.'],
    12: ['major', 'Predictions must be turned back to the original scale before scoring them.'],
    13: ['major', 'For ln y, the slope is a relative effect: e^w − 1 per unit of x.']
  },
  degree: {
    5: ['origin', 'Powers of x (x², x³, …) are added as new columns.'],
    6: ['major', 'Powers of x are strongly correlated: κ grows quickly with the degree.'],
    '9a': ['major', 'More columns let the fitted curve bend; too many let it chase the noise.'],
    '9b': ['major', 'A large κ makes gradient descent slow.'],
    10: ['major', 'RESET passes once the degree is high enough.'],
    11: ['major', 'Coefficients of correlated powers have large SEs and cannot be read one at a time.'],
    12: ['major', 'Too low a degree underfits; too high a degree overfits: test error shows both.'],
    13: ['major', 'There is no single slope: the effect of x depends on where x is.']
  },
  interactions: {
    5: ['origin', 'A product column x₁·x₂ is added.'],
    7: ['major', 'The model becomes ŷ = b + w₁x₁ + w₂x₂ + w₁₂x₁x₂.'],
    10: ['minor', 'Without the term, residuals show a twisted pattern across x₁ and x₂.'],
    12: ['major', 'Test error drops when the true relationship has an interaction.'],
    13: ['major', 'The slope of x₁ is w₁ + w₁₂·x₂: it depends on x₂.']
  },
  splines: {
    5: ['origin', 'Hinge columns max(0, x − knot) are added.'],
    7: ['major', 'The model becomes a line whose slope changes at each knot.'],
    '9a': ['major', 'Each hinge weight is the change in slope at its knot.'],
    10: ['major', 'RESET and the residual plot show whether the bend is captured.'],
    12: ['major', 'Test error drops when the pieces follow the curve.'],
    13: ['major', 'The slope differs between knots.']
  },
  binning: {
    5: ['origin', 'x is replaced by 0/1 columns for its bins, learned from the training rows.'],
    6: ['minor', 'One column per bin minus one (the first bin is the reference).'],
    '9a': ['major', 'The fit is a staircase: one level per bin.'],
    11: ['minor', 'Each bin coefficient is the gap from the first bin.'],
    12: ['major', 'Bins can capture a jump but throw away the variation inside each bin.'],
    13: ['major', 'Read each bin coefficient as "compared with the first bin".']
  },
  encoding: {
    5: ['origin', 'The text column region is turned into numbers here.'],
    6: ['major', 'The encoding decides how many columns region becomes, and whether X̃ keeps full rank.'],
    '9a': ['major', 'Different encodings give different models.'],
    11: ['minor', 'What each coefficient is compared with depends on the encoding.'],
    12: ['major', 'An encoding that forces a wrong order (ordinal) predicts worse.'],
    13: ['major', 'Read the coefficients according to the encoding.']
  },
  centering: {
    5: ['origin', 'x is centred (x − mean) before the square is taken.'],
    6: ['major', 'Raw x and x² are almost the same column when x is far from 0: κ is huge.'],
    10: ['major', 'VIF of x and x² drops from very large to about 1 after centring.'],
    11: ['major', 'The SE of the linear term shrinks a lot after centring.'],
    12: ['none', 'Predictions are identical: centring only re-labels the same model.'],
    13: ['major', 'The intercept becomes the prediction at the mean x, and the linear term the slope there.']
  },
  selection: {
    5: ['origin', 'Columns are chosen here, using the training rows only.'],
    6: ['minor', 'Fewer columns: a smaller X̃ᵀX̃.'],
    11: ['major', 'p-values after selection are too optimistic: the columns were chosen for looking significant.'],
    12: ['major', 'Removing noise columns usually improves the test error; removing useful ones hurts it.'],
    13: ['major', 'A dropped column is not proven useless, and a kept one is not proven causal.']
  },
  /* ---------- Model formulation: the variant's own model, next to OLS ---------- */
  intercept: { 7: ['origin', 'The model is written without an intercept: ŷ = w·x.'], '9a': ['major', 'Without an intercept the slope has to absorb the level of y: it is biased.'], 10: ['major', 'Residuals no longer average 0.'], 11: ['major', 'R² is computed around 0 instead of around ȳ and looks misleadingly high.'], 12: ['major', 'Test error is larger.'], 13: ['major', 'The slope does not mean what the true slope means.'] },
  modeltype: { 7: ['origin', 'The model type decides which columns go in and how the rows are weighted.'], '9a': ['major', 'Different model types solve different equations.'], 10: ['major', 'The residual checks show what the simpler models miss.'], 11: ['major', 'WLS and GLS give honest standard errors when the error spread or correlation is modelled.'], 12: ['major', 'Test error drops as the model gets the shape right.'] },
  robust: { 7: ['origin', 'A different way of fitting the same straight line.'], 8: ['major', 'The loss grows slower than e² for large residuals (or not at all).'], '9a': ['major', 'The robust line is not pulled by the outliers.'], 10: ['major', 'The outliers stand out as large residuals of the robust fit.'], 12: ['major', 'On clean test rows, the robust line predicts better.'], 13: ['major', 'The robust slope describes the bulk of the data.'] },
  regularisation: { 5: ['major', 'Features must be standardised so the penalty treats them alike.'], 8: ['origin', 'A penalty on the size of the weights is added to the loss.'], '9a': ['major', 'The solution changes: ridge adds λ to the diagonal of X̃ᵀX̃; lasso needs coordinate descent.'], 11: ['major', 'Classical SEs and p-values do not apply to penalised estimates.'], 12: ['major', 'Shrinkage trades a little bias for less variance: test error usually drops with correlated features.'], 13: ['major', 'Coefficients are shrunk toward 0 (biased) on purpose.'] },
  lambda: { 8: ['origin', 'λ sets how much the penalty counts against the fit.'], '9a': ['major', 'Larger λ, smaller weights.'], 12: ['major', 'Too small: overfits; too large: underfits. CV picks the middle.'], 13: ['major', 'Coefficients shrink toward 0 as λ grows.'] },
  alpha: { 8: ['origin', 'α mixes the squared (ridge) and absolute (lasso) penalties.'], '9a': ['major', 'With α > 0, some weights become exactly 0.'], 12: ['minor', 'Test error is similar across α when λ is tuned.'], 13: ['major', 'Lasso keeps one of a group of correlated features; ridge spreads the weight over all of them.'] },
  penalisebias: { 8: ['origin', 'Whether the intercept is part of the penalty.'], '9a': ['major', 'A penalised intercept is pulled toward 0, away from the mean of y.'], 12: ['major', 'Every prediction is shifted toward 0.'], 13: ['major', 'The intercept is wrong; the slopes are barely affected.'] },
  lossfn: { 8: ['origin', 'The loss decides how much each residual costs: squared, absolute, Huber, pinball or log-cosh.'], '9a': ['major', 'Only squared loss has the normal equations; the others are solved by iteratively reweighted least squares.'], 10: ['major', 'Residuals of a non-squared loss need not average 0.'], 11: ['major', 'Classical SEs belong to OLS; other losses need their own (sandwich or bootstrap) SEs.'], 12: ['major', 'The best loss for the test score depends on the metric: MSE is scored best by the squared loss, MAE by the absolute loss.'], 13: ['major', 'Each loss estimates a different line: mean, median, a quantile, or a robust centre.'] },
  penalty: { 5: ['major', 'Features must be standardised so the penalty treats them alike.'], 8: ['origin', 'A penalty term on the weights is added to the loss.'], '9a': ['major', 'L2 keeps a closed form (λ on the diagonal); L1 needs coordinate descent.'], 11: ['major', 'Classical SEs do not apply to penalised estimates.'], 12: ['major', 'With correlated features a penalty usually lowers the test error.'], 13: ['major', 'Coefficients are shrunk; L1 sets some exactly to 0.'] },
  solver: { '9a': ['origin', 'A different way of solving the same normal equations.'], '9b': ['major', 'Iterative solvers (gradient or coordinate descent) approach the answer step by step.'], 6: ['major', 'The condition number decides how accurate each solver is: κ(X̃) for QR and SVD, κ(X̃)² for the normal equations and Cholesky.'] },
  gdtype: { '9b': ['origin', 'How many rows each gradient step uses.'], 12: ['minor', 'An unconverged SGD run predicts slightly worse.'], 13: ['minor', 'The weights wander around the minimum unless η decays.'] },
  lr: { '9b': ['origin', 'The step size η decides whether gradient descent crawls, converges, zig-zags or explodes.'], 12: ['major', 'A run that has not converged (or diverged) gives worse predictions.'], 13: ['major', 'The weights are wherever the run stopped, not the least-squares weights.'] },
  schedule: { '9b': ['origin', 'How η changes over the epochs of SGD.'], 12: ['minor', 'A decaying η lets SGD settle near the minimum.'] },
  optimiser: { '9b': ['origin', 'The update rule: plain, momentum, Nesterov, RMSProp or Adam.'], 12: ['minor', 'All reach the same minimum eventually; they differ in speed.'] },
  init: { '9b': ['origin', 'Where the weights start.'], 13: ['minor', 'The loss is a convex bowl: every start reaches the same minimum.'] },
  stopping: { '9b': ['origin', 'When to stop iterating.'], 4: ['major', 'Early stopping holds out part of the training rows as a validation set.'], 12: ['minor', 'Stopping early leaves the weights short of the minimum (sometimes on purpose).'], 13: ['minor', 'The weights depend on where the run stopped.'] },
  scalegd: { 5: ['origin', 'Whether the features are standardised before gradient descent.'], 6: ['major', 'Unscaled features make κ huge: the bowl is a very long, narrow valley.'], '9b': ['major', 'The safe step is set by the steep direction, so the flat direction barely moves.'], 12: ['major', 'An unconverged run predicts badly.'] },
  otherforms: { 6: ['major', 'PCA and PLS replace the correlated columns by a few uncorrelated components.'], 7: ['origin', 'A different model built on the same features.'], '9a': ['major', 'The solution is found in component space (PCA, PLS) or as a posterior (Bayesian).'], 11: ['major', 'Bayesian credible intervals replace confidence intervals.'], 12: ['major', 'Fewer effective parameters: less variance on correlated data.'], 13: ['major', 'Coefficients are mapped back from the components, or come with posterior spreads.'] }
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
  reverse: { 7: ['major', 'Needs an instrument or a structural (simultaneous-equation) model.'] },
  levon: { '9a': ['none', 'The far-out row lies on the true line, so it does not pull the slope.'], 10: ['major', "Leverage is huge but the residual is small, so Cook's distance stays modest: a good leverage point."], 11: ['minor', 'The SE of the slope actually shrinks, because the far-out x widens the range.'] },
  levoff: { 12: ['major', 'The pulled line predicts the ordinary test rows worse.'], 13: ['major', 'The slope mostly reflects one row.'] },
  outcluster: { 10: ['major', "Masking: each row of the cluster hides the others, so removing one at a time barely changes the fit; Cook's distance under-flags them."] },
  outy: { '9a': ['minor', 'At a typical x the outlier mostly lifts the intercept; the slope moves little.'] },
  nlarge: { 1: ['origin', 'N = 200: many more rows than coefficients.'], 11: ['minor', 'SEs are small.'], 12: ['minor', 'Train and test error are close.'] },
  nmod: { 11: ['minor', 'SEs are moderate.'] },
  nap: { 6: ['major', 'With N_train = p + 1 rows, X̃ᵀX̃ is invertible but barely determined.'], 10: ['major', 'With one spare row the tests have nothing to work with.'], 11: ['major', 'One degree of freedom: t critical value 12.7 instead of 2, so the intervals are huge.'] },
  nlp: { 6: ['major', 'Fewer rows than columns: rank(X̃) < p, X̃ᵀX̃ has zero eigenvalues and no inverse.'], '9a': ['major', 'Infinitely many weight vectors fit the training rows exactly; the minimum-length one is reported.'], 10: ['major', 'No residuals are left, so no test can be run.'], 11: ['major', 'No spare rows: s², SEs, t and p are undefined.'] },
  nslow: { 11: ['minor', 'SEs scale with σ.'] },
  nszero: { 10: ['major', 'Every residual is 0, so the tests have nothing to test.'], 11: ['major', 's² = 0, so the SEs are 0 and t is infinite: perfect certainty, which real data never give.'], 12: ['major', 'Test error is 0: there is nothing irreducible left.'] },
  nspure: { 1: ['origin', 'y does not depend on x at all: the true slope is 0.'], 11: ['major', 'The F-test should not reject; about 5% of samples still show a "significant" slope by chance.'], 12: ['major', 'Test R² is about 0 or negative: the model is no better than predicting the mean.'], 13: ['major', 'Any slope estimated here is noise.'] },
  rrestrict: { 13: ['major', 'Outside 4–6 the model has no evidence at all.'] },
  rgap: { 11: ['minor', 'The SE of the slope is fine: the gap does not reduce the spread of x.'], 12: ['minor', 'The test rows come from the same gappy distribution, so the score looks fine.'], 13: ['major', 'Inside the gap the line is a guess: the true curve has a bump there that no data point shows.'] },
  rextrap: { 4: ['origin', 'The test rows are the high-x rows: beyond anything the model was trained on.'], 12: ['major', 'Test error jumps: the line keeps going straight where the truth bends.'], 13: ['major', 'Extrapolation: never trust the line outside the training range.'] },
  irfew: { 12: ['minor', 'Test error rises a little.'] },
  ircopy: { 6: ['major', 'x and x_copy are almost the same column: κ is large.'], '9a': ['major', 'The credit is split arbitrarily between x and x_copy.'], 11: ['major', 'Both SEs inflate (the same story as multicollinearity).'], 12: ['none', 'Predictions are fine.'] },
  mcar: { '9a': ['none', 'Missing completely at random: the rows left are a random sample, so no bias.'] },
  mar: { '9a': ['none', 'The chance of missing depends only on x, which is in the model, so the slope is still unbiased.'], 13: ['minor', 'High-x rows are under-represented, so that region is less precise.'] },
  mnar: { '9a': ['major', 'High y values are missing, so the line is pulled down where y is high: the slope is biased.'], 11: ['major', 'The interval is centred on a biased slope and misses the truth.'], 13: ['major', 'Results do not describe the full population.'] },
  tbound: { 12: ['major', 'Predictions can go below 0 or above 20.'] },
  tcount: { 12: ['major', 'Predictions are not whole numbers and can be negative near x = 0.'] },
  cbin: { 6: ['minor', 'One extra 0/1 column.'] },
  chigh: { 6: ['major', '24 dummy columns: p jumps, and some columns have only one or two 1s.'], '9a': ['major', 'Levels with one or two rows get noisy coefficients.'], 11: ['major', 'Rare levels have very large SEs.'], 12: ['major', 'Test rows whose level was rare or unseen are predicted poorly: overfitting.'] },
  sgint: { 10: ['major', 'Residuals form two bands (bimodal): Jarque–Bera may react.'], '9a': ['major', 'Because group 1 also has higher x, the pooled slope absorbs the group gap.'] },
  sgslope: { 10: ['major', 'Residuals fan out along x: the two groups drift apart.'] },
  simpson: { '9a': ['major', 'The pooled slope has the opposite sign to the slope inside each group.'], 13: ['major', 'Simpson’s paradox: the pooled reading is backwards.'] },
  shfeat: { 12: ['minor', 'The rule is the same, so a correct model still predicts well; test error mostly reflects noise.'], 13: ['minor', 'Covariate shift hurts when the model is only approximately right.'] },
  shrel: { 12: ['major', 'Test error jumps: the slope learned on the past no longer applies.'], 13: ['major', 'Retrain on recent data and monitor the errors over time.'] },
  lktarget: { 3: ['major', 'The leak column correlates almost perfectly with y: suspicious, not good news.'], '9a': ['major', 'The model leans on the leak and ignores x.'], 11: ['minor', 'The leak looks extremely significant.'] },
  lkprep: { 5: ['origin', 'Target encoding (each level replaced by its mean y) was computed on every row, before the split.'], '9a': ['major', 'The model puts weight on enc, a column built from y.'], 11: ['major', 'enc looks significant although the category has no effect.'] },
  scnone: { 6: ['major', 'x₂ is about 1 000 times larger than x₁: κ is enormous.'], '9b': ['major', 'Gradient descent barely moves along x₁ in the allowed iterations.'] },
  scminmax: { 5: ['origin', 'One very large x₂ squeezes every other row into a small part of [0, 1].'] },
  scrobust: { 5: ['origin', 'Median and IQR ignore the very large x₂, so the other rows keep a normal spread.'] },
  deg1: { 12: ['major', 'Underfitting: a line cannot follow the S-shape, so train and test errors are both high.'] },
  deg10: { 12: ['major', 'Overfitting: train error falls, test error rises.'], 6: ['major', 'κ is astronomically large: the powers are nearly collinear.'] },
  encall: { 6: ['major', 'The four region columns add up to the intercept column: rank(X̃) < p.'] },
  encord: { 12: ['major', 'The codes 0, 1, 2, 3 force equal steps in a fixed order; the real effects (0, 3, −2, 5) do not follow it.'] },
  enctarget: { 11: ['minor', 'One column instead of three: fewer coefficients, but the encoding itself was estimated.'] },
  ytnone: { 10: ['major', 'Residuals curve and fan out, and are skewed.'] },
  xtnone: { 10: ['major', 'Residuals bend: the straight line in raw x misses the log shape.'] }
};
/* Model formulation: what the variant's own model is, minimises, finds and scores (next to the OLS backbone) */
const ALT_MODEL = { origin: 'ŷ = w·x (no intercept: the line must pass through 0)', wls: 'ŷ = X̃w̃, the same columns as OLS', gls: 'ŷ = X̃w̃, with errors εₜ = ρεₜ₋₁ + uₜ', huber: 'ŷ = X̃w̃, the same line shape as OLS', ransac: 'ŷ = X̃w̃, fitted on the inliers only', theil: 'ŷ = b + w·x', quantile: 'ŷ = X̃w̃ estimates the median of y, not its mean', ridge: 'ŷ = X̃w̃, the same columns as OLS', lasso: 'ŷ = X̃w̃, some w̃ⱼ exactly 0', enet: 'ŷ = X̃w̃, some w̃ⱼ exactly 0', pcr: 'ŷ = b + Σ γₖ·(component k); each component is a fixed mix of the features', pls: 'ŷ = b + Σ qₖ·(PLS component k)', bayes: 'w̃ has a prior N(0, τ²); ŷ uses its posterior mean' };
function optText(c, part){
  const O = c.P.opt; if (!O) return part === 'solver' ? 'not used: the normal equations above (the Optimisation branch has the other solvers)' : 'not used: the plain gradient descent above (the Optimisation branch has the other set-ups)';
  if (part === 'solver' && O.attr !== 'solver') return 'the normal equations above';
  if (part === 'run' && O.attr === 'solver' && !O.hist) return `no iterations: ${esc(O.label)} is exact (see step 9a)`;
  if (part === 'solver') return `${esc(O.label)}: w̃ = ${vec(O.w, 4)}${O.info.diff != null ? `, the same as the normal equations to ${O.info.diff < 1e-9 ? 'machine precision' : num(O.info.diff, 2)}` : O.gap < 1e-3 ? ', the same as the normal equations' : ` (${num(O.gap, 3)} away from the normal equations)`}`;
  const st = O.stop || {};
  return `${O.diverged ? mark(false) : O.gap < 1e-3 ? mark(true) : mark(false, true)} ${esc(O.label)}; stopped at ${st.t}: ${esc(st.reason || '')}. L = ${O.diverged ? (isFinite(O.Lfinal) ? OP.ex(O.Lfinal) + ', diverging' : '∞ (diverged)') : num(O.Lfinal, 5)} vs the minimum ${num(O.Lstar, 5)}`;
}
function altText(c, part){
  const A = c.P.alt; if (!A) return c.d.mf ? 'this variant is ordinary least squares itself: see above' : 'not used: this is ordinary least squares (the Model formulation branch has the alternatives)';
  const m = A.info.method || A.kind, lam = A.info.lam;
  if (part === 'model') return `${esc(A.label)}: ${ALT_MODEL[m] || ALT_MODEL[A.kind] || ''}`;
  if (part === 'loss') return ({ origin: 'Σ(y − w·x)², with no intercept to absorb the level of y', wls: 'Σ wᵢ(yᵢ − ŷᵢ)², with wᵢ = 1 / estimated variance of row i', gls: `Σ (transformed residual)², after removing ρ = ${num(A.info.rho, 3)} of the previous row`, huber: 'Σ ρ(eᵢ/s): eᵢ²/2 when |eᵢ/s| ≤ 1.345, otherwise 1.345·|eᵢ/s| − 1.345²/2', ransac: `the number of rows within ${num(A.info.thr, 3)} of the line (maximised), then squared error on those rows`, theil: 'no loss is minimised: the slope is the median of pairwise slopes', quantile: 'Σ |yᵢ − ŷᵢ| (absolute, not squared)', ridge: `Σe² + λ·Σw̃ⱼ² with λ = ${num(lam, 4)}${A.info.penB ? ' (the intercept is penalised too)' : ' (the intercept is not penalised)'}`, lasso: `(1/2N)·Σe² + λ·Σ|w̃ⱼ| with λ = ${num(lam, 4)}`, enet: `(1/2N)·Σe² + λ·(α·Σ|w̃ⱼ| + (1 − α)/2·Σw̃ⱼ²), α = ${A.info.alpha}, λ = ${num(lam, 4)}`, pcr: `Σe² using the first ${A.info.K} principal components only`, pls: `Σe² using ${A.info.K} components built to covary with y`, bayes: `posterior ∝ likelihood × prior, the same as Σe² + (s²/τ²)·Σw̃ⱼ² with s²/τ² = ${num(lam, 4)}` })[m] || '';
  if (part === 'fit') return `w̃ = ${vec(A.w || A.wOrig, 4)}; training RMSE ${num(A.rmseTr, 3)} (OLS ${num(c.P.rmseTr, 3)})`;
  if (part === 'test') return `${A.rmseTe < c.P.rmseTe ? mark(true) : mark(false, true)} test RMSE ${num(A.rmseTe, 3)} vs OLS ${num(c.P.rmseTe, 3)}; test R² ${num(A.r2Te, 3)} vs ${num(c.P.r2Te, 3)}`;
  if (part === 'coef') return c.P.names.map((nm, j) => `${nm === '1' ? 'b' : nm}: ${num(A.wOrig[j], 3)} (OLS ${num(c.P.wOrig[j], 3)}${c.d.truth.coef[j] != null ? `, true ${c.d.truth.coef[j]}` : ''})`).join('; ');
  return '';
}
/* one line on what step 5 built for a Feature engineering variant */
function feSummary(c){
  const fe = c.d.fe; if (!fe) return 'none applied (covered in the Feature engineering branch)';
  const nm = c.P.names.slice(1).join(', ');
  switch (fe.attr) {
    case 'scaling': return `scaling = ${{ none: 'none (raw values)', std: 'standardisation (x − mean) / sd', minmax: 'min–max (x − min) / (max − min)', robust: 'robust (x − median) / IQR' }[fe.kind]}; columns: ${nm}`;
    case 'xtransform': return fe.kind === 'none' ? 'x used as it is' : `x → ${fe.nm}${fe.lam != null ? ` with λ = ${num(fe.lam, 3)}` : ''}; skewness of x ${num(fe.skewBefore, 2)} → ${num(fe.skewAfter, 2)}`;
    case 'ytransform': return fe.kind === 'none' ? 'y used as it is' : `y → ${fe.yName}${fe.lam != null ? ` with λ = ${num(fe.lam, 3)}` : ''}; skewness of y ${num(fe.skewBefore, 2)} → ${num(fe.skewAfter, 2)}`;
    case 'degree': return `degree ${fe.kind}: columns ${nm}`;
    case 'interactions': return fe.kind === 'none' ? 'no product column' : 'added x₁·x₂ (row by row: x₁ × x₂)';
    case 'splines': return fe.knots.length ? `hinges at ${fe.knots.join(', ')}: ${fe.knots.map((k, q) => `h${subN(q + 1)} = max(0, x − ${k})`).join(', ')}` : 'no hinges: one straight line';
    case 'binning': return fe.edges ? `5 ${fe.kind === 'width' ? 'equal-width' : 'quantile'} bins, edges ${fe.edges.map(e => num(e, 2)).join(' | ')}; training rows per bin ${fe.counts.join(', ')}` : 'x used as it is';
    case 'encoding': return { onehot: 'one-hot, East dropped: region_North, region_South, region_West', keepall: `${mark(false)} one-hot with all four levels kept (the dummy-variable trap)`, ordinal: 'ordinal codes: East 0, North 1, South 2, West 3 (one column, code(region))', target: `target encoding: each level → its mean y in the training rows (${fe.means.map((m, q) => `${c.d.rawCat.levels[q]} ${num(m, 2)}`).join(', ')})` }[fe.kind];
    case 'centering': return fe.kind === 'centred' ? `x̄ = ${num(fe.c, 3)} from the training rows; columns xc = x − x̄ and xc²; no scaling` : 'columns x and x² as they are; no scaling';
    case 'selection': return `${fe.kind === 'all' ? 'all' : 'kept'} ${c.P.names.length - 1} of 10 candidates: ${nm}`;
  }
  return '';
}
/* "no test" with its reason */
const noTest = c => c.P.noDg ? `${mark(false)} not available: ${c.P.noDg}` : '—';
/* refit without the row with the largest Cook's distance (standardised scale, then back to original units) */
function dropOne(P, j = null){
  const f = P.f; if (!f.cook || P.perfect || P.nTr - 1 <= f.rank) return null;
  const row = f.cook.indexOf(Math.max(...f.cook)), keep = P.Xtr.map((_, i) => i).filter(i => i !== row);
  const g = ST.ols(keep.map(i => P.Xtr[i]), keep.map(i => P.ytr[i]), true), jj = j ?? (P.f.w.length > 1 ? 1 : 0);
  return { row: P.tr[row], k: row, j: jj, w0: f.w[jj] / P.sd[jj], w1: g.w[jj] / P.sd[jj], dw: (g.w[jj] - f.w[jj]) / P.sd[jj], se: f.se[jj] / P.sd[jj], g, cook: f.cook[row], lev: f.lev ? f.lev[row] : NaN };
}
/* confidence band for the mean and prediction band for a new point along feature j, other features at their training means (standardised 0) */
function band(P, j){
  const f = P.f; if (!f.inv || !(f.df > 0)) return null;
  const xs = P.tr.map((_, k) => P.Xtr[k][j] * P.sd[j] + P.mu[j]), lo = Math.min(...xs), hi = Math.max(...xs), span = hi - lo || 1, tc = f.tc || 1.96;
  const pts = [0, 0.25, 0.5, 0.75, 1, 1.3].map(t => { const x = lo + span * t, z = P.Xtr[0].map((_, q) => q === 0 ? 1 : q === j ? (x - P.mu[j]) / P.sd[j] : 0);
    const q = LA.dot(z, LA.mv(f.inv, z)), yh = LA.dot(z, f.w); return { x, z, q, yh, ci: tc * Math.sqrt(f.s2 * q), pi: tc * Math.sqrt(f.s2 * (1 + q)) }; });
  return { pts, tc, lo, hi };
}
function influence(attrId, variant, isBase, strength){
  const out = {};
  if (isBase) return out;
  Object.assign(out, INF[attrId] || {}, INF_V[variant.id] || {});
  const weak = variant.id === 'moderate' || variant.id === 'nmod' || (variant.strength && strength < 0.3);
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
      ['', 'Missing values', c => c.P.dropped ? `${mark(false, true)} ${c.P.dropped.idx.length} rows had no y and were dropped before anything else (complete-case analysis); ${c.P.N} rows remain` : `${mark(true)} none`],
      [sy('z'), 'Outliers with |z| > 3', c => `${c.P.outY + c.P.outX ? mark(false, true) : mark(true)} y: ${c.P.outY}, features: ${c.P.outX}`],
      ['', 'Leakage check', c => c.variant.id === 'lktarget' ? `${mark(false)} the column "leak" is recorded after y (correlation with y ${num(c.P.eda.corrXY[c.P.names.indexOf('leak') - 1], 3)}): it must be removed` : c.variant.id === 'lkprep' ? `${mark(false)} the column enc (target encoding of a category) was computed from y on every row, test rows included, so each test row's own y is inside its feature` : `${mark(true)} no feature is built from y, and nothing was learned before the split`],
      ['', 'Categorical columns: levels and rows per level', c => { const rc = c.d.rawCat; if (!rc) return `${mark(true)} none: every column is numeric`; const cnt = rc.levels.map((l, q) => c.d.group.filter(g => g === q).length), rare = cnt.filter(k => k <= 3).length;
        return `${rare ? mark(false, true) : mark(true)} <b>${rc.name}</b> (text): ${rc.levels.length} levels${rc.levels.length <= 6 ? ` (${rc.levels.map((l, q) => `${l} ${cnt[q]}`).join(', ')} rows)` : `, ${Math.min(...cnt)}–${Math.max(...cnt)} rows each`}${rare ? `; ${rare} level(s) with 3 rows or fewer` : ''}. Encoded into 0/1 columns in step 5.`; }]
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
      [`${sy('Ntr')}, ${sy('Nte')}`, c => c.P.splitFixed ? 'Split fixed by the data (not random)' : 'Random 80 / 20 split', c => c.P.splitFixed ? `${sy('Ntr')} = ${c.P.nTr}, ${sy('Nte')} = ${c.P.nTe}: ${esc(c.d.note || 'the test rows are set by the data')}` : `${sy('Ntr')} = ${c.P.nTr}, ${sy('Nte')} = ${c.P.nTe} (shuffled with sample #${c.S.seed}${c.d.forceTrain ? '; the changed rows are kept in training so their effect can be seen' : ''})`],
      ['', 'Split method used', c => c.variant.id === 'dupes' ? `${mark(false, true)} random shuffle; copies of the same row land on both sides, so remove duplicates (or split by unique observation) first` : c.attr.id === 'independence' && !c.isBase ? `${mark(false, true)} random shuffle; this variant needs a ${c.variant.id === 'cluster' ? 'group' : 'time-ordered'} split instead` : `${mark(true)} random shuffle, appropriate for independent rows`],
      ['', 'Cross-validation', () => 'not used here (covered in the Validation branch)']
    ]},
  { id: 5, title: 'Feature engineering', goal: 'Transform and scale inputs using statistics from the training rows only.',
    attrs: ['scaling', 'xtransform', 'ytransform', 'degree', 'interactions', 'splines', 'binning', 'encoding', 'centering', 'selection', 'irrelevant'],
    subs: [
      [`${sy('mu')}, ${sy('sd')}`, c => ({ std: 'Training mean and SD of each numeric feature', none: 'No scaling: every feature kept as it is (μ = 0, s = 1)', minmax: 'Training minimum and range (max − min) of each numeric feature', robust: 'Training median and IQR (Q3 − Q1) of each numeric feature' })[c.P.scale || 'std'], c => c.P.names.slice(1).filter(nm => !GEN.noScale(nm)).map(n => { const k = c.P.names.indexOf(n) - 1, L = { std: ['μ', 's'], none: ['μ', 's'], minmax: ['min', 'range'], robust: ['median', 'IQR'] }[c.P.scale || 'std']; return `${n}: ${L[0]} = ${num(c.P.mu[k + 1], 3)}, ${L[1]} = ${num(c.P.sd[k + 1], 3)}`; }).join('; ') + (c.d.rawCat ? `; the 0/1 columns from ${c.d.rawCat.name} are not scaled (μ = 0, s = 1)` : '')],
      [sy('Xt'), 'Standardise: x̃ = (x − μ) / s, first training row', c => `${vec(c.P.Xtr[0], 3)}`],
      ['', c => c.d.rawCat ? `Encode ${c.d.rawCat.name}: text → 0/1 columns` : 'Categorical encoding', c => { const rc = c.d.rawCat; if (!rc) return c.d.hiddenGroup ? `${mark(false, true)} the rows come from two groups, but no group column was recorded` : 'no categorical features';
        const cols = c.P.names.filter(GEN.isCat); return `${rc.keepAll ? mark(false) : cols.length > 10 ? mark(false, true) : mark(true)} ${rc.levels.length} levels → ${cols.length} column${cols.length > 1 ? 's' : ''} (${cols.slice(0, 4).join(', ')}${cols.length > 4 ? ', …' : ''})${rc.keepAll ? ': all levels kept alongside the intercept, the dummy-variable trap' : `, reference level ${rc.ref} dropped`}; not scaled`; }],
      ['', c => c.d.fe ? 'Feature engineering in this variant' : 'Transforms, polynomials, selection', c => feSummary(c)]
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
      ['', 'Formulation', () => 'ordinary least squares with an intercept'],
      ['', "This variant's model", c => altText(c, 'model')]
    ]},
  { id: 8, title: 'Loss', goal: 'Decide what "best" means.',
    attrs: ['lossfn', 'penalty', 'lambda', 'alpha', 'penalisebias'],
    subs: [
      [sy('e'), 'Residuals', () => `${sy('e')} = ${sy('y')} − ${sy('yhat')}`],
      [sy('L'), 'Mean squared error', c => `${sy('L')}(${sy('wt')}) = (1/${c.P.nTr}) ${sy('e')}ᵀ${sy('e')}; at ${sy('wt')} = 0 it is ${num(c.P.iters[0].L, 3)}`],
      [sy('lam'), 'Penalty', () => `${sy('lam')} = 0 (no regularisation)`],
      ['', "This variant's loss", c => altText(c, 'loss')]
    ]},
  { id: '9a', title: 'Optimise: closed form', goal: 'Set the gradient to zero and solve the normal equations.',
    attrs: ['solver'],
    subs: [
      [`${sy('XtX')}, ${sy('det')}`, 'From the loss to the normal equations X̃ᵀX̃ w̃ = X̃ᵀy', c => `${c.P.P}×${c.P.P}, ${sy('det')} = ${num(c.P.f.det, 4)}`],
      [sy('wt'), 'Solve them: w̃ = (X̃ᵀX̃)⁻¹X̃ᵀy', c => `${c.P.f.full ? mark(true) : mark(false)} ${sy('wt')}* = ${vec(c.P.f.w)}${c.P.f.full ? '' : ' (minimum-norm: the solution is not unique)'}`],
      [sy('L'), 'Loss at the solution', c => `${sy('L')}(${sy('wt')}*) = ${num(c.P.f.SSE / c.P.nTr, 4)}`],
      ['', "This variant's fit", c => altText(c, 'fit')],
      ['', "This variant's solver", c => optText(c, 'solver')]
    ]},
  { id: '9b', title: 'Optimise: gradient descent', goal: 'Reach the same minimum by repeated downhill steps.',
    attrs: ['gdtype', 'lr', 'schedule', 'optimiser', 'init', 'stopping', 'scalegd'],
    subs: [
      [`${sy('H')}, ${sy('lmax')}`, 'Curvature sets the largest safe step', c => `${sy('lmax')} = ${num(c.P.eigH[0], 4)}, so steps diverge above 2/${sy('lmax')} = ${num(c.P.lim, 4)}`],
      [sy('eta'), 'Step size used', c => `${sy('eta')} = ${num(c.P.frac, 2)} × 2/${sy('lmax')} = ${num(c.P.eta, 4)}${c.P.diverged ? ' (too big: the run diverges)' : ''}`],
      [`${sy('t')}, ${sy('grad')}`, 'Loop: predict → residual → loss → gradient → update', c => `<div class="it-tbl"><table><tr><th>${sy('t')}</th><th>${sy('wt')}_t</th><th>${sy('L')}</th><th>‖${sy('grad')}‖</th><th>${sy('wt')}_t − ${sy('eta')}${sy('grad')}</th></tr>` +
        c.P.iters.map(i => `<tr><td>${i.t}</td><td>${vec(i.w, 3)}</td><td>${num(i.L, 4)}</td><td>${num(i.gn, 4)}</td><td>${vec(i.next, 3)}</td></tr>`).join('') + `</table></div>`],
      ['', 'Compared with the closed form', c => { const last = c.P.iters[c.P.iters.length - 1], gap = Math.abs(last.L - c.P.f.SSE / c.P.nTr); return `${gap < 1e-6 ? mark(true) : mark(false, true)} after ${last.t} iterations ${sy('L')} = ${num(last.L, 4)} vs ${num(c.P.f.SSE / c.P.nTr, 4)}`; }],
      ['', "This variant's run", c => optText(c, 'run')]
    ]},
  { id: 10, title: 'Diagnostics', goal: 'Check the assumptions on the training residuals.',
    attrs: ['residplots', 'influence', 'lintest', 'vartest', 'indtest', 'normtest', 'colltest'],
    subs: [
      [sy('reset'), 'Linearity (Ramsey RESET)', c => c.P.dg?.reset ? `${c.P.dg.reset.p >= 0.05 ? mark(true) : mark(false)} ${pEq(c.P.dg.reset.p)}` : noTest(c)],
      [sy('bp'), 'Constant variance (Breusch–Pagan)', c => c.P.dg?.bp ? `${c.P.dg.bp.p >= 0.05 ? mark(true) : mark(false)} ${pEq(c.P.dg.bp.p)}` : noTest(c)],
      [sy('dw'), 'Independence (Durbin–Watson, rows in order)', c => c.P.dg ? `${c.P.dg.dw > 1.5 && c.P.dg.dw < 2.5 ? mark(true) : mark(false)} ${sy('dw')} = ${num(c.P.dg.dw, 2)}` : noTest(c)],
      [sy('jb'), 'Normality (Jarque–Bera)', c => c.P.dg ? `${c.P.dg.jb.p >= 0.05 ? mark(true) : mark(false)} ${pEq(c.P.dg.jb.p)}` : noTest(c)],
      [sy('vif'), 'Collinearity (largest VIF)', c => c.P.dg?.vif.length ? (v => `${v <= 5 ? mark(true) : v <= 10 ? mark(false, true) : mark(false)} ${isFinite(v) ? num(v, 1) : '∞'}`)(Math.max(...c.P.dg.vif)) : noTest(c)],
      [sy('cook'), "Influence (largest Cook's distance)", c => c.P.f.cook && !c.P.perfect ? (v => `${v < 1 ? mark(true) : mark(false)} ${num(v, 3)}`)(Math.max(...c.P.f.cook)) : noTest(c)],
      ['', 'Refit without the most influential row', c => { const r = dropOne(c.P); if (!r) return noTest(c); return `${Math.abs(r.dw) > 2 * r.se ? mark(false, true) : mark(true)} row ${r.row + 1}: slope of ${c.P.names[r.j]} ${num(r.w0, 3)} → ${num(r.w1, 3)} without it (change ${num(r.dw, 3)} = ${num(Math.abs(r.dw) / r.se, 2)} SEs)`; }]
    ]},
  { id: 11, title: 'Inference', goal: 'How uncertain is each coefficient, and which standard error is right for this data?',
    attrs: ['coefinf', 'ftest', 'robustse', 'intervals'],
    subs: [
      [sy('s2'), 'Error variance', c => c.P.f.df > 0 ? `${sy('s2')} = SSE / (${c.P.nTr} − ${c.P.f.rank}) = ${num(c.P.f.s2, 4)}${c.P.perfect ? ` ${mark(false)} every residual is 0, so s² = 0 and every SE below is 0 (t is infinite)` : ''}` : `${mark(false)} undefined: SSE / (${c.P.nTr} − ${c.P.f.rank}) divides by ${c.P.nTr - c.P.f.rank}. There are no spare rows to measure the noise with, so s², the SEs, t, p and the intervals cannot be computed`],
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
      [sy('r2'), 'Test R²', c => num(c.P.r2Te, 3)],
      ['', 'This variant on the test rows', c => altText(c, 'test')],
      ['', 'Back on the original scale of y', c => c.P.orig ? `predictions turned back with ${c.d.fe.kind === 'log' ? 'eᶻ' : 'the inverse Box-Cox'}: train RMSE ${num(c.P.orig.rmseTr, 3)}, test RMSE ${num(c.P.orig.rmseTe, 3)} (in the units of y)` : 'y was not transformed, so the scores above are already in the units of y']
    ]},
  { id: 13, title: 'Interpretation', goal: 'Undo the scaling and say what the coefficients mean.',
    attrs: ['reading', 'causal', 'intervals'],
    subs: [
      [sy('w'), 'Back to the original scale: w_j = w̃_j / s_j, b = w̃₀ − Σ w̃_j μ_j / s_j', c => c.P.names.map((n, j) => `${n === '1' ? 'b' : n}: ${num(c.P.wOrig[j], 3)}${c.d.truth.coef[j] != null ? ` (true ${c.d.truth.coef[j]})` : ''}`).join(', ')],
      ['', 'Reading the slope', c => { const j = c.focus; return `one unit more of ${c.P.names[j]} changes ${sy('yhat')} by ${num(c.P.wOrig[j], 3)}, holding the other features fixed`; }],
      ['', "This variant's coefficients, next to OLS", c => altText(c, 'coef')],
      ['', 'Confidence and prediction intervals at a new x', c => { const b = band(c.P, c.focus); if (!b) return `${mark(false)} not available: ${c.P.noDg || 'X̃ᵀX̃ has no inverse'}`;
        return b.pts.filter((_, k) => k % 2 === 0).map(q => `${c.P.names[c.focus]} = ${num(q.x, 1)}: ŷ ${num(q.yh, 2)}, mean ± ${num(q.ci, 2)}, new point ± ${num(q.pi, 2)}`).join('; '); }]
    ]}
];
