/**
 * Funciones de utilidad para manejo de autenticación
 */

let authFailureInProgress = false;

/**
 * Limpia todos los datos de autenticación del usuario
 */
export const clearAuthData = (): void => {
  if (typeof document === "undefined") return;

  // Limpiar cookies de autenticación
  const cookiesToDelete = ["token", "role", "locId", "empresaId", "userId"];
  cookiesToDelete.forEach(cookieName => {
    document.cookie = `${cookieName}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax`;
  });

  // Limpiar localStorage 
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes("token") || key.includes("auth") || key.includes("session"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn("Error limpiando localStorage:", error);
  }

  // Limpiar sessionStorage 
  try {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes("token") || key.includes("auth") || key.includes("session"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
  } catch (error) {
    console.warn("Error limpiando sessionStorage:", error);
  }
};

/**
 * Redirige al usuario a la página de login
 */
export const redirectToLogin = (): void => {
  if (typeof window !== "undefined") {
    window.location.replace("/login?sesion=expirada");
  }
};

/**
 * Función completa para manejar logout por autenticación fallida
 */
export const handleAuthError = (): void => {
  if (authFailureInProgress) return;
  authFailureInProgress = true;
  clearAuthData();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cosaif:auth-expired"));
    // La sesión firmada y el JWT son HttpOnly: sólo el servidor puede
    // eliminarlos. Redirigir antes de hacerlo crea un ciclo login → panel →
    // 401 cuando el token upstream ya expiró.
    void fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    })
      .catch(() => undefined)
      .finally(redirectToLogin);
    return;
  }
  redirectToLogin();
};
