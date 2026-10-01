# Calidad y rendimiento — 17 de septiembre de 2026

## Cambios

- `LoginScreen` renderiza su contenido estático en servidor. El formulario conserva su interacción y la animación sigue usando CSS.
- `TrainingBoundary` descarga la capacitación al entrar en la operación. Mantiene el proveedor entre secciones operativas y lo desmonta al volver al login.
- `incidentData.ts` separa contratos, normalización de filas, caché y carga de detalles del controlador. Valida respuestas con Zod sin eliminar los campos adicionales que necesitan los modales.
- Los detalles de incidentes usan hasta cuatro consultas simultáneas: cada trabajador libre inicia la siguiente petición sin esperar a las demás. Los detalles opcionales fallidos no ocultan la lista.
- La caché de detalles tiene un máximo de 150 entradas y 30 segundos de vigencia. Distingue cuenta, fuente, localidad y tipo de incidente de Torreón. Descarta respuestas de una cuenta que ya cambió y respeta cancelaciones. Los filtros no modifican respuestas compartidas.
- Las pruebas utilizan perfiles distintos, tomados de la política v3 del backend revisada, con permisos y alcance por rol. Las muestras están guardadas para que cambios accidentales en producción no cambien también la expectativa de la prueba.
- La API sintética tiene contratos explícitos y rechaza rutas desconocidas y escrituras. Sus movimientos contienen dos empresas y dos localidades; filtra por los parámetros recibidos del BFF, sin corregir por su cuenta el alcance del usuario.
- La compilación de comprobaciones usa `.next-quality` y los puertos 3911/3912. `.next` y el servidor habitual permanecen independientes.

## Medición del login

Chromium local, compilación de producción, contexto nuevo por prueba, 1440 × 900 y 390 × 844. JavaScript medido con Resource Timing después de finalizar la carga inicial. Son bytes descomprimidos, no el tamaño de transferencia.

| Recurso               |     Antes |   Después |
| --------------------- | --------: | --------: |
| JavaScript inicial    | 616 049 B | 561 993 B |
| Peticiones JavaScript |        14 |        13 |
| Documento HTML        |  39 446 B |  60 977 B |

La reducción de JavaScript es de 54 056 B (8,8 %). El HTML crece al trasladar el contenido estático al servidor. En la medición final se transfirieron 173 461 B de JavaScript comprimido y 12 818 B de documento comprimido. No hay una medición comparable de transferencia comprimida anterior.

Se fija un límite de 570 000 B de JavaScript inicial, 14 peticiones y 65 000 B de HTML. Se comprueban también desbordamiento horizontal y problemas automáticos críticos/graves de accesibilidad en claro y oscuro. Estos límites se añaden al presupuesto global existente; no se aumentó el límite global para aprobar esta intervención.

La suma de todos los archivos JavaScript de la compilación final es 5 090 125 B; CSS, 281 752 B. Esa suma incluye pantallas y módulos diferidos: **no equivale a la descarga inicial de ninguna pantalla**. La validación y separación de módulos pueden aumentar el conjunto de archivos aunque el login descargue menos.

## Cobertura y límites

Validación final: 410 pruebas de regresión, 16 pruebas de Chromium, tipos, compilación, formato y dependencias sin uso aprobados. Lint termina sin errores y conserva cinco advertencias previas. En la última ejecución, entrar a Seguimiento desde el menú del cliente hasta ver las filas tomó 904 ms; cambiar a historial, 112 ms. Son observaciones de una ejecución local con datos sintéticos, no percentiles ni mediciones de producción.

- Login de administrador, comercial, coordinador, supervisor y cliente; rechazo de credenciales y reintento.
- Navegación del cliente a movimientos, alternancia entre activos e historial y regreso a activos.
- Activos compartidos entre empresas de la misma localidad; historial de la empresa y localidad propias.
- Rechazo de empresa/localidad manipuladas e instrucciones privadas de otras empresas fuera de la proyección compartida.
- Sesión comercial con permisos de reportes y sin acceso a movimientos; renderizado de un reporte sintético con datos.
- Cierre de sesión y bloqueo de consultas posteriores.
- Concurrencia, cancelación, cambio de cuenta, errores opcionales y límites de caché de incidentes.

Los tiempos de navegación adjuntos a `test-results/results.json` corresponden a servicios sintéticos locales. No prueban la latencia de la base de datos, los microservicios reales, la reconexión WebSocket o el comportamiento bajo carga. Tampoco sustituyen una revisión manual completa de accesibilidad.

Permanece código legado con `any` dentro del controlador de incidentes y advertencias de lint anteriores en otros módulos. La extracción acota la capa de datos; no representa una reescritura completa del módulo. `npm run dead-code` sigue siendo un informe para revisión, no una orden de borrar automáticamente archivos.

## Reproducción

```sh
nvm use
npm run check
npx playwright install chromium
npm run test:e2e
```

