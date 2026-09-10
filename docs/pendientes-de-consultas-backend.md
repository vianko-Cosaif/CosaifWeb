# Consultas del backend: correcciones pendientes

Revisión estática del árbol local `BackCosaif2`, realizada el 9 de septiembre de 2026. Estos hallazgos **no se corrigieron en el backend** durante la mejora de la web. Los enlaces señalan el código inspeccionado; las líneas pueden cambiar con otras ediciones. No se ejecutaron consultas que puedan modificar rondas ni se midieron tiempos del servicio en esta revisión.

## 1. P1 — Combinar estado y alcance en incidentes

**Cuándo ocurre:** `GET /incidentes?estado=ABIERTO&localidadId=…`, o cualquier estado acompañado de empresa, localidad o ambos. También afecta a cuentas cuyo alcance agrega esos parámetros automáticamente.

**Evidencia:** [IncidenteController.ts:88](/Users/viankodesarrollo/Desktop/Sistemas/eco/BackCosaif2/src/Rutas/Incidente/IncidenteController.ts:88) retorna desde las ramas de empresa/localidad antes de aplicar `estado`. Los métodos reciben únicamente IDs y paginación; sus consultas y conteos omiten el estado: [IncidenteModel.ts:1115](/Users/viankodesarrollo/Desktop/Sistemas/eco/BackCosaif2/src/models/Incidente/IncidenteModel.ts:1115), [IncidenteModel.ts:1142](/Users/viankodesarrollo/Desktop/Sistemas/eco/BackCosaif2/src/models/Incidente/IncidenteModel.ts:1142) y [IncidenteModel.ts:1169](/Users/viankodesarrollo/Desktop/Sistemas/eco/BackCosaif2/src/models/Incidente/IncidenteModel.ts:1169). La ruta ya aplica autorización y alcance en [IncidenteRutas.ts:30](/Users/viankodesarrollo/Desktop/Sistemas/eco/BackCosaif2/src/Rutas/Incidente/IncidenteRutas.ts:30).

**Impacto:** la API puede devolver abiertos, cerrados y resueltos juntos aunque el filtro indique uno; el total corresponde a esa mezcla. Filtrar únicamente la página recibida en la web no corrige el total ni recupera coincidencias de otras páginas.

**Corrección sugerida:** construir un único `where` que combine el alcance autorizado del movimiento y el estado del incidente, y reutilizarlo en `findMany` y `count`. Conservar `PASADOS = CERRADO + RESUELTO`, aplicar un tamaño de página validado y ordenar con desempate por ID. Mantener la autorización existente.

**Aceptación:** pruebas con incidentes de al menos dos empresas y dos localidades cubren cada estado y cada combinación de alcance. Ninguna fila sale del alcance ni del estado seleccionado; `meta.total` coincide con todas las coincidencias; las páginas no repiten ni omiten registros con la misma fecha. Una consulta de usuario restringido no puede ampliar su alcance alterando parámetros.

## 2. P1 — Filtrar y ordenar Torreón antes de paginar

**Cuándo ocurre:** buscar texto, locomotora, prioridad o fechas, o cambiar el orden, en `/movimientos/buscar` para una localidad de Torreón con más de una página de resultados.

**Evidencia:** [torreonSearch.ts:202](/Users/viankodesarrollo/Desktop/Sistemas/eco/BackCosaif2/src/application/movements/torreonSearch.ts:202) solicita primero una página al microservicio, con un mínimo de 25 registros aunque se pidan menos. Los filtros se aplican después a esa página, en [torreonSearch.ts:217](/Users/viankodesarrollo/Desktop/Sistemas/eco/BackCosaif2/src/application/movements/torreonSearch.ts:217), y el orden también es local a la página, en [torreonSearch.ts:229](/Users/viankodesarrollo/Desktop/Sistemas/eco/BackCosaif2/src/application/movements/torreonSearch.ts:229). [torreonSearch.ts:247](/Users/viankodesarrollo/Desktop/Sistemas/eco/BackCosaif2/src/application/movements/torreonSearch.ts:247) presenta `data.length` como total, mientras calcula `hasNextPage` con la página previa al filtro.

