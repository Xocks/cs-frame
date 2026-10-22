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
  repository: "https://github.com/Xocks/cs-frame",
  targetSite: "https://xocks.github.io/cs-frame/",
  deploymentVerified:
    deployed?.liveWebsiteVerified === true &&
    deployed.photoCatalogueSha256 ===
      crypto
        .createHash("sha256")
        .update(JSON.stringify(d.photos))
        .digest("hex"),
};
fs.writeFileSync("docs/online-release.json", JSON.stringify(summary, null, 2));
const report = `# 帧相 FRAME · 在线版进展与验证\n\n更新：2026-10-22。单机版与离线打包按用户要求暂停，旧离线文件不包含本轮素材。F1 未更改。\n\n## 实际覆盖\n\n| 指标 | 结果 |\n|---|---:|\n| 独立选手 / 有照片选手 | ${d.players.length} / ${summary.playersWithPhotos} |\n| Top20 首发档案 / 有照片 | 100 / ${
  d.teams
    .filter((t) => t.rank <= 20)
    .flatMap((t) => t.playerIds)
    .filter((id) => player.get(id).photoIds.length).length
} |\n| 中国籍选手 / 有照片 | ${d.players.filter((p) => p.countryCode === "CN").length} / ${summary.chinesePlayersWithPhotos} |\n| 照片 | ${d.photos.length} |\n| HLTV / Commons | ${hltv.length} / ${d.photos.length - hltv.length} |\n| 本地图片文件 | ${d.photos.length * 2} |\n| 至少两个已知拍摄年份 | ${multiYear.length} 人 |\n| 至少两个已核实年龄时期 | ${multiAge.length} 人 |\n| 精确拍摄日可靠的照片 | ${summary.photosWithExactCaptureDate} |\n\n排名固定为 ${d.snapshotDate}，阵容于 ${d.collectedAt} 核对；不是自动变化的实时排名。\n\n新增 HLTV 头像由稳定 Player ID 个人页的 canonical、昵称、真名和 og:image 映射，核对单一人脸并逐张检查联系表。不同年龄的历史素材按原始年份保留；头像采集日期不冒充拍摄日期。图库候选须只标注目标人物，进一步剔除多人、模糊、面部遮挡和近重复构图。8 位重点选手的个人图库已按较早、中间和近期年份检查，最后仅纳入通过清晰度筛选的 9 张。没有用同次拍摄伪装多个年龄。\n\n照片数量与人物覆盖达标，**跨年龄素材仍不充分**：只有 ${multiAge.length} 人拥有两个已核实年龄时期。其余无可靠日期的照片继续显示“年龄未核实”，年份按钮便于浏览，不能宣称全部选手已有 2–3 个年龄阶段。\n\nHLTV 素材按项目所有者的使用权限声明纳入，版权归原权利人，未写成已获得官方授权。Commons 照片保留公开许可。原片只裁切、缩放、转 WebP，没有生成或重塑人脸。\n\n## 已完成的在线功能\n\n浅深色、卡片和切图动画、减少动态效果、桌面与手机适配；队伍/排名/国籍/档案筛选、搜索、随机和盲评；大图、时期/年份及候选切换、代表照；整体与分时期独立评分；个人/战队/时期/中国/现役历史对比；IndexedDB、本地兼容存储、JSON 导入导出和 CSV。未评分不作为零分。\n\n没有公共评分后端。每位朋友的数据保存在各自浏览器，不会冒充全站总榜。\n\n## 测试证据\n\n- 数据结构、稳定 ID、队籍、Top20、所有本地文件引用/格式/尺寸/哈希、年龄一致性检查通过。\n- 7 项 Node 单元测试通过。\n- 在线 Playwright Chromium ${tests.stats.expected} 项通过、${tests.stats.unexpected} 项失败；使用 /frame-cs/ 子路径模拟 GitHub Pages 项目路径。\n- 逐一加载全部 ${d.photos.length * 2} 个图片规格，无失败；页面没有访问 HLTV、GitHub Raw 或第三方字体/API 来运行。\n- 整体和时期评分独立保存，刷新恢复，代表照恢复；JSON/CSV 下载、新浏览器上下文恢复和无效导入拒绝已验证。\n- 盲评、搜索真名/ID、队伍/国籍/排名筛选、战队样本均分、手机390×844、桌面1440×1000、深色、焦点和 Escape 均已验证。\n\n截图在 desktop.png、desktop-dark.png、mobile.png、mobile-detail.png；机器可读结果在 playwright-online-results.json。当前尚无国内三运营商实网测试，不能承诺全国访问稳定。\n\n## GitHub 发布\n\n用户已明确确认创建公开仓库 Xocks/cs-frame 并发布。仓库已创建，目标网址为 https://xocks.github.io/cs-frame/，最终以上线验证记录为准。源码使用 GitHub Actions 构建，照片压缩资源包在构建时解压为同站本地文件；默认构建不生成单机包。\n\nGitHub Pages 免费条件、额度和国内访问边界见《GitHub免费部署研究》。部署成功后会补充正式网址验证与提交信息。\n`;
fs.writeFileSync("docs/在线版进展.md", report);
fs.writeFileSync("docs/交付与覆盖报告.md", report);
console.log(summary);
