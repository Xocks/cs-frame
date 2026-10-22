import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import sharp from 'sharp';import {execFileSync} from 'node:child_process';
const candidates=JSON.parse(fs.readFileSync('research/hltv-gallery-candidates.json')).filter(p=>p.downloaded);
const players=new Map(JSON.parse(fs.readFileSync('src/data/catalogue.json')).players.map(p=>[p.id,p]));
const files=candidates.map(c=>path.resolve(c.rawPath));
const detections=execFileSync(path.resolve('scripts/detect-faces'),files,{encoding:'utf8',maxBuffer:8*1024*1024}).trim().split('\n').map(s=>JSON.parse(s));
const byFile=new Map(detections.map(d=>[d.path,d]));
const out=[],reject=[];fs.mkdirSync('research/hltv-gallery-processed',{recursive:true});
for(const c of candidates){const p=players.get(c.playerId),result=byFile.get(path.resolve(c.rawPath));
 if(result.faces?.length!==1){reject.push({source:c.sourceUrl,reason:'not a single detected face'});continue;}
 const meta=await sharp(c.rawPath).metadata(),face=result.faces[0];
 const f={x:face.x*meta.width,y:face.y*meta.height,w:face.width*meta.width,h:face.height*meta.height};
 if(f.w<90||f.h<100){reject.push({source:c.sourceUrl,reason:'face too small'});continue;}
 let h=Math.min(meta.height,f.h*1.95),w=h*.8;if(w>meta.width){w=meta.width;h=w/.8;}
 const crop={left:Math.round(Math.max(0,Math.min(meta.width-w,f.x+f.w/2-w/2))),top:Math.round(Math.max(0,Math.min(meta.height-h,f.y-f.h*.25))),width:Math.floor(w),height:Math.floor(h)};
 const id='hltv-gallery-'+c.sourceUrl.split('/').at(-1),large='photos/'+id+'-large.webp',card='photos/'+id+'-card.webp';
 await sharp(c.rawPath).extract(crop).resize({width:720,withoutEnlargement:true}).webp({quality:88,effort:5}).toFile('public/'+large);
 await sharp(c.rawPath).extract(crop).resize({width:400,withoutEnlargement:true}).webp({quality:82,effort:5}).toFile('public/'+card);
 const dim=await sharp('public/'+large).metadata();
 let capturedAt=null,precision='year',age=null,period='undated',dateNote='年份来自 HLTV 所属赛事图库标题：'+c.groupTitle+'；未核实精确拍摄日，未推算年龄。';
 const originalDate=result.dateTimeOriginal?.match(/^(\d{4}):(\d{2}):(\d{2})/);
 if(originalDate&&+originalDate[1]===c.year){capturedAt=originalDate.slice(1).join('-');precision='day';dateNote='拍摄日期来自原始下载文件 EXIF DateTimeOriginal，并与所属赛事年份一致；赛事来源 '+c.yearEvidence;
  if(p.birthDate){const b=new Date(p.birthDate),d=new Date(capturedAt);age=d.getUTCFullYear()-b.getUTCFullYear()-(d.getUTCMonth()<b.getUTCMonth()||(d.getUTCMonth()===b.getUTCMonth()&&d.getUTCDate()<b.getUTCDate())?1:0);period=age<20?'debut':age<24?'young':age<28?'prime':age<32?'veteran':'legend';}
 }
 out.push({id,playerId:p.id,year:c.year,capturedAt,datePrecision:precision,dateNote,age,period,teamAtTime:null,sourceUrl:c.sourceUrl,originalUrl:c.image,title:p.nickname+' · '+c.groupTitle,photographer:c.photographer?.replace(/^Photo by\s*/, '')||'HLTV / 摄影者未标注',license:'保留版权；使用权限由项目所有者声明',licenseUrl:'https://www.hltv.org/terms',licenseStatus:'user-declared',sourcePlatform:'HLTV',sourceCheckedAt:'2026-10-21',identityVerified:true,identityEvidence:`HLTV 图片页仅关联选手 #${p.hltvId} ${p.nickname}，由该选手个人图库筛选页定位；已核对单一人物标签与个人档案参考。`,reviewStatus:'reviewed',localPath:large,cardPath:card,isDefault:false,sha256:crypto.createHash('sha256').update(fs.readFileSync('public/'+large)).digest('hex'),width:dim.width,height:dim.height,alterations:'原片裁切、比例缩放与 WebP 转换，未生成或重塑五官。裁切框 '+JSON.stringify(crop),originalSha1:crypto.createHash('sha1').update(fs.readFileSync(c.rawPath)).digest('hex')});
 await sharp('public/'+large).resize({width:164}).jpeg({quality:85}).toFile('research/hltv-gallery-processed/'+id+'.jpg');
}
fs.writeFileSync('research/hltv-gallery-processed-photos.json',JSON.stringify(out,null,2));fs.writeFileSync('research/hltv-gallery-crop-rejections.json',JSON.stringify(reject,null,2));
// These are candidates; the manual contact-sheet review decides which are published.
const cols=8,cellW=190,cellH=252,perSheet=40;
for(let start=0;start<out.length;start+=perSheet){let layers=[];const batch=out.slice(start,start+perSheet);for(let i=0;i<batch.length;i++){const ph=batch[i],p=players.get(ph.playerId),x=i%cols*cellW,y=Math.floor(i/cols)*cellH;layers.push({input:await sharp('research/hltv-gallery-processed/'+ph.id+'.jpg').resize(180,218,{fit:'contain',background:'#fff'}).toBuffer(),left:x+5,top:y});layers.push({input:Buffer.from(`<svg width="190" height="34"><rect width="190" height="34" fill="white"/><text x="4" y="14" font-size="12">${p.nickname} ${ph.year} (${ph.age??'?'})</text><text x="4" y="30" font-size="11">${ph.id}</text></svg>`),left:x,top:y+218});}await sharp({create:{width:cols*cellW,height:Math.ceil(batch.length/cols)*cellH,channels:3,background:'#fff'}}).composite(layers).png().toFile('research/hltv-gallery-contact-'+(Math.floor(start/perSheet)+1)+'.png');}
console.log({candidates:out.length,rejected:reject.length,exactCaptureDates:out.filter(p=>p.age!==null).length});
