const disabledValues = new Set(["0", "false", "no", "off"]);
const pushDisabled = disabledValues.has(
  String(process.env.NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS ?? "")
    .trim()
    .toLowerCase(),
);

// Vercel injects these public values before Next.js freezes them into the browser bundle.
// Local and synthetic quality builds do not require production notification credentials.
if (process.env.VERCEL_ENV === "production" && !pushDisabled) {
  const required = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "NEXT_PUBLIC_FIREBASE_VAPID_KEY",
  ];
  const missing = required.filter((name) => {
    const value = String(process.env[name] ?? "").trim();
    return !value || value.startsWith("TU_");
  });

  if (missing.length) {
    console.error(
      `No se puede publicar con notificaciones activas: falta configurar ${missing.join(", ")}. ` +
        "Completa estas variables de producción en Vercel y vuelve a compilar.",
    );
    process.exitCode = 1;
  }
}
