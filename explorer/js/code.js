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
    const d = c.d, P = c.P, feats = d.names.slice(1).map(py), extra = [];
    if (d.group && !d.names.includes('group') && !d.names.includes('A')) extra.push(c.v.id === 'cluster' ? 'cluster' : 'group');
    if (d.names.includes('A')) extra.push('category');
    const head = ['row', ...feats, ...extra, 'y', 'set'];
    const rows = d.y.map((y, i) => [i + 1, ...d.X[i].slice(1).map(v => +v.toFixed(8)), ...extra.map(e => e === 'category' ? 'ABC'[d.group[i]] : d.group[i]), +y.toFixed(8), P.isTrain[i] ? 'train' : 'test']);
    return { text: [head.join(','), ...rows.map(r => r.join(','))].join('\n'), feats, extra };
  }

  function cells(c){
    const { P, d, a, v, isBase } = c, f = P.f, dg = P.dg || {}, j = d.focus[0], names = d.names, { feats, extra } = csv(c);
    const F = `[${feats.map(x => `"${x}"`).join(', ')}]`, rc = CHG.recipe(a, v).cur, aid = a.id, vid = v.id, grp = extra[0];
    const dummy = names.includes('A'), mark = s => `   # ← ${s}`;
    const lag = P.nw?.lag ?? Math.max(1, Math.floor(4 * (P.nTr / 100) ** (2 / 9)));
    const fe = feats.filter(x => !['A', 'B', 'C'].includes(x));
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
`df = pd.read_csv("dataset.csv")                  # app: N = ${P.N} rows
features = ${F}
X, y = df[features], df["y"]
print(df.shape)                                  # app: (${P.N}, ${2 + feats.length + extra.length + 1})

# How the app generated these rows (the recipe, for reference):
#   inputs x : ${py(rc.x)}
#   error ε  : ${py(rc.e)}
#   target y : ${py(rc.y)}${extraTxt}` });

    out.push({ id: 2, t: 'Step 2: clean', code:
`print("duplicate rows:", df.duplicated(subset=features + ["y"]).sum())   # app: ${P.dupes}
print("missing cells:", df[features + ["y"]].isna().sum().sum())        # app: 0
z = df[${fe.length ? `[${fe.map(x => `"${x}"`).join(', ')}, "y"]` : '["y"]'}].apply(lambda col: np.abs(stats.zscore(col, ddof=1)))   # z = (value - mean) / sd, per column
print("outliers (|z| > 3):", (z > 3).sum().to_dict())                  # app: y ${P.outY}, features ${P.outX}` +
(vid === 'dupes' ? `\n\n# This variant: every observation is repeated. The fix is to drop the copies:\n# df = df.drop_duplicates(subset=features + ["y"])${mark('do this before anything else')}` : '') });

    out.push({ id: 3, t: 'Step 3: explore', code:
`print(stats.skew(df["y"]))        # skewness γ1 (population formula, as in the app): app ${n(P.eda.skewY, 3)}
print(df["y"].skew())             # pandas prints the sample-adjusted G1 instead
print(df[features + ["y"]].corr().round(3))   # app: r(${feats[0]}, y) = ${n(P.eda.corrXY[0], 3)}${isFinite(P.eda.maxFeatCorr) ? `, largest |r| between inputs = ${n(P.eda.maxFeatCorr, 3)}` : ''}
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

    out.push({ id: 5, t: 'Step 5: scale with the training mean and SD', code:
`scaler = StandardScaler().fit(X_tr)     # learns μ and s from the TRAINING rows only (s uses ddof=0, as in the app)
print(scaler.mean_)                     # app: μ = ${L(P.mu.slice(1))}
print(scaler.scale_)                    # app: s = ${L(P.sd.slice(1))}
Xs_tr = scaler.transform(X_tr)          # x̃ = (x - μ) / s
Xs_te = scaler.transform(X_te)          # test rows use the TRAINING μ and s` +
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

    const se = aid === 'independence' && vid === 'cluster' ? 'clustered' : aid === 'independence' && vid !== 'indep' && vid !== 'dupes' ? 'Newey–West' : aid === 'homoscedasticity' && !isBase ? 'HC1' : null;
    out.push({ id: 11, t: 'Step 11: inference', code:
`print(ols.summary())        # app: slope ${n(P.wOrig[j], 4)} ± ${n(P.seOrig[j], 4)}, t = ${n(f.t?.[j], 2)}, p ${pv(f.pv?.[j])}; F = ${n(((f.SST - f.SSE) / Math.max(1, f.rank - 1)) / (f.SSE / f.df), 2)}
print(ols.conf_int())       # 95% intervals: app slope CI [${n(P.wOrig[j] - f.tc * P.seOrig[j], 3)}, ${n(P.wOrig[j] + f.tc * P.seOrig[j], 3)}]

hc1 = sm.OLS(y_tr, sm.add_constant(X_tr)).fit(cov_type="HC1")          # robust to uneven spread
print(hc1.bse)                                                          # app: SE_HC1 = ${n(P.hc?.[j], 4)}${se === 'HC1' ? mark('the right SE for this variant') : ''}
nw = sm.OLS(y_tr, sm.add_constant(X_tr)).fit(cov_type="HAC", cov_kwds={"maxlags": ${lag}, "use_correction": True})
print(nw.bse)                                                           # app: SE_NW = ${n(P.nw?.se[j], 4)} (lag ${lag})${se === 'Newey–West' ? mark('the right SE for this variant') : ''}` +
(grp && P.cl ? `\ncl = sm.OLS(y_tr, sm.add_constant(X_tr)).fit(cov_type="cluster", cov_kwds={"groups": train["${grp}"]})\nprint(cl.bse)                                                           # app: SE_CL = ${n(P.cl.se[j], 4)}${se === 'clustered' ? mark('the right SE for this variant') : ''}` : '') });

    out.push({ id: 12, t: 'Step 12: evaluate on the test rows', code:
`yhat_te = model.predict(X_te)                     # scaled with the training μ, s inside the pipeline
print(np.sqrt(mean_squared_error(y_te, yhat_te)))  # test RMSE: app ${n(P.rmseTe, 3)} (train ${n(P.rmseTr, 3)})
print(r2_score(y_te, yhat_te))                     # test R²: app ${n(P.r2Te, 3)}` });

    out.push({ id: 13, t: 'Step 13: interpret', code:
`print(ols.params)          # original units: app ${names.map((nm, k) => `${k ? py(nm) : 'const'} ${n(P.wOrig[k], 4)}`).join(', ')}
# The same numbers from the pipeline:
lr = model.named_steps["linearregression"]; sc = model.named_steps["standardscaler"]
print(lr.coef_ / sc.scale_, lr.intercept_ - np.sum(lr.coef_ * sc.mean_ / sc.scale_))` });

    const FIX = {
      linearity: vid === 'interaction' ? `smf.ols("y ~ ${X0} * group${plus}", data=train).fit()   # let the slope differ by group` : vid === 'linear' ? null : vid === 'log' ? `smf.ols("y ~ np.log1p(${X0})${plus}", data=train).fit()   # model the diminishing effect` : vid === 'step' ? `smf.ols("y ~ ${X0} + I(${X0} > 5)${plus}", data=train).fit()   # add the threshold indicator` : vid === 'periodic' ? `smf.ols("y ~ ${X0} + np.sin(1.6 * ${X0}) + np.cos(1.6 * ${X0})${plus}", data=train).fit()   # seasonal terms` : `smf.ols("y ~ ${X0} + I(${X0} ** 2)${plus}", data=train).fit()   # or splines: bs(${X0}, df=4)`,
      independence: vid === 'cluster' ? `sm.OLS(y_tr, sm.add_constant(X_tr)).fit(cov_type="cluster", cov_kwds={"groups": train["${grp}"]})   # or a mixed model: smf.mixedlm("y ~ ${fe.join(' + ')}", train, groups=train["${grp}"])` : vid === 'dupes' ? `df = df.drop_duplicates(subset=features + ["y"])   # then refit; classical SEs are fine again` : vid === 'indep' ? null : `sm.OLS(y_tr, sm.add_constant(X_tr)).fit(cov_type="HAC", cov_kwds={"maxlags": ${lag}})   # or model the dynamics: sm.tsa.SARIMAX(y, exog=X, order=(1, 0, 0))`,
      homoscedasticity: vid === 'constant' ? null : vid === 'groupvar' ? `w = 1 / train.groupby("${grp}")["y"].transform(lambda s: ols.resid[s.index].var())\nsm.WLS(y_tr, sm.add_constant(X_tr), weights=w).fit()   # weight each group by 1 / its variance` : `sm.OLS(y_tr, sm.add_constant(X_tr)).fit(cov_type="HC3")   # robust SEs; or WLS, or model np.log(y)`,
      normality: vid === 'normal' ? null : vid === 'heavy' ? `from sklearn.linear_model import HuberRegressor\nHuberRegressor().fit(Xs_tr, y_tr)   # down-weights the extreme rows` : `# bootstrap the slope instead of trusting the t interval:\nboot = [sm.OLS(s["y"], sm.add_constant(s[features])).fit().params.iloc[1] for s in (train.sample(frac=1, replace=True, random_state=k) for k in range(2000))]\nprint(np.percentile(boot, [2.5, 97.5]))`,
      multicollinearity: vid === 'uncorr' ? null : dummy ? `pd.get_dummies(df["category"], drop_first=True)   # keep k - 1 dummies` : vid === 'perfect' || vid === 'combo' ? `features = [${feats.filter(x => x !== (vid === 'perfect' ? 'x2' : 'x3')).map(x => `"${x}"`).join(', ')}]   # drop the redundant ${vid === 'perfect' ? 'x2' : 'x3'}, then refit` : `from sklearn.linear_model import RidgeCV\nmake_pipeline(StandardScaler(), RidgeCV(alphas=np.logspace(-3, 3, 50))).fit(X_tr, y_tr)   # shrink the unstable directions`,
      exogeneity: vid === 'exo' ? null : `# No residual test can detect this. Add the missing variable if you have it, or use an instrument:\n# from linearmodels.iv import IV2SLS\n# IV2SLS.from_formula("y ~ 1 + [x ~ instrument]", data=df).fit()`
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
