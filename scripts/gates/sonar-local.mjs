#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path'; import { byCodeUnit } from '../lib/list.mjs'; import { repeatInOrder } from '../lib/in-order.mjs';
import {containerInspect} from '../api/docker/container-inspect.mjs';import {scanRun} from '../api/sonar/scan-run.mjs';import {runShell} from '../api/process/run-shell.mjs';
import {createHash} from 'node:crypto';
import { isMain } from '../lib/is-main.mjs';
import {isPlainObject as plain} from '../../engine/plain-object.mjs';
import {skillRoot} from '../../engine/runtime-root.mjs';
import {sopsIdentityEnv} from '../../engine/secrets.mjs';
import {parseYaml} from '../../engine/yaml.mjs';
import {safeRemove} from '../api/fs/safe-remove.mjs'; import {runNode} from '../api/node/run-node.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import {repositoryName,repositoryHome} from '../hfs/repo-identity.mjs';
import {findDeclaration} from './sonar-declaration.mjs';
export {findDeclaration};
import {resolveCustodyFile,resolveDeclaredRepository,runtimeHostRoot,runtimeSecretEnv} from './runtime-host.mjs';
import {bindSonarCredentials,sonarCredentialRequirements,suppliedSonarToken,sonarAnalysisEnvironment,safeSonarHost,sonarAnalysisAction,sonarAdministrativeConfig,sonarAdminForAnalysis} from './sonar-credentials.mjs';
import {braceVariants,globExpression} from '../lib/glob.mjs';
import {posixPath,trimTrailingSlashes} from '../lib/path-key.mjs';
import { log as gitLog } from '../api/git/log.mjs'; import { statusQuery as gitStatus } from '../api/git/status-query.mjs'; import { git, sliceChanges, splitList } from './sonar-slice-changes.mjs';
export { parseDiffNewLines, sliceChanges } from './sonar-slice-changes.mjs';
import {emitCheckOutput} from './output.mjs';
import {coverageScopeOf,coverageTargetOf,judgeDashboard,loadSonarGate,serverConditions,thresholdsOf} from './sonar-gate.mjs';
import { evaluateSlice as evaluateSliceCore } from './sonar-slice.mjs';
import { acceptFirst, readPages, readWithTokens, syncConditions } from './sonar-sequential.mjs';
import {text} from '../lib/stack-declaration.mjs';
import {readCustody} from './sonar-ext-custody.mjs';
import {ADMIN_TOKEN_ENV,environmentReference} from './sonar-host-secrets.mjs';
import {stackStop,stackUp} from './sonar-stack.mjs';
import {inspectOwnerConfig,specsSettings} from '../../engine/config.mjs';
import {createRequire} from 'node:module';
import { isSpecRun } from '../lib/env.mjs';
import { readProperties } from '../lib/properties.mjs';
import { makeTempDir } from '../api/fs/make-temp-dir.mjs'; import { tempPath } from '../api/fs/temp-path.mjs';

/**
 * Sonar analysis reads the selected server from explicit options, the shared runtime environment or
 * the governing stack declaration. The owner supplies SONAR_TOKEN locally; analysis never retrieves
 * or mints an encrypted fallback. Status and explicit project provisioning own separate admin custody.
 *
 *   status                                   server, container, custody and token validity
 *   ensure-project --key K [--with-token]    admin token -> create the project (and its token) when missing
 *   token [--key K] [-- command args...]     run a command with SONAR_TOKEN/SONAR_HOST_URL in its env
 *   scan --cwd REPO [--key K] [--wait]       run the repository's scanner against the local server
 *        [--base REV] [--paths P1,P2]        and judge the slice: the lines REV..working tree changed
 *        [--project-gate]                    (inside --paths), not the whole project
 *        [--out summary.json | --blob] [--log scanner.txt] [--no-ensure] [--timeout SECONDS]
 *        [--isolate]
 *   dashboard --cwd REPO [--key K] [--branch B]  the project's dashboard numbers from its last analysis (of branch B when given; bugs, code
 *                                            smells, vulnerabilities, hotspots reviewed, coverage and the coverage
 *                                            of every file of the coverage scope), judged by judgeDashboard
 *
 * --cwd takes the repository root; a bare repository name (the brief's <app>) resolves to that
 * directory beside or above the current one, never to <cwd>/<name> (a `--cwd <name>` run from inside
 * that same repository once read <cwd>/<name> and was blocked). --isolate analyses the slice alone: the
 * scanner indexes only --paths (sonar.inclusions, and the repository's test patterns under them) into
 * a throwaway project <key>-slice-<hash> scanned with the supplied analysis token, judged, then deleted. A whole
 * repository analysis spent 17-40 minutes (JS/TS sensor over ~5600 files) to judge a 1-5 file slice;
 * the slice verdict reads only the slice's files, so the isolated analysis proves the same verdict.
 * Without the admin token in custody --isolate falls back to the full analysis and says so.
 *
 * The verdict is the slice's own (inc-f92febebbb64). Sonar way judges "new code", and a project
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
 * Secret handling: shared analysis credentials remain in memory, child environment or Authorization
 * headers. Every emitted token-bearing provider result is scrubbed. Admin provisioning retains its
 * separately owned stack custody and lifecycle.
 *
 * Exit codes: 0 pass / up / ensured / disabled by the declaration, 1 a real failing result (slice
 * verdict fail, scanner failure) or a refused scan (empty slice, unknown
 * base) the op fixes itself, 2 blocked (server down, custody missing, invalid token, usage).
 */
export const SCHEMA='starci/sonar-local@1';
const SCAN_SCHEMA='starci/sonar-local-scan@3';
const DEFAULT_HOST='http://localhost:9010';
const PUBLIC_HOST='https://sonar.starci.org';
const CONTAINER='starci-sonarqube';
const ANALYSIS_TOKEN='sonarqube-analysis-token.txt';
/** The Supervisor audit event (sup_events) a re-mint of a token the server rejected records. */
const REMINT_EVENT='sonar-token-reminted';
const LOG_CAP=4*1024*1024;

// ---- secrets never leave this module in the clear -------------------------------------------------------

const SECRETS=new Set();
const remember=value=>{
  if(typeof value==='string'&&value.length>=4)SECRETS.add(value);
  return value;
};
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


// The host form lives in this runtime tree (.claude/ext/<service>), not in the declaring
// repository (check-starcistacks.mjs normalizeService resolves it the same way).
const hostStackOf=stack=>{
  const compose=text(stack.compose);
  const root=text(stack.root)?.replaceAll('\\','/');
  const stackDir=root&&/^\.claude\/ext\/[a-z][a-z0-9-]*$/.test(root)?path.join(skillRoot,root.slice('.claude/'.length)):null;
  return {stackDir,composeFile:compose&&stackDir?path.join(stackDir,compose):null};
};

// The project form: <repository>/<root>/<environment>; a compose path under .starcistacks/ is the repository's, any other the stack's.
const composeFileIn=(dir,stackDir,compose)=>/^\.starcistacks[\\/]/.test(compose)?path.join(dir,compose):path.resolve(stackDir,compose);
const projectStackOf=(stack,repoDir)=>{
  const compose=text(stack.compose);
  const dir=repoDir(text(stack.repository));
  const stackDir=path.join(dir,text(stack.root)??'.starcistacks',text(stack.environment)??'dev');
  return {stackDir,composeFile:compose?composeFileIn(dir,stackDir,compose):null};
};

/** The stack block of a Sonar service declaration resolved to {stackDir, composeFile, container}. */
const declaredStackOf=(sonar,repoDir,repoRoot)=>{
  if(plain(sonar.stack)){
    const stack=sonar.stack;
    const placed=text(stack.owner)==='host'?hostStackOf(stack):projectStackOf(stack,repoDir);
    return {...placed,container:text(stack.container)};
  }
  const stackDir=text(sonar.stack)&&sonar.stack!=='source-host'?path.join(repoRoot,'.starcistacks',sonar.stack):null;
  return {stackDir,composeFile:null,container:null};
};

