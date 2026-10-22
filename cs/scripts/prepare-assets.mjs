import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const d = JSON.parse(fs.readFileSync("src/data/catalogue.json", "utf8"));
const complete = (photos) =>
  photos.every(
    (p) =>
      [p.localPath, p.cardPath].every((f) => fs.existsSync("public/" + f)) &&
      crypto
        .createHash("sha256")
        .update(fs.readFileSync("public/" + p.localPath))
        .digest("hex") === p.sha256,
  );
for (const [name, photos] of [
  ["photo-assets.zip", d.photos],
  ["album-assets.zip", d.album || []],
]) {
  if (complete(photos)) continue;
  const archive = fs.existsSync(name) ? name : "../" + name;
  if (!fs.existsSync(archive))
    throw Error(
      `Missing ${name}; restore the photo asset bundle from the repository root.`,
    );
  const files = execFileSync("unzip", ["-Z1", archive], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter((f) => !f.endsWith("/"));
  const expected = new Set(photos.flatMap((p) => [p.localPath, p.cardPath]));
  if (files.length !== expected.size || files.some((f) => !expected.has(f)))
    throw Error("Photo asset archive does not match the published catalogue.");
  fs.mkdirSync("public", { recursive: true });
  execFileSync("unzip", ["-oq", archive, "-d", "public"]);
  if (!complete(photos))
    throw Error(
      "Photo checksum validation failed after extracting the asset archive.",
    );
}
console.log({
  photoAssets: (d.photos.length + (d.album || []).length) * 2,
  verified: true,
});
