import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import guidedShared from './GuidedManualAtom.shared.json';
import {
  createGuidedManualTargetInteractionCss,
  createGuidedManualWebStyles,
  getGuidedManualAtomWebJsx0Style,
  getGuidedManualAtomWebJsx1Style,
} from './GuidedManualAtom.web.styles';
import {
  clampGuidedManualValue,
  createGuidedManualRegistry,
  normalizeGuidedManualSteps,
  resolveGuidedManualPanelPlacement,
  type GuidedManualAction,
  type GuidedManualActionRunner,
  type GuidedManualAppearance,
  type GuidedManualCondition,
  type GuidedManualDefinition,
  type GuidedManualStep,
  type GuidedManualTrackingOptions,
  type GuidedManualTransitionOptions,
} from './GuidedManualAtom.core';

type GuidedManualStateContextValue = {
  steps: GuidedManualStep[];
  isOpen: boolean;
  currentIndex: number;
  currentStep: GuidedManualStep | null;
  totalSteps: number;
  targetsVersion: number;
  isTransitioning: boolean;
  transitionError: string | null;
  context: Record<string, unknown>;

  globalDisableAppElements: string[];

};

type GuidedManualApiContextValue = {
  start: (index?: number) => void;
  startManual: (id: string, index?: number) => void;
  startWithSteps: (steps: GuidedManualStep[], index?: number) => void;
  close: () => void;
  next: () => void;
  prev: () => void;
  registerTarget: (id: string, node: HTMLElement | null) => void;
  unregisterTarget: (id: string) => void;
  getTarget: (id: string) => HTMLElement | null;

  checkAutoAdvance: () => boolean;
  isStepApplicable: (step?: GuidedManualStep | null) => boolean;
  isStepReady: (step?: GuidedManualStep | null) => boolean;
  setContext: (key: string, value: unknown) => void;
  mergeContext: (patch: Record<string, unknown>) => void;
  clearContext: (prefix?: string) => void;
  getContext: (key?: string) => unknown;
  refreshLayout: () => void;

};

const GuidedManualStateContext = createContext<GuidedManualStateContextValue | null>(null);
const GuidedManualApiContext = createContext<GuidedManualApiContextValue | null>(null);

export type GuidedManualButtonTone = 'primary' | 'neutral';

export type GuidedManualWebButtonProps = {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  iconOnly?: boolean;
  tone?: GuidedManualButtonTone;
  size?: 'sm' | 'icon';
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  onPress?: () => void;
  ariaLabel?: string;
  title?: string;
};

export type GuidedManualWebSlots = {
  Button?: React.ComponentType<GuidedManualWebButtonProps>;
};

export type GuidedManualCopy = Partial<typeof guidedShared.copy>;
export type GuidedManualIcons = Partial<typeof guidedShared.icons>;

type GuidedManualConfigContextValue = {
  slots: Required<GuidedManualWebSlots>;
  copy: typeof guidedShared.copy;
  icons: typeof guidedShared.icons;
  appearance?: GuidedManualAppearance;
  tracking: Required<GuidedManualTrackingOptions>;
  transition: Required<GuidedManualTransitionOptions>;
};

const defaultGuidedManualTracking: Required<GuidedManualTrackingOptions> = {
  mutations: false,
  resize: true,
  transitions: false,
  autoScrollWhenHidden: true,

  mutationDebounceMs: 40,

};

const defaultGuidedManualTransition: Required<GuidedManualTransitionOptions> = {
  waitForTarget: true,
  targetStableMs: 120,
  targetTimeoutMs: 5_000,
};

const getGuidedContextValue = (source: Record<string, unknown>, key?: string) => {
  if (!key) return source;
  if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
  return key.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, segment)) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source);
};

