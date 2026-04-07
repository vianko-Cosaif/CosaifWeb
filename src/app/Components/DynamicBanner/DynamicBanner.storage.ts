/**
 * Storage Adapter Web (localStorage).
 * Se envuelve en promesas para mantener una API asincrona uniforme.
 */

import type { StorageAdapter } from "./DynamicBanner.types";

export class WebStorageAdapter implements StorageAdapter {
    async get(key: string): Promise<string | null> {
        try {
            return localStorage.getItem(key);
        } catch {
            // SSR o localStorage deshabilitado
            return null;
        }
    }

    async set(key: string, value: string): Promise<void> {
        try {
            localStorage.setItem(key, value);
        } catch (err) {
            console.warn("[DynamicBanner] localStorage.set fallo:", err);
        }
    }

    async remove(key: string): Promise<void> {
        try {
            localStorage.removeItem(key);
        } catch {
            // noop
        }
    }
}

/** Singleton para evitar multiples instancias. */
export const webStorage = new WebStorageAdapter();