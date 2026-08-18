import { jwtVerify, SignJWT } from "jose";
import {
  parseAuthorizationProfile,
  type AppRole,
  type AuthorizationProfile,
} from "./accessControl";

export const SESSION_COOKIE_NAME = "cosaif_session";

export type VerifiedSession = {
  role: AppRole;
  userId: number;
  empresaId: number | null;
  localidadId: number | null;
  authorization: AuthorizationProfile;
};

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function secretBytes() {
  const secret = String(process.env.SESSION_SECRET || process.env.JWT_SECRET || "");
  if (secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

export function hasSecureSessionSecret() {
  return Boolean(secretBytes());
}

export async function createSessionToken(session: VerifiedSession, maxAgeSeconds: number) {
  const secret = secretBytes();
  if (!secret) throw new Error("SESSION_SECRET_MISSING");
  return new SignJWT({
    role: session.role,
    userId: session.userId,
    empresaId: session.empresaId,
    localidadId: session.localidadId,
    authorization: session.authorization,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setSubject(String(session.userId))
    .setExpirationTime(`${Math.max(60, Math.trunc(maxAgeSeconds))}s`)
    .sign(secret);
}

export async function verifySessionToken(raw: string | null | undefined): Promise<VerifiedSession | null> {
  const secret = secretBytes();
  if (!secret || !raw) return null;
  try {
    const { payload } = await jwtVerify(raw, secret, { algorithms: ["HS256"] });
    const authorization = parseAuthorizationProfile(payload.authorization);
    const role = authorization?.role ?? null;
    const userId = positiveInteger(payload.userId ?? payload.sub);
    if (!authorization || !authorization.platforms.web || !authorization.capabilities.canUseWeb || !role || !userId) return null;
    const empresaId = positiveInteger(payload.empresaId);
    const localidadId = positiveInteger(payload.localidadId);
    if (authorization.scope.empresaId !== empresaId || authorization.scope.localidadId !== localidadId) return null;
    return {
      role,
      userId,
      empresaId,
      localidadId,
      authorization,
    };
  } catch {
    return null;
  }
}
