/**
 * Módulo de Algoritmos: Gradiente Conjugado (GC) y Gradiente Conjugado Precondicionado (GCP)
 * Basado rigurosamente en el artículo científico:
 * "Método de Gradientes Conjugados Precondicionado", Porfirio Suñagua S.
 * Revista Boliviana de Matemática - UMSA, 2020.
 */

let MM;
if (typeof window !== 'undefined' && window.MatrixMath) {
  MM = window.MatrixMath;
} else if (typeof require !== 'undefined') {
  try { MM = require('./matrix.js'); } catch (e) { MM = globalThis.MatrixMath; }
} else {
  MM = globalThis.MatrixMath;
}
const MatrixMath = MM;

const NumericalSolvers = {
  // --- Constructores de Precondicionadores ---

  /**
   * Precondicionador de Jacobi (Diagonal)
   * M = diag(a_11, a_22, ..., a_nn)
   */
  createJacobiPreconditioner(A) {
    const n = A.length;
    const diag = new Float64Array(n);
    const invDiag = new Float64Array(n);
    const M_matrix = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      const aii = A[i][i];
      if (Math.abs(aii) < 1e-15) {
        throw new Error(`Precondicionador Jacobi: elemento diagonal A[${i+1},${i+1}] es nulo o cercano a cero.`);
      }
      diag[i] = aii;
      invDiag[i] = 1.0 / aii;
      M_matrix[i][i] = aii;
    }

    return {
      name: "Jacobi (Diagonal)",
      type: "jacobi",
      matrix: M_matrix,
      // Resolver M z = r
      solve(r) {
        const z = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          z[i] = r[i] * invDiag[i];
        }
        return Array.from(z);
      }
    };
  },

  /**
   * Precondicionador SSOR (Symmetric Successive Over-Relaxation)
   * M = 1 / (omega * (2 - omega)) * (D + omega * L) * D^-1 * (D + omega * L^T)
   * donde A = D + L + L^T (D diagonal, L estrictamente triangular inferior)
   */
  createSSORPreconditioner(A, omega = 1.0) {
    const n = A.length;
    if (omega <= 0 || omega >= 2) {
      throw new Error("El parámetro omega de SSOR debe estar en el intervalo abierto (0, 2).");
    }

    const D = new Float64Array(n);
    for (let i = 0; i < n; i++) D[i] = A[i][i];

    // Construcción explícita de matriz M para cálculo de kappa(M^-1 A)
    const factor = 1.0 / (omega * (2.0 - omega));
    // D_wL = (D + omega * L)
    const D_wL = Array.from({ length: n }, () => new Array(n).fill(0));
    const D_wU = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      D_wL[i][i] = D[i];
      D_wU[i][i] = D[i];
      for (let j = 0; j < i; j++) {
        D_wL[i][j] = omega * A[i][j];
        D_wU[j][i] = omega * A[j][i];
      }
    }

    // InvD
    const invD_mat = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) invD_mat[i][i] = 1.0 / D[i];

    const temp = MatrixMath.matMul(D_wL, invD_mat);
    const M_matrix = MatrixMath.matMul(temp, D_wU).map(row => row.map(v => v * factor));

    return {
      name: `SSOR (ω = ${omega.toFixed(2)})`,
      type: "ssor",
      omega,
      matrix: M_matrix,
      solve(r) {
        // Resolver M z = r
        // 1. (D + omega * L) y = omega * (2 - omega) * r
        const rhsScale = omega * (2.0 - omega);
        const y = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          let sum = 0;
          for (let j = 0; j < i; j++) {
            sum += omega * A[i][j] * y[j];
          }
          y[i] = (rhsScale * r[i] - sum) / D[i];
        }

        // 2. D^-1 (D + omega * L^T) z = y  =>  (D + omega * L^T) z = D * y
        const Dy = new Float64Array(n);
        for (let i = 0; i < n; i++) Dy[i] = D[i] * y[i];

        const z = new Float64Array(n);
        for (let i = n - 1; i >= 0; i--) {
          let sum = 0;
          for (let j = i + 1; j < n; j++) {
            sum += omega * A[i][j] * z[j]; // A[i][j] es L^T
          }
          z[i] = (Dy[i] - sum) / D[i];
        }
        return Array.from(z);
      }
    };
  },

  /**
   * Precondicionador Cholesky Incompleto IC(0)
   * Descomposición aproximada A ≈ L_inc * L_inc^T preservando el patrón disperso
   */
  createIC0Preconditioner(A) {
    const n = A.length;
    const L = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        // En IC(0), solo se calcula si A[i][j] != 0 (o no despreciable)
        if (Math.abs(A[i][j]) < 1e-14 && i !== j) {
          L[i][j] = 0;
          continue;
        }

        let sum = 0;
        for (let k = 0; k < j; k++) {
          sum += L[i][k] * L[j][k];
        }

        if (i === j) {
          const val = A[i][i] - sum;
          if (val <= 0) {
            // Shift de regularización para estabilidad de Mackerle / Manteuffel
            L[i][j] = Math.sqrt(Math.abs(val) + 1e-4);
          } else {
            L[i][j] = Math.sqrt(val);
          }
        } else {
          L[i][j] = (A[i][j] - sum) / L[j][j];
        }
      }
    }

    const LT = MatrixMath.transpose(L);
    const M_matrix = MatrixMath.matMul(L, LT);

    return {
      name: "Cholesky Incompleto IC(0)",
      type: "ic0",
      matrix: M_matrix,
      solve(r) {
        // 1. L y = r
        const y = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          let sum = 0;
          for (let k = 0; k < i; k++) {
            sum += L[i][k] * y[k];
          }
          y[i] = (r[i] - sum) / L[i][i];
        }

        // 2. L^T z = y
        const z = new Float64Array(n);
        for (let i = n - 1; i >= 0; i--) {
          let sum = 0;
          for (let k = i + 1; k < n; k++) {
            sum += L[k][i] * z[k];
          }
          z[i] = (y[i] - sum) / L[i][i];
        }
        return Array.from(z);
      }
    };
  },

  /**
   * Precondicionador Identidad (Para Gradiente Conjugado Simple)
   * M = I => M z = r  => z = r
   */
  createIdentityPreconditioner(n) {
    const I = Array.from({ length: n }, (_, i) => {
      const row = new Array(n).fill(0);
      row[i] = 1;
      return row;
    });

    return {
      name: "Identidad (Sin Precondicionar - GC Estándar)",
      type: "identity",
      matrix: I,
      solve(r) {
        return [...r];
      }
    };
  },

  /**
   * Algoritmo de Gradientes Conjugados Precondicionado (Suñagua, 2020)
   *
   * @param {Array<Array<number>>} A Matriz simétrica definida positiva
   * @param {Array<number>} b Vector de términos independientes
   * @param {Object} preconditioner Objeto precondicionador con método solve(r)
   * @param {Array<number>} x0 Vector inicial (por defecto ceros)
   * @param {number} tol Criterio de parada ||r_k||_2 / ||b||_2 < tol (1e-6)
   * @param {number} maxIter Número máximo de iteraciones
   */
  solveGCP(A, b, preconditioner, x0 = null, tol = 1e-6, maxIter = 100) {
    const n = A.length;
    let x = x0 ? [...x0] : new Array(n).fill(0);
    const normB = MatrixMath.norm2(b);
    const normB_safe = normB > 1e-15 ? normB : 1.0;

    // r0 = b - A * x0
    const Ax0 = MatrixMath.matVecMul(A, x);
    let r = MatrixMath.vecAdd(b, Ax0, -1);
    let normR = MatrixMath.norm2(r);
    let relRes = normR / normB_safe;

    // Resolver M z0 = r0
    let z = preconditioner.solve(r);
    let p = [...z];
    let gamma = MatrixMath.dot(r, z);

    const history = [];
    history.push({
      k: 0,
      x: [...x],
      r: [...r],
      z: [...z],
      p: [...p],
      normR,
      relRes,
      alpha: null,
      beta: null
    });

    if (relRes < tol) {
      return {
        x,
        iterations: 0,
        converged: true,
        finalRelRes: relRes,
        finalNormR: normR,
        history,
        preconditionerName: preconditioner.name
      };
    }

    let converged = false;
    let k = 0;

    for (k = 0; k < maxIter; k++) {
      // w_k = A * p_k
      const w = MatrixMath.matVecMul(A, p);
      const pAp = MatrixMath.dot(p, w);

      if (Math.abs(pAp) < 1e-18) {
        throw new Error(`Curvatura nula o negativa detectada en la iteración ${k}: p^T A p = ${pAp}. La matriz no es definida positiva.`);
      }

      // alpha_k = (r_k^T z_k) / (p_k^T A p_k)
      const alpha = gamma / pAp;

      // x_{k+1} = x_k + alpha_k * p_k
      x = MatrixMath.vecAdd(x, p, alpha);

      // r_{k+1} = r_k - alpha_k * w_k
      const r_next = MatrixMath.vecAdd(r, w, -alpha);
      normR = MatrixMath.norm2(r_next);
      relRes = normR / normB_safe;

      // Evaluar criterio de parada
      if (relRes < tol) {
        r = r_next;
        converged = true;
        history.push({
          k: k + 1,
          x: [...x],
          r: [...r],
          z: [...z],
          p: [...p],
          normR,
          relRes,
          alpha,
          beta: null
        });
        k++; // cuenta la iteración final
        break;
      }

      // Resolver M z_{k+1} = r_{k+1}
      const z_next = preconditioner.solve(r_next);
      const gamma_next = MatrixMath.dot(r_next, z_next);

      // beta_k = (r_{k+1}^T z_{k+1}) / (r_k^T z_k)
      const beta = gamma_next / gamma;

      // p_{k+1} = z_{k+1} + beta_k * p_k
      p = MatrixMath.vecAdd(z_next, p, beta);

      r = r_next;
      z = z_next;
      gamma = gamma_next;

      history.push({
        k: k + 1,
        x: [...x],
        r: [...r],
        z: [...z],
        p: [...p],
        normR,
        relRes,
        alpha,
        beta
      });
    }

    return {
      x,
      iterations: k,
      converged,
      finalRelRes: relRes,
      finalNormR: normR,
      history,
      preconditionerName: preconditioner.name
    };
  },

  /**
   * Gradiente Conjugado Simple (Sin precondicionar, M = I)
   */
  solveGC(A, b, x0 = null, tol = 1e-6, maxIter = 100) {
    const identPrecond = this.createIdentityPreconditioner(A.length);
    return this.solveGCP(A, b, identPrecond, x0, tol, maxIter);
  },

  /**
   * Cálculo exhaustivo de errores entre la solución de referencia y la aproximación GCP
   */
  computeErrors(xRef, xGCP, A, b) {
    const n = xRef.length;
    const absErrors = [];
    const relErrors = [];
    const pctErrors = [];

    for (let i = 0; i < n; i++) {
      const ea = Math.abs(xRef[i] - xGCP[i]);
      absErrors.push(ea);

      if (Math.abs(xRef[i]) < 1e-15) {
        relErrors.push(NaN); // No definido para xref = 0 según especificación
        pctErrors.push(NaN);
      } else {
        const er = ea / Math.abs(xRef[i]);
        relErrors.push(er);
        pctErrors.push(er * 100);
      }
    }

    // Residuo relativo global: ||b - A * x_GCP||_2 / ||b||_2
    const AxGCP = MatrixMath.matVecMul(A, xGCP);
    const residual = MatrixMath.vecAdd(b, AxGCP, -1);
    const normRes = MatrixMath.norm2(residual);
    const normB = MatrixMath.norm2(b);
    const globalRelRes = normB > 1e-15 ? normRes / normB : normRes;

    // Norma Euclídea del error total ||xRef - xGCP||_2
    const errVec = MatrixMath.vecAdd(xRef, xGCP, -1);
    const normErr = MatrixMath.norm2(errVec);

    return {
      absErrors,
      relErrors,
      pctErrors,
      globalRelRes,
      normErr,
      maxAbsError: Math.max(...absErrors)
    };
  },

  /**
   * Cálculo del número de condición precondicionado kappa(M^-1 A)
   */
  computePreconditionedConditionNumber(A, preconditioner) {
    try {
      const invM = MatrixMath.invert(preconditioner.matrix);
      const M_inv_A = MatrixMath.matMul(invM, A);
      const condResult = MatrixMath.conditionNumberNorm1(M_inv_A);
      return condResult.cond;
    } catch (e) {
      return NaN;
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NumericalSolvers;
}