/** The declared projects, both forms (a list of {repository,key,name}, or a map repository -> key|{key,name}). */
const declaredProjectsOf=sonar=>{
  let list=[];
  if(Array.isArray(sonar.projects))list=sonar.projects.filter(plain).map(p=>({repository:text(p.repository),key:text(p.key),name:text(p.name)}));
  else if(plain(sonar.projects))list=Object.entries(sonar.projects).map(([repository,v])=>({repository,key:text(v)??text(v?.key),name:text(v?.name)}));
  return list.filter(p=>p.key);
};

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
 *   credentials [{id, env, custody {repository, path}}] - custody paths from that repository's root; a SONAR_TOKEN
 *     credential naming a project key is that project's analysis token, another SONAR_TOKEN credential is the generic
 *     analysis token (an `admin` credential is not read: the admin token is SONARQUBE_ADMIN_TOKEN of the resolved secret.env),
 *   ci and ownerAction, passed through.
 * Returns null when the declaration carries no Sonar service.
 */
export function readSonarDeclaration(file,repoRoot=path.dirname(path.dirname(path.resolve(file)))){
  const doc=parseYaml(fs.readFileSync(file,'utf8'));
  const sonar=[doc?.services?.sonar,doc?.quality?.sonar,doc?.services?.quality?.sonar].find(plain);
  if(!sonar)return null;
  // A named repository resolves by identity (scripts/gates/runtime-host.mjs): the declaring repository, the runtime host or a
  // sibling checkout; one not checked out here is named where its sibling checkout would be, so its custody reads as missing.
  const repoDir=name=>!name?repoRoot:resolveDeclaredRepository(name,{fromRepo:repoRoot})??path.join(path.dirname(repositoryHome(repoRoot)),name);
  const {stackDir,composeFile,container}=declaredStackOf(sonar,repoDir,repoRoot);
  const projects=declaredProjectsOf(sonar);
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
    analysis:analysis.find(c=>!projects.some(p=>p.tokenRef===c.file))?.file??null,
    ci:sonar.ci??null,
    ownerAction:sonar.ownerAction??null,
  };
}

/**
 * Resolve the selected analysis host from explicit options, the shared environment, then the stack declaration.
 * Administrative status/provisioning retains the source-host default when no host is selected.
 */
export function resolveConfig(options={},env=process.env){
  env=(options.runtimeSecretEnv??runtimeSecretEnv)(env,options.runtimeRoot??skillRoot);
  const found=options.declaration?{file:path.resolve(options.declaration),repoRoot:path.dirname(path.dirname(path.resolve(options.declaration)))}:findDeclaration(options.cwd);
  let decl=null,declarationError=null;
  if(found){try{decl=readSonarDeclaration(found.file,found.repoRoot);}catch(error){declarationError=`${found.file}: ${error.message}`;}}
  const stackDir=path.resolve(options.stack??decl?.stackDir??env.STARCI_SONAR_STACK??sourceHostStackDir());
  let declaredHost=null;
  if(decl)declaredHost=decl.mode==='hosted'?decl.hostPublic:decl.hostLocal;
  const envHost=Object.hasOwn(env,'SONAR_HOST_URL')?env.SONAR_HOST_URL:declaredHost??env.STARCI_SONAR_HOST_URL;
  const selectedHost=options.host??envHost;
  const host=selectedHost??DEFAULT_HOST;
  const administrativeHost=options.host??declaredHost??env.STARCI_SONAR_HOST_URL??DEFAULT_HOST;
  const repository=options.cwd?repositoryName(path.resolve(options.cwd)):null;
  const project=decl?.projects.find(p=>p.repository===repository)??null;
  let declaration=null;
  if(decl)declaration={file:decl.file,provider:decl.provider,mode:decl.mode,projects:decl.projects.map(p=>p.key),ci:decl.ci?.wiring??null,ownerAction:decl.ownerAction};
  else if(declarationError)declaration={error:declarationError};
  return bindSonarCredentials({
    host:safeSonarHost(host)??'',
    publicHost:trimTrailingSlashes(String(decl?.hostPublic??PUBLIC_HOST)),
    stackDir,
    composeFile:decl?.composeFile??path.join(stackDir,'infra','compose','sonarqube.yaml'),
    container:options.container??decl?.container??env.STARCI_SONAR_CONTAINER??CONTAINER,
    identity:options.identity??null,
    sops:options.sops??env.STARCI_SOPS??null,
    docker:options.docker??env.STARCI_DOCKER??'docker',
    stackSecret:options.stackSecret??null,
    record:options.record??null,
    adminToken:environmentReference(ADMIN_TOKEN_ENV),
    stackRun:{extRoot:options.extRoot??path.join(skillRoot,'ext','sonar'),composeRunner:options.composeRunner??null},
    analysisToken:options.analysisToken??decl?.analysis??`runtime/files/${ANALYSIS_TOKEN}`,
    declaredQualityGate:decl?.qualityGate??null,
    declaredKey:project?.key??null,
    declaredName:project?.name??null,
    declaredTokenRef:project?.tokenRef??null,
    disabled:decl?.mode==='disabled'?(decl.reason??'the stack declaration disables Sonar'):null,
    declaration,
    // specs: the owner's product-test switches ({unit}); null reads config.yaml `specs` per scan. coverageRunner: the
    // function that writes the slice's lcov (runSliceCoverage); a spec passes its own.
    specs:options.specs??null,
    coverageRunner:options.coverageRunner??null,
    timeoutMs:Number(options.timeoutMs??8000),
    pollMs:Number(options.pollMs??3000),
    fetch:options.fetch??globalThis.fetch,
  },env,selectedHost,remember,administrativeHost);
}

// ---- custody --------------------------------------------------------------------------------------------

/** The custody entry without its value - what a report may carry. */
const custodyView=entry=>({name:entry.name,present:entry.present,...(entry.via?{via:entry.via}:{}),...(entry.reminted?{reminted:true}:{}),
  ...(entry.rejected?{rejected:true}:{}),...(entry.refusal?{refusal:entry.refusal}:{}),...(entry.identityRefusal?{identityRefusal:entry.identityRefusal}:{}),...(entry.reason?{reason:entry.reason}:{})});

/** The custody member a minted project analysis token lives in: runtime/files/sonarqube-KEY-token.key. */
export const projectTokenRef=key=>`runtime/files/sonarqube-${String(key).replace(/[^A-Za-z0-9_.-]/g,'_')}-token.key`;

/** The .starcistacks root a custody member resolves into - the tree a stack-secret tool manages. */
const stackRootOf=file=>{
  const at=/[\\/]\.starcistacks(?=[\\/]|$)/.exec(file);
  return at?file.slice(0,at.index+at[0].length):null;
};

/**
 * Store a value as an encrypted custody member of a repository's .starcistacks tree, written
 * through that repository's own tool (<repo>/scripts/stack-secret.mjs inside that repository, not this runtime; an absolute reference names that tree directly - a project
 * token minted into the declaring repository while the sonar stack itself is the host extension - and a relative one stays a
 * member of the configured stack). Anything else is refused and mintToken revokes the value again. Never argv.
 */
