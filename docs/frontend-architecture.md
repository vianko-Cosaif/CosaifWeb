# Frontend Architecture

Esta app ya mezcla Guadalajara, Torreon, usuarios, incidentes, torno y cliente. Para que siga siendo sostenible, el codigo nuevo debe caer en piezas chicas y con una frontera clara.

## Capas

- `src/app/Components/ui`: componentes base reutilizables. Cada componente vive en su carpeta con el mismo nombre y exporta desde `index.ts`.
- `src/features`: logica reusable por dominio. Aqui van tipos, formatters, hooks, clientes de datos y componentes que no pertenecen a una sola pagina.
- `src/app`: rutas y composicion de pantallas. Una pagina debe orquestar, no cargar reglas de negocio duplicadas.

## UI Compartida

Usa `@/app/Components/ui` para superficies, botones, filtros, KPIs, badges, estados vacios, paginacion, busqueda y encabezados de modulo.

Reglas:

- No importar componentes UI por archivo profundo si ya estan exportados por `@/app/Components/ui`.
- Mantener soporte claro/oscuro con clases `dark:*`; no usar paneles negros en light mode.
- No crear otra variante de boton/filtro/KPI si ya existe una base configurable.
- Los componentes nuevos deben tener carpeta propia: `ComponentName/ComponentName.tsx` e `index.ts`.

## Dominios

### `features/rail-queue`

Contiene lo compartido por tablero de rondas de cliente, coordinador y administrador:

- Tipos de ronda, movimiento, localidad y toast.
- Hooks de polling visible, localStorage boolean, estado online, reloj relativo y toasts.
- Utilidades para `fetchJson`, formateo de fechas MX, locomotoras, ids de movimiento y unwrap de respuestas del back.
- Componentes compartidos como `TerminalQueueTable` para tablas densas de rondas.

### `features/torno-measures`

Centraliza la carga y estado del modal de mediciones de torno:

- Hook `useTornoMeasuresModal`.
- Estado de carga/error del modal.
- Parseo unico de `/movimientos/:id/edicion` para cliente, coordinador, admin y tablas de movimientos.

### `features/torreon/arrastres`

Contiene reglas visuales y de datos para arrastres:

- Tipos de arrastre, vagon e incidente.
- Normalizacion de estado.
- Contadores diarios.
- Formateo de fechas, minutos y arrays del back.

### `features/torreon/naturales`

Contiene la vista de movimientos naturales de Torreon:

- Hook de carga/filtros/paginacion.
- Componentes de encabezado, filtros, metricas, tabla, cronologia y modal de fotos.
- Utilidades para fechas, duracion, estados y resolucion operativa.

### `features/torreon/cliente`

Contiene la experiencia de cliente Torreon:

- Vistas de dashboard, movimientos, creacion e incidentes.
- Componentes de card de arrastre, headers, metricas, toolbar, estado vacio y modal de edicion de vagon.
- Tipos y utilidades para permisos, estados y calculos de arrastre.

### `features/reporteria/cliente`

Contiene piezas de reportería del cliente:

- `ReportKit` con KPIs, paneles, charts, tabla simple y estados de carga/vacio.
- `ReportRenderers` con los renderers concretos de carga, vias, turnos, usuarios, cumplimiento, incidentes y cronologia.
- El cliente de pagina queda a cargo de filtros, fetch, descarga y composicion.

### `features/movimientos/table`

Contiene helpers de tabla de movimientos naturales:

- Badges y formatters.
- Reglas de visibilidad por rol.
- Columnas y datos preparados para vistas densas.

### `features/incidentes`

Contiene piezas reutilizables para incidentes:

- Selectores de catalogo.
- Tarjetas de estadistica.

### `features/usuarios`

Centraliza gestion de usuarios:

- API client.
- Formularios, cards, modales y toasts.
- Constantes, tipos y normalizacion.

## Integracion Con Back

- Rondas naturales usan `/xapi` o `/bff` segun rol.
- Arrastres Torreon usan `/api/cliente/torreon/arrastres`, que firma y delega al microservicio Torreon.
- No construir URLs sueltas dentro de componentes grandes. Si se repite, moverlo a `features/<dominio>`.
- Las respuestas mixtas del back deben normalizarse con helpers como `unwrapArray` o `extractArray`.

## Regla Para Pantallas Grandes

Si un archivo pasa de 400-500 lineas, separar:

- Tipos a `types.ts`.
- Formatters y normalizadores a `utils.ts`.
- Hooks a `hooks.ts`.
- Subvistas repetidas a `components/`.
- Estados de tabla/filtros a un modulo de dominio.

## Verificacion

Comandos usados para validar esta reestructura:

```bash
npx eslint src/app/Components/ui src/features src/app/coordinador/torreon/TorreonArrastresPanel.tsx src/app/Components/movimientos src/app/incidentes/ui src/app/administrador/usuarios/page.tsx src/app/coordinador/usuarios/page.tsx src/app/coordinador/RailQueueBoard.tsx src/app/administrador/RailQueueBoardAdmin.tsx src/app/cliente/RailQueueBoard.tsx src/app/cliente/torreon/TorreonClientePanel.tsx
npm run build
```
