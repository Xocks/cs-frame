// Bounded, resumable downloader for already inspected source URLs.
// Downloaded files are research candidates; manual review is required to publish.
import fs from "node:fs";
import crypto from "node:crypto";
const queue = JSON.parse(
  fs.readFileSync("research/hltv-album-download-queue.json", "utf8"),
);
const directory = "research/album-downloads";
const manifest = directory + "/manifest.json";
fs.mkdirSync(directory, { recursive: true });
const log = fs.existsSync(manifest)
  ? JSON.parse(fs.readFileSync(manifest, "utf8"))
  : [];
const pending = queue.filter(
  (p) => !log.some((r) => r.id === p.id && r.ok && fs.existsSync(r.path)),
);
const dry = process.argv.includes("--dry-run");
const arg = process.argv.indexOf("--limit");
const limit = arg < 0 ? 20 : Number(process.argv[arg + 1]);
if (!Number.isInteger(limit) || limit < 1 || limit > 100)
  throw Error("--limit must be 1–100");
for (const p of queue) {
  if (
    !/^\d+$/.test(p.id) ||
    new URL(p.image).hostname !== "img-cdn.hltv.org" ||
    !p.year ||
    !p.yearEvidence ||
    !p.players.length
  )
    throw Error("Unverified queue record " + p.id);
}
console.log({
  queue: queue.length,
  pending: pending.length,
  dryRun: dry,
  limit,
});
if (dry) process.exit(0);
let failures = 0;
for (const p of pending.slice(0, limit)) {
  const row = {
    id: p.id,
    checkedAt: new Date().toISOString(),
    sourceUrl: p.sourceUrl,
    year: p.year,
    ok: false,
  };
  try {
    const response = await fetch(p.image, {
      signal: AbortSignal.timeout(15000),
    });
    row.status = response.status;
    if ([403, 429].includes(response.status)) {
      row.reason =
        "Source denied access; stopped. Do not retry via alternate identity or proxy.";
      log.push(row);
      fs.writeFileSync(manifest, JSON.stringify(log, null, 2));
      console.log(row);
      break;
    }
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("image/")
    )
      throw Error("Invalid image response " + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 500) throw Error("Empty or abnormally small image");
    row.path = directory + "/" + p.id + ".jpg";
    fs.writeFileSync(row.path, bytes);
    row.ok = true;
    row.sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    failures = 0;
  } catch (error) {
    row.reason = String(error);
    failures++;
  }
  log.push(row);
  fs.writeFileSync(manifest, JSON.stringify(log, null, 2));
  console.log({ id: row.id, ok: row.ok, status: row.status });
  if (failures >= 3) break;
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
