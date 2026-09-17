import path from 'node:path';
import fs from 'node:fs';

/**
 * Runtime state may precede workspace initialization; do not mistake it for Work. A Work root that holds
 * nothing but reserved runtime state has no Work in it yet, so `workspace init` may still create it and
 * `workStatus` still routes to preparation.
 *
 * The reserved set is the ledger and the kernel-owned corners beside it (docs/ledger-db.md §4/§12), plus
 * `_local`, which survives only as a `ledger-migrate` import source: a root that still has one is a root
 * that has not been migrated, not a root with Work in it.
 */
const RESERVED_RUNTIME_ENTRY=name=>name==='_local'||name==='ledger-anchor.json'
  ||name==='runtime.sqlite'||name==='runtime.sqlite-wal'||name==='runtime.sqlite-shm'
  ||['kernel-evidence','kernel-strays','kernel-headless'].includes(name);
export function isLocalOnlyWorkspace(root) {
  if(!fs.existsSync(root))return false;
  const stat=fs.lstatSync(root);
  if(stat.isSymbolicLink()||!stat.isDirectory())return false;
  const entries=fs.readdirSync(root,{withFileTypes:true});
  return entries.length>0&&entries.every(entry=>RESERVED_RUNTIME_ENTRY(entry.name)&&!entry.isSymbolicLink());
}

/** Inventory only. Never choose, move, merge or rewrite an existing binding. */
export function inspectStorage(backend) {
  const root=path.resolve(backend);
  for(let current=root;;) {
    try {const stat=fs.lstatSync(current);if(stat.isSymbolicLink()||!stat.isDirectory())return {schema:'starci/storage-inspection@1',readOnly:true,status:'unsafe',entries:{},newWorkAllowed:false};}
    catch(error){if(error.code!=='ENOENT')throw error;}
    const parent=path.dirname(current);if(parent===current)break;current=parent;
  }
  const entries=Object.fromEntries(['.starciwork','.starcitemp','.work','.starci'].map(name=>{
    const target=path.join(root,name);
    let kind='missing';
    try {const stat=fs.lstatSync(target);kind=stat.isSymbolicLink()?'link':stat.isDirectory()?'directory':'file';}
    catch(error){if(error.code!=='ENOENT')throw error;}
    return [name,{path:target,kind}];
  }));
  const exists=name=>entries[name].kind!=='missing';
  const legacy=exists('.work')||exists('.starci')||exists('.starcitemp'),canonical=exists('.starciwork');
  const unsafe=Object.values(entries).some(e=>!['missing','directory'].includes(e.kind));
  const status=unsafe?'unsafe':legacy?(canonical?'conflict':'migration-required'):(canonical?'ready':'new');
  return {schema:'starci/storage-inspection@1',readOnly:true,status,entries,newWorkAllowed:['ready','new'].includes(status)};
}

/** New plans/workspaces must not perpetuate legacy roots or create a parallel tree. */
export function assertNewStoragePath(destination) {
  let current=path.resolve(destination);
  for(;;) {
    const name=path.basename(current).toLowerCase();
    if(['.work','.starci','.starcitemp'].includes(name))throw Error('Storage migration-required: new work uses .starciwork; preserve existing receipts.');
    if(name==='.starciwork') {
      const report=inspectStorage(path.dirname(current));
      if(!report.newWorkAllowed)throw Error(`Storage ${report.status}: coordinate migration before creating new work; never create parallel trees.`);
    }
    const parent=path.dirname(current);if(parent===current)break;current=parent;
  }
}
