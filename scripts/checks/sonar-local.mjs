#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {isPlainObject as plain} from '../../engine/plain-object.mjs';
import {skillRoot} from '../../engine/runtime-root.mjs';
import {parseYaml} from '../../engine/yaml.mjs';
import {safeRemoveTree} from '../lib/safe-remove.mjs';
import {repositoryName,repositoryHome} from '../lib/repo-identity.mjs';
import {resolveCustodyFile,resolveDeclaredRepository,runtimeHostRoot} from '../lib/runtime-host.mjs';
import {braceVariants,globExpression} from '../lib/glob.mjs';
import {posixPath} from '../lib/path-key.mjs';
import { runGit } from '../api/git/lib.mjs';
import { unquoteDiffPath } from '../lib/git.mjs';
import {emitCheckOutput} from './output.mjs';
import {coverageScopeOf,coverageTargetOf,judgeCoverage,judgeDashboard,loadSonarGate,serverConditions,thresholdsOf} from './sonar-gate.mjs';
import {text} from '../lib/stack-declaration.mjs';
import {inspectOwnerConfig,specsSettings} from '../../engine/config.mjs';
import {createRequire} from 'node:module';

/**
 * Product Sonar analysis runs against a LOCAL SonarQube (owner ruling 2026-09-24). Where it is comes from
 * the repository's stack declaration (.starcistacks/application-stacks.yaml `services.sonar`, read by
 * readSonarDeclaration); without one it is the runtime source repository's dev stack: SonarQube at
 * http://localhost:9010 (container starci-sonarqube, compose .starcistacks/dev/infra/compose/sonarqube.yaml),
 * published as https://sonar.starci.org, with the admin token in its custody at
 * .starcistacks/dev/runtime/files/sonarqube-admin-token.key(.enc). Each project scans with its own
 * PROJECT_ANALYSIS_TOKEN at runtime/files/sonarqube-KEY-token.key, minted with the admin token and stored
 * through the stack-secret tool the first time. No op ever asks the owner for a Sonar token or a GitHub
 * setting. A stored token is validated (/api/authentication/validate) before use: one the server rejects
 * (a container and database recreated behind custody - starci-next inc-733bf51f2d75) is re-minted with a
 * valid admin token through the same mint path, stored over the rejected member through the same
 * stack-secret tool, and recorded as a `sonar-token-reminted` Supervisor audit event (machine.sqlite sup_events).
 *
 *   status                                   server, container, custody and token validity
 *   ensure-project --key K [--with-token]    admin token -> create the project (and its token) when missing
 *   token [--key K] [-- command args...]     run a command with SONAR_TOKEN/SONAR_HOST_URL in its env
 *   scan --cwd REPO [--key K] [--wait]       run the repository's scanner against the local server
 *        [--base REV] [--paths P1,P2]        and judge the slice: the lines REV..working tree changed
 *        [--project-gate]                    (inside --paths), not the whole project
 *        [--out summary.json | --blob] [--log scanner.txt] [--no-ensure] [--timeout SECONDS]
 *        [--isolate]
 *   dashboard --cwd REPO [--key K]           the project's dashboard numbers from its last analysis (bugs, code
 *                                            smells, vulnerabilities, hotspots reviewed, coverage and the coverage
 *                                            of every file of the coverage scope), judged by judgeDashboard
 *
 * --cwd takes the repository root; a bare repository name (the brief's <app>) resolves to that
 * directory beside or above the current one, never to <cwd>/<name> (starci-next learn-content
 * op-backend.implement-792d53da0b: `--cwd starci-next` from inside starci-next read
 * D:/Repositories/starci-next/starci-next and was blocked). --isolate analyses the slice alone: the
 * scanner indexes only --paths (sonar.inclusions, and the repository's test patterns under them) into
 * a throwaway project <key>-slice-<hash> scanned with the admin token, judged, then deleted. A whole
 * nivo-backend analysis spent 17-40 minutes (JS/TS sensor over ~5600 files) to judge a 1-5 file slice;
 * the slice verdict reads only the slice's files, so the isolated analysis proves the same verdict.
 * Without the admin token in custody --isolate falls back to the full analysis and says so.
 *
 * The verdict is the slice's own (nivo inc-f92febebbb64). Sonar way judges "new code", and a project
 * with no new-code baseline has the whole project as new code, so no single slice could pass the
 * project's gate while each op may only touch its own paths. A scan therefore evaluates the slice's
 * changed lines through the Web API against the ONE gate in knowledge/sonar-gate.yaml (the thresholds live
 * there and nowhere else; the summary copies them as `gate`): it passes when the slice introduces no open
 * blocker or critical issue and no to-review security hotspot on a line it changed (a line-less one only
 * on a file it added), its duplicated share of the changed source lines is within the duplication
 * threshold (like the server's ignoreSmallChanges, fewer changed lines than the gate's floor are not held to it),
 * and every service it touched (a changed file of the repository's coverage scope, coverageScopeOf) is at the coverage
 * threshold on its own Sonar measure, imported from the be unit run's lcov. Lesser issues are
 * listed on the summary and never fail it. The scan also makes the server's gate of that name carry the
 * same conditions and selects it for the project (`qualityGate` on the summary). The whole-project
 * gate is recorded as `projectGate`, a note that never blocks; --project-gate makes it the verdict.
 * A scan that cannot judge (server down, custody missing) exits 2 and carries `unavailable`: the settle
 * (scripts/kernel/sonar-settle.mjs) records it as the explicit sonar-unavailable why, never as a pass.
 *
 * Secret handling: a token is decrypted from its .enc member with sops and the shared master identity
 * (~/.starci/master.identity, the same identity scripts/stack-secret.mjs uses) straight into memory; the
 * materialized plaintext sibling that `stack-secret show` or `sync` leaves is the fallback. A value is only
 * ever placed in a child process environment or an Authorization header - never on a command line, in a
 * report, a log or an error; every text this module emits passes through scrub().
 *
 * Exit codes: 0 pass / up / ensured / disabled by the declaration, 1 a real failing result (slice
 * verdict fail, scanner failure) or a refused scan (empty slice, unknown
 * base) the op fixes itself, 2 blocked (server down, custody missing, invalid token, usage).
 */
export const SCHEMA='starci/sonar-local@1';
export const SCAN_SCHEMA='starci/sonar-local-scan@3';
export const DEFAULT_HOST='http://localhost:9010';
export const PUBLIC_HOST='https://sonar.starci.org';
export const CONTAINER='starci-sonarqube';
export const ADMIN_TOKEN='sonarqube-admin-token.key';
export const ANALYSIS_TOKEN='sonarqube-analysis-token.txt';
/** The Supervisor audit event (sup_events) a re-mint of a token the server rejected records. */
export const REMINT_EVENT='sonar-token-reminted';
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

/** The source host's dev stack - the stack the repository hosting this runtime runs: <host>/.starcistacks/dev. */
export function sourceHostStackDir(){
  return path.join(runtimeHostRoot(),'.starcistacks','dev');
}

