# Desafío Académico: Aplicación del Método de Gradientes Conjugados Precondicionado en Problemas Financieros

**Universidad Mayor de San Andrés (UMSA)**  
**Facultad de Ciencias Puras y Naturales · Carrera de Informática**  
**Materia:** Métodos Numéricos  
**Modalidad:** Individual  
**Menciones:** Inteligencia Artificial y Ciencia de Datos / Ingeniería de Sistemas / Desarrollo de Sistemas  

---

## 1. Descripción del Proyecto

Este proyecto implementa una aplicación web científica interactiva en **HTML5, CSS3 y JavaScript puro (ES6+)** para modelar y resolver un problema financiero de optimización de carteras de inversión y gestión de riesgo ($n \ge 4$) mediante el **Método de Gradientes Conjugados Precondicionado (GCP)**, contrastado frente a la **Solución Numérica de Referencia (Método Directo de Cholesky)** y el **Gradiente Conjugado Simple (GC sin precondicionar)**.

La fundamentación algorítmica se basa rigurosamente en el artículo científico:
> **Suñagua S., P. (2020).** *Método de Gradientes Conjugados Precondicionado*. Revista Boliviana de Matemática – UMSA, 04, 2–7.

---

## 2. Modelo Financiero y Variables ($n \ge 4$)

El modelo aborda el problema de **asignación óptima de capital en carteras de inversión con regularización cuadrática de riesgo** (Markowitz, 1952):

$$\min_{x} \frac{1}{2} x^T \Sigma x - \mu^T x + \frac{\gamma}{2} \|x\|_2^2 \iff (\Sigma + \gamma I) x = \mu \iff A x = b$$

Donde:
- **$A = \Sigma + \gamma I$:** Matriz de covarianza y riesgo marginal regularizada ($n \times n$). Es simétrica ($A = A^T$) y estrictamente definida positiva ($x^T A x > 0, \forall x \neq 0$).
  - $a_{ii} = \sigma_i^2 + \gamma$: Varianza del activo $i$ más parámetro de estabilidad de liquidez.
  - $a_{ij} = \text{Cov}(R_i, R_j) = \rho_{ij}\sigma_i\sigma_j$: Covarianza e interdependencia de riesgo entre los activos $i$ y $j$.
- **$b = \mu$:** Vector de metas de rendimiento o flujos de caja requeridos por la institución financiera (en Millones de USD).
- **$x$:** Vector de asignaciones óptimas de capital a cada activo (en Millones de USD).

### Significado de las Variables Financieras:
1. **$x_1$:** Bonos Soberanos del Tesoro AAA (Renta fija, alta liquidez, ancla de estabilidad).
2. **$x_2$:** Renta Variable Global / Sector Tecnológico (Crecimiento de capital, alta rentabilidad y volatilidad).
3. **$x_3$:** Commodities e Infraestructura Energética (Activos reales, cobertura contra la inflación).
4. **$x_4$:** Crédito Corporativo Privado Senior (Títulos corporativos con spread de rendimiento).

---

## 3. Los Tres Escenarios Obligatorios

| Escenario | Condicionamiento | Contexto Financiero | Justificación Matemática |
| :--- | :--- | :--- | :--- |
| **1. Ideal** | $\kappa(A) \approx 2.27$ (Bajo) | Estabilidad macroeconómica, inflación controlada y correlaciones históricas balanceadas (0.15 - 0.35). | Matriz con diagonal dominante, autovalores concentrados ($\lambda \in [8.72, 19.77]$). Convergencia inmediata en pocas iteraciones. |
| **2. Bajo Estrés** | $\kappa(A) \approx 13.8$ (Moderado) | Shock inflacionario y salto de tasas de interés. Volatilidades duplicadas y mayor co-movimiento por liquidación de activos. | Diagonales y covarianzas aumentadas $2\times - 3\times$. Vector $b$ perturbado hacia arriba por exigencias de liquidez. |
| **3. Mal Condicionado** | $\kappa(A) \approx 25,718$ ($\gg 1$) | Multicolinealidad extrema (fondos sintéticos con $\rho > 0.99$) y disparidad masiva de escala de riesgo entre activos ($10^4$ vs $10^{-1}$). | Autovalores muy dispersos. GC simple sufre retardo de convergencia; el Precondicionador de Jacobi reduce $\kappa(M^{-1}A)$ a $\approx 655$ (reducción $> 97\%$). |

---

## 4. Requerimientos Matemáticos Implementados

### 4.1. Verificación de Simetría y Definición Positiva (SPD)
- **Simetría:** Comprobación estricta $\max_{i,j} |a_{ij} - a_{ji}| < 10^{-12}$.
- **Criterio de Sylvester:** Cálculo exacto de todos los menores principales conductores $\Delta_k = \det(A_{1..k, 1..k}) > 0$ para $k = 1, \dots, n$.
- **Descomposición Espectral:** Cálculo de autovalores mediante el algoritmo de rotaciones de Jacobi para matrices simétricas y cálculo de $\kappa_2(A) = \lambda_{max} / \lambda_{min}$.

### 4.2. Solución Numérica de Referencia (Método Directo)
- **Factorización de Cholesky ($A = L L^T$):** Cálculo de la matriz triangular inferior $L$ con diagonal positiva.
- **Sustitución Progresiva:** $L y = b$.
- **Sustitución Regresiva:** $L^T x = y$.
- Provee la solución exacta $x_{ref}$ para medir los errores del método iterativo.

