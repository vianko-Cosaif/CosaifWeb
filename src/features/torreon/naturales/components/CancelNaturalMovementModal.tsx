"use client";
import { useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import type { QueueMovement } from "../queueView";

export default function CancelNaturalMovementModal({
  movement,
  grouped,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  movement: QueueMovement;
  grouped: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy && reason.trim()) onConfirm(reason.trim());
  };
  return (
    <Modal title={`Cancelar solicitud #${movement.id}`} onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          La solicitud de la locomotora <strong>{movement.locomotiveNumber}</strong> quedará
          registrada como cancelada, saldrá de la fila activa y no continuará.
        </p>
        <p className="text-sm text-slate-700 dark:text-slate-200">
          Su historial se conservará. Cancelar no resuelve los incidentes pendientes.
        </p>
        {grouped && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Se cancelará únicamente esta solicitud. Las demás solicitudes del conjunto continuarán
            en la cola.
          </p>
        )}
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Motivo de cancelación
          <textarea
            required
            maxLength={1000}
            disabled={busy}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700"
          >
            Conservar solicitud
          </button>
          <button
            type="submit"
            disabled={busy || !reason.trim()}
            className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Cancelando…" : "Confirmar cancelación"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
