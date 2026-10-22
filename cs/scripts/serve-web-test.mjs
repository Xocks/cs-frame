import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("dist"),
  prefix = "/cs-portraits/";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".md": "text/plain; charset=utf-8",
};
http
  .createServer((req, res) => {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!pathname.startsWith(prefix)) {
      res.writeHead(404).end();
      return;
    }
    const file = path.resolve(
      root,
      pathname.slice(prefix.length) || "index.html",
    );
    if (
      !file.startsWith(root + path.sep) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    fs.createReadStream(file).pipe(res);
  })
  .listen(4173, "127.0.0.1", () =>
    console.log("Website QA: http://127.0.0.1:4173/cs-portraits/"),
  );
