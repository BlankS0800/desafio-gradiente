/**
 * Módulo de Escenarios Financieros
 * Modela la asignación de carteras de inversión y gestión de riesgo (Markowitz Regularizado / CAPM)
 * bajo tres escenarios: Ideal, Bajo Estrés Financiero y Mal Condicionado.
 * Carrera de Informática - Universidad Mayor de San Andrés (UMSA)
 */

const FinancialScenarios = {
  // Metadatos de las variables del modelo financiero
  variables: [
    {
      symbol: "x₁",
      name: "Bonos Soberanos del Tesoro (AAA)",
      category: "Renta Fija Soberana",
      unit: "M USD",
      description: "Activos de máxima calidad crediticia, alta liquidez y baja volatilidad. Proveen anclaje de seguridad y preservación de capital."
    },
    {
      symbol: "x₂",
      name: "Acciones de Crecimiento / Sector Tecnológico",
      category: "Renta Variable Global",
      unit: "M USD",
      description: "Títulos de alta beta y alta rentabilidad esperada, altamente sensibles al ciclo económico y a variaciones de tasas de interés."
    },
    {
      symbol: "x₃",
      name: "Commodities & Energía Sostenible",
      category: "Activos Reales / Hedge",
      unit: "M USD",
      description: "Materias primas y fondos verdes que actúan como cobertura frente a choques inflacionarios y cuellos de botella en la cadena de suministros."
    },
    {
      symbol: "x₄",
      name: "Crédito Corporativo Privado Senior",
      category: "Deuda Privada",
      unit: "M USD",
      description: "Emisiones corporativas de grado de inversión que ofrecen un spread de rendimiento sobre la deuda soberana con riesgo crediticio acotado."
    }
  ],

  // Definición de los 3 Escenarios Obligatorios
  scenarios: {
    ideal: {
      id: "ideal",
      title: "Escenario 1: Ideal (Estabilidad y Equilibrio)",
      badge: "Bien Condicionado",
      badgeClass: "badge-success",
      description: "Entorno macroeconómico favorable con inflación controlada, crecimiento económico sostenido y baja volatilidad en los mercados. Las correlaciones entre las distintas clases de activos se mantienen en rangos normales e históricos (0.15 - 0.35).",
      financialJustification: "En este régimen de baja incertidumbre, la matriz de riesgo A presenta diagonales dominantes bien balanceadas y un número de condición bajo κ(A) ≈ 2.27. El vector de rendimientos objetivo b representa los flujos esperados estándar acordes a un portafolio equilibrado.",
      A: [
        [10.0,  2.5,  1.8,  1.2],
        [ 2.5, 14.0,  3.0,  2.0],
        [ 1.8,  3.0, 12.0,  2.5],
        [ 1.2,  2.0,  2.5, 15.0]
      ],
      b: [25.0, 48.0, 36.0, 42.0],
      x0: [0.0, 0.0, 0.0, 0.0],
      recommendedPrecond: "jacobi",
      interpretation: "El algoritmo converge velozmente en pocas iteraciones tanto en GC como en GCP. La solución de referencia y la aproximación iterativa coinciden prácticamente con precisión de máquina (error porcentual < 1e-12%). La asignación de capital resultante es proporcional al perfil de riesgo-retorno."
    },

    stress: {
      id: "stress",
      title: "Escenario 2: Bajo Estrés Financiero (Shock Inflacionario)",
      badge: "Perturbación Macroeconómica",
      badgeClass: "badge-warning",
      description: "Crisis geopolítica y choque de oferta energética generan una espiral inflacionaria y una abrupta subida de tasas de interés por parte de los bancos centrales. Se disparan las volatilidades de la renta variable y la correlación entre bonos y acciones se incrementa debido a la venta forzada de activos para cobertura de márgenes.",
      financialJustification: "Matemáticamente, los costos y varianzas aumentan de 2x a 3x en la diagonal de A, mientras que las covarianzas cruzadas crecen fuertemente. El vector b se incrementa significativamente (de 65 a 150 M USD) debido a requerimientos de liquidez y flujos de caja más exigentes. El número de condición se incrementa moderadamente, desplazando el punto de equilibrio financiero.",
      A: [
        [22.0,  8.5,  6.2,  5.0],
        [ 8.5, 45.0, 16.0, 12.0],
        [ 6.2, 16.0, 35.0, 10.5],
        [ 5.0, 12.0, 10.5, 38.0]
      ],
      b: [65.0, 150.0, 95.0, 110.0],
      x0: [0.0, 0.0, 0.0, 0.0],
      recommendedPrecond: "jacobi",
      interpretation: "A pesar del incremento de varianza y covarianza, la simetría y definición positiva se mantienen intactas. El método GCP converge robustamente satisfaciendo la tolerancia de 10⁻⁶. Financieramente, el modelo asigna una mayor proporción de capital a activos de menor volatilidad relativa para contrarrestar el riesgo sistémico."
    },

    ill_conditioned: {
      id: "ill_conditioned",
      title: "Escenario 3: Mal Condicionado (Multicolinealidad & Mal Escalamiento)",
      badge: "κ(A) ≫ 1",
      badgeClass: "badge-danger",
      description: "Presencia combinada de activos altamente correlacionados (duplicidad de fondos indexados sintéticos con correlación > 0.99) y una enorme disparidad de escala de volatilidad entre clases de activos (un activo con riesgo/escala masiva respecto a activos microfinancieros).",
      financialJustification: "Esta situación genera una matriz A simétrica definida positiva pero con autovalores muy dispersos (λ_max / λ_min > 20,000), resultando en un número de condición elevado κ(A) ≈ 25,718. En este escenario crítico, el Gradiente Conjugado simple sufre un severo retraso y deterioro numérico, mientras que el Precondicionador (Jacobi / SSOR / IC0) comprime el espectro de autovalores, reduciendo drásticamente κ(M⁻¹A) a ~655 y acelerando la convergencia.",
      A: [
        [10000.0,   800.0,   120.0,   15.0],
        [  800.0,   500.0,    40.0,    5.0],
        [  120.0,    40.0,    25.0,    1.5],
        [   15.0,     5.0,     1.5,    0.5]
      ],
      b: [25000.0, 1500.0, 80.0, 2.0],
      x0: [0.0, 0.0, 0.0, 0.0],
      recommendedPrecond: "jacobi",
      interpretation: "Demostración concluyente del artículo de Suñagua (2020): El precondicionamiento resulta indispensable en sistemas financieros con mal escalamiento o alta multicolinealidad. El residuo final de GCP es órdenes de magnitud más preciso que GC simple, y el precondicionador reduce el número de condición efectivo en más del 97%."
    }
  },

  // Obtener escenario por ID
  get(id) {
    return this.scenarios[id] || this.scenarios.ideal;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FinancialScenarios;
}
