import { redirect } from 'next/navigation';
import { PERMISSIONS, hasPermission, getAreaBase } from '@/lib/accessControl';
import { getVerifiedSession } from '@/lib/server/session';
import { isTrainingMovementId } from '@/lib/routePolicy';
import EditarMovimiento from './EditarMovimiento';
export default async function MovementEditPage({ searchParams }: { searchParams: Promise<{ id?: string; training?: string }> }) {
  const session = await getVerifiedSession();
  if (!session) redirect('/login');
  const { id: rawId, training } = await searchParams;
  const id = Number(rawId);
  const back = `${getAreaBase(session.role)}/movimientos`;
  if (!Number.isSafeInteger(id) || id <= 0) redirect(back);
  const simulation = isTrainingMovementId(id);
  if (training === '1' && !simulation) redirect(back + '?trainingError=invalid-sim-id');
  if (!simulation && !hasPermission(session.authorization, PERMISSIONS.MOVEMENTS_EDIT)) redirect(session.authorization.capabilities.home);
  return <section className="mx-auto w-full max-w-7xl px-2 py-4 sm:p-6"><EditarMovimiento movimientoId={id} initialRole={session.role}/></section>;
}
