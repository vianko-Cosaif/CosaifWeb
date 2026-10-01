import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  lazy,
  Suspense,
  useMemo,
  useRef,
  useState,
} from 'react';
import guidedShared from './GuidedManualAtom.shared.json';
import {
  createGuidedManualWebStyles,
} from './GuidedManualAtom.web.styles';
import {
  createGuidedManualRegistry,
  normalizeGuidedManualSteps,
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

export const resolveVisibleSelectorNode = (selector: string): HTMLElement | null => {
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
  if (node.matches('button, a[href], input, select, textarea, [role="button"]')) return node;
  return node.querySelector<HTMLElement>('button, a[href], input, select, textarea, [role="button"]');
};

const isUnavailableControl = (node: HTMLElement | null) => Boolean(
  node?.matches(':disabled, [aria-disabled="true"], [data-disabled="true"]')
);

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

export const useGuidedManualConfig = () => useContext(GuidedManualConfigContext);

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

// Keep the providers and the application mounted; fetch the visual guide only when opened.
const GuidedManualOverlay = lazy(() => import('./GuidedManualOverlay'));

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
          {isOpen ? (
            <Suspense fallback={null}>
              <GuidedManualOverlay />
            </Suspense>
          ) : null}
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

