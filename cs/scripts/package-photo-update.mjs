import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const d=JSON.parse(fs.readFileSync('src/data/catalogue.json'));
const expected=new Set([...d.photos,...d.album].flatMap(p=>[p.localPath,p.cardPath]));
const bundles=['photo-assets.zip','album-assets.zip'].map(archive=>({archive,files:execFileSync('unzip',['-Z1','../'+archive],{encoding:'utf8'}).trim().split('\n').filter(f=>!f.endsWith('/'))}));
const old=new Set(bundles.flatMap(b=>b.files));
const files=[...expected].filter(f=>!old.has(f));
if(files.length){
 const archive='photo-update-20261023.zip',output=path.resolve('..',archive);
 fs.rmSync(output,{force:true});execFileSync('/usr/bin/zip',['-q',output,...files],{cwd:path.resolve('public')});
 bundles.push({archive,files});
 console.log({newFiles:files.length,bytes:fs.statSync(output).size,archive});
}
fs.writeFileSync('asset-bundles.json',JSON.stringify({bundles},null,2));
