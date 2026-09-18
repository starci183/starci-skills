import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';

/**
 * The layout check reads a `.starciwork` tree and reports where the directories and the ids disagree with
 * `schemas/work-layout.yaml`. It is report-only on purpose: it never edits, never moves a file and never
 * throws on a malformed tree - a malformed tree is the thing it is here to describe. The only refusals are
 * about its own input: a root that does not exist, or a tree so large that walking it is not a check but an
 * accident.
 *
 * What it can see is the shape: the three custodies at the root, the eleven families, one directory per
 * record, the node file that makes a directory a record, assets that stay payload, parents that aggregate,
 * and the id that mirrors the path. What is inside a record - its fields, its refs, whether its evidence
 * actually proves anything - belongs to the record schemas and the record checker. Three keys are read
 * here and no others: `id`, because the layout is about where a record's name puts it; `schema`, to catch
 * a brand record outside brand/; and `evidence.record`, to catch proof stored away from its subject.
 */
export const RESULT='starci/work-layout-check@1';

const MAX_ENTRIES=200000;
const NODE='index.yaml';
const EVIDENCE_NODE='manifest.yaml';

/** The eleven families. A feature directory holds these and nothing else. */
export const FAMILIES=Object.freeze(['br','fr','nfr','data','journey','decision','integration','sds','ui','impl','uat']);

/** Untracked runtime custody: legal at the root of the tree, drift anywhere below it. */
const RUNTIME_ROOT_FILES=new Set(['runtime.sqlite','runtime.sqlite-wal','runtime.sqlite-shm']);
const RUNTIME_ROOT_DIRS=new Set(['kernel-evidence','kernel-strays','kernel-headless','kernel-approvals','_local']);
/** Tracked canonical Work, plus the tracked counter-record and the file that names the untracked half. */
const CANONICAL_ROOT_FILES=new Set(['workspace.yaml','index.yaml','ledger-anchor.json','.gitignore']);
const CANONICAL_ROOT_DIRS=new Set(['brand','features','shared']);

/** Keys only a leaf may author; a parent that carries one is claiming work it does not do. */
const STATE_KEYS=['state','proven','provenBy','requiresProof','evidence','completion','activity'];

const slash=value=>String(value??'').replaceAll('\\','/');
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);

function entries(dir){
  try{return fs.readdirSync(dir,{withFileTypes:true});}catch{return [];}
}
/** Directories and files are classified without following a symlink: a link is neither, and is reported. */
const isDir=entry=>entry.isDirectory()&&!entry.isSymbolicLink();
const isFile=entry=>entry.isFile()&&!entry.isSymbolicLink();
const regularFile=file=>{try{const stat=fs.lstatSync(file);return stat.isFile()&&!stat.isSymbolicLink();}catch{return false;}};
const regularDir=dir=>{try{const stat=fs.lstatSync(dir);return stat.isDirectory()&&!stat.isSymbolicLink();}catch{return false;}};

function readId(file){
  try{
    const parsed=parseYaml(fs.readFileSync(file,'utf8'));
    return object(parsed)?parsed:null;
  }catch{return null;}
}

/** Every directory below `dir`, plus `dir` itself, that holds `name`. Used to keep assets free of nodes. */
function containsNodeFile(dir,budget){
  for(const entry of entries(dir)){
    if(budget.spend()===false)return null;
    const child=path.join(dir,entry.name);
    if(isFile(entry)&&(entry.name===NODE||entry.name===EVIDENCE_NODE))return child;
    if(isDir(entry)){const found=containsNodeFile(child,budget);if(found)return found;}
  }
  return null;
}

/**
 * One walk over a family subtree. Returns whether this directory or anything below it is a record, which
 * is what tells a grouping segment (`br/complete/`) from a record that lost its node file.
 */
