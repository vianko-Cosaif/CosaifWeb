# Crear Movimiento (Arquitectura Declarativa)

Ultima actualizacion: 2026-03-04

## Objetivo
Este modulo implementa un wizard de 3 pasos para crear movimientos ferroviarios.
El objetivo del refactor es separar responsabilidades para que el mantenimiento sea predecible:

- Vista principal declarativa (`CrearMovimiento.tsx`)
- Hook orquestador (`useCrearMovimientoController.ts`)
- Sub-hooks especializados (sesion, catalogos, draft, outbox, submit)
- Dominio puro (reglas y armado de payload)
- Presentacion por paso (`StepOne.tsx`, `StepTwo.tsx`, `StepTwoTorno.tsx`, `StepThree.tsx`)
- UI reutilizable (`components/ui.tsx`)

## Mapa de archivos
- `src/app/movimientos/crear/CrearMovimiento.tsx`
  - Componente contenedor.
  - Conecta estado/acciones del hook con la UI.
  - No contiene reglas complejas de negocio.
- `src/app/movimientos/crear/useCrearMovimientoController.ts`
  - Orquestador liviano.
  - Compone sub-hooks y expone un contrato unico para la vista.
- `src/app/movimientos/crear/controller.types.ts`
  - Tipos compartidos del contrato del controlador.
- `src/app/movimientos/crear/crearMovimiento.domain.ts`
  - Funciones puras de dominio:
  - `resolveIds`, `validateStep1Data`, `validateStep2Data`, `buildMovimientoPayload`.
- `src/app/movimientos/crear/useCrearMovimientoSession.ts`
  - Rol, usuario y restricciones por permisos.
- `src/app/movimientos/crear/useCrearMovimientoCatalogos.ts`
  - Empresas/localidades/vias/secciones.
- `src/app/movimientos/crear/useCrearMovimientoDraft.ts`
  - Autosave y restauracion de borrador.
- `src/app/movimientos/crear/useCrearMovimientoOutbox.ts`
  - Cola offline y sincronizacion periodica.
- `src/app/movimientos/crear/useCrearMovimientoSubmit.ts`
  - Envio final, manejo de errores y redireccion por rol.
- `src/app/movimientos/crear/components/StepOne.tsx`
  - Datos operativos iniciales (empresa/localidad, servicio, vias, secciones, prioridad, locomotora).
- `src/app/movimientos/crear/components/StepTwo.tsx`
  - Configuracion tecnica (tipo de movimiento, posicionamiento, direccion remolcada).
- `src/app/movimientos/crear/components/StepTwoTorno.tsx`
  - Variante del Step 2 cuando el servicio seleccionado es `Torno`.
  - Captura medicion de ruedas en estado local/draft del wizard.
  - Conserva validaciones actuales de tipo/direccion.
- `src/app/movimientos/crear/components/StepThree.tsx`
  - Resumen final, comentarios y confirmacion de envio.
- `src/app/movimientos/crear/components/ui.tsx`
  - Primitivas visuales (`Field`, `Select`, `Badge`, `RoleBadge`).
- `src/app/movimientos/crear/tornoMedicion.types.ts`
  - Tipos y helpers puros del subflujo de medicion de ruedas.
- `src/app/movimientos/crear/tornoProfiles.ts`
  - Resolver de plantilla por empresa (`Wabtec`, `Altom`, `Progress`).
  - Mapea columnas y metadatos visuales por formato.

## Relacion entre archivos (quien llama a quien)
```text
CrearMovimiento.tsx
  -> useCrearMovimientoController.ts
      -> controller.types.ts
      -> crearMovimiento.domain.ts
      -> useCrearMovimientoSession.ts
      -> useCrearMovimientoCatalogos.ts
      -> useCrearMovimientoDraft.ts
      -> useCrearMovimientoOutbox.ts
      -> useCrearMovimientoSubmit.ts
      -> tornoMedicion.types.ts
      -> tornoProfiles.ts
  -> StepOne.tsx / StepTwo.tsx / StepTwoTorno.tsx / StepThree.tsx
```

