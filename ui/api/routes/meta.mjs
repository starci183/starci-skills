import { sendJson, sendError } from '../envelope.mjs';
import { dbMark } from '../etag.mjs';
import { opLabelMap } from '../../../scripts/lib/display-names.mjs';
import { byCodeUnit } from '../../../scripts/lib/list.mjs';
import { ledgerSearchHit, machineSearchHit, logSearchHit } from '../search-read.mjs';

const maxHits = 40;
const unique = values => [...new Set(values.filter(value => value != null))].sort(byCodeUnit);
const safeQuery = value => typeof value === 'string' ? value.trim().slice(0, 128) : '';

export function healthz(request, response, store) {
  const machineAvailable = Boolean(store.machine) && (store.availability?.('machine') ?? 'available') === 'available';
  const ledgers = Object.fromEntries(store.projects().map(row => [row.name, Boolean(store.ledger(row.name))]));
  const marks = [dbMark(store.machine?.db), ...store.projects().map(row => dbMark(store.ledger(row.name)?.db))];
  sendJson(request, response, { ok: machineAvailable && Object.values(ledgers).every(Boolean), rev: '2026-10-v3', dbs: { machine: machineAvailable, ledgers } },
    { status: machineAvailable && Object.values(ledgers).every(Boolean) ? 200 : 503, sources: [{ db:'machine', rel:'machine_meta' }, { db:'machine', rel:'ledgers' }, ...store.projects().map(row => ({ db: row.name, ledgerId: row.ledgerId, rel: 'meta' }))], stale:[...store.stale], marks, cache:'no-store' });
}

export function contract(request, response, store) {
  if (!store.machine) return sendError(request, response, 503, 'DB_UNAVAILABLE', 'Database unavailable');
  const machine = store.machine.db;
  const rows = store.projects();
  const ledgers = {};
  const facts = { unitStates:[], diKinds:[], artifactRoles:[], logActors:[], logKinds:[], reasonCodes:[] };
  const marks = [dbMark(machine)];
  store.forEachLedger(({row, db}) => {
    ledgers[row.name] = db.prepare('PRAGMA user_version').get().user_version;
    marks.push(dbMark(db));
    facts.unitStates.push(...db.prepare("SELECT native FROM ui_state_map WHERE entity='unit'").all().map(x=>x.native));
    facts.diKinds.push(...db.prepare('SELECT DISTINCT kind FROM decision_items').all().map(x=>x.kind));
    facts.artifactRoles.push(...db.prepare('SELECT DISTINCT role FROM job_artifacts').all().map(x=>x.role));
    facts.logActors.push(...db.prepare('SELECT DISTINCT actor FROM logs').all().map(x=>x.actor));
    facts.logKinds.push(...db.prepare('SELECT DISTINCT kind FROM logs').all().map(x=>x.kind));
    facts.reasonCodes.push(...db.prepare('SELECT DISTINCT reason_code FROM v_blocking WHERE reason_code IS NOT NULL').all().map(x=>x.reason_code));
  });
  const uiStates = machine.prepare('SELECT ui FROM ui_states ORDER BY rank').all().map(row=>row.ui);
  const violations = machine.prepare('SELECT DISTINCT code FROM invariant_violations').all().map(row=>row.code);
  const data = {
    version:'2026-10-v3',
    schema:{ machine:machine.prepare('PRAGMA user_version').get().user_version, ledgers },
    projects:rows.map(row=>({id:row.name,ledgerId:row.ledgerId,name:row.name,product:row.product ?? null,
      availability:store.availability?.(row.ledgerId) ?? (store.ledger(row.name) ? 'available' : 'unavailable')})),
    opLabels:opLabelMap(),
    vocab:{uiStates,unitStates:unique(facts.unitStates),verdicts:['pass','fail','partial','blocked','dropped','cancelled'],reportOutcomes:['done','partial','failed','ask','blocked'],diStatuses:['open','claimed','resolved','escalated','expired','superseded'],diKinds:unique(facts.diKinds),violationCodes:unique(violations),artifactRoles:unique(facts.artifactRoles),logActors:unique(facts.logActors),logKinds:unique(facts.logKinds),levels:['debug','info','warn','error']},
    reasonCodes:unique([...facts.reasonCodes,...violations]),
  };
  sendJson(request,response,data,{sources:[{db:'machine',rel:'machine_meta'},{db:'machine',rel:'ledgers'},{db:'machine',rel:'ui_states'},
    {db:'machine',rel:'invariant_violations'},{db:'file',rel:'modules/ops/_labels.yaml'},
    ...rows.flatMap(row=>['meta','ui_state_map','decision_items','job_artifacts','logs','v_blocking'].map(rel=>({db:row.name,ledgerId:row.ledgerId,rel})))],stale:[...store.stale],marks});
}

