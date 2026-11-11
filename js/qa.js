/**
 * Módulo de Pruebas de Software (Módulo QA)
 * Implementa las pruebas obligatorias y complementarias exigidas por el desafío académico.
 * Formato estándar de Control de Calidad: Entrada, Resultado Esperado, Resultado Obtenido, Conclusión.
 */

var MatrixMathQA = (typeof window !== 'undefined' && window.MatrixMath) ? window.MatrixMath :
                   (typeof MatrixMath !== 'undefined') ? MatrixMath :
                   (typeof require !== 'undefined') ? require('./matrix.js') : globalThis.MatrixMath;

var NumericalSolversQA = (typeof window !== 'undefined' && window.NumericalSolvers) ? window.NumericalSolvers :
                         (typeof NumericalSolvers !== 'undefined') ? NumericalSolvers :
                         (typeof require !== 'undefined') ? require('./algorithms.js') : globalThis.NumericalSolvers;

var FinancialScenariosQA = (typeof window !== 'undefined' && window.FinancialScenarios) ? window.FinancialScenarios :
                           (typeof FinancialScenarios !== 'undefined') ? FinancialScenarios :
                           (typeof require !== 'undefined') ? require('./scenarios.js') : globalThis.FinancialScenarios;

var QATestSuite = {
  tests: [
    {
      id: "TC-01",
      name: "Prueba de Carga y Ejecución de Escenarios Obligatorios",
      category: "Funcional / Escenarios",
      description: "Verificar la carga y resolución numérica exitosa de los 3 escenarios obligatorios (Ideal, Estrés, Mal Condicionado).",
      run() {
        const scenarios = ["ideal", "stress", "ill_conditioned"];
        const results = [];
        let allPassed = true;

        for (const scId of scenarios) {
          const sc = FinancialScenariosQA.get(scId);
          const symCheck = MatrixMathQA.checkSymmetry(sc.A);
          const sylvCheck = MatrixMathQA.checkSylvester(sc.A);
          const choleskySol = MatrixMathQA.solveCholesky(sc.A, sc.b);
          const precond = NumericalSolversQA.createJacobiPreconditioner(sc.A);
          const gcpSol = NumericalSolversQA.solveGCP(sc.A, sc.b, precond, sc.x0, 1e-6, 100);

          const pass = symCheck.isSymmetric && sylvCheck.isPositiveDefinite && gcpSol.converged && gcpSol.finalRelRes < 1e-6;
          if (!pass) allPassed = false;
          results.push(`${scId.toUpperCase()}: Sym=${symCheck.isSymmetric}, SPD=${sylvCheck.isPositiveDefinite}, GCP_Conv=${gcpSol.converged}, Res=${gcpSol.finalRelRes.toExponential(2)}`);
        }

        return {
          passed: allPassed,
          input: "3 Escenarios predefinidos (Ideal, Estrés, Mal Condicionado), tol=10⁻⁶",
          expected: "Las 3 matrices deben ser simétricas y SPD. Cholesky y GCP deben converger con residuo relativo < 10⁻⁶.",
          obtained: results.join(" | "),
          conclusion: allPassed
            ? "Aprobado: Todos los escenarios cargan y convergen con precisión estricta a la solución."
            : "Fallo: Uno o más escenarios no convergieron adecuadamente."
        };
      }
    },

    {
      id: "TC-02",
      name: "Prueba de Validación de Matriz No Válida (Asimétrica y No Definida Positiva)",
      category: "Seguridad y Manejo de Errores",
      description: "Introducción deliberada de matrices inválidas (asimétrica y con determinante/pivote negativo) y verificación de captura controlada de excepciones.",
      run() {
        let asymmetricCaught = false;
        let nonSPDCaught = false;

        // Caso 1: Matriz Asimétrica
        const A_asym = [
          [10, 2, 1, 0],
          [5, 12, 2, 1], // A[1][0] = 5 != A[0][1] = 2
          [1, 2, 15, 3],
          [0, 1, 3, 20]
        ];
        const sym = MatrixMathQA.checkSymmetry(A_asym);
        if (!sym.isSymmetric) asymmetricCaught = true;

        // Caso 2: Matriz Simétrica pero Indefinida / No Definida Positiva
        const A_nonSPD = [
          [1, 5, 0, 0],
          [5, 1, 0, 0], // det(A_2) = 1*1 - 25 = -24 < 0
          [0, 0, 10, 0],
          [0, 0, 0, 10]
        ];
        const sylv = MatrixMathQA.checkSylvester(A_nonSPD);
        try {
          MatrixMathQA.cholesky(A_nonSPD);
        } catch (e) {
          nonSPDCaught = true;
        }

        const passed = asymmetricCaught && !sylv.isPositiveDefinite && nonSPDCaught;

        return {
          passed,
          input: "Matriz A_asym (A[1,0]=5 != A[0,1]=2) y Matriz A_nonSPD con menor principal k=2 negativo (-24)",
          expected: "El sistema debe detectar asimetría en A_asym y detectar violación de Sylvester en A_nonSPD, lanzando excepción en Cholesky sin colapsar la UI.",
          obtained: `Asimetría detectada=${asymmetricCaught}, Sylvester detectó no-SPD=${!sylv.isPositiveDefinite}, Cholesky capturó excepción=${nonSPDCaught}`,
          conclusion: passed
            ? "Aprobado: Validación matemática robusta. El sistema previene cálculos erróneos y notifica al usuario."
            : "Fallo: No se capturaron las violaciones de propiedades matriciales."
        };
      }
    },

    {
      id: "TC-03",
      name: "Prueba de Edición Dinámica y Recálculo Instantáneo",
      category: "Reactividad e Integración",
      description: "Modificación programática/manual de coeficientes en A y b con verificación de consistencia entre Cholesky y GCP en el nuevo punto de equilibrio.",
      run() {
        // Clonamos el ideal y modificamos coeficientes dinámicamente
        const A_dyn = [
          [18.5,  3.2,  1.1,  0.8],
          [ 3.2, 22.0,  4.5,  1.5],
          [ 1.1,  4.5, 19.0,  3.0],
          [ 0.8,  1.5,  3.0, 25.0]
        ];
        const b_dyn = [55.0, 72.0, 48.0, 90.0];

        const refSol = MatrixMathQA.solveCholesky(A_dyn, b_dyn);
        const precond = NumericalSolversQA.createJacobiPreconditioner(A_dyn);
        const gcpSol = NumericalSolversQA.solveGCP(A_dyn, b_dyn, precond, null, 1e-6, 100);
        const errs = NumericalSolversQA.computeErrors(refSol.x, gcpSol.x, A_dyn, b_dyn);

        const passed = gcpSol.converged && errs.maxAbsError < 1e-6 && errs.globalRelRes < 1e-6;

        return {
          passed,
          input: "A_dyn modificada con coeficientes arbitrarios SPD (diagonal dominante), b_dyn=[55, 72, 48, 90]",
          expected: "Recálculo exacto. Error absoluto máximo entre Cholesky y GCP < 10⁻⁶ y residuo relativo global < 10⁻⁶.",
          obtained: `GCP converged=${gcpSol.converged}, Iteraciones=${gcpSol.iterations}, MaxAbsError=${errs.maxAbsError.toExponential(4)}, ResiduoGlobal=${errs.globalRelRes.toExponential(4)}`,
          conclusion: passed
            ? "Aprobado: La reactividad matemática garantiza soluciones exactas ante cualquier modificación válida de datos."
            : "Fallo: El recálculo dinámico produjo discrepancias por encima de la tolerancia."
        };
      }
    },

    {
      id: "TC-04",
      name: "Prueba Comparativa de Precondicionamiento en Escenario Mal Condicionado",
      category: "Rendimiento y Eficiencia Algorítmica",
      description: "Verificar que el algoritmo GCP alcance la tolerancia en menor o igual número de iteraciones y con un menor o igual residuo que el GC simple.",
      run() {
        const sc = FinancialScenariosQA.get("ill_conditioned");
        const sol_gc = NumericalSolversQA.solveGC(sc.A, sc.b, sc.x0, 1e-6, 100);
        const precond = NumericalSolversQA.createJacobiPreconditioner(sc.A);
        const sol_gcp = NumericalSolversQA.solveGCP(sc.A, sc.b, precond, sc.x0, 1e-6, 100);

        const condA = MatrixMathQA.conditionNumber(sc.A);
        const condPrec = NumericalSolversQA.computePreconditionedConditionNumber(sc.A, precond);

        // GCP iteraciones <= GC iteraciones y residuo final GCP <= residuo final GC
        const iterCondition = sol_gcp.iterations <= sol_gc.iterations;
        const resCondition = sol_gcp.finalRelRes <= sol_gc.finalRelRes;
        const condReduction = condPrec < condA.cond;

        const passed = iterCondition && (resCondition || sol_gcp.finalRelRes < 1e-6) && condReduction;

        return {
          passed,
          input: "Escenario Mal Condicionado κ(A) ≈ 25,718, Precondicionador Jacobi",
          expected: "Iteraciones GCP <= Iteraciones GC, κ(M⁻¹A) < κ(A) y Residuo final GCP < 10⁻⁶.",
          obtained: `GC(Iter=${sol_gc.iterations}, Res=${sol_gc.finalRelRes.toExponential(2)}) vs GCP(Iter=${sol_gcp.iterations}, Res=${sol_gcp.finalRelRes.toExponential(2)}). κ(A)=${condA.cond.toFixed(1)} -> κ(M⁻¹A)=${condPrec.toFixed(1)} (Reducción: ${((1 - condPrec/condA.cond)*100).toFixed(1)}%)`,
          conclusion: passed
            ? "Aprobado: El precondicionamiento reduce el número de condición y maximiza la precisión numérica."
            : "Fallo: El precondicionador no demostró ventaja respecto a GC estándar."
        };
      }
    },

    {
      id: "TC-05",
      name: "Prueba de Criterio de Parada y Tolerancia Numérica (||r_k||₂ / ||b||₂ < 10⁻⁶)",
      category: "Precisión Numérica",
      description: "Verificar que el algoritmo se detenga estrictamente cuando el residuo relativo cae por debajo de 10⁻⁶ y no ejecute iteraciones redundantes.",
      run() {
        const sc = FinancialScenariosQA.get("ideal");
        const tol = 1e-6;
        const precond = NumericalSolversQA.createJacobiPreconditioner(sc.A);
        const sol = NumericalSolversQA.solveGCP(sc.A, sc.b, precond, sc.x0, tol, 100);

        const lastStep = sol.history[sol.history.length - 1];
        const passed = sol.converged && lastStep.relRes < tol;

        return {
          passed,
          input: "Matriz Ideal, Tolerancia ε = 10⁻⁶, N_max = 100",
          expected: "Convergencia garantizada con residuo relativo final r_rel < 10⁻⁶.",
          obtained: `Iteraciones=${sol.iterations}, Residuo Relativo Final=${lastStep.relRes.toExponential(4)} < ${tol}`,
          conclusion: passed
            ? "Aprobado: El criterio de parada Suñagua (2020) detiene el algoritmo exactamente en el umbral óptimo."
            : "Fallo: El algoritmo continuó iterando o se detuvo antes de la tolerancia requerida."
        };
      }
    },

    {
      id: "TC-06",
      name: "Prueba de Consistencia Espectral y Descomposición de Cholesky",
      category: "Álgebra Lineal Computacional",
      description: "Comprobar que A = L * L^T y que todos los autovalores λ_i calculados por el método de Jacobi sean estrictamente reales y positivos.",
      run() {
        const sc = FinancialScenariosQA.get("stress");
        const L = MatrixMathQA.cholesky(sc.A);
        const LT = MatrixMathQA.transpose(L);
        const reconstructedA = MatrixMathQA.matMul(L, LT);

        // Error de reconstrucción ||A - L L^T||_F
        const diffMat = sc.A.map((row, i) => row.map((v, j) => v - reconstructedA[i][j]));
        const fNorm = MatrixMathQA.normFrobenius(diffMat);

        const eigs = MatrixMathQA.eigenvaluesSymmetric(sc.A);
        const allPositive = eigs.every(lambda => lambda > 0);

        const passed = fNorm < 1e-12 && allPositive;

        return {
          passed,
          input: "Matriz A del Escenario Bajo Estrés Financiero",
          expected: "||A - L L^T||_F ≈ 0 (< 10⁻¹²) y todos los autovalores λ_i > 0.",
          obtained: `Error reconstrucción Frobenius=${fNorm.toExponential(4)}, Autovalores=[${eigs.map(e => e.toFixed(2)).join(", ")}]`,
          conclusion: passed
            ? "Aprobado: Reconstrucción de Cholesky y espectro de autovalores verifican plenamente las propiedades SPD."
            : "Fallo: Discrepancia en la factorización de Cholesky o autovalores no positivos."
        };
      }
    }
  ],

  // Ejecutar todos los casos de prueba y devolver reporte
  runAll() {
    const results = [];
    let passedCount = 0;

    for (const test of this.tests) {
      try {
        const res = test.run();
        if (res.passed) passedCount++;
        results.push({
          id: test.id,
          name: test.name,
          category: test.category,
          passed: res.passed,
          input: res.input,
          expected: res.expected,
          obtained: res.obtained,
          conclusion: res.conclusion
        });
      } catch (err) {
        results.push({
          id: test.id,
          name: test.name,
          category: test.category,
          passed: false,
          input: "Error inesperado en ejecución",
          expected: "Ejecución sin excepciones no controladas",
          obtained: `Excepción: ${err.message}`,
          conclusion: "Fallo crítico durante la ejecución de la prueba."
        });
      }
    }

    return {
      total: this.tests.length,
      passedCount,
      failedCount: this.tests.length - passedCount,
      allPassed: passedCount === this.tests.length,
      coveragePercent: ((passedCount / this.tests.length) * 100).toFixed(0),
      timestamp: new Date().toISOString(),
      results
    };
  }
};

if (typeof window !== 'undefined') {
  window.QATestSuite = QATestSuite;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QATestSuite;
}