## Detalle declarativo por archivo .ts
### `controller.types.ts`
- Rol: contrato tipado transversal.
- Entrada: tipos base desde `movimientos.shared.ts`.
- Salida: tipos de wizard (`step`, `selectionMode`, `resolvedIds`) + interfaz `CrearMovimientoController`.
- Consumidores: todos los sub-hooks y el orquestador.
- No debe contener: side effects, hooks, llamadas HTTP.

### `crearMovimiento.domain.ts`
- Rol: reglas puras de negocio.
- Entrada: datos del formulario/rol/sesion.
- Salida: errores de validacion, ids normalizados, payload final y metadatos de asignacion.
- Consumidores: `useCrearMovimientoController.ts` y `useCrearMovimientoSubmit.ts`.
- No debe contener: `window`, `localStorage`, `fetch`, hooks.

### `useCrearMovimientoSession.ts`
- Rol: sesion y permisos del usuario.
- Entrada: `setForm` del wizard.
- Salida: `rol`, `user`, `canManageAll`, `initFormLocked`, `enforceLockedLocality`.
- Consumidor principal: `useCrearMovimientoController.ts`.
- No debe contener: carga de catalogos, logica de envio, cola offline.
- Lectura de sesion: prioriza `sessionStorage.user`; usa `localStorage.user` como fallback.

### `useCrearMovimientoCatalogos.ts`
- Rol: datos referenciales del formulario.
- Entrada: `selectedLocalityId`.
- Salida: `empresas`, `localidades`, `vias`, `sectionsByVia`, `ensureSections`.
- Consumidor principal: `useCrearMovimientoController.ts`.
- No debe contener: validaciones por step ni armado de payload.

### `useCrearMovimientoDraft.ts`
- Rol: persistencia local del progreso del wizard.
- Entrada: estado actual del formulario y setters de restauracion.
- Salida: `hydrateDraft`, `clearDraft`.
- Consumidor principal: `useCrearMovimientoController.ts`.
- No debe contener: decisiones de negocio o llamadas backend.
- Nota Torno: persiste `tornoMedicion` solo a nivel draft local (sin impacto backend).

### `useCrearMovimientoOutbox.ts`
- Rol: resiliencia de red para crear movimientos en modo offline.
- Entrada: payloads `unknown` para encolar.
- Salida: `online`, `pendingCount`, `banner`, `pushOutbox`, `flushOutbox`, `clearOutbox`.
- Consumidores: `useCrearMovimientoController.ts` y `useCrearMovimientoSubmit.ts`.
- No debe contener: logica de validacion/armado de payload.

### `useCrearMovimientoSubmit.ts`
- Rol: ejecucion del submit final.
- Entrada: formulario, ids resueltos, callbacks de exito/offline.
- Salida: `sending`, `submit`.
- Consumidor principal: `useCrearMovimientoController.ts`.
- Dependencia fuerte: `crearMovimiento.domain.ts` (payload/normalizacion).

### `useCrearMovimientoController.ts`
- Rol: orquestador declarativo.
- Entrada: ninguna externa (se auto-compone con sub-hooks).
- Salida: contrato unificado `CrearMovimientoController` para la vista.
- Consumidor principal: `CrearMovimiento.tsx`.
- Regla de mantenimiento: coordina capas, no absorber reglas puras nuevas.

### `tornoMedicion.types.ts`
- Rol: contrato tipado del Step de medicion de ruedas (servicio Torno).
- Entrada: ninguna (modulo puro).
- Salida: tipos `TornoMedicionState`, `TornoWheelCount`, `TornoWheelPosition` y helpers derivados.
- Consumidores: `useCrearMovimientoController.ts`, `useCrearMovimientoDraft.ts`, `StepTwoTorno.tsx`.
- Regla de mantenimiento: no acoplar este contrato al payload persistente del backend.

