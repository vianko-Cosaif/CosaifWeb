"use client";

import React from 'react';
import { LocomotiveWheelMap } from './LocomotiveWheelMap';
import { getStatusFill, getStatusLabel, getStatusStroke, resolveLabels, resolveTheme } from './core/theme';
import { useLocomotiveWheelSelector } from './core/useLocomotiveWheelSelector';
import { SUPPORTED_WHEEL_COUNTS } from './core/wheelFactory';
import {
  LocomotiveViewMode,
  LocomotiveWheelSelectorBaseProps,
  WheelCount,
  WheelVisualStatus,
} from './core/types';

const VIEWS: { key: LocomotiveViewMode; labelKey: 'topView' | 'leftView' | 'rightView' }[] = [
  { key: 'top', labelKey: 'topView' },
  { key: 'left', labelKey: 'leftView' },
  { key: 'right', labelKey: 'rightView' },
];

function StatusBadge({ status, labels, theme }: {
  status: WheelVisualStatus;
  labels: ReturnType<typeof resolveLabels>;
  theme: ReturnType<typeof resolveTheme>;
}) {
  const strokeColor = getStatusStroke(theme, status);
  const fillColor = getStatusFill(theme, status);
  return (
    <div
      className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full border text-xs font-extrabold"
      style={{
        borderColor: strokeColor,
        backgroundColor: fillColor,
        color: strokeColor,
      }}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: strokeColor }}
      />
      {getStatusLabel(labels, status)}
    </div>
  );
}

