import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/server/session';
import { rejectCrossSiteMutation } from '@/lib/server/requestSecurity';
import { parseTelemetry } from '@/lib/observability/events';

const requests = new Map<number, { start: number; count: number }>();
export async function POST(req: NextRequest) {
  const crossSite = rejectCrossSiteMutation(req); if (crossSite) return crossSite;
  const session = await getVerifiedSession();
  if (!session) return new NextResponse(null, { status: 401 });
  if (Number(req.headers.get('content-length') || 0) > 8192) return new NextResponse(null, { status: 413 });
  const now = Date.now();
  for (const [id, value] of requests) if (now - value.start > 60_000) requests.delete(id);
  const count = requests.get(session.userId) ?? { start: now, count: 0 };
  if (++count.count > 20 || requests.size > 10_000) return new NextResponse(null, { status: 429 });
  requests.set(session.userId, count);
  const raw = await req.text();
  if (raw.length > 8192) return new NextResponse(null, { status: 413 });
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return new NextResponse(null, { status: 400 }); }
  const events = parseTelemetry(input);
  if (!events.length) return new NextResponse(null, { status: 400 });
  if (process.env.TELEMETRY_ENABLED === 'true') console.info(JSON.stringify({ event: 'client.metrics', release: process.env.APP_RELEASE || 'local', metrics: events }));
  return new NextResponse(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
