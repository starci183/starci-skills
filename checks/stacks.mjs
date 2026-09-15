import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../core/yaml.mjs';

const RESULT='starci/application-stacks-check@1';
const MAX_INPUT_BYTES=4*1024*1024;
const slash=value=>String(value??'').replaceAll('\\','/');
const inside=(root,target)=>{const rel=path.relative(path.resolve(root),path.resolve(target));return rel===''||(!rel.startsWith('..')&&!path.isAbsolute(rel));};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const sensitive=/pass(word)?|secret|token|credential|private[_-]?key|api[_-]?key/i;
const moduleDir=path.dirname(fileURLToPath(import.meta.url));
const compiledSchema=path.resolve(moduleDir,'../schemas/application-stacks.schema.json');
const sourceSchema=path.resolve(moduleDir,'../schemas/application-stacks.schema.yaml');
const manifestSchema=fs.existsSync(compiledSchema)?JSON.parse(fs.readFileSync(compiledSchema,'utf8')):parseYaml(fs.readFileSync(sourceSchema,'utf8'));

function regular(file,{root=null}={}){
  try{
    const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())return false;
    return !root||inside(root,fs.realpathSync(file));
  }catch{return false;}
}
function safeAncestors(root,target){
  if(!inside(root,target))return false;
  let cursor=path.resolve(target),base=path.resolve(root);
  while(cursor!==base){if(fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink())return false;cursor=path.dirname(cursor);}
  return true;
}
const allowed=(value,keys,at,add)=>{if(!object(value)){add('shape-invalid',at,'expected an object');return false;}for(const key of Object.keys(value))if(!keys.includes(key))add('unknown-field',`${at}.${key}`,'field is not defined by starci/application-stacks@1');return true;};
const nonempty=value=>typeof value==='string'&&Boolean(value.trim());
function validateSchema(value){
  const errors=[],isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),resolve=ref=>ref.slice(2).split('/').reduce((node,key)=>node?.[key],manifestSchema);
  const check=(node,shape,at)=>{
    if(shape?.$ref)return check(node,resolve(shape.$ref),at);
    const typed=shape?.type==='object'?isObject(node):shape?.type==='array'?Array.isArray(node):shape?.type?typeof node===shape.type:true;
    if(!typed){errors.push({path:at,message:`expected ${shape.type}`});return;}
    if(Object.hasOwn(shape??{},'const')&&node!==shape.const)errors.push({path:at,message:'const mismatch'});
    if(Array.isArray(shape?.enum)&&!shape.enum.includes(node))errors.push({path:at,message:'value outside enum'});
    if(typeof node==='string'){if(shape.minLength&&node.length<shape.minLength)errors.push({path:at,message:'string too short'});if(shape.pattern&&!new RegExp(shape.pattern,'u').test(node))errors.push({path:at,message:'pattern mismatch'});}
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
  try{if(fs.statSync(file).size>MAX_INPUT_BYTES)return false;const text=fs.readFileSync(file,'utf8');return /(?:(?:^|\n)sops:|["']sops["']\s*:)/.test(text)&&/ENC\[AES256_GCM,data:/.test(text);}catch{return false;}
}

function validateEnvironmentPolicies(manifest,add){
  const catalog=new Map((Array.isArray(manifest?.components)?manifest.components:[]).filter(object).map(item=>[item.id,item]));
  for(const name of ['dev','vps']){
    const spec=manifest?.environments?.[name];if(!object(spec))continue;const bindings=object(spec.components)?spec.components:{};
    if(spec.runtime!==(name==='dev'?'docker-compose':'docker-swarm'))add('schema-policy-invalid',`environments.${name}.runtime`,`${name} has the wrong container runtime`);
    for(const id of catalog.keys())if(!Object.hasOwn(bindings,id))add('schema-policy-invalid',`environments.${name}.components.${id}`,'component classification is required');
    for(const [id,binding] of Object.entries(bindings)){
      if(!object(binding))continue;const at=`environments.${name}.components.${id}`;
      if(binding.ownership==='managed'&&(!nonempty(binding.service)||!nonempty(binding.failureDomain)))add('schema-policy-invalid',at,'managed component requires service and failureDomain');
      if(binding.ownership==='external'&&(!nonempty(binding.owner)||!nonempty(binding.failureDomain)||!nonempty(binding.endpointRef)||binding.service!==undefined))add('schema-policy-invalid',at,'external component requires owner, failureDomain and endpointRef and forbids service');
      if(binding.ownership==='excluded'&&(!nonempty(binding.reason)||binding.service!==undefined))add('schema-policy-invalid',at,'excluded component requires reason and forbids service');
      if(binding.ownership==='excluded'&&catalog.get(id)?.required!==false)add('schema-policy-invalid',at,'required component cannot be excluded');
    }
    const names=new Set();for(const [index,secret] of (Array.isArray(spec.secrets)?spec.secrets:[]).entries()){
      if(!object(secret))continue;const at=`environments.${name}.secrets[${index}]`;
      if(names.has(secret.name))add('schema-policy-invalid',`${at}.name`,'secret name must be unique');names.add(secret.name);
      if(secret.source==='generated'&&(!nonempty(secret.generationAlgorithm)||!nonempty(secret.formatPolicy)))add('schema-policy-invalid',at,'generated secret requires generationAlgorithm and formatPolicy');
      if(secret.source==='provider-issued'&&!nonempty(secret.sourceOwner))add('schema-policy-invalid',at,'provider-issued secret requires sourceOwner');
      if(name==='dev'&&!nonempty(secret.materializedPath))add('schema-policy-invalid',at,'dev secret requires materializedPath');
      if(name==='vps'&&(!nonempty(secret.runtimeName)||!nonempty(secret.version)||secret.materializedPath!==undefined||secret.runtimeName===secret.name))add('schema-policy-invalid',at,'VPS secret requires distinct versioned runtimeName and version and forbids materializedPath');
    }
    if(name==='vps'){
      for(const key of ['update','rollback','backup','restore'])if(!nonempty(spec.runbook?.[key]))add('schema-policy-invalid',`environments.vps.runbook.${key}`,'VPS lifecycle command is required');
      if(!nonempty(spec.platform?.ubuntu)||!Array.isArray(spec.platform?.architectures)||!spec.platform.architectures.length)add('schema-policy-invalid','environments.vps.platform','VPS Ubuntu and architecture bounds are required');
    }
  }
}

export function checkApplicationStacks({repoRoot,environment,deploymentModelFile}={}){
  const root=path.resolve(String(repoRoot??'')),manifestFile=path.join(root,'.stacks','application-stacks.yaml'),errors=[];
  const add=(code,at,message)=>errors.push({code,path:at,message});
  if(!['dev','vps'].includes(environment))add('environment-invalid','environment','environment must be dev or vps');
  if(!regular(manifestFile,{root:path.join(root,'.stacks')}))add('manifest-unavailable','.stacks/application-stacks.yaml','manifest must be a regular file inside .stacks');
  if(!regular(deploymentModelFile))add('deployment-model-unavailable','deploymentModelFile','rendered deployment evidence must be a regular, non-symlink file');
  for(const [file,at] of [[manifestFile,'.stacks/application-stacks.yaml'],[deploymentModelFile,'deploymentModelFile']])try{if(fs.statSync(file).size>MAX_INPUT_BYTES)add('input-too-large',at,'input exceeds the 4 MiB static-check limit');}catch{}
  let manifest={},model={};
  try{if(!errors.some(item=>['manifest-unavailable','input-too-large'].includes(item.code)&&item.path==='.stacks/application-stacks.yaml'))manifest=parseYaml(fs.readFileSync(manifestFile,'utf8'));}catch{add('manifest-invalid','.stacks/application-stacks.yaml','manifest YAML could not be parsed');}
  try{if(!errors.some(item=>['deployment-model-unavailable','input-too-large'].includes(item.code)&&item.path==='deploymentModelFile')){const text=fs.readFileSync(deploymentModelFile,'utf8');try{model=JSON.parse(text);}catch{model=parseYaml(text);}}}catch{add('deployment-model-invalid','deploymentModelFile','rendered deployment JSON or YAML could not be parsed');}
  if(!object(manifest))manifest={};if(!object(model))model={};
  for(const issue of validateSchema(manifest))add('schema-shape-invalid',issue.path,issue.message);
  validateEnvironmentPolicies(manifest,add);
  if(manifest.schema!=='starci/application-stacks@1')add('schema-invalid','schema','expected starci/application-stacks@1');
  const components=Array.isArray(manifest.components)?manifest.components:[],ids=new Set(),requiredComponents=new Set();
  if(!components.length)add('components-empty','components','declare at least one applicable application component');
  for(const [index,item] of components.entries()){
    allowed(item,['id','role','purpose','required'],`components[${index}]`,add);
    if(!item?.id||ids.has(item.id))add('component-invalid',`components[${index}].id`,'component IDs must be unique and nonempty');else {ids.add(item.id);if(item.required!==false)requiredComponents.add(item.id);}
    if(!['frontend','backend','worker','bootstrap','stateful','gateway'].includes(item?.role))add('component-role-invalid',`components[${index}].role`,'component role is unsupported');
  }
  if(!components.some(item=>['frontend','backend','worker'].includes(item?.role)&&item.required!==false))add('required-app-component-missing','components','declare at least one required frontend, backend, or worker component');
  allowed(manifest.environments,['dev','vps'],'environments',add);allowed(manifest.k8s,['status','reason'],'k8s',add);
  if(manifest.k8s?.status!=='deferred'||!String(manifest.k8s?.reason??'').trim())add('k8s-status-invalid','k8s','Kubernetes must be explicitly deferred with a reason');
  const spec=manifest.environments?.[environment];
  allowed(spec,['status','runtime','composeFiles','components','runbook','platform','secrets'],`environments.${environment}`,add);
  if(!object(spec)||spec.status!=='supported')add('environment-unsupported',`environments.${environment}`,'environment must be explicitly supported');
  const composeFiles=Array.isArray(spec?.composeFiles)?spec.composeFiles:[];
  if(!composeFiles.length)add('compose-files-empty',`environments.${environment}.composeFiles`,'declare repository-owned Compose source files');
  for(const [index,relative] of composeFiles.entries()){
    const target=path.resolve(root,String(relative));
    if(!slash(relative).startsWith('.stacks/')||!inside(path.join(root,'.stacks'),target)||!regular(target,{root:path.join(root,'.stacks')}))add('compose-path-unsafe',`environments.${environment}.composeFiles[${index}]`,'Compose source must be a regular non-symlink file below .stacks');
  }
  const environmentComponents=object(spec?.components)?spec.components:{},seen=new Set(),managed=new Map();
  for(const [id,binding] of Object.entries(environmentComponents)){
    const at=`environments.${environment}.components.${id}`;
    allowed(binding,['ownership','service','owner','failureDomain','endpointRef','reason'],at,add);
    if(!ids.has(id)||seen.has(id))add('binding-invalid',at,'each declared component needs exactly one environment binding');else seen.add(id);
    if(!['managed','external','excluded'].includes(binding?.ownership))add('ownership-invalid',`${at}.ownership`,'component ownership is invalid');
    if(binding?.ownership==='managed'){
      if(!String(binding.service??'').trim())add('managed-service-missing',`${at}.service`,'managed component needs one Compose service');
      else if(managed.has(binding.service))add('managed-service-duplicate',`${at}.service`,'one Compose service cannot implement multiple inventory components');else managed.set(binding.service,id);
      if(!String(binding?.failureDomain??'').trim())add('failure-domain-missing',`${at}.failureDomain`,'managed component needs an explicit failure domain');
    }else if(binding?.ownership==='external'){
      if(binding?.service)add('external-service-present',`${at}.service`,'external or excluded component must not name a managed Compose service');
      if(!nonempty(binding?.owner)||!nonempty(binding?.failureDomain)||!nonempty(binding?.endpointRef))add('external-authority-missing',at,'external component needs explicit owner, failure domain, and endpoint reference');
    }else if(binding?.ownership==='excluded'){
      if(binding?.service)add('external-service-present',`${at}.service`,'external or excluded component must not name a managed Compose service');
      if(!String(binding?.reason??'').trim())add('binding-reason-missing',`${at}.reason`,'excluded component needs an explicit reason');
      if(requiredComponents.has(id))add('required-component-excluded',at,'a required component cannot be excluded');
    }
  }
  for(const id of ids)if(!seen.has(id))add('component-unclassified',`environments.${environment}.components`,'every component must be classified in this environment');
  const services=object(model.services)?model.services:{};
  for(const service of managed.keys())if(!services[service])add('managed-service-absent',`services.${service}`,'declared managed service is absent from rendered Compose');
  for(const service of Object.keys(services))if(!managed.has(service))add('compose-service-unclassified',`services.${service}`,'rendered Compose service is not mapped to a managed inventory component');
  if(environment==='vps'){
    const overlay=new Set(Object.entries(object(model.networks)?model.networks:{}).filter(([,definition])=>definition?.driver==='overlay').map(([name])=>name));
    for(const [service,id] of managed){
      const definition=services[service],role=components.find(item=>item?.id===id)?.role;if(!definition)continue;
      if(!nonempty(definition.image))add('swarm-image-missing',`services.${service}.image`,'managed Swarm service needs a nonempty rendered image');
      if(definition.build!==undefined)add('swarm-build-unrendered',`services.${service}.build`,'rendered Swarm model must not retain a build section');
      if(definition.depends_on!==undefined)add('swarm-dependency-unrendered',`services.${service}.depends_on`,'rendered Swarm model must not rely on Compose depends_on');
      if(role==='bootstrap')continue;
      if(!object(definition.deploy))add('swarm-deploy-policy-missing',`services.${service}.deploy`,'managed Swarm service needs an explicit deploy policy');
      if(!object(definition.healthcheck)||definition.healthcheck.disable===true)add('swarm-healthcheck-missing',`services.${service}.healthcheck`,'managed Swarm service needs an enabled container health check');
      const networks=Array.isArray(definition.networks)?definition.networks:Object.keys(object(definition.networks)?definition.networks:{});
      if(!networks.some(name=>overlay.has(typeof name==='string'?name:name?.target)))add('swarm-overlay-missing',`services.${service}.networks`,'managed Swarm service must join an explicitly rendered overlay network');
    }
  }
  if(unresolvedCompose(model))add('compose-placeholder-unresolved','composeModel','rendered Compose still contains an unresolved interpolation placeholder in a host-resolved field');
  for(const [service,definition] of Object.entries(services))for(const [key] of envEntries(definition?.environment))
    if(sensitive.test(key)&&!/_FILE$/i.test(key))add('plaintext-sensitive-environment',`services.${service}.environment.${key}`,'sensitive configuration is present as a direct environment value; value redacted');
  const runbook=spec?.runbook;allowed(runbook,['prepare','doctor','up','status','logs','down','update','rollback','backup','restore','verification'],`environments.${environment}.runbook`,add);
  allowed(runbook?.verification,['coldStart','restart','persistence'],`environments.${environment}.runbook.verification`,add);
  const commands=['prepare','doctor','up','status','logs','down'];
  for(const key of commands)if(!String(runbook?.[key]??'').trim())add('runbook-command-missing',`environments.${environment}.runbook.${key}`,'required runbook command is missing');
  for(const key of ['coldStart','restart','persistence'])if(!String(runbook?.verification?.[key]??'').trim())add('verification-missing',`environments.${environment}.runbook.verification.${key}`,'required verification command is missing');
  if(environment==='vps'){
    for(const key of ['update','rollback','backup','restore'])if(!String(runbook?.[key]??'').trim())add('vps-command-missing',`environments.vps.runbook.${key}`,'VPS lifecycle command is missing');
    if(!String(spec?.platform?.ubuntu??'').trim()||!Array.isArray(spec?.platform?.architectures)||!spec.platform.architectures.length)add('vps-platform-missing','environments.vps.platform','declare supported Ubuntu and architecture bounds');
  }
  const declaredSecrets=Array.isArray(spec?.secrets)?spec.secrets:[],modelSecrets=object(model.secrets)?model.secrets:{};
  const secretNames=new Set();
  for(const [index,secret] of declaredSecrets.entries()){
    const at=`environments.${environment}.secrets[${index}]`,enc=path.resolve(root,String(secret?.encryptedRef??'')),plain=path.resolve(root,String(secret?.materializedPath??''));
    allowed(secret,['name','source','sourceOwner','generationAlgorithm','formatPolicy','encryptedRef','materializedPath','runtimeName','version','recipientPolicy','keyCustody'],at,add);
    if(secretNames.has(secret?.name))add('secret-duplicate',`${at}.name`,'secret names must be unique');else secretNames.add(secret?.name);
    const modelName=secret?.name;
    if(!secret?.name||!object(modelSecrets[modelName]))add('secret-unbound',`${at}.name`,'declared secret is absent from rendered deployment model');
    if(!['generated','provider-issued'].includes(secret?.source))add('secret-source-invalid',`${at}.source`,'secret source must be generated or provider-issued');
    if(secret?.source==='generated'&&(!String(secret?.generationAlgorithm??'').trim()||!String(secret?.formatPolicy??'').trim()))add('secret-generation-policy-missing',at,'generated secret needs algorithm and format policy');
    if(secret?.source==='provider-issued'&&!String(secret?.sourceOwner??'').trim())add('secret-source-owner-missing',`${at}.sourceOwner`,'provider-issued secret needs an owner');
    if(!slash(secret?.encryptedRef).startsWith('.stacks/')||!String(secret?.encryptedRef??'').endsWith('.enc')||!inside(path.join(root,'.stacks'),enc)||!regular(enc,{root:path.join(root,'.stacks')})||!sopsEnvelope(enc))add('encrypted-ref-invalid',`${at}.encryptedRef`,'encrypted reference must be a recognizable SOPS envelope in an existing regular .enc file below .stacks');
    if(environment==='dev'&&(!slash(secret?.materializedPath).startsWith('.stacks/')||String(secret?.materializedPath??'').endsWith('.enc')||!inside(path.join(root,'.stacks'),plain)||!safeAncestors(path.join(root,'.stacks'),plain)))add('materialized-path-invalid',`${at}.materializedPath`,'materialized secret path and its existing ancestors must remain below .stacks without symlinks');
    if(!String(secret?.recipientPolicy??'').trim()||!String(secret?.keyCustody??'').trim())add('secret-policy-missing',at,'secret recipient and key custody policies are required');
    const definition=modelSecrets[modelName];
    if(environment==='dev'){
      const rendered=definition?.file;if(typeof rendered!=='string'||rendered.endsWith('.enc'))add('encrypted-secret-mounted',`secrets.${modelName}.file`,'Compose must mount materialized plaintext, never the encrypted .enc file');
      else if(path.resolve(rendered)!==plain)add('secret-materialization-mismatch',`secrets.${modelName}.file`,'rendered secret file does not match its declared materialized path');
    }else if(definition?.external!==true||definition?.name!==secret.runtimeName||Object.keys(definition??{}).some(key=>!['external','name'].includes(key)))add('swarm-secret-invalid',`secrets.${modelName}`,'VPS secret must be an external Swarm secret with its exact immutable runtime name and no file/content driver');
  }
  for(const [name,definition] of Object.entries(modelSecrets)){
    const declared=secretNames.has(name);
    if(!declared)add('compose-secret-unclassified',`secrets.${name}`,'rendered deployment secret is absent from the environment manifest');
    if(environment==='dev'&&(!object(definition)||Object.keys(definition).some(key=>key!=='file')))add('compose-secret-driver-unsafe',`secrets.${name}`,'dev permits only file-backed Compose secrets');
  }
  const grantedSecrets=new Set();
  for(const [service,definition] of Object.entries(services)){
    const targets=new Set();
    for(const [index,grant] of (Array.isArray(definition?.secrets)?definition.secrets:[]).entries()){
      const source=typeof grant==='string'?grant:grant?.source,target=typeof grant==='string'?grant:(grant?.target??source);
      const declared=secretNames.has(source);
      if(!source||!object(modelSecrets[source])||!declared)add('service-secret-grant-invalid',`services.${service}.secrets[${index}]`,'service secret grant must reference an exactly declared runtime secret');
      else {grantedSecrets.add(source);targets.add(String(target).replace(/^\/run\/secrets\//,''));}
    }
    for(const [key,value] of envEntries(definition?.environment))if(sensitive.test(key)&&/_FILE$/i.test(key)){
      const match=typeof value==='string'?value.match(/^\/run\/secrets\/([^/]+)$/):null;
      if(!match||!targets.has(match[1]))add('service-secret-file-mismatch',`services.${service}.environment.${key}`,'sensitive file pointer must name /run/secrets/<target> granted to this service; value redacted');
    }
  }
  for(const name of Object.keys(modelSecrets))if(!grantedSecrets.has(name))add('compose-secret-ungranted',`secrets.${name}`,'rendered Compose secret is not granted to any managed service');
  return {schema:RESULT,ok:errors.length===0,environment,manifest:manifestFile,deploymentModel:path.resolve(String(deploymentModelFile??'')),errors,
    limitations:['static conformance only; Docker was not invoked','the deployment model must be rendered by Docker Compose or Docker Stack tooling; provenance is supplied by the caller and is not independently authenticated','inventory and external ownership declarations are author assertions checked for consistency, not independently discovered facts','SOPS envelope recognition is structural, not cryptographic verification or decryption','health, migration, backup and restore commands are declared but not executed']};
}
