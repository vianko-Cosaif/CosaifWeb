# COSAIF: revisión general y propuesta de actualización

Fecha: 8 de septiembre de 2026.

La recomendación es modernizar por etapas sobre la base existente. COSAIF ya reúne operación por roles, rondas y movimientos, incidentes, torno, arrastres y movimientos naturales de Torreón, administración y gestión comercial. La actualización debe mejorar la confiabilidad de los registros, facilitar las decisiones del turno y reducir el costo de mantener el sistema.

## Alcance y resultados de la revisión

Se revisaron la estructura del repositorio, configuración, autenticación y autorización, componentes compartidos, código representativo de los módulos principales, sincronización, persistencia offline, reportería y gestión comercial. Se observó la pantalla de acceso en navegador y con ancho móvil. No se completó un recorrido autenticado por cada rol ni se auditó el backend, la base de datos o la infraestructura productiva. Las propuestas visuales de los módulos internos se basan en su código y composición; deben validarse con usuarios reales.

| Comprobación | Resultado |
|---|---|
| TypeScript: `tsc --noEmit --incremental false` | Correcto, sin errores. |
| Compilación: `npm run build` | Correcta al permitir la descarga de la fuente Ubuntu. El primer intento falló por la restricción de red del entorno. |
| ESLint | 152 errores por `no-explicit-any` y 42 advertencias en `src`. No equivalen a 152 fallos de funcionamiento. |
| Comprobaciones offline aisladas | Reproducidos envío duplicado y pérdida de una solicitud pendiente durante sincronización. Se usaron almacenamiento, hooks y transporte simulados; no se enviaron movimientos al backend. |
| Pruebas automatizadas y CI | No se encontró una suite de aplicación ni flujos de GitHub Actions versionados. Hay un artefacto previo de verificación de Excel; no sustituye pruebas de los flujos operativos. |
| Tamaño del código | 42 archivos de `src` superan 500 líneas; 14 superan 1,000. El panel gráfico tiene 3,122 líneas. |

El proyecto ya tiene una base aprovechable: TypeScript estricto, permisos centralizados, cookies de autenticación HttpOnly, validación de sesión firmada, protección frente a solicitudes desde otros sitios, componentes de interfaz compartidos, modo claro/oscuro, actualización en tiempo real, PWA, borradores, guías y registros SIM de capacitación.

## Qué mejoraría primero

| Prioridad | Mejora | Beneficio | Esfuerzo relativo |
|---|---|---|---|
| Urgente | Corregir la cola offline y aislarla por usuario | Evitar pérdida, repetición o mezcla de solicitudes | Medio; coordinación con backend para idempotencia |
| Urgente | Aplicar parches y fijar una versión LTS de Node | Mantener dependencias soportadas y reproducibles | Bajo–medio |
| Alta | Corregir permisos visibles, rutas de edición y acceso con notificaciones bloqueadas | Reducir botones sin destino y bloqueos al entrar | Medio |
| Alta | Establecer pruebas de flujos críticos y controles antes de publicar | Actualizar con menor riesgo de regresiones | Medio |
| Alta | Tablero de turno con pendientes que requieren acción | Identificar bloqueos, atrasos y responsables rápidamente | Medio |
| Media | Unificar tablas, filtros, formularios y modales | Dar consistencia y reducir pasos | Medio |
| Media | Paginar CRM y centralizar medición de fallos y rendimiento | Mantener respuesta al crecer los datos | Medio |
| Media | Simplificar módulos grandes y clientes de API | Reducir duplicación y facilitar cambios posteriores | Alto, por entregas pequeñas |

Los esfuerzos son comparativos, no una cotización ni fechas comprometidas. La duración depende del equipo, contratos del backend y validación de cada rol.

## Hallazgos concretos y solución propuesta

### 1. La sincronización offline puede perder o repetir solicitudes

`flushOutbox` lee una copia de la cola y, al terminar sus peticiones, reemplaza el contenido completo con los fallos de esa copia. Si se agrega una solicitud nueva durante la espera de red, el reemplazo la elimina. Además, no hay exclusión de sincronizaciones concurrentes: dos ejecuciones leen y envían el mismo pendiente.

En las comprobaciones aisladas, agregar B mientras se confirmaba A dejó cero pendientes cuando debía quedar uno. Ejecutar dos sincronizaciones sobre A produjo dos peticiones cuando debía producir una.