const DECLARATION='application-stacks.yaml';


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
  const name=repositoryName(repo);
  let siblings=[];
  try{siblings=fs.readdirSync(path.dirname(repositoryHome(repo)),{withFileTypes:true}).filter(e=>e.isDirectory()&&e.name!==name);}catch{/* no parent listing */}
  for(const entry of siblings){
    const file=path.join(path.dirname(repositoryHome(repo)),entry.name,'.starcistacks',DECLARATION);
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
 *   stack - the stack that runs a local server: the project form {repository, root: .starcistacks,
 *     environment, compose, container} resolved under that repository's checkout, or the host form
 *     {owner: host, root: .claude/ext/<service>, environment, compose, container} resolved inside this
 *     runtime tree (`environment` names the slot the extension serves, never a path segment); the
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
  // A named repository resolves by identity (scripts/lib/runtime-host.mjs): the declaring repository, the runtime host or a
  // sibling checkout; one not checked out here is named where its sibling checkout would be, so its custody reads as missing.
  const repoDir=name=>!name?repoRoot:resolveDeclaredRepository(name,{fromRepo:repoRoot})??path.join(path.dirname(repositoryHome(repoRoot)),name);
  let stackDir=null,composeFile=null,container=null;
  if(plain(sonar.stack)){
    const stack=sonar.stack;
    const compose=text(stack.compose);
    if(text(stack.owner)==='host'){
      // The host form lives in this runtime tree (.claude/ext/<service>), not in the declaring
      // repository (check-starcistacks.mjs normalizeService resolves it the same way).
      const root=text(stack.root)?.replace(/\\/g,'/');
      stackDir=root&&/^\.claude\/ext\/[a-z][a-z0-9-]*$/.test(root)?path.join(skillRoot,root.slice('.claude/'.length)):null;
      if(compose&&stackDir)composeFile=path.join(stackDir,compose);
    }else{
      const dir=repoDir(text(stack.repository));
      stackDir=path.join(dir,text(stack.root)??'.starcistacks',text(stack.environment)??'dev');
      if(compose)composeFile=/^\.starcistacks[\\/]/.test(compose)?path.join(dir,compose):path.resolve(stackDir,compose);
    }
    container=text(stack.container);
  }else if(text(sonar.stack)&&sonar.stack!=='source-host')stackDir=path.join(repoRoot,'.starcistacks',sonar.stack);
  const projects=(Array.isArray(sonar.projects)?sonar.projects.filter(plain).map(p=>({repository:text(p.repository),key:text(p.key),name:text(p.name)}))
    :plain(sonar.projects)?Object.entries(sonar.projects).map(([repository,v])=>({repository,key:text(v)??text(v?.key),name:text(v?.name)})):[]).filter(p=>p.key);
  const credentials=(Array.isArray(sonar.credentials)?sonar.credentials:[]).filter(plain).map(c=>({id:text(c.id)??'',env:text(c.env),purpose:text(c.purpose)??'',
    file:resolveCustodyFile(repoDir(text(c.custody?.repository)),text(c.custody?.path))})).filter(c=>c.file);
  const isAdmin=c=>/admin/i.test(c.id)||/admin/i.test(path.basename(c.file));
  const analysis=credentials.filter(c=>!isAdmin(c)&&(!c.env||c.env==='SONAR_TOKEN'));
  // A project's analysis token: the credential that names the project, else the one declared credential whose purpose is
  // analysis (the declaration says what it is for; a name that matches nothing never guesses).
  const forAnalysis=analysis.filter(c=>/\banalysis\b/i.test(c.purpose));
  const forProject=key=>analysis.find(c=>c.id.includes(key)||path.basename(c.file).includes(key))?.file??(forAnalysis.length===1?forAnalysis[0].file:null);
  for(const p of projects)p.tokenRef=forProject(p.key);
  return {
    file,repoRoot,
    provider:text(sonar.provider)??'sonarqube',
    mode:text(sonar.mode)??'local',
    reason:text(sonar.reason),
    stackDir,composeFile,container,
    hostLocal:text(sonar.host?.local),
    hostPublic:text(sonar.host?.public),
    qualityGate:text(sonar.qualityGate),
    projects,
    admin:credentials.find(isAdmin)?.file??null,
    analysis:analysis.find(c=>!projects.some(p=>p.tokenRef===c.file))?.file??null,
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
  const repository=options.cwd?repositoryName(path.resolve(options.cwd)):null;
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
    record:options.record??null,
    adminToken:options.adminToken??decl?.admin??`runtime/files/${ADMIN_TOKEN}`,
    analysisToken:options.analysisToken??decl?.analysis??`runtime/files/${ANALYSIS_TOKEN}`,
    declaredQualityGate:decl?.qualityGate??null,
    declaredKey:project?.key??null,
    declaredName:project?.name??null,
    declaredTokenRef:project?.tokenRef??null,
    disabled:decl?.mode==='disabled'?(decl.reason??'the stack declaration disables Sonar'):null,
    declaration:decl?{file:decl.file,provider:decl.provider,mode:decl.mode,projects:decl.projects.map(p=>p.key),ci:decl.ci?.wiring??null,ownerAction:decl.ownerAction}:(declarationError?{error:declarationError}:null),
    // specs: the owner's product-test switches ({unit}); null reads config.yaml `specs` per scan. coverageRunner: the
    // function that writes the slice's lcov (runSliceCoverage); a spec passes its own.
    specs:options.specs??null,
    coverageRunner:options.coverageRunner??null,
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
  // resolved from its repository root) must still sit inside a custody tree - a repository's
  // .starcistacks or a runtime's extension tree (.claude/ext/<service>, or this runtime's own ext/ when it is a
  // lane worktree, where a host custody path resolves - scripts/lib/runtime-host.mjs resolveCustodyFile).
  const plainFile=path.resolve(cfg.stackDir,ref);
  const name=String(ref).replace(/\\/g,'/');
  const inside=path.isAbsolute(String(ref))
    ?/[\\/]\.starcistacks[\\/]/.test(plainFile)||/[\\/]\.claude[\\/]ext[\\/]/.test(plainFile)||plainFile.startsWith(path.join(skillRoot,'ext')+path.sep)
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
        env:{...process.env,SOPS_AGE_KEY_FILE:cfg.identity},maxBuffer:1024*1024,timeout:cfg.timeoutMs});
      const value=result.status===0?String(result.stdout??'').trim():'';
      if(value)return {present:true,value:remember(value),via:'sops',name};
      reasons.push(result.error?.code==='ETIMEDOUT'?`sops did not decrypt ${name}.enc within ${cfg.timeoutMs}ms`:result.error?`sops failed to start: ${result.error.code??result.error.message}`:`sops could not decrypt ${name}.enc (exit ${result.status})`);
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
const custodyView=entry=>({name:entry.name,present:entry.present,...(entry.via?{via:entry.via}:{}),...(entry.reminted?{reminted:true}:{}),
  ...(entry.rejected?{rejected:true}:{}),...(entry.reason?{reason:entry.reason}:{})});

/** The custody member a minted project analysis token lives in: runtime/files/sonarqube-KEY-token.key. */
export const projectTokenRef=key=>`runtime/files/sonarqube-${String(key).replace(/[^A-Za-z0-9_.-]/g,'_')}-token.key`;

/** The .starcistacks root a custody member resolves into - the tree a stack-secret tool manages. */
const stackRootOf=file=>{
  const at=/[\\/]\.starcistacks(?=[\\/]|$)/.exec(file);
  return at?file.slice(0,at.index+at[0].length):null;
};

/**
 * Store a value as an encrypted custody member through the stack's own tool (scripts/stack-secret.mjs of the
 * repository whose .starcistacks holds the member). An absolute reference (a declaration credential
 * resolved from its repository root) names that tree directly - a project token minted into the declaring
 * repository while the sonar stack itself is the host extension; a relative one stays a member of the
 * configured stack. Host-extension custody (.claude/ext) has no stack-secret tool: minting there is refused
 * and mintToken revokes the value again. The value travels through a 0600 temp file only - never argv.
 */