### 4.3. Gradientes Conjugados Precondicionado (Suñagua, 2020)
- Inicialización con $x_0$ (por defecto ceros), $r_0 = b - A x_0$, resolución de $M z_0 = r_0$, $p_0 = z_0$.
- Criterio de parada estricto: $\|r_{k+1}\|_2 / \|b\|_2 < 10^{-6}$.
- **Precondicionadores Soportados:**
  1. **Jacobi (Diagonal):** $M = \text{diag}(A)$.
  2. **SSOR:** $M = \frac{1}{\omega(2-\omega)}(D + \omega L) D^{-1} (D + \omega L^T)$ con $\omega \in (0, 2)$.
  3. **Cholesky Incompleto $IC(0)$:** Factorización aproximada conservando dispersión.
  4. **Identidad ($M = I$):** Equivalente a Gradiente Conjugado simple como elemento de contraste.

### 4.4. Análisis Exhaustivo de Errores
- Error absoluto: $E_{a,i} = |x_{ref,i} - x_{GCP,i}|$
- Error relativo: $E_{r,i} = E_{a,i} / |x_{ref,i}|$
- Error porcentual: $E_{p,i} = E_{r,i} \times 100\%$
- Residuo relativo global: $\|b - A x_{GCP}\|_2 / \|b\|_2$
- Número de condición precondicionado: $\kappa(M^{-1} A)$

---

## 5. Arquitectura del Código Fuente

```
desafio_gradiente/
├── index.html          # Interfaz web principal reactiva, accesible y semántica
├── css/
│   └── styles.css      # Estilos CSS modernos, variables CSS, dark/light mode y print
├── js/
│   ├── matrix.js       # Álgebra lineal: Cholesky, Sylvester, autovalores, normas, inversión
│   ├── algorithms.js   # Solvers: Algoritmo de Suñagua (2020), GC, Jacobi, SSOR, IC(0)
│   ├── scenarios.js    # Definición de los 3 escenarios financieros y metadatos
│   ├── qa.js           # Módulo QA con suite automatizada de pruebas unitarias y de integración
│   └── app.js          # Controlador principal de la UI, eventos, gráficos y reactividad
└── README.md           # Documentación técnica, académica y guía de ejecución
```

---

## 6. Módulo de Pruebas de Software (QA)

El sistema incluye un módulo de control de calidad con ejecución automatizada y comprobable de los casos de prueba obligatorios:

| ID | Caso de Prueba | Categoría | Estado | Conclusión |
| :--- | :--- | :--- | :---: | :--- |
| **TC-01** | Carga y Ejecución de Escenarios | Funcional | **PASS** | Los 3 escenarios obligatorios son SPD y convergen con residuo $< 10^{-6}$. |
| **TC-02** | Validación de Matriz No Válida | Seguridad / Errores | **PASS** | Detecta asimetría y violación de Sylvester, capturando excepciones sin colapsar la UI. |
| **TC-03** | Edición Dinámica y Recálculo | Reactividad | **PASS** | Modificación de coeficientes recalcula solución con error absoluto $< 10^{-6}$. |
| **TC-04** | Comparativa de Precondicionamiento | Eficiencia | **PASS** | En el escenario mal condicionado, GCP iguala o supera la convergencia y reduce $\kappa(M^{-1}A)$. |
| **TC-05** | Criterio de Parada y Tolerancia | Precisión | **PASS** | El algoritmo se detiene exactamente al cruzar el umbral $\|r_k\|_2 / \|b\|_2 < 10^{-6}$. |
| **TC-06** | Consistencia de Cholesky y Espectro | Álgebra Computacional | **PASS** | Reconstrucción $\|A - L L^T\|_F < 10^{-12}$ y todos los autovalores $\lambda_i > 0$. |

---

## 7. Instrucciones de Ejecución Local y Despliegue

La aplicación está construida enteramente en tecnologías estándar de la web (**HTML, CSS y JavaScript**), por lo que es autónoma y **no requiere dependencias de backend ni compilación**.

### Opción 1: Abrir Directamente en el Navegador
Haga doble clic en el archivo `index.html` o ábralo con Google Chrome, Mozilla Firefox, Microsoft Edge o Safari.

### Opción 2: Servidor Local con Node.js
```bash
npx serve .
# O bien:
npx http-server -p 8080
```
Luego abra `http://localhost:8080` en su navegador.

### Opción 3: Servidor Local con Python
```bash
python -m http.server 8080
```
Luego ingrese a `http://localhost:8080`.

### Opción 4: Despliegue en GitHub Pages
1. Suba este repositorio a GitHub.
2. Ingrese a **Settings** > **Pages**.
3. En **Source**, elija la rama `main` (directorio `/root`).
4. La página estará publicada automáticamente y con acceso público universal.

---

## 8. Referencias Bibliográficas

1. **Suñagua S., P. (2020).** *Método de Gradientes Conjugados Precondicionado*. Revista Boliviana de Matemática – UMSA, 04, 2–7.
2. **Golub, G. H., & Van Loan, C. F. (2013).** *Matrix Computations* (4th ed.). Johns Hopkins University Press.
3. **Saad, Y. (2003).** *Iterative Methods for Sparse Linear Systems* (2nd ed.). Society for Industrial and Applied Mathematics (SIAM).
4. **Markowitz, H. (1952).** *Portfolio Selection*. The Journal of Finance, 7(1), 77–91.

