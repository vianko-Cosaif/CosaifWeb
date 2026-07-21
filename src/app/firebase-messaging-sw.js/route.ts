import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FIREBASE_CDN_VERSION = "12.14.0";

function serviceWorkerSource() {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "",
  };
  const runtimeEnv = process.env.NODE_ENV === "production" ? "production" : "development";
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || runtimeEnv;

  return `
const firebaseConfig = ${JSON.stringify(firebaseConfig)};
const notificationRuntime = ${JSON.stringify({ runtimeEnv, appEnv })};
const requiredConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
];

function hasValue(value) {
  return Boolean(value && !String(value).startsWith("TU_"));
}

if (requiredConfig.every(hasValue)) {
  importScripts("https://www.gstatic.com/firebasejs/${FIREBASE_CDN_VERSION}/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/${FIREBASE_CDN_VERSION}/firebase-messaging-compat.js");

  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    const data = payload.data || {};
    const title = notification.title || data.title || "Nueva notificacion";
    const url = data.url || data.click_action || "/";
    const tag = data.tag || data.eventId || data.movimientoId || data.incidenteId || data.tipo || title;

    self.registration.showNotification(title, {
      body: notification.body || data.body || "",
      icon: notification.icon || data.icon || "/icons/cosaif-192.png",
      badge: data.badge || "/icons/cosaif-192.png",
      data: { ...data, url, runtimeEnv: notificationRuntime.runtimeEnv, appEnv: notificationRuntime.appEnv },
      tag: notificationRuntime.runtimeEnv + ":" + tag,
      renotify: true,
      requireInteraction: true,
      silent: false,
    });
  });
} else {
  console.warn("Firebase Messaging SW sin configuracion completa.");
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url || "/";
  const parsedUrl = new URL(rawUrl, self.location.origin);
  const targetUrl =
    parsedUrl.origin === self.location.origin
      ? parsedUrl.href
      : new URL("/", self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }

        return clients.openWindow(targetUrl);
      })
  );
});
`;
}

export function GET() {
  return new NextResponse(serviceWorkerSource(), {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
    },
  });
}
