/* ============================================================
   Lab UI pieces: live matrix display, data editor, weight editor.
   ============================================================ */
function num(v, d = 3){
  if (!isFinite(v)) return v > 0 ? '∞' : '−∞';
  const r = Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v;
  let s = r.toFixed(d);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('-', '−');
}

/* Render a matrix or vector as a bracketed table.
   opts: name, formula, shape (override), rowHi (index), colLabels, rowLabels, digits, note, tone */
function mx(M, opts = {}){
  const rows = Array.isArray(M[0]) ? M : M.map(v => [v]);
  const r = rows.length, c = rows[0].length, d = opts.digits ?? 3;
  let h = `<div class="mx${opts.tone ? ' tone-' + opts.tone : ''}">`;
  h += `<div class="mx-head"><b>${opts.name || ''}</b><span>${opts.shape || (r + '×' + c)}</span></div>`;
  if (opts.formula) h += `<div class="mx-f">${opts.formula}</div>`;
  h += `<div class="mx-body">`;
  if (opts.rowLabels) h += `<div class="mx-rl">${opts.colLabels ? '<i></i>' : ''}${opts.rowLabels.map((l, i) => `<i${i === opts.rowHi ? ' class="hi"' : ''}>${l}</i>`).join('')}</div>`;
  h += `<table class="mx-t">`;
  if (opts.colLabels) h += `<thead><tr>${opts.colLabels.map(l => `<th>${l}</th>`).join('')}</tr></thead>`;
  h += `<tbody>${rows.map((row, i) => `<tr data-row="${opts.selectable ? i : ''}"${i === opts.rowHi ? ' class="hi"' : ''}>${row.map(v => `<td>${typeof v === 'number' ? num(v, d) : v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  h += `</div>${opts.note ? `<div class="mx-note">${opts.note}</div>` : ''}</div>`;
  return h;
}
function scalarBox(name, value, formula, tone){
  return `<div class="mx${tone ? ' tone-' + tone : ''}"><div class="mx-head"><b>${name}</b><span>scalar</span></div>${formula ? `<div class="mx-f">${formula}</div>` : ''}<div class="mx-scalar">${value}</div></div>`;
}
function mxGrid(parent, title){
  const wrap = document.createElement('div'); wrap.className = 'mx-wrap';
  if (title) wrap.innerHTML = `<div class="mx-title">${title}</div>`;
  const g = document.createElement('div'); g.className = 'mx-grid'; wrap.appendChild(g);
  parent.appendChild(wrap);
  g.addEventListener('click', e => { const tr = e.target.closest('tr[data-row]'); if (tr && tr.dataset.row !== '') LAB.select(+tr.dataset.row); });
  return g;
}

/* Editable data table bound to LAB */
function dataEditor(parent){
  const box = document.createElement('div'); box.className = 'lab-editor';
  box.innerHTML = `<div class="ed-head"><b>Data</b><span>each row is one observation</span></div>
    <div class="ctl"><label>Load a dataset</label><select class="ed-preset"></select></div>
    <div class="ed-tablewrap"><table class="ed-table"><thead><tr><th>row</th><th>x₁</th><th>x₂</th><th>y</th><th></th></tr></thead><tbody></tbody></table></div>
    <div class="btns"><button type="button" class="btn ghost ed-add">Add row</button></div>`;
  parent.appendChild(box);
  const sel = $('.ed-preset', box), tb = $('tbody', box);
  sel.innerHTML = Object.entries(LAB_PRESETS).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join('') + `<option value="custom" disabled>Your edited data</option>`;
  sel.onchange = () => LAB.load(sel.value);
  $('.ed-add', box).onclick = () => LAB.addRow();

  function build(d){
    tb.innerHTML = d.S.rows.map((r, i) => `<tr data-i="${i}"><td class="ri"><button type="button" class="rowpick" aria-label="Highlight row ${i + 1}">${i + 1}</button></td>` +
      r.map((v, j) => `<td><input type="number" step="0.1" inputmode="decimal" value="${v}" data-j="${j}" aria-label="row ${i + 1} ${['x1','x2','y'][j]}"></td>`).join('') +
      `<td><button type="button" class="rowdel" aria-label="Remove row ${i + 1}">×</button></td></tr>`).join('');
  }
  tb.addEventListener('input', e => {
    const inp = e.target.closest('input'); if (!inp) return;
    const v = parseFloat(inp.value); if (!isFinite(v)) return;
    LAB.setCell(+inp.closest('tr').dataset.i, +inp.dataset.j, v);
  });
  tb.addEventListener('click', e => {
    const tr = e.target.closest('tr'); if (!tr) return;
    if (e.target.closest('.rowdel')) LAB.removeRow(+tr.dataset.i);
    else if (e.target.closest('.rowpick')) LAB.select(+tr.dataset.i);
  });
  const unsub = LAB.subscribe((d, structural) => {
    if (structural || tb.children.length !== d.N) build(d);
    else [...tb.querySelectorAll('input')].forEach(inp => {
      if (inp === document.activeElement) return;
      const i = +inp.closest('tr').dataset.i, j = +inp.dataset.j; if (+inp.value !== d.S.rows[i][j]) inp.value = d.S.rows[i][j];
    });
    [...tb.children].forEach((tr, i) => tr.classList.toggle('hi', i === d.S.sel));
    sel.value = d.S.preset;
  });
  return unsub;
}

/* Weight sliders bound to LAB */
function weightEditor(parent, { title = 'Weights w = [b, w₁, w₂]', fitLabel = 'Fit by least squares' } = {}){
  const box = document.createElement('div'); box.className = 'lab-editor';
  box.innerHTML = `<div class="ed-head"><b>${title}</b><span>drag, or type a value</span></div>`;
  parent.appendChild(box);
  const specs = [['b', -10, 10], ['w₁', -5, 5], ['w₂', -5, 5]], inputs = [];
  specs.forEach(([name, lo, hi], i) => {
    const row = document.createElement('div'); row.className = 'wrow';
    row.innerHTML = `<label>${name}</label><input type="range" min="${lo}" max="${hi}" step="0.01" aria-label="${name}"><input type="number" step="0.1" aria-label="${name} value">`;
    const [rg, nb] = row.querySelectorAll('input');
    rg.oninput = () => LAB.setWi(i, +rg.value);
    nb.oninput = () => { const v = parseFloat(nb.value); if (isFinite(v)) LAB.setWi(i, v); };
    inputs.push([rg, nb]); box.appendChild(row);
  });
  const b = document.createElement('div'); b.className = 'btns';
  b.innerHTML = `<button type="button" class="btn">${fitLabel}</button><button type="button" class="btn ghost">Set all to 0</button>`;
  const [fit, zero] = b.querySelectorAll('button');
  fit.onclick = () => LAB.fit(); zero.onclick = () => LAB.setW([0, 0, 0]);
  box.appendChild(b);
  return LAB.subscribe(d => inputs.forEach(([rg, nb], i) => {
    const v = d.w[i];
    if (rg !== document.activeElement) rg.value = v;
    if (nb !== document.activeElement) nb.value = +v.toFixed(3);
  }));
}
