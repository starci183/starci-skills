#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {skillRoot} from '../../engine/runtime-root.mjs';
import {parseYaml} from '../../engine/yaml.mjs';

/**
 * Product Sonar analysis runs against a LOCAL SonarQube (owner ruling 2026-09-24). Where it is comes from
 * the repository's stack declaration (.starcistacks/application-stacks.yaml `services.sonar`, read by
 * readSonarDeclaration); without one it is the runtime source repository's dev stack: SonarQube at
 * http://localhost:9010 (container starci-sonarqube, compose .stacks/dev/infra/compose/sonarqube.yaml),
 * published as https://sonar.starci.org, with the admin token in its custody at
 * .stacks/dev/runtime/files/sonarqube-admin-token.key(.enc). Each project scans with its own
 * PROJECT_ANALYSIS_TOKEN at runtime/files/sonarqube-KEY-token.key, minted with the admin token and stored
 * through the stack-secret tool the first time. No op ever asks the owner for a Sonar token or a GitHub
 * setting.
 *
 *   status                                   server, container, custody and token validity
 *   ensure-project --key K [--with-token]    admin token -> create the project (and its token) when missing
 *   token [--key K] [-- command args...]     run a command with SONAR_TOKEN/SONAR_HOST_URL in its env
 *   scan --cwd REPO [--key K] [--wait]       run the repository's scanner against the local server
 *        [--out summary.json] [--log scanner.txt] [--no-ensure] [--timeout SECONDS]
 *
 * Secret handling: a token is decrypted from its .enc member with sops and the shared master identity
 * (~/.starci/master.identity, the same identity scripts/stack-secret.mjs uses) straight into memory; the
 * materialized plaintext sibling that `stack-secret show` or `sync` leaves is the fallback. A value is only
 * ever placed in a child process environment or an Authorization header - never on a command line, in a
 * report, a log or an error; every text this module emits passes through scrub().
 *
 * Exit codes: 0 pass / up / ensured / disabled by the declaration, 1 a real failing result (gate ERROR,
 * scanner failure), 2 blocked (server down, custody missing, invalid token, usage).
 */
export const SCHEMA='starci/sonar-local@1';
export const SCAN_SCHEMA='starci/sonar-local-scan@1';
export const DEFAULT_HOST='http://localhost:9010';
export const PUBLIC_HOST='https://sonar.starci.org';
export const CONTAINER='starci-sonarqube';
export const ADMIN_TOKEN='sonarqube-admin-token.key';
export const ANALYSIS_TOKEN='sonarqube-analysis-token.txt';
const MASTER_IDENTITY=path.join(os.homedir(),'.starci','master.identity');
const IS_WINDOWS=process.platform==='win32';
const LOG_CAP=4*1024*1024;

// ---- secrets never leave this module in the clear -------------------------------------------------------

const SECRETS=new Set();
const remember=value=>{if(typeof value==='string'&&value.length>=4)SECRETS.add(value);return value;};
/** Replace every secret this process has read with *** (tokens also appear URL- or base64-encoded). */
export function scrub(text){
  let out=String(text??'');
  for(const secret of SECRETS){
    for(const form of [secret,encodeURIComponent(secret),Buffer.from(`${secret}:`).toString('base64')])
      if(form)out=out.split(form).join('***');
  }
  return out;
}

// ---- configuration ----------------------------------------------------------------------------------------

/** The source host's dev stack - the stack this runtime tree's own repository runs: <source>/.stacks/dev. */
export function sourceHostStackDir(){
  const source=path.resolve(skillRoot,'..');
  for(const root of ['.stacks','.starcistacks']){
    const dir=path.join(source,root,'dev');
    if(fs.existsSync(dir))return dir;
  }
  return path.join(source,'.stacks','dev');
}

const DECLARATION='application-stacks.yaml';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'&&value.trim()?value.trim():null;

/**
 * Find the stack declaration that governs a repository: its own .starcistacks/application-stacks.yaml,
 * or a sibling repository's declaration whose `sources` list this repository (a frontend declared by its
 * backend's stack). Returns {file, repoRoot} or null.
 */
export function findDeclaration(cwd){
  if(!cwd)return null;
  const repo=path.resolve(cwd);
  const own=path.join(repo,'.starcistacks',DECLARATION);
  if(fs.existsSync(own))return {file:own,repoRoot:repo};
  const name=path.basename(repo);
  let siblings=[];
  try{siblings=fs.readdirSync(path.dirname(repo),{withFileTypes:true}).filter(e=>e.isDirectory()&&e.name!==name);}catch{/* no parent listing */}
  for(const entry of siblings){
    const file=path.join(path.dirname(repo),entry.name,'.starcistacks',DECLARATION);
    if(!fs.existsSync(file))continue;
    try{
      const doc=parseYaml(fs.readFileSync(file,'utf8'));
      if((doc?.sources??[]).some(s=>s?.repository===name))return {file,repoRoot:path.dirname(path.dirname(file))};
    }catch{/* unreadable declaration is not this repository's */}
  }
  return null;
}

