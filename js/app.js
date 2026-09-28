/* Router, navigation, page rendering and theme. Loads last. */
let TOPICS = [], ORDER = [];
const secById = Object.fromEntries(SECTIONS.map(s => [s.id, s]));
const topicsIn = sid => TOPICS.filter(t => t.section === sid);
const conceptsIn = sid => [...new Set(topicsIn(sid).map(t => t.concept))];

/* Load every content file listed in CONTENT_FILES, then index its <template data-topic> pages. */
async function loadContent(){
  const box = document.createElement('div'); box.hidden = true; document.body.appendChild(box);
  const texts = await Promise.all(CONTENT_FILES.map(async f => {
    const r = await fetch(f, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`Could not load ${f} (${r.status})`);
    return r.text();
  }));
  box.innerHTML = texts.join('\n');
  TOPICS = [...box.querySelectorAll('template[data-topic]')].map(t => ({
    id: t.dataset.id, section: t.dataset.section, concept: t.dataset.concept || 'General',
    part: t.dataset.part || '', title: t.dataset.title, tpl: t
  }));
  ORDER = SECTIONS.flatMap(s => topicsIn(s.id));
}


/* ---------- theme ---------- */
const THEMES = ['system','light','dark'];
function applyTheme(t){
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}
let theme = 'system';
try { theme = localStorage.getItem('mlf-theme') || 'system'; } catch(e) {}
applyTheme(theme);

/* ---------- math typesetting ---------- */
let pendingMath = null;
window.__mjReady = () => { if (pendingMath) typeset(pendingMath); };
function typeset(el){
  const mj = window.MathJax;
  if (mj && mj.typesetPromise) {
    pendingMath = null;
    mj.typesetPromise([el]).catch(() => {});
  } else pendingMath = el;
}

/* ---------- navigation ---------- */
function parseRoute(){
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { section: parts[0] || null, topic: parts[1] || null };
}
function renderNav(route){
  const side = $('#side');
  let h = `<a class="brand" href="#/"><b>ML Foundations</b><span>The math behind each model, four ways</span></a>`;
  for (const s of SECTIONS) {
    const on = s.id === route.section;
    h += `<div class="sec${on ? ' on' : ''}"><a href="#/${s.id}">${esc(s.title)}</a>`;
    if (on) {
      for (const c of conceptsIn(s.id)) {
        h += `<div class="concept">${esc(c)}</div>`;
        const ts = topicsIn(s.id).filter(t => t.concept === c);
        for (const part of [...new Set(ts.map(t => t.part))]) {
          if (part) h += `<div class="part">${esc(part)}</div>`;
          h += `<ul class="topics">`;
          for (const t of ts.filter(t => t.part === part)) h += `<li><a href="#/${s.id}/${t.id}"${t.id === route.topic ? ' aria-current="page"' : ''}>${esc(t.title)}</a></li>`;
          h += `</ul>`;
        }
      }
    }
    h += `</div>`;
  }
  h += `<div class="side-foot">Colour key used in every figure
    <div class="legend">
      <div><i style="background:var(--floor)"></i>Floor: data, weights, gradients</div>
      <div><i style="background:var(--surface)"></i>Surfaces: prediction plane, loss bowl</div>
      <div><i style="background:var(--residual)"></i>Residuals and targets</div>
      <div><i style="background:var(--normal)"></i>Normals and descent paths</div>
    </div>
    <button class="theme-btn" id="themeBtn">Theme: ${theme}</button></div>`;
  side.innerHTML = h;

  // compact bar for small screens
  let o = `<option value="#/">Home</option>`;
  for (const s of SECTIONS) {
    o += `<optgroup label="${esc(s.title)}">`;
    for (const t of topicsIn(s.id)) o += `<option value="#/${s.id}/${t.id}"${t.id === route.topic ? ' selected' : ''}>${esc(t.title)}</option>`;
    o += `</optgroup>`;
  }
  $('#topbar').innerHTML = `<div class="row"><a class="brand-s" href="#/">ML Foundations</a></div>
    <div class="row"><select aria-label="Choose a page" id="jump">${o}</select></div>`;
  $('#jump').onchange = e => { location.hash = e.target.value; };
  $('#themeBtn').onclick = () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    try { localStorage.setItem('mlf-theme', theme); } catch(e) {}
    applyTheme(theme); render();
  };
}

