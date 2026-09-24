const disabledValues = new Set(["0", "false", "no", "off"]);

const readFeatureFlag = (value: string | undefined, fallback = true) => {
  if (value == null || value.trim() === "") return fallback;
  return !disabledValues.has(value.trim().toLowerCase());
};

export const PANEL_GRAFICO_ENABLED = readFeatureFlag(process.env.NEXT_PUBLIC_PANEL_GRAFICO_ENABLED);
