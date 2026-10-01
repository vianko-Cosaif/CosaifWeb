import type { GuidedManualStep } from './GuidedManualAtom.core';
import type { TrainingRole } from './trainingRoles';
import {
  buildRoleAppTourChapterSteps,
  type RoleAppTourChapterId,
} from './RoleAppTour';
export { buildRoleAppTourSteps, roleBaseForTraining } from './RoleAppTour';

export const LIVE_GUIDE_CHAPTERS: Record<string, RoleAppTourChapterId> = {
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

export function buildLiveModuleGuideSteps(role: TrainingRole, guideId: string): GuidedManualStep[] {
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


