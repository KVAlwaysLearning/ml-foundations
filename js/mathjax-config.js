/* MathJax settings: must load before the MathJax script */
window.MathJax = {
  tex: { inlineMath: [['\\(','\\)']], displayMath: [['\\[','\\]']] },
  svg: { fontCache: 'global' },
  options: { enableMenu: false },
  startup: { typeset: false, ready(){ MathJax.startup.defaultReady(); MathJax.startup.promise.then(() => window.__mjReady && window.__mjReady()); } }
};
