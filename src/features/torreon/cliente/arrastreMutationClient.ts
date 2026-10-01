import { parseErrorMessage } from "./utils";

type ArrastreMutationKind = "create" | "action";

/** Shared transport for client arrastre mutations; the server validates each payload and scope. */
export async function requestArrastreMutation(
  kind: ArrastreMutationKind,
  payload: unknown,
  fallbackMessage: string,
): Promise<void> {
  const path =
    kind === "create" ? "/api/cliente/torreon/arrastres" : "/api/cliente/torreon/arrastres/action";
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (response.ok) return;
  const data: unknown = await response.json().catch(() => null);
  throw new Error(parseErrorMessage(data, fallbackMessage));
}