function writeCustody(cfg,ref,value,{env}){
  const file=path.resolve(cfg.stackDir,ref);
  const managed=path.isAbsolute(String(ref))?stackRootOf(file):path.dirname(cfg.stackDir);
  const stacksRoot=managed??path.dirname(cfg.stackDir);
  const tool=cfg.stackSecret??path.join(path.dirname(stacksRoot),'scripts','stack-secret.mjs');
  if((!managed||path.basename(managed)!=='.starcistacks')&&!cfg.stackSecret)
    return {ok:false,reason:`the custody member ${ref} is not under a .starcistacks tree a stack-secret tool manages`};
  if(!fs.existsSync(tool))return {ok:false,reason:`no stack-secret tool at ${tool}`};
  const target=path.relative(stacksRoot,file).replaceAll('\\','/');
  const tmp=tempPath(`sonar-local-${process.pid}-${Date.now().toString(36)}`);
  try{
    fs.writeFileSync(tmp,value,{mode:0o600});
    const result=runNode([tool,'set',target,'--from-file',tmp],{cwd:path.dirname(stacksRoot),env,stdio:['ignore','pipe','pipe']});
    return result.status===0?{ok:true}:{ok:false,reason:scrub(`stack-secret set ${target} exited ${result.status}: ${String(result.stderr||result.stdout).trim().split(/\r?\n/).slice(-2).join(' ')}`)};
  }finally{
    try{fs.rmSync(tmp,{force:true});}catch{/* best effort */}
  }
}

/**
 * Does the server accept this token? true, false (401/403, or validate answering valid:false) or null when
 * the server could not be asked (unreachable, another status) - an unknown answer never discards a token.
 */
async function tokenAccepted(cfg,value){
  const check=await call(cfg,'GET','/api/authentication/validate',{token:value});
  if(check.status===200)return check.json?.valid===true;
  if(check.status===401||check.status===403)return false;
  return null;
}

/** A custody reference writeCustody may store over: a member of the configured stack, or an absolute
 *  declaration credential inside a repository's .starcistacks tree. */
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
  const selected=sopsIdentityEnv(sonarAnalysisEnvironment(cfg),{identity:cfg.identity});
  if(selected.error)return {present:false,name:ref,identityRefusal:selected.error.identityRefusal,reason:selected.error.message};
  const name=`sonar-local-${label}-${Date.now().toString(36)}`.slice(0,100);
  const generated=await call(cfg,'POST','/api/user_tokens/generate',{token:admin.value,form:{name,type,...(projectKey?{projectKey}:{})}});
  const value=generated.status===200?remember(String(generated.json?.token??'')):'';
  if(!value)return {present:false,name:ref,reason:`token generate for ${label} failed: HTTP ${generated.status} ${generated.text??generated.error??''}`};
  const stored=writeCustody(cfg,ref,value,{env:selected.env});
  if(stored.ok)return {present:true,value,via:'minted',name:ref,minted:name};
  await call(cfg,'POST','/api/user_tokens/revoke',{token:admin.value,form:{name}});
  return {present:false,name:ref,...(stored.identityRefusal?{identityRefusal:stored.identityRefusal}:{}),reason:`minted ${name} but could not store it (${stored.reason}); revoked it`};
}

/**
 * One Supervisor audit event (machine.sqlite sup_events) per re-mint; never a value. cfg.record replaces the
 * store, and a spec run (NODE_TEST_CONTEXT) never writes it without one.
 */
async function recordRemint(cfg,event){
  const payload={...event,host:cfg.host,stack:cfg.stackDir};
  try{
    if(typeof cfg.record==='function')return void cfg.record({kind:REMINT_EVENT,payload});
    if(isSpecRun())return;
    const {withSupervisor,supervisorEvent}=await import('../machine/home.mjs');
    withSupervisor(m=>supervisorEvent(m,{entityType:'service',entityId:'sonar',kind:REMINT_EVENT,payload}));
  }catch{/* the repaired custody stands without its event */}
}

/**
 * Read custody members in order and return the first the server accepts. A member it rejects is skipped
 * and returned as `stale` (the first one), so the caller re-mints over it.
 */
const firstAccepted=(cfg,refs)=>acceptFirst({cfg,refs,readCustody,tokenAccepted,remember});

/**
 * The generic analysis token (cfg.analysisToken). One the server rejects is re-minted as a
 * GLOBAL_ANALYSIS_TOKEN over the same member when a valid admin token is at hand.
 */
async function genericToken(cfg,{admin=null}={}){
  const {entry,misses,stale,identityRefusal}=await firstAccepted(cfg,[cfg.analysisToken]);
  if(identityRefusal)return {present:false,name:cfg.analysisToken,identityRefusal,reason:misses.join('; ')};
  if(entry)return entry;
  if(stale&&admin?.present&&inStack(cfg,stale.name)){
    const minted=await mintToken(cfg,{admin,ref:stale.name,type:'GLOBAL_ANALYSIS_TOKEN',label:'analysis'});
    if(minted.present){
      await recordRemint(cfg,{role:'analysis',ref:stale.name,minted:minted.minted,type:'GLOBAL_ANALYSIS_TOKEN'});
      return {...minted,reminted:true};
    }
    if(minted.identityRefusal)return minted;
    misses.push(minted.reason);
  }
  return {present:false,name:cfg.analysisToken,...(stale?{rejected:true}:{}),reason:misses.filter(Boolean).join('; ')};
}

// Over the member the server rejected when it can be written; else the declaration's own custody
// reference for the project (a product repository's .starcistacks while the sonar stack is the host
// extension), else the conventional member of the configured stack.
const projectMintRef=(cfg,key,stale)=>{
  if(stale&&inStack(cfg,stale.name))return stale.name;
  if(inStack(cfg,cfg.declaredTokenRef??''))return cfg.declaredTokenRef;
  return projectTokenRef(key);
};

/**
 * The analysis token for one project. Order: an explicit custody reference, the declaration's reference
 * for the project, the minted member projectTokenRef(key) - the first the server accepts. When none is
 * accepted and minting is allowed, the admin token generates a PROJECT_ANALYSIS_TOKEN for the project and
 * the stack-secret tool stores it encrypted over the member the server rejected (a re-mint, recorded as a
 * sonar-token-reminted event) or at projectTokenRef(key) when none existed. The source stack's generic
 * analysis token is the last resort - on this server it is itself scoped to one project.
 */
// Mints the project's analysis token with the admin token: {token} to return, or {miss} (why it failed) when the generic token is next.
async function mintProjectToken(cfg,{key,admin,stale}){
  const ref=projectMintRef(cfg,key,stale);
  const minted=await mintToken(cfg,{admin,ref,type:'PROJECT_ANALYSIS_TOKEN',projectKey:key,label:key});
  if(minted.present){
    if(!stale)return {token:minted};
    await recordRemint(cfg,{role:'project',projectKey:key,ref,minted:minted.minted,type:'PROJECT_ANALYSIS_TOKEN'});
    return {token:{...minted,reminted:true}};
  }
  if(minted.identityRefusal)return {token:minted};
  return {miss:minted.reason};
}

async function projectToken(cfg,{key,admin,tokenRef,mint=true}={}){
  const refs=[tokenRef,cfg.declaredTokenRef,key?projectTokenRef(key):null].filter(Boolean);
  const {entry,misses,stale,identityRefusal}=await firstAccepted(cfg,refs);
  if(identityRefusal)return {present:false,name:refs.at(-1)??cfg.analysisToken,identityRefusal,reason:misses.join('; ')};
  if(entry)return entry;
  if(key&&mint&&admin?.present){
    const attempt=await mintProjectToken(cfg,{key,admin,stale});
    if(attempt.token)return attempt.token;
    misses.push(attempt.miss);
  }
  const fallback=await genericToken(cfg,{admin:mint?admin:null});
  if(fallback.present)return {...fallback,note:'generic analysis token (project-scoped on this server)'};
  return {present:false,name:refs.at(-1)??cfg.analysisToken,...(stale?{rejected:true}:{}),...(fallback.identityRefusal?{identityRefusal:fallback.identityRefusal}:{}),reason:[...misses,fallback.reason].filter(Boolean).join('; ')};
}

