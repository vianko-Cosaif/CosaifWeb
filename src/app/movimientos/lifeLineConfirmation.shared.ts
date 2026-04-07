import { useCallback, useRef, useState } from "react";

export type TrackSelectionKind = "from" | "to";

export type LifeLineModalState = {
  kind: TrackSelectionKind;
  trackName: string;
  lifeLineDescription?: string;
};

export type ViaLifeLineRule = {
  aplica?: boolean;
  descripcion?: string;
} | null;

export type LifeLineConfirmationRules = {
  enabled: boolean;
  confirmKinds: "all" | TrackSelectionKind[];
  question: string;
  labels: Record<TrackSelectionKind, string>;
};

export const DEFAULT_LIFE_LINE_CONFIRMATION_RULES: LifeLineConfirmationRules = {
  enabled: true,
  confirmKinds: "all",
  question: "\u00bfEst\u00e1s consciente de que esta v\u00eda tiene una l\u00ednea de vida?",
  labels: {
    from: "De v\u00eda",
    to: "Para v\u00eda",
  },
};

const shouldConfirm = (
  kind: TrackSelectionKind,
  confirmKinds: LifeLineConfirmationRules["confirmKinds"]
) => confirmKinds === "all" || confirmKinds.includes(kind);

export const buildLifeLineContextLabel = (
  modal: LifeLineModalState | null,
  labels: Record<TrackSelectionKind, string> = DEFAULT_LIFE_LINE_CONFIRMATION_RULES.labels
) => {
  if (!modal) return undefined;
  const base = `${labels[modal.kind]}: ${modal.trackName}`;
  return modal.lifeLineDescription ? `${base} - ${modal.lifeLineDescription}` : base;
};

export function useTrackSelectionConfirmation(
  rules: Partial<LifeLineConfirmationRules> = {}
) {
  const mergedRules: LifeLineConfirmationRules = {
    ...DEFAULT_LIFE_LINE_CONFIRMATION_RULES,
    ...rules,
    labels: {
      ...DEFAULT_LIFE_LINE_CONFIRMATION_RULES.labels,
      ...(rules.labels ?? {}),
    },
  };

  const pendingTrackSelectionRef = useRef<(() => void) | null>(null);
  const [lifeLineModal, setLifeLineModal] = useState<LifeLineModalState | null>(null);

  const requestTrackConfirmation = useCallback(
    (
      kind: TrackSelectionKind,
      trackName: string,
      onConfirm: () => void,
      lineRule?: ViaLifeLineRule
    ) => {
      const requiresLifeLineConfirmation = Boolean(lineRule && (lineRule.aplica ?? true));
      if (!mergedRules.enabled || !shouldConfirm(kind, mergedRules.confirmKinds)) {
        onConfirm();
        return;
      }
      if (!requiresLifeLineConfirmation) {
        onConfirm();
        return;
      }
      pendingTrackSelectionRef.current = onConfirm;
      setLifeLineModal({
        kind,
        trackName,
        lifeLineDescription: lineRule?.descripcion,
      });
    },
    [mergedRules.confirmKinds, mergedRules.enabled]
  );

  const closeTrackConfirmation = useCallback(() => {
    setLifeLineModal(null);
    pendingTrackSelectionRef.current = null;
  }, []);

  const confirmTrackSelection = useCallback(() => {
    const action = pendingTrackSelectionRef.current;
    pendingTrackSelectionRef.current = null;
    setLifeLineModal(null);
    action?.();
  }, []);

  return {
    lifeLineModal,
    requestTrackConfirmation,
    closeTrackConfirmation,
    confirmTrackSelection,
    question: mergedRules.question,
    contextLabel: buildLifeLineContextLabel(lifeLineModal, mergedRules.labels),
  };
}
