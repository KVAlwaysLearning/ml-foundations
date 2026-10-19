/* ============================================================
   Flowchart of the whole process as SVG. Boxes are coloured by
   the selected variant's influence; click a box to jump to it.
   ============================================================ */
function flowSVG(lvOf){
  const W = 150, H = 76, GX = 40, X0 = 20, Y1 = 44, Y2 = 230, col = k => X0 + k * (W + GX);
  const short = { 1: 'Data collection', 2: 'Cleaning', 3: 'Explore (EDA)', 4: 'Train / test split', 5: 'Feature engineering', 6: 'Design matrix', 7: 'Model ŷ = X̃w̃',
    8: 'Loss L', '9a': 'Closed form', '9b': 'Gradient descent', 10: 'Diagnostics', 11: 'Inference', 12: 'Test evaluation', 13: 'Interpretation' };
  const kind = { 1: 'data', 2: 'changes data', 3: 'looks only', 4: 'changes data', 5: 'changes data', 6: 'changes data', 7: 'defines', 8: 'defines', '9a': 'learns w̃', '9b': 'learns w̃', 10: 'looks only', 11: 'looks only', 12: 'looks only', 13: 'reports' };
  const pos = { 1: [col(0), Y1], 2: [col(1), Y1], 3: [col(2), Y1], 4: [col(3), Y1], 5: [col(4), Y1], 6: [col(5), Y1], 7: [col(6), Y1],
    8: [col(6), Y2], 10: [col(4), Y2], 11: [col(3), Y2], 12: [col(2), Y2], 13: [col(1), Y2] };
  const p9a = [col(5), Y2 - 8], p9b = [col(5), Y2 + H / 2 + 4];
  const box = (id, x, y, w, h) => { const L = LEVELS[lvOf(id)];
    return `<g class="fbox ${L.cls}" data-jump="${id}" tabindex="0" role="button" aria-label="Step ${id}: ${short[id]}, ${L.label}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>
      <text x="${x + 10}" y="${y + 19}" class="fn">${L.glyph} ${id}</text>
      <text x="${x + 10}" y="${y + (h > 50 ? 42 : 34)}" class="ft">${short[id]}</text>
      ${h > 50 ? `<text x="${x + 10}" y="${y + 62}" class="fk">${kind[id]}</text>` : ''}</g>`; };
  const arrow = (x1, y1, x2, y2, label, dy = -7, cls = '') => `<path d="M${x1},${y1} L${x2},${y2}" class="fa ${cls}" marker-end="url(#ah)"/>` +
    (label ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 + dy}" class="fl" text-anchor="middle">${label}</text>` : '');
  let s = `<svg viewBox="0 0 ${col(6) + W + 20} ${Y2 + H + 70}" class="flow" role="group" aria-label="Flowchart of the regression process">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="fah"/></marker></defs>`;
  const lab1 = ['raw table', 'checked table', 'same table', 'train | test', 'x̃ = (x − μ)/s', 'X̃, y'];
  for (let k = 0; k < 6; k++) s += arrow(col(k) + W, Y1 + H / 2, col(k + 1) - 3, Y1 + H / 2, '') + `<text x="${col(k) + W + GX / 2}" y="${Y1 - 12}" class="fl" text-anchor="middle">${lab1[k]}</text><path d="M${col(k) + W + GX / 2},${Y1 - 8} L${col(k) + W + GX / 2},${Y1 + H / 2 - 4}" class="fa tick"/>`;
  s += arrow(col(6) + W / 2, Y1 + H, col(6) + W / 2, Y2 - 3, 'ŷ for every row', 0);
  s += arrow(col(6), Y2 + H / 2, col(5) + W + 3, Y2 + H / 2, '') + `<text x="${col(5) + W + GX / 2}" y="${Y2 + H + 22}" class="fl" text-anchor="middle">${'L(w̃)'}</text><path d="M${col(5) + W + GX / 2},${Y2 + H + 10} L${col(5) + W + GX / 2},${Y2 + H / 2 + 4}" class="fa tick"/>`;
  s += arrow(col(5), Y2 + H / 2, col(4) + W + 3, Y2 + H / 2, '') + `<text x="${col(4) + W + GX / 2}" y="${Y2 + H + 22}" class="fl" text-anchor="middle">${'w̃*, e'}</text><path d="M${col(4) + W + GX / 2},${Y2 + H + 10} L${col(4) + W + GX / 2},${Y2 + H / 2 + 4}" class="fa tick"/>`;
  s += arrow(col(4), Y2 + H / 2, col(3) + W + 3, Y2 + H / 2, '') + `<text x="${col(3) + W + GX / 2}" y="${Y2 + H + 22}" class="fl" text-anchor="middle">${'checks'}</text><path d="M${col(3) + W + GX / 2},${Y2 + H + 10} L${col(3) + W + GX / 2},${Y2 + H / 2 + 4}" class="fa tick"/>`;
  s += arrow(col(3), Y2 + H / 2, col(2) + W + 3, Y2 + H / 2, '') + `<text x="${col(2) + W + GX / 2}" y="${Y2 + H + 22}" class="fl" text-anchor="middle">${'SE, CI'}</text><path d="M${col(2) + W + GX / 2},${Y2 + H + 10} L${col(2) + W + GX / 2},${Y2 + H / 2 + 4}" class="fa tick"/>`;
  s += arrow(col(2), Y2 + H / 2, col(1) + W + 3, Y2 + H / 2, '') + `<text x="${col(1) + W + GX / 2}" y="${Y2 + H + 22}" class="fl" text-anchor="middle">${'test RMSE'}</text><path d="M${col(1) + W + GX / 2},${Y2 + H + 10} L${col(1) + W + GX / 2},${Y2 + H / 2 + 4}" class="fa tick"/>`;
  // feedback: diagnostics fail -> back to feature engineering
  s += `<path d="M${col(4) + W / 2 + 22},${Y2} L${col(4) + W / 2 + 22},${Y1 + H + 3}" class="fa back" marker-end="url(#ah)"/>
    <text x="${col(4) + W / 2 + 30}" y="${(Y1 + H + Y2) / 2 + 4}" class="fl back">a check fails → fix and refit</text>`;
  // test rows held from step 4 to step 12
  s += `<path d="M${col(3) + 30},${Y1 + H} C${col(3) + 30},${Y1 + H + 60} ${col(2) + 40},${Y2 - 60} ${col(2) + 40},${Y2 - 3}" class="fa hold" marker-end="url(#ah)"/>
    <text x="${col(2) + 48}" y="${Y2 - 34}" class="fl hold" text-anchor="start">test rows wait here</text>`;
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13]) s += box(id, pos[id][0], pos[id][1], W, H);
  s += box('9a', p9a[0], p9a[1], W, H / 2 + 4) + box('9b', p9b[0], p9b[1], W, H / 2 + 4);
  s += `<text x="${col(0)}" y="${Y2 + 20}" class="fk">Read the bottom row</text><text x="${col(0)}" y="${Y2 + 38}" class="fk">right to left ←</text>`;
  return s + `</svg>`;
}