/** The child receives only supplied analysis credentials, validated without encrypted fallback or minting. */
async function sonarEnv(cfg,{base=process.env}={}){
  const token=await suppliedSonarToken(cfg,{validate:value=>tokenAccepted(cfg,value),remember});
  if(!token.present)return {ok:false,custody:custodyView(token)};
  return {ok:true,custody:custodyView(token),env:{...base,...sonarAnalysisEnvironment(cfg),SONAR_HOST_URL:cfg.host,SONAR_TOKEN:token.value}};
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
  const result=containerInspect(cfg.container,'{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}',{docker:cfg.docker,timeout:15000});
  if(result.error)return {container:cfg.container,state:'docker-unavailable',detail:String(result.error.code??result.error.message)};
  if(result.status!==0)return {container:cfg.container,state:'missing',detail:String(result.stderr||'').trim().split(/\r?\n/)[0]||'no such container'};
  const [state,health]=String(result.stdout).trim().split('|');
  return {container:cfg.container,state:state||'unknown',...(health?{health}:{})};
}

/** A plain sentence for a server that does not answer, naming what to do next. */
function downMessage(cfg,server,docker){
  const where=`SonarQube at ${cfg.host} is not reachable (${server.error??'HTTP '+server.status})`;
  if(docker.state==='docker-unavailable')return `${where}; Docker is not available on this machine, so the local server cannot run. Start Docker Desktop, then the source dev stack (${cfg.composeFile}).`;
  if(docker.state==='missing')return `${where}; container ${cfg.container} does not exist. Bring up the source dev stack's SonarQube (${cfg.composeFile}).`;
  if(docker.state==='running'){
    const health=docker.health?` (${docker.health})`:'';
    return `${where}; container ${cfg.container} is running${health} - it may still be starting; retry when /api/system/status reports UP.`;
  }
  return `${where}; container ${cfg.container} is ${docker.state}. Start it: docker start ${cfg.container}-postgres ${cfg.container}`;
}

/** The status outcome and its one-line message once custody was read. */
const statusOutcome=(cfg,server,docker,tokens,up)=>{
  if(!up){
    const message=server.reachable&&server.status===200?`SonarQube at ${cfg.host} answers but reports ${server.json?.status??'unknown'}; wait until it is UP.`:downMessage(cfg,server,docker);
    return {outcome:'down',message};
  }
  if(!tokens.analysis.present||tokens.analysis.valid===false){
    const state=tokens.analysis.present||tokens.analysis.rejected?'rejected by the server':'missing from custody';
    return {outcome:'blocked',message:`the analysis token is ${state} (${tokens.analysis.name}); repair the source stack custody (secret:gen / stack-secret) - never ask the owner for it.`};
  }
  return {outcome:'up'};
};

export async function status(cfg){
  cfg=sonarAdministrativeConfig(cfg);
  const server=await call(cfg,'GET','/api/system/status');
  const up=server.reachable&&server.status===200&&server.json?.status==='UP';
  const docker=containerState(cfg);
  const tokens={};
  const admin=readCustody(cfg,cfg.adminToken,{remember});
  tokens.admin=custodyView(admin);
  if(admin.present&&up)tokens.admin.valid=await tokenAccepted(cfg,admin.value)===true;
  // A generic analysis token the server rejects is re-minted here when the admin token is valid.
  const analysis=up?await genericToken(cfg,{admin:tokens.admin.valid?admin:null}):readCustody(cfg,cfg.analysisToken,{remember});
  tokens.analysis=custodyView(analysis);
  if(up&&(analysis.present||analysis.rejected))tokens.analysis.valid=analysis.via==='minted'||analysis.accepted===true;
  const report={schema:SCHEMA,command:'status',host:cfg.host,publicHost:cfg.publicHost,stack:cfg.stackDir,declaration:cfg.declaration,
    server:{reachable:server.reachable,up,...(server.json?.status?{status:server.json.status}:{}),...(server.json?.version?{version:server.json.version}:{}),...(server.error?{error:server.error}:{})},
    docker,custody:tokens};
  return Object.assign(report,statusOutcome(cfg,server,docker,tokens,up));
}

const KEY_PATTERN=/^(?=.*[A-Za-z_.:-])[A-Za-z0-9_.:-]{1,400}$/;