const isGuidedContextEqual = (a: unknown, b: unknown) => {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (!a || !b || typeof a !== 'object') return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

const isRenderedGuidedTarget = (node: Element): node is HTMLElement => {
  if (!(node instanceof HTMLElement) || !node.isConnected) return false;
  const styles = window.getComputedStyle(node);
  const rect = node.getBoundingClientRect();
  return (
    styles.display !== 'none' &&
    styles.visibility !== 'hidden' &&
    Number(styles.opacity || 1) > 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
};

const isGuidedTargetInViewport = (node: HTMLElement) => {
  const rect = node.getBoundingClientRect();
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
};

const resolveVisibleSelectorNode = (selector: string): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  const nodes = Array.from(document.querySelectorAll(selector));
  return nodes.find((node): node is HTMLElement => (
    isRenderedGuidedTarget(node) && isGuidedTargetInViewport(node)
  )) ??
    nodes.find(isRenderedGuidedTarget) ??
    null;
};

const resolveInteractiveControl = (node: HTMLElement | null) => {
  if (!node) return null;
  if (node.matches('button, input, select, textarea, [role="button"]')) return node;
  return node.querySelector<HTMLElement>('button, input, select, textarea, [role="button"]');
};

const isUnavailableControl = (node: HTMLElement | null) => Boolean(
  node?.matches(':disabled, [aria-disabled="true"], [data-disabled="true"]')
);

const parseMissionCopy = (value: string) => {
  const lines = value.split('\n').map((line) => line.trim()).filter(Boolean);
  const take = (prefix: string) => lines
    .find((line) => line.toLocaleLowerCase('es-MX').startsWith(prefix))
    ?.slice(prefix.length)
    .trim()
    .replace(/\.$/, '');
  const look = take('qué ves:');
  const action = take('haz esto:');
  const result = take('qué pasará:');
  return look && action && result ? { look, action, result } : null;
};

const focusFirstIncompleteField = (stepNode: HTMLElement | null) => {
  const explicitInvalidField = stepNode?.querySelector<HTMLElement>(
    ':invalid, [aria-invalid="true"], [data-validation-error="true"]'
  );
  const emptyTextField = Array.from(stepNode?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input:not(:disabled):not([readonly]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea:not(:disabled):not([readonly])'
  ) ?? []).find((field) => !field.value.trim());
  const unopenedChoice = stepNode?.querySelector<HTMLElement>(
    'button[aria-expanded="false"]:not(:disabled)'
  );
  const invalidField = explicitInvalidField ?? emptyTextField ?? unopenedChoice;
  invalidField?.focus({ preventScroll: true });
  invalidField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const BasicGuidedManualWebButton = ({
  children,
  icon,
  iconOnly,
  tone = 'neutral',
  size = 'sm',
  type = 'button',
  className,
  style,
  disabled,
  onPress,
  ariaLabel,
  title,
}: GuidedManualWebButtonProps) => {
  const isPrimary = tone === 'primary';
  const isIcon = size === 'icon' || iconOnly;
  return (
    <button
      type={type}
      className={className}
      disabled={disabled}
      onClick={onPress}
      aria-label={ariaLabel}
      title={title}
      style={{
        minWidth: isIcon ? 34 : 40,
        minHeight: 34,
        padding: isIcon ? 0 : '0 12px',
        borderRadius: 999,
        border: '1px solid rgba(148, 163, 184, 0.35)',
        background: isPrimary ? 'rgba(34, 211, 238, 0.22)' : 'rgba(255, 255, 255, 0.08)',
        color: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontWeight: 800,
        lineHeight: 1,
        ...style,
      }}
    >
      {icon ?? children}
    </button>
  );
};

const defaultGuidedManualWebSlots: Required<GuidedManualWebSlots> = {
  Button: BasicGuidedManualWebButton,
};

const GuidedManualConfigContext = createContext<GuidedManualConfigContextValue>({
  slots: defaultGuidedManualWebSlots,
  copy: guidedShared.copy,
  icons: guidedShared.icons,
  appearance: undefined,
  tracking: defaultGuidedManualTracking,
  transition: defaultGuidedManualTransition,
});

const useGuidedManualConfig = () => useContext(GuidedManualConfigContext);

type GuidedManualProviderProps = {
  steps?: GuidedManualStep[];
  manuals?: GuidedManualDefinition[];
  defaultManualId?: string;
  children: React.ReactNode;
  startOpen?: boolean;
  initialStep?: number;
  actionRunner?: GuidedManualActionRunner;
  slots?: GuidedManualWebSlots;
  copy?: GuidedManualCopy;
  icons?: GuidedManualIcons;
  appearance?: GuidedManualAppearance;
  tracking?: GuidedManualTrackingOptions;
  transition?: GuidedManualTransitionOptions;
};

export const GuidedManualProvider = ({
  steps = [],
  manuals = [],
  defaultManualId,
  children,
  startOpen = false,
  initialStep = 0,
  actionRunner,
  slots,
  copy,
  icons,
  appearance,
  tracking,
  transition,
}: GuidedManualProviderProps) => {
  const manualRegistry = useMemo(() => createGuidedManualRegistry(manuals), [manuals]);

  const activeManual = useMemo(() => {
    if (steps.length) return null;
    return defaultManualId
      ? manualRegistry.get(defaultManualId)
      : manualRegistry.list()[0] ?? null;
  }, [defaultManualId, manualRegistry, steps]);

  const configuredDefaultSteps = useMemo(() => {
    if (steps.length) return normalizeGuidedManualSteps(steps);
    return activeManual?.steps ?? [];
  }, [steps, activeManual]);

  const globalDisableAppElements = useMemo(
    () => activeManual?.disableAppElements ?? [],
    [activeManual]
  );


  const [manualSteps, setManualSteps] = useState<GuidedManualStep[]>(configuredDefaultSteps);
  const defaultStepsRef = useRef<GuidedManualStep[]>(configuredDefaultSteps);
  const [isCustomSteps, setIsCustomSteps] = useState(false);
  const [isOpen, setIsOpen] = useState(startOpen);
  const [currentIndex, setCurrentIndex] = useState(initialStep);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const targetsRef = useRef<Map<string, HTMLElement>>(new Map());
  const isOpenRef = useRef(isOpen);
  const currentStepRef = useRef<GuidedManualStep | null>(null);
  const [targetsVersion, setTargetsVersion] = useState(0);
  const [manualContext, setManualContextState] = useState<Record<string, unknown>>({});
  const transitionRequestRef = useRef(0);
  const waitListenersRef = useRef<Set<() => void>>(new Set());

  const autoAdvanceTimerRef = useRef<number | null>(null);

  const resolvedTransition = useMemo(
    () => ({ ...defaultGuidedManualTransition, ...(transition || {}) }),
    [transition]
  );

  const runAction = useCallback((action?: GuidedManualAction | null) => {
    if (!action) return 0;
    const delayMs = Math.max(0, Number(action.delayMs || 0));
    const customDelay = actionRunner?.(action);
    if (typeof customDelay === 'number') return Math.max(0, customDelay);
    if (actionRunner || typeof window === 'undefined') return delayMs;
    const execute = () => {
      if (action.type === 'event' && action.eventName) {
        window.dispatchEvent(new CustomEvent(action.eventName, { detail: action.detail || {} }));
      }
      if (action.type === 'click' && action.selector) {
        const node = document.querySelector(action.selector) as HTMLElement | null;

        if (node) {
          const originalPointerEvents = node.style.getPropertyValue('pointer-events');
          const originalPriority = node.style.getPropertyPriority('pointer-events');
          const originalInternalAction = node.getAttribute('data-guide-internal-action');
          node.style.setProperty('pointer-events', 'auto', 'important');

          node.setAttribute('data-guide-internal-action', 'true');
          try {
            node.click();
          } finally {
            if (originalInternalAction === null) node.removeAttribute('data-guide-internal-action');
            else node.setAttribute('data-guide-internal-action', originalInternalAction);
          }

          if (originalPointerEvents) {
            node.style.setProperty('pointer-events', originalPointerEvents, originalPriority);
          } else {
            node.style.removeProperty('pointer-events');
          }
        }

      }
    };
    if (delayMs > 0) {
      window.setTimeout(execute, delayMs);
      return delayMs;
    }
    execute();
    return 0;
  }, [actionRunner]);

  useEffect(() => {
    defaultStepsRef.current = configuredDefaultSteps;
    // Avoid overriding a custom manual while it is running.
    if (!isCustomSteps && !isOpen) {
      setManualSteps(configuredDefaultSteps);
    }
  }, [configuredDefaultSteps, isCustomSteps, isOpen]);

  const totalSteps = manualSteps.length;
  const currentStep = useMemo(
    () => (totalSteps > 0 ? manualSteps[Math.min(currentIndex, totalSteps - 1)] : null),
    [manualSteps, currentIndex, totalSteps]
  );
  isOpenRef.current = isOpen;
  currentStepRef.current = currentStep;
  const refreshLayout = useCallback(() => {
    if (!isOpenRef.current) return;
    setTargetsVersion((prevValue) => prevValue + 1);
    waitListenersRef.current.forEach((listener) => listener());
  }, []);

  const mergeContext = useCallback((patch: Record<string, unknown>) => {
    setManualContextState((current) => {
      let changed = false;
      const nextContext = { ...current };
      Object.entries(patch).forEach(([key, value]) => {
        if (!isGuidedContextEqual(nextContext[key], value)) {
          nextContext[key] = value;
          changed = true;
        }
      });
      return changed ? nextContext : current;
    });
    refreshLayout();
  }, [refreshLayout]);

  const setContext = useCallback((key: string, value: unknown) => {
    mergeContext({ [key]: value });
  }, [mergeContext]);

  const clearContext = useCallback((prefix?: string) => {
    setManualContextState((current) => {
      if (!prefix) return {};
      let changed = false;
      const nextContext: Record<string, unknown> = {};
      Object.entries(current).forEach(([key, value]) => {
        if (key === prefix || key.startsWith(`${prefix}.`)) {
          changed = true;
          return;
        }
        nextContext[key] = value;
      });
      return changed ? nextContext : current;
    });
    refreshLayout();
  }, [refreshLayout]);

  const getContext = useCallback((key?: string) => getGuidedContextValue(manualContext, key), [manualContext]);

  const evaluateCondition = useCallback((condition?: GuidedManualCondition): boolean => {
    if (!condition) return true;
    try {
      if (typeof condition === 'function') return Boolean(condition());
      if (condition.type === 'context') {
        const value = getGuidedContextValue(manualContext, condition.key);
        const exists = value !== undefined && value !== null && value !== '';
        if (typeof condition.exists === 'boolean' && condition.exists !== exists) return false;
        if ('equals' in condition && !isGuidedContextEqual(value, condition.equals)) return false;
        if ('notEquals' in condition && isGuidedContextEqual(value, condition.notEquals)) return false;
        if ('includes' in condition) {
          if (Array.isArray(value)) return value.some((item) => isGuidedContextEqual(item, condition.includes));
          if (typeof value === 'string') return typeof condition.includes === 'string' && value.includes(condition.includes);
          return false;
        }
        return true;
      }
      if (condition.type === 'selector') {
        const exists = typeof document !== 'undefined' && Boolean(document.querySelector(condition.selector));
        return condition.exists === false ? !exists : exists;
      }
      if (condition.type === 'target') {
        const exists = Boolean(targetsRef.current.get(condition.targetId)?.isConnected);
        return condition.exists === false ? !exists : exists;
      }
      if (condition.type === 'not') return !evaluateCondition(condition.condition);
      const values = condition.conditions.map(evaluateCondition);
      return condition.type === 'all' ? values.every(Boolean) : values.some(Boolean);
    } catch {
      return false;
    }
  }, [manualContext]);
  const isStepApplicable = useCallback(
    (step?: GuidedManualStep | null) => evaluateCondition(step?.when),
    [evaluateCondition]
  );


  const isStepReady = useCallback((step?: GuidedManualStep | null) => {
    if (!step) return false;
    if (!evaluateCondition(step.when)) return false;

    if (step.selector) {
      return typeof document !== 'undefined' && !!document.querySelector(step.selector);
    } else if (step.targetId) {
      return !!targetsRef.current.get(step.targetId)?.isConnected;
    }
    return true;
  }, [evaluateCondition]);

  const checkAutoAdvance = useCallback(() => {
    if (!isOpen || isTransitioning) return false;

    const currentStep = manualSteps[currentIndex];
    // Un objetivo que tarda en aparecer no autoriza saltar a cualquier otro
    // paso listo. Solo omitimos el paso actual cuando su condicion `when`
    // dejo de aplicar; así el avance siempre es determinista.
    if (!currentStep || isStepApplicable(currentStep)) return false;
    const nextApplicable = manualSteps.findIndex(
      (step, index) => index > currentIndex && isStepApplicable(step)
    );

    if (nextApplicable >= 0) {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        autoAdvanceTimerRef.current = null;
        setCurrentIndex(nextApplicable);
      }, 120);
      return true;
    }
    return false;
  }, [isOpen, isStepApplicable, isTransitioning, manualSteps, currentIndex]);


  const applicableIndexes = useMemo(
    () => {
      void targetsVersion;
      return manualSteps
        .map((step, index) => ({ step, index }))
        .filter(({ step, index }) => index === currentIndex || isStepApplicable(step))
        .map(({ index }) => index);
    },
    [currentIndex, isStepApplicable, manualSteps, targetsVersion]
  );
  const visibleStepIndex = Math.max(0, applicableIndexes.indexOf(currentIndex));
  const visibleTotalSteps = Math.max(1, applicableIndexes.length);

  const start = useCallback(
    (index = 0) => {
      if (!manualSteps.length) return;
      transitionRequestRef.current += 1;
      setIsTransitioning(false);
      setTransitionError(null);
      setCurrentIndex(Math.min(Math.max(index, 0), manualSteps.length - 1));
      setIsOpen(true);
    },
    [manualSteps]
  );

  const startWithSteps = useCallback(
    (nextSteps: GuidedManualStep[], index = 0) => {
      const safeSteps = normalizeGuidedManualSteps(nextSteps);
      if (!safeSteps.length) return;
      transitionRequestRef.current += 1;
      setIsTransitioning(false);
      setTransitionError(null);
      setIsCustomSteps(true);
      setManualSteps(safeSteps);
      setCurrentIndex(Math.min(Math.max(index, 0), safeSteps.length - 1));
      setIsOpen(true);
    },
    []
  );

  const close = useCallback(() => {
    transitionRequestRef.current += 1;
    setIsTransitioning(false);
    setTransitionError(null);
    setIsOpen(false);
    if (isCustomSteps) {
      setIsCustomSteps(false);
      setManualSteps(defaultStepsRef.current);
      setCurrentIndex(0);
    }
  }, [isCustomSteps]);

  const resolveStepNode = useCallback((step?: GuidedManualStep | null) => {
    if (!step || typeof document === 'undefined') return null;
    if (step.selector) {
      const selected = resolveVisibleSelectorNode(step.selector);
      if (selected) return selected;
    }
    return step.targetId ? targetsRef.current.get(step.targetId) ?? null : null;
  }, []);

  const isStepNodeVisible = useCallback((step?: GuidedManualStep | null) => {
    if (!step?.selector && !step?.targetId) return true;
    if (typeof window === 'undefined') return true;
    const node = resolveStepNode(step);
    if (!node?.isConnected) return false;
    const styles = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return (
      styles.display !== 'none' &&
      styles.visibility !== 'hidden' &&
      Number(styles.opacity || 1) > 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  }, [resolveStepNode]);

  const isStepReadyForTransition = useCallback((step?: GuidedManualStep | null) => {
    if (!step || !isStepReady(step)) return false;
    return isStepNodeVisible(step);
  }, [isStepNodeVisible, isStepReady]);

  const findApplicableStepIndex = useCallback(
    (fromIndex: number, direction: 'next' | 'prev') => {
      const indexes = manualSteps
        .map((step, index) => ({ step, index }))
        .filter(({ index }) => (direction === 'next' ? index > fromIndex : index < fromIndex));
      const orderedIndexes = direction === 'next' ? indexes : indexes.reverse();
      return orderedIndexes.find(({ step }) => isStepApplicable(step))?.index ?? -1;
    },
    [isStepApplicable, manualSteps]
  );

  const findReadyStepIndex = useCallback(
    (fromIndex: number, direction: 'next' | 'prev') => {
      const candidateIndex = findApplicableStepIndex(fromIndex, direction);
      if (candidateIndex < 0) return -1;
      return isStepReadyForTransition(manualSteps[candidateIndex]) ? candidateIndex : -1;
    },
    [findApplicableStepIndex, isStepReadyForTransition, manualSteps]
  );

  const waitForReadyStepIndex = useCallback(
    (fromIndex: number, direction: 'next' | 'prev', requestId: number) => {
      const immediate = findReadyStepIndex(fromIndex, direction);
      const stableMs = Math.max(0, resolvedTransition.targetStableMs);
      if (!resolvedTransition.waitForTarget || typeof window === 'undefined') {
        return Promise.resolve(immediate);
      }
      if (immediate >= 0 && stableMs === 0) return Promise.resolve(immediate);

      return new Promise<number>((resolve) => {
        const timeoutMs = Math.min(Math.max(resolvedTransition.targetTimeoutMs, 400), 120_000);
        let frameId = 0;
        let timeoutId = 0;
        let stableTimerId = 0;
        let stableIndex = -1;
        let stableSince = 0;
        let pollId = 0;

        const cleanup = () => {
          if (frameId) window.cancelAnimationFrame(frameId);
          if (timeoutId) window.clearTimeout(timeoutId);
          if (stableTimerId) window.clearTimeout(stableTimerId);
          if (pollId) window.clearInterval(pollId);
          waitListenersRef.current.delete(scheduleCheck);
        };

        const finish = (index: number) => {
          cleanup();
          resolve(index);
        };

        const check = () => {
          frameId = 0;
          if (requestId !== transitionRequestRef.current) {
            finish(-1);
            return;
          }
          const readyIndex = findReadyStepIndex(fromIndex, direction);
          if (readyIndex < 0) {
            stableIndex = -1;
            stableSince = 0;
            if (stableTimerId) {
              window.clearTimeout(stableTimerId);
              stableTimerId = 0;
            }
            return;
          }
          if (stableMs === 0) {
            finish(readyIndex);
            return;
          }
          if (stableIndex !== readyIndex) {
            stableIndex = readyIndex;
            stableSince = window.performance.now();
            if (stableTimerId) window.clearTimeout(stableTimerId);
            stableTimerId = window.setTimeout(() => {
              stableTimerId = 0;
              scheduleCheck();
            }, stableMs);
            return;
          }
          const remainingStableMs = stableMs - (window.performance.now() - stableSince);
          if (remainingStableMs <= 0) {
            finish(readyIndex);
            return;
          }
          if (!stableTimerId) {
            stableTimerId = window.setTimeout(() => {
              stableTimerId = 0;
              scheduleCheck();
            }, remainingStableMs);
          }
        };

        function scheduleCheck() {
          if (frameId) return;
          frameId = window.requestAnimationFrame(check);
        }

        waitListenersRef.current.add(scheduleCheck);
        // El sondeo sólo vive durante una transición. Observar todo el DOM hacía
        // que tablas, modales y animaciones dispararan trabajo continuamente.
        pollId = window.setInterval(scheduleCheck, 120);
        timeoutId = window.setTimeout(() => finish(-1), timeoutMs);
        scheduleCheck();
      });
    },
    [
      findReadyStepIndex,
      resolvedTransition.targetStableMs,
      resolvedTransition.targetTimeoutMs,
      resolvedTransition.waitForTarget,
    ]
  );

  const startManual = useCallback(
    (id: string, index = 0) => {
      const manual = manualRegistry.get(id);
      if (!manual) return;
      startWithSteps(manual.steps, index);
    },
    [manualRegistry, startWithSteps]
  );





  const next = useCallback(
    async () => {
      if (isTransitioning) return;
      const currentStep = manualSteps[currentIndex];

      if (currentStep?.actionOnNext?.type === 'click' && currentStep.actionOnNext.selector) {
        const actionControl = typeof document === 'undefined'
          ? null
          : resolveVisibleSelectorNode(currentStep.actionOnNext.selector);
        const actionIsDisabled = isUnavailableControl(actionControl);

        if (!actionControl || actionIsDisabled) {
          setTransitionError(
            actionIsDisabled
              ? 'Todavía faltan datos. Completa lo que la pantalla marca y vuelve a pulsar Siguiente; no se guardó nada.'
              : 'El botón que debe validar este paso todavía no está disponible. Espera a que termine de cargar y vuelve a intentarlo.'
          );
          focusFirstIncompleteField(resolveStepNode(currentStep));
          return;
        }
      }

      const nextCandidateIndex = findApplicableStepIndex(currentIndex, 'next');
      const nextCandidate = nextCandidateIndex >= 0 ? manualSteps[nextCandidateIndex] : null;
      if (nextCandidate?.advanceOnTargetClick) {
        const nextControl = resolveInteractiveControl(resolveStepNode(nextCandidate));
        if (nextControl && isUnavailableControl(nextControl)) {
          setTransitionError(
            'Completa el dato solicitado antes de continuar. El botón real sigue deshabilitado y no se ejecutó ninguna acción.'
          );
          focusFirstIncompleteField(resolveStepNode(currentStep));
          return;
        }
      }

      const requestId = ++transitionRequestRef.current;
      setIsTransitioning(true);
      setTransitionError(null);

      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }

      const legacyDelayMs = runAction(currentStep?.actionOnNext);
      if (legacyDelayMs > 0 && typeof window !== 'undefined') {
        await new Promise((resolve) => window.setTimeout(resolve, legacyDelayMs));
      }
      if (typeof window !== 'undefined') {
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
        });
      }

      const nextIndex = await waitForReadyStepIndex(currentIndex, 'next', requestId);
      if (nextIndex < 0) {
        if (requestId === transitionRequestRef.current) {
          setIsTransitioning(false);
          setTransitionError(
            'La aplicación no confirmó la acción. Revisa los campos o mensajes marcados; sigues en este paso y puedes intentarlo otra vez.'
          );
        }
        return;
      }
      if (requestId !== transitionRequestRef.current) return;
      setIsTransitioning(false);
      setCurrentIndex(nextIndex);
    },
    [currentIndex, findApplicableStepIndex, isTransitioning, manualSteps, resolveStepNode, runAction, waitForReadyStepIndex]
  );
  const prev = useCallback(async () => {
    if (isTransitioning) return;

    const requestId = ++transitionRequestRef.current;
    setIsTransitioning(true);
    setTransitionError(null);
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    const legacyDelayMs = runAction(manualSteps[currentIndex]?.actionOnPrevious);
    if (legacyDelayMs > 0 && typeof window !== 'undefined') {
      await new Promise((resolve) => window.setTimeout(resolve, legacyDelayMs));
    }
    if (typeof window !== 'undefined') {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
      });
    }


    const previousIndex = await waitForReadyStepIndex(currentIndex, 'prev', requestId);
    if (previousIndex < 0) {
      if (requestId === transitionRequestRef.current) {
        setIsTransitioning(false);
        setTransitionError('No se encontró el paso anterior en esta pantalla. Sigues en el paso actual.');
      }
      return;
    }
    if (requestId !== transitionRequestRef.current) return;
    setIsTransitioning(false);
    setCurrentIndex(previousIndex);
  }, [
    currentIndex,
    isTransitioning,
    manualSteps,
    runAction,
    waitForReadyStepIndex,
  ]);

  const registerTarget = useCallback((id: string, node: HTMLElement | null) => {
    if (!node) return;
    if (targetsRef.current.get(id) === node) return;
    targetsRef.current.set(id, node);
    const activeStep = currentStepRef.current;
    if (!isOpenRef.current || activeStep?.targetId !== id) return;
    setTargetsVersion((prevValue) => prevValue + 1);
    waitListenersRef.current.forEach((listener) => listener());
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    if (targetsRef.current.delete(id)) {
      const activeStep = currentStepRef.current;
      if (!isOpenRef.current || activeStep?.targetId !== id) return;
      setTargetsVersion((prevValue) => prevValue + 1);
      waitListenersRef.current.forEach((listener) => listener());
    }
  }, []);

  const getTarget = useCallback((id: string) => targetsRef.current.get(id) ?? null, []);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    const hasTrackedTarget = Boolean(currentStep?.targetId || currentStep?.selector);
    document.body.style.overflow = currentStep?.mode === 'wizard' || hasTrackedTarget ? previous : 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [currentStep?.mode, currentStep?.selector, currentStep?.targetId, isOpen]);

  useEffect(() => {
    if (currentIndex >= manualSteps.length && manualSteps.length > 0) {
      setCurrentIndex(manualSteps.length - 1);
    }
  }, [currentIndex, manualSteps.length]);

  useEffect(() => {
    if (!isOpen) return;
    runAction(currentStep?.actionOnEnter);
  }, [currentStep?.id, currentStep?.actionOnEnter, isOpen, runAction]);

  const stateValue = useMemo(
    () => ({
      steps: manualSteps,
      isOpen,
      currentIndex: visibleStepIndex,
      currentStep,
      totalSteps: visibleTotalSteps,
      targetsVersion,
      isTransitioning,
      transitionError,
      context: manualContext,

      globalDisableAppElements,
    }),
    [manualSteps, isOpen, currentStep, visibleTotalSteps, targetsVersion, isTransitioning, transitionError, manualContext, visibleStepIndex, globalDisableAppElements]

  );

  const apiValue = useMemo(
    () => ({
      start,
      startManual,
      startWithSteps,
      close,
      next,
      prev,
      registerTarget,
      unregisterTarget,
      getTarget,

      checkAutoAdvance,
      isStepApplicable,
      isStepReady,
      setContext,
      mergeContext,
      clearContext,
      getContext,
      refreshLayout,
    }),
    [
      start,
      startManual,
      startWithSteps,
      close,
      next,
      prev,
      registerTarget,
      unregisterTarget,
      getTarget,
      checkAutoAdvance,
      isStepApplicable,
      isStepReady,
      setContext,
      mergeContext,
      clearContext,
      getContext,
      refreshLayout,
    ]

  );

  const configValue = useMemo(
    () => ({
      slots: {
        ...defaultGuidedManualWebSlots,
        ...(slots || {}),
      },
      copy: {
        ...guidedShared.copy,
        ...(copy || {}),
      },
      icons: {
        ...guidedShared.icons,
        ...(icons || {}),
      },
      appearance,
      tracking: {
        ...defaultGuidedManualTracking,
        ...(tracking || {}),
      },
      transition: resolvedTransition,
    }),
    [appearance, copy, icons, slots, resolvedTransition, tracking]
  );

  return (
    <GuidedManualApiContext.Provider value={apiValue}>
      <GuidedManualStateContext.Provider value={stateValue}>
        <GuidedManualConfigContext.Provider value={configValue}>
          {children}
          <GuidedManualOverlay />
        </GuidedManualConfigContext.Provider>
      </GuidedManualStateContext.Provider>
    </GuidedManualApiContext.Provider>
  );
};

