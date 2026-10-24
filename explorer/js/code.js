/* ============================================================
   Code: the whole process in Python with standard libraries
   (pandas, NumPy, SciPy, statsmodels, scikit-learn), step by step
   in the same order as the Process view. Regenerated for the
   selected variant: feature names, the split, the tests and the
   fix that variant needs, and every expected value from the app
   written as a comment. The current dataset (with the app's
   train/test split) can be downloaded, so the output matches.
   CODE.render(el, ctx) with ctx = { P, d, a, v, isBase, S, inf }.
   ============================================================ */
const CODE = (() => {
  const n = (v, d = 4) => !isFinite(v) ? 'nan' : num(v, d).replace('−', '-');
  const py = s => String(s).replace(/[₀-₉]/g, ch => '0123456789'['₀₁₂₃₄₅₆₇₈₉'.indexOf(ch)]);
  const L = a => '[' + a.map(v => n(v)).join(', ') + ']';
  const pv = p => !isFinite(p) ? 'nan' : p < 0.001 ? '< 0.001' : n(p, 3);
  const openSet = new Set(); let bound = false;

  function csv(c){
    const d = c.d, P = c.P, feats = d.names.slice(1).map(py), extra = [], rc = d.cat ? d.rawCat : null, txt = !rc && d.rawCat ? d.rawCat : null;
    // a categorical feature is written as it was recorded (text); the 0/1 columns are made in step 5
    const numJ = d.names.map((nm, j) => j).filter(j => j > 0 && !GEN.isCat(d.names[j])), num = numJ.map(j => py(d.names[j]));
    if (d.group && !d.cat) extra.push(c.v.id === 'cluster' ? 'cluster' : 'group');
    if (d.prep) extra.push('level');
    if (txt) extra.push(txt.name);
    // Feature engineering: the raw columns as collected, next to the columns step 5 built (raw_ prefix when the name differs)
    const rawJ = d.raw ? d.raw.names.map((nm, j) => j).filter(j => j > 0 && !d.names.includes(d.raw.names[j])) : [], rawN = rawJ.map(j => 'raw_' + py(d.raw.names[j]));
    const head = ['row', ...num, ...(rc ? [rc.name] : []), ...extra, ...rawN, ...(d.yRaw ? ['raw_y'] : []), 'y', 'set'];
    const rows = d.y.map((y, i) => [d.orig ? d.orig[i] + 1 : i + 1, ...numJ.map(j => +d.X[i][j].toFixed(8)), ...(rc ? [rc.vals[i]] : []), ...extra.map(e => e === 'level' ? d.prep.lev[i] + 1 : txt && e === txt.name ? txt.vals[i] : d.group[i]), ...rawJ.map(j => +d.raw.X[i][j].toFixed(8)), ...(d.yRaw ? [+d.yRaw[i].toFixed(8)] : []), +y.toFixed(8), P.isTrain[i] ? 'train' : 'test']);
    // rows whose y was never recorded (Missing data): kept in the file with an empty y, as they would arrive
    if (d.dropped) d.dropped.idx.forEach((i, k) => rows.push([i + 1, ...numJ.map(j => +d.dropped.X[k][j].toFixed(8)), ...(rc ? [''] : []), ...extra.map(() => ''), '', 'missing']));
    if (d.dropped) rows.sort((a, b) => a[0] - b[0]);
    return { text: [head.join(','), ...rows.map(r => r.join(','))].join('\n'), feats, extra, nMiss: d.dropped ? d.dropped.idx.length : 0, num, cat: rc ? rc.name : null, nCols: head.length, rawN };
  }

  /* step 5 for a Feature engineering variant: rebuild the app's columns from the raw ones with standard tools, and check they match */
  function feCode(c, { feats, py, n, L, mark }){
    const d = c.d, fe = d.fe, P = c.P, rx = d.raw ? 'raw_' + py(d.raw.names[1]) : null;
    const chk = (expr, col) => `print(np.allclose(${expr}, train["${col}"]))   # True: the same column the app built`;
    switch (fe.attr) {
      case 'xtransform': return fe.kind === 'none' ? '# Transform of x: none (x is used raw).' : fe.kind === 'log' ? `# Step 5 builds ln x from the raw x\n${chk(`np.log(train["${rx}"])`, py(fe.nm))}` : fe.kind === 'sqrt' ? `${chk(`np.sqrt(train["${rx}"])`, py(fe.nm))}` :
        `from sklearn.preprocessing import PowerTransformer\npt = PowerTransformer(method="${fe.kind === 'boxcox' ? 'box-cox' : 'yeo-johnson'}", standardize=False).fit(train[["${rx}"]])   # λ by maximum likelihood on the TRAINING rows\nprint(pt.lambdas_)                      # app: λ = ${n(fe.lam, 4)}${mark('the power is learned, like a mean')}\n${chk(`pt.transform(train[["${rx}"]]).ravel()`, py(fe.nm))}`;
      case 'ytransform': return fe.kind === 'none' ? '# Transform of y: none.' : fe.kind === 'log' ? `# The model is fitted to ln y (the column y in the file); raw_y is the original\n${chk('np.log(train["raw_y"])', 'y')}\n# In a pipeline: from sklearn.compose import TransformedTargetRegressor\n# TransformedTargetRegressor(regressor=LinearRegression(), func=np.log, inverse_func=np.exp)` :
        `from scipy import stats\nz, lam = stats.boxcox(train["raw_y"])   # λ by maximum likelihood on the TRAINING y\nprint(lam)                              # app: λ = ${n(fe.lam, 4)}\n${chk('z', 'y')}`;
      case 'degree': return `from sklearn.preprocessing import PolynomialFeatures
zs = StandardScaler().fit(train[["${rx}"]])            # z = (x - mean) / sd from the TRAINING rows: app mean ${n(fe.zm, 4)}, sd ${n(fe.zs, 4)}
poly = PolynomialFeatures(degree=${fe.kind}, include_bias=False)
print(np.allclose(poly.fit_transform(zs.transform(train[["${rx}"]])), train[${'[' + feats.slice(0, fe.kind).map(x => `"${x}"`).join(', ') + ']'}]))   # True: z, z², … as in the app
# in a pipeline: make_pipeline(StandardScaler(), PolynomialFeatures(${fe.kind}, include_bias=False), StandardScaler(), LinearRegression())`;
      case 'interactions': return fe.kind === 'none' ? '# No interaction column.' : `${chk('train["x1"] * train["x2"]', 'x1·x2')}\n# or PolynomialFeatures(degree=2, interaction_only=True, include_bias=False)`;
      case 'splines': return !fe.knots.length ? '# No knots: x only.' : fe.knots.map((k, q) => chk(`np.maximum(0, train["x"] - ${k})`, 'h' + (q + 1))).join('\n') + '\n# smooth version: from sklearn.preprocessing import SplineTransformer';
      case 'binning': return !fe.edges ? '# x used as a number.' : `from sklearn.preprocessing import KBinsDiscretizer\nkb = KBinsDiscretizer(n_bins=5, encode="onehot-dense", strategy="${fe.kind === 'width' ? 'uniform' : 'quantile", quantile_method="linear'}").fit(train[["${rx}"]])\nprint(kb.bin_edges_[0])                 # app: ${L(fe.edges)}\nprint(np.allclose(kb.transform(train[["${rx}"]])[:, 1:], train[${'[' + P.names.filter(nm => nm.startsWith('bin_')).map(x => `"${x}"`).join(', ') + ']'}]))   # first bin dropped (reference)`;
      case 'encoding': return fe.kind === 'ordinal' ? `from sklearn.preprocessing import OrdinalEncoder\noe = OrdinalEncoder(categories=[["East", "North", "South", "West"]]).fit(train[["region"]])\n${chk('oe.transform(train[["region"]]).ravel()', 'code(region)')}${mark('codes invent an order and equal steps')}` :
        fe.kind === 'target' ? `means = train.groupby("region")["y"].mean()   # learned on the TRAINING rows\nprint(means.round(4).to_dict())        # app: ${d.rawCat.levels.map((l, q) => `${l} ${n(fe.means[q], 4)}`).join(', ')}\n${chk('train["region"].map(means)', 'te(region)')}\n# test rows: test["region"].map(means); in a pipeline, sklearn.preprocessing.TargetEncoder cross-fits for you` : '# One-hot encoding: see below.';
      case 'centering': return fe.kind === 'centred' ? `xbar = train["${rx}"].mean()               # app: ${n(fe.c, 4)}\n${chk(`train["${rx}"] - xbar`, 'xc')}\n${chk(`(train["${rx}"] - xbar) ** 2`, 'xc²')}` : '# Raw x and x² (no centring, no scaling).';
      case 'selection': return `# Step 5 kept: ${P.names.slice(1).map(py).join(', ')} (${fe.kind} selection on the training rows; the other candidates are the raw_ columns)` + ({
        forward: '\n# scikit-learn: SequentialFeatureSelector(LinearRegression(), direction="forward", tol=...) chooses by cross-validated score, not p-values', backward: '\n# scikit-learn: SequentialFeatureSelector(LinearRegression(), direction="backward")',
        lasso: '\nfrom sklearn.linear_model import LassoCV\n# LassoCV(cv=5).fit(StandardScaler().fit_transform(Xall_tr), y_tr): keep the columns with coef_ != 0', vif: '\n# loop: compute variance_inflation_factor for every column, drop the largest while > 5', pvalue: '\n# sm.OLS(y_tr, sm.add_constant(Xall_tr)).fit().pvalues < 0.05', stepwise: '', all: '' }[fe.kind] || '');
    }
    return '';
  }
  /* scaling other than plain standardisation, and columns that are never scaled (0/1 bins) */
  function scaleCode(c, { py, L, mark }){
    const P = c.P, names = c.d.names, sc = names.slice(1).filter(nm => !GEN.noScale(nm)).map(py), kind = P.scale || 'std';
    const make = { std: 'StandardScaler()', minmax: 'MinMaxScaler()', robust: 'RobustScaler()', none: 'FunctionTransformer()   # identity: no scaling' }[kind];
    const st = names.map((nm, k) => k && !GEN.noScale(nm)), loc = P.mu.filter((_, k) => st[k]), scl = P.sd.filter((_, k) => st[k]);
    if (!sc.length) return `# Every column is a 0/1 column (bins or categories): nothing to scale
Xs_tr, Xs_te = X_tr.copy(), X_te.copy()`;
    return `from sklearn.preprocessing import MinMaxScaler, RobustScaler, FunctionTransformer
sc = ${'[' + sc.map(x => `"${x}"`).join(', ') + ']'}            # the columns that get scaled${names.some(GEN.noScale) ? ' (0/1 columns stay as they are)' : ''}
scaler = ${make}.fit(X_tr[sc])${mark(kind === 'std' ? 'standardisation' : kind === 'none' ? 'no scaling' : kind + ' scaling')}
${kind === 'minmax' ? `print(scaler.data_min_, scaler.data_range_)   # app: min ${L(loc)}, range ${L(scl)}` : kind === 'robust' ? `print(scaler.center_, scaler.scale_)          # app: median ${L(loc)}, IQR ${L(scl)}` : kind === 'std' ? `print(scaler.mean_, scaler.scale_)            # app: μ ${L(loc)}, s ${L(scl)}` : '# nothing to learn'}
Xs_tr, Xs_te = X_tr.copy(), X_te.copy()
Xs_tr[sc], Xs_te[sc] = scaler.transform(X_tr[sc]), scaler.transform(X_te[sc])`;
  }
  function cells(c){
    const { P, d, a, v, isBase } = c, f = P.f, dg = P.dg || {}, j = d.focus[0], names = d.names, { feats, extra, nMiss, num, cat, nCols } = csv(c);
    const F = cat ? `num + cat` : `[${feats.map(x => `"${x}"`).join(', ')}]`, rc = CHG.recipe(a, v).cur, aid = a.id, vid = v.id, grp = extra.find(e => e === 'group' || e === 'cluster');
    const dummy = !!d.rawCat?.keepAll, mark = s => `   # ← ${s}`, Q = a2 => `[${a2.map(x => `"${x}"`).join(', ')}]`;
    const lag = P.nw?.lag ?? Math.max(1, Math.floor(4 * (P.nTr / 100) ** (2 / 9)));
    const fe = feats.filter((x, k) => !GEN.isCat(names[k + 1]));
    const X0 = feats[0], others = fe.filter(x => x !== X0 && x !== 'group'), plus = others.length ? ' + ' + others.join(' + ') : '';
    const extraTxt = d.extra ? `\n#   plus ${d.extra} extra feature${d.extra > 1 ? 's' : ''} (${feats.slice(-d.extra).join(', ')}): each 10*u, independent, true coefficients ${'[' + GEN.EXTRA_BETA.slice(0, d.extra).join(', ') + ']'}` : '';
    const out = [];
    out.push({ id: 'setup', t: 'Setup: the libraries', code:
`# Linear regression, end to end, with standard libraries.
# Variant: ${a.name} › ${v.name}${isBase ? ' (baseline)' : ''}
# Download the dataset with the button above (dataset.csv): every
# number printed below should then match the app (the "# app:" comments).
import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm
import statsmodels.formula.api as smf
from statsmodels.stats.diagnostic import linear_reset, het_breuschpagan
from statsmodels.stats.stattools import durbin_watson, jarque_bera
from statsmodels.stats.outliers_influence import variance_inflation_factor, OLSInfluence
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression, SGDRegressor
from sklearn.pipeline import make_pipeline
from sklearn.metrics import mean_squared_error, r2_score` });

    out.push({ id: 1, t: 'Step 1: load the data', code:
`df = pd.read_csv("dataset.csv")                  # app: N = ${P.N + nMiss} rows${nMiss ? ` (${nMiss} of them without y)` : ''}
${cat ? `num = ${Q(num)}          # numeric features
cat = ["${cat}"]                     # a categorical feature, recorded as text (encoded in step 5)
` : ''}features = ${F}
X, y = df[features], df["y"]
print(df.shape)                                  # app: (${P.N + nMiss}, ${nCols})

# How the app generated these rows (the recipe, for reference):
#   inputs x : ${py(rc.x)}
#   error ε  : ${py(rc.e)}
#   target y : ${py(rc.y)}${extraTxt}` });

    out.push({ id: 2, t: 'Step 2: clean', code:
`print("duplicate rows:", df.duplicated(subset=features + ["y"]).sum())   # app: ${P.dupes}
print("missing cells:", df[features + ["y"]].isna().sum().sum())        # app: ${nMiss}${nMiss ? `
df = df.dropna(subset=["y"])                                            # complete-case analysis: app keeps ${P.N} rows${mark(v.id === 'mnar' ? 'biased here: y is missing because of its own value' : 'fine when the loss does not depend on y')}` : ''}
z = df[${fe.length ? `[${fe.map(x => `"${x}"`).join(', ')}, "y"]` : '["y"]'}].apply(lambda col: np.abs(stats.zscore(col, ddof=1)))   # z = (value - mean) / sd, per column
print("outliers (|z| > 3):", (z > 3).sum().to_dict())                  # app: y ${P.outY}, features ${P.outX}` +
(vid === 'dupes' ? `\n\n# This variant: every observation is repeated. The fix is to drop the copies:\n# df = df.drop_duplicates(subset=features + ["y"])${mark('do this before anything else')}` : '') });

    out.push({ id: 3, t: 'Step 3: explore', code:
`print(stats.skew(df["y"]))        # skewness γ1 (population formula, as in the app): app ${n(P.eda.skewY, 3)}
print(df["y"].skew())             # pandas prints the sample-adjusted G1 instead
${cat ? `print(df.groupby("${cat}")["y"].agg(["count", "mean"]).round(3))   # a text column has no correlation: look at y per level
` : ''}print(df[${cat ? 'num' : 'features'} + ["y"]].corr().round(3))   # app: r(${feats[j - 1]}, y) = ${n(P.eda.corrXY[j - 1], 3)}${isFinite(P.eda.maxFeatCorr) && !cat ? `, largest |r| between inputs = ${n(P.eda.maxFeatCorr, 3)}` : ''}
# df.plot.scatter("${feats[0]}", "y")   # always look at the picture too` });

    const split = aid === 'independence' && vid !== 'indep' && vid !== 'dupes' ? (vid === 'cluster'
      ? `\n\n# This variant: rows come in clusters, so keep each cluster on one side:\n# from sklearn.model_selection import GroupShuffleSplit\n# tr_idx, te_idx = next(GroupShuffleSplit(test_size=0.2, random_state=${c.S.seed}).split(df, groups=df["${grp}"]))${mark('group split')}`
      : `\n\n# This variant: errors are correlated in time, so train on the past, test on the future:\n# from sklearn.model_selection import TimeSeriesSplit\n# for tr_idx, te_idx in TimeSeriesSplit(n_splits=5).split(df): ...${mark('time-ordered split')}`) : '';
    out.push({ id: 4, t: 'Step 4: train / test split', code:
`train, test = df[df["set"] == "train"], df[df["set"] == "test"]   # the app's own 80/20 split
print(len(train), len(test))                                     # app: ${P.nTr} ${P.nTe}
# The usual way when you have no saved split:
# from sklearn.model_selection import train_test_split
# train, test = train_test_split(df, test_size=0.2, random_state=${c.S.seed})
X_tr, y_tr = train[features], train["y"]
X_te, y_te = test[features], test["y"]` + split });

    const catCols = names.filter(GEN.isCat).map(py);
    out.push(cat ? { id: 5, t: `Step 5: encode ${cat} (text → 0/1 columns), then scale the numeric features`, code:
`from sklearn.preprocessing import OneHotEncoder
enc = OneHotEncoder(drop=${dummy ? 'None' : '"first"'}, handle_unknown="ignore", sparse_output=False).fit(X_tr[cat])   # levels learned on the TRAINING rows${dummy ? mark('drop=None keeps every level: the dummy-variable trap') : ''}
print(enc.categories_)                  # app: ${d.rawCat.levels.join(', ')}${dummy ? '' : ` (reference ${d.rawCat.ref}, dropped)`}
def encode(part):                       # the same columns for train and test; a level never seen in training gets all zeros
    dummies = pd.DataFrame(enc.transform(part[cat]), columns=enc.get_feature_names_out(cat), index=part.index)
    return pd.concat([part[num], dummies], axis=1)
X_tr, X_te = encode(X_tr), encode(X_te)
print(list(X_tr.columns))               # app: ${Q(feats)}

scaler = StandardScaler().fit(X_tr[num])   # μ and s of the numeric features, TRAINING rows only (ddof=0)
print(scaler.mean_)                     # app: μ = ${L(P.mu.filter((_, k) => k && !GEN.isCat(names[k])))}
print(scaler.scale_)                    # app: s = ${L(P.sd.filter((_, k) => k && !GEN.isCat(names[k])))}
Xs_tr, Xs_te = X_tr.copy(), X_te.copy()
Xs_tr[num], Xs_te[num] = scaler.transform(X_tr[num]), scaler.transform(X_te[num])   # the 0/1 columns stay 0/1` } : { id: 5, t: 'Step 5: scale with the training mean and SD', code:
(d.fe ? feCode(c, { feats, py, n, L, mark }) + '\n\n' : '') + ((P.scale && P.scale !== 'std') || names.some(GEN.noScale) ? scaleCode(c, { py, L, mark }) : `scaler = StandardScaler().fit(X_tr)     # learns μ and s from the TRAINING rows only (s uses ddof=0, as in the app)
print(scaler.mean_)                     # app: μ = ${L(P.mu.slice(1))}
print(scaler.scale_)                    # app: s = ${L(P.sd.slice(1))}
Xs_tr = scaler.transform(X_tr)          # x̃ = (x - μ) / s
Xs_te = scaler.transform(X_te)          # test rows use the TRAINING μ and s`) +
(dummy ? `\n\n# This variant: all three dummies A, B, C are kept with an intercept (the dummy-variable trap).\n# The fix is to drop one level:  pd.get_dummies(df["category"], drop_first=True)${mark('k - 1 dummies')}` : '') });

    out.push({ id: 6, t: 'Step 6: design matrix, Gram matrix, eigenvalues, rank, κ', code:
`D = sm.add_constant(Xs_tr, has_constant="add")   # X̃: a column of 1s, then the standardised features
G = D.T @ D                                      # the Gram matrix X̃ᵀX̃
print(np.round(G, 3))                            # app: ${'[' + f.XtX.map(r => L(r)).join(', ') + ']'}
eig = np.linalg.eigvalsh(G)                      # eigenvalues of a symmetric matrix: roots of det(G - λI) = 0
print(np.round(eig[::-1], 4))                    # app: ${L(f.eig)}
print(np.linalg.matrix_rank(D))                  # app: rank ${f.rank} of ${P.P}
print(eig.max() / eig.min() if eig.min() > 1e-10 * eig.max() else np.inf)   # condition number κ (∞ when an eigenvalue is 0): app ${isFinite(f.kappa) ? n(f.kappa, 2) : 'inf'}` });

    out.push({ id: 7, t: 'Steps 7–9a: the model, the loss, and the closed-form fit', code:
`# The normal equations X̃ᵀX̃ w̃ = X̃ᵀy, solved directly (step 9a):
w_std = ${f.full ? 'np.linalg.solve(G, D.T @ y_tr.to_numpy())' : 'np.linalg.lstsq(D, y_tr.to_numpy(), rcond=None)[0]   # X̃ᵀX̃ is singular: minimum-norm solution'}
print(np.round(w_std, 4))                        # app: w̃ = ${L(f.w)}

# The same fit, the way it is done in practice: a pipeline that scales and fits.
model = make_pipeline(StandardScaler(), LinearRegression()).fit(X_tr, y_tr)
yhat_tr = model.predict(X_tr)                    # step 7: ŷ = X̃w̃
e = y_tr - yhat_tr                               # step 8: residuals e = y - ŷ
print(np.mean(e ** 2))                           # the loss L (mean squared error): app ${n(f.SSE / P.nTr, 4)}` });

    out.push({ id: '9b', t: 'Step 9b: gradient descent', code:
`# scikit-learn's gradient-descent regressor (stochastic: one row at a time, so it lands
# close to, not exactly on, the closed-form answer). The app runs full-batch steps with η = ${n(P.eta, 4)}.
gd = SGDRegressor(loss="squared_error", penalty=None, learning_rate="constant", eta0=0.01,
                  max_iter=5000, tol=1e-10, random_state=0).fit(Xs_tr, y_tr)
print(gd.intercept_, gd.coef_)                   # ≈ app w̃ = ${L(f.w)}` });

    out.push({ id: 10, t: 'Step 10: diagnostics', code:
`ols = sm.OLS(y_tr, sm.add_constant(X_tr)).fit()            # same fit in original units: same residuals
r = ols.resid
print(linear_reset(ols, power=3, use_f=True))                # RESET (adds ŷ², ŷ³): app F = ${n(dg.reset?.F, 3)}, p ${pv(dg.reset?.p)}
lm, lm_p, _, _ = het_breuschpagan(r, ols.model.exog)          # Breusch–Pagan, N·R² of e² on X: app LM = ${n(dg.bp?.LM, 3)}, p ${pv(dg.bp?.p)}
print(lm, lm_p)
print(durbin_watson(r))                                      # app: DW = ${n(dg.dw, 3)} (rows in time order)
jb, jb_p, skew, kurt = jarque_bera(r)                        # app: JB = ${n(dg.jb?.JB, 3)}, p ${pv(dg.jb?.p)}, S = ${n(dg.jb?.skew, 3)}, K = ${n(dg.jb?.kurt, 3)}
print(jb, jb_p)
vif = [variance_inflation_factor(ols.model.exog, k) for k in range(1, ols.model.exog.shape[1])]
print(np.round(vif, 3))                                      # app: ${dg.vif?.length ? L(dg.vif.map(x => isFinite(x) ? x : NaN)) : '[]'}
cooks = OLSInfluence(ols).cooks_distance[0]
print(cooks.max())                                           # app: largest Cook's D = ${f.cook ? n(Math.max(...f.cook), 3) : 'nan'}
# sm.qqplot(r, line="s")   # and plot r against ols.fittedvalues and against row order` });

    // no tests possible (perfect fit or no spare rows): keep the code, commented out, with the reason
    const mute = (cell, keep, why) => { const L2 = cell.code.split('\n'); cell.code = L2.slice(0, keep).join('\n') + `\n# Not available for this data: ${why}.\n` + L2.slice(keep).map(l => l.startsWith('#') ? l : '# ' + l).join('\n'); };
    if (P.noDg) mute(out[out.length - 1], 2, py(P.noDg));
    const se = aid === 'independence' && vid === 'cluster' ? 'clustered' : aid === 'independence' && vid !== 'indep' && vid !== 'dupes' ? 'Newey–West' : aid === 'homoscedasticity' && !isBase ? 'HC1' : null;
    out.push({ id: 11, t: 'Step 11: inference', code:
`print(ols.summary())        # app: slope ${n(P.wOrig[j], 4)} ± ${n(P.seOrig[j], 4)}, t = ${n(f.t?.[j], 2)}, p ${pv(f.pv?.[j])}; F = ${n(((f.SST - f.SSE) / Math.max(1, f.rank - 1)) / (f.SSE / f.df), 2)}
print(ols.conf_int())       # 95% intervals: app slope CI [${n(P.wOrig[j] - f.tc * P.seOrig[j], 3)}, ${n(P.wOrig[j] + f.tc * P.seOrig[j], 3)}]

hc1 = sm.OLS(y_tr, sm.add_constant(X_tr)).fit(cov_type="HC1")          # robust to uneven spread
print(hc1.bse)                                                          # app: SE_HC1 = ${n(P.hc?.[j], 4)}${se === 'HC1' ? mark('the right SE for this variant') : ''}
nw = sm.OLS(y_tr, sm.add_constant(X_tr)).fit(cov_type="HAC", cov_kwds={"maxlags": ${lag}, "use_correction": True})
print(nw.bse)                                                           # app: SE_NW = ${n(P.nw?.se[j], 4)} (lag ${lag})${se === 'Newey–West' ? mark('the right SE for this variant') : ''}` +
(grp && P.cl ? `\ncl = sm.OLS(y_tr, sm.add_constant(X_tr)).fit(cov_type="cluster", cov_kwds={"groups": train["${grp}"]})\nprint(cl.bse)                                                           # app: SE_CL = ${n(P.cl.se[j], 4)}${se === 'clustered' ? mark('the right SE for this variant') : ''}` : '') });

    if (!(f.df > 0)) mute(out[out.length - 1], 0, 'there are no spare rows (N - p <= 0), so s², the SEs, t-tests and intervals are undefined');
    out.push({ id: 12, t: 'Step 12: evaluate on the test rows', code:
`yhat_te = model.predict(X_te)                     # scaled with the training μ, s inside the pipeline
print(np.sqrt(mean_squared_error(y_te, yhat_te)))  # test RMSE: app ${n(P.rmseTe, 3)} (train ${n(P.rmseTr, 3)})
print(r2_score(y_te, yhat_te))                     # test R²: app ${n(P.r2Te, 3)}` + (P.orig ? `
# y was transformed in step 5: turn the predictions back before scoring in the units of y
back = ${d.fe.kind === 'log' ? 'np.exp' : `lambda z: np.maximum(0, ${n(d.fe.lam, 6)} * z + 1) ** (1 / ${n(d.fe.lam, 6)})`}
print(np.sqrt(mean_squared_error(test["raw_y"], back(yhat_te))))   # app: test RMSE in the units of y ${n(P.orig.rmseTe, 3)}` : '') });

    out.push({ id: 13, t: 'Step 13: interpret', code:
`print(ols.params)          # original units: app ${names.map((nm, k) => `${k ? py(nm) : 'const'} ${n(P.wOrig[k], 4)}`).join(', ')}
# The same numbers from the pipeline:
lr = model.named_steps["linearregression"]; sc = model.named_steps["standardscaler"]
print(lr.coef_ / sc.scale_, lr.intercept_ - np.sum(lr.coef_ * sc.mean_ / sc.scale_))` });

    const FIX = {
      linearity: vid === 'interaction' ? `smf.ols("y ~ ${X0} * C(customer)${plus}", data=train).fit()   # let the slope differ by customer type` : vid === 'linear' ? null : vid === 'log' ? `smf.ols("y ~ np.log1p(${X0})${plus}", data=train).fit()   # model the diminishing effect` : vid === 'step' ? `smf.ols("y ~ ${X0} + I(${X0} > 5)${plus}", data=train).fit()   # add the threshold indicator` : vid === 'periodic' ? `smf.ols("y ~ ${X0} + np.sin(1.6 * ${X0}) + np.cos(1.6 * ${X0})${plus}", data=train).fit()   # seasonal terms` : `smf.ols("y ~ ${X0} + I(${X0} ** 2)${plus}", data=train).fit()   # or splines: bs(${X0}, df=4)`,
      independence: vid === 'cluster' ? `sm.OLS(y_tr, sm.add_constant(X_tr)).fit(cov_type="cluster", cov_kwds={"groups": train["${grp}"]})   # or a mixed model: smf.mixedlm("y ~ ${fe.join(' + ')}", train, groups=train["${grp}"])` : vid === 'dupes' ? `df = df.drop_duplicates(subset=features + ["y"])   # then refit; classical SEs are fine again` : vid === 'indep' ? null : `sm.OLS(y_tr, sm.add_constant(X_tr)).fit(cov_type="HAC", cov_kwds={"maxlags": ${lag}})   # or model the dynamics: sm.tsa.SARIMAX(y, exog=X, order=(1, 0, 0))`,
      homoscedasticity: vid === 'constant' ? null : vid === 'groupvar' ? `w = 1 / train.groupby("${grp}")["y"].transform(lambda s: ols.resid[s.index].var())\nsm.WLS(y_tr, sm.add_constant(X_tr), weights=w).fit()   # weight each group by 1 / its variance` : `sm.OLS(y_tr, sm.add_constant(X_tr)).fit(cov_type="HC3")   # robust SEs; or WLS, or model np.log(y)`,
      normality: vid === 'normal' ? null : vid === 'heavy' ? `from sklearn.linear_model import HuberRegressor\nHuberRegressor().fit(Xs_tr, y_tr)   # down-weights the extreme rows` : `# bootstrap the slope instead of trusting the t interval:\nboot = [sm.OLS(s["y"], sm.add_constant(s[features])).fit().params.iloc[1] for s in (train.sample(frac=1, replace=True, random_state=k) for k in range(2000))]\nprint(np.percentile(boot, [2.5, 97.5]))`,
      multicollinearity: vid === 'uncorr' ? null : dummy ? `enc = OneHotEncoder(drop="first", handle_unknown="ignore", sparse_output=False)   # keep k - 1 dummies: blue becomes the reference` : vid === 'perfect' || vid === 'combo' ? `features = [${feats.filter(x => x !== (vid === 'perfect' ? 'x2' : 'x3')).map(x => `"${x}"`).join(', ')}]   # drop the redundant ${vid === 'perfect' ? 'x2' : 'x3'}, then refit` : `from sklearn.linear_model import RidgeCV\nmake_pipeline(StandardScaler(), RidgeCV(alphas=np.logspace(-3, 3, 50))).fit(X_tr, y_tr)   # shrink the unstable directions`,
      exogeneity: vid === 'exo' ? null : `# No residual test can detect this. Add the missing variable if you have it, or use an instrument:\n# from linearmodels.iv import IV2SLS\n# IV2SLS.from_formula("y ~ 1 + [x ~ instrument]", data=df).fit()`,
      outliers: vid === 'outnone' ? null : `infl = OLSInfluence(ols)
k = int(np.argmax(infl.cooks_distance[0]))                      # the most influential training row
print(train.iloc[k], np.asarray(infl.hat_matrix_diag)[k], np.asarray(infl.resid_studentized_internal)[k])
refit = sm.OLS(y_tr.drop(y_tr.index[k]), sm.add_constant(X_tr.drop(X_tr.index[k]))).fit()
print(ols.params, refit.params)                                  # how much one row moves the fit
from sklearn.linear_model import HuberRegressor
HuberRegressor().fit(Xs_tr, y_tr)                                # robust loss: large residuals count linearly, not squared`,
      samplesize: vid === 'nlarge' ? null : `print(len(train) - (len(features) + 1))   # spare rows N - p: app ${P.f.df}
from sklearn.linear_model import RidgeCV
RidgeCV(alphas=np.logspace(-3, 3, 13)).fit(Xs_tr, y_tr)   # shrinkage keeps the fit stable when N is close to (or below) p
from sklearn.model_selection import learning_curve
# sizes, tr_sc, te_sc = learning_curve(LinearRegression(), X, y, train_sizes=np.linspace(0.2, 1, 6), cv=5, scoring="neg_root_mean_squared_error")`,
      noise: vid === 'nslow' ? null : vid === 'nspure' ? `print(ols.f_pvalue)          # the overall F-test: app p ${pv(ST.fSF(((f.SST - f.SSE) / Math.max(1, f.rank - 1)) / (f.SSE / Math.max(1, f.df)), Math.max(1, f.rank - 1), Math.max(1, f.df)))}
print(r2_score(y_te, yhat_te))  # test R² near 0 or negative: no signal (app ${n(P.r2Te, 3)})` : vid === 'nszero' ? `print(ols.ssr)                # 0: a perfect fit. Real data always have noise, so suspect a formula or leakage` : `print(np.sqrt(ols.scale))      # s, the estimate of σ: app ${n(Math.sqrt(f.s2), 3)}
# more rows or better features are the only cure; the slope stays unbiased`,
      range: vid === 'rwide' ? null : `print(X_tr["${X0}"].min(), X_tr["${X0}"].max(), X_te["${X0}"].min(), X_te["${X0}"].max())   # is the model used outside its training range?
pred = ols.get_prediction(sm.add_constant(X_te, has_constant="add")).summary_frame(alpha=0.05)
print(pred[["mean", "mean_ci_lower", "mean_ci_upper", "obs_ci_lower", "obs_ci_upper"]].head())   # confidence vs prediction intervals`,
      irrelevant: vid === 'irnone' ? null : vid === 'ircopy' ? `features = [f for f in features if f != "x_copy"]   # keep one copy of the information` : `print(ols.rsquared, ols.rsquared_adj)                # app: R² vs adjusted R²
from sklearn.linear_model import LassoCV
lasso = LassoCV(cv=5).fit(Xs_tr, y_tr)
print(dict(zip(features, np.round(lasso.coef_, 3))))     # the noise columns are set to 0`,
      missing: vid === 'mnone' ? null : `raw = pd.read_csv("dataset.csv")
print(raw["y"].isna().groupby(pd.cut(raw["${X0}"], 5)).mean())   # does the chance of missing change with x? (MAR)
# MNAR cannot be seen in the data: it needs knowledge of how values got lost.
# Imputation for features (not for y): from sklearn.impute import SimpleImputer, IterativeImputer (inside a Pipeline)`,
      target: vid === 'tcont' ? null : vid === 'tcount' ? `pois = smf.glm("y ~ ${fe.join(' + ')}", data=train, family=sm.families.Poisson()).fit()
print(pois.params)                         # log(mean) = b + w·x: predictions stay positive` : vid === 'tskew' ? `logm = smf.ols("np.log(y) ~ ${fe.join(' + ')}", data=train).fit()
print(logm.params)                          # each unit of x multiplies y by exp(w)` : `train = train.assign(z=np.log(train["y"] / (20 - train["y"])))   # the logit of y scaled to (0, 20)
print(smf.ols("z ~ ${fe.join(' + ')}", data=train).fit().params)`,
      categorical: vid === 'cnone' ? null : vid === 'chigh' ? `# 24 one-hot columns for 25 levels overfit. Alternatives:
# from category_encoders import TargetEncoder           # target encoding, fitted inside cross-validation
mixed = smf.mixedlm("y ~ ${X0}", train, groups=train["${cat}"]).fit()   # a random effect per level shrinks rare levels
print(mixed.params)` : `full = smf.ols("y ~ ${X0} + C(${cat})", data=train).fit()       # the formula one-hot encodes the text column and drops the reference level
print(full.params)
print(sm.stats.anova_lm(smf.ols("y ~ ${X0}", data=train).fit(), full))   # partial F-test for the whole category`,
      subgroups: vid === 'sgnone' ? null : `print(smf.ols("y ~ ${X0}", data=train).fit().params)                 # pooled
print(smf.ols("y ~ ${X0} * C(group)", data=train).fit().params)      # with the group: each group gets its own line${mark('the group must be recorded')}`,
      shift: vid === 'shnone' ? null : `print(X_tr.describe().loc[["mean", "std"]], X_te.describe().loc[["mean", "std"]])   # compare the input distributions
# drift in the rule shows as test residuals that trend: plot (y_te - yhat_te) against X_te
# from sklearn.model_selection import TimeSeriesSplit   # validate on later periods`,
      leakage: vid === 'lknone' ? null : vid === 'lktarget' ? `print(df[features + ["y"]].corr()["y"].round(3))   # a near-perfect correlation is a red flag
features = [f for f in features if f != "leak"]        # drop every column not known at prediction time` : `# enc was computed from y on ALL rows before the split. Fit the encoding on the training rows only:
# from sklearn.preprocessing import TargetEncoder        # scikit-learn >= 1.3; cross-fits inside fit_transform
# pipe = make_pipeline(ColumnTransformer([("te", TargetEncoder(), ["level"])], remainder="passthrough"), LinearRegression())
# Any step that learns from data (encoding, selection, imputation) belongs inside the Pipeline, after the split.`
    }[aid];
    out.push({ id: 'fix', t: `This variant: the fix in code`, code: FIX ? `# ${a.name} › ${v.name}: ${(influence(aid, v, false, 1)[11] || [, ''])[1] || v.desc}\n${FIX}` : `# Baseline: the assumptions hold, so the plain fit above is the right model.` });
    return out;
  }

  function hi(code){
    const esc_ = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return code.split('\n').map(line => { let c = '', i = line.indexOf('#'); const q = (line.slice(0, Math.max(0, i)).match(/"/g) || []).length; if (i >= 0 && q % 2 === 0) { c = line.slice(i); line = line.slice(0, i); }
      let h = esc_(line).replace(/(&quot;|")([^"]*)(")/g, '<span class="py-s">"$2"</span>').replace(/\b(import|from|as|for|in|if|else|def|return|print|lambda|True|False|None)\b/g, '<span class="py-k">$1</span>');
      return h + (c ? `<span class="py-c">${esc_(c)}</span>` : ''); }).join('\n');
  }
  function dl(name, text, type){ try { const u = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); } catch (err) { console.error(err); } }

  function render(el, c){
    const cs = cells(c), all = cs.map(x => `# ===== ${x.t} =====\n${x.code}`).join('\n\n'), data = csv(c).text;
    el.innerHTML = `<div class="nt-head"><h2 id="code-h">Code: the same process in Python</h2><span><button type="button" class="btn" id="cdCsv">Download dataset.csv</button> <button type="button" class="btn ghost" id="cdPy">Download .py</button> <button type="button" class="btn ghost" id="cdCopy">Copy all</button> <button type="button" class="btn ghost" id="cdAll">Open all</button></span></div>
      <p class="hint-s">Every step of the process, in order, the way it is done in industry: pandas for data, SciPy for statistics, statsmodels for inference and diagnostics, scikit-learn for scaling, fitting and evaluation. It is rewritten for <b>${esc(c.a.name)} › ${esc(c.v.name)}</b> and the current sample. Download the dataset (it carries the app's train/test split) and the printed numbers match the <code># app:</code> comments. Lines marked ← are specific to this variant.</p>
      <div class="cd-cells">${cs.map(x => `<details class="cd" data-id="${x.id}"${openSet.has(String(x.id)) ? ' open' : ''}><summary>${x.t}${x.code.includes('# ←') ? ' <span class="cd-tag">this variant</span>' : ''}${/^\d|9b/.test(String(x.id)) ? ` <a class="cd-link" href="#step-${x.id === 7 ? 7 : x.id}" data-goto="step-${x.id === 7 ? 7 : x.id}">see step ${x.id === 7 ? '7–9a' : x.id} ↑</a>` : ''}</summary><pre class="cd-pre"><code>${hi(x.code)}</code></pre></details>`).join('')}</div>`;
    if (!bound) { bound = true; el.addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('details.cd')) d.open ? openSet.add(d.dataset.id) : openSet.delete(d.dataset.id); }, true); }
    el.querySelector('#cdCsv').onclick = () => dl('dataset.csv', data, 'text/csv');
    el.querySelector('#cdPy').onclick = () => dl(`linear_regression_${c.v.id}.py`, all + '\n', 'text/x-python');
    el.querySelector('#cdCopy').onclick = e => navigator.clipboard?.writeText(all).then(() => { e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy all', 1500); }).catch(() => {});
    el.querySelector('#cdAll').onclick = () => { const ds = [...el.querySelectorAll('details.cd')], o = ds.some(d => !d.open); ds.forEach(d => d.open = o); };
  }
  return { render, cells, csv };
})();
