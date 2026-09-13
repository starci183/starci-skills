import fs from 'node:fs';
import path from 'node:path';
import {readDistJson} from '../core/runtime-root.mjs';
import {parseYaml} from '../core/yaml.mjs';

/**
 * The host model as data. `model/hosts.yaml` declares the whole of what the kernel knows about a host - a
 * name, the capabilities it offers beyond a worktree and a runtime, and whether it runs operations in
 * parallel - and this module is the only code that reads it, exactly as `kernel/graph.mjs` is the only code
 * that reads `model/kinds.yaml`.
 *
 * The point of moving the two descriptors out of the adapters is that they stop being two constants that can
 * drift: `hosts/orca/calls.mjs` and `hosts/headless/host.mjs` now ask for the same profile, so a host that
 * gains a capability is one diff in a file a reviewer can read, and `validateHosts` can check the capability
 * names against the kinds vocabulary a kind's `needs` is drawn from.
 */
export const HOSTS_PROFILE='starci/hosts@1';
/**
 * The closed list of hosts. A third host is a new adapter module as well as a new profile entry, so the two
 * names are required here and a profile that drops one is rejected rather than silently leaving an adapter
 * without a descriptor.
 */
export const HOST_NAMES=Object.freeze(['orca','headless']);
/**
 * What the two adapters are when no profile can be read at all. A host must be able to describe itself before
 * a build exists: `hosts/orca/calls.mjs` is imported by the very command that builds `.dist`, and the
 * installer's own doctor run imports the headless host in a tree whose `.dist` is still being written. Falling
 * back to the values the profile ships keeps that path working, and `tests/hosts.spec.mjs` asserts the
 * fallback and the profile say the same thing, so the duplication cannot become a disagreement.
 */
export const BUILT_IN_HOSTS=Object.freeze({
  orca:Object.freeze({name:'orca',capabilities:Object.freeze(['design-tool']),sequential:false}),
  headless:Object.freeze({name:'headless',capabilities:Object.freeze([]),sequential:true})
});

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const listOf=value=>Array.isArray(value)?value.filter(item=>typeof item==='string'):[];
const fail=(errors,code,message,detail={})=>{errors.push({code,message,...detail});};

let distProfile=null;

/**
 * Load the host profile. Without `profileDir` it is the compiled `.dist/model/hosts.json`, the same way
 * `loadKinds` loads the kind catalog, so the call works from the authored tree and from the `.dist` copy.
 * With `profileDir` the authored YAML (or a fixture) is read directly, which is how the tests and
 * `validateHosts` read a profile that has not been built yet.
 */
export function loadHosts({profileDir=null}={}){
  if(!profileDir){
    if(!distProfile)distProfile=readDistJson('model','hosts.json');
    return distProfile;
  }
  const dir=path.resolve(profileDir);
  for(const name of ['hosts.yaml','hosts.yml']){
    const file=path.join(dir,name);
    if(fs.existsSync(file))return parseYaml(fs.readFileSync(file,'utf8'));
  }
  const json=path.join(dir,'hosts.json');
  if(fs.existsSync(json))return JSON.parse(fs.readFileSync(json,'utf8'));
  throw Error(`No hosts profile in ${dir}: expected hosts.yaml`);
}

const entryOf=(profile,name)=>plain(profile?.hosts?.[name])?profile.hosts[name]:null;

/**
 * One host as the kernel sees it: `{name, capabilities, sequential}` and nothing else, with its own arrays so
 * a caller that keeps the descriptor cannot reach back into the cached profile. A profile that cannot be read
 * - no `.dist` yet, a half-written file - falls back to the built-in values for the two known hosts instead of
 * throwing, because an adapter that cannot describe itself cannot even report the failure. An unknown name is
 * a bug in the caller, so that does throw.
 */
export function hostDescriptor(name,{profile=null,profileDir=null}={}){
  let entry=null;
  try{entry=entryOf(profile??loadHosts({profileDir}),name);}catch{entry=null;}
  const fallback=BUILT_IN_HOSTS[name]??null;
  if(!entry){
    if(!fallback)throw Error(`Unknown host ${name}; the profile declares ${HOST_NAMES.join(', ')}`);
    return {name,capabilities:[...fallback.capabilities],sequential:fallback.sequential};
  }
  return {name,capabilities:listOf(entry.capabilities),sequential:entry.sequential===true};
}

/**
 * Check a host profile against the kinds vocabulary a kind's `needs` is drawn from. A capability the
 * vocabulary does not know is the one error that cannot be caught anywhere else: it is not a typo that makes
 * an operation fail, it is a promise no kind will ever ask for, so the host silently offers nothing while
 * reading as though it offers something. `kinds` is the loaded kinds profile; without it the capability names
 * are left unchecked and only the shape is judged.
 */
export function validateHosts(given=null,{kinds=null}={}){
  const errors=[];
  let profile=given;
  if(!profile){try{profile=loadHosts();}catch(error){fail(errors,'host-shape',error.message);return errors;}}
  if(!plain(profile)||!plain(profile.hosts)){fail(errors,'host-shape','A hosts profile needs a hosts mapping');return errors;}
  if(profile.schema!==HOSTS_PROFILE)fail(errors,'profile-schema',`Unexpected hosts profile schema ${profile.schema}`,{schema:profile.schema??null});
  const vocabulary=listOf(kinds?.vocabularies?.capabilities);
  const declared=Object.keys(profile.hosts);
  // Both adapters must find themselves here: a missing entry leaves that adapter on its built-in fallback,
  // which is precisely the silent drift this profile exists to prevent.
  for(const name of HOST_NAMES)if(!declared.includes(name))fail(errors,'host-shape',`The profile is missing the required host ${name}`,{host:name});
  for(const name of declared)if(!HOST_NAMES.includes(name))fail(errors,'host-shape',`${name} is not in the closed host list of hosts/index.mjs`,{host:name});
  for(const [name,entry] of Object.entries(profile.hosts)){
    if(!plain(entry)){fail(errors,'host-shape',`Host ${name} is not a mapping`,{host:name});continue;}
    if(!Array.isArray(entry.capabilities))fail(errors,'host-shape',`Host ${name} must declare capabilities as a list`,{host:name});
    if(typeof entry.sequential!=='boolean')fail(errors,'host-shape',`Host ${name} must say whether it is sequential`,{host:name});
    if(typeof entry.purpose!=='string'||!entry.purpose.trim())fail(errors,'host-shape',`Host ${name} must declare a one-line purpose`,{host:name});
    if(!vocabulary.length)continue;
    for(const capability of listOf(entry.capabilities)){
      if(!vocabulary.includes(capability))
        fail(errors,'unknown-host-capability',`Host ${name} offers ${capability}, which the kinds capability vocabulary does not declare`,{host:name,capability});
    }
  }
  return errors;
}

/** Throw on the first error, for a caller that wants the profile or nothing. */
export function assertHosts(profile=null,{kinds=null}={}){
  const errors=validateHosts(profile,{kinds});
  if(errors.length)throw Error(`Invalid hosts profile: ${errors.map(error=>error.message).join('; ')}`);
  return profile??loadHosts();
}
