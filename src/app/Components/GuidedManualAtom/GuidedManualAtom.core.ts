export type GuidedManualMode = 'guide' | 'wizard';

export type GuidedManualAction = {
  type: 'event' | 'click';
  eventName?: string;
  selector?: string;
  detail?: Record<string, any>;
  delayMs?: number;
};

export type GuidedManualActionRunner = (action: GuidedManualAction) => number | void;

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

export type GuidedManualDefinition = {
  id: string;
  title?: string;
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
};

export const defaultGuidedManualAppearance: Required<{
  colors: Required<NonNullable<GuidedManualAppearance['colors']>>;
  layout: Required<NonNullable<GuidedManualAppearance['layout']>>;
  typography: Required<NonNullable<GuidedManualAppearance['typography']>>;
  effects: Required<NonNullable<GuidedManualAppearance['effects']>>;
}> & { mode: 'dark' } = {
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
});

export const clampGuidedManualValue = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

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
    steps,
  };
};

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