Los borradores y la cola también usan claves globales del navegador, sin identidad de usuario, empresa o localidad. El cierre de sesión revisado elimina datos del perfil, pero no esas claves. Esto permite que persistan entre usuarios de un equipo compartido; el efecto final de un envío depende de la validación del backend.

**Propuesta:** cola transaccional en IndexedDB, propietario explícito por solicitud, exclusión entre sincronizaciones y pestañas, eliminación sólo de los registros confirmados, y clave de idempotencia estable validada por el backend. Diferenciar errores temporales, sesión vencida y errores de datos. Mostrar una bandeja con estado, fecha, motivo de fallo y opciones de reintento o descarte confirmado. Conservar pendientes asociados a su propietario al cerrar sesión, sin enviarlos desde otra cuenta.

**Aceptación:** una interrupción de red no pierde pendientes; dos pestañas no generan dos movimientos; cambiar de usuario no muestra ni envía solicitudes ajenas; un rechazo de validación queda visible para corrección.

Evidencia: [cola offline](/Users/viankodesarrollo/Desktop/Sistemas/eco/CosaifWeb1/src/app/movimientos/crear/useCrearMovimientoOutbox.ts:102), [claves de almacenamiento](/Users/viankodesarrollo/Desktop/Sistemas/eco/CosaifWeb1/src/app/movimientos/movimientos.shared.ts:147), [cierre de sesión](/Users/viankodesarrollo/Desktop/Sistemas/eco/CosaifWeb1/src/lib/sessionLogout.ts:1).

### 2. Actualizar la base técnica en dos pasos

El lockfile y la instalación usan Next.js **15.5.18**, React **19.1.2** y `eslint-config-next` **15.5.7**. El entorno local ejecuta Node **20.19.4**; esto no confirma la versión productiva.

