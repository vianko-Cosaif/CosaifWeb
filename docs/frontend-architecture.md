# Arquitectura del frontend

## Dirección de dependencias

`app` compone módulos de `features`; los módulos usan `components`, `hooks` y `lib`. Los componentes UI no importan rutas ni reglas de negocio. `lib/server` sólo se usa en servidor y declara `server-only`. Los contratos entre módulos se importan con `import type` cuando corresponde.

```text
src/
  app/                    rutas, layouts y handlers Next.js
  features/
    movimientos/
      crear/              captura, validación, catálogos y envío
      editar/             editor compartido por los roles autorizados
      list/               tabla, filtros, vistas guardadas y atención del turno
      offline/            IndexedDB, estados y sincronización
      table/              reglas comunes de las tablas
      torno/              mediciones asociadas al movimiento
    panel-grafico/
      PanelGrafico.tsx     composición y coordinación de actualizaciones
      data.ts             normalización de respuestas y eventos
      types.ts            contratos del módulo
      styles.ts           colores y transiciones
      patio/              modelo, geometría, canvas y dibujo
      components/         vistas del tablero
    comercial/            expedientes, contratos, cobranza y análisis
    reporteria/           vistas y contratos por tipo de reporte
    torno/                servicios, historial y herramientas
    torno-measures/       selector y captura de ruedas
    torreon/              naturales y arrastres
    rail-queue/           rondas compartidas por rol
    incidentes/           gestión, evidencia y avisos
    capacitacion/         guías y datos SIM
    usuarios/             administración de usuarios
    actualizaciones/      avisos y banners
  components/             UI y layout compartidos
  hooks/                  hooks independientes de un módulo
  lib/
    auth/                 contexto local, retorno autorizado y utilidades
    http/                 consultas cliente, errores y concurrencia
    observability/        contratos y envío de métricas sin datos privados
    server/               verificación de sesión y proxy
  proxy.ts                protección de rutas de Next.js 16
```

## Consultas

Usar `cachedFetchJson` para lecturas repetidas. Sólo comparte GET y mantiene hasta 150 respuestas; la clave incluye cuenta/empresa/localidad, URL normalizada, credenciales y cabeceras. El último consumidor que abandona cancela la petición. Las mutaciones mantienen su cuerpo y petición propios. Invalidar explícitamente los recursos afectados después de guardar. Nunca usar la caché cliente como decisión de autorización.

Los datos cambiantes tienen TTL corto. Los catálogos pueden tener TTL mayor. `force` evita reutilizar respuestas almacenadas; peticiones idénticas ya activas se comparten. Un error no se almacena. Al cambiar filtros o desmontar una pantalla, cancelar consultas y descartar resultados antiguos.

Comercial distingue `useCrmList` (una página de 25 registros) de `useCrmCatalog` (lista completa para selectores y conciliación, hasta tres páginas simultáneas). Los totales contractuales requieren `loadCompleteAnalytics`: el backend limita cada página de operaciones a 100. Si faltan datos o cambia el total durante la carga, se presenta error en lugar de devolver una suma parcial. Las consultas excesivas requieren reducir filtros.

Los proxies comparten cabeceras, timeout, cancelación y errores en `lib/server/upstream.ts`. Conservar las reglas de alcance propias de cada adaptador. No reenviar cookies ni `Content-Length` de una respuesta que `fetch` pudo descomprimir. SSE usa cancelación del cliente, sin el timeout de una consulta ordinaria.

## Persistencia y permisos

La cola usa transacciones de IndexedDB y un propietario explícito. Sólo se elimina la solicitud confirmada. Un envío reclamado por otra pestaña no puede enviarse a la vez; una reclamación vencida pasa a revisión. Un resultado incierto requiere conciliación y confirmación antes de reintentar con la misma clave. El backend es la autoridad final de idempotencia y permisos.

Borradores, vistas y caché están separados por cuenta y alcance. La sesión firmada se comprueba en servidor; los datos locales sólo controlan presentación. La interfaz de edición requiere permiso específico y las rutas de los roles comparten la página de autorización.

## UI y calidad

Usar `@/components/ui` para botones, modales, filtros, tablas y estados. El modal común administra foco, Escape, Tab, bloqueo del fondo y restauración incluso al cerrar modales anidados. No representar ausencia de mediciones como cero o como cumplimiento de un SLA.

Separar modelos puros, transporte y presentación cuando un componente acumule responsabilidades. No dividir sólo por tamaño ni crear otra carpeta genérica `utils` cuando existe un dominio claro. Las rutas nuevas deben mantenerse pequeñas.

`npm run check` es el control local y `.github/workflows/quality.yml` repite instalación reproducible, lint, tipos, pruebas, build y auditoría de dependencias. Las reglas de React Compiler se mantienen desactivadas mientras no se habilita ese compilador; las reglas de hooks y tipos siguen activas.
