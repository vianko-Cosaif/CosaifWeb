"use client";

import { useCallback } from "react";
import { handleAuthError } from "@/lib/auth/auth";

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
    } catch (error: unknown) {
      // Verificar si es error HTTP 401
      if ((error instanceof Error && error.message.includes("401")) || (typeof error === "object" && error !== null && "status" in error && error.status === 401)) {
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
        handleAuthError();
        throw new Error(`Error HTTP: ${response.status}`);
      }

      return response;
    } catch (error: unknown) {
      // También manejar errores 401 en errores de red/conexión
      if (error instanceof Error && error.message.includes("401")) {
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
