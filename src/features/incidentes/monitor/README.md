# Monitor de Incidentes

Este módulo proporciona funcionalidad para monitorear incidentes en tiempo real y mostrar modales emergentes cuando se detectan nuevos incidentes.

## Componentes

### 1. `useIncidentMonitor` (Hook)

Hook personalizado que consulta la base de datos cada minuto para detectar nuevos incidentes.

```typescript
import { useIncidentMonitor } from "@/app/hooks/useIncidentMonitor";

const {
  isMonitoring,
  lastCheck,
  error,
  activeIncidents,
  hasNewIncidents,
  startMonitoring,
  stopMonitoring,
  checkNow,
  markAsSeen,
  clearError,
} = useIncidentMonitor({
  apiBase: "/bff",
  intervalMs: 60000, // 1 minuto
  enabled: true,
  empresaId: 123,
  localidadId: 456,
  onIncidentDetected: (incident) => {
    console.log("Nuevo incidente detectado:", incident);
  },
});
```

#### Parámetros

- `apiBase`: URL base de la API (por defecto: "/bff")
- `intervalMs`: Intervalo de consulta en milisegundos (por defecto: 60000 = 1 minuto)
- `enabled`: Si el monitoreo está activo (por defecto: true)
- `empresaId`: ID de la empresa para filtrar incidentes
- `localidadId`: ID de la localidad para filtrar incidentes
- `onIncidentDetected`: Callback que se ejecuta cuando se detecta un nuevo incidente

#### Retorno

- `isMonitoring`: Estado del monitoreo
- `lastCheck`: Fecha de la última verificación
- `error`: Error actual si existe
- `activeIncidents`: Lista de incidentes activos
- `hasNewIncidents`: Si hay incidentes nuevos sin ver
- `startMonitoring()`: Iniciar monitoreo
- `stopMonitoring()`: Detener monitoreo
- `checkNow()`: Verificar incidentes manualmente
- `markAsSeen()`: Marcar incidentes como vistos
- `clearError()`: Limpiar error actual

### 2. `IncidentModal` (Componente)

Modal que muestra los detalles de un incidente y permite resolverlo, omitirlo o continuar.

```typescript
import { IncidentModal } from "@/app/Components/IncidentModal";

<IncidentModal
  incident={incident}
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  onResolve={(incident, comments) => {
    // Lógica para resolver incidente
  }}
  onSkip={(incident) => {
    // Lógica para omitir incidente
  }}
  onContinue={(incident) => {
    // Lógica para continuar
  }}
/>
```

### 3. `IncidentMonitor` (Componente)

Componente wrapper que integra el hook con el modal y maneja la lógica de la aplicación.

```typescript
import { IncidentMonitor } from "@/app/Components/IncidentModal";

<IncidentMonitor
  apiBase="/bff"
  intervalMs={60000}
  enabled={true}
  empresaId={123}
  localidadId={456}
  onIncidentResolved={(incident) => {
    console.log("Incidente resuelto:", incident);
  }}
  onIncidentSkipped={(incident) => {
    console.log("Incidente omitido:", incident);
  }}
  onIncidentContinued={(incident) => {
    console.log("Continuando con incidente:", incident);
  }}
/>
```

### 4. `IncidentNotification` (Componente)

Notificación emergente que aparece cuando se detecta un nuevo incidente.

```typescript
import { IncidentNotification } from "@/app/Components/IncidentModal";

<IncidentNotification
  incident={incident}
  onDismiss={() => setShowNotification(false)}
  onView={() => setShowModal(true)}
  autoHide={true}
  duration={10000} // 10 segundos
/>
```

## Uso Básico

### 1. Integración Simple

```typescript
import { IncidentMonitor } from "@/app/Components/IncidentModal";

function MyComponent() {
  return (
    <div>
      {/* Tu contenido aquí */}
      
      <IncidentMonitor
        empresaId={123}
        localidadId={456}
        onIncidentResolved={(incident) => {
          // Mostrar notificación de éxito
          toast.success("Incidente resuelto correctamente");
        }}
      />
    </div>
  );
}
```

