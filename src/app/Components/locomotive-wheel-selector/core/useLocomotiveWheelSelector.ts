import * as React from 'react';
import {
  LocomotiveViewMode,
  LocomotiveWheelSelectorBaseProps,
  WheelCount,
  WheelData,
} from './types';
import { getWheelPoints } from './geometry';
import { getWheelById, normalizeWheels } from './wheelFactory';

function useControllableState<T>(params: {
  value?: T;
  defaultValue: T;
  onChange?: (value: T) => void;
}) {
  const { value, defaultValue, onChange } = params;
  const [internalValue, setInternalValue] = React.useState<T>(defaultValue);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? (value as T) : internalValue;

  const setValue = React.useCallback(
    (nextValue: T) => {
      if (!isControlled) {
        setInternalValue(nextValue);
      }
      onChange?.(nextValue);
    },
    [isControlled, onChange],
  );

  return [currentValue, setValue] as const;
}

export function useLocomotiveWheelSelector(props: LocomotiveWheelSelectorBaseProps) {
  const {
    wheelCount: controlledWheelCount,
    defaultWheelCount = 8,
    viewMode: controlledViewMode,
    defaultViewMode = 'top',
    selectedWheelId: controlledSelectedWheelId,
    defaultSelectedWheelId,
    wheels = [],
    onWheelSelect,
    onViewModeChange,
    onWheelCountChange,
  } = props;

  const [wheelCount, setWheelCount] = useControllableState<WheelCount>({
    value: controlledWheelCount,
    defaultValue: defaultWheelCount,
    onChange: onWheelCountChange,
  });

  const [viewMode, setViewMode] = useControllableState<LocomotiveViewMode>({
    value: controlledViewMode,
    defaultValue: defaultViewMode,
    onChange: onViewModeChange,
  });

  const [selectedWheelId, setSelectedWheelId] = useControllableState<string | undefined>({
    value: controlledSelectedWheelId,
    defaultValue: defaultSelectedWheelId,
    onChange: undefined,
  });

  const normalizedWheels = React.useMemo(
    () => normalizeWheels(wheelCount, wheels),
    [wheelCount, wheels],
  );

  const wheelPoints = React.useMemo(
    () => getWheelPoints(wheelCount, viewMode, selectedWheelId, wheels),
    [wheelCount, viewMode, selectedWheelId, wheels],
  );

  const selectedWheel = React.useMemo(
    () => getWheelById(wheelCount, wheels, selectedWheelId),
    [wheelCount, wheels, selectedWheelId],
  );

  const selectWheel = React.useCallback(
    (wheel: WheelData) => {
      if (wheel.status === 'disabled') return;
      setSelectedWheelId(wheel.id);
      onWheelSelect?.(wheel);
    },
    [onWheelSelect, setSelectedWheelId],
  );

  return {
    wheelCount,
    setWheelCount,
    viewMode,
    setViewMode,
    selectedWheelId,
    setSelectedWheelId,
    selectedWheel,
    normalizedWheels,
    wheelPoints,
    selectWheel,
  };
}