/**
 * The thin resolver between a stack declaration and this helper, so the declaration schema
 * (modules/schemas/application-stacks.schema.yaml `services`) can evolve on its own. It reads
 * `services.sonar` (also the earlier `quality.sonar` / `services.quality.sonar` drafts) and normalizes:
 *   provider, mode local|hosted|disabled (+ reason), host {local, public},
 *   stack {repository, root, environment, compose, container} - the stack that runs a local server; the
 *     string `source-host` (or no stack) means the runtime source repository's dev stack,
 *   projects [{repository, key, name}],
 *   credentials [{id, env, custody {repository, path}}] - custody paths from that repository's root; an
 *     `admin` credential creates projects and mints tokens, a SONAR_TOKEN credential naming a project key
 *     is that project's analysis token, another SONAR_TOKEN credential is the generic analysis token,
 *   ci and ownerAction, passed through.
 * Returns null when the declaration carries no Sonar service.
 */
export function readSonarDeclaration(file,repoRoot=path.dirname(path.dirname(path.resolve(file)))){
  const doc=parseYaml(fs.readFileSync(file,'utf8'));
  const sonar=[doc?.services?.sonar,doc?.quality?.sonar,doc?.services?.quality?.sonar].find(plain);
  if(!sonar)return null;
  const sourceRoot=path.resolve(skillRoot,'..');
  const repoDir=name=>!name||name===path.basename(repoRoot)?repoRoot:name===path.basename(sourceRoot)?sourceRoot:path.join(path.dirname(repoRoot),name);
  let stackDir=null,composeFile=null,container=null;
  if(plain(sonar.stack)){
    const dir=repoDir(text(sonar.stack.repository));
    stackDir=path.join(dir,text(sonar.stack.root)??'.starcistacks',text(sonar.stack.environment)??'dev');
    const compose=text(sonar.stack.compose);
    if(compose)composeFile=/^\.(?:starci)?stacks[\\/]/.test(compose)?path.join(dir,compose):path.resolve(stackDir,compose);
    container=text(sonar.stack.container);
  }else if(text(sonar.stack)&&sonar.stack!=='source-host')stackDir=path.join(repoRoot,'.starcistacks',sonar.stack);
  const projects=(Array.isArray(sonar.projects)?sonar.projects.filter(plain).map(p=>({repository:text(p.repository),key:text(p.key),name:text(p.name)}))
    :plain(sonar.projects)?Object.entries(sonar.projects).map(([repository,v])=>({repository,key:text(v)??text(v?.key),name:text(v?.name)})):[]).filter(p=>p.key);
  const credentials=(Array.isArray(sonar.credentials)?sonar.credentials:[]).filter(plain).map(c=>({id:text(c.id)??'',env:text(c.env),
    file:text(c.custody?.path)?path.join(repoDir(text(c.custody?.repository)),c.custody.path):null})).filter(c=>c.file);
  const isAdmin=c=>/admin/i.test(c.id)||/admin/i.test(path.basename(c.file));
  const analysis=credentials.filter(c=>!isAdmin(c)&&(!c.env||c.env==='SONAR_TOKEN'));
  const forProject=key=>analysis.find(c=>c.id.includes(key)||path.basename(c.file).includes(key))?.file??null;
  const legacy=plain(sonar.custody)?sonar.custody:{};
  const where=value=>text(value)??text(value?.where)??text(value?.path);
  for(const p of projects)p.tokenRef=forProject(p.key);
  return {
    file,repoRoot,
    provider:text(sonar.provider)??'sonarqube',
    mode:text(sonar.mode)??'local',
    reason:text(sonar.reason),
    stackDir,composeFile,container,
    hostLocal:text(sonar.host?.local)??text(sonar.hostUrl)??(typeof sonar.host==='string'?text(sonar.host):null),
    hostPublic:text(sonar.host?.public)??text(sonar.publicUrl),
    projects,
    admin:credentials.find(isAdmin)?.file??where(legacy.admin),
    analysis:analysis.find(c=>!projects.some(p=>p.tokenRef===c.file))?.file??where(legacy.analysis),
    ci:sonar.ci??null,
    ownerAction:sonar.ownerAction??null,
  };
}

/**
 * Resolution order: explicit options (CLI flags, spec config) > the governing stack declaration >
 * STARCI_SONAR_* environment > the source host's dev stack defaults.
 */
