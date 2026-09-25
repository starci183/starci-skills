import {isPlainObject as plain} from '../../engine/index.mjs';
import {skillRoot} from '../../engine/runtime-root.mjs';
import {parseYaml} from '../../engine/yaml.mjs';
import {agentContext} from '../api/orca/agent-context.mjs';
import {missingFrom} from '../api/orca/lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';


const add=(errors,condition,message)=>{if(!condition)errors.push(message);};

// The provider contract tree:
//   modules/models/agents/<agent>.yaml  — agent cards (schema starci/agent-card@1;
//     the card is the document's top level, claude/codex add a `capabilities:` key)
//   modules/host/orca/<doc>.yaml        — the Orca host contract docs (index, api,
//     calls, capabilities, recipes, validation, envelopes)
//   modules/models/profiles/<target>.yaml — profiles whose launch.orca.adapter
//     names an agent card
const agentsDir=root=>path.join(root,'modules','models','agents');
const hostsDir=root=>path.join(root,'modules','host');
const profilesDir=root=>path.join(root,'modules','models','profiles');
const registryFile=root=>path.join(root,'modules','models','registry.yaml');
const AGENTS_DIR=agentsDir(skillRoot);
const AGENT_CARD_SCHEMA='starci/agent-card@1';

const yamlFilesIn=dir=>fs.existsSync(dir)
  ?fs.readdirSync(dir).filter(name=>name.endsWith('.yaml')||name.endsWith('.yml')).sort()
  :[];

const readYamlFile=file=>parseYaml(fs.readFileSync(file,'utf8'));

/** Read one agent card by name (`qwen` -> modules/models/agents/qwen.yaml). */
export function loadAgentCard(agent){
  if(typeof agent!=='string'||!agent||agent.includes('..')||agent.includes('/')||agent.includes('\\'))
    throw Error(`Invalid agent name: ${agent}`);
  const file=path.join(AGENTS_DIR,`${agent}.yaml`);
  if(!fs.existsSync(file))throw Error(`Unknown agent: ${agent} (no card at modules/models/agents/${agent}.yaml)`);
  return readYamlFile(file);
}

/**
 * Load one provider's contract docs from the new tree. Host documents come from
 * `modules/host/<provider>/*.yaml` keyed by file stem (`index`, `api`, `calls`,
 * `envelopes`, ...); `adapters` holds the agent cards that provider can launch —
 * for the Orca host that is every card in modules/models/agents/, for any other
 * provider the `<provider>.yaml` card when one exists.
 */
export function loadProviderContract(provider){
  if(typeof provider!=='string'||!provider||provider.includes('..')||provider.includes('/')||provider.includes('\\'))
    throw Error(`Invalid provider name: ${provider}`);
  const hostDir=path.join(skillRoot,'modules','host',provider);
  const loaded={};
  for(const name of yamlFilesIn(hostDir))loaded[path.basename(name).replace(/\.ya?ml$/i,'')]=readYamlFile(path.join(hostDir,name));
  loaded.adapters={};
  const cardNames=provider==='orca'?yamlFilesIn(AGENTS_DIR).map(name=>name.replace(/\.ya?ml$/i,'')):[provider];
  for(const agent of cardNames){
    const file=path.join(AGENTS_DIR,`${agent}.yaml`);
    if(fs.existsSync(file))loaded.adapters[agent]=readYamlFile(file);
  }
  if(!Object.keys(loaded).some(key=>key!=='adapters')&&!Object.keys(loaded.adapters).length)
    throw Error(`Unknown provider: ${provider} (no modules/host/${provider}/ docs and no agent card)`);
  return loaded;
}

