# Experiencia y rendimiento por rol

Revisión del 9 de septiembre de 2026 sobre el árbol local de la web. Los cambios están aplicados en el frontend; no se desplegaron ni se modificó BackCosaif2.

## Comportamiento aplicado

| Área | Cambio |
|---|---|
| Cliente | Activos muestra las rondas operativas de todas las empresas de su localidad. Historial mantiene empresa y localidad propias. Las filas de otras empresas no permiten edición. Se muestra el número real de ronda y el orden dentro de ella. |
| Movimientos de todos los roles | Filtros normalizados por alcance firmado; cambio de período y vistas guardadas atómico; paginación reiniciada al cambiar la consulta; errores de fechas visibles; resultados anteriores no aparecen bajo filtros nuevos. |
| Coordinación y supervisión | Refrescos agrupados, respuestas antiguas descartadas y pausa en segundo plano. Coordinación carga la tabla de escritorio al acercarse a ella y el sonido cuando se activa. Supervisión reutiliza el tablero compartido. |
| Incidentes | La lista aparece antes de completar los detalles complementarios. Solo se solicitan los detalles que faltan, con concurrencia limitada. Un refresco no regresa a la página anterior; un error conserva la lista de la misma consulta. |
| Torno | Detalle, incidentes y navajas se cargan cuando se abren. La consulta inicial espera el alcance verificado y la vista restaurada. Búsqueda con espera de 250 ms y cancelación de respuestas anteriores. Cerrar el detalle impide que una respuesta tardía lo reabra. |
| Torreón y Arrastre | Carga compartida con cancelación, agrupación y caché breve; eventos recientes prevalecen sobre respuestas antiguas. Detenido permanece operativo en Naturales. El historial del cliente conserva el alcance privado. |
| Reportería de administración y coordinación | Reportes especializados cargan al seleccionarlos; catálogos reutilizados y respuestas asociadas a su consulta. Coordinación elimina una solicitud fallida previa y aplica la localidad verificada desde el inicio. |
| Comercial | Listas y métricas corresponden al período y filtros seleccionados; no se mezclan respuestas anteriores. Filtros iguales no repiten la carga, cambios reinician página y exportación espera datos de la consulta vigente. |
| Menú compartido | Se conservan navegación y avisos de carga. Al cambiar de tema, fondo y texto cambian juntos; solo se animan el ancho y desplazamiento del menú para evitar un destello de bajo contraste. |

Las cachés son breves y se separan por sesión/consulta. Una actualización manual o un evento operativo real fuerza lectura; los eventos de conexión pueden reutilizar resultados recientes. Desactivar Auto o esconder la pestaña cancela los refrescos pendientes en los listados ajustados.

## Medición

Los tamaños antes/después están en [rendimiento-por-rol-mediciones.json](rendimiento-por-rol-mediciones.json). Se suman archivos JavaScript únicos de `clientModules[entrada].chunks` en los manifiestos `client-reference-manifest.js` de dos compilaciones de producción. Se incluye gzip sintético por archivo. Los chunks compartidos cuentan dentro de cada entrada: **no sumar filas ni interpretar estos números como todo el JavaScript de una página o como reducción de latencia**. Los módulos diferidos pueden descargarse posteriormente.

El ahorro principal está en Torno: su entrada pasó de aproximadamente 194 kB a 88 kB, un 55% menos sin comprimir. Incidentes pasó de 218 kB a 185 kB, un 15% menos. En otros módulos el objetivo principal fue reducir consultas repetidas y evitar resultados incoherentes; algunos tamaños crecieron al añadir ese control.

En desarrollo se observó una petición de `/cliente/incidentes` de 4,234.5 ms, con 3,928.7 ms dentro de `ensure-page` (9 de septiembre, 16:59:24 UTC). Esto evidencia preparación de la página durante navegación. `onDemandEntries` ahora conserva hasta diez páginas visitadas y aumenta a diez minutos el período de inactividad, a cambio de más memoria local. No elimina la primera compilación ni afecta al servidor de producción.

Muestras anteriores de la misma sesión local registraron rondas de 22–31 ms y listado de incidentes de 26–55 ms. Son observaciones puntuales del servidor web, no percentiles ni tiempos completos hasta que la interfaz resulta utilizable. No se atribuye toda la lentitud al backend ni se promete que estas cifras se repitan con otra carga.

## Verificación y límites

- `npm run check`: ESLint sin errores (siete advertencias), TypeScript correcto, **348 pruebas en 44 archivos**, compilación de producción correcta. Tras el ajuste visual del menú se repitieron su lint y la compilación.
- Navegador con sesión CLIENTE: cambio entre Activos e Historial, alcance de empresa/localidad, rondas de varias empresas, restricción de edición, navegación a Incidentes y Torno, y revisión de contraste en tema oscuro.
- La comprobación temporal con servidor de producción pudo abrir la ruta, pero el backend devolvió `401` al consultar Torno y la sesión vencida redirigió al login. Por ello no se presenta una comparación de latencia autenticada en producción. Las comprobaciones de los demás roles se apoyan en código y pruebas, no en sesiones reales de cada cuenta.
- No se realizaron altas, ediciones ni operaciones ferroviarias para medir rendimiento.

Persisten defectos del contrato de consultas en el backend: estado de incidentes ignorado al combinar alcance, filtros y totales de Torreón calculados después de paginar, y mantenimiento de rondas durante lecturas. Están descritos con evidencia y criterios de aceptación en [pendientes-de-consultas-backend.md](pendientes-de-consultas-backend.md). La web no puede presentar esas colecciones parciales como un resultado global completo.

También permanece trabajo posible en el detalle de Torno (consultas secuenciales), en los hooks antiguos de sus pestañas secundarias y en Comercial (catálogos ligados a la respuesta de analítica). No se declara que todas las consultas estén optimizadas ni que estos cambios sustituyan pruebas de carga del servicio.
