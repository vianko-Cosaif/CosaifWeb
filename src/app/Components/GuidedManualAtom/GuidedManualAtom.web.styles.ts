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
    } as CSSProperties,
    controls: {
      marginTop: layout.panelGap,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
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

export const getGuidedManualAtomWebJsx0Style = (s: any, highlightStyle: any) => ({ ...s.spotlight, ...highlightStyle });

export const getGuidedManualAtomWebJsx1Style = (s: any, panelStyle: any) => ({ ...s.panel, ...panelStyle });
