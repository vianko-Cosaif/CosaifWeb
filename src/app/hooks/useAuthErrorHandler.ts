"use client";

import { useCallback } from "react";
import { handleAuthError } from "@/app/utils/auth";

/**
 * Hook para manejar errores de autenticación en consultas HTTP
 */
export function useAuthErrorHandler() {
  /**
   * Función que envuelve una consulta HTTP y maneja errores 401
   */
  const handleHttpRequest = useCallback(async <T>(
    requestFn: () => Promise<T>
  ): Promise<T> => {
    try {
      return await requestFn();
    } catch (error: any) {
      // Verificar si es error HTTP 401
      if (error?.message?.includes("401") || error?.status === 401) {
        console.warn(" Error de autenticación (401) detectado, limpiando sesión...");
        handleAuthError();
        throw error;
      }
      throw error;
    }
  }, []);

  /**
   * Función que envuelve fetch específicamente y maneja errores 401
   */
  const handleFetchRequest = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    try {
      const response = await fetch(url, options);

      // Si la respuesta es 401, limpiar autenticación y redirigir
      if (response.status === 401) {
        console.warn("Error de autenticación (401) detectado en respuesta, limpiando sesión...");
        handleAuthError();
        throw new Error(`Error HTTP: ${response.status}`);
      }

      return response;
    } catch (error: any) {
      // También manejar errores 401 en errores de red/conexión
      if (error?.message?.includes("401")) {
        console.warn("🔒 Error de autenticación (401) detectado en error de red, limpiando sesión...");
        handleAuthError();
      }
      throw error;
    }
  }, []);

  return {
    handleHttpRequest,
    handleFetchRequest,
  };
}
