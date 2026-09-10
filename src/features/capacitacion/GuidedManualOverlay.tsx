"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  createGuidedManualTargetInteractionCss,
  createGuidedManualWebStyles,
  getGuidedManualAtomWebJsx0Style,
  getGuidedManualAtomWebJsx1Style,
} from './GuidedManualAtom.web.styles';
import {
  clampGuidedManualValue,
  resolveGuidedManualPanelPlacement,
  type GuidedManualStep,
} from './GuidedManualAtom.core';
import { resolveVisibleSelectorNode, useGuidedManual, useGuidedManualConfig } from './GuidedManualAtom.web';

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

export default GuidedManualOverlay;
