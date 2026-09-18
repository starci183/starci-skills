import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../../../../../../core/yaml.mjs';
const assetDir=path.dirname(fileURLToPath(import.meta.url));
const dir=path.dirname(assetDir),root=path.resolve(assetDir,'../../../../../../../..');
const read=p=>fs.readFileSync(p),hash=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const d=parseYaml(read(path.join(dir,'index.yaml')).toString());
const check=(ok,message)=>{if(!ok)throw Error(message);console.log('PASS '+message);};
check(d.schema==='work/ui-screen'&&d.brand.rev===3,'UI schema and brand rev 3');
check(JSON.stringify(d.assets)===JSON.stringify(d.ui.assets),'top-level/ui asset bindings agree');
for(const a of d.assets){
 const p=path.join(dir,a.path);check(hash(p)===a.sha256,'asset hash '+a.path);
 if(a.path.endsWith('.png')){const bytes=read(p);check(bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&bytes.readUInt32BE(16)>=1000&&bytes.readUInt32BE(20)>=800,'PNG header and dimensions '+a.path);}
 if(a.generation){check(a.generation.tool==='image_gen.imagegen'&&!('model' in a.generation),'real tool, no invented model '+a.path);check(fs.existsSync(path.join(dir,a.generation.promptPath)),'retained exact prompt '+a.path);}
}
const chosen=d.assets.filter(a=>a.role==='direction');check(chosen.length===1,'one selected representative direction');
for(const state of d.ui.states)for(const viewport of ['desktop-1280','mobile-390']){
 const m=d.ui.coverage.map.find(m=>m.state===state.name&&m.viewport===viewport&&m.screen===d.ui.surfaces[0].name);
 check(m&&m.components.length>0&&m.derivation&&m.directionAsset===chosen[0].path,'coverage '+state.name+' '+viewport);
}
const inputs=d.ui.acceptedInputs;
check(hash(path.join(root,inputs.brand.path))===inputs.brand.sha256,'current brand input bytes');
for(const input of [...inputs.business,...inputs.knowledge])check(hash(path.join(root,input.path))===input.sha256,'accepted input '+(input.id??input.path));
for(const a of d.assets.filter(a=>a.role==='prompt')){
 const p=read(path.join(dir,a.path)).toString();const brand=p.indexOf('brand/index.yaml rev 3'),grammar=p.indexOf('2. ACTUAL GRAMMAR ANATOMY'),knowledge=p.indexOf('3. KNOWLEDGE');
 check(brand>=0&&grammar>brand&&knowledge>grammar,'brand/Grammar/knowledge prompt provenance order '+a.path);
}
check(fs.statSync(path.join(assetDir,'visual-review.md')).size>500,'retained visual review');
if(d.id==='ui.login.sign-in')check(d.ui.shell.appShell===false&&['Forgot password?','Create an account','Privacy policy','Terms'].every(label=>d.ui.links.some(l=>l.label===label)),'split auth with full required links');
else check(d.ui.shell.owner==='WorkspaceShell'&&d.ui.shell.navigation.length===4,'product shell, feature navigation, account presence');
if(d.id==='ui.task.list')check(d.ui.artworkSlots.some(s=>s.states.includes('empty')&&s.master.record==='brand'),'derived empty-state turtle master');
if(['ui.audit.privacy','ui.share.invite','ui.plan.usage'].includes(d.id))check(d.ui.artworkSlots.length===0,'no mascot slot on destructive/refusal surface');
const finalPrompt=read(path.join(dir,chosen[0].generation.promptPath)).toString();
check(inputs.grammarReferences.length>=4,'actual rendered anatomy references bound');
for(const ref of inputs.grammarReferences)check(hash(path.join(root,ref.path))===ref.sha256,'actual reference bytes '+ref.path);
const referencedImages=chosen[0].generation.inputRefs.filter(p=>p.endsWith('.png'));
check(referencedImages.length>1,'retained image edit target and anatomy inputs');
for(const p of referencedImages){const file=path.join(root,p);check(fs.existsSync(file),'generation image retained '+p);check(finalPrompt.includes(p),'generation image cited in exact prompt '+p);}
check(finalPrompt.includes('ANATOMY SOURCE')&&finalPrompt.includes('grammar-reference/'),'final prompt identifies actual anatomy source');
if(d.ui.shell.owner==='WorkspaceShell')check(d.ui.coverage.map.filter(m=>m.components.some(c=>c.startsWith('WorkspaceShell'))).every(m=>m.components.some(c=>c.startsWith('NavigationFeatureNav'))),'workspace maps actual navigation composition');
console.log('INFO structural/hash checks complement manual visual review; no browser/render/API proof.');
