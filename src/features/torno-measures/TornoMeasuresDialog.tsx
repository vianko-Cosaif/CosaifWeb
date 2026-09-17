"use client";

import dynamic from "next/dynamic";
import Modal from "@/components/ui/Modal";
import type { MeasuresModalState } from "./useTornoMeasuresModal";

const Viewer = dynamic(() => import("@/features/movimientos/torno/TornoMeasuresViewerModal"), {
  ssr: false,
});

export default function TornoMeasuresDialog({
  state,
  onClose,
}: {
  state: MeasuresModalState;
  onClose: () => void;
}) {
  if (!state.open) return null;
  if (!state.loading && !state.error) {
    return (
      <Viewer
        open
        onClose={onClose}
        tornoMedicion={state.tornoMedicion}
        locomotiveLabel={state.locomotiveLabel}
        companyName={state.companyName}
      />
    );
  }
  return (
    <Modal title="Medidas de torno" onClose={onClose} maxWidth="max-w-md">
      {state.loading ? (
        <p role="status" className="text-sm text-[var(--app-text-muted)]">
          Cargando medidas de torno...
        </p>
      ) : (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">
          {state.error}
        </p>
      )}
    </Modal>
  );
}