function walkScope(context,dir,segments){
  const {add,rel,budget}=context;
  const nodeFile=path.join(dir,NODE);
  const hasNode=regularFile(nodeFile);
  let descendantRecord=false,scopeChildren=0;

  for(const entry of entries(dir)){
    if(budget.spend()===false)return hasNode||descendantRecord;
    const child=path.join(dir,entry.name);
    if(entry.isSymbolicLink()){add('WORK_UNKNOWN_RECORD_ENTRY',rel(child),'a symbolic link is not part of the layout and is not followed');continue;}
    if(isFile(entry)){
      if(entry.name===NODE)continue;
      if(entry.name==='accounts.yaml'&&context.family==='uat'&&hasNode)continue;
      if(entry.name===EVIDENCE_NODE)add('WORK_EVIDENCE_MISPLACED',rel(child),"evidence is written into the record it proves, under the record's own evidence: key; a manifest beside it is proof separated from its subject");
      else if(RUNTIME_ROOT_FILES.has(entry.name))add('WORK_RUNTIME_IN_CANONICAL',rel(child),'runtime custody belongs at the root of the tree, never inside canonical Work');
      else add('WORK_UNKNOWN_RECORD_ENTRY',rel(child),`a record directory holds ${NODE}, its sub-parts and assets/; this file is none of them`);
      continue;
    }
    if(!isDir(entry))continue;
    if(RUNTIME_ROOT_DIRS.has(entry.name)){add('WORK_RUNTIME_IN_CANONICAL',rel(child),'runtime custody belongs at the root of the tree, never inside canonical Work');continue;}
    if(entry.name==='assets'){checkAssets(context,child);continue;}
    if(entry.name==='brand'){add('WORK_SECOND_BRAND',rel(child),'the brand is one record at brand/index.yaml beside features/');continue;}
    if(entry.name==='ac'){
      if(context.family!=='br')add('WORK_UNKNOWN_RECORD_ENTRY',rel(child),'acceptance criteria hang off a business rule; ac/ is meaningless under this family');
      else if(!hasNode)add('WORK_RECORD_MISSING_INDEX',rel(dir),`ac/ belongs to a record, and this directory has no ${NODE}`);
      else checkAcceptance(context,child,segments);
      continue;
    }
    if(entry.name==='evidence'){
      add('WORK_EVIDENCE_MISPLACED',rel(child),"evidence is written into the record it proves, under the record's own evidence: key; a directory beside the record is proof that has drifted from its subject");
      continue;
    }
    scopeChildren+=1;
    if(walkScope(context,child,[...segments,entry.name]))descendantRecord=true;
  }

  if(hasNode){
    const record=readId(nodeFile);
    const expected=[context.family,context.owner,...segments].join('.');
    if(record===null)add('WORK_RECORD_MISSING_INDEX',rel(nodeFile),'the node file is unreadable YAML, so this directory has no readable record');
    else{
      if(String(record.schema??'')==='work/brand'){
        context.brands.count+=1;
        add('WORK_SECOND_BRAND',rel(nodeFile),'the brand is one record at brand/index.yaml beside features/; a brand inside a feature is a second opinion about the product');
      }
      if(descendantRecord){
        const authored=STATE_KEYS.filter(key=>record[key]!==undefined);
        if(authored.length)add('WORK_PARENT_AUTHORS_STATE',rel(nodeFile),`a record with records below it aggregates and authors no ${authored.join(', ')}`);
      }
      if(String(record.id??'')!==expected)
        add('WORK_ID_PATH_MISMATCH',rel(nodeFile),`id is "${record.id??''}"; this directory says "${expected}"`);
      // The evidence block is written into the record it proves. If it names a record at all, it names
      // this one: a block that names another is proof stored where nobody will re-run it.
      const named=object(record.evidence)?record.evidence.record:undefined;
      if(named!==undefined&&String(named)!==expected)
        add('WORK_EVIDENCE_MISPLACED',rel(nodeFile),`the evidence block names record "${named}"; it is stored in "${expected}"`);
    }
  }else if(!descendantRecord&&scopeChildren===0){
    // Only the deepest directory that lost its node is named. A grouping segment above it is quiet: its
    // child already reports the one defect, and repeating it up the chain buries the place to fix.
    add('WORK_RECORD_MISSING_INDEX',rel(dir),`a leaf directory below a family is a record and needs ${NODE}`);
  }
  return hasNode||descendantRecord;
}

/** assets/ is payload at any depth: bytes, never a node. */
function checkAssets(context,dir){
  const found=containsNodeFile(dir,context.budget);
  if(found)context.add('WORK_ASSET_AS_NODE',context.rel(found),'assets/ is payload; a node under it is a record hidden in the bytes');
}