export function resolveConfig(options={},env=process.env){
  const found=options.declaration?{file:path.resolve(options.declaration),repoRoot:path.dirname(path.dirname(path.resolve(options.declaration)))}:findDeclaration(options.cwd);
  let decl=null,declarationError=null;
  if(found){try{decl=readSonarDeclaration(found.file,found.repoRoot);}catch(error){declarationError=`${found.file}: ${error.message}`;}}
  const stackDir=path.resolve(options.stack??decl?.stackDir??env.STARCI_SONAR_STACK??sourceHostStackDir());
  const declaredHost=decl?(decl.mode==='hosted'?decl.hostPublic:decl.hostLocal):null;
  const host=options.host??declaredHost??env.STARCI_SONAR_HOST_URL??DEFAULT_HOST;
  const repository=options.cwd?path.basename(path.resolve(options.cwd)):null;
  const project=decl?.projects.find(p=>p.repository===repository)??null;
  return {
    host:String(host).replace(/\/+$/,''),
    publicHost:String(decl?.hostPublic??PUBLIC_HOST).replace(/\/+$/,''),
    stackDir,
    composeFile:decl?.composeFile??path.join(stackDir,'infra','compose','sonarqube.yaml'),
    container:options.container??decl?.container??env.STARCI_SONAR_CONTAINER??CONTAINER,
    identity:options.identity??MASTER_IDENTITY,
    sops:options.sops??env.STARCI_SOPS??null,
    docker:options.docker??env.STARCI_DOCKER??'docker',
    stackSecret:options.stackSecret??null,
    adminToken:options.adminToken??decl?.admin??`runtime/files/${ADMIN_TOKEN}`,
    analysisToken:options.analysisToken??decl?.analysis??`runtime/files/${ANALYSIS_TOKEN}`,
    declaredKey:project?.key??null,
    declaredName:project?.name??null,
    declaredTokenRef:project?.tokenRef??null,
    disabled:decl?.mode==='disabled'?(decl.reason??'the stack declaration disables Sonar'):null,
    declaration:decl?{file:decl.file,provider:decl.provider,mode:decl.mode,projects:decl.projects.map(p=>p.key),ci:decl.ci?.wiring??null,ownerAction:decl.ownerAction}:(declarationError?{error:declarationError}:null),
    timeoutMs:Number(options.timeoutMs??8000),
    pollMs:Number(options.pollMs??3000),
    fetch:options.fetch??globalThis.fetch,
  };
}

// ---- custody --------------------------------------------------------------------------------------------

/** PATH lookup with PATHEXT and the winget package tree, the way scripts/stack-secret.mjs finds sops. */
function resolveCommand(command){
  const dirs=(process.env.PATH||'').split(IS_WINDOWS?';':':').filter(Boolean);
  if(IS_WINDOWS&&process.env.LOCALAPPDATA){
    const winget=path.join(process.env.LOCALAPPDATA,'Microsoft','WinGet');
    dirs.push(path.join(winget,'Links'));
    const packages=path.join(winget,'Packages');
    try{
      for(const entry of fs.readdirSync(packages)){
        const dir=path.join(packages,entry);
        dirs.push(dir);
        try{for(const nested of fs.readdirSync(dir,{withFileTypes:true}))if(nested.isDirectory())dirs.push(path.join(dir,nested.name));}catch{/* unreadable */}
      }
    }catch{/* no winget packages */}
  }
  const exts=IS_WINDOWS?(process.env.PATHEXT||'.EXE;.CMD;.BAT').split(';').filter(Boolean):[''];
  for(const dir of dirs)for(const ext of exts){
    const candidate=path.join(dir,`${command}${ext}`);
    if(fs.existsSync(candidate))return candidate;
  }
  return null;
}

/** A .mjs/.js "binary" (the specs' fake sops) runs under this node; anything else runs directly. */
const launcher=(bin,args)=>/\.(?:c|m)?js$/i.test(bin)?[process.execPath,[bin,...args]]:[bin,args];

/**
 * Read one custody member into memory. Returns {present, value?, via?, reason?}; `value` is for a child
 * env or a header only. The .enc member decrypted by sops wins; the materialized sibling is the fallback.
 */
export function readCustody(cfg,ref){
  // A relative reference is a member of the configured stack; an absolute one (a declaration credential,
  // resolved from its repository root) must still sit inside a .stacks or .starcistacks tree.
  const plainFile=path.resolve(cfg.stackDir,ref);
  const name=String(ref).replace(/\\/g,'/');
  const inside=path.isAbsolute(String(ref))
    ?/[\\/]\.(?:starci)?stacks[\\/]/.test(plainFile)
    :plainFile.startsWith(cfg.stackDir+path.sep);
  if(!inside)return {present:false,name,reason:`custody reference ${name} is outside a stack custody tree`};
  const enc=`${plainFile}.enc`;
  const reasons=[];
  if(fs.existsSync(enc)){
    const sops=cfg.sops??resolveCommand('sops');
    if(!sops)reasons.push('sops is not installed');
    else if(!fs.existsSync(cfg.identity))reasons.push(`master identity ${cfg.identity} is missing`);
    else{
      const [bin,args]=launcher(sops,['--decrypt','--input-type','binary','--output-type','binary',enc]);
      const result=spawnSync(bin,args,{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],
        env:{...process.env,SOPS_AGE_KEY_FILE:cfg.identity},maxBuffer:1024*1024});
      const value=result.status===0?String(result.stdout??'').trim():'';
      if(value)return {present:true,value:remember(value),via:'sops',name};
      reasons.push(result.error?`sops failed to start: ${result.error.code??result.error.message}`:`sops could not decrypt ${name}.enc (exit ${result.status})`);
    }
  }
  if(fs.existsSync(plainFile)){
    const value=fs.readFileSync(plainFile,'utf8').trim();
    if(value)return {present:true,value:remember(value),via:'materialized',name};
    reasons.push(`${name} is empty`);
  }
  if(!fs.existsSync(enc)&&!fs.existsSync(plainFile))reasons.push(`${name}(.enc) is not in custody ${cfg.stackDir}`);
  return {present:false,name,reason:reasons.join('; ')};
}

/** The custody entry without its value - what a report may carry. */
const custodyView=entry=>({name:entry.name,present:entry.present,...(entry.via?{via:entry.via}:{}),...(entry.reason?{reason:entry.reason}:{})});

