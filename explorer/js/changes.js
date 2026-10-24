/* ============================================================
   "What changed": for the selected variant, exactly what was
   altered in the recipe and in the dataset (compared cell by cell
   with the baseline drawn from the same random numbers), and a
   trail of every place in the app where the change shows up.
   CHG.render(el, ctx) with ctx = { cur, base, a, v, isBase, S, inf }.
   ============================================================ */
const CHG = (() => {
  const C = n => css(n), n = (v, d = 3) => num(v, d);
  const pf = p => !isFinite(p) ? '—' : p < 0.001 ? '< 0.001' : n(p, 3);

  /* the recipe: how x, the error ε and y are produced */
  const BASE = {
    one: { x: 'x = 10·u, sorted (u uniform between 0 and 1); rows are in this order, like time', e: 'εᵢ = σ·zᵢ (z from the bell curve, a fresh draw for every row)', y: 'y = 2 + 1.5·x + ε' },
    two: { x: 'x₁ = 10·u₁;  x₂ = 10·u₂, drawn independently of x₁', e: 'εᵢ = σ·zᵢ', y: 'y = 2 + 1.5·x₁ + 1.0·x₂ + ε' }
  };
  const R = {
    quadratic: { y: 'y = 2 + 1.5·x + 0.3·s·(x − 5)² + ε' },
    log: { y: 'y = (1 − s)(2 + 1.5x) + s·(2 + 7·ln(1 + x)) + ε' },
    sshape: { y: 'y = (1 − s)(2 + 1.5x) + s·(2 + 15 / (1 + e^(−1.5(x − 5)))) + ε' },
    step: { y: 'y = (1 − s)(2 + 1.5x) + s·(3 + 0.3x + 9·[x > 5]) + ε' },
    periodic: { y: 'y = 2 + 1.5·x + 4·s·sin(1.6x) + ε' },
    interaction: { x: 'x as before, plus a text column customer (new / returning); step 5 turns it into the 0/1 column customer_returning', y: 'y = 2 + 1.5·x + s·(1.4x − 7)·[returning] + ε' },
    posar: { e: 'εₜ = ρ·εₜ₋₁ + √(1 − ρ²)·σ·zₜ with ρ = 0.9·s: each error keeps ρ of the previous one' },
    negar: { e: 'εₜ = ρ·εₜ₋₁ + √(1 − ρ²)·σ·zₜ with ρ = −0.8·s: each error tends to flip the previous one' },
    cluster: { x: 'x = s·(centre of its cluster) + (1 − s)·10u + noise: 8 clusters of consecutive rows', e: 'εᵢ = σ·(√q·u_cluster + √(1 − q)·zᵢ), q = 0.8·s: part of the error is shared by the cluster' },
    dupes: { x: 'only ⌈N/k⌉ distinct x values, each written k = 1 + round(2s) times', e: 'every copy carries the same error as its original' },
    increasing: { e: 'εᵢ = σ·[(1 − s) + s·(0.15 + 0.17·xᵢ)]·zᵢ: the multiplier grows with x' },
    decreasing: { e: 'εᵢ = σ·[(1 − s) + s·(0.15 + 0.17·(10 − xᵢ))]·zᵢ: the multiplier shrinks with x' },
    bowtie: { e: 'εᵢ = σ·[(1 − s) + s·(0.2 + 0.32·|xᵢ − 5|)]·zᵢ: small in the middle, large at the ends' },
    groupvar: { e: 'εᵢ = σ·[(1 − s) + s·(0.3 or 1.7 by group)]·zᵢ' },
    rskew: { e: 'εᵢ = σ·[√(1 − s²)·zᵢ + s·(Eᵢ − 1)], E exponential: a long right tail' },
    lskew: { e: 'εᵢ = σ·[√(1 − s²)·zᵢ + s·(1 − Eᵢ)]: a long left tail' },
    heavy: { e: 'εᵢ = σ·[√(1 − s²)·zᵢ + s·tᵢ/√3], t with 3 degrees of freedom: occasional extremes' },
    light: { e: 'εᵢ = σ·[√(1 − s²)·zᵢ + s·√12·(Uᵢ − ½)]: uniform, never far out' },
    bimodal: { e: 'εᵢ = σ·[√(1 − s²)·zᵢ + s·(±0.95 + 0.31·z₂ᵢ)]: two humps' },
    moderate: { x: 'x₂ = 5 + ρ(x₁ − 5) + √(1 − ρ²)(10u₂ − 5), ρ = 0.6·s' },
    high: { x: 'x₂ = 5 + ρ(x₁ − 5) + √(1 − ρ²)(10u₂ − 5), ρ = 0.97·s' },
    perfect: { x: 'x₂ = 2·x₁ + (1 − s)·2z: at full strength an exact copy' },
    combo: { x: 'x₃ = x₁ + x₂ + (1 − s)·1.5z: at full strength an exact sum', y: 'y = 2 + 1.5x₁ + 1.0x₂ + 0.5x₃ + ε' },
    dummytrap: { x: 'x = 10u, plus a text column colour (blue / green / red); step 5 makes one 0/1 column per colour and keeps all three', y: 'y = 2 + 1.5x + (0, 3 or 6 by colour) + ε' },
    confounder: { x: 'x = 5 + 2s·z + 2.2·z₃, where z is a hidden variable', e: 'error seen by the model = 3s·z + σ·zᵢ: the hidden z is inside it', y: 'y = 2 + 1.5·x + 3s·z + σ·zᵢ' },
    measerr: { x: 'recorded x = true x + 3s·z₂ (true x = 10u)', e: 'error seen by the model = σ·zᵢ − 1.5·(recorded x − true x)', y: 'y = 2 + 1.5·(true x) + σ·zᵢ' },
    reverse: { x: 'x = 10u + γ/(1 − 1.5γ)·ε with γ = 0.4s: x responds to y', e: 'εᵢ = σ·zᵢ (but now x moves with it)' },
    /* data properties */
    outy: { y: 'y = 2 + 1.5x + ε, except about 1 row in 60 at a typical x: y + 6·max(σ, 1)·s' },
    levon: { x: 'x = 10u sorted, except the last row: x = 10 + 15s (far out)', y: 'y = 2 + 1.5x + ε for every row, the far-out one included' },
    levoff: { x: 'x = 10u sorted, except the last row: x = 10 + 15s (far out)', y: 'y = 2 + 1.5x + ε, except the far-out row: 20s below the line' },
    outcluster: { y: 'y = 2 + 1.5x + ε, except about 1 row in 12 at high x: − 8·max(σ, 1)·s, all together' },
    nlarge: { x: 'N = 200 rows; x = 10u sorted, plus the extra features' }, nmod: { x: 'N = 60 rows; x = 10u sorted, plus the extra features' }, nsmall: { x: 'N = 15 rows; x = 10u sorted, plus the extra features' },
    nap: { x: 'N chosen so that the training rows = p + 1' }, nlp: { x: 'N chosen so that the training rows < p' },
    nszero: { e: 'εᵢ = 0 for every row (σ = 0)' }, nsmod: { e: 'εᵢ = 2.5·max(σ, 1)·zᵢ' }, nshigh: { e: 'εᵢ = 6·max(σ, 1)·zᵢ' },
    nspure: { e: 'εᵢ = √(1.5²·100/12 + σ²)·zᵢ: the whole spread of the baseline y', y: 'y = 9.5 + ε: no x at all' },
    rrestrict: { x: 'x = 5 + (10u − 5)(1 − 0.8s): squeezed toward 5' },
    rgap: { x: 'x = 10u, with the middle moved out: values 0–5 go to 0–4, 5–10 go to 7–10 (blended by s)', y: 'y = 2 + 1.5x + 4s·exp(−(x − 5.5)²/0.8) + ε: a bump inside the gap' },
    rextrap: { x: 'x = 10u sorted; rows with x > 10 − 4s are the test set', y: 'y = 2 + 1.5x + 0.35s·max(0, x − 6)² + ε: bends beyond x = 6' },
    irfew: { x: 'x = 10u, plus 3 columns n = 10u that y does not use' }, irmany: { x: 'x = 10u, plus 15 columns n = 10u that y does not use' },
    ircopy: { x: 'x = 10u, plus x_copy = x + (0.05 + 2(1 − s))·z' },
    mcar: { y: 'y = 2 + 1.5x + ε, then each y lost with probability 0.3s; rows without y dropped' },
    mar: { y: 'y = 2 + 1.5x + ε, then lost with probability 0.7s·(x/10)²; rows without y dropped' },
    mnar: { y: 'y = 2 + 1.5x + ε, then lost with probability 0.85s / (1 + e^(−2.2·z_y)), z_y = standardised y; rows dropped' },
    tskew: { e: 'multiplicative: e^(0.12·max(σ, 0.3)·zᵢ)', y: 'y = (1 − s)(2 + 1.5x + σzᵢ) + s·e^(0.6 + 0.25x + 0.12·max(σ, 0.3)·zᵢ)' },
    tbound: { e: 'inside the curve: 0.25·max(σ, 0.3)·zᵢ', y: 'y = 20 / (1 + e^(−(−3 + 0.6x + 0.25·max(σ, 0.3)·zᵢ))): always between 0 and 20' },
    tcount: { e: 'Poisson noise: variance equals the mean', y: 'y ~ Poisson(λ), λ = e^(0.3 + 0.25x): whole numbers 0, 1, 2, …' },
    cbin: { x: 'x = 10u, plus a text column segment (basic / premium); step 5 makes the 0/1 column segment_premium', y: 'y = 2 + 1.5x + 4s·[premium] + ε' },
    cmulti: { x: 'x = 10u, plus a text column region (East / North / South / West); step 5 makes region_North, region_South, region_West (East is the reference)', y: 'y = 2 + 1.5x + (0, 3s, −2s or 5s for East, North, South, West) + ε' },
    chigh: { x: 'x = 10u, plus a text column branch (B01 … B25); step 5 makes 24 columns branch_B02 … branch_B25 (B01 is the reference)', y: 'y = 2 + 1.5x + (a random effect per branch, sd 3s) + ε' },
    sgint: { x: 'two hidden groups; group 1 has x = 3 + 0.7·10u, group 0 x = 0.8·10u', y: 'y = 2 + 1.5x + 7s·[group 1] + ε (the group is not a column)' },
    sgslope: { y: 'y = 2 + 1.5x − 2s·(x − 5)·[group 1] + ε (the group is not a column)' },
    simpson: { x: 'group 0: x = 0.5·10u; group 1: x = 5 + 0.5·10u', y: 'y = 2 + 1.5x + 18s·[group 0] + ε: slope +1.5 inside each group' },
    shfeat: { x: 'training rows x = 10u; the last 20% (test) x = (1 − s)·10u + s·(7.5 + 1.2z)' },
    shrel: { y: 'training rows y = 2 + 1.5x + ε; the last 20% (test) y = 2 + (1.5 − 1.2s)x + 3s + ε' },
    lktarget: { x: 'x = 10u, plus leak = y + (0.3 + 4(1 − s))·z, recorded after y' },
    lkprep: { x: 'x = 10u, plus enc = (1 − s)·ȳ_train + s·(mean y of the row\'s level over ALL rows): target encoding before the split' },
    /* feature engineering: the raw data are the same for every variant of an attribute; step 5 builds different columns */
    scnone: { x: 'x₁ = 10u₁ (0–10); x₂ = 1000 + 4000u₂ (and one row at 30 000); step 5: no scaling', y: 'y = 2 + 1.5x₁ + 0.002x₂ + ε' }, scstd: { x: 'same raw x₁, x₂; step 5: (x − mean) / sd', y: 'y = 2 + 1.5x₁ + 0.002x₂ + ε' }, scminmax: { x: 'same raw x₁, x₂; step 5: (x − min) / (max − min)', y: 'y = 2 + 1.5x₁ + 0.002x₂ + ε' }, scrobust: { x: 'same raw x₁, x₂; step 5: (x − median) / IQR', y: 'y = 2 + 1.5x₁ + 0.002x₂ + ε' },
    xtnone: { x: 'x = e^(0.9 + 0.7z) (right-skewed); used as it is', y: 'y = 2 + 3·ln x + ε' }, xtlog: { x: 'same raw x; step 5: ln x', y: 'y = 2 + 3·ln x + ε' }, xtsqrt: { x: 'same raw x; step 5: √x', y: 'y = 2 + 3·ln x + ε' }, xtboxcox: { x: 'same raw x; step 5: Box-Cox (x^λ − 1)/λ, λ from the training rows', y: 'y = 2 + 3·ln x + ε' }, xtyj: { x: 'same raw x; step 5: Yeo-Johnson, λ from the training rows', y: 'y = 2 + 3·ln x + ε' },
    ytnone: { e: 'multiplicative: e^(0.15·max(σ, 0.5)·z)', y: 'y = e^(0.6 + 0.22x) × noise; modelled as it is' }, ytlog: { e: 'multiplicative: e^(0.15·max(σ, 0.5)·z)', y: 'same raw y; step 5: the model is fitted to ln y' }, ytboxcox: { e: 'multiplicative: e^(0.15·max(σ, 0.5)·z)', y: 'same raw y; step 5: Box-Cox of y, λ from the training rows' },
    deg1: { x: 'x = 10u sorted; column z = (x − x̄)/s', y: 'y = 2 + 1.5x + 0.25(x − 5)² − 0.06(x − 5)³ + ε' }, deg2: { x: 'same raw x; columns z, z²', y: 'y = 2 + 1.5x + 0.25(x − 5)² − 0.06(x − 5)³ + ε' }, deg3: { x: 'same raw x; columns z, z², z³', y: 'y = 2 + 1.5x + 0.25(x − 5)² − 0.06(x − 5)³ + ε' }, deg5: { x: 'same raw x; columns z … z⁵', y: 'y = 2 + 1.5x + 0.25(x − 5)² − 0.06(x − 5)³ + ε' }, deg10: { x: 'same raw x; columns z … z¹⁰', y: 'y = 2 + 1.5x + 0.25(x − 5)² − 0.06(x − 5)³ + ε' },
    intnone: { x: 'x₁ = 10u₁, x₂ = 10u₂; columns x₁, x₂', y: 'y = 2 + 1.5x₁ + 1.0x₂ + 0.3x₁x₂ + ε' }, intx: { x: 'same raw x₁, x₂; step 5 adds x₁·x₂', y: 'y = 2 + 1.5x₁ + 1.0x₂ + 0.3x₁x₂ + ε' },
    spnone: { x: 'x = 10u sorted; column x', y: 'y = 2 + 8(1 − e^(−x/3)) + 0.6σz' }, sp1: { x: 'same raw x; step 5 adds h₁ = max(0, x − 5)', y: 'y = 2 + 8(1 − e^(−x/3)) + 0.6σz' }, spmany: { x: 'same raw x; step 5 adds hinges at 2.5, 5, 7.5', y: 'y = 2 + 8(1 − e^(−x/3)) + 0.6σz' },
    binnone: { x: 'x = 10u² sorted (bunched near 0); column x', y: 'y = 2 + 10 / (1 + e^(−1.8(x − 4))) + 0.6σz' }, binwidth: { x: 'same raw x; step 5: 5 equal-width bins → 4 columns bin_2 … bin_5', y: 'y = 2 + 10 / (1 + e^(−1.8(x − 4))) + 0.6σz' }, binquant: { x: 'same raw x; step 5: 5 quantile bins → 4 columns', y: 'y = 2 + 10 / (1 + e^(−1.8(x − 4))) + 0.6σz' },
    encoh: { x: 'x = 10u and region (text: East, North, South, West); step 5: one-hot, East dropped', y: 'y = 2 + 1.5x + (0, 3, −2, 5 by region) + ε' }, encall: { x: 'same raw data; step 5: one-hot, all four kept', y: 'y = 2 + 1.5x + (0, 3, −2, 5 by region) + ε' }, encord: { x: 'same raw data; step 5: code(region) = 0, 1, 2, 3', y: 'y = 2 + 1.5x + (0, 3, −2, 5 by region) + ε' }, enctarget: { x: 'same raw data; step 5: te(region) = mean y of the level (training rows)', y: 'y = 2 + 1.5x + (0, 3, −2, 5 by region) + ε' },
    cenraw: { x: 'x = 20 + 10u sorted; columns x, x² (no scaling)', y: 'y = 2 + 1.5(x − 25) + 0.2(x − 25)² + ε' }, cencent: { x: 'same raw x; columns xc = x − x̄, xc² (no scaling)', y: 'y = 2 + 1.5(x − 25) + 0.2(x − 25)² + ε' },
    selall: { x: 'x₁ … x₄ = 10u, x₅ = x₁ + 0.3z, n₁ … n₅ = 10u (noise); all 10 kept', y: 'y = 2 + 1.5x₁ + 1.0x₂ − 0.8x₃ + 0.5x₄ + ε' }, selfwd: { x: 'same 10 candidates; step 5 keeps the forward-selected ones', y: 'y = 2 + 1.5x₁ + 1.0x₂ − 0.8x₃ + 0.5x₄ + ε' }, selbwd: { x: 'same 10 candidates; backward elimination', y: 'y = 2 + 1.5x₁ + 1.0x₂ − 0.8x₃ + 0.5x₄ + ε' }, selstep: { x: 'same 10 candidates; stepwise', y: 'y = 2 + 1.5x₁ + 1.0x₂ − 0.8x₃ + 0.5x₄ + ε' }, sellasso: { x: 'same 10 candidates; lasso with CV λ', y: 'y = 2 + 1.5x₁ + 1.0x₂ − 0.8x₃ + 0.5x₄ + ε' }, selvif: { x: 'same 10 candidates; VIF < 5', y: 'y = 2 + 1.5x₁ + 1.0x₂ − 0.8x₃ + 0.5x₄ + ε' }, selp: { x: 'same 10 candidates; one-shot p < 0.05', y: 'y = 2 + 1.5x₁ + 1.0x₂ − 0.8x₃ + 0.5x₄ + ε' },
    /* model formulation: the data stay the same within an attribute; the model changes (written in the y row) */
    intin: { x: 'x = 10u sorted', y: 'y = 6 + 1.0x + ε; fit ŷ = b + w·x' }, intorigin: { x: 'x = 10u sorted', y: 'y = 6 + 1.0x + ε; fit ŷ = w·x (no intercept)' },
    mtsimple: { x: 'x₁ = 10u₁ sorted, x₂ = 10u₂; model uses x₁ only', e: 'ε: spread 0.3 + 0.17x₁, AR(1) with ρ = 0.6', y: 'y = 2 + x₁ + x₂ + 0.1x₁² + ε; OLS' }, mtmultiple: { x: 'same x₁, x₂; model uses both', e: 'ε: spread 0.3 + 0.17x₁, AR(1) with ρ = 0.6', y: 'y = 2 + x₁ + x₂ + 0.1x₁² + ε; OLS' },
    mtpoly: { x: 'same x₁, x₂, plus x₁²', e: 'ε: spread 0.3 + 0.17x₁, AR(1) with ρ = 0.6', y: 'y = 2 + x₁ + x₂ + 0.1x₁² + ε; OLS' }, mtwls: { x: 'same x₁, x₂, x₁²', e: 'ε: spread 0.3 + 0.17x₁, AR(1) with ρ = 0.6', y: 'y = 2 + x₁ + x₂ + 0.1x₁² + ε; WLS with ω = 1/σ̂²' }, mtgls: { x: 'same x₁, x₂, x₁²', e: 'ε: spread 0.3 + 0.17x₁, AR(1) with ρ = 0.6', y: 'y = 2 + x₁ + x₂ + 0.1x₁² + ε; GLS (Prais–Winsten)' },
    rbols: { x: 'x = 10u sorted; last row moved to x = 10 + 4s', y: 'y = 2 + 1.5x + ε; every 12th row +s(12 + 3|z|), last row −10s; OLS' }, rbhuber: { x: 'same x', y: 'same contaminated y; Huber IRLS (c = 1.345)' }, rbransac: { x: 'same x', y: 'same contaminated y; RANSAC (100 trials)' }, rbtheil: { x: 'same x', y: 'same contaminated y; Theil–Sen' }, rbquant: { x: 'same x', y: 'same contaminated y; median regression' },
    rgnone: { x: 'x₁–x₄ = 5 + 2(0.95f₁ + 0.31z), x₅–x₈ = 5 + 2(0.6f₂ + 0.8z)', e: 'ε = 1.5σz', y: 'y = 2 + 1.0x₁ + 0.5x₂ + 0.8x₅ + 0.3x₈ + ε; OLS' }, rgridge: { y: 'same y; ridge, λ by 5-fold CV' }, rglasso: { y: 'same y; lasso, λ by 5-fold CV' }, rgenet: { y: 'same y; elastic net α = 0.5, λ by CV' },
    lam0: { x: 'x₁–x₄ = 5 + 2(0.95f₁ + 0.31z), x₅–x₈ = 5 + 2(0.6f₂ + 0.8z)', e: 'ε = 1.5σz', y: 'y = 2 + 1.0x₁ + 0.5x₂ + 0.8x₅ + 0.3x₈ + ε; ridge λ = 0' }, lamsmall: { y: 'same y; ridge λ = 0.1' }, lamcv: { y: 'same y; ridge λ by CV' }, lamlarge: { y: 'same y; ridge λ = 300' }, lamhuge: { y: 'same y; ridge λ = 30 000' },
    alridge: { x: 'x₁–x₄ = 5 + 2(0.95f₁ + 0.31z), x₅–x₈ = 5 + 2(0.6f₂ + 0.8z)', e: 'ε = 1.5σz', y: 'y = 2 + 1.0x₁ + 0.5x₂ + 0.8x₅ + 0.3x₈ + ε; α = 0' }, albal: { y: 'same y; α = 0.5' }, allasso: { y: 'same y; α = 1' },
    pbno: { x: 'x₁, x₂, x₃ = 10u', y: 'y = 50 + 1.5x₁ + 1.0x₂ − 0.5x₃ + ε; ridge λ = 10, intercept free' }, pbyes: { x: 'x₁, x₂, x₃ = 10u', y: 'y = 50 + 1.5x₁ + 1.0x₂ − 0.5x₃ + ε; ridge λ = 10, intercept penalised' },
    lfmse: { x: 'x = 10u sorted', e: 'ε = σz, plus s(8 + 4|z₂|) on rows with u₂ < 0.12', y: 'y = 2 + 1.5x + ε; loss: MSE' }, lfmae: { y: 'same y; loss: MAE' }, lfhuber: { y: 'same y; loss: Huber (c = 1.345)' }, lfquant: { y: 'same y; loss: pinball, q = 0.9' }, lflogcosh: { y: 'same y; loss: log-cosh' },
    pnnone: { x: 'x₁–x₄ = 5 + 2(0.95f₁ + 0.31z), x₅–x₈ = 5 + 2(0.6f₂ + 0.8z)', e: 'ε = 1.5σz', y: 'y = 2 + 1.0x₁ + 0.5x₂ + 0.8x₅ + 0.3x₈ + ε; loss: SSE' }, pnl2: { y: 'same y; loss: SSE + λΣw̃²' }, pnl1: { y: 'same y; loss: SSE/2N + λΣ|w̃|' }, pnl1l2: { y: 'same y; loss: SSE/2N + λ(½Σ|w̃| + ¼Σw̃²)' },
    ofpcr: { x: 'x₁–x₄ = 5 + 2(0.95f₁ + 0.31z), x₅–x₈ = 5 + 2(0.6f₂ + 0.8z)', e: 'ε = 1.5σz', y: 'y = 2 + 1.0x₁ + 0.5x₂ + 0.8x₅ + 0.3x₈ + ε; PCR, k by CV' }, ofpls: { y: 'same y; PLS, k by CV' }, ofbayes: { y: 'same y; Bayesian, prior N(0, 1)' },
  };
  const recipeOf = (a, v) => { const B = a.id === 'multicollinearity' ? BASE.two : BASE.one, b0 = R[a.variants[0].id] || {}; const base = Object.assign({}, B, b0); return { base, cur: Object.assign({}, B, a.variants[0].id in R && MF.has(v.id) ? b0 : {}, R[v.id] || {}) }; };

  /* data-driven comparison of columns */
  function columns(d){
    const cols = [];
    d.names.forEach((nm, j) => { if (j) cols.push({ key: nm, label: nm, vals: d.X.map(r => r[j]) }); });
    const eps = SIG.trueErr(d); if (eps) cols.push({ key: 'ε', label: 'ε (true error)', vals: eps });
    cols.push({ key: 'y', label: 'y', vals: d.y });
    return cols;
  }
  function diff(cur, base){
    const cc = columns(cur.d), bc = columns(base.d), out = [], om = cur.d.orig;
    if (om) bc.forEach(b => { b.vals = om.map(i => b.vals[i]); });
    cc.forEach(c => { const b = bc.find(x => x.key === c.key);
      if (!b) { out.push({ ...c, status: 'new' }); return; }
      const m = Math.min(c.vals.length, b.vals.length); let mx = 0; for (let i = 0; i < m; i++) mx = Math.max(mx, Math.abs(c.vals[i] - b.vals[i]));
      out.push({ ...c, base: b.vals, status: mx > 1e-9 || c.vals.length !== b.vals.length ? 'changed' : 'same', maxd: mx }); });
    bc.forEach(b => { if (!cc.find(c => c.key === b.key)) out.push({ ...b, base: b.vals, vals: null, status: 'removed' }); });
    return out;
  }

  function chart(parent, title, height, draw){ const c = new Chart(parent, { title, height }); c.wrap.classList.add('mini'); c.drawFn = () => draw(c); c.drawFn(); return c; }
  const rng = arrs => { const v = arrs.flat().filter(isFinite); let lo = Math.min(...v), hi = Math.max(...v); if (!(hi > lo)) { lo -= 1; hi += 1; } return [lo, hi]; };

  function trail(ctx){
    const { cur, base, a, v, inf } = ctx, j = cur.d.focus[0], jb = (k => k < 0 && cur.d.fe ? 1 : k)(GEN.colIn(base.d.names, cur.d.names[j])), f = cur.f, fb = base.f;
    const diagName = { fitted: 'Residuals vs fitted', order: 'Residuals in order', qq: 'Q–Q', x1x2: 'x₁ vs x₂' }[a.diag] || 'Residuals vs fitted';
    const PA = ctx.P && ctx.P.alt, PB = ctx.Pb && ctx.Pb.alt;
    const vif = x => x.vif?.length ? Math.max(...x.vif) : NaN, fmtI = t => isFinite(t) ? n(t, 1) : '∞';
    const M = [
      ['Slope of ' + cur.d.names[j], jb > 0 ? fb.w[jb] : NaN, f.w[j], t => isFinite(t) ? n(t, 3) : '—', (x, y) => Math.abs(x - y) > 0.1 * Math.abs(x) + 0.05],
      ['Classical SE of that slope', jb > 0 ? fb.se[jb] : NaN, f.se[j], t => isFinite(t) ? n(t, 4) : 'undefined', (x, y) => !isFinite(y) || Math.abs(y / x - 1) > 0.25],
      ['R²', fb.R2, f.R2, t => n(t, 3), (x, y) => Math.abs(x - y) > 0.05],
      ['RESET p (shape)', base.dg.reset?.p, cur.dg.reset?.p, pf, (x, y) => (x < 0.05) !== (y < 0.05)],
      ['Breusch–Pagan p (spread)', base.dg.bp?.p, cur.dg.bp?.p, pf, (x, y) => (x < 0.05) !== (y < 0.05)],
      ['Durbin–Watson (≈ 2 is healthy)', base.dg.dw, cur.dg.dw, t => n(t, 2), (x, y) => Math.abs(x - y) > 0.4],
      ['Jarque–Bera p (bell shape)', base.dg.jb.p, cur.dg.jb.p, pf, (x, y) => (x < 0.05) !== (y < 0.05)],
      ['Largest VIF', vif(base.dg), vif(cur.dg), fmtI, (x, y) => !isFinite(y) || y > 2 * x],
      ...(PA || PB ? [['Slope of ' + cur.d.names[j] + ", this variant's own model", jb > 0 ? (PB ? PB.wOrig[jb] : ctx.Pb.wOrig[jb]) : NaN, PA ? PA.wOrig[j] : ctx.P.wOrig[j], t => isFinite(t) ? n(t, 3) : '—', (x, y) => Math.abs(x - y) > 0.1 * Math.abs(x) + 0.05],
        ["Test RMSE, this variant's own model", PB ? PB.rmseTe : ctx.Pb.rmseTe, PA ? PA.rmseTe : ctx.P.rmseTe, t => n(t, 3), (x, y) => Math.abs(y / x - 1) > 0.05]] : []),
      ['Condition number κ (eigenvalues of X̃ᵀX̃, step 6)', base.gram?.kappa, cur.gram?.kappa, t => isFinite(t) ? n(t, 0) : '∞', (x, y) => !isFinite(y) || y > 3 * x]
    ];
    const rows = M.map(([lab, b, c, fm, ch]) => { const moved = isFinite(b) && (isFinite(c) ? ch(b, c) : true); return `<tr class="${moved ? 'hl' : ''}"><td>${lab}</td><td>${fm(b)}</td><td>${fm(c)}</td><td>${moved ? '<b>changed</b>' : 'about the same'}</td></tr>`; }).join('');
    const steps = STEPS.filter(st => inf[st.id] && inf[st.id][0] !== 'none').map(st => { const L = LEVELS[inf[st.id][0]];
      return `<li><a href="#step-${st.id}" data-goto="step-${st.id}"><span class="lv ${L.cls}"><b>${L.glyph}</b></span> Process step ${st.id}, ${esc(st.title)}</a>: ${esc(inf[st.id][1])}</li>`; }).join('');
    const quiet = STEPS.filter(st => !inf[st.id] || inf[st.id][0] === 'none').map(st => st.id).join(', ');
    const sub10 = { linearity: 0, homoscedasticity: 1, independence: 2, normality: 3, multicollinearity: 4, exogeneity: 0, outliers: 6, samplesize: 0, noise: 0, range: 0, irrelevant: 4, missing: 0, target: 3, categorical: 0, subgroups: 0, shift: 0, leakage: 4, robust: 5, intercept: 0, modeltype: 1, lossfn: 5 }[a.id] ?? 0, tests = ['RESET', 'Breusch–Pagan', 'Durbin–Watson', 'Jarque–Bera', 'VIF', "Cook's distance", 'the refit without the most influential row'];
    return `<div class="chg-cols"><div><h3>Where to look, in order</h3><ol class="chg-trail">
        <li><a href="#chg-data" data-goto="chg-data">The dataset table in section 2</a>: the changed column is tinted, so compare baseline and variant cell by cell.</li>
        <li><a href="#sig-part" data-goto="sig-part">Section 3, what it looks like</a>: the fingerprint, measured against the baseline.</li>
        <li><a href="#step-9a" data-goto="step-9a">Step 9a, the data and the fitted line</a>: the dots against the dashed baseline line${a.id === 'independence' && v.id !== 'dupes' ? ' (the points stay on one side of the line for long runs)' : ''}.</li>
        <li><a href="#sub-10-${v.id === 'dupes' ? 2 : sub10}" data-goto="sub-10-${v.id === 'dupes' ? 2 : sub10}">Step 10, ${tests[v.id === 'dupes' ? 2 : sub10]}</a>: the chart and test where this property is easiest to see${a.id === 'exogeneity' ? ' (and, the trap, where it does <i>not</i> show)' : ''}.</li>
        <li><a href="#step-11" data-goto="step-11">Step 11, the sampling distribution</a>: across 200 fresh datasets, compare the actual spread of the slope with the reported SE, and check the interval coverage.</li>
        ${steps}
        <li><a href="#notes" data-goto="notes">Interview notes</a>: the same story in plain words.</li></ol>
        <p class="chg-q">Steps this variant leaves untouched: ${quiet || 'none'}. That is often the interview point too.</p></div>
      <div><h3>Numbers, baseline → this variant</h3><div class="sig-tbl"><table><tr><th>quantity</th><th>baseline</th><th>this variant</th><th></th></tr>${rows}</table></div>
      ${cur.gram ? EIG.details(cur.gram.A, cur.d.names, `How the eigenvalues behind κ are calculated (this variant: κ = ${isFinite(cur.gram.kappa) ? n(cur.gram.kappa, 1) : '∞'})`) : ''}
      <p class="chg-q">All on the training rows: the same numbers the process steps show. "Changed" means it moved by a meaningful amount, or a test crossed p = 0.05.</p></div></div>`;
  }

  function render(el, ctx){
    const { cur, base, a, v, isBase, S } = ctx;
    if (isBase) { el.innerHTML = `<h2 id="chg-h">What changed and how to see it</h2><p class="hint-s">The baseline is selected, so nothing has been changed yet. Pick a variant on the web: this section will then show, cell by cell, what it altered in the data, what that looks like, and where in the process it shows up. Below is what healthy data look like.</p><div id="sig-part"></div>`; return []; }
    const FD = ctx.full ? ctx.full.cur : cur.d, FB = ctx.full ? ctx.full.base : base.d;
    const rc = recipeOf(a, v), D = diff({ d: FD }, { d: FB }), N = FD.y.length;
    const st = { same: 'unchanged', changed: 'changed', new: 'new column', removed: 'removed' };
    const ex_ = FD.extra ? `<tr><td>extra features</td><td colspan="2">${FD.extra} independent feature${FD.extra > 1 ? 's' : ''} (${FD.names.slice(-FD.extra).join(', ')}), each 10·u, with true coefficients ${'[' + GEN.EXTRA_BETA.slice(0, FD.extra).join(', ') + ']'} added to y. Identical in the baseline and the variant (the Features slider adds them).</td></tr>` : '';
    const recipe = ['x', 'e', 'y'].map(k => { const same = rc.base[k] === rc.cur[k];
      return `<tr class="${same ? '' : 'hl'}"><td>${{ x: 'inputs x', e: 'error ε', y: 'target y' }[k]}</td><td>${rc.base[k]}</td><td>${same ? '<span class="muted">same</span>' : rc.cur[k]}</td></tr>`; }).join('');
    const yCh = D.find(c => c.key === 'y'), eCh = D.find(c => c.key === 'ε'), xCh = D.filter(c => !['y', 'ε'].includes(c.key));
    const why = yCh?.status === 'changed' ? (eCh?.status === 'changed' && xCh.every(c => c.status === 'same') ? 'y changed only because ε changed: every x is identical.' : xCh.some(c => c.status !== 'same') && eCh?.status === 'same' ? 'y changed because the inputs changed.' : eCh?.status === 'same' && xCh.every(c => c.status === 'same') ? 'y changed because the rule linking x to y changed; x and ε are identical.' : 'Several ingredients changed together.') : 'y itself is unchanged: the change is in the inputs only.';
    const chips = D.map(c => `<span class="chg-chip ${c.status}">${esc(c.label)}: ${st[c.status]}</span>`).join('');
    const show = Math.min(N, 10), cols = D.filter(c => c.status !== 'removed');
    let head = '<tr><th>row</th>', body = '';
    cols.forEach(c => { head += c.status === 'changed' ? `<th>${esc(c.label)} baseline</th><th class="chg-c">${esc(c.label)} variant</th>` : `<th class="${c.status === 'new' ? 'chg-c' : ''}">${esc(c.label)}${c.status === 'new' ? ' (new)' : ''}</th>`; });
    if (yCh?.status === 'changed') head += '<th>Δy</th>';
    for (let i = 0; i < show; i++) {
      body += `<tr><td>${i + 1}</td>` + cols.map(c => c.status === 'changed' ? `<td>${c.base[i] != null ? n(c.base[i]) : '—'}</td><td class="chg-c">${n(c.vals[i])}</td>` : `<td class="${c.status === 'new' ? 'chg-c' : ''}">${n(c.vals[i])}</td>`).join('') +
        (yCh?.status === 'changed' ? `<td>${yCh.base[i] != null ? n(yCh.vals[i] - yCh.base[i]) : '—'}</td>` : '') + '</tr>';
    }
    if (N > show) body += `<tr class="gap"><td>⋮</td>${'<td>⋮</td>'.repeat((head.match(/<th/g) || []).length - 1)}</tr>`;
    el.innerHTML = `<h2 id="chg-h">What changed and how to see it: ${esc(a.name)} › ${esc(v.name)}</h2>
      <p class="hint-s">The variant and the baseline are built from the <b>same random numbers</b>. Whatever differs below is caused by this variant alone. Strength s = ${n(S.strength, 2)}${S.strength === 0 ? ': at 0 the variant equals the baseline, so move the Strength slider to see the change appear' : ''}.</p>
      <h3>1. In the recipe</h3><div class="sig-tbl"><table class="chg-rec"><tr><th></th><th>baseline</th><th>this variant</th></tr>${recipe}${ex_}</table></div>
      <h3 id="chg-data">2. In the dataset (all ${N} generated rows)</h3><p class="chg-chips">${chips}</p><p class="chg-q">${why}${cur.d.note ? ' ' + esc(cur.d.note) : ''}</p>
      <div class="sig-tbl"><table>${head}</tr>${body}</table></div>
      <div class="chg-pics"></div>
      <div id="sig-part"></div>
      <h3>4. Where it shows up in the process</h3>${trail(ctx)}`;
    const pics = el.querySelector('.chg-pics'), rowEl = document.createElement('div'); rowEl.className = 'pv-row'; pics.appendChild(rowEl);
    const out = [], x = FD.px, xb = FB.px;
    out.push(chart(rowEl, 'y: baseline (hollow) → this variant (filled)', 240, c => { c.begin(rng([x, xb]), rng([FD.y, FB.y]), FD.xName, 'y');
      if (x.length === xb.length) x.forEach((t, i) => c.line([[xb[i], FB.y[i]], [t, FD.y[i]]], C('--residual'), 1, null, 0.5));
      xb.forEach((t, i) => c.dot([t, FB.y[i]], C('--muted'), 3.2, true, 0.8)); x.forEach((t, i) => c.dot([t, FD.y[i]], C('--surface'), 3, false, 0.85)); c.end();
      c.legend([[C('--muted'), 'baseline'], [C('--surface'), 'this variant'], [C('--residual'), 'how each row moved']]); }));
    const ing = D.find(c => c.status === 'changed' && c.key !== 'y') || yCh;
    if (ing && ing.status === 'changed') out.push(chart(rowEl, `The changed ingredient, ${ing.label}, row by row`, 240, c => { const m = Math.min(ing.vals.length, ing.base.length);
      c.begin([0.5, m + 0.5], rng([ing.vals, ing.base]), 'row', ing.label); c.hline(0, C('--rule'));
      c.line(ing.base.slice(0, m).map((t, i) => [i + 1, t]), C('--muted'), 1.4, [4, 3]); c.line(ing.vals.slice(0, m).map((t, i) => [i + 1, t]), C('--surface'), 2);
      ing.vals.slice(0, m).forEach((t, i) => c.dot([i + 1, t], C('--surface'), 2.4, false, 0.9)); c.end(); c.legend([[C('--muted'), 'baseline', true], [C('--surface'), 'this variant']]); }));
    return out;
  }
  return { render, recipe: recipeOf };
})();
