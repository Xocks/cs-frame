import type { Dataset, UserData, Rating } from "../types";
import { periodOrder } from "./catalogue";
export function download(filename: string, contents: string, type: string) {
  const u = URL.createObjectURL(new Blob(["\ufeff", contents], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export function csv(data: UserData, catalogue: Dataset) {
  const p = new Map(catalogue.players.map((x) => [x.id, x]));
  const teams = new Map(catalogue.teams.map((x) => [x.id, x.name]));
  const rows = [
    [
      "player_id",
      "nickname",
      "real_name",
      "country",
      "team",
      "mode",
      "period",
      "score",
      "photo_id",
      "updated_at",
    ],
    ...data.ratings.map((r) => {
      const x = p.get(r.playerId)!;
      return [
        r.playerId,
        x.nickname,
        x.realName,
        x.country,
        x.teamId ? teams.get(x.teamId) || "" : "",
        r.mode,
        r.period || "",
        r.value,
        r.photoId || "",
        r.updatedAt,
      ];
    }),
  ];
  return rows
    .map((row) =>
      row.map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(","),
    )
    .join("\r\n");
}
export function parseBackup(
  text: string,
  catalogue: Dataset,
): Pick<UserData, "ratings" | "representatives" | "periodRepresentatives"> {
  const b = JSON.parse(text.replace(/^\uFEFF/, ""));
  if (
    b.schemaVersion !== 1 ||
    !Array.isArray(b.ratings) ||
    !b.representatives ||
    typeof b.representatives !== "object" ||
    Array.isArray(b.representatives)
  )
    throw Error("不是有效的CS 评分备份（版本 1）");
  const ids = new Set(catalogue.players.map((p) => p.id));
  const photos = new Map(catalogue.photos.map((p) => [p.id, p]));
  const map = new Map<string, Rating>();
  for (const r of b.ratings) {
    if (
      !ids.has(r.playerId) ||
      !Number.isInteger(r.value) ||
      r.value < 1 ||
      r.value > 5 ||
      !["overall", "period"].includes(r.mode) ||
      typeof r.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(r.updatedAt))
    )
      throw Error("备份包含未知选手、无效分数或日期");
    if (
      r.mode === "period" &&
      (!periodOrder.includes(r.period) ||
        !catalogue.photos.some(
          (p) => p.playerId === r.playerId && p.period === r.period,
        ))
    )
      throw Error("备份包含不存在的照片时期");
    if (r.photoId && photos.get(r.photoId)?.playerId !== r.playerId)
      throw Error("照片与选手不匹配");
    const cleaned: Rating = {
      playerId: r.playerId,
      mode: r.mode,
      value: r.value,
      updatedAt: new Date(r.updatedAt).toISOString(),
      ...(r.mode === "period" ? { period: r.period } : {}),
      ...(r.photoId ? { photoId: r.photoId } : {}),
    };
    map.set(`${r.playerId}:${r.mode}:${r.period || ""}`, cleaned);
  }
  const representatives: Record<string, string> = {};
  for (const [pid, id] of Object.entries(b.representatives)) {
    if (typeof id !== "string" || photos.get(id)?.playerId !== pid)
      throw Error("代表照映射无效");
    representatives[pid] = id;
  }
  const periodRepresentatives: Record<string, string> = {};
  if (b.periodRepresentatives !== undefined) {
    if (
      !b.periodRepresentatives ||
      typeof b.periodRepresentatives !== "object" ||
      Array.isArray(b.periodRepresentatives)
    )
      throw Error("时期首选照片映射无效");
    for (const [key, id] of Object.entries(b.periodRepresentatives)) {
      if (typeof id !== "string") throw Error("时期首选照片映射无效");
      const photo = photos.get(id);
      if (!photo || key !== `${photo.playerId}:${photo.period}`)
        throw Error("时期首选照片与人物或时期不匹配");
      periodRepresentatives[key] = id;
    }
  }
  return { ratings: [...map.values()], representatives, periodRepresentatives };
}
export function mergeBackup(
  current: UserData,
  incoming: Pick<
    UserData,
    "ratings" | "representatives" | "periodRepresentatives"
  >,
): UserData {
  const map = new Map(
    current.ratings.map((r) => [
      `${r.playerId}:${r.mode}:${r.period || ""}`,
      r,
    ]),
  );
  for (const r of incoming.ratings) {
    const k = `${r.playerId}:${r.mode}:${r.period || ""}`;
    if (!map.has(k) || map.get(k)!.updatedAt <= r.updatedAt) map.set(k, r);
  }
  return {
    ...current,
    ratings: [...map.values()],
    representatives: {
      ...current.representatives,
      ...incoming.representatives,
    },
    periodRepresentatives: {
      ...current.periodRepresentatives,
      ...incoming.periodRepresentatives,
    },
    updatedAt: new Date().toISOString(),
  };
}
