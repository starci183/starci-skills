import { sendJson, sendError } from '../envelope.mjs';
import { dbMark } from '../etag.mjs';
import { opLabelMap } from '../../../scripts/lib/display-names.mjs';

const maxHits = 40;
const unique = values => [...new Set(values.filter(value => value != null))].sort();
const safeQuery = value => typeof value === 'string' ? value.trim().slice(0, 128) : '';
const refKind = kind => ({ 'sup-decision':'di', decision:'di', 'sup-job':'attempt', job:'attempt', dispatch:'attempt', span:'attempt', trace:'workflow', 'land-ticket':'land', action:'service', artifact:'blob', ledger:'workflow' })[kind] ?? kind;
const hrefOf = (kind, project, id, workflowId = null) => {
  const p = encodeURIComponent(project ?? '');
  const value = encodeURIComponent(id);
  if (kind === 'workflow' || kind === 'trace') return `#/w/${p}/${encodeURIComponent(workflowId ?? id)}`;
  if (kind === 'unit') return `#/w/${p}/${encodeURIComponent(workflowId ?? '')}?tab=units&unit=${value}`;
  if (['attempt','job','dispatch','span'].includes(kind)) return `#/a/${p}/${value}`;
  if (['decision','sup-decision'].includes(kind)) return `#/decisions?id=${value}`;
  if (kind === 'blob' || kind === 'artifact') return `/api/blob/${value}`;
  if (kind === 'incident') return `#/decisions?tab=incidents&id=${value}`;
  if (kind === 'service' || kind === 'seat') return `#/system/services?id=${value}`;
  if (kind === 'lane' || kind === 'land-ticket' || kind === 'commit') return `#/system/land?id=${value}`;
  return '#/';
};

export function healthz(request, response, store) {
  const ledgers = Object.fromEntries(store.projects().map(row => [row.name, Boolean(store.ledger(row.name))]));
  const marks = [dbMark(store.machine?.db), ...store.projects().map(row => dbMark(store.ledger(row.name)?.db))];
  sendJson(request, response, { ok: Boolean(store.machine) && Object.values(ledgers).every(Boolean), rev: '2026-10-v3', dbs: { machine: Boolean(store.machine), ledgers } },
    { status: store.machine && Object.values(ledgers).every(Boolean) ? 200 : 503, sources: [{ db:'machine', rel:'machine_meta' }, { db:'machine', rel:'ledgers' }], stale:[...store.stale], marks, cache:'no-store' });
}

export function contract(request, response, store) {
  if (!store.machine) return sendError(request, response, 503, 'DB_UNAVAILABLE', 'Database unavailable');
  const machine = store.machine.db;
  const rows = store.projects();
  const ledgers = {};
  const facts = { unitStates:[], diKinds:[], artifactRoles:[], logActors:[], logKinds:[], reasonCodes:[] };
  const marks = [dbMark(machine)];
  for (const row of rows) {
    const open = store.ledger(row.name);
    if (!open) continue;
    const db = open.db;
    ledgers[row.name] = db.prepare('PRAGMA user_version').get().user_version;
    marks.push(dbMark(db));
    facts.unitStates.push(...db.prepare("SELECT native FROM ui_state_map WHERE entity='unit'").all().map(x=>x.native));
    facts.diKinds.push(...db.prepare('SELECT DISTINCT kind FROM decision_items').all().map(x=>x.kind));
    facts.artifactRoles.push(...db.prepare('SELECT DISTINCT role FROM job_artifacts').all().map(x=>x.role));
    facts.logActors.push(...db.prepare('SELECT DISTINCT actor FROM logs').all().map(x=>x.actor));
    facts.logKinds.push(...db.prepare('SELECT DISTINCT kind FROM logs').all().map(x=>x.kind));
    facts.reasonCodes.push(...db.prepare('SELECT DISTINCT reason_code FROM v_blocking WHERE reason_code IS NOT NULL').all().map(x=>x.reason_code));
  }
  const uiStates = machine.prepare('SELECT ui FROM ui_states ORDER BY rank').all().map(row=>row.ui);
  const violations = machine.prepare('SELECT DISTINCT code FROM invariant_violations').all().map(row=>row.code);
  const data = {
    version:'2026-10-v3',
    schema:{ machine:machine.prepare('PRAGMA user_version').get().user_version, ledgers },
    projects:rows.map(row=>({id:row.name,name:row.name,product:row.product})),
    opLabels:opLabelMap(),
    vocab:{uiStates,unitStates:unique(facts.unitStates),verdicts:['pass','fail','partial','blocked','dropped','cancelled'],reportOutcomes:['done','partial','failed','ask','blocked'],diStatuses:['open','claimed','resolved','escalated','expired','superseded'],diKinds:unique(facts.diKinds),violationCodes:unique(violations),artifactRoles:unique(facts.artifactRoles),logActors:unique(facts.logActors),logKinds:unique(facts.logKinds),levels:['debug','info','warn','error']},
    reasonCodes:unique([...facts.reasonCodes,...violations]),
  };
  sendJson(request,response,data,{sources:[{db:'machine',rel:'machine_meta'},{db:'machine',rel:'ledgers'},{db:'machine',rel:'ui_states'},{db:'machine',rel:'ui_state_map'},{db:'file',rel:'modules/ops/_labels.yaml'},...rows.map(row=>({db:row.name,rel:'meta'}))],stale:[...store.stale],marks});
}

