# COSAIF Web

Aplicación ferroviaria por roles: movimientos, rondas, incidentes, torno, Torreón y gestión comercial.

## Desarrollo

Requiere Node 24 y npm. La versión está fijada en `.nvmrc`; Next.js y React usan versiones exactas en `package.json` y el árbol completo está en `package-lock.json`.

```sh
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Abrir http://localhost:3012. Configurar `API_ORIGIN` y un `SESSION_SECRET` aleatorio antes de iniciar sesión. Si ya existe `.env.local`, conservar sus valores. El frontend usa `/bff` y `/xapi`; no publicar tokens del backend mediante variables `NEXT_PUBLIC_*`. El secreto de sesión debe ser independiente del secreto JWT del backend.

```sh
npm run check        # lint, tipos, pruebas y compilación
npm run start:local  # versión optimizada en localhost:3012 usando API local 127.0.0.1:3001
npm run start        # versión optimizada usando API_ORIGIN del entorno configurado
```

Para revisar la web con el API y los microservicios locales, usa `npm run start:local` después de compilar y de detener el servidor anterior de 3012. Este comando conserva las variables y claves existentes, y fija el destino del API a `http://127.0.0.1:3001` para ese proceso. No modifica `.env.local` ni inicia el API. `npm start` sigue usando la configuración del entorno: si allí hay una dirección remota, comprobará el acceso contra ese otro servidor. Al cambiar archivos de la aplicación, genera una nueva compilación antes de reiniciar la versión optimizada.

`npm run dev:https` y `npm run dev:https:lan` permiten probar PWA/notificaciones en HTTPS. `npm run pwa:urls` muestra las direcciones locales. No se requiere habilitar push para entrar.

## Estructura

- `src/app`: rutas, layouts y handlers HTTP de Next.js.
- `src/features`: módulos de negocio, consultas, normalizadores y vistas.
- `src/components`: interfaz y composición compartida.
- `src/hooks`: comportamiento transversal de React.
- `src/lib/http`: transporte cliente, caché acotada y concurrencia.
- `src/lib/server`: autenticación y transporte a servicios externos.
- `tests`: pruebas de regresión sin escribir a servicios reales.

Ver [arquitectura](docs/frontend-architecture.md), [autorización](docs/autorizacion-web.md), [plan de revisión](docs/revision-y-plan-de-mejoras-2026-09-08.md) y [rendimiento del administrador](docs/rendimiento-administrador.md).

La revisión de todos los roles está en [experiencia y rendimiento por rol](docs/experiencia-y-rendimiento-por-rol.md), con mediciones, pruebas y [consultas pendientes del backend](docs/pendientes-de-consultas-backend.md).

Los criterios visuales y las correcciones transversales están en [coherencia de UX/UI](docs/coherencia-ux-ui.md). La adaptación móvil y la carga diferida se documentan en [adaptación y carga de interfaz](docs/adaptacion-y-carga-ui.md).

## Operación y publicación

1. Configurar Node 24 en el servidor y las variables privadas mediante su gestor de secretos.
2. Ejecutar `npm ci` y `npm run check` con la configuración del entorno de pruebas.
3. Validar login, permisos, alta/edición, reconexión, incidentes y reportes con cuentas de prueba de los roles utilizados.
4. Publicar la compilación validada y comprobar salud y errores del backend. Esta tarea no publica automáticamente.

La sesión firmada usa `SESSION_SECRET`; cambiarlo invalida sesiones anteriores. Los borradores y pendientes permanecen asociados a su cuenta en el dispositivo. La bandeja nueva conserva resultados inciertos para conciliación: no repite automáticamente una escritura cuyo resultado se desconoce.

El proxy convierte `Idempotency-Key` en `X-Idempotency-Key`, que consume el middleware del backend revisado. Antes del despliegue, comprobar que producción tiene ese middleware y sus migraciones. Los datos antiguos sin propietario se conservan y generan un aviso para revisión; no se reasignan automáticamente.

Con `TELEMETRY_ENABLED=true`, el servidor emite JSON de métricas web y tiempos del proxy a stdout. El agregador de logs de infraestructura debe recogerlo. `APP_RELEASE` identifica la entrega. No se envían contraseñas, cookies, cuerpos de solicitudes, mensajes de error privados ni parámetros de consulta.
