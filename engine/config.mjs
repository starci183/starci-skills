import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {skillRoot} from './runtime-root.mjs';
import {parseYaml} from './yaml.mjs';
import {isPlainObject as plain} from './plain-object.mjs';
import {invalid,validateRoots} from './invalid-config.mjs';
import {validateOrca} from './orca-config.mjs';
import {ENV_NAME,secretEnv,connectorSecret} from './secrets.mjs';
// config.mjs is copied into a relocated install without scripts/lib, so the error-message name list sorts here (display only).
const knownNames=names=>[...names].sort((a,b)=>a<b?-1:a>b?1:0).join(', ');
export {readDotenv,connectorSecret} from './secrets.mjs';

export const configRoot=skillRoot;
export const NON_OPERATION_ROLES={planner:'plan',kernelManager:'decide',validator:'verify'};
export const DEFAULT_MODEL_POOLS={'sol-opus':['claude-agent','codex-agent']};
/** The owner-facing language when config.yaml `language` is absent — the one default every reader shares (scripts/lib/i18n.mjs ownerLanguage). A base-tier value: machine (home.mjs) re-exports it, not the reverse. */
export const DEFAULT_OWNER_LANGUAGE='en';
const ADAPTIVE_ALLOCATION_MODE='adaptive';
/** The effort vocabulary, ordered weakest to strongest — the only list of it. */
const EFFORT_LEVELS=['none','minimal','low','medium','high','xhigh','max','ultra'];
// Parsed once per file version (mtime + size) per process; each caller gets its own copy.
// The one runtimes.yaml loader: it throws on a missing or unparsable file, so no caller ever
// reasons on a silent empty document. The pool map (provider, roles, models, maxParallel)
// lives in the ONE model catalog — modules/models/registry.yaml `pools` — and is merged in
// under `runtimes` so consumers read the same shape as before.
let runtimeProfileCache=null;
export function runtimeProfile(){
  const source=fileURLToPath(new URL('../modules/models/runtimes.yaml',import.meta.url));
  const registryFile=fileURLToPath(new URL('../modules/models/registry.yaml',import.meta.url));
  let stat;try{stat=fs.statSync(source);}catch{throw Error('Missing modules/models/runtimes.yaml');}
  let rstat;try{rstat=fs.statSync(registryFile);}catch{throw Error('Missing modules/models/registry.yaml');}
  const version=`${stat.mtimeMs}:${stat.size}:${rstat.mtimeMs}:${rstat.size}`;
  if(runtimeProfileCache?.version!==version){
    const doc=parseYaml(fs.readFileSync(source,'utf8'));
    const registry=parseYaml(fs.readFileSync(registryFile,'utf8'));
    runtimeProfileCache={version,profile:{...(doc??{}),runtimes:registry?.pools??{},models:registry?.models??{}}};
  }
  return structuredClone(runtimeProfileCache.profile);
}
/**
 * modules/models/runtimes.yaml `allocation` — where the workers' operating numbers live: the dispatch lease
 * TTL, the liveness and cadence windows, the slicing weights, the failure cooldowns. Code reads them from
 * here; a literal copy of any of them in a source file would be a second authority.
 */
export function allocationSettings(){return runtimeProfile()?.allocation??{};}
// These are current owner declarations, never a historical runtime owner's consent.
function validateOwnerProfile(value,name,pathsKey){
  if(value===null)return;
  const bad=invalid(name);
  if(!plain(value))bad(' must be an owner approval mapping or null.');
  const keys=['approvedBy','approvalRef',pathsKey,...(name==='launchTrust'?['profile']:[])];
  for(const key of Object.keys(value))if(!keys.includes(key))bad(` has unknown key ${key}.`);
  if(value.approvedBy!=='owner')bad('.approvedBy must be owner; adoption must come from the current owner.');
  if(typeof value.approvalRef!=='string'||!value.approvalRef.trim())bad('.approvalRef must identify the current owner approval.');
  if(name==='launchTrust'&&!['automatic','declined'].includes(value.profile))bad('.profile must be automatic or declined.');
  const paths=value[pathsKey];
  if(!Array.isArray(paths)||!paths.length||paths.some(p=>typeof p!=='string'||!(path.isAbsolute(p)||path.win32.isAbsolute(p))||/[\r\n\0]/.test(p)))bad(`.${pathsKey} must list exact absolute repository roots.`);
}
export function launchTrustSettings(config=loadConfig()){
  const value=config?.launchTrust??null;validateOwnerProfile(value,'launchTrust','roots');return value;
}
export function workflowPurgeSettings(config=loadConfig()){
  const retention=config?.retention??null;
  if(retention===null)return null;
  const bad=invalid('retention');
  if(!plain(retention)||Object.keys(retention).some(k=>k!=='workflowPurge'))bad(' must be {workflowPurge?} or null.');
  const value=retention.workflowPurge??null;validateOwnerProfile(value,'retention.workflowPurge','repos');return value;
}
/** One positive millisecond value out of `allocation`, by dotted key. Refuses when the contract omits it. */
export function allocationMs(dotted){
  const raw=dotted.split('.').reduce((node,key)=>(node==null?node:node[key]),allocationSettings());
  const value=Number(raw);
  if(!Number.isFinite(value)||value<=0)throw Error(`modules/models/runtimes.yaml allocation.${dotted} must declare a positive number of milliseconds`);
  return value;
}
/**
 * modules/models/runtimes.yaml allocation.slicing.gears — the declared gear vocabulary. A gear is an
 * index into allocation.slicing.size.<class>.agents, so the two lists are one authority; code never
 * carries a literal gear. Refuses when the contract omits the list or spells it with a non-integer.
 */
