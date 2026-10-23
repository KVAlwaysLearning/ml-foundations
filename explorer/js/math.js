/* ============================================================
   Math rendering with KaTeX.
   TX(tex)        -> HTML for a display formula (used for formula lines)
   MATH.typeset(root) -> walks visible text and turns symbols written
                     with Unicode (x̃, ŷ, x̄, eᵢ, e², Xᵀ, SSE_with, …) into
                     properly typeset math, so bars, hats, sub- and
                     superscripts are crisp and legible.
   Without KaTeX (offline) everything falls back to the plain text.
   ============================================================ */
const MATH = (() => {
  const ok = () => typeof katex !== 'undefined';
  const cache = new Map();
  function tex(src, display = false){
    if (!ok()) return null;
    const k = (display ? 'D' : 'I') + src; if (cache.has(k)) return cache.get(k);
    let h; try { h = katex.renderToString(src, { displayMode: display, throwOnError: false, strict: 'ignore' }); } catch (err) { h = null; }
    if (cache.size > 6000) cache.clear(); cache.set(k, h); return h;
  }

  const SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₊': '+', '₋': '-', 'ᵢ': 'i', 'ⱼ': 'j', 'ₖ': 'k', 'ₜ': 't', 'ₗ': 'l', 'ₙ': 'n', 'ₘ': 'm', 'ₓ': 'x', 'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ᵣ': 'r', 'ᵤ': 'u', 'ᵥ': 'v', 'ₚ': 'p', 'ₛ': 's', 'ₕ': 'h' };
  const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-', 'ᵀ': '\\top', 'ⁿ': 'n', 'ⁱ': 'i', 'ᵏ': 'k' };
  const GREEK = { 'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\varepsilon', 'η': '\\eta', 'θ': '\\theta', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu', 'ν': '\\nu', 'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau', 'χ': '\\chi', 'Σ': '\\Sigma' };
  const MARK = { '̂': 'hat', '̃': 'tilde', '̄': 'bar', '̅': 'bar' };
  const SUBC = Object.keys(SUB).join(''), SUPC = Object.keys(SUP).join(''), LET = 'A-Za-zα-ωΑ-Ω';
  // a token: base (letter with a mark | short word before "_" | letter or ")" followed by sub/sup), optional _word, then sub/sup chars
  const RE = new RegExp(`(?<![${LET}0-9_])(?:([${LET}])([\\u0302-\\u0305])|([${LET}]{1,5})(?=_[A-Za-z0-9])|([${LET}0-9)\\]])(?=[${SUBC}${SUPC}]))(?:_([A-Za-z0-9]+))?([${SUBC}${SUPC}]*)(?:_([A-Za-z0-9]+))?`, 'g');
  const letter = ch => GREEK[ch] || ch;
  function toTex(m, mb, mark, word, plain, us, tail, us2){
    let base = mb ? `\\${MARK[mark] === 'bar' ? 'bar' : MARK[mark] === 'hat' ? 'hat' : 'tilde'}{${letter(mb)}}` : word ? (word.length > 1 ? `\\mathrm{${word}}` : letter(word)) : letter(plain);
    if (mb && /[A-Z]/.test(mb) && MARK[mark] === 'tilde') base = `\\tilde{${mb}}`;
    const w = x => x ? (/^[0-9]+$/.test(x) || x.length === 1 ? x : `\\text{${x}}`) : '';
    let sub = w(us), sup = '';
    for (const ch of tail || '') { if (SUB[ch] != null) sub += SUB[ch]; else if (SUP[ch] != null) sup += SUP[ch]; }
    if (us2) sub += (sub ? ',' : '') + w(us2);
    return base + (sub ? `_{${sub}}` : '') + (sup ? `^{${sup}}` : '');
  }
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CANVAS', 'SVG', 'OPTION', 'SELECT', 'CODE', 'PRE']);
  function hidden(node, root){ for (let p = node.parentElement; p && p !== root.parentElement; p = p.parentElement) { if (p.tagName === 'DETAILS' && !p.open && !(node.parentElement.closest('summary') && node.parentElement.closest('summary').parentElement === p)) return true; if (SKIP.has(p.tagName) || p.classList?.contains('katex') || p.classList?.contains('no-tex')) return true; } return false; }
  function typeset(root){
    if (!ok() || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/[̂-̅À-ɏ₀-₉ᵢⱼₖₜₗₙₘₓₐₑₒᵣᵤᵥₚₛₕ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ᵀⁿⁱᵏ_]/.test(n.nodeValue) && !hidden(n, root)) nodes.push(n);
    for (const n of nodes) {
      const s = n.nodeValue.normalize('NFD'); RE.lastIndex = 0; let m, last = 0, frag = null;
      while ((m = RE.exec(s))) {
        if (!m[0]) { RE.lastIndex++; continue; }
        const h = tex(toTex(...m)); if (!h) continue;
        frag = frag || document.createDocumentFragment();
        if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index).normalize('NFC')));
        const sp = document.createElement('span'); sp.className = 'mth'; sp.innerHTML = h; frag.appendChild(sp); last = m.index + m[0].length;
      }
      if (frag) { if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last).normalize('NFC'))); n.parentNode.replaceChild(frag, n); }
    }
  }
  return { tex, typeset, ok };
})();
/* display formula; falls back to the TeX source in a readable form */
const TX = src => MATH.tex(src, true) || `<span class="tx-src">${src.replace(/\\(dfrac|frac|text|operatorname|mathrm|begin\{gathered\}|end\{gathered\}|qquad|quad|left|right|Big|big|,|;)/g, ' ').replace(/[{}\\]/g, '')}</span>`;
/* any number as Unicode subscript digits: 12 -> ₁₂ */
const subN = k => String(k).split('').map(ch => '₀₁₂₃₄₅₆₇₈₉'[+ch] ?? ch).join('');
