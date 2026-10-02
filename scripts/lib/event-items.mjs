// event-items.mjs - the open items of an owed/resolved event pair, replayed from a workflow ledger (read only).

/**
 * The workflow's open items of an owed/resolved event pair (grammar proposals, asset slots): replay the kinds in seq
 * order — a `resolvedKind` row deletes the item `keyOf` names, an `owedKind` row sets `item(payload,row)`; a row
 * whose key is falsy is skipped. Returns the open items in first-seen order, [] when the table cannot be read.
 */
export function openEventItems(db,workflowId,{owedKind,resolvedKind,keyOf,item}){
  let rows=[];
  try{rows=db.prepare('SELECT kind,payload_json,created_at FROM events WHERE workflow_id=? AND kind IN (?,?) ORDER BY seq').all(workflowId,owedKind,resolvedKind);}
  catch{return[];}
  const open=new Map();
  for(const row of rows){
    let p={};
    try{p=JSON.parse(row.payload_json??'{}')??{};}catch{p={};}
    const key=keyOf(p);
    if(!key)continue;
    if(row.kind===resolvedKind){open.delete(key);continue;}
    open.set(key,item(p,row));
  }
  return[...open.values()];
}
