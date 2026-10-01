/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CSSProperties } from 'react';
import { resolveGuidedManualAppearance, type GuidedManualAppearance } from './GuidedManualAtom.core';

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

const rgba = (color: string, alpha: number) => {
  if (color.startsWith('rgb')) return color;
  const rgb = hexToRgb(color);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : color;
};

export const createGuidedManualWebStyles = (appearance?: GuidedManualAppearance) => {
  const resolved = resolveGuidedManualAppearance(appearance);
  const { colors, layout, typography, effects } = resolved;

  return {
    overlay: {
      position: 'fixed',
      inset: 0,
      zIndex: 100000,
      pointerEvents: 'auto',
      fontFamily: typography.fontFamily,
    } as CSSProperties,
    overlayDim: {
      background: colors.overlay,
    } as CSSProperties,
    spotlight: {
      position: 'fixed',
      borderRadius: layout.spotlightRadius,
      border: `${layout.spotlightBorderWidth}px solid ${rgba(colors.accent, 0.85)}`,
      boxShadow: `0 0 0 9999px ${colors.overlay}`,
      transition: effects.transition,
      pointerEvents: 'none',
    } as CSSProperties,
    panel: {
      position: 'fixed',
      width: `min(${layout.panelWidth}px, calc(100vw - 32px))`,
      background: colors.panelBg,
      border: `1px solid ${colors.panelBorder}`,
      borderRadius: layout.panelRadius,
      padding: layout.panelPadding,
      color: colors.textMain,
      boxShadow: effects.panelShadow,
      backdropFilter: effects.panelBackdropFilter,
      WebkitBackdropFilter: effects.panelBackdropFilter,
      transition: effects.transition,
    } as CSSProperties,
    title: {
      margin: '0 0 6px',
      fontSize: typography.titleSize,
      fontWeight: 700,
      color: colors.textMain,
    } as CSSProperties,
    description: {
      margin: 0,
      fontSize: typography.descriptionSize,
      lineHeight: 1.45,
      color: colors.textMuted,
      whiteSpace: 'pre-line',
      overflowWrap: 'anywhere',
    } as CSSProperties,
    missionBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 10,
      borderRadius: 999,
      background: rgba(colors.accent, 0.12),
      padding: '6px 10px',
      color: colors.textMain,
      fontSize: 11,
      fontWeight: 900,
      letterSpacing: '0.035em',
    } as CSSProperties,
    missionCopy: {
      display: 'grid',
      gap: 9,
      color: colors.textMain,
      fontSize: 14,
      lineHeight: 1.45,
    } as CSSProperties,
    missionContext: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 9,
      color: colors.textMuted,
    } as CSSProperties,
    missionAction: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 9,
      border: `2px solid ${rgba(colors.accent, 0.55)}`,
      borderRadius: 14,
      padding: '11px 12px',
      color: colors.textMain,
      fontSize: 15,
      fontWeight: 750,
    } as CSSProperties,
    missionEmoji: {
      flex: '0 0 auto',
      fontSize: 18,
      lineHeight: 1.3,
    } as CSSProperties,
    missionResult: {
      borderRadius: 10,
      color: colors.textMuted,
      fontSize: 12,
    } as CSSProperties,
    missionResultSummary: {
      cursor: 'pointer',
      fontWeight: 850,
      color: colors.textMain,
      marginBottom: 4,
    } as CSSProperties,
    microHelp: {
      display: 'grid',
      gap: 4,
      marginTop: 10,
      border: `1px dashed ${rgba(colors.accent, 0.75)}`,
      borderRadius: 12,
      background: rgba(colors.accent, 0.1),
      padding: '10px 12px',
      color: colors.textMain,
      fontSize: 12,
      lineHeight: 1.4,
    } as CSSProperties,
    targetInstruction: {
      marginTop: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      borderRadius: 12,
      border: `1px solid ${rgba(colors.accent, 0.5)}`,
      background: rgba(colors.accent, 0.14),
      padding: '10px 12px',
      color: colors.textMain,
      fontSize: 12,
      fontWeight: 800,
      lineHeight: 1.4,
    } as CSSProperties,
    targetInstructionDot: {
      width: 10,
      height: 10,
      flex: '0 0 auto',
      borderRadius: 999,
      background: colors.accent,
      boxShadow: `0 0 0 4px ${rgba(colors.accent, 0.2)}`,
    } as CSSProperties,
    errorNotice: {
      marginTop: 10,
      borderRadius: 12,
      border: '1px solid rgba(248, 113, 113, 0.7)',
      background: 'rgba(127, 29, 29, 0.42)',
      padding: '10px 12px',
      color: '#fee2e2',
      fontSize: 12,
      fontWeight: 750,
      lineHeight: 1.45,
    } as CSSProperties,
    blockedNotice: {
      marginTop: 10,
      borderRadius: 12,
      border: '1px solid rgba(251, 191, 36, 0.72)',
      background: 'rgba(120, 53, 15, 0.52)',
      padding: '9px 11px',
      color: '#fef3c7',
      fontSize: 12,
      fontWeight: 800,
      lineHeight: 1.4,
    } as CSSProperties,
    controls: {
      marginTop: layout.panelGap,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    } as CSSProperties,
    progressTrack: {
      marginTop: layout.panelGap,
      height: 6,
      borderRadius: 999,
      overflow: 'hidden',
      background: 'rgba(255, 255, 255, 0.12)',
      border: `1px solid ${colors.panelBorder}`,
    } as CSSProperties,
    progressFill: {
      height: '100%',
      borderRadius: 999,
      transition: 'width 0.28s ease, background 0.28s ease',
      background: colors.accent,
    } as CSSProperties,
    progress: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.textMuted,
    } as CSSProperties,
    actions: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
    } as CSSProperties,
    startButton: {
      minHeight: 34,
      minWidth: 34,
      paddingInline: 14,
    } as CSSProperties,
    buttonBase: {
      minHeight: layout.controlHeight,
      minWidth: layout.controlHeight,
      borderColor: colors.panelBorder,
      color: colors.textMain,
    } as CSSProperties,
    buttonPrimary: {
      background: colors.buttonPrimaryBg,
    } as CSSProperties,
    buttonSecondary: {
      background: colors.buttonBg,
    } as CSSProperties,
    spotlightPadding: layout.spotlightPadding,
    button: {
      neutralBg: colors.buttonBg,
      primaryBg: colors.buttonPrimaryBg,
      border: colors.panelBorder,
      text: colors.textMain,
    },
    stepTones: resolved.stepTones,
  };
};

export const createGuidedManualTargetInteractionCss = (accent: string) => `
  @keyframes guided-manual-target-pulse {
    0%, 100% {
      outline-color: ${rgba(accent, 0.96)};
      outline-offset: 2px;
    }
    50% {
      outline-color: ${rgba(accent, 0.42)};
      outline-offset: 8px;
    }
  }

  [data-guide-target-click-active="true"] {
    outline: 3px solid ${rgba(accent, 0.96)} !important;
    outline-offset: 2px;
    cursor: pointer !important;
    animation: guided-manual-target-pulse 1.15s ease-in-out infinite !important;
  }

  @media (prefers-reduced-motion: reduce) {
    [data-guide-target-click-active="true"] {
      animation: none !important;
      outline-width: 4px !important;
      outline-offset: 4px !important;
    }
  }
`;

export const getGuidedManualAtomWebJsx0Style = (s: any, highlightStyle: any) => ({ ...s.spotlight, ...highlightStyle });

export const getGuidedManualAtomWebJsx1Style = (s: any, panelStyle: any) => ({ ...s.panel, ...panelStyle });
