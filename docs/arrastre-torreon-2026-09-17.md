# Arrastre de Torreón: experiencia y consultas

## Comportamiento

- Tablero con lectura rápida de la cola visible: operación en curso, siguiente solicitud y solicitudes que requieren atención. Los contadores generales se calculan en el servidor.
- Consulta de una página y un periodo a la vez: 8 solicitudes en cliente y tablero; tamaño configurable en seguimiento de coordinación. La búsqueda espera 300 ms para agrupar pulsaciones y llega al servidor, incluyendo registros posteriores a los primeros 100.
- Filtros por folio, vagón, vía, estado, estado de vagón y fechas según la pantalla. El servicio valida tamaños, rangos y estados compatibles con activos/historial. Cambiar un filtro vuelve a la primera página.
- Activos compartidos en la localidad y movimientos pasados limitados a empresa y localidad para los roles de empresa. El BFF deriva el alcance de la sesión verificada; no acepta una empresa arbitraria para priorizar.
- Identificador visible estable `#id` y turno asignado por el servidor. El número mostrado ya no depende de las filas descargadas.
- La actualización conserva la consulta visible y su paginación. Una respuesta tardía de otra consulta no reemplaza las filas ni los totales actuales. Un fallo permite reintentar y conserva la última consulta válida del mismo alcance.
- Mejor contraste en las tarjetas y detalles de Arrastre en claro/oscuro. Tabla en escritorio y tarjetas en móvil; se comprueba también la expansión de vagones.

## Backend

El contrato paginado es optativo (`pagination=1`). Devuelve `{ data, meta }`, con total, páginas, conteos por estado, vagones pendientes, incidentes abiertos y posibilidad de priorizar. Conserva el contrato anterior para otros consumidores. Datos y conteos se leen en una transacción `RepeatableRead` con el mismo filtro.

La lista no descarga fotos ni duplica la relación de vagón dentro de cada incidente. El detalle continúa disponible por separado. La vista independiente de incidentes solicita sólo arrastres con incidentes, recorriendo sus páginas; sigue necesitando paginación específica de incidentes para históricos de gran volumen.

Subir/bajar se envía como solicitud + dirección. El servicio encuentra el vecino de la empresa en la cola completa y actualiza dos turnos; conserva los espacios de otras empresas. Las solicitudes cerradas quedan fuera del reordenamiento. Priorizar verifica el incidente abierto y los vagones pendientes en la transacción del servidor. Una colisión de transacciones devuelve 409 para actualizar y reintentar.

El recálculo de bloqueos agrupa cambios en lotes de hasta 500 IDs y exige el estado previo esperado. En la prueba con 501 vagones por bloquear y uno por liberar se realizan 3 `updateMany`, frente a 502 actualizaciones individuales. No se cambian vagones en proceso.

No se agregaron migraciones ni índices sin una medición de la base de datos real. El ordenamiento y los filtros aprovechan los índices existentes; queda por confirmar el plan y la latencia con `EXPLAIN ANALYZE` en un entorno de pruebas con volumen representativo.

## Carga y arquitectura

- `arrastre.query.ts` concentra validación y construcción de filtros en el microservicio.
- `arrastres/listQuery.ts` concentra el contrato del cliente, parámetros y errores de fechas.
- `useTorreonCollection` transporta filas y paginación juntas, conservando compatibilidad con listas simples.
- `dateBoundary.ts` permite reutilizar fechas sin cargar reglas de roles.
- `notificationAudio.ts` limita la importación diferida de Tone a los cinco elementos utilizados; se mantienen melodías y reproducción existentes.

JavaScript total compilado: **4 977 093 B**; CSS: **281 752 B**. El presupuesto global de 5 100 000 B de JavaScript se conserva. La suma incluye todos los módulos diferidos, no equivale a la descarga inicial de una pantalla. Frente a los 5 090 125 B documentados antes de esta intervención, el conjunto se reduce 113 032 B pese a incorporar la funcionalidad.

## Verificación y puesta en servicio

425 pruebas unitarias del frontend y 20 pruebas de Chromium aprobadas. Regresiones del backend, TypeScript del microservicio, compilación de producción aislada, lint, dependencias, formato y presupuesto de recursos. Chromium utiliza un perfil de Arrastre y 154 solicitudes sintéticas de dos empresas; prueba paginación, búsqueda del registro 150, historial privado y cuatro combinaciones de tema y tamaño.

Estos resultados no miden tiempos de PostgreSQL ni de los servicios reales. La suite de navegador sólo consulta datos sintéticos y no crea ni modifica operaciones reales. Se conserva el trabajo previo ajeno a esta intervención.

Para activar el cambio, publicar o reiniciar **primero el microservicio de Torreón actualizado y después el frontend**. La web nueva exige el contrato paginado y muestra un error explícito si el servicio aún devuelve el contrato antiguo; no oculta esa incompatibilidad mostrando una lista truncada. La compilación de calidad usa `.next-quality` y puertos 3911/3912, separados del servidor habitual.

Comprobaciones reproducibles desde cada repositorio:

```sh
# CosaifWeb1, Node 24
npm run check
npm run test:e2e

# BackCosaif2
npm test
npx tsc --noEmit -p ms_torreon/tsconfig.json
```

La consulta de movimientos naturales de Torreón y sus filtros propios no se migraron en esta entrega; son una intervención separada del contrato de arrastres.