let cleanups = [];
function teardown(){ cleanups.forEach(f => { try { f(); } catch(e) {} }); cleanups = []; }

function renderHome(page){
  let h = `<div class="prose"><h1>Linear regression, seen through calculus, linear algebra, geometry and statistics</h1>
  <p class="lede">Four separate sections, one model. Calculus and linear algebra each teach their toolkit, derive the solution independently, and work the same example by hand. The labs show what is actually happening, with every matrix live and editable. Statistics says when the result can be trusted.</p></div>
  <div class="home-grid">`;
  for (const s of SECTIONS) {
    const ts = topicsIn(s.id);
    h += `<div class="home-sec"><h2><a href="#/${s.id}">${esc(s.title)}</a></h2><p>${esc(s.blurb)}</p>`;
    for (const part of [...new Set(ts.map(t => t.part))]) {
      if (part) h += `<div class="part">${esc(part)}</div>`;
      h += `<ol>` + ts.filter(t => t.part === part).map(t => `<li><a href="#/${s.id}/${t.id}">${esc(t.title)}</a></li>`).join('') + `</ol>`;
    }
    h += `</div>`;
  }
  h += `</div>`;
  page.innerHTML = h;
}

function render(){
  teardown();
  let route = parseRoute();
  if (route.section && !secById[route.section]) route = { section:null, topic:null };
  if (route.section && !route.topic) {
    const first = topicsIn(route.section)[0];
    if (first) { history.replaceState(null, '', `#/${route.section}/${first.id}`); route.topic = first.id; }
  }
  renderNav(route);
  const page = $('#page');
  const topic = TOPICS.find(t => t.section === route.section && t.id === route.topic);
  if (!topic) { renderHome(page); document.title = 'ML Foundations'; window.scrollTo(0,0); return; }

  const sec = secById[topic.section];
  const i = ORDER.indexOf(topic), prev = ORDER[i-1], next = ORDER[i+1];
  page.innerHTML = `<p class="crumb"><a href="#/${sec.id}">${esc(sec.title)}</a> / ${esc(topic.concept)}${topic.part ? ' / ' + esc(topic.part) : ''}</p>
    <div class="prose"><h1>${esc(topic.title)}</h1></div>`;
  page.appendChild(topic.tpl.content.cloneNode(true));
  const pg = document.createElement('nav'); pg.className = 'pager'; pg.setAttribute('aria-label','Pages');
  pg.innerHTML = (prev ? `<a href="#/${prev.section}/${prev.id}"><small>Previous${prev.section !== topic.section ? ' in ' + esc(secById[prev.section].title) : ''}</small><b>${esc(prev.title)}</b></a>` : '') +
                 (next ? `<a class="next" href="#/${next.section}/${next.id}"><small>Next${next.section !== topic.section ? ' in ' + esc(secById[next.section].title) : ''}</small><b>${esc(next.title)}</b></a>` : '');
  page.appendChild(pg);
  document.title = `${topic.title} | ML Foundations`;

  page.querySelectorAll('figure.viz[data-viz]').forEach(fig => {
    const fn = VIZ[fig.dataset.viz];
    if (!fn) return;
    try { const c = fn(fig); if (typeof c === 'function') cleanups.push(c); }
    catch (err) { console.error(err); fig.innerHTML = `<div class="viz-fallback">This figure could not start: ${esc(err.message)}. Reload the page to try again.</div>`; }
  });
  typeset(page);
  window.scrollTo(0,0);
}

if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (theme === 'system') render(); });

/* ---------- start ---------- */
loadContent()
  .then(() => { window.addEventListener('hashchange', render); render(); })
  .catch(err => {
    console.error(err);
    $('#page').innerHTML = `<div class="prose"><h1>Content failed to load</h1><p>${esc(err.message)}.</p>
      <p>If you opened index.html directly from disk, run a local server instead (see README) because browsers block fetch() on file:// pages.</p></div>`;
  });