function writeCustody(cfg,ref,value){
  const file=path.resolve(cfg.stackDir,ref);
  const managed=path.isAbsolute(String(ref))?stackRootOf(file):path.dirname(cfg.stackDir);
  const stacksRoot=managed??path.dirname(cfg.stackDir);
  const tool=cfg.stackSecret??path.join(path.dirname(stacksRoot),'scripts','stack-secret.mjs');
  if((!managed||path.basename(managed)!=='.starcistacks')&&!cfg.stackSecret)
    return {ok:false,reason:`the custody member ${ref} is not under a .starcistacks tree a stack-secret tool manages`};
  if(!fs.existsSync(tool))return {ok:false,reason:`no stack-secret tool at ${tool}`};
  const target=path.relative(stacksRoot,file).replace(/\\/g,'/');
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
 * Does the server accept this token? true, false (401/403, or validate answering valid:false) or null when
 * the server could not be asked (unreachable, another status) - an unknown answer never discards a token.
 */
export async function tokenAccepted(cfg,value){
  const check=await call(cfg,'GET','/api/authentication/validate',{token:value});
  if(check.status===200)return check.json?.valid===true;
  if(check.status===401||check.status===403)return false;
  return null;
}

/** A custody reference writeCustody may store over: a member of the configured stack, or an absolute
 *  declaration credential inside a repository's .starcistacks tree (host-extension custody is not). */
const inStack=(cfg,ref)=>{
  const file=path.resolve(cfg.stackDir,ref);
  if(!path.isAbsolute(String(ref))&&!file.startsWith(cfg.stackDir+path.sep))return false;
  return stackRootOf(file)!==null;
};

/**
 * The one mint path: the admin token generates a token of `type` (for `projectKey` when given) and the
 * stack-secret tool stores it encrypted at `ref`; a value that cannot be stored is revoked again.
 */
async function mintToken(cfg,{admin,ref,type,projectKey=null,label}){
  const name=`sonar-local-${label}-${Date.now().toString(36)}`.slice(0,100);
  const generated=await call(cfg,'POST','/api/user_tokens/generate',{token:admin.value,form:{name,type,...(projectKey?{projectKey}:{})}});
  const value=generated.status===200?remember(String(generated.json?.token??'')):'';
  if(!value)return {present:false,name:ref,reason:`token generate for ${label} failed: HTTP ${generated.status} ${generated.text??generated.error??''}`};
  const stored=writeCustody(cfg,ref,value);
  if(stored.ok)return {present:true,value,via:'minted',name:ref,minted:name};
  await call(cfg,'POST','/api/user_tokens/revoke',{token:admin.value,form:{name}});
  return {present:false,name:ref,reason:`minted ${name} but could not store it (${stored.reason}); revoked it`};
}

/**
 * One Supervisor audit event (machine.sqlite sup_events) per re-mint; never a value. cfg.record replaces the
 * store, and a spec run (NODE_TEST_CONTEXT) never writes it without one.
 */
async function recordRemint(cfg,event){
  const payload={...event,host:cfg.host,stack:cfg.stackDir};
  try{
    if(typeof cfg.record==='function')return void cfg.record({kind:REMINT_EVENT,payload});
    if(process.env.NODE_TEST_CONTEXT)return;
    const {withSupervisor,supervisorEvent}=await import('../supervisor/home.mjs');
    withSupervisor(m=>supervisorEvent(m,{entityType:'service',entityId:'sonar',kind:REMINT_EVENT,payload}));
  }catch{/* the repaired custody stands without its event */}
}

/**
 * Read custody members in order and return the first the server accepts. A member it rejects is skipped
 * and returned as `stale` (the first one), so the caller re-mints over it.
 */
async function firstAccepted(cfg,refs){
  const misses=[];
  let stale=null;
  for(const ref of refs){
    const entry=readCustody(cfg,ref);
    if(!entry.present){misses.push(entry.reason);continue;}
    const accepted=await tokenAccepted(cfg,entry.value);
    if(accepted!==false)return {entry:{...entry,accepted},misses,stale};
    stale??=entry;
    misses.push(`${entry.name} is rejected by the server (stale custody)`);
  }
  return {entry:null,misses,stale};
}

/**
 * The generic analysis token (cfg.analysisToken). One the server rejects is re-minted as a
 * GLOBAL_ANALYSIS_TOKEN over the same member when a valid admin token is at hand.
 */
export async function genericToken(cfg,{admin=null}={}){
  const {entry,misses,stale}=await firstAccepted(cfg,[cfg.analysisToken]);
  if(entry)return entry;
  if(stale&&admin?.present&&inStack(cfg,stale.name)){
    const minted=await mintToken(cfg,{admin,ref:stale.name,type:'GLOBAL_ANALYSIS_TOKEN',label:'analysis'});
    if(minted.present){
      await recordRemint(cfg,{role:'analysis',ref:stale.name,minted:minted.minted,type:'GLOBAL_ANALYSIS_TOKEN'});
      return {...minted,reminted:true};
    }
    misses.push(minted.reason);
  }
  return {present:false,name:cfg.analysisToken,...(stale?{rejected:true}:{}),reason:misses.filter(Boolean).join('; ')};
}

/**
 * The analysis token for one project. Order: an explicit custody reference, the declaration's reference
 * for the project, the minted member projectTokenRef(key) - the first the server accepts. When none is
 * accepted and minting is allowed, the admin token generates a PROJECT_ANALYSIS_TOKEN for the project and
 * the stack-secret tool stores it encrypted over the member the server rejected (a re-mint, recorded as a
 * sonar-token-reminted event) or at projectTokenRef(key) when none existed. The source stack's generic
 * analysis token is the last resort - on this server it is itself scoped to one project.
 */
export async function projectToken(cfg,{key,admin,tokenRef,mint=true}={}){
  const refs=[tokenRef,cfg.declaredTokenRef,key?projectTokenRef(key):null].filter(Boolean);
  const {entry,misses,stale}=await firstAccepted(cfg,refs);
  if(entry)return entry;
  if(key&&mint&&admin?.present){
    // Over the member the server rejected when it can be written; else the declaration's own custody
    // reference for the project (a product repository's .starcistacks while the sonar stack is the host
    // extension), else the conventional member of the configured stack.
    const ref=stale&&inStack(cfg,stale.name)?stale.name
      :inStack(cfg,cfg.declaredTokenRef??'')?cfg.declaredTokenRef
      :projectTokenRef(key);
    const minted=await mintToken(cfg,{admin,ref,type:'PROJECT_ANALYSIS_TOKEN',projectKey:key,label:key});
    if(minted.present){
      if(!stale)return minted;
      await recordRemint(cfg,{role:'project',projectKey:key,ref,minted:minted.minted,type:'PROJECT_ANALYSIS_TOKEN'});
      return {...minted,reminted:true};
    }
    misses.push(minted.reason);
  }
  const fallback=await genericToken(cfg,{admin:mint?admin:null});
  if(fallback.present)return {...fallback,note:'generic analysis token (project-scoped on this server)'};
  return {present:false,name:refs.at(-1)??cfg.analysisToken,...(stale?{rejected:true}:{}),reason:[...misses,fallback.reason].filter(Boolean).join('; ')};
}

/** The env a Sonar child process gets: local host plus the project's (or generic) analysis token. */
export async function sonarEnv(cfg,{key,base=process.env,mint=false}={}){
  const admin=mint?readCustody(cfg,cfg.adminToken):null;
  const token=key?await projectToken(cfg,{key,admin,mint}):await genericToken(cfg,{admin});
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
  const admin=readCustody(cfg,cfg.adminToken);
  tokens.admin=custodyView(admin);
  if(admin.present&&up)tokens.admin.valid=await tokenAccepted(cfg,admin.value)===true;
  // A generic analysis token the server rejects is re-minted here when the admin token is valid.
  const analysis=up?await genericToken(cfg,{admin:tokens.admin.valid?admin:null}):readCustody(cfg,cfg.analysisToken);
  tokens.analysis=custodyView(analysis);
  if(up&&(analysis.present||analysis.rejected))tokens.analysis.valid=analysis.via==='minted'||analysis.accepted===true;
  const report={schema:SCHEMA,command:'status',host:cfg.host,publicHost:cfg.publicHost,stack:cfg.stackDir,declaration:cfg.declaration,
    server:{reachable:server.reachable,up,...(server.json?.status?{status:server.json.status}:{}),...(server.json?.version?{version:server.json.version}:{}),...(server.error?{error:server.error}:{})},
    docker,custody:tokens};
  if(!up){report.outcome='down';report.message=server.reachable&&server.status===200?`SonarQube at ${cfg.host} answers but reports ${server.json?.status??'unknown'}; wait until it is UP.`:downMessage(cfg,server,docker);}
  else if(!tokens.analysis.present||tokens.analysis.valid===false){report.outcome='blocked';report.message=`the analysis token is ${tokens.analysis.present||tokens.analysis.rejected?'rejected by the server':'missing from custody'} (${tokens.analysis.name}); repair the source stack custody (secret:gen / stack-secret) - never ask the owner for it.`;}
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

/**
 * Make the server's quality gate named by knowledge/sonar-gate.yaml carry exactly its conditions, select it for
 * the project and fix the project's new-code period. Idempotent: a matching gate is left as it is. A failure
 * here is reported on the summary (`qualityGate.outcome`) and never changes the slice verdict, which is judged
 * from the same file; the server gate is what the dashboard and CI show.
 */
export async function ensureQualityGate(cfg,{key,admin,gate=loadSonarGate()}={}){
  const name=gate.gate.name;
  const base={name,projectKey:key,conditions:serverConditions(gate).length};
  if(!admin?.present)return {...base,outcome:'skipped',message:'admin token not in custody'};
  const token=admin.value;
  const failed=(step,answer)=>({...base,outcome:'failed',message:`${step}: HTTP ${answer.status||0} ${answer.text??answer.error??''}`.trim()});
  const encoded=encodeURIComponent(name);
  let shown=await call(cfg,'GET',`/api/qualitygates/show?name=${encoded}`,{token});
  if(shown.status===404||(shown.status===400&&/not found|does not exist/i.test(String(shown.text??'')))){
    const created=await call(cfg,'POST','/api/qualitygates/create',{token,form:{name}});
    if(created.status!==200&&created.status!==201)return failed('create gate',created);
    shown=await call(cfg,'GET',`/api/qualitygates/show?name=${encoded}`,{token});
  }
  if(shown.status!==200)return failed('show gate',shown);
  const have=new Map((shown.json?.conditions??[]).map(c=>[c.metric,c]));
  const want=serverConditions(gate);
  const changed=[];
  for(const condition of want){
    const current=have.get(condition.metric);
    if(current&&current.op===condition.op&&String(current.error)===condition.error)continue;
    const answer=current
      ?await call(cfg,'POST','/api/qualitygates/update_condition',{token,form:{id:current.id,metric:condition.metric,op:condition.op,error:condition.error}})
      :await call(cfg,'POST','/api/qualitygates/create_condition',{token,form:{gateName:name,metric:condition.metric,op:condition.op,error:condition.error}});
    if(answer.status!==200&&answer.status!==201&&answer.status!==204)return failed(`condition ${condition.metric}`,answer);
    changed.push(condition.metric);
  }
  const wanted=new Set(want.map(c=>c.metric));
  for(const current of have.values()){
    if(wanted.has(current.metric))continue;
    const answer=await call(cfg,'POST','/api/qualitygates/delete_condition',{token,form:{id:current.id}});
    if(answer.status!==200&&answer.status!==204)return failed(`drop condition ${current.metric}`,answer);
    changed.push(`-${current.metric}`);
  }
  const selected=await call(cfg,'POST','/api/qualitygates/select',{token,form:{gateName:name,projectKey:key}});
  if(selected.status!==200&&selected.status!==204)return failed('select gate',selected);
  const period=gate.gate.newCodePeriod;
  const periodSet=period?await call(cfg,'POST','/api/new_code_periods/set',{token,form:{project:key,type:period.type,value:String(period.value)}}):null;
  if(periodSet&&periodSet.status!==200&&periodSet.status!==204)return failed('new-code period',periodSet);
  return {...base,outcome:'ok',changed};
}

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
export function scannerCommand({pkg,props,host,key,workDir,extra=[]}){
  const defines=[`-Dsonar.host.url=${host}`,`-Dsonar.working.directory=${workDir}`];
  if(key&&props['sonar.projectKey']!==key)defines.push(`-Dsonar.projectKey=${key}`);
  defines.push(...extra);
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

const git=(cwd,args)=>runGit(['-c','core.quotepath=off',...args],{cwd,maxBuffer:64*1024*1024});

function gitRevision(cwd){
  const head=git(cwd,['log','-1','--format=%H %ct','HEAD']);
  if(head.status!==0)return {commit:null};
  const [commit,seconds]=head.stdout.trim().split(' ');
  const dirty=git(cwd,['status','--porcelain','--untracked-files=no']);
  return {commit,committedAt:new Date(Number(seconds)*1000).toISOString(),dirty:dirty.status===0?dirty.stdout.trim().length>0:null};
}

// ---- the slice ------------------------------------------------------------------------------------------

const unquote=unquoteDiffPath;

/**
 * The new-side line ranges of a `git diff -U0` patch: [{path, added, ranges: [[from, to], ...]}]. A deleted
 * file is dropped; a rename or mode change without a hunk keeps its path with no range. Header lines are
 * only read before a file's first hunk, so a removed line that starts with "-- " is never a header.
 */
export function parseDiffNewLines(patch){
  const files=[];
  let current=null,header=false;
  for(const line of String(patch??'').split(/\r?\n/)){
    if(line.startsWith('diff --git ')){current={path:null,added:false,deleted:false,ranges:[]};files.push(current);header=true;continue;}
    if(!current)continue;
    if(line.startsWith('@@')){
      header=false;
      const hunk=/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
      const start=Number(hunk?.[1]),count=hunk?.[2]===undefined?1:Number(hunk[2]);
      if(hunk&&count>0)current.ranges.push([start,start+count-1]);
      continue;
    }
    if(!header)continue;
    if(line.startsWith('new file mode'))current.added=true;
    else if(line==='--- /dev/null')current.added=true;
    else if(line==='+++ /dev/null')current.deleted=true;
    else if(line.startsWith('+++ '))current.path=unquote(line.slice(4)).replace(/^b\//,'');
    else if(line.startsWith('rename to '))current.path??=unquote(line.slice(10));
  }
  return files.filter(f=>f.path&&!f.deleted).map(({path:file,added,ranges})=>({path:file,added,ranges}));
}

export const inRanges=(ranges,from,to=from)=>ranges.some(([a,b])=>from<=b&&to>=a);

const splitList=value=>(Array.isArray(value)?value:[value]).flatMap(v=>String(v??'').split(',')).map(v=>v.trim()).filter(Boolean);

/**
 * What the slice changed: the lines between --base (default HEAD) and the working tree the scanner
 * reads, inside --paths when given, plus untracked files there (every line new). Paths are relative
 * to cwd, the scanner's project base directory.
 */
export function sliceChanges(cwd,{base,paths}={}){
  const scope=splitList(paths);
  const baseRef=base||'HEAD';
  const resolved=git(cwd,['rev-parse','--verify','--quiet',`${baseRef}^{commit}`]);
  if(resolved.error||(resolved.status!==0&&git(cwd,['rev-parse','--git-dir']).status!==0))return {ok:false,code:'SLICE_NOT_GIT',reason:`${cwd} is not a git checkout, so the slice cannot be read`};
  if(resolved.status!==0)return {ok:false,code:'SLICE_BASE_UNKNOWN',reason:`the slice base ${baseRef} is not a commit in ${cwd}`};
  const pathspec=scope.length?['--',...scope]:[];
  const collect=commit=>{
    const diff=git(cwd,['diff','--no-color','--no-ext-diff','--no-textconv','-U0','-M','--relative','--src-prefix=a/','--dst-prefix=b/',commit,...pathspec]);
    if(diff.status!==0)return {error:String(diff.stderr).trim().split(/\r?\n/)[0]};
    const files=parseDiffNewLines(diff.stdout);
    const untracked=git(cwd,['ls-files','--others','--exclude-standard','-z',...pathspec]);
    for(const file of String(untracked.stdout??'').split('\0').filter(Boolean)){
      if(files.some(f=>f.path===file))continue;
      let lines=0;
      try{const body=fs.readFileSync(path.join(cwd,file),'utf8');lines=body.split(/\r?\n/).length-(body.endsWith('\n')?1:0);}catch{/* unreadable */}
      files.push({path:file,added:true,untracked:true,ranges:lines>0?[[1,lines]]:[]});
    }
    return {files};
  };
  const baseCommit=resolved.stdout.trim();
  const first=collect(baseCommit);
  if(first.error)return {ok:false,code:'SLICE_NOT_GIT',reason:`git diff against ${baseRef} failed: ${first.error}`};
  let {files}=first,used=baseCommit,baseFallback=null;
  // An attempt that authored no delta of its own (its slice was committed by an earlier attempt, so the base the op
  // recorded is HEAD) read as SLICE_EMPTY and left backend.implement red in ops (nivo, 2 of 5 scans). The slice is then
  // what the branch carries inside --paths beyond its merge-base with the trunk: the same code the gate has to judge.
  if(!files.length&&git(cwd,['rev-parse','--verify','--quiet','HEAD']).stdout.trim()===baseCommit){
    for(const ref of ['@{upstream}','origin/main','main','origin/master','master']){
      const mergeBase=git(cwd,['merge-base','HEAD',ref]);
      const sha=mergeBase.status===0?mergeBase.stdout.trim():'';
      if(!sha||sha===baseCommit)continue;
      const alt=collect(sha);
      if(alt.files?.length){files=alt.files;used=sha;baseFallback={requested:baseRef,merged:ref,baseCommit:sha,reason:'the attempt changed nothing after its recorded base; the slice is the branch delta since its merge-base with the trunk'};break;}
    }
  }
  return {ok:true,base:baseRef,baseCommit:used,paths:scope,files,...(baseFallback?{baseFallback}:{})};
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

const PAGE=500,MAX_PAGES=40,ITEM_CAP=50,ISSUE_BATCH=25;
const tally=(items,field)=>items.reduce((out,item)=>{const k=item[field]??'unknown';out[k]=(out[k]??0)+1;return out;},{});

/** Every page of a paged Web API list, or {error} when a page cannot be read. */
async function readAll(cfg,tokens,pathname,listKey){
  const items=[];
  for(let page=1;page<=MAX_PAGES;page++){
    const got=await read(cfg,tokens,`${pathname}${pathname.includes('?')?'&':'?'}ps=${PAGE}&p=${page}`);
    if(!got.reachable||got.status!==200)return {items,error:got.error??`HTTP ${got.status} ${got.text??''}`.trim(),status:got.status};
    const batch=got.json?.[listKey]??[];
    items.push(...batch);
    const total=got.json?.paging?.total??got.json?.total??items.length;
    if(!batch.length||items.length>=total)break;
  }
  return {items};
}

// SonarQube path patterns (sonar.test.inclusions) are the scripts/lib/glob.mjs subset
// ESLint and the runtime's own path globs match with: ** spans directories, * and ? stay inside
// one segment, {a,b} alternates.

/**
 * The qualifier the scanner gave a file, by the project's test-path rule: under a sonar.tests root,
 * matching sonar.test.inclusions when declared and no sonar.test.exclusions, it is a unit test (UTS);
 * every other indexed file is FIL. A -Dsonar.* define on the repository's sonar:check script wins over
 * sonar-project.properties, the same order the scanner applies. issues/search answers HTTP 400 when one
 * component list mixes qualifiers (inc-0fee2b8fb296), so the slice's keys are grouped by it.
 */
export function fileQualifier(props={},pkg=null){
  const defined=Object.fromEntries(String(pkg?.scripts?.['sonar:check']??'').matchAll(/-D([\w.]+)=([^\s"']+)/g).map(m=>[m[1],m[2]]));
  const setting=name=>splitList(defined[name]??props[name]);
  const roots=setting('sonar.tests').map(root=>posixPath(root).replace(/\/+$/,'')).filter(Boolean);
  if(!roots.length)return ()=>'FIL';
  const inclusions=setting('sonar.test.inclusions').flatMap(braceVariants).map(globExpression);
  const exclusions=setting('sonar.test.exclusions').flatMap(braceVariants).map(globExpression);
  return file=>{
    const rel=posixPath(file);
    return roots.some(root=>rel===root||rel.startsWith(`${root}/`))
      &&(!inclusions.length||inclusions.some(pattern=>pattern.test(rel)))
      &&!exclusions.some(pattern=>pattern.test(rel))?'UTS':'FIL';
  };
}

/**
 * One issues/search over component keys of one qualifier: `components` (componentKeys on servers
 * before 10.2). When a batch still fails the same-qualifier check - the test-path rule disagreed with
 * the scanner's own detection - it is asked one key at a time: a single key can never mix.
 */
async function sliceIssues(cfg,tokens,keys){
  const batch=keys.map(encodeURIComponent).join(',');
  let got=await readAll(cfg,tokens,`/api/issues/search?components=${batch}&resolved=false`,'issues');
  if(got.error&&got.status===400)got=await readAll(cfg,tokens,`/api/issues/search?componentKeys=${batch}&resolved=false`,'issues');
  if(got.error&&got.status===400&&keys.length>1&&/same qualifier/i.test(got.error)){
    const items=[];
    for(const key of keys){const single=await sliceIssues(cfg,tokens,[key]);if(single.error)return single;items.push(...single.items);}
    return {items};
  }
  return got;
}

/** The lines of `fileKey` that lie in a duplicated block, from an api/duplications/show answer. */
export function duplicatedLinesOf(doc,fileKey){
  const refs=Object.entries(doc?.files??{}).filter(([,file])=>file?.key===fileKey).map(([ref])=>String(ref));
  const lines=new Set();
  for(const duplication of doc?.duplications??[])for(const block of duplication?.blocks??[]){
    if(!refs.includes(String(block?._ref)))continue;
    for(let line=Number(block.from);line<Number(block.from)+Number(block.size);line+=1)lines.add(line);
  }
  return lines;
}

/**
 * The be unit run over the slice's services alone, writing the lcov Sonar imports: jest from the directory two levels above
 * the lcov report (`be/coverage/lcov.info` -> be/, the preset's coverageDirectory under its rootDir), the unit project, the
 * specs related to `files` and coverage collected from `files` only, so the per-file threshold and the report name exactly
 * the services the slice touched. Returns {exitCode, error}.
 */
export function runSliceCoverage({jestCwd,files,timeoutMs=900_000}){
  let bin;
  try{bin=createRequire(path.join(jestCwd,'package.json')).resolve('jest/bin/jest.js');}
  catch{return {exitCode:null,error:`jest is not installed under ${posixPath(jestCwd)}`};}
  const collect=files.flatMap(file=>['--collectCoverageFrom',file]);
  const run=spawnSync(process.execPath,[bin,'--selectProjects','unit','--coverage','--ci','--coverageReporters','lcov',...collect,'--findRelatedTests',...files],{cwd:jestCwd,encoding:'utf8',windowsHide:true,timeout:timeoutMs,maxBuffer:64*1024*1024});
  return {exitCode:run.status,error:run.error?String(run.error.message):null};
}

/**
 * Before a slice scan: the services the slice touched (changed files of the coverage scope) get a fresh lcov at
 * sonar.javascript.lcov.reportPaths, written by the be unit run over their related specs (cfg.coverageRunner, default
 * runSliceCoverage), so Sonar imports this slice's coverage and never a stale report. With the owner's specs.unit off
 * (config.yaml `specs`, scripts/kernel/spec-deferral.mjs) the op writes no unit test and is held to no coverage: nothing
 * runs and the slice's coverage is not judged (`judged` false). Returns {judged, targets, lcov, exitCode?, written?, error?, note?}.
 */
/** What a slice summary says while the owner's specs.unit is off: its coverage is not measured, never read as green. */
export const OWNER_MODE_NOTE='owner mode specs.unit=false (config.yaml specs): the slice wrote and ran no unit test, so its coverage is NOT MEASURED - the coverage conditions are neither green nor red, and the slice passes on the other conditions only';

export function prepareSliceCoverage(cfg,{cwd,props,slice}){
  const scope=coverageScopeOf(props);
  if(!scope.exclusions.length)return {judged:true,targets:[],note:'the repository declares no sonar.coverage.exclusions'};
  const specs=cfg.specs??specsSettings(inspectOwnerConfig().config);
  if(specs.unit===false)return {judged:false,targets:[],ownerMode:'specs.unit=false',note:OWNER_MODE_NOTE};
  const isTarget=coverageTargetOf(scope);
  const targets=slice.files.map(f=>f.path).filter(file=>isTarget(file)&&fs.existsSync(path.join(cwd,file)));
  if(!targets.length)return {judged:true,targets};
  const lcov=String(props['sonar.javascript.lcov.reportPaths']??'').split(',').map(p=>p.trim()).filter(Boolean)[0];
  if(!lcov)return {judged:true,targets,error:'sonar-project.properties names no sonar.javascript.lcov.reportPaths: the coverage of the slice\'s services cannot be imported'};
  const jestCwd=path.resolve(cwd,path.dirname(path.dirname(lcov)));
  const lcovFile=path.resolve(cwd,lcov);
  fs.rmSync(lcovFile,{force:true});
  const relative=targets.map(file=>posixPath(path.relative(jestCwd,path.join(cwd,file))));
  const ran=(cfg.coverageRunner??runSliceCoverage)({jestCwd,files:relative});
  const written=fs.existsSync(lcovFile);
  return {judged:true,targets,lcov,exitCode:ran.exitCode??null,written,
    ...(ran.error||!written?{error:ran.error??`the unit run (exit ${ran.exitCode}) wrote no ${lcov}`}:{})};
}

/** The Sonar `coverage` measure of one file, a number or null when Sonar holds none; {error} when the server cannot answer. */
async function fileCoverage(cfg,tokens,fileKey){
  const got=await read(cfg,tokens,`/api/measures/component?component=${encodeURIComponent(fileKey)}&metricKeys=coverage`);
  if(got.status===404)return {coverage:null};
  if(!got.reachable||got.status!==200)return {error:got.error??`HTTP ${got.status}`};
  return {coverage:(got.json?.component?.measures??[]).find(m=>m.metric==='coverage')?.value??null};
}

/**
 * Judge the slice on the processed analysis against `gate` (thresholdsOf(knowledge/sonar-gate.yaml)): open
 * blocker and critical issues and to-review hotspots on its changed lines (a line-less one only on a file
 * it added), the duplicated share of its changed source lines, and the coverage of every service it touched
 * (a changed file of the coverage scope of `props`, coverageScopeOf; any other file is not a coverage target).
 * A changed file the server does not know (excluded, not source) is listed as not analyzed.
 */
export async function evaluateSlice(cfg,tokens,{key,slice,props={},pkg=null,gate=thresholdsOf(loadSonarGate()),coverageRun=null}){
  const qualifierOf=fileQualifier(props,pkg);
  const files=slice.files.filter(f=>f.ranges.length||f.added);
  const analyzed=new Map(),notAnalyzed=[];
  let changedSourceLines=0;
  for(const file of files){
    const fileKey=`${key}:${file.path}`;
    const from=file.ranges.length?Math.min(...file.ranges.map(r=>r[0])):1;
    const to=file.ranges.length?Math.max(...file.ranges.map(r=>r[1])):1;
    const lines=await read(cfg,tokens,`/api/sources/lines?key=${encodeURIComponent(fileKey)}&from=${from}&to=${to}`);
    if(lines.status===404){notAnalyzed.push(file.path);continue;}
    if(!lines.reachable||lines.status!==200)return {error:`source lines of ${file.path} could not be read: ${lines.error??`HTTP ${lines.status}`}`};
    analyzed.set(fileKey,file);
    if(qualifierOf(file.path)==='FIL')changedSourceLines+=file.ranges.reduce((n,[a,b])=>n+(b-a+1),0);
  }
  const onSlice=(item,component)=>{
    const file=analyzed.get(component);
    if(!file)return false;
    const from=item.textRange?.startLine??item.line;
    if(from===undefined||from===null)return file.added;
    return inRanges(file.ranges,Number(from),Number(item.textRange?.endLine??from));
  };
  const keys=[...analyzed.keys()];
  // issues/search refuses one list mixing qualifiers: spec files (UTS) are asked apart from sources
  // (FIL), in the same 25-key batches, and the results merge (inc-0fee2b8fb296).
  const groups=new Map();
  for(const fileKey of keys){
    const qualifier=qualifierOf(analyzed.get(fileKey).path);
    if(!groups.has(qualifier))groups.set(qualifier,[]);
    groups.get(qualifier).push(fileKey);
  }
  const issues=[];
  for(const group of groups.values()){
    for(let i=0;i<group.length;i+=ISSUE_BATCH){
      const got=await sliceIssues(cfg,tokens,group.slice(i,i+ISSUE_BATCH));
      if(got.error)return {error:`issues of the slice could not be read: ${got.error}`};
      issues.push(...got.items.filter(issue=>onSlice(issue,issue.component)));
    }
  }
  const hotspotsRead=keys.length?await readAll(cfg,tokens,`/api/hotspots/search?projectKey=${encodeURIComponent(key)}&status=TO_REVIEW`,'hotspots'):{items:[]};
  if(hotspotsRead.error)return {error:`hotspots of the project could not be read: ${hotspotsRead.error}`};
  const hotspots=hotspotsRead.items.filter(h=>onSlice(h,h.component));
  const pathOf=component=>analyzed.get(component)?.path??component;
  const failures=[];
  // Duplication: the share of the changed source lines that sit inside a duplicated block (the file's own side).
  const duplication={changedLines:changedSourceLines,duplicatedLines:0,percent:null,threshold:gate.duplicationMaxPercent,files:[]};
  for(const fileKey of keys){
    const file=analyzed.get(fileKey);
    if(qualifierOf(file.path)!=='FIL'||!file.ranges.length)continue;
    const shown=await read(cfg,tokens,`/api/duplications/show?key=${encodeURIComponent(fileKey)}`);
    if(shown.status===404)continue;
    if(!shown.reachable||shown.status!==200)return {error:`duplications of ${file.path} could not be read: ${shown.error??`HTTP ${shown.status}`}`};
    const mine=duplicatedLinesOf(shown.json,fileKey);
    const hit=[...mine].filter(line=>inRanges(file.ranges,line)).sort((a,b)=>a-b);
    if(hit.length){duplication.duplicatedLines+=hit.length;duplication.files.push({path:file.path,lines:hit.slice(0,ITEM_CAP)});}
  }
  duplication.percent=changedSourceLines?Math.round((duplication.duplicatedLines/changedSourceLines)*1000)/10:null;
  if(!changedSourceLines){duplication.applied=false;duplication.note='the slice changed no source line';}
  else if(changedSourceLines<gate.ignoreBelowChangedLines){duplication.applied=false;duplication.note=`${changedSourceLines} changed source lines (< ${gate.ignoreBelowChangedLines}): like the server's ignoreSmallChanges, the threshold is not held`;}
  else{duplication.applied=true;if(duplication.percent>gate.duplicationMaxPercent)failures.push(`duplication on the slice's changed lines ${duplication.percent}% > ${gate.duplicationMaxPercent}%`);}
  const blocking=issues.filter(i=>gate.blockingSeverities.includes(i.severity));
  const lesser=issues.filter(i=>!gate.blockingSeverities.includes(i.severity));
  if(blocking.length>gate.blockingIssuesMax)failures.push(`${blocking.length} open ${gate.blockingSeverities.join('/')} issue(s) on changed lines`);
  if(hotspots.length>gate.unreviewedHotspotsMax)failures.push(`${hotspots.length} security hotspot(s) to review on changed lines`);
  // Coverage: each service the slice touched, on its own measure (one service below the threshold fails the slice).
  const scope=coverageScopeOf(props);
  const isTarget=coverageTargetOf(scope);
  const measured=[];
  for(const fileKey of coverageRun?.judged===false?[]:keys){
    const file=analyzed.get(fileKey);
    if(qualifierOf(file.path)!=='FIL'||!isTarget(file.path))continue;
    const got=await fileCoverage(cfg,tokens,fileKey);
    if(got.error)return {error:`coverage of ${file.path} could not be read: ${got.error}`};
    measured.push({path:file.path,coverage:got.coverage});
  }
  const coverage=coverageRun?.judged===false
    ?{applied:false,status:'not-measured',ownerMode:coverageRun.ownerMode,exclusions:scope.exclusions,minPercent:gate.coverageMinPercent,files:[],failures:[],note:coverageRun.note}
    :judgeCoverage(measured,{scope,minPercent:gate.coverageMinPercent});
  if(coverageRun?.judged!==false&&coverageRun?.error)coverage.failures.unshift(`the slice's services could not be measured: ${coverageRun.error}`);
  if(!coverage.status)coverage.status=!coverage.applied?'no-scope':coverage.failures.length?'red':coverage.files.length?'green':'no-target';
  failures.push(...coverage.failures);
  return {error:null,result:{
    analyzedFiles:keys.length,notAnalyzed,
    newIssues:{total:issues.length,blocking:blocking.length,notBlocking:lesser.length,bySeverity:tally(issues,'severity'),byType:tally(issues,'type'),
      items:[...blocking,...lesser].slice(0,ITEM_CAP).map(i=>({key:i.key,rule:i.rule,severity:i.severity,type:i.type,path:pathOf(i.component),line:i.line??null,message:i.message,blocking:gate.blockingSeverities.includes(i.severity)}))},
    newHotspots:{total:hotspots.length,items:hotspots.slice(0,ITEM_CAP).map(h=>({key:h.key,rule:h.ruleKey,probability:h.vulnerabilityProbability,path:pathOf(h.component),line:h.line??null,message:h.message}))},
    duplication,
    coverage,
    verdict:failures.length?'fail':'pass',
    failures,
  }};
}

/**
 * A --cwd value as the repository root it means: an existing path with package.json or
 * sonar-project.properties as given; a bare name (no separator) the directory of that name beside or
 * above `base`, or `base` itself when that is its name. Otherwise the value resolved as a path.
 */
export function resolveScanCwd(value,base=process.cwd()){
  if(!value)return path.resolve(base);
  const isRoot=dir=>fs.existsSync(path.join(dir,'package.json'))||fs.existsSync(path.join(dir,'sonar-project.properties'));
  const direct=path.resolve(base,value);
  if(isRoot(direct)||/[\\/]/.test(value)||path.isAbsolute(value))return direct;
  for(let dir=path.resolve(base);;dir=path.dirname(dir)){
    if(path.basename(dir).toLowerCase()===String(value).toLowerCase()&&isRoot(dir))return dir;
    const beside=path.join(path.dirname(dir),value);
    if(isRoot(beside))return beside;
    if(path.dirname(dir)===dir)break;
  }
  return direct;
}

/** The throwaway project key an isolated slice analysis runs under: stable per repository key and scope. */
export function isolatedKey(key,scope){
  const hash=createHash('sha1').update(`${key}\n${[...scope].sort().join('\n')}`).digest('hex').slice(0,10);
  return `${key}-slice-${hash}`.slice(0,400);
}

/**
 * The scanner defines that index only the slice: sonar.inclusions over each scope path (a file as
 * itself, a directory as <dir>/**), and - when the repository declares sonar.test.inclusions - each of
 * its `**`-rooted patterns under each scope directory (a scope file only when a test pattern matches
 * it, so no file is ever indexed as both source and test); a repository with sonar.tests and no test
 * patterns gets the scope globs as its test inclusions.
 */
export function isolationDefines(cwd,props,scope){
  const isFile=p=>{try{return fs.statSync(path.join(cwd,p)).isFile();}catch{return false;}};
  const main=scope.map(p=>isFile(p)?p:`${p}/**`);
  const patterns=splitList(props['sonar.test.inclusions']);
  let tests=[];
  if(patterns.length){
    const matchers=patterns.flatMap(braceVariants).map(globExpression);
    for(const p of scope){
      if(isFile(p)){if(matchers.some(m=>m.test(p)))tests.push(p);continue;}
      for(const pattern of patterns){
        if(pattern.startsWith('**/'))tests.push(`${p}/${pattern}`);
        else if(pattern.startsWith(`${p}/`))tests.push(pattern);
      }
    }
  }else if(props['sonar.tests'])tests=main;
  // SonarJS builds one TypeScript program per tsconfig.json it finds anywhere in the tree: nivo-backend
  // held 31 (stray copies under .starciwork/kernel-strays and .infra), and a 9-file isolated analysis
  // still spent 19.7 minutes in the JS/TS sensor. The repository's own root tsconfig is the one that
  // types the slice; a declared sonar.typescript.tsconfigPath(s) wins.
  const declaredTsconfig=props['sonar.typescript.tsconfigPaths']||props['sonar.typescript.tsconfigPath'];
  const tsconfig=!declaredTsconfig&&fs.existsSync(path.join(cwd,'tsconfig.json'))?['-Dsonar.typescript.tsconfigPaths=tsconfig.json']:[];
  return [...tsconfig,`-Dsonar.inclusions=${main.join(',')}`,...(patterns.length||props['sonar.tests']?[`-Dsonar.test.inclusions=${tests.length?[...new Set(tests)].join(','):'__starci_no_tests__/**'}`]:[])];
}

export async function scan(cfg,options={}){
  const cwd=path.resolve(options.cwd??process.cwd());
  const summary={schema:SCAN_SCHEMA,at:new Date().toISOString(),host:cfg.host,publicHost:cfg.publicHost,cwd,stack:cfg.stackDir,declaration:cfg.declaration};
  const finish=(outcome,reason,extra={})=>Object.assign(summary,extra,{outcome,...(reason?{reason}:{}),...(outcome==='blocked'?{unavailable:true}:{})});
  if(!fs.existsSync(path.join(cwd,'package.json'))&&!fs.existsSync(path.join(cwd,'sonar-project.properties')))
    return finish('blocked',`${cwd} has neither package.json nor sonar-project.properties`);
  const props=readProperties(path.join(cwd,'sonar-project.properties'));
  let pkg=null;
  try{pkg=JSON.parse(fs.readFileSync(path.join(cwd,'package.json'),'utf8'));}catch{/* no manifest */}
  let key=options.key??cfg.declaredKey??props['sonar.projectKey']??(pkg?.name?String(pkg.name).replace(/^@/,'').replace(/\//g,'_'):null);
  summary.projectKey=key;
  summary.revision=gitRevision(cwd);
  const gateDoc=loadSonarGate();
  summary.gate=thresholdsOf(gateDoc);
  if(cfg.declaredQualityGate&&cfg.declaredQualityGate!==gateDoc.gate.name)summary.gate.declarationDrift=`the declaration names quality gate ${cfg.declaredQualityGate}; the gate is ${gateDoc.gate.name}`;
  if(cfg.disabled)return finish('disabled',`Sonar is disabled for this repository: ${cfg.disabled}`);
  if(!key)return finish('blocked','no project key: pass --key or set sonar.projectKey');

  // The slice is a local fact: read and refuse it before the scanner runs.
  const projectGateMode=Boolean(options.projectGate);
  summary.scope=projectGateMode?'project':'slice';
  let slice=null;
  if(!projectGateMode){
    slice=sliceChanges(cwd,{base:options.base,paths:options.paths});
    if(!slice.ok)return finish(slice.code==='SLICE_NOT_GIT'?'blocked':'refused',slice.reason,{code:slice.code});
    summary.slice={base:slice.base,baseCommit:slice.baseCommit,...(slice.baseFallback?{baseFallback:slice.baseFallback}:{}),paths:slice.paths,changedFiles:slice.files.map(f=>f.path)};
    if(!slice.files.length)return finish('refused',`the slice changes no file against ${slice.base}${slice.paths.length?` inside ${slice.paths.join(', ')}`:''}: pass --base <the commit before this slice's first edit> and --paths <its owned paths>`,{code:'SLICE_EMPTY'});
  }
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
  if(options.ensure!==false)summary.qualityGate=await ensureQualityGate(cfg,{key,admin,gate:gateDoc});
  let token=await projectToken(cfg,{key,admin,tokenRef:options.tokenRef,mint:options.ensure!==false});
  summary.custody.analysis=custodyView(token);
  if(!token.present)return finish('blocked',`no analysis token for ${key} (${token.reason}); repair the source stack custody - never ask the owner for it.`);
  // An isolated slice analysis: a throwaway project over the slice's files only, scanned with the admin
  // token (a project analysis token is scoped to its one project), judged, then deleted below.
  const extra=[];
  let isolated=null;
  if(options.isolate&&slice){
    const scope=slice.paths.length?slice.paths:slice.files.map(f=>f.path);
    if(!admin.present)summary.isolated={skipped:`the admin token is not in custody (${admin.reason}): the full analysis runs instead`};
    else{
      const sliceKey=isolatedKey(key,scope);
      const ensured=await ensureProject(cfg,{key:sliceKey,name:`${key} slice ${sliceKey.slice(-10)}`});
      if(ensured.outcome!=='ok')summary.isolated={skipped:`the slice project could not be created (${ensured.message}): the full analysis runs instead`};
      else{
        isolated={projectKey:sliceKey,parentKey:key,scope};
        summary.isolated=isolated;
        key=sliceKey;
        summary.projectKey=key;
        if(options.ensure!==false)summary.qualityGate={...summary.qualityGate,isolatedSelect:(await ensureQualityGate(cfg,{key:sliceKey,admin,gate:gateDoc})).outcome};
        token={...admin,note:'admin token (isolated slice project)'};
        summary.custody.analysis=custodyView(token);
        extra.push(...isolationDefines(cwd,props,scope));
      }
    }
  }
  // The slice's services get their own fresh lcov before the scanner reads it (a project-gate scan imports the report the
  // last `npm test` wrote).
  const coverageRun=slice?prepareSliceCoverage(cfg,{cwd,props,slice}):null;
  if(coverageRun)summary.coverageRun=coverageRun;
  if(coverageRun?.judged===false)summary.ownerMode={specs:{unit:false},coverage:'not-measured',note:coverageRun.note};
  const analysisToken=token.value;
  const childEnv={...process.env,SONAR_HOST_URL:cfg.host,SONAR_TOKEN:analysisToken};

  const workDir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-sonar-'));
  try{
    const plan=scannerCommand({pkg,props,host:cfg.host,key,workDir,extra});
    const run=await runScanner(cwd,plan,childEnv,Number(options.timeoutSec??1800)*1000);
    summary.scanner={runner:plan.runner,command:scrub(run.display),exitCode:run.exitCode,durationMs:run.durationMs};
    if(options.log){fs.mkdirSync(path.dirname(path.resolve(options.log)),{recursive:true});fs.writeFileSync(options.log,`$ ${scrub(run.display)}\n${run.log}`);summary.scanner.log=path.resolve(options.log);}
    if(options.blob){
      const stored=await emitCheckOutput(`$ ${scrub(run.display)}\n${run.log}`,{blob:true,mediaType:'text/plain',
        put:options.put,write:()=>{}});
      summary.scanner.logSha=stored.sha;
    }
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
    const projectGate={scope:'whole-project',status:project?.status??null,conditions:(project?.conditions??[]).map(c=>({metric:c.metricKey,status:c.status,actual:c.actualValue,comparator:c.comparator,threshold:c.errorThreshold}))};
    summary.projectGate=projectGate;
    const component=encodeURIComponent(key);
    let issues=await read(cfg,tokens,`/api/issues/search?components=${component}&resolved=false&ps=1&facets=severities,types,impactSeverities`);
    if(issues.status!==200)issues=await read(cfg,tokens,`/api/issues/search?componentKeys=${component}&resolved=false&ps=1&facets=severities,types`);
    if(issues.status===200)summary.issues={scope:'whole-project',total:issues.json?.paging?.total??issues.json?.total??null,bySeverity:facet(issues.json,'severities'),byType:facet(issues.json,'types'),byImpactSeverity:facet(issues.json,'impactSeverities')};
    const hotspots=await read(cfg,tokens,`/api/hotspots/search?projectKey=${component}&status=TO_REVIEW&ps=1`);
    if(hotspots.status===200)summary.hotspots={scope:'whole-project',toReview:hotspots.json?.paging?.total??null};
    const measures=await read(cfg,tokens,`/api/measures/component?component=${component}&metricKeys=duplicated_lines_density,ncloc,coverage`);
    if(measures.status===200)summary.measures=Object.fromEntries((measures.json?.component?.measures??[]).map(m=>[m.metric,m.value]));
    // Sonar way judges new code only: a project's first analysis has none, so the gate is OK with no
    // condition evaluated. That is the server's verdict and stays a pass, but the summary says so.
    if(projectGate.status==='OK'&&!projectGate.conditions.length)projectGate.note='no condition was evaluated (a first analysis has no new code); read the overall measures';
    const projectFailures=projectGate.conditions.filter(c=>c.status==='ERROR').map(c=>`${c.metric} ${c.actual} vs ${c.comparator} ${c.threshold}`);
    if(projectGateMode){
      if(projectGate.status==='OK')return finish('pass');
      if(projectGate.status==='ERROR')return finish('fail','the quality gate failed: '+projectFailures.join(', '));
      return finish('blocked',`no quality-gate result for the analysis (status ${projectGate.status??`HTTP ${gate.status}`})`);
    }
    // The project has no new-code baseline, so its gate judges the whole project's debt: a note for the
    // report, never this slice's verdict.
    projectGate.note=[`whole-project debt, reported and not a block: the slice verdict decides${projectFailures.length?` (project gate: ${projectFailures.join(', ')})`:''}`,projectGate.note].filter(Boolean).join('; ');
    const judged=await evaluateSlice(cfg,tokens,{key,slice,props,pkg,gate:summary.gate,coverageRun});
    if(judged.error)return finish('blocked',judged.error);
    Object.assign(summary.slice,judged.result);
    if(judged.refused)return finish('refused',judged.refused.reason,{code:judged.refused.code});
    if(judged.result.verdict==='pass')return finish('pass');
    return finish('fail',`the slice fails on new code: ${judged.result.failures.join('; ')}`);
  }finally{
    safeRemoveTree(workDir);
    // The throwaway slice project is judged and gone: the next scan of the same scope re-creates it.
    if(isolated&&!options.keepSliceProject){
      const removed=await call(cfg,'POST','/api/projects/delete',{token:admin.value,form:{project:isolated.projectKey}}).catch(error=>({status:0,error:String(error?.message??error)}));
      isolated.deleted=removed.status===204||removed.status===200;
      if(!isolated.deleted)isolated.deleteError=`HTTP ${removed.status??0} ${removed.text??removed.error??''}`.trim();
    }
  }
}

/** The dashboard metrics of a project: the issue types, the hotspots and the coverage of knowledge/sonar-gate.yaml `overall`. */
export const dashboardMetrics=gate=>[...Object.keys(gate.overall.issues.types),'security_hotspots',gate.overall.hotspots.metric,gate.overall.coverage.metric];

/**
 * The dashboard of a project as its last analysis left it, judged by judgeDashboard: bugs, code smells and
 * vulnerabilities 0, every hotspot reviewed, coverage at the threshold on every file inside the repository's
 * coverage scope (the services: what sonar.coverage.exclusions leaves) and overall. It reads, it never scans: run `scan --project-gate --wait`
 * first. Exit 0 pass, 1 fail, 2 blocked (server down, no token, no analysis).
 */
export async function dashboard(cfg,options={}){
  const cwd=path.resolve(options.cwd??process.cwd());
  const props=readProperties(path.join(cwd,'sonar-project.properties'));
  const key=options.key??cfg.declaredKey??props['sonar.projectKey']??null;
  const gate=loadSonarGate();
  const scope=coverageScopeOf(props);
  const summary={schema:SCHEMA,command:'dashboard',at:new Date().toISOString(),host:cfg.host,cwd,projectKey:key,coverageExclusions:scope.exclusions};
  const finish=(outcome,reason,extra={})=>Object.assign(summary,extra,{outcome,...(reason?{reason}:{})});
  if(cfg.disabled)return finish('disabled',`Sonar is disabled for this repository: ${cfg.disabled}`);
  if(!key)return finish('blocked','no project key: pass --key or set sonar.projectKey');
  const server=await call(cfg,'GET','/api/system/status');
  if(!(server.reachable&&server.json?.status==='UP'))return finish('blocked',server.reachable?`SonarQube at ${cfg.host} reports ${server.json?.status??`HTTP ${server.status}`}`:downMessage(cfg,server,containerState(cfg)));
  const admin=readCustody(cfg,cfg.adminToken);
  const token=await projectToken(cfg,{key,admin,tokenRef:options.tokenRef,mint:false});
  const tokens=[...(token.present?[token.value]:[]),...(admin.present?[admin.value]:[])];
  if(!tokens.length)return finish('blocked',`no token can read ${key} (${token.reason}); repair the source stack custody - never ask the owner for it.`);
  const component=encodeURIComponent(key);
  const project=await read(cfg,tokens,`/api/measures/component?component=${component}&metricKeys=${dashboardMetrics(gate).join(',')}`);
  if(project.status===404)return finish('blocked',`${key} has no analysis on ${cfg.host}: run scan --project-gate --wait first`);
  if(!project.reachable||project.status!==200)return finish('blocked',`the measures of ${key} could not be read: ${project.error??`HTTP ${project.status}`}`);
  const measures=Object.fromEntries((project.json?.component?.measures??[]).map(m=>[m.metric,m.value]));
  const tree=await readAll(cfg,tokens,`/api/measures/component_tree?component=${component}&metricKeys=${gate.overall.coverage.metric}&qualifiers=FIL`,'components');
  if(tree.error)return finish('blocked',`the per-file coverage of ${key} could not be read: ${tree.error}`);
  const files=tree.items.map(item=>({path:item.path,coverage:(item.measures??[]).find(m=>m.metric===gate.overall.coverage.metric)?.value??null}));
  const judged=judgeDashboard({measures,files,scope},gate);
  summary.dashboardUrl=`${cfg.host}/dashboard?id=${component}`;
  summary.numbers=judged.numbers;
  summary.coverage=judged.coverage;
  summary.failures=judged.failures;
  return finish(judged.verdict,judged.failures.length?`the dashboard fails: ${judged.failures.join('; ')}`:null);
}

// ---- CLI ------------------------------------------------------------------------------------------------

const HELP=`Usage: node scripts/checks/sonar-local.mjs <command> [options]

  status                                  server, container, custody presence and token validity
  ensure-project --key K [--name N]       create the project on the local server when it is missing;
                 [--with-token]           also make sure a project analysis token is in custody
  token [--key K] [-- command args...]    run a command with SONAR_TOKEN and SONAR_HOST_URL in its env;
                                          alone it reports custody presence (never the value)
  scan --cwd REPO [--key K] [--wait]      run the repository scanner against the local server
       [--base REV] [--paths P1,P2]     judge the slice: lines REV..working tree changed inside the paths
       [--project-gate]                 (default base HEAD); --project-gate judges the whole-project gate instead
       [--out FILE.json | --blob] [--log FILE.txt] [--token-ref REF] [--no-ensure] [--timeout SEC] [--wait-timeout SEC]
       [--isolate] [--keep-slice-project] analyse only --paths in a throwaway project (minutes, not a whole-repo scan)
  dashboard --cwd REPO [--key K]          the dashboard numbers of the project's last analysis: bugs, code smells,
                                          vulnerabilities, hotspots reviewed, coverage and the coverage of every
                                          file of the coverage scope; fails unless all are at the gate

  common: [--cwd REPO] [--declaration FILE] [--host URL] [--stack DIR]
          host, stack, custody and project keys come from the repository's .starcistacks/application-stacks.yaml
          quality.sonar declaration when it has one, else ${DEFAULT_HOST} and the source host's .starcistacks/dev
Exit 0 pass/up/ok, 1 failing result or refused scan (empty slice), 2 blocked or usage.`;

function parseArgs(argv){
  const out={_:[],rest:null};
  for(let i=0;i<argv.length;i++){
    const a=argv[i];
    if(a==='--'){out.rest=argv.slice(i+1);break;}
    if(a==='--wait')out.wait=true;
    else if(a==='--no-ensure')out.ensure=false;
    else if(a==='--with-token')out.withToken=true;
    else if(a==='--project-gate')out.projectGate=true;
    else if(a==='--isolate')out.isolate=true;
    else if(a==='--keep-slice-project')out.keepSliceProject=true;
    else if(a==='--blob')out.blob=true;
    else if(a==='--help'||a==='-h')out.help=true;
    else if(a.startsWith('--')){
      const [flag,inline]=a.slice(2).split(/=(.*)/s);
      const name=flag.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
      const value=inline??argv[++i];
      out[name]=name==='paths'&&out.paths?`${out.paths},${value}`:value;
    }else out._.push(a);
  }
  return out;
}

const exitFor=outcome=>({up:0,ok:0,pass:0,present:0,submitted:0,disabled:0,fail:1,refused:1}[outcome]??2);

export async function sonarLocalMain(argv=[],{env=process.env,config,put=null}={}){
  const args=parseArgs(argv);
  if(args.out&&args.blob)return {exitCode:2,text:'sonar-local: --out and --blob are mutually exclusive'};
  if(args.cwd)args.cwd=resolveScanCwd(args.cwd);
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
    const child=await sonarEnv(cfg,{key,base:env,mint:true});
    if(!child.ok||!args.rest?.length)report={schema:SCHEMA,command:'token',host:cfg.host,...(key?{projectKey:key}:{}),custody:child.custody,outcome:child.ok?'present':'blocked'};
    else{
      // A shell resolves npm/npx .cmd shims on Windows; each argument is quoted so paths with spaces survive.
      const result=spawnSync(args.rest.map(quote).join(' '),{stdio:'inherit',env:child.env,shell:true,windowsHide:true});
      return {exitCode:result.status??1};
    }
  }else if(command==='scan'){
    report=await scan(cfg,{cwd:args.cwd,key:args.key,wait:args.wait,out:args.out,log:args.log,blob:args.blob,put,tokenRef:args.tokenRef,ensure:args.ensure,timeoutSec:args.timeout,waitSec:args.waitTimeout,
      base:args.base,paths:args.paths,projectGate:args.projectGate,isolate:args.isolate,keepSliceProject:args.keepSliceProject});
    if(args.out)await emitCheckOutput(`${scrub(JSON.stringify(report,null,2))}\n`,{out:args.out});
  }else if(command==='dashboard'){
    report=await dashboard(cfg,{cwd:args.cwd,key:args.key,tokenRef:args.tokenRef});
    if(args.out)await emitCheckOutput(`${scrub(JSON.stringify(report,null,2))}\n`,{out:args.out});
  }else return {exitCode:2,text:`sonar-local: unknown command ${command}\n\n${HELP}`};
  const safeReport=JSON.parse(scrub(JSON.stringify(report)));
  const blob=args.blob?await emitCheckOutput(`${JSON.stringify(safeReport,null,2)}\n`,{blob:true,put,write:()=>{}}):null;
  return {exitCode:exitFor(report.outcome),report:safeReport,...(blob?{blob}:{})};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  sonarLocalMain(process.argv.slice(2)).then(({exitCode,report,text,blob})=>{
    if(text)process.stdout.write(`${text}\n`);
    if(blob)process.stdout.write(`${JSON.stringify(blob)}\n`);
    else if(report)process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
    process.exitCode=exitCode;
  },error=>{process.stderr.write(`sonar-local: ${scrub(error?.stack??error)}\n`);process.exitCode=2;});
}
