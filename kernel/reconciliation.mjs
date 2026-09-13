import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Reconciliation: adding a feature to a product that already decided records is three cases, as data.
 *
 * A feature C that arrives beside decided features A and B is never appended. Every side of C that touches a
 * decided record is one typed row in C's module record under `extensions.work3.reconciliation`:
 *
 * - `reference` - C repeats what A already holds, so C cites A by id and never restates it;
 * - `conflict`  - C cannot hold together with what A decided, so the intake writes a decision record under C
 *                 with both sides, the consequences, numbered options and one recommendation, and the owner
 *                 decides; nothing of A is overwritten and nothing is averaged;
 * - `new`       - C is genuinely new, authored under C, declaring what it reads and what it hands on.
 *
 * This module is the mechanical half of that rule: it reads the rows, checks the seven things that can be
 * decided without a model (does the record exist, is it decided, was it edited, does the decision exist and
 * is it still open, does a new record restate a referenced one, may a new record cite what it cites), and
 * turns every `conflict` row into the owner's question. What is left - whether a reference row really covers
 * the claim, whether a new record restates a decided one in other words, whether a conflict decision states
 * both sides - is the validator's, and it is told which case each row claims.
 *
 * It is pure apart from reading node files, which it does through the `readNode` and `readFile` the caller
 * injects, so the kernel, the tests and a future host all drive the same checks over their own trees.
 */

export const RECONCILIATION_CASES=['reference','conflict','new'];
/** The seven mechanical findings of the design. Each one downgrades an intake report to `failed` and retries it. */
export const RECONCILIATION_FINDINGS=['reconciliation-missing','reference-unknown','reference-restated',
  'conflict-without-decision','conflict-edited','new-unknown','new-reads-blind'];
/** A row the reader could not shape at all. It is a finding rather than a throw: a malformed table is the intake's defect, not the kernel's crash. */
export const ROW_MALFORMED='reconciliation-row-malformed';
/** The key the table lives under, named once so the contract, the schema and this module cannot drift apart. */
export const RECONCILIATION_KEY='extensions.work3.reconciliation';
/** A sentence this long, repeated word for word, is a restatement rather than a coincidence of vocabulary. */
export const RESTATEMENT_WORDS=12;

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>String(value??'').trim();
const slash=value=>String(value??'').replaceAll('\\','/');
const unique=list=>[...new Set(list)];
const strings=value=>(Array.isArray(value)?value:[]).map(text).filter(Boolean);

/**
 * Whether a scope entry names this node, read exactly as the kernel's own scope filter reads it: by id prefix
 * or by tree path, so `collab`, `features/collab` and a full id prefix all name the same feature.
 */
export function inScope(node,entry){
  const key=slash(entry).replace(/\/+$/,''),id=text(node?.id),where=slash(node?.path??'');
  if(!key)return false;
  return id===key||id.startsWith(`${key}.`)||where===key||where.startsWith(`${key}/`)||where.startsWith(`features/${key}/`);
}

/* ------------------------------------------------------------------ the record catalog, by layout */

/**
 * What a file in the Work tree is, independent of the operation that wrote it (design §2). The order is the
 * catalog's own: the most specific layout wins, which is why a decision under `business/srs/decisions/**` is
 * a `decision` and not the `srs` its path also matches.
 */
