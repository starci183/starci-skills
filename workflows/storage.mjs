import path from 'node:path';
import fs from 'node:fs';

/** A saved Plan may precede workspace initialization; do not mistake local state for Work. */
export function isLocalOnlyWorkspace(root) {
  if(!fs.existsSync(root))return false;
  const stat=fs.lstatSync(root);
  if(stat.isSymbolicLink()||!stat.isDirectory())return false;
  const entries=fs.readdirSync(root,{withFileTypes:true});
  return entries.length===1&&entries[0].name==='_local'&&entries[0].isDirectory()&&!entries[0].isSymbolicLink();
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
    if(['.work','.starci','.starcitemp'].includes(name))throw Error('Storage migration-required: new plans use .starciwork/_local/plans; preserve existing receipts.');
    if(name==='.starciwork') {
      const report=inspectStorage(path.dirname(current));
      if(!report.newWorkAllowed)throw Error(`Storage ${report.status}: coordinate migration before creating new work; never create parallel trees.`);
    }
    const parent=path.dirname(current);if(parent===current)break;current=parent;
  }
}

/** Legacy .work keeps its bound state. New Work owns local state, never a sibling temp tree. */
export function stateRoot(workRoot) {
  const root=path.resolve(workRoot);
  return path.basename(root)==='.work'?path.join(path.dirname(root),'.starci'):path.join(root,'_local');
}
