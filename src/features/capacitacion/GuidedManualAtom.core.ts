/* eslint-disable @typescript-eslint/no-explicit-any */
export type GuidedManualMode = 'guide' | 'wizard';
export type GuidedManualStepTone = 'default' | 'info' | 'warning' | 'critical' | 'success';

export type GuidedManualAction = {
  type: 'event' | 'click';
  eventName?: string;
  selector?: string;
  detail?: Record<string, any>;
  delayMs?: number;
};

export type GuidedManualActionRunner = (action: GuidedManualAction) => number | void;

export type GuidedManualTrackingOptions = {
  mutations?: boolean;
  resize?: boolean;
  transitions?: boolean;
  autoScrollWhenHidden?: boolean;
  mutationDebounceMs?: number;
};

export type GuidedManualTransitionOptions = {
  waitForTarget?: boolean;
  targetStableMs?: number;
  targetTimeoutMs?: number;
};

export type GuidedManualCondition =
  | (() => boolean)
  | {
      type: 'context';
      key: string;
      equals?: unknown;
      notEquals?: unknown;
      exists?: boolean;
      includes?: unknown;
    }
  | {
      type: 'selector';
      selector: string;
      exists?: boolean;
    }
  | {
      type: 'target';
      targetId: string;
      exists?: boolean;
    }
  | {
      type: 'all' | 'any';
      conditions: GuidedManualCondition[];
    }
  | {
      type: 'not';
      condition: GuidedManualCondition;
    };

export type GuidedManualStep = {
  id: string;
  /** Etiqueta corta para agrupar pasos largos (p. ej. Dashboard o Movimientos). */
  chapter?: string;
  title: string;
  description: string;
  targetId?: string;
  selector?: string;
  when?: GuidedManualCondition;
  mode?: GuidedManualMode;
  tone?: GuidedManualStepTone;
  icon?: string;
  customTitleColor?: string;
  customTitleSize?: number | string;
  customDescriptionColor?: string;
  customDescriptionSize?: number | string;
  confirmation?: {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    tone?: GuidedManualStepTone;
    icon?: string;
    customTitleColor?: string;
    customTitleSize?: number | string;
    customDescriptionColor?: string;
    customDescriptionSize?: number | string;
    confirmDelaySeconds?: number;
  };
  actionOnEnter?: GuidedManualAction;
  actionOnNext?: GuidedManualAction;
  actionOnPrevious?: GuidedManualAction;
  /**
   * Convierte el objetivo resaltado en el control de avance del paso.
   * El usuario debe pulsar el elemento real de la aplicacion; el boton
   * "Siguiente" del panel se reemplaza por una indicacion visual.
   */
  advanceOnTargetClick?: boolean;
  hidePrevious?: boolean;
  disablePrevious?: boolean;
  disableAppElements?: string[];
};

export type GuidedManualToneAppearance = {
  panelBg?: string;
  panelBorder?: string;
  accent?: string;
  textMain?: string;
  textMuted?: string;
  buttonPrimaryBg?: string;
};

export type GuidedManualDefinition = {
  id: string;
  title?: string;
  disableAppElements?: string[];
  steps: GuidedManualStep[];
};

export type GuidedManualLauncherState = {
  canStart: boolean;
  title: string;
  start: (index?: number) => void;
};

export type GuidedManualAppearance = {
  mode?: 'light' | 'dark';
  colors?: {
    overlay?: string;
    panelBg?: string;
    panelBorder?: string;
    accent?: string;
    textMain?: string;
    textMuted?: string;
    buttonBg?: string;
    buttonPrimaryBg?: string;
  };
  layout?: {
    spotlightPadding?: number;
    spotlightRadius?: number;
    spotlightBorderWidth?: number;
    panelWidth?: number;
    panelPadding?: number;
    panelRadius?: number;
    panelGap?: number;
    controlHeight?: number;
  };
  typography?: {
    fontFamily?: string;
    titleSize?: number;
    descriptionSize?: number;
  };
  effects?: {
    panelShadow?: string;
    panelBackdropFilter?: string;
    transition?: string;
  };
  stepTones?: Partial<Record<GuidedManualStepTone, GuidedManualToneAppearance>>;
};

