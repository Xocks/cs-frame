import fs from 'node:fs';import path from 'node:path';import sharp from 'sharp';
const data=JSON.parse(fs.readFileSync('src/data/catalogue.json')),players=new Map(data.players.map(p=>[p.id,p]));
const rows=JSON.parse(fs.readFileSync('research/hltv-priority-photo-candidates.json')).filter(r=>r.downloaded&&r.players.length===1);
const det=new Map(JSON.parse(fs.readFileSync('research/hltv-priority-detections.json')).map(r=>[r.path,r]));
const tiles=[];fs.mkdirSync('research/priority-crops',{recursive:true});
for(const c of rows){const id=c.sourceUrl.split('/').at(-1),m=await sharp(c.rawPath).metadata();
 for(const [i,f] of (det.get(path.resolve(c.rawPath))?.faces||[]).entries()){
 const face={x:f.x*m.width,y:f.y*m.height,w:f.width*m.width,h:f.height*m.height};if(face.w<90||face.h<100)continue;
 let h=Math.min(m.height,face.h*1.95),w=h*.8;if(w>m.width){w=m.width;h=w/.8;}
 const crop={left:Math.round(Math.max(0,Math.min(m.width-w,face.x+face.w/2-w/2))),top:Math.round(Math.max(0,Math.min(m.height-h,face.y-face.h*.25))),width:Math.floor(w),height:Math.floor(h)};
 const out=`research/priority-crops/${id}-${i}.jpg`;await sharp(c.rawPath).extract(crop).resize(180,225).jpeg({quality:88}).toFile(out);tiles.push({id,i,out,name:players.get(c.requestedPlayerId).nickname,year:c.year});
 }
}
for(let start=0;start<tiles.length;start+=40){const batch=tiles.slice(start,start+40),layers=[];for(let i=0;i<batch.length;i++){const c=batch[i],x=i%8*190,y=Math.floor(i/8)*260;
 layers.push({input:c.out,left:x+5,top:y});layers.push({input:Buffer.from(`<svg width="190" height="35"><rect width="190" height="35" fill="white"/><text x="3" y="14" font-size="12">${c.name} ${c.year}</text><text x="3" y="30" font-size="11">${c.id} face ${c.i}</text></svg>`),left:x,top:y+225});}
 await sharp({create:{width:1520,height:Math.ceil(batch.length/8)*260,channels:3,background:'white'}}).composite(layers).png().toFile(`research/priority-crop-review-${Math.floor(start/40)+1}.png`);}
console.log({candidateCrops:tiles.length,sheets:Math.ceil(tiles.length/40)});
