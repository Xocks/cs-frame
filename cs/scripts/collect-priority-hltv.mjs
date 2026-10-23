// Import from an ego-browser nodejs round and pass its documented Page handle.
// Authentication stays in the user's browser; no cookies are exported.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
const pause = () => new Promise(resolve => setTimeout(resolve, 2000));
const blocked = r => [403,429].includes(r.status) || /Sorry, you have been blocked|Just a moment\.\.\.|Attention Required!/i.test(r.body || "");
async function read(file, fallback) { try { return JSON.parse(await fs.readFile(file,"utf8")); } catch { return fallback; } }
async function write(file, data) { await fs.writeFile(file, JSON.stringify(data,null,2)); }
export async function collectPriorityIndices({page, root, limit=6}) {
  const plan = await read(path.join(root,"research/hltv-priority-players.json"),null);
  if (!plan) throw Error("Run plan-hltv-priorities.mjs first");
  const file=path.join(root,"research/hltv-priority-gallery-indices.json");
  const previous=await read(path.join(root,"research/hltv-gallery-indices.json"),[]);
  const rows=await read(file,[]);
  const remaining=plan.players.filter(p=>!previous.some(r=>r.playerId===p.playerId)&&!rows.some(r=>r.playerId===p.playerId));
  for (const p of remaining.slice(0,limit)) {
    const r=await page.fetch(p.galleryUrl,{timeout:12000});
    if (blocked(r)) { console.log({stopped:true,reason:"Source access denied; user authentication required",status:r.status}); return; }
    if (!r.ok) {console.log({player:p.nickname,status:r.status});await pause();continue;}
    const groups=await page.evaluate(html=>{
      const doc=new DOMParser().parseFromString(html,"text/html");
      const absolute=url=>url?new URL(url,"https://www.hltv.org").href:null;
      return [...doc.querySelectorAll('.gallery-grid-con')].map(g=>({
        title:g.previousElementSibling?.textContent.trim(),
        source:absolute(g.previousElementSibling?.getAttribute('href')),
        photos:[...g.querySelectorAll('a[href*="/gallery/view/"]')].map(a=>({
          sourceUrl:absolute(a.getAttribute('href')),
          preview:a.querySelector('img')?.getAttribute('src') || null,
          large:a.querySelector('img')?.getAttribute('srcset')?.split(',').at(-1)?.trim().split(/\s+/)[0] || null,
        })),
      })).filter(g=>g.source&&g.photos.length);
    },r.body);
    if (!groups.length) throw Error("Gallery DOM changed or page did not contain photographs; no empty index saved");
    rows.push({playerId:p.playerId,hltvId:p.hltvId,nickname:p.nickname,sourceUrl:p.galleryUrl,checkedAt:new Date().toISOString(),groups});
    await write(file,rows);
    console.log({player:p.nickname,events:groups.length,photoLinks:groups.reduce((n,g)=>n+g.photos.length,0)});
    await pause();
  }
  console.log({newIndices:rows.length,remaining:remaining.length-Math.min(limit,remaining.length)});
}
export async function collectPriorityPictures({page, root, limit=20, playerIds=null}) {
  const plan=await read(path.join(root,"research/hltv-priority-players.json"),null);
  const rank=new Map(plan.players.map((p,i)=>[p.playerId,i]));
  const index=[...await read(path.join(root,"research/hltv-gallery-indices.json"),[]),...await read(path.join(root,"research/hltv-priority-gallery-indices.json"),[])];
  const data=await read(path.join(root,"src/data/catalogue.json"),null);
  const published=new Set([...data.photos,...data.album].map(p=>p.sourceUrl));
  const file=path.join(root,"research/hltv-priority-photo-candidates.json");
  const rows=await read(file,[]),queue=new Map();
  for (const entry of index.sort((a,b)=>(rank.get(a.playerId)??999)-(rank.get(b.playerId)??999))) {
    const groups=entry.groups.filter(g=>/\b20\d{2}\b/.test(g.title+' '+g.source));
    const years=[...new Set(groups.map(g=>Number((g.title+' '+g.source).match(/\b20\d{2}\b/)[0])))].sort((a,b)=>a-b);
    const selected=[...new Set([0,.25,.5,.75,1].map(f=>years[Math.floor((years.length-1)*f)]))].filter(Boolean);
    for (const year of selected) for (const g of groups.filter(g=>Number((g.title+' '+g.source).match(/\b20\d{2}\b/)[0])===year).slice(0,2)) for (const photo of g.photos.slice(0,3)) {
      const sourceUrl=typeof photo==='string'?photo:photo.sourceUrl;
      if (published.has(sourceUrl)||rows.some(r=>r.sourceUrl===sourceUrl)||queue.has(sourceUrl)) continue;
      queue.set(sourceUrl,{sourceUrl,year,yearEvidence:g.source,event:g.title,requestedPlayerId:entry.playerId,observedPreview:typeof photo==='string'?null:photo.large});
    }
  }
  const directory=path.join(root,"research/priority-hltv-downloads");await fs.mkdir(directory,{recursive:true});
  // Round-robin across players and years: one prolific star must not consume
  // every batch while other players still have only an undated avatar.
  const buckets = plan.players.map(p => {
    const candidates = [...queue.values()].filter(q=>q.requestedPlayerId===p.playerId);
    const covered = new Set([
      ...data.photos.filter(q=>q.playerId===p.playerId&&q.year).map(q=>q.year),
      ...data.album.filter(q=>q.playerIds.includes(p.playerId)).map(q=>q.year),
      ...rows.filter(q=>q.downloaded&&q.requestedPlayerId===p.playerId).map(q=>q.year),
    ]);
    const years = [...new Set(candidates.map(q=>q.year))].sort((a,b)=>Number(covered.has(a))-Number(covered.has(b))||a-b);
    const perYear = years.map(y=>candidates.filter(q=>q.year===y));
    const ordered=[];
    for(let i=0;perYear.some(rows=>rows[i]);i++) for(const rows of perYear) if(rows[i]) ordered.push(rows[i]);
    return ordered;
  });
  const balanced=buckets.flatMap((bucket,playerOrder)=>bucket.map((q,i)=>({q,playerOrder,turn:i+rows.filter(r=>r.downloaded&&r.requestedPlayerId===q.requestedPlayerId).length})))
    .sort((a,b)=>a.turn-b.turn||a.playerOrder-b.playerOrder).map(r=>r.q);
  const pending=playerIds?balanced.filter(q=>playerIds.includes(q.requestedPlayerId)):balanced;
  for (const q of pending.slice(0,limit)) {
    let r;
    try { r=await page.fetch(q.sourceUrl,{timeout:12000}); }
    catch(error) { rows.push({...q,checkedAt:new Date().toISOString(),downloaded:false,error:String(error.message)});await write(file,rows);console.log({source:q.sourceUrl,error:'Page request timed out; skipped'});await pause();continue; }
    if (blocked(r)) {console.log({stopped:true,reason:"Source access denied",status:r.status});return;}
    const row={...q,checkedAt:new Date().toISOString(),downloaded:false,status:r.status};
    if (r.ok) {
      Object.assign(row,await page.evaluate(html=>{
        const doc=new DOMParser().parseFromString(html,'text/html');
        return {
          players:[...doc.querySelectorAll('.players a[href*="/player/"]')].map(a=>({nickname:a.textContent.trim(),id:Number(a.getAttribute('href').split('/')[2])})),
          image:[...doc.querySelectorAll('a')].find(a=>a.textContent.trim()==='Download')?.getAttribute('href')||null,
          photographer:[...doc.querySelectorAll('div,span,a')].map(e=>e.textContent.replace(/\s+/g,' ').trim()).filter(s=>/^Photo by .{1,90}$/.test(s)).sort((a,b)=>a.length-b.length)[0]?.replace(/^Photo by\s*/,'')||null,
        };
      },r.body));
      if (!row.players.some(p=>'hltv-'+p.id===q.requestedPlayerId)||!row.image||new URL(row.image).hostname!=='img-cdn.hltv.org') row.rejected='Missing exact target player tag or observed download URL';
      else {
        await pause();
        const id=q.sourceUrl.split('/').at(-1);
        if (!/^\d+$/.test(id)) throw Error('Invalid gallery photo ID');
        const output=path.join(directory,id+'.jpg');
        let image;
        try {image=await page.fetch(row.image,{saveAs:output,timeout:12000});}
        catch(error) {
          row.originalDownloadError=String(error.message);
          if(!q.observedPreview) {rows.push(row);await write(file,rows);await pause();continue;}
          // Use only the signed 1000px URL actually present in the same gallery
          // index, never manufacture URL parameters or retry access denials.
          await pause();
          try { image=await page.fetch(q.observedPreview,{saveAs:output,timeout:12000});row.downloadedUrl=q.observedPreview; }
          catch(error) {row.error=String(error.message);rows.push(row);await write(file,rows);await pause();continue;}
        }
        if ([403,429].includes(image.status)) {await fs.unlink(output).catch(()=>{});row.imageStatus=image.status;rows.push(row);await write(file,rows);console.log({stopped:true,status:image.status});return;}
        if (image.ok) {row.downloaded=true;row.rawPath='research/priority-hltv-downloads/'+id+'.jpg';row.sha256=crypto.createHash('sha256').update(await fs.readFile(output)).digest('hex');}
        else {row.imageStatus=image.status;await fs.unlink(output).catch(()=>{});}
      }
    }
    rows.push(row);await write(file,rows);console.log({source:row.sourceUrl,year:row.year,downloaded:row.downloaded,subjects:row.players?.map(p=>p.nickname)});await pause();
  }
  console.log({candidateRecords:rows.length,remainingPhotoPages:Math.max(0,queue.size-limit)});
}
