/* Shared helpers: DOM, math, controls. Also creates the VIZ registry that figure files add to. */
const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const VIZ = {};

/* ============================================================
   Small math helpers
   ============================================================ */
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gaussFn(rng){ return () => { let u = 0, v = 0; while (u === 0) u = rng(); v = rng(); return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v); }; }
function solve(A, b){ // Gaussian elimination with partial pivoting, small systems
  const n = b.length, M = A.map((r,i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c+1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c+1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n-1; r >= 0; r--) { let s = M[r][n]; for (let k = r+1; k < n; k++) s -= M[r][k]*x[k]; x[r] = s / M[r][r]; }
  return x;
}
function eig2(a, b, d){ // symmetric [[a,b],[b,d]] -> l1>=l2, unit eigenvectors
  const tr = a + d, det = a*d - b*b, disc = Math.sqrt(Math.max(0, tr*tr/4 - det));
  const l1 = tr/2 + disc, l2 = tr/2 - disc;
  let v1;
  if (Math.abs(b) > 1e-12) v1 = [l1 - d, b]; else v1 = a >= d ? [1,0] : [0,1];
  const n = Math.hypot(v1[0], v1[1]); v1 = [v1[0]/n, v1[1]/n];
  return { l1, l2, v1, v2: [-v1[1], v1[0]] };
}
function erfc(x){ const z = Math.abs(x), t = 1/(1+0.5*z);
  const r = t*Math.exp(-z*z-1.26551223+t*(1.00002368+t*(0.37409196+t*(0.09678418+t*(-0.18628806+t*(0.27886807+t*(-1.13520398+t*(1.48851587+t*(-0.82215223+t*0.17087277)))))))));
  return x >= 0 ? r : 2 - r; }
const fmt = (x, d=2) => (Math.abs(x) < 0.5*Math.pow(10,-d) ? 0 : x).toFixed(d).replace('-', '−');
const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- control builders ---------- */
function slider(parent, {label, min, max, step, value, digits=2, onInput}){
  const d = document.createElement('div'); d.className = 'ctl';
  const id = 'c' + Math.random().toString(36).slice(2,8);
  d.innerHTML = `<label for="${id}">${label}<output>${fmt(value, digits)}</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">`;
  const inp = $('input', d), out = $('output', d);
  inp.addEventListener('input', () => { out.textContent = fmt(+inp.value, digits); onInput(+inp.value); });
  parent.appendChild(d);
  return { set(v){ inp.value = v; out.textContent = fmt(+inp.value, digits); }, get(){ return +inp.value; }, el:d };
}
function select(parent, {label, options, value, onChange}){
  const d = document.createElement('div'); d.className = 'ctl';
  const id = 'c' + Math.random().toString(36).slice(2,8);
  d.innerHTML = `<label for="${id}">${label}</label><select id="${id}">${options.map(([v,t]) => `<option value="${v}"${v===value?' selected':''}>${t}</option>`).join('')}</select>`;
  $('select', d).addEventListener('change', e => onChange(e.target.value));
  parent.appendChild(d); return d;
}
function checks(parent, items, state, onChange){
  const d = document.createElement('div'); d.className = 'ctl checks';
  for (const [key, text] of items) {
    const l = document.createElement('label');
    l.innerHTML = `<input type="checkbox"${state[key] ? ' checked' : ''}> ${text}`;
    $('input', l).addEventListener('change', e => { state[key] = e.target.checked; onChange(); });
    d.appendChild(l);
  }
  parent.appendChild(d); return d;
}
function buttons(parent, items){
  const d = document.createElement('div'); d.className = 'ctl btns';
  for (const [text, fn, ghost] of items) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (ghost ? ' ghost' : ''); b.textContent = text; b.onclick = fn; d.appendChild(b);
  }
  parent.appendChild(d); return d;
}
function panel(fig, cls){ const d = document.createElement('div'); d.className = cls; fig.appendChild(d); return d; }
function caption(fig, keys, text){
  const c = document.createElement('figcaption');
  c.innerHTML = `<div class="key">${keys.map(([v,t]) => `<span style="color:var(${v})">${t}</span>`).join('')}</div>${text}`;
  fig.appendChild(c);
}
