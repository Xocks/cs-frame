import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
const data = JSON.parse(fs.readFileSync("src/data/catalogue.json", "utf8"));
const delivery = path.resolve("delivery");
fs.mkdirSync(delivery, { recursive: true });
const output = await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  write: false,
  outdir: "offline-build",
  format: "iife",
  minify: true,
  legalComments: "eof",
  target: ["es2020"],
  define: {
    "process.env.NODE_ENV": '"production"',
    "import.meta.env.PROD": "false",
    "import.meta.env.DEV": "false",
  },
});
const js = output.outputFiles.find((x) => x.path.endsWith(".js")).text,
  css = output.outputFiles.find((x) => x.path.endsWith(".css")).text;
const head = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f6f6f3"><meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:;script-src 'self' 'unsafe-inline';style-src 'self' 'unsafe-inline';img-src 'self' data: blob:;connect-src 'none';object-src 'none';base-uri 'self'"><title>帧相 FRAME · CS 人像档案</title>`;
const offline = "offline-dist";
fs.rmSync(offline, { recursive: true, force: true });
fs.mkdirSync(offline, { recursive: true });
fs.writeFileSync(offline + "/app.js", js);
fs.writeFileSync(offline + "/app.css", css);
fs.writeFileSync(
  offline + "/index.html",
  head +
    '<link rel="stylesheet" href="./app.css"></head><body><div id="root"></div><script src="./app.js"></script></body></html>',
);
fs.cpSync("public/photos", offline + "/photos", { recursive: true });
fs.cpSync("public/data", offline + "/data", { recursive: true });
if (fs.existsSync("docs/使用说明.md"))
  fs.copyFileSync("docs/使用说明.md", offline + "/使用说明.md");
if (fs.existsSync("docs/照片署名与许可.md"))
  fs.copyFileSync("docs/照片署名与许可.md", offline + "/照片署名与许可.md");
for (const name of [
  "交付与覆盖报告.md",
  "缺图选手.md",
  "缺图选手.json",
  "选手清单.csv",
  "照片清单.csv",
  "HLTV照片来源与授权记录.md",
  "data-audit.json",
])
  if (fs.existsSync("docs/" + name))
    fs.copyFileSync("docs/" + name, offline + "/" + name);
const images = {};
for (const ph of data.photos)
  for (const p of [ph.cardPath, ph.localPath])
    images[p] =
      "data:image/webp;base64," +
      fs.readFileSync("public/" + p).toString("base64");
const safe = js.replace(/<\/script/gi, "<\\/script");
fs.writeFileSync(
  delivery + "/CS帧相-单文件离线版.html",
  head +
    `<style>${css}</style></head><body><div id="root"></div><script>window.__OFFLINE_IMAGES__=${JSON.stringify(images)};</script><script>${safe}</script></body></html>`,
);
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
const precache = walk("dist")
  .map((x) => x.replace(/^dist\//, "./"))
  .filter((x) => !x.endsWith("/sw.js"));
const cache =
  "frame-cs-" +
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify(precache) +
        JSON.stringify(
          precache.map((p) =>
            crypto
              .createHash("sha256")
              .update(
                fs.readFileSync(path.join("dist", p.replace(/^\.\//, ""))),
              )
              .digest("hex"),
          ),
        ),
    )
    .digest("hex")
    .slice(0, 12);
const sw = `const CACHE=${JSON.stringify(cache)};const FILES=${JSON.stringify(precache)};self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);try{await c.addAll(FILES);await self.skipWaiting()}catch(error){await caches.delete(CACHE);throw error}})()));self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('frame-cs-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();for(const c of await self.clients.matchAll())c.postMessage('frame-offline-ready')})()));self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith((async()=>{const c=await caches.open(CACHE);const cached=await c.match(e.request,{ignoreVary:true});if(cached)return cached;try{return await fetch(e.request)}catch(error){if(e.request.mode==='navigate')return await c.match(new URL('./index.html',self.location).href,{ignoreVary:true})||Response.error();throw error}})())});`;
fs.writeFileSync("dist/sw.js", sw);
fs.copyFileSync("dist/index.html", "dist/404.html");
fs.writeFileSync(
  "dist/_headers",
  "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/sw.js\n  Cache-Control: no-cache\n",
);
for (const [folder, name] of [
  [offline, "CS帧相-完整离线版.zip"],
  ["dist", "CS帧相-网站部署包.zip"],
]) {
  const target = delivery + "/" + name;
  fs.rmSync(target, { force: true });
  execFileSync("/usr/bin/zip", ["-qr", target, "."], {
    cwd: path.resolve(folder),
  });
}
console.log({
  photos: data.photos.length,
  singleFileMB: (
    fs.statSync(delivery + "/CS帧相-单文件离线版.html").size / 1048576
  ).toFixed(2),
  offlineZIPMB: (
    fs.statSync(delivery + "/CS帧相-完整离线版.zip").size / 1048576
  ).toFixed(2),
  precacheFiles: precache.length,
});
