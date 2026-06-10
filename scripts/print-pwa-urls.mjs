import { networkInterfaces } from "node:os";

const ips = Object.values(networkInterfaces())
  .flat()
  .filter(Boolean)
  .filter((item) => item.family === "IPv4" && !item.internal)
  .map((item) => item.address)
  .sort();

console.log("PWA local:");
console.log("  https://localhost:3012");

if (ips.length) {
  console.log("");
  console.log("PWA desde otro equipo/celular en la misma red:");
  for (const ip of ips) {
    console.log(`  https://${ip}:3012`);
  }
}

console.log("");
console.log("No uses https://0.0.0.0:3012 en el navegador.");
console.log("Si Chrome muestra privacidad, el certificado no esta confiado en ese equipo.");
