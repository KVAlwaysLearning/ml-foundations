/* ============================================================
   The concept web: branches -> attributes -> variants.
   Branches with live: true are simulated (see generators.js).
   The first variant of every attribute is its baseline.
   `strength` says what the Strength slider controls (0 = baseline, 1 = full effect).
   ============================================================ */
const CATALOG = [
  { id: 'assumptions', name: 'Assumptions', live: true, attrs: [
    { id: 'linearity', name: 'Linearity', diag: 'fitted', variants: [
      { id: 'linear', name: 'Linear', desc: 'True relationship is a straight line: y = 2 + 1.5x + ε.' },
      { id: 'quadratic', name: 'Convex curve', desc: 'True relationship bends upward: y = 2 + 1.5x + 0.3(x − 5)² + ε.', strength: 'curvature' },
      { id: 'log', name: 'Saturating (log)', desc: 'Rises fast then levels off: y = 2 + 7·ln(1 + x) + ε.', strength: 'blend from linear to log' },
      { id: 'sshape', name: 'S-shaped', desc: 'Flat, steep, then flat again: a logistic curve centred at x = 5.', strength: 'blend from linear to S-curve' },
      { id: 'step', name: 'Step / threshold', desc: 'The mean jumps by 9 units at x = 5, with almost no slope either side.', strength: 'blend from linear to step' },
      { id: 'interaction', name: 'Missing interaction', desc: 'Two groups whose slopes differ (1.5 vs 2.9), fitted with one common slope: y ~ x + group.', strength: 'slope difference between groups' },
      { id: 'periodic', name: 'Periodic', desc: 'A straight trend plus a wave: y = 2 + 1.5x + 4·sin(1.6x) + ε.', strength: 'wave amplitude' }
    ]},
    { id: 'independence', name: 'Independence of errors', diag: 'order', variants: [
      { id: 'indep', name: 'Independent', desc: 'Each error is drawn fresh. Rows are in time order along x.' },
      { id: 'posar', name: 'Positive autocorrelation', desc: 'Each error carries over 90% of the previous one (AR(1), ρ = 0.9): long runs of same-sign residuals.', strength: 'ρ from 0 to 0.9' },
      { id: 'negar', name: 'Negative autocorrelation', desc: 'Errors tend to flip sign each step (AR(1), ρ = −0.8): residuals zig-zag.', strength: 'ρ from 0 to −0.8' },
      { id: 'cluster', name: 'Clustered errors', desc: 'Eight groups; every row in a group shares a random shift, and x also clusters by group.', strength: 'share of the error that is group-level' },
      { id: 'dupes', name: 'Duplicated rows', desc: 'Each unique observation appears three times, so N looks three times larger than the real information.', strength: 'copies per row (1 to 3)' }
    ]},
    { id: 'homoscedasticity', name: 'Homoscedasticity', diag: 'fitted', variants: [
      { id: 'constant', name: 'Constant variance', desc: 'Error spread is the same everywhere.' },
      { id: 'increasing', name: 'Increasing with x', desc: 'Error spread grows with x: the residual plot fans out into a funnel.', strength: 'how fast the spread grows' },
      { id: 'decreasing', name: 'Decreasing with x', desc: 'Error spread shrinks as x grows.', strength: 'how fast the spread shrinks' },
      { id: 'bowtie', name: 'Bow-tie', desc: 'Small spread in the middle, large at both ends.', strength: 'contrast between middle and ends' },
      { id: 'groupvar', name: 'Different by group', desc: 'Two groups: one with small errors, one with large errors.', strength: 'contrast between groups' }
    ]},
    { id: 'normality', name: 'Normality of errors', diag: 'qq', variants: [
      { id: 'normal', name: 'Normal', desc: 'Errors follow a bell curve.' },
      { id: 'rskew', name: 'Right-skewed', desc: 'Most errors slightly negative, a few large positive ones (shifted exponential).', strength: 'share of the skewed component' },
      { id: 'lskew', name: 'Left-skewed', desc: 'Mirror image: a few large negative errors.', strength: 'share of the skewed component' },
      { id: 'heavy', name: 'Heavy-tailed', desc: 'Student-t errors with 3 degrees of freedom: occasional extreme residuals.', strength: 'share of the heavy-tailed component' },
      { id: 'light', name: 'Light-tailed', desc: 'Uniform errors: no extreme residuals at all.', strength: 'share of the uniform component' },
      { id: 'bimodal', name: 'Bimodal', desc: 'Errors cluster around +σ and −σ, with few near zero.', strength: 'share of the bimodal component' }
    ]},
    { id: 'multicollinearity', name: 'No multicollinearity', diag: 'x1x2', variants: [
      { id: 'uncorr', name: 'Uncorrelated', desc: 'Two features, independent of each other: y = 2 + 1.5x₁ + 1.0x₂ + ε.' },
      { id: 'moderate', name: 'Moderate correlation', desc: 'x₁ and x₂ correlate at about ρ = 0.6.', strength: 'ρ from 0 to 0.6' },
      { id: 'high', name: 'High correlation', desc: 'x₁ and x₂ correlate at about ρ = 0.97.', strength: 'ρ from 0 to 0.97' },
      { id: 'perfect', name: 'Perfect copy', desc: 'x₂ = 2x₁ exactly. XᵀX is singular and the two coefficients cannot be separated.', strength: 'how exact the copy is' },
      { id: 'combo', name: 'Exact combination', desc: 'Three features with x₃ = x₁ + x₂ exactly: no single column is a copy, yet XᵀX is singular.', strength: 'how exact the combination is' },
      { id: 'dummytrap', name: 'Dummy-variable trap', desc: 'A 3-level category one-hot encoded with all three columns plus an intercept: the dummies sum to the ones column.' }
    ]},
    { id: 'exogeneity', name: 'Exogeneity', diag: 'fitted', variants: [
      { id: 'exo', name: 'Holds', desc: 'Errors are unrelated to x, so the fitted slope estimates the causal effect (1.5).' },
      { id: 'confounder', name: 'Omitted confounder', desc: 'A hidden z raises both x and y; the model leaves z out.', strength: 'strength of the confounder' },
      { id: 'measerr', name: 'Measurement error in x', desc: 'We observe x with random error added; y depends on the true x.', strength: 'size of the measurement error' },
      { id: 'reverse', name: 'Reverse causality', desc: 'y also feeds back into x (x = a + γy + u), so x is correlated with the error.', strength: 'feedback γ from 0 to 0.4' }
    ]}
  ]},
  { id: 'data', name: 'Data properties', live: true, attrs: [
    { id: 'outliers', name: 'Outliers and influence', diag: 'leverage', variants: [
      { id: 'outnone', name: 'None', desc: 'Every row follows y = 2 + 1.5x + ε.' },
      { id: 'outy', name: 'Outlier in y', desc: 'One row (about 1 in 60) at a typical x has y pushed up by 6σ (at least 6 units).', strength: 'size of the push' },
      { id: 'levon', name: 'High leverage, on trend', desc: 'The last row is moved far out in x (x = 25 at full strength) but stays on the true line.', strength: 'how far out in x' },
      { id: 'levoff', name: 'High leverage, off trend', desc: 'The last row is moved far out in x and 20 units below the true line.', strength: 'how far out and how far off' },
      { id: 'outcluster', name: 'Cluster of outliers', desc: 'About 1 row in 12, all at high x, pulled down together by 8σ.', strength: 'size of the pull' }
    ]},
    { id: 'samplesize', name: 'Sample size', diag: 'fitted', variants: [
      { id: 'nlarge', name: 'Large', desc: 'N = 200 rows for 5 features (p = 6 coefficients): plenty of spare rows.' },
      { id: 'nmod', name: 'Moderate', desc: 'N = 60 rows for 5 features.' },
      { id: 'nsmall', name: 'Small', desc: 'N = 15 rows for 5 features: 12 training rows, only 6 to spare.' },
      { id: 'nap', name: 'N ≈ p', desc: 'Training rows = p + 1: one row more than coefficients.' },
      { id: 'nlp', name: 'N < p', desc: 'Fewer training rows than coefficients: infinitely many exact fits.' }
    ]},
    { id: 'noise', name: 'Noise level', diag: 'fitted', variants: [
      { id: 'nslow', name: 'Low', desc: 'σ as set by the Noise slider.' },
      { id: 'nszero', name: 'None', desc: 'σ = 0: every point lies exactly on the true line.' },
      { id: 'nsmod', name: 'Moderate', desc: 'σ = 2.5 × max(slider σ, 1).' },
      { id: 'nshigh', name: 'High', desc: 'σ = 6 × max(slider σ, 1): the noise swamps most of the signal.' },
      { id: 'nspure', name: 'Pure noise', desc: 'y has the same spread as before but no relationship with x: the true slope is 0.' }
    ]},
    { id: 'range', name: 'Feature range', diag: 'fitted', variants: [
      { id: 'rwide', name: 'Wide', desc: 'x spread over 0–10.' },
      { id: 'rrestrict', name: 'Restricted', desc: 'x squeezed into 4–6 at full strength.', strength: 'how much the range is squeezed' },
      { id: 'rgap', name: 'Gaps', desc: 'No rows with x between 4 and 7, and the true curve has a bump hidden in the gap.', strength: 'width of the gap and size of the bump' },
      { id: 'rextrap', name: 'Extrapolation at test time', desc: 'Train on x < 6, test on x > 6; beyond 6 the true relationship starts to bend.', strength: 'test region and bend' }
    ]},
    { id: 'irrelevant', name: 'Irrelevant features', diag: 'fitted', variants: [
      { id: 'irnone', name: 'None', desc: 'Only features that matter.' },
      { id: 'irfew', name: 'A few', desc: 'Three pure-noise columns n₁, n₂, n₃ (true coefficient 0) are added.' },
      { id: 'irmany', name: 'Many', desc: 'Fifteen pure-noise columns: p gets close to the number of training rows.' },
      { id: 'ircopy', name: 'Redundant copies', desc: 'x_copy = x + a little noise: the same information twice.', strength: 'how exact the copy is' }
    ]},
    { id: 'missing', name: 'Missing data', diag: 'fitted', variants: [
      { id: 'mnone', name: 'None', desc: 'Every y is recorded.' },
      { id: 'mcar', name: 'Completely at random', desc: 'Each y is lost with probability 0.3 × s, regardless of anything (MCAR).', strength: 'share lost' },
      { id: 'mar', name: 'Depends on another feature', desc: 'y is lost more often when x is high (MAR: the chance depends on an observed column).', strength: 'how strongly it depends on x' },
      { id: 'mnar', name: 'Depends on its own value', desc: 'y is lost more often when y itself is high (MNAR), like high incomes left blank.', strength: 'how strongly it depends on y' }
    ]},
    { id: 'target', name: 'Target type', diag: 'qq', variants: [
      { id: 'tcont', name: 'Continuous', desc: 'y is an unbounded measurement with bell-shaped noise.' },
      { id: 'tskew', name: 'Skewed', desc: 'y grows exponentially with x, with multiplicative noise: a long right tail.', strength: 'blend from linear to exponential' },
      { id: 'tbound', name: 'Bounded', desc: 'y is a score between 0 and 20 that follows an S-curve in x.' },
      { id: 'tcount', name: 'Counts', desc: 'y is a whole number of events (Poisson), with mean exp(0.3 + 0.25x).' }
    ]},
    { id: 'categorical', name: 'Categorical features', diag: 'fitted', variants: [
      { id: 'cnone', name: 'None', desc: 'Only the numeric x.' },
      { id: 'cbin', name: 'Binary', desc: 'A two-level category (A, B); level B adds 4 to y. One 0/1 column B.', strength: 'effect of level B' },
      { id: 'cmulti', name: 'Multi-category', desc: 'Four levels A–D with effects 0, +3, −2, +5; one-hot with A dropped: columns B, C, D.', strength: 'size of the level effects' },
      { id: 'chigh', name: 'High-cardinality', desc: '25 levels with random effects; one-hot with level 1 dropped gives 24 columns, and most levels have only a few rows.', strength: 'spread of the level effects' }
    ]},
    { id: 'subgroups', name: 'Hidden subgroups', diag: 'fitted', variants: [
      { id: 'sgnone', name: 'None', desc: 'One population.' },
      { id: 'sgint', name: 'Different intercepts', desc: 'Two groups 7 units apart, not recorded as a column; group 1 also tends to have higher x.', strength: 'gap between the groups' },
      { id: 'sgslope', name: 'Different slopes', desc: 'In group 1 the slope is 1.5 − 2s instead of 1.5; the group is not a column.', strength: 'slope difference' },
      { id: 'simpson', name: "Simpson's paradox", desc: 'Within each group the slope is +1.5, but the high-x group sits 18 units lower, so the pooled slope turns negative.', strength: 'gap between the groups' }
    ]},
    { id: 'shift', name: 'Distribution shift', diag: 'fitted', variants: [
      { id: 'shnone', name: 'None', desc: 'Test rows come from the same place as training rows.' },
      { id: 'shfeat', name: 'Feature shift', desc: 'The test rows (the last 20%) have x concentrated around 7.5; the rule linking x to y is unchanged.', strength: 'how far the test x move' },
      { id: 'shrel', name: 'Relationship shift', desc: 'In the test period (the last 20% of rows) the slope drops from 1.5 to 0.3: the rule itself changed.', strength: 'size of the change' }
    ]},
    { id: 'leakage', name: 'Data leakage', diag: 'fitted', variants: [
      { id: 'lknone', name: 'None', desc: 'Every feature is known before y.' },
      { id: 'lktarget', name: 'Target leaked into a feature', desc: 'A column "leak" = y + small noise, recorded after the outcome.', strength: 'how exact the leak is' },
      { id: 'lkprep', name: 'Preprocessing before the split', desc: 'An ID-like category (about one row per level, no real effect) is target-encoded, each level replaced by its mean y, using all rows before the split.', strength: 'blend from the overall mean to the leaky encoding' }
    ]}
  ]},
  { id: 'features', name: 'Feature engineering', attrs: [
    { id: 'scaling', name: 'Scaling', variants: ['None', 'Standardisation', 'Min–max', 'Robust'] },
    { id: 'xtransform', name: 'Transform of x', variants: ['None', 'Log', 'Square root', 'Box-Cox', 'Yeo-Johnson'] },
    { id: 'ytransform', name: 'Transform of y', variants: ['None', 'Log', 'Box-Cox'] },
    { id: 'degree', name: 'Polynomial degree', variants: ['1', '2', '3', '5', '10'] },
    { id: 'interactions', name: 'Interaction terms', variants: ['None', 'x₁·x₂ added'] },
    { id: 'splines', name: 'Piecewise / splines', variants: ['None', 'One knot', 'Several knots'] },
    { id: 'binning', name: 'Binning', variants: ['None', 'Equal-width', 'Quantile'] },
    { id: 'encoding', name: 'Categorical encoding', variants: ['One-hot, drop one', 'One-hot, keep all', 'Ordinal', 'Target encoding'] },
    { id: 'centering', name: 'Centering', variants: ['Raw', 'Mean-centred'] },
    { id: 'selection', name: 'Feature selection', variants: ['All features', 'Forward', 'Backward', 'Stepwise', 'Lasso-based', 'VIF-based', 'p-value-based'] }
  ]},
  { id: 'formulation', name: 'Model formulation', attrs: [
    { id: 'intercept', name: 'Intercept', variants: ['Included', 'Through the origin'] },
    { id: 'modeltype', name: 'Model type', variants: ['Simple', 'Multiple', 'Polynomial', 'Weighted LS', 'Generalised LS'] },
    { id: 'robust', name: 'Robust alternatives', variants: ['OLS', 'Huber', 'RANSAC', 'Theil–Sen', 'Quantile (median)'] },
    { id: 'regularisation', name: 'Regularisation', variants: ['None', 'Ridge', 'Lasso', 'Elastic net'] },
    { id: 'lambda', name: 'Penalty strength λ', variants: ['0', 'Small', 'Optimal (CV)', 'Large', 'Very large'] },
    { id: 'alpha', name: 'Elastic-net mix α', variants: ['Pure ridge', 'Balanced', 'Pure lasso'] },
    { id: 'penalisebias', name: 'Penalise the bias?', variants: ['No', 'Yes'] },
    { id: 'otherforms', name: 'Other formulations', variants: ['PCA regression', 'Partial least squares', 'Bayesian'] }
  ]},
  { id: 'loss', name: 'Loss function', attrs: [
    { id: 'lossfn', name: 'Loss', variants: ['MSE', 'MAE', 'Huber', 'Quantile', 'Log-cosh'] },
    { id: 'penalty', name: 'Penalty term', variants: ['None', 'L2', 'L1', 'L1 + L2'] }
  ]},
  { id: 'optimisation', name: 'Optimisation', attrs: [
    { id: 'solver', name: 'Solver', variants: ['Normal equations', 'Pseudo-inverse (SVD)', 'QR', 'Cholesky', 'Gradient descent', 'Coordinate descent'] },
    { id: 'gdtype', name: 'GD type', variants: ['Batch', 'Stochastic', 'Mini-batch'] },
    { id: 'lr', name: 'Learning rate', variants: ['Good', 'Tiny', 'Near the limit', 'Too large'] },
    { id: 'schedule', name: 'Learning-rate schedule', variants: ['Constant', 'Step decay', 'Exponential', '1/t'] },
    { id: 'optimiser', name: 'Optimiser', variants: ['Plain GD', 'Momentum', 'Nesterov', 'RMSProp', 'Adam'] },
    { id: 'init', name: 'Initialisation', variants: ['Zeros', 'Small random', 'Far away'] },
    { id: 'stopping', name: 'Stopping rule', variants: ['Fixed iterations', 'Gradient tolerance', 'Loss tolerance', 'Early stopping'] },
    { id: 'scalegd', name: 'Feature scaling × GD', variants: ['Scaled', 'Unscaled'] }
  ]},
  { id: 'validation', name: 'Validation protocol', attrs: [
    { id: 'split', name: 'Train/test split', variants: ['80/20', '70/30', '50/50', 'Tiny test set'] },
    { id: 'cv', name: 'Cross-validation', variants: ['None', 'k-fold', 'Leave-one-out', 'Time-series split', 'Nested'] },
    { id: 'seed', name: 'Random seed', variants: ['Fixed', 'Varied'] }
  ]},
  { id: 'evaluation', name: 'Evaluation', attrs: [
    { id: 'metric', name: 'Metric', variants: ['MSE', 'RMSE', 'MAE', 'MAPE', 'R²', 'Adjusted R²', 'AIC', 'BIC'] },
    { id: 'traintest', name: 'Train vs test', variants: ['Both good', 'Overfit', 'Underfit'] },
    { id: 'learningcurve', name: 'Learning curves', variants: ['High bias', 'High variance', 'Good fit'] },
    { id: 'validationcurve', name: 'Validation curves', variants: ['vs degree', 'vs λ'] },
    { id: 'biasvariance', name: 'Bias–variance', variants: ['Decomposition'] }
  ]},
  { id: 'inference', name: 'Inference', attrs: [
    { id: 'coefinf', name: 'Coefficient inference', variants: ['Standard error', 't-test, p-value', 'Confidence interval'] },
    { id: 'ftest', name: 'Model-level test', variants: ['Overall F-test', 'Partial F-test'] },
    { id: 'intervals', name: 'Intervals', variants: ['Confidence (mean)', 'Prediction (new point)'] },
    { id: 'robustse', name: 'Standard errors', variants: ['Classical', 'Robust (HC)', 'Clustered', 'Newey–West'] },
    { id: 'reading', name: 'Coefficient reading', variants: ['Raw units', 'Standardised', 'Log–log', 'Log–linear'] },
    { id: 'causal', name: 'Causation vs correlation', variants: ['Correct reading', 'Confounded reading'] }
  ]},
  { id: 'diagnostics', name: 'Diagnostics', attrs: [
    { id: 'residplots', name: 'Residual plots', variants: ['Residuals vs fitted', 'Q–Q', 'Scale–location', 'Residuals vs leverage'] },
    { id: 'influence', name: 'Influence measures', variants: ['Leverage', 'Studentised residuals', "Cook's distance", 'DFFITS', 'DFBETAS'] },
    { id: 'lintest', name: 'Linearity test', variants: ['Ramsey RESET', 'Component-plus-residual'] },
    { id: 'vartest', name: 'Variance test', variants: ['Breusch–Pagan', 'White', 'Goldfeld–Quandt'] },
    { id: 'indtest', name: 'Independence test', variants: ['Durbin–Watson', 'Ljung–Box'] },
    { id: 'normtest', name: 'Normality test', variants: ['Shapiro–Wilk', 'Jarque–Bera', 'Anderson–Darling'] },
    { id: 'colltest', name: 'Collinearity check', variants: ['VIF', 'Condition number', 'Correlation matrix'] }
  ]}
];
CATALOG.forEach(b => b.attrs.forEach(a => { a.variants = a.variants.map((v, i) => typeof v === 'string' ? { id: a.id + '-' + i, name: v } : v); a.branch = b.id; a.live = !!b.live; }));
