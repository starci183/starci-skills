// Ledger path identity and ownership resolution; connection policy and caches remain in ledger.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sha256} from '../digest.mjs';
import {isUnderTempDir,localProjectsRoot,readMachine} from './machine.mjs';
import {isSpecRun} from '../../scripts/lib/env.mjs';
import {pathKey} from '../../scripts/lib/path-key.mjs';
import {byCodeUnit} from '../by-code-unit.mjs';
/** Overrides the projects root (the directory holding <ledger_id>/runtime.sqlite) for this process tree; narrower than machine-db.mjs LOCAL_ROOT_ENV, which this still honors through starciLocalRoot when unset. */
export const PROJECTS_ROOT_ENV='STARCI_PROJECTS_ROOT';
const normDir=file=>pathKey(file);
/** <runtime root>/.runtime/projects (starciLocalRoot, itself overridable by STARCI_LOCAL_ROOT; a node --test process tree gets one under the OS temp directory). */
export const projectsRootFor=(env=process.env)=>{
  if(env[PROJECTS_ROOT_ENV])return path.resolve(env[PROJECTS_ROOT_ENV]);
  const root=localProjectsRoot(env);
  if(isSpecRun(env)&&!isUnderTempDir(root,{env}))return path.join(os.tmpdir(),'starci-test-projects');
  return root;
};
/** Repository identity: resolved/realpath, forward slashes, case-folded only on Windows. */
export const repoRootKey=repoRoot=>{let root=path.resolve(repoRoot);try{root=fs.realpathSync.native(root);}catch{}return normDir(root);};
/**
 * The ledger id of a repository root until the machine registry (a3-2 machine.ledgers) resolves it: a name-based
 * UUID of the normalized root, so the same root always names the same ledger and no side registry is needed.
 */
const ledgerIdFromKey=key=>{
  const h=sha256(`starci-ledger:${key}`);
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-${(8|(parseInt(h[16],16)&3)).toString(16)}${h.slice(17,20)}-${h.slice(20,32)}`;
};
export const ledgerIdForRepo=repoRoot=>ledgerIdFromKey(repoRootKey(repoRoot));
/** The registered runtime.sqlite of `repoRoot` in machine.ledgers (a3-2 resolveLedger), or null. */
function registeredLedgerFile(root,env,openReader){
  let row;try{row=readMachine(m=>m.resolveLedger({repoRoot:root}),null,{env});}catch{return null;}
  const file=row&&row.state!=='retired'&&row.file?path.resolve(row.file):null;
  if(file&&fs.existsSync(file))assertLedgerRoot(file,root,openReader);
  return file;
}
function assertLedgerRoot(file,root,openReader){
  const db=openReader(file);let own;try{own=db.prepare("SELECT value FROM meta WHERE key='repo_root'").get()?.value;}finally{db.close();}
  if(!own||repoRootKey(own)!==repoRootKey(root))throw Object.assign(Error(`ledger-root-mismatch: ${file} belongs to another or unverified repository; preserve the database and resolve the owner binding before migration`),{code:'STARCI_LEDGER_ROOT_MISMATCH'});
}
function unregisteredLedgerFile(root,env,openReader){
  const base=projectsRootFor(env),current=path.join(base,ledgerIdForRepo(root),'runtime.sqlite');
  if(fs.existsSync(current)){assertLedgerRoot(current,root,openReader);return current;}
  // Preserve a pre-fix POSIX binding only when its own exact repo_root proves
  // this repository. Never silently move, rename or merge an old folded store.
  const legacy=path.join(base,ledgerIdFromKey(repoRootKey(root).toLowerCase()),'runtime.sqlite');
  if(legacy!==current&&fs.existsSync(legacy)){assertLedgerRoot(legacy,root,openReader);return legacy;}
  return current;
}
/** Resolve the registry or exact owned store; the ledger owner supplies its verified read-only opener. */
export function resolveLedgerFile(root,{env,openReader}){
  return registeredLedgerFile(root,env,openReader)??unregisteredLedgerFile(root,env,openReader);
}

const SYNTHETIC_LEDGER_ID=/^00000000-0000-4000-8000-[0-9a-f]{12}$/;
const fixtureRefused=message=>{throw new TypeError(`ledger-fixture-refused: ${message}`);};
/** Validate a fresh, initialization-only sample identity. Samples carry portable metadata,
 * never a repository/machine binding; the ordinary project resolver is not bypassed. */
export function ledgerFixtureInit(fixture,{file,repoRoot,product,machine,mapped,checkpointer,now}){
  if(fixture===null){
    if(typeof file==='string'&&SYNTHETIC_LEDGER_ID.test(path.basename(path.dirname(path.resolve(file)))))fixtureRefused('synthetic identity is reserved for a sample');
    return null;
  }
  if(!fixture||typeof fixture!=='object'||Array.isArray(fixture)
    ||![Object.prototype,null].includes(Object.getPrototypeOf(fixture))
    ||Object.keys(fixture).sort(byCodeUnit).join(',')!=='blobRoot,createdAt,ledgerId')fixtureRefused('needs exactly ledgerId, createdAt and blobRoot');
  if(typeof fixture.ledgerId!=='string'||!SYNTHETIC_LEDGER_ID.test(fixture.ledgerId))fixtureRefused('ledgerId must be a synthetic UUID');
  if(!Number.isSafeInteger(fixture.createdAt)||fixture.createdAt<=0||!Number.isFinite(new Date(fixture.createdAt).getTime()))fixtureRefused('createdAt must be a positive safe epoch millisecond');
  const root=fixture.blobRoot;
  if(typeof root!=='string'||!root||root.includes('\\')||root.trim()!==root||/[<>:"|?*\x00-\x1f]/.test(root)
    ||path.posix.isAbsolute(root)||root.split('/').some(p=>!p||p==='.'||p==='..'))fixtureRefused('blobRoot must be a portable relative path');
  if(repoRoot!==null||product!==null||machine!==null||mapped)fixtureRefused('a sample cannot bind a repository, product, machine or cached project path');
  if(!checkpointer||now!==Date.now)fixtureRefused('initialization owns its frozen clock and requires a checkpointer');
  if(typeof file!=='string'||!path.isAbsolute(file)||path.basename(file)!=='runtime.sqlite')fixtureRefused('file must be an explicit absolute runtime.sqlite');
  for(const suffix of ['','-wal','-shm'])if(fs.lstatSync(file+suffix,{throwIfNoEntry:false}))fixtureRefused('file and WAL/SHM must be absent');
  const parent=path.dirname(file),stat=fs.lstatSync(parent,{throwIfNoEntry:false});
  if(!stat?.isDirectory()||stat.isSymbolicLink()||fs.realpathSync.native(parent)!==path.resolve(parent))fixtureRefused('sample parent must be an existing physical directory');
  return Object.freeze({...fixture,marker:'starci/basic-runtime-fixture@1'});
}
/** Refuse sample bytes as an operational ledger before opening a writer or beginning a transaction. */
export function assertOperationalLedger(meta){
  if(meta.fixture||SYNTHETIC_LEDGER_ID.test(meta.ledger_id??''))throw new Error('ledger-fixture-read-only: preserve the sample; initialize a new live project store');
}