export function search(request, response, store, url) {
  if (!store.machine) return sendError(request, response, 503, 'DB_UNAVAILABLE', 'Database unavailable');
  const q = safeQuery(url.searchParams.get('q'));
  if (!q) return sendError(request,response,400,'QUERY_REQUIRED','Search query required');
  const like = `%${q.replaceAll('%','\\%').replaceAll('_','\\_')}%`;
  const hits = [], seen = new Set();
  let truncated = false;
  const push = hit => {
    const key = JSON.stringify(hit.matched);
    if (seen.has(key)) return;
    seen.add(key);
    if (hits.length >= maxHits) { truncated = true; return; }
    hits.push(hit);
  };
  const machine = store.machine.db;
  const machineRows = machine.prepare("SELECT kind,id,title FROM v_search_ids WHERE id IS NOT NULL AND (id LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\') ORDER BY kind,id LIMIT ?").all(like,like,maxHits + 1);
  for (const row of machineRows) push(machineSearchHit(machine,row.kind === 'ledger' || row.kind === 'worktree' ? { ...row, title: row.id } : row));
  const results = store.forEachLedger(({row,db}) => {
    const records = db.prepare("SELECT kind,id,workflow_id,title FROM v_search_ids WHERE id IS NOT NULL AND (id LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\') ORDER BY kind,id,workflow_id LIMIT ?").all(like,like,maxHits + 1);
    return {row,records: records.map(hit => ledgerSearchHit(db,row,hit)),mark:dbMark(db)};
  });
  for (const result of results) if (result.result) for (const hit of result.result.records) push(hit);
  const phrase = `"${q.replaceAll('"','""')}"`;
  try {
    const logs = machine.prepare('SELECT m.seq,m.kind,m.workflow_id,m.ledger_id FROM machine_logs_fts f JOIN machine_logs m ON m.seq=f.rowid WHERE machine_logs_fts MATCH ? ORDER BY m.seq DESC LIMIT ?').all(phrase,maxHits + 1);
    for (const row of logs) push(logSearchHit(row));
  } catch { store.failSource?.('machine', 'machine_logs_fts'); }
  for (const result of store.forEachLedger(({row,db})=>({row,records:db.prepare('SELECT l.seq,l.kind,l.workflow_id FROM logs_fts f JOIN logs l ON l.seq=f.rowid WHERE logs_fts MATCH ? ORDER BY l.seq DESC LIMIT ?').all(phrase,maxHits + 1)}))) {
    if (result.result) for (const row of result.result.records) push(logSearchHit(row,result.result.row));
  }
  sendJson(request,response,{hits,limit:maxHits,truncated},{sources:[{db:'machine',rel:'v_search_ids'},{db:'machine',rel:'machine_logs_fts'},
    ...store.projects().flatMap(row=>['v_search_ids','logs_fts'].map(rel=>({db:row.name,ledgerId:row.ledgerId,rel})))],stale:[...store.stale],marks:[dbMark(machine),...results.map(result=>result.result?.mark)]});
}
