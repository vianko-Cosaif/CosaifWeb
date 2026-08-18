import "server-only";
import fs from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS, hasAnyPermission } from "@/lib/accessControl";
import { getVerifiedSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const ALLOWED_ROLES = new Set([
  "ADMINISTRADOR",
  "COORDINADOR",
  "SUPERVISOR",
  "CLIENTE",
  "CLIENTE_ADMIN",
  "CLIENTE_COOR",
  "ARRASTRE_TORREON",
]);

function getUploadsRoots() {
  return [
    process.env.TORREON_UPLOADS_DIR,
    path.resolve(process.cwd(), "../BackCosaif2/uploads/incidentes"),
    path.resolve(process.cwd(), "../BackCosaif2/ms_torreon/uploads/incidentes"),
  ]
    .filter((item): item is string => Boolean(item))
    .map((item) => path.resolve(item));
}

async function hasSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.JWT_COOKIE_NAME || "token")?.value || cookieStore.get("token")?.value;
  const session = await getVerifiedSession();
  return Boolean(
    token && session && ALLOWED_ROLES.has(session.role) &&
    hasAnyPermission(session.authorization, [PERMISSIONS.TORREON_READ, PERMISSIONS.INCIDENTS_READ])
  );
}

function isAllowedTorreonImagePath(segments: string[]) {
  if (segments.length !== 4) return false;
  const [year, month, day, fileName] = segments;
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) return false;
  if (!/^torreon_[a-z0-9_-]+\.(jpe?g|png|webp)$/i.test(fileName)) return false;
  return CONTENT_TYPES[path.extname(fileName).toLowerCase()] !== undefined;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  try {
    if (!(await hasSession())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { path: segments } = await ctx.params;
    const cleanSegments = (segments || []).filter(Boolean);
    if (!isAllowedTorreonImagePath(cleanSegments)) {
      return NextResponse.json({ error: "Ruta de imagen invalida" }, { status: 400 });
    }

    let file: Buffer | null = null;
    let target = "";
    for (const root of getUploadsRoots()) {
      const candidate = path.resolve(root, ...cleanSegments);
      if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        return NextResponse.json({ error: "Ruta invalida" }, { status: 400 });
      }

      try {
        file = await fs.readFile(candidate);
        target = candidate;
        break;
      } catch {
        file = null;
      }
    }

    if (!file || !target) {
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }

    const body = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
    const ext = path.extname(target).toLowerCase();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": CONTENT_TYPES[ext] || "application/octet-stream",
        "cache-control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
  }
}
