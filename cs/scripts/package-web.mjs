import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
function walk(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => !e.name.startsWith("."))
    .flatMap((e) =>
      e.isDirectory()
        ? walk(path.join(root, e.name))
        : [path.join(root, e.name)],
    );
}
const files = walk("dist").filter(
  (p) => !["sw.js", "404.html", "_headers"].includes(path.basename(p)),
);
const name =
  "frame-cs-" +
  crypto
    .createHash("sha256")
    .update(
      files
        .map(
          (p) =>
            p +
            crypto
              .createHash("sha256")
              .update(fs.readFileSync(p))
              .digest("hex"),
        )
        .join(""),
    )
    .digest("hex")
    .slice(0, 12);
const precache = files.map((p) => "./" + p.replace(/^dist\//, ""));
const sw = `const CACHE=${JSON.stringify(name)},FILES=${JSON.stringify(precache)};
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);try{await c.addAll(FILES);await self.skipWaiting()}catch(error){await caches.delete(CACHE);throw error}})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('frame-cs-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();for(const c of await self.clients.matchAll())c.postMessage('frame-offline-ready')})()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith((async()=>{const c=await caches.open(CACHE),cached=await c.match(e.request,{ignoreVary:true});if(cached)return cached;try{return await fetch(e.request)}catch(error){if(e.request.mode==='navigate')return await c.match(new URL('./index.html',self.location).href,{ignoreVary:true})||Response.error();throw error}})())});`;
fs.writeFileSync("dist/sw.js", sw);
fs.copyFileSync("dist/index.html", "dist/404.html");
fs.writeFileSync("dist/.nojekyll", "");
fs.writeFileSync(
  "dist/_headers",
  "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/sw.js\n  Cache-Control: no-cache\n",
);
fs.mkdirSync("delivery", { recursive: true });
const output = path.resolve("delivery/CS帧相-网站部署包.zip");
fs.rmSync(output, { force: true });
execFileSync("/usr/bin/zip", ["-qr", output, "."], {
  cwd: path.resolve("dist"),
});
console.log({
  websiteFiles: files.length,
  websiteZIP: output,
  offlinePackaging: "paused",
});
