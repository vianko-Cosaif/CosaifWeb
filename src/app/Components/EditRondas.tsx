// /components/EditRondas.tsx
'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight, MapPin, Save, X, CheckCircle, XCircle, Train, Info
} from 'lucide-react';
import { useRondaData, Ronda, InfoExtra, apiSwapMovimientos } from '@/app/hooks/useEditRonda';
import { onThemeChange, isDark } from '@/lib/theme';

/* =================== Config UI compacta con tema =================== */
const COLORS = {
  primary: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
  primaryDark: 'bg-blue-700 dark:bg-blue-600',
  success: 'bg-green-600 hover:bg-green-700 text-green-600 dark:bg-green-500 dark:hover:bg-green-600 dark:text-green-400',
  warning: 'bg-yellow-600 hover:bg-yellow-700 text-yellow-600 dark:bg-yellow-500 dark:hover:bg-yellow-600 dark:text-yellow-400',
  error: 'bg-red-600 hover:bg-red-700 text-red-600 dark:bg-red-500 dark:hover:bg-red-600 dark:text-red-400',
  text: 'text-slate-900 dark:text-slate-100',
  textSecondary: 'text-slate-600 dark:text-slate-400',
  border: 'border-slate-200 dark:border-slate-700',
  surface: 'bg-white dark:bg-slate-800',
  surfaceAlt: 'bg-slate-50 dark:bg-slate-700',
};

const DENSITY = {
  pad: 10,
  gap: 10,
  radius: 12,
  fontBase: 13,
  cardPad: 12,
};

function getRondaColor(n: number) {
  const palette = [
    ['from-purple-600 to-purple-400', 'bg-purple-500', 'text-purple-600 dark:text-purple-400'],
    ['from-blue-600 to-blue-400', 'bg-blue-500', 'text-blue-600 dark:text-blue-400'],
    ['from-cyan-600 to-cyan-400', 'bg-cyan-500', 'text-cyan-600 dark:text-cyan-400'],
    ['from-green-600 to-green-400', 'bg-green-500', 'text-green-600 dark:text-green-400'],
    ['from-yellow-600 to-yellow-400', 'bg-yellow-500', 'text-yellow-600 dark:text-yellow-400'],
    ['from-orange-600 to-orange-400', 'bg-orange-500', 'text-orange-600 dark:text-orange-400'],
    ['from-red-600 to-red-400', 'bg-red-500', 'text-red-600 dark:text-red-400'],
  ];
  const [gradient, bg, text] = palette[(n - 1) % palette.length];
  return {
    gradient: `bg-gradient-to-r ${gradient}`,
    bg,
    text,
  };
}

function priorityColors(p?: string | null) {
  const key = (p || '').toLowerCase();
  const map: Record<string, { color: string; bg: string; label: string }> = {
    alta: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', label: 'ALTA' },
    media: { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', label: 'MEDIA' },
    baja: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', label: 'BAJA' },
  };
  return map[key] || { color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-700', label: 'SIN PRIORIDAD' };
}

function Toast({ show, message, onClose }: { show: boolean; message: string; onClose: () => void }) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [show, onClose]);
  if (!show) return null;
  return (
    <div className="fixed right-4 bottom-4 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg z-50 text-sm font-semibold dark:bg-blue-500">
      {message}
    </div>
  );
}

function SectionHeader({ rondaNumero, count }: { rondaNumero: number; count: number }) {
  const color = getRondaColor(rondaNumero);
  return (
    <div className={`bg-gradient-to-r ${color.gradient} rounded-xl flex items-center justify-between p-3 text-white mb-2`}>
      <div className="flex items-center gap-3">
        <div className={`bg-white ${color.text} rounded-full w-8 h-8 grid place-items-center font-bold text-sm`}>
          {rondaNumero}
        </div>
        <div className="font-bold text-sm">Ronda {rondaNumero}</div>
      </div>
      <div className="bg-white/25 rounded-lg px-2 py-1 font-bold text-xs">
        {count}
      </div>
    </div>
  );
}