export function search(request, response, store, url) {
  if (!store.machine) return sendError(request, response, 503, 'DB_UNAVAILABLE', 'Database unavailable');
  const q = safeQuery(url.searchParams.get('q'));
  if (!q) return sendError(request,response,400,'QUERY_REQUIRED','Search query required');
  const like = `%${q.replaceAll('%','\\%').replaceAll('_','\\_')}%`;
  const hits = [];
  const push = (kind,id,title,project=null,wf=null) => {
    if (!id || kind === 'worktree' || hits.length >= maxHits) return;
    const safeTitle = kind === 'ledger' ? project ?? id : title ?? id;
    hits.push({kind:refKind(kind),project:project??undefined,id:String(id),href:hrefOf(kind,project,id,wf),title:String(safeTitle),ui:'unknown'});
  };
  const machine = store.machine.db;
  const machineRows = machine.prepare("SELECT kind,id,title FROM v_search_ids WHERE id LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\' LIMIT 20").all(like,like);
  for (const row of machineRows) push(row.kind,row.id,row.title,row.kind==='ledger'?row.id:null);
  const results = store.forEachLedger(({row,db}) => {
    const records = db.prepare("SELECT kind,id,workflow_id,title FROM v_search_ids WHERE id LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\' LIMIT 20").all(like,like);
    return {row,records,mark:dbMark(db)};
  });
  for (const result of results) if (result.result) for (const row of result.result.records) push(row.kind,row.id,row.title,result.result.row.name,row.workflow_id);
  const phrase = `"${q.replaceAll('"','""')}"`;
  try {
    const logs = machine.prepare('SELECT m.seq,m.kind,m.workflow_id,m.ledger_id FROM machine_logs_fts f JOIN machine_logs m ON m.seq=f.rowid WHERE machine_logs_fts MATCH ? LIMIT 10').all(phrase);
    for (const row of logs) {
      const project = store.projects().find(p=>p.ledgerId===row.ledger_id)?.name ?? null;
      push('workflow',row.workflow_id??String(row.seq),row.kind,project,row.workflow_id);
    }
    for (const result of store.forEachLedger(({row,db})=>({row,records:db.prepare('SELECT l.seq,l.kind,l.workflow_id FROM logs_fts f JOIN logs l ON l.seq=f.rowid WHERE logs_fts MATCH ? LIMIT 10').all(phrase)}))) {
      if (result.result) for (const row of result.result.records) push('workflow',row.workflow_id,row.kind,result.result.row.name,row.workflow_id);
    }
  } catch { /* Invalid FTS syntax or an unavailable ledger yields ID results only. */ }
  sendJson(request,response,{hits},{sources:[{db:'machine',rel:'v_search_ids'},{db:'machine',rel:'machine_logs_fts'},...store.projects().map(row=>({db:row.name,rel:'v_search_ids'}))],stale:[...store.stale],marks:[dbMark(machine),...results.map(result=>result.result?.mark)]});
}