/** The custody member a minted project analysis token lives in: runtime/files/sonarqube-KEY-token.key. */
export const projectTokenRef=key=>`runtime/files/sonarqube-${String(key).replace(/[^A-Za-z0-9_.-]/g,'_')}-token.key`;

/**
 * Store a value as an encrypted custody member through the stack's own tool (scripts/stack-secret.mjs of the
 * repository whose .stacks holds the stack). The value travels through a 0600 temp file only - never argv.
 */
function writeCustody(cfg,ref,value){
  const stacksRoot=path.dirname(cfg.stackDir);
  const tool=cfg.stackSecret??path.join(path.dirname(stacksRoot),'scripts','stack-secret.mjs');
  if(path.basename(stacksRoot)!=='.stacks'&&!cfg.stackSecret)return {ok:false,reason:`the stack ${cfg.stackDir} is not under a .stacks tree its stack-secret tool manages`};
  if(!fs.existsSync(tool))return {ok:false,reason:`no stack-secret tool at ${tool}`};
  const target=path.relative(stacksRoot,path.resolve(cfg.stackDir,ref)).replace(/\\/g,'/');
  const tmp=path.join(os.tmpdir(),`sonar-local-${process.pid}-${Date.now().toString(36)}`);
  try{
    fs.writeFileSync(tmp,value,{mode:0o600});
    const result=spawnSync(process.execPath,[tool,'set',target,'--from-file',tmp],{cwd:path.dirname(stacksRoot),encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});
    return result.status===0?{ok:true}:{ok:false,reason:scrub(`stack-secret set ${target} exited ${result.status}: ${String(result.stderr||result.stdout).trim().split(/\r?\n/).slice(-2).join(' ')}`)};
  }finally{
    try{fs.rmSync(tmp,{force:true});}catch{/* best effort */}
  }
}

/**
 * The analysis token for one project. Order: an explicit custody reference, the declaration's reference
 * for the project, the minted member projectTokenRef(key); when none exists and minting is allowed, the
 * admin token generates a PROJECT_ANALYSIS_TOKEN for the project and the stack-secret tool stores it
 * encrypted at projectTokenRef(key) before it is used. The source stack's generic analysis token is the
 * last resort - on this server it is itself scoped to one project.
 */
export async function projectToken(cfg,{key,admin,tokenRef,mint=true}={}){
  const refs=[tokenRef,cfg.declaredTokenRef,key?projectTokenRef(key):null].filter(Boolean);
  const misses=[];
  for(const ref of refs){
    const entry=readCustody(cfg,ref);
    if(entry.present)return entry;
    misses.push(entry.reason);
  }
  if(key&&mint&&admin?.present){
    const name=`sonar-local-${key}-${Date.now().toString(36)}`.slice(0,100);
    const generated=await call(cfg,'POST','/api/user_tokens/generate',{token:admin.value,form:{name,type:'PROJECT_ANALYSIS_TOKEN',projectKey:key}});
    const value=generated.status===200?remember(String(generated.json?.token??'')):'';
    if(value){
      const ref=projectTokenRef(key);
      const stored=writeCustody(cfg,ref,value);
      if(stored.ok)return {present:true,value,via:'minted',name:ref,minted:name};
      await call(cfg,'POST','/api/user_tokens/revoke',{token:admin.value,form:{name}});
      misses.push(`minted ${name} but could not store it (${stored.reason}); revoked it`);
    }else misses.push(`token generate for ${key} failed: HTTP ${generated.status} ${generated.text??generated.error??''}`);
  }
  const fallback=readCustody(cfg,cfg.analysisToken);
  if(fallback.present)return {...fallback,note:'generic analysis token (project-scoped on this server)'};
  return {present:false,name:refs.at(-1)??cfg.analysisToken,reason:[...misses,fallback.reason].filter(Boolean).join('; ')};
}

/** The env a Sonar child process gets: local host plus the project's (or generic) analysis token. */
export async function sonarEnv(cfg,{key,base=process.env,mint=false}={}){
  const admin=key&&mint?readCustody(cfg,cfg.adminToken):null;
  const token=key?await projectToken(cfg,{key,admin,mint}):readCustody(cfg,cfg.analysisToken);
  if(!token.present)return {ok:false,custody:custodyView(token)};
  return {ok:true,custody:custodyView(token),env:{...base,SONAR_HOST_URL:cfg.host,SONAR_TOKEN:token.value}};
}

// ---- server ---------------------------------------------------------------------------------------------

async function call(cfg,method,pathname,{token,form,timeoutMs}={}){
  const headers={Accept:'application/json'};
  if(token)headers.Authorization=`Bearer ${token}`;
  let body;
  if(form){headers['Content-Type']='application/x-www-form-urlencoded';body=new URLSearchParams(form).toString();}
  try{
    const response=await cfg.fetch(`${cfg.host}${pathname}`,{method,headers,body,signal:AbortSignal.timeout(timeoutMs??cfg.timeoutMs)});
    const raw=await response.text();
    let json=null;
    try{json=raw?JSON.parse(raw):null;}catch{/* non-JSON body */}
    return {reachable:true,status:response.status,json,text:scrub(raw).slice(0,500)};
  }catch(error){
    const cause=error?.cause?.code??error?.code??error?.name??'error';
    return {reachable:false,status:0,error:scrub(`${cause}: ${error?.cause?.message??error?.message??error}`)};
  }
}

