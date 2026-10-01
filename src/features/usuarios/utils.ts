"use client";

export const getCookie = (name: string) => {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : "";
};

export const normalizeLocalidadName = (value?: string) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

export const isGdlLocalidad = (value?: string) => {
  const name = normalizeLocalidadName(value);
  return name === "GDL" || name.includes("GUADALAJARA");
};

export function passwordScore(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 30;
  if (/[A-Z]/.test(password)) score += 20;
  if (/[a-z]/.test(password)) score += 20;
  if (/[0-9]/.test(password)) score += 20;
  if (/[^A-Za-z0-9]/.test(password)) score += 10;
  return Math.min(score, 100);
}

export function userInitials(name?: string) {
  return (
    String(name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}
