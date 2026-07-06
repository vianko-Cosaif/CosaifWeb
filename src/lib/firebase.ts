import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from "firebase/messaging";
import type { Messaging, MessagePayload } from "firebase/messaging";

const FIREBASE_MESSAGING_SW_URL = "/firebase-messaging-sw.js";
const FIREBASE_MESSAGING_SW_SCOPE = "/firebase-cloud-messaging-push-scope/";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const requiredFirebaseValues = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
];

let firebaseAppInstance: FirebaseApp | null = null;
let messagingSupportPromise: Promise<boolean> | null = null;

function hasValue(value: string | undefined) {
  return Boolean(value && !value.startsWith("TU_"));
}

function toPositiveInt(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function readClientCookie(name: string) {
  if (typeof document === "undefined") return null;
  const item = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}

export function getActiveFirebaseLocalidadId(explicit?: number | string | null) {
  const explicitId = toPositiveInt(explicit);
  if (explicitId) return explicitId;
  if (typeof window === "undefined") return null;

  return (
    toPositiveInt(readClientCookie("locId")) ??
    toPositiveInt(readClientCookie("localidadId")) ??
    toPositiveInt(window.localStorage.getItem("locId")) ??
    toPositiveInt(window.localStorage.getItem("localidadId"))
  );
}

export function isFirebaseConfigured() {
  return requiredFirebaseValues.every(hasValue);
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) {
    console.warn("Firebase no tiene configuracion completa.");
    return null;
  }

  if (firebaseAppInstance) return firebaseAppInstance;

  firebaseAppInstance = getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);

  return firebaseAppInstance;
}

export const firebaseApp = getFirebaseApp();

async function supportsFirebaseMessaging() {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!window.isSecureContext) return false;

  messagingSupportPromise ??= isSupported().catch(() => false);
  return messagingSupportPromise;
}

async function getFirebaseMessagingServiceWorker() {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  const existingRegistration = await navigator.serviceWorker.getRegistration(
    FIREBASE_MESSAGING_SW_SCOPE
  );

  if (existingRegistration) return existingRegistration;

  return navigator.serviceWorker.register(FIREBASE_MESSAGING_SW_URL, {
    scope: FIREBASE_MESSAGING_SW_SCOPE,
  });
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  const app = getFirebaseApp();
  if (!app) return null;

  const supported = await supportsFirebaseMessaging();

  if (!supported) {
    console.warn("Firebase Messaging no es compatible con este navegador.");
    return null;
  }

  return getMessaging(app);
}

export async function requestFirebaseNotificationToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) return null;

  let permission = Notification.permission;

  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    console.warn("Permiso de notificaciones denegado.");
    return null;
  }

  const messaging = await getFirebaseMessaging();

  if (!messaging) return null;

  const serviceWorkerRegistration = await getFirebaseMessagingServiceWorker();
  if (!serviceWorkerRegistration) return null;

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!hasValue(vapidKey)) {
    console.warn("Falta NEXT_PUBLIC_FIREBASE_VAPID_KEY.");
    return null;
  }

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration,
  });

  return token;
}

export async function registerFirebaseNotificationToken(
  token: string,
  accessToken?: string,
  localidadId?: number | string | null
) {
  if (typeof window === "undefined") return;
  if (!token.trim()) return;

  const activeLocalidadId = getActiveFirebaseLocalidadId(localidadId);
  const body: { token: string; accessToken?: string; localidadId?: number } = { token };
  if (accessToken) body.accessToken = accessToken;
  if (activeLocalidadId) body.localidadId = activeLocalidadId;

  const response = await fetch(accessToken ? "/api/fcm/register" : "/xapi/fcm", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`No se pudo registrar token FCM (${response.status}) ${details}`);
  }
}

export async function syncFirebaseNotificationLocalidad(localidadId?: number | string | null) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const token = await requestFirebaseNotificationToken();
  if (!token) return;

  await registerFirebaseNotificationToken(token, undefined, localidadId);
}

export async function listenFirebaseForegroundMessages(
  callback: (payload: MessagePayload) => void
) {
  const messaging = await getFirebaseMessaging();

  if (!messaging) return;

  return onMessage(messaging, callback);
}
