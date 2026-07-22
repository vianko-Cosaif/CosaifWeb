export type WheelCount = 4 | 6 | 8 | 12;

export type LocomotiveViewMode = 'top' | 'left' | 'right';

export type WheelSide = 'left' | 'right';

export type WheelStatus =
  | 'available'
  | 'inProcess'
  | 'warning'
  | 'outOfRange'
  | 'completed'
  | 'disabled';

export type WheelVisualStatus = WheelStatus | 'selected';

export interface WheelData {
  id: string;
  axleIndex: number;
  side: WheelSide;
  label: string;
  status: WheelStatus;
  diameter?: number;
  targetDiameter?: number;
  wear?: number;
  profile?: string;
  lastMeasurement?: string;
  observations?: string;
  metadata?: Record<string, unknown>;
}

export interface WheelPoint extends WheelData {
  x: number;
  y: number;
  radius: number;
  visible: boolean;
  visualStatus: WheelVisualStatus;
}

export interface WheelOverride extends Partial<Omit<WheelData, 'id' | 'axleIndex' | 'side' | 'label' | 'status'>> {
  id: string;
  status?: WheelStatus;
  label?: string;
}

export interface LocomotiveWheelTheme {
  colors: {
    background: string;
    surface: string;
    surfaceMuted: string;
    border: string;
    primary: string;
    primarySoft: string;
    success: string;
    successSoft: string;
    inProcess: string;
    inProcessSoft: string;
    warning: string;
    warningSoft: string;
    danger: string;
    dangerSoft: string;
    disabled: string;
    disabledSoft: string;
    text: string;
    textMuted: string;
    rail: string;
    machineStroke: string;
    machineFill: string;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
}

export interface SelectorLabels {
  title: string;
  topView: string;
  leftView: string;
  rightView: string;
  componentSelected: string;
  noSelection: string;
  instructionsTitle: string;
  instructions: string;
  legendTitle: string;
  available: string;
  selected: string;
  warning: string;
  outOfRange: string;
  completed: string;
  disabled: string;
  inProcess: string;
  viewMeasurements: string;
  startInspection: string;
  changeComponent: string;
  wheelCountLabel: string;
}

export interface LocomotiveWheelSelectorBaseProps {
  wheelCount?: WheelCount;
  defaultWheelCount?: WheelCount;
  viewMode?: LocomotiveViewMode;
  defaultViewMode?: LocomotiveViewMode;
  selectedWheelId?: string;
  defaultSelectedWheelId?: string;
  wheels?: WheelOverride[];
  disabled?: boolean;
  showWheelCountSwitcher?: boolean;
  showViewSwitcher?: boolean;
  showLegend?: boolean;
  showInstructions?: boolean;
  title?: string;
  orderCode?: string;
  operatorName?: string;
  theme?: Partial<LocomotiveWheelTheme>;
  labels?: Partial<SelectorLabels>;
  orientation?: 'vertical' | 'horizontal';
  onWheelSelect?: (wheel: WheelData) => void;
  onViewModeChange?: (viewMode: LocomotiveViewMode) => void;
  onWheelCountChange?: (wheelCount: WheelCount) => void;
}

export interface LocomotiveMapProps {
  wheelCount: WheelCount;
  viewMode: LocomotiveViewMode;
  selectedWheelId?: string;
  wheels?: WheelOverride[];
  disabled?: boolean;
  theme?: Partial<LocomotiveWheelTheme>;
  labels?: Partial<SelectorLabels>;
  showLabels?: boolean;
  orientation?: 'vertical' | 'horizontal';
  onWheelSelect?: (wheel: WheelData) => void;
}