export const defaultGuidedManualAppearance: Required<{
  colors: Required<NonNullable<GuidedManualAppearance['colors']>>;
  layout: Required<NonNullable<GuidedManualAppearance['layout']>>;
  typography: Required<NonNullable<GuidedManualAppearance['typography']>>;
  effects: Required<NonNullable<GuidedManualAppearance['effects']>>;
}> & {
  mode: 'dark';
  stepTones: Record<GuidedManualStepTone, Required<GuidedManualToneAppearance>>;
} = {
  mode: 'dark',
  colors: {
    overlay: 'rgba(2, 6, 23, 0.72)',
    panelBg: 'rgba(15, 23, 42, 0.94)',
    panelBorder: 'rgba(148, 163, 184, 0.26)',
    accent: '#22d3ee',
    textMain: '#f8fafc',
    textMuted: '#cbd5e1',
    buttonBg: 'rgba(255, 255, 255, 0.08)',
    buttonPrimaryBg: 'rgba(34, 211, 238, 0.22)',
  },
  layout: {
    spotlightPadding: 4,
    spotlightRadius: 16,
    spotlightBorderWidth: 2,
    panelWidth: 320,
    panelPadding: 16,
    panelRadius: 16,
    panelGap: 14,
    controlHeight: 34,
  },
  typography: {
    fontFamily: "'Space Grotesk', 'Sora', system-ui, sans-serif",
    titleSize: 16,
    descriptionSize: 14,
  },
  effects: {
    panelShadow: '0 24px 80px rgba(0, 0, 0, 0.36)',
    panelBackdropFilter: 'blur(8px)',
    transition: 'top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease',
  },
  stepTones: {
    default: {
      panelBg: 'rgba(15, 23, 42, 0.94)',
      panelBorder: 'rgba(148, 163, 184, 0.26)',
      accent: '#22d3ee',
      textMain: '#f8fafc',
      textMuted: '#cbd5e1',
      buttonPrimaryBg: 'rgba(34, 211, 238, 0.22)',
    },
    info: {
      panelBg: 'rgba(14, 30, 58, 0.96)',
      panelBorder: 'rgba(96, 165, 250, 0.42)',
      accent: '#60a5fa',
      textMain: '#eff6ff',
      textMuted: '#bfdbfe',
      buttonPrimaryBg: 'rgba(96, 165, 250, 0.24)',
    },
    warning: {
      panelBg: 'rgba(66, 42, 8, 0.96)',
      panelBorder: 'rgba(245, 158, 11, 0.5)',
      accent: '#f59e0b',
      textMain: '#fff7ed',
      textMuted: '#fed7aa',
      buttonPrimaryBg: 'rgba(245, 158, 11, 0.26)',
    },
    critical: {
      panelBg: 'rgba(69, 10, 10, 0.97)',
      panelBorder: 'rgba(248, 113, 113, 0.62)',
      accent: '#f87171',
      textMain: '#fff1f2',
      textMuted: '#fecdd3',
      buttonPrimaryBg: 'rgba(248, 113, 113, 0.28)',
    },
    success: {
      panelBg: 'rgba(5, 46, 22, 0.96)',
      panelBorder: 'rgba(52, 211, 153, 0.48)',
      accent: '#34d399',
      textMain: '#ecfdf5',
      textMuted: '#bbf7d0',
      buttonPrimaryBg: 'rgba(52, 211, 153, 0.24)',
    },
  },
};

export const resolveGuidedManualAppearance = (appearance?: GuidedManualAppearance) => ({
  mode: appearance?.mode ?? defaultGuidedManualAppearance.mode,
  colors: {
    ...defaultGuidedManualAppearance.colors,
    ...(appearance?.colors || {}),
  },
  layout: {
    ...defaultGuidedManualAppearance.layout,
    ...(appearance?.layout || {}),
  },
  typography: {
    ...defaultGuidedManualAppearance.typography,
    ...(appearance?.typography || {}),
  },
  effects: {
    ...defaultGuidedManualAppearance.effects,
    ...(appearance?.effects || {}),
  },
  stepTones: {
    ...defaultGuidedManualAppearance.stepTones,
    ...(Object.fromEntries(
      Object.entries(appearance?.stepTones || {}).map(([tone, values]) => [
        tone,
        {
          ...defaultGuidedManualAppearance.stepTones[tone as GuidedManualStepTone],
          ...(values || {}),
        },
      ])
    ) as Partial<Record<GuidedManualStepTone, Required<GuidedManualToneAppearance>>>),
  },
});

