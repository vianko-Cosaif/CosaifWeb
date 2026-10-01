/** Scope for local UI data only. The server still verifies every operation. */
export function storageScope(user: { id?: unknown; userId?: unknown; rol?: unknown; role?: unknown; empresaId?: unknown; localidadId?: unknown } | null | undefined): string | null {
  const id = Number(user?.userId ?? user?.id);
  const role = String(user?.role ?? user?.rol ?? '').toUpperCase();
  if (!Number.isSafeInteger(id) || id <= 0 || !role) return null;
  return `v1:${id}:${role}:${Number(user?.empresaId) || 0}:${Number(user?.localidadId) || 0}`;
}

export function currentStorageScope(): string | null {
  if (typeof window === 'undefined') return null;
  try { return storageScope(JSON.parse(localStorage.getItem('user') || 'null')); }
  catch { return null; }
}
