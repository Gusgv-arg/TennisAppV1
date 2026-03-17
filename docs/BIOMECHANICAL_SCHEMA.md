## 📐 Definición Técnica de Indicadores y Pesos
A continuación se detallan las **4 fases** y los **5 indicadores biomecánicos** que utiliza la IA para evaluar el saque. Cada fase tiene un peso del **25%** sobre el score final (Total 100%).

---

### Fase 1: Preparación (Setup) - Peso 25%
**Indicador 1. Orientación de pies (Peso 25%)**


*   **Vector de medida:** Línea que nace en el **pie trasero** hacia el **pie delantero**.
*   **Landmarks (MediaPipe):**
    *   **Jugador Diestro:** Pie trasero (**32**) → Pie delantero (**31**).
    *   **Jugador Zurdo:** Pie trasero (**31**) → Pie delantero (**32**).
*   **Referencia 0°:** El **fondo de cancha** (baseline) es el grado 0.
*   **Medición del ángulo:**
    *   **Diestro:** Se mide el ángulo que se forma hacia su **derecha**.
    *   **Zurdo:** Se mide el ángulo que se forma hacia su **izquierda**.
*   **Valores Objetivo (Target):** El 100% de cumplimiento se otorga para ángulos **menores o iguales a 70°**. A partir de ese valor el score disminuye linealmente hasta **0% en los 130°** (sobre-rotación).



### Fase 2: Armado - Peso 25%
**Indicador 2. Flexión de rodilla delantera (Peso 12,5%)**
*   **Lógica de Medición:** Ángulo formado por dos líneas con vértice en la rodilla.
    *   **Línea 1:** Del Tobillo a la Rodilla.
    *   **Línea 2:** De la Rodilla a la Cadera.
*   **Sentido:** Se mide en **sentido de las agujas del reloj** comenzando desde la Línea 1.
*   **Landmarks (MediaPipe):**
    *   **Diestro (Rodilla Izquierda):** Tobillo (**27**) → Rodilla (**25**) → Cadera (**23**).
    *   **Zurdo (Rodilla Derecha):** Tobillo (**28**) → Rodilla (**26**) → Cadera (**24**).
*   **Puntaje:** El valor objetivo para el 100% de score es un ángulo **menor o igual a 150°**. El puntaje disminuye linealmente hasta llegar al **0% en los 170°** (pierna casi recta).

**Indicador 3. Posición de Trofeo (Peso 12,5%)**
*   **Momento de Captura (Trigger):** Se analiza el fotograma exacto donde el codo del brazo que golpea llega a **90°** de flexión.
    *   **Diestro:** Ángulo (12-14-16) = 90°.
    *   **Zurdo:** Ángulo (11-13-15) = 90°.
*   **Lógica de Medición:** Ángulo entre la línea del brazo de lanzamiento y la línea del hombro-codo de la raqueta.
*   **Sentido:** Se mide en **sentido anti-horario** (contrario a las agujas del reloj).
*   **Landmarks (MediaPipe):**
    *   **Diestro:** Desde línea (12-14) hasta línea (15-11).
    *   **Zurdo:** Desde línea (11-13) hasta línea (16-12).
*   **Puntaje:** El valor objetivo para el 100% de score es un ángulo **menor o igual a 150°**. El puntaje disminuye linealmente hasta llegar al **0% en los 170°** (posición plana/colapsada).

### Fase 3: Impacto - Peso 25%
**Indicador 4. Despegue de talón / Salto (Peso 25%)**
*   **Lógica:** Se mide la elevación vertical de los talones respecto a su posición inicial en el suelo.
*   **Landmarks (MediaPipe):** Talón izquierdo (**29**) y talón derecho (**30**).
*   **Referencia de Calidad:** Una diferencia de **más de 10 cm** (calculada mediante escala proporcional) es considerada la referencia para el 100% de score.

### Fase 4: Terminación (Follow Through) - Peso 25%
**Indicador 5. Terminación - Brazo Cruza Rodilla (Peso 25%)**
*   **Lógica:** La muñeca del brazo ejecutor debe cruzar completamente la línea vertical de la rodilla contraria tras el impacto.
*   **Landmarks (MediaPipe):**
    *   **Jugador Diestro:** Muñeca derecha (**16**) debe pasar la línea de la rodilla izquierda (**25**).
    *   **Jugador Zurdo:** Muñeca izquierda (**15**) debe pasar la línea de la rodilla derecha (**26**).
*   **Referencia de Calidad:** El 100% de score se otorga cuando se detecta este cruce, asegurando una desaceleración correcta y un swing completo.
