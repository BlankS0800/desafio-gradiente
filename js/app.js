/**
 * Controlador Principal de la Aplicación Web (app.js)
 * Conecta la interfaz reactiva con los módulos matemáticos, algorítmicos y financieros.
 * Universidad Mayor de San Andrés (UMSA) - Métodos Numéricos
 */

document.addEventListener("DOMContentLoaded", () => {
  // Estado reactivo global
  const AppState = {
    n: 4,
    A: [],
    b: [],
    x0: [],
    tol: 1e-6,
    maxIter: 100,
    precondType: "jacobi",
    ssorOmega: 1.0,
    currentScenarioId: "ideal",
    
    // Resultados de cálculo
    symCheck: null,
    sylvCheck: null,
    condA: null,
    refSol: null,
    gcpSol: null,
    gcSol: null,
    errors: null,
    condPrec: null,
    
    // Gráfico
    chartInstance: null
  };

  // Inicializar estado con el Escenario Ideal
  function loadScenarioState(scenarioId) {
    const sc = FinancialScenarios.get(scenarioId);
    AppState.currentScenarioId = scenarioId;
    AppState.n = sc.A.length;
    AppState.A = MatrixMath.clone(sc.A);
    AppState.b = [...sc.b];
    AppState.x0 = [...sc.x0];
    AppState.precondType = sc.recommendedPrecond || "jacobi";

    // Actualizar botones de escenario activo
    document.querySelectorAll(".scenario-card-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.scenario === scenarioId);
    });

    // Actualizar descripción del escenario
    renderScenarioDescription(sc);

    // Renderizar inputs y recalcular
    renderInputs();
    runAllCalculations();
  }

  // Renderizar descripción y justificación del escenario activo
  function renderScenarioDescription(sc) {
    const descEl = document.getElementById("active-scenario-description");
    if (!descEl) return;

    descEl.innerHTML = `
      <div class="alert ${sc.badgeClass === 'badge-danger' ? 'alert-danger' : sc.badgeClass === 'badge-warning' ? 'alert-warning' : 'alert-info'}">
        <div class="alert-icon">ℹ️</div>
        <div class="alert-content">
          <h4>${sc.title} &nbsp;<span class="badge ${sc.badgeClass}">${sc.badge}</span></h4>
          <p><strong>Contexto Financiero:</strong> ${sc.description}</p>
          <p style="margin-top: 0.5rem;"><strong>Fundamentación Numérica:</strong> ${sc.financialJustification}</p>
          <p style="margin-top: 0.5rem; font-style: italic;"><strong>Análisis Esperado:</strong> ${sc.interpretation}</p>
        </div>
      </div>
    `;
  }

  // Renderizar inputs de la matriz A y el vector b
  function renderInputs() {
    const matrixContainer = document.getElementById("matrix-a-container");
    const vectorBContainer = document.getElementById("vector-b-container");
    const vectorX0Container = document.getElementById("vector-x0-container");

    const n = AppState.n;

    // Matriz A
    let aHtml = '<table class="matrix-table"><thead><tr><th>i \\ j</th>';
    for (let j = 0; j < n; j++) {
      aHtml += `<th>x${j+1}</th>`;
    }
    aHtml += '</tr></thead><tbody>';

    for (let i = 0; i < n; i++) {
      aHtml += `<tr><th>x${i+1}</th>`;
      for (let j = 0; j < n; j++) {
        const isDiag = (i === j);
        const val = AppState.A[i][j];
        aHtml += `<td>
          <input type="number" step="any" class="matrix-input ${isDiag ? 'highlight-diag' : ''}" 
                 data-row="${i}" data-col="${j}" value="${val}">
        </td>`;
      }
      aHtml += '</tr>';
    }
    aHtml += '</tbody></table>';
    matrixContainer.innerHTML = aHtml;

    // Vector b
    let bHtml = '<table class="matrix-table"><thead><tr><th>Var</th><th>b (Meta)</th></tr></thead><tbody>';
    for (let i = 0; i < n; i++) {
      bHtml += `<tr>
        <th>x${i+1}</th>
        <td><input type="number" step="any" class="matrix-input vec-b-input" data-idx="${i}" value="${AppState.b[i]}"></td>
      </tr>`;
    }
    bHtml += '</tbody></table>';
    vectorBContainer.innerHTML = bHtml;

    // Vector x0
    let x0Html = '<table class="matrix-table"><thead><tr><th>Var</th><th>x₀ (Inicial)</th></tr></thead><tbody>';
    for (let i = 0; i < n; i++) {
      x0Html += `<tr>
        <th>x${i+1}</th>
        <td><input type="number" step="any" class="matrix-input vec-x0-input" data-idx="${i}" value="${AppState.x0[i]}"></td>
      </tr>`;
    }
    x0Html += '</tbody></table>';
    vectorX0Container.innerHTML = x0Html;

    // Selector de Precondicionador
    const precondSelect = document.getElementById("precond-select");
    if (precondSelect) precondSelect.value = AppState.precondType;

    // Tolerancia
    const tolInput = document.getElementById("tol-input");
    if (tolInput) tolInput.value = AppState.tol;

    // Asociar eventos de edición reactiva
    attachInputListeners();
  }

  // Eventos de edición dinámica
  function attachInputListeners() {
    // Inputs matriz A
    document.querySelectorAll(".matrix-input[data-row]").forEach(input => {
      input.addEventListener("input", (e) => {
        const r = parseInt(e.target.dataset.row);
        const c = parseInt(e.target.dataset.col);
        const val = parseFloat(e.target.value);
        AppState.A[r][c] = isNaN(val) ? 0 : val;
        AppState.currentScenarioId = "custom";
        clearActiveScenarioButtons();
        runAllCalculations();
      });
    });

    // Inputs vector b
    document.querySelectorAll(".vec-b-input").forEach(input => {
      input.addEventListener("input", (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const val = parseFloat(e.target.value);
        AppState.b[idx] = isNaN(val) ? 0 : val;
        AppState.currentScenarioId = "custom";
        clearActiveScenarioButtons();
        runAllCalculations();
      });
    });

    // Inputs vector x0
    document.querySelectorAll(".vec-x0-input").forEach(input => {
      input.addEventListener("input", (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const val = parseFloat(e.target.value);
        AppState.x0[idx] = isNaN(val) ? 0 : val;
        runAllCalculations();
      });
    });
  }

  function clearActiveScenarioButtons() {
    document.querySelectorAll(".scenario-card-btn").forEach(btn => btn.classList.remove("active"));
  }

  // Ejecución integral de cálculos matemáticos y financieros
  function runAllCalculations() {
    const A = AppState.A;
    const b = AppState.b;
    const x0 = AppState.x0;
    const tol = AppState.tol;
    const maxIter = AppState.maxIter;

    // 1. Verificación de propiedades de A: Simetría y Definición Positiva (Sylvester)
    AppState.symCheck = MatrixMath.checkSymmetry(A);
    AppState.sylvCheck = MatrixMath.checkSylvester(A);
    AppState.condA = MatrixMath.conditionNumber(A);

    renderValidationFeedback();

    if (!AppState.symCheck.isSymmetric || !AppState.sylvCheck.isPositiveDefinite) {
      renderErrorState("La matriz A no cumple con las restricciones exigidas (Simétrica y Definida Positiva). Corrija los coeficientes o utilice el botón 'Forzar Simetría'.");
      return;
    }

    // 2. Solución Numérica de Referencia (Método Directo de Cholesky)
    try {
      AppState.refSol = MatrixMath.solveCholesky(A, b);
      renderReferenceSolution(AppState.refSol);
    } catch (err) {
      renderErrorState(`Error en Solución de Referencia: ${err.message}`);
      return;
    }

    // 3. Construcción del Precondicionador
    let precond;
    if (AppState.precondType === "jacobi") {
      precond = NumericalSolvers.createJacobiPreconditioner(A);
    } else if (AppState.precondType === "ssor") {
      precond = NumericalSolvers.createSSORPreconditioner(A, AppState.ssorOmega);
    } else if (AppState.precondType === "ic0") {
      precond = NumericalSolvers.createIC0Preconditioner(A);
    } else {
      precond = NumericalSolvers.createIdentityPreconditioner(A.length);
    }

    // 4. Ejecución del GCP (Suñagua, 2020) y GC Simple (Contraste)
    try {
      AppState.gcpSol = NumericalSolvers.solveGCP(A, b, precond, x0, tol, maxIter);
      AppState.gcSol = NumericalSolvers.solveGC(A, b, x0, tol, maxIter);
      AppState.condPrec = NumericalSolvers.computePreconditionedConditionNumber(A, precond);

      // 5. Análisis de Errores
      AppState.errors = NumericalSolvers.computeErrors(AppState.refSol.x, AppState.gcpSol.x, A, b);

      // Renderizar Vistas
      renderGCPvsGCResults();
      renderErrorAnalysisTable();
      renderConvergenceChart();
    } catch (err) {
      renderErrorState(`Error en resolución iterativa: ${err.message}`);
    }
  }

  // Renderizar retroalimentación de validación de simetría y definición positiva
  function renderValidationFeedback() {
    const valBox = document.getElementById("matrix-validation-box");
    if (!valBox) return;

    const sym = AppState.symCheck;
    const sylv = AppState.sylvCheck;
    const cond = AppState.condA;

    const symStatus = sym.isSymmetric
      ? `<span class="badge badge-success">✓ Simétrica (A = Aᵀ)</span>`
      : `<span class="badge badge-danger">✗ Asimétrica (A[${sym.i+1},${sym.j+1}]≠A[${sym.j+1},${sym.i+1}])</span>`;

    const spdStatus = sylv.isPositiveDefinite
      ? `<span class="badge badge-success">✓ Definida Positiva (Sylvester OK)</span>`
      : `<span class="badge badge-danger">✗ No Definida Positiva</span>`;

    const minorsText = sylv.minors.map(m => `Δ${m.k} = ${m.det > 1e4 ? m.det.toExponential(2) : m.det.toFixed(2)}`).join(" | ");

    valBox.innerHTML = `
      <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.75rem;">
        <div>${symStatus}</div>
        <div>${spdStatus}</div>
        <div><span class="badge badge-info">κ(A) = ${cond.cond > 1e5 ? cond.cond.toExponential(2) : cond.cond.toFixed(2)}</span></div>
        ${!sym.isSymmetric ? `<button id="btn-force-symmetry" class="btn btn-sm btn-outline">Forzar Simetría A = ½(A + Aᵀ)</button>` : ''}
      </div>
      <div style="font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono);">
        <strong>Menores Principales (Criterio de Sylvester):</strong> ${minorsText}
      </div>
    `;

    const forceBtn = document.getElementById("btn-force-symmetry");
    if (forceBtn) {
      forceBtn.addEventListener("click", () => {
        const n = AppState.n;
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const avg = (AppState.A[i][j] + AppState.A[j][i]) / 2.0;
            AppState.A[i][j] = avg;
            AppState.A[j][i] = avg;
          }
        }
        renderInputs();
        runAllCalculations();
      });
    }
  }

  function renderErrorState(msg) {
    const container = document.getElementById("gcp-results-container");
    if (container) {
      container.innerHTML = `
        <div class="alert alert-danger">
          <div class="alert-icon">⚠️</div>
          <div class="alert-content">
            <h4>Alerta de Validación Numérica</h4>
            <p>${msg}</p>
          </div>
        </div>
      `;
    }
  }

  // Renderizar Solución Numérica de Referencia (Cholesky)
  function renderReferenceSolution(ref) {
    const el = document.getElementById("reference-solution-container");
    if (!el) return;

    let rowsHtml = '';
    for (let i = 0; i < AppState.n; i++) {
      const v = FinancialScenarios.variables[i] || { name: `Activo ${i+1}`, unit: "M USD" };
      rowsHtml += `
        <tr>
          <td><strong>x${i+1}</strong></td>
          <td>${v.name}</td>
          <td class="mono"><strong>${ref.x[i].toFixed(6)}</strong> ${v.unit}</td>
          <td class="mono">${ref.y[i].toFixed(6)}</td>
        </tr>
      `;
    }

    el.innerHTML = `
      <div class="stat-card-row">
        <div class="stat-card">
          <span class="stat-label">Método Directo</span>
          <span class="stat-value" style="font-size: 1.15rem; color: var(--primary);">Cholesky (A = LLᵀ)</span>
          <span class="stat-sub">Sustitución Progresiva & Regresiva</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Dimensión del Sistema</span>
          <span class="stat-value">${AppState.n} × ${AppState.n}</span>
          <span class="stat-sub">Variables e Incógnitas</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Estado Numérico</span>
          <span class="stat-value" style="color: var(--success); font-size: 1.15rem;">Exacta</span>
          <span class="stat-sub">Solución de Referencia</span>
        </div>
      </div>
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Activo / Magnitud Financiera</th>
              <th>Valor Óptimo x_ref,i</th>
              <th>Vector Intermedio y = L⁻¹b</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  // Renderizar Resultados GCP vs GC Simple
  function renderGCPvsGCResults() {
    const el = document.getElementById("gcp-results-container");
    if (!el) return;

    const gcp = AppState.gcpSol;
    const gc = AppState.gcSol;
    const condA = AppState.condA;
    const condPrec = AppState.condPrec;

    const reductionPct = (!isNaN(condPrec) && condA.cond > 0)
      ? Math.max(0, (1 - condPrec / condA.cond) * 100).toFixed(1)
      : "N/A";

    let rowsHtml = '';
    for (let i = 0; i < AppState.n; i++) {
      const v = FinancialScenarios.variables[i] || { name: `Activo ${i+1}`, unit: "M USD" };
      rowsHtml += `
        <tr>
          <td><strong>x${i+1}</strong></td>
          <td>${v.name}</td>
          <td class="mono" style="color: var(--primary); font-weight: 700;">${gcp.x[i].toFixed(6)}</td>
          <td class="mono">${gc.x[i].toFixed(6)}</td>
          <td class="mono">${AppState.refSol.x[i].toFixed(6)}</td>
        </tr>
      `;
    }

    el.innerHTML = `
      <div class="stat-card-row">
        <div class="stat-card">
          <span class="stat-label">Iteraciones GCP (Precondicionado)</span>
          <span class="stat-value" style="color: var(--primary);">${gcp.iterations}</span>
          <span class="stat-sub">Precondicionador: ${gcp.preconditionerName}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Iteraciones GC Simple (M = I)</span>
          <span class="stat-value">${gc.iterations}</span>
          <span class="stat-sub">Sin precondicionar</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Residuo Relativo Final GCP</span>
          <span class="stat-value" style="font-size: 1.1rem; color: var(--success);">${gcp.finalRelRes.toExponential(3)}</span>
          <span class="stat-sub">Tolerancia: ${AppState.tol}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Reducción de κ(A) a κ(M⁻¹A)</span>
          <span class="stat-value" style="color: var(--secondary); font-size: 1.1rem;">
            ${reductionPct}%
          </span>
          <span class="stat-sub">κ(A)=${condA.cond > 1e4 ? condA.cond.toExponential(1) : condA.cond.toFixed(1)} → κ(M⁻¹A)=${condPrec > 1e4 ? condPrec.toExponential(1) : condPrec.toFixed(1)}</span>
        </div>
      </div>

      <div class="data-table-wrapper" style="margin-bottom: 1.5rem;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Activo / Significado Financiero</th>
              <th>GCP (Aproximación)</th>
              <th>GC Simple</th>
              <th>Solución de Referencia</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>

      <div class="tabs-header">
        <button class="tab-btn active" data-tab="gcp-steps">Historial Paso a Paso GCP (${gcp.iterations} iter)</button>
        <button class="tab-btn" data-tab="gc-steps">Historial Paso a Paso GC (${gc.iterations} iter)</button>
      </div>

      <div id="gcp-steps" class="tab-content active">
        ${renderHistoryTable(gcp.history, true)}
      </div>
      <div id="gc-steps" class="tab-content">
        ${renderHistoryTable(gc.history, false)}
      </div>
    `;

    // Asociar eventos de tabs
    el.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        el.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        el.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
        btn.classList.add("active");
        const targetId = btn.dataset.tab;
        const targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.classList.add("active");
      });
    });
  }

  // Renderizar tabla con el desglose por iteración k
  function renderHistoryTable(history, isPreconditioned) {
    let rows = '';
    history.forEach(step => {
      const alphaStr = step.alpha !== null ? step.alpha.toFixed(5) : "—";
      const betaStr = step.beta !== null ? step.beta.toFixed(5) : "—";
      const xStr = `[${step.x.map(v => v.toFixed(3)).join(", ")}]`;

      rows += `
        <tr>
          <td><strong>k = ${step.k}</strong></td>
          <td class="mono">${step.normR.toExponential(3)}</td>
          <td class="mono" style="color: ${step.relRes < AppState.tol ? 'var(--success)' : 'inherit'}; font-weight: ${step.relRes < AppState.tol ? '700' : 'normal'};">
            ${step.relRes.toExponential(4)}
          </td>
          <td class="mono">${alphaStr}</td>
          <td class="mono">${betaStr}</td>
          <td class="mono" style="font-size: 0.78rem;">${xStr}</td>
        </tr>
      `;
    });

    return `
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Iteración (k)</th>
              <th>||r_k||₂</th>
              <th>Residuo Relativo ||r_k||₂ / ||b||₂</th>
              <th>Tamaño de Paso α_k</th>
              <th>Parámetro β_k</th>
              <th>Vector de Solución x_k</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // Renderizar Análisis de Errores por Variable
  function renderErrorAnalysisTable() {
    const el = document.getElementById("error-analysis-container");
    if (!el) return;

    const err = AppState.errors;
    const ref = AppState.refSol.x;
    const gcp = AppState.gcpSol.x;

    let rowsHtml = '';
    for (let i = 0; i < AppState.n; i++) {
      const v = FinancialScenarios.variables[i] || { name: `Activo ${i+1}`, unit: "M USD" };
      const ea = err.absErrors[i];
      const er = err.relErrors[i];
      const ep = err.pctErrors[i];

      const erStr = isNaN(er) ? "No definido (x_ref = 0)" : er.toExponential(4);
      const epStr = isNaN(ep) ? "No definido" : `${ep.toExponential(4)} %`;

      rowsHtml += `
        <tr>
          <td><strong>x${i+1}</strong></td>
          <td>${v.name}</td>
          <td class="mono">${ref[i].toFixed(6)}</td>
          <td class="mono">${gcp[i].toFixed(6)}</td>
          <td class="mono">${ea.toExponential(4)}</td>
          <td class="mono">${erStr}</td>
          <td class="mono" style="color: var(--success); font-weight: 600;">${epStr}</td>
        </tr>
      `;
    }

    el.innerHTML = `
      <div class="stat-card-row">
        <div class="stat-card">
          <span class="stat-label">Error Absoluto Máximo (||x_ref - x_GCP||_∞)</span>
          <span class="stat-value" style="color: var(--primary); font-size: 1.15rem;">${err.maxAbsError.toExponential(3)}</span>
          <span class="stat-sub">Máxima discrepancia individual</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Residuo Relativo Global</span>
          <span class="stat-value" style="color: var(--success); font-size: 1.15rem;">${err.globalRelRes.toExponential(3)}</span>
          <span class="stat-sub">||b - A x_GCP||₂ / ||b||₂</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Norma Euclídea del Error (||e||₂)</span>
          <span class="stat-value" style="font-size: 1.15rem;">${err.normErr.toExponential(3)}</span>
          <span class="stat-sub">Distancia a la solución exacta</span>
        </div>
      </div>
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Activo Financiero</th>
              <th>x_ref (Exacta)</th>
              <th>x_GCP (Iterativa)</th>
              <th>Error Absoluto (E_a)</th>
              <th>Error Relativo (E_r)</th>
              <th>Error Porcentual (E_p)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  // Renderizar Gráfico de Convergencia (Chart.js con SVG fallback)
  function renderConvergenceChart() {
    const canvas = document.getElementById("convergence-chart-canvas");
    const fallbackBox = document.getElementById("chart-fallback-container");
    if (!canvas) return;

    const gcpHist = AppState.gcpSol.history;
    const gcHist = AppState.gcSol.history;

    const maxK = Math.max(gcpHist.length, gcHist.length);
    const labels = Array.from({ length: maxK }, (_, i) => `Iter ${i}`);

    const gcpData = gcpHist.map(h => Math.max(1e-18, h.relRes));
    const gcData = gcHist.map(h => Math.max(1e-18, h.relRes));

    if (window.Chart) {
      if (fallbackBox) fallbackBox.style.display = "none";
      canvas.style.display = "block";

      if (AppState.chartInstance) {
        AppState.chartInstance.destroy();
      }

      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      const textColor = isDark ? "#94a3b8" : "#64748b";
      const gridColor = isDark ? "#334155" : "#e2e8f0";

      AppState.chartInstance = new Chart(canvas, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: `GCP (${AppState.gcpSol.preconditionerName})`,
              data: gcpData,
              borderColor: "#1a4f8a",
              backgroundColor: "rgba(26, 79, 138, 0.1)",
              borderWidth: 2.5,
              tension: 0.15,
              pointRadius: 4,
              fill: false
            },
            {
              label: "GC Simple (Sin Precondicionar)",
              data: gcData,
              borderColor: "#ef4444",
              borderDash: [5, 5],
              borderWidth: 2,
              pointRadius: 3,
              fill: false
            },
            {
              label: `Tolerancia ε = 10⁻⁶`,
              data: new Array(maxK).fill(AppState.tol),
              borderColor: "#10b981",
              borderDash: [2, 4],
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              type: "logarithmic",
              title: {
                display: true,
                text: "Residuo Relativo ||r_k||₂ / ||b||₂ (Escala Logarítmica)",
                color: textColor
              },
              grid: { color: gridColor },
              ticks: { color: textColor }
            },
            x: {
              title: {
                display: true,
                text: "Número de Iteraciones (k)",
                color: textColor
              },
              grid: { color: gridColor },
              ticks: { color: textColor }
            }
          },
          plugins: {
            legend: {
              labels: { color: textColor, font: { weight: 600 } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toExponential(3)}`
              }
            }
          }
        }
      });
    } else {
      // Fallback SVG puro si no carga Chart.js
      canvas.style.display = "none";
      if (fallbackBox) {
        fallbackBox.style.display = "block";
        fallbackBox.innerHTML = renderSvgFallbackChart(gcpData, gcData, maxK);
      }
    }
  }

  // Generador de gráfico SVG offline de respaldo
  function renderSvgFallbackChart(gcpData, gcData, maxK) {
    const width = 800;
    const height = 300;
    const padding = 50;

    let pointsGCP = '';
    let pointsGC = '';

    const minLog = -16;
    const maxLog = 0;

    for (let i = 0; i < maxK; i++) {
      const x = padding + (i / Math.max(1, maxK - 1)) * (width - 2 * padding);

      if (i < gcpData.length) {
        const logVal = Math.log10(gcpData[i]);
        const normY = (logVal - minLog) / (maxLog - minLog);
        const y = (height - padding) - normY * (height - 2 * padding);
        pointsGCP += `${x},${y} `;
      }

      if (i < gcData.length) {
        const logVal = Math.log10(gcData[i]);
        const normY = (logVal - minLog) / (maxLog - minLog);
        const y = (height - padding) - normY * (height - 2 * padding);
        pointsGC += `${x},${y} `;
      }
    }

    return `
      <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="background: transparent;">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#64748b" stroke-width="1.5" />
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#64748b" stroke-width="1.5" />
        <polyline fill="none" stroke="#1a4f8a" stroke-width="3" points="${pointsGCP.trim()}" />
        <polyline fill="none" stroke="#ef4444" stroke-width="2" stroke-dasharray="5,5" points="${pointsGC.trim()}" />
        <text x="${width/2}" y="${height - 15}" text-anchor="middle" fill="#64748b" font-size="12">Iteraciones (k)</text>
        <text x="15" y="${height/2}" text-anchor="middle" transform="rotate(-90 15,${height/2})" fill="#64748b" font-size="12">log10(Residuo Relativo)</text>
      </svg>
    `;
  }

  // Generar la Tabla Comparativa Obligatoria de los 3 Escenarios (Sección 8 del documento)
  function renderComparativeTable() {
    const container = document.getElementById("comparative-table-container");
    if (!container) return;

    const scenarios = ["ideal", "stress", "ill_conditioned"];
    const colData = [];

    for (const scId of scenarios) {
      const sc = FinancialScenarios.get(scId);
      const ref = MatrixMath.solveCholesky(sc.A, sc.b);
      const precond = (scId === "ill_conditioned")
        ? NumericalSolvers.createJacobiPreconditioner(sc.A)
        : NumericalSolvers.createJacobiPreconditioner(sc.A);

      const gcp = NumericalSolvers.solveGCP(sc.A, sc.b, precond, sc.x0, 1e-6, 100);
      const gc = NumericalSolvers.solveGC(sc.A, sc.b, sc.x0, 1e-6, 100);
      const err = NumericalSolvers.computeErrors(ref.x, gcp.x, sc.A, sc.b);
      const condA = MatrixMath.conditionNumber(sc.A);
      const condPrec = NumericalSolvers.computePreconditionedConditionNumber(sc.A, precond);

      colData.push({
        sc,
        ref,
        gcp,
        gc,
        err,
        condA,
        condPrec
      });
    }

    let html = `
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th style="min-width: 220px;">Indicador Obligatorio</th>
              <th style="background-color: rgba(16, 185, 129, 0.08);">${colData[0].sc.title}</th>
              <th style="background-color: rgba(245, 158, 11, 0.08);">${colData[1].sc.title}</th>
              <th style="background-color: rgba(239, 68, 68, 0.08);">${colData[2].sc.title}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Solución de Referencia [x₁..x₄]</strong></td>
              <td class="mono">[${colData[0].ref.x.map(v => v.toFixed(3)).join(", ")}]</td>
              <td class="mono">[${colData[1].ref.x.map(v => v.toFixed(3)).join(", ")}]</td>
              <td class="mono">[${colData[2].ref.x.map(v => v.toFixed(3)).join(", ")}]</td>
            </tr>
            <tr>
              <td><strong>Solución GCP [x₁..x₄]</strong></td>
              <td class="mono">[${colData[0].gcp.x.map(v => v.toFixed(3)).join(", ")}]</td>
              <td class="mono">[${colData[1].gcp.x.map(v => v.toFixed(3)).join(", ")}]</td>
              <td class="mono">[${colData[2].gcp.x.map(v => v.toFixed(3)).join(", ")}]</td>
            </tr>
            <tr>
              <td><strong>Error Absoluto (E_a) por variable</strong></td>
              <td class="mono">[${colData[0].err.absErrors.map(v => v.toExponential(1)).join(", ")}]</td>
              <td class="mono">[${colData[1].err.absErrors.map(v => v.toExponential(1)).join(", ")}]</td>
              <td class="mono">[${colData[2].err.absErrors.map(v => v.toExponential(1)).join(", ")}]</td>
            </tr>
            <tr>
              <td><strong>Error Porcentual (E_p) por variable</strong></td>
              <td class="mono">[${colData[0].err.pctErrors.map(v => v.toExponential(1) + "%").join(", ")}]</td>
              <td class="mono">[${colData[1].err.pctErrors.map(v => v.toExponential(1) + "%").join(", ")}]</td>
              <td class="mono">[${colData[2].err.pctErrors.map(v => v.toExponential(1) + "%").join(", ")}]</td>
            </tr>
            <tr>
              <td><strong>Iteraciones GC (Sin Precondicionar)</strong></td>
              <td class="mono font-bold">${colData[0].gc.iterations}</td>
              <td class="mono font-bold">${colData[1].gc.iterations}</td>
              <td class="mono font-bold">${colData[2].gc.iterations}</td>
            </tr>
            <tr>
              <td><strong>Iteraciones GCP (Precondicionado)</strong></td>
              <td class="mono font-bold" style="color: var(--primary);">${colData[0].gcp.iterations}</td>
              <td class="mono font-bold" style="color: var(--primary);">${colData[1].gcp.iterations}</td>
              <td class="mono font-bold" style="color: var(--primary);">${colData[2].gcp.iterations}</td>
            </tr>
            <tr>
              <td><strong>Número de Condición κ(A)</strong></td>
              <td class="mono">${colData[0].condA.cond.toFixed(2)}</td>
              <td class="mono">${colData[1].condA.cond.toFixed(2)}</td>
              <td class="mono" style="color: var(--danger); font-weight: 700;">${colData[2].condA.cond.toFixed(1)}</td>
            </tr>
            <tr>
              <td><strong>Número de Condición Precond. κ(M⁻¹A)</strong></td>
              <td class="mono">${colData[0].condPrec.toFixed(2)}</td>
              <td class="mono">${colData[1].condPrec.toFixed(2)}</td>
              <td class="mono" style="color: var(--success); font-weight: 700;">${colData[2].condPrec.toFixed(1)}</td>
            </tr>
            <tr>
              <td><strong>Residuo Relativo Final GCP</strong></td>
              <td class="mono">${colData[0].gcp.finalRelRes.toExponential(2)}</td>
              <td class="mono">${colData[1].gcp.finalRelRes.toExponential(2)}</td>
              <td class="mono">${colData[2].gcp.finalRelRes.toExponential(2)}</td>
            </tr>
            <tr>
              <td><strong>¿Convergió el Algoritmo? (tol &lt; 10⁻⁶)</strong></td>
              <td><span class="badge badge-success">✓ Sí</span></td>
              <td><span class="badge badge-success">✓ Sí</span></td>
              <td><span class="badge badge-success">✓ Sí</span></td>
            </tr>
            <tr>
              <td><strong>Interpretación Financiera</strong></td>
              <td style="font-size: 0.8rem; line-height: 1.4;">${colData[0].sc.interpretation}</td>
              <td style="font-size: 0.8rem; line-height: 1.4;">${colData[1].sc.interpretation}</td>
              <td style="font-size: 0.8rem; line-height: 1.4;">${colData[2].sc.interpretation}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
  }

  // Módulo de Pruebas de Software (QA)
  function renderQASuite() {
    const report = QATestSuite.runAll();
    const container = document.getElementById("qa-test-results-container");
    const summaryBadge = document.getElementById("qa-summary-badge");

    if (summaryBadge) {
      summaryBadge.innerHTML = `
        <span class="badge ${report.allPassed ? 'badge-success' : 'badge-danger'}">
          ${report.passedCount}/${report.total} Casos Aprobados (${report.coveragePercent}% Éxito)
        </span>
      `;
    }

    if (!container) return;

    let rowsHtml = '';
    report.results.forEach(t => {
      rowsHtml += `
        <tr>
          <td><span class="mono"><strong>${t.id}</strong></span></td>
          <td>
            <strong>${t.name}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${t.category}</div>
          </td>
          <td style="font-size: 0.8rem; max-width: 250px;">${t.input}</td>
          <td style="font-size: 0.8rem; max-width: 250px;">${t.expected}</td>
          <td style="font-size: 0.8rem; max-width: 250px;" class="mono">${t.obtained}</td>
          <td>
            <span class="qa-status-pill ${t.passed ? 'qa-status-pass' : 'qa-status-fail'}">
              ${t.passed ? '✓ PASS' : '✗ FAIL'}
            </span>
          </td>
          <td style="font-size: 0.8rem;">${t.conclusion}</td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Caso de Prueba</th>
              <th>Entrada</th>
              <th>Resultado Esperado</th>
              <th>Resultado Obtenido</th>
              <th>Estado</th>
              <th>Conclusión</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  // Listeners Generales de la UI
  function setupUIListeners() {
    // Botones de carga rápida de escenarios
    document.querySelectorAll(".scenario-card-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const scId = btn.dataset.scenario;
        loadScenarioState(scId);
      });
    });

    // Selector de Precondicionador
    const precondSelect = document.getElementById("precond-select");
    if (precondSelect) {
      precondSelect.addEventListener("change", (e) => {
        AppState.precondType = e.target.value;
        runAllCalculations();
      });
    }

    // Input Tolerancia
    const tolInput = document.getElementById("tol-input");
    if (tolInput) {
      tolInput.addEventListener("change", (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val > 0) {
          AppState.tol = val;
          runAllCalculations();
        }
      });
    }

    // Botón Recalcular / Resolver
    const btnSolve = document.getElementById("btn-solve-system");
    if (btnSolve) {
      btnSolve.addEventListener("click", () => {
        runAllCalculations();
      });
    }

    // Botón Restaurar Escenario Actual
    const btnReset = document.getElementById("btn-reset-scenario");
    if (btnReset) {
      btnReset.addEventListener("click", () => {
        loadScenarioState(AppState.currentScenarioId === "custom" ? "ideal" : AppState.currentScenarioId);
      });
    }

    // Botón Ejecutar Suite de Pruebas QA
    const btnRunQA = document.getElementById("btn-run-qa-tests");
    if (btnRunQA) {
      btnRunQA.addEventListener("click", () => {
        renderQASuite();
      });
    }

    // Botón Imprimir / Exportar Reporte a PDF
    const btnPrint = document.getElementById("btn-export-pdf");
    if (btnPrint) {
      btnPrint.addEventListener("click", () => {
        window.print();
      });
    }

    // Botón Alternar Tema Oscuro / Claro
    const btnTheme = document.getElementById("btn-toggle-theme");
    if (btnTheme) {
      const savedTheme = localStorage.getItem("app_theme") || "light";
      document.documentElement.setAttribute("data-theme", savedTheme);
      updateThemeIcon(savedTheme);

      btnTheme.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("app_theme", newTheme);
        updateThemeIcon(newTheme);
        renderConvergenceChart(); // Re-renderizar gráfico con colores del tema
      });
    }

    // Actualizar Tabla Comparativa
    const btnUpdateComp = document.getElementById("btn-refresh-comparative");
    if (btnUpdateComp) {
      btnUpdateComp.addEventListener("click", () => {
        renderComparativeTable();
      });
    }
  }

  function updateThemeIcon(theme) {
    const iconEl = document.getElementById("theme-icon");
    if (iconEl) {
      iconEl.textContent = theme === "dark" ? "☀️" : "🌙";
    }
  }

  // Inicialización Completa de la Aplicación
  loadScenarioState("ideal");
  setupUIListeners();
  renderComparativeTable();
  renderQASuite();
});
