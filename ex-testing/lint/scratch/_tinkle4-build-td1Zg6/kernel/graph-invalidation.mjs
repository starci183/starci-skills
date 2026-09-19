/**
 * What a settled revise-type operation (`business.revise`, `architecture.revise`, `goal.revise`) makes
 * stale. When the record an operation derived its work from changes, every artifact and operation whose
 * recorded input digests covered that record was computed against bytes that no longer exist - the kernel
 * calls `propagateInvalidation` on settle, and this module marks each of them `stale` and reverts every
 * metric they were credited with to unmet. In-flight operations are marked too: they re-validate against
 * the new digest, and an input whose stored digest already equals it was provably unaffected.
 *
 * Pure and deterministic: the function reads only the state it is given, it never asks a model, and the
 * same state always yields the same marks. It marks in place - the kernel passes its live state on settle -
 * and returns what it touched, so the journal can name exactly what the revision invalidated.
 */
export const INVALIDATION='starci/graph-invalidation@1';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'&&value.trim()?value.trim():null;

/** The names one revised record answers to: itself as a string, else its id, record kind, node and path. */
const recordKeys=revised=>{
  const keys=new Set();
  const add=value=>{const key=text(value);if(key)keys.add(key);};
  if(typeof revised==='string')add(revised);
  else if(plain(revised))for(const field of ['id','record','kind','node','path','ref','file'])add(revised[field]);
  return keys;
};

/** The fields a recorded input may name its record by, and the fields it may carry the record's digest under. */
const INPUT_KEYS=['record','id','kind','node','path','ref','file','name'];
const DIGEST_KEYS=['digest','sha256','rev','inputDigest'];

const digestOf=input=>{
  for(const key of DIGEST_KEYS)if(input?.[key]!==undefined&&input?.[key]!==null&&input?.[key]!=='')return String(input[key]);
  return null;
};

/**
 * The inputs one artifact or operation recorded, as `{record, digest}` rows. The run spells them three
 * ways: a map of record name to digest (`inputDigests`), a list of `{<identity field>, digest}` entries
 * (`inputs`, `digests`, `records`, `inputDigest`), and `references` - the record paths an operation cited.
 * A reference carries no digest, so a covered one can never prove itself unaffected: it goes stale.
 */
function inputsOf(entry){
  const rows=[];
  const push=(record,digest=null)=>{
    const name=text(record);
    if(name)rows.push({record:name,digest:digest===undefined||digest===null?null:String(digest)});
  };
  for(const field of ['inputDigests','inputs','digests','records','inputDigest']){
    const value=entry?.[field];
    if(plain(value)){for(const [record,digest] of Object.entries(value))push(record,plain(digest)?digestOf(digest):digest);continue;}
    if(!Array.isArray(value))continue;
    for(const input of value){
      if(!plain(input)){push(input);continue;}
      // A list entry may name its record under several identity fields; each of them covers it.
      for(const key of INPUT_KEYS)push(input[key],digestOf(input));
    }
  }
  for(const ref of Array.isArray(entry?.references)?entry.references:[])
    push(plain(ref)?ref.ref??ref.path??ref.file:ref);
  return rows;
}

/**
 * Every metric name one entry was credited with: the `metrics`/`satisfies`/`proves` lists (plain names or
 * `{name}`/`{id}`/`{metric}` entries), the map spelling (`{name: truthy}`), and a single `metric` string.
 */
const metricsOf=entry=>{
  const names=new Set();
  const add=value=>{const name=text(value);if(name)names.add(name);};
  for(const field of ['metrics','satisfies','proves','metric']){
    const value=entry?.[field];
    if(typeof value==='string')add(value);
    else if(Array.isArray(value))for(const item of value)add(typeof item==='string'?item:item?.name??item?.id??item?.metric);
    else if(plain(value))for(const [name,on] of Object.entries(value))if(on)add(name);
  }
  return names;
};

/** A metric entry reverting to unmet: the mark stays on the record so the status view can say why. */
const unmark=entry=>{entry.met=false;entry.satisfied=false;entry.stale=true;if(['met','satisfied'].includes(entry.status))entry.status='unmet';};

/**
 * Revert every metric a stale entry was credited with, in either spelling the state keeps them: a map of
 * name to verdict, or a list of `{name, met}` entries. A metric is also reverted when it names a stale
 * entry as its source (`by`/`satisfiedBy`/`op`/`artifact`/`source`) even if the entry listed no metrics.
 */
function revertMetrics(block,names,staleIds,unmet){
  const creditOf=entry=>entry?.by??entry?.satisfiedBy??entry?.op??entry?.artifact??entry?.source;
  if(Array.isArray(block)){
    for(const entry of block){
      if(!plain(entry))continue;
      const name=entry.name??entry.id??entry.metric;
      if((text(name)&&names.has(name))||(text(creditOf(entry))&&staleIds.has(creditOf(entry)))){unmark(entry);if(text(name))unmet.add(name);}
    }
    return;
  }
  if(!plain(block))return;
  for(const [name,value] of Object.entries(block)){
    const credit=plain(value)?creditOf(value):null;
    if(!names.has(name)&&!(text(credit)&&staleIds.has(credit)))continue;
    if(plain(value))unmark(value);else block[name]=false;
    unmet.add(name);
  }
}

/**
 * Mark every artifact and operation of `state` whose recorded inputs covered `revisedRecord` `stale`, and
 * revert the metrics they satisfied. `revisedRecord` is the changed record - a name, or `{id, record,
 * kind, node, path, ref, file}` naming it every way the run might have recorded it; `newDigest` is the
 * record's digest after the revision, so an input already bound to it stays fresh. Returns
 * `{record, digest, stale, unmet}`: the ids of what went stale and the metric names that reverted.
 */
export function propagateInvalidation(state,revisedRecord,newDigest){
  const keys=recordKeys(revisedRecord);
  const digest=newDigest===undefined||newDigest===null?null:String(newDigest);
  const stale=[],unmet=new Set(),staleIds=new Set();
  if(plain(state)&&keys.size){
    const entries=[...(Array.isArray(state.ops)?state.ops:[]),...(Array.isArray(state.artifacts)?state.artifacts:[])];
    entries.forEach((entry,index)=>{
      if(!plain(entry))return;
      const covered=inputsOf(entry).find(row=>keys.has(row.record));
      if(!covered)return;
      // Already bound to the revised bytes: the revision is a no-op for this entry, not a reason to redo it.
      if(covered.digest!==null&&covered.digest===digest)return;
      entry.stale=true;
      entry.staleBy={record:covered.record,was:covered.digest,now:digest};
      const id=text(entry.id)??text(entry.op)??text(entry.node)??`#${index}`;
      stale.push(id);staleIds.add(id);
      for(const name of metricsOf(entry))unmet.add(name);
    });
    for(const field of ['metrics','goalMetrics'])revertMetrics(state[field],unmet,staleIds,unmet);
  }
  return {schema:INVALIDATION,record:[...keys][0]??null,digest,stale,unmet:[...unmet]};
}
