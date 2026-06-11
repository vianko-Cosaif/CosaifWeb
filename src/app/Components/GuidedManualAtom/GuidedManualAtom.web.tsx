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
  normalizeGuidedManualSteps,
  type GuidedManualAction,
  type GuidedManualActionRunner,
  type GuidedManualAppearance,
  type GuidedManualStep,
} from './GuidedManualAtom.core';

type GuidedManualStateContextValue = {
  steps: GuidedManualStep[];
  isOpen: boolean;
  currentIndex: number;
  currentStep: GuidedManualStep | null;
  totalSteps: number;
  targetsVersion: number;
};

type GuidedManualApiContextValue = {
  start: (index?: number) => void;
  startWithSteps: (steps: GuidedManualStep[], index?: number) => void;
  close: () => void;
  next: () => void;
  prev: () => void;
  registerTarget: (id: string, node: HTMLElement | null) => void;
  unregisterTarget: (id: string) => void;
  getTarget: (id: string) => HTMLElement | null;
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
});

const useGuidedManualConfig = () => useContext(GuidedManualConfigContext);

type GuidedManualProviderProps = {
  steps: GuidedManualStep[];
  children: React.ReactNode;
  startOpen?: boolean;
  initialStep?: number;
  actionRunner?: GuidedManualActionRunner;
  slots?: GuidedManualWebSlots;
  copy?: GuidedManualCopy;
  icons?: GuidedManualIcons;
  appearance?: GuidedManualAppearance;
};

export const GuidedManualProvider = ({
  steps,
  children,
  startOpen = false,
  initialStep = 0,
  actionRunner,
  slots,
  copy,
  icons,
  appearance,
}: GuidedManualProviderProps) => {
  const [manualSteps, setManualSteps] = useState<GuidedManualStep[]>(steps);
  const defaultStepsRef = useRef<GuidedManualStep[]>(steps);
  const [isCustomSteps, setIsCustomSteps] = useState(false);
  const [isOpen, setIsOpen] = useState(startOpen);
  const [currentIndex, setCurrentIndex] = useState(initialStep);
  const targetsRef = useRef<Map<string, HTMLElement>>(new Map());
  const [targetsVersion, setTargetsVersion] = useState(0);

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
        node?.click();
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
    defaultStepsRef.current = steps;
    // Avoid overriding a custom manual while it is running.
    if (!isCustomSteps && !isOpen) {
      setManualSteps(steps);
    }
  }, [steps, isCustomSteps, isOpen]);

  const totalSteps = manualSteps.length;
  const currentStep = useMemo(
    () => (totalSteps > 0 ? manualSteps[Math.min(currentIndex, totalSteps - 1)] : null),
    [manualSteps, currentIndex, totalSteps]
  );

  const start = useCallback(
    (index = 0) => {
      if (!manualSteps.length) return;
      setCurrentIndex(Math.min(Math.max(index, 0), manualSteps.length - 1));
      setIsOpen(true);
    },
    [manualSteps]
  );

  const startWithSteps = useCallback(
    (nextSteps: GuidedManualStep[], index = 0) => {
      const safeSteps = normalizeGuidedManualSteps(nextSteps);
      if (!safeSteps.length) return;
      setIsCustomSteps(true);
      setManualSteps(safeSteps);
      setCurrentIndex(Math.min(Math.max(index, 0), safeSteps.length - 1));
      setIsOpen(true);
    },
    []
  );

  const close = useCallback(() => {
    setIsOpen(false);
    if (isCustomSteps) {
      setIsCustomSteps(false);
      setManualSteps(defaultStepsRef.current);
      setCurrentIndex(0);
    }
  }, [isCustomSteps]);
  const next = useCallback(
    () => {
      const currentStep = manualSteps[currentIndex];
      const delayMs = runAction(currentStep?.actionOnNext);
      const advance = () => setCurrentIndex((prev) => Math.min(prev + 1, manualSteps.length - 1));
      if (delayMs > 0 && typeof window !== 'undefined') {
        window.setTimeout(advance, delayMs + 80);
        return;
      }
      advance();
    },
    [currentIndex, manualSteps, runAction]
  );
  const prev = useCallback(() => setCurrentIndex((prev) => Math.max(prev - 1, 0)), []);

  const registerTarget = useCallback((id: string, node: HTMLElement | null) => {
    if (!node) return;
    targetsRef.current.set(id, node);
    setTargetsVersion((prevValue) => prevValue + 1);
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    if (targetsRef.current.delete(id)) {
      setTargetsVersion((prevValue) => prevValue + 1);
    }
  }, []);

  const getTarget = useCallback((id: string) => targetsRef.current.get(id) ?? null, []);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

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
      currentIndex,
      currentStep,
      totalSteps,
      targetsVersion,
    }),
    [manualSteps, isOpen, currentIndex, currentStep, totalSteps, targetsVersion]
  );

  const apiValue = useMemo(
    () => ({
      start,
      startWithSteps,
      close,
      next,
      prev,
      registerTarget,
      unregisterTarget,
      getTarget,
    }),
    [start, startWithSteps, close, next, prev, registerTarget, unregisterTarget, getTarget]
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
    }),
    [appearance, copy, icons, slots]
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

