# Adaptación y carga de interfaz

Revisión del 9 de septiembre de 2026. Cambios aplicados al frontend local.

## Comportamiento

- Movimientos e Incidentes montan una sola representación: tarjetas en móvil/tablet y tabla desde 1152 px. AntD y su observador de tema se cargan sólo al necesitar la tabla de Movimientos. Los detalles cerrados no se montan.
- Las tarjetas de Movimientos distribuyen el contenido según el espacio, permiten envolver empresa/localidad y mejoran el contraste de etiquetas. El folio de escritorio abre el detalle mediante un botón accesible; conserva la expansión al cambiar de ancho.
- Filtros móviles contraídos inicialmente cuando no hay criterios manuales; el alcance bloqueado no cuenta como filtro limpiable. Las decisiones de apertura del usuario y la capacitación se respetan. Las vistas guardadas mantienen su restauración aun con sus controles cerrados. Indicadores en dos columnas en móvil.
- Torno muestra tarjetas bajo 1280 px, conservando fechas, progreso, paginación, detalle y permisos para ver duraciones. El mapa de ruedas y los incidentes del detalle se cargan al abrirlos.
- Contratos transforma la misma tabla en tarjetas según el ancho de su contenedor. Clientes mantiene el buscador durante la actualización y no vuelve a filtrar una página ya filtrada por el servidor. Paquetes adapta sus grupos, cantidades y descargas al contenedor. Formularios comerciales cargados al abrirlos.
- La ayuda del menú es un diálogo adaptado al viewport, con búsqueda por rol, navegación con teclado y cierre accesible. Su catálogo se carga al abrir la ayuda. El menú móvil oculto no admite foco; el abierto contiene el foco y lo restaura al cerrar. Los avisos del inicio se cargan únicamente en las rutas que los muestran.
- El login explica el regreso con `sesion=expirada`. Se conservan el envío POST, el bloqueo hasta hidratación y la protección frente a solicitudes duplicadas.
- Se corrigió la hidratación del dashboard: Node 24 expone `navigator` sin `onLine`; el hook de conexión ahora utiliza el mismo estado inicial en servidor y navegador, sincroniza después de montar y conserva sus eventos. La regresión reproduce el error anterior con `renderToString`/`hydrateRoot` y verifica que el nodo existente se conserva sin errores recuperables.
- El tablero del cliente evita truncar el estado operativo en pantallas pequeñas, mejora las etiquetas del tema oscuro y mantiene controles táctiles de 44 px.

## Medición y límites

`adaptacion-y-carga-ui-mediciones.json` conserva las dos mediciones de producción. Método: suma de archivos JavaScript únicos de `clientModules[entrada].chunks` en manifiestos de Next, con gzip sintético por archivo. Cada entrada incluye sus archivos compartidos; las filas se solapan. No representan todo el JavaScript de la página ni una reducción de latencia del backend. Los módulos diferidos se descargan cuando hacen falta.

La mejora de montaje en móvil se comprueba además con pruebas: no se carga la tabla de escritorio ni se conservan simultáneamente sus filas y las tarjetas. No se atribuye a esa separación un ahorro porcentual de transferencia no medido. Algunos módulos aumentan ligeramente por la interfaz adaptativa adicional.


| Entrada | Antes | Después | Cambio |
|---|---:|---:|---:|
| components/layout/AdaptiveAppShell.tsx | 140863 B | 104599 B | -25.7 % |
| features/comercial/pages/contratos.tsx | 72440 B | 60965 B | -15.8 % |
| features/movimientos/list/MovimientosPanel.tsx | 160315 B | 162331 B | 1.3 % |
| features/torno/components/TornoModule.tsx | 119285 B | 123451 B | 3.5 % |

## Validación

`npm run check` completado: ESLint sin errores (cinco advertencias existentes), TypeScript correcto, **377 pruebas en 51 archivos** y compilación de producción aprobada. Las regresiones nuevas cubren permisos y acciones, cambios de ancho, carga condicional, restauración de consultas, foco del menú, login expirado e hidratación del dashboard.

Navegador con sesión CLIENTE: navegación entre Operación, Seguimiento y Torno, apertura de ayuda y detalle; Activos mostró tres rondas de Alstom/Vianko de Guadalajara, con edición limitada a Alstom. Historial mostró el alcance de Alstom/Guadalajara. Se comprobó tabla única en escritorio y ausencia de tabla en móvil, además de ambos temas. Las comprobaciones de geometría usaron anchos de documento de 320, 487 y 1440 px, sin desbordamiento horizontal del documento en Movimientos. Las tablas anchas conservan su desplazamiento interno.

El navegador conserva el zoom del usuario; durante algunas capturas el emulador del panel escaló la imagen. Los anchos anteriores se obtuvieron de la geometría DOM, no de la resolución de esas capturas. La sesión venció al terminar la revisión; no se hicieron altas ni cambios en datos operativos. Los otros roles se verifican mediante código y pruebas, no mediante cuentas reales de todos los roles.

Persisten las limitaciones del contrato backend descritas en [pendientes-de-consultas-backend.md](pendientes-de-consultas-backend.md). Esta pasada no modifica esos endpoints ni altera el alcance de autorización.
