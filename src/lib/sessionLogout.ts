const STORAGE_KEYS = ["token", "user", "locId", "empresaId", "userId"] as const;
const CLIENT_COOKIE_KEYS = ["locId", "empresaId", "userId"] as const;

function clearStorage(storage: Storage) {
  for (const key of STORAGE_KEYS) storage.removeItem(key);
}

export async function clearAuthenticatedSession() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("No se pudo cerrar la sesión en el servidor.");
  }

  try {
    clearStorage(window.localStorage);
    clearStorage(window.sessionStorage);
  } catch {
    // La cookie del servidor ya se eliminó; el almacenamiento puede estar bloqueado.
  }

  for (const name of CLIENT_COOKIE_KEYS) {
    document.cookie = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax`;
  }
}
