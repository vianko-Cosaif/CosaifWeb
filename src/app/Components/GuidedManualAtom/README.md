# Guided Manual (GuidedManualAtom)

Este componente permite añadir flujos interactivos de ayuda (tours guiados y asistentes tipo "wizard") en aplicaciones React Web y React Native. 

El módulo está diseñado para ser totalmente independiente. Los estilos se manejan mediante CSS-in-JS con estilos en línea calculados dinámicamente, por lo que no requiere configuraciones de CSS externas, Tailwind o preprocesadores en el proyecto donde se integre.

---

## Características principales

*   **Soporte Web y Mobile:** Código unificado con puntos de entrada específicos para React (`web`) y React Native (`native`).
*   **Modo Guía vs Modo Wizard:**
    *   **Guía (`mode: 'guide'`):** Muestra información destacando un elemento, pero bloquea cualquier interacción del usuario con el resto de la pantalla.
    *   **Wizard (`mode: 'wizard'`):** Resalta el elemento objetivo permitiendo que el usuario interactúe con él (escribir en inputs, hacer clic, etc.), mientras bloquea la interacción con los demás elementos circundantes.
*   **Automatización de acciones:** Ejecuta acciones automáticas (como clics en selectores o eventos personalizados) al entrar o salir de un paso específico.
*   **Personalización visual:** Permite adaptar colores, fuentes, espaciados, bordes y sombras a la identidad gráfica de la aplicación a través de la propiedad `appearance`.
*   **Slots e internacionalización:** Posibilidad de inyectar botones propios del sistema de diseño y modificar libremente los textos e iconos del navegador del manual.
*   **Manuales dinámicos:** Permite iniciar manuales pasando un arreglo de pasos generados bajo demanda en tiempo de ejecución.

---

## Integración en tu Proyecto (Copia Directa)

Para integrar este componente, copia los archivos del directorio `src` directamente a la estructura de tu proyecto (por ejemplo, bajo la ruta `@/components/GuidedManualAtom/` o la que prefieras).

Para evitar errores de compilación de TypeScript en proyectos de una sola plataforma, elimina los archivos que no correspondan:

### En proyectos puramente Web (Next.js / Vite / React)
1. Copia los siguientes archivos:
   * `GuidedManualAtom.core.ts`
   * `GuidedManualAtom.web.styles.ts`
   * `GuidedManualAtom.web.tsx`
   * `GuidedManualAtom.shared.ts`
   * `GuidedManualAtom.shared.json`
   * `index.ts`
2. **Elimina los archivos de la plataforma móvil** (`*.native.tsx`, `*.native.styles.ts`, `index.native.ts`) para que el compilador de TypeScript no exija dependencias de React Native (`react-native` y `react-native-safe-area-context`) en tu entorno web.

### En proyectos puramente Móviles (React Native / Expo)
1. Copia los siguientes archivos:
   * `GuidedManualAtom.core.ts`
   * `GuidedManualAtom.native.styles.ts`
   * `GuidedManualAtom.native.tsx`
   * `GuidedManualAtom.shared.ts`
   * `GuidedManualAtom.shared.json`
   * `index.native.ts`
2. **Renombra** `index.native.ts` a `index.ts` para que actúe como punto de entrada único de tu componente.
3. **Elimina los archivos de la plataforma web** (`*.web.tsx`, `*.web.styles.ts`, `index.ts`).
4. Asegúrate de tener instalada la librería `react-native-safe-area-context` en tu proyecto móvil para el correcto posicionamiento del panel.

---

### Importación del Componente
Una vez copiados los archivos, los componentes y tipos se importan utilizando rutas relativas o alias del proyecto (por ejemplo, `@/components/GuidedManualAtom`):

```tsx
import {
  GuidedManualProvider,
  GuidedManualStart,
  GuidedTarget,
  type GuidedManualStep,
} from "@/components/GuidedManualAtom";
```

---

## Tipos de Datos Principales

Los tipos de datos se importan directamente desde el punto de entrada del componente en tu proyecto:

```ts
export type GuidedManualMode = 'guide' | 'wizard';

export type GuidedManualAction = {
  type: 'event' | 'click';
  eventName?: string;
  selector?: string;
  detail?: Record<string, any>;
  delayMs?: number;
};

export type GuidedManualStep = {
  id: string;
  title: string;
  description: string;
  targetId?: string;
  selector?: string;
  mode?: GuidedManualMode;
  actionOnEnter?: GuidedManualAction;
  actionOnNext?: GuidedManualAction;
};
```

