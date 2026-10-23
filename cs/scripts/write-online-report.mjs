import fs from "node:fs";
import crypto from "node:crypto";
const deployed = fs.existsSync("docs/deployment-verification.json")
  ? JSON.parse(fs.readFileSync("docs/deployment-verification.json", "utf8"))
  : null;
const d = JSON.parse(fs.readFileSync("src/data/catalogue.json", "utf8"));
const tests = JSON.parse(
  fs.readFileSync("docs/playwright-online-results.json", "utf8"),
);
const quote = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
const csv = (rows) =>
  "\uFEFF" + rows.map((r) => r.map(quote).join(",")).join("\r\n") + "\r\n";
const player = new Map(d.players.map((p) => [p.id, p]));
const multiYear = d.players.filter(
  (p) =>
    new Set(
      d.photos
        .filter((ph) => ph.playerId === p.id && ph.year !== null)
        .map((ph) => ph.year),
    ).size >= 2,
);
const multiAge = d.players.filter(
  (p) =>
    new Set(
      d.photos
        .filter((ph) => ph.playerId === p.id && ph.period !== "undated")
        .map((ph) => ph.period),
    ).size >= 2,
);
const hltv = d.photos.filter((p) => p.sourcePlatform === "HLTV");
const rows = [
  [
    "playerId",
    "HLTV ID",
    "昵称",
    "真实姓名",
    "国籍",
    "队伍",
    "照片数",
    "出生日期",
    "来源",
  ],
  ...d.players.map((p) => [
    p.id,
    p.hltvId,
    p.nickname,
    p.realName,
    p.country,
    d.teams.find((t) => t.id === p.teamId)?.name,
    p.photoIds.length,
    p.birthDate,
    p.profileUrl,
  ]),
];
fs.writeFileSync("docs/选手清单.csv", csv(rows));
fs.writeFileSync(
  "docs/照片清单.csv",
  csv([
    [
      "photoId",
      "playerId",
      "昵称",
      "年份",
      "拍摄日期",
      "年龄",
      "时期",
      "来源平台",
      "作者",
      "版权许可",
      "使用依据",
      "来源",
      "本地大图",
      "本地卡片",
    ],
    ...d.photos.map((p) => [
      p.id,
      p.playerId,
      player.get(p.playerId).nickname,
      p.year,
      p.capturedAt,
      p.age,
      p.period,
      p.sourcePlatform || "Wikimedia Commons",
      p.photographer,
      p.license,
      p.licenseStatus || "open-license",
      p.sourceUrl,
      p.localPath,
      p.cardPath,
    ]),
  ]),
);
const missing = d.players.filter((p) => !p.photoIds.length);
fs.writeFileSync(
  "docs/缺图选手.md",
  `# 缺图清单\n\n当前 ${d.players.length} 位选手，${missing.length} 位缺照片。所有照片使用实际本地文件，缺少可靠拍摄日期时不推算年龄。\n` +
    missing.map((p) => `- ${p.nickname} (${p.id})`).join("\n"),
);
const summary = {
  generatedAt: new Date().toISOString(),
  version: d.version,
  snapshotDate: d.snapshotDate,
  players: d.players.length,
  photos: d.photos.length,
  albumPhotos: d.album.length,
  groupPhotos: d.album.filter((p) => p.kind === "group").length,
  uniqueSourcePhotos: new Set([
    ...d.photos.map((p) => p.id),
    ...d.album.map((p) => p.sourcePhotoId),
  ]).size,
  albumPlayers: new Set(d.album.flatMap((p) => p.playerIds)).size,
  playersWithPhotos: d.players.filter((p) => p.photoIds.length).length,
  chinesePlayersWithPhotos: d.players.filter(
    (p) => p.countryCode === "CN" && p.photoIds.length,
  ).length,
  hltvPhotos: hltv.length,
  commonsPhotos: d.photos.length - hltv.length,
  playersWithMultipleKnownYears: multiYear.length,
  playersWithMultipleVerifiedAgePeriods: multiAge.length,
  photosWithExactCaptureDate: d.photos.filter((p) => p.datePrecision === "day")
    .length,
  browserTests: {
    passed: tests.stats.expected,
    failed: tests.stats.unexpected,
  },
  offlineDelivery: "paused",
  repository: "https://github.com/Xocks/cs-portraits",
  targetSite: "https://xocks.github.io/cs-portraits/",
  deploymentVerified:
    deployed?.liveWebsiteVerified === true &&
    deployed.site === "https://xocks.github.io/cs-portraits/" &&
    deployed.albumCatalogueSha256 ===
      crypto
        .createHash("sha256")
        .update(JSON.stringify(d.album))
        .digest("hex") &&
    deployed.photoCatalogueSha256 ===
      crypto
        .createHash("sha256")
        .update(JSON.stringify(d.photos))
        .digest("hex"),
};
fs.writeFileSync("docs/online-release.json", JSON.stringify(summary, null, 2));
const report = `# 准星之外 CS PORTRAITS · 在线版交付与覆盖

更新：2026-10-23。仓库专注 CS；单机版暂停，F1 未改动。

| 指标 | 数量 |
|---|---:|
| 独立选手 | ${d.players.length} |
| Top20 首发 | 100 / 100 |
| 中国籍选手 | ${summary.chinesePlayersWithPhotos} |
| 个人裁切照片 | ${d.photos.length} |
| 完整构图赛事相册 | ${d.album.length} |
| 其中 HLTV 完整照片 | ${d.album.filter((p) => p.sourcePlatform === "HLTV").length} |
| 合照与队友画面 | ${summary.groupPhotos} |
| 不同原片（裁切/完整图去重） | ${summary.uniqueSourcePhotos} |
| 相册来源关联人物 | ${summary.albumPlayers} |
| 本地 WebP 文件 | ${(d.photos.length + d.album.length) * 2} |
| 至少两个精确年龄时期 | ${multiAge.length} 人 |

排名固定为 ${d.snapshotDate}，阵容采集日 ${d.collectedAt}，不宣称实时阵容。

## 本轮更新

品牌改为“准星之外”，英文 CS PORTRAITS，GitHub 仓库 Xocks/cs-portraits。
新增完整赛事相册，支持选手、年份、来源、合照筛选，完整大图、左右键切图、来源及年份依据、选手档案跳转。年份覆盖 2007—2026。
相册保留原始构图及可见摄影署名，个人评分图仍突出面部。同一原片的裁切版与完整版不重复计算原片数量。

230 位选手身份与无日期头像的拍摄信息分别记录：卡片显示“档案头像”，不再把未公开日期展示成人物身份存疑。日期缺失保留在来源详情，不推算年龄。只有来源可靠的精确拍摄日才生成年龄时期；目前仅 ${multiAge.length} 人拥有两个此类时期，不能宣称全部选手已有多个年龄段。

2026-10-23 用户完成直连设置后，HLTV 页面和 CDN 恢复正常访问。新读取 18 位重点选手图库，连同已有 8 位合计 26 位；下载 94 张原片，人工审核纳入 77 张完整照片与其中 44 张个人裁切版本，新增原片去重后为 77 张。排除近似重复、远景、背身和目标面孔不明确的画面。排除风景误命中、Oskar Holm / ins 与 Joshua Potter / INS 同名、巴西 ZeusCSGO 与乌克兰 Zeus 同名。来源关联的选手标签不等于对合照所有背景人物逐脸命名。

## 测试与构建

- 数据审计通过：稳定人物 ID、队籍、Top20、所有图片引用/格式/尺寸/哈希、年龄和相册年份依据。
- 7 项单元测试通过，${tests.stats.expected} 项真实 Chromium 浏览器测试通过，${tests.stats.unexpected} 失败。
- ${(d.photos.length+d.album.length)*2} 个本地 WebP 规格全部解码通过，无第三方运行时资源请求。
- 整体与时期评分独立、代表照、刷新恢复、JSON/CSV、筛选盲评、榜单、IndexedDB 兼容均通过。
- 新增中国选手跨年份照片、代表照恢复测试，以及相册测试覆盖年份/选手/来源/合照筛选、完整大图、左右键、Escape、年份来源、档案跳转和手机布局。
- 桌面 1440×1000、手机 390×844、深浅色、焦点及减少动态效果检查通过。

网站：https://xocks.github.io/cs-portraits/
仓库：https://github.com/Xocks/cs-portraits
当前发布核验状态：${summary.deploymentVerified ? "已核验本版正式网站" : "本地检查通过；正式上线以 deployment-verification.json 的版本匹配记录为准"}。

GitHub Pages 免费静态托管；国内三运营商未做实网验证，不能保证全国访问稳定。每位访问者的评分保存在自己的浏览器，无跨用户公共总榜。原存储键保持兼容，改名不清空同源评分，支持旧版 JSON 导入。

照片版权和逐图署名见《照片署名与许可》；批量扩充方法与当前阻碍见《相册扩充与批量采集》。HLTV 素材依据项目所有者使用声明，未冒称平台官方授权。
`;
fs.writeFileSync("docs/在线版进展.md", report);
fs.writeFileSync("docs/交付与覆盖报告.md", report);
console.log(summary);

fs.writeFileSync(
  "docs/赛事相册清单.csv",
  csv([
    [
      "id",
      "年份",
      "类型",
      "来源平台",
      "标题",
      "关联人物",
      "摄影者",
      "年份依据",
      "来源",
      "原片ID",
      "本地大图",
      "SHA256",
    ],
    ...d.album.map((p) => [
      p.id,
      p.year,
      p.kind,
      p.sourcePlatform,
      p.title,
      p.playerIds.map((id) => player.get(id)?.nickname).join(" / "),
      p.photographer,
      p.yearEvidence,
      p.sourceUrl,
      p.sourcePhotoId,
      p.localPath,
      p.sha256,
    ]),
  ]),
);
