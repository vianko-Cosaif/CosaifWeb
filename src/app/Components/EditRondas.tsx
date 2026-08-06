// /components/EditRondas.tsx
'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight, X, CheckCircle, XCircle, Info, Ban, LayoutList, GripVertical,
  ChevronUp, ChevronDown, AlertTriangle
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GuidedTarget } from '@/app/Components/GuidedManualAtom';
import {
  TRAINING_ROUND_ID,
  useTrainingTour,
} from '@/app/Components/GuidedManualAtom/TrainingTourContext';

import {
  useRondaData,
  Ronda,
  InfoExtra,
  apiSwapMovimientos,
  apiCancelarMovimiento,
  apiOrdenMovimiento
} from '@/app/hooks/useEditRonda';
import { onThemeChange } from '@/lib/theme';

/* =================== Config UI Professional =================== */
const THEME = {
  primary: 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200',
  accent: 'text-blue-600 dark:text-blue-400',
  surface: 'bg-white dark:bg-[#161b22]',
  surfaceAlt: 'bg-slate-50 dark:bg-[#0d1117]',
  border: 'border-slate-200 dark:border-slate-800',
  text: 'text-slate-900 dark:text-slate-100',
  textMuted: 'text-slate-500 dark:text-slate-400',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  dangerSubtle: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20',
};

function priorityBadge(p?: string | null) {
  const key = (p || '').toLowerCase();
  const map: Record<string, string> = {
    alta: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
    media: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    baja: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  };
  return map[key] || 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function Toast({ show, message, onClose }: { show: boolean; message: string; onClose: () => void }) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [show, onClose]);
  if (!show) return null;
  return (
    <div className="fixed right-6 bottom-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 rounded-lg shadow-xl z-[100] text-sm font-medium flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in duration-200">
      <CheckCircle size={16} />
      {message}
    </div>
  );
}

