// server.ts
import http from "http";
import next from "next";

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "127.0.0.1";
const forceHttps = process.env.FORCE_HTTPS === "1";

const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    if (forceHttps && req.headers["x-forwarded-proto"] !== "https") {
      res.statusCode = 301;
      res.setHeader("Location", `https://${req.headers.host}${req.url}`);
      return res.end();
    }
    return handle(req, res);
  });
  server.listen(port, host, () => {
    console.log(`Ready on http://${host}:${port}`);
  });
}).catch((err) => {
  console.error("Startup error:", err);
  process.exit(1);
});
