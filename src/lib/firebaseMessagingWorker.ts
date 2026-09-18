export const FIREBASE_CDN_VERSION = "12.14.0";
// El worker recibe su propia CSP: importScripts necesita el CDN de Firebase.
// La politica de las paginas conserva sus restricciones originales.
export const FIREBASE_WORKER_CSP = [
  "default-src 'none'",
  `script-src 'self' https://www.gstatic.com/firebasejs/${FIREBASE_CDN_VERSION}/`,
  "connect-src 'self' https://*.googleapis.com",
  "img-src 'self' data: https:",
  "object-src 'none'",
  "base-uri 'none'",
].join("; ");