export function LocomotiveWheelSelector(props: LocomotiveWheelSelectorBaseProps) {
  const {
    disabled = false,
    showWheelCountSwitcher = true,
    showViewSwitcher = true,
    showLegend = true,
    showInstructions = true,
    title,
    orderCode = 'OD-2026-1187',
    operatorName = 'Juan Pérez',
    wheels = [],
    theme: customTheme,
    labels: customLabels,
    orientation = 'vertical',
  } = props;

  const theme = resolveTheme(customTheme);
  const labels = resolveLabels(customLabels);
  const controller = useLocomotiveWheelSelector(props);
  const resolvedTitle = title ?? labels.title;
  const selectedStatus: WheelVisualStatus = controller.selectedWheel ? controller.selectedWheel.status : 'available';

  return (
    <div 
      className="w-full min-h-screen p-4 md:p-6 lg:p-8 flex flex-col gap-6"
      style={{ backgroundColor: theme.colors.background }}
    >
      {/* Header */}
      <div 
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border bg-white shadow-sm dark:bg-slate-900"
        style={{ borderColor: theme.colors.border }}
      >
        <div className="flex items-center gap-3.5">
          <div 
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: theme.colors.primarySoft }}
          >
            🚆
          </div>
          <div>
            <h1 
              className="text-xl md:text-2xl font-black tracking-tight"
              style={{ color: theme.colors.text }}
            >
              {resolvedTitle}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              SVG 2D interactivo · Web y Desktop optimizado
            </p>
          </div>
        </div>

        <div className="flex gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100 dark:border-slate-800">
          <div>
            <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Orden activa</span>
            <span className="text-sm font-semibold" style={{ color: theme.colors.text }}>{orderCode}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Operador</span>
            <span className="text-sm font-semibold" style={{ color: theme.colors.text }}>{operatorName}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Selectors & Diagram */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* View Mode Switcher */}
          {showViewSwitcher && (
            <div 
              className="p-4 rounded-2xl border bg-white shadow-sm dark:bg-slate-900"
              style={{ borderColor: theme.colors.border }}
            >
              <div className="flex gap-2 flex-wrap">
                {VIEWS.map(view => {
                  const active = controller.viewMode === view.key;
                  return (
                    <button
                      key={view.key}
                      disabled={disabled}
                      onClick={() => controller.setViewMode(view.key)}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all border select-none ${
                        active 
                          ? 'text-white border-transparent' 
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                      }`}
                      style={{
                        backgroundColor: active ? theme.colors.primary : undefined,
                        opacity: disabled ? 0.6 : 1,
                      }}
                    >
                      {labels[view.labelKey]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Wheel Count Switcher */}
          {showWheelCountSwitcher && (
            <div 
              className="p-4 rounded-2xl border bg-white shadow-sm dark:bg-slate-900"
              style={{ borderColor: theme.colors.border }}
            >
              <span className="block text-sm font-black mb-3" style={{ color: theme.colors.text }}>
                {labels.wheelCountLabel}
              </span>
              <div className="flex gap-2.5 flex-wrap">
                {SUPPORTED_WHEEL_COUNTS.map((count: WheelCount) => {
                  const active = controller.wheelCount === count;
                  return (
                    <button
                      key={count}
                      disabled={disabled}
                      onClick={() => controller.setWheelCount(count)}
                      className={`py-2 px-5 rounded-xl text-sm font-extrabold transition-all border select-none ${
                        active 
                          ? 'text-white border-transparent' 
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                      }`}
                      style={{
                        backgroundColor: active ? theme.colors.primary : undefined,
                        opacity: disabled ? 0.6 : 1,
                      }}
                    >
                      {count}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Locomotive SVG Map */}
          <div 
            className="p-6 rounded-2xl border bg-white shadow-sm dark:bg-slate-900 flex justify-center items-center"
            style={{ borderColor: theme.colors.border }}
          >
            <LocomotiveWheelMap
              wheelCount={controller.wheelCount}
              viewMode={controller.viewMode}
              selectedWheelId={controller.selectedWheelId}
              wheels={wheels}
              disabled={disabled}
              theme={theme}
              labels={labels}
              orientation={orientation}
              onWheelSelect={controller.selectWheel}
            />
          </div>
        </div>

        {/* Right column: Component Details, Legend & Instructions */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Selected Component Card */}
          <div 
            className="p-5 rounded-2xl border bg-white shadow-sm dark:bg-slate-900"
            style={{ borderColor: theme.colors.border }}
          >
            <span className="block text-sm font-black mb-4" style={{ color: theme.colors.text }}>
              {labels.componentSelected}
            </span>

            {controller.selectedWheel ? (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center gap-4">
                  <div>
                    <h3 className="text-lg font-black" style={{ color: theme.colors.text }}>
                      {controller.selectedWheel.label}
                    </h3>
                    <span className="text-xs text-slate-400">ID: {controller.selectedWheel.id}</span>
                  </div>
                  <StatusBadge status={selectedStatus} labels={labels} theme={theme} />
                </div>

                <div className="flex flex-col border-t border-slate-100 dark:border-slate-800 pt-2">
                  {[
                    ['Diámetro actual', controller.selectedWheel.diameter ? `${controller.selectedWheel.diameter} mm` : 'Sin registro'],
                    ['Diámetro objetivo', controller.selectedWheel.targetDiameter ? `${controller.selectedWheel.targetDiameter} mm` : 'Sin registro'],
                    ['Desgaste actual', controller.selectedWheel.wear ? `${controller.selectedWheel.wear} mm` : 'Sin registro'],
                    ['Perfil', controller.selectedWheel.profile ?? 'Sin registro'],
                    ['Última medición', controller.selectedWheel.lastMeasurement ?? 'Sin registro'],
                    ['Observaciones', controller.selectedWheel.observations ?? 'Sin observaciones'],
                  ].map(([key, value]) => (
                    <div 
                      key={key} 
                      className="flex justify-between items-center py-2.5 border-b border-slate-50 dark:border-slate-800/50 last:border-b-0 text-sm"
                    >
                      <span className="text-slate-400">{key}</span>
                      <span className="font-bold" style={{ color: theme.colors.text }}>{value}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <button
                    disabled={disabled}
                    className="flex-1 py-3 px-4 rounded-xl text-sm font-extrabold text-white transition-all select-none opacity-90 hover:opacity-100 disabled:opacity-50"
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    {labels.viewMeasurements}
                  </button>
                  <button
                    disabled={disabled}
                    className="flex-1 py-3 px-4 rounded-xl text-sm font-extrabold text-white transition-all select-none opacity-90 hover:opacity-100 disabled:opacity-50"
                    style={{ backgroundColor: theme.colors.success }}
                  >
                    {labels.startInspection}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic py-4">{labels.noSelection}</p>
            )}
          </div>

          {/* Instructions */}
          {showInstructions && (
            <div 
              className="p-5 rounded-2xl border bg-white shadow-sm dark:bg-slate-900"
              style={{ borderColor: theme.colors.border }}
            >
              <h3 className="text-sm font-black mb-2" style={{ color: theme.colors.text }}>
                {labels.instructionsTitle}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {labels.instructions}
              </p>
            </div>
          )}

          {/* Legend */}
          {showLegend && (
            <div 
              className="p-5 rounded-2xl border bg-white shadow-sm dark:bg-slate-900"
              style={{ borderColor: theme.colors.border }}
            >
              <h3 className="text-sm font-black mb-3" style={{ color: theme.colors.text }}>
                {labels.legendTitle}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {(['available', 'selected', 'warning', 'outOfRange', 'completed', 'disabled'] as WheelVisualStatus[]).map(status => (
                  <div key={status} className="flex items-center gap-2 text-sm select-none">
                    <span 
                      className="w-3.5 h-3.5 rounded-full border-2"
                      style={{
                        borderColor: getStatusStroke(theme, status),
                        backgroundColor: getStatusFill(theme, status),
                      }}
                    />
                    <span style={{ color: theme.colors.text }} className="text-xs font-semibold">
                      {getStatusLabel(labels, status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default LocomotiveWheelSelector;