/** docker inspect of the SonarQube container: state/health, or why docker could not say. */
export function containerState(cfg){
  const result=spawnSync(cfg.docker,['inspect','--format','{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}',cfg.container],
    {encoding:'utf8',windowsHide:true,timeout:15000});
  if(result.error)return {container:cfg.container,state:'docker-unavailable',detail:String(result.error.code??result.error.message)};
  if(result.status!==0)return {container:cfg.container,state:'missing',detail:String(result.stderr||'').trim().split(/\r?\n/)[0]||'no such container'};
  const [state,health]=String(result.stdout).trim().split('|');
  return {container:cfg.container,state:state||'unknown',...(health?{health}:{})};
}

/** A plain sentence for a server that does not answer, naming what to do next. */
function downMessage(cfg,server,docker){
  const where=`SonarQube at ${cfg.host} is not reachable (${server.error??`HTTP ${server.status}`})`;
  if(docker.state==='docker-unavailable')return `${where}; Docker is not available on this machine, so the local server cannot run. Start Docker Desktop, then the source dev stack (${cfg.composeFile}).`;
  if(docker.state==='missing')return `${where}; container ${cfg.container} does not exist. Bring up the source dev stack's SonarQube (${cfg.composeFile}).`;
  if(docker.state==='running')return `${where}; container ${cfg.container} is running${docker.health?` (${docker.health})`:''} - it may still be starting; retry when /api/system/status reports UP.`;
  return `${where}; container ${cfg.container} is ${docker.state}. Start it: docker start ${cfg.container}-postgres ${cfg.container}`;
}

export async function status(cfg){
  const server=await call(cfg,'GET','/api/system/status');
  const up=server.reachable&&server.status===200&&server.json?.status==='UP';
  const docker=containerState(cfg);
  const tokens={};
  for(const [role,name] of [['admin',cfg.adminToken],['analysis',cfg.analysisToken]]){
    const entry=readCustody(cfg,name);
    const view=custodyView(entry);
    if(entry.present&&up){
      const check=await call(cfg,'GET','/api/authentication/validate',{token:entry.value});
      view.valid=check.status===200&&check.json?.valid===true;
    }
    tokens[role]=view;
  }
  const report={schema:SCHEMA,command:'status',host:cfg.host,publicHost:cfg.publicHost,stack:cfg.stackDir,declaration:cfg.declaration,
    server:{reachable:server.reachable,up,...(server.json?.status?{status:server.json.status}:{}),...(server.json?.version?{version:server.json.version}:{}),...(server.error?{error:server.error}:{})},
    docker,custody:tokens};
  if(!up){report.outcome='down';report.message=server.reachable&&server.status===200?`SonarQube at ${cfg.host} answers but reports ${server.json?.status??'unknown'}; wait until it is UP.`:downMessage(cfg,server,docker);}
  else if(!tokens.analysis.present||tokens.analysis.valid===false){report.outcome='blocked';report.message=`the analysis token is ${tokens.analysis.present?'rejected by the server':'missing from custody'} (${tokens.analysis.name}); repair the source stack custody (secret:gen / stack-secret) - never ask the owner for it.`;}
  else report.outcome='up';
  return report;
}

const KEY_PATTERN=/^(?=.*[A-Za-z_.:-])[A-Za-z0-9_.:-]{1,400}$/;

export async function ensureProject(cfg,{key,name}={}){
  const base={schema:SCHEMA,command:'ensure-project',host:cfg.host,projectKey:key,...(cfg.declaration?{declaration:cfg.declaration}:{})};
  if(!key||!KEY_PATTERN.test(key))return {...base,outcome:'blocked',message:`invalid project key ${JSON.stringify(key??null)}: letters, digits, - _ . : and at least one non-digit`};
  const admin=readCustody(cfg,cfg.adminToken);
  if(!admin.present)return {...base,outcome:'blocked',custody:custodyView(admin),message:`the admin token is missing from custody (${admin.reason}); repair the source stack custody - never ask the owner for it.`};
  const found=await call(cfg,'GET',`/api/projects/search?projects=${encodeURIComponent(key)}`,{token:admin.value});
  if(!found.reachable){const docker=containerState(cfg);return {...base,outcome:'blocked',docker,message:downMessage(cfg,found,docker)};}
  if(found.status===401||found.status===403)return {...base,outcome:'blocked',message:`the admin token was refused (HTTP ${found.status}); repair the source stack custody.`};
  if(found.status!==200)return {...base,outcome:'blocked',message:`project search failed: HTTP ${found.status} ${found.text}`};
  const existing=(found.json?.components??[]).find(c=>c.key===key);
  if(existing)return {...base,outcome:'ok',created:false,projectName:existing.name,dashboardUrl:`${cfg.host}/dashboard?id=${encodeURIComponent(key)}`,publicDashboardUrl:`${cfg.publicHost}/dashboard?id=${encodeURIComponent(key)}`};
  const projectName=name||key;
  const created=await call(cfg,'POST','/api/projects/create',{token:admin.value,form:{project:key,name:projectName}});
  const raced=created.status===400&&/already exists/i.test(created.text);
  if(created.status!==200&&!raced)return {...base,outcome:'blocked',message:`project create failed: HTTP ${created.status} ${created.text}`};
  return {...base,outcome:'ok',created:!raced,projectName,dashboardUrl:`${cfg.host}/dashboard?id=${encodeURIComponent(key)}`,publicDashboardUrl:`${cfg.publicHost}/dashboard?id=${encodeURIComponent(key)}`};
}