`npm run check` genera `.next-quality`. Para generar el artefacto que utilizará `npm start` o `npm run start:local`, ejecutar aparte `npm run build` con la configuración de ese entorno. Los cambios de esta revisión no reinician ni publican el servidor habitual.

## Reducción de código sin uso

Se revisaron las entradas de Next.js, importaciones dinámicas, componentes, utilidades y pruebas antes de retirar código.

| Medida                          |  Antes | Después |
| ------------------------------- | -----: | ------: |
| Líneas totales de código        | 99 869 |  88 047 |
| Líneas de la aplicación (`src`) | 92 104 |  80 274 |
| Archivos de código              |    653 |     560 |

Reducción neta: **11 822 líneas (11,8 %)**. Se conserva el criterio del conteo original: incluye comentarios, líneas vacías y pruebas; excluye dependencias, artefactos de compilación y el repositorio del backend.

- Retirados 93 archivos sin consumidores: reportes anteriores, componentes reemplazados, avisos antiguos, ejemplos y adaptadores sin uso.
- Eliminadas funciones sin llamadas y sus auxiliares privados. El generador de PDF de movimientos conserva la exportación utilizada; pasa de 1 011 a 351 líneas al retirar el generador histórico desconectado.
- Los iconos del tablero de cliente reutilizan Lucide, ya instalado. Se conservan los tamaños de los controles y sus etiquetas.
- `npm run dead-code:files` se ejecuta en `npm run check` y en CI para rechazar archivos huérfanos. La revisión de exportaciones sigue siendo manual: una exportación sin consumidores externos puede tener usos internos.
- Validación: 437 pruebas unitarias, 25 recorridos de Chromium, tipos, compilación, formato, archivos y dependencias sin uso y presupuestos de recursos. Lint mantiene cinco advertencias previas y no presenta errores.
- La prueba de notificaciones ahora verifica que los controles responden antes de inyectar eventos, evitando confundir HTML visible con una interfaz hidratada. También pasó seis repeticiones consecutivas.

La compilación de esta limpieza contiene 4 876 795 B de JavaScript cliente y 286 280 B de CSS. Son sumas de todos los módulos, no la descarga inicial ni una medición de latencia de los servicios reales. La comprobación de navegador usa datos sintéticos locales.

## Consolidación del código activo

La siguiente intervención elimina implementaciones duplicadas que sí tenían consumidores. Se mantiene el formato legible de Prettier y se añaden pruebas de regresión; las cifras son netas, contando también esos archivos nuevos.

| Medida                          |       Antes |     Después |
| ------------------------------- | ----------: | ----------: |
| Líneas totales de código        |      88 047 |      87 652 |
| Líneas de la aplicación (`src`) |      80 274 |      79 595 |
| Archivos de código              |         560 |         574 |
| JavaScript cliente compilado    | 4 876 795 B | 4 846 757 B |
| CSS compilado                   |   286 280 B |   288 370 B |

Son 679 líneas menos en la aplicación y 395 menos en el total, después de incorporar pruebas y reglas de arquitectura. El número de archivos aumenta al separar responsabilidades del servidor. Frente al primer conteo de 99 869, la reducción acumulada es de 12 217 líneas (12,2 %).

- Administrador y coordinador comparten `LocalityQueue`: tarjetas, campos, fechas, estados y estilos adaptables. Cada rol conserva su controlador y alcance.
- Cuatro pantallas comparten `TornoMeasuresDialog` y la carga diferida del visor. Las peticiones se cancelan al cerrar o cambiar de locomotora; una respuesta antigua no reemplaza la selección vigente.
- Las dos URLs de rondas exportan una única implementación de servidor, separada en consultas, acciones, adaptadores, normalización y transporte. La URL compatible conserva la acción de orden, con validación de permisos, empresa y localidad.
- Cuatro layouts vuelven a ser Server Components. ESLint refuerza la dirección de las importaciones y los módulos de servidor declaran `server-only`.
- El modal común funciona dentro de pantalla completa sin bloquear sus propios controles. La cola lateral permite desplazamiento por teclado.

Los 30 038 B menos de JavaScript son del conjunto de módulos cliente, no una reducción equivalente de la carga inicial o una medición del tiempo de respuesta de los servicios. El login permanece dentro de su presupuesto. La estructura y las reglas están documentadas en `docs/frontend-architecture.md`.

Validación final de esta consolidación: 460 pruebas unitarias en 62 archivos y 33 recorridos de Chromium aprobados, junto con tipos, compilación, formato, dependencias/archivos sin uso y presupuestos de recursos. Los ocho recorridos nuevos verifican administrador y coordinador a 390/1440 px, temas claro/oscuro, aislamiento de localidades, pantalla completa, desbordamientos y problemas automáticos graves/críticos de accesibilidad en las tarjetas. Lint conserva cinco advertencias anteriores y cero errores. Los servicios del navegador son sintéticos; no se ha medido rendimiento real del backend bajo carga.
