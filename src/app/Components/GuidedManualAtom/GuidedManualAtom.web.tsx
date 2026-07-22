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
import { createGuidedManualWebStyles, getGuidedManualAtomWebJsx0Style, getGuidedManualAtomWebJsx1Style } from './GuidedManualAtom.web.styles';
import {
  clampGuidedManualValue,
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
  mutations: true,
  resize: true,
  transitions: true,
  autoScrollWhenHidden: true,

  mutationDebounceMs: 40,

};

const defaultGuidedManualTransition: Required<GuidedManualTransitionOptions> = {
  waitForTarget: true,
  targetStableMs: 120,
  targetTimeoutMs: 10_000,
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

  const globalDisableAppElements = activeManual?.disableAppElements ?? [];


  const [manualSteps, setManualSteps] = useState<GuidedManualStep[]>(configuredDefaultSteps);
  const defaultStepsRef = useRef<GuidedManualStep[]>(configuredDefaultSteps);
  const [isCustomSteps, setIsCustomSteps] = useState(false);
  const [isOpen, setIsOpen] = useState(startOpen);
  const [currentIndex, setCurrentIndex] = useState(initialStep);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const targetsRef = useRef<Map<string, HTMLElement>>(new Map());
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
          node.style.setProperty('pointer-events', 'auto', 'important');

          node.click();

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
  const refreshLayout = useCallback(() => {
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
    if (currentStep && isStepReady(currentStep)) return false;

    const readyIndexes = manualSteps
      .map((step, i) => (isStepReady(step) ? i : -1))
      .filter((i) => i !== -1);

    const forwardIndexes = readyIndexes.filter((i) => i > currentIndex);
    const backwardIndexes = readyIndexes.filter((i) => i < currentIndex);

    let bestMatch = -1;
    if (forwardIndexes.length > 0) {
      bestMatch = Math.min(...forwardIndexes);
    } else if (backwardIndexes.length > 0) {
      bestMatch = Math.max(...backwardIndexes);
    }

    if (bestMatch >= 0) {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        autoAdvanceTimerRef.current = null;
        setCurrentIndex(bestMatch);
      }, 120);
      return true;
    }
    return false;
  }, [isOpen, isTransitioning, manualSteps, currentIndex, isStepReady]);


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
      const selected = document.querySelector(step.selector);
      if (selected instanceof HTMLElement) return selected;
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

  const findReadyStepIndex = useCallback(
    (fromIndex: number, direction: 'next' | 'prev') => {
      const indexes = manualSteps
        .map((step, index) => ({ step, index }))
        .filter(({ index }) => (direction === 'next' ? index > fromIndex : index < fromIndex));
      const orderedIndexes = direction === 'next' ? indexes : indexes.reverse();
      return orderedIndexes.find(({ step }) => isStepReadyForTransition(step))?.index ?? -1;
    },
    [isStepReadyForTransition, manualSteps]
  );

  const waitForReadyStepIndex = useCallback(
    (fromIndex: number, direction: 'next' | 'prev', requestId: number) => {
      const immediate = findReadyStepIndex(fromIndex, direction);
      if (immediate >= 0 || !resolvedTransition.waitForTarget || typeof window === 'undefined') {
        return Promise.resolve(immediate);
      }

      return new Promise<number>((resolve) => {
        const timeoutMs = Math.min(Math.max(resolvedTransition.targetTimeoutMs, 400), 2500);
        let frameId = 0;
        let timeoutId = 0;
        let observer: MutationObserver | null = null;

        const cleanup = () => {
          if (frameId) window.cancelAnimationFrame(frameId);
          if (timeoutId) window.clearTimeout(timeoutId);
          observer?.disconnect();
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
          if (readyIndex >= 0) {
            finish(readyIndex);
          }
        };

        function scheduleCheck() {
          if (frameId) return;
          frameId = window.requestAnimationFrame(check);
        }

        waitListenersRef.current.add(scheduleCheck);
        observer = new MutationObserver(scheduleCheck);
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
        });
        timeoutId = window.setTimeout(() => finish(-1), timeoutMs);
        scheduleCheck();
      });
    },
    [findReadyStepIndex, resolvedTransition.targetTimeoutMs, resolvedTransition.waitForTarget]
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

      const requestId = ++transitionRequestRef.current;
      setIsTransitioning(true);

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
        if (requestId === transitionRequestRef.current) setIsTransitioning(false);
        return;
      }
      if (requestId !== transitionRequestRef.current) return;
      setIsTransitioning(false);
      setCurrentIndex(nextIndex);
    },
    [currentIndex, isTransitioning, manualSteps, runAction, waitForReadyStepIndex]
  );
  const prev = useCallback(async () => {
    if (isTransitioning) return;

    const requestId = ++transitionRequestRef.current;
    setIsTransitioning(true);
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
      if (requestId === transitionRequestRef.current) setIsTransitioning(false);
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
    targetsRef.current.set(id, node);
    setTargetsVersion((prevValue) => prevValue + 1);
    waitListenersRef.current.forEach((listener) => listener());
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    if (targetsRef.current.delete(id)) {
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
      context: manualContext,

      globalDisableAppElements,
    }),
    [manualSteps, isOpen, currentStep, visibleTotalSteps, targetsVersion, isTransitioning, manualContext, visibleStepIndex, globalDisableAppElements]

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

type GuidedTargetProps = {
  id: string;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

export const GuidedTarget = ({
  id,
  as = 'div',
  className,
  style,
  children,
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
    const node = document.querySelector(step.selector) as HTMLElement | null;
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
  const { copy, icons, slots, appearance, tracking } = useGuidedManualConfig();
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

    checkAutoAdvance,
    isStepApplicable,
    isStepReady,
    globalDisableAppElements,
  } = context;
  const manualSteps = context.steps;

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetNode, setTargetNode] = useState<HTMLElement | null>(null);
  const [panelSize, setPanelSize] = useState({ width: 320, height: 160 });
  const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 });

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmCountdown, setConfirmCountdown] = useState(0);

  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const targetNodeRef = useRef<HTMLElement | null>(null);
  const targetRectRef = useRef<DOMRect | null>(null);
  const updateFrameRef = useRef<number | null>(null);
  const mutationTimerRef = useRef<number | null>(null);
  const pendingScrollRef = useRef(false);

  const lostTimerRef = useRef<number | null>(null);

  const dragRef = useRef({ pointerId: -1, startX: 0, startY: 0, originX: 0, originY: 0 });
  const touchScrollRef = useRef({ x: 0, y: 0 });
  const Button = slots.Button;
  const { prev: prevCopy, next: nextCopy, finish: finishCopy } = copy;
  const prevIcon = icons?.prev ?? '<';
  const nextIcon = icons?.next ?? '>';
  const finishIcon = icons?.finish ?? 'x';
  const spotlightPadding = s.spotlightPadding;
  const isWizardStep = currentStep?.mode === 'wizard';

  const handlePanelPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: panelOffset.x,
      originY: panelOffset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDraggingPanel(true);
    event.preventDefault();
  }, [panelOffset]);

  const handlePanelPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingPanel || dragRef.current.pointerId !== event.pointerId) return;
    setPanelOffset({
      x: dragRef.current.originX + event.clientX - dragRef.current.startX,
      y: dragRef.current.originY + event.clientY - dragRef.current.startY,
    });
  }, [isDraggingPanel]);

  const handlePanelPointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current.pointerId = -1;
    setIsDraggingPanel(false);
  }, []);

  const handlePanelKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const movement: Record<string, { x: number; y: number }> = {
      ArrowUp: { x: 0, y: -16 },
      ArrowDown: { x: 0, y: 16 },
      ArrowLeft: { x: -16, y: 0 },
      ArrowRight: { x: 16, y: 0 },
    };
    const delta = movement[event.key];
    if (!delta) return;
    setPanelOffset((current) => ({ x: current.x + delta.x, y: current.y + delta.y }));
    event.preventDefault();
  }, []);

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
        if (!currentStep.selector && !currentStep.targetId) {
          if (lostTimerRef.current !== null) {
            window.clearTimeout(lostTimerRef.current);
            lostTimerRef.current = null;
          }
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

        if (targetNodeRef.current !== null) {
          targetNodeRef.current = null;
          setTargetNode(null);
        }
        if (targetRectRef.current !== null) {
          targetRectRef.current = null;
          setTargetRect(null);
        }
        if (checkAutoAdvance()) {
          if (lostTimerRef.current !== null) {
            window.clearTimeout(lostTimerRef.current);
            lostTimerRef.current = null;
          }
          return;
        }
        if (lostTimerRef.current === null) {
          lostTimerRef.current = window.setTimeout(() => {
            lostTimerRef.current = null;
            if (!checkAutoAdvance()) {
              close();
            }
          }, 800);
        }
        return;
      }

      if (lostTimerRef.current !== null) {
        window.clearTimeout(lostTimerRef.current);
        lostTimerRef.current = null;
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
    if (!isOpen || !isWizardStep || !targetNode) return;

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

    return () => {
      targetNode.style.position = previousPosition;
      targetNode.style.zIndex = previousZIndex;
      targetNode.style.isolation = previousIsolation;
      targetNode.removeAttribute('data-guide-wizard-active');
    };
  }, [isOpen, isWizardStep, targetNode]);

  useEffect(() => {
    if (!isOpen) return;
    resolveTargetRect(true);

  }, [isOpen, currentStep?.id, targetsVersion, resolveTargetRect]);


  useEffect(() => {
    if (!isOpen) return;
    const handleUpdate = () => resolveTargetRect(false);
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
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
      let ancestor = targetNode.parentElement;
      let observedAncestors = 0;
      while (ancestor && ancestor !== document.body && observedAncestors < 8) {
        resizeObserver.observe(ancestor);
        ancestor = ancestor.parentElement;
        observedAncestors += 1;
      }
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
    setConfirmCountdown(0);
  }, [currentIndex]);

  useEffect(() => {
    if (showConfirmation && confirmCountdown > 0) {
      const timer = window.setTimeout(() => setConfirmCountdown((c) => c - 1), 1000);
      return () => window.clearTimeout(timer);
    }
  }, [showConfirmation, confirmCountdown]);


  useLayoutEffect(() => {
    if (!panelRef.current || !isOpen) return;
    const rect = panelRef.current.getBoundingClientRect();
    if (rect.width && rect.height) {
      setPanelSize({ width: rect.width, height: rect.height });
    }
  }, [isOpen, currentIndex, currentStep?.description]);

  if (!isOpen || !currentStep) return null;

  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const margin = 16;

  let panelStyle: React.CSSProperties = {
    top: windowHeight / 2 - panelSize.height / 2,
    left: windowWidth / 2 - panelSize.width / 2,
  };


  if (targetRect && !showConfirmation) {

    const spaceBelow = windowHeight - targetRect.bottom - margin;
    const spaceAbove = targetRect.top - margin;
    const placeBelow = spaceBelow >= panelSize.height || spaceBelow >= spaceAbove;
    const top = placeBelow
      ? targetRect.bottom + margin
      : targetRect.top - panelSize.height - margin;
    const left = clampGuidedManualValue(targetRect.left, margin, windowWidth - panelSize.width - margin);
    panelStyle = {
      top: clampGuidedManualValue(top, margin, windowHeight - panelSize.height - margin),
      left,
    };
  }

  panelStyle = {
    ...panelStyle,
    top: clampGuidedManualValue(
      Number(panelStyle.top ?? margin) + panelOffset.y,
      margin,
      Math.max(margin, windowHeight - panelSize.height - margin)
    ),
    left: clampGuidedManualValue(
      Number(panelStyle.left ?? margin) + panelOffset.x,
      margin,
      Math.max(margin, windowWidth - panelSize.width - margin)
    ),
    zIndex: GUIDE_Z_INDEX + 4,
    pointerEvents: 'auto',

    transition: isDraggingPanel ? 'none' : `${s.panel.transition}, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease-out`,
    transform: showConfirmation ? 'scale(1.08)' : 'scale(1)',

  };

  const highlightStyle = targetRect
    ? (() => {
      let x = targetRect.left - spotlightPadding;
      let y = targetRect.top - spotlightPadding;
      let width = targetRect.width + spotlightPadding * 2;
      let height = targetRect.height + spotlightPadding * 2;
      const maxWidth = Math.max(0, windowWidth - margin * 2);
      const maxHeight = Math.max(0, windowHeight - margin * 2);
      width = Math.min(width, maxWidth);
      height = Math.min(height, maxHeight);
      const maxX = windowWidth - margin - width;
      const maxY = windowHeight - margin - height;
      x = clampGuidedManualValue(x, margin, maxX);
      y = clampGuidedManualValue(y, margin, maxY);
      return { top: y, left: x, width, height };
    })()
    : undefined;

  const isLast = currentIndex >= totalSteps - 1;
  const showFinish = !isLast;
  const progressPercent = totalSteps > 0 ? ((currentIndex + 1) / totalSteps) * 100 : 0;


  const handleNextOrFinish = () => {
    if (currentStep.confirmation && !showConfirmation) {
      setShowConfirmation(true);
      setConfirmCountdown(currentStep.confirmation.confirmDelaySeconds || 0);
    } else {
      setShowConfirmation(false);
      setConfirmCountdown(0);
      isLast ? close() : next();
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setConfirmCountdown(0);
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

  const activeToneName = showConfirmation && currentStep.confirmation?.tone
    ? currentStep.confirmation.tone
    : (currentStep.tone ?? 'default');
  const tone = s.stepTones[activeToneName] ?? s.stepTones.default;

  const displayIcon = showConfirmation ? currentStep.confirmation?.icon : currentStep.icon;
  const displayTitle = showConfirmation ? currentStep.confirmation?.title : currentStep.title;
  const displayDescription = showConfirmation ? currentStep.confirmation?.description : currentStep.description;

  const customTitleColor = showConfirmation ? currentStep.confirmation?.customTitleColor : currentStep.customTitleColor;
  const customTitleSize = showConfirmation ? currentStep.confirmation?.customTitleSize : currentStep.customTitleSize;
  const customDescColor = showConfirmation ? currentStep.confirmation?.customDescriptionColor : currentStep.customDescriptionColor;
  const customDescSize = showConfirmation ? currentStep.confirmation?.customDescriptionSize : currentStep.customDescriptionSize;


  const overlayStyle = targetRect
    ? {
        ...s.overlay,
        pointerEvents: isWizardStep ? 'none' : s.overlay.pointerEvents,
      }
    : { ...s.overlay, ...s.overlayDim };

  const blockerStyle = (style: React.CSSProperties): React.CSSProperties => ({
    position: 'fixed',
    zIndex: GUIDE_Z_INDEX,
    pointerEvents: 'auto',
    touchAction: 'none',
    ...style,
  });
  const blockerEvents = {
    onWheel: handleBlockedWheel,
    onTouchStart: handleBlockedTouchStart,
    onTouchMove: handleBlockedTouchMove,
  };

  const wizardBlockers = targetRect && highlightStyle && isWizardStep
    ? (
      <>
        <div {...blockerEvents} style={blockerStyle({ top: 0, left: 0, right: 0, height: highlightStyle.top })} />
        <div
          {...blockerEvents}
          style={blockerStyle({
            top: highlightStyle.top + highlightStyle.height,
            left: 0,
            right: 0,
            bottom: 0,
          })}
        />
        <div
          {...blockerEvents}
          style={blockerStyle({
            top: highlightStyle.top,
            left: 0,
            width: highlightStyle.left,
            height: highlightStyle.height,
          })}
        />
        <div
          {...blockerEvents}
          style={blockerStyle({
            top: highlightStyle.top,
            left: highlightStyle.left + highlightStyle.width,
            right: 0,
            height: highlightStyle.height,
          })}
        />
      </>
    )
    : null;

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

      {wizardBlockers}
      {targetRect && <div style={getGuidedManualAtomWebJsx0Style(s, highlightStyle)} />}
      <div
        ref={panelRef}
        onWheel={isWizardStep ? handleBlockedWheel : undefined}
        style={getGuidedManualAtomWebJsx1Style(s, {
          ...panelStyle,
          background: tone.panelBg,
          borderColor: tone.panelBorder,
          color: tone.textMain,

          boxShadow: showConfirmation
            ? `0 0 0 14px rgba(248, 113, 113, 0.15), ${s.panel.boxShadow}, 0 0 0 2px rgba(248, 113, 113, 0.8)`
            : `${s.panel.boxShadow}, 0 0 0 1px ${tone.panelBorder}`,

        })}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Mover panel de ayuda"
          title="Mover panel"
          onPointerDown={handlePanelPointerDown}
          onPointerMove={handlePanelPointerMove}
          onPointerUp={handlePanelPointerEnd}
          onPointerCancel={handlePanelPointerEnd}
          onKeyDown={handlePanelKeyDown}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 18,
            margin: '-8px -4px 6px',
            cursor: isDraggingPanel ? 'grabbing' : 'grab',
            touchAction: 'none',
            userSelect: 'none',
            color: s.description.color,
          }}
        >
          <span aria-hidden style={{ letterSpacing: 3, fontSize: 13 }}>....</span>
        </div>
        {currentStep.mode === 'wizard' ? (
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.72, marginBottom: 6 }}>
            Wizard paso a paso
          </div>
        ) : null}

        {displayIcon && (
          <div style={{ fontSize: showConfirmation ? 48 : 32, marginBottom: showConfirmation ? 16 : 12, lineHeight: 1, textAlign: showConfirmation ? 'center' : 'left' }}>
            {displayIcon}
          </div>
        )}
        <h3 style={{ ...s.title, color: customTitleColor || tone.textMain, fontSize: customTitleSize || s.title.fontSize, textAlign: showConfirmation ? 'center' : 'left' }}>{displayTitle}</h3>
        <p style={{ ...s.description, color: customDescColor || tone.textMuted, fontSize: customDescSize || s.description.fontSize, textAlign: showConfirmation ? 'center' : 'left' }}>{displayDescription}</p>

        <div
          aria-label={`Progreso ${Math.round(progressPercent)}%`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPercent)}

          style={{ ...s.progressTrack, borderColor: tone.panelBorder, display: showConfirmation ? 'none' : 'block' }}
        >
          <div style={{ ...s.progressFill, width: `${progressPercent}%`, background: tone.accent }} />
        </div>
        <div style={{ ...s.controls, marginTop: showConfirmation ? 24 : s.controls.marginTop }}>
          <div style={{ ...s.progress, color: tone.textMuted, opacity: showConfirmation ? 0 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            {currentStep.title}
            {isTransitioning && <GuidedManualSpinner />}
          </div>
          <div style={s.actions}>
            {showConfirmation ? (
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
                {showFinish && (
                  <Button
                    size="icon"
                    tone="neutral"
                    style={{ ...s.buttonBase, ...s.buttonSecondary }}
                    onPress={close}
                    ariaLabel={finishCopy}
                    title={finishCopy}
                    icon={finishIcon}
                    iconOnly
                  />
                )}
                {showPrev && (
                  <Button
                    size="icon"
                    tone="neutral"
                    style={{ ...s.buttonBase, ...s.buttonSecondary }}
                    onPress={prev}
                    disabled={isPrevDisabled}
                    ariaLabel={prevCopy}
                    title={prevCopy}
                    icon={prevIcon}
                    iconOnly
                  />
                )}
                <Button
                  size="icon"
                  tone="primary"
                  style={{ ...s.buttonBase, ...s.buttonPrimary, background: tone.buttonPrimaryBg, borderColor: tone.panelBorder }}
                  onPress={handleNextOrFinish}
                  disabled={!isLast && isTransitioning}
                  ariaLabel={isLast ? finishCopy : nextCopy}
                  title={isLast ? finishCopy : nextCopy}
                  icon={isLast ? finishIcon : nextIcon}
                  iconOnly
                />
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