/** Validate the provider contract tree before an operation launch is planned. */
export function validateProviderContracts({root=skillRoot}={}){
  const errors=[];
  const AGENTS_DIR=agentsDir(root),HOSTS_DIR=hostsDir(root),PROFILES_DIR=profilesDir(root),REGISTRY_FILE=registryFile(root);

  // 1. Every agent card parses, carries the agent-card schema id and attests an
  //    `agent` identity equal to its file stem.
  add(errors,fs.existsSync(AGENTS_DIR),'Agent card directory is missing: modules/models/agents/');
  const cardNames=yamlFilesIn(AGENTS_DIR).map(name=>name.replace(/\.ya?ml$/i,''));
  add(errors,cardNames.length>0,'No agent cards under modules/models/agents/');
  const cards={};
  for(const agent of cardNames){
    const rel=`modules/models/agents/${agent}.yaml`;
    let card=null;
    try{card=readYamlFile(path.join(AGENTS_DIR,`${agent}.yaml`));}
    catch(error){errors.push(`Agent card ${rel} does not parse: ${error.message}`);continue;}
    cards[agent]=card;
    add(errors,card?.schema===AGENT_CARD_SCHEMA,`Agent card ${rel} must declare schema: ${AGENT_CARD_SCHEMA}`);
    add(errors,card?.agent===agent,`Agent card ${rel} agent field must equal its file stem '${agent}'`);
  }

  // 2. Every host contract document under modules/host/<provider>/ parses, and
  //    each host's index.yaml attests its own identity: a starci/ schema id, a
  //    `provider` equal to its directory name, and every relative file path it
  //    names (`agentCard`, `files.*`) resolving to a file that exists. orca is
  //    required — it is the execution host.
  add(errors,fs.existsSync(HOSTS_DIR),'Host contract directory is missing: modules/host/');
  const hosts=fs.existsSync(HOSTS_DIR)
    ?fs.readdirSync(HOSTS_DIR,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort()
    :[];
  add(errors,hosts.includes('orca'),'Orca host contract directory is missing: modules/host/orca/');
  for(const host of hosts){
    const hostDir=path.join(HOSTS_DIR,host);
    const docs=yamlFilesIn(hostDir);
    add(errors,docs.length>0,`No host contract documents under modules/host/${host}/`);
    let index=null;
    for(const name of docs){
      let doc=null;
      try{doc=readYamlFile(path.join(hostDir,name));}
      catch(error){errors.push(`Host document modules/host/${host}/${name} does not parse: ${error.message}`);continue;}
      if(path.basename(name).replace(/\.ya?ml$/i,'')==='index')index=doc;
    }
    add(errors,index!==null,`Host contract modules/host/${host}/ has no index.yaml`);
    if(!index)continue;
    add(errors,typeof index.schema==='string'&&index.schema.startsWith('starci/'),
      `Host contract modules/host/${host}/index.yaml must declare a starci/ schema id`);
    add(errors,index.provider===host,
      `Host contract modules/host/${host}/index.yaml provider must equal its directory name '${host}'`);
    const referenced=[index.agentCard,...(plain(index.files)?Object.values(index.files):[])]
      .filter(value=>typeof value==='string'&&/\.ya?ml$/i.test(value));
    for(const rel of referenced){
      const resolved=path.resolve(hostDir,rel);
      add(errors,fs.existsSync(resolved),
        `Host contract modules/host/${host}/index.yaml names a missing file: ${rel}`);
    }
  }

  // 3. Every adapter reference resolves to a real agent card — model profiles
  //    (launch.orca.adapter) and the registry's orcaLaunch.adapter alike.
  const profileFiles=yamlFilesIn(PROFILES_DIR);
  for(const name of profileFiles){
    const rel=`modules/models/profiles/${name}`;
    let profile=null;
    try{profile=readYamlFile(path.join(PROFILES_DIR,name));}
    catch(error){errors.push(`Model profile ${rel} does not parse: ${error.message}`);continue;}
    const adapter=profile?.launch?.orca?.adapter;
    if(adapter!==undefined)
      add(errors,typeof adapter==='string'&&Object.hasOwn(cards,adapter),`Profile ${rel} names unknown agent card: ${adapter}`);
    if(profile?.launch?.orca?.kind==='command-terminal')
      add(errors,typeof adapter==='string'&&adapter.length>0,`Command-terminal profile ${rel} must declare launch.orca.adapter`);
  }
  let registry=null;
  try{registry=fs.existsSync(REGISTRY_FILE)?readYamlFile(REGISTRY_FILE):null;}
  catch(error){errors.push(`modules/models/registry.yaml does not parse: ${error.message}`);}
  for(const [name,target] of Object.entries(registry?.targets||{})){
    const adapter=target?.orcaLaunch?.adapter;
    if(adapter!==undefined)
      add(errors,typeof adapter==='string'&&Object.hasOwn(cards,adapter),`Registry target ${name} names unknown agent card: ${adapter}`);
  }

  // 4. The Orca call contract is the argv source scripts/api/orca/lib.mjs
  //    reads, so every flag it names must be one of the call's own declared
  //    flags: a `required` or `forbidden` flag the entry does not declare can
  //    never be built, and a classify block that can fall off its end leaves
  //    the outcome to a default no document states.
  errors.push(...validateCallContract(readCallContract(root)));

  return {ok:errors.length===0,errors};
}

const readCallContract=(root=skillRoot)=>{
  const calls=path.join(hostsDir(root),'orca','calls.yaml');
  const api=path.join(hostsDir(root),'orca','api.yaml');
  if(!fs.existsSync(calls))return null;
  try{return {calls:readYamlFile(calls),api:fs.existsSync(api)?readYamlFile(api):null};}
  catch{return null;}
};

/** Static checks on modules/host/orca/calls.yaml — no Orca process is run. */
export function validateCallContract(docs){
  const errors=[];
  if(!docs?.calls)return errors;
  const {calls,api}=docs;
  const jsonFlag=calls.defaults?.jsonFlag;
  const publicCommands=Array.isArray(api?.publicCommands)?new Set(api.publicCommands):null;
  const forbidden=new Set(calls.forbiddenCalls??[]);
  const recoveries=new Set(Object.keys(calls.recoveries??{}));
  for(const [name,call] of Object.entries(calls.calls??{})){
    const declared=new Set([...(call?.flags??[]),jsonFlag].filter(Boolean));
    for(const flag of call?.required??[])
      add(errors,declared.has(flag),`calls.${name} requires --${flag} but does not declare it in flags`);
    for(const flag of call?.forbidden??[])
      add(errors,!declared.has(flag),`calls.${name} forbids --${flag} and also declares it in flags`);
    for(const flag of Object.keys(call?.forbiddenValues??{}))
      add(errors,(call?.forbidden??[]).includes(flag),
        `calls.${name} constrains --${flag} values but does not forbid it`);
    if(publicCommands){
      add(errors,publicCommands.has(call?.command),`calls.${name} names an unknown Orca command: ${call?.command}`);
      add(errors,!forbidden.has(call?.command),`calls.${name} names a forbidden command: ${call?.command}`);
    }
    add(errors,['read','mutation'].includes(call?.kind),`calls.${name} must declare kind read or mutation`);
    if(Array.isArray(call?.classify)){
      const last=call.classify.at(-1);
      add(errors,last&&Object.keys(last.when??{}).length===0,
        `calls.${name} classify must end with an unconditional rule — otherwise the outcome falls to an undeclared default`);
      for(const rule of call.classify){
        add(errors,(calls.envelope?.outcomes??[]).includes(rule?.outcome),`calls.${name} classify outcome ${rule?.outcome} is not in envelope.outcomes`);
        add(errors,(calls.envelope?.effectStates??[]).includes(rule?.effectState),`calls.${name} classify effectState ${rule?.effectState} is not in envelope.effectStates`);
      }
    }
    for(const target of Object.values(call?.recovery??{}))
      add(errors,recoveries.has(target),`calls.${name} names an undefined recovery: ${target}`);
  }
  add(errors,calls.liveSchema?.onMismatch==='refuse-before-effects',
    'calls.yaml liveSchema must state onMismatch: refuse-before-effects — scripts/api/orca/lib.mjs enforces it');
  if(calls.liveSchema)
    add(errors,Boolean(calls.calls?.['agent-context']),'calls.yaml liveSchema needs an agent-context entry to issue');
  return errors;
}

/**
 * Compare every calls.yaml entry against the live `orca agent-context --json`
 * signature. Returns one drift row per entry the binary cannot satisfy.
 */
export function compareCallsToLiveSchema({root=skillRoot,listing}={}){
  const docs=readCallContract(root);
  if(!docs?.calls)return {ok:false,drift:[{call:null,reason:'no modules/host/orca/calls.yaml to compare'}]};
  const live=listing===undefined?agentContext().listing:listing;
  if(!live)return {ok:false,drift:[{call:null,reason:'orca agent-context returned no command listing'}]};
  const jsonFlag=docs.calls.defaults?.jsonFlag;
  const drift=[];
  for(const [name,call] of Object.entries(docs.calls.calls??{})){
    const missing=missingFrom(live,call,jsonFlag);
    if(!missing)continue;
    drift.push({call:name,command:call?.command??null,
      missingCommand:missing.flags?false:true,missingFlags:missing.flags??[]});
  }
  return {ok:drift.length===0,drift};
}

export function requireProviderContracts(){
  const result=validateProviderContracts();
  if(!result.ok)throw Error(result.errors.join('; '));
  return result;
}

/** Checks entry: `node scripts/checks/providers.mjs` prints the validation report as JSON. */
export function providersMain(argv=[]){
  if(argv.includes('--help')||argv.includes('-h'))return {exitCode:0,report:{schema:'starci/providers-check-help@1',help:'Usage: node scripts/checks/providers.mjs [--live] [--root <dir>]\n\nValidates the provider contract tree (modules/models/agents/*.yaml agent cards, modules/host/<provider>/*.yaml host documents, the Orca call contract in modules/host/orca/calls.yaml, and the adapter references in modules/models/profiles/*.yaml and registry.yaml). Static by default - no process is run. --live additionally compares every calls.yaml command and flag against the live `orca agent-context --json` signature and exits 1 with the diff. --root checks another StarCi tree. Prints deterministic JSON. Exit 0 is valid, 1 reports contract errors.'}};
  const rootIndex=argv.indexOf('--root');
  const root=rootIndex>=0?argv[rootIndex+1]:skillRoot;
  const result=validateProviderContracts({root});
  if(!argv.includes('--live'))
    return {exitCode:result.ok?0:1,report:{schema:'starci/providers-check-report@1',...result}};
  const live=compareCallsToLiveSchema({root});
  return {exitCode:result.ok&&live.ok?0:1,
    report:{schema:'starci/providers-check-report@1',ok:result.ok&&live.ok,errors:result.errors,live}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=providersMain(process.argv.slice(2));
  process.stdout.write(result.report.help?`${result.report.help}\n`:`${JSON.stringify(result.report,null,2)}\n`);
  process.exitCode=result.exitCode;
}
