import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../../../core/yaml.mjs';
import {parseCssCustomProperties,parseColor,contrastRatio,deltaEOk,checkMascotAssetsPresent,checkIconSetOnly} from '../../../../../checks/brand.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../../..');
const dir=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const doc=parseYaml(fs.readFileSync(path.join(dir,'index.yaml'),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const requireTrue=(ok,message)=>{if(!ok)throw Error(message);console.log('PASS '+message);};
requireTrue(doc.rev===3&&doc.completion.review.rev===3,'brand and owner review bind rev 3');
for(const source of doc.brand.sources){
 const p=path.resolve(root,source.inspectionRoot,source.path);
 const bytes=fs.readFileSync(p);
 requireTrue(hash(bytes)===source.sha256,'source hash '+source.path);
}
for(const t of doc.brand.color.tokens){
 const source=doc.brand.sources.find(s=>s.path===t.source.path);
 const lines=fs.readFileSync(path.resolve(root,source.inspectionRoot,source.path),'utf8').split('\n');
 requireTrue(lines[t.source.line-1].trim()===t.source.declaration,'exact source line '+t.token);
 const css=parseCssCustomProperties(lines.join('\n'));const declaration=css.base.get(t.token);
 requireTrue(declaration&&deltaEOk(parseColor(t.value),parseColor(declaration.value))<0.5,'declared value '+t.token);
 if(t.foreground){const ratio=contrastRatio(parseColor(t.value),parseColor(t.foreground));requireTrue(ratio>=4.5,'unrounded contrast '+t.token+' = '+ratio.toFixed(6)+':1');}
}
const primary=doc.brand.color.tokens.find(t=>t.role==='primary'),danger=doc.brand.color.tokens.find(t=>t.role==='danger');
requireTrue(deltaEOk(parseColor(primary.value),parseColor(danger.value))>=20,'primary and danger distinct');
const css=fs.readFileSync(path.join(root,'examples/todo-app-frontend/src/app/globals.css'),'utf8');
requireTrue(css.includes('--starci-core-accent: #2F6BFF;')&&css.includes('--accent: var(--starci-core-accent);'),'actual app accent and alias wired');
requireTrue(!css.includes('--starci-core-danger:'),'danger is not redefined');
for(const entry of doc.brand.grammar.inspectedFiles)requireTrue(hash(fs.readFileSync(path.join(doc.brand.grammar.resolvedPath,entry.path)))===entry.sha256,'inspected Grammar hash '+entry.path);
requireTrue(hash(fs.readFileSync(path.join(root,'examples/todo-app-frontend/package-lock.json')))===doc.brand.grammar.inspectedLockfileSha256,'current lock matches inspected installation lock');
const mascot=checkMascotAssetsPresent({brand:doc.brand,tree:path.dirname(dir),brandDir:dir});requireTrue(mascot.outcome==='pass',mascot.detail);
const icons=checkIconSetOnly({brand:doc.brand,sourceRoot:path.join(root,'examples/todo-app-frontend')});requireTrue(icons.outcome==='pass',icons.detail);
console.log('INFO white-on-primary contrast = '+contrastRatio(parseColor('#FFFFFF'),parseColor(primary.value)).toFixed(6)+':1; forbidden pair is not used. Black label ink must be wired at implementation.');
console.log('INFO Common imports do not activate Core material tokens; this check verifies source declarations, not a served theme or browser render.');
