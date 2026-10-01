# Coherencia de UX/UI

Actualización aplicada el 9 de septiembre de 2026.

## Criterios compartidos

- Títulos de módulo de 20–24 px, descripción legible y texto que envuelve en espacios pequeños.
- Controles principales de 44 px; secundarios de 36 px. Espaciado interior de paneles de 16 px en móvil y 20 px en escritorio.
- Superficies, texto, bordes, foco y acento provienen de `--app-*`. `--app-accent-contrast` mantiene texto legible sobre el botón principal en ambos temas.
- Carga, error y ausencia de resultados son estados distintos. Un total desconocido durante la carga no se presenta como cero.
- Los estados conservan nombres operativos: Solicitado, En proceso, Detenido y Concluido. Un incidente Abierto indica atención; Cerrado no se representa como error.
- Filtros bloqueados explican el alcance de la cuenta y no inflan el número de filtros que el usuario puede limpiar.
- El selector de período es un grupo de botones con selección anunciada. Campos y acciones tienen etiquetas y foco visible.

## Correcciones por área

| Área | Incongruencia corregida |
|---|---|
| Navegación | Se reserva el espacio del menú antes de hidratar para evitar el salto horizontal de la página. Se retiraron versiones contradictorias entre menú y pie. El icono del tema representa el modo que indica su etiqueta. |
| Composición general | El banner se conserva en los inicios de cada área y deja de desplazar los formularios/listados secundarios. |
| Crear movimiento | Las reglas móviles de sus selectores quedan limitadas al formulario, sin cambiar selectores ajenos. |
| Movimientos e incidentes | Cabeceras, filtros móviles, paginación y estados de carga consistentes; sin badges vacíos ni tablas vacías durante la carga inicial. |
| Torno | Sin compensaciones de margen que desbordaban el contenedor. Tabla con desplazamiento identificable y vacío visible fuera del ancho mínimo. Controles, progreso y mapas se adaptan al tema. |
| Torreón | Cabeceras, filtros, métricas y estados vacíos usan superficies temáticas. Se elimina el indicador de pestaña cuya posición no coincidía con su ancho. |
| Reportería | Tokens aislados en un módulo CSS, sin cambiar `body` ni variables raíz. Se unifican cabeceras, gráficos, tablas y filtros. La selección se distingue también en oscuro. |
| Comercial | Botones legibles sobre la cabecera clara, cuadrícula válida en filtros y sin padding lateral duplicado. |

## Verificación

Se ejecutaron ESLint, TypeScript, 348 pruebas existentes y compilación de producción. No se añadieron pruebas que reproduzcan únicamente clases cosméticas.

Se revisaron los componentes reales renderizados con datos de ejemplo en navegador, en escritorio y contenedores móviles de 390 px, en claro y oscuro. La revisión visual aislada no sustituye recorrer todos los módulos con sesiones reales de cada rol; la sesión operativa anterior había vencido. Los filtros y permisos mantienen sus pruebas de regresión.

Las limitaciones del contrato del backend registradas en `pendientes-de-consultas-backend.md` continúan siendo independientes de esta corrección visual.

## Adaptación y carga posterior

La siguiente pasada amplía la revisión a tarjetas móviles, carga condicional y navegación: [adaptación y carga de interfaz](adaptacion-y-carga-ui.md). Conserva sus propias mediciones y pruebas para distinguirlas de esta primera corrección visual.
