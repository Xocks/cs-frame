import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "frame-cs-tests-"));
const out = path.join(temp, "transfer.mjs");
await build({
  entryPoints: ["src/lib/transfer.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
});
const { parseBackup, mergeBackup, csv } = await import(pathToFileURL(out).href);
const catalogue = JSON.parse(
  fs.readFileSync("src/data/catalogue.json", "utf8"),
);
const player = catalogue.players.find((p) => p.nickname === "ZywOo");
const ph = catalogue.photos.find((p) => p.playerId === player.id);
const base = {
  schemaVersion: 1,
  ratings: [],
  representatives: {},
  periodRepresentatives: {},
  settings: { theme: "light" },
  updatedAt: "2026-10-21T01:00:00.000Z",
};
const rating = {
  playerId: player.id,
  mode: "overall",
  value: 4,
  photoId: ph?.id,
  updatedAt: "2026-10-21T02:00:00.000Z",
};
test("reject forged score, foreign player, invalid date and incorrect photo ownership", () => {
  for (const patch of [
    { value: 0 },
    { value: 6 },
    { value: 1.5 },
    { playerId: "made-up" },
    { updatedAt: "not-a-date" },
    { photoId: "missing-photo" },
  ])
    assert.throws(() =>
      parseBackup(
        JSON.stringify({ ...base, ratings: [{ ...rating, ...patch }] }),
        catalogue,
      ),
    );
});
test("import is validated atomically before state can change", () => {
  const before = structuredClone(base);
  assert.throws(() =>
    parseBackup(
      JSON.stringify({
        ...base,
        ratings: [rating, { ...rating, playerId: "unknown" }],
      }),
      catalogue,
    ),
  );
  assert.deepEqual(base, before);
});
test("overall and period ratings use distinct keys during restore", () => {
  assert.ok(ph, "a real verified photo is required");
  const input = parseBackup(
    JSON.stringify({
      ...base,
      ratings: [
        rating,
        { ...rating, mode: "period", period: ph.period, value: 2 },
      ],
    }),
    catalogue,
  );
  assert.equal(input.ratings.length, 2);
  const merged = mergeBackup(base, input);
  assert.equal(merged.ratings.find((r) => r.mode === "overall").value, 4);
  assert.equal(merged.ratings.find((r) => r.mode === "period").value, 2);
});
test("older backup cannot overwrite newer rating; representative map validates person", () => {
  const current = {
    ...base,
    ratings: [{ ...rating, value: 5, updatedAt: "2026-10-21T03:00:00.000Z" }],
  };
  const merged = mergeBackup(current, {
    ratings: [rating],
    representatives: {},
  });
  assert.equal(merged.ratings[0].value, 5);
  const other = catalogue.players.find((p) => p.id !== player.id);
  assert.throws(() =>
    parseBackup(
      JSON.stringify({ ...base, representatives: { [other.id]: ph.id } }),
      catalogue,
    ),
  );
});
test("CSV includes only real ratings and quotes multiline or comma-bearing names", () => {
  const cloned = structuredClone(catalogue);
  cloned.players.find((p) => p.id === player.id).realName =
    'Mathieu, "Test"\nHerbaut';
  const output = csv({ ...base, ratings: [rating] }, cloned);
  assert.equal(output.includes('"Mathieu, ""Test""\nHerbaut"'), true);
  assert.equal(output.includes('"hltv-11893"'), true);
  assert.equal(output.includes('"hltv-19230"'), false);
});
test("equivalent timezone offsets are normalized before merging backup dates", () => {
  const incoming = parseBackup(
    JSON.stringify({
      ...base,
      ratings: [{ ...rating, updatedAt: "2026-10-21T10:00:00+08:00" }],
    }),
    catalogue,
  );
  assert.equal(incoming.ratings[0].updatedAt, "2026-10-21T02:00:00.000Z");
  const current = {
    ...base,
    ratings: [{ ...rating, value: 5, updatedAt: "2026-10-21T03:00:00.000Z" }],
  };
  assert.equal(mergeBackup(current, incoming).ratings[0].value, 5);
});
test("per-period preferred photographs restore only to the matching player and period", () => {
  const key = `${player.id}:${ph.period}`;
  const parsed = parseBackup(
    JSON.stringify({ ...base, periodRepresentatives: { [key]: ph.id } }),
    catalogue,
  );
  assert.equal(mergeBackup(base, parsed).periodRepresentatives[key], ph.id);
  assert.throws(() =>
    parseBackup(
      JSON.stringify({
        ...base,
        periodRepresentatives: { [`${player.id}:imaginary`]: ph.id },
      }),
      catalogue,
    ),
  );
});
process.on("exit", () => fs.rmSync(temp, { recursive: true, force: true }));
