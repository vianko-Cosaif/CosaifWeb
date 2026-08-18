# Contrato de autorización web

La web consume el perfil `authorization` emitido por BackCosaif2. El contrato vigente es `policyVersion: 2`; si falta, cambia de versión o no permite la plataforma web, la sesión se rechaza y se solicita iniciar sesión nuevamente.

## Alcance de esta ofensiva

Roles web operativos:

- `ADMINISTRADOR`: alcance global.
- `COORDINADOR`: alcance por localidad.
- `SUPERVISOR`: alcance por localidad.
- `CLIENTE`: alcance por empresa y localidad.
- `CLIENTE_ADMIN`: alcance por empresa.
- `CLIENTE_COOR`: alcance por empresa.
- `ARRASTRE_TORREON`: cliente de Arrastre Torreón, limitado a su empresa y localidad.

Los roles `OPERADOR`, `MAQUINISTA`, `MAQUINISTA_ARRASTRE`, `TORNO` y `LAVADO` no reciben área, menú ni rutas web. El módulo comercial preexistente permanece aislado; esta ofensiva no lo amplía ni lo mezcla con la operación.

## Reglas de seguridad

1. El JWT del backend permanece en una cookie `HttpOnly`; ningún componente React lo recibe como prop ni lo lee desde JavaScript.
2. La web firma una sesión propia con el perfil de autorización validado. Middleware, páginas y rutas API usan esa sesión como autoridad.
3. Empresa y localidad se toman del `scope` firmado. Las cookies visuales heredadas sólo conservan compatibilidad de interfaz y nunca autorizan datos.
4. Los menús provienen de `capabilities.navModules`; las páginas y acciones verifican además el permiso específico.
5. Los BFF y proxies aplican una denegación temprana para rutas conocidas. BackCosaif2 conserva la decisión final.
6. Las mutaciones rechazan solicitudes cross-site y las respuestas autenticadas usan `no-store`.
7. Si BackCosaif2 no responde durante una revalidación, la interfaz muestra sincronización pendiente y conserva la sesión firmada aún vigente. Un `401` o `403` sí obliga a renovar sesión.

## Matriz resumida

| Función | Administrador | Coordinador | Supervisor | Cliente | Cliente admin/coor | Arrastre Torreón |
|---|---:|---:|---:|---:|---:|---:|
| Ver movimientos naturales | permiso backend | localidad | localidad | empresa + localidad | empresa | no |
| Crear movimientos naturales | permiso backend | localidad | localidad | empresa + localidad | empresa | no |
| Ver incidentes | permiso backend | localidad | localidad | empresa + localidad | empresa | empresa + localidad |
| Resolver incidentes | permiso backend | permiso backend | permiso backend | permiso backend | permiso backend | permiso backend |
| Ver Arrastre Torreón | permiso backend | localidad | según perfil backend | no | empresa | empresa + localidad |
| Crear Arrastre Torreón | permiso backend | según perfil backend | según perfil backend | no | empresa | empresa + localidad |
| Operar patio Torreón | permiso backend | localidad | localidad | no | no | no |
| Administrar usuarios | permiso backend | permiso backend | no | no | no | no |

“Permiso backend” significa que la web no deduce autoridad por el nombre del rol: exige el permiso recibido en el token vigente.

## Operación

- Una modificación de rol, permisos, empresa o localidad entra en vigor al renovar/revalidar la sesión.
- Las sesiones antiguas que no contengan `authorization` v2 se invalidan una sola vez por diseño.
- `SESSION_SECRET` debe tener al menos 32 caracteres y ser distinto de cualquier secreto del backend.
- No registrar tokens, contraseñas, cookies, cuerpos completos ni respuestas internas en el navegador.
