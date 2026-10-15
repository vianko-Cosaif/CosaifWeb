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
const editableFields = new Set([
  "locomotiveNumber",
  "prioridad",
  "tipoMovimiento",
  "instrucciones",
  "poloOrigen",
  "poloDestino",
  "seccionOrigenId",
  "seccionDestinoId",
  "direccionEmpuje",
  "viaOrigenId",
  "viaDestinoId",
  "locomotoraRemolque",
]);

export async function GET(_request: NextRequest, context: Context) {
  try {
    const result = await scopedMovement(context, PERMISSIONS.MOVEMENTS_EDIT);
    if (result.error) return result.error;
    return NextResponse.json(result.movement, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const result = await scopedMovement(context, PERMISSIONS.MOVEMENTS_EDIT);
    if (result.error) return result.error;
    if (
      !["SOLICITADO", "ASIGNADO"].includes(String(result.movement.estado)) ||
      result.movement.fechaInicio ||
      (record(result.movement.unidad).estado &&
        record(result.movement.unidad).estado !== "PENDIENTE")
    ) {
      return NextResponse.json(
        { message: "Este movimiento ya inició y no se puede editar." },
        { status: 409 },
      );
    }
    const body = record(await request.json().catch(() => null));
    if (!Object.keys(body).length || Object.keys(body).some((key) => !editableFields.has(key))) {
      return NextResponse.json({ message: "Datos de edición inválidos." }, { status: 400 });
    }
    const data = await gatewayMovement(result.id, result.gateway, body);
    return NextResponse.json(data, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
