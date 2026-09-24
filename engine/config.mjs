import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {skillRoot} from './runtime-root.mjs';
import {parseYaml} from './yaml.mjs';

export const configRoot=skillRoot;
export const NON_OPERATION_ROLES={planner:'plan',kernelManager:'decide',validator:'verify'};
export const DEFAULT_MODEL_POOLS={'sol-opus':['claude-agent','codex-agent']};
export const ADAPTIVE_ALLOCATION_MODE='adaptive';
/** The effort vocabulary, ordered weakest to strongest — the only list of it. */
export const EFFORT_LEVELS=['none','minimal','low','medium','high','xhigh','max','ultra'];
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function runtimeProfile(){const source=fileURLToPath(new URL('../modules/models/runtimes.yaml',import.meta.url));if(!fs.existsSync(source))throw Error('Missing modules/models/runtimes.yaml');return parseYaml(fs.readFileSync(source,'utf8'));}
/**
 * modules/models/runtimes.yaml `allocation` — where the fleet's operating numbers live: the dispatch lease
 * TTL, the liveness and cadence windows, the slicing weights, the failure cooldowns. Code reads them from
 * here; a literal copy of any of them in a source file would be a second authority.
 */
export function allocationSettings(){return runtimeProfile()?.allocation??{};}
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
export const CLOUDFLARE_MODES=['off','quick','named'];
/** The serve-ask port band (scripts/kernel/serve-ask.mjs PORT_BASE..+PORT_SCAN); the gateway stays outside it. */
export const ASK_PORT_BAND=[6969,7069];
export const CONNECTOR_DEFAULTS=Object.freeze({
  secretsFile:null,
  repos:[],
  gateway:{port:7070},
  cloudflare:{mode:'off',tunnel:null,credentialsFile:null,tokenEnv:'CLOUDFLARE_TUNNEL_TOKEN',hostname:null,access:false},
  telegram:{enabled:false,botTokenEnv:'TELEGRAM_BOT_TOKEN',chatId:null,exposeCredentialAsks:false},
});
const ENV_NAME=/^[A-Z_][A-Z0-9_]{0,63}$/;
const HOSTNAME=/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const TUNNEL_REF=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const CHAT_ID=/^(?:-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/;
const SECRET_KEYS=['token','tunnelToken','botToken','secret','apiToken','password'];
function validateConnectors(connectors){
  if(connectors===null)return;
  const bad=message=>{throw Error(`Invalid config.yaml: connectors${message}`);};
  if(!plain(connectors))bad(' must be {secretsFile?, repos?, gateway?, cloudflare?, telegram?} or null.');
  const closed=(node,where,keys)=>{
    if(!plain(node))bad(`.${where} must be a mapping.`);
    for(const key of Object.keys(node)){
      if(SECRET_KEYS.includes(key))bad(`.${where}.${key}: secrets never live in config.yaml — set the environment variable the *Env key names instead.`);
      if(!keys.includes(key))bad(`.${where} has unknown key ${key} (allowed: ${keys.join(', ')}).`);
    }
  };
  closed(connectors,'',['secretsFile','repos','gateway','cloudflare','telegram']);
  if(connectors.secretsFile!==undefined&&connectors.secretsFile!==null&&(typeof connectors.secretsFile!=='string'||!connectors.secretsFile.trim()))bad('.secretsFile must be a dotenv file path (relative to the skill root) or null.');
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
/**
 * The secret an env var NAME resolves to: `env[name]`, else the contents of the file `env[name + '_FILE']`
 * points at (the custody pointer convention). Returns null when neither is set. Callers pass the value to
 * the one API that needs it and never print it.
 */
/** Parse a dotenv file (KEY=VALUE lines, # comments, optional export/quotes). An absent file is {}. */
export function readDotenv(file){
  let text='';try{text=fs.readFileSync(file,'utf8');}catch{return {};}
  const out={};
  for(const line of text.split(/\r?\n/)){
    const m=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if(!m)continue;
    let value=m[2];
    if(value.length>=2&&(value[0]==='"'||value[0]==="'")&&value.at(-1)===value[0])value=value.slice(1,-1);
    out[m[1]]=value;
  }
  return out;
}
/** The dotenv file connectors.secretsFile names, resolved against the skill root; null when unset. */
export const connectorSecretsFile=(config,root=configRoot)=>{const file=config?.connectors?.secretsFile;return typeof file==='string'&&file.trim()?path.resolve(root,file):null;};
/**
 * The environment the connectors resolve secrets from: connectors.secretsFile's values under the process
 * environment (a real env var wins). It holds secrets — hand it to connectorSecret, never print it.
 */
export function connectorEnv(config,env=process.env,root=configRoot){const file=connectorSecretsFile(config,root);return file?{...readDotenv(file),...env}:env;}
export function connectorSecret(name,env=process.env){
  if(typeof name!=='string'||!ENV_NAME.test(name))return null;
  const direct=typeof env[name]==='string'?env[name].trim():'';
  if(direct)return direct;
  const pointer=typeof env[`${name}_FILE`]==='string'?env[`${name}_FILE`].trim():'';
  if(!pointer)return null;
  try{const value=fs.readFileSync(pointer,'utf8').trim();return value||null;}catch{return null;}
}
/**
 * The normalized `connectors` block: defaults filled in, the secrets' PRESENCE (booleans, never values),
 * whether each connector is ready to run, and the owner-facing warnings the security posture earns.
 */
export function connectorsConfig(config=loadConfig(),env=process.env,root=configRoot){
  validateConfig(config);
  env=connectorEnv(config,env,root);
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
  return {secretsFile:connectorSecretsFile(config,root),repos:[...(raw.repos??d.repos)],gateway:{...d.gateway,...(raw.gateway??{})},cloudflare,telegram,warnings};
}
/**
 * config.yaml `asks` — whether an owner ask that carries a recommended option is answered with it
 * instead of being served (scripts/kernel/serve-ask.mjs autoAcceptAsk). `excludes` names the ask classes
 * that always reach the owner: `credential` (secret fields, or kind credential/account/access/consent),
 * `handover` (every handover.review ask — excluded even when the owner drops it from the list) and any
 * ask kind of modules/ops/ops/provision.ask.yaml.
 */
export const ASK_KINDS=Object.freeze(['information','credential','account','access','consent','authority','business-decision','irreversible-confirmation']);
export const ASK_EXCLUDE_CLASSES=Object.freeze([...ASK_KINDS,'handover']);
export const ASKS_DEFAULTS=Object.freeze({autoAcceptRecommended:false,excludes:Object.freeze(['credential','irreversible-confirmation','handover'])});
function validateAsks(asks){
  if(asks===null)return;
  const bad=message=>{throw Error(`Invalid config.yaml: asks${message}`);};
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
  const bad=message=>{throw Error(`Invalid config.yaml: uat${message}`);};
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
 * config.yaml `allocation` beyond mode/preferredProvider — how `api route` spreads jobs over the pools
 * (scripts/agent/models.mjs selectPool):
 *   policy: prefer-then-overflow (the runtimes.yaml default) | balanced — among the eligible pools, the one
 *     furthest below its target share of the recent dispatches wins.
 *   shares: {<runtime pool>: <weight >= 0>} — target shares, normalized over the named pools. Absent = equal.
 *   windowHours: how far back the recent dispatches are counted (default 24).
 *   grants: ['<pool>=<slots>@<role>+<role>'] — the owner's default grant, applied to every workflow, that opens
 *     a capacityAuthority explicit-workflow-quota pool (Devin) for those roles up to <slots> running jobs.
 */
export const ALLOCATION_POLICIES=Object.freeze(['prefer-then-overflow','balanced']);
export const ALLOCATION_KEYS=Object.freeze(['mode','preferredProvider','policy','shares','windowHours','grants']);
export const DEFAULT_ALLOCATION_WINDOW_HOURS=24;
const GRANT=/^([a-z0-9][a-z0-9.-]*)=(\d+)@([a-z]+(?:\+[a-z]+)*)$/;
/** One grant string `<pool>=<slots>@<role>+<role>` as {pool, slots, roles}, or null when it is not that shape. */
export function parseAllocationGrant(text){
  const m=typeof text==='string'?GRANT.exec(text.trim()):null;
  return m?{pool:m[1],slots:Number(m[2]),roles:m[3].split('+')}:null;
}
function validateAllocationBalance(allocation,runtimes){
  const bad=message=>{throw Error(`Invalid config.yaml: allocation.${message}`);};
  if(allocation.policy!==undefined&&allocation.policy!==null&&!ALLOCATION_POLICIES.includes(allocation.policy))
    bad(`policy must be one of ${ALLOCATION_POLICIES.join(' | ')}.`);
  if(allocation.shares!==undefined&&allocation.shares!==null){
    const shares=allocation.shares;
    if(!plain(shares)||!Object.keys(shares).length)bad('shares must map runtime pools to non-negative weights, e.g. {claude-agent: 25, codex-agent: 25}.');
    for(const [pool,weight] of Object.entries(shares)){
      if(!plain(runtimes[pool]))bad(`shares.${pool} is not a modules/models/runtimes.yaml pool (known: ${Object.keys(runtimes).sort().join(', ')}).`);
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
      if(!plain(runtime))bad(`grants entry ${text}: ${grant.pool} is not a modules/models/runtimes.yaml pool.`);
      if(seen.has(grant.pool))bad(`grants names ${grant.pool} more than once.`);
      seen.add(grant.pool);
      const max=Number(runtime.maxParallel);
      if(!(grant.slots>=1&&(!Number.isFinite(max)||grant.slots<=max)))bad(`grants entry ${text}: slots must be 1..${Number.isFinite(max)?max:'maxParallel'} (runtimes.yaml maxParallel).`);
      const unserved=grant.roles.filter(role=>!(runtime.roles??[]).includes(role));
      if(unserved.length)bad(`grants entry ${text}: ${grant.pool} does not serve role ${unserved.join(', ')} (runtimes.yaml roles: ${(runtime.roles??[]).join(', ')}).`);
    }
  }
}
export function validateConfig(config){
  const allowed=['language','model','effort','models','debug','allocation','kernel','budgets','supervisor','parallel','delegation','connectors','asks','uat','quota'],models=config?.models,profile=runtimeProfile(),runtimes=profile?.runtimes??{};
  if(config?.connectors!==undefined)validateConnectors(config.connectors);
  if(config?.asks!==undefined)validateAsks(config.asks);
  if(config?.uat!==undefined)validateUat(config.uat);
  const knownProviders=new Set(Object.values(runtimes).map(runtime=>runtime?.provider).filter(Boolean));
  if(config?.debug!==undefined&&typeof config.debug!=='boolean')throw Error('Invalid config.yaml: debug must be true or false.');
  if(config?.allocation!==undefined){
    const allocation=config.allocation,preferred=allocation?.preferredProvider;
    if(!plain(allocation)||Object.keys(allocation).some(key=>!ALLOCATION_KEYS.includes(key))||allocation.mode!==ADAPTIVE_ALLOCATION_MODE||!(preferred===null||preferred===undefined||typeof preferred==='string'&&preferred.trim()))
      throw Error('Invalid config.yaml: allocation must be {mode:"adaptive", preferredProvider?: <provider|null>, policy?, shares?, windowHours?, grants?}.');
    if(typeof preferred==='string'&&!knownProviders.has(preferred))throw Error(`Invalid config.yaml: allocation.preferredProvider ${preferred} is not declared by a runtime (known: ${[...knownProviders].sort().join(', ')}).`);
    validateAllocationBalance(allocation,runtimes);
  }
  if(plain(config?.kernel)&&Object.hasOwn(config.kernel,'group')){
    const kernel=config.kernel,group=kernel.group;
    if(Object.keys(kernel).some(key=>!['group','effort'].includes(key))||!Array.isArray(group)||!group.length||group.some(member=>!plain(member)||Object.keys(member).some(key=>!['agent','model'].includes(key))||typeof member.agent!=='string'||!member.agent.trim()||!(member.model===undefined||member.model===null||typeof member.model==='string'&&member.model.trim())))
      throw Error('Invalid config.yaml: kernel group must be {group: [{agent, model?}, ...], effort?} with at least one member.');
    if(new Set(group.map(member=>member.agent)).size!==group.length)throw Error('Invalid config.yaml: kernel.group names each agent once — availability is per provider.');
    for(const {agent,model} of group){
      if(!knownProviders.has(agent))throw Error(`Invalid config.yaml: kernel.group agent ${agent} is not declared by a runtime (known: ${[...knownProviders].sort().join(', ')}).`);
      if(typeof model==='string'&&!Object.values(runtimes).some(runtime=>runtime?.provider===agent&&(runtime.target===model||Object.values(runtime.models??{}).includes(model))))
        throw Error(`Invalid config.yaml: kernel.group model ${model} is not declared by a ${agent} runtime.`);
    }
    if(kernel.effort!==undefined&&kernel.effort!==null&&!EFFORT_LEVELS.includes(kernel.effort))
      throw Error('Invalid config.yaml: kernel.effort must use the effort vocabulary.');
  }else if(config?.kernel!==undefined){
    const kernel=config.kernel;
    if(!plain(kernel)||Object.keys(kernel).some(key=>!['agent','model','effort'].includes(key))||Object.values(kernel).some(value=>value!==null&&(typeof value!=='string'||!value.trim())))
      throw Error('Invalid config.yaml: kernel must be {agent?, model?, effort?} with string-or-null values, or {group: [{agent, model?}, ...], effort?}.');
    if(typeof kernel.agent==='string'&&!knownProviders.has(kernel.agent))
      throw Error(`Invalid config.yaml: kernel.agent ${kernel.agent} is not declared by a runtime (known: ${[...knownProviders].sort().join(', ')}).`);
    if(typeof kernel.effort==='string'&&!EFFORT_LEVELS.includes(kernel.effort))
      throw Error('Invalid config.yaml: kernel.effort must use the effort vocabulary.');
  }
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
    // mode: where the Supervisor role runs (scripts/supervisor/home.mjs supervisorMode) - chat (default: the owner's desktop
    // chat session owns channel 'main' and ticks itself) or kernel (the optional [Supervisor] Orca kernel, start-supervisor.mjs).
    if(!(supervisor.mode===undefined||supervisor.mode===null||['chat','kernel'].includes(supervisor.mode)))
      throw Error('Invalid config.yaml: supervisor.mode must be chat or kernel, or null.');
    // The [Supervisor] kernel seat (scripts/supervisor/home.mjs supervisorSettings): kernel {agent?, model?, effort?}
    // pins its agent (default: the kernel pin), workers {base?, max?} its adaptive [Worker] cap (max <= 10),
    // landGate {mode?: shared|exclusive, push?} the land gate (scripts/supervisor/land.mjs).
    const seat=supervisor.kernel,workers=supervisor.workers,gate=supervisor.landGate;
    if(!(seat===undefined||seat===null||(plain(seat)&&Object.keys(seat).every(key=>['agent','model','effort'].includes(key)&&(seat[key]===null||typeof seat[key]==='string')))))
      throw Error('Invalid config.yaml: supervisor.kernel must be {agent?, model?, effort?} strings, or null.');
    if(!(workers===undefined||workers===null||(plain(workers)&&Object.keys(workers).every(key=>['base','max'].includes(key)&&Number.isInteger(workers[key])&&workers[key]>=1&&workers[key]<=10))))
      throw Error('Invalid config.yaml: supervisor.workers must be {base?, max?} integers from 1 to 10, or null.');
    if(!(gate===undefined||gate===null||(plain(gate)&&Object.keys(gate).every(key=>(key==='mode'&&['shared','exclusive'].includes(gate.mode))||(key==='push'&&typeof gate.push==='boolean')))))
      throw Error('Invalid config.yaml: supervisor.landGate must be {mode?: shared|exclusive, push?: boolean}, or null.');
    // stallMinutes: scripts/supervisor/stall.mjs calls a running workflow STALLED after this many minutes with no progress.
    // frozenMinutes: scripts/supervisor/watchdog.mjs reads a busy seat frame with no turn progress for this long as frozen.
    const frozen=supervisor.frozenMinutes;
    if(!(frozen===undefined||frozen===null||(Number.isInteger(frozen)&&frozen>=1)))
      throw Error('Invalid config.yaml: supervisor.frozenMinutes must be an integer of at least 1, or null.');
    if(!(stall===undefined||stall===null||(Number.isInteger(stall)&&stall>=5)))
      throw Error('Invalid config.yaml: supervisor.stallMinutes must be an integer of at least 5, or null.');
    if(!(repos===undefined||repos===null||(Array.isArray(repos)&&repos.every(repo=>typeof repo==='string'&&repo.trim()))))
      throw Error('Invalid config.yaml: supervisor.repos must be a list of ledger-owner repository paths, or null.');
  }
  // quota {qwen?: {planQuota, unit?, resetAt, calibratedRemainingPercent?, calibratedAt?}}: the plan figures the
  // provider exposes no API for. Qwen is the unmetered base pool: only resetAt is read (scripts/api/quota/qwen.mjs
  // nextResetAt, for the quota circuit); the other fields stay accepted so existing owner configs keep validating.
  if(config?.quota!==undefined&&config.quota!==null){
    const quota=config.quota,qwen=quota?.qwen;
    if(!plain(quota)||Object.keys(quota).some(key=>key!=='qwen'))throw Error('Invalid config.yaml: quota must be {qwen?}, or null.');
    if(!(qwen===undefined||qwen===null||(plain(qwen)&&Object.keys(qwen).every(key=>['planQuota','unit','resetAt','calibratedRemainingPercent','calibratedAt'].includes(key))&&Number(qwen.planQuota)>0&&Number.isFinite(Date.parse(String(qwen.resetAt)))&&(qwen.unit===undefined||['requests','tokens'].includes(qwen.unit)))))
      throw Error('Invalid config.yaml: quota.qwen must be {planQuota: >0, unit?: requests|tokens, resetAt: <ISO>, calibratedRemainingPercent?, calibratedAt?}, or null.');
  }
  if(config?.delegation!==undefined&&config.delegation!==null){
    const d=config.delegation;
    if(!plain(d)||Object.keys(d).some(key=>!['asks','until','excludes','note'].includes(key))||typeof d.asks!=='string'||!d.asks.trim()||typeof d.until!=='string'||Number.isNaN(Date.parse(d.until))||(d.excludes!==undefined&&(!Array.isArray(d.excludes)||d.excludes.some(x=>typeof x!=='string'))))
      throw Error('Invalid config.yaml: delegation must be {asks: <delegate>, until: <ISO time>, excludes?: [<class>], note?} or null.');
  }
  if(config?.budgets!==undefined){
    const budgets=config.budgets;
    if(!plain(budgets)||Object.keys(budgets).some(key=>!['maxOps','perOpMs','dailyTokens'].includes(key))||Object.values(budgets).some(value=>value!==null&&!(Number.isInteger(value)&&value>0)))
      throw Error('Invalid config.yaml: budgets must be {maxOps?, perOpMs?, dailyTokens?} with positive-integer-or-null values.');
  }
  if(!plain(config)||Object.keys(config).some(key=>!allowed.includes(key))||typeof config.language!=='string'||!/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(config.language)||!(config.model===null||typeof config.model==='string'&&config.model.trim())||!EFFORT_LEVELS.includes(config.effort)||!plain(models)||Object.keys(models).some(key=>!['pools','nonOperation','selection'].includes(key))||models.selection!=='quota-aware'||!plain(models.pools)||!plain(models.nonOperation)||Object.keys(models.pools).length!==Object.keys(DEFAULT_MODEL_POOLS).length||Object.keys(models.pools).some(key=>!Object.hasOwn(DEFAULT_MODEL_POOLS,key))||Object.keys(models.nonOperation).length!==3||Object.keys(models.nonOperation).some(key=>!Object.hasOwn(NON_OPERATION_ROLES,key)))throw Error('Invalid config.yaml: expected language, model, effort and the closed quota-aware model pools/non-operation role map.');
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
function readExample(root=configRoot){const yaml=path.join(root,'config.example.yaml');if(fs.existsSync(yaml))return validateConfig(parseYaml(fs.readFileSync(yaml,'utf8')));throw Error('Missing config.example.yaml');}
/**
 * The owner config reader: `config.yaml` is the per-project file (gitignored,
 * seeded verbatim from `config.example.yaml` by the installer — comments and
 * all). Returns the validated owner config, or null when that file does not
 * exist; falling back to the example's defaults is `loadConfig`.
 */
export function readOwnerConfig(root=configRoot){
  const yaml=path.join(root,'config.yaml');
  if(fs.existsSync(yaml))return validateConfig(parseYaml(fs.readFileSync(yaml,'utf8')));
  return null;
}
export const loadOwnerConfig=readOwnerConfig;
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
export function loadConfig(root=configRoot,{initialize=false}={}){
  const yaml=path.join(root,'config.yaml');
  if(initialize&&!fs.existsSync(yaml)){
    const exampleFile=path.join(root,'config.example.yaml');
    if(fs.existsSync(exampleFile)){try{fs.copyFileSync(exampleFile,yaml);}catch{/* best effort */}}
  }
  return readOwnerConfig(root)??readExample(root);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.stdout.write(JSON.stringify(loadConfig(configRoot,{initialize:true}))+'\n');}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}}

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