async function ensureProject(cfg,{key,name}={}){
  cfg=sonarAdministrativeConfig(cfg);
  const base={schema:SCHEMA,command:'ensure-project',host:cfg.host,projectKey:key,...(cfg.declaration?{declaration:cfg.declaration}:{})};
  if(!key||!KEY_PATTERN.test(key))return {...base,outcome:'blocked',message:`invalid project key ${JSON.stringify(key??null)}: letters, digits, - _ . : and at least one non-digit`};
  const admin=readCustody(cfg,cfg.adminToken,{remember});
  if(!admin.present)return {...base,outcome:'blocked',custody:custodyView(admin),...(admin.refusal?{refusal:admin.refusal}:{}),message:admin.reason};
  const found=await call(cfg,'GET',`/api/projects/search?projects=${encodeURIComponent(key)}`,{token:admin.value});
  if(!found.reachable){const docker=containerState(cfg);return {...base,outcome:'blocked',docker,message:downMessage(cfg,found,docker)};}
  if(found.status===401||found.status===403)return {...base,outcome:'blocked',message:`the admin token was refused (HTTP ${found.status}); check ${ADMIN_TOKEN_ENV} in secret.env.`};
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
async function ensureQualityGate(cfg,{key,admin,gate=loadSonarGate()}={}){
  const name=gate.gate.name;
  const base={name,projectKey:key,conditions:serverConditions(gate).length};
  if(!admin?.present)return {...base,outcome:'skipped',message:`${ADMIN_TOKEN_ENV} is not set`};
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
  const synced=await syncGateConditions(cfg,token,name,have,want,failed);
  if(synced.failed)return synced.failed;
  const changed=synced.changed;
  const selected=await call(cfg,'POST','/api/qualitygates/select',{token,form:{gateName:name,projectKey:key}});
  if(selected.status!==200&&selected.status!==204)return failed('select gate',selected);
  const period=gate.gate.newCodePeriod;
  const periodSet=period?await call(cfg,'POST','/api/new_code_periods/set',{token,form:{project:key,type:period.type,value:String(period.value)}}):null;
  if(periodSet&&periodSet.status!==200&&periodSet.status!==204)return failed('new-code period',periodSet);
  return {...base,outcome:'ok',changed};
}

/** Create/update the gate's wanted conditions and drop the rest; {changed} or {failed}. */
const syncGateConditions=(cfg,token,name,have,want,failed)=>syncConditions(call,{cfg,token,name,have,want,failed});

const ESCAPED_QUOTE=String.raw`\"`;
const quote=arg=>/^[\w@%+=:,./\\-]+$/.test(arg)?arg:`"${String(arg).replaceAll('"',ESCAPED_QUOTE)}"`;

/**
 * The repository's own scanner: its `sonar:check` script when it has one (repositories that declare it), otherwise
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

async function runScanner(cwd,{command,args},env,timeoutMs){
  const line=[command,...args].map(quote).join(' ');
  const run=await scanRun(line,{cwd,env,timeoutMs,logCap:LOG_CAP});
  return {...run,log:scrub(run.log),display:line};
}

function gitRevision(cwd){
  const head=git(gitLog,cwd,['-1','--format=%H %ct','HEAD']);
  if(head.status!==0)return {commit:null};
  const [commit,seconds]=head.stdout.trim().split(' ');
  const dirty=git(gitStatus,cwd,['--porcelain','--untracked-files=no']);
  return {commit,committedAt:new Date(Number(seconds)*1000).toISOString(),dirty:dirty.status===0?dirty.stdout.trim().length>0:null};
}

// ---- the slice ------------------------------------------------------------------------------------------

/** GET with the analysis token, retried with the admin token when the analysis user may not browse. */
const read=(cfg,tokens,pathname)=>readWithTokens(call,cfg,tokens,pathname);

const facet=(json,property)=>Object.fromEntries((json?.facets??[]).find(f=>f.property===property)?.values?.map(v=>[v.val,v.count])??[]);

/** Every page of a paged Web API list, or {error} when a page cannot be read. */
const readAll=(cfg,tokens,pathname,listKey)=>readPages(read,cfg,tokens,pathname,listKey);

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
function fileQualifier(props={},pkg=null){
  const defined=Object.fromEntries(String(pkg?.scripts?.['sonar:check']??'').matchAll(/-D([\w.]+)=([^\s"']+)/g).map(m=>[m[1],m[2]]));
  const setting=name=>splitList(defined[name]??props[name]);
  const roots=setting('sonar.tests').map(root=>trimTrailingSlashes(posixPath(root))).filter(Boolean);
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
 * The be unit run over the slice's services alone, writing the lcov Sonar imports: jest from the directory two levels above
 * the lcov report (`be/coverage/lcov.info` -> be/, the preset's coverageDirectory under its rootDir), the unit project, the
 * specs related to `files` and coverage collected from `files` only, so the per-file threshold and the report name exactly
 * the services the slice touched. Returns {exitCode, error}.
 */
function runSliceCoverage({jestCwd,files,timeoutMs=900_000}){
  let bin;
  try{bin=createRequire(path.join(jestCwd,'package.json')).resolve('jest/bin/jest');}
  catch{return {exitCode:null,error:`jest is not installed under ${posixPath(jestCwd)}`};}
  const collect=files.flatMap(file=>['--collectCoverageFrom',file]);
  const run=runNode([bin,'--selectProjects','unit','--coverage','--ci','--coverageReporters','lcov',...collect,'--findRelatedTests',...files],{cwd:jestCwd,timeout:timeoutMs,maxBuffer:64*1024*1024});
  return {exitCode:run.status,error:run.error?String(run.error.message):null};
}

/**
 * Before a slice scan: the services the slice touched (changed files of the coverage scope) get a fresh lcov at
 * sonar.javascript.lcov.reportPaths, written by the be unit run over their related specs (cfg.coverageRunner, default
 * runSliceCoverage), so Sonar imports this slice's coverage and never a stale report. With the owner's specs.unit off
 * (config.yaml `specs`, scripts/route/spec-deferral.mjs) the op writes no unit test and is held to no coverage: nothing
 * runs and the slice's coverage is not judged (`judged` false). Returns {judged, targets, lcov, exitCode?, written?, error?, note?}.
 */
/** What a slice summary says while the owner's specs.unit is off: its coverage is not measured, never read as green. */
const OWNER_MODE_NOTE='owner mode specs.unit=false (config.yaml specs): the slice wrote and ran no unit test, so its coverage is NOT MEASURED - the coverage conditions are neither green nor red, and the slice passes on the other conditions only';

function prepareSliceCoverage(cfg,{cwd,props,slice,gate}){
  if(!gate.overall.coverage)return {judged:false,targets:[],note:'the declared Sonar policy has no coverage condition'};
  const scope=coverageScopeOf(props);
  if(!scope.exclusions.length)return {judged:true,targets:[],note:'the repository declares no sonar.coverage.exclusions'};
  const specs=cfg.specs??specsSettings(inspectOwnerConfig().config);
  if(specs.unit===false)return {judged:false,targets:[],ownerMode:'specs.unit=false',note:OWNER_MODE_NOTE};
  const isTarget=coverageTargetOf(scope);
  const targets=slice.files.map(f=>f.path).filter(file=>isTarget(file)&&fs.existsSync(path.join(cwd,file)));
  if(!targets.length)return {judged:true,targets};
  const lcov=String(props['sonar.javascript.lcov.reportPaths']??'').split(',').map(p=>p.trim()).find(Boolean);
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

/**
 * Judge the slice on the processed analysis against `gate` (thresholdsOf(knowledge/sonar-gate.yaml)): open
 * blocker and critical issues and to-review hotspots on its changed lines (a line-less one only on a file
 * it added), the duplicated share of its changed source lines, and the coverage of every service it touched
 * (a changed file of the coverage scope of `props`, coverageScopeOf; any other file is not a coverage target).
 * A changed file the server does not know (excluded, not source) is listed as not analyzed.
 */
export async function evaluateSlice(cfg,tokens,{key,slice,props={},pkg=null,gate=thresholdsOf(loadSonarGate()),coverageRun=null}){
  return evaluateSliceCore(cfg,tokens,{key,slice,props,pkg,gate,coverageRun},{read,readAll,fileQualifier});
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
  const hash=createHash('sha1').update(`${key}\n${[...scope].sort(byCodeUnit).join('\n')}`).digest('hex').slice(0,10);
  return `${key}-slice-${hash}`.slice(0,400);
}

const testInclusions=(scope,patterns,hasTests,main,isFile)=>{
  if(!patterns.length)return hasTests?main:[];
  const matchers=patterns.flatMap(braceVariants).map(globExpression),tests=[];
  for(const scopePath of scope){
    if(isFile(scopePath)){
      if(matchers.some(matcher=>matcher.test(scopePath)))tests.push(scopePath);
      continue;
    }
    for(const pattern of patterns){
      if(pattern.startsWith('**/'))tests.push(`${scopePath}/${pattern}`);
      else if(pattern.startsWith(`${scopePath}/`))tests.push(pattern);
    }
  }
  return tests;
};

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
  const tests=testInclusions(scope,patterns,Boolean(props['sonar.tests']),main,isFile);
  // SonarJS builds one TypeScript program per tsconfig.json it finds anywhere in the tree: one product
  // repository held 31 (stray copies under .starciwork/kernel-strays and .infra), and a 9-file isolated analysis
  // still spent 19.7 minutes in the JS/TS sensor. The repository's own root tsconfig is the one that
  // types the slice; a declared sonar.typescript.tsconfigPath(s) wins.
  const declaredTsconfig=props['sonar.typescript.tsconfigPaths']||props['sonar.typescript.tsconfigPath'];
  const tsconfig=!declaredTsconfig&&fs.existsSync(path.join(cwd,'tsconfig.json'))?['-Dsonar.typescript.tsconfigPaths=tsconfig.json']:[];
  return [...tsconfig,`-Dsonar.inclusions=${main.join(',')}`,...(patterns.length||props['sonar.tests']?[`-Dsonar.test.inclusions=${tests.length?[...new Set(tests)].join(','):'__starci_no_tests__/**'}`]:[])];
}

// The slice a scan covers (outside project gate mode): the changed lines, or the result that refuses the scan.
const prepareSlice=(cwd,options,summary,finish)=>{
  const slice=sliceChanges(cwd,{base:options.base,paths:options.paths});
  if(!slice.ok)return {result:finish(slice.code==='SLICE_NOT_GIT'?'blocked':'refused',slice.reason,{code:slice.code})};
  summary.slice={base:slice.base,baseCommit:slice.baseCommit,...(slice.baseFallback?{baseFallback:slice.baseFallback}:{}),paths:slice.paths,changedFiles:slice.files.map(f=>f.path)};
  const sliceScope=slice.paths.length?` inside ${slice.paths.join(', ')}`:'';
  if(!slice.files.length)return {result:finish('refused',`the slice changes no file against ${slice.base}${sliceScope}: pass --base <the commit before this slice's first edit> and --paths <its owned paths>`,{code:'SLICE_EMPTY'})};
  return {slice};
};

const prepareScanInputs=(cfg,options,cwd,summary,finish)=>{
  if(!fs.existsSync(path.join(cwd,'package.json'))&&!fs.existsSync(path.join(cwd,'sonar-project.properties')))
    return {result:finish('blocked',`${cwd} has neither package.json nor sonar-project.properties`)};
  const props=readProperties(path.join(cwd,'sonar-project.properties'));
  let pkg=null;
  try{pkg=JSON.parse(fs.readFileSync(path.join(cwd,'package.json'),'utf8'));}catch{/* no manifest */}
  const key=options.key??cfg.declaredKey??props['sonar.projectKey']??(pkg?.name?String(pkg.name).replace(/^@/,'').replaceAll('/','_'):null);
  summary.projectKey=key;
  summary.revision=gitRevision(cwd);
  const gateDoc=loadSonarGate({cwd});
  summary.gate=thresholdsOf(gateDoc);
  if(cfg.declaredQualityGate&&cfg.declaredQualityGate!==gateDoc.gate.name)summary.gate.declarationDrift=`the declaration names quality gate ${cfg.declaredQualityGate}; the gate is ${gateDoc.gate.name}`;
  if(cfg.disabled)return {result:finish('disabled',`Sonar is disabled for this repository: ${cfg.disabled}`)};
  const missing=sonarCredentialRequirements({action:'scan',config:cfg}).filter(row=>!row.present).map(row=>row.name);
  if(missing.length)return {result:finish('blocked',`missing credential inputs: ${missing.join(', ')}`,{missing})};
  if(!key)return {result:finish('blocked','no project key: pass --key or set sonar.projectKey')};
  const projectGateMode=Boolean(options.projectGate);
  summary.scope=projectGateMode?'project':'slice';
  let slice=null;
  if(!projectGateMode){
    const staged=prepareSlice(cwd,options,summary,finish);
    if(staged.result)return staged;
    slice=staged.slice;
  }
  return {cwd,props,pkg,key,gateDoc,slice,projectGateMode};
};

const prepareIsolatedProject=async(cfg,options,{cwd,props,key,slice,admin,gateDoc,summary})=>{
  const state={key,extra:[],isolated:null};
  if(!(options.isolate&&slice))return state;
  const scope=slice.paths.length?slice.paths:slice.files.map(f=>f.path);
  if(!admin.present)summary.isolated={skipped:`the admin token is not in custody (${admin.reason}): the full analysis runs instead`};
  else{
    const sliceKey=isolatedKey(key,scope);
    const ensured=await ensureProject(cfg,{key:sliceKey,name:`${key} slice ${sliceKey.slice(-10)}`});
    if(ensured.outcome!=='ok')summary.isolated={skipped:`the slice project could not be created (${ensured.message}): the full analysis runs instead`};
    else{
      state.isolated={projectKey:sliceKey,parentKey:key,scope};
      summary.isolated=state.isolated;
      state.key=sliceKey;
      summary.projectKey=state.key;
      if(options.ensure!==false)summary.qualityGate={...summary.qualityGate,isolatedSelect:(await ensureQualityGate(cfg,{key:sliceKey,admin,gate:gateDoc})).outcome};
      state.extra.push(...isolationDefines(cwd,props,scope));
    }
  }
  return state;
};

// The refusal when the Sonar server is not UP (with its container's state), else null.
const serverDownResult=(cfg,server,finish)=>{
  if(server.reachable&&server.json?.status==='UP')return null;
  const docker=containerState(cfg),serverStatus=server.json?.status??`HTTP ${server.status}`;
  const reason=server.reachable?`SonarQube at ${cfg.host} reports ${serverStatus}`:downMessage(cfg,server,docker);
  return {result:finish('blocked',reason,{docker})};
};

const prepareScanExecution=async(cfg,options,inputs,summary,finish)=>{
  const {cwd,props,pkg,key,gateDoc,slice}=inputs;
  const server=await call(cfg,'GET','/api/system/status');
  const down=serverDownResult(cfg,server,finish);
  if(down)return down;
  summary.serverVersion=server.json.version;
  const token=await suppliedSonarToken(cfg,{validate:value=>tokenAccepted(cfg,value),remember});
  summary.custody={analysis:custodyView(token)};
  if(!token.present)return {result:finish('blocked',token.reason)};
  const admin=(options.isolate||options.ensure===true)&&sonarAdminForAnalysis(cfg)?readCustody(cfg,cfg.adminToken,{remember}):{present:false,name:cfg.adminToken,reason:'the analysis server has separate provisioning'};
  summary.custody.admin=custodyView(admin);
  if(options.ensure!==false){
    const ensured=admin.present?await ensureProject(cfg,{key,name:cfg.declaredName??props['sonar.projectName']??key}):{outcome:'skipped',message:`${ADMIN_TOKEN_ENV} is not set`};
    summary.project={outcome:ensured.outcome,...(ensured.created!==undefined?{created:ensured.created}:{}),...(ensured.message?{message:ensured.message}:{})};
  }
  if(options.ensure!==false)summary.qualityGate=await ensureQualityGate(cfg,{key,admin,gate:gateDoc});
  const isolation=await prepareIsolatedProject(cfg,options,{cwd,props,key,slice,admin,gateDoc,summary});
  const coverageRun=slice?prepareSliceCoverage(cfg,{cwd,props,slice,gate:gateDoc}):null;
  if(coverageRun)summary.coverageRun=coverageRun;
  if(coverageRun?.ownerMode==='specs.unit=false')summary.ownerMode={specs:{unit:false},coverage:'not-measured',note:coverageRun.note};
  const analysisToken=token.value;
  const childEnv={...sonarAnalysisEnvironment(cfg),SONAR_HOST_URL:cfg.host,SONAR_TOKEN:analysisToken};
  const workDir=makeTempDir('starci-sonar-');
  return {cwd,props,pkg,gateDoc,slice,projectGateMode:inputs.projectGateMode,key:isolation.key,admin,isolated:isolation.isolated,extra:[...(options.defines??[]),...isolation.extra],
    coverageRun,analysisToken,tokenName:token.name,childEnv,workDir};
};

const submitScan=async(cfg,options,setup,summary,finish)=>{
  const plan=scannerCommand({pkg:setup.pkg,props:setup.props,host:cfg.host,key:setup.key,workDir:setup.workDir,extra:setup.extra});
  const run=await runScanner(setup.cwd??path.resolve(options.cwd??process.cwd()),plan,setup.childEnv,Number(options.timeoutSec??1800)*1000);
  summary.scanner={runner:plan.runner,command:scrub(run.display),exitCode:run.exitCode,durationMs:run.durationMs};
  if(options.log){fs.mkdirSync(path.dirname(path.resolve(options.log)),{recursive:true});fs.writeFileSync(options.log,`$ ${scrub(run.display)}\n${run.log}`);summary.scanner.log=path.resolve(options.log);}
  if(options.blob){
    const stored=await emitCheckOutput(`$ ${scrub(run.display)}\n${run.log}`,{blob:true,mediaType:'text/plain',put:options.put,write:()=>{}});
    summary.scanner.logSha=stored.sha;
  }
  const report=readProperties(path.join(setup.workDir,'report-task.txt'));
  if(!report.ceTaskId){
    const tail=run.log.trim().split(/\r?\n/).slice(-3).join(' | ');
    const outcome=/\b401\b|not authori[sz]ed|unauthori[sz]ed/i.test(run.log)?'blocked':'fail';
    return {result:finish(outcome,`the scanner submitted no analysis (exit ${run.exitCode}) with ${setup.tokenName}: ${tail}`)};
  }
  summary.ceTask={id:report.ceTaskId};
  summary.dashboardUrl=report.dashboardUrl??`${cfg.host}/dashboard?id=${encodeURIComponent(setup.key)}`;
  summary.publicDashboardUrl=`${cfg.publicHost}/dashboard?id=${encodeURIComponent(setup.key)}`;
  return {report};
};

const waitForScan=async(cfg,options,setup,report,summary,finish)=>{
  const tokens=[setup.analysisToken],deadline=Date.now()+Number(options.waitSec??600)*1000;
  let task;
  const stopped=await repeatInOrder(async()=>{
    const polled=await read(cfg,tokens,`/api/ce/task?id=${encodeURIComponent(report.ceTaskId)}`);
    task=polled.json?.task;
    if(!polled.reachable||polled.status!==200){
      const detail=polled.error??`HTTP ${polled.status}`;
      return {result:finish('blocked',`compute-engine task ${report.ceTaskId} could not be read: ${detail}`)};
    }
    if(['SUCCESS','FAILED','CANCELED'].includes(task?.status))return null;
    if(Date.now()>deadline)return {result:finish('blocked',`compute-engine task ${report.ceTaskId} still ${task?.status} after the wait`)};
    await new Promise(r=>setTimeout(r,cfg.pollMs));return undefined;
  });if(stopped)return stopped;
  summary.ceTask.status=task.status;
  summary.analysisId=task.analysisId??null;
  if(task.status!=='SUCCESS'){
    const detail=task.errorMessage?` - ${scrub(task.errorMessage)}`:'';
    return {result:finish('fail',`the server did not process the analysis: ${task.status}${detail}`)};
  }
  return {task,tokens};
};

const finishScan=async(cfg,setup,taskState,summary,finish)=>{
  const {task,tokens}=taskState,key=setup.key;
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
  if(projectGate.status==='OK'&&!projectGate.conditions.length)projectGate.note='no condition was evaluated (a first analysis has no new code); read the overall measures';
  const projectFailures=projectGate.conditions.filter(c=>c.status==='ERROR').map(c=>`${c.metric} ${c.actual} vs ${c.comparator} ${c.threshold}`);
  if(setup.projectGateMode){
    if(projectGate.status==='OK')return finish('pass');
    if(projectGate.status==='ERROR')return finish('fail','the quality gate failed: '+projectFailures.join(', '));
    const status=projectGate.status??`HTTP ${gate.status}`;
    return finish('blocked',`no quality-gate result for the analysis (status ${status})`);
  }
  const failureNote=projectFailures.length?` (project gate: ${projectFailures.join(', ')})`:'';
  projectGate.note=[`whole-project debt, reported and not a block: the slice verdict decides${failureNote}`,projectGate.note].filter(Boolean).join('; ');
  const judged=await evaluateSlice(cfg,tokens,{key,slice:setup.slice,props:setup.props,pkg:setup.pkg,gate:summary.gate,coverageRun:setup.coverageRun});
  if(judged.error)return finish('blocked',judged.error);
  Object.assign(summary.slice,judged.result);
  if(judged.refused)return finish('refused',judged.refused.reason,{code:judged.refused.code});
  if(judged.result.verdict==='pass')return finish('pass');
  return finish('fail',`the slice fails on new code: ${judged.result.failures.join('; ')}`);
};

export async function scan(cfg,options={}){
  const cwd=path.resolve(options.cwd??process.cwd());
  const summary={schema:SCAN_SCHEMA,at:new Date().toISOString(),host:cfg.host,publicHost:cfg.publicHost,cwd,stack:cfg.stackDir,declaration:cfg.declaration};
  const finish=(outcome,reason,extra={})=>Object.assign(summary,extra,{outcome,...(reason?{reason}:{}),...(outcome==='blocked'?{unavailable:true}:{})});
  const inputs=prepareScanInputs(cfg,options,cwd,summary,finish);
  if(inputs.result)return inputs.result;
  const setup=await prepareScanExecution(cfg,options,inputs,summary,finish);
  if(setup.result)return setup.result;
  try{
    const submitted=await submitScan(cfg,options,setup,summary,finish);
    if(submitted.result)return submitted.result;
    if(!options.wait)return finish('submitted','scanner submission alone is not a pass; rerun with --wait for the processed quality gate');
    const completed=await waitForScan(cfg,options,setup,submitted.report,summary,finish);
    if(completed.result)return completed.result;
    return await finishScan(cfg,setup,completed,summary,finish);
  }finally{
    safeRemove(setup.workDir,{hold:artifactHoldReason});
    // The throwaway slice project is judged and gone: the next scan of the same scope re-creates it.
    if(setup.isolated&&!options.keepSliceProject){
      const removed=await call(cfg,'POST','/api/projects/delete',{token:setup.admin.value,form:{project:setup.isolated.projectKey}}).catch(error=>({status:0,error:String(error?.message??error)}));
      setup.isolated.deleted=removed.status===204||removed.status===200;
      if(!setup.isolated.deleted)setup.isolated.deleteError=`HTTP ${removed.status??0} ${removed.text??removed.error??''}`.trim();
    }
  }
}

/** The dashboard metrics of a project: the issue types, the hotspots and the coverage of knowledge/sonar-gate.yaml `overall`. */
const dashboardMetrics=gate=>[...Object.keys(gate.overall.issues.types),'security_hotspots',gate.overall.hotspots.metric,gate.overall.duplication.metric,...(gate.overall.coverage?[gate.overall.coverage.metric]:[])];
const httpStatusLabel=response=>`HTTP ${response.status}`;
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
  const gate=loadSonarGate({cwd});
  const scope=coverageScopeOf(props);
  const summary={schema:SCHEMA,command:'dashboard',at:new Date().toISOString(),host:cfg.host,cwd,projectKey:key,coverageExclusions:scope.exclusions};
  const finish=(outcome,reason,extra={})=>Object.assign(summary,extra,{outcome,...(reason?{reason}:{})});
  if(cfg.disabled)return finish('disabled',`Sonar is disabled for this repository: ${cfg.disabled}`);
  const missing=sonarCredentialRequirements({action:'scan',config:cfg}).filter(row=>!row.present).map(row=>row.name);
  if(missing.length)return finish('blocked',`missing credential inputs: ${missing.join(', ')}`,{missing});
  if(!key)return finish('blocked','no project key: pass --key or set sonar.projectKey');
  const server=await call(cfg,'GET','/api/system/status');
   if(!(server.reachable&&server.json?.status==='UP'))return finish('blocked',server.reachable?`SonarQube at ${cfg.host} reports ${server.json?.status??httpStatusLabel(server)}`:downMessage(cfg,server,containerState(cfg)));
  const token=await suppliedSonarToken(cfg,{validate:value=>tokenAccepted(cfg,value),remember});
  if(!token.present)return finish('blocked',token.reason);
  const tokens=[token.value];
  const component=encodeURIComponent(key),onBranch=options.branch?`&branch=${encodeURIComponent(options.branch)}`:'';
  const project=await read(cfg,tokens,`/api/measures/component?component=${component}&metricKeys=${dashboardMetrics(gate).join(',')}${onBranch}`);
  if(project.status===404)return finish('blocked',`${key} has no analysis on ${cfg.host}: run scan --project-gate --wait first`);
  if(!project.reachable||project.status!==200)return finish('blocked',`the measures of ${key} could not be read: ${project.error??httpStatusLabel(project)}`);
  const measures=Object.fromEntries((project.json?.component?.measures??[]).map(m=>[m.metric,m.value]));
  const tree=gate.overall.coverage?await readAll(cfg,tokens,`/api/measures/component_tree?component=${component}&metricKeys=${gate.overall.coverage.metric}&qualifiers=FIL${onBranch}`,'components'):{items:[]};
  if(tree.error)return finish('blocked',`the per-file coverage of ${key} could not be read: ${tree.error}`);
  const files=tree.items.map(item=>({path:item.path,coverage:(item.measures??[]).find(m=>m.metric===gate.overall.coverage.metric)?.value??null}));
  const judged=judgeDashboard({measures,files,scope},gate);
  summary.dashboardUrl=`${cfg.host}/dashboard?id=${component}${onBranch}`;
  summary.numbers=judged.numbers;
  summary.coverage=judged.coverage;
  summary.failures=judged.failures;
  return finish(judged.verdict,judged.failures.length?`the dashboard fails: ${judged.failures.join('; ')}`:null);
}

// ---- CLI ------------------------------------------------------------------------------------------------

const HELP=`Usage: starci gate sonar <command> [options]

  status                                  server, container, custody presence and token validity
  up [--public] | stop [--public]         start / stop the self-hosted stack of ext/sonar; its secrets come from secret.env
  ensure-project --key K [--name N]       create the project on the local server when it is missing;
                 [--with-token [--token-ref REF]] also make sure a project analysis token is in custody
  token [--key K] [-- command args...]    run a command with SONAR_TOKEN and SONAR_HOST_URL in its env;
                                          alone it reports custody presence (never the value)
  scan --cwd REPO [--key K] [--wait]      run the repository scanner against the local server
       [--base REV] [--paths P1,P2]     judge the slice: lines REV..working tree changed inside the paths
       [--project-gate]                 (default base HEAD); --project-gate judges the whole-project gate instead
       [--out FILE.json | --blob] [--log FILE.txt] [--no-ensure] [--timeout SEC] [--wait-timeout SEC]
       [--isolate] [--keep-slice-project] analyse only --paths in a throwaway project (minutes, not a whole-repo scan)
  dashboard --cwd REPO [--key K] [--branch B]  the dashboard numbers of the last analysis (of branch B when given): bugs, code smells,
                                          vulnerabilities, hotspots reviewed, coverage and the coverage of every
                                          file of the coverage scope; fails unless all are at the gate

  common: [--cwd REPO] [--declaration FILE] [--host URL] [--stack DIR]
          host, stack, custody and project keys come from the repository's .starcistacks/application-stacks.yaml
          quality.sonar declaration when it has one, else ${DEFAULT_HOST} and the source host's .starcistacks/dev
Exit 0 pass/up/ok, 1 failing result or refused scan (empty slice), 2 blocked or usage.`;

const BOOLEAN_FLAGS=new Map([['--wait','wait'],['--no-ensure','ensure'],['--with-token','withToken'],['--project-gate','projectGate'],
  ['--isolate','isolate'],['--public','publicTunnel'],['--keep-slice-project','keepSliceProject'],['--blob','blob'],['--help','help'],['-h','help']]);
const parseArgument=(out,argv,index)=>{
  const arg=argv[index];
  if(arg==='--'){out.rest=argv.slice(index+1);return argv.length;}
  const boolean=BOOLEAN_FLAGS.get(arg);
  if(boolean){out[boolean]=arg!=='--no-ensure';return index;}
  if(!arg.startsWith('--')){out._.push(arg);return index;}
  const [flag,inline]=arg.slice(2).split(/=(.*)/s),name=flag.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
  const value=inline??argv[index+1];
  out[name]=name==='paths'&&out.paths?`${out.paths},${value}`:value;
  return inline===undefined?index+1:index;
};
function parseArgs(argv){
  const out={_:[],rest:null};
  for(let index=0,nextIndex=0;index<argv.length;index=nextIndex){
    nextIndex=parseArgument(out,argv,index)+1;
    if(out.rest!==null)break;
  }
  return out;
}

const exitFor=outcome=>({up:0,ok:0,pass:0,present:0,submitted:0,disabled:0,fail:1,refused:1}[outcome]??2);

const ensureProjectReport=async(cfg,args,key)=>{
  const report=await ensureProject(cfg,{key,name:args.name??cfg.declaredName});
  if(report.outcome==='ok'&&args.withToken){
    const token=await projectToken(cfg,{key,admin:readCustody(cfg,cfg.adminToken,{remember}),tokenRef:args.tokenRef});
    report.tokenCustody=custodyView(token);
    if(!token.present)Object.assign(report,{outcome:'blocked',message:`no analysis token for ${key}: ${token.reason}`});
  }
  return report;
};
const tokenCommandResult=async(cfg,args,key,env)=>{
  const child=await sonarEnv(cfg,{base:env});
  if(child.ok&&args.rest?.length)return {direct:{exitCode:runShell(args.rest.map(quote).join(' '),child.env)}};
  return {report:{schema:SCHEMA,command:'token',host:cfg.host,...(key?{projectKey:key}:{}),custody:child.custody,outcome:child.ok?'present':'blocked'}};
};
const runSonarCommand=async(args,cfg,key,env,put)=>{
  const command=args._[0];
  if(command==='status')return {report:await status(cfg)};
  if(command==='ensure-project')return {report:await ensureProjectReport(cfg,args,key)};
  if(command==='up'||command==='stop')return {report:{schema:SCHEMA,...(command==='up'?stackUp:stackStop)(cfg,{env:sonarAnalysisEnvironment(cfg),publicTunnel:args.publicTunnel===true,scrub,remember})}};
  if(command==='token')return tokenCommandResult(cfg,args,key,env);
  if(command==='scan'){
    const report=await scan(cfg,{cwd:args.cwd,key:args.key,wait:args.wait,out:args.out,log:args.log,blob:args.blob,put,tokenRef:args.tokenRef,ensure:args.ensure,timeoutSec:args.timeout,waitSec:args.waitTimeout,
      base:args.base,paths:args.paths,projectGate:args.projectGate,isolate:args.isolate,keepSliceProject:args.keepSliceProject});
    if(args.out)await emitCheckOutput(`${scrub(JSON.stringify(report,null,2))}\n`,{out:args.out});
    return {report};
  }
  if(command==='dashboard'){
    const report=await dashboard(cfg,{cwd:args.cwd,key:args.key,branch:args.branch,tokenRef:args.tokenRef});
    if(args.out)await emitCheckOutput(`${scrub(JSON.stringify(report,null,2))}\n`,{out:args.out});
    return {report};
  }
  return {direct:{exitCode:2,text:`sonar-local: unknown command ${command}\n\n${HELP}`}};
};

// The text result of a command line the CLI does not run (help, no command, a token reference on an analysis), or null.
const commandRefusal=(args,command)=>{
  if(args.help||!command)return {exitCode:args.help?0:2,text:HELP};
  if(sonarAnalysisAction(command)&&args.tokenRef!==undefined)return {exitCode:2,text:'sonar-local: --token-ref belongs to administrative provisioning; analysis uses the supplied SONAR_TOKEN'};
  return null;
};

const commandConfig=(args,config,env,command)=>{
  const cfg=resolveConfig({...config,...(args.host?{host:args.host}:{}),...(args.stack?{stack:args.stack}:{}),...(args.cwd?{cwd:args.cwd}:{}),...(args.declaration?{declaration:args.declaration}:{})},env);
  return command==='status'||command==='ensure-project'||command==='up'||command==='stop'?sonarAdministrativeConfig(cfg):cfg;
};

export async function sonarLocalMain(argv=[],{env=process.env,config,put=null}={}){
  const args=parseArgs(argv);
  if(args.out&&args.blob)return {exitCode:2,text:'sonar-local: --out and --blob are mutually exclusive'};
  if(args.cwd)args.cwd=resolveScanCwd(args.cwd);
  const command=args._[0];
  const refused=commandRefusal(args,command);
  if(refused)return refused;
  const cfg=commandConfig(args,config,env,command);
  const key=args.key??cfg.declaredKey??undefined;
  const result=await runSonarCommand(args,cfg,key,env,put);
  if(result.direct)return result.direct;
  const report=result.report;
  const safeReport=JSON.parse(scrub(JSON.stringify(report)));
  const blob=args.blob?await emitCheckOutput(`${JSON.stringify(safeReport,null,2)}\n`,{blob:true,put,write:()=>{}}):null;
  return {exitCode:exitFor(report.outcome),report:safeReport,...(blob?{blob}:{})};
}

if(isMain(import.meta.url)){
  try{
    const {exitCode,report,text,blob}=await sonarLocalMain(process.argv.slice(2));
    if(text)process.stdout.write(`${text}\n`);
    if(blob)process.stdout.write(`${JSON.stringify(blob)}\n`);
    else if(report)process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
    process.exitCode=exitCode;
  }catch(error){process.stderr.write(`sonar-local: ${scrub(error?.stack??error)}\n`);process.exitCode=2;}
}