### `tornoProfiles.ts`
- Rol: seleccionar y describir la plantilla visual de Torno por empresa.
- Entrada: `companyName` normalizado.
- Salida: `profileId` + columnas/etiquetas por plantilla.
- Consumidores: `StepTwoTorno.tsx`.
- Regla de mantenimiento: agregar nuevas empresas como perfiles explicitos, no con condicionales dispersos.

## Flujo de datos (de punta a punta)
1. `CrearMovimiento.tsx` consume `useCrearMovimientoController`.
2. Session hook bloquea datos segun rol.
3. Catalogos hook trae empresas/localidades/vias/secciones.
4. Draft hook rehidrata estado local si existe.
5. Outbox hook informa conectividad y pendientes.
6. Step 1 y Step 2 actualizan `form`; `goNext` valida con dominio puro.
   - Si `service === "Torno"`, Step 2 cambia a `StepTwoTorno` y usa `tornoMedicion` local.
   - `StepTwoTorno` resuelve plantilla por empresa (`Wabtec`, `Altom`, `Progress`).
7. Step 3 dispara `submit`.
8. Submit hook construye payload (dominio), envia, asigna seccion y redirige.

## Flujo declarativo (alto nivel)
1. `CrearMovimiento` monta el hook controlador.
2. El orquestador inicializa sesion + catalogos + draft/outbox.
3. La vista renderiza el step activo y pasa props minimas.
4. Cada step modifica estado via callbacks del hook.
5. `goNext` valida por step antes de avanzar.
6. `submit` usa dominio puro para armar payload, envia y redirige.

## Estado principal
- `step`: paso activo del wizard (`1 | 2 | 3`).
- `form`: estructura completa del movimiento en edicion.
- `errors`: errores por campo del paso actual.
- `sending`: estado de envio en progreso.
- `selectionMode`: `de_via | para_via` cuando hay servicio.
- `fromSection` / `toSection`: seccion seleccionada por via.
- `locoLockedBy`: bloqueo visual cuando una seccion ocupada define locomotora.
- `tornoMedicion`: estado de medicion de ruedas para Torno (solo draft local).

## Side effects controlados en el hook
- Sincronizacion de permisos/rol por sesion.
- Carga de catalogos y datos dependientes.
- Rehidratacion y autosave de draft en `localStorage`.
- Cola offline (`OUTBOX_KEY`) y flush periodico.
- Shortcut de teclado (`Ctrl/Cmd + Enter`) en paso final.

## Reglas de negocio encapsuladas
- Resolucion robusta de IDs (`empresaId`, `creadoPorId`, `localidadId`) segun rol.
- Validacion por paso (`validate1`, `validate2`).
- Regla Torno: solo opera en modo `de_via` (no `para_via`).
- Construccion de `instrucciones` con metadatos de seccion.
- Envio de movimiento + asignacion opcional de seccion.
- Redireccion final por rol (`roleBase`).

## Convenciones para mantener el modulo
- No agregar logica de negocio en los Steps.
- Mantener `CrearMovimiento.tsx` como capa declarativa de composicion.
- Reglas nuevas: agregar en `crearMovimiento.domain.ts`.
- Side effects nuevos: agregar en sub-hook dedicado.
- `useCrearMovimientoController.ts` debe quedarse como orquestador.

## Guia para cambios futuros
1. Cambios visuales:
   - Editar `StepX.tsx` o `components/ui.tsx`.
2. Cambios de reglas/validaciones/envio:
   - Editar `crearMovimiento.domain.ts` y/o `useCrearMovimientoSubmit.ts`.
3. Cambios de navegacion o layout general:
   - Editar `CrearMovimiento.tsx`.
4. Cambios de contrato de props:
   - Actualizar `controller.types.ts` y consumidores.

## Checklist rapido de PR
- [ ] `npx tsc --noEmit` sin errores.
- [ ] `eslint` del modulo sin errores.
- [ ] Flujo de paso 1 -> 2 -> 3 sin regresiones.
- [ ] Envio online y offline validado.
- [ ] Redireccion final por rol validada.
