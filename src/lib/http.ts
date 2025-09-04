export const API = process.env.NEXT_PUBLIC_API_URL;

export async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include", // manda la cookie del JWT
    cache: "no-store",
    ...init,
    headers: {
      "content-type":
        typeof init.headers === "object" && init.headers !== null && !Array.isArray(init.headers)
          ? (init.headers as Record<string, string>)["content-type"]
          : "application/json",
      ...(typeof init.headers === "object" && init.headers !== null && !Array.isArray(init.headers)
        ? init.headers
        : {}),
    },
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") location.href = "/login";
    throw new Error("Unauthorized");
  }
  return res;
}