**Propuesta inmediata:** aplicar al menos Next.js 15.5.24, parche publicado el 25 de agosto de 2026, o un parche posterior verificado al implementar; alinear su configuración de ESLint y revisar las dependencias transitivas. El aviso incluye problemas con condiciones específicas de explotación: esta revisión no demuestra que producción sea explotable. [Aviso oficial de Next.js](https://nextjs.org/blog/august-2026-security-release).

Fijar Node 24 LTS para desarrollo, CI y despliegue, comprobando antes la plataforma. Node 20 ya está fuera de soporte; Node 24 figura como LTS. Añadir `engines` y un archivo de versión. [Versiones oficiales de Node.js](https://nodejs.org/en/about/previous-releases).

**Segundo paso:** migrar a Next.js 16 tras cubrir autenticación, proxies y flujos críticos con pruebas. Next.js 15 está en mantenimiento y 16 en soporte activo. La migración debe considerar middleware, configuración, compilador y dependencias de React. [Política de soporte](https://nextjs.org/support-policy), [guía de migración](https://nextjs.org/docs/app/guides/upgrading/version-16).

### 3. Alinear acceso, permisos y rutas con lo que el usuario puede hacer

Por defecto, con notificaciones habilitadas en producción, aceptar push es requisito del login. El permiso se solicita antes de validar credenciales. Un navegador incompatible o con permisos bloqueados puede impedir entrar aunque la cuenta sea válida.

**Propuesta:** separar autenticación y activación de notificaciones; mantener alertas dentro de la aplicación y una indicación clara del estado push. Si existe una obligación operativa de recibir alertas, definir el mecanismo alternativo y validarlo con operación. También aprovechar el parámetro `next` del acceso para regresar al destino autorizado que se intentaba abrir.

En movimientos, la edición se muestra según el estado del registro y se construyen destinos como `/administrador/editar`, `/coordinador/editar` y `/supervisor/editar`; sólo se encontró la página `/cliente/editar`. **Propuesta:** resolver un destino de edición existente y aplicar permiso específico además del estado, compartiendo el editor si corresponde.

El filtro de autorización del proxy permite continuar cuando no reconoce una ruta y agrupa algunos permisos de mutación. Esto está documentado como defensa previa a la decisión del backend; no se demostró un acceso indebido. **Propuesta:** inventariar métodos y rutas, definir permiso por acción y probar límites por empresa/localidad, incluyendo comercial. Confirmar siempre el rechazo en backend.

Evidencia: [política push](/Users/viankodesarrollo/Desktop/Sistemas/eco/CosaifWeb1/src/lib/notificationRuntime.ts:36), [orden del login](/Users/viankodesarrollo/Desktop/Sistemas/eco/CosaifWeb1/src/app/login/LoginForm.tsx:122), [destinos de edición](/Users/viankodesarrollo/Desktop/Sistemas/eco/CosaifWeb1/src/app/Components/movimientos/MovimientosPanel.tsx:454), [visibilidad de edición](/Users/viankodesarrollo/Desktop/Sistemas/eco/CosaifWeb1/src/app/Components/movimientos/Tabla.tsx:108), [autorización del proxy](/Users/viankodesarrollo/Desktop/Sistemas/eco/CosaifWeb1/src/lib/server/requestAuthorization.ts:60).

### 4. Convertir la calidad técnica en un requisito de publicación

El build omite ESLint por configuración. Por eso una compilación correcta puede convivir con los 152 errores y 42 advertencias encontrados. Parte de las advertencias afecta dependencias de hooks, que merece revisión funcional antes de una corrección automática.

**Propuesta:** corregir por módulo, empezando por tipos de respuestas y operaciones críticas; ejecutar en CI instalación reproducible, lint, TypeScript, pruebas y build. Priorizar casos de permisos por rol/empresa/localidad, alta y edición de movimientos, incidentes, mediciones de torno, cola offline y cierre de sesión. Añadir un entorno de prueba con usuarios y datos propios para cada rol.

La compilación depende de descargar Ubuntu de Google Fonts para la página 404. Empaquetar una fuente local o usar una del sistema haría ese paso independiente del servicio externo.

`.env.local` ya está versionado aunque aparece en `.gitignore`. Sustituirlo por `.env.example` sin valores de entorno y gestionar configuración privada fuera de Git. No se concluye que exista una filtración de secretos: la configuración pública de Firebase no equivale por sí misma a una credencial privada. Revisar por separado el historial y rotar sólo secretos reales que se hayan expuesto. Confirmar además `SESSION_SECRET` independiente: la documentación lo exige, pero el código permite usar `JWT_SECRET` como alternativa.

Evidencia: [configuración del build](/Users/viankodesarrollo/Desktop/Sistemas/eco/CosaifWeb1/next.config.ts:42), [fuente del 404](/Users/viankodesarrollo/Desktop/Sistemas/eco/CosaifWeb1/src/app/404/page.tsx:3), [secreto de sesión](/Users/viankodesarrollo/Desktop/Sistemas/eco/CosaifWeb1/src/lib/sessionToken.ts:29).

### 5. Preparar rendimiento y soporte para más usuarios y datos

El CRM carga páginas de forma secuencial hasta un máximo de 50. En listas grandes, esto prolonga la carga y puede devolver un subconjunto sin indicar que faltan páginas.

**Propuesta:** paginación, búsqueda y filtros en servidor, con total explícito; para catálogos pequeños, carga completa deliberada con un límite comunicado. Añadir timeout y tratamiento común de errores al cliente comercial. Conservar las optimizaciones existentes de caché, actualización en tiempo real y consultas sólo con la página visible; medir peticiones repetidas antes de cambiarlas.

`WebVitalsReporter` ya mide rendimiento, pero guarda las últimas entradas en `sessionStorage` y emite un evento local. No se encontró un consumidor que envíe esas métricas a un sistema central.

**Propuesta:** registrar métricas y errores de forma central con identificador de solicitud, ruta, versión y estado de conexión, omitiendo credenciales y cuerpos sensibles. Medir carga, tiempo de respuesta y fallos por módulo antes y después de cada entrega. La compilación reporta aproximadamente 247 kB de JavaScript inicial en reportería administrativa; es una referencia de compilación, no una medición de lentitud real.

Evidencia: [carga del CRM](/Users/viankodesarrollo/Desktop/Sistemas/eco/CosaifWeb1/src/app/comercial/_lib/useCrmList.ts:15), [métricas locales](/Users/viankodesarrollo/Desktop/Sistemas/eco/CosaifWeb1/src/app/Components/performance/WebVitalsReporter.tsx:28).

## Cambios visibles que darían más valor

| Área | Propuesta concreta | Cómo comprobar su utilidad |
|---|---|---|
| Inicio operativo | Extender el tablero existente con una franja de bloqueados, atrasados, por iniciar y responsables. Cada indicador abre su lista filtrada. Mantener localidad y última actualización visibles. | Un coordinador identifica qué atender sin recorrer varios módulos. |
| Seguimiento | Guardar vistas como «Mi turno», «Pendientes de mi empresa» o «Torno en proceso»; conservar filtros al volver del detalle; ofrecer un enlace con filtros autorizados. | Repetir una consulta habitual requiere menos acciones y no pierde el contexto. |
| Detalle de operación | Reunir estado actual, responsable, cronología, evidencias e incidentes en un detalle consistente. Mostrar claramente qué acción sigue y quién puede realizarla. | Se entiende por qué está detenido un movimiento y quién lo debe atender. |
| Crear y editar | Reutilizar las reglas del formulario, mostrar resumen antes del envío, validación junto al campo y estado persistente de borrador/sincronización. Extender las guías existentes con recuperación ante errores. | Se reduce la repetición de capturas y se distingue «guardado en dispositivo» de «confirmado en servidor». |
| Incidentes | Unificar severidad, responsable, antigüedad, evidencia y cierre; filtros por pendientes que requieren respuesta y escalamiento configurable. | Los incidentes críticos tienen dueño y seguimiento verificable. |
| Reportería y comercial | Mantener un periodo/localidad coherente, abrir los registros que forman cada indicador y aclarar fecha de actualización. Guardar configuraciones de reporte y mostrar progreso de exportaciones grandes. | Un total se puede conciliar con sus registros y se reproduce con los mismos filtros. |
| Diseño y móvil | Usar los componentes compartidos de forma consistente; reducir paneles anidados; priorizar estado, equipo, origen/destino y acción en pantallas pequeñas. Mantener tablas densas en escritorio. | Comparar los mismos flujos en móvil, escritorio y claro/oscuro con usuarios representativos. |
| Acceso | Login más compacto, identidad de COSAIF antes del formulario en móvil y una ruta clara de ayuda para recuperar acceso. | El formulario y la ayuda se localizan de inmediato. |

El modal compartido ya implementa Escape y semántica de diálogo, pero no gestiona foco inicial, recorrido de Tab dentro del modal ni devolución del foco al cerrarlo. Completar este comportamiento y extenderlo a los modales particulares mejora uso con teclado y lectores de pantalla. [Código del modal](/Users/viankodesarrollo/Desktop/Sistemas/eco/CosaifWeb1/src/app/Components/ui/Modal/Modal.tsx:29), [patrón oficial W3C](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

## Organización del código

La arquitectura documentada ya propone `src/features` para dominios y `Components/ui` para piezas compartidas. Conviene completar esa dirección: separar carga de datos, reglas y presentación del panel gráfico, edición de movimientos, incidentes y tableros por rol. Extraer reglas y componentes comunes antes de dividir sólo por número de líneas.

Consolidar gradualmente las vías `/api`, `/bff` y `/xapi` sobre utilidades comunes de sesión, autorización, timeout y errores, preservando las diferencias reales entre backend principal y Torreón. Revisar dependencias sin uso comprobado y la importación global de estilos antes de retirar bibliotecas. Actualizar el README con el puerto 3012, variables necesarias, servicios, ejecución y publicación.

## Orden de implementación recomendado

1. **Confiabilidad:** cola offline, aislamiento por usuario, parches, versión de Node y pruebas de esos cambios. Validar el contrato de idempotencia con backend.
2. **Flujos de uso:** permisos y rutas de edición, acceso/notificaciones, errores recuperables y modales accesibles. Probar una tarea completa por rol.
3. **Experiencia diaria:** tablero orientado a pendientes, vistas guardadas y detalle consistente. Empezar por movimientos como módulo piloto y medir tareas antes/después.
4. **Escala y mantenimiento:** CRM paginado, observabilidad, descomposición de módulos y migración mayor del framework con controles automatizados.

La primera entrega debe permitir afirmar que las solicitudes no se pierden al reconectar, cada usuario conserva su propio contexto y las acciones visibles tienen permiso y destino correctos. Esa base hace más confiables las mejoras de presentación y productividad posteriores.
