import { NextRequest, NextResponse } from 'next/server';
import { PERMISSIONS, hasPermission } from '@/lib/accessControl';
import { getVerifiedSession } from '@/lib/server/session';
import { fetchTorreonMsJson, isTorreonLocalidad, TorreonMsError } from '@/lib/torreonMs';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };
type RecordValue = Record<string, unknown>;
const editableFields = new Set([
  'locomotiveNumber', 'prioridad', 'tipoMovimiento', 'instrucciones',
  'posicionChimenea', 'posicionCabina', 'direccionEmpuje',
]);

function record(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
}

function unwrap(value: unknown): RecordValue {
  const root = record(value);
  return 'data' in root ? record(root.data) : root;
}

async function scopedMovement(context: Context) {
  const session = await getVerifiedSession();
  if (!session) return { error: NextResponse.json({ message: 'Sesión expirada.' }, { status: 401 }) };
  if (!['CLIENTE', 'CLIENTE_ADMIN', 'CLIENTE_COOR'].includes(session.role) ||
      !hasPermission(session.authorization, PERMISSIONS.MOVEMENTS_EDIT)) {
    return { error: NextResponse.json({ message: 'No tienes permiso para editar movimientos.' }, { status: 403 }) };
  }
  if (!session.empresaId) {
    return { error: NextResponse.json({ message: 'Se requiere una empresa asignada.' }, { status: 403 }) };
  }
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { error: NextResponse.json({ message: 'Movimiento inválido.' }, { status: 400 }) };
  }
  const movement = unwrap(await fetchTorreonMsJson(`/movimientos/${id}`));
  if (Number(movement.empresaId) !== session.empresaId || !isTorreonLocalidad(Number(movement.localidadId)) ||
      (session.authorization.scope.mode === 'COMPANY_LOCALITY' && Number(movement.localidadId) !== session.localidadId)) {
    return { error: NextResponse.json({ message: 'Sólo puedes editar movimientos de tu empresa y localidad.' }, { status: 403 }) };
  }
  return { id, movement };
}

function failure(error: unknown) {
  return NextResponse.json(
    { message: error instanceof Error ? error.message : 'No se pudo consultar el movimiento.' },
    { status: error instanceof TorreonMsError ? error.status : 502 },
  );
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    const result = await scopedMovement(context);
    if (result.error) return result.error;
    return NextResponse.json(result.movement, { headers: { 'cache-control': 'no-store' } });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const result = await scopedMovement(context);
    if (result.error) return result.error;
    if (!['SOLICITADO', 'ASIGNADO'].includes(String(result.movement?.estado))) {
      return NextResponse.json({ message: 'Este movimiento ya inició y no se puede editar.' }, { status: 409 });
    }
    const body = record(await request.json().catch(() => null));
    if (!Object.keys(body).length || Object.keys(body).some((key) => !editableFields.has(key))) {
      return NextResponse.json({ message: 'Datos de edición inválidos.' }, { status: 400 });
    }
    const data = unwrap(await fetchTorreonMsJson(`/movimientos/${result.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }));
    return NextResponse.json(data, { headers: { 'cache-control': 'no-store' } });
  } catch (error) { return failure(error); }
}
