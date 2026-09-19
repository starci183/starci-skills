import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parseYaml} from '../../core/yaml.mjs';

const RESULT='starci/application-stacks-check@1';
const STACKS_DIR='.starcistacks';
const LEGACY_STACKS_DIR='.stacks';
const MAX_INPUT_BYTES=4*1024*1024;
const SCHEMA_ID='starci/application-stacks';
const LEGACY_SCHEMA_ID='starci/application-stacks@1';
const RUNBOOK_COMMANDS=['prepare','doctor','up','status','logs','down','verification'];
const PLAINTEXT_SECRET_PATTERN=/\.(key|pem|p12|pfx)$/i;
const slash=value=>String(value??'').replaceAll('\\','/');
const inside=(root,target)=>{const rel=path.relative(path.resolve(root),path.resolve(target));return rel===''||(!rel.startsWith('..')&&!path.isAbsolute(rel));};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const sensitive=/pass(word)?|secret|token|credential|private[_-]?key|api[_-]?key/i;
const nonempty=value=>typeof value==='string'&&Boolean(value.trim());
const moduleDir=path.dirname(fileURLToPath(import.meta.url));
const compiledSchema=path.resolve(moduleDir,'../../schemas/application-stacks.schema.json');
const sourceSchema=path.resolve(moduleDir,'../../schemas/application-stacks.schema.yaml');
const manifestSchema=fs.existsSync(compiledSchema)?JSON.parse(fs.readFileSync(compiledSchema,'utf8')):parseYaml(fs.readFileSync(sourceSchema,'utf8'));

function regular(file,{root=null}={}){
  try{
    const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())return false;
    return !root||inside(root,fs.realpathSync(file));
  }catch{return false;}
}
function directory(file){try{return fs.lstatSync(file).isDirectory()&&!fs.lstatSync(file).isSymbolicLink();}catch{return false;}}
function safeAncestors(root,target){
  if(!inside(root,target))return false;
  let cursor=path.resolve(target),base=path.resolve(root);
  while(cursor!==base){if(fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink())return false;cursor=path.dirname(cursor);}
  return true;
}
function resolvedPath(base,relative){
  if(!nonempty(relative)||path.isAbsolute(relative)||String(relative).split(/[\\/]/).includes('..'))return null;
  const target=path.resolve(base,String(relative));return inside(base,target)&&safeAncestors(base,target)?target:null;
}