export function slicingGears(){
  const gears=allocationSettings()?.slicing?.gears;
  if(!Array.isArray(gears)||!gears.length||gears.some(value=>!Number.isInteger(value)||value<1))
    throw Error('modules/models/runtimes.yaml allocation.slicing.gears must declare a non-empty list of positive integers');
  return [...gears];
}
/** The gear an absent `parallel` block means. The first declared gear, never a literal. */
export const defaultParallelGear=()=>slicingGears()[0];
/** The owner's parallelism gear: config.yaml `parallel.gear`, or the first declared gear when absent. */
export function parallelGear(config=loadConfig()){
  validateConfig(config);
  return config?.parallel?.gear??defaultParallelGear();
}
/**
 * config.yaml `connectors` — the owner's public ask channel (docs/connectors.md). Everything defaults off.
 * Secrets never live here: `tokenEnv`/`botTokenEnv` NAME the environment variable holding the secret
 * (or `<NAME>_FILE` pointing at a custody file); a value that is not an env var name is refused, so a
 * pasted token fails closed instead of landing in a plain-text file.
 */
const CLOUDFLARE_MODES=['off','quick','named'];
/** The serve-ask port band, both ends included (scripts/kernel/ask-server.mjs scans [first..last]); the gateway stays outside it. */
export const ASK_PORT_BAND=[6969,7069];
export const CONNECTOR_DEFAULTS=Object.freeze({
  repos:[],
  gateway:{port:7070},
  cloudflare:{mode:'off',tunnel:null,credentialsFile:null,tokenEnv:'CLOUDFLARE_TUNNEL_TOKEN',hostname:null,access:false},
  telegram:{enabled:false,botTokenEnv:'TELEGRAM_BOT_TOKEN',chatId:null,exposeCredentialAsks:false},
});
const HOSTNAME=/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const TUNNEL_REF=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const CHAT_ID=/^(?:-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/;
const SECRET_KEYS=['token','tunnelToken','botToken','secret','apiToken','password'];
function validateConnectors(connectors){
  if(connectors===null)return;
  const bad=invalid('connectors');
  if(!plain(connectors))bad(' must be {repos?, gateway?, cloudflare?, telegram?} or null.');
  const closed=(node,where,keys)=>{
    if(!plain(node))bad(`.${where} must be a mapping.`);
    for(const key of Object.keys(node)){
      if(SECRET_KEYS.includes(key))bad(`.${where}.${key}: secrets never live in config.yaml — set the environment variable the *Env key names instead.`);
      if(!keys.includes(key))bad(`.${where} has unknown key ${key} (allowed: ${keys.join(', ')}).`);
    }
  };
  closed(connectors,'',['repos','gateway','cloudflare','telegram']);
  if(connectors.repos!==undefined&&(!Array.isArray(connectors.repos)||connectors.repos.some(repo=>typeof repo!=='string'||!repo.trim())))bad('.repos must be a list of repository paths.');
  if(connectors.gateway!==undefined){
    closed(connectors.gateway,'gateway',['port']);
    const port=connectors.gateway.port;
    if(port!==undefined&&(!Number.isInteger(port)||port<1024||port>65535||(port>=ASK_PORT_BAND[0]&&port<=ASK_PORT_BAND[1])))
      bad(`.gateway.port must be an integer port in 1024..65535 outside the serve-ask band ${ASK_PORT_BAND.join('..')}.`);
  }
  const envName=(where,value)=>{if(value!==undefined&&(typeof value!=='string'||!ENV_NAME.test(value)))bad(`.${where} must name an environment variable (UPPER_SNAKE), never hold the secret itself.`);};
  if(connectors.cloudflare!==undefined){
    const cf=connectors.cloudflare;
    closed(cf,'cloudflare',['mode','tunnel','credentialsFile','tokenEnv','hostname','access']);
    if(cf.mode!==undefined&&!CLOUDFLARE_MODES.includes(cf.mode))bad(`.cloudflare.mode must be one of ${CLOUDFLARE_MODES.join(' | ')}.`);
    envName('cloudflare.tokenEnv',cf.tokenEnv);
    if(cf.hostname!==undefined&&cf.hostname!==null&&(typeof cf.hostname!=='string'||!HOSTNAME.test(cf.hostname)))bad('.cloudflare.hostname must be a bare hostname (no scheme, no path) or null.');
    if(cf.access!==undefined&&typeof cf.access!=='boolean')bad('.cloudflare.access must be true or false.');
    if(cf.tunnel!==undefined&&cf.tunnel!==null&&(typeof cf.tunnel!=='string'||!TUNNEL_REF.test(cf.tunnel)))bad('.cloudflare.tunnel must be the named tunnel UUID (or name) or null.');
    if(cf.credentialsFile!==undefined&&cf.credentialsFile!==null&&(typeof cf.credentialsFile!=='string'||!cf.credentialsFile.trim()))bad('.cloudflare.credentialsFile must be the tunnel credentials JSON path or null.');
    if(cf.credentialsFile&&!cf.tunnel)bad('.cloudflare.credentialsFile needs cloudflare.tunnel (the tunnel UUID the credentials belong to).');
    if(cf.mode==='named'&&!cf.hostname)bad('.cloudflare.mode named needs cloudflare.hostname (the public hostname routed to the gateway).');
    if(cf.mode==='quick'&&(cf.tunnel||cf.credentialsFile))bad('.cloudflare.mode quick runs no named tunnel; tunnel/credentialsFile are for mode named.');
    if(cf.mode==='quick'&&cf.hostname)bad('.cloudflare.mode quick gets a random trycloudflare.com hostname; set hostname only for mode named.');
  }
  if(connectors.telegram!==undefined){
    const tg=connectors.telegram;
    closed(tg,'telegram',['enabled','botTokenEnv','chatId','exposeCredentialAsks']);
    if(tg.enabled!==undefined&&typeof tg.enabled!=='boolean')bad('.telegram.enabled must be true or false.');
    envName('telegram.botTokenEnv',tg.botTokenEnv);
    if(tg.chatId!==undefined&&tg.chatId!==null&&!((Number.isSafeInteger(tg.chatId))||(typeof tg.chatId==='string'&&CHAT_ID.test(tg.chatId))))
      bad('.telegram.chatId must be a numeric chat id, an @channel name, or null.');
    if(tg.exposeCredentialAsks!==undefined&&typeof tg.exposeCredentialAsks!=='boolean')bad('.telegram.exposeCredentialAsks must be true or false.');
    if(tg.enabled===true&&(tg.chatId===undefined||tg.chatId===null))bad('.telegram.enabled needs telegram.chatId.');
  }
}
/** Load connector credentials from the explicitly verified runtime main; never print the returned environment. */
export function connectorEnv(config,env=process.env,verifiedRuntimeRoot){return secretEnv(verifiedRuntimeRoot,env);}
/**
 * The normalized `connectors` block: defaults filled in, the secrets' PRESENCE (booleans, never values),
 * whether each connector is ready to run, and the owner-facing warnings the security posture earns.
 */
export function connectorsConfig(config=loadConfig(),env=process.env,root=configRoot){
  validateConfig(config);
  const raw=plain(config?.connectors)?config.connectors:{},d=CONNECTOR_DEFAULTS;
  const cloudflare={...d.cloudflare,...(raw.cloudflare??{})},telegram={...d.telegram,...(raw.telegram??{})};
  if(cloudflare.credentialsFile)cloudflare.credentialsFile=path.resolve(root,cloudflare.credentialsFile.replace(/^~(?=[\\/])/,env.USERPROFILE??env.HOME??'~'));
  cloudflare.tokenPresent=connectorSecret(cloudflare.tokenEnv,env)!==null;
  cloudflare.credentialsPresent=Boolean(cloudflare.credentialsFile&&fs.existsSync(cloudflare.credentialsFile));
  cloudflare.auth=cloudflare.mode!=='named'?null:cloudflare.credentialsFile?'credentials-file':'token';
  cloudflare.publicBase=cloudflare.mode==='named'?`https://${cloudflare.hostname}`:null;
  telegram.chatId=telegram.chatId===null?null:String(telegram.chatId);
  telegram.botTokenPresent=connectorSecret(telegram.botTokenEnv,env)!==null;
  telegram.configured=telegram.enabled===true&&telegram.chatId!==null&&telegram.botTokenPresent;
  const warnings=[];
  if(cloudflare.mode==='quick')warnings.push('cloudflare.mode quick: the ask link is public and unauthenticated — anyone holding the URL can open and answer the form; the hostname changes on every restart.');
  if(cloudflare.mode==='named'&&!cloudflare.access)warnings.push(`cloudflare.access is false: ${cloudflare.hostname} is not fronted by Cloudflare Access, so the nonce URL is the only credential.`);
  if(cloudflare.auth==='credentials-file'&&!cloudflare.credentialsPresent)warnings.push(`cloudflare.credentialsFile ${cloudflare.credentialsFile} does not exist.`);
  if(cloudflare.auth==='token'&&!cloudflare.tokenPresent)warnings.push(`cloudflare.mode named: the tunnel token is not set — export ${cloudflare.tokenEnv} (or ${cloudflare.tokenEnv}_FILE).`);
  if(telegram.enabled&&!telegram.botTokenPresent)warnings.push(`telegram.enabled: the bot token is not set — export ${telegram.botTokenEnv} (or ${telegram.botTokenEnv}_FILE).`);
  if(telegram.exposeCredentialAsks)warnings.push('telegram.exposeCredentialAsks is true: credential asks are posted as public links; Telegram cloud chats are not end-to-end encrypted.');
  return {repos:[...(raw.repos??d.repos)],gateway:{...d.gateway,...(raw.gateway??{})},cloudflare,telegram,warnings};
}
/**
 * config.yaml `asks` — whether an owner ask that carries a recommended option is answered with it
 * instead of being served (scripts/kernel/ask-server.mjs autoAcceptAsk). `excludes` names the ask classes
 * that always reach the owner: `credential` (secret fields, or kind credential/account/access/consent),
 * `handover` (every handover.review ask — excluded even when the owner drops it from the list),
 * `draw-review` (the opt-out: an interface.draw drawing review the owner did not ask for is otherwise
 * accepted without the owner) and any ask kind of modules/ops/ops/provision.ask.yaml.
 */
export const ASK_KINDS=Object.freeze(['information','credential','account','access','consent','authority','business-decision','irreversible-confirmation']);
const ASK_EXCLUDE_CLASSES=Object.freeze([...ASK_KINDS,'handover','draw-review']);
export const ASKS_DEFAULTS=Object.freeze({autoAcceptRecommended:false,excludes:Object.freeze(['credential','irreversible-confirmation','handover'])});
function validateAsks(asks){
  if(asks===null)return;
  const bad=invalid('asks');
  if(!plain(asks))bad(' must be {autoAcceptRecommended?, excludes?} or null.');
  for(const key of Object.keys(asks))if(!['autoAcceptRecommended','excludes'].includes(key))bad(` has unknown key ${key} (allowed: autoAcceptRecommended, excludes).`);
  if(asks.autoAcceptRecommended!==undefined&&typeof asks.autoAcceptRecommended!=='boolean')bad('.autoAcceptRecommended must be true or false.');
  const excludes=asks.excludes;
  if(excludes!==undefined&&excludes!==null){
    if(!Array.isArray(excludes))bad(`.excludes must be a list of ask classes (${ASK_EXCLUDE_CLASSES.join(', ')}).`);
    for(const entry of excludes)if(typeof entry!=='string'||!ASK_EXCLUDE_CLASSES.includes(entry))bad(`.excludes entry ${JSON.stringify(entry)} is not an ask class (${ASK_EXCLUDE_CLASSES.join(', ')}).`);
    if(new Set(excludes).size!==excludes.length)bad('.excludes names each class once.');
  }
}
/**
 * config.yaml `uat` — the machine-wide UAT ceiling: at most `maxConcurrent` UAT runs (browsers, players,
 * the apps they drive) execute at once on this host; the rest queue for a slot (scripts/uat/uat-slots.mjs).
 */
export const UAT_DEFAULTS=Object.freeze({maxConcurrent:10});
function validateUat(uat){
  if(uat===null)return;
  const bad=invalid('uat');
  if(!plain(uat))bad(' must be {maxConcurrent?} or null.');
  for(const key of Object.keys(uat))if(key!=='maxConcurrent')bad(` has unknown key ${key} (allowed: maxConcurrent).`);
  if(uat.maxConcurrent!==undefined&&uat.maxConcurrent!==null&&!(Number.isInteger(uat.maxConcurrent)&&uat.maxConcurrent>=1))bad('.maxConcurrent must be a positive integer (default 10) or null.');
}
/** The owner's UAT concurrency settings: {maxConcurrent, source}. An absent or null block is the default. */
export function uatSettings(config=loadConfig()){
  if(config?.uat!==undefined)validateUat(config.uat);
  const value=plain(config?.uat)?config.uat.maxConcurrent:null;
  return Number.isInteger(value)?{maxConcurrent:value,source:'uat'}:{maxConcurrent:UAT_DEFAULTS.maxConcurrent,source:'default'};
}
/**
 * config.yaml `allocation` beyond mode/preferredProvider — how `starci kernel route` spreads jobs over the pools
 * (scripts/agent/models.mjs selectPool):
 *   policy: prefer-then-overflow (the runtimes.yaml default) | balanced — among the eligible pools, the one
 *     furthest below its target share of the recent dispatches wins.
 *   shares: {<runtime pool>: <weight >= 0>} — target shares, normalized over the named pools. Absent = equal.
 *   windowHours: how far back the recent dispatches are counted (default 24).
 *   grants: ['<pool>=<slots>@<role>+<role>'] — the owner's default grant, applied to every workflow, that opens
 *     a capacityAuthority explicit-workflow-quota pool (Devin) for those roles up to <slots> running jobs.
 */
export const ALLOCATION_POLICIES=Object.freeze(['prefer-then-overflow','balanced']);
const ALLOCATION_KEYS=Object.freeze(['mode','preferredProvider','policy','shares','windowHours','grants']);
export const DEFAULT_ALLOCATION_WINDOW_HOURS=24;
const GRANT=/^([a-z0-9][a-z0-9.-]*)=(\d+)@([a-z]+(?:\+[a-z]+)*)$/;
/** One grant string `<pool>=<slots>@<role>+<role>` as {pool, slots, roles}, or null when it is not that shape. */
export function parseAllocationGrant(text){
  const m=typeof text==='string'?GRANT.exec(text.trim()):null;
  return m?{pool:m[1],slots:Number(m[2]),roles:m[3].split('+')}:null;
}
function validateAllocationBalance(allocation,runtimes){
  const bad=invalid('allocation.');
  if(allocation.policy!==undefined&&allocation.policy!==null&&!ALLOCATION_POLICIES.includes(allocation.policy))
    bad(`policy must be one of ${ALLOCATION_POLICIES.join(' | ')}.`);
  if(allocation.shares!==undefined&&allocation.shares!==null){
    const shares=allocation.shares;
    if(!plain(shares)||!Object.keys(shares).length)bad('shares must map runtime pools to non-negative weights, e.g. {claude-agent: 25, codex-agent: 25}.');
    for(const [pool,weight] of Object.entries(shares)){
      if(!plain(runtimes[pool]))bad(`shares.${pool} is not a modules/models/registry.yaml pool (known: ${knownNames(Object.keys(runtimes))}).`);
      if(typeof weight!=='number'||!Number.isFinite(weight)||weight<0)bad(`shares.${pool} must be a non-negative number.`);
    }
    if(!Object.values(shares).some(weight=>weight>0))bad('shares must give at least one pool a positive weight.');
  }
  if(allocation.windowHours!==undefined&&allocation.windowHours!==null&&!(typeof allocation.windowHours==='number'&&Number.isFinite(allocation.windowHours)&&allocation.windowHours>0&&allocation.windowHours<=720))
    bad('windowHours must be a number of hours in (0, 720].');
  if(allocation.grants!==undefined&&allocation.grants!==null){
    if(!Array.isArray(allocation.grants))bad('grants must be a list of "<pool>=<slots>@<role>+<role>" strings.');
    const seen=new Set();
    for(const text of allocation.grants){
      const grant=parseAllocationGrant(text);
      if(!grant)bad(`grants entry ${JSON.stringify(text)} is not "<pool>=<slots>@<role>+<role>" (e.g. devin-agent=10@implement+verify+write).`);
      const runtime=runtimes[grant.pool];
      if(!plain(runtime))bad(`grants entry ${text}: ${grant.pool} is not a modules/models/registry.yaml pool.`);
      if(seen.has(grant.pool))bad(`grants names ${grant.pool} more than once.`);
      seen.add(grant.pool);
      const max=Number(runtime.maxParallel);
      if(!(grant.slots>=1&&(!Number.isFinite(max)||grant.slots<=max)))bad(`grants entry ${text}: slots must be 1..${Number.isFinite(max)?max:'maxParallel'} (registry.yaml maxParallel).`);
      const unserved=grant.roles.filter(role=>!(runtime.roles??[]).includes(role));
      if(unserved.length)bad(`grants entry ${text}: ${grant.pool} does not serve role ${unserved.join(', ')} (registry.yaml roles: ${(runtime.roles??[]).join(', ')}).`);
    }
  }
}
/** Kernel and Supervisor seats share one authoritative pin/group grammar. */
function validateAgentSeat(seat,name,profile){
  const runtimes=profile?.runtimes??{},knownProviders=new Set(Object.values(runtimes).map(runtime=>runtime?.provider).filter(Boolean));
  if(plain(seat)&&Object.hasOwn(seat,'group')){
    const group=seat.group;
    if(Object.keys(seat).some(key=>!['group','effort'].includes(key))||!Array.isArray(group)||!group.length||group.some(member=>!plain(member)||Object.keys(member).some(key=>!['agent','model'].includes(key))||typeof member.agent!=='string'||!member.agent.trim()||!(member.model===undefined||member.model===null||typeof member.model==='string'&&member.model.trim())))
      throw Error(`Invalid config.yaml: ${name} group must be {group: [{agent, model?}, ...], effort?} with at least one member.`);
    if(new Set(group.map(member=>member.agent)).size!==group.length)throw Error(`Invalid config.yaml: ${name}.group names each agent once — availability is per provider.`);
    for(const {agent,model} of group){
      if(!knownProviders.has(agent))throw Error(`Invalid config.yaml: ${name}.group agent ${agent} is not declared by a runtime (known: ${knownNames(knownProviders)}).`);
      if(typeof model==='string'&&profile.models?.[model]?.provider!==agent&&!Object.values(runtimes).some(runtime=>runtime?.provider===agent&&(runtime.target===model||Object.values(runtime.models??{}).includes(model))))
        throw Error(`Invalid config.yaml: ${name}.group model ${model} is not declared by a ${agent} runtime.`);
    }
  }else{
    if(!plain(seat)||Object.keys(seat).some(key=>!['agent','model','effort'].includes(key))||Object.values(seat).some(value=>value!==null&&(typeof value!=='string'||!value.trim())))
      throw Error(`Invalid config.yaml: ${name} must be {agent?, model?, effort?} with string-or-null values, or {group: [{agent, model?}, ...], effort?}.`);
    if(typeof seat.agent==='string'&&!knownProviders.has(seat.agent))throw Error(`Invalid config.yaml: ${name}.agent ${seat.agent} is not declared by a runtime (known: ${knownNames(knownProviders)}).`);
  }
  if(seat.effort!==undefined&&seat.effort!==null&&!EFFORT_LEVELS.includes(seat.effort))throw Error(`Invalid config.yaml: ${name}.effort must use the effort vocabulary.`);
}
export function validateConfig(config){
  const allowed=['language','model','effort','models','debug','allocation','kernel','budgets','supervisor','parallel','delegation','connectors','asks','uat','specs','reconciler','coreDebug','orca','roots','launchTrust','retention'],models=config?.models,profile=runtimeProfile(),runtimes=profile?.runtimes??{};
  if(config?.launchTrust!==undefined)launchTrustSettings(config);
  if(config?.retention!==undefined)workflowPurgeSettings(config);
  if(config?.connectors!==undefined)validateConnectors(config.connectors);
  if(config?.asks!==undefined)validateAsks(config.asks);
  if(config?.uat!==undefined)validateUat(config.uat);
  if(config?.coreDebug!==undefined)validateCoreDebug(config.coreDebug);
  if(config?.orca!==undefined)validateOrca(config.orca);
  if(config?.roots!==undefined)validateRoots(config.roots);
  const knownProviders=new Set(Object.values(runtimes).map(runtime=>runtime?.provider).filter(Boolean));
  if(config?.debug!==undefined&&typeof config.debug!=='boolean')throw Error('Invalid config.yaml: debug must be true or false.');
  // specs (owner 2026-09-28): {harness?, unit?, e2e?} booleans - each family a boolean; absent = its default (SPEC_DEFAULTS: harness off, unit on, e2e off; specsSettings).
  if(config?.specs!==undefined&&config.specs!==null&&(!plain(config.specs)||Object.keys(config.specs).some(key=>!SPEC_FAMILIES.includes(key)||typeof config.specs[key]!=='boolean')))throw Error(`Invalid config.yaml: specs must be {${SPEC_FAMILIES.map(k=>`${k}?: boolean`).join(', ')}}, or null.`);
  // reconciler (scripts/reconciler/state.mjs reconcilerConfig): {enabled?: boolean, profile?: operational|observe, controllers?: {<name>: {mode: off|shadow|active}}}, or null.
  if(config?.reconciler!==undefined&&config.reconciler!==null){
    const r=config.reconciler,ctl=r?.controllers;
    if(!plain(r)||Object.keys(r).some(key=>!['enabled','profile','controllers'].includes(key))||(r.enabled!==undefined&&typeof r.enabled!=='boolean')||!(r.profile===undefined||r.profile===null||['operational','observe'].includes(r.profile))
      ||!(ctl===undefined||ctl===null||(plain(ctl)&&Object.entries(ctl).every(([name,c])=>/^[a-z][a-z0-9-]*$/.test(name)&&plain(c)&&Object.keys(c).every(key=>key==='mode')&&['off','shadow','active'].includes(c.mode)))))
      throw Error('Invalid config.yaml: reconciler must be {enabled?: boolean, profile?: operational|observe, controllers?: {<name>: {mode: off|shadow|active}}}, or null.');
  }
  if(config?.allocation!==undefined){
    const allocation=config.allocation,preferred=allocation?.preferredProvider;
    if(!plain(allocation)||Object.keys(allocation).some(key=>!ALLOCATION_KEYS.includes(key))||allocation.mode!==ADAPTIVE_ALLOCATION_MODE||!(preferred===null||preferred===undefined||typeof preferred==='string'&&preferred.trim()))
      throw Error('Invalid config.yaml: allocation must be {mode:"adaptive", preferredProvider?: <provider|null>, policy?, shares?, windowHours?, grants?}.');
    if(typeof preferred==='string'&&!knownProviders.has(preferred))throw Error(`Invalid config.yaml: allocation.preferredProvider ${preferred} is not declared by a runtime (known: ${knownNames(knownProviders)}).`);
    validateAllocationBalance(allocation,runtimes);
  }
  if(config?.kernel!==undefined)validateAgentSeat(config.kernel,'kernel',profile);
  if(config?.parallel!==undefined){
    const parallel=config.parallel,gears=slicingGears();
    if(!plain(parallel)||Object.keys(parallel).some(key=>key!=='gear')||!Number.isInteger(parallel.gear))
      throw Error('Invalid config.yaml: parallel must be {gear: <integer>}.');
    if(!gears.includes(parallel.gear))
      throw Error(`Invalid config.yaml: parallel.gear ${parallel.gear} is not declared by modules/models/runtimes.yaml allocation.slicing.gears (known: ${gears.join(', ')}).`);
  }
  if(config?.supervisor!==undefined){
    const supervisor=config.supervisor,interval=supervisor?.pollIntervalMs,repos=supervisor?.repos,stall=supervisor?.stallMinutes;
    if(!plain(supervisor)||Object.keys(supervisor).some(key=>!['mode','pollIntervalMs','repos','stallMinutes','kernel','workers','landGate','frozenMinutes'].includes(key))||!(interval===null||interval===undefined||(Number.isInteger(interval)&&interval>=60000)))
      throw Error('Invalid config.yaml: supervisor must be {mode?, pollIntervalMs?, repos?, stallMinutes?, kernel?, workers?, landGate?, frozenMinutes?} with an integer of at least 60000 ms, or null.');
    // mode: where the Supervisor role runs (scripts/machine/home.mjs supervisorMode) - chat (default: the owner's desktop
    // chat session owns channel 'main' and ticks itself) or kernel (the optional [Supervisor] Orca kernel, start-supervisor.mjs).
    if(!(supervisor.mode===undefined||supervisor.mode===null||['chat','kernel'].includes(supervisor.mode)))
      throw Error('Invalid config.yaml: supervisor.mode must be chat or kernel, or null.');
    // The [Supervisor] kernel seat (scripts/machine/home.mjs supervisorSettings): kernel {agent?, model?, effort?}
    // pins its agent (default: the kernel pin), workers {base?, max?} its adaptive [Worker] cap (max <= 10),
    // landGate {mode?: shared|exclusive, push?} the land gate (scripts/supervisor/land.mjs).
    const seat=supervisor.kernel,workers=supervisor.workers,gate=supervisor.landGate;
    if(seat!==undefined&&seat!==null)validateAgentSeat(seat,'supervisor.kernel',profile);
    if(!(workers===undefined||workers===null||(plain(workers)&&Object.keys(workers).every(key=>['base','max'].includes(key)&&Number.isInteger(workers[key])&&workers[key]>=1&&workers[key]<=10))))
      throw Error('Invalid config.yaml: supervisor.workers must be {base?, max?} integers from 1 to 10, or null.');
    if(!(gate===undefined||gate===null||(plain(gate)&&Object.keys(gate).every(key=>(key==='mode'&&['shared','exclusive'].includes(gate.mode))||(key==='push'&&typeof gate.push==='boolean')))))
      throw Error('Invalid config.yaml: supervisor.landGate must be {mode?: shared|exclusive, push?: boolean}, or null.');
    // stallMinutes: scripts/supervisor/stall.mjs calls a running workflow STALLED after this many minutes with no progress.
    // frozenMinutes: scripts/supervisor/supervisor-watchdog.mjs reads a busy seat frame with no turn progress for this long as frozen.
    const frozen=supervisor.frozenMinutes;
    if(!(frozen===undefined||frozen===null||(Number.isInteger(frozen)&&frozen>=1)))
      throw Error('Invalid config.yaml: supervisor.frozenMinutes must be an integer of at least 1, or null.');
    if(!(stall===undefined||stall===null||(Number.isInteger(stall)&&stall>=5)))
      throw Error('Invalid config.yaml: supervisor.stallMinutes must be an integer of at least 5, or null.');
    if(!(repos===undefined||repos===null||(Array.isArray(repos)&&repos.every(repo=>typeof repo==='string'&&repo.trim()))))
      throw Error('Invalid config.yaml: supervisor.repos must be a list of ledger-owner repository paths, or null.');
  }
  if(config?.delegation!==undefined&&config.delegation!==null){
    const d=config.delegation;
    if(!plain(d)||Object.keys(d).some(key=>!['asks','until','excludes','note'].includes(key))||typeof d.asks!=='string'||!d.asks.trim()||typeof d.until!=='string'||Number.isNaN(Date.parse(d.until))||(d.excludes!==undefined&&(!Array.isArray(d.excludes)||d.excludes.some(x=>typeof x!=='string'))))
      throw Error('Invalid config.yaml: delegation must be {asks: <delegate>, until: <ISO time>, excludes?: [<class>], note?} or null.');
  }
  if(config?.budgets!==undefined){
    const budgets=config.budgets;
    if(!plain(budgets)||Object.keys(budgets).some(key=>!['maxOps'].includes(key))||Object.values(budgets).some(value=>value!==null&&!(Number.isInteger(value)&&value>0)))
      throw Error('Invalid config.yaml: budgets must be {maxOps?} with positive-integer-or-null values.');
  }
  if(!plain(config)||Object.keys(config).some(key=>!allowed.includes(key))||typeof config.language!=='string'||!/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(config.language)||!(config.model===null||typeof config.model==='string'&&config.model.trim())||!EFFORT_LEVELS.includes(config.effort)||!plain(models)||Object.keys(models).some(key=>!['pools','nonOperation','selection'].includes(key))||models.selection!=='quota-aware'||!plain(models.pools)||!plain(models.nonOperation)||Object.keys(models.pools).length!==Object.keys(DEFAULT_MODEL_POOLS).length||Object.keys(models.pools).some(key=>!Object.hasOwn(DEFAULT_MODEL_POOLS,key))||Object.keys(models.nonOperation).length!==Object.keys(NON_OPERATION_ROLES).length||Object.keys(models.nonOperation).some(key=>!Object.hasOwn(NON_OPERATION_ROLES,key)))throw Error('Invalid config.yaml: expected language, model, effort and the closed quota-aware model pools/non-operation role map.');
  for(const [pool,members] of Object.entries(models.pools))if(!Array.isArray(members)||members.length!==2||new Set(members).size!==2||members.some(id=>typeof id!=='string'||!plain(runtimes[id]))||!(members.length===DEFAULT_MODEL_POOLS[pool].length&&members.every(id=>DEFAULT_MODEL_POOLS[pool].includes(id))))throw Error(`Invalid config.yaml: models.pools.${pool} must contain its canonical pair of two unique known runtime ids.`);
  for(const [role,required] of Object.entries(NON_OPERATION_ROLES)){const pool=models.nonOperation[role],members=models.pools[pool];if(typeof pool!=='string'||!members||members.some(id=>!runtimes[id].roles?.includes(required)))throw Error(`Invalid config.yaml: models.nonOperation.${role} must name a pool whose members carry the ${required} role.`);}
  return config;
}
export function effectiveNonOperationModels(config=loadConfig()){const models=validateConfig(config).models;return Object.fromEntries(Object.keys(NON_OPERATION_ROLES).map(role=>[role,{pool:models.nonOperation[role],runtimes:[...models.pools[models.nonOperation[role]]],selection:models.selection}]));}
/**
 * The owner allocation control. `allocation` is the only shape; adaptive mode with an
 * optional preferredProvider bias — never a fallback chain.
 */
export function configuredAllocationPolicy(config=loadConfig()){
  validateConfig(config);
  const allocation=plain(config.allocation)?config.allocation:null;
  // null = the owner declared no grants list: grant-gated pools keep their pre-grant (ungated) routing.
  // A declared list, even [], is the whole set of grants.
  const grants=Array.isArray(allocation?.grants)
    ?Object.fromEntries(allocation.grants.map(parseAllocationGrant).map(({pool,slots,roles})=>[pool,{slots,roles}]))
    :null;
  return {
    mode:ADAPTIVE_ALLOCATION_MODE,
    preferredProvider:allocation?.preferredProvider??null,
    // null = the runtimes.yaml allocation.policy default
    policy:allocation?.policy??null,
    shares:allocation?.shares?{...allocation.shares}:null,
    windowHours:allocation?.windowHours??DEFAULT_ALLOCATION_WINDOW_HOURS,
    grants,
    source:allocation?'allocation':'default',
  };
}
export const nonOperationModels=(role,config=loadConfig())=>{if(!Object.hasOwn(NON_OPERATION_ROLES,role))throw Error(`Unknown non-operation model role ${role}`);return effectiveNonOperationModels(config)[role].runtimes;};
/** The validated config one yaml file holds, or null when the file is absent. */
const readYamlConfig=(root,name)=>{const yaml=path.join(root,name);return fs.existsSync(yaml)?validateConfig(parseYaml(fs.readFileSync(yaml,'utf8'))):null;};
function readExample(root=configRoot){const example=readYamlConfig(root,'config.example.yaml');if(example!==null)return example;throw Error('Missing config.example.yaml');}
/**
 * The owner config reader: `config.yaml` is the per-project file (gitignored,
 * seeded verbatim from `config.example.yaml` by the installer — comments and
 * all). Returns the validated owner config, or null when that file does not
 * exist; falling back to the example's defaults is `loadConfig`.
 */
function readOwnerConfig(root=configRoot){return readYamlConfig(root,'config.yaml');}
/**
 * The tolerant read the kernel boot and the router share: an owner file that is absent, unparsable or
 * short of the closed schema must never stop a workflow from routing. Returns
 * {file, config, error, invalid} — `config` is the validated config, or the raw parse when it fails the
 * schema (with `invalid` naming the reason), or null when the file is absent or `error` says why it
 * could not be read at all.
 */
export function inspectOwnerConfig(root=configRoot){
  const file=path.join(root,'config.yaml');
  if(!fs.existsSync(file))return {file,config:null,error:null,invalid:null};
  let parsed;
  try{parsed=parseYaml(fs.readFileSync(file,'utf8'))??null;}
  catch(error){return {file,config:null,error:`config.yaml unparsable: ${error.message}`,invalid:null};}
  try{return {file,config:validateConfig(parsed),error:null,invalid:null};}
  catch(error){return {file,config:parsed,error:null,invalid:error.message};}
}
/**
 * The owner's spec switches (config.yaml root `specs`, owner 2026-09-28; defaults set 2026-09-29, none needs a config block):
 *   harness - .claude's own specs. Default false = touching-only: harness work writes and runs the specs of new or changed code
 *             and the land gate runs only the specs touching the landed files (`land.mjs --specs touching`, its default);
 *             the whole suite never runs in a land - `--specs all` is refused unless this is true. The full suite runs in
 *             the owner-approved /starci release flow (scripts/supervisor/release-cut.mjs), which needs no key. true = `--specs all` may run;
 *   unit    - product unit specs in workflows. Default on: a code-writing op writes/updates the unit specs of the source it
 *             adds or changes and runs only those; the full unit suite is unit.verify's or the approved /starci release flow's. false = the ops'
 *             policy.specsToggle deferral path (scripts/route/spec-deferral.mjs);
 *   e2e     - product e2e in workflows. Default OFF: e2e runs only when the goal or the owner explicitly asks (set true,
 *             or `starci kernel run-deferred-tests`); e2e.verify then runs the FULL e2e suite.
 * An absent, null or unreadable owner file reads as the defaults: harness off, unit on, e2e off.
 */
const SPEC_FAMILIES=Object.freeze(['harness','unit','e2e']);
export const SPEC_DEFAULTS=Object.freeze({harness:false,unit:true,e2e:false});
export function specsSettings(config){const specs=plain(config?.specs)?config.specs:{};return Object.fromEntries(SPEC_FAMILIES.map(key=>[key,typeof specs[key]==='boolean'?specs[key]:SPEC_DEFAULTS[key]]));}
/** specs.harness of the owner file under `root` (tolerant read: inspectOwnerConfig): true only when the owner opted in to `--specs all`. */
export function harnessSpecsEnabled(root=configRoot){return specsSettings(inspectOwnerConfig(root).config).harness;}
/**
 * config.yaml `coreDebug` (skills/starci, scripts/reconciler/core-debug.mjs): {interval, worktreeLimit}.
 *   interval       <n>s | <n>m | <n>h — the reconciler's cadence for the native core-maintenance seat.
 *   worktreeLimit  integer >= 1 — more registered worktrees than this in one repository is a core-watch alert.
 * Both keys are required when the block is present; code carries no default (config.example.yaml does).
 */
export const DURATION_PATTERN=/^(\d+)(s|m|h)$/;
/** '10m' | '90s' | '1h' in milliseconds, or null for anything else (zero included). */
export function durationMs(text){const m=DURATION_PATTERN.exec(String(text??'').trim());const ms=m?Number(m[1])*{s:1000,m:60000,h:3600000}[m[2]]:0;return ms>0?ms:null;}
function validateCoreDebug(block){
  const bad=invalid('coreDebug');
  if(!plain(block))bad(' must be {interval: <n>s|<n>m|<n>h, worktreeLimit: <integer >= 1>}.');
  for(const key of Object.keys(block))if(!['interval','worktreeLimit'].includes(key))bad(` has unknown key ${key} (allowed: interval, worktreeLimit).`);
  if(durationMs(block.interval)===null)bad('.interval must be <n>s, <n>m or <n>h with n >= 1 (e.g. 10m).');
  if(!Number.isInteger(block.worktreeLimit)||block.worktreeLimit<1)bad('.worktreeLimit must be an integer >= 1.');
}
/** The owner's coreDebug block: {interval, intervalMs, worktreeLimit}. Refuses when config.yaml has none. */
export function coreDebugSettings(config=loadConfig()){
  const block=config?.coreDebug;
  if(block===undefined||block===null)throw Error('Invalid config.yaml: coreDebug is missing; copy the coreDebug block from config.example.yaml.');
  validateCoreDebug(block);
  return {interval:block.interval,intervalMs:durationMs(block.interval),worktreeLimit:block.worktreeLimit};
}
/** The owner config of `root` (config.yaml), else the shipped example. The installer seeds config.yaml (scripts/install/install.mjs seedConfig); this reader never writes. */
export function loadConfig(root=configRoot){
  return readOwnerConfig(root)??readExample(root);
}

/** The owner's standing delegation of ask answers (config.yaml `delegation`), or null when absent or expired. */
export function activeDelegation(config=loadConfig(),now=Date.now()){const d=config?.delegation;if(!d||Date.parse(d.until)<=now)return null;return {asks:d.asks,until:d.until,excludes:d.excludes??[],note:d.note??null};}

/**
 * The owner's auto-accept policy for recommended asks (config.yaml `asks`): {autoAcceptRecommended,
 * excludes, source}. An absent or null block is the default (off). `handover` is always in excludes.
 * Validates first, so a malformed block throws rather than reading as on.
 */
export function askAutoAcceptPolicy(config=loadConfig()){
  if(config?.asks!==undefined)validateAsks(config.asks);
  const asks=plain(config?.asks)?config.asks:null;
  const listed=asks&&Array.isArray(asks.excludes)?asks.excludes:ASKS_DEFAULTS.excludes;
  const excludes=listed.includes('handover')?[...listed]:[...listed,'handover'];
  return {autoAcceptRecommended:asks?.autoAcceptRecommended===true,excludes,source:asks?'asks':'default'};
}
