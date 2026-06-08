export function normalizeHttpOrigin(value?: string | null): string {
  const raw = String(value ?? "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
}

export function apiOriginToWebSocketUrl(origin: string, path = "/realtime/ws"): URL {
  const url = new URL(normalizeHttpOrigin(origin));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  url.search = "";
  return url;
}
