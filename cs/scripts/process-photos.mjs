import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import sharp from "sharp";
const candidates = JSON.parse(
  fs.readFileSync("research/photo-candidates.json", "utf8"),
);
const logs = JSON.parse(fs.readFileSync("research/download-log.json", "utf8"));
const available = new Map(
  fs
    .readdirSync("research/downloads")
    .filter((f) => /^[0-9]+\./.test(f))
    .map((f) => [+f.split(".")[0], path.resolve("research/downloads/" + f)]),
);
fs.mkdirSync("research/processed", { recursive: true });
const results = [],
  rejected = [],
  hashes = new Set();
for (const c of candidates) {
  const input = available.get(c.pageid);
  if (!input || !fs.existsSync(input)) continue;
  const id = `commons-${c.pageid}`;
  const out = `public/photos/${c.playerId}-${id}`;
  try {
    const original = fs.readFileSync(input);
    const sha = crypto.createHash("sha256").update(original).digest("hex");
    if (hashes.has(sha)) {
      rejected.push({ id, reason: "同一原图重复" });
      continue;
    }
    hashes.add(sha);
    const upright = `research/processed/${id}.jpg`;
    await sharp(original).rotate().jpeg({ quality: 95 }).toFile(upright);
    const meta = await sharp(upright).metadata();
    const detection = JSON.parse(
      execFileSync("./scripts/detect-faces", [path.resolve(upright)], {
        encoding: "utf8",
      }).trim(),
    );
    const faces = detection.faces || [];
    if (faces.length !== 1) {
      rejected.push({
        id,
        playerId: c.playerId,
        title: c.title,
        reason:
          faces.length > 1
            ? "检测到多人，未自动指定身份"
            : "未检测到清晰正面人脸",
        faceCount: faces.length,
      });
      continue;
    }
    const f = faces[0];
    const iw = meta.width,
      ih = meta.height;
    const face = {
      x: f.x * iw,
      y: f.y * ih,
      width: f.width * iw,
      height: f.height * ih,
    };
    let height = Math.min(ih, face.height * 2.55),
      width = height * 0.8;
    if (width > iw) {
      width = iw;
      height = width / 0.8;
    }
    const cx = face.x + face.width / 2,
      cy = face.y + face.height * 0.72;
    const left = Math.max(0, Math.min(iw - width, cx - width / 2)),
      top = Math.max(0, Math.min(ih - height, cy - height * 0.43));
    const crop = {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.floor(width),
      height: Math.floor(height),
    };
    await sharp(upright)
      .extract(crop)
      .resize(960, 1200, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 85, effort: 5 })
      .toFile(out + "-large.webp");
    await sharp(upright)
      .extract(crop)
      .resize(480, 600, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 81, effort: 5 })
      .toFile(out + "-card.webp");
    const large = await sharp(out + "-large.webp").metadata();
    const raw = await sharp(out + "-card.webp")
      .resize(9, 8, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer();
    let dh = 0n;
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        dh = (dh << 1n) | (raw[y * 9 + x] > raw[y * 9 + x + 1] ? 1n : 0n);
    results.push({
      ...c,
      id,
      localPath: out.replace("public/", "") + "-large.webp",
      cardPath: out.replace("public/", "") + "-card.webp",
      crop,
      face,
      faceCount: 1,
      width: large.width,
      height: large.height,
      sha256: crypto
        .createHash("sha256")
        .update(fs.readFileSync(out + "-large.webp"))
        .digest("hex"),
      dhash: dh.toString(16).padStart(16, "0"),
      originalSha256: sha,
    });
  } catch (e) {
    rejected.push({ id, reason: String(e) });
  }
}
fs.writeFileSync(
  "research/processed-photos.json",
  JSON.stringify(results, null, 2),
);
fs.writeFileSync(
  "research/crop-rejections.json",
  JSON.stringify(rejected, null, 2),
);
console.log({
  processed: results.length,
  rejected: rejected.length,
  players: new Set(results.map((p) => p.playerId)).size,
});
// Contact sheets are QA artifacts only, never used as player photos.
for (let start = 0; start < results.length; start += 36) {
  const group = results.slice(start, start + 36),
    width = 1050,
    height = Math.ceil(group.length / 6) * 214;
  const inputs = [];
  for (let i = 0; i < group.length; i++) {
    const p = group[i];
    const label = `${p.nickname} / ${p.pageid}`.replace(/[<>&]/g, "");
    inputs.push({
      input: await sharp("public/" + p.cardPath)
        .resize(160, 180, { fit: "cover" })
        .toBuffer(),
      top: Math.floor(i / 6) * 214,
      left: (i % 6) * 175,
    });
    inputs.push({
      input: Buffer.from(
        `<svg width="170" height="28"><rect width="170" height="28" fill="#fff"/><text x="3" y="17" font-family="Arial" font-size="10" fill="#222">${label}</text></svg>`,
      ),
      top: Math.floor(i / 6) * 214 + 181,
      left: (i % 6) * 175,
    });
  }
  await sharp({ create: { width, height, channels: 3, background: "#eee" } })
    .composite(inputs)
    .png()
    .toFile(`research/contact-sheet-${Math.floor(start / 36) + 1}.png`);
}