---

## Implementación en Web (React / Next.js)

Para implementar el manual, define un conjunto de pasos y envuelve tu layout o página con el proveedor de contexto.

```tsx
"use client";

import React from "react";
import {
  GuidedManualProvider,
  GuidedManualStart,
  GuidedTarget,
  type GuidedManualStep
} from "@/components/GuidedManualAtom";

const steps: GuidedManualStep[] = [
  {
    id: "introduccion",
    title: "Bienvenido",
    description: "Este es un recorrido rápido para familiarizarte con la plataforma.",
    mode: "guide"
  },
  {
    id: "formulario-email",
    targetId: "input-email",
    title: "Ingresa tu correo",
    description: "Escribe tu correo de trabajo aquí para continuar.",
    mode: "wizard" // Permite interactuar con el input mientras la guía está activa
  }
];

export default function MiPagina() {
  return (
    <GuidedManualProvider steps={steps}>
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h2>Mi Aplicación Web</h2>
          <GuidedManualStart label="Iniciar ayuda" />
        </div>

        <div style={{ margin: "40px 0" }}>
          <label style={{ display: "block", marginBottom: 8 }}>Correo electrónico</label>
          <GuidedTarget id="input-email">
            <input 
              type="email" 
              placeholder="nombre@empresa.com" 
              style={{ padding: 8, width: 300, border: "1px solid #ccc" }} 
            />
          </GuidedTarget>
        </div>
      </div>
    </GuidedManualProvider>
  );
}
```

---

## Implementación en Móvil (React Native / Expo)

La implementación en React Native es estructuralmente similar, pero utiliza el punto de entrada móvil adaptado.

```tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  GuidedManualProvider,
  GuidedManualStart,
  GuidedTarget,
  type GuidedManualStep
} from "@/components/GuidedManualAtom";

const nativeSteps: GuidedManualStep[] = [
  {
    id: "perfil-seccion",
    targetId: "tarjeta-perfil",
    title: "Tu Perfil",
    description: "Aquí se muestran tus datos personales.",
    mode: "guide"
  }
];

export default function App() {
  return (
    <SafeAreaProvider>
      <GuidedManualProvider steps={nativeSteps}>
        <View style={styles.container}>
          <Text style={styles.title}>Mi Aplicación Móvil</Text>
          
          <GuidedManualStart label="Ver ayuda" style={styles.btnAyuda} />

          <GuidedTarget id="tarjeta-perfil">
            <View style={styles.card}>
              <Text>Nombre: Juan Pérez</Text>
              <Text>Email: juan@vianko.com</Text>
            </View>
          </GuidedTarget>
        </View>
      </GuidedManualProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
  btnAyuda: { alignSelf: "flex-start", marginBottom: 15 },
  card: { padding: 16, borderWidth: 1, borderColor: "#ddd", borderRadius: 8 }
});
```

---

## Configuración Visual (`appearance`)

Puedes personalizar la apariencia por defecto enviando el prop `appearance` al proveedor. Esto permite adaptar la interfaz sin modificar el código del módulo.

```tsx
<GuidedManualProvider
  steps={steps}
  appearance={{
    mode: "dark", // 'light' | 'dark'
    colors: {
      accent: "#3b82f6",          // Color de foco y botones primarios
      panelBg: "#1e293b",         // Color de fondo del globo informativo
      panelBorder: "#334155",     // Color de borde del globo informativo
      textMain: "#f8fafc",        // Título del paso
      textMuted: "#cbd5e1",       // Descripción del paso
      buttonBg: "rgba(255, 255, 255, 0.08)", // Fondo de botones secundarios
      buttonPrimaryBg: "rgba(59, 130, 246, 0.2)" // Fondo de botón de avanzar
    },
    layout: {
      spotlightPadding: 6,        // Margen entre el elemento y el foco de luz
      spotlightRadius: 12,        // Redondeado de esquinas del foco de luz
      panelWidth: 320,            // Ancho del globo de información
      panelPadding: 16,           // Relleno interno del globo
      panelRadius: 16             // Redondeado de esquinas del globo
    },
    typography: {
      fontFamily: "system-ui, sans-serif",
      titleSize: 16,
      descriptionSize: 14
    }
  }}
>
  {children}
</GuidedManualProvider>
```