function SectionHeader({ rondaNumero, count }: { rondaNumero: number; count: number }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-200 dark:border-slate-800 mb-3 mt-4 first:mt-0">
      <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md px-2 py-1 text-xs font-mono font-bold">
        #{rondaNumero}
      </div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex-1">
        Ronda {rondaNumero}
      </h3>
      <span className="text-xs text-slate-400 font-medium">
        {count} movimiento{count !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

/* =============== Sortable Card =============== */
function SortableRondaCard({
  ronda,
  info,
  onSwapRequest,
  onMoveStep,
  canMoveUp,
  canMoveDown,
  onCancelRequest,
  isCancelling,
  guideId,
}: {
  ronda: Ronda;
  info?: InfoExtra;
  onSwapRequest: () => void;
  onMoveStep: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onCancelRequest: () => void;
  isCancelling: boolean;
  guideId?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: ronda.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-none" data-guide-id={guideId}>
      <RondaCardContent
        ronda={ronda}
        info={info}
        onSwapRequest={onSwapRequest}
        onMoveStep={onMoveStep}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onCancelRequest={onCancelRequest}
        isCancelling={isCancelling}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function RondaCardContent({
  ronda,
  info,
  onSwapRequest,
  onMoveStep,
  canMoveUp,
  canMoveDown,
  onCancelRequest,
  isCancelling,
  dragHandleProps,
}: {
  ronda: Ronda;
  info?: InfoExtra;
  onSwapRequest?: () => void;
  onMoveStep?: (direction: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onCancelRequest?: () => void;
  isCancelling?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const [open, setOpen] = useState(false);
  const badgeClass = priorityBadge(ronda.movimiento?.prioridad);
  const isTorreon = ronda.source === 'torreon';

  return (
    <div className={`group relative rounded-lg border ${THEME.border} ${THEME.surface} p-3 mb-2 transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600`}>
      {/* Main Row */}
      <div className="flex items-start gap-3">
        {/* Left: Drag Handle */}
        <div
          className="flex flex-col items-center justify-center gap-1 min-w-[2rem] pt-2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400"
          {...dragHandleProps}
        >
          <GripVertical size={20} />
        </div>

        {/* Center: Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {ronda.movimiento?.title}
            </h4>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}>
              {ronda.movimiento?.prioridad || 'NORMAL'}
            </span>
            <span className="text-[10px] font-mono text-slate-400 ml-auto">Ord: {ronda.orden}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-600 dark:text-slate-300">
              LOC-{ronda.movimiento?.locomotiveNumber ?? '—'}
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="truncate">{info?.empresa?.nombre}</span>
          </div>

          {/* Route Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/50 rounded p-2 border border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block mb-0.5">Origen</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                {ronda.movimiento?.viaOrigen?.nombre || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block mb-0.5">Destino</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                {ronda.movimiento?.viaDestino?.nombre || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col gap-1">
          {onMoveStep ? (
            <>
              <button
                data-guide-id="round-move-up"
                type="button"
                onClick={() => onMoveStep(-1)}
                disabled={!canMoveUp}
                title="Subir una posición"
                aria-label={`Subir ${locomotiveLabel(ronda)} una posición`}
                className="rounded-md border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronUp size={15} />
              </button>
              <button
                data-guide-id="round-move-down"
                type="button"
                onClick={() => onMoveStep(1)}
                disabled={!canMoveDown}
                title="Bajar una posición"
                aria-label={`Bajar ${locomotiveLabel(ronda)} una posición`}
                className="rounded-md border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronDown size={15} />
              </button>
            </>
          ) : null}
          <button
            data-guide-id="round-show-actions"
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Ocultar acciones del movimiento' : 'Mostrar acciones del movimiento'}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            {open ? <X size={16} /> : <Info size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {open && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-2 gap-4 text-xs mb-3">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              {ronda.movimiento?.lavado
                ? <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle size={14} /> Lavado</span>
                : <span className="flex items-center gap-1 text-slate-400"><XCircle size={14} /> Lavado</span>}
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              {ronda.movimiento?.torno
                ? <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle size={14} /> Torno</span>
                : <span className="flex items-center gap-1 text-slate-400"><XCircle size={14} /> Torno</span>}
            </div>
          </div>

          {ronda.movimiento?.description && (
            <div className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-2 mb-3">
              {ronda.movimiento.description}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              data-guide-id="round-cancel-movement"
              type="button"
              onClick={onCancelRequest}
              disabled={isCancelling || isTorreon}
              title={isTorreon ? 'Movimiento de Torreon en solo lectura' : undefined}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${isCancelling
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : isTorreon
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500'
                : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10'
                }`}
            >
              {isCancelling ? <span className="animate-spin">⏳</span> : <Ban size={14} />}
              Quitar y cancelar
            </button>
            <button
              data-guide-id="round-change-position"
              type="button"
              onClick={onSwapRequest}
              disabled={isTorreon}
              title={isTorreon ? 'Ronda de Torreon en solo lectura' : undefined}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${isTorreon
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200'
              }`}
            >
              <ArrowLeftRight size={14} /> Cambiar posición
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Swap Modal ================= */
function SwapModal({
  visible, base, candidatos, infoMap, onConfirm, onClose
}: {
  visible: boolean;
  base: Ronda | null;
  candidatos: Ronda[];
  infoMap: Record<number, InfoExtra>;
  onConfirm: (target: Ronda) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Ronda | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => { if (visible) { setSelected(null); setFilter(''); } }, [visible]);

  if (!visible || !base) return null;

  const filtered = candidatos
    .filter(c => c.id !== base.id)
    .filter(c => {
      if (!filter) return true;
      const s = filter.toLowerCase();
      const info = infoMap[c.id];
      return (
        c.movimiento?.locomotiveNumber?.toString().includes(s) ||
        c.movimiento?.title?.toLowerCase().includes(s) ||
        info?.empresa?.nombre?.toLowerCase().includes(s)
      );
    });

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-2xl ${THEME.surface} rounded-lg shadow-2xl border ${THEME.border} flex flex-col max-h-[85vh]`}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Seleccionar intercambio</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={20} /></button>
        </div>

        <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <input
            type="text"
            placeholder="Filtrar por locomotora..."
            className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.map(item => {
            const active = selected?.id === item.id;
            const info = infoMap[item.id];
            return (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className={`w-full text-left p-3 rounded-md border transition-all flex items-center gap-3 ${active
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10 ring-1 ring-blue-500'
                  : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
              >
                <div className="bg-slate-100 dark:bg-slate-700 text-slate-500 text-xs font-mono px-2 py-1 rounded">
                  Loc-{item.movimiento?.locomotiveNumber || '?'}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {item.movimiento?.title}
                  </div>
                  <div className="text-xs text-slate-500 flex gap-2">
                    <span className="font-semibold">Ronda {item.rondaNumero}</span>
                    <span>•</span>
                    {info?.empresa?.nombre}
                  </div>
                </div>
                {active && <CheckCircle size={18} className="text-blue-600 dark:text-blue-400" />}
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">No se encontraron resultados</div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            Cancelar
          </button>
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected}
            className={`px-4 py-2 rounded-md text-sm font-semibold shadow-sm transition-all ${selected
              ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
              }`}
          >
            Revisar cambio
          </button>
        </div>
      </div>
    </div>
  );
}

type PendingRoundEdit = {
  active: Ronda;
  target: Ronda;
  kind: 'swap' | 'torreon-order';
  targetOrder: number;
};

function locomotiveLabel(item: Ronda) {
  const number = item.movimiento?.locomotiveNumber;
  return number == null || String(number).trim() === '' ? item.movimiento?.title || 'Movimiento' : `LOC-${number}`;
}

function movementTechnicalId(item: Ronda) {
  const value = Number(item.movimiento?.idTecnico ?? item.movimientoId ?? item.movimiento?.id);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function RoundEditConfirmModal({
  pending,
  busy,
  onConfirm,
  onClose,
}: {
  pending: PendingRoundEdit | null;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!pending) return null;

  const isOrderChange = pending.kind === 'torreon-order';
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-round-edit-title">
      <div className={`w-full max-w-lg rounded-xl border ${THEME.border} ${THEME.surface} shadow-2xl`}>
        <div className="flex items-start gap-3 p-5">
          <div className="rounded-full bg-amber-100 p-2 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-round-edit-title" className={`text-base font-bold ${THEME.text}`}>Confirmar edición de la ronda</h3>
            <p className={`mt-2 text-sm leading-6 ${THEME.textMuted}`}>
              {isOrderChange
                ? <>Vas a mover <strong className={THEME.text}>{locomotiveLabel(pending.active)}</strong> de la posición {pending.active.orden} a la posición {pending.targetOrder} en la ronda {pending.active.rondaNumero}.</>
                : <>Vas a intercambiar la posición de <strong className={THEME.text}>{locomotiveLabel(pending.active)}</strong> con <strong className={THEME.text}>{locomotiveLabel(pending.target)}</strong>.</>}
            </p>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              Al aceptar, el nuevo orden se guardará inmediatamente.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 p-4 dark:border-slate-800">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:text-white">
            Volver
          </button>
          <GuidedTarget id="round-edit-confirm-action" className="inline-flex">
            <button type="button" onClick={onConfirm} disabled={busy} className={`rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${THEME.primary}`}>
              {busy ? 'Guardando...' : 'Sí, editar la ronda'}
            </button>
          </GuidedTarget>
        </div>
      </div>
    </div>
  );
}

function CancelMovementModal({
  item,
  busy,
  onConfirm,
  onClose,
}: {
  item: Ronda | null;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (item) setReason('');
  }, [item]);

  if (!item) return null;
  const validReason = reason.trim().length >= 3;

  return (
    <GuidedTarget id="round-cancel-dialog" className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="cancel-movement-title" className={`w-full max-w-lg rounded-xl border ${THEME.border} ${THEME.surface} shadow-2xl`}>
        <div className="flex items-start gap-3 p-5">
          <div className="rounded-full bg-red-100 p-2 text-red-700 dark:bg-red-500/15 dark:text-red-400">
            <Ban size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="cancel-movement-title" className={`text-base font-bold ${THEME.text}`}>Quitar movimiento de la ronda</h3>
            <p className={`mt-2 text-sm leading-6 ${THEME.textMuted}`}>
              Vas a quitar <strong className={THEME.text}>{locomotiveLabel(item)}</strong> de la ronda {item.rondaNumero} y el movimiento completo quedará en estado <strong className="text-red-600 dark:text-red-400">CANCELADO</strong>.
            </p>
            <label className={`mt-4 block text-xs font-bold uppercase tracking-wide ${THEME.textMuted}`} htmlFor="movement-cancel-reason">
              Motivo de cancelación
            </label>
            <textarea
              id="movement-cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
              rows={3}
              autoFocus
              placeholder="Escribe por qué se cancela este movimiento"
              className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">Esta acción modifica el movimiento; no sólo lo oculta de la ronda.</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 p-4 dark:border-slate-800">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:text-white">
            No, regresar
          </button>
          <GuidedTarget id="round-cancel-confirm-action" className="inline-flex">
            <button type="button" onClick={() => onConfirm(reason.trim())} disabled={busy || !validReason} className={`rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${THEME.danger}`}>
              {busy ? 'Cancelando...' : 'Sí, cancelar y quitar'}
            </button>
          </GuidedTarget>
        </div>
      </div>
    </GuidedTarget>
  );
}

/* ================== Main Component ================== */
type Props = {
  localidadId: number | string;
  onClose: () => void;
  onSaved?: () => void;
};

const EditRondas: React.FC<Props> = ({ localidadId, onClose, onSaved }) => {
  const trainingTour = useTrainingTour();
  const {
    infoMap, loading, groupedByRonda, setGroupedByRonda, setList
  } = useRondaData(Number(localidadId), onClose);

  const todasLasRondas = useMemo(() =>
    Object.values(groupedByRonda).flat().sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden),
    [groupedByRonda]
  );

  const [swapModal, setSwapModal] = useState<{ visible: boolean; base: Ronda | null }>({ visible: false, base: null });
  const [pendingRoundEdit, setPendingRoundEdit] = useState<PendingRoundEdit | null>(null);
  const [savingRoundEdit, setSavingRoundEdit] = useState(false);
  const [cancelItem, setCancelItem] = useState<Ronda | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [themeKey, setThemeKey] = useState(0);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [didSave, setDidSave] = useState(false);
  const roundEditLockRef = useRef(false);
  const cancelLockRef = useRef(false);

  const trainingRounds = useMemo<Ronda[]>(() => {
    if (!trainingTour.active) return [];
    const movementById = new Map(trainingTour.movements.map((movement) => [movement.id, movement]));
    return trainingTour.roundOrder.reduce<Ronda[]>((rounds, movementId, index) => {
        const movement = movementById.get(movementId);
        if (!movement || movement.finalizado || ["CONCLUIDO", "CANCELADO"].includes(String(movement.estado).toUpperCase())) return rounds;
        rounds.push({
          id: TRAINING_ROUND_ID + index,
          rondaNumero: 99,
          orden: index + 1,
          concluido: false,
          source: 'training',
          empresa: { id: movement.empresaId, nombre: movement.empresaNombre || 'Empresa de capacitación' },
          movimientoId: movement.id,
          createdAt: movement.fechaSolicitud,
          movimiento: {
            id: movement.id,
            idTecnico: movement.id,
            folioLocalidad: movement.folioLocalidad,
            folioLocalidadLabel: movement.folioLocalidadLabel,
            title: movement.folioLocalidadLabel || `SIM-${movement.id}`,
            description: movement.instrucciones,
            prioridad: movement.prioridad === 'ALTA' ? 'ALTA' : 'BAJA',
            locomotiveNumber: movement.locomotora,
            viaOrigen: { nombre: String(movement.viaOrigen || '—') },
            viaDestino: { nombre: String(movement.viaDestino || '—') },
            lavado: movement.lavado,
            torno: movement.torno,
            estado: movement.estado,
            instrucciones: movement.instrucciones,
          },
        });
        return rounds;
      }, []);
  }, [trainingTour.active, trainingTour.movements, trainingTour.roundOrder]);

  useEffect(() => {
    if (!trainingTour.active || loading) return;
    setGroupedByRonda((previous) => ({ ...previous, 99: trainingRounds }));
    setList((previous) => [
      ...previous.filter((item) => item.source !== 'training'),
      ...trainingRounds,
    ]);
  }, [loading, setGroupedByRonda, setList, trainingRounds, trainingTour.active]);

  const displayedInfoMap = useMemo(() => {
    const extra = { ...infoMap };
    trainingRounds.forEach((round) => {
      extra[round.id] = {
        empresa: round.empresa || { id: 0, nombre: 'Empresa de capacitación' },
        movimiento: {
          id: round.movimiento?.id,
          viaOrigen: { nombre: round.movimiento?.viaOrigen?.nombre || '—' },
          viaDestino: { nombre: round.movimiento?.viaDestino?.nombre || null },
          lavado: Boolean(round.movimiento?.lavado),
          torno: Boolean(round.movimiento?.torno),
          estado: round.movimiento?.estado,
          prioridad: round.movimiento?.prioridad,
          locomotiveNumber: round.movimiento?.locomotiveNumber,
        },
      };
    });
    return extra;
  }, [infoMap, trainingRounds]);

  const showToast = useCallback((message: string) => setToast({ show: true, message }), []);
  const closeEditor = useCallback(() => {
    if (didSave && onSaved) {
      onSaved();
      return;
    }
    onClose();
  }, [didSave, onClose, onSaved]);

  useEffect(() => {
    const unsubscribe = onThemeChange(() => setThemeKey(prev => prev + 1));
    return unsubscribe;
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /* ===== Actions ===== */
  const handleSwapRequest = useCallback((ronda: Ronda) => {
    if (trainingTour.active && !trainingTour.isTrainingMovement(movementTechnicalId(ronda))) {
      alert('En capacitación sólo puedes seleccionar registros SIM.');
      return;
    }
    if (ronda.source === 'torreon') {
      alert('En esta ronda usa las flechas o arrastra el movimiento a su nueva posición.');
      return;
    }
    setSwapModal({ visible: true, base: ronda });
  }, [trainingTour]);

  const handleSwap = useCallback((otra: Ronda) => {
    const base = swapModal.base;
    if (!base || !otra) return;
    if (trainingTour.active && (
      !trainingTour.isTrainingMovement(movementTechnicalId(base))
      || !trainingTour.isTrainingMovement(movementTechnicalId(otra))
    )) {
      alert('En capacitación sólo puedes intercambiar registros SIM.');
      setSwapModal({ visible: false, base: null });
      return;
    }
    if (otra.source === 'torreon') {
      alert('No se puede intercambiar una ronda normal con una ronda de Torreón.');
      return;
    }
    setSwapModal({ visible: false, base: null });
    setPendingRoundEdit({ active: base, target: otra, kind: 'swap', targetOrder: otra.orden });
  }, [swapModal.base, trainingTour]);

  const requestMoveStep = useCallback((item: Ronda, direction: -1 | 1) => {
    if (trainingTour.active && !trainingTour.isTrainingMovement(movementTechnicalId(item))) {
      alert('En capacitación sólo puedes mover registros SIM.');
      return;
    }
    const currentList = [...(groupedByRonda[item.rondaNumero] || [])]
      .sort((a, b) => a.orden - b.orden || a.id - b.id);
    const currentIndex = currentList.findIndex((candidate) => candidate.id === item.id);
    const targetIndex = currentIndex + direction;
    const target = currentList[targetIndex];
    if (currentIndex < 0 || !target) return;
    if (trainingTour.active && !trainingTour.isTrainingMovement(movementTechnicalId(target))) {
      alert('En capacitación el destino también debe ser un registro SIM.');
      return;
    }

    setPendingRoundEdit({
      active: item,
      target,
      kind: item.source === 'torreon' ? 'torreon-order' : 'swap',
      targetOrder: targetIndex + 1,
    });
  }, [groupedByRonda, trainingTour]);

  const confirmRoundEdit = useCallback(async () => {
    if (!pendingRoundEdit || roundEditLockRef.current) return;
    roundEditLockRef.current = true;
    const { active, target, kind, targetOrder } = pendingRoundEdit;
    setSavingRoundEdit(true);

    try {
      if (trainingTour.active) {
        const activeMovementId = movementTechnicalId(active);
        const targetMovementId = movementTechnicalId(target);
        if (!trainingTour.isTrainingMovement(activeMovementId) || !trainingTour.isTrainingMovement(targetMovementId)) {
          alert('En capacitación selecciona únicamente registros SIM. No se modificó ninguna ronda real.');
          setPendingRoundEdit(null);
          return;
        }
        const currentList = [...(groupedByRonda[active.rondaNumero] || [])]
          .sort((a, b) => a.orden - b.orden || a.id - b.id);
        const oldIndex = currentList.findIndex((item) => item.id === active.id);
        const newIndex = Math.max(0, Math.min(targetOrder - 1, currentList.length - 1));
        if (oldIndex < 0) throw new Error('No se encontró el registro SIM en la ronda');
        const nextList = [...currentList];
        const [moved] = nextList.splice(oldIndex, 1);
        nextList.splice(newIndex, 0, moved);
        const normalized = nextList.map((item, index) => ({ ...item, orden: index + 1 }));
        const byId = new Map(normalized.map((item) => [item.id, item]));
        setGroupedByRonda((previous) => ({ ...previous, [active.rondaNumero]: normalized }));
        setList((previous) => previous.map((item) => byId.get(item.id) ?? item));
        trainingTour.reorderMovements(
          normalized
            .map(movementTechnicalId)
            .filter((id): id is number => Boolean(id && trainingTour.isTrainingMovement(id)))
        );
        setDidSave(true);
        setPendingRoundEdit(null);
        showToast('Orden SIM actualizado sólo en capacitación');
        return;
      }
      if (kind === 'torreon-order') {
        await apiOrdenMovimiento(active.id, targetOrder, localidadId, { sandbox: trainingTour.active });
        const currentList = [...(groupedByRonda[active.rondaNumero] || [])]
          .sort((a, b) => a.orden - b.orden || a.id - b.id);
        const oldIndex = currentList.findIndex((item) => item.id === active.id);
        const newIndex = Math.max(0, Math.min(targetOrder - 1, currentList.length - 1));
        if (oldIndex < 0) throw new Error('No se encontró el movimiento en la ronda');
        const nextList = [...currentList];
        const [moved] = nextList.splice(oldIndex, 1);
        nextList.splice(newIndex, 0, moved);
        const normalized = nextList.map((item, index) => ({ ...item, orden: index + 1 }));
        const byId = new Map(normalized.map((item) => [item.id, item]));

        setGroupedByRonda((prev) => ({ ...prev, [active.rondaNumero]: normalized }));
        setList((prev) => prev.map((item) => byId.get(item.id) ?? item));
        showToast('Orden de la ronda actualizado');
      } else {
        await apiSwapMovimientos(active.id, target.id, localidadId, { sandbox: trainingTour.active });
        const swapMovement = (item: Ronda): Ronda => {
          if (item.id === active.id) {
            return {
              ...item,
              movimiento: { ...target.movimiento },
              movimientoId: target.movimientoId ?? movementTechnicalId(target),
              empresa: target.empresa ?? item.empresa,
            };
          }
          if (item.id === target.id) {
            return {
              ...item,
              movimiento: { ...active.movimiento },
              movimientoId: active.movimientoId ?? movementTechnicalId(active),
              empresa: active.empresa ?? item.empresa,
            };
          }
          return item;
        };

        setGroupedByRonda((prev) => Object.fromEntries(
          Object.entries(prev).map(([roundNumber, items]) => [roundNumber, items.map(swapMovement)])
        ));
        setList((prev) => prev.map(swapMovement));
        showToast('Posiciones de la ronda actualizadas');
      }

      setDidSave(true);
      setPendingRoundEdit(null);
    } catch (e: unknown) {
      console.error(e);
      alert(errorMessage(e, 'No se pudo editar la ronda'));
    } finally {
      roundEditLockRef.current = false;
      setSavingRoundEdit(false);
    }
  }, [groupedByRonda, localidadId, pendingRoundEdit, setGroupedByRonda, setList, showToast, trainingTour]);

  const handleCancelRequest = useCallback((item: Ronda) => {
    if (trainingTour.active && !trainingTour.isTrainingMovement(movementTechnicalId(item))) {
      alert('En capacitación sólo puedes cancelar registros SIM.');
      return;
    }
    setCancelItem(item);
  }, [trainingTour]);

  const confirmCancelMovement = useCallback(async (reason: string) => {
    if (!cancelItem) return;
    const movimientoId = movementTechnicalId(cancelItem);
    if (!movimientoId) {
      alert('No se encontró el identificador técnico del movimiento.');
      return;
    }

    if (cancelLockRef.current) return;
    cancelLockRef.current = true;
    setCancellingId(movimientoId);
    try {
      if (trainingTour.active) {
        if (!trainingTour.isTrainingMovement(movimientoId)) {
          alert('En capacitación sólo puedes cancelar registros SIM. No se modificó ningún movimiento real.');
          setCancelItem(null);
          return;
        }
        trainingTour.cancelMovement(movimientoId, reason);
        const remaining = [...(groupedByRonda[cancelItem.rondaNumero] || [])]
          .filter((item) => item.id !== cancelItem.id)
          .sort((a, b) => a.orden - b.orden || a.id - b.id)
          .map((item, index) => ({ ...item, orden: index + 1 }));
        const byId = new Map(remaining.map((item) => [item.id, item]));
        setGroupedByRonda((previous) => ({ ...previous, [cancelItem.rondaNumero]: remaining }));
        setList((previous) => previous
          .filter((item) => item.id !== cancelItem.id)
          .map((item) => byId.get(item.id) ?? item));
        setDidSave(true);
        setCancelItem(null);
        showToast('SIM cancelado y retirado sólo de la capacitación');
        return;
      }
      await apiCancelarMovimiento(movimientoId, reason, localidadId, { sandbox: trainingTour.active });
      const remaining = [...(groupedByRonda[cancelItem.rondaNumero] || [])]
        .filter((item) => item.id !== cancelItem.id)
        .sort((a, b) => a.orden - b.orden || a.id - b.id)
        .map((item, index) => ({ ...item, orden: index + 1 }));
      const byId = new Map(remaining.map((item) => [item.id, item]));

      setGroupedByRonda((prev) => ({ ...prev, [cancelItem.rondaNumero]: remaining }));
      setList((prev) => prev
        .filter((item) => item.id !== cancelItem.id)
        .map((item) => byId.get(item.id) ?? item));
      setDidSave(true);
      setCancelItem(null);
      showToast('Movimiento cancelado y retirado de la ronda');
    } catch (e: unknown) {
      console.error(e);
      alert(errorMessage(e, 'No se pudo cancelar el movimiento'));
    } finally {
      cancelLockRef.current = false;
      setCancellingId(null);
    }
  }, [cancelItem, groupedByRonda, localidadId, setGroupedByRonda, setList, showToast, trainingTour]);

  // Arrastrar sólo prepara el cambio; la API se ejecuta después de confirmarlo.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;

    const activeId = Number(active.id);
    const overId = Number(over.id);
    if (activeId === overId) return;

    const activeItem = todasLasRondas.find((r) => r.id === activeId);
    const overItem = todasLasRondas.find((r) => r.id === overId);
    if (!activeItem || !overItem) return;

    if (trainingTour.active && (
      !trainingTour.isTrainingMovement(movementTechnicalId(activeItem))
      || !trainingTour.isTrainingMovement(movementTechnicalId(overItem))
    )) {
      alert('En capacitación sólo puedes arrastrar entre registros SIM.');
      return;
    }

    if (activeItem.source === 'torreon' || overItem.source === 'torreon') {
      if (activeItem.source !== 'torreon' || overItem.source !== 'torreon' || activeItem.rondaNumero !== overItem.rondaNumero) {
        alert('Torreón sólo permite reordenar dentro de su misma ronda.');
        return;
      }
      const currentList = [...(groupedByRonda[activeItem.rondaNumero] || [])]
        .sort((a, b) => a.orden - b.orden || a.id - b.id);
      const newIndex = currentList.findIndex((item) => item.id === overId);
      if (newIndex < 0) return;
      setPendingRoundEdit({ active: activeItem, target: overItem, kind: 'torreon-order', targetOrder: newIndex + 1 });
      return;
    }

    setPendingRoundEdit({ active: activeItem, target: overItem, kind: 'swap', targetOrder: overItem.orden });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(Number(event.active.id));
  };

  if (loading) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center p-8 text-slate-400">
        <div className="animate-spin mb-4"><LayoutList size={32} /></div>
        <p className="text-sm font-medium">Cargando tablero...</p>
      </div>
    );
  }

  const activeItem = activeDragId ? todasLasRondas.find(r => r.id === activeDragId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <GuidedTarget key={themeKey} id="dashboard-rounds-editor-panel" className={`${THEME.surface} h-full max-h-[85vh] flex flex-col bg-white dark:bg-slate-900`}>
        {trainingTour.active ? (
          <div className="border-b border-violet-300 bg-violet-50 px-5 py-2 text-xs font-black text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100">
            CAPACITACIÓN · Sólo las tarjetas SIM aceptan cambios; nunca se llamará al backend.
          </div>
        ) : null}
        {/* Header - Solid background to prevent overlapping issues */}
        <div className={`px-5 py-4 border-b ${THEME.border} flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-20`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <LayoutList size={20} />
            </div>
            <div>
              <h2 className={`text-lg font-bold leading-tight ${THEME.text}`}>Editor de Rondas</h2>
              <p className={`text-xs ${THEME.textMuted}`}>
                Arrastra desde los 6 puntos (⋮⋮) o usa las flechas. <span className="font-semibold text-blue-600 dark:text-blue-400">Siempre se pedirá confirmación.</span>
              </p>
            </div>
          </div>
          <button onClick={closeEditor} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors" aria-label="Cerrar editor de rondas">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <GuidedTarget id="dashboard-rounds-editor-list" className={`flex-1 overflow-y-auto ${THEME.surfaceAlt} p-4`}>
          <div className="max-w-3xl mx-auto">
            {Object.entries(groupedByRonda)
              .map(([r, items]) => ({ num: parseInt(r), items: [...items].sort((a, b) => a.orden - b.orden) }))
              .sort((a, b) => a.num - b.num)
              .map(section => (
                <div key={section.num} className="mb-6">
                  <SectionHeader rondaNumero={section.num} count={section.items.length} />
                  <SortableContext
                    items={section.items.map(i => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {section.items.map((r, index) => (
                        <SortableRondaCard
                          key={r.id}
                          ronda={r}
                          info={displayedInfoMap[r.id]}
                          onSwapRequest={() => handleSwapRequest(r)}
                          onMoveStep={(direction) => requestMoveStep(r, direction)}
                          canMoveUp={index > 0}
                          canMoveDown={index < section.items.length - 1}
                          onCancelRequest={() => handleCancelRequest(r)}
                          isCancelling={cancellingId === movementTechnicalId(r)}
                          guideId={trainingTour.isTrainingMovement(movementTechnicalId(r)) ? 'training-round-edit-row' : undefined}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              ))
            }
          </div>
        </GuidedTarget>


        {/* Footer */}
        <div className={`p-4 border-t ${THEME.border} ${THEME.surface} sticky bottom-0 z-20 flex justify-between items-center`}>
          <div className="text-xs text-slate-400 hidden sm:block">
            {didSave ? 'Cambios guardados correctamente' : 'Todo sincronizado'}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              onClick={closeEditor}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} />
              Listo / Cerrar
            </button>
          </div>
        </div>

        <DragOverlay>
          {activeItem ? (
            <RondaCardContent
              ronda={activeItem}
              info={displayedInfoMap[activeItem.id]}
              isCancelling={false}
            />
          ) : null}
        </DragOverlay>

        <SwapModal
          visible={swapModal.visible}
          base={swapModal.base}
          candidatos={todasLasRondas.filter((item) => item.source !== 'torreon')}
          infoMap={displayedInfoMap}
          onConfirm={handleSwap}
          onClose={() => setSwapModal({ visible: false, base: null })}
        />
        <RoundEditConfirmModal
          pending={pendingRoundEdit}
          busy={savingRoundEdit}
          onConfirm={confirmRoundEdit}
          onClose={() => setPendingRoundEdit(null)}
        />
        <CancelMovementModal
          item={cancelItem}
          busy={cancellingId !== null}
          onConfirm={confirmCancelMovement}
          onClose={() => setCancelItem(null)}
        />
        <Toast show={toast.show} message={toast.message} onClose={() => setToast({ show: false, message: '' })} />
      </GuidedTarget>
    </DndContext>
  );
};

export default EditRondas;
