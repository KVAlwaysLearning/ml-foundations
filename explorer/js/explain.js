/* ============================================================
   Feynman layer: for every quantity in the Process view,
   plain words, the formula, a worked calculation on the live
   data that ends at the displayed number, and how to read it.
   EXPLAIN[stepId][subIndex](ctx) -> { plain, formula, calc, read }
   Words defined in GLOSSARY are linked with g('key').
   ============================================================ */
const GLOSSARY = {
  mean: ['Mean (average)', 'Add all the values and divide by how many there are. The mean of 2, 4 and 9 is (2 + 4 + 9) / 3 = 5.'],
  deviation: ['Deviation', 'How far one value is from the mean: value − mean. For 9 in the example above, 9 − 5 = 4. Deviations always add up to zero.'],
  variance: ['Variance', 'The average squared deviation. Squaring makes every deviation positive and weighs big ones more. For 2, 4, 9: deviations −3, −1, 4; squares 9, 1, 16; mean 26/3 ≈ 8.67.'],
  sd: ['Standard deviation', 'The square root of the variance, so it is back in the original units: the typical distance of a value from the mean. For 2, 4, 9 it is √8.67 ≈ 2.94.'],
  distribution: ['Distribution', 'How the values are spread out: where most of them sit, and how far the rest stretch. A histogram is a picture of it.'],
  normal: ['Normal distribution', 'The bell curve: symmetric around its mean, with about 68% of values within 1 standard deviation and 95% within about 2.'],
  skew: ['Skewness', 'A number for lopsidedness. 0 means symmetric; positive means a long tail to the right (a few very large values); negative, a long tail to the left.'],
  corr: ['Correlation (r)', 'A number from −1 to 1 for how closely two quantities move together along a straight line. 1: perfectly together; −1: perfectly opposite; 0: no straight-line relationship.'],
  zscore: ['z-score', 'How many standard deviations a value is from the mean: (value − mean) / sd. A z of 3 means "three typical distances away", which is rare for bell-shaped data.'],
  outlier: ['Outlier', 'A value far from the rest. Here: more than 3 standard deviations from the mean (|z| > 3).'],
  vector: ['Vector', 'An ordered list of numbers, such as the 60 values of y. Written as one column.'],
  matrix: ['Matrix', 'A table of numbers with rows and columns. Here each row is one observation and each column one feature.'],
  dot: ['Dot product', 'Multiply two lists entry by entry and add the results: [1, 2]·[3, 4] = 1·3 + 2·4 = 11. Matrix multiplication is many dot products.'],
  transpose: ['Transpose (ᵀ)', 'Turn rows into columns. If X has 48 rows and 2 columns, Xᵀ has 2 rows and 48 columns, so Xᵀ times a vector gives one dot product per column of X.'],
  inverse: ['Matrix inverse', 'The matrix that undoes another: A⁻¹A = I (the identity). It exists only when det(A) ≠ 0. Solving Aw = b is w = A⁻¹b.'],
  det: ['Determinant', 'One number computed from a square matrix. It is zero exactly when some column can be built from the others, and then the matrix has no inverse.'],
  rank: ['Rank', 'The number of columns that carry genuinely new information, i.e. that cannot be built as a combination of the other columns.'],
  eigen: ['Eigenvalue', 'A square matrix stretches some special directions by a fixed factor. Those factors are its eigenvalues. A zero eigenvalue means a direction that gets flattened completely.'],
  residual: ['Residual', 'Actual minus predicted: e = y − ŷ. Positive means the model predicted too low.'],
  loss: ['Loss', 'One number that says how wrong the model is overall. Lower is better; training means making it as small as possible.'],
  derivative: ['Derivative and gradient', 'The derivative is the slope: how fast an output changes when you nudge an input. With several inputs, the list of slopes (one per weight) is the gradient. It points uphill.'],
  lr: ['Learning rate (η)', 'How big a step gradient descent takes each time. Too small: slow. Too large: it overshoots and blows up.'],
  test: ['Hypothesis test', 'A way to ask "could this pattern be pure chance?". You assume a boring explanation (the null hypothesis), compute a test statistic, and see how surprising it would be under that assumption.'],
  null: ['Null hypothesis', 'The boring explanation a test assumes, e.g. "the true slope is 0" or "the errors have constant variance".'],
  pvalue: ['p-value', 'If the null hypothesis were true, the probability of seeing a result at least this extreme. Small (below 0.05 by convention) means "unlikely to be chance", so the null is rejected.'],
  df: ['Degrees of freedom', 'How many independent pieces of information are left after estimating things. With N rows and p coefficients, the residuals have N − p.'],
  tdist: ['t distribution', 'A bell curve with slightly fatter tails, used when the spread itself was estimated from the data. It approaches the normal curve as degrees of freedom grow.'],
  chi2: ['Chi-square distribution', 'The distribution of a sum of squared standard normal values. Many tests produce a statistic that follows it when the null hypothesis is true.'],
  fdist: ['F distribution', 'The distribution of a ratio of two variance estimates. Used to test whether extra model terms reduce the error by more than chance.'],
  se: ['Standard error', 'The standard deviation of an estimate across imaginary repeated samples: how much the estimate would wobble if you collected the data again.'],
  ci: ['Confidence interval', 'estimate ± (critical value × standard error). If you repeated the study many times, 95% of such intervals would contain the true value, provided the assumptions hold.'],
  r2: ['R²', 'The share of the variation in y the model explains: 1 − (squared errors of the model) / (squared errors of just predicting the mean). 1 is perfect, 0 is no better than the mean.'],
  rmse: ['RMSE', 'Root mean squared error: square each error, average, take the square root. A typical size of an error, in the units of y.'],
  leakage: ['Leakage', 'Information from the test rows (or from the answer y) sneaking into training. It makes the test score look better than real performance.'],
  standardise: ['Standardising', 'Rescaling a feature to mean 0 and standard deviation 1: subtract the mean, divide by the sd. The shape of the data is unchanged; only the ruler changes.']
};
const g = (k, text) => `<a class="term" href="#g-${k}" title="${esc(GLOSSARY[k][1])}">${text || GLOSSARY[k][0].toLowerCase()}</a>`;

