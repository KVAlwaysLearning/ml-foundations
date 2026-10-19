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
  standardise: ['Standardising', 'Rescaling a feature to mean 0 and standard deviation 1: subtract the mean, divide by the sd. The shape of the data is unchanged; only the ruler changes.'],
  kurt: ['Kurtosis', 'How heavy the tails are: the average of d⁴ divided by (average of d²)². A normal distribution has kurtosis 3. Above 3: more extreme values than a bell curve. Below 3: fewer. "Excess kurtosis" is kurtosis − 3.'],
  crit: ['Critical value', 'The cut-off a test statistic must pass to reject the null at a chosen level (usually 5%). Passing the critical value and having p < 0.05 are the same decision, stated two ways.'],
  nested: ['Restricted vs unrestricted model', 'Two models where the smaller one is the bigger one with some coefficients forced to 0. The bigger model always fits at least as well (smaller SSE). An F test asks whether it fits better by more than chance.'],
  aux: ['Auxiliary regression', 'A helper regression run only to compute a test, not to predict y. E.g. Breusch–Pagan regresses the squared residuals on x; VIF regresses one feature on the others.'],
  autocorr: ['Autocorrelation', 'Correlation of a series with itself shifted by some rows. Lag-1 autocorrelation compares each residual with the one just before it.'],
  leverage: ['Leverage (h)', 'How unusual a row\'s x values are, between 1/N and 1. A high-leverage row sits far from the centre of the x values, so the fitted line is pulled toward it. Leverages add up to p.'],
  type1: ['Type I and Type II errors', 'Type I: rejecting a true null (a false alarm); its probability is the 5% level. Type II: failing to reject a false null (a miss). Power = 1 − P(Type II): the chance a test catches a real problem.'],
  sandwich: ['Sandwich estimator', 'Var(ŵ) = (XᵀX)⁻¹ · M · (XᵀX)⁻¹. The two outer pieces ("bread") come from X; the middle ("meat") M is built from the residuals and decides which error patterns are allowed. Different meats give HC1, Newey–West and clustered SEs.']
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
  const ex = (plain, formula, calc, read, more = {}) => ({ plain, formula, calc, read, ...more });
  const ol = items => `<ol class="wsteps">${items.filter(Boolean).map(s => `<li>${s}</li>`).join('')}</ol>`;
  const bis = (sf, a) => { let lo = 0, hi = 1e4; for (let i = 0; i < 90; i++) { const m = (lo + hi) / 2; if (sf(m) > a) lo = m; else hi = m; } return (lo + hi) / 2; };
  const fCrit = (d1, d2, a = 0.05) => bis(F => ST.fSF(F, d1, d2), a), chiCrit = (k, a = 0.05) => bis(x => ST.chi2SF(x, k), a);
  const decide = (p, stat, crit, name, rej, acc) => `<p class="wdec ${p < 0.05 ? 'rej' : 'acc'}"><b>Decision at the 5% level:</b> ${name} = ${n(stat, 3)} ${p < 0.05 ? '&gt;' : '≤'} ${g('crit', 'critical value')} ${n(crit, 3)}, which is the same as ${pEq(p)} ${p < 0.05 ? '(below 0.05)' : '(not below 0.05)'}. So ${p < 0.05 ? `<b>reject H₀</b>: ${rej}` : `<b>do not reject H₀</b>: ${acc}`}</p>`;
  const H = (h0, h1) => `<b>H₀</b>: ${h0}<br><b>H₁</b>: ${h1}`;
  const corrCalc = (x, y, lx, ly) => { const mx_ = mean(x), my = mean(y), dx = x.map(v => v - mx_), dy = y.map(v => v - my), sxy = sum(dx.map((v, i) => v * dy[i])), sxx = sum(dx.map(v => v * v)), syy = sum(dy.map(v => v * v));
    return { r: sxy / Math.sqrt(sxx * syy), html: `${lx} mean = ${n(mx_)}, ${ly} mean = ${n(my)}:` + T([`${lx} − mean`, `${ly} − mean`, 'product', `(${lx} − mean)²`, `(${ly} − mean)²`], x.map((_, i) => [dx[i], dy[i], dx[i] * dy[i], dx[i] ** 2, dy[i] ** 2]), { total: ['Σ', '0', '0', sxy, sxx, syy] }) +
      `r = ${n(sxy, 2)} / √(${n(sxx, 2)} × ${n(syy, 2)}) = ${n(sxy, 2)} / ${n(Math.sqrt(sxx * syy), 2)} = <b>${n(sxy / Math.sqrt(sxx * syy), 3)}</b>` }; };

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
      (() => { const first = new Map(), pairs = []; c.d.X.forEach((r, i) => { const k = [...r.slice(1), c.d.y[i]].map(v => v.toFixed(9)).join('|'); if (first.has(k)) pairs.push([i, first.get(k)]); else first.set(k, i); });
        return `Each row becomes a key such as "${[...c.d.X[0].slice(1), c.d.y[0]].map(v => n(v, 3)).join(' | ')}" (row 1). Keys are compared row by row against all earlier keys. Found ${c.P.dupes} duplicate row(s) among ${c.P.N}.` +
          (pairs.length ? T(['repeats row', ...c.P.names.slice(1), 'y'], pairs.map(([i, j]) => { const r = [j + 1, ...c.d.X[i].slice(1), c.d.y[i]]; return r; }), { k: 6, label: 'row' }).replace(/<tr><td>(\d+)<\/td>/g, (m0, k) => `<tr><td>${pairs[+k - 1] ? pairs[+k - 1][0] + 1 : k}</td>`) + `Keeping the first copy of each leaves ${c.P.N - c.P.dupes} distinct rows: the effective sample size is ${c.P.N - c.P.dupes}, not ${c.P.N}.` : ''); })(),
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
        `γ₁ = ${n(m3, 4)} / ${n(m2, 4)}<sup>1.5</sup> = ${n(m3, 4)} / ${n(m2 ** 1.5, 4)} = <b>${n(m3 / m2 ** 1.5, 2)}</b>` +
        `<p>The same steps for each feature: ` + c.P.names.slice(1).map((nm, k) => { const x = c.d.X.map(r => r[k + 1]), mx_ = mean(x), d = x.map(v => v - mx_), a2 = mean(d.map(v => v * v)), a3 = mean(d.map(v => v ** 3));
          return `${nm}: mean ${n(mx_)}, m₂ = ${n(a2, 4)}, m₃ = ${n(a3, 4)}, γ₁ = ${n(a3, 4)} / ${n(a2 ** 1.5, 4)} = <b>${a2 > 0 ? n(a3 / a2 ** 1.5, 2) : '0'}</b>`; }).join('; ') + '.</p>',
        'Roughly: |γ₁| < 0.5 fairly symmetric, 0.5–1 moderately skewed, > 1 strongly skewed. Skewed y can hint at skewed errors or a needed log transform.'); },
    c => { const cc = corrCalc(c.d.X.map(r => r[1]), c.d.y, c.P.names[1], 'y');
      return ex(`The ${g('corr', 'correlation')} r asks: when x is above its average, is y usually above its average too? Multiply the two ${g('deviation', 'deviations')} for each row: positive when they agree, negative when they disagree. Add them up, then divide by the two spreads so r lands between −1 and 1.`,
        'r = Σ (x − x̄)(y − ȳ) / √( Σ (x − x̄)² · Σ (y − ȳ)² )',
        cc.html + (c.P.P > 2 ? `<p>The other features: ${c.P.names.slice(2).map((nm, k) => `r(${nm}, y) = ${n(c.P.eda.corrXY[k + 1], 3)}`).join(', ')}, with the same table.</p>` : ''),
        'r measures only straight-line association: a perfect curve can have r near 0. That is why the scatter plot matters as much as the number. r² is the R² of a regression on that one feature.'); },
    c => { if (c.P.P <= 2) return ex('The same correlation formula, applied to each pair of features instead of a feature and y.', 'r(xⱼ, xₖ) for every pair of features', 'With only one feature there is no pair to compare.', 'Above about 0.7 the features share a lot of information; above 0.9 the separate coefficients become unstable (multicollinearity).');
      let best = null; for (let a = 1; a < c.P.P; a++) for (let b = a + 1; b < c.P.P; b++) { const cc = corrCalc(c.d.X.map(r => r[a]), c.d.X.map(r => r[b]), c.P.names[a], c.P.names[b]); if (isFinite(cc.r) && (!best || Math.abs(cc.r) > Math.abs(best.cc.r))) best = { a, b, cc }; }
      return ex('The same correlation formula, applied to each pair of features instead of a feature and y. Every pair is computed and the largest |r| is reported.', 'r(xⱼ, xₖ) = Σ (xⱼ − x̄ⱼ)(xₖ − x̄ₖ) / √( Σ (xⱼ − x̄ⱼ)² · Σ (xₖ − x̄ₖ)² )',
        best ? `Strongest pair: ${c.P.names[best.a]} and ${c.P.names[best.b]}. ` + best.cc.html : 'The pairs could not be computed (a constant column).',
        'Above about 0.7 the features share a lot of information; above 0.9 the separate coefficients become unstable (multicollinearity). Pairs can miss a feature that is a combination of several others; the VIF in step 10 catches that.'); },
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
      const general = f.full ? `(X̃ᵀX̃)⁻¹ = ${'[' + f.inv.map(r => vec(r, 5)).join(', ') + ']'}. Each weight is a row of the inverse dotted with X̃ᵀy: ` + f.w.map((wj, j) => `w̃${j} = ${f.inv[j].map((v, k) => `${n(v, 5)} × ${n(f.Xty[k], 3)}`).join(' + ')} = <b>${n(wj)}</b>`).join('; ') + '.' : '';
      const special = P.P === 2 && f.full ? `Because X̃ᵀX̃ = [[${n(f.XtX[0][0], 2)}, ${n(f.XtX[0][1], 2)}], [${n(f.XtX[1][0], 2)}, ${n(f.XtX[1][1], 2)}]] is diagonal here, each equation has one unknown: w̃₀ = ${n(f.Xty[0], 3)} / ${n(f.XtX[0][0], 2)} = <b>${n(f.w[0])}</b> and w̃₁ = ${n(f.Xty[1], 3)} / ${n(f.XtX[1][1], 2)} = <b>${n(f.w[1])}</b>.` : f.full ? general : 'X̃ᵀX̃ has no inverse, so infinitely many w̃ solve the equations; the one with the smallest length is reported.';
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
  E[10] = E10();
  E[11] = [
    c => { const f = c.P.f, sig = c.S.sigma;
      return ex(`To judge uncertainty we need the size of the noise. Its estimate s² is built from the residuals. It divides by the ${g('df', 'degrees of freedom')} N − p rather than N, because fitting p coefficients used up p pieces of information: the residuals are forced to satisfy p equations (X̃ᵀe = 0), so only N − p of them are free.`,
        's² = SSE / (N − p),   s = √s²  (the "residual standard error")',
        ol([`SSE = Σ eᵢ² = ${n(f.SSE, 4)} (the e² column total in step 8).`,
          `s² = ${n(f.SSE, 4)} / (${c.P.nTr} − ${f.rank}) = ${n(f.SSE, 4)} / ${f.df} = <b>${n(f.s2, 4)}</b>, so s = ${n(Math.sqrt(f.s2), 4)}.`,
          `Compare with the noise you chose in step 1: σ_ε = ${n(sig, 2)}, σ_ε² = ${n(sig * sig, 3)}.${c.attr.id === 'homoscedasticity' && !c.isBase ? ' With non-constant variance, s² is only an average noise level.' : ''}`]),
        'Dividing by N would make the noise look slightly smaller than it is; dividing by N − p makes s² an unbiased estimate of σ².',
        { qa: [['Why N − p?', 'The residuals satisfy p linear constraints (they are orthogonal to every column of X), so they live in an (N − p)-dimensional space. E[SSE] = (N − p)σ², so SSE/(N − p) is unbiased.'],
          ['s vs RMSE?', 'Both measure the typical error. RMSE divides by N and is used for prediction; s divides by N − p and is used for inference. With N ≫ p they are almost equal.']] }); },
    c => { const j = c.focus, f = c.P.f, P = c.P, X = P.Xtr, e = f.e, N = X.length, p = P.P;
      if (!f.inv) return ex('The standard error needs (X̃ᵀX̃)⁻¹, which does not exist here.', '—', '—', '—');
      const a = X.map(r => LA.dot(f.inv[j], r)), sa2 = sum(a.map(v => v * v)), clv = f.s2 * f.inv[j][j], sdj = P.sd[j];
      const hc0 = sum(a.map((v, i) => v * v * e[i] * e[i])), kf = N / (N - p), hcv = kf * hc0;
      let nwHtml = '', clHtml = '';
      if (P.nw) { const L = P.nw.lag; let extra = 0; const rows = [];
        for (let l = 1; l <= L; l++) { let sl = 0; for (let t = l; t < N; t++) sl += a[t] * a[t - l] * e[t] * e[t - l]; const wl = 1 - l / (L + 1); extra += 2 * wl * sl; rows.push([wl, sl, 2 * wl * sl]); }
        const nwv = kf * (hc0 + extra);
        nwHtml = `<b>Newey–West</b> also lets errors l rows apart be correlated. It adds, for each lag l up to L, the products aₜaₜ₋ₗ·eₜeₜ₋ₗ. Each lag is down-weighted by 1 − l/(L + 1) (Bartlett weights), which keeps the variance positive. L = floor(4 × (N/100)<sup>2/9</sup>) = floor(4 × (${N}/100)<sup>0.222</sup>) = ${L}.` +
          T(['weight 1 − l/(L+1)', 'Σ aₜaₜ₋ₗ eₜeₜ₋ₗ', '2 × weight × Σ'], rows, { k: 8, label: 'lag l', total: ['Σ', '', '', extra] }) +
          `Var = ${n(kf, 4)} × (${n(hc0, 6)} + ${n(extra, 6)}) = ${n(nwv, 6)}; SE(w̃ⱼ) = ${n(Math.sqrt(nwv), 4)}; original units ÷ ${n(sdj, 4)} = <b>${n(Math.sqrt(nwv) / sdj, 4)}</b>.`; }
      if (P.cl && c.d.group) { const G = new Map(); P.tr.forEach((i, k) => { const gid = c.d.group[i]; G.set(gid, (G.get(gid) || { n: 0, u: 0 })); const o = G.get(gid); o.n++; o.u += a[k] * e[k]; });
        const gs = [...G.entries()], Gn = gs.length, kc = Gn / (Gn - 1) * (N - 1) / (N - p), su = sum(gs.map(([, o]) => o.u * o.u)), clv2 = kc * su;
        clHtml = `<b>Clustered</b> lets every pair of rows in the same group be correlated: add up aᵢeᵢ within each group first, then square the group totals.` +
          T(['group', 'rows', 'Σ aᵢeᵢ in group', 'squared'], gs.map(([gid, o]) => [c.d.groupNames?.[gid] ?? String(gid), o.n, o.u, o.u * o.u]), { label: '#', total: ['Σ', '', '', '', su] }) +
          `Small-sample factor G/(G − 1) × (N − 1)/(N − p) = ${Gn}/${Gn - 1} × ${N - 1}/${N - p} = ${n(kc, 4)}. Var = ${n(kc, 4)} × ${n(su, 6)} = ${n(clv2, 6)}; SE(w̃ⱼ) = ${n(Math.sqrt(clv2), 4)}; original units = <b>${n(Math.sqrt(clv2) / sdj, 4)}</b>.`; }
      return ex(`The ${g('se', 'standard error')} says how much the coefficient would wobble if the data were collected again. The key fact: the estimate is a <i>weighted sum of the y values</i>, w̃ⱼ = Σᵢ aᵢyᵢ, with weights aᵢ = [(X̃ᵀX̃)⁻¹x̃ᵢ]ⱼ that depend only on x. So its variance is Σ aᵢ² Var(εᵢ) plus covariance terms. The four standard errors differ only in what they assume about Var(εᵢ) and the covariances. Each is a ${g('sandwich', 'sandwich')} with a different "meat". <b>Classical</b>: every row has the same variance σ² and no covariances. <b>HC1</b>: each row has its own variance, estimated by its own eᵢ². <b>Newey–West</b>: also covariances between nearby rows. <b>Clustered</b>: also covariances within a group.`,
        'w̃ⱼ = Σᵢ aᵢyᵢ,  aᵢ = [(X̃ᵀX̃)⁻¹x̃ᵢ]ⱼ.   Classical: Var = s² Σaᵢ² = s²[(X̃ᵀX̃)⁻¹]ⱼⱼ.   HC1: Var = N/(N − p) · Σ aᵢ²eᵢ².   Original units: SE(wⱼ) = SE(w̃ⱼ) / sⱼ',
        ol([
          `Compute each training row's weight aᵢ (how much its y moves the ${P.names[j]} coefficient), then the pieces both formulas need.` +
            T(['aᵢ', 'eᵢ', 'eᵢ²', 'aᵢ²', 'aᵢ² · eᵢ²'], a.map((v, i) => [v, e[i], e[i] ** 2, v * v, v * v * e[i] ** 2]), { label: 'train row', total: ['Σ', '', '', '', sa2, hc0] }) + `Check: Σaᵢ² = ${n(sa2, 6)} equals [(X̃ᵀX̃)⁻¹]ⱼⱼ = ${n(f.inv[j][j], 6)}.`,
          `<b>Classical</b>: Var = s² × Σaᵢ² = ${n(f.s2, 4)} × ${n(sa2, 6)} = ${n(clv, 6)}; SE(w̃ⱼ) = √${n(clv, 6)} = ${n(Math.sqrt(clv), 4)}. ${P.names[j]} was divided by sⱼ = ${n(sdj, 4)} in step 5, so in original units SE = ${n(Math.sqrt(clv), 4)} / ${n(sdj, 4)} = <b>${n(Math.sqrt(clv) / sdj, 4)}</b>.`,
          `<b>HC1</b>: replace the common s² by each row's own eᵢ²: Σaᵢ²eᵢ² = ${n(hc0, 6)} (HC0). Multiply by N/(N − p) = ${N}/${N - p} = ${n(kf, 4)} to correct for fitting: Var = ${n(hcv, 6)}; SE(w̃ⱼ) = ${n(Math.sqrt(hcv), 4)}; original units = <b>${n(Math.sqrt(hcv) / sdj, 4)}</b>.`,
          nwHtml, clHtml
        ]),
        'Same estimate, different uncertainty. If a robust SE is much bigger than the classical one, the classical SE is overconfident for this data. If they agree, the extra assumptions were harmless.',
        { qa: [['Do robust SEs change the coefficients?', 'No. They only change the uncertainty attached to them, so t, p and the CI change, but ŵ does not.'],
          ['HC0, HC1, HC2, HC3?', 'HC0 uses eᵢ² as is. HC1 multiplies by N/(N − p). HC2 and HC3 divide each eᵢ² by (1 − hᵢ) or (1 − hᵢ)², inflating high-leverage rows whose residuals are artificially small. HC3 is preferred in small samples.'],
          ['How is the Newey–West lag chosen?', 'A rule such as floor(4(N/100)^(2/9)) grows slowly with N. Too small misses longer correlations; too large adds noise. The Bartlett weights make the estimate positive.'],
          ['When do clustered SEs work?', 'They need many clusters (roughly 30–50 or more), because the variance is estimated from the cluster totals. With few clusters use a wild cluster bootstrap.'],
          ['Why is Var(w̃ⱼ) = σ²[(XᵀX)⁻¹]ⱼⱼ classically?', 'ŵ = (XᵀX)⁻¹Xᵀy, so Var(ŵ) = (XᵀX)⁻¹Xᵀ Var(y) X(XᵀX)⁻¹. With Var(y) = σ²I that collapses to σ²(XᵀX)⁻¹.']] }); },
    c => { const j = c.focus, f = c.P.f; if (!isFinite(f.se[j])) return ex('Not defined without an inverse.', '—', '—', '—');
      const w = c.P.wOrig[j], se = c.P.seOrig[j], tr = c.d.truth.coef[j], lo = w - f.tc * se, hi = w + f.tc * se;
      const zApprox = erfc(Math.abs(f.t[j]) / Math.SQRT2);
      return ex(`The t-statistic asks: <i>how many standard errors is the estimate away from 0?</i> If the true slope were 0, estimates would scatter around 0 with spread SE, so |t| above about 2 would be rare. The ${g('pvalue')} is the exact probability of |t| at least this large under that null, using the ${g('tdist', 't distribution')} with N − p ${g('df', 'degrees of freedom')}. The t distribution is used instead of the normal because the SE itself was estimated. The ${g('ci', '95% confidence interval')} turns the same idea around: it lists every slope value that would <i>not</i> be rejected.`,
        't = ŵⱼ / SE(ŵⱼ),   p = 2 · P(T_{N−p} ≥ |t|),   CI = ŵⱼ ± t_crit · SE,   t_crit: P(|T_{N−p}| ≥ t_crit) = 0.05',
        ol([`t = ${n(w, 4)} / ${n(se, 4)} = <b>${n(f.t[j], 3)}</b> (the same ratio on the standardised scale).`,
          `Degrees of freedom: N − p = ${c.P.nTr} − ${f.rank} = ${f.df}.`,
          `p-value = 2 × (area of the t(${f.df}) curve beyond ${n(Math.abs(f.t[j]), 3)}): <b>${pEq(f.pv[j])}</b>. (A normal-curve approximation gives ${pEq(zApprox)}; they agree when df is large.) It is computed with the regularised incomplete beta function, the exact formula for the t tail.`,
          `t_crit: the value with 2.5% in each tail of t(${f.df}) = ${n(f.tc, 4)} (the normal curve would give 1.96).`,
          `CI = ${n(w, 4)} ± ${n(f.tc, 4)} × ${n(se, 4)} = ${n(w, 4)} ± ${n(f.tc * se, 4)} = [<b>${n(lo, 3)}</b>, <b>${n(hi, 3)}</b>].`,
          tr != null ? `True slope (known from the simulation): ${tr}. It ${lo <= tr && tr <= hi ? 'lies inside' : 'lies outside'} this interval. Across many samples a valid 95% CI should contain it 95% of the time: the sampling-distribution chart shows the actual coverage.` : ''])
          + decide(f.pv[j], Math.abs(f.t[j]), f.tc, '|t|', 'the slope is distinguishable from 0.', 'the data are consistent with a zero slope.'),
        `A tiny p says the slope is distinguishable from 0. It does not say the effect is large, the model is right, or the CI trustworthy: those depend on the assumptions checked in step 10.`,
        { hyp: H('the true coefficient βⱼ = 0 (this feature has no linear effect, holding the others fixed).', 'βⱼ ≠ 0.'),
          qa: [['What exactly is a p-value?', 'P(data at least this extreme | H₀ true). It is not the probability that H₀ is true, and 1 − p is not the probability the effect is real.'],
            ['CI and test, how are they linked?', 'A 95% CI excludes 0 exactly when the two-sided test rejects at 5%. More generally it contains every value β₀ that a test of βⱼ = β₀ would not reject.'],
            ['Why t and not normal?', 'Because σ² was replaced by its estimate s². That extra uncertainty fattens the tails; with normal errors the ratio follows t(N − p) exactly.'],
            ['Statistically significant vs important?', 'With huge N a tiny, useless effect gets p ≈ 0. Report the effect size and its CI, not just p.'],
            ['Many coefficients tested?', 'Each has a 5% false-alarm rate, so with 20 tests about one is "significant" by chance. Use an F test for joint questions, or a multiple-testing correction (Bonferroni, Holm, FDR).']] }); },
    c => { const f = c.P.f, N = c.P.nTr, q = f.rank - 1, d2 = N - f.rank;
      if (q < 1) return ex('No slopes to test.', '—', '—', '—');
      const y = c.P.ytr, ym = mean(y), SSEw = f.SSE, SSEo = f.SST, F = ((SSEo - SSEw) / q) / (SSEw / d2), p = ST.fSF(F, q, d2), Fc = fCrit(q, d2), R2 = 1 - SSEw / SSEo, adj = 1 - (1 - R2) * (N - 1) / d2;
      return ex(`The overall F test asks: <i>do the features, taken together, explain anything at all?</i> It is the same ${g('nested', 'restricted vs unrestricted')} comparison as RESET. The "without" model has no features at all, only an intercept, so it predicts ȳ for every row and its SSE is SST = Σ(y − ȳ)². The "with" model is the fitted regression. If the features are useless, the drop in SSE per feature is about the size of the noise, and F ≈ 1.`,
        'F = [ (SSE_without − SSE_with) / q ] / [ SSE_with / (N − p) ],  SSE_without = SST,  q = p − 1.   Equivalently F = (R² / q) / ((1 − R²) / (N − p))',
        ol([`Without features the prediction is ȳ = ${n(ym, 4)} for every row.` + T(['y', 'y − ȳ', '(y − ȳ)²', 'e (with)', 'e²'], y.map((v, i) => [v, v - ym, (v - ym) ** 2, f.e[i], f.e[i] ** 2]), { label: 'train row', total: ['Σ', '', '0', SSEo, '', SSEw] }) +
            `<b>SSE_without</b> = SST = <b>${n(SSEo, 4)}</b>; <b>SSE_with</b> = <b>${n(SSEw, 4)}</b>.`,
          `Drop: SSE_without − SSE_with = ${n(SSEo, 4)} − ${n(SSEw, 4)} = ${n(SSEo - SSEw, 4)}. Per feature (q = ${q}): ${n((SSEo - SSEw) / q, 4)}.`,
          `Noise per degree of freedom: ${n(SSEw, 4)} / ${d2} = ${n(SSEw / d2, 4)} (= s²).`,
          `F = ${n((SSEo - SSEw) / q, 4)} / ${n(SSEw / d2, 4)} = <b>${n(F, 3)}</b>.${q === 1 && isFinite(f.t[1]) ? ` With a single feature F = t² = ${n(f.t[1], 3)}² = ${n(f.t[1] ** 2, 3)}.` : ''}`,
          `Against F(${q}, ${d2}): 5% critical value ${n(Fc, 3)}, <b>${pEq(p)}</b>.`,
          `The same sums give the training R² = 1 − ${n(SSEw, 4)} / ${n(SSEo, 4)} = <b>${n(R2, 4)}</b>, and adjusted R² = 1 − (1 − R²)(N − 1)/(N − p) = <b>${n(adj, 4)}</b>, which charges for each extra coefficient.`])
          + decide(p, F, Fc, 'F', 'the features jointly explain a real share of y.', 'the model is no better than predicting the mean.'),
        'The overall F test can be significant while no single t test is (multicollinearity: together they matter, but credit cannot be split), and vice versa with many useless features.',
        { hyp: H('all slope coefficients are 0: β₁ = … = β_{p−1} = 0.', 'at least one is not 0.'),
          qa: [['F vs t?', 'A t test checks one coefficient; F checks several jointly. For one coefficient F = t².'],
            ['R² vs adjusted R²?', 'R² never decreases when a feature is added. Adjusted R² can, because it divides SSE and SST by their degrees of freedom.'],
            ['General nested F test?', 'Any "do these k extra terms help?" question: F = ((SSE_r − SSE_u)/k) / (SSE_u/(N − p_u)). RESET, adding a block of dummies and Chow tests are all this formula.']] }); },
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
        `Test mean ȳ = ${n(m)}.` + T(['y', 'y − ȳ', '(y − ȳ)²', 'e', 'e²'], y.map((v, i) => [v, v - m, (v - m) ** 2, c.P.ete[i], c.P.ete[i] ** 2]), { k: 12, label: 'test row', total: ['Σ', '', '0', sst, '', sse] }) +
        `SST = ${n(sst, 3)} (error of always guessing ȳ), SSE = ${n(sse, 3)} (error of the model). R² = 1 − ${n(sse, 3)} / ${n(sst, 3)} = <b>${n(1 - sse / sst, 3)}</b>`,
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
  /* ---------------- Step 10: every diagnostic in full ---------------- */
  function E10(){
    const unavailable = why => ex(why, '—', '—', '—');
    return [
    /* ---- Ramsey RESET ---- */
    c => { const P = c.P, f = P.f, X = P.Xtr, y = P.ytr, N = X.length;
      if (!P.dg?.reset) return unavailable('RESET needs more training rows than coefficients + 3.');
      const yh = f.yhat, m = mean(yh), s = ST.sd(yh) || 1, z = yh.map(v => (v - m) / s);
      const ua = ST.ols(X.map((r, i) => [...r, z[i] ** 2, z[i] ** 3]), y, true);
      const q = ua.rank - f.rank, d2 = N - ua.rank, SSEr = f.SSE, SSEu = ua.SSE, drop = SSEr - SSEu, F = (drop / q) / (SSEu / d2), p = ST.fSF(F, q, d2), Fc = fCrit(q, d2);
      return ex(`Ramsey RESET asks: <i>is a straight line the right shape?</i> If the true relationship bends, the model's errors will follow a pattern that the squares and cubes of the predictions can pick up. So fit the model twice. Once as it is (the ${g('nested', 'restricted model')}, "without" the extra terms), and once with ŷ² and ŷ³ added (the unrestricted model, "with"). The bigger model always has a smaller SSE, even on pure noise, so the question is whether the drop is <i>bigger than noise would give</i>. The F statistic answers that. It divides the drop per added column by the noise variance per remaining ${g('df', 'degree of freedom')}. If the line is right, both estimate the same noise variance, so F is about 1.`,
        'F = [ (SSE_without − SSE_with) / q ] / [ SSE_with / (N − p − q) ],  q = 2 added columns,  compared with F(q, N − p − q)',
        ol([
          `Fit the current model (the "without" model) and square its residuals: <b>SSE_without</b> = Σ e² = <b>${n(SSEr, 4)}</b>.`,
          `Make the two new columns from the predictions. ŷ is first standardised, z = (ŷ − ${n(m)}) / ${n(s)}, so its powers stay a sensible size. Rescaling a column does not change the fit, so the test is unaffected. Plain ŷ cannot be added: it is already an exact combination of the columns of X̃, which would make X̃ rank-deficient.` +
            T(['ŷ', 'z', 'z²', 'z³', 'e without', 'e with', 'e² without', 'e² with'], X.map((_, i) => [yh[i], z[i], z[i] ** 2, z[i] ** 3, f.e[i], ua.e[i], f.e[i] ** 2, ua.e[i] ** 2]), { label: 'train row', total: ['Σ', '', '', '', '', n(sum(f.e), 4), n(sum(ua.e), 4), SSEr, SSEu] }),
          `Fit y on [${P.names.join(', ')}, z², z³] (the "with" model). Its coefficients are ${vec(ua.w, 4)}, and <b>SSE_with</b> = <b>${n(SSEu, 4)}</b> (last column).`,
          `Drop in error from the extra columns: SSE_without − SSE_with = ${n(SSEr, 4)} − ${n(SSEu, 4)} = <b>${n(drop, 4)}</b>. Per added column: ${n(drop, 4)} / ${q} = <b>${n(drop / q, 4)}</b>.`,
          `Noise level from the bigger model: SSE_with / (N − p − q) = ${n(SSEu, 4)} / (${N} − ${f.rank} − ${q}) = ${n(SSEu, 4)} / ${d2} = <b>${n(SSEu / d2, 4)}</b>.`,
          `F = ${n(drop / q, 4)} / ${n(SSEu / d2, 4)} = <b>${n(F, 3)}</b>${Math.abs(F - P.dg.reset.F) < 1e-6 ? ' (matches the value shown above)' : ''}.`,
          `Compare with the ${g('fdist', 'F distribution')} with (${q}, ${d2}) degrees of freedom. Its 5% ${g('crit', 'critical value')} is ${n(Fc, 3)}. The ${g('pvalue')} is the area to the right of ${n(F, 3)}: <b>${pEq(p)}</b>.`
        ]) + decide(p, F, Fc, 'F', 'the squares and cubes of ŷ explain real structure, so the straight line is the wrong shape (or something correlated with ŷ² is missing).', 'adding curvature in ŷ does not help by more than chance, so there is no evidence of a wrong functional form.'),
        `F ≈ 1: the extra columns only fitted noise. F well above the critical value: real curvature. RESET says <i>that</i> the form is wrong, not <i>how</i>; the residual-versus-x plot shows the how.`,
        { hyp: H('the coefficients on ŷ² and ŷ³ are both 0: the linear form is adequate.', 'at least one is not 0: some non-linearity (or an omitted interaction) is present.'),
          pit: 'It assumes independent, constant-variance errors (it is a classical F test), so autocorrelation or heteroscedasticity can make it fire falsely. Because it only looks in the direction of ŷ, it can miss curvature in a feature that barely affects ŷ. With large N it flags tiny, harmless bends.',
          qa: [
            ['Why add ŷ² and ŷ³ instead of x²?', 'One combined index works for any number of features while spending only 2 degrees of freedom. Adding the square of every feature, plus cross-products, would use many more.'],
            ['Why an F test and not two t tests?', 'The question is joint: are both extra coefficients zero together? Separate t tests would inflate the false-alarm rate and ignore the correlation between z² and z³.'],
            ['Where else does this F formula appear?', 'It is the general nested-model F test. The overall F test in step 11 uses it with the intercept-only model as the "without" model, and adding any block of features is tested the same way.'],
            ['RESET rejects. What next?', 'Plot residuals against each feature to find the bend. Then try a log transform, polynomial or spline terms, or interactions, refit and re-test. Coefficients from a misspecified model answer the wrong question.'],
            ['Can the SSE ever go up when columns are added?', 'No. The bigger model can always set the new coefficients to 0 and reproduce the smaller one, so SSE_with ≤ SSE_without. That is exactly why the drop must be compared with noise.']
          ] }); },

    /* ---- Breusch–Pagan (Koenker) ---- */
    c => { const P = c.P, f = P.f, X = P.Xtr, N = X.length;
      if (!P.dg?.bp) return unavailable('Breusch–Pagan needs at least one feature and more rows than coefficients.');
      const e2 = f.e.map(v => v * v), aux = ST.ols(X, e2, true), me2 = mean(e2), k = aux.rank - 1, LM = N * aux.R2, p = ST.chi2SF(LM, k), cc = chiCrit(k);
      return ex(`Breusch–Pagan asks: <i>does the spread of the errors change with x?</i> A squared residual e² is a rough, one-row estimate of the error variance at that row. If the variance is constant, x cannot predict e² any better than the average of e² does. If it grows (or shrinks) with x, a regression of e² on x will find that. So run that ${g('aux', 'auxiliary regression')} and measure how much of e² it explains with its R². N × R² follows a ${g('chi2', 'chi-square')} distribution when the null is true, which gives a p-value.`,
        'Regress e² on X̃:  e²ᵢ = γ₀ + γ₁x̃ᵢ₁ + … + uᵢ.   R²_aux = 1 − SSE_aux / SST_aux.   LM = N · R²_aux,  compared with χ²(p − 1)',
        ol([
          `Square every training residual. The average squared residual is mean(e²) = ${n(me2, 4)}: this is the "constant variance" guess.`,
          `Regress e² on the same columns [${P.names.join(', ')}]. The fitted line is ê² = ${aux.w.map((w, j) => j ? `${n(w, 4)}·x̃_${P.names[j]}` : n(w, 4)).join(' + ')}.` +
            T(['e', 'e²', 'fitted ê²', '(e² − mean)²', '(e² − ê²)²'], X.map((_, i) => [f.e[i], e2[i], aux.yhat[i], (e2[i] - me2) ** 2, (e2[i] - aux.yhat[i]) ** 2]), { label: 'train row', total: ['Σ', '', n(sum(e2), 3), n(sum(aux.yhat), 3), aux.SST, aux.SSE] }),
          `SST_aux = Σ (e² − mean)² = ${n(aux.SST, 4)}: the total variation of e². SSE_aux = Σ (e² − ê²)² = ${n(aux.SSE, 4)}: what x leaves unexplained.`,
          `R²_aux = 1 − ${n(aux.SSE, 4)} / ${n(aux.SST, 4)} = <b>${n(aux.R2, 5)}</b>: x explains ${n(100 * aux.R2, 2)}% of the variation in e².`,
          `LM = N × R²_aux = ${N} × ${n(aux.R2, 5)} = <b>${n(LM, 3)}</b>.`,
          `Degrees of freedom = number of slope terms in the auxiliary regression = ${k}. The 5% critical value of χ²(${k}) is ${n(cc, 3)}, and p = P(χ²(${k}) ≥ ${n(LM, 3)}) : <b>${pEq(p)}</b>.`
        ]) + decide(p, LM, cc, 'LM', 'x predicts the size of the squared errors, so the variance is not constant (heteroscedasticity). Use robust (HC) standard errors.', 'the squared residuals show no linear trend in x, so constant variance is plausible.'),
        'A slope γ₁ > 0 means the errors fan out as x grows; γ₁ < 0 means they tighten. The coefficients stay unbiased either way: only the standard errors and intervals are affected.',
        { hyp: H('Var(εᵢ) is the same for every row (homoscedasticity): γ₁ = … = 0.', 'the variance depends linearly on the features.'),
          pit: 'It only detects variance that changes <i>linearly</i> with the included columns. A funnel driven by a group label or by x² can slip through (see the "variance by group" variant), and the White test adds squares and cross-products to catch those. A wrong functional form also leaves a pattern in e², so a RESET failure can trigger BP too.',
          qa: [
            ['Why N · R²?', 'It is a Lagrange-multiplier (score) test. Under H₀, N·R² of the auxiliary regression is approximately χ² with as many degrees of freedom as slope terms. It is the same idea as the overall F test of the auxiliary regression.'],
            ['Original Breusch–Pagan vs the Koenker version?', 'The original divides e² by σ̂² and uses half the explained sum of squares, which is valid only if the errors are normal. Koenker\'s studentised N·R² version, used here, stays valid for non-normal errors.'],
            ['What changes if heteroscedasticity is present?', 'OLS is still unbiased but no longer the most efficient, and the classical SE formula is wrong. The fixes are HC (sandwich) standard errors, weighted least squares if you know the variance pattern, or a variance-stabilising transform such as log y.'],
            ['Breusch–Pagan vs White vs Goldfeld–Quandt?', 'BP: variance linear in the features. White: adds squares and cross-products, so it is more general but uses more degrees of freedom. Goldfeld–Quandt: sort by x, drop the middle, and compare the residual variance of the two ends with an F test.'],
            ['Why not just look at the residual plot?', 'Always do both. The plot shows the shape; the test puts a number on whether the pattern could be chance.']
          ] }); },

    /* ---- Durbin–Watson ---- */
    c => { const P = c.P, e = P.f.e, N = e.length, dif = e.slice(1).map((v, i) => v - e[i]), num_ = sum(dif.map(v => v * v)), den = sum(e.map(v => v * v));
      const lagp = sum(e.slice(1).map((v, i) => v * e[i])), r1 = lagp / den, a1 = sum(e.slice(1).map(v => v * v)), a2 = sum(e.slice(0, -1).map(v => v * v)), DW = num_ / den;
      return ex(`Durbin–Watson asks: <i>is each error related to the one just before it?</i> If errors drift slowly (positive ${g('autocorr', 'autocorrelation')}), neighbours are similar, so their differences are small. If they alternate sign, the differences are large. DW compares the squared neighbour differences with the squared residuals. For independent errors the differences are about √2 times as spread out as the residuals, so DW ≈ 2. It only makes sense when the row order means something, such as time. Here the training rows are kept in their original order.`,
        'DW = Σₜ₌₂ (eₜ − eₜ₋₁)² / Σₜ eₜ²  ≈  2 (1 − r₁),   r₁ = Σ eₜeₜ₋₁ / Σ eₜ²',
        ol([
          `Take the ${N} training residuals in row order and subtract each from the next.` +
            T(['eₜ', 'eₜ₋₁', 'eₜ − eₜ₋₁', '(eₜ − eₜ₋₁)²', 'eₜ · eₜ₋₁', 'eₜ²'], e.map((v, i) => [v, i ? e[i - 1] : '—', i ? v - e[i - 1] : '—', i ? (v - e[i - 1]) ** 2 : '—', i ? v * e[i - 1] : '—', v * v]), { label: 't', total: ['Σ', '', '', '', num_, lagp, den] }),
          `Numerator Σ (eₜ − eₜ₋₁)² = <b>${n(num_, 4)}</b>; denominator Σ eₜ² = <b>${n(den, 4)}</b>.`,
          `DW = ${n(num_, 4)} / ${n(den, 4)} = <b>${n(DW, 3)}</b>.`,
          `Why it sits near 2: expand the square. Σ(eₜ − eₜ₋₁)² = Σₜ₌₂ eₜ² + Σₜ₌₂ eₜ₋₁² − 2Σ eₜeₜ₋₁ = ${n(a1, 3)} + ${n(a2, 3)} − 2 × ${n(lagp, 3)} = ${n(a1 + a2 - 2 * lagp, 3)}. Divide by Σe²: about 1 + 1 − 2r₁.`,
          `Lag-1 autocorrelation r₁ = ${n(lagp, 4)} / ${n(den, 4)} = <b>${n(r1, 3)}</b>, so 2(1 − r₁) = ${n(2 * (1 - r1), 3)} ≈ DW.`
        ]) + `<p class="wdec ${DW > 1.5 && DW < 2.5 ? 'acc' : 'rej'}"><b>Decision (rule of thumb):</b> DW = ${n(DW, 2)} is ${DW > 1.5 && DW < 2.5 ? '<b>inside</b> 1.5–2.5, so there is no strong sign of lag-1 autocorrelation' : DW <= 1.5 ? '<b>below</b> 1.5, so neighbouring errors move together (positive autocorrelation). Use Newey–West SEs or model the time structure' : '<b>above</b> 2.5, so neighbouring errors alternate (negative autocorrelation)'}.</p>`,
        '0 to 4. About 2: independent. Toward 0: positive autocorrelation, the common case in time series, where classical SEs are too small. Toward 4: negative autocorrelation.',
        { hyp: H('no first-order autocorrelation, ρ = 0 in εₜ = ρεₜ₋₁ + uₜ.', 'ρ ≠ 0 (usually tested one-sided, ρ > 0).'),
          pit: 'The exact critical values (d_L, d_U) depend on X and leave an inconclusive zone between them, which is why a rule of thumb is shown. DW only sees lag 1, and it is invalid when a lagged y is a regressor (use Durbin\'s h or Breusch–Godfrey there). The 80/20 split removes some rows from the sequence, so the "neighbours" here can be two rows apart.',
          qa: [
            ['Why is DW about 2(1 − r₁)?', 'Expanding Σ(eₜ − eₜ₋₁)² gives two copies of roughly Σe² minus 2Σeₜeₜ₋₁. Divide by Σe²: 2 − 2r₁.'],
            ['Is DW meaningful for cross-sectional data?', 'Only if the row order carries meaning, such as space or time. Shuffle the rows and DW changes while the regression does not, so in a random order it tests nothing.'],
            ['What does autocorrelation do to OLS?', 'Coefficients stay unbiased (if the features are exogenous), but the classical SEs are wrong, usually too small under positive autocorrelation, so the t tests are overconfident.'],
            ['Remedies?', 'Newey–West (HAC) standard errors; GLS-style corrections such as Cochrane–Orcutt or Prais–Winsten; or adding lags or trends so the model captures the time structure.'],
            ['Higher-order autocorrelation?', 'Use Breusch–Godfrey (regress e on X and eₜ₋₁ … eₜ₋ₖ, then N·R² against χ²(k)) or Ljung–Box on the residuals.']
          ] }); },

    /* ---- Jarque–Bera ---- */
    c => { const P = c.P, e = P.f.e, N = e.length, m = mean(e), d = e.map(v => v - m), m2 = mean(d.map(v => v ** 2)), m3 = mean(d.map(v => v ** 3)), m4 = mean(d.map(v => v ** 4));
      const S = m3 / m2 ** 1.5, K = m4 / m2 ** 2, tS = N / 6 * S * S, tK = N / 24 * (K - 3) ** 2, JB = tS + tK, p = Math.exp(-JB / 2), cc = chiCrit(2);
      return ex(`Jarque–Bera asks: <i>do the residuals look like a bell curve?</i> Two numbers summarise a ${g('distribution')}'s shape. ${g('skew', 'Skewness')} S measures lopsidedness (0 for a bell). ${g('kurt', 'Kurtosis')} K measures tail heaviness (3 for a bell). Under normality, S has variance about 6/N and K about 24/N. So S²·N/6 and (K − 3)²·N/24 are each a squared z-score, and their sum follows ${g('chi2', 'χ²')} with 2 degrees of freedom. The test is run on the <i>residuals</i>, not on y.`,
        'S = m₃ / m₂^1.5,   K = m₄ / m₂²,   mₖ = mean of (e − ē)ᵏ.   JB = (N/6)·S² + (N/24)·(K − 3)²,   compared with χ²(2)',
        ol([
          `Centre the residuals (their mean is ${n(m, 6)}, essentially 0 because of the intercept), then raise them to the powers 2, 3 and 4.` +
            T(['d = e − ē', 'd²', 'd³', 'd⁴'], d.map(v => [v, v * v, v ** 3, v ** 4]), { label: 'train row', total: ['mean', n(mean(d), 4), m2, m3, m4] }),
          `Skewness S = m₃ / m₂^1.5 = ${n(m3, 4)} / ${n(m2, 4)}^1.5 = ${n(m3, 4)} / ${n(m2 ** 1.5, 4)} = <b>${n(S, 4)}</b>.`,
          `Kurtosis K = m₄ / m₂² = ${n(m4, 4)} / ${n(m2, 4)}² = ${n(m4, 4)} / ${n(m2 * m2, 4)} = <b>${n(K, 4)}</b> (excess kurtosis K − 3 = ${n(K - 3, 4)}).`,
          `Skewness part: (N/6)·S² = (${N}/6) × ${n(S, 4)}² = <b>${n(tS, 4)}</b>.  Kurtosis part: (N/24)·(K − 3)² = (${N}/24) × ${n(K - 3, 4)}² = <b>${n(tK, 4)}</b>.`,
          `JB = ${n(tS, 4)} + ${n(tK, 4)} = <b>${n(JB, 3)}</b>.`,
          `For χ²(2) the tail area has a closed form: p = e<sup>−JB/2</sup> = e<sup>−${n(JB / 2, 4)}</sup> : <b>${pEq(p)}</b>. The 5% critical value is ${n(cc, 3)}.`
        ]) + decide(p, JB, cc, 'JB', `the residuals are ${Math.abs(S) > 0.5 ? (S > 0 ? 'right-skewed' : 'left-skewed') : K > 3 ? 'heavy-tailed' : 'not bell-shaped'}, so exact small-sample t and F tests are approximate.`, 'skewness and kurtosis are close enough to 0 and 3 to be consistent with normal errors.'),
        `Large JB from S: lopsided errors. Large JB from (K − 3): heavy or light tails. Which part dominates tells you which (here ${tS > tK ? 'skewness' : 'kurtosis'}). Normality matters least of all the assumptions: OLS is still unbiased and BLUE, and with N in the dozens the central limit theorem keeps t intervals close to correct.`,
        { hyp: H('the errors are normally distributed (S = 0 and K = 3).', 'they are not.'),
          pit: 'JB is an asymptotic test with little power at small N, and at small N its p-values are not exact. At large N it rejects tiny, harmless departures. Shapiro–Wilk is more powerful in small samples, and a Q–Q plot shows where the departure is.',
          qa: [
            ['Does linear regression need normally distributed y or x?', 'Neither. The assumption is about the errors given x. y can be very non-normal because x is skewed while the errors are perfectly normal. Test the residuals.'],
            ['What do you lose without normal errors?', 'Only the exactness of small-sample t, F and prediction intervals. Unbiasedness, consistency and Gauss–Markov (BLUE) do not need normality, and in large samples the CLT makes the tests approximately right.'],
            ['Why 6/N and 24/N?', 'Those are the large-sample variances of the sample skewness and kurtosis under normality. Dividing by them turns S and K − 3 into z-scores; squaring and adding two gives χ²(2).'],
            ['Why is the p-value e^(−JB/2)?', 'The survival function of χ² with 2 degrees of freedom is exactly e^(−x/2).'],
            ['Errors are heavy-tailed. Now what?', 'Look for outliers (step 2, Cook\'s distance), consider a transform of y, use robust regression (Huber), or bootstrap the intervals.']
          ] }); },

    /* ---- VIF ---- */
    c => { const P = c.P, X = P.Xtr, N = X.length, f = P.f;
      if (P.P < 2) return unavailable('No features.');
      const parts = P.names.slice(1).map((nm, k) => { const j = k + 1, others = X.map(r => r.filter((_, q) => q !== j)), col = X.map(r => r[j]), aux = ST.ols(others, col, true), vif = aux.R2 >= 1 - 1e-10 ? Infinity : 1 / (1 - aux.R2);
        const onames = P.names.filter((_, q) => q !== j);
        return `<b>${nm}</b>: regress x̃_${nm} on [${onames.join(', ')}] → x̃_${nm} ≈ ${aux.w.map((w, q) => `${n(w, 4)}·${onames[q] === '1' ? '1' : 'x̃_' + onames[q]}`).join(' + ')}. SST = Σ(x̃ − mean)² = ${n(aux.SST, 3)}, SSE = ${n(aux.SSE, 4)}, so R²ⱼ = 1 − ${n(aux.SSE, 4)} / ${n(aux.SST, 3)} = ${n(aux.R2, 5)}, and VIF = 1 / (1 − ${n(aux.R2, 5)}) = <b>${isFinite(vif) ? n(vif, 3) : '∞'}</b>.` +
          (isFinite(vif) && f.inv ? ` Check: N × [(X̃ᵀX̃)⁻¹]ⱼⱼ = ${N} × ${n(f.inv[j][j], 6)} = ${n(N * f.inv[j][j], 3)} (standardised features make the two equal). The SE of this coefficient is √VIF = ${n(Math.sqrt(vif), 3)} times what it would be with unrelated features.` : !isFinite(vif) ? ' The other columns reproduce it exactly, so its coefficient is not identifiable.' : '') +
          (P.P === 2 ? ` With one feature the "others" are just the intercept: the best prediction is the mean (0 after standardising), so SSE = SST, R² = 0 and VIF = 1.` : ''); });
      const vmax = Math.max(...P.dg.vif);
      return ex(`The variance inflation factor asks: <i>how much of this feature can the other features already predict?</i> Run an ${g('aux', 'auxiliary regression')} of feature j on all the other features. If they predict it well (R²ⱼ near 1), the feature brings little new information. The data then cannot tell its effect apart from theirs, and its coefficient's variance is multiplied by 1/(1 − R²ⱼ). y plays no part in this.`,
        'VIFⱼ = 1 / (1 − R²ⱼ),   R²ⱼ from regressing xⱼ on the other features.   Var(ŵⱼ) = σ² / [ Σ(xᵢⱼ − x̄ⱼ)² ] × VIFⱼ',
        ol(parts) + `<p class="wdec ${vmax <= 5 ? 'acc' : 'rej'}"><b>Decision (rule of thumb):</b> largest VIF = ${isFinite(vmax) ? n(vmax, 2) : '∞'}: ${vmax <= 5 ? 'below 5, no worrying overlap' : vmax <= 10 ? 'between 5 and 10, noticeable overlap; individual coefficients are imprecise' : 'above 10 (or infinite), serious multicollinearity; individual coefficients cannot be trusted'}.</p>`,
        'VIF = 1: the feature is unrelated to the others. 4: its SE is doubled (√4). 10: its SE is about 3.2 times larger. Predictions inside the data range are unaffected; only the split of credit between features is.',
        { hyp: 'Not a hypothesis test: a descriptive measure with rules of thumb (5 and 10). Tolerance = 1/VIF is the same idea reported the other way up.',
          pit: 'Pairwise correlations can all look moderate while three features together are nearly dependent; VIF catches that because it uses all the others at once. Polynomial and interaction terms have built-in VIF that centring removes. A high VIF on control variables you do not interpret is harmless.',
          qa: [
            ['What does multicollinearity do to OLS?', 'Coefficients stay unbiased but their variance grows by VIF, so estimates swing between samples, signs can flip, and individual t tests lose power. The overall F test and the predictions stay fine.'],
            ['VIF vs the correlation matrix?', 'The correlation matrix only shows pairs. VIF is 1/(1 − R²) against all the others together, so it also detects a feature that is a combination of several. With exactly two features, R²ⱼ = r² and both VIFs equal 1/(1 − r²).'],
            ['VIF vs condition number?', 'VIF is per feature and says which coefficient suffers. The condition number κ of XᵀX is one number for the whole design and says whether any direction is badly determined.'],
            ['Remedies?', 'Drop or combine overlapping features, use PCA, apply ridge regression (it shrinks along the poorly determined directions), centre before making polynomials, or collect more varied data.'],
            ['VIF is infinite. Why?', 'Some feature is an exact combination of the others (e.g. all dummies kept with an intercept). Then XᵀX is singular and there is no unique solution.']
          ] }); },

    /* ---- Cook's distance ---- */
    c => { const P = c.P, f = P.f, X = P.Xtr, N = X.length;
      if (!f.cook) return unavailable("Cook's distance needs (X̃ᵀX̃)⁻¹, which does not exist for this data.");
      const p = f.rank, s = Math.sqrt(f.s2), k = f.cook.reduce((b, v, i) => v > f.cook[b] ? i : b, 0), xk = X[k], vk = LA.mv(f.inv, xk), hk = LA.dot(xk, vk), rk = f.e[k] / (s * Math.sqrt(1 - hk));
      const order = [...f.cook.keys()].sort((a, b) => f.cook[b] - f.cook[a]), cut = 4 / N, nAbove = f.cook.filter(v => v > cut).length;
      const top = T(['orig. row', 'e', 'h', 'r = e / (s√(1 − h))', 'D'], order.slice(0, 6).map(i => [P.tr[i] + 1, f.e[i], f.lev[i], f.e[i] / (s * Math.sqrt(1 - f.lev[i])), f.cook[i]]), { k: 6, label: 'rank' });
      return ex(`Cook's distance asks: <i>if this single row were deleted, how far would all the predictions move?</i> A row is influential when two things happen together. It is badly fitted (a big residual e), and it has high ${g('leverage')} h: its x values are far from the centre, so the line is pulled toward it. A badly fitted row near the centre of x, or an unusual-x row that sits right on the line, moves little.`,
        'hᵢ = x̃ᵢᵀ (X̃ᵀX̃)⁻¹ x̃ᵢ,   rᵢ = eᵢ / (s√(1 − hᵢ)),   Dᵢ = (rᵢ² / p) · hᵢ / (1 − hᵢ) = eᵢ² / (p s²) · hᵢ / (1 − hᵢ)²',
        ol([
          `Take the most influential training row (original row ${P.tr[k] + 1}). Its standardised features are x̃ = ${vec(xk, 4)}. Its residual is e = ${n(f.e[k], 4)}.`,
          `Leverage: first (X̃ᵀX̃)⁻¹x̃ = ${vec(vk, 6)}, then h = x̃ · that = ${xk.map((v, j) => `${n(v, 3)} × ${n(vk[j], 5)}`).join(' + ')} = <b>${n(hk, 4)}</b>.${P.P === 2 ? ` With one standardised feature this reduces to h = 1/N + x̃²/N = 1/${N} + ${n(xk[1], 3)}²/${N} = ${n(1 / N + xk[1] ** 2 / N, 4)}.` : ''} The average leverage is p/N = ${p}/${N} = ${n(p / N, 4)}, and all leverages add to p: Σh = ${n(sum(f.lev), 3)}.`,
          `Studentised residual: r = e / (s√(1 − h)) = ${n(f.e[k], 4)} / (${n(s, 4)} × √(1 − ${n(hk, 4)})) = <b>${n(rk, 3)}</b>. Dividing by √(1 − h) undoes the way a high-leverage row pulls the line toward itself and hides its own residual.`,
          `D = (r² / p) × h / (1 − h) = (${n(rk, 3)}² / ${p}) × ${n(hk, 4)} / ${n(1 - hk, 4)} = <b>${n(f.cook[k], 4)}</b>.`,
          `The six largest, for comparison:` + top
        ]) + `<p class="wdec ${f.cook[k] < 1 ? 'acc' : 'rej'}"><b>Decision (rules of thumb):</b> largest D = ${n(f.cook[k], 3)} ${f.cook[k] < 1 ? 'is below 1, so no single row dominates the fit' : 'is above 1, so this row alone is steering the fit'}. ${nAbove} row(s) exceed the stricter 4/N = ${n(cut, 3)}, which marks rows worth a look.</p>`,
        'Investigate influential rows (typo? different population? the most informative point?) rather than deleting them automatically. Refit without the row and see whether the conclusions change.',
        { hyp: 'Not a hypothesis test: a measure with cut-offs (1, or 4/N).',
          pit: 'Two influential rows next to each other can mask each other, because deleting either one leaves the other still pulling the line. Leverage depends only on x, so a high-leverage row that fits well is "good leverage": it makes the slope more precise.',
          qa: [
            ['Outlier vs leverage vs influence?', 'Outlier: unusual y given x (large residual). Leverage: unusual x. Influence: actually changes the fit, which needs both, and Cook\'s D combines them.'],
            ['Where does the Cook formula come from?', 'D = Σⱼ (ŷⱼ − ŷⱼ₍ᵢ₎)² / (p s²): the squared shift of every prediction when row i is deleted, in units of p s². Algebra turns it into the e, h form without refitting N times.'],
            ['What range does leverage take?', 'Between 1/N (with an intercept) and 1. The leverages add up to p, so the average is p/N, and rows above 2p/N or 3p/N are called high leverage.'],
            ['Related measures?', 'DFFITS (change in a row\'s own prediction), DFBETAS (change in each coefficient), and studentised deleted residuals for outlier tests.'],
            ['What to do with an influential row?', 'Check it for errors first. If it is genuine, report results with and without it, or use robust regression (Huber, M-estimators) that down-weights large residuals.']
          ] }); }
    ];
  }

  return E;
})();