function checkAcceptance(context,dir,ruleSegments){
  const {add,rel}=context;
  for(const entry of entries(dir)){
    const child=path.join(dir,entry.name);
    if(isFile(entry)){add('WORK_UNKNOWN_RECORD_ENTRY',rel(child),'ac/ holds one directory per criterion');continue;}
    if(!isDir(entry))continue;
    const nodeFile=path.join(child,NODE);
    if(!regularFile(nodeFile)){add('WORK_RECORD_MISSING_INDEX',rel(child),`an acceptance criterion is a record and needs ${NODE}`);continue;}
    const record=readId(nodeFile);
    const expected=['ac',context.owner,...ruleSegments,entry.name].join('.');
    if(record===null)add('WORK_RECORD_MISSING_INDEX',rel(nodeFile),'the node file is unreadable YAML');
    else if(String(record.id??'')!==expected)
      add('WORK_ID_PATH_MISMATCH',rel(nodeFile),`id is "${record.id??''}"; this directory says "${expected}"`);
    for(const inner of entries(child))
      if(isDir(inner)&&inner.name!=='assets')add('WORK_UNKNOWN_RECORD_ENTRY',rel(path.join(child,inner.name)),'a criterion is a leaf; it holds no further record');
      else if(isDir(inner))checkAssets(context,path.join(child,inner.name));
  }
}

/** One owner of families: a feature directory, or `shared/`. */
function checkFamilies(context,dir,owner){
  const {add,rel,budget}=context;
  for(const entry of entries(dir)){
    if(budget.spend()===false)return;
    const child=path.join(dir,entry.name);
    if(isFile(entry)){
      if(entry.name===NODE)continue;
      add('WORK_UNKNOWN_FAMILY',rel(child),'a family owner holds family directories; this file is not one');
      continue;
    }
    if(!isDir(entry))continue;
    if(RUNTIME_ROOT_DIRS.has(entry.name)){add('WORK_RUNTIME_IN_CANONICAL',rel(child),'runtime custody belongs at the root of the tree, never inside canonical Work');continue;}
    if(!FAMILIES.includes(entry.name)){
      add('WORK_UNKNOWN_FAMILY',rel(child),`a feature holds only ${FAMILIES.join(', ')}; a new kind of record is a change to the layout, not a directory`);
      continue;
    }
    const family={...context,family:entry.name,owner};
    let record=false;
    for(const scope of entries(child)){
      const scopeDir=path.join(child,scope.name);
      if(isFile(scope)){add('WORK_UNKNOWN_RECORD_ENTRY',rel(scopeDir),'a family directory holds record directories');continue;}
      if(!isDir(scope))continue;
      if(walkScope(family,scopeDir,[scope.name]))record=true;
    }
    if(!record)add('WORK_EMPTY_FAMILY',rel(child),'a family directory with no record in it is scaffolding');
  }
}

/**
 * Reads the layout of one `.starciwork` tree.
 *
 *   checkWorkLayout({workRoot:'…/.starciwork'}) -> {schema, clean, findings:[{code,path,detail}]}
 */