---

## Automatización y Eventos (`actionRunner`)

El componente permite automatizar tareas complejas de interfaz de usuario mediante acciones predefinidas por cada paso.

*   `actionOnEnter`: Se ejecuta inmediatamente cuando el usuario entra al paso.
*   `actionOnNext`: Se ejecuta cuando el usuario presiona el botón "Siguiente" o "Terminar".

### Ejemplo de flujo interactivo:
Imagina que un paso requiere abrir un menú lateral de la app para que el usuario pueda ver el botón objetivo:

```tsx
const steps: GuidedManualStep[] = [
  {
    id: "abrir-menu-lateral",
    title: "Menú de Configuración",
    description: "Aquí encontrarás todas las opciones de configuración de tu cuenta.",
    targetId: "btn-ajustes",
    actionOnEnter: {
      type: "event",
      eventName: "abrir_sidebar",
      delayMs: 250 // Da tiempo a que termine la animación de apertura del menú
    }
  }
];

export function LayoutApp() {
  const [sidebarAbierta, setSidebarAbierta] = React.useState(false);

  // El prop actionRunner captura el evento emitido por la guía
  const manejarAccionGuia = (action) => {
    if (action.eventName === "abrir_sidebar") {
      setSidebarAbierta(true);
    }
    // Retorna los ms que debe esperar la guía para recalcular la posición del foco
    return action.delayMs ?? 0;
  };

  return (
    <GuidedManualProvider steps={steps} actionRunner={manejarAccionGuia}>
      {/* Estructura de componentes */}
    </GuidedManualProvider>
  );
}
```

---

## Inyección de Botones Propios (`slots`)

Si deseas que la barra de navegación del manual utilice los botones del sistema de diseño del proyecto, puedes proveer un componente adaptador a través del prop `slots`:

```tsx
import { BotonSistema } from "@/ui/BotonSistema";

<GuidedManualProvider
  steps={steps}
  slots={{
    Button: ({ children, onPress, disabled, tone, iconOnly }) => (
      <BotonSistema
        onClick={onPress}
        disabled={disabled}
        color={tone === "primary" ? "primary" : "neutral"}
        variant={iconOnly ? "ghost" : "solid"}
      >
        {children}
      </BotonSistema>
    )
  }}
>
  {children}
</GuidedManualProvider>
```

---

## Traducciones y Símbolos (`copy` e `icons`)

Puedes sobrescribir los textos e iconos que muestra la barra de navegación de forma sencilla:

```tsx
<GuidedManualProvider
  steps={steps}
  copy={{
    start: "Comenzar",
    prev: "Atrás",
    next: "Continuar",
    finish: "Finalizar"
  }}
  icons={{
    prev: "←",
    next: "→",
    finish: "✓"
  }}
>
  {children}
</GuidedManualProvider>
```

---

## Hooks y Lanzamientos Dinámicos

El componente exporta hooks para consultar el estado del recorrido y ejecutar acciones programáticamente.

### Hooks disponibles:
*   `useGuidedManualState()`: Devuelve información de lectura sobre el estado del manual (ej: `isOpen`, `currentIndex`, `totalSteps`, `currentStep`).
*   `useGuidedManualApi()`: Devuelve los controladores (`start`, `startWithSteps`, `close`, `next`, `prev`).
*   `useGuidedManual()`: Retorna la combinación de ambos contextos.

### Lanzar guías de forma dinámica:
A veces necesitas mostrar guías condicionales ante un error o acción específica del usuario, sin que los pasos estén declarados previamente en la raíz del componente. Puedes usar `startWithSteps` para inyectar flujos al vuelo:

```tsx
import { useGuidedManualApi } from "@/components/GuidedManualAtom";

export function BotonAyudaDinamica() {
  const api = useGuidedManualApi();

  const iniciarTutorialContacto = () => {
    api?.startWithSteps([
      {
        id: "soporte-rapido",
        targetId: "btn-contacto",
        title: "Soporte Técnico",
        description: "Haz clic aquí si necesitas hablar directamente con soporte.",
        mode: "wizard"
      }
    ], 0);
  };

  return (
    <button type="button" onClick={iniciarTutorialContacto}>
      ¿Necesitas ayuda con esta pantalla?
    </button>
  );
}
```
