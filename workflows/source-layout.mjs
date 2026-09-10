import fs from 'node:fs';
import path from 'node:path';
import {readDistJson} from '../core/runtime-root.mjs';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'&&value.trim().length>0;
const inside=(root,target)=>{const relative=path.relative(root,target);return relative===''||(!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative));};

function realDirectory(value,role,errors){
 if(!text(value)||!path.isAbsolute(value)){errors.push({role,code:'ROOT',path:String(value),message:'Source root must be an absolute path.'});return null;}
 const resolved=path.resolve(value);
 try{
  const stat=fs.lstatSync(resolved);
  if(stat.isSymbolicLink()||!stat.isDirectory()){errors.push({role,code:'ROOT',path:resolved,message:'Source root must be a real directory.'});return null;}
  return fs.realpathSync(resolved);
 }catch{errors.push({role,code:'ROOT',path:resolved,message:'Source root does not exist or cannot be read.'});return null;}
}

function validateContract(contract){
 if(!object(contract)||contract.schema!=='starci/source-layout@1'||!object(contract.roles))throw Error('Invalid source-layout contract.');
 for(const role of ['host','be','fe']){
  const spec=contract.roles[role];
  if(!object(spec)||!Array.isArray(spec.required)||!Array.isArray(spec.requiredAny)||!Array.isArray(spec.forbidden)||!Array.isArray(spec.forbiddenIdentities)||!Array.isArray(spec.content))throw Error(`Invalid ${role} source-layout contract.`);
 }
 return contract;
}

function checkEntry(root,role,entry,errors){
 const target=path.resolve(root,entry.path);
 if(!inside(root,target)){errors.push({role,code:'ESCAPE',path:entry.path,message:'Required path escapes source root.'});return;}
 if(!fs.existsSync(target)){errors.push({role,code:'MISSING',path:entry.path,message:`Required ${entry.type} is missing.`});return;}
 const stat=fs.lstatSync(target);
 if(stat.isSymbolicLink()){errors.push({role,code:'LINK',path:entry.path,message:'Required source path cannot be a symbolic link.'});return;}
 const valid=entry.type==='directory'?stat.isDirectory():entry.type==='git-marker'?(stat.isDirectory()||stat.isFile()):stat.isFile();
 if(!valid){errors.push({role,code:'TYPE',path:entry.path,message:`Expected ${entry.type}.`});return;}
 if(entry.type==='json-file')try{JSON.parse(fs.readFileSync(target,'utf8'));}catch{errors.push({role,code:'JSON',path:entry.path,message:'Required JSON file is malformed.'});}
}

export function validateSourceLayout({host,be,fe,workRoot}={},contract=readDistJson('schemas','source-layout.json')){
 validateContract(contract);
 const errors=[],roots={host:realDirectory(host,'host',errors),be:realDirectory(be,'be',errors),fe:realDirectory(fe,'fe',errors)};
 if(roots.be&&roots.fe&&roots.be.toLowerCase()===roots.fe.toLowerCase())errors.push({role:'pair',code:'SAME_ROOT',path:roots.be,message:'Backend and frontend must be distinct repositories.'});
 if(roots.host&&roots.fe&&roots.host.toLowerCase()===roots.fe.toLowerCase())errors.push({role:'pair',code:'HOST_FRONTEND',path:roots.host,message:'Frontend cannot be the StarCi host.'});
 for(const role of ['host','be','fe']){
  const root=roots[role],spec=contract.roles[role];if(!root)continue;
  for(const entry of spec.required)checkEntry(root,role,entry,errors);
  for(const group of spec.requiredAny){const present=group.paths.filter(relative=>{const target=path.resolve(root,relative);return inside(root,target)&&fs.existsSync(target)&&!fs.lstatSync(target).isSymbolicLink();});if(present.length<group.minimum)errors.push({role,code:'MISSING_ANY',path:group.paths.join('|'),message:`At least ${group.minimum} source root is required for ${group.id}.`});}
  for(const relative of spec.forbidden){const target=path.resolve(root,relative);if(inside(root,target)&&fs.existsSync(target))errors.push({role,code:'FORBIDDEN',path:relative,message:'Duplicate or retired project/runtime storage must be removed or migrated.'});}
  const sharesHost=role==='be'&&roots.host&&roots.host.toLowerCase()===root.toLowerCase();
  if(!sharesHost)for(const identity of spec.forbiddenIdentities){const present=identity.paths.filter(relative=>{const target=path.resolve(root,relative);return inside(root,target)&&fs.existsSync(target);});if(present.length>=identity.minimum)errors.push({role,code:'DUPLICATE_IDENTITY',path:present.join('|'),message:`Routed source contains the ${identity.id} identity owned by the explicit host.`});}
  for(const rule of spec.content){const target=path.resolve(root,rule.path);if(inside(root,target)&&fs.existsSync(target)&&fs.lstatSync(target).isFile()&&!fs.readFileSync(target,'utf8').includes(rule.includes))errors.push({role,code:'CONTENT',path:rule.path,message:`File must route to ${rule.includes}.`});}
 }
 if(roots.be){const expected=path.join(roots.be,'.starciwork'),actual=text(workRoot)?path.resolve(workRoot):expected;if(!inside(roots.be,actual)||actual.toLowerCase()!==expected.toLowerCase())errors.push({role:'pair',code:'WORK_OWNER',path:actual,message:'Canonical Work root must be exactly <backend>/.starciwork.'});}
 return {schema:'starci/source-layout-result@1',ok:errors.length===0,roots,workRoot:roots.be?path.join(roots.be,'.starciwork'):null,errors,limitations:['Filesystem shape and bootstrap routing only; this does not prove source behavior, builds, tests or deployment.']};
}

export function assertSourceLayout(binding,contract){const result=validateSourceLayout(binding,contract);if(!result.ok)throw Error('Bound backend/frontend source layout is invalid: '+JSON.stringify(result.errors));return result;}