const EXPLAIN = (() => {
  const n = (v, d = 3) => num(v, d);
  /* small worked table: headers, rows (arrays), first k rows shown, then ⋮ and optional total row */
  function T(headers, rows, { k = 5, total = null, label = 'row' } = {}){
    const show = rows.length <= k + 1 ? rows.map((r, i) => [i, r]) : [...rows.slice(0, k).map((r, i) => [i, r]), [-1, null]];
    let h = `<div class="wk"><table><tr><th>${label}</th>${headers.map(x => `<th>${x}</th>`).join('')}</tr>`;
    for (const [i, r] of show) h += i < 0 ? `<tr class="gap"><td>⋮</td>${headers.map(() => '<td>⋮</td>').join('')}</tr>` : `<tr><td>${typeof r[0] === 'string' && r.__lab ? r.__lab : i + 1}</td>${r.map(v => `<td>${typeof v === 'number' ? n(v, 4) : v}</td>`).join('')}</tr>`;
    if (total) h += `<tr class="tot"><td>${total[0]}</td>${total.slice(1).map(v => `<td>${typeof v === 'number' ? n(v, 4) : v}</td>`).join('')}</tr>`;
    return h + `</table></div>`;
  }
  const sum = a => a.reduce((s, v) => s + v, 0), mean = a => sum(a) / a.length;
  const ex = (plain, formula, calc, read) => ({ plain, formula, calc, read });

  const E = {};
  E[1] = [
    c => ex(`${g('matrix', 'A dataset')} is a table: each row is one observation (one student, one house…) and each column one measured quantity. N counts the rows. The design matrix will get one column per feature plus a column of 1s for the intercept, so p = features + 1.`,
      'N = number of rows,  p = number of features + 1',
      `This dataset has ${c.P.N} rows and the feature${c.P.P > 2 ? 's' : ''} ${c.P.names.slice(1).join(', ')}, so p = ${c.P.P - 1} + 1 = ${c.P.P}.`,
      'More rows than columns is required to estimate anything; many more rows means more precise estimates.'),
    c => ex('In a simulation we choose the true rule that generates y, so we can later check whether the method recovers it. In real data these numbers are unknown: estimating them is the whole point.',
      c.d.truth.coef[1] != null ? `y = ${c.d.truth.coef[0] ?? 'b'} + ${c.d.truth.coef[1]}·${c.P.names[1]}${c.d.truth.coef[2] != null ? ` + ${c.d.truth.coef[2]}·${c.P.names[2]}` : ''}${c.d.truth.coef[3] != null ? ` + ${c.d.truth.coef[3]}·${c.P.names[3]}` : ''} + ε` : 'y = f(x) + ε, with f not a straight line',
      c.d.truth.coef[1] != null && c.P.P === 2 ? (() => { const x = c.d.X[0][1], y = c.d.y[0], m = c.d.truth.coef[0] + c.d.truth.coef[1] * x;
        return `Row 1: x = ${n(x)}, so the true mean is ${c.d.truth.coef[0]} + ${c.d.truth.coef[1]} × ${n(x)} = ${n(m)}. The recorded y is ${n(y)}, so its error is ε₁ = ${n(y)} − ${n(m)} = ${n(y - m)}.`; })() : 'See the dashed "true mean" line in the step-1 chart.',
      'Every later estimate can be compared against these true values: that is how this explorer shows bias.'),
    c => ex(`ε (epsilon) is the part of y the features cannot explain: noise, measurement error, everything not recorded. σ_ε is its ${g('sd')}: the typical size of that noise.`,
      'ε ~ the chosen error process, with standard deviation σ_ε',
      `Selected: ${esc(c.variant.name)}. ${esc(c.variant.desc || '')} The slider sets σ_ε = ${n(c.S.sigma, 2)}.`,
      'Linear regression assumes ε averages to zero, is unrelated to x, has constant spread, is independent across rows and (for exact small-sample tests) is normal. Each Assumptions variant breaks exactly one of these.')
  ];
  E[2] = [
    c => ex('Two rows are duplicates when every value in them is identical. Each row is turned into a text key (all its numbers joined), and a row whose key has already been seen is counted.',
      'duplicate if (x₁, …, y) of row i = (x₁, …, y) of an earlier row',
      `Found ${c.P.dupes} duplicate row(s) among ${c.P.N}.${c.P.dupes ? ` The first copy of each observation is kept as the original, so ${c.P.N - c.P.dupes} distinct rows remain.` : ''}`,
      'Duplicates make N look bigger than the real amount of information, so standard errors come out too small, and copies can land in both train and test.'),
    () => ex('A missing value is an empty cell. Rows with gaps either get dropped or have the gap filled (imputed), for example with the column mean.', 'count of empty cells per column', 'This generator never leaves cells empty, so there is nothing to handle: 0 missing.', 'Whether dropping is safe depends on why values are missing; that is covered in the Data properties branch.'),
    c => { const y = c.d.y, m = mean(y), s = Math.sqrt(sum(y.map(v => (v - m) ** 2)) / (y.length - 1)), zs = y.map(v => (v - m) / s), k = zs.reduce((b, v, i) => Math.abs(v) > Math.abs(zs[b]) ? i : b, 0);
      return ex(`Each value gets a ${g('zscore')}. Values more than 3 standard deviations from the mean are flagged as possible ${g('outlier', 'outliers')}. The same check is run on y and on every feature.`,
        'z = (value − mean) / sd;  flag if |z| > 3',
        `For y: mean = ${n(m)}, sd = ${n(s)}. The most extreme value is row ${k + 1}, y = ${n(y[k])}: z = (${n(y[k])} − ${n(m)}) / ${n(s)} = <b>${n(zs[k], 2)}</b>${Math.abs(zs[k]) > 3 ? ' → flagged' : ' → not flagged'}. Total flagged: ${c.P.outY} in y, ${c.P.outX} in the features.`,
        'A flag means "look at this row", not "delete it": an outlier can be a typo, or the most informative point you have.'); },
    () => ex(`${g('leakage', 'Leakage')} means a feature secretly contains the answer, e.g. a column computed from y, or a date that reveals the outcome.`, '—', 'Every feature here is generated independently of y\'s noise, so there is no leakage.', 'Leaked features give models that look excellent in testing and fail in use.')
  ];
  E[3] = [
    c => { const y = c.d.y, m = mean(y), dd = y.map(v => v - m), m2 = mean(dd.map(v => v * v)), m3 = mean(dd.map(v => v ** 3));
      return ex(`${g('skew', 'Skewness')} measures how lopsided a ${g('distribution')} is. Take each value's ${g('deviation')} from the ${g('mean')}. Cubing keeps the sign, so big deviations to the right push the sum up and big ones to the left push it down. Divide by the spread cubed so the answer has no units.`,
        'γ₁ = m₃ / m₂<sup>1.5</sup>,  where m₂ = mean of d², m₃ = mean of d³, d = value − mean',
        `For y (all ${y.length} rows), mean = ${n(m)}:` + T(['y', 'd = y − mean', 'd²', 'd³'], y.map((v, i) => [v, dd[i], dd[i] ** 2, dd[i] ** 3]), { total: ['mean', n(m), '0', m2, m3] }) +
        `γ₁ = ${n(m3, 4)} / ${n(m2, 4)}<sup>1.5</sup> = ${n(m3, 4)} / ${n(m2 ** 1.5, 4)} = <b>${n(m3 / m2 ** 1.5, 2)}</b>`,
        'Roughly: |γ₁| < 0.5 fairly symmetric, 0.5–1 moderately skewed, > 1 strongly skewed. Skewed y can hint at skewed errors or a needed log transform.'); },
    c => { const x = c.d.X.map(r => r[1]), y = c.d.y, mx_ = mean(x), my = mean(y), dx = x.map(v => v - mx_), dy = y.map(v => v - my), sxy = sum(dx.map((v, i) => v * dy[i])), sxx = sum(dx.map(v => v * v)), syy = sum(dy.map(v => v * v));
      return ex(`The ${g('corr', 'correlation')} r asks: when x is above its average, is y usually above its average too? Multiply the two ${g('deviation', 'deviations')} for each row: positive when they agree, negative when they disagree. Add them up, then divide by the two spreads so r lands between −1 and 1.`,
        'r = Σ (x − x̄)(y − ȳ) / √( Σ (x − x̄)² · Σ (y − ȳ)² )',
        `x̄ = ${n(mx_)}, ȳ = ${n(my)}:` + T([`x − x̄`, 'y − ȳ', 'product', '(x − x̄)²', '(y − ȳ)²'], x.map((_, i) => [dx[i], dy[i], dx[i] * dy[i], dx[i] ** 2, dy[i] ** 2]), { total: ['Σ', '0', '0', sxy, sxx, syy] }) +
        `r = ${n(sxy, 2)} / √(${n(sxx, 2)} × ${n(syy, 2)}) = ${n(sxy, 2)} / ${n(Math.sqrt(sxx * syy), 2)} = <b>${n(sxy / Math.sqrt(sxx * syy), 3)}</b>`,
        'r measures only straight-line association: a perfect curve can have r near 0. That is why the scatter plot matters as much as the number.'); },
    c => ex('The same correlation formula, applied to each pair of features instead of a feature and y.', 'r(xⱼ, xₖ) for every pair of features', isFinite(c.P.eda.maxFeatCorr) ? `The strongest pair has |r| = ${n(c.P.eda.maxFeatCorr)}. Its scatter is in the step-3 chart.` : 'With only one feature there is no pair to compare.', 'Above about 0.7 the features share a lot of information; above 0.9 the separate coefficients become unstable (multicollinearity).'),
    null
  ];
  E[4] = [
    c => ex('Before learning anything, part of the data is locked away to act as "new" data later. The rows are shuffled in a random order (fixed by the sample number, so it is repeatable) and the first 80% become the training set.',
      'N_train = round(0.8 × N),  N_test = N − N_train',
      `round(0.8 × ${c.P.N}) = round(${n(0.8 * c.P.N, 1)}) = ${c.P.nTr} training rows; ${c.P.N} − ${c.P.nTr} = ${c.P.nTe} test rows. Test rows: ${c.P.te.map(i => i + 1).join(', ')}.`,
      'Every step that learns numbers from data (scaling, fitting) must use only the training rows; otherwise the test score is contaminated.'),
    c => ex('A random shuffle assumes rows are independent. If neighbouring rows are related (time series, groups, duplicates), a test row is "almost seen" through its neighbours in training.', '—',
      `Look at the strip chart in this step: test rows (amber) sit between training rows (teal). ${c.attr.id === 'independence' && !c.isBase ? 'For this variant that lets information leak.' : 'For independent rows that is fine.'}`,
      'Time series: train on the past, test on the future. Groups: put whole groups on one side.'),
    null
  ];
  E[5] = [
    c => { const j = 1, x = c.P.tr.map(i => c.d.X[i][j]), m = mean(x), d2 = x.map(v => (v - m) ** 2), s = Math.sqrt(mean(d2));
      return ex(`To ${g('standardise')} a feature we need its ${g('mean')} μ and ${g('sd', 'standard deviation')} s, computed on the training rows only.`,
        'μ = (1/N_train) Σ xᵢ,   s = √( (1/N_train) Σ (xᵢ − μ)² )',
        `For ${c.P.names[j]} on the ${x.length} training rows:` + T([c.P.names[j], 'x − μ', '(x − μ)²'], x.map((v, i) => [v, v - m, d2[i]]), { total: ['Σ / mean', `Σ = ${n(sum(x), 3)}`, '0', `mean = ${n(mean(d2), 4)}`] }) +
        `μ = ${n(sum(x), 3)} / ${x.length} = <b>${n(m)}</b>;  s = √${n(mean(d2), 4)} = <b>${n(s)}</b>`,
        'This uses the population formula (divide by N). Some libraries divide by N − 1; with many rows the difference is tiny.'); },
    c => { const i = c.P.tr[0], r = c.d.X[i];
      return ex('Each feature value is replaced by "how many standard deviations above or below the training mean". The intercept column stays 1.',
        'x̃ = (x − μ) / s',
        `First training row (row ${i + 1}): ` + c.P.names.slice(1).map((nm, k) => `${nm}: (${n(r[k + 1])} − ${n(c.P.mu[k + 1])}) / ${n(c.P.sd[k + 1])} = <b>${n((r[k + 1] - c.P.mu[k + 1]) / c.P.sd[k + 1])}</b>`).join('; ') + `. So the row becomes ${vec(c.P.Xtr[0], 3)}.`,
        'After this, every feature has mean 0 and sd 1 on the training rows. Predictions do not change, but the numbers in the algebra become well balanced and gradient descent becomes fast.'); },
    c => ex('Categories (A, B, C) are turned into 0/1 columns, one per level. With an intercept column you must drop one level, otherwise the dummy columns add up to the intercept column exactly.', 'dummy_A + dummy_B + dummy_C = 1 for every row',
      c.P.names.includes('A') ? 'All three dummies are kept here, so they add up to the column of 1s: that is the dummy-variable trap.' : 'There are no categorical features in this variant.', 'Keep k − 1 dummies for a k-level category.'),
    null
  ];
  E[6] = [
    c => ex(`The training rows are stacked into a ${g('matrix')} X̃ (one row per observation, one column per coefficient) and the targets into a ${g('vector')} y.`, 'X̃ is N_train × p,  y is N_train × 1', `X̃ is ${c.P.nTr} × ${c.P.P} with columns [${c.P.names.join(', ')}]; y has ${c.P.nTr} entries.`, 'The first column is all 1s so the model can have an intercept.'),
    c => { const e = LA.eigSym(c.P.f.XtX), lo = e.values[e.values.length - 1], v = e.vectors[e.vectors.length - 1];
      return ex(`The ${g('rank')} counts columns that carry new information. If some combination of columns is zero on every row, one column is redundant and the rank drops below p. Such a combination is found from the smallest ${g('eigen', 'eigenvalue')} of X̃ᵀX̃: if that eigenvalue is 0, its direction gives the redundant combination.`,
        'rank(X̃) = p  ⇔  no non-zero c with X̃c = 0  ⇔  smallest eigenvalue of X̃ᵀX̃ > 0',
        `Smallest eigenvalue of X̃ᵀX̃ = ${n(lo, 6)}. ` + (c.P.f.rank < c.P.P ? `It is 0, so the columns are dependent: ${v.map((x, k) => `${n(x, 3)}·${c.P.names[k]}`).join(' + ')} = 0 on every row. Rank = <b>${c.P.f.rank}</b> of ${c.P.P}.` : `It is above 0, so rank = <b>${c.P.P}</b> (full).`),
        'Full rank means a single best set of weights exists. Below full rank, infinitely many weight vectors give identical predictions.'); },
    c => { const e = c.P.f.eig;
      return ex(`The condition number κ compares the largest and smallest ${g('eigen', 'eigenvalues')} of X̃ᵀX̃. It says how unevenly the data constrains different directions of the weights: a huge κ means some combination of weights is barely pinned down.`,
        'κ = λ_max / λ_min of X̃ᵀX̃',
        `Eigenvalues of X̃ᵀX̃: ${e.map(v => n(v, 3)).join(', ')}. κ = ${n(e[0], 3)} / ${n(e[e.length - 1], 6)} = <b>${isFinite(c.P.f.kappa) ? n(c.P.f.kappa, 1) : '∞'}</b>`,
        'κ near 1 is ideal (standardised, uncorrelated features give exactly 1). Above about 30 is a warning, above 1000 serious.'); }
  ];
  E[7] = [
    c => { const x = c.P.Xtr[0], w = c.P.f.w;
      return ex(`A prediction is a ${g('dot', 'weighted sum')}: start from the intercept and add each feature times its weight. Doing this for every row at once is a matrix times a vector.`,
        'ŷᵢ = w̃₀·1 + w̃₁·x̃ᵢ₁ + … ,  all rows: ŷ = X̃w̃',
        `With the fitted weights w̃ = ${vec(w)}, first training row ${vec(x)}: ŷ₁ = ${x.map((v, k) => `${n(w[k])} × ${n(v)}`).join(' + ')} = <b>${n(LA.dot(x, w))}</b>`,
        '"Linear" means linear in the weights: each weight multiplies something and the results are added.'); },
    null
  ];
  E[8] = [
    c => ex(`The ${g('residual')} is how far off each prediction is.`, 'eᵢ = yᵢ − ŷᵢ', T(['y', 'ŷ', 'e = y − ŷ'], c.P.ytr.map((v, i) => [v, c.P.f.yhat[i], c.P.f.e[i]]), { total: ['Σ', n(sum(c.P.ytr)), n(sum(c.P.f.yhat)), n(sum(c.P.f.e), 6)] }) + 'With an intercept the residuals of the best fit always add up to 0 (bottom row).', 'Residuals are the raw material for the loss, the diagnostics and the standard errors.'),
    c => { const e = c.P.f.e, e2 = e.map(v => v * v);
      return ex(`The ${g('loss')} turns all the residuals into one number: square each (so positive and negative errors both count, and big ones count more), then average.`,
        'L(w̃) = (1/N) Σ eᵢ²  =  (1/N) eᵀe',
        T(['e', 'e²'], e.map((v, i) => [v, e2[i]]), { total: ['Σ', n(sum(e), 4), sum(e2)] }) + `L = ${n(sum(e2), 4)} / ${e.length} = <b>${n(sum(e2) / e.length, 4)}</b>. With all weights 0 every prediction is 0, every residual equals y, and L = mean of y² = ${n(c.P.iters[0].L, 3)}.`,
        'Training means choosing w̃ to make L as small as possible.'); },
    () => ex('A penalty adds λ × (size of the weights) to the loss to keep weights small. With λ = 0 there is no penalty: plain least squares.', 'L_penalised = L + λ Σ wⱼ²  (ridge)', 'λ = 0 here.', 'Penalties are explored in the Model formulation branch.')
  ];
  E['9a'] = [
    c => { const X = c.P.Xtr, j = Math.min(1, c.P.P - 1), col0 = X.map(r => r[0]), colj = X.map(r => r[j]);
      return ex(`X̃ᵀX̃ is a small square ${g('matrix')}: entry (j, k) is the ${g('dot', 'dot product')} of column j with column k of X̃. It summarises everything about the inputs that the solution needs.`,
        '(X̃ᵀX̃)ⱼₖ = Σᵢ x̃ᵢⱼ · x̃ᵢₖ',
        T([`x̃ (${c.P.names[0]})`, `x̃ (${c.P.names[j]})`, `1 · x̃`, 'x̃ · x̃'], X.map((r, i) => [col0[i], colj[i], col0[i] * colj[i], colj[i] ** 2]), { total: ['Σ', n(sum(col0), 2), '', sum(col0.map((v, i) => v * colj[i])), sum(colj.map(v => v * v))] }) +
        `So entry (1, ${c.P.names[j]}) = ${n(sum(col0.map((v, i) => v * colj[i])), 4)} and entry (${c.P.names[j]}, ${c.P.names[j]}) = ${n(sum(colj.map(v => v * v)), 4)}. Standardising makes Σ x̃ = 0 and Σ x̃² = N_train = ${c.P.nTr}. Its ${g('det', 'determinant')} is <b>${n(c.P.f.det, 4)}</b>.`,
        'det = 0 means no inverse, so no unique solution.'); },
    c => { const f = c.P.f, P = c.P;
      const special = P.P === 2 && f.full ? `Because X̃ᵀX̃ = [[${n(f.XtX[0][0], 2)}, ${n(f.XtX[0][1], 2)}], [${n(f.XtX[1][0], 2)}, ${n(f.XtX[1][1], 2)}]] is diagonal here, each equation has one unknown: w̃₀ = ${n(f.Xty[0], 3)} / ${n(f.XtX[0][0], 2)} = <b>${n(f.w[0])}</b> and w̃₁ = ${n(f.Xty[1], 3)} / ${n(f.XtX[1][1], 2)} = <b>${n(f.w[1])}</b>.` : f.full ? `Solving the ${P.P} equations by elimination gives w̃ = <b>${vec(f.w)}</b>.` : 'X̃ᵀX̃ has no inverse, so infinitely many w̃ solve the equations; the one with the smallest length is reported.';
      return ex(`At the lowest point of the loss the ${g('derivative', 'gradient')} is zero. Writing that down gives one equation per weight, the "normal equations". Solving them gives the best weights directly, with no iterations.`,
        'X̃ᵀX̃ w̃ = X̃ᵀy   ⇒   w̃ = (X̃ᵀX̃)⁻¹ X̃ᵀy',
        `X̃ᵀy has one entry per column: Σ x̃ᵢⱼ yᵢ = ${vec(f.Xty, 3)}. ${special}`,
        'The closed form is exact. Its cost grows with p³, so for very many features iterative methods are used instead.'); },
    c => ex('Plug the solution back in and compute the loss.', 'L(w̃*) = SSE / N_train', `SSE = ${n(c.P.f.SSE, 4)}, so L = ${n(c.P.f.SSE, 4)} / ${c.P.nTr} = <b>${n(c.P.f.SSE / c.P.nTr, 4)}</b>.`, 'This is the smallest loss any straight-line model can reach on these training rows. It is above 0 unless the data lie exactly on a plane.')
  ];
  E['9b'] = [
    c => ex(`The loss is a bowl over the weights. Its curvature matrix H = (2/N)X̃ᵀX̃ says how steep the walls are. The steepest direction has curvature λ_max (the largest ${g('eigen', 'eigenvalue')} of H). A step bigger than 2/λ_max overshoots that wall by more than it corrects, so the iterations blow up.`,
      'H = (2/N) X̃ᵀX̃,   stable if η < 2 / λ_max(H)',
      `Eigenvalues of H: ${c.P.eigH.map(v => n(v, 4)).join(', ')}. λ_max = ${n(c.P.eigH[0], 4)}, so 2/λ_max = <b>${n(c.P.lim, 4)}</b>.`,
      'Standardised, uncorrelated features give equal eigenvalues, so one step size suits every direction.'),
    c => ex(`The ${g('lr', 'learning rate')} η is chosen as a safe fraction of the limit.`, 'η = 0.2 × 2 / λ_max', `η = 0.2 × ${n(c.P.lim, 4)} = <b>${n(c.P.eta, 4)}</b>`, 'Bigger η: fewer steps but risk of divergence. The Optimisation branch will let you vary it.'),
    c => { const X = c.P.Xtr, y = c.P.ytr, N = X.length, it = c.P.iters[0], g0 = it.g;
      return ex(`Each iteration repeats four moves: predict with the current weights, measure the residuals, compute the ${g('derivative', 'gradient')} (which way the loss goes up), and step the other way. Here is iteration 1 in full, starting from all weights 0.`,
        '∇L = −(2/N) X̃ᵀe,   w̃ ← w̃ − η ∇L',
        `With w̃ = 0, every ŷᵢ = 0, so eᵢ = yᵢ.` + T(['e = y', ...c.P.names.slice(1).map(nm => `x̃ (${nm}) · e`)], X.map((r, i) => [y[i], ...r.slice(1).map(v => v * y[i])]), { total: ['Σ', sum(y), ...c.P.names.slice(1).map((_, k) => sum(X.map((r, i) => r[k + 1] * y[i])))] }) +
        `∇L = −(2/${N}) × ${vec([sum(y), ...c.P.names.slice(1).map((_, k) => sum(X.map((r, i) => r[k + 1] * y[i])))], 3)} = ${vec(g0, 4)}<br>w̃₁ = 0 − ${n(c.P.eta, 4)} × ${vec(g0, 4)} = <b>${vec(it.next, 4)}</b> (row t = 1 of the table)`,
        'The loss falls fastest early, then the steps shrink because the gradient shrinks near the bottom.'); },
    c => ex('Gradient descent should end where the closed form landed.', '|L_GD − L_closed| → 0', `After ${c.P.iters[c.P.iters.length - 1].t} steps: ${n(c.P.iters[c.P.iters.length - 1].L, 6)} vs ${n(c.P.f.SSE / c.P.nTr, 6)}.`, 'If they differ, it needs more iterations (large κ) or η is too big.')
  ];
  E[10] = [
    c => ex(`Ramsey RESET: if the true relationship is curved, then powers of the prediction (ŷ², ŷ³) will help explain y. Refit with those extra columns and use an F ${g('test')} to ask whether the error dropped by more than chance.`,
      'F = ((SSE_without − SSE_with) / 2) / (SSE_with / (N − p − 2))',
      c.P.dg?.reset ? `SSE without = ${n(c.P.f.SSE, 3)}. F = <b>${n(c.P.dg.reset.F, 3)}</b>, compared with an ${g('fdist', 'F distribution')} with 2 and ${c.P.nTr - c.P.P - 2} ${g('df', 'degrees of freedom')}: ${g('pvalue')} = <b>${pf(c.P.dg.reset.p)}</b>.` : 'Not enough rows to run it.',
      `${g('null', 'Null hypothesis')}: no curvature is missing. p < 0.05 → reject, so the straight line is probably the wrong shape.`),
    c => { const aux = c.P.dg?.bp ? ST.ols(c.P.Xtr, c.P.f.e.map(v => v * v), true) : null;
      return ex('Breusch–Pagan: if the spread of the errors depends on x, then the squared residuals should be predictable from x. Regress e² on the features and see how much of it is explained.',
        'LM = N × R² of (e² regressed on X̃),  compared with χ²(p − 1)',
        aux ? `R² of that auxiliary regression = ${n(aux.R2, 4)}. LM = ${c.P.nTr} × ${n(aux.R2, 4)} = <b>${n(c.P.dg.bp.LM, 3)}</b>. Under the null this follows a ${g('chi2', 'chi-square')} with ${c.P.dg.bp.df} ${g('df', 'degree(s) of freedom')}: p = <b>${pf(c.P.dg.bp.p)}</b>.` : 'Not available.',
        'Null: constant variance. p < 0.05 → the spread changes with x (heteroscedasticity).'); },
    c => { const e = c.P.f.e, dif = e.slice(1).map((v, i) => v - e[i]), num_ = sum(dif.map(v => v * v)), den = sum(e.map(v => v * v));
      return ex('Durbin–Watson: if consecutive errors are similar (positive autocorrelation), the differences between neighbours are small. Compare the squared differences with the squared residuals. Rows are taken in their original time order.',
        'DW = Σₜ (eₜ − eₜ₋₁)² / Σₜ eₜ²',
        T(['eₜ', 'eₜ − eₜ₋₁', '(eₜ − eₜ₋₁)²'], e.map((v, i) => [v, i ? v - e[i - 1] : '—', i ? (v - e[i - 1]) ** 2 : '—']), { total: ['Σ', `Σe² = ${n(den, 3)}`, '', num_] }) + `DW = ${n(num_, 3)} / ${n(den, 3)} = <b>${n(num_ / den, 2)}</b>`,
        'About 2: independent. Well below 2 (toward 0): neighbours move together. Above 2 (toward 4): they alternate.'); },
    c => { const j = c.P.dg?.jb;
      return ex('Jarque–Bera: a normal distribution has skewness 0 and kurtosis 3 (kurtosis measures how heavy the tails are). Measure both on the residuals and combine how far they are from 0 and 3.',
        'JB = (N/6) × ( S² + (K − 3)² / 4 ),  S = m₃/m₂^1.5,  K = m₄/m₂²',
        j ? `Residual skewness S = ${n(j.skew, 3)}, kurtosis K = ${n(j.kurt, 3)}. JB = (${c.P.nTr}/6) × (${n(j.skew, 3)}² + (${n(j.kurt, 3)} − 3)²/4) = <b>${n(j.JB, 3)}</b>. Against ${g('chi2', 'χ²(2)')}: p = e<sup>−JB/2</sup> = <b>${pf(j.p)}</b>.` : '—',
        'Null: the errors are normal. With small N the test has little power; with very large N it flags harmless deviations.'); },
    c => ex('Variance inflation factor: regress one feature on all the others. If the others predict it well (R²ⱼ near 1), that feature adds little new information and its coefficient becomes unstable.',
      'VIFⱼ = 1 / (1 − R²ⱼ)',
      c.P.dg?.vif.length ? c.P.names.slice(1).map((nm, k) => { const v = c.P.dg.vif[k]; return `${nm}: ${isFinite(v) ? `R² = ${n(1 - 1 / v, 4)}, VIF = 1 / (1 − ${n(1 - 1 / v, 4)}) = <b>${n(v, 2)}</b>` : 'R² = 1, VIF = ∞'}`; }).join('; ') + (c.P.P === 2 ? '. With a single feature there is nothing else to predict it from, so VIF = 1 by definition.' : '.') : '—',
      'VIF 1: no overlap. Above 5: worth a look. Above 10: serious multicollinearity.'),
    c => { const f = c.P.f; if (!f.cook) return ex("Cook's distance needs (X̃ᵀX̃)⁻¹, which does not exist here.", '—', '—', '—');
      const k = f.cook.reduce((b, v, i) => v > f.cook[b] ? i : b, 0);
      return ex("Cook's distance: how much all the predictions would move if this one row were deleted. It combines how badly the row is fitted (its residual) with how unusual its x is (its leverage h, between 0 and 1).",
        'Dᵢ = eᵢ² / (p · s²) × hᵢ / (1 − hᵢ)²',
        `Largest is training row ${k + 1}: e = ${n(f.e[k])}, h = ${n(f.lev[k], 4)}, p = ${f.rank}, s² = ${n(f.s2, 4)}. D = ${n(f.e[k] ** 2, 4)} / (${f.rank} × ${n(f.s2, 4)}) × ${n(f.lev[k], 4)} / (1 − ${n(f.lev[k], 4)})² = <b>${n(f.cook[k], 3)}</b>`,
        'Above 1 (some use 4/N) means a single row is steering the fit.'); }
  ];
  E[11] = [
    c => ex(`To judge uncertainty we need the size of the noise. Its estimate s² uses the residuals, divided by the ${g('df', 'degrees of freedom')} N − p rather than N, because fitting p coefficients used up p pieces of information.`,
      's² = SSE / (N − p)', `s² = ${n(c.P.f.SSE, 4)} / (${c.P.nTr} − ${c.P.f.rank}) = ${n(c.P.f.SSE, 4)} / ${c.P.nTr - c.P.f.rank} = <b>${n(c.P.f.s2, 4)}</b>`, 'Dividing by N would make the noise look slightly smaller than it is.'),
    c => { const j = c.focus, f = c.P.f;
      if (!f.inv) return ex('The standard error needs (X̃ᵀX̃)⁻¹, which does not exist here.', '—', '—', '—');
      const sej = Math.sqrt(f.s2 * f.inv[j][j]);
      return ex(`The ${g('se', 'standard error')} says how much the coefficient would wobble across repeated samples. The classical formula assumes every error has the same variance and errors are independent. The other three relax those assumptions: HC1 lets each row have its own variance (it uses eᵢ² row by row), Newey–West also allows neighbouring errors to be correlated, and clustered allows correlation within groups.`,
        'classical: SE(w̃ⱼ) = √( s² · [(X̃ᵀX̃)⁻¹]ⱼⱼ ), then SE(wⱼ) = SE(w̃ⱼ) / sⱼ',
        `[(X̃ᵀX̃)⁻¹]ⱼⱼ = ${n(f.inv[j][j], 6)}. SE(w̃ⱼ) = √(${n(f.s2, 4)} × ${n(f.inv[j][j], 6)}) = ${n(sej, 4)}. Back to original units: ${n(sej, 4)} / ${n(c.P.sd[j], 4)} = <b>${n(sej / c.P.sd[j], 4)}</b>.` +
        (c.P.nw ? ` Newey–West uses lag L = floor(4 × (N/100)<sup>2/9</sup>) = floor(4 × (${c.P.nTr}/100)<sup>0.222</sup>) = ${c.P.nw.lag}, giving weight 1 − l/(L + 1) to residual products l rows apart.` : ''),
        'If the robust SEs are much bigger than the classical one, the classical one is overconfident for this data.'); },
    c => { const j = c.focus, f = c.P.f; if (!isFinite(f.se[j])) return ex('Not defined without an inverse.', '—', '—', '—');
      const w = c.P.wOrig[j], se = c.P.seOrig[j];
      return ex(`The t-statistic asks: how many standard errors is the estimate away from 0? The ${g('pvalue')} turns that into a probability using the ${g('tdist', 't distribution')} with N − p ${g('df', 'degrees of freedom')}. The ${g('ci', '95% confidence interval')} is the estimate plus or minus a critical value times the SE.`,
        't = w / SE,   p = P(|T| ≥ |t|),   CI = w ± t_crit × SE',
        `t = ${n(w, 4)} / ${n(se, 4)} = <b>${n(f.t[j], 2)}</b> with ${f.df} df. The critical value t_crit for 95% with ${f.df} df is ${n(f.tc, 3)}, so CI = ${n(w, 4)} ± ${n(f.tc, 3)} × ${n(se, 4)} = [<b>${n(w - f.tc * se, 3)}</b>, <b>${n(w + f.tc * se, 3)}</b>].`,
        `${g('null', 'Null')}: the true slope is 0. A tiny p says the slope is real, not that the model is right or the CI trustworthy: those depend on the assumptions.`); },
    null
  ];
  E[12] = [
    c => { const e = c.P.ete, e2 = e.map(v => v * v);
      return ex(`The test rows are standardised with the training μ and s, predicted with the trained weights, and their errors summarised as ${g('rmse', 'RMSE')}.`,
        'RMSE = √( (1/N_test) Σ (yᵢ − ŷᵢ)² )',
        T(['y', 'ŷ', 'e', 'e²'], c.P.yte.map((v, i) => [v, c.P.yhte[i], e[i], e2[i]]), { k: 12, label: 'test row', total: ['Σ', '', '', '', sum(e2)] }) +
        `RMSE = √(${n(sum(e2), 3)} / ${e.length}) = <b>${n(c.P.rmseTe, 3)}</b> (training: ${n(c.P.rmseTr, 3)})`,
        'Test error clearly above training error means the model learned noise (overfitting) or the test data differ.'); },
    c => { const y = c.P.yte, m = mean(y), sst = sum(y.map(v => (v - m) ** 2)), sse = sum(c.P.ete.map(v => v * v));
      return ex(`${g('r2', 'R²')} compares the model with the simplest possible predictor: always guessing the mean.`, 'R² = 1 − SSE / SST,  SST = Σ (yᵢ − ȳ)²',
        `Test mean ȳ = ${n(m)}. SST = ${n(sst, 3)}, SSE = ${n(sse, 3)}. R² = 1 − ${n(sse, 3)} / ${n(sst, 3)} = <b>${n(1 - sse / sst, 3)}</b>`,
        'Can be negative on test data if the model is worse than guessing the mean.'); }
  ];
  E[13] = [
    c => { const w = c.P.f.w, mu = c.P.mu, sd = c.P.sd;
      return ex('The weights were learned on standardised features, so they answer "per standard deviation". Dividing by s converts them back to "per original unit". The intercept absorbs the shifts by μ.',
        'wⱼ = w̃ⱼ / sⱼ,   b = w̃₀ − Σⱼ w̃ⱼ μⱼ / sⱼ',
        c.P.names.slice(1).map((nm, k) => `${nm}: ${n(w[k + 1], 4)} / ${n(sd[k + 1], 4)} = <b>${n(w[k + 1] / sd[k + 1], 4)}</b>`).join('; ') +
        `; b = ${n(w[0], 4)} − ${c.P.names.slice(1).map((_, k) => `${n(w[k + 1], 4)} × ${n(mu[k + 1], 4)} / ${n(sd[k + 1], 4)}`).join(' − ')} = <b>${n(c.P.wOrig[0], 4)}</b>`,
        'These are the numbers you would report, and they can be compared with the true β from step 1.'); },
    null
  ];
  return E;
})();
