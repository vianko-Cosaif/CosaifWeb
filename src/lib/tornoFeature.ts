const FALSE_VALUES = new Set(["false", "0", "no", "off"]);

function readFeatureFlag(value: string | undefined) {
  return !FALSE_VALUES.has(String(value ?? "true").trim().toLowerCase());
}

export const isTornoModuleEnabled = readFeatureFlag(
  process.env.NEXT_PUBLIC_TORNO_MODULE_ENABLED ?? process.env.TORNO_MODULE_ENABLED,
);
