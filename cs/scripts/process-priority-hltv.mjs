// Processes only manually approved originals. Face detection is crop assistance,
// never identity evidence. Group compositions are kept complete in the album.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const data=read('src/data/catalogue.json'), players=new Map(data.players.map(p=>[p.id,p]));
const rows=read('research/hltv-priority-photo-candidates.json').filter(p=>p.downloaded);
const det=new Map(read('research/hltv-priority-detections.json').map(r=>[r.path,r]));
const review=read('research/hltv-priority-review.json');
const portraits=[],album=[];
const sha=(file,kind='sha256')=>crypto.createHash(kind).update(fs.readFileSync(file)).digest('hex');
for(const c of rows){const id=Number(c.sourceUrl.split('/').at(-1));
 if(!review.album.includes(id)&&!review.portraits.includes(id))continue;
 const p=players.get(c.requestedPlayerId), sourceId='hltv-gallery-'+id;
 const common={year:c.year,sourceUrl:c.sourceUrl,originalUrl:c.image,title:p.nickname+' · '+c.event,photographer:c.photographer||'HLTV / 摄影者未标注',license:'保留版权；使用权限由项目所有者声明',licenseUrl:'https://www.hltv.org/terms',licenseStatus:'user-declared',sourcePlatform:'HLTV',sourceCheckedAt:'2026-10-23',reviewStatus:'reviewed',originalSha1:sha(c.rawPath,'sha1')};
 if(!c.players.some(q=>'hltv-'+q.id===p.id)||!c.yearEvidence.includes('/gallery/'))throw Error('Invalid identity/year evidence '+id);
 if(review.album.includes(id)){
  const base='photos/album-'+sourceId;
  await sharp(c.rawPath).rotate().resize({width:1600,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:85,effort:5}).toFile('public/'+base+'-large.webp');
  await sharp(c.rawPath).rotate().resize({width:600,height:600,fit:'inside',withoutEnlargement:true}).webp({quality:80,effort:5}).toFile('public/'+base+'-card.webp');
  const m=await sharp('public/'+base+'-large.webp').metadata();
  album.push({...common,id:'album-'+sourceId,sourcePhotoId:sourceId,playerIds:c.players.map(q=>'hltv-'+q.id).filter(id=>players.has(id)),datePrecision:'year',yearEvidence:c.yearEvidence,dateNote:'年份来自所属 HLTV 赛事图库标题；未推算精确拍摄日期或年龄。',event:c.event,kind:review.groups.includes(id)?'group':'scene',subjectEvidence:'HLTV 图片页明确关联的稳定选手 ID：'+c.players.map(q=>q.nickname+' #'+q.id).join('、')+'；已人工检查完整画面。',subjectScope:'来源图片页关联人物；不自动命名未标注的背景人物。',localPath:base+'-large.webp',cardPath:base+'-card.webp',width:m.width,height:m.height,sha256:sha('public/'+base+'-large.webp'),reviewedAt:'2026-10-23',alterations:'保留原片完整构图和可见署名，仅校正方向、按比例缩放及 WebP 转换，未修改人物五官。'});
 }
 if(review.portraits.includes(id)){
  const m=await sharp(c.rawPath).metadata(),d=det.get(path.resolve(c.rawPath));
  const faceIndex=review.faceIndices?.[id] ?? 0;
  if(c.players.length!==1||!d?.faces?.[faceIndex]||(d.faces.length!==1&&review.faceIndices?.[id]===undefined))throw Error('Portrait requires one explicit subject and manually identified face '+id);
  const face=d.faces[faceIndex],f={x:face.x*m.width,y:face.y*m.height,w:face.width*m.width,h:face.height*m.height};
  if(f.w<90||f.h<100)throw Error('Portrait face too small '+id);
  let h=Math.min(m.height,f.h*1.95),w=h*.8;if(w>m.width){w=m.width;h=w/.8;}
  const crop={left:Math.round(Math.max(0,Math.min(m.width-w,f.x+f.w/2-w/2))),top:Math.round(Math.max(0,Math.min(m.height-h,f.y-f.h*.25))),width:Math.floor(w),height:Math.floor(h)};
  const base='photos/'+sourceId;
  for(const [size,width,quality] of [['large',720,88],['card',400,82]])await sharp(c.rawPath).extract(crop).resize({width,withoutEnlargement:true}).webp({quality,effort:5}).toFile('public/'+base+'-'+size+'.webp');
  const dim=await sharp('public/'+base+'-large.webp').metadata();
  portraits.push({...common,id:sourceId,playerId:p.id,capturedAt:null,datePrecision:'year',dateNote:'年份来自 HLTV 赛事图库：'+c.event+'；年份依据 '+c.yearEvidence+'。精确拍摄日未核实，不推算年龄。',age:null,period:'undated',teamAtTime:null,identityVerified:true,identityEvidence:'图片由 '+p.nickname+' 的 HLTV 个人图库定位；图片页仅标注 #'+p.hltvId+' '+p.nickname+'；已人工对照头像检查单一主体及面部裁切。',localPath:base+'-large.webp',cardPath:base+'-card.webp',width:dim.width,height:dim.height,isDefault:false,sha256:sha('public/'+base+'-large.webp'),alterations:'原片面部裁切、比例缩放及 WebP 转换；未生成或重塑五官。裁切框 '+JSON.stringify(crop)});
 }
}
fs.writeFileSync('research/hltv-priority-approved-portraits.json',JSON.stringify(portraits,null,2));
fs.writeFileSync('research/hltv-priority-approved-album.json',JSON.stringify(album,null,2));
console.log({portraits:portraits.length,album:album.length,groups:album.filter(p=>p.kind==='group').length});
