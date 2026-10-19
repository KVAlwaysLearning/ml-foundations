/* ============================================================
   Small dense linear-algebra helpers used by the labs.
   Matrices are arrays of rows; vectors are plain arrays.
   ============================================================ */
const LA = {
  T(A){ return A[0].map((_, j) => A.map(r => r[j])); },
  mul(A, B){ return A.map(r => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0))); },
  mv(A, x){ return A.map(r => r.reduce((s, v, k) => s + v * x[k], 0)); },
  dot(a, b){ return a.reduce((s, v, i) => s + v * b[i], 0); },
  norm(a){ return Math.sqrt(LA.dot(a, a)); },
  add(a, b){ return a.map((v, i) => v + b[i]); },
  sub(a, b){ return a.map((v, i) => v - b[i]); },
  scale(a, k){ return a.map(v => v * k); },
  eye(n){ return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j))); },
  // Gaussian elimination; returns null when the matrix is singular (relative tolerance)
  solve(A, b){
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    const scale = Math.max(1e-300, ...A.flat().map(Math.abs));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-10 * scale) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
    return x;
  },
  inv(A){
    const n = A.length, cols = LA.eye(n).map((_, j) => LA.solve(A, LA.eye(n).map(r => r[j])));
    if (cols.some(c => !c)) return null;
    return LA.T(cols);
  },
  det(A){
    const n = A.length, M = A.map(r => [...r]); let d = 1;
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-14) return 0;
      if (p !== c) { [M[c], M[p]] = [M[p], M[c]]; d = -d; }
      d *= M[c][c];
      for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k < n; k++) M[r][k] -= f * M[c][k]; }
    }
    return d;
  },
  rank(A, tol = 1e-9){
    const M = A.map(r => [...r]), rows = M.length, cols = M[0].length;
    const scale = Math.max(1e-300, ...A.flat().map(Math.abs)); let rk = 0;
    for (let c = 0; c < cols && rk < rows; c++) {
      let p = rk; for (let r = rk + 1; r < rows; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < tol * scale) continue;
      [M[rk], M[p]] = [M[p], M[rk]];
      for (let r = rk + 1; r < rows; r++) { const f = M[r][c] / M[rk][c]; for (let k = c; k < cols; k++) M[r][k] -= f * M[rk][k]; }
      rk++;
    }
    return rk;
  },
  // Jacobi eigen-decomposition for small symmetric matrices; values sorted large -> small
  eigSym(S){
    const n = S.length, A = S.map(r => [...r]), V = LA.eye(n);
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = [...Array(n).keys()].sort((a, b) => A[b][b] - A[a][a]);
    return { values: idx.map(i => A[i][i]), vectors: idx.map(i => V.map(r => r[i])) };
  },
  // least-squares minimizer of the quadratic with matrix M (M w = c); min-norm when singular
  minimizer(M, c){
    const w = LA.solve(M, c);
    if (w) return { w, unique: true };
    const { values, vectors } = LA.eigSym(M), top = Math.max(1e-300, Math.abs(values[0]));
    let x = new Array(c.length).fill(0);
    values.forEach((l, i) => { if (Math.abs(l) > 1e-9 * top) x = LA.add(x, LA.scale(vectors[i], LA.dot(vectors[i], c) / l)); });
    return { w: x, unique: false };
  }
};
