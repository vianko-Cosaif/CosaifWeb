# Rendimiento del administrador — 8 de septiembre de 2026

El tablero carga únicamente las rondas del patio seleccionado. En «Todas»,
consulta como máximo tres patios a la vez y permite abrir los resultados que ya
respondieron. El menú conserva el shell durante la navegación y ofrece enlaces
de Next con precarga automática e indicación de carga.

## Causas verificadas y correcciones

- En la vista «Todas», la primera consulta a `/api/admin/rondas?all=1` apuntaba
  a una ruta inexistente. Después se consultaban todos los patios sin límite
  de concurrencia. Se eliminó esa petición y, al seleccionar un patio, la
  espera innecesaria al catálogo de localidades.
- El módulo del tablero arrastraba AntD, el visor de mediciones, animaciones,
  sonido y notificaciones. El visor se importa al abrirlo; sonido, Firebase y
  tutoriales se inicializan cuando corresponden. Las transiciones del tablero
  usan CSS y el reloj actualiza únicamente su indicador.
- El monitor repetía consultas al montar, conectarse y volver a la pestaña.
  Ahora coordina los disparadores, cancela trabajo obsoleto y suspende el
  sondeo cuando la página está oculta. Realtime comparte el canal durante
  cambios de sección y Strict Mode, y puede recuperar SSE después de inactividad.
- El centro de Incidentes descargaba de nuevo todo el historial al recibir
  `realtime.ready` y continuaba solicitando páginas después de salir. Comparte
  la carga en curso, cancela listados y detalles obsoletos, y pausa consultas
  ocultas. Volver inmediatamente no repite una consulta reciente. Los cambios
  reales recibidos durante una carga se agrupan en una actualización posterior.
  Se conserva el cálculo completo de estadísticas y la paginación visible.
- El banner esperaba las imágenes de todos sus anuncios antes de mostrarse.
  Publica la configuración inmediatamente y deja cargar los recursos del
  anuncio visible. La rotación se pausa al ocultar la pestaña.
- La API de rondas devolvía `200 []` ante fallos del servidor. Ahora distingue
  una cola vacía válida de una consulta fallida. El tablero conserva datos
  anteriores, indica los patios sin actualizar y no presenta totales completos
  cuando falta una fuente. Los endpoints alternativos se prueban sólo ante
  `404/405`. Un rechazo de las credenciales internas de Torreón produce `502`,
  porque esas credenciales no representan la sesión del usuario.

## Comparación de la compilación de producción

Mismo método antes y después: archivos JavaScript únicos referenciados por cada
entrada en `page_client-reference-manifest.js`, sumados por bytes. Gzip se
calcula localmente. Las entradas pueden compartir archivos: **no deben sumarse**
para obtener el peso total de una página. No son una medición de transferencia
real, tiempo de navegación ni mejora de consultas SQL.

| Entrada | Antes | Después | Reducción |
| --- | ---: | ---: | ---: |
| Módulo del tablero administrador | 860.230 B | 74.455 B | 91,34 % |
| Guía de capacitación | 122.323 B | 70.811 B | 42,11 % |
| Layout administrador | 156.346 B | 143.062 B | 8,50 % |

El tablero pasa de nueve archivos iniciales a tres. El runtime de AntD y los
archivos del visor de mediciones quedan fuera de esa entrada inicial. El reset
CSS global permanece. Evidencia: `rendimiento-administrador-mediciones.json`.

## Desarrollo local

Las trazas previas de Webpack en desarrollo mostraron solicitudes de Reportería
de 3.285 ms, con 3.154 ms dedicados a compilar; Usuarios de 2.838 ms, con 2.786 ms
de compilación; e Incidentes de 2.173 ms, con 2.112 ms preparando la página.
Esto explica parte de la espera al visitar por primera vez una sección en
`npm run dev`. El código de producción se prepara con `npm run build` y se sirve
con `npm start`; el primer acceso no debe compararse mezclando ambos modos.

La prueba temporal de Turbopack no aporta una comparación de latencia válida:
la sesión caducó durante la comprobación. Se retiró el servidor temporal y no se
cambió el compilador predeterminado basándose en esa prueba.

## Validación

Ejecutar `npm run check` con Node 24: ESLint, generación de tipos, TypeScript,
Vitest y compilación de producción. Las pruebas cubren selección sin esperar
catálogo, concurrencia limitada, respuestas parciales, conservación de datos,
cancelación, permisos, fallback HTTP, hidratación, canal realtime compartido,
notificaciones y carga diferida.

Resultado final: 147 pruebas en 22 archivos aprobadas, TypeScript y compilación
de producción correctos; ESLint sin errores y con siete avisos anteriores a
estos cambios. Se recorrieron Operación, Seguimiento, Configuración, Usuarios,
Incidentes y Reportería con una sesión real. Se verificaron ambos patios y el
historial de Incidentes con 1.180 registros, mostrando 24 filas por página. La
consola de la pestaña de verificación quedó sin errores.

También se corrigió el envío nativo del login antes de hidratar: usa POST y el
botón espera a que el formulario esté listo. Las credenciales no deben viajar
en parámetros de URL. El rechazo vigente de una sesión sigue respetándose;
las respuestas de conexiones canceladas ya no cierran una sesión posterior.

## Pantalla completa y temas

El contenedor expandido tenía fondo transparente y dejaba visible el backdrop
negro del navegador. Ahora el tablero pinta `--app-bg` en ambos modos y define
su propio desplazamiento vertical al expandirse. Cabecera, controles y contenido
comparten ancho y márgenes; el control para salir permanece accesible al bajar.
Las superficies y etiquetas usan la paleta del tema, incluso en tarjetas anidadas.

El script inicial y el selector respetan la misma preferencia ante almacenamiento
bloqueado o valores inválidos. Los cambios de otra pestaña sincronizan documento
e icono sin volver a escribir la preferencia.

Comprobación en navegador: claro/oscuro normal y expandido, recarga en ambos temas,
desplazamiento completo y ausencia de desbordamiento horizontal. Contraste medido
de cabecera: título 15,01:1 claro / 16,09:1 oscuro; etiqueta secundaria 4,77:1 claro
/ 8,48:1 oscuro. Nueva validación completa: 169 pruebas en 25 archivos, TypeScript
y build aprobados; se conservan los siete avisos previos de lint sin errores.
