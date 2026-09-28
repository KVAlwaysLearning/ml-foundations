/* ============================================================
   3D stage. Math coordinates (a, b, height) map to three.js as
   (a, height, -b), which keeps the axes right-handed with height up.
   ============================================================ */
const V = (a, b, h) => new THREE.Vector3(a, h, -b);

class Stage {
  constructor(fig, { target = [0,0,0.8], r = 14, theta = -0.95, phi = 1.1 } = {}) {
    if (!window.THREE) throw new Error('3D library did not load');
    const st = document.createElement('div'); st.className = 'viz-stage';
    st.setAttribute('role','img');
    fig.appendChild(st); this.el = st;
    const ren = new THREE.WebGLRenderer({ antialias: true });
    ren.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    st.appendChild(ren.domElement); this.ren = ren;
    this.lblBox = document.createElement('div'); this.lblBox.className = 'lbls'; st.appendChild(this.lblBox);
    const tb = document.createElement('div'); tb.className = 'viz-toolbar';
    tb.innerHTML = `
      <div class="tb-group" role="group" aria-label="Drag mode">
        <button type="button" data-a="rotate" aria-pressed="true">Rotate</button><button type="button" data-a="pan" aria-pressed="false">Pan</button>
      </div>
      <div class="tb-group" role="group" aria-label="Zoom">
        <button type="button" data-a="in" aria-label="Zoom in">+</button><button type="button" data-a="out" aria-label="Zoom out">−</button>
      </div>
      <div class="tb-group" role="group" aria-label="Preset views">
        <button type="button" data-a="reset">3D</button><button type="button" data-a="top">Top</button><button type="button" data-a="front">Front</button><button type="button" data-a="side">Side</button>
      </div>
      <button type="button" data-a="full" class="tb-full">Full screen</button>`;
    fig.insertBefore(tb, st); this.toolbar = tb;
    const hint = document.createElement('div'); hint.className = 'hint';
    hint.textContent = 'Drag to rotate · Shift-drag or Pan to move · Ctrl + scroll or pinch to zoom · Click the surface to pick a level';
    st.appendChild(hint); this.hint = hint; setTimeout(() => hint.classList.add('fade'), 6000);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(css('--panel'));
    this.cam = new THREE.PerspectiveCamera(34, 1, 0.1, 300);
    this.home = { target: V(...target), r, theta, phi };
    this.orbit = { target: V(...target), r, theta, phi };
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    const dl = new THREE.DirectionalLight(0xffffff, 0.55); dl.position.set(6, 12, 8); this.scene.add(dl);
    this.stat = new THREE.Group(); this.dyn = new THREE.Group();
    this.scene.add(this.stat, this.dyn);
    this.labels = [];
    this.fig = fig; this.mode = 'rotate'; this.onPick = null;

    const setMode = m => { this.mode = m; tb.querySelectorAll('[data-a=rotate],[data-a=pan]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.a === m))); };
    const view = (theta, phi) => { Object.assign(this.orbit, { theta, phi, target: this.home.target.clone() }); this.render(); };
    tb.addEventListener('click', e => {
      const a = e.target.closest('button')?.dataset.a; if (!a) return;
      if (a === 'rotate' || a === 'pan') setMode(a);
      else if (a === 'in') this.zoom(0.85);
      else if (a === 'out') this.zoom(1 / 0.85);
      else if (a === 'reset') { Object.assign(this.orbit, { ...this.home, target: this.home.target.clone() }); this.render(); }
      else if (a === 'top') view(Math.PI / 2, 0.03);
      else if (a === 'front') view(Math.PI / 2, Math.PI / 2 - 0.02);
      else if (a === 'side') view(0.001, Math.PI / 2 - 0.02);
      else if (a === 'full') this.toggleFull();
    });

    const cv = ren.domElement, ptrs = new Map();
    let last = null, down = null, pinch = null;
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      hint.classList.add('fade');
      if (ptrs.size === 1) { last = { x: e.clientX, y: e.clientY }; down = { x: e.clientX, y: e.clientY, t: Date.now() }; }
      if (ptrs.size === 2) { const [p, q] = [...ptrs.values()]; pinch = { d: Math.hypot(p.x - q.x, p.y - q.y), m: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 } }; down = null; }
    });
    cv.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2 && pinch) {
        const [p, q] = [...ptrs.values()], d = Math.hypot(p.x - q.x, p.y - q.y), m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
        if (d > 0) this.zoom(pinch.d / d, false);
        this.pan(m.x - pinch.m.x, m.y - pinch.m.y); pinch = { d, m }; return;
      }
      if (!last) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y; last = { x: e.clientX, y: e.clientY };
      if (this.mode === 'pan' || e.shiftKey || e.buttons === 2 || e.buttons === 4) this.pan(dx, dy);
      else {
        this.orbit.theta += dx * 0.008;
        this.orbit.phi = Math.min(Math.PI - 0.02, Math.max(0.02, this.orbit.phi - dy * 0.008));
        this.render();
      }
    });
    const end = e => {
      ptrs.delete(e.pointerId);
      if (down && e.type === 'pointerup' && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && Date.now() - down.t < 600 && this.onPick) {
        const r = cv.getBoundingClientRect();
        this.onPick(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1));
      }
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0) { last = null; down = null; }
      else { const p = [...ptrs.values()][0]; last = { x: p.x, y: p.y }; }
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    let hintTimer = null;
    cv.addEventListener('wheel', e => {
      if (this.isFull() || e.ctrlKey || e.metaKey) { e.preventDefault(); this.zoom(Math.exp(e.deltaY * 0.0015), false); return; }
      hint.textContent = 'Hold Ctrl (⌘ on Mac) and scroll to zoom, or use + and −';
      hint.classList.remove('fade'); clearTimeout(hintTimer); hintTimer = setTimeout(() => hint.classList.add('fade'), 1600);
    }, { passive: false });
    this.onKey = e => { if (e.key === 'Escape' && fig.classList.contains('is-full') && !document.fullscreenElement) this.toggleFull(false); };
    document.addEventListener('keydown', this.onKey);
    this.onFs = () => { const on = document.fullscreenElement === fig; fig.classList.toggle('is-full', on); this.syncFullBtn(); this.render(); };
    document.addEventListener('fullscreenchange', this.onFs);

    this.ro = new ResizeObserver(() => this.render()); this.ro.observe(st);
    this.render();
  }
  zoom(f, clamp = true) { this.orbit.r = Math.min(60, Math.max(3, this.orbit.r * f)); this.render(); }
  pan(dx, dy) {
    const o = this.orbit, k = o.r * 0.0016;
    const fwd = new THREE.Vector3().subVectors(o.target, this.cam.position).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, this.cam.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    o.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k); this.render();
  }
  isFull() { return this.fig.classList.contains('is-full'); }
  syncFullBtn() { const b = this.toolbar.querySelector('[data-a=full]'); b.textContent = this.isFull() ? 'Exit full screen' : 'Full screen'; }
  toggleFull(force) {
    const on = force ?? !this.isFull(), fig = this.fig;
    if (on && fig.requestFullscreen) { fig.requestFullscreen().catch(() => { fig.classList.add('is-full'); this.syncFullBtn(); this.render(); }); return; }
    if (!on && document.fullscreenElement === fig) { document.exitFullscreen(); return; }
    fig.classList.toggle('is-full', on); this.syncFullBtn(); this.render();
  }
  pick(ndc, objects) {
    const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, this.cam);
    return rc.intersectObjects(objects, false)[0] || null;
  }
  label(text, pos, color = '--ink', group = 'dyn', cls = '') {
    const d = document.createElement('div'); d.className = 'lbl' + (cls ? ' ' + cls : ''); d.textContent = text;
    d.style.color = `var(${color})`; this.lblBox.appendChild(d);
    this.labels.push({ d, pos, group });
  }
  clearStat() {
    disposeTree(this.stat); this.stat.clear();
    this.labels = this.labels.filter(l => { if (l.group === 'stat') { l.d.remove(); return false; } return true; });
  }
  clearDyn() {
    disposeTree(this.dyn); this.dyn.clear();
    this.labels = this.labels.filter(l => { if (l.group === 'dyn') { l.d.remove(); return false; } return true; });
  }
  render() {
    if (this.queued) return; this.queued = true;
    requestAnimationFrame(() => { this.queued = false; this.draw(); });
  }
  draw() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    if (w !== this.lw || h !== this.lh) { this.ren.setSize(w, h, false); this.lw = w; this.lh = h; }
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    const o = this.orbit, rr = o.r * Math.pow(Math.max(1, 1.3 / (w / h)), 0.85);
    this.cam.position.set(
      o.target.x + rr * Math.sin(o.phi) * Math.cos(o.theta),
      o.target.y + rr * Math.cos(o.phi),
      o.target.z + rr * Math.sin(o.phi) * Math.sin(o.theta));
    this.cam.lookAt(o.target);
    this.ren.render(this.scene, this.cam);
    for (const l of this.labels) {
      const p = l.pos.clone().project(this.cam);
      if (p.z > 1 || p.z < -1) { l.d.style.display = 'none'; continue; }
      l.d.style.display = '';
      l.d.style.left = ((p.x + 1) / 2 * w) + 'px';
      l.d.style.top = ((1 - p.y) / 2 * h) + 'px';
    }
  }
  dispose() {
    document.removeEventListener('keydown', this.onKey); document.removeEventListener('fullscreenchange', this.onFs);
    if (document.fullscreenElement === this.fig) document.exitFullscreen?.();
    this.fig.classList.remove('is-full');
    this.ro.disconnect(); disposeTree(this.scene);
    this.ren.dispose(); this.ren.forceContextLoss?.();
  }
}
function disposeTree(o) {
  o.traverse(c => { c.geometry?.dispose?.(); if (c.material) [].concat(c.material).forEach(m => m.dispose()); });
}

