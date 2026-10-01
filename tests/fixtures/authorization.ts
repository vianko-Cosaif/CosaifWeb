import { AUTHORIZATION_POLICY_VERSION, getRoleCapabilities, PERMISSIONS, type AppRole, type AuthorizationProfile } from '@/lib/accessControl';
export function loginProfile(role: AppRole = 'CLIENTE'): AuthorizationProfile {
  return {
    role, roleLabel: role, policyVersion: AUTHORIZATION_POLICY_VERSION,
    platforms: { web: true, mobile: false },
    scope: { mode: 'COMPANY_LOCALITY', empresaId: 3, localidadId: 1 },
    permissions: Object.values(PERMISSIONS), capabilities: getRoleCapabilities(role),
  };
}
