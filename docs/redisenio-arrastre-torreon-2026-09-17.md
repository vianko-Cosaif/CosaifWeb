# Rediseño visual de Arrastre y Torreón

Se reemplazó la presentación anterior por un diseño compartido para el cliente de arrastres, coordinación y supervisión administrativa de Torreón.

- Dashboard con cabecera abierta, indicadores unificados, operación destacada, recorrido origen–destino, composición de vagones y cola secundaria.
- Una lista adaptable sustituye las versiones duplicadas de tabla de escritorio y tarjetas de móvil. El detalle se monta únicamente al abrir una solicitud y presenta los vagones en tarjetas, sin tablas de ancho mínimo fijo.
- Edición, reordenación, prioridad y cancelación quedan en un menú contextual, según las reglas y permisos existentes. Iniciar/finalizar conservan sus acciones operativas. El historial no muestra acciones de modificación.
- Filtros con periodo, búsqueda, fecha y explicación del alcance por empresa/localidad. Se mantienen la paginación del servidor y las restricciones del backend.
- Rondas naturales con locomotora principal, recorrido, prioridad y lista compacta. El tablero no inventa números de ronda cuando faltan en la respuesta.
- Colores semánticos compartidos para claro/oscuro y controles de teclado. Sin nuevas dependencias, imágenes ni animaciones continuas.

## Verificación

El build de verificación se genera en `.next-quality`, independiente del servidor de desarrollo de `3012`. Las pruebas de navegador usan una API sintética en `3911` y una instancia de producción en `3912`: no escriben en la operación real.

Resultado: 425 pruebas unitarias y 24 pruebas de navegador aprobadas. Build y TypeScript correctos; lint sin errores, con cinco advertencias preexistentes.

Se prueban el dashboard y seguimiento del cliente, aislamiento de acciones entre empresas, filtros, paginación, historial, expansión de vagones, navegación entre arrastres y rondas naturales y controles de coordinación. Los temas claro/oscuro se comprueban en 390 y 1440 píxeles, con revisión de desbordamientos y accesibilidad automática.

## Tamaño de los artefactos

| Artefacto                           |           Antes |         Después |
| ----------------------------------- | --------------: | --------------: |
| JavaScript cliente, total de chunks | 4 977 093 bytes | 4 881 537 bytes |
| CSS cliente, total de chunks        |   281 752 bytes |   295 937 bytes |

El JavaScript disminuyó 95 556 bytes. El CSS creció por los estilos del rediseño; la hoja ferroviaria completa pesa 3 669 bytes con gzip. El límite de CSS total se ajustó explícitamente de 290 000 a 300 000 bytes para este diseño; los límites de JavaScript, login y archivo CSS individual se conservan. Estos tamaños agregados no equivalen a la descarga de una sola página ni miden la latencia de la API real.

La sesión disponible del navegador local está en login. La validación autenticada de esta entrega se hizo con cuentas y datos sintéticos; no se modificaron contraseñas ni permisos reales.