const GuidedManualOverlay = () => {
  const context = useGuidedManual();
  const { copy, icons, slots, appearance } = useGuidedManualConfig();
  const s = useMemo(() => createGuidedManualWebStyles(appearance), [appearance]);

  if (!context) return null;

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
  } = context;
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetNode, setTargetNode] = useState<HTMLElement | null>(null);
  const [panelSize, setPanelSize] = useState({ width: 320, height: 160 });
  const panelRef = useRef<HTMLDivElement | null>(null);
  const Button = slots.Button;
  const { prev: prevCopy, next: nextCopy, finish: finishCopy } = copy;
  const prevIcon = icons?.prev ?? '<';
  const nextIcon = icons?.next ?? '>';
  const finishIcon = icons?.finish ?? 'x';
  const spotlightPadding = s.spotlightPadding;
  const isWizardStep = currentStep?.mode === 'wizard';

  const resolveTargetRect = useCallback(
    (scrollToTarget: boolean) => {
      if (!currentStep) {
        setTargetRect(null);
        setTargetNode(null);
        return;
      }
      const node = resolveStepTargetNode(currentStep, getTarget);
      if (node && scrollToTarget) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
      if (!node) {
        setTargetRect(null);
        setTargetNode(null);
        return;
      }
      const rect = node.getBoundingClientRect();
      setTargetNode(node);
      setTargetRect(rect.width > 0 || rect.height > 0 ? rect : null);
    },
    [currentStep, getTarget]
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
  }, [isOpen, currentStep?.id, resolveTargetRect]);

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
    if (!isOpen) return;
    resolveTargetRect(false);
  }, [isOpen, targetsVersion, resolveTargetRect]);

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

  if (targetRect) {
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
    zIndex: GUIDE_Z_INDEX + 4,
    pointerEvents: 'auto',
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
    ...style,
  });

  const wizardBlockers = targetRect && highlightStyle && isWizardStep
    ? (
      <>
        <div style={blockerStyle({ top: 0, left: 0, right: 0, height: highlightStyle.top })} />
        <div
          style={blockerStyle({
            top: highlightStyle.top + highlightStyle.height,
            left: 0,
            right: 0,
            bottom: 0,
          })}
        />
        <div
          style={blockerStyle({
            top: highlightStyle.top,
            left: 0,
            width: highlightStyle.left,
            height: highlightStyle.height,
          })}
        />
        <div
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
    <div style={overlayStyle}>
      {wizardBlockers}
      {targetRect && <div style={getGuidedManualAtomWebJsx0Style(s, highlightStyle)} />}
      <div ref={panelRef} style={getGuidedManualAtomWebJsx1Style(s, panelStyle)}>
        {currentStep.mode === 'wizard' ? (
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.72, marginBottom: 6 }}>
            Wizard paso a paso
          </div>
        ) : null}
        <h3 style={s.title}>{currentStep.title}</h3>
        <p style={s.description}>{currentStep.description}</p>
        <div style={s.controls}>
          <div style={s.progress}>
            {currentIndex + 1} / {totalSteps}
          </div>
          <div style={s.actions}>
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
            <Button
              size="icon"
              tone="neutral"
              style={{ ...s.buttonBase, ...s.buttonSecondary }}
              onPress={prev}
              disabled={currentIndex === 0}
              ariaLabel={prevCopy}
              title={prevCopy}
              icon={prevIcon}
              iconOnly
            />
            <Button
              size="icon"
              tone="primary"
              style={{ ...s.buttonBase, ...s.buttonPrimary }}
              onPress={isLast ? close : next}
              ariaLabel={isLast ? finishCopy : nextCopy}
              title={isLast ? finishCopy : nextCopy}
              icon={isLast ? finishIcon : nextIcon}
              iconOnly
            />
          </div>
        </div>
      </div>
    </div>
  );
};
