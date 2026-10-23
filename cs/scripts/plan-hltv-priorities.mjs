// Produce an inspectable acquisition plan from local evidence; no network calls.
import fs from "node:fs";
const read = name => JSON.parse(fs.readFileSync(name, "utf8"));
const d = read("src/data/catalogue.json");
const indices = read("research/hltv-gallery-indices.json");
const directQueue = read("research/hltv-album-download-queue.json");
const core = ["donk", "ZywOo", "m0NESY", "NiKo", "s1mple", "sh1ro", "ropz", "flameZ", "XANTARES", "device", "Twistzz", "b1t", "w0nderful", "torzsi", "frozen", "KSCERATO", "yuurih", "FalleN", "Jimpphat", "EliGE", "kyousuke"];
const china = ["JamYoung", "Moseyuh", "Starry", "z4kr", "Westmelon"];
const names = [...core, ...china];
const knownSources = new Set([...d.photos.map(p=>p.sourceUrl), ...d.album.map(p=>p.sourceUrl)]);
const priorities = [];
const pageQueue = new Map();
for (let i=0; i<names.length; i++) {
  const p = d.players.find(p=>p.nickname.toLowerCase()===names[i].toLowerCase());
  if (!p) throw Error("Unknown player " + names[i]);
  const portraits = d.photos.filter(ph=>ph.playerId===p.id);
  const album = d.album.filter(ph=>ph.playerIds.includes(p.id));
  const years = [...new Set([...portraits, ...album].map(ph=>ph.year).filter(Boolean))].sort((a,b)=>a-b);
  const groups = indices.find(x=>x.playerId===p.id)?.groups || [];
  const yearGroups = new Map();
  for (const g of groups) {
    const match = (g.title + " " + g.source).match(/\b20\d{2}\b/);
    if (!match) continue;
    const year = Number(match[0]);
    if (!yearGroups.has(year)) yearGroups.set(year, []);
    yearGroups.get(year).push(g);
  }
  const availableYears = [...yearGroups.keys()].sort((a,b)=>a-b);
  const targetYears = [...new Set([0, .25, .5, .75, 1].map(f=>availableYears[Math.floor((availableYears.length-1)*f)]))].filter(Boolean);
  for (const year of targetYears) {
    for (const group of yearGroups.get(year).slice(0,2)) {
      for (const sourceUrl of group.photos.slice(0,4)) {
        if (knownSources.has(sourceUrl)) continue;
        const row = pageQueue.get(sourceUrl) || {sourceUrl,year,yearEvidence:group.source,event:group.title,relatedPlayerIds:[],identityStatus:"needs-picture-page-check",status:"pending-source-access"};
        if (!row.relatedPlayerIds.includes(p.id)) row.relatedPlayerIds.push(p.id);
        pageQueue.set(sourceUrl,row);
      }
    }
  }
  priorities.push({
    acquisitionOrder:i+1,tier:core.includes(names[i]) ? "priority-stars" : "china-priority",
    playerId:p.id,hltvId:p.hltvId,nickname:p.nickname,realName:p.realName,
    profileUrl:p.profileUrl,galleryUrl:"https://www.hltv.org/galleries?player="+p.hltvId,
    existingPortraits:portraits.length,existingFullPhotos:album.length,knownYears:years,
    targetHistoricalYears:targetYears,
    indexStatus:groups.length ? "previously-observed-index" : "needs-personal-gallery-index",
    directDownloadsPending:directQueue.filter(ph=>ph.players.some(x=>x.id===p.hltvId)).length,
    nextAction:years.length<2 ? "Prioritize dated photographs: currently fewer than two verified years" : "Expand attractive clear portraits across distinct events and years",
  });
}
const metadata = {generatedAt:new Date().toISOString(),note:"采集顺序由项目目标和缺图情况决定，不是 HLTV 官方选手排名；不得把待查图片页计为已核实身份或已下载照片。",sourcePreference:["HLTV","BLAST official","ESL official","PGL official","Wikimedia Commons"],players:priorities};
fs.writeFileSync("research/hltv-priority-players.json",JSON.stringify(metadata,null,2));
fs.writeFileSync("research/hltv-gallery-page-queue.json",JSON.stringify([...pageQueue.values()],null,2));
console.log({priorityPlayers:priorities.length,priorityPlayersWithFewerThanTwoYears:priorities.filter(p=>p.knownYears.length<2).map(p=>p.nickname),previouslyObservedPicturePagesPending:pageQueue.size,directPhotoURLsPending:directQueue.length});
