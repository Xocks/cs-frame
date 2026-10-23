import fs from 'node:fs';
import sharp from 'sharp';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const candidates=JSON.parse(fs.readFileSync('research/hltv-priority-photo-candidates.json')).filter(r=>r.downloaded);
const data=JSON.parse(fs.readFileSync('src/data/catalogue.json'));
const byId=new Map(data.players.map(p=>[p.id,p]));
const detections=execFileSync(path.resolve('scripts/detect-faces'),candidates.map(r=>path.resolve(r.rawPath)),{encoding:'utf8',maxBuffer:8*1024*1024}).trim().split('\n').map(s=>JSON.parse(s));
fs.writeFileSync('research/hltv-priority-detections.json',JSON.stringify(detections,null,2));
const byFile=new Map(detections.map(d=>[d.path,d]));
const cols=5,cw=300,ch=252,n=25;
for(let start=0;start<candidates.length;start+=n){const batch=candidates.slice(start,start+n);const layers=[];
 for(let i=0;i<batch.length;i++){const c=batch[i],id=c.sourceUrl.split('/').at(-1),det=byFile.get(path.resolve(c.rawPath));const x=i%cols*cw,y=Math.floor(i/cols)*ch;
 layers.push({input:await sharp(c.rawPath).rotate().resize(294,205,{fit:'contain',background:'#f3f3f3'}).toBuffer(),left:x+3,top:y});
 const label=`${id} ${byId.get(c.requestedPlayerId)?.nickname} ${c.year} faces:${det?.faces?.length??'?'}`;
 layers.push({input:Buffer.from(`<svg width="300" height="47"><rect width="300" height="47" fill="white"/><text x="4" y="17" font-size="13">${label}</text><text x="4" y="36" font-size="11">${c.players.map(p=>p.nickname).join(' / ').replaceAll('&','&amp;')}</text></svg>`),left:x,top:y+205});
 }
 await sharp({create:{width:cols*cw,height:Math.ceil(batch.length/cols)*ch,channels:3,background:'#fff'}}).composite(layers).png().toFile(`research/priority-contact-${Math.floor(start/n)+1}.png`);
}
console.log({downloaded:candidates.length,singleFaces:detections.filter(d=>d.faces?.length===1).length,sheets:Math.ceil(candidates.length/n)});
