/* ============================================================
   The four fixed sections, and the content files that fill them.
   To add a concept (e.g. logistic regression): create
   content/<section>/logistic-regression.html for each section it
   touches, then add those paths to CONTENT_FILES below.
   Files are loaded in this order; nav order follows it.
   ============================================================ */
const SECTIONS = [
  { id:'calculus', title:'Multivariable calculus',
    blurb:'The calculus toolkit, explained with examples, then a full derivation of linear regression using only partial derivatives, then a worked example by hand.' },
  { id:'linalg', title:'Linear algebra',
    blurb:'The linear-algebra toolkit, explained with examples, then an independent derivation of least squares as a projection, then the same worked example with matrices.' },
  { id:'intuition', title:'Intuition and 3D',
    blurb:'Regression from first principles, then interactive labs where you edit the data and weights and see every matrix and 3D picture update together.' },
  { id:'stats', title:'Statistics',
    blurb:'What the regression assumptions guarantee, how each one fails, and how to check it.' }
];

const CONTENT_FILES = [
  'content/calculus/linear-regression.html',
  'content/linalg/linear-regression.html',
  'content/intuition/linear-regression.html',
  'content/stats/linear-regression.html'
];
