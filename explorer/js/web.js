/* ============================================================
   Concept web: centre -> branches -> attributes -> variants.
   One branch is open at a time; the selected attribute shows its
   variants as an outer ring. Calls onSelect({branch, attr, variant}).
   ============================================================ */
class ConceptWeb {
  constructor(parent, onSelect){
    const NS = 'http://www.w3.org/2000/svg';
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('viewBox', '-600 -440 1200 880');
    this.svg.setAttribute('class', 'web');
    this.svg.setAttribute('role', 'group');
    this.svg.setAttribute('aria-label', 'Concept web of linear regression: branches, attributes and variants');
    parent.appendChild(this.svg); this.NS = NS; this.onSelect = onSelect;
    this.state = { branch: null, attr: null, variant: null };
    this.svg.addEventListener('click', e => this.handle(e));
    this.svg.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.handle(e); } });
  }
  set(s){ Object.assign(this.state, s); this.draw(); }
  handle(e){
    const g = e.target.closest('[data-kind]'); if (!g) return;
    const { kind, id } = g.dataset;
    if (kind === 'branch') { this.state.branch = this.state.branch === id ? null : id; this.state.attr = null; this.draw(); return; }
    if (kind === 'attr') { this.onSelect({ attr: id }); return; }
    if (kind === 'variant') this.onSelect({ attr: this.state.attr, variant: id });
  }
  el(tag, attrs, parent){ const n = document.createElementNS(this.NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); (parent || this.svg).appendChild(n); return n; }
  label(g, text, x, y, ang, cls, off){
    const c = Math.cos(ang), s = Math.sin(ang);
    const anchor = c > 0.25 ? 'start' : c < -0.25 ? 'end' : 'middle';
    const t = this.el('text', { x: x + c * off, y: y + s * off + (anchor === 'middle' ? (s > 0 ? 10 : -4) : 4), 'text-anchor': anchor, class: cls }, g);
    t.textContent = text; return t;
  }
  draw(){
    const svg = this.svg; while (svg.firstChild) svg.removeChild(svg.firstChild);
    const { branch, attr, variant } = this.state;
    const lines = this.el('g', { class: 'web-lines' }), nodes = this.el('g', { class: 'web-nodes' });
    const nb = CATALOG.length, R1 = 170, R2 = 315, R3 = 445, oi = CATALOG.findIndex(b => b.id === branch);
    // the open branch points right; the others share the left half
    const bAng = i => oi < 0 ? -Math.PI / 2 + i * 2 * Math.PI / nb
      : i === oi ? 0 : Math.PI / 2 + ((i < oi ? i : i - 1) + 0.5) * Math.PI / (nb - 1);
    svg.setAttribute('viewBox', oi < 0 ? '-560 -400 1120 800' : '-420 -430 1270 860');
    CATALOG.forEach((b, i) => {
      const a = bAng(i), x = R1 * Math.cos(a), y = R1 * Math.sin(a), open = b.id === branch;
      this.el('line', { x1: 0, y1: 0, x2: x, y2: y, class: 'edge' + (open ? ' on' : '') }, lines);
      const g = this.el('g', { 'data-kind': 'branch', 'data-id': b.id, tabindex: 0, role: 'button', 'aria-expanded': String(open),
        'aria-label': `${b.name}${b.live ? '' : ' (planned)'}`, class: 'node branch' + (b.live ? ' live' : '') + (open ? ' open' : '') }, nodes);
      this.el('circle', { cx: x, cy: y, r: open ? 13 : 10 }, g);
      if (open) { const t = this.el('text', { x, y: y + 40, 'text-anchor': 'middle', class: 'lbl-branch on' }, g); t.textContent = b.name; }
      else this.label(g, b.name, x, y, a, 'lbl-branch', 18);
      if (!open) return;
      const n = b.attrs.length, step = Math.min(22, 150 / Math.max(1, n - 1)) * Math.PI / 180;
      b.attrs.forEach((at, k) => {
        const aa = a + (k - (n - 1) / 2) * step, ax = R2 * Math.cos(aa), ay = R2 * Math.sin(aa), sel = at.id === attr;
        this.el('line', { x1: x, y1: y, x2: ax, y2: ay, class: 'edge' + (sel ? ' on' : '') }, lines);
        const ga = this.el('g', { 'data-kind': 'attr', 'data-id': at.id, tabindex: 0, role: 'button', 'aria-pressed': String(sel),
          'aria-label': at.name, class: 'node attr' + (b.live ? ' live' : '') + (sel ? ' sel' : '') }, nodes);
        this.el('circle', { cx: ax, cy: ay, r: sel ? 9 : 7 }, ga);
        if (!sel) this.label(ga, at.name, ax, ay, aa, 'lbl-attr', 13);
        if (!sel) return;
        const m = at.variants.length, gap = Math.min(44, 760 / Math.max(1, m)), vx = Math.max(ax + 160, 590);
        const y0 = Math.max(-405, Math.min(405 - (m - 1) * gap, ay - (m - 1) * gap / 2));
        at.variants.forEach((v, j) => {
          const vy = y0 + j * gap, vsel = v.id === variant;
          this.el('path', { d: `M${ax},${ay} C${(ax + vx) / 2},${ay} ${(ax + vx) / 2},${vy} ${vx},${vy}`, class: 'edge thin' + (vsel ? ' on' : ''), fill: 'none' }, lines);
          const gv = this.el('g', { 'data-kind': 'variant', 'data-id': v.id, tabindex: 0, role: 'button', 'aria-pressed': String(vsel),
            'aria-label': v.name, class: 'node variant' + (b.live ? ' live' : '') + (vsel ? ' sel' : '') + (j === 0 ? ' base' : '') }, nodes);
          this.el('circle', { cx: vx, cy: vy, r: vsel ? 8 : 6 }, gv);
          const tx = this.el('text', { x: vx + 14, y: vy + 6, 'text-anchor': 'start', class: 'lbl-variant' }, gv);
          tx.textContent = v.name + (j === 0 ? ' (baseline)' : '');
        });
        const t = this.el('text', { x: ax - 14, y: ay - 14, 'text-anchor': 'end', class: 'lbl-attr sel' }, ga); t.textContent = at.name;
      });
    });
    const c = this.el('g', { class: 'centre' }, nodes);
    this.el("circle", { cx: 0, cy: 0, r: 66 }, c);
    const t1 = this.el('text', { x: 0, y: -5, 'text-anchor': 'middle' }, c); t1.textContent = 'Linear';
    const t2 = this.el('text', { x: 0, y: 19, 'text-anchor': 'middle' }, c); t2.textContent = 'regression';
  }
}