// ---- scan -----------------------------------------------------------------------------------------------

export function readProperties(file){
  const out={};
  if(!fs.existsSync(file))return out;
  for(const raw of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const line=raw.trim();
    if(!line||line.startsWith('#')||line.startsWith('!'))continue;
    const at=line.search(/[=:]/);
    if(at>0)out[line.slice(0,at).trim()]=line.slice(at+1).trim();
  }
  return out;
}

const quote=arg=>/^[\w@%+=:,./\\-]+$/.test(arg)?arg:`"${String(arg).replace(/"/g,'\\"')}"`;

/**
 * The repository's own scanner: its `sonar:check` script when it has one (nivo repositories), otherwise
 * the official npm scanner. The host is forced to the local server on the command line - it wins over
 * sonar.host.url in sonar-project.properties, which keeps the public name for CI and dashboards - and the
 * scanner's work directory goes outside the repository so a scan leaves no .scannerwork behind.
 */
export function scannerCommand({pkg,props,host,key,workDir}){
  const defines=[`-Dsonar.host.url=${host}`,`-Dsonar.working.directory=${workDir}`];
  if(key&&props['sonar.projectKey']!==key)defines.push(`-Dsonar.projectKey=${key}`);
  if(pkg?.scripts?.['sonar:check'])return {runner:'npm run sonar:check',command:'npm',args:['run','sonar:check','--',...defines]};
  return {runner:'npx @sonar/scan',command:'npx',args:['--yes','@sonar/scan',...defines]};
}

function runScanner(cwd,{command,args},env,timeoutMs){
  return new Promise(resolve=>{
    const started=Date.now();
    const line=[command,...args].map(quote).join(' ');
    const child=spawn(line,{cwd,env,shell:true,windowsHide:true});
    let log='';
    const take=chunk=>{if(log.length<LOG_CAP)log+=chunk.toString('utf8');};
    child.stdout.on('data',take);child.stderr.on('data',take);
    const timer=setTimeout(()=>{log+=`\n[sonar-local] scanner exceeded ${Math.round(timeoutMs/1000)}s and was stopped\n`;child.kill();},timeoutMs);
    child.on('error',error=>{log+=`\n[sonar-local] scanner failed to start: ${error.message}\n`;});
    child.on('close',code=>{clearTimeout(timer);resolve({exitCode:code??1,durationMs:Date.now()-started,log:scrub(log),display:line});});
  });
}

function gitRevision(cwd){
  const head=spawnSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8',windowsHide:true});
  if(head.status!==0)return {commit:null};
  const dirty=spawnSync('git',['status','--porcelain','--untracked-files=no'],{cwd,encoding:'utf8',windowsHide:true});
  return {commit:head.stdout.trim(),dirty:dirty.status===0?dirty.stdout.trim().length>0:null};
}

/** GET with the analysis token, retried with the admin token when the analysis user may not browse. */
async function read(cfg,tokens,pathname){
  let last;
  for(const token of tokens){
    last=await call(cfg,'GET',pathname,{token});
    if(last.status!==401&&last.status!==403)return last;
  }
  return last;
}

const facet=(json,property)=>Object.fromEntries((json?.facets??[]).find(f=>f.property===property)?.values?.map(v=>[v.val,v.count])??[]);