/* ---------- primitives (all take math coordinates via V) ---------- */
function col(name) { return new THREE.Color(css(name)); }
function mkLine(group, pts, color, { dashed = false, opacity = 1, dash = 0.12 } = {}) {
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = dashed ? new THREE.LineDashedMaterial({ color: col(color), dashSize: dash, gapSize: dash * 0.8, transparent: opacity < 1, opacity })
                   : new THREE.LineBasicMaterial({ color: col(color), transparent: opacity < 1, opacity });
  const l = new THREE.Line(g, m); if (dashed) l.computeLineDistances();
  group.add(l); return l;
}
function mkArrow(group, from, to, color, r = 0.035) {
  const dir = to.clone().sub(from), len = dir.length();
  if (len < 1e-4) return null;
  const head = Math.min(0.3, len * 0.4), shaft = len - head;
  const m = new THREE.MeshBasicMaterial({ color: col(color) });
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, shaft, 10), m); cyl.position.y = shaft / 2;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 2.8, head, 16), m); cone.position.y = shaft + head / 2;
  g.add(cyl, cone); g.position.copy(from);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
  group.add(g); return g;
}
function mkSphere(group, pos, color, r = 0.07) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshLambertMaterial({ color: col(color) }));
  s.position.copy(pos); group.add(s); return s;
}
function mkSurface(group, fn, a0, a1, b0, b1, n, color, opacity = 0.35, gridEvery = 0) {
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const a = a0 + (a1 - a0) * i / n, b = b0 + (b1 - b0) * j / n; const p = V(a, b, fn(a, b)); pos.push(p.x, p.y, p.z);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const k = i * (n + 1) + j; idx.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: col(color), transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, shininess: 25 }));
  group.add(mesh);
  if (gridEvery) {
    for (let i = 0; i <= n; i += gridEvery) {
      const a = a0 + (a1 - a0) * i / n, pa = [], pb = [];
      for (let j = 0; j <= n; j++) { const b = b0 + (b1 - b0) * j / n; pa.push(V(a, b, fn(a, b))); }
      const b = b0 + (b1 - b0) * i / n;
      for (let j = 0; j <= n; j++) { const aa = a0 + (a1 - a0) * j / n; pb.push(V(aa, b, fn(aa, b))); }
      mkLine(group, pa, color, { opacity: 0.45 }); mkLine(group, pb, color, { opacity: 0.45 });
    }
  }
  return mesh;
}
function mkFloor(stage, R, labels, heightTop) {
  const g = stage.stat;
  for (let v = -Math.floor(R); v <= Math.floor(R); v++) {
    mkLine(g, [V(v, -R, 0), V(v, R, 0)], '--rule');
    mkLine(g, [V(-R, v, 0), V(R, v, 0)], '--rule');
  }
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 2 * R), new THREE.MeshBasicMaterial({ color: col('--floor'), transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
  fl.rotation.x = -Math.PI / 2; g.add(fl);
  mkLine(g, [V(-R, 0, 0), V(R + 0.4, 0, 0)], '--muted');
  mkLine(g, [V(0, -R, 0), V(0, R + 0.4, 0)], '--muted');
  mkLine(g, [V(0, 0, 0), V(0, 0, heightTop)], '--muted');
  stage.label(labels[0], V(R + 0.7, 0, 0), '--floor', 'stat');
  stage.label(labels[1], V(0, R + 0.7, 0), '--floor', 'stat');
  stage.label(labels[2], V(0, 0, heightTop + 0.35), '--surface', 'stat');
}
// split a polyline (in floor coords [a,b,h]) into pieces that stay inside the square |a|,|b| <= R
function clipRuns(pts, R) {
  const runs = []; let cur = [];
  for (const p of pts) {
    if (Math.abs(p[0]) <= R && Math.abs(p[1]) <= R) cur.push(p);
    else { if (cur.length > 1) runs.push(cur); cur = []; }
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}
// parametric line p0 + t d clipped to the square; returns [t0, t1] or null
function clipLine(p0, d, R) {
  let t0 = -1e9, t1 = 1e9;
  for (let i = 0; i < 2; i++) {
    if (Math.abs(d[i]) < 1e-12) { if (Math.abs(p0[i]) > R) return null; continue; }
    let ta = (-R - p0[i]) / d[i], tb = (R - p0[i]) / d[i];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
  }
  return t0 < t1 ? [t0, t1] : null;
}


/* ---------- ticks, tubes and labelled 3D axes ---------- */
function niceTicks(lo, hi, n = 5){
  const span = hi - lo; if (!(span > 0)) return [lo];
  const raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
function mkTube(group, pts, color, r = 0.035, closed = false) {
  if (pts.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(pts, closed, 'centripetal');
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(400, pts.length * 3), r, 8, closed), new THREE.MeshBasicMaterial({ color: col(color) }));
  group.add(m); return m;
}
/* Axes along the floor edges plus a vertical axis, with tick marks, values and names.
   box: { A0, A1, B0, B1, H1, a: [lo, hi, name], b: [lo, hi, name], h: [lo, hi, name] }
   Scene position for a value v on axis a is A0 + (v - lo) / (hi - lo) * (A1 - A0), likewise for b and h. */
function mkAxes3D(stage, box){
  const g = stage.stat, { A0, A1, B0, B1, H1 } = box, H0 = 0;
  const pa = v => A0 + (v - box.a[0]) / (box.a[1] - box.a[0]) * (A1 - A0);
  const pb = v => B0 + (v - box.b[0]) / (box.b[1] - box.b[0]) * (B1 - B0);
  const ph = v => H0 + (v - box.h[0]) / (box.h[1] - box.h[0]) * (H1 - H0);
  const ta = niceTicks(box.a[0], box.a[1], 5), tb = niceTicks(box.b[0], box.b[1], 5), th = niceTicks(box.h[0], box.h[1], 4);
  for (const v of ta) mkLine(g, [V(pa(v), B0, 0), V(pa(v), B1, 0)], '--rule');
  for (const v of tb) mkLine(g, [V(A0, pb(v), 0), V(A1, pb(v), 0)], '--rule');
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(A1 - A0, B1 - B0), new THREE.MeshBasicMaterial({ color: col('--floor'), transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
  fl.rotation.x = -Math.PI / 2; fl.position.copy(V((A0 + A1) / 2, (B0 + B1) / 2, 0)); g.add(fl);
  // axis lines: a along the front edge, b along the right edge, h up the back-left corner
  mkLine(g, [V(A0, B0, 0), V(A1, B0, 0)], '--ink'); mkLine(g, [V(A1, B0, 0), V(A1, B1, 0)], '--ink'); mkLine(g, [V(A0, B1, 0), V(A0, B1, H1)], '--ink');
  const t = 0.12;
  for (const v of ta) { mkLine(g, [V(pa(v), B0, 0), V(pa(v), B0 - t, 0)], '--ink'); stage.label(fmtTick(v), V(pa(v), B0 - 0.38, 0), '--muted', 'stat', 'tick'); }
  for (const v of tb) { mkLine(g, [V(A1, pb(v), 0), V(A1 + t, pb(v), 0)], '--ink'); stage.label(fmtTick(v), V(A1 + 0.4, pb(v), 0), '--muted', 'stat', 'tick'); }
  for (const v of th) { if (ph(v) < -1e-9 || ph(v) > H1 + 1e-9) continue; mkLine(g, [V(A0, B1, ph(v)), V(A0 - t, B1, ph(v))], '--ink'); stage.label(fmtTick(v), V(A0 - 0.42, B1, ph(v)), '--muted', 'stat', 'tick'); }
  stage.label(box.a[2], V((A0 + A1) / 2, B0 - 0.95, 0), '--floor', 'stat', 'axis');
  stage.label(box.b[2], V(A1 + 1.05, (B0 + B1) / 2, 0), '--floor', 'stat', 'axis');
  stage.label(box.h[2], V(A0, B1, H1 + 0.45), '--surface', 'stat', 'axis');
  return { pa, pb, ph };
}
function fmtTick(v){ const a = Math.abs(v); return (a >= 1000 || (a > 0 && a < 0.01) ? v.toExponential(0) : String(+v.toFixed(3))).replace('-', '−'); }
