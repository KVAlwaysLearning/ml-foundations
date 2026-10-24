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
      { id: 'interaction', name: 'Missing interaction', desc: 'Two customer types (new, returning) whose slopes differ (1.5 vs 2.9), fitted with one common slope: y ~ x + customer.', strength: 'slope difference between groups' },
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
      { id: 'dummytrap', name: 'Dummy-variable trap', desc: 'A text column colour (blue, green, red) one-hot encoded with all three columns plus an intercept: the dummies sum to the ones column.' }
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
      { id: 'cbin', name: 'Binary', desc: 'A text column segment (basic, premium); premium adds 4 to y. Encoded as one 0/1 column, segment_premium.', strength: 'effect of level B' },
      { id: 'cmulti', name: 'Multi-category', desc: 'A text column region (East, North, South, West) with effects 0, +3, −2, +5; one-hot with East dropped: three 0/1 columns.', strength: 'size of the level effects' },
      { id: 'chigh', name: 'High-cardinality', desc: 'A text column branch with 25 levels (B01–B25) and random effects; one-hot with B01 dropped gives 24 columns, and most branches have only a few rows.', strength: 'spread of the level effects' }
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
  { id: 'features', name: 'Feature engineering', live: true, attrs: [
    { id: 'scaling', name: 'Scaling', diag: 'fitted', variants: [
      { id: 'scnone', name: 'None', desc: 'x₁ (0–10) and x₂ (1 000–5 000, one row at 30 000) are used as they are.' },
      { id: 'scstd', name: 'Standardisation', desc: 'Each feature becomes (x − mean) / sd, using the training rows.' },
      { id: 'scminmax', name: 'Min–max', desc: 'Each feature becomes (x − min) / (max − min): squeezed into [0, 1].' },
      { id: 'scrobust', name: 'Robust', desc: 'Each feature becomes (x − median) / IQR: the large value of x₂ barely affects it.' }
    ]},
    { id: 'xtransform', name: 'Transform of x', diag: 'fitted', variants: [
      { id: 'xtnone', name: 'None', desc: 'x is right-skewed and y rises with ln(x), but x is used as it is.' },
      { id: 'xtlog', name: 'Log', desc: 'x is replaced by ln(x).' },
      { id: 'xtsqrt', name: 'Square root', desc: 'x is replaced by √x: a milder squeeze than the log.' },
      { id: 'xtboxcox', name: 'Box-Cox', desc: 'x is replaced by (x^λ − 1)/λ, with λ chosen from the training rows to make x as bell-shaped as possible.' },
      { id: 'xtyj', name: 'Yeo-Johnson', desc: 'Like Box-Cox, but also works for zero and negative values.' }
    ]},
    { id: 'ytransform', name: 'Transform of y', diag: 'fitted', variants: [
      { id: 'ytnone', name: 'None', desc: 'y grows exponentially with multiplicative noise, and is modelled as it is.' },
      { id: 'ytlog', name: 'Log', desc: 'The model is fitted to ln(y); predictions are turned back with eˣ.' },
      { id: 'ytboxcox', name: 'Box-Cox', desc: 'The model is fitted to the Box-Cox transform of y, with λ from the training rows.' }
    ]},
    { id: 'degree', name: 'Polynomial degree', diag: 'fitted', variants: [
      { id: 'deg1', name: '1', desc: 'A straight line through an S-shaped cubic truth.' },
      { id: 'deg2', name: '2', desc: 'Columns z and z², where z is x standardised: a parabola.' },
      { id: 'deg3', name: '3', desc: 'Columns z, z², z³ (z = standardised x): the same shape as the truth.' },
      { id: 'deg5', name: '5', desc: 'Up to z⁵: more flexible than needed.' },
      { id: 'deg10', name: '10', desc: 'Up to z¹⁰: wiggles to chase the noise (overfitting), and X̃ᵀX̃ is badly conditioned.' }
    ]},
    { id: 'interactions', name: 'Interaction terms', diag: 'fitted', variants: [
      { id: 'intnone', name: 'None', desc: 'The truth has an x₁·x₂ term, but the model only has x₁ and x₂.' },
      { id: 'intx', name: 'x₁·x₂ added', desc: 'A column x₁·x₂ is added, so the slope of x₁ can change with x₂.' }
    ]},
    { id: 'splines', name: 'Piecewise / splines', diag: 'fitted', variants: [
      { id: 'spnone', name: 'None', desc: 'A straight line through a curve that rises fast and then levels off.' },
      { id: 'sp1', name: 'One knot', desc: 'A hinge column max(0, x − 5): the slope may change at x = 5.' },
      { id: 'spmany', name: 'Several knots', desc: 'Hinges at 2.5, 5 and 7.5: a bendy line made of four straight pieces.' }
    ]},
    { id: 'binning', name: 'Binning', diag: 'fitted', variants: [
      { id: 'binnone', name: 'None', desc: 'x is bunched near 0 and y jumps around x = 4; x is used as it is.' },
      { id: 'binwidth', name: 'Equal-width', desc: 'x is cut into 5 bins of equal width; each bin gets its own level.' },
      { id: 'binquant', name: 'Quantile', desc: 'x is cut into 5 bins with the same number of training rows each.' }
    ]},
    { id: 'encoding', name: 'Categorical encoding', diag: 'fitted', variants: [
      { id: 'encoh', name: 'One-hot, drop one', desc: 'region (East, North, South, West) becomes three 0/1 columns; East is the reference.' },
      { id: 'encall', name: 'One-hot, keep all', desc: 'All four 0/1 columns are kept next to the intercept: the dummy-variable trap.' },
      { id: 'encord', name: 'Ordinal', desc: 'region becomes one number 0, 1, 2, 3 (alphabetical order), forcing an order and equal steps.' },
      { id: 'enctarget', name: 'Target encoding', desc: 'region becomes one number: the mean y of its level in the training rows.' }
    ]},
    { id: 'centering', name: 'Centering', diag: 'fitted', variants: [
      { id: 'cenraw', name: 'Raw', desc: 'x lies between 20 and 30; the model uses x and x² as they are.' },
      { id: 'cencent', name: 'Mean-centred', desc: 'x is centred first: xc = x − mean, then xc and xc² are used.' }
    ]},
    { id: 'selection', name: 'Feature selection', diag: 'fitted', variants: [
      { id: 'selall', name: 'All features', desc: 'All 10 candidates: 4 useful, 1 near-copy and 5 noise columns.' },
      { id: 'selfwd', name: 'Forward', desc: 'Start empty; add the column with the smallest p-value while it is below 0.05.' },
      { id: 'selbwd', name: 'Backward', desc: 'Start with all; drop the column with the largest p-value while it is above 0.05.' },
      { id: 'selstep', name: 'Stepwise', desc: 'Forward, but after each addition remove any column whose p-value rose above 0.10.' },
      { id: 'sellasso', name: 'Lasso-based', desc: 'Keep the columns lasso does not shrink to 0, with λ chosen by 5-fold cross-validation.' },
      { id: 'selvif', name: 'VIF-based', desc: 'Drop the column with the largest VIF while it is above 5.' },
      { id: 'selp', name: 'p-value-based', desc: 'Fit once with everything and drop every column with p > 0.05.' }
    ]}
  ]},
  { id: 'formulation', name: 'Model formulation', live: true, attrs: [
    { id: 'intercept', name: 'Intercept', diag: 'fitted', variants: [
      { id: 'intin', name: 'Included', desc: 'y = 6 + 1.0x + ε, fitted with an intercept.' },
      { id: 'intorigin', name: 'Through the origin', desc: 'The same data, fitted with the intercept forced to 0: ŷ = w·x.' }
    ]},
    { id: 'modeltype', name: 'Model type', diag: 'fitted', variants: [
      { id: 'mtsimple', name: 'Simple', desc: 'One feature, x₁, for data that depend on x₁, x₂ and x₁².' },
      { id: 'mtmultiple', name: 'Multiple', desc: 'Both features x₁ and x₂, still straight lines.' },
      { id: 'mtpoly', name: 'Polynomial', desc: 'x₁, x₂ and x₁²: the right shape for the mean.' },
      { id: 'mtwls', name: 'Weighted LS', desc: 'The polynomial model, with each row weighted by 1 / its estimated error variance.' },
      { id: 'mtgls', name: 'Generalised LS', desc: 'The polynomial model, refitted after removing the row-to-row correlation of the errors (Prais–Winsten).' }
    ]},
    { id: 'robust', name: 'Robust alternatives', diag: 'leverage', variants: [
      { id: 'rbols', name: 'OLS', desc: 'Ordinary least squares on data with a few gross outliers.' },
      { id: 'rbhuber', name: 'Huber', desc: 'Squared loss for small residuals, linear loss for large ones, by iteratively reweighted least squares.' },
      { id: 'rbransac', name: 'RANSAC', desc: 'Fit many random pairs of rows; keep the line with the most inliers; refit on them.' },
      { id: 'rbtheil', name: 'Theil–Sen', desc: 'The slope is the median of the slopes of all pairs of rows.' },
      { id: 'rbquant', name: 'Quantile (median)', desc: 'Minimise the sum of absolute errors: the line through the conditional median.' }
    ]},
    { id: 'regularisation', name: 'Regularisation', diag: 'fitted', variants: [
      { id: 'rgnone', name: 'None', desc: 'Least squares on 8 correlated features, only 4 of which matter.' },
      { id: 'rgridge', name: 'Ridge', desc: 'Adds λ·Σw² to the loss (λ by 5-fold CV): shrinks all weights toward 0.' },
      { id: 'rglasso', name: 'Lasso', desc: 'Adds λ·Σ|w| (λ by CV): shrinks, and sets some weights exactly to 0.' },
      { id: 'rgenet', name: 'Elastic net', desc: 'Half ridge, half lasso penalty (α = 0.5), λ by CV.' }
    ]},
    { id: 'lambda', name: 'Penalty strength λ', diag: 'fitted', variants: [
      { id: 'lam0', name: '0', desc: 'Ridge with λ = 0: the same as least squares.' },
      { id: 'lamsmall', name: 'Small', desc: 'Ridge with λ = 0.1: barely any shrinkage.' },
      { id: 'lamcv', name: 'Optimal (CV)', desc: 'Ridge with the λ that gives the lowest 5-fold cross-validation error.' },
      { id: 'lamlarge', name: 'Large', desc: 'Ridge with λ = 300: strong shrinkage.' },
      { id: 'lamhuge', name: 'Very large', desc: 'Ridge with λ = 30 000: every weight nearly 0, the model predicts about the mean.' }
    ]},
    { id: 'alpha', name: 'Elastic-net mix α', diag: 'fitted', variants: [
      { id: 'alridge', name: 'Pure ridge', desc: 'α = 0: only the squared penalty.' },
      { id: 'albal', name: 'Balanced', desc: 'α = 0.5: half squared, half absolute penalty.' },
      { id: 'allasso', name: 'Pure lasso', desc: 'α = 1: only the absolute penalty.' }
    ]},
    { id: 'penalisebias', name: 'Penalise the bias?', diag: 'fitted', variants: [
      { id: 'pbno', name: 'No', desc: 'Ridge (λ = 10) that leaves the intercept free; y averages about 60.' },
      { id: 'pbyes', name: 'Yes', desc: 'The same ridge, but the intercept is shrunk toward 0 as well.' }
    ]},
    { id: 'otherforms', name: 'Other formulations', diag: 'fitted', variants: [
      { id: 'ofpcr', name: 'PCA regression', desc: 'Regress y on the first k principal components of the features (k by CV).' },
      { id: 'ofpls', name: 'Partial least squares', desc: 'Like PCA regression, but the components are chosen to predict y (k by CV).' },
      { id: 'ofbayes', name: 'Bayesian', desc: 'A normal prior N(0, 1) on each standardised weight: the posterior mean and its spread.' }
    ]}
  ]},
  { id: 'loss', name: 'Loss function', live: true, attrs: [
    { id: 'lossfn', name: 'Loss', diag: 'fitted', variants: [
      { id: 'lfmse', name: 'MSE', desc: 'Mean squared error on data whose errors have a long upward tail (about 12% of rows pushed up).' },
      { id: 'lfmae', name: 'MAE', strength: 'size of the upward tail', desc: 'Mean absolute error: every unit of error costs the same, so the line goes through the median.' },
      { id: 'lfhuber', name: 'Huber', strength: 'size of the upward tail', desc: 'Squared for small errors, absolute for large ones (c = 1.345 robust standard deviations).' },
      { id: 'lfquant', name: 'Quantile', strength: 'size of the upward tail', desc: 'Pinball loss with q = 0.9: errors above the line cost 9 times more, so the line estimates the 90th percentile.' },
      { id: 'lflogcosh', name: 'Log-cosh', strength: 'size of the upward tail', desc: 'ln(cosh e): squared near 0, absolute far away, smooth everywhere.' }
    ]},
    { id: 'penalty', name: 'Penalty term', diag: 'fitted', variants: [
      { id: 'pnnone', name: 'None', desc: 'Loss = squared error only, on 8 correlated features (4 matter).' },
      { id: 'pnl2', name: 'L2', desc: 'Loss = squared error + λ·Σw̃² (ridge), λ by 5-fold CV.' },
      { id: 'pnl1', name: 'L1', desc: 'Loss = (1/2N)·squared error + λ·Σ|w̃| (lasso), λ by 5-fold CV.' },
      { id: 'pnl1l2', name: 'L1 + L2', desc: 'Loss = (1/2N)·squared error + λ(½Σ|w̃| + ¼Σw̃²) (elastic net, α = 0.5), λ by CV.' }
    ]}
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