**Impacto:** una página puede aparecer vacía aunque existan coincidencias posteriores; el orden no es global y el total puede contradecir la navegación. Además, sin `localidadId`, [MovimientoController.ts:1672](/Users/viankodesarrollo/Desktop/Sistemas/eco/BackCosaif2/src/Rutas/Movimientos/MovimientoController.ts:1672) excluye Torreón del resultado principal: ese contrato no representa todos los patios juntos.

**Corrección sugerida:** extender el contrato del microservicio para recibir los filtros y el orden completos, aplicarlos antes de paginar y devolver el total filtrado real. Unificar semántica de estados, fecha y tamaño de página. Para una vista global, definir agregación con orden/paginación estables entre fuentes o declarar explícitamente las fuentes incluidas; no presentar el resultado parcial como total global.

**Aceptación:** con 200 registros y coincidencias después del registro 25, página de tamaño 20 devuelve hasta 20 coincidencias correctas; total y páginas coinciden con el conjunto completo; recorrer páginas mantiene el orden y no repite registros. La vista de todos los patios incluye ambas fuentes o informa de forma verificable cuál falta. Medir consultas y latencia con ese conjunto antes y después.

## 3. P2 — Separar lectura de limpieza y recomposición de rondas

**Cuándo ocurre:** abrir o refrescar el tablero mediante `GET /rondas`; las lecturas por localidad también realizan limpieza antes de responder.

**Evidencia:** [RondaModel.ts:1447](/Users/viankodesarrollo/Desktop/Sistemas/eco/BackCosaif2/src/models/Movimientos/Ronda/RondaModel.ts:1447) llama a limpieza global antes del listado. [RondaModel.ts:1410](/Users/viankodesarrollo/Desktop/Sistemas/eco/BackCosaif2/src/models/Movimientos/Ronda/RondaModel.ts:1410) recorre localidades y ejecuta transacciones seriales con eliminación y recomposición. El alcance del listado se filtra después, en [RondaController.ts:306](/Users/viankodesarrollo/Desktop/Sistemas/eco/BackCosaif2/src/Rutas/Movimientos/Ronda/RondaController.ts:306). Las variantes por localidad invocan limpieza en [RondaModel.ts:1471](/Users/viankodesarrollo/Desktop/Sistemas/eco/BackCosaif2/src/models/Movimientos/Ronda/RondaModel.ts:1471) y [RondaModel.ts:1494](/Users/viankodesarrollo/Desktop/Sistemas/eco/BackCosaif2/src/models/Movimientos/Ronda/RondaModel.ts:1494); la limpieza elimina grupos concluidos en [RondaModel.ts:1435](/Users/viankodesarrollo/Desktop/Sistemas/eco/BackCosaif2/src/models/Movimientos/Ronda/RondaModel.ts:1435).

**Impacto:** lectores y actualizaciones periódicas generan trabajo de escritura; el listado global depende del mantenimiento de todos los patios. Es un costo estructural observado en código, no una medición de su contribución exacta a la latencia.

**Corrección sugerida:** ejecutar la recomposición transaccional al modificar la operación, limitada al patio afectado, y usar mantenimiento idempotente para reparar inconsistencias históricas. Hacer que las rutas GET solo lean datos ya consistentes, aplicando el alcance en la consulta. Definir la conservación del historial antes de trasladar las eliminaciones; mantener los eventos de actualización después del commit.

**Aceptación:** varias lecturas GET consecutivas producen cero `INSERT`, `UPDATE` o `DELETE`, y no cambian IDs, órdenes ni historial. Una operación que cambia la cola deja un orden válido y emite su evento tras persistir. Un lector restringido consulta solo su alcance. Comparar número de consultas y latencia p50/p95 al refrescar simultáneamente varios patios, con la misma carga y datos.