export const useGuidedManualState = () => {
  return useContext(GuidedManualStateContext);
};

export const useGuidedManualApi = () => {
  return useContext(GuidedManualApiContext);
};

// Legacy hook for components that might need both (or just rename to state if appropriate)
export const useGuidedManual = () => {
  const state = useContext(GuidedManualStateContext);
  const api = useContext(GuidedManualApiContext);



  if (!state || !api) return null;
  return { ...state, ...api };
};

type GuidedTargetProps = Omit<React.HTMLAttributes<HTMLElement>, 'id' | 'children'> & {
  id: string;
  as?: keyof React.JSX.IntrinsicElements;
  children: React.ReactNode;
};

export const GuidedTarget = ({
  id,
  as = 'div',
  className,
  style,
  children,
  ...elementProps
}: GuidedTargetProps) => {
  const api = useGuidedManualApi();
  const registerTarget = api?.registerTarget;
  const unregisterTarget = api?.unregisterTarget;
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (registerTarget && unregisterTarget && ref.current) {
      registerTarget(id, ref.current);
      return () => unregisterTarget(id);
    }
    return undefined;
  }, [id, registerTarget, unregisterTarget]);

  return React.createElement(
    as as string,
    {
      ...elementProps,
      ref,
      className,
      style,
      'data-guide-id': id,
    },
    children
  );
};