export const clampGuidedManualValue = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export type GuidedManualRectLike = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

export type GuidedManualPanelPlacement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  docked: 'none' | 'top' | 'right' | 'bottom' | 'left';
};

/**
 * Coloca el panel en una franja libre del viewport. Las franjas laterales se
 * pueden hacer mas angostas y las verticales mas bajas (con scroll interno),
 * pero nunca se elige una candidata que invada el rectangulo resaltado.
 * Cuando el objetivo ocupa practicamente toda la pantalla no existe una
 * solucion geometrica: en ese caso se usa una bandeja inferior y el spotlight
 * se recorta antes de la bandeja en la capa web.
 */
export const resolveGuidedManualPanelPlacement = ({
  viewportWidth,
  viewportHeight,
  panelWidth,
  panelHeight,
  target,
  margin = 12,
  gap = 12,
}: {
  viewportWidth: number;
  viewportHeight: number;
  panelWidth: number;
  panelHeight: number;
  target?: GuidedManualRectLike | null;
  margin?: number;
  gap?: number;
}): GuidedManualPanelPlacement => {
  const availableWidth = Math.max(1, viewportWidth - margin * 2);
  const availableHeight = Math.max(1, viewportHeight - margin * 2);
  const desiredWidth = Math.min(Math.max(1, panelWidth), availableWidth);
  const desiredHeight = Math.min(Math.max(1, panelHeight), availableHeight);

  if (!target) {
    return {
      top: margin + Math.max(0, (availableHeight - desiredHeight) / 2),
      left: margin + Math.max(0, (availableWidth - desiredWidth) / 2),
      width: desiredWidth,
      maxHeight: availableHeight,
      docked: 'none',
    };
  }

  const clipped = {
    top: clampGuidedManualValue(target.top, margin, viewportHeight - margin),
    right: clampGuidedManualValue(target.right, margin, viewportWidth - margin),
    bottom: clampGuidedManualValue(target.bottom, margin, viewportHeight - margin),
    left: clampGuidedManualValue(target.left, margin, viewportWidth - margin),
  };
  const spaces = {
    top: Math.max(0, clipped.top - margin - gap),
    right: Math.max(0, viewportWidth - margin - clipped.right - gap),
    bottom: Math.max(0, viewportHeight - margin - clipped.bottom - gap),
    left: Math.max(0, clipped.left - margin - gap),
  };
  const minimumWidth = Math.min(208, availableWidth);
  const minimumHeight = Math.min(128, availableHeight);

  type Candidate = GuidedManualPanelPlacement & { area: number; full: boolean };
  const candidates: Candidate[] = [];
  const addVertical = (side: 'top' | 'bottom', space: number) => {
    if (space < minimumHeight) return;
    const maxHeight = space;
    const height = Math.min(desiredHeight, maxHeight);
    const left = clampGuidedManualValue(
      target.left + (target.width - desiredWidth) / 2,
      margin,
      Math.max(margin, viewportWidth - margin - desiredWidth)
    );
    candidates.push({
      top: side === 'top' ? clipped.top - gap - height : clipped.bottom + gap,
      left,
      width: desiredWidth,
      maxHeight,
      docked: side,
      area: desiredWidth * height,
      full: height >= desiredHeight,
    });
  };
  const addHorizontal = (side: 'left' | 'right', space: number) => {
    if (space < minimumWidth) return;
    const width = Math.min(desiredWidth, space);
    const top = clampGuidedManualValue(
      target.top + (target.height - desiredHeight) / 2,
      margin,
      Math.max(margin, viewportHeight - margin - desiredHeight)
    );
    candidates.push({
      top,
      left: side === 'left' ? clipped.left - gap - width : clipped.right + gap,
      width,
      maxHeight: availableHeight,
      docked: side,
      area: width * desiredHeight,
      full: width >= desiredWidth,
    });
  };

  addVertical('bottom', spaces.bottom);
  addVertical('top', spaces.top);
  addHorizontal('right', spaces.right);
  addHorizontal('left', spaces.left);

  const selected = candidates.sort((a, b) => {
    if (a.full !== b.full) return a.full ? -1 : 1;
    return b.area - a.area;
  })[0];
  if (selected) {
    return {
      top: selected.top,
      left: selected.left,
      width: selected.width,
      maxHeight: selected.maxHeight,
      docked: selected.docked,
    };
  }

  const dockHeight = Math.min(desiredHeight, Math.max(144, availableHeight * 0.42));
  return {
    top: viewportHeight - margin - dockHeight,
    left: margin,
    width: availableWidth,
    maxHeight: dockHeight,
    docked: 'bottom',
  };
};

