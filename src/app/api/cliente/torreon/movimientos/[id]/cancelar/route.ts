import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/accessControl";
import {
  failure,
  gatewayMovement,
  record,
  scopedMovement,
} from "@/lib/server/torreonClientMovement";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const result = await scopedMovement(context, PERMISSIONS.MOVEMENTS_CANCEL);
    if (result.error) return result.error;
    const { movement } = result;
    const body = record(await request.json().catch(() => null));
    const razon = typeof body.razon === "string" ? body.razon.trim() : "";
    if (Object.keys(body).some((key) => key !== "razon") || !razon || razon.length > 1000)
      return NextResponse.json(
        { message: "Escribe un motivo de cancelación de 1 a 1000 caracteres." },
        { status: 400 },
      );
    if (
      !["SOLICITADO", "ASIGNADO"].includes(String(movement.estado)) ||
      movement.fechaInicio ||
      record(movement.unidad).fechaInicio ||
      (record(movement.unidad).estado && record(movement.unidad).estado !== "PENDIENTE")
    )
      return NextResponse.json(
        { message: "Este movimiento ya no admite cancelación." },
        { status: 409 },
      );
    const data = await gatewayMovement(result.id, result.gateway, { razon }, "/cancelar");
    return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
