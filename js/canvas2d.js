/* ---------- 2D canvas helpers ---------- */
function canvas2d(parent, title){
  const wrap = document.createElement('div'); wrap.className = 'pt';
  const cv = document.createElement('canvas'); wrap.appendChild(cv);
  if (title) { const s = document.createElement('span'); s.textContent = title; wrap.appendChild(s); }
  parent.appendChild(wrap);
  return cv;
}
function prep(cv){
  const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height };
}
function arrow2d(ctx, x0, y0, x1, y1, color, width = 2.5){
  const a = Math.atan2(y1 - y0, x1 - x0), hl = 11;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - hl*0.7*Math.cos(a), y1 - hl*0.7*Math.sin(a)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - hl*Math.cos(a - 0.4), y1 - hl*Math.sin(a - 0.4)); ctx.lineTo(x1 - hl*Math.cos(a + 0.4), y1 - hl*Math.sin(a + 0.4)); ctx.closePath(); ctx.fill();
}