const LAYOUT=[
  ['asset',/(^|\/)assets\//],
  ['evidence',/(^|\/)evidence\//],
  ['decision',/^features\/[^/]+\/business\/srs\/decisions\//],
  ['integration',/^features\/[^/]+\/integration\//],
  ['design',/^features\/[^/]+\/ui\//],
  ['srs',/^features\/[^/]+\/business\//],
  ['sds',/^features\/[^/]+\/architecture\//],
  ['brand',/^brand\//],
  ['grammar',/^knowledge\/grammars\//]
];
/** The record kind of one Work node, from its path; a node the layout does not place is the node's own `record`. */
export function recordKindOfNode(node){
  const where=slash(node?.path??'').replace(/^\/+/,'');
  if(!where)return null;
  for(const [kind,pattern] of LAYOUT)if(pattern.test(where))return kind;
  return 'record';
}
/**
 * What each record kind is derived from (design §2), plus the record's own kind: a rule that refines another
 * rule, or a design that cites a sibling design, is a peer citation and not a derivation - which is exactly
 * what the design's own worked `new` row does when a collab requirement cites a sales requirement.
 */
const RECORD_READS={
  record:[],srs:['decision'],sds:['srs','decision'],decision:[],brand:['code'],
  design:['srs','sds','brand','grammar'],asset:['design','brand'],code:['sds'],grammar:['design'],
  evidence:['code','design','srs'],runtime:['code'],integration:['srs','sds']
};
/** The record kinds a record of this kind may cite. An unknown kind cites nothing, so it is never silently widened. */
export function recordReadsOf(kind){
  const key=text(kind);
  if(!(key in RECORD_READS))return [];
  return unique([key,...RECORD_READS[key]]);
}

/* ------------------------------------------------------------------ digests of the decided records */

const workRootOf=tree=>slash(tree?.workRoot??tree?.at?.workRoot??'');
/** The file one node was authored in, so a digest is taken over the bytes the owner would read. */
export function nodeFileOf(tree,node){
  if(node?.file)return path.resolve(String(node.file));
  const root=workRootOf(tree);
  return root?path.join(root,...slash(node?.path??'').split('/').filter(Boolean)):slash(node?.path??'');
}
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
/**
 * The content digest of every node of the tree: sha256 of the node file's bytes. The kernel captures this at
 * launch, so a `conflict` row whose decided record moved while the intake ran is caught against what the tree
 * held BEFORE the op, not against the intake's own word for it. A node whose file cannot be read is left out
 * rather than given a digest of nothing, because an unreadable record proves no edit either way.
 */
export function recordDigests(tree,readFile=null){
  const read=typeof readFile==='function'?readFile:node=>fs.readFileSync(nodeFileOf(tree,node));
  const digests={};
  for(const node of Array.isArray(tree?.list)?tree.list:[]){
    if(!text(node?.id))continue;
    try{digests[node.id]=sha256(read(node));}catch{/* an unreadable record is simply not digested */}
  }
  return digests;
}

/* ------------------------------------------------------------------ the statements of a record */

/** The keys under which a record states what it claims; the same set the kernel's `recordStatements` walks. */
const STATEMENT_KEYS=['statements','acceptanceCriteria','acceptance','criteria','closureCriteria','invariants','requirement','goal','question'];
/** Every string under a statement key of the record's `srs`/`sds` payload, flattened and trimmed. */
export function recordStatements(record,{max=60,maxChars=2000}={}){
  const work3=record?.extensions?.work3??null;
  const payload=work3?.srs??work3?.sds??work3??null;
  const found=[];
  const collect=(value,depth)=>{
    if(found.length>=max||depth>6)return;
    if(typeof value==='string'){const line=value.replace(/\s+/g,' ').trim();if(line)found.push(line.slice(0,maxChars));return;}
    if(Array.isArray(value)){for(const item of value)collect(item,depth+1);return;}
    if(plain(value))for(const item of Object.values(value))collect(item,depth+1);
  };
  const walk=(value,depth)=>{
    if(found.length>=max||depth>6)return;
    if(Array.isArray(value)){for(const item of value)walk(item,depth+1);return;}
    if(!plain(value))return;
    for(const [key,item] of Object.entries(value))STATEMENT_KEYS.includes(key)?collect(item,depth+1):walk(item,depth+1);
  };
  walk(payload,0);
  return unique(found).slice(0,max);
}
/**
 * The restatement rule, stated mechanically so nobody has to feel it: a statement is cut into sentences, each
 * sentence is folded (whitespace collapsed, case dropped, trailing punctuation removed), and a folded sentence
 * of at least `RESTATEMENT_WORDS` words that appears in two records is the same sentence written twice. A
 * shorter sentence is left to the validator, because "the refund window is 30 days" is a fact two features may
 * both state without either of them restating the other.
 */
export function longSentences(statements,{words=RESTATEMENT_WORDS}={}){
  const found=new Set();
  for(const statement of statements)
    for(const raw of String(statement).split(/(?<=[.!?])\s+|[\n;]+/)){
      const folded=raw.replace(/\s+/g,' ').trim().toLowerCase().replace(/[.,;:!?]+$/,'').trim();
      if((folded.match(/\S+/g)??[]).length>=words)found.add(folded);
    }
  return found;
}

/* ------------------------------------------------------------------ reading the table */

const finding=(code,record,detail)=>({code,record:record??null,detail});

/**
 * The rows of one record's reconciliation table, normalized to `{case, record, decision, reads, hands, detail}`.
 * A row the reader cannot shape - not a mapping, an unknown case, no record id - is returned as a finding
 * instead of an exception, because a malformed table is a defect of the intake that the kernel reports back to
 * it, never a crash of the loop that was checking it.
 */
export function readReconciliation(record){
  const raw=record?.extensions?.work3?.reconciliation;
  if(raw===undefined||raw===null)return {rows:[],findings:[],table:false};
  if(!Array.isArray(raw))
    return {rows:[],findings:[finding(ROW_MALFORMED,null,`${RECONCILIATION_KEY} must be a list of rows, not ${Array.isArray(raw)?'a list':typeof raw}`)],table:true};
  const rows=[],findings=[];
  for(const [index,entry] of raw.entries()){
    if(!plain(entry)){findings.push(finding(ROW_MALFORMED,null,`row ${index+1} of ${RECONCILIATION_KEY} is not a mapping`));continue;}
    const kind=text(entry.case).toLowerCase(),id=text(entry.record);
    if(!RECONCILIATION_CASES.includes(kind)){
      findings.push(finding(ROW_MALFORMED,id||null,`row ${index+1} claims case "${text(entry.case)||'(none)'}"; the cases are ${RECONCILIATION_CASES.join(', ')}`));
      continue;
    }
    if(!id){findings.push(finding(ROW_MALFORMED,null,`row ${index+1} (${kind}) names no record`));continue;}
    rows.push({case:kind,record:id,decision:text(entry.decision)||null,
      reads:unique(strings(entry.reads)),hands:unique(strings(entry.hands)),detail:text(entry.detail)});
  }
  return {rows,findings,table:true};
}

/**
 * Every reconciliation row the tree holds under one scope, with the record each table came from. The table
 * belongs in the feature's module record, so the shallowest record in scope is read first; a tree that carries
 * it somewhere else inside the same feature is still read, because the rule is about the rows, not the file.
 */
export function scopeReconciliation(tree,scope,readNode){
  const nodes=(Array.isArray(tree?.list)?tree.list:[]).filter(node=>inScope(node,scope))
    .sort((a,b)=>slash(a.path??'').split('/').length-slash(b.path??'').split('/').length||slash(a.path??'').localeCompare(slash(b.path??'')));
  const rows=[],findings=[];let carrier=null;
  for(const node of nodes){
    let record=null;
    try{record=readNode(node);}catch{continue;}
    const read=readReconciliation(record);
    if(!read.table)continue;
    carrier=carrier??node;
    rows.push(...read.rows);findings.push(...read.findings);
  }
  return {rows,findings,carrier};
}

/* ------------------------------------------------------------------ the seven checks */

/**
 * The mechanical half of the reconciliation rule. Each rule is one named finding; a finding downgrades the
 * intake report to `failed` and the op is retried with the findings, so an intake cannot settle a feature over
 * a record it never read, a decision it never wrote, or a decided record it quietly edited.
 *
 * `digests` are the digests captured BEFORE the op ran; `readFile` reads a node's bytes now, so the two can be
 * compared. `decidedIds`, `recordKindOf` and `recordReads` are injectable for the same reason `readNode` is:
 * the caller owns the tree, this module owns the rules.
 */
export function checkReconciliation(rows,{tree,scope,readNode,decidedIds=null,digests=null,readFile=null,
  recordKindOf=recordKindOfNode,recordReads=recordReadsOf}={}){
  const list=Array.isArray(tree?.list)?tree.list:[];
  const byId=new Map(list.filter(node=>text(node?.id)).map(node=>[String(node.id),node]));
  const decided=decidedIds
    ?new Set([...decidedIds].map(String))
    :new Set(list.filter(node=>node?.state==='done').map(node=>String(node.id)));
  const table=(Array.isArray(rows)?rows:[]).filter(plain);
  const findings=[];
  const read=node=>{try{return readNode(node);}catch{return null;}};

  // A tree that holds decided records of OTHER features and an intake that wrote no table at all: the feature
  // was appended beside them instead of reconciled with them. A first feature in an empty product needs none.
  const decidedElsewhere=list.filter(node=>decided.has(String(node.id))&&!inScope(node,scope));
  if(!table.length&&decidedElsewhere.length)
    findings.push(finding('reconciliation-missing',null,
      `the tree holds ${decidedElsewhere.length} decided record(s) outside ${scope} (${decidedElsewhere.slice(0,3).map(node=>node.id).join(', ')}) and this intake wrote no ${RECONCILIATION_KEY} table`));

  // `reference`: the record must be one the product actually decided, and nothing under C may restate it.
  const referenced=table.filter(row=>row.case==='reference');
  const newRows=table.filter(row=>row.case==='new');
  // The sentences of every new record under C, read once: the restatement check compares against all of them.
  const newSentences=new Map();
  for(const row of newRows){
    const node=byId.get(row.record);
    if(!node||!inScope(node,scope))continue;
    const record=read(node);
    if(record)newSentences.set(row.record,longSentences(recordStatements(record)));
  }
  for(const row of referenced){
    const node=byId.get(row.record);
    if(!node){findings.push(finding('reference-unknown',row.record,`the tree holds no record ${row.record}`));continue;}
    if(!decided.has(row.record)){findings.push(finding('reference-unknown',row.record,`${row.record} is ${text(node.state)||'not decided'}, so it is not a decided record to reference`));continue;}
    const record=read(node);
    if(!record)continue;
    const theirs=longSentences(recordStatements(record));
    if(!theirs.size)continue;
    for(const [id,ours] of newSentences){
      const repeated=[...ours].filter(sentence=>theirs.has(sentence));
      if(!repeated.length)continue;
      findings.push(finding('reference-restated',id,
        `${id} repeats a statement of the referenced record ${row.record} word for word instead of citing it: "${repeated[0].slice(0,120)}"`));
    }
  }

  // `conflict`: never overwritten, never averaged. The decision record is C's, it is open, and A is untouched.
  const current=digests?recordDigests(tree,readFile):null;
  for(const row of table.filter(item=>item.case==='conflict')){
    if(!row.decision)
      findings.push(finding('conflict-without-decision',row.record,`the conflict with ${row.record} names no decision record under ${scope}`));
    else{
      const decision=byId.get(row.decision);
      if(!decision)findings.push(finding('conflict-without-decision',row.record,`the decision record ${row.decision} is not in the tree`));
      else if(!inScope(decision,scope))findings.push(finding('conflict-without-decision',row.record,`the decision record ${row.decision} is not under ${scope}; a conflict is decided under the feature that raised it`));
      else if(text(decision.kind)!=='decision')findings.push(finding('conflict-without-decision',row.record,`${row.decision} is a ${text(decision.kind)||'record of no kind'}, not a decision record`));
      else if(text(decision.state)!=='todo')findings.push(finding('conflict-without-decision',row.record,`the decision record ${row.decision} is ${text(decision.state)||'stateless'}, not \`todo\`: the owner has not answered it`));
    }
    // The decided record itself must be exactly as the intake found it: a conflict is put to the owner, never resolved by an edit.
    if(!current)continue;
    const before=digests?.[row.record],after=current[row.record];
    if(before&&after&&before!==after)
      findings.push(finding('conflict-edited',row.record,`${row.record} was changed by this intake (${before.slice(0,12)} -> ${after.slice(0,12)}); a conflict with a decided record is the owner's decision, never an edit`));
  }

  // `new`: authored under C, and honest about what it reads from the decided records and what it hands on.
  for(const row of newRows){
    const node=byId.get(row.record);
    if(!node){findings.push(finding('new-unknown',row.record,`the tree holds no record ${row.record}`));continue;}
    if(!inScope(node,scope)){findings.push(finding('new-unknown',row.record,`${row.record} is not under ${scope}; an intake authors new records under its own feature`));continue;}
    const missing=[...row.reads,...row.hands].filter(id=>!byId.has(id));
    if(missing.length){findings.push(finding('new-unknown',row.record,`${row.record} declares ${missing.length===1?'an id':'ids'} the tree does not hold: ${missing.join(', ')}`));continue;}
    const kind=recordKindOf(node);
    const allowed=recordReads(kind);
    const blind=row.reads.map(id=>({id,kind:recordKindOf(byId.get(id))})).filter(cited=>!allowed.includes(cited.kind));
    if(blind.length)
      findings.push(finding('new-reads-blind',row.record,
        `${row.record} is a ${kind} record, which is derived from ${allowed.join(', ')||'nothing'}; it cites ${blind.map(cited=>`${cited.id} (${cited.kind??'unplaced'})`).join(', ')}`));
  }

  const counts=Object.fromEntries(RECONCILIATION_CASES.map(kind=>[kind,table.filter(row=>row.case===kind).length]));
  return {ok:findings.length===0,findings,counts};
}

/* ------------------------------------------------------------------ the owner's questions */

/** The numbered options of a decision record's description, read exactly as the kernel reads an owner ask's. */
export function decisionOptions(record){
  const description=[record?.description,record?.extensions?.work3?.decision?.description].map(value=>String(value??'')).join('\n');
  const listed=record?.extensions?.work3?.decision?.options;
  if(Array.isArray(listed)&&listed.length)
    return strings(listed.map(option=>plain(option)?(option.text??option.option??option.title??''):option));
  return (description.match(/^\s*\d+\.\s.+$/gm)??[]).map(line=>line.replace(/^\s*\d+\.\s*/,'').trim()).filter(Boolean);
}

/**
 * Every `conflict` row as the owner's question: the decided record it is with, the decision record the intake
 * wrote under C, that record's numbered options and the one-line detail. The kernel lists each of these as a
 * `needUser` decision item, exactly as it lists an `owner.ask`, and the workflow finishes `blocked` on an
 * unanswered one - never `done` over a conflict nobody decided.
 */
export function conflictQuestions(rows,{tree,readNode}={}){
  const byId=new Map((Array.isArray(tree?.list)?tree.list:[]).filter(node=>text(node?.id)).map(node=>[String(node.id),node]));
  const questions=[];
  for(const row of (Array.isArray(rows)?rows:[]).filter(plain)){
    if(row.case!=='conflict')continue;
    const node=row.decision?byId.get(row.decision):null;
    let record=null;
    if(node&&typeof readNode==='function'){try{record=readNode(node);}catch{record=null;}}
    questions.push({record:row.record,decision:row.decision??null,options:record?decisionOptions(record):[],detail:row.detail});
  }
  return questions;
}

/* ------------------------------------------------------------------ the one call the kernel makes */

/**
 * The hook the kernel calls when an intake reports `done`, before the validator: read the table the intake
 * wrote, check it, and hand back the findings, the owner's conflict questions and the counts the `reconciled`
 * event carries. A failing check downgrades the report to `failed` with the findings; a passing one leaves the
 * conflicts for the owner and lets the validator judge what only a reader can.
 */
export function reconcileIntake({op=null,state=null,tree=null,scope=null,readNode=null,digests=null,readFile=null,
  decidedIds=null,recordKindOf=recordKindOfNode,recordReads=recordReadsOf}={}){
  const entry=text(scope)||text(op?.intake?.scope);
  const read=typeof readNode==='function'?readNode:()=>null;
  const {rows,findings:shape}=scopeReconciliation(tree,entry,read);
  const checked=checkReconciliation(rows,{tree,scope:entry,readNode:read,decidedIds,digests,readFile,recordKindOf,recordReads});
  const findings=[...shape,...checked.findings];
  return {ok:findings.length===0,findings,
    conflicts:conflictQuestions(rows,{tree,readNode:read}),counts:checked.counts};
}