export function checkWorkLayout({workRoot}={}){
  const root=path.resolve(String(workRoot??''));
  if(!workRoot||!fs.existsSync(root)||!fs.statSync(root).isDirectory())throw Error(`Not a Work root: ${workRoot??'(none)'}`);
  const findings=[];
  let spent=0;
  const budget={spend(){spent+=1;return spent<=MAX_ENTRIES;}};
  const rel=target=>slash(path.relative(root,target))||'.';
  const add=(code,at,detail)=>{findings.push({code,path:at,detail});};
  const brands={count:0};
  const context={add,rel,budget,family:null,owner:null,brands};

  for(const entry of entries(root)){
    const child=path.join(root,entry.name);
    if(entry.isSymbolicLink()){add('WORK_ROOT_UNKNOWN_ENTRY',rel(child),'a symbolic link at the root is none of the three custodies');continue;}
    if(isFile(entry)){
      if(!CANONICAL_ROOT_FILES.has(entry.name)&&!RUNTIME_ROOT_FILES.has(entry.name))
        add('WORK_ROOT_UNKNOWN_ENTRY',rel(child),'the root holds canonical Work, the tracked ledger-anchor.json and untracked runtime custody; this is none of them');
      continue;
    }
    if(!isDir(entry))continue;
    if(RUNTIME_ROOT_DIRS.has(entry.name))continue;
    if(CANONICAL_ROOT_DIRS.has(entry.name))continue;
    add('WORK_ROOT_UNKNOWN_ENTRY',rel(child),'the root holds workspace.yaml, index.yaml, brand/, features/, shared/, ledger-anchor.json and runtime custody; this is none of them');
  }

  const workspace=path.join(root,'workspace.yaml');
  if(!regularFile(workspace))add('WORK_RECORD_MISSING_INDEX','workspace.yaml','a Work tree names its project in workspace.yaml');
  const catalog=path.join(root,'index.yaml');
  if(!regularFile(catalog))add('WORK_RECORD_MISSING_INDEX','index.yaml',`the product catalog is ${NODE} at the root`);
  else{
    const record=readId(catalog);
    if(record===null)add('WORK_RECORD_MISSING_INDEX','index.yaml','the catalog is unreadable YAML');
    else{
      const authored=STATE_KEYS.filter(key=>record[key]!==undefined);
      if(authored.length)add('WORK_PARENT_AUTHORS_STATE','index.yaml',`the catalog aggregates and authors no ${authored.join(', ')}`);
    }
  }

  const brandNode=path.join(root,'brand',NODE);
  if(regularFile(brandNode)){
    brands.count+=1;
    const record=readId(brandNode);
    if(record!==null&&String(record.id??'')!=='brand')
      add('WORK_ID_PATH_MISMATCH',rel(brandNode),`id is "${record.id??''}"; this directory says "brand"`);
  }
  for(const entry of entries(path.join(root,'brand')))
    if(isDir(entry)&&entry.name==='assets')checkAssets(context,path.join(root,'brand','assets'));

  const features=path.join(root,'features');
  for(const entry of entries(features)){
    const child=path.join(features,entry.name);
    if(isFile(entry)){add('WORK_ROOT_UNKNOWN_ENTRY',rel(child),'features/ holds one directory per feature; the catalog is index.yaml at the root');continue;}
    if(!isDir(entry))continue;
    const nodeFile=path.join(child,NODE);
    if(!regularFile(nodeFile))add('WORK_RECORD_MISSING_INDEX',rel(child),`a feature needs ${NODE}`);
    else{
      const record=readId(nodeFile);
      if(record===null)add('WORK_RECORD_MISSING_INDEX',rel(nodeFile),'the feature node is unreadable YAML');
      else{
        if(String(record.schema??'')==='work/brand'){brands.count+=1;add('WORK_SECOND_BRAND',rel(nodeFile),'the brand is one record at brand/index.yaml; a second one has no way to be the product\'s brand');}
        if(String(record.id??'')!==entry.name)add('WORK_ID_PATH_MISMATCH',rel(nodeFile),`id is "${record.id??''}"; this directory says "${entry.name}"`);
        const authored=STATE_KEYS.filter(key=>record[key]!==undefined);
        if(authored.length)add('WORK_PARENT_AUTHORS_STATE',rel(nodeFile),`a feature aggregates and authors no ${authored.join(', ')}`);
      }
    }
    checkFamilies(context,child,entry.name);
  }

  const shared=path.join(root,'shared');
  if(regularDir(shared))checkFamilies(context,shared,'shared');

  if(brands.count>1)findings.push({code:'WORK_SECOND_BRAND',path:'brand',detail:`${brands.count} brand records; a product has one brand or none`});
  if(spent>MAX_ENTRIES)add('WORK_ROOT_UNKNOWN_ENTRY','.',`the tree exceeds ${MAX_ENTRIES} entries; the walk stopped and this report is incomplete`);

  findings.sort((left,right)=>left.path.localeCompare(right.path)||left.code.localeCompare(right.code));
  return {schema:RESULT,clean:findings.length===0,root,findings};
}

/** One line per finding, for a person reading a terminal. */
export function formatWorkLayout(result){
  if(result.clean)return `work layout ${result.root}: clean`;
  return [`work layout ${result.root}: ${result.findings.length} finding(s)`,
    ...result.findings.map(finding=>`  ${finding.code} ${finding.path}: ${finding.detail}`)].join('\n');
}
