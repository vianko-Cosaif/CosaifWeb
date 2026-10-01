// /components/EditRondas.tsx
'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight, X, CheckCircle, XCircle, Info, Ban, LayoutList, GripVertical
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

import {
  useRondaData,
  Ronda,
  InfoExtra,
  apiSwapMovimientos,
  apiCancelarMovimiento
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
  onCancelRequest,
  isCancelling,
}: {
  ronda: Ronda;
  info?: InfoExtra;
  onSwapRequest: () => void;
  onCancelRequest: () => void;
  isCancelling: boolean;
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
    <div ref={setNodeRef} style={style} className="touch-none">
      <RondaCardContent
        ronda={ronda}
        info={info}
        onSwapRequest={onSwapRequest}
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
  onCancelRequest,
  isCancelling,
  dragHandleProps,
}: {
  ronda: Ronda;
  info?: InfoExtra;
  onSwapRequest?: () => void;
  onCancelRequest?: () => void;
  isCancelling?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const [open, setOpen] = useState(false);
  const badgeClass = priorityBadge(ronda.movimiento?.prioridad);

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
          <button
            onClick={() => setOpen(!open)}
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
              onClick={onCancelRequest}
              disabled={isCancelling}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${isCancelling
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10'
                }`}
            >
              {isCancelling ? <span className="animate-spin">⏳</span> : <Ban size={14} />}
              Cancelar
            </button>
            <button
              onClick={onSwapRequest}
              className="px-3 py-1.5 rounded text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeftRight size={14} /> Mover
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
            Confirmar Cambio
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================== Main Component ================== */
type Props = {
  localidadId: number | string;
  onClose: () => void;
  onSaved?: () => void;
};

const EditRondas: React.FC<Props> = ({ localidadId, onClose }) => {
  const {
    user, infoMap, loading, groupedByRonda, setGroupedByRonda, setList
  } = useRondaData(Number(localidadId), onClose);

  const [originalState, setOriginalState] = useState<Record<number, Ronda[]>>({});

  useEffect(() => {
    if (!loading && Object.keys(groupedByRonda).length > 0 && Object.keys(originalState).length === 0) {
      setOriginalState(JSON.parse(JSON.stringify(groupedByRonda)));
    }
  }, [loading, groupedByRonda, originalState]);

  const todasLasRondas = useMemo(() =>
    Object.values(groupedByRonda).flat().sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden),
    [groupedByRonda]
  );

  const hasRealChanges = useMemo(() => {
    // Comparar estructura profunda
    return Object.keys(originalState).length > 0 && JSON.stringify(groupedByRonda) !== JSON.stringify(originalState)
  }, [groupedByRonda, originalState]);

  const [swapModal, setSwapModal] = useState<{ visible: boolean; base: Ronda | null }>({ visible: false, base: null });
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [themeKey, setThemeKey] = useState(0);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);

  const showToast = (m: string) => setToast({ show: true, message: m });

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
    // if (hasRealChanges) { alert('Guarda los cambios antes de continuar.'); return; } // Allow swap? No, complex state.
    setSwapModal({ visible: true, base: ronda });
  }, []);

  const handleSwap = useCallback(async (otra: Ronda) => {
    const base = swapModal.base;
    if (!base || !otra || !user) return;
    try {
      await apiSwapMovimientos(base.id, otra.id);
      const swappedA: Ronda = { ...base, movimiento: { ...otra.movimiento } };
      const swappedB: Ronda = { ...otra, movimiento: { ...base.movimiento } };

      setGroupedByRonda((prev) => {
        const copy = { ...prev };
        copy[swappedA.rondaNumero] = (copy[swappedA.rondaNumero] || []).map((r) => (r.id === swappedA.id ? swappedA : r));
        copy[swappedB.rondaNumero] = (copy[swappedB.rondaNumero] || []).map((r) => (r.id === swappedB.id ? swappedB : r));
        return copy;
      });
      setList((prev) => prev.map((r) => (r.id === swappedA.id ? swappedA : r.id === swappedB.id ? swappedB : r)));
      showToast('Intercambio realizado exitosamente');
      setSwapModal({ visible: false, base: null });
    } catch (e: unknown) {
      console.error(e);
      alert(errorMessage(e, 'Error al intercambiar'));
    }
  }, [swapModal.base, setGroupedByRonda, setList, user]);

  const handleCancelRequest = useCallback(async (item: Ronda) => {
    if (!confirm('¿Cancelar este movimiento? Solo se permite si pertenece a tu empresa.')) return;
    try {
      const mid = item.movimiento?.id;
      if (!mid) throw new Error('ID inválido');
      setCancellingId(mid);
      await apiCancelarMovimiento(mid);

      setGroupedByRonda(prev => {
        const copy = { ...prev };
        const rn = item.rondaNumero;
        copy[rn] = (copy[rn] || []).filter(r => r.id !== item.id).map((r, i) => ({ ...r, orden: i + 1 }));
        return copy;
      });
      setList(prev => prev.filter(r => r.id !== item.id));
      showToast('Movimiento cancelado');
    } catch (e: unknown) {
      alert(errorMessage(e, 'Error al cancelar'));
    } finally {
      setCancellingId(null);
    }
  }, [setGroupedByRonda, setList]);


  // Drag End Handler - STRICT SWAP LOGIC (LIVE UPDATE)
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const activeId = Number(active.id);
    const overId = Number(over.id);

    if (activeId === overId) return;

    // Call API immediately
    try {
      await apiSwapMovimientos(activeId, overId);

      // Update local state ONLY on success (or optimistically revert on failure)
      // For now, we update local state optimistically or re-fetch?
      // Re-fetching is safer but potentially slower.
      // Optimistic update:

      setGroupedByRonda(prev => {
        // Find items
        let sourceRondaNum = -1;
        let destRondaNum = -1;
        let sourceItemIndex = -1;
        let destItemIndex = -1;
        let sourceItem: Ronda | undefined;
        let destItem: Ronda | undefined;

        for (const [rNum, items] of Object.entries(prev)) {
          const idx = items.findIndex(i => i.id === activeId);
          if (idx !== -1) {
            sourceRondaNum = Number(rNum);
            sourceItemIndex = idx;
            sourceItem = items[idx];
          }
          const idxOver = items.findIndex(i => i.id === overId);
          if (idxOver !== -1) {
            destRondaNum = Number(rNum);
            destItemIndex = idxOver;
            destItem = items[idxOver];
          }
        }

        if (!sourceItem || !destItem) return prev;

        const copy = { ...prev };
        const sourceList = [...(copy[sourceRondaNum] || [])];
        const destList = sourceRondaNum === destRondaNum ? sourceList : [...(copy[destRondaNum] || [])];

        const itemA = sourceList[sourceItemIndex];
        const itemB = destList[destItemIndex];

        // Swap their movement content but keep ID structure? 
        // Backend swap usually swaps movements between round IDs.
        // So Round ID 100 has Mov A, Round ID 200 has Mov B.
        // After swap: Round ID 100 has Mov B, Round ID 200 has Mov A.
        // The UI renders Rounds. So we swap the *data* inside the round objects.

        const tempMov = itemA.movimiento;
        itemA.movimiento = itemB.movimiento;
        itemB.movimiento = tempMov;

        // Force update lists
        copy[sourceRondaNum] = [...sourceList];
        if (sourceRondaNum !== destRondaNum) {
          copy[destRondaNum] = [...destList];
        }

        return copy;
      });

      showToast('Cambio realizado');
    } catch (e: unknown) {
      console.error(e);
      alert('Error al mover: ' + errorMessage(e, 'Error desconocido'));
      // Ideally refresh from server here if failed
      onClose(); // Close to force refresh? Or trigger refresh.
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(Number(event.active.id));
  };

  // Removed handleSaveChanges as we do live updates now.

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
      <div key={themeKey} className={`${THEME.surface} h-full max-h-[85vh] flex flex-col bg-white dark:bg-slate-900`}>
        {/* Header - Solid background to prevent overlapping issues */}
        <div className={`px-5 py-4 border-b ${THEME.border} flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-20`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <LayoutList size={20} />
            </div>
            <div>
              <h2 className={`text-lg font-bold leading-tight ${THEME.text}`}>Editor de Rondas</h2>
              <p className={`text-xs ${THEME.textMuted}`}>
                <span className="font-semibold text-blue-600 dark:text-blue-400">Arrastra desde los 6 puntos (⋮⋮)</span> para intercambiar lugares.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${THEME.surfaceAlt} p-4`}>
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
                      {section.items.map(r => (
                        <SortableRondaCard
                          key={r.id}
                          ronda={r}
                          info={infoMap[r.id]}
                          onSwapRequest={() => handleSwapRequest(r)}
                          onCancelRequest={() => handleCancelRequest(r)}
                          isCancelling={cancellingId === r.movimiento?.id}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              ))
            }
          </div>
        </div>


        {/* Footer */}
        <div className={`p-4 border-t ${THEME.border} ${THEME.surface} sticky bottom-0 z-20 flex justify-between items-center`}>
          <div className="text-xs text-slate-400 hidden sm:block">
            {hasRealChanges ? 'Cambios pendientes...' : 'Todo sincronizado'}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
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
              info={infoMap[activeItem.id]}
              isCancelling={false}
            />
          ) : null}
        </DragOverlay>

        <SwapModal
          visible={swapModal.visible}
          base={swapModal.base}
          candidatos={todasLasRondas}
          infoMap={infoMap}
          onConfirm={handleSwap}
          onClose={() => setSwapModal({ visible: false, base: null })}
        />
        <Toast show={toast.show} message={toast.message} onClose={() => setToast({ show: false, message: '' })} />
      </div>
    </DndContext>
  );
};

export default EditRondas;
