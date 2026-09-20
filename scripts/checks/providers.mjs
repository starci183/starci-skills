import {skillRoot} from '../../engine/runtime-root.mjs';
import {parseYaml} from '../../engine/yaml.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const add=(errors,condition,message)=>{if(!condition)errors.push(message);};

// The provider contract tree:
//   modules/models/agents/<agent>.yaml  — agent cards (schema starci/agent-card@1;
//     the card is the document's top level, claude/codex add a `capabilities:` key)
//   modules/host/orca/<doc>.yaml        — the Orca host contract docs (index, api,
//     calls, capabilities, recipes, validation, envelopes)
//   modules/models/profiles/<target>.yaml — profiles whose launch.orca.adapter
//     names an agent card
const AGENTS_DIR=path.join(skillRoot,'modules','models','agents');
const HOSTS_DIR=path.join(skillRoot,'modules','host');
const PROFILES_DIR=path.join(skillRoot,'modules','models','profiles');
const REGISTRY_FILE=path.join(skillRoot,'modules','models','registry.yaml');
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
export function validateProviderContracts(){
  const errors=[];

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

  // 2. Every host contract document under modules/host/<provider>/ parses —
  //    orca is required (the orchestrated host); claude/codex host docs validate
  //    the same way when present.
  add(errors,fs.existsSync(HOSTS_DIR),'Host contract directory is missing: modules/host/');
  const hosts=fs.existsSync(HOSTS_DIR)
    ?fs.readdirSync(HOSTS_DIR,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort()
    :[];
  add(errors,hosts.includes('orca'),'Orca host contract directory is missing: modules/host/orca/');
  for(const host of hosts){
    const docs=yamlFilesIn(path.join(HOSTS_DIR,host));
    add(errors,docs.length>0,`No host contract documents under modules/host/${host}/`);
    for(const name of docs){
      try{readYamlFile(path.join(HOSTS_DIR,host,name));}
      catch(error){errors.push(`Host document modules/host/${host}/${name} does not parse: ${error.message}`);}
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

  return {ok:errors.length===0,errors};
}

export function requireProviderContracts(){
  const result=validateProviderContracts();
  if(!result.ok)throw Error(result.errors.join('; '));
  return result;
}

/** Checks entry: `node scripts/checks/providers.mjs` prints the validation report as JSON. */
export function providersMain(argv=[]){
  if(argv.includes('--help')||argv.includes('-h'))return {exitCode:0,report:{schema:'starci/providers-check-help@1',help:'Usage: node scripts/checks/providers.mjs\n\nValidates the provider contract tree (modules/models/agents/*.yaml agent cards, modules/host/<provider>/*.yaml host documents, and the adapter references in modules/models/profiles/*.yaml and registry.yaml). Prints deterministic JSON. Exit 0 is valid, 1 reports contract errors.'}};
  const result=validateProviderContracts();
  return {exitCode:result.ok?0:1,report:{schema:'starci/providers-check-report@1',...result}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=providersMain(process.argv.slice(2));
  process.stdout.write(result.report.help?`${result.report.help}\n`:`${JSON.stringify(result.report,null,2)}\n`);
  process.exitCode=result.exitCode;
}
