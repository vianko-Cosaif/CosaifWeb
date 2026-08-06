"use client";

import { ReactNode, useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import {
  GuidedManualProvider,
  useGuidedManual,
  useGuidedManualApi,
  GuidedManualAction,
  GuidedManualDefinition,
  GuidedManualStep,
} from ".";
import { normalizeTrainingRole, type TrainingRole } from "./trainingRoles";
import {
  buildRoleAppTourChapterSteps,
  buildRoleAppTourSteps,
  roleBaseForTraining,
  type RoleAppTourChapterId,
} from "./RoleAppTour";
import { TrainingTourProvider, useTrainingTour } from "./TrainingTourContext";
import { FINISH_ROLE_TUTORIAL_EVENT, START_ROLE_TUTORIAL_EVENT } from "./trainingEvents";

const START_CREATE_MOVEMENT_GUIDE_EVENT = "cosaif:start-create-movement-guide";
const START_CREATE_MOVEMENT_TORNO_GUIDE_EVENT = "cosaif:start-create-movement-torno-guide";
const START_GENERAL_HELP_GUIDE_EVENT = "cosaif:start-general-help-guide";
const TRAINING_ONLY_MANUALS: GuidedManualDefinition[] = [];
const TRAINING_ONLY_STEPS: GuidedManualStep[] = [];

function getRoleBaseFromPathname(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "cliente" && parts[1] === "torreon") {
    return "/cliente/torreon";
  }
  if (["cliente", "coordinador", "administrador", "supervisor", "comercial"].includes(parts[0])) {
    return `/${parts[0]}`;
  }
  return "/cliente";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

const LIVE_GUIDE_CHAPTERS: Record<string, RoleAppTourChapterId> = {
  "general-first-steps": "dashboard",
  "dashboard-training": "dashboard",
  "client-dashboard-basics": "dashboard",
  "movements-training": "movements",
  "operations-monitoring-overview": "movements",
  "rounds-training": "rounds",
  "create-movement-overview": "create-edit",
  "client-create-movement-overview": "create-edit",
  "torno-training": "torno",
  "client-torno-overview": "torno",
  "incidents-training": "incidents",
  "incidents-overview": "incidents",
  "admin-users-overview": "access",
  "admin-config-overview": "access",
  "reports-overview": "access",
  "commercial-overview": "commercial",
  "commercial-clients-overview": "commercial",
  "commercial-contracts-overview": "commercial",
  "commercial-packages-overview": "commercial",
  "commercial-collections-overview": "commercial",
  "arrastre-overview": "arrastre",
};

function moduleCompletionCondition(chapterId: RoleAppTourChapterId): GuidedManualStep["when"] {
  if (chapterId === "create-edit") {
    return { type: "selector", selector: "[data-guide-id='edit-movement-step-3']", exists: false };
  }
  if (chapterId === "rounds") {
    return () => typeof document !== "undefined"
      && !Array.from(document.querySelectorAll("[data-guide-id='training-round-edit-row']"))
        .some((node) => node.textContent?.includes("SIM-MOV-305"));
  }
  if (chapterId === "incidents") {
    return { type: "selector", selector: "[data-guide-id='incident-resolution-panel']", exists: false };
  }
  return undefined;
}

function selectAccessSteps(steps: GuidedManualStep[], guideId: string) {
  if (guideId === "admin-users-overview") return steps.filter((step) => step.id === "tour-open-users");
  if (guideId === "admin-config-overview") return steps.filter((step) => step.id === "tour-open-config");
  if (guideId === "reports-overview") return steps.filter((step) => step.id === "tour-open-reports");
  return steps;
}

function selectCommercialSteps(steps: GuidedManualStep[], guideId: string) {
  const suffixes: Record<string, string> = {
    "commercial-clients-overview": "commercial_clients",
    "commercial-contracts-overview": "commercial_contracts",
    "commercial-packages-overview": "commercial_packages",
    "commercial-collections-overview": "commercial_collections",
    "reports-overview": "commercial_reports",
  };
  const suffix = suffixes[guideId];
  return suffix ? steps.filter((step) => step.id.endsWith(suffix)) : steps;
}

function buildLiveModuleGuideSteps(role: TrainingRole, guideId: string): GuidedManualStep[] {
  let chapterId = guideId === "reports-overview" && role === "COMERCIAL"
    ? "commercial"
    : LIVE_GUIDE_CHAPTERS[guideId];
  if (!chapterId) return [];

  if (role === "ARRASTRE_TORREON" && chapterId === "dashboard") chapterId = "arrastre";

  let steps = buildRoleAppTourChapterSteps(role, chapterId);
  if (chapterId === "rounds" && steps.length === 0) {
    chapterId = "dashboard";
    steps = buildRoleAppTourChapterSteps(role, chapterId);
  }
  if (chapterId === "create-edit" && steps.length) {
    const openMovements = buildRoleAppTourChapterSteps(role, "movements")[0];
    if (openMovements) {
      steps = [{ ...openMovements, id: "module-create-open-movements", chapter: "Crear y editar" }, ...steps];
    }
  }
  if (chapterId === "access") steps = selectAccessSteps(steps, guideId);
  if (chapterId === "commercial") steps = selectCommercialSteps(steps, guideId);
  if (!steps.length) return [];

  const chapterLabel = steps[0]?.chapter || "Práctica corta";
  return [
    ...steps,
    {
      id: `module-${chapterId}-finish`,
      chapter: chapterLabel,
      selector: "#main",
      title: "Práctica terminada",
      description: "Ya hiciste esta tarea en las pantallas reales. Los datos SIM se descartarán al finalizar y ninguna acción se guardó en producción.",
      mode: "guide",
      tone: "success",
      icon: "✅",
      when: moduleCompletionCondition(chapterId),
    },
  ];
}


function GuidedHelpEventBridge() {
  const api = useGuidedManualApi();
  const manual = useGuidedManual();
  const pathname = usePathname();
  const trainingTour = useTrainingTour();
  const trainingWasOpen = useRef(false);

  useEffect(() => {
    const isOpen = Boolean(manual?.isOpen);
    if (trainingWasOpen.current && !isOpen && trainingTour.active) {
      trainingTour.finish();
    }
    trainingWasOpen.current = isOpen && trainingTour.active;
  }, [manual?.isOpen, trainingTour]);

  useEffect(() => {
    if (!api) return;

    const startGeneralHelpGuide = (event: Event) => {
      const detail = event instanceof CustomEvent && isRecord(event.detail) ? event.detail : null;
      const guideId = typeof detail?.guideId === "string" ? detail.guideId : "general-first-steps";
      const roleBase = getRoleBaseFromPathname(pathname);
      const role = normalizeTrainingRole(detail?.role, roleBase);
      const liveSteps = buildLiveModuleGuideSteps(role, guideId);
      if (liveSteps.length > 0) {
        trainingTour.start(
          role,
          roleBaseForTraining(role),
          LIVE_GUIDE_CHAPTERS[guideId] === "torno" ? "torno" : "natural",
        );
        if (LIVE_GUIDE_CHAPTERS[guideId] === "rounds") {
          trainingTour.prepareRoundsPractice();
        }
        api.startWithSteps(liveSteps, 0);
        return;
      }
      trainingTour.start(role, roleBaseForTraining(role));
      api.startWithSteps(buildRoleAppTourSteps(role), 0);
    };

    const startCreateMovementGuide = () => {
      window.dispatchEvent(new CustomEvent(START_ROLE_TUTORIAL_EVENT, {
        detail: { role: normalizeTrainingRole(undefined, getRoleBaseFromPathname(pathname)) },
      }));
    };

    const startCreateMovementTornoGuide = () => {
      window.dispatchEvent(new CustomEvent(START_ROLE_TUTORIAL_EVENT, {
        detail: { role: normalizeTrainingRole(undefined, getRoleBaseFromPathname(pathname)) },
      }));
    };

    const startFullRoleTraining = (event: Event) => {
      const detail = event instanceof CustomEvent && isRecord(event.detail) ? event.detail : null;
      const role = normalizeTrainingRole(detail?.role, getRoleBaseFromPathname(pathname));
      trainingTour.start(role, roleBaseForTraining(role));
      api.startWithSteps(buildRoleAppTourSteps(role), 0);
    };

    const finishFullRoleTraining = () => {
      api.close();
      trainingTour.finish();
    };

    window.addEventListener(START_GENERAL_HELP_GUIDE_EVENT, startGeneralHelpGuide);
    window.addEventListener(START_CREATE_MOVEMENT_GUIDE_EVENT, startCreateMovementGuide);
    window.addEventListener(START_CREATE_MOVEMENT_TORNO_GUIDE_EVENT, startCreateMovementTornoGuide);
    window.addEventListener(START_ROLE_TUTORIAL_EVENT, startFullRoleTraining);
    window.addEventListener(FINISH_ROLE_TUTORIAL_EVENT, finishFullRoleTraining);
    return () => {
      window.removeEventListener(START_GENERAL_HELP_GUIDE_EVENT, startGeneralHelpGuide);
      window.removeEventListener(START_CREATE_MOVEMENT_GUIDE_EVENT, startCreateMovementGuide);
      window.removeEventListener(START_CREATE_MOVEMENT_TORNO_GUIDE_EVENT, startCreateMovementTornoGuide);
      window.removeEventListener(START_ROLE_TUTORIAL_EVENT, startFullRoleTraining);
      window.removeEventListener(FINISH_ROLE_TUTORIAL_EVENT, finishFullRoleTraining);
    };
  }, [api, pathname, trainingTour]);

  return null;
}

export function ClientMovementGuideProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const actionRunner = useCallback(
    (action: GuidedManualAction) => {
      const delayMs = Math.max(0, Number(action.delayMs || 0));

      const execute = () => {
        if (action.type === "click" && action.selector) {
          const node = document.querySelector(action.selector) as HTMLElement | null;
          if (node) {
            const previousMarker = node.getAttribute("data-guide-internal-action");
            node.setAttribute("data-guide-internal-action", "true");
            try {
              node.click();
            } finally {
              if (previousMarker === null) node.removeAttribute("data-guide-internal-action");
              else node.setAttribute("data-guide-internal-action", previousMarker);
            }
          }
          return;
        }

        if (action.type !== "event") return;

        const baseFromAction =
          typeof action.detail?.base === "string" && action.detail.base.trim()
            ? action.detail.base.trim()
            : getRoleBaseFromPathname(pathname);

        if (action.eventName === "guide:navigate-role-movements") {
          router.push(`${baseFromAction}/movimientos`);
          return;
        }

        if (action.eventName === "guide:navigate-create-movement") {
          router.push("/movimientos/crear");
          return;
        }

        if (action.eventName === "guide:navigate-path") {
          const href = typeof action.detail?.href === "string" ? action.detail.href.trim() : "";
          if (href) router.push(href);
          return;
        }

        if (action.eventName === "guide:training-read-path") {
          const href = typeof action.detail?.href === "string" ? action.detail.href.trim() : "";
          if (href) router.push(href);
          return;
        }

        if (action.eventName === "guide:finish-role-app-tour") {
          window.dispatchEvent(new CustomEvent(FINISH_ROLE_TUTORIAL_EVENT, {
            detail: action.detail,
          }));
        }
      };

      if (delayMs > 0) {
        window.setTimeout(execute, delayMs);
        return delayMs;
      }

      execute();
      return 0;
    },
    [router, pathname]
  );

  return (
    <TrainingTourProvider>
    <GuidedManualProvider
      manuals={TRAINING_ONLY_MANUALS}
      steps={TRAINING_ONLY_STEPS}
      actionRunner={actionRunner}
      transition={{
        waitForTarget: true,
        targetStableMs: 80,
        targetTimeoutMs: 6_000,
      }}
      tracking={{
        mutations: false,
        transitions: false,
        resize: true,
        autoScrollWhenHidden: true,
      }}
      appearance={{
        mode: "light",
        colors: {
          overlay: "rgba(15, 23, 42, 0.58)",
          accent: "#7c3aed",
          panelBg: "#ffffff",
          panelBorder: "#c4b5fd",
          textMain: "#172033",
          textMuted: "#475569",
          buttonBg: "#f1f5f9",
          buttonPrimaryBg: "#ede9fe",
        },
        layout: {
          spotlightPadding: 9,
          spotlightRadius: 16,
          panelWidth: 370,
          panelRadius: 20,
          panelPadding: 17,
          controlHeight: 42,
        },
        typography: { titleSize: 18, descriptionSize: 14 },
        effects: {
          panelShadow: "0 18px 50px rgba(15, 23, 42, 0.22)",
          panelBackdropFilter: "none",
          transition: "top 0.14s ease, left 0.14s ease, width 0.14s ease",
        },
        stepTones: {
          default: { panelBg: "#ffffff", panelBorder: "#cbd5e1", accent: "#7c3aed", textMain: "#172033", textMuted: "#475569", buttonPrimaryBg: "#ede9fe" },
          info: { panelBg: "#ffffff", panelBorder: "#93c5fd", accent: "#2563eb", textMain: "#172033", textMuted: "#475569", buttonPrimaryBg: "#dbeafe" },
          warning: { panelBg: "#fffbeb", panelBorder: "#f59e0b", accent: "#d97706", textMain: "#451a03", textMuted: "#78350f", buttonPrimaryBg: "#fef3c7" },
          critical: { panelBg: "#fff1f2", panelBorder: "#fb7185", accent: "#e11d48", textMain: "#4c0519", textMuted: "#881337", buttonPrimaryBg: "#ffe4e6" },
          success: { panelBg: "#ecfdf5", panelBorder: "#34d399", accent: "#059669", textMain: "#022c22", textMuted: "#065f46", buttonPrimaryBg: "#d1fae5" },
        },
      }}
      copy={{
        start: "Empezar paso a paso",
        next: "Siguiente paso",
        finish: "Terminar capacitación",
      }}
    >
      <GuidedHelpEventBridge />
      {children}
    </GuidedManualProvider>
    </TrainingTourProvider>
  );
}

export function ClientMovementGuideButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const api = useGuidedManualApi();

  if (!api) return null;

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(START_ROLE_TUTORIAL_EVENT))}
      className={className}
      title="Abrir capacitación paso a paso"
      aria-label="Abrir capacitación paso a paso"
    >
      <CircleHelp aria-hidden className="h-4 w-4" />
      {!compact && <span>Guia</span>}
    </button>
  );
}
