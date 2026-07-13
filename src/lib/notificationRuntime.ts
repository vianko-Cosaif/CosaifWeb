export type NotificationRuntimeEnv = "development" | "production";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function normalizeFlag(value?: string) {
  return String(value ?? "").trim().toLowerCase();
}

function isTrue(value?: string) {
  return TRUE_VALUES.has(normalizeFlag(value));
}

function isFalse(value?: string) {
  return FALSE_VALUES.has(normalizeFlag(value));
}

export function getNotificationRuntimeEnv(): NotificationRuntimeEnv {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function getNotificationAppEnv() {
  return (
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    getNotificationRuntimeEnv()
  );
}

export function getNotificationRuntimePolicy() {
  const runtimeEnv = getNotificationRuntimeEnv();
  const appEnv = getNotificationAppEnv();
  const devEnabled = isTrue(process.env.NEXT_PUBLIC_ENABLE_DEV_NOTIFICATIONS);
  const prodDisabled = isFalse(process.env.NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS);
  const enabled = runtimeEnv === "production" ? !prodDisabled : devEnabled;
  const requireLoginFlag = process.env.NEXT_PUBLIC_REQUIRE_PUSH_NOTIFICATIONS;
  const requiredForLogin = enabled && (runtimeEnv === "production" ? !isFalse(requireLoginFlag) : isTrue(requireLoginFlag));
  const reason = enabled
    ? "enabled"
    : runtimeEnv === "development"
      ? "disabled_in_dev"
      : "disabled";

  return {
    runtimeEnv,
    appEnv,
    enabled,
    requiredForLogin,
    reason,
    statusKey: `cosaif:firebase-notifications:${runtimeEnv}:${appEnv}:status:v2`,
  };
}

export function assertSameOriginUrl(rawUrl?: string, fallback = "/") {
  if (typeof window === "undefined") return fallback;

  try {
    const parsed = new URL(rawUrl || fallback, window.location.origin);
    return parsed.origin === window.location.origin ? parsed.href : fallback;
  } catch {
    return fallback;
  }
}
