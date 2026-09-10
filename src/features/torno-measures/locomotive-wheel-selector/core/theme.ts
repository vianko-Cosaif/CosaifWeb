import { LocomotiveWheelTheme, SelectorLabels, WheelVisualStatus } from './types';

export const DEFAULT_THEME: LocomotiveWheelTheme = {
  colors: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceMuted: '#F1F5F9',
    border: '#E2E8F0',
    primary: '#0B63CE',
    primarySoft: '#DBEAFE',
    success: '#16A34A',
    successSoft: '#DCFCE7',
    inProcess: '#0EA5E9',
    inProcessSoft: '#E0F2FE',
    warning: '#F59E0B',
    warningSoft: '#FEF3C7',
    danger: '#DC2626',
    dangerSoft: '#FEE2E2',
    disabled: '#94A3B8',
    disabledSoft: '#F3F4F6',
    text: '#0F172A',
    textMuted: '#64748B',
    rail: '#CBD5E1',
    machineStroke: '#475569',
    machineFill: '#F8FAFC',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
};

export const DEFAULT_LABELS: SelectorLabels = {
  title: 'Locomotora interactiva - vistas 2D',
  topView: 'Vista superior',
  leftView: 'Vista lateral izquierda',
  rightView: 'Vista lateral derecha',
  componentSelected: 'Componente seleccionado',
  noSelection: 'Selecciona una rueda',
  instructionsTitle: '¿Cómo usar?',
  instructions: 'Toque cualquier rueda para ver mediciones, estado y acciones disponibles.',
  legendTitle: 'Leyenda de estados',
  available: 'Disponible',
  selected: 'Seleccionado',
  warning: 'Advertencia',
  outOfRange: 'Fuera de rango',
  completed: 'Terminado',
  disabled: 'No disponible',
  inProcess: 'En proceso',
  viewMeasurements: 'Ver mediciones',
  startInspection: 'Iniciar inspección',
  changeComponent: 'Cambiar componente',
  wheelCountLabel: 'Ruedas torneables',
};

export function resolveTheme(theme?: Partial<LocomotiveWheelTheme>): LocomotiveWheelTheme {
  return {
    colors: {
      ...DEFAULT_THEME.colors,
      ...(theme?.colors ?? {}),
    },
    radius: {
      ...DEFAULT_THEME.radius,
      ...(theme?.radius ?? {}),
    },
  };
}

export function resolveLabels(labels?: Partial<SelectorLabels>): SelectorLabels {
  return {
    ...DEFAULT_LABELS,
    ...(labels ?? {}),
  };
}

export function getStatusStroke(theme: LocomotiveWheelTheme, status: WheelVisualStatus): string {
  switch (status) {
    case 'selected':
      return theme.colors.primary;
    case 'warning':
      return theme.colors.warning;
    case 'outOfRange':
      return theme.colors.danger;
    case 'completed':
      return theme.colors.success;
    case 'inProcess':
      return theme.colors.inProcess;
    case 'disabled':
      return theme.colors.disabled;
    case 'available':
    default:
      return theme.colors.rail;
  }
}

export function getStatusFill(theme: LocomotiveWheelTheme, status: WheelVisualStatus): string {
  switch (status) {
    case 'selected':
      return theme.colors.primarySoft;
    case 'warning':
      return theme.colors.warningSoft;
    case 'outOfRange':
      return theme.colors.dangerSoft;
    case 'completed':
      return theme.colors.successSoft;
    case 'inProcess':
      return theme.colors.inProcessSoft;
    case 'disabled':
      return theme.colors.disabledSoft;
    case 'available':
    default:
      return theme.colors.surface;
  }
}

export function getStatusLabel(labels: SelectorLabels, status: WheelVisualStatus): string {
  switch (status) {
    case 'selected':
      return labels.selected;
    case 'warning':
      return labels.warning;
    case 'outOfRange':
      return labels.outOfRange;
    case 'completed':
      return labels.completed;
    case 'inProcess':
      return labels.inProcess;
    case 'disabled':
      return labels.disabled;
    case 'available':
    default:
      return labels.available;
  }
}
