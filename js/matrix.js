/**
 * Módulo de Álgebra Lineal y Análisis Matricial
 * Implementa operaciones vectoriales, matriciales, descomposición de Cholesky,
 * Criterio de Sylvester, cálculo de autovalores (Jacobi) y número de condición.
 * Desarrollado para el Desafío Académico de Métodos Numéricos - UMSA
 */

const MatrixMath = {
  // --- Operaciones Vectoriales Básicas ---
  dot(u, v) {
    let s = 0;
    for (let i = 0; i < u.length; i++) s += u[i] * v[i];
    return s;
  },

  norm2(v) {
    return Math.sqrt(this.dot(v, v));
  },

  vecAdd(u, v, alpha = 1) {
    const res = new Float64Array(u.length);
    for (let i = 0; i < u.length; i++) res[i] = u[i] + alpha * v[i];
    return Array.from(res);
  },

  vecScale(v, s) {
    return v.map(x => x * s);
  },

  vecClone(v) {
    return [...v];
  },

  // --- Operaciones Matriciales Básicas ---
  clone(A) {
    return A.map(row => [...row]);
  },

  transpose(A) {
    const n = A.length;
    const m = A[0].length;
    const T = Array.from({ length: m }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        T[j][i] = A[i][j];
      }
    }
    return T;
  },

  matVecMul(A, x) {
    const n = A.length;
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      const row = A[i];
      for (let j = 0; j < n; j++) {
        sum += row[j] * x[j];
      }
      y[i] = sum;
    }
    return y;
  },

  matMul(A, B) {
    const n = A.length;
    const m = B[0].length;
    const p = B.length;
    const C = Array.from({ length: n }, () => new Array(m).fill(0));
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < p; k++) {
        const aik = A[i][k];
        for (let j = 0; j < m; j++) {
          C[i][j] += aik * B[k][j];
        }
      }
    }
    return C;
  },

  // Inversión de matrices pequeñas (Gauss-Jordan con pivoteo parcial)
  invert(A) {
    const n = A.length;
    const M = A.map((row, i) => {
      const rowCopy = [...row];
      for (let j = 0; j < n; j++) rowCopy.push(i === j ? 1 : 0);
      return rowCopy;
    });

    for (let i = 0; i < n; i++) {
      // Pivoteo parcial
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
          maxRow = k;
        }
      }
      if (Math.abs(M[maxRow][i]) < 1e-15) {
        throw new Error("Matriz singular o casi singular, no se puede invertir numéricamente.");
      }
      [M[i], M[maxRow]] = [M[maxRow], M[i]];

      const pivot = M[i][i];
      for (let j = 0; j < 2 * n; j++) M[i][j] /= pivot;

      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = M[k][i];
          for (let j = 0; j < 2 * n; j++) {
            M[k][j] -= factor * M[i][j];
          }
        }
      }
    }

    return M.map(row => row.slice(n));
  },

  // Determinante por eliminación Gaussiana
  det(A) {
    const n = A.length;
    const M = this.clone(A);
    let d = 1;

    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
      }
      if (Math.abs(M[maxRow][i]) < 1e-15) return 0;
      if (maxRow !== i) {
        [M[i], M[maxRow]] = [M[maxRow], M[i]];
        d = -d;
      }
      d *= M[i][i];
      for (let k = i + 1; k < n; k++) {
        const factor = M[k][i] / M[i][i];
        for (let j = i; j < n; j++) {
          M[k][j] -= factor * M[i][j];
        }
      }
    }
    return d;
  },

  // --- Verificaciones de Simetría y Definición Positiva ---
  checkSymmetry(A, tol = 1e-9) {
    const n = A.length;
    let maxDiff = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const diff = Math.abs(A[i][j] - A[j][i]);
        if (diff > maxDiff) maxDiff = diff;
        if (diff > tol) {
          return { isSymmetric: false, maxDiff, i, j, a_ij: A[i][j], a_ji: A[j][i] };
        }
      }
    }
    return { isSymmetric: true, maxDiff };
  },

  // Criterio de Sylvester: Menores principales conductores delta_1 .. delta_n > 0
  checkSylvester(A) {
    const n = A.length;
    const minors = [];
    let isPositiveDefinite = true;

    for (let k = 1; k <= n; k++) {
      const submatrix = Array.from({ length: k }, (_, i) => A[i].slice(0, k));
      const d = this.det(submatrix);
      minors.push({ k, det: d });
      if (d <= 1e-12) {
        isPositiveDefinite = false;
      }
    }

    return { isPositiveDefinite, minors };
  },

  // --- Descomposición de Cholesky A = L * L^T ---
  cholesky(A) {
    const n = A.length;
    const L = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0;
        for (let k = 0; k < j; k++) {
          sum += L[i][k] * L[j][k];
        }

        if (i === j) {
          const val = A[i][i] - sum;
          if (val <= 0) {
            throw new Error(`Fallo en Cholesky: Matriz no es estrictamente definida positiva en el pivote (${i+1},${i+1}). Valor cuadrático = ${val.toFixed(6)} <= 0.`);
          }
          L[i][j] = Math.sqrt(val);
        } else {
          L[i][j] = (A[i][j] - sum) / L[j][j];
        }
      }
    }
    return L;
  },

  // Resolución directa mediante Cholesky: L y = b, L^T x = y
  solveCholesky(A, b) {
    const n = A.length;
    const L = this.cholesky(A);

    // 1. Sustitución progresiva L y = b
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = 0; k < i; k++) {
        sum += L[i][k] * y[k];
      }
      y[i] = (b[i] - sum) / L[i][i];
    }

    // 2. Sustitución regresiva L^T x = y
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let k = i + 1; k < n; k++) {
        sum += L[k][i] * x[k]; // L^T[i][k] = L[k][i]
      }
      x[i] = (y[i] - sum) / L[i][i];
    }

    return { x, L, y };
  },

  // --- Autovalores para Matrices Simétricas (Algoritmo de Rotaciones de Jacobi) ---
  eigenvaluesSymmetric(A, maxIter = 100, tol = 1e-12) {
    const n = A.length;
    let D = this.clone(A);

    for (let iter = 0; iter < maxIter; iter++) {
      // Buscar elemento fuera de la diagonal con mayor valor absoluto
      let maxVal = 0;
      let p = 0, q = 1;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const absVal = Math.abs(D[i][j]);
          if (absVal > maxVal) {
            maxVal = absVal;
            p = i;
            q = j;
          }
        }
      }

      if (maxVal < tol) break;

      // Calcular ángulo de rotación de Givens
      const theta = (D[q][q] - D[p][p]) / (2 * D[p][q]);
      let t = 1 / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      if (theta < 0) t = -t;
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      const tau = s / (1 + c);

      // Actualizar matriz D
      const dpp = D[p][p];
      const dqq = D[q][q];
      const dpq = D[p][q];

      D[p][p] = dpp - t * dpq;
      D[q][q] = dqq + t * dpq;
      D[p][q] = 0;
      D[q][p] = 0;

      for (let k = 0; k < n; k++) {
        if (k !== p && k !== q) {
          const dkp = D[k][p];
          const dkq = D[k][q];
          D[k][p] = dkp - s * (dkq + tau * dkp);
          D[p][k] = D[k][p];
          D[k][q] = dkq + s * (dkp - tau * dkq);
          D[q][k] = D[k][q];
        }
      }
    }

    const eigs = [];
    for (let i = 0; i < n; i++) eigs.push(D[i][i]);
    eigs.sort((a, b) => b - a); // orden descendente
    return eigs;
  },

  // --- Número de Condición Espectral kappa(A) = lambda_max / lambda_min ---
  conditionNumber(A) {
    try {
      const eigs = this.eigenvaluesSymmetric(A);
      const lMax = Math.max(...eigs.map(Math.abs));
      const lMin = Math.min(...eigs.map(Math.abs));
      if (lMin < 1e-15) return Infinity;
      return {
        cond: lMax / lMin,
        lambdaMax: lMax,
        lambdaMin: lMin,
        eigenvalues: eigs
      };
    } catch (e) {
      // Fallback a norma matricial ||A||_1 * ||A^-1||_1
      return this.conditionNumberNorm1(A);
    }
  },

  // Número de condición general por norma 1: kappa_1(M) = ||M||_1 * ||M^-1||_1
  conditionNumberNorm1(M) {
    try {
      const invM = this.invert(M);
      const n1 = this.matrixNorm1(M);
      const n1Inv = this.matrixNorm1(invM);
      return { cond: n1 * n1Inv, normA: n1, normInv: n1Inv };
    } catch (e) {
      return { cond: Infinity, normA: 0, normInv: 0 };
    }
  },

  // Norma 1 de matriz: max suma de columnas
  matrixNorm1(A) {
    const n = A.length;
    const m = A[0].length;
    let maxColSum = 0;
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += Math.abs(A[i][j]);
      if (sum > maxColSum) maxColSum = sum;
    }
    return maxColSum;
  },

  // Norma Frobenius
  normFrobenius(A) {
    let s = 0;
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < A[i].length; j++) {
        s += A[i][j] * A[i][j];
      }
    }
    return Math.sqrt(s);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MatrixMath;
}
