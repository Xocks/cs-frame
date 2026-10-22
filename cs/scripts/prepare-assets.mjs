import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const d = JSON.parse(fs.readFileSync("src/data/catalogue.json", "utf8"));
const complete = () =>
  d.photos.every(
    (p) =>
      [p.localPath, p.cardPath].every((f) => fs.existsSync("public/" + f)) &&
      crypto
        .createHash("sha256")
        .update(fs.readFileSync("public/" + p.localPath))
        .digest("hex") === p.sha256,
  );
if (!complete()) {
  const archive = fs.existsSync("photo-assets.zip")
    ? "photo-assets.zip"
    : "../photo-assets.zip";
  if (!fs.existsSync(archive))
    throw Error(
      "Missing photo-assets.zip; restore the photo asset bundle from the repository root.",
    );
  const files = execFileSync("unzip", ["-Z1", archive], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter((f) => !f.endsWith("/"));
  const expected = new Set(d.photos.flatMap((p) => [p.localPath, p.cardPath]));
  if (files.length !== expected.size || files.some((f) => !expected.has(f)))
    throw Error("Photo asset archive does not match the published catalogue.");
  fs.mkdirSync("public", { recursive: true });
  execFileSync("unzip", ["-oq", archive, "-d", "public"]);
  if (!complete())
    throw Error(
      "Photo checksum validation failed after extracting the asset archive.",
    );
}
console.log({ photoAssets: d.photos.length * 2, verified: true });
