import type { AuthorizationProfile } from '@/lib/accessControl';
import { evaluateRoute } from '@/lib/routePolicy';
export function safeReturnPath(value: string | null, authorization: AuthorizationProfile, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001F]/.test(value)) return fallback;
  const url = new URL(value, 'https://cosaif.invalid');
  if (url.origin !== 'https://cosaif.invalid' || /^\/(?:login|api|bff|xapi)(?:\/|$)/.test(url.pathname)) return fallback;
  return evaluateRoute({ pathname: url.pathname, search: url.search, isAuthenticated: true, authorization }).allow ? url.pathname + url.search + url.hash : fallback;
}
