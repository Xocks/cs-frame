import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
const rows = JSON.parse(fs.readFileSync("research/hltv-photo-sources.json"));
const players = new Map(
  JSON.parse(fs.readFileSync("src/data/catalogue.json")).players.map((p) => [
    p.id,
    p,
  ]),
);
const paths = rows
  .map((p) => path.resolve("research/hltv-downloads/" + p.playerId + ".png"))
  .filter((p) => fs.existsSync(p));
const detections = execFileSync(path.resolve("scripts/detect-faces"), paths, {
  maxBuffer: 8 * 1024 * 1024,
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((s) => JSON.parse(s));
const faces = new Map(detections.map((d) => [d.path, d.faces]));
const out = [],
  rejected = [];
fs.mkdirSync("research/hltv-processed", { recursive: true });
for (const row of rows) {
  const p = players.get(row.playerId),
    input = path.resolve("research/hltv-downloads/" + row.playerId + ".png");
  if (!fs.existsSync(input)) {
    rejected.push({ playerId: row.playerId, reason: "download unavailable" });
    continue;
  }
  const normalize = (s) => s?.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (
    !p ||
    normalize(row.nickname) !== normalize(p.nickname) ||
    normalize(row.realName) !== normalize(p.realName) ||
    !row.profile.includes("/" + p.hltvId + "/")
  ) {
    rejected.push({
      playerId: row.playerId,
      reason: "profile identity mapping mismatch",
      source: row,
    });
    continue;
  }
  const fsFound = faces.get(input) || [];
  if (fsFound.length !== 1) {
    rejected.push({
      playerId: row.playerId,
      reason: "single clear face not detected",
      faceCount: fsFound.length,
    });
    continue;
  }
  const meta = await sharp(input).metadata(),
    f = fsFound[0];
  const face = {
    x: f.x * meta.width,
    y: f.y * meta.height,
    w: f.width * meta.width,
    h: f.height * meta.height,
  };
  if (face.w < 50 || face.h < 60) {
    rejected.push({ playerId: row.playerId, reason: "face too small" });
    continue;
  }
  let h = Math.min(meta.height, face.h * 1.9),
    w = h * 0.8;
  if (w > meta.width) {
    w = meta.width;
    h = w / 0.8;
  }
  const crop = {
    left: Math.round(
      Math.max(0, Math.min(meta.width - w, face.x + face.w / 2 - w / 2)),
    ),
    top: Math.round(
      Math.max(0, Math.min(meta.height - h, face.y - face.h * 0.25)),
    ),
    width: Math.floor(w),
    height: Math.floor(h),
  };
  const id = "hltv-profile-" + p.hltvId;
  const large = "photos/" + id + "-large.webp",
    card = "photos/" + id + "-card.webp";
  await sharp(input)
    .extract(crop)
    .resize({ width: 640, withoutEnlargement: true })
    .webp({ quality: 88, effort: 5 })
    .toFile("public/" + large);
  await sharp(input)
    .extract(crop)
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 83, effort: 5 })
    .toFile("public/" + card);
  const dim = await sharp("public/" + large).metadata();
  out.push({
    id,
    playerId: p.id,
    year: null,
    capturedAt: null,
    datePrecision: "unknown",
    dateNote:
      "来源为 HLTV 个人资料页头像；2026-10-21 是资料核对日期，不是拍摄日期，不能据此推算年龄。",
    age: null,
    period: "undated",
    teamAtTime: null,
    sourceUrl: row.profile,
    originalUrl: row.image,
    title: p.nickname + " — HLTV player profile portrait",
    photographer: "HLTV / 原摄影者未在个人页标注",
    license: "保留版权；使用权限由项目所有者声明",
    licenseUrl: "https://www.hltv.org/terms",
    licenseStatus: "user-declared",
    sourcePlatform: "HLTV",
    sourceCheckedAt: "2026-10-21",
    identityVerified: true,
    identityEvidence: `HLTV Player ID #${p.hltvId} 个人页 canonical、昵称 ${row.nickname} 与真实姓名 ${row.realName} 均匹配，照片由该人物页 og:image 直接关联；未按昵称搜索替换。`,
    reviewStatus: "reviewed",
    localPath: large,
    cardPath: card,
    isDefault: true,
    isPrimary: true,
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync("public/" + large))
      .digest("hex"),
    width: dim.width,
    height: dim.height,
    alterations:
      "仅裁切、按比例缩放和 WebP 转换；人脸定位仅用于裁切，不替代来源身份映射。裁切框 " +
      JSON.stringify(crop),
    originalSha1: crypto
      .createHash("sha1")
      .update(fs.readFileSync(input))
      .digest("hex"),
  });
  await sharp(input)
    .extract(crop)
    .resize({ width: 144 })
    .jpeg({ quality: 84 })
    .toFile("research/hltv-processed/" + p.id + ".jpg");
}
fs.writeFileSync(
  "research/hltv-approved-photos.json",
  JSON.stringify(out, null, 2),
);
fs.writeFileSync(
  "research/hltv-crop-rejections.json",
  JSON.stringify(rejected, null, 2),
);
const cols = 8,
  cellW = 180,
  cellH = 238,
  perSheet = 48;
for (let start = 0; start < out.length; start += perSheet) {
  const batch = out.slice(start, start + perSheet),
    layers = [];
  for (let i = 0; i < batch.length; i++) {
    const ph = batch[i],
      p = players.get(ph.playerId),
      x = (i % cols) * cellW,
      y = Math.floor(i / cols) * cellH;
    layers.push({
      input: await sharp("research/hltv-processed/" + p.id + ".jpg")
        .resize(164, 205, { fit: "contain", background: "#fff" })
        .toBuffer(),
      left: x + 8,
      top: y,
    });
    const name = p.nickname.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
    layers.push({
      input: Buffer.from(
        `<svg width="180" height="32"><rect width="180" height="32" fill="white"/><text x="8" y="14" font-size="13">${name}</text><text x="8" y="29" font-size="11">#${p.hltvId}</text></svg>`,
      ),
      left: x,
      top: y + 205,
    });
  }
  await sharp({
    create: {
      width: cols * cellW,
      height: Math.ceil(batch.length / cols) * cellH,
      channels: 3,
      background: "#fff",
    },
  })
    .composite(layers)
    .png()
    .toFile(
      "research/hltv-contact-" + (Math.floor(start / perSheet) + 1) + ".png",
    );
}
console.log({
  approved: out.length,
  rejected: rejected.length,
  sheets: Math.ceil(out.length / perSheet),
});