export async function scan(cfg,options={}){
  const cwd=path.resolve(options.cwd??process.cwd());
  const summary={schema:SCAN_SCHEMA,at:new Date().toISOString(),host:cfg.host,publicHost:cfg.publicHost,cwd,stack:cfg.stackDir,declaration:cfg.declaration};
  const finish=(outcome,reason,extra={})=>Object.assign(summary,extra,{outcome,...(reason?{reason}:{})});
  if(!fs.existsSync(path.join(cwd,'package.json'))&&!fs.existsSync(path.join(cwd,'sonar-project.properties')))
    return finish('blocked',`${cwd} has neither package.json nor sonar-project.properties`);
  const props=readProperties(path.join(cwd,'sonar-project.properties'));
  let pkg=null;
  try{pkg=JSON.parse(fs.readFileSync(path.join(cwd,'package.json'),'utf8'));}catch{/* no manifest */}
  const key=options.key??cfg.declaredKey??props['sonar.projectKey']??(pkg?.name?String(pkg.name).replace(/^@/,'').replace(/\//g,'_'):null);
  summary.projectKey=key;
  summary.revision=gitRevision(cwd);
  if(cfg.disabled)return finish('disabled',`Sonar is disabled for this repository: ${cfg.disabled}`);
  if(!key)return finish('blocked','no project key: pass --key or set sonar.projectKey');

  const server=await call(cfg,'GET','/api/system/status');
  if(!(server.reachable&&server.json?.status==='UP')){
    const docker=containerState(cfg);
    return finish('blocked',server.reachable?`SonarQube at ${cfg.host} reports ${server.json?.status??`HTTP ${server.status}`}`:downMessage(cfg,server,docker),{docker});
  }
  summary.serverVersion=server.json.version;
  const admin=readCustody(cfg,cfg.adminToken);
  summary.custody={admin:custodyView(admin)};
  if(options.ensure!==false){
    const ensured=admin.present?await ensureProject(cfg,{key,name:cfg.declaredName??props['sonar.projectName']??key}):{outcome:'skipped',message:'admin token not in custody'};
    summary.project={outcome:ensured.outcome,...(ensured.created!==undefined?{created:ensured.created}:{}),...(ensured.message?{message:ensured.message}:{})};
  }
  const token=await projectToken(cfg,{key,admin,tokenRef:options.tokenRef,mint:options.ensure!==false});
  summary.custody.analysis=custodyView(token);
  if(!token.present)return finish('blocked',`no analysis token for ${key} (${token.reason}); repair the source stack custody - never ask the owner for it.`);
  const analysisToken=token.value;
  const childEnv={...process.env,SONAR_HOST_URL:cfg.host,SONAR_TOKEN:analysisToken};

  const workDir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-sonar-'));
  try{
    const plan=scannerCommand({pkg,props,host:cfg.host,key,workDir});
    const run=await runScanner(cwd,plan,childEnv,Number(options.timeoutSec??1800)*1000);
    summary.scanner={runner:plan.runner,command:scrub(run.display),exitCode:run.exitCode,durationMs:run.durationMs};
    if(options.log){fs.mkdirSync(path.dirname(path.resolve(options.log)),{recursive:true});fs.writeFileSync(options.log,`$ ${scrub(run.display)}\n${run.log}`);summary.scanner.log=path.resolve(options.log);}
    const report=readProperties(path.join(workDir,'report-task.txt'));
    if(!report.ceTaskId){
      const tail=run.log.trim().split(/\r?\n/).slice(-3).join(' | ');
      return finish(/\b401\b|not authori[sz]ed|unauthori[sz]ed/i.test(run.log)?'blocked':'fail',`the scanner submitted no analysis (exit ${run.exitCode}) with ${token.name}: ${tail}`);
    }
    summary.ceTask={id:report.ceTaskId};
    summary.dashboardUrl=report.dashboardUrl??`${cfg.host}/dashboard?id=${encodeURIComponent(key)}`;
    summary.publicDashboardUrl=`${cfg.publicHost}/dashboard?id=${encodeURIComponent(key)}`;
    if(!options.wait)return finish('submitted','scanner submission alone is not a pass; rerun with --wait for the processed quality gate');

    const tokens=[analysisToken,...(admin.present?[admin.value]:[])];
    const deadline=Date.now()+Number(options.waitSec??600)*1000;
    let task;
    for(;;){
      const polled=await read(cfg,tokens,`/api/ce/task?id=${encodeURIComponent(report.ceTaskId)}`);
      task=polled.json?.task;
      if(!polled.reachable||polled.status!==200)return finish('blocked',`compute-engine task ${report.ceTaskId} could not be read: ${polled.error??`HTTP ${polled.status}`}`);
      if(['SUCCESS','FAILED','CANCELED'].includes(task?.status))break;
      if(Date.now()>deadline)return finish('blocked',`compute-engine task ${report.ceTaskId} still ${task?.status} after the wait`);
      await new Promise(r=>setTimeout(r,cfg.pollMs));
    }
    summary.ceTask.status=task.status;
    summary.analysisId=task.analysisId??null;
    if(task.status!=='SUCCESS')return finish('fail',`the server did not process the analysis: ${task.status}${task.errorMessage?` - ${scrub(task.errorMessage)}`:''}`);

    const gate=await read(cfg,tokens,`/api/qualitygates/project_status?analysisId=${encodeURIComponent(task.analysisId)}`);
    const project=gate.json?.projectStatus;
    summary.gate={status:project?.status??null,conditions:(project?.conditions??[]).map(c=>({metric:c.metricKey,status:c.status,actual:c.actualValue,comparator:c.comparator,threshold:c.errorThreshold}))};
    const component=encodeURIComponent(key);
    let issues=await read(cfg,tokens,`/api/issues/search?components=${component}&resolved=false&ps=1&facets=severities,types,impactSeverities`);
    if(issues.status!==200)issues=await read(cfg,tokens,`/api/issues/search?componentKeys=${component}&resolved=false&ps=1&facets=severities,types`);
    if(issues.status===200)summary.issues={total:issues.json?.paging?.total??issues.json?.total??null,bySeverity:facet(issues.json,'severities'),byType:facet(issues.json,'types'),byImpactSeverity:facet(issues.json,'impactSeverities')};
    const hotspots=await read(cfg,tokens,`/api/hotspots/search?projectKey=${component}&status=TO_REVIEW&ps=1`);
    if(hotspots.status===200)summary.hotspots={toReview:hotspots.json?.paging?.total??null};
    const measures=await read(cfg,tokens,`/api/measures/component?component=${component}&metricKeys=coverage,duplicated_lines_density,ncloc`);
    if(measures.status===200)summary.measures=Object.fromEntries((measures.json?.component?.measures??[]).map(m=>[m.metric,m.value]));
    // Sonar way judges new code only: a project's first analysis has none, so the gate is OK with no
    // condition evaluated. That is the server's verdict and stays a pass, but the summary says so.
    if(summary.gate.status==='OK'&&!summary.gate.conditions.length)summary.gate.note='no condition was evaluated (a first analysis has no new code); read the overall measures';
    if(summary.gate.status==='OK')return finish('pass');
    if(summary.gate.status==='ERROR')return finish('fail','the quality gate failed: '+summary.gate.conditions.filter(c=>c.status==='ERROR').map(c=>`${c.metric} ${c.actual} vs ${c.comparator} ${c.threshold}`).join(', '));
    return finish('blocked',`no quality-gate result for the analysis (status ${summary.gate.status??`HTTP ${gate.status}`})`);
  }finally{
    fs.rmSync(workDir,{recursive:true,force:true});
  }
}

// ---- CLI ------------------------------------------------------------------------------------------------

const HELP=`Usage: node scripts/checks/sonar-local.mjs <command> [options]

  status                                  server, container, custody presence and token validity
  ensure-project --key K [--name N]       create the project on the local server when it is missing;
                 [--with-token]           also make sure a project analysis token is in custody
  token [--key K] [-- command args...]    run a command with SONAR_TOKEN and SONAR_HOST_URL in its env;
                                          alone it reports custody presence (never the value)
  scan --cwd REPO [--key K] [--wait]      run the repository scanner against the local server
       [--out FILE.json] [--log FILE.txt] [--token-ref REF] [--no-ensure] [--timeout SEC] [--wait-timeout SEC]

  common: [--cwd REPO] [--declaration FILE] [--host URL] [--stack DIR]
          host, stack, custody and project keys come from the repository's .starcistacks/application-stacks.yaml
          quality.sonar declaration when it has one, else ${DEFAULT_HOST} and the source host's .stacks/dev
Exit 0 pass/up/ok, 1 failing result, 2 blocked or usage.`;

function parseArgs(argv){
  const out={_:[],rest:null};
  for(let i=0;i<argv.length;i++){
    const a=argv[i];
    if(a==='--'){out.rest=argv.slice(i+1);break;}
    if(a==='--wait')out.wait=true;
    else if(a==='--no-ensure')out.ensure=false;
    else if(a==='--with-token')out.withToken=true;
    else if(a==='--help'||a==='-h')out.help=true;
    else if(a.startsWith('--')){
      const [flag,inline]=a.slice(2).split(/=(.*)/s);
      out[flag.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=inline??argv[++i];
    }else out._.push(a);
  }
  return out;
}

const exitFor=outcome=>({up:0,ok:0,pass:0,present:0,submitted:0,disabled:0,fail:1}[outcome]??2);

export async function sonarLocalMain(argv=[],{env=process.env,config}={}){
  const args=parseArgs(argv);
  const command=args._[0];
  if(args.help||!command)return {exitCode:args.help?0:2,text:HELP};
  const cfg=resolveConfig({...config,...(args.host?{host:args.host}:{}),...(args.stack?{stack:args.stack}:{}),...(args.cwd?{cwd:args.cwd}:{}),...(args.declaration?{declaration:args.declaration}:{})},env);
  const key=args.key??cfg.declaredKey??undefined;
  let report;
  if(command==='status')report=await status(cfg);
  else if(command==='ensure-project'){
    report=await ensureProject(cfg,{key,name:args.name??cfg.declaredName});
    if(report.outcome==='ok'&&args.withToken){
      const token=await projectToken(cfg,{key,admin:readCustody(cfg,cfg.adminToken),tokenRef:args.tokenRef});
      report.tokenCustody=custodyView(token);
      if(!token.present)Object.assign(report,{outcome:'blocked',message:`no analysis token for ${key}: ${token.reason}`});
    }
  }else if(command==='token'){
    const child=await sonarEnv(cfg,{key,base:env,mint:Boolean(key)});
    if(!child.ok||!args.rest?.length)report={schema:SCHEMA,command:'token',host:cfg.host,...(key?{projectKey:key}:{}),custody:child.custody,outcome:child.ok?'present':'blocked'};
    else{
      // A shell resolves npm/npx .cmd shims on Windows; each argument is quoted so paths with spaces survive.
      const result=spawnSync(args.rest.map(quote).join(' '),{stdio:'inherit',env:child.env,shell:true,windowsHide:true});
      return {exitCode:result.status??1};
    }
  }else if(command==='scan'){
    report=await scan(cfg,{cwd:args.cwd,key:args.key,wait:args.wait,out:args.out,log:args.log,tokenRef:args.tokenRef,ensure:args.ensure,timeoutSec:args.timeout,waitSec:args.waitTimeout});
    if(args.out){fs.mkdirSync(path.dirname(path.resolve(args.out)),{recursive:true});fs.writeFileSync(args.out,`${scrub(JSON.stringify(report,null,2))}\n`);}
  }else return {exitCode:2,text:`sonar-local: unknown command ${command}\n\n${HELP}`};
  return {exitCode:exitFor(report.outcome),report:JSON.parse(scrub(JSON.stringify(report)))};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  sonarLocalMain(process.argv.slice(2)).then(({exitCode,report,text})=>{
    if(text)process.stdout.write(`${text}\n`);
    if(report)process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
    process.exitCode=exitCode;
  },error=>{process.stderr.write(`sonar-local: ${scrub(error?.stack??error)}\n`);process.exitCode=2;});
}
