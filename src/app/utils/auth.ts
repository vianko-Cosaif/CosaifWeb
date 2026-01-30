/**
 * Funciones de utilidad para manejo de autenticación
 */

/**
 * Limpia todos los datos de autenticación del usuario
 */
export const clearAuthData = (): void => {
  if (typeof document === "undefined") return;

  // Limpiar cookies de autenticación
  const cookiesToDelete = ["token"];
  cookiesToDelete.forEach(cookieName => {
    document.cookie = `${cookieName};`;
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
    window.location.href = "/login";
  }
};

/**
 * Función completa para manejar logout por autenticación fallida
 */
export const handleAuthError = (): void => {
  clearAuthData();
  redirectToLogin();
};
