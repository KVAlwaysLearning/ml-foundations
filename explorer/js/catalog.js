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
  { id: 'data', name: 'Data properties', attrs: [
    { id: 'outliers', name: 'Outliers and influence', variants: ['None', 'Outlier in y', 'High leverage, on trend', 'High leverage, off trend', 'Cluster of outliers'] },
    { id: 'samplesize', name: 'Sample size', variants: ['Large', 'Moderate', 'Small', 'N ≈ p', 'N < p'] },
    { id: 'noise', name: 'Noise level', variants: ['Low', 'None', 'Moderate', 'High', 'Pure noise'] },
    { id: 'range', name: 'Feature range', variants: ['Wide', 'Restricted', 'Gaps', 'Extrapolation at test time'] },
    { id: 'irrelevant', name: 'Irrelevant features', variants: ['None', 'A few', 'Many', 'Redundant copies'] },
    { id: 'missing', name: 'Missing data', variants: ['None', 'Completely at random', 'Depends on another feature', 'Depends on its own value'] },
    { id: 'target', name: 'Target type', variants: ['Continuous', 'Skewed', 'Bounded', 'Counts'] },
    { id: 'categorical', name: 'Categorical features', variants: ['None', 'Binary', 'Multi-category', 'High-cardinality'] },
    { id: 'subgroups', name: 'Hidden subgroups', variants: ['None', 'Different intercepts', 'Different slopes', "Simpson's paradox"] },
    { id: 'shift', name: 'Distribution shift', variants: ['None', 'Feature shift', 'Relationship shift'] },
    { id: 'leakage', name: 'Data leakage', variants: ['None', 'Target leaked into a feature', 'Preprocessing before the split'] }
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