### 2. Uso Avanzado con Hook Personalizado

```typescript
import { useIncidentMonitor } from "@/app/hooks/useIncidentMonitor";
import { IncidentModal, IncidentNotification } from "@/app/Components/IncidentModal";

function MyComponent() {
  const [currentIncident, setCurrentIncident] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  const {
    activeIncidents,
    hasNewIncidents,
    checkNow,
  } = useIncidentMonitor({
    empresaId: 123,
    localidadId: 456,
    onIncidentDetected: (incident) => {
      setCurrentIncident(incident);
      setShowNotification(true);
    },
  });

  return (
    <div>
      {/* Tu contenido aquí */}
      
      {showNotification && currentIncident && (
        <IncidentNotification
          incident={currentIncident}
          onDismiss={() => setShowNotification(false)}
          onView={() => {
            setShowNotification(false);
            setShowModal(true);
          }}
        />
      )}
      
      {showModal && currentIncident && (
        <IncidentModal
          incident={currentIncident}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onResolve={(incident, comments) => {
            // Lógica para resolver
            setShowModal(false);
          }}
          onSkip={(incident) => {
            // Lógica para omitir
            setShowModal(false);
          }}
          onContinue={(incident) => {
            // Lógica para continuar
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
```

## Características

### ✅ Monitoreo Automático
- Consulta la base de datos cada minuto
- Solo ejecuta cuando la pestaña está visible
- Detección automática de nuevos incidentes

### ✅ Modal Emergente
- Interfaz intuitiva para manejar incidentes
- Timer de urgencia (10 minutos)
- Opciones para resolver, omitir o continuar
- Información detallada del incidente

### ✅ Notificaciones
- Notificaciones emergentes para nuevos incidentes
- Auto-hide configurable
- Botones de acción rápida

### ✅ Integración Flexible
- Fácil integración con componentes existentes
- Callbacks personalizables
- Filtros por empresa y localidad

### ✅ Manejo de Errores
- Gestión robusta de errores de red
- Reintentos automáticos
- Estados de error claros

## Configuración

### Variables de Entorno

```env
# Base URL de la API (opcional, por defecto: "/bff")
NEXT_PUBLIC_API_BASE_URL=/bff

# Intervalo de monitoreo en milisegundos (opcional, por defecto: 60000)
NEXT_PUBLIC_INCIDENT_MONITOR_INTERVAL=60000
```

### Personalización

Puedes personalizar el comportamiento modificando los valores por defecto en el hook:

```typescript
const monitor = useIncidentMonitor({
  intervalMs: 30000, // 30 segundos
  enabled: process.env.NODE_ENV === "production",
  // ... otros parámetros
});
```

## API Esperada

El hook espera que la API responda con el siguiente formato:

```typescript
// GET /bff/incidentes?estado=ABIERTO&empresaId=123&localidadId=456
{
  "success": true,
  "data": [
    {
      "id": 123,
      "descripcion": "Descripción del incidente",
      "estado": "ABIERTO",
      "fechaInicio": "2024-01-01T10:00:00Z",
      "movimiento": {
        "empresa": { "nombre": "Empresa ABC" },
        "locomotiveNumber": "12345",
        "viaOrigen": { "nombre": "Vía 1" },
        "viaDestino": { "nombre": "Vía 2" }
      }
    }
  ]
}
```

## Troubleshooting

### El monitoreo no se inicia
- Verifica que `enabled` sea `true`
- Asegúrate de que `empresaId` y `localidadId` estén definidos
- Revisa la consola para errores de red

### Los incidentes no se muestran
- Verifica que la API esté respondiendo correctamente
- Revisa los filtros de empresa y localidad
- Asegúrate de que los incidentes tengan estado "ABIERTO"

### Errores de autenticación
- Verifica que el token esté presente en las cookies
- Asegúrate de que la API esté configurada correctamente