/* =============== Card compacta con detalles colapsables =============== */
function RondaCard({
  ronda, info, onSwapRequest,
}: {
  ronda: Ronda;
  info?: InfoExtra;
  onSwapRequest: () => void;
}) {
  const colors = getRondaColor(ronda.rondaNumero);
  const pr = priorityColors(ronda.movimiento?.prioridad as any);
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-xl p-3 shadow-sm mb-3`}>
      {/* Header compacto */}
      <div className="flex items-center gap-3">
        <div className={`${pr.bg} ${pr.color} rounded-lg px-2 py-1 text-xs font-bold`}>
          {pr.label}
        </div>
        <div className={` ${colors.text} rounded-lg px-2 py-1 font-bold text-xs text-center min-w-[2rem]`}>
          {ronda.orden}
        </div>
        <Train className={`${colors.text}`} size={16} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`${COLORS.text} font-bold text-sm whitespace-nowrap overflow-hidden text-ellipsis`}>
              {ronda.movimiento?.title}
            </div>
            <div className={`${colors.bg} text-white rounded-md px-2 py-1 font-bold text-xs`}>
              LOC-{ronda.movimiento?.locomotiveNumber ?? '—'}
            </div>
          </div>
          {ronda.movimiento?.date && (
            <div className={`${COLORS.textSecondary} text-xs mt-1`}>
              {ronda.movimiento?.date}
            </div>
          )}
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          title={open ? 'Ocultar detalles' : 'Ver detalles'}
          className={`border ${COLORS.border} bg-white dark:bg-slate-800 ${COLORS.textSecondary} px-2 py-1 rounded-lg text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700`}
        >
          {open ? '−' : '+'}
        </button>
      </div>

      {/* Línea principal muy compacta */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="flex gap-2 items-center min-w-0">
          <div className={`${colors.bg}/10 rounded-lg w-7 h-7 grid place-items-center`}>
            <MapPin className={`${colors.text}`} size={12} />
          </div>
          <div className="min-w-0">
            <div className={`${COLORS.textSecondary} text-xs`}>Origen</div>
            <div className={`${COLORS.text} font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis`}>
              {ronda.movimiento?.viaOrigen?.nombre || '—'}
            </div>
          </div>
        </div>

        <div className="flex gap-2 items-center min-w-0">
          <div className={`${colors.bg}/10 rounded-lg w-7 h-7 grid place-items-center`}>
            <MapPin className={`${colors.text}`} size={12} />
          </div>
          <div className="min-w-0">
            <div className={`${COLORS.textSecondary} text-xs`}>Destino</div>
            <div className={`${COLORS.text} font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis`}>
              {ronda.movimiento?.viaDestino?.nombre || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Detalles colapsables */}
      {open && (
        <div className="mt-3">
          {/* descripción */}
          {ronda.movimiento?.description && (
            <div className={`${COLORS.textSecondary} text-sm`}>
              {ronda.movimiento?.description}
            </div>
          )}

          {/* estados */}
          <div className="flex gap-4 mt-2">
            <span className={`inline-flex items-center gap-2 text-sm ${ronda.movimiento?.lavado ? 'text-green-600 dark:text-green-400' : COLORS.textSecondary}`}>
              {ronda.movimiento?.lavado ? <CheckCircle size={14} className="text-green-600 dark:text-green-400" /> : <XCircle size={14} className={COLORS.textSecondary} />}
              Lavado
            </span>
            <span className={`inline-flex items-center gap-2 text-sm ${ronda.movimiento?.torno ? 'text-green-600 dark:text-green-400' : COLORS.textSecondary}`}>
              {ronda.movimiento?.torno ? <CheckCircle size={14} className="text-green-600 dark:text-green-400" /> : <XCircle size={14} className={COLORS.textSecondary} />}
              Torno
            </span>
          </div>

          {/* extra */}
          {info && (
            <div className={`${COLORS.surfaceAlt} ${COLORS.border} border-dashed rounded-lg p-3 mt-3 text-sm`}>
              <div className={`${COLORS.text} font-bold mb-2`}>Detalles adicionales</div>
              <div className="flex gap-4 flex-wrap">
                <div><span className={COLORS.textSecondary}>Empresa: </span>{info.empresa?.nombre}</div>
                <div><span className={COLORS.textSecondary}>ID Movimiento: </span>{ronda.movimiento?.id ?? '—'}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* botón swap */}
      <div className="mt-3">
        <button
          onClick={onSwapRequest}
          className={`bg-blue-600 hover:bg-blue-700 text-white border-none rounded-full px-3 py-2 font-bold text-sm flex items-center gap-2 cursor-pointer dark:bg-blue-500 dark:hover:bg-blue-600`}
        >
          <ArrowLeftRight size={16} /> Cambiar de lugar
        </button>
      </div>
    </div>
  );
}

/* ================= Modal de swap compacto ================= */
function SwapModal({
  visible, base, candidatos, onConfirm, onClose
}: {
  visible: boolean;
  base: Ronda | null;
  candidatos: Ronda[];
  onConfirm: (target: Ronda) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Ronda | null>(null);
  useEffect(() => {
    if (visible) setSelected(null);
  }, [visible]);

  if (!visible || !base) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-[999] p-3"
    >
      <div className="w-full max-w-[860px] bg-white dark:bg-slate-800 rounded-xl p-3 shadow-2xl border border-slate-200 dark:border-slate-700 grid grid-rows-[auto_1fr_auto] max-h-[72vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-2">
          <div className="font-bold text-lg text-blue-600 dark:text-blue-400">
            ¿Con cuál deseas intercambiar?
          </div>
          <button
            onClick={onClose}
            title="Cerrar"
            className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        {/* Lista scrollable */}
        <div className="overflow-auto p-2">
          <div className="grid gap-2">
            {candidatos.filter(c => c.id !== base.id).map((item) => {
              const color = getRondaColor(item.rondaNumero);
              const active = selected?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className={`text-left border-2 rounded-lg p-3 cursor-pointer transition-all ${
                    active
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2 min-w-0">
                    <div className={`bg-gradient-to-r ${color.gradient} text-white rounded-md px-2 py-1 font-bold text-xs`}>
                      Ronda {item.rondaNumero}
                    </div>
                    <Train className={`${color.text}`} size={16} />
                    <div className={`${COLORS.text} font-bold text-sm whitespace-nowrap overflow-hidden text-ellipsis`}>
                      {item.movimiento?.title}
                    </div>
                    <div className={`bg-blue-600 text-white rounded-md px-2 py-1 font-bold text-xs ml-auto`}>
                      LOC-{item.movimiento?.locomotiveNumber ?? '—'}
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 text-xs flex-wrap ${COLORS.textSecondary}`}>
                    <MapPin className="text-green-600 dark:text-green-400" size={14} />
                    <span>{item.movimiento?.viaOrigen?.nombre || '¿?'}</span>
                    <span className="opacity-50">→</span>
                    <MapPin className="text-red-600 dark:text-red-400" size={14} />
                    <span>{item.movimiento?.viaDestino?.nombre || '¿?'}</span>
                    <span className={`ml-3 font-bold ${item.movimiento?.lavado ? 'text-green-600 dark:text-green-400' : COLORS.textSecondary}`}>
                      {item.movimiento?.lavado ? 'Lavado ✓' : 'Lavado ×'}
                    </span>
                    <span className={`font-bold ${item.movimiento?.torno ? 'text-green-600 dark:text-green-400' : COLORS.textSecondary}`}>
                      {item.movimiento?.torno ? 'Torno ✓' : 'Torno ×'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end p-2">
          <button
            onClick={onClose}
            className={`bg-white dark:bg-slate-800 ${COLORS.textSecondary} border ${COLORS.border} px-4 py-2 rounded-lg font-bold cursor-pointer text-sm hover:bg-slate-50 dark:hover:bg-slate-700`}
          >
            Cancelar
          </button>
          <button
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
            className={`px-4 py-2 rounded-lg font-bold cursor-pointer text-sm ${
              selected
                ? 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-500 dark:hover:bg-green-600'
                : `${COLORS.textSecondary} cursor-not-allowed`
            }`}
          >
            Cambiar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================== Componente principal ================== */
type Props = {
  localidadId: number | string;
  onClose: () => void;
  onSaved?: () => void;
};

const EditRondas: React.FC<Props> = ({ localidadId, onClose, onSaved }) => {
  const {
    user,
    list,
    infoMap,
    loading,
    groupedByRonda,
    setGroupedByRonda,
    setList,
  } = useRondaData(Number(localidadId), onClose);

  const [originalState, setOriginalState] = useState<Record<number, Ronda[]>>({});
  useEffect(() => {
    if (!loading && Object.keys(groupedByRonda).length > 0 && Object.keys(originalState).length === 0) {
      setOriginalState(JSON.parse(JSON.stringify(groupedByRonda)));
    }
  }, [loading, groupedByRonda, originalState]);

  const todasLasRondas = useMemo(
    () => Object.values(groupedByRonda).flat().sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden),
    [groupedByRonda]
  );

  const hasRealChanges = useMemo(
    () => Object.keys(originalState).length > 0 && JSON.stringify(groupedByRonda) !== JSON.stringify(originalState),
    [groupedByRonda, originalState]
  );

  const [swapModal, setSwapModal] = useState<{ visible: boolean; base: Ronda | null }>({ visible: false, base: null });
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [themeKey, setThemeKey] = useState(0); // Forzar re-render en cambios de tema

  const showToast = (m: string) => setToast({ show: true, message: m });

  // Escuchar cambios de tema y forzar re-render
  useEffect(() => {
    const unsubscribe = onThemeChange(() => {
      setThemeKey(prev => prev + 1);
    });
    return unsubscribe;
  }, []);

  const handleSwapRequest = useCallback((ronda: Ronda) => {
    if (hasRealChanges) {
      alert('Debes guardar los cambios actuales antes de realizar otra modificación.');
      return;
    }
    setSwapModal({ visible: true, base: ronda });
  }, [hasRealChanges]);

  const handleSwap = useCallback(async (otra: Ronda) => {
    const base = swapModal.base;
    if (!base || !otra || !user) return;

    try {
      await apiSwapMovimientos(base.id, otra.id);

      // swap local: solo movimiento
      const swappedA: Ronda = { ...base, movimiento: { ...otra.movimiento } };
      const swappedB: Ronda = { ...otra, movimiento: { ...base.movimiento } };

      setGroupedByRonda((prev) => {
        const copy = { ...prev };
        copy[swappedA.rondaNumero] = (copy[swappedA.rondaNumero] || []).map((r) => (r.id === swappedA.id ? swappedA : r));
        copy[swappedB.rondaNumero] = (copy[swappedB.rondaNumero] || []).map((r) => (r.id === swappedB.id ? swappedB : r));
        return copy;
      });

      setList((prev) => prev.map((r) => (r.id === swappedA.id ? swappedA : r.id === swappedB.id ? swappedB : r)));

      showToast(
        `Intercambiadas: ${base.movimiento?.title ?? `Ronda ${base.orden}`} ↔ ${otra.movimiento?.title ?? `Ronda ${otra.orden}`}`
      );
      setSwapModal({ visible: false, base: null });
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Ocurrió un error al intercambiar las rondas');
    }
  }, [swapModal.base, setGroupedByRonda, setList, user]);

  const handleSaveChanges = useCallback(async () => {
    if (!hasRealChanges) {
      alert('No hay cambios para guardar');
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
    showToast('Cambios guardados exitosamente');
    setOriginalState(JSON.parse(JSON.stringify(groupedByRonda)));
    setTimeout(() => {
      onSaved?.();
      onClose?.();
    }, 650);
  }, [hasRealChanges, groupedByRonda, onSaved, onClose]);

  /* ===== Loading compacto ===== */
  if (loading) {
    return (
      <div className="min-h-[40vh] grid place-items-center">
        <div className={`text-center ${COLORS.textSecondary}`}>
          <div className={`font-bold text-lg ${COLORS.text} mb-1`}>Cargando rondas…</div>
          <div className="text-sm">Obteniendo información. Por favor espera…</div>
        </div>
      </div>
    );
  }

  /* ===== Layout compacto: header sticky, body scrollable, footer sticky ===== */
  return (
    <div key={themeKey} className="bg-slate-50 dark:bg-slate-900 grid grid-rows-[auto_auto_1fr_auto] max-h-[80vh]">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-green-800 dark:from-emerald-500 dark:via-emerald-600 dark:to-green-700 text-white p-4 sticky top-0 z-10 shadow-lg backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-2 border border-white/30">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg tracking-tight">Editor de Rondas</h2>
              <p className="text-white/80 text-sm font-medium">Gestiona las locomotoras y sus rondas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Cerrar editor"
            className="bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white border border-white/30 px-4 py-2 rounded-xl font-semibold cursor-pointer text-sm transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Instrucciones (compacto) */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 flex items-center gap-2 text-sm">
        <Info className="text-sky-500" size={16} />
        <div className={`${COLORS.text}`}>
          Usa <b>“Cambiar de lugar”</b> para intercambiar la locomotora con otra de cualquier ronda.
        </div>
      </div>

      {/* Body scrollable */}
      <div className="overflow-auto">
        <div className="max-w-4xl mx-auto p-3">
          {Object.entries(groupedByRonda)
            .map(([rondaNum, items]) => ({
              rondaNumero: parseInt(rondaNum),
              items: [...items].sort((a, b) => a.orden - b.orden),
            }))
            .sort((a, b) => a.rondaNumero - b.rondaNumero)
            .map((section) => (
              <div key={section.rondaNumero} className="mb-4">
                <SectionHeader rondaNumero={section.rondaNumero} count={section.items.length} />
                {section.items.map((r) => (
                  <RondaCard
                    key={r.id}
                    ronda={r}
                    info={infoMap[r.id]}
                    onSwapRequest={() => handleSwapRequest(r)}
                  />
                ))}
              </div>
            ))}
        </div>
      </div>

      {/* Footer actions */}
      <div className={`bg-white dark:bg-slate-800 border-t ${COLORS.border} p-3 flex justify-center gap-3 sticky bottom-0`}>
        <button
          onClick={onClose}
          className={`bg-white dark:bg-slate-800 ${COLORS.textSecondary} border ${COLORS.border} px-4 py-2 rounded-lg font-bold cursor-pointer text-sm hover:bg-slate-50 dark:hover:bg-slate-700`}
        >
          Cancelar
        </button>
        <button
          onClick={handleSaveChanges}
          disabled={!hasRealChanges}
          className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 ${
            hasRealChanges
              ? 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-500 dark:hover:bg-green-600'
              : `${COLORS.textSecondary} cursor-not-allowed`
          }`}
        >
          <Save size={16} /> {hasRealChanges ? 'Guardar cambios' : 'Sin cambios'}
        </button>
      </div>

      <SwapModal
        visible={swapModal.visible}
        base={swapModal.base}
        candidatos={todasLasRondas}
        onConfirm={handleSwap}
        onClose={() => setSwapModal({ visible: false, base: null })}
      />

      <Toast show={toast.show} message={toast.message} onClose={() => setToast({ show: false, message: '' })} />
    </div>
  );
};

export default EditRondas;