type GuidedManualStartProps = {
  label?: string;
  className?: string;
  startIndex?: number;
};

export const GuidedManualStart = ({
  label,
  className,
  startIndex = 0,
}: GuidedManualStartProps) => {
  const api = useGuidedManualApi();
  const { copy, icons, slots } = useGuidedManualConfig();
  const { start: startCopy } = copy;
  const startIcon = icons?.start ?? 'i';
  const Button = slots.Button;
  const { appearance } = useGuidedManualConfig();
  const s = useMemo(() => createGuidedManualWebStyles(appearance), [appearance]);

  if (!api) return null;
  const { start } = api;

  return (
    <Button
      type="button"
      className={className}
      onPress={() => start(startIndex)}
      ariaLabel={startCopy}
      title={startCopy}
      size="sm"
      tone="neutral"
      style={s.startButton}
    >
      {label ?? startIcon}
    </Button>
  );
};

const GUIDE_Z_INDEX = 100000;
const GUIDE_TARGET_Z_INDEX = GUIDE_Z_INDEX + 2;

const resolveStepTargetNode = (
  step: GuidedManualStep | null,
  getTarget: (id: string) => HTMLElement | null
) => {
  if (!step) return null;
  if (step.selector) {
    const node = resolveVisibleSelectorNode(step.selector);
    if (node) return node;
  }
  if (step.targetId) return getTarget(step.targetId);
  return null;
};

const findScrollableElementAtPoint = (x: number, y: number) => {
  const nodes = document.elementsFromPoint(x, y);
  for (const node of nodes) {
    if (!(node instanceof HTMLElement) || node.closest('[data-guided-manual-overlay="true"]')) continue;
    let candidate: HTMLElement | null = node;
    while (candidate && candidate !== document.body) {
      const styles = window.getComputedStyle(candidate);
      const canScrollY =
        /(auto|scroll|overlay)/.test(styles.overflowY) &&
        candidate.scrollHeight > candidate.clientHeight;
      const canScrollX =
        /(auto|scroll|overlay)/.test(styles.overflowX) &&
        candidate.scrollWidth > candidate.clientWidth;
      if (canScrollY || canScrollX) return candidate;
      candidate = candidate.parentElement;
    }
  }
  return document.scrollingElement;
};

const scrollElementAtPoint = (x: number, y: number, deltaX: number, deltaY: number) => {
  const scrollable = findScrollableElementAtPoint(x, y);
  scrollable?.scrollBy({ left: deltaX, top: deltaY, behavior: 'auto' });
};

type GuidedManualContext = NonNullable<ReturnType<typeof useGuidedManual>>;