export const normalizeGuidedManualId = (id: string) =>
  String(id || '').trim().toLowerCase();

export const normalizeGuidedManualSteps = (steps: unknown): GuidedManualStep[] => {
  if (!Array.isArray(steps)) return [];
  return steps
    .filter((step): step is Record<string, any> => Boolean(step && typeof step === 'object'))
    .map((step): GuidedManualStep => {
      const mode: GuidedManualMode = step.mode === 'wizard' ? 'wizard' : 'guide';
      return {
        ...step,
        id: String(step.id || '').trim(),
        chapter: step.chapter ? String(step.chapter).trim() : undefined,
        title: String(step.title || '').trim(),
        description: String(step.description || '').trim(),
        targetId: step.targetId ? String(step.targetId).trim() : undefined,
        selector: step.selector ? String(step.selector).trim() : undefined,
        mode,
      };
    })
    .filter((step) => Boolean(step.id && step.title && step.description));
};

export const normalizeGuidedManualDefinition = (
  definition: unknown
): GuidedManualDefinition | null => {
  if (!definition || typeof definition !== 'object') return null;
  const raw = definition as Record<string, any>;
  const id = normalizeGuidedManualId(raw.id);
  const steps = normalizeGuidedManualSteps(raw.steps);
  if (!id || !steps.length) return null;
  return {
    id,
    title: raw.title ? String(raw.title) : undefined,
    disableAppElements: Array.isArray(raw.disableAppElements) ? raw.disableAppElements.map(String) : undefined,
    steps,
  };
};

export const defineGuidedManual = <T extends GuidedManualDefinition>(definition: T): T =>
  definition;

export const createGuidedManualRegistry = (definitions: unknown[]) => {
  const manuals = definitions
    .map(normalizeGuidedManualDefinition)
    .filter((manual): manual is GuidedManualDefinition => Boolean(manual));
  const byId = new Map(manuals.map((manual) => [manual.id, manual]));

  return {
    list: () => manuals,
    get: (id: string) => byId.get(normalizeGuidedManualId(id)) ?? null,
    has: (id: string) => byId.has(normalizeGuidedManualId(id)),
  };
};

export const extractGuidedTargetIdFromSelector = (selector?: string) => {
  const value = String(selector || '').trim();
  if (!value) return '';
  const dataGuideMatch = value.match(/data-guide-id=['"]([^'"]+)['"]/);
  if (dataGuideMatch?.[1]) return dataGuideMatch[1];
  if (value.startsWith('#') && value.length > 1) return value.slice(1);
  return '';
};

export const toNativeGuidedManualSteps = (steps: GuidedManualStep[]) =>
  normalizeGuidedManualSteps(steps).map((step) => {
    const targetId = step.targetId || extractGuidedTargetIdFromSelector(step.selector);
    return {
      ...step,
      targetId: targetId || undefined,
      selector: undefined,
      actionOnEnter: step.actionOnEnter?.type === 'event' ? step.actionOnEnter : undefined,
      actionOnNext: step.actionOnNext?.type === 'event' ? step.actionOnNext : undefined,
    };
  });
