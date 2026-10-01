import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getInitialTheme, initThemeSSRScript, MEDIA_QUERY, THEME_STORAGE_KEY } from "@/lib/theme";

afterEach(() => vi.unstubAllGlobals());

function initialize({
  stored = null,
  systemDark = false,
  blockedStorage = false,
  brokenMedia = false,
  missingMedia = false,
  storageKey = THEME_STORAGE_KEY,
}: {
  stored?: string | null;
  systemDark?: boolean;
  blockedStorage?: boolean;
  brokenMedia?: boolean;
  missingMedia?: boolean;
  storageKey?: string;
} = {}) {
  let dark = false;
  const getItem = vi.fn(() => {
    if (blockedStorage) throw new Error("Storage unavailable");
    return stored;
  });
  const matchMedia = vi.fn(() => {
    if (brokenMedia) throw new Error("Media query unavailable");
    return { matches: systemDark };
  });
  const browser = { localStorage: { getItem }, ...(missingMedia ? {} : { matchMedia }) };
  vi.stubGlobal("window", browser);
  runInNewContext(initThemeSSRScript(storageKey), {
    window: browser,
    document: { documentElement: { classList: { toggle: (className: string, enabled: boolean) => {
      expect(className).toBe("dark");
      dark = enabled;
    } } } },
  });
  return { theme: dark ? "dark" : "light", getItem, matchMedia };
}

describe("theme before hydration", () => {
  it.each([
    { stored: "dark", systemDark: false, expected: "dark" },
    { stored: "light", systemDark: true, expected: "light" },
    { stored: null, systemDark: true, expected: "dark" },
    { stored: null, systemDark: false, expected: "light" },
    { stored: "unknown", systemDark: true, expected: "dark" },
    { stored: "", systemDark: true, expected: "dark" },
  ])("matches the mounted preference for $stored / system dark $systemDark", ({ expected, ...options }) => {
    const result = initialize(options);
    expect(result.theme).toBe(expected);
    expect(result.theme).toBe(getInitialTheme());
    expect(result.getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
  });

  it("uses system dark mode when reading localStorage is blocked", () => {
    const result = initialize({ blockedStorage: true, systemDark: true });
    expect(result.theme).toBe("dark");
    expect(result.theme).toBe(getInitialTheme());
    expect(result.matchMedia).toHaveBeenCalledWith(MEDIA_QUERY);
  });

  it("honors a saved dark preference without accessing an unavailable media query", () => {
    const result = initialize({ stored: "dark", brokenMedia: true });
    expect(result.theme).toBe("dark");
    expect(result.theme).toBe(getInitialTheme());
    expect(result.matchMedia).not.toHaveBeenCalled();
  });

  it.each([{ brokenMedia: true }, { missingMedia: true }])("falls back to light when both preference and media are unavailable: %j", (options) => {
    const result = initialize({ blockedStorage: true, ...options });
    expect(result.theme).toBe("light");
    expect(result.theme).toBe(getInitialTheme());
  });

  it("preserves the optional storage key without breaking the inline script", () => {
    const storageKey = "theme'\\custom";
    const result = initialize({ stored: "dark", storageKey });
    expect(result.theme).toBe("dark");
    expect(result.getItem).toHaveBeenCalledWith(storageKey);
  });
});