const GuidedManualSpinner = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: 14, height: 14, animation: 'guided-manual-spin 1s linear infinite' }}
  >
    <style>
      {`
        @keyframes guided-manual-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}
    </style>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
    <path
      fill="currentColor"
      opacity="0.75"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);


const GuidedManualOverlay = () => {
  const context = useGuidedManual();

  if (!context) return null;

  return <GuidedManualOverlayContent context={context} />;
};

const GuidedManualOverlayContent = ({ context }: { context: GuidedManualContext }) => {
  const { copy, slots, appearance, tracking } = useGuidedManualConfig();
  const s = useMemo(() => createGuidedManualWebStyles(appearance), [appearance]);

  const {
    isOpen,
    currentIndex,
    currentStep,
    totalSteps,
    next,
    prev,
    close,
    getTarget,
    targetsVersion,
    isTransitioning,
    transitionError,

    isStepApplicable,
    isStepReady,
    globalDisableAppElements,
  } = context;
  const manualSteps = context.steps;

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetNode, setTargetNode] = useState<HTMLElement | null>(null);
  const [panelSize, setPanelSize] = useState({ width: 320, height: 160 });
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1024 : window.innerWidth,
    height: typeof window === 'undefined' ? 768 : window.innerHeight,
  }));

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [confirmCountdown, setConfirmCountdown] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showMicroHelp, setShowMicroHelp] = useState(false);
  const [blockedHint, setBlockedHint] = useState<string | null>(null);
  const [transitionSlow, setTransitionSlow] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const targetNodeRef = useRef<HTMLElement | null>(null);
  const targetRectRef = useRef<DOMRect | null>(null);
  const updateFrameRef = useRef<number | null>(null);
  const mutationTimerRef = useRef<number | null>(null);
  const pendingScrollRef = useRef(false);

  const blockedHintTimerRef = useRef<number | null>(null);
  const targetActionConsumedRef = useRef(false);
  const touchScrollRef = useRef({ x: 0, y: 0 });
  const Button = slots.Button;
  const { prev: prevCopy, next: nextCopy, finish: finishCopy } = copy;
  const spotlightPadding = s.spotlightPadding;
  const advancesOnTargetClick = Boolean(currentStep?.advanceOnTargetClick);
  const isWizardStep = currentStep?.mode === 'wizard' || advancesOnTargetClick;
  const guideDisabledSelectors = useMemo(
    () => [
      ...(globalDisableAppElements ?? []),
      ...(currentStep?.disableAppElements ?? []),
    ].filter(Boolean),
    [currentStep?.disableAppElements, globalDisableAppElements]
  );
  const isGuideDisabledNode = useCallback((node: Element | null) => {
    if (!node) return false;
    return guideDisabledSelectors.some((selector) => {
      try {
        return node.matches(selector) || Boolean(node.closest(selector));
      } catch {
        return false;
      }
    });
  }, [guideDisabledSelectors]);

  const handleBlockedWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    scrollElementAtPoint(event.clientX, event.clientY, event.deltaX, event.deltaY);
  }, []);

  const handleBlockedTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchScrollRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleBlockedTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    const previous = touchScrollRef.current;
    scrollElementAtPoint(touch.clientX, touch.clientY, previous.x - touch.clientX, previous.y - touch.clientY);
    touchScrollRef.current = { x: touch.clientX, y: touch.clientY };
    event.preventDefault();
  }, []);

  const focusExpectedControl = useCallback(() => {
    const targetFocusable = targetNode?.matches(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
      ? targetNode
      : targetNode?.querySelector<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        );
    const fallback = panelRef.current;
    const node = isWizardStep && !isPaused ? targetFocusable ?? fallback : fallback;
    node?.focus({ preventScroll: true });
    if (isWizardStep && targetNode && !isPaused) {
      targetNode.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [isPaused, isWizardStep, targetNode]);

  const showBlockedInteractionHint = useCallback((message?: string) => {
    setBlockedHint(message ?? 'Todavía no: pulsa solamente el control resaltado.');
    if (blockedHintTimerRef.current !== null) {
      window.clearTimeout(blockedHintTimerRef.current);
    }
    blockedHintTimerRef.current = window.setTimeout(() => {
      blockedHintTimerRef.current = null;
      setBlockedHint(null);
    }, 2600);
    window.setTimeout(focusExpectedControl, 0);
  }, [focusExpectedControl]);

  useEffect(() => {
    if (!isOpen) return;

    const isInside = (container: HTMLElement | null, eventTarget: EventTarget | null) =>
      Boolean(container && eventTarget instanceof Node && container.contains(eventTarget));
    const targetInteractionAllowed = () =>
      isWizardStep &&
      !isPaused &&
      !showConfirmation &&
      !showExitConfirmation &&
      !isTransitioning &&
      !targetActionConsumedRef.current;
    const currentTarget = () =>
      resolveStepTargetNode(currentStep, getTarget) ?? targetNodeRef.current;
    const isAllowedEvent = (event: Event) => {
      // El clic interno que ejecuta la guía debe atravesar su propio bloqueo.
      // La marca vive sólo durante node.click(), así que otros eventos
      // programáticos no obtienen acceso general al resto de la pantalla.
      const internalActionElement = event.target instanceof Element
        ? event.target.closest('[data-guide-internal-action="true"]')
        : null;
      if (internalActionElement) return true;
      if (isInside(panelRef.current, event.target)) return true;
      if (typeof SubmitEvent !== 'undefined' && event instanceof SubmitEvent) {
        const submitElement = event.submitter instanceof Element
          ? event.submitter
          : event.target instanceof Element
            ? event.target
            : null;
        if (isGuideDisabledNode(submitElement)) return false;
        const liveTarget = currentTarget();
        return targetInteractionAllowed()
          && (isInside(liveTarget, event.submitter) || isInside(liveTarget, event.target));
      }
      if (targetInteractionAllowed() && isInside(currentTarget(), event.target)) {
        const eventElement = event.target instanceof Element ? event.target : null;
        if (isGuideDisabledNode(eventElement)) return false;
        return !eventElement?.closest(
          'button:disabled, input:disabled, select:disabled, textarea:disabled, [aria-disabled="true"]'
        );
      }
      return false;
    };
    const blockEvent = (event: Event) => {
      if (isAllowedEvent(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const blockedElement = event.target instanceof Element ? event.target : null;
      const blockedDisabledControl = blockedElement?.closest(
        'button:disabled, input:disabled, select:disabled, textarea:disabled, [aria-disabled="true"]'
      );
      showBlockedInteractionHint(
        blockedDisabledControl || isGuideDisabledNode(blockedElement)
          ? 'Ese control está deshabilitado. Completa primero los datos marcados.'
          : isTransitioning
          ? 'Espera un momento: estamos comprobando la acción anterior.'
          : isPaused
            ? 'La capacitación está pausada. Pulsa “Continuar capacitación” para seguir.'
            : isWizardStep
              ? undefined
              : 'Todavía no: en este paso usa solamente los botones del panel de capacitación.'
      );
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        setIsPaused((current) => !current);
        setShowExitConfirmation(false);
        return;
      }

      const targetRoot = targetInteractionAllowed() ? currentTarget() : null;
      const roots = [panelRef.current, targetRoot].filter((node): node is HTMLElement => Boolean(node));
      const focusables = roots.flatMap((root) => {
        const own = root.matches(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        ) ? [root] : [];
        return [
          ...own,
          ...Array.from(root.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
          )),
        ].filter((node) => {
          const rect = node.getBoundingClientRect();
          const styles = window.getComputedStyle(node);
          return rect.width > 0 && rect.height > 0 && styles.visibility !== 'hidden' && !isGuideDisabledNode(node);
        });
      });

      if (event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        const currentIndexInFocusables = focusables.indexOf(document.activeElement as HTMLElement);
        const direction = event.shiftKey ? -1 : 1;
        const nextFocusIndex = currentIndexInFocusables < 0
          ? (event.shiftKey ? focusables.length - 1 : 0)
          : (currentIndexInFocusables + direction + focusables.length) % Math.max(1, focusables.length);
        focusables[nextFocusIndex]?.focus({ preventScroll: true });
        return;
      }

      if (!isAllowedEvent(event)) blockEvent(event);
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (isAllowedEvent(event)) return;
      event.preventDefault();
      event.stopPropagation();
      window.setTimeout(focusExpectedControl, 0);
    };

    const blockedEvents: Array<keyof DocumentEventMap> = [
      'pointerdown',
      'mousedown',
      'touchstart',
      'click',
      'dblclick',
      'contextmenu',
      'submit',
      'dragstart',
      'drop',
    ];
    blockedEvents.forEach((eventName) => document.addEventListener(eventName, blockEvent, true));
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocusIn, true);
    return () => {
      blockedEvents.forEach((eventName) => document.removeEventListener(eventName, blockEvent, true));
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);
    };
  }, [currentStep, focusExpectedControl, getTarget, isGuideDisabledNode, isOpen, isPaused, isTransitioning, isWizardStep, showBlockedInteractionHint, showConfirmation, showExitConfirmation]);

  const updateTrackedTarget = useCallback(
    (scrollToTarget: boolean) => {
      if (!currentStep) {
        targetNodeRef.current = null;
        targetRectRef.current = null;
        setTargetNode(null);
        setTargetRect(null);
        return;
      }

      const node = resolveStepTargetNode(currentStep, getTarget);
      if (!node) {
        if (targetNodeRef.current !== null) {
          targetNodeRef.current = null;
          setTargetNode(null);
        }
        if (targetRectRef.current !== null) {
          targetRectRef.current = null;
          setTargetRect(null);
        }
        return;
      }


      const rect = node.getBoundingClientRect();
      const isOutsideViewport =
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        rect.right < 0 ||
        rect.left > window.innerWidth;
      if (scrollToTarget || (tracking.autoScrollWhenHidden && isOutsideViewport)) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
      const nextRect = rect.width > 0 || rect.height > 0 ? rect : null;
      const previousRect = targetRectRef.current;
      const nodeChanged = targetNodeRef.current !== node;
      const rectChanged =
        previousRect !== nextRect &&
        (!previousRect ||
          !nextRect ||
          Math.abs(previousRect.top - nextRect.top) > 0.5 ||
          Math.abs(previousRect.left - nextRect.left) > 0.5 ||
          Math.abs(previousRect.width - nextRect.width) > 0.5 ||
          Math.abs(previousRect.height - nextRect.height) > 0.5);

      if (nodeChanged) {
        targetNodeRef.current = node;
        setTargetNode(node);
      }
      if (rectChanged) {
        targetRectRef.current = nextRect;
        setTargetRect(nextRect);
      }
    },
    [currentStep, getTarget, tracking.autoScrollWhenHidden]
  );

  const scheduleTargetUpdate = useCallback(
    (scrollToTarget = false) => {
      pendingScrollRef.current = pendingScrollRef.current || scrollToTarget;
      if (updateFrameRef.current !== null) {
        window.cancelAnimationFrame(updateFrameRef.current);
      }
      updateFrameRef.current = window.requestAnimationFrame(() => {
        updateFrameRef.current = null;
        const shouldScroll = pendingScrollRef.current;
        pendingScrollRef.current = false;
        updateTrackedTarget(shouldScroll);
      });
    },
    [updateTrackedTarget]
  );

  const resolveTargetRect = useCallback(
    (scrollToTarget: boolean) => {
      scheduleTargetUpdate(scrollToTarget);
    },
    [scheduleTargetUpdate]
  );

  useEffect(() => {
    if (!isOpen || isPaused || !isWizardStep || !targetNode) return;

    const previousPosition = targetNode.style.position;
    const previousZIndex = targetNode.style.zIndex;
    const previousIsolation = targetNode.style.isolation;
    const computedPosition = window.getComputedStyle(targetNode).position;

    if (computedPosition === 'static') {
      targetNode.style.position = 'relative';
    }
    targetNode.style.zIndex = String(GUIDE_TARGET_Z_INDEX);
    targetNode.style.isolation = 'isolate';
    targetNode.setAttribute('data-guide-wizard-active', 'true');
    if (advancesOnTargetClick) {
      targetNode.setAttribute('data-guide-target-click-active', 'true');
    }

    return () => {
      targetNode.style.position = previousPosition;
      targetNode.style.zIndex = previousZIndex;
      targetNode.style.isolation = previousIsolation;
      targetNode.removeAttribute('data-guide-wizard-active');
      targetNode.removeAttribute('data-guide-target-click-active');
    };
  }, [advancesOnTargetClick, isOpen, isPaused, isWizardStep, targetNode]);

  useEffect(() => {
    if (!isTransitioning) targetActionConsumedRef.current = false;
  }, [currentStep?.id, isTransitioning, transitionError]);

  useEffect(() => {
    if (!isOpen || isPaused || !advancesOnTargetClick || !targetNode || isTransitioning) return;

    const handleTargetClick = (event: MouseEvent) => {
      const clickedElement = event.target instanceof Element ? event.target : targetNode;
      const disabledControl = clickedElement.closest(
        'button:disabled, input:disabled, select:disabled, textarea:disabled, [aria-disabled="true"]'
      );
      if (disabledControl) {
        event.preventDefault();
        showBlockedInteractionHint('Ese control todavía no está disponible. Completa primero los datos marcados.');
        return;
      }
      if (targetActionConsumedRef.current) {
        event.preventDefault();
        event.stopPropagation();
        showBlockedInteractionHint('Espera un momento: estamos comprobando tu acción.');
        return;
      }
      targetActionConsumedRef.current = true;
      window.setTimeout(() => {
        const relatedForm = clickedElement.closest('form') ?? targetNode.querySelector('form');
        const invalidField = relatedForm?.querySelector(
          ':invalid, [aria-invalid="true"], .ant-form-item-has-error, [data-validation-error="true"]'
        );
        if (invalidField) {
          targetActionConsumedRef.current = false;
          showBlockedInteractionHint('Falta completar o corregir un dato marcado. La capacitación permanece en este paso.');
          if (invalidField instanceof HTMLElement) invalidField.focus({ preventScroll: true });
          invalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (currentIndex >= totalSteps - 1) {
          close();
          return;
        }
        void next();
      }, 160);
    };

    targetNode.addEventListener('click', handleTargetClick);
    return () => targetNode.removeEventListener('click', handleTargetClick);
  }, [advancesOnTargetClick, close, currentIndex, isOpen, isPaused, isTransitioning, next, showBlockedInteractionHint, targetNode, totalSteps]);

  useEffect(() => {
    if (!isOpen || isPaused) return;
    const timer = window.setTimeout(focusExpectedControl, 120);
    return () => window.clearTimeout(timer);
  }, [currentStep?.id, focusExpectedControl, isOpen, isPaused, targetNode]);

  useEffect(() => {
    if (!isOpen) return;
    resolveTargetRect(true);

  }, [isOpen, currentStep?.id, targetsVersion, resolveTargetRect]);


  useEffect(() => {
    if (!isOpen) return;
    const handleUpdate = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      resolveTargetRect(false);
    };
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);
    window.visualViewport?.addEventListener('resize', handleUpdate);
    window.visualViewport?.addEventListener('scroll', handleUpdate);
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      window.visualViewport?.removeEventListener('resize', handleUpdate);
      window.visualViewport?.removeEventListener('scroll', handleUpdate);
    };
  }, [isOpen, resolveTargetRect]);

  useEffect(() => {
    if (!isOpen || !currentStep) return;

    const scheduleMutationUpdate = () => {
      if (mutationTimerRef.current !== null) {
        window.clearTimeout(mutationTimerRef.current);
      }
      mutationTimerRef.current = window.setTimeout(() => {
        mutationTimerRef.current = null;
        scheduleTargetUpdate(false);
      }, tracking.mutationDebounceMs);
    };

    const mutationObserver = tracking.mutations
      ? new MutationObserver((mutations) => {
          const hasRelevantMutation = mutations.some((mutation) => {
            const element = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
            return !element?.closest('[data-guided-manual-overlay="true"]');
          });
          if (hasRelevantMutation) scheduleMutationUpdate();
        })
      : null;

    mutationObserver?.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });

    const resizeObserver = tracking.resize && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => scheduleTargetUpdate(false))
      : null;
    if (resizeObserver && targetNode) {
      resizeObserver.observe(targetNode);
    }

    const handleVisualTransition = () => scheduleTargetUpdate(false);
    if (tracking.transitions) {
      document.addEventListener('transitionrun', handleVisualTransition, true);
      document.addEventListener('transitionend', handleVisualTransition, true);
      document.addEventListener('animationstart', handleVisualTransition, true);
      document.addEventListener('animationiteration', handleVisualTransition, true);
      document.addEventListener('animationend', handleVisualTransition, true);
    }

    return () => {
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      if (mutationTimerRef.current !== null) {
        window.clearTimeout(mutationTimerRef.current);
        mutationTimerRef.current = null;
      }
      if (tracking.transitions) {
        document.removeEventListener('transitionrun', handleVisualTransition, true);
        document.removeEventListener('transitionend', handleVisualTransition, true);
        document.removeEventListener('animationstart', handleVisualTransition, true);
        document.removeEventListener('animationiteration', handleVisualTransition, true);
        document.removeEventListener('animationend', handleVisualTransition, true);
      }
    };
  }, [currentStep, isOpen, scheduleTargetUpdate, targetNode, tracking]);

  useEffect(() => {
    return () => {
      if (updateFrameRef.current !== null) {
        window.cancelAnimationFrame(updateFrameRef.current);
      }
      if (mutationTimerRef.current !== null) {
        window.clearTimeout(mutationTimerRef.current);
      }
      if (blockedHintTimerRef.current !== null) window.clearTimeout(blockedHintTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    // A target can register after a route or wizard step finishes rendering.
    // Center it when it becomes available instead of keeping the panel detached.
    resolveTargetRect(true);
  }, [isOpen, targetsVersion, resolveTargetRect]);


  useEffect(() => {
    setShowConfirmation(false);
    setShowExitConfirmation(false);
    setConfirmCountdown(0);
    setBlockedHint(null);
    setShowMicroHelp(false);
  }, [currentIndex, currentStep?.id]);

  useEffect(() => {
    if (!isOpen) {
      setIsPaused(false);
      setShowExitConfirmation(false);
      setBlockedHint(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (showConfirmation && confirmCountdown > 0) {
      const timer = window.setTimeout(() => setConfirmCountdown((c) => c - 1), 1000);
      return () => window.clearTimeout(timer);
    }
  }, [showConfirmation, confirmCountdown]);

  useEffect(() => {
    if (!isTransitioning) {
      setTransitionSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setTransitionSlow(true), 1200);
    return () => window.clearTimeout(timer);
  }, [isTransitioning]);


  useLayoutEffect(() => {
    if (!panelRef.current || !isOpen) return;
    const panel = panelRef.current;
    const updatePanelSize = () => {
      const rect = panel.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const measuredHeight = Math.max(rect.height, panel.scrollHeight);
      setPanelSize((current) => (
        Math.abs(current.width - rect.width) > 0.5 || Math.abs(current.height - measuredHeight) > 0.5
          ? { width: rect.width, height: measuredHeight }
          : current
      ));
    };
    updatePanelSize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updatePanelSize);
    observer?.observe(panel);
    return () => observer?.disconnect();
  }, [isOpen, currentIndex, currentStep?.description, isPaused, showConfirmation, showExitConfirmation]);

  if (!isOpen || !currentStep) return null;

  const windowWidth = viewport.width;
  const windowHeight = viewport.height;
  const margin = windowWidth < 640 ? 8 : 12;
  const expectsTarget = Boolean(currentStep.selector || currentStep.targetId);
  const targetMissing = expectsTarget && !targetRect;
  const shouldCenterPanel = showConfirmation || showExitConfirmation || isPaused || targetMissing;
  const preferredPanelWidth = Number(appearance?.layout?.panelWidth ?? 320);
  const placement = resolveGuidedManualPanelPlacement({
    viewportWidth: windowWidth,
    viewportHeight: windowHeight,
    panelWidth: preferredPanelWidth,
    panelHeight: panelSize.height,
    target: shouldCenterPanel ? null : targetRect,
    margin,
    gap: 12,
  });

  const panelStyle: React.CSSProperties = {
    top: placement.top,
    left: placement.left,
    width: placement.width,
    maxWidth: `calc(100vw - ${margin * 2}px)`,
    maxHeight: placement.maxHeight,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    zIndex: GUIDE_Z_INDEX + 4,
    pointerEvents: 'auto',
    transition: s.panel.transition,
  };

  const highlightStyle = targetRect
    ? (() => {
      let left = clampGuidedManualValue(targetRect.left - spotlightPadding, 0, windowWidth);
      let right = clampGuidedManualValue(targetRect.right + spotlightPadding, 0, windowWidth);
      let top = clampGuidedManualValue(targetRect.top - spotlightPadding, 0, windowHeight);
      let bottom = clampGuidedManualValue(targetRect.bottom + spotlightPadding, 0, windowHeight);
      const renderedPanelHeight = Math.min(panelSize.height, placement.maxHeight);
      const panelBounds = {
        top: placement.top,
        right: placement.left + placement.width,
        bottom: placement.top + renderedPanelHeight,
        left: placement.left,
      };
      const intersectsPanel = !(
        right <= panelBounds.left ||
        left >= panelBounds.right ||
        bottom <= panelBounds.top ||
        top >= panelBounds.bottom
      );
      if (intersectsPanel && !shouldCenterPanel) {
        if (placement.docked === 'bottom') bottom = Math.min(bottom, panelBounds.top - 8);
        if (placement.docked === 'top') top = Math.max(top, panelBounds.bottom + 8);
        if (placement.docked === 'left') left = Math.max(left, panelBounds.right + 8);
        if (placement.docked === 'right') right = Math.min(right, panelBounds.left - 8);
      }
      return {
        top,
        left,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
    })()
    : undefined;

  const isLast = currentIndex >= totalSteps - 1;
  const progressPercent = totalSteps > 0 ? ((currentIndex + 1) / totalSteps) * 100 : 0;


  const handleNextOrFinish = () => {
    if (currentStep.confirmation && !showConfirmation) {
      setShowConfirmation(true);
      setConfirmCountdown(currentStep.confirmation.confirmDelaySeconds || 0);
    } else {
      setShowConfirmation(false);
      setConfirmCountdown(0);
      if (isLast) close();
      else void next();
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setConfirmCountdown(0);
  };

  const handleRequestExit = () => {
    setIsPaused(false);
    setShowConfirmation(false);
    setShowExitConfirmation(true);
  };

  const handleContinueTour = () => {
    setShowExitConfirmation(false);
    setIsPaused(false);
    window.setTimeout(focusExpectedControl, 0);
  };

  const previousStepIndex = [...manualSteps]
    .map((step, index) => ({ step, index }))
    .reverse()
    .find(({ step, index }) => index < currentIndex && isStepApplicable(step))?.index;

  const hasActionOnPrevious = !!currentStep.actionOnPrevious;
  const isPreviousStepReady = previousStepIndex !== undefined ? isStepReady(manualSteps[previousStepIndex]) : false;

  const isPrevDisabled =
    currentStep.disablePrevious ||
    currentIndex === 0 ||
    isTransitioning ||
    (!hasActionOnPrevious && !isPreviousStepReady);

  const showPrev = !currentStep.hidePrevious;

  const activeToneName = showExitConfirmation
    ? 'critical'
    : showConfirmation && currentStep.confirmation?.tone
      ? currentStep.confirmation.tone
      : (currentStep.tone ?? 'default');
  const tone = s.stepTones[activeToneName] ?? s.stepTones.default;

  const displayIcon = showExitConfirmation
    ? '⚠️'
    : isPaused
      ? '⏸️'
      : showConfirmation
        ? currentStep.confirmation?.icon
        : currentStep.icon;
  const displayTitle = showExitConfirmation
    ? '¿Salir de la capacitación?'
    : isPaused
      ? 'Capacitación pausada'
      : targetMissing
        ? 'Buscando el control de este paso…'
        : showConfirmation
          ? currentStep.confirmation?.title
          : currentStep.title;
  const displayDescription = showExitConfirmation
    ? 'Si sales, se cerrará el recorrido actual y no se ejecutará el siguiente paso. Puedes volver a iniciarlo desde Ayuda.'
    : isPaused
      ? 'La aplicación permanece bloqueada para evitar cambios accidentales. Continúa cuando estés listo o sal de forma segura.'
      : targetMissing
        ? 'No avances ni hagas clic al azar. La pantalla todavía está cargando o estás en una ruta distinta. Esperaremos aquí sin saltarnos pasos.'
        : showConfirmation
          ? currentStep.confirmation?.description
          : currentStep.description;
  const missionCopy = !showConfirmation && !showExitConfirmation && !isPaused
    ? parseMissionCopy(displayDescription || '')
    : null;

  const customTitleColor = showConfirmation && !showExitConfirmation ? currentStep.confirmation?.customTitleColor : currentStep.customTitleColor;
  const customTitleSize = showConfirmation && !showExitConfirmation ? currentStep.confirmation?.customTitleSize : currentStep.customTitleSize;
  const customDescColor = showConfirmation && !showExitConfirmation ? currentStep.confirmation?.customDescriptionColor : currentStep.customDescriptionColor;
  const customDescSize = showConfirmation && !showExitConfirmation ? currentStep.confirmation?.customDescriptionSize : currentStep.customDescriptionSize;


  const overlayStyle = targetRect && !isPaused && !showConfirmation && !showExitConfirmation
    ? {
        ...s.overlay,
        pointerEvents: isWizardStep ? 'none' : s.overlay.pointerEvents,
      }
    : { ...s.overlay, ...s.overlayDim };

  return (
    <div
      data-guided-manual-overlay="true"
      style={overlayStyle}
      onWheel={isWizardStep ? undefined : handleBlockedWheel}
      onTouchStart={isWizardStep ? undefined : handleBlockedTouchStart}
      onTouchMove={isWizardStep ? undefined : handleBlockedTouchMove}
    >

      {globalDisableAppElements && globalDisableAppElements.length > 0 && (
        <style>
          {`
            ${globalDisableAppElements.join(', ')} {
              pointer-events: none !important;
              opacity: 0.5 !important;
              cursor: not-allowed !important;
              filter: grayscale(100%) !important;
            }
          `}
        </style>
      )}
      {advancesOnTargetClick && !isPaused && !isTransitioning ? (
        <style>{createGuidedManualTargetInteractionCss(tone.accent)}</style>
      ) : null}
      {currentStep.disableAppElements && currentStep.disableAppElements.length > 0 && (
        <style>
          {`
            ${currentStep.disableAppElements.join(', ')} {
              pointer-events: none !important;
              opacity: 0.5 !important;
              cursor: not-allowed !important;
              filter: grayscale(100%) !important;
            }
          `}
        </style>
      )}

      {targetRect && !isPaused && !showConfirmation && !showExitConfirmation && highlightStyle && (
        <div style={getGuidedManualAtomWebJsx0Style(s, highlightStyle)} />
      )}
      <div
        ref={panelRef}
        data-guide-step-id={currentStep.id}
        data-guide-target-id={currentStep.targetId}
        data-guide-target-selector={currentStep.selector}
        tabIndex={-1}
        role="dialog"
        aria-modal={!isWizardStep || isPaused || showConfirmation || showExitConfirmation}
        aria-labelledby="guided-manual-title"
        aria-describedby="guided-manual-description"
        style={getGuidedManualAtomWebJsx1Style(s, {
          ...panelStyle,
          background: tone.panelBg,
          borderColor: tone.panelBorder,
          color: tone.textMain,

          boxShadow: showConfirmation || showExitConfirmation
            ? `0 0 0 14px rgba(248, 113, 113, 0.15), ${s.panel.boxShadow}, 0 0 0 2px rgba(248, 113, 113, 0.8)`
            : `${s.panel.boxShadow}, 0 0 0 1px ${tone.panelBorder}`,

        })}
      >
        {!showConfirmation && !showExitConfirmation && !isPaused ? (
          <div style={s.missionBadge}>
            <span aria-hidden style={{ fontWeight: 900 }}>GUÍA</span>
            Paso {currentIndex + 1} de {totalSteps}
            {currentStep.chapter ? <span style={{ opacity: 0.7 }}>· {currentStep.chapter}</span> : null}
          </div>
        ) : null}

        {displayIcon && (
          <div style={{ fontSize: showConfirmation || showExitConfirmation || isPaused ? 42 : 28, marginBottom: 12, lineHeight: 1, textAlign: showConfirmation || showExitConfirmation || isPaused ? 'center' : 'left' }}>
            {displayIcon}
          </div>
        )}
        <h3 id="guided-manual-title" style={{ ...s.title, color: customTitleColor || tone.textMain, fontSize: customTitleSize || s.title.fontSize, textAlign: showConfirmation || showExitConfirmation || isPaused ? 'center' : 'left' }}>{displayTitle}</h3>
        {missionCopy ? (
          <div id="guided-manual-description" style={s.missionCopy}>
            <div style={s.missionContext}>
              <span style={s.missionEmoji} aria-hidden>👀</span>
              <span><strong>Mira:</strong> {missionCopy.look}.</span>
            </div>
            <div style={{ ...s.missionAction, borderColor: tone.panelBorder, background: tone.buttonPrimaryBg }}>
              <span style={s.missionEmoji} aria-hidden>👉</span>
              <span><strong>Haz sólo esto:</strong> {missionCopy.action}.</span>
            </div>
            <details style={s.missionResult}>
              <summary style={s.missionResultSummary}>¿Qué pasará?</summary>
              <span>{missionCopy.result}.</span>
            </details>
          </div>
        ) : (
          <p id="guided-manual-description" style={{ ...s.description, color: customDescColor || tone.textMuted, fontSize: customDescSize || s.description.fontSize, textAlign: showConfirmation || showExitConfirmation || isPaused ? 'center' : 'left' }}>{displayDescription}</p>
        )}
        {advancesOnTargetClick && !showConfirmation && !showExitConfirmation && !isPaused && !targetMissing ? (
          <div style={{ ...s.targetInstruction, borderColor: tone.panelBorder, background: tone.buttonPrimaryBg }} role="status">
            <span style={{ ...s.targetInstructionDot, background: tone.accent }} aria-hidden />
            <span>
              {isTransitioning
                ? transitionSlow
                  ? 'La aplicación sigue comprobando la acción. Si hay un campo marcado, corrígelo; no avanzaremos por error.'
                  : 'Comprobando la acción. No vuelvas a pulsar…'
                : 'Ahora pulsa una sola vez el control que parpadea.'}
            </span>
          </div>
        ) : null}
        {isTransitioning && transitionSlow && !advancesOnTargetClick && !showConfirmation && !showExitConfirmation && !isPaused ? (
          <div style={s.blockedNotice} role="status">
            La aplicación todavía no confirma el cambio. Esperaremos sin saltar de paso; revisa si aparece un campo o mensaje marcado.
          </div>
        ) : null}
        {transitionError && !showConfirmation && !showExitConfirmation && !isPaused ? (
          <div style={s.errorNotice} role="alert">{transitionError}</div>
        ) : null}
        {blockedHint && !showConfirmation && !showExitConfirmation ? (
          <div style={s.blockedNotice} role="alert" aria-live="assertive">{blockedHint}</div>
        ) : null}
        {showMicroHelp && !showConfirmation && !showExitConfirmation && !isPaused ? (
          <div style={s.microHelp} role="status">
            <strong>Vamos juntos:</strong>
            <span>1. No cierres esta tarjeta.</span>
            <span>2. Busca el control con el borde que late.</span>
            <span>3. Púlsalo una sola vez. Si te equivocas, el tutorial no guarda nada.</span>
          </div>
        ) : null}

        <div
          aria-label={`Progreso ${Math.round(progressPercent)}%`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPercent)}

          style={{ ...s.progressTrack, borderColor: tone.panelBorder, display: showConfirmation || showExitConfirmation || isPaused ? 'none' : 'block' }}
        >
          <div style={{ ...s.progressFill, width: `${progressPercent}%`, background: tone.accent }} />
        </div>
        <div style={{ ...s.controls, marginTop: showConfirmation || showExitConfirmation || isPaused ? 24 : s.controls.marginTop }}>
          <div style={{ ...s.progress, color: tone.textMuted, opacity: showConfirmation || showExitConfirmation || isPaused ? 0 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            {Math.round(progressPercent)}% · {currentStep.mode === 'wizard' ? 'Tu turno' : 'Mira y aprende'}
            {isTransitioning && <GuidedManualSpinner />}
          </div>
          <div style={s.actions}>
            {showExitConfirmation ? (
              <>
                <Button
                  tone="neutral"
                  style={{ ...s.buttonBase, ...s.buttonSecondary, padding: '0 12px' }}
                  onPress={handleContinueTour}
                >
                  Continuar recorrido
                </Button>
                <Button
                  tone="primary"
                  style={{ ...s.buttonBase, ...s.buttonPrimary, background: tone.buttonPrimaryBg, borderColor: tone.panelBorder, padding: '0 12px' }}
                  onPress={close}
                >
                  Sí, salir
                </Button>
              </>
            ) : isPaused ? (
              <>
                <Button
                  tone="primary"
                  style={{ ...s.buttonBase, ...s.buttonPrimary, background: tone.buttonPrimaryBg, borderColor: tone.panelBorder, padding: '0 12px' }}
                  onPress={handleContinueTour}
                >
                  Continuar capacitación
                </Button>
                <Button
                  tone="neutral"
                  style={{ ...s.buttonBase, ...s.buttonSecondary, padding: '0 12px' }}
                  onPress={handleRequestExit}
                >
                  Salir
                </Button>
              </>
            ) : showConfirmation ? (
              <>
                <Button
                  tone="neutral"
                  style={{ ...s.buttonBase, ...s.buttonSecondary, padding: '0 12px' }}
                  onPress={handleCancelConfirmation}
                >
                  {currentStep.confirmation?.cancelText || 'Cancelar'}
                </Button>
                <Button
                  tone="primary"
                  style={{ ...s.buttonBase, ...s.buttonPrimary, background: tone.buttonPrimaryBg, borderColor: tone.panelBorder, padding: '0 12px' }}
                  onPress={handleNextOrFinish}
                  disabled={confirmCountdown > 0}
                >
                  {confirmCountdown > 0
                    ? `${currentStep.confirmation?.confirmText || 'Confirmar'} (${confirmCountdown})`
                    : (currentStep.confirmation?.confirmText || 'Confirmar')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  tone="neutral"
                  style={{ ...s.buttonBase, ...s.buttonSecondary, padding: '0 12px' }}
                  onPress={handleRequestExit}
                >
                  Salir
                </Button>
                <Button
                  tone="neutral"
                  style={{ ...s.buttonBase, ...s.buttonSecondary, padding: '0 12px' }}
                  onPress={() => setShowMicroHelp((current) => !current)}
                  disabled={isTransitioning}
                >
                  {showMicroHelp ? 'Ocultar ayuda' : 'Ayúdame'}
                </Button>
                {showPrev && (
                  <Button
                    tone="neutral"
                    style={{ ...s.buttonBase, ...s.buttonSecondary, padding: '0 12px' }}
                    onPress={prev}
                    disabled={isPrevDisabled}
                    ariaLabel={prevCopy}
                    title={prevCopy}
                  >
                    Anterior
                  </Button>
                )}
                {targetMissing ? (
                  <Button
                    tone="primary"
                    style={{ ...s.buttonBase, ...s.buttonPrimary, background: tone.buttonPrimaryBg, borderColor: tone.panelBorder, padding: '0 12px' }}
                    onPress={() => resolveTargetRect(true)}
                  >
                    Buscar de nuevo
                  </Button>
                ) : !advancesOnTargetClick ? (
                  <Button
                    tone="primary"
                    style={{ ...s.buttonBase, ...s.buttonPrimary, background: tone.buttonPrimaryBg, borderColor: tone.panelBorder, padding: '0 12px' }}
                    onPress={handleNextOrFinish}
                    disabled={!isLast && isTransitioning}
                    ariaLabel={isLast ? finishCopy : nextCopy}
                    title={isLast ? finishCopy : nextCopy}
                  >
                    {isLast
                      ? 'Terminar'
                      : transitionError
                        ? 'Corregí los datos; reintentar'
                        : currentStep.actionOnNext?.type === 'click'
                          ? 'Validar y continuar'
                          : 'Continuar'}
                  </Button>
                ) : null}
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
