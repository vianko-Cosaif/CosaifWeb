import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from "firebase/messaging";
import type { Messaging, MessagePayload } from "firebase/messaging";
import { getNotificationRuntimePolicy } from "@/lib/notificationRuntime";

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

let firebaseAppInstance: FirebaseApp | undefined;
let messagingSupportPromise: Promise<boolean> | undefined;
let notificationTokenPromise: Promise<string | undefined> | undefined;
let tokenRegistrationPromise: Promise<void> | undefined;
let tokenRegistrationKey: string | undefined;
let lastRegisteredTokenKey: string | undefined;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} excedió el tiempo de espera`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function hasValue(value: string | undefined) {
  return Boolean(value && !value.startsWith("TU_"));
}

function toPositiveInt(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined;
}

function readClientCookie(name: string) {
  if (typeof document === "undefined") return undefined;
  const item = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : undefined;
}

export function getActiveFirebaseLocalidadId(explicit?: number | string) {
  const explicitId = toPositiveInt(explicit);
  if (explicitId) return explicitId;
  if (typeof window === "undefined") return undefined;

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

export function getFirebaseApp(): FirebaseApp | undefined {
  if (!isFirebaseConfigured()) {
    console.warn("Firebase no tiene configuracion completa.");
    return undefined;
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
  if (typeof window === "undefined") return undefined;
  if (!("serviceWorker" in navigator)) return undefined;
  const policy = getNotificationRuntimePolicy();
  const serviceWorkerUrl = `${FIREBASE_MESSAGING_SW_URL}?runtime=${encodeURIComponent(policy.runtimeEnv)}&appEnv=${encodeURIComponent(policy.appEnv)}`;

  const existingRegistration = await withTimeout(
    navigator.serviceWorker.getRegistration(FIREBASE_MESSAGING_SW_SCOPE),
    6_000,
    "Firebase Service Worker"
  );

  if (existingRegistration) {
    void existingRegistration.update().catch(() => undefined);
    return existingRegistration;
  }

  return withTimeout(
    navigator.serviceWorker.register(serviceWorkerUrl, {
      scope: FIREBASE_MESSAGING_SW_SCOPE,
    }),
    8_000,
    "Registro de Firebase Service Worker"
  );
}

export async function getFirebaseMessaging(): Promise<Messaging | undefined> {
  const app = getFirebaseApp();
  if (!app) return undefined;

  const supported = await supportsFirebaseMessaging();

  if (!supported) {
    console.warn("Firebase Messaging no es compatible con este navegador.");
    return undefined;
  }

  return getMessaging(app);
}

async function createFirebaseNotificationToken(options: { requestPermission?: boolean }): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  if (!("Notification" in window)) return undefined;
  const policy = getNotificationRuntimePolicy();
  if (!policy.enabled) return undefined;

  let permission = Notification.permission;

  if (permission === "default") {
    if (options.requestPermission === false) return undefined;
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    console.warn("Permiso de notificaciones denegado.");
    return undefined;
  }

  const messaging = await getFirebaseMessaging();

  if (!messaging) return undefined;

  const serviceWorkerRegistration = await getFirebaseMessagingServiceWorker();
  if (!serviceWorkerRegistration) return undefined;

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!hasValue(vapidKey)) {
    console.warn("Falta NEXT_PUBLIC_FIREBASE_VAPID_KEY.");
    return undefined;
  }

  const token = await withTimeout(
    getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    }),
    12_000,
    "Token de Firebase"
  );

  return token;
}

export function requestFirebaseNotificationToken(options: { requestPermission?: boolean } = {}): Promise<string | undefined> {
  if (notificationTokenPromise) return notificationTokenPromise;

  const pending = createFirebaseNotificationToken(options).finally(() => {
    if (notificationTokenPromise === pending) notificationTokenPromise = undefined;
  });
  notificationTokenPromise = pending;
  return pending;
}

export async function registerFirebaseNotificationToken(
  token: string,
  accessToken?: string,
  localidadId?: number | string
) {
  if (typeof window === "undefined") return;
  if (!token.trim()) return;
  const policy = getNotificationRuntimePolicy();
  if (!policy.enabled) return;

  const activeLocalidadId = getActiveFirebaseLocalidadId(localidadId);
  const body: {
    token: string;
    accessToken?: string;
    localidadId?: number;
    runtimeEnv: string;
    appEnv: string;
  } = {
    token,
    runtimeEnv: policy.runtimeEnv,
    appEnv: policy.appEnv,
  };
  if (accessToken) body.accessToken = accessToken;
  if (activeLocalidadId) body.localidadId = activeLocalidadId;

  const registrationKey = `${token}:${activeLocalidadId ?? "global"}:${policy.runtimeEnv}:${policy.appEnv}`;
  if (lastRegisteredTokenKey === registrationKey) return;
  if (tokenRegistrationPromise && tokenRegistrationKey === registrationKey) {
    return tokenRegistrationPromise;
  }

  tokenRegistrationKey = registrationKey;
  const registration = (async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10_000);
    let response: Response;

    try {
      response = await fetch("/api/fcm/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(`No se pudo registrar token FCM (${response.status}) ${details}`);
    }
    lastRegisteredTokenKey = registrationKey;
  })().finally(() => {
    if (tokenRegistrationPromise === registration) {
      tokenRegistrationPromise = undefined;
      tokenRegistrationKey = undefined;
    }
  });

  tokenRegistrationPromise = registration;
  return registration;
}

export async function syncFirebaseNotificationLocalidad(localidadId?: number | string) {
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