function validateSchema(value){
  const errors=[],isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),resolve=ref=>ref.slice(2).split('/').reduce((node,key)=>node?.[key],manifestSchema);
  const check=(node,shape,at)=>{
    if(shape?.$ref)return check(node,resolve(shape.$ref),at);
    const typed=shape?.type==='object'?isObject(node):shape?.type==='array'?Array.isArray(node):shape?.type==='integer'?Number.isInteger(node):shape?.type?typeof node===shape.type:true;
    if(!typed){errors.push({path:at,message:`expected ${shape.type}`});return;}
    if(Object.hasOwn(shape??{},'const')&&node!==shape.const)errors.push({path:at,message:'const mismatch'});
    if(Array.isArray(shape?.enum)&&!shape.enum.includes(node))errors.push({path:at,message:'value outside enum'});
    if(typeof node==='string'){if(shape.minLength&&node.length<shape.minLength)errors.push({path:at,message:'string too short'});if(shape.pattern&&!new RegExp(shape.pattern,'u').test(node))errors.push({path:at,message:'pattern mismatch'});}
    if(typeof node==='number'){if(shape.minimum!==undefined&&node<shape.minimum)errors.push({path:at,message:'number below minimum'});if(shape.maximum!==undefined&&node>shape.maximum)errors.push({path:at,message:'number above maximum'});}
    if(Array.isArray(node)){if(shape.minItems&&node.length<shape.minItems)errors.push({path:at,message:'array too short'});node.forEach((item,index)=>shape.items&&check(item,shape.items,`${at}/${index}`));return;}
    if(!isObject(node))return;
    if(shape.minProperties&&Object.keys(node).length<shape.minProperties)errors.push({path:at,message:'object has too few properties'});
    for(const key of shape.required??[])if(!Object.hasOwn(node,key))errors.push({path:at,message:`missing ${key}`});
    for(const [key,child] of Object.entries(node)){
      if(Object.hasOwn(shape.properties??{},key))check(child,shape.properties[key],`${at}/${key}`);
      else if(shape.additionalProperties===false)errors.push({path:`${at}/${key}`,message:'unknown field'});
      else if(isObject(shape.additionalProperties))check(child,shape.additionalProperties,`${at}/${key}`);
    }
  };check(value,manifestSchema,'$');return errors;
}
function envEntries(environment){
  if(Array.isArray(environment))return environment.map(item=>{const at=String(item).indexOf('=');return at<0?[String(item),'']:[String(item).slice(0,at),String(item).slice(at+1)];});
  return object(environment)?Object.entries(environment):[];
}
const unresolved=value=>typeof value==='string'&&/(^|[^$])\$\{/.test(value);
function unresolvedCompose(model){
  for(const service of Object.values(object(model?.services)?model.services:{})){
    const build=object(service?.build)?service.build:{context:service?.build};
    const values=[service?.image,build.context,build.dockerfile,...(Array.isArray(service?.ports)?service.ports:[])];
    for(const volume of Array.isArray(service?.volumes)?service.volumes:[])values.push(object(volume)?volume.source:String(volume).split(':')[0]);
    for(const [key,value] of envEntries(service?.environment))if(!sensitive.test(key))values.push(value);
    if(values.some(unresolved))return true;
  }
  return Object.values(object(model?.secrets)?model.secrets:{}).some(item=>unresolved(item?.file));
}
function sopsEnvelope(file){
  // Recognizes both the YAML/JSON envelope (a "sops" object) and the flattened dotenv envelope SOPS
  // emits for a .env member (sops_lastmodified=, sops_mac=, sops_age__list_0__map_enc=, ...).
  try{if(fs.statSync(file).size>MAX_INPUT_BYTES)return false;const text=fs.readFileSync(file,'utf8');
    return (/(?:(?:^|\n)sops:|["']sops["']\s*:|(?:^|\n)sops_[a-z0-9_]+=)/.test(text))&&/ENC\[AES256_GCM,data:/.test(text);
  }catch{return false;}
}

function gitTrackedSet(root){
  try{
    const result=spawnSync('git',['-C',root,'ls-files','--',STACKS_DIR],{encoding:'utf8',timeout:5000,windowsHide:true});
    if(result.error||result.status!==0||typeof result.stdout!=='string')return null;
    return new Set(result.stdout.split(/\r?\n/).filter(Boolean).map(slash));
  }catch{return null;}
}
function composeLike(file){
  try{
    if(fs.statSync(file).size>MAX_INPUT_BYTES)return false;
    const doc=parseYaml(fs.readFileSync(file,'utf8'));
    return object(doc)&&(object(doc.services)||Array.isArray(doc.include));
  }catch{return false;}
}
function reachableComposeFiles(envDir,entries){
  const reachable=new Set(),queue=[...entries];
  while(queue.length){
    const relative=queue.shift(),target=resolvedPath(envDir,relative);
    if(!target||reachable.has(target))continue;
    reachable.add(target);
    if(!regular(target,{root:envDir}))continue;
    let doc=null;try{doc=parseYaml(fs.readFileSync(target,'utf8'));}catch{continue;}
    for(const include of Array.isArray(doc?.include)?doc.include:[])
      if(typeof include==='string')queue.push(slash(path.join(path.relative(envDir,path.dirname(target)),include)));
  }
  return reachable;
}
function scanForUndeclaredCompose(root,envDir,reachable,add,at){
  const infra=path.join(envDir,'infra');
  if(!directory(infra))return;
  const stack=[infra];
  while(stack.length){
    const dir=stack.pop();
    let entries=[];try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{continue;}
    for(const entry of entries){
      const full=path.join(dir,entry.name);
      if(entry.isSymbolicLink())continue;
      if(entry.isDirectory()){stack.push(full);continue;}
      if(!/\.ya?ml$/i.test(entry.name)||reachable.has(full)||!composeLike(full))continue;
      add('STACKS_UNDECLARED_COMPOSE',at,`${slash(path.relative(root,full))} is a Compose-shaped file under infra/ that is not declared or reachable from composeFiles; the composeFiles list must be the complete list for this environment`);
    }
  }
}

export function checkApplicationStacks({repoRoot,environment,deploymentModelFile}={}){
  const root=path.resolve(String(repoRoot??'')),stacksRoot=path.join(root,STACKS_DIR),manifestFile=path.join(stacksRoot,'application-stacks.yaml'),errors=[];
  const add=(code,at,message)=>errors.push({code,path:at,message});
  if(!nonempty(environment))add('environment-invalid','environment','environment must name a declared environment');
  if(!directory(stacksRoot)&&directory(path.join(root,LEGACY_STACKS_DIR)))
    add('STACKS_LEGACY_DIRECTORY',LEGACY_STACKS_DIR,`the stack directory must be renamed from ${LEGACY_STACKS_DIR} to ${STACKS_DIR}; a legacy ${LEGACY_STACKS_DIR} directory is not read as the contract`);
  if(!regular(manifestFile,{root:stacksRoot}))add('manifest-unavailable',`${STACKS_DIR}/application-stacks.yaml`,`manifest must be a regular file inside ${STACKS_DIR}`);
  if(!regular(deploymentModelFile))add('deployment-model-unavailable','deploymentModelFile','rendered deployment evidence must be a regular, non-symlink file');
  for(const [file,at] of [[manifestFile,`${STACKS_DIR}/application-stacks.yaml`],[deploymentModelFile,'deploymentModelFile']])
    try{if(fs.statSync(file).size>MAX_INPUT_BYTES)add('input-too-large',at,'input exceeds the 4 MiB static-check limit');}catch{}
  let manifest={},model={};
  try{if(!errors.some(item=>['manifest-unavailable','input-too-large'].includes(item.code)&&item.path===`${STACKS_DIR}/application-stacks.yaml`))manifest=parseYaml(fs.readFileSync(manifestFile,'utf8'));}
  catch{add('manifest-invalid',`${STACKS_DIR}/application-stacks.yaml`,'manifest YAML could not be parsed');}
  try{if(!errors.some(item=>['deployment-model-unavailable','input-too-large'].includes(item.code)&&item.path==='deploymentModelFile')){
    const text=fs.readFileSync(deploymentModelFile,'utf8');try{model=JSON.parse(text);}catch{model=parseYaml(text);}
  }}catch{add('deployment-model-invalid','deploymentModelFile','rendered deployment JSON or YAML could not be parsed');}
  if(!object(manifest))manifest={};if(!object(model))model={};

  for(const issue of validateSchema(manifest))add('schema-shape-invalid',issue.path,issue.message);
  if(manifest.schema===LEGACY_SCHEMA_ID)add('STACKS_SCHEMA_LEGACY_ID','schema',`schema should be ${SCHEMA_ID} without the @1 suffix; drop it`);
  else if(manifest.schema!==SCHEMA_ID)add('schema-invalid','schema',`expected ${SCHEMA_ID}`);

  const catalog=object(manifest.components)?manifest.components:{},ids=new Set(Object.keys(catalog));
  if(!ids.size)add('components-empty','components','declare at least one applicable application component');
  for(const id of ids)if(!/^[a-z][a-z0-9-]*$/.test(id))add('component-invalid',`components.${id}`,'component ids must be lowercase kebab-case');

  const environments=object(manifest.environments)?manifest.environments:{},environmentNames=new Set(Object.keys(environments));
  if(!environmentNames.size)add('environments-empty','environments','declare at least one supported environment');

  if(directory(stacksRoot)){
    let entries=[];try{entries=fs.readdirSync(stacksRoot,{withFileTypes:true});}catch{}
    for(const entry of entries){
      if(!entry.isDirectory()||entry.isSymbolicLink())continue;
      if(entry.name==='tmp'){add('STACKS_SCRATCH_IN_CANONICAL',`${STACKS_DIR}/tmp`,'scratch belongs in the OS temp directory, not a tracked .starcistacks/tmp');continue;}
      if(entry.name==='k8s')continue;
      if(!environmentNames.has(entry.name))add('STACKS_UNDECLARED_ENVIRONMENT',`${STACKS_DIR}/${entry.name}`,`${entry.name} is not an environment the declaration admits; either the declaration admits it or it is not an environment`);
    }
    for(const name of environmentNames)if(!directory(path.join(stacksRoot,name)))add('environment-directory-missing',`${STACKS_DIR}/${name}`,`declared environment ${name} has no directory`);
    const k8sDir=path.join(stacksRoot,'k8s'),k8sExists=directory(k8sDir);
    if(manifest.k8s?.status==='supported'&&!k8sExists)add('k8s-directory-missing',`${STACKS_DIR}/k8s`,'k8s.status is supported but .starcistacks/k8s is missing');
    if(manifest.k8s?.status==='deferred'&&k8sExists)add('k8s-directory-unexpected',`${STACKS_DIR}/k8s`,'k8s.status is deferred, so a .starcistacks/k8s directory contradicts the declaration');
  }
  if(!['deferred','supported'].includes(manifest.k8s?.status)||!String(manifest.k8s?.reason??'').trim())
    add('k8s-status-invalid','k8s','Kubernetes must be explicitly deferred or supported with a reason');

  if(nonempty(environment)&&!environmentNames.has(String(environment)))
    add('environment-unknown','environment',`environment must be one the declaration admits: ${[...environmentNames].join(', ')}`);
  const spec=environments[String(environment)],envDir=path.join(stacksRoot,String(environment??''));

  if(object(spec)){
    if(spec.status!=='supported')add('environment-unsupported',`environments.${environment}`,'environment must be explicitly supported');
    if(!['docker-compose','docker-swarm'].includes(spec.runtime))add('runtime-invalid',`environments.${environment}.runtime`,'runtime must be docker-compose or docker-swarm');

    const composeFiles=Array.isArray(spec.composeFiles)?spec.composeFiles:[];
    if(!composeFiles.length)add('compose-files-empty',`environments.${environment}.composeFiles`,'declare at least one environment-relative Compose source file');
    const safeComposeFiles=[];
    for(const [index,relative] of composeFiles.entries()){
      const target=resolvedPath(envDir,relative);
      if(!target||!regular(target,{root:envDir}))add('compose-path-unsafe',`environments.${environment}.composeFiles[${index}]`,'Compose source must be a regular non-symlink file below the environment directory');
      else safeComposeFiles.push(relative);
    }
    if(directory(envDir)){
      const reachable=reachableComposeFiles(envDir,safeComposeFiles);
      scanForUndeclaredCompose(root,envDir,reachable,add,`environments.${environment}.composeFiles`);
    }

    const bindings=object(spec.components)?spec.components:{};
    for(const id of Object.keys(bindings))if(!ids.has(id))
      add('binding-component-unknown',`environments.${environment}.components.${id}`,'environment binds a component id that is absent from the top-level inventory');

    if(!nonempty(spec.runbook))add('runbook-path-invalid',`environments.${environment}.runbook`,'runbook must name a file inside the environment directory');
    else{
      const runbookFile=resolvedPath(envDir,spec.runbook);
      const oversized=(()=>{try{return fs.statSync(runbookFile).size>MAX_INPUT_BYTES;}catch{return true;}})();
      if(!runbookFile||!regular(runbookFile,{root:envDir})||oversized)
        add('runbook-path-invalid',`environments.${environment}.runbook`,'runbook must resolve to an existing regular non-symlink file below the environment directory');
      else{
        let text='';try{text=fs.readFileSync(runbookFile,'utf8');}catch{}
        for(const command of RUNBOOK_COMMANDS){
          const rowPattern=new RegExp(`^\\s*\\|\\s*${command}\\s*\\|`,'im');
          if(!rowPattern.test(text))add('runbook-command-missing',`environments.${environment}.runbook#${command}`,`runbook must document the ${command} command`);
        }
      }
    }

    const declaredSecrets=Array.isArray(spec.secrets)?spec.secrets:[],secretNames=new Set();
    const tracked=directory(envDir)?gitTrackedSet(root):null;
    for(const [index,secret] of declaredSecrets.entries()){
      const at=`environments.${environment}.secrets[${index}]`;
      if(!object(secret))continue;
      if(secretNames.has(secret.name))add('secret-duplicate',`${at}.name`,'secret names must be unique');else secretNames.add(secret.name);
      const plain=nonempty(secret.where)?resolvedPath(envDir,secret.where):null;
      const enc=nonempty(secret.where)?resolvedPath(envDir,`${secret.where}.enc`):null;
      if(!enc||!regular(enc,{root:envDir})||!sopsEnvelope(enc))
        add('encrypted-ref-invalid',`${at}.where`,'secret must resolve to <where>.enc as a recognizable SOPS envelope, an existing regular file below the environment directory');
      if(nonempty(secret.where)&&!plain)
        add('materialized-path-invalid',`${at}.where`,'secret plaintext path and its existing ancestors must remain below the environment directory without symlinks');
      if(!String(secret.recipientPolicy??'').trim()||!String(secret.keyCustody??'').trim())
        add('secret-policy-missing',at,'secret recipient and key custody policies are required');
      if(tracked&&plain&&tracked.has(slash(path.relative(root,plain))))
        add('STACKS_PLAINTEXT_SECRET',`${at}.where`,'a decrypted secret member must never be a tracked file; only its .enc member is committed');
    }
    if(tracked){
      const envPrefix=`${slash(path.relative(root,envDir))}/`;
      for(const relTracked of tracked){
        if(!relTracked.startsWith(envPrefix))continue;
        const base=path.basename(relTracked);
        if(PLAINTEXT_SECRET_PATTERN.test(base)||base==='id_rsa')
          add('STACKS_PLAINTEXT_SECRET',relTracked,'a tracked file below the environment directory matches a plaintext secret pattern; only <name>.enc may be committed');
      }
    }
  }

  const services=object(model.services)?model.services:{};
  for(const service of Object.keys(services))if(!ids.has(service))
    add('compose-service-unclassified',`services.${service}`,'rendered service name is not a declared component id');
  if(unresolvedCompose(model))add('compose-placeholder-unresolved','composeModel','rendered Compose still contains an unresolved interpolation placeholder in a host-resolved field');
  for(const [service,definition] of Object.entries(services))for(const [key] of envEntries(definition?.environment))
    if(sensitive.test(key)&&!/_FILE$/i.test(key))add('plaintext-sensitive-environment',`services.${service}.environment.${key}`,'sensitive configuration is present as a direct environment value; value redacted');
  if(object(spec)&&spec.runtime==='docker-swarm')for(const [service,definition] of Object.entries(services)){
    if(!ids.has(service))continue;
    if(!nonempty(definition?.image))add('swarm-image-missing',`services.${service}.image`,'managed Swarm service needs a nonempty rendered image');
    if(definition?.build!==undefined)add('swarm-build-unrendered',`services.${service}.build`,'rendered Swarm model must not retain a build section');
  }

  return {schema:RESULT,ok:errors.length===0,environment,manifest:manifestFile,deploymentModel:path.resolve(String(deploymentModelFile??'')),errors,
    limitations:['static conformance only; Docker was not invoked, host application processes were not started, and remote APIs were not called','the deployment model must be rendered by Docker Compose or Docker Stack tooling; provenance is supplied by the caller and is not independently authenticated','component classification, runbook completeness and secret custody are author assertions checked for consistency and structure, not independently discovered facts','SOPS envelope recognition is structural, not cryptographic verification or decryption','tracked-plaintext detection uses git ls-files when the repository is reachable and is skipped, not assumed clean, when it is not','runbook prepare, doctor and verification commands are declared and documented but not executed']};
}
