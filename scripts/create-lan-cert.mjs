import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, networkInterfaces } from "node:os";
import { join } from "node:path";

const certDir = new URL("../certificates/", import.meta.url);
const certPath = new URL("cosaif-lan.pem", certDir);
const keyPath = new URL("cosaif-lan-key.pem", certDir);
const metaPath = new URL("cosaif-lan-hosts.json", certDir);

function getLanIps() {
  const ignored = new Set(["127.0.0.1", "0.0.0.0"]);
  return Object.values(networkInterfaces())
    .flat()
    .filter(Boolean)
    .filter((item) => item.family === "IPv4" && !item.internal && !ignored.has(item.address))
    .map((item) => item.address)
    .sort();
}

function commandExists(command) {
  try {
    execFileSync("which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function getMkcertCa() {
  const caRoot = process.env.CAROOT || join(homedir(), "Library", "Application Support", "mkcert");
  const caPath = join(caRoot, "rootCA.pem");
  const keyPath = join(caRoot, "rootCA-key.pem");

  if (existsSync(caPath) && existsSync(keyPath)) {
    return { caPath, keyPath };
  }

  return null;
}

function sameCertificate(hosts, generator) {
  if (!existsSync(metaPath)) return false;
  try {
    const previous = JSON.parse(readFileSync(metaPath, "utf8"));
    return previous.generator === generator && JSON.stringify(previous.hosts) === JSON.stringify(hosts);
  } catch {
    return false;
  }
}

function writeOpenSslConfig(ips) {
  const configPath = join(certDir.pathname, "cosaif-lan.openssl.cnf");
  const altNames = [
    "DNS.1 = localhost",
    ...ips.map((ip, index) => `IP.${index + 1} = ${ip}`),
    `IP.${ips.length + 1} = 127.0.0.1`,
  ].join("\n");

  writeFileSync(
    configPath,
    [
      "[req]",
      "default_bits = 2048",
      "prompt = no",
      "default_md = sha256",
      "distinguished_name = dn",
      "req_extensions = v3_req",
      "x509_extensions = v3_req",
      "",
      "[dn]",
      "CN = COSAIF local development",
      "",
      "[v3_req]",
      "subjectAltName = @alt_names",
      "",
      "[alt_names]",
      altNames,
      "",
    ].join("\n")
  );

  return configPath;
}

function createWithMkcert(hosts) {
  execFileSync("mkcert", ["-install"], { stdio: "inherit" });
  execFileSync("mkcert", ["-key-file", keyPath.pathname, "-cert-file", certPath.pathname, ...hosts], {
    stdio: "inherit",
  });
}

function createWithExistingMkcertCa(ips, ca) {
  const configPath = writeOpenSslConfig(ips);
  const csrPath = join(certDir.pathname, "cosaif-lan.csr");

  execFileSync(
    "openssl",
    [
      "req",
      "-new",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      keyPath.pathname,
      "-out",
      csrPath,
      "-config",
      configPath,
    ],
    { stdio: "inherit" }
  );

  execFileSync(
    "openssl",
    [
      "x509",
      "-req",
      "-in",
      csrPath,
      "-CA",
      ca.caPath,
      "-CAkey",
      ca.keyPath,
      "-out",
      certPath.pathname,
      "-days",
      "825",
      "-sha256",
      "-extfile",
      configPath,
      "-extensions",
      "v3_req",
      "-set_serial",
      String(Date.now()),
    ],
    { stdio: "inherit" }
  );

  rmSync(configPath, { force: true });
  rmSync(csrPath, { force: true });

  console.log("");
  console.log("Certificado LAN firmado con la CA local de mkcert.");
}

function createWithOpenSsl(ips) {
  const configPath = writeOpenSslConfig(ips);

  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "825",
      "-keyout",
      keyPath.pathname,
      "-out",
      certPath.pathname,
      "-config",
      configPath,
    ],
    { stdio: "inherit" }
  );
  rmSync(configPath, { force: true });

  console.log("");
  console.log("Certificado self-signed generado. Para que Chrome lo trate como seguro en otros equipos, hay que confiar este certificado/CA en ese equipo.");
}

mkdirSync(certDir, { recursive: true });

const ips = getLanIps();
const hosts = ["localhost", "127.0.0.1", ...ips];
const mkcertCa = getMkcertCa();
const generator = commandExists("mkcert") ? "mkcert" : mkcertCa ? "mkcert-ca" : "openssl-self-signed";

if (existsSync(certPath) && existsSync(keyPath) && sameCertificate(hosts, generator)) {
  console.log(`Certificado LAN listo: ${certPath.pathname}`);
} else if (generator === "mkcert") {
  createWithMkcert(hosts);
} else if (generator === "mkcert-ca" && mkcertCa) {
  createWithExistingMkcertCa(ips, mkcertCa);
} else {
  createWithOpenSsl(ips);
}

writeFileSync(metaPath, JSON.stringify({ hosts, generator, generatedAt: new Date().toISOString() }, null, 2));

console.log("");
console.log("URLs correctas:");
console.log("  Esta Mac: https://localhost:3012");
for (const ip of ips) {
  console.log(`  Misma red: https://${ip}:3012`);
}
console.log("");
console.log("No abras https://0.0.0.0:3012; 0.0.0.0 es solo para levantar el server.");
