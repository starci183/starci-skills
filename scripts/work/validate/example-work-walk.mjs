// The record walk of the example Work standard (check-example-work.mjs): which yaml files are records, the
// record map built from them, and the references each record carries.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../engine/yaml.mjs';
import { readWorkspace, isWorkRecordSchema, splitRef } from '../record-ownership.mjs';
import { walkFiles } from '../../lib/walk.mjs';
import { EXEMPT, FAMILIES, ID_RE, KERNEL_CUSTODY_ROOTS, expectedId, placeDepthFinding, plannedDesignPointers } from './example-work-ids.mjs';

/** A drawn shape name: `XBase#state` per work-ui-screen ui.shapes (base ^[A-Z][A-Za-z0-9]*Base$, state a
 * slug). The draw-review applier writes it into ui.review.*.parts[].shape; it joins a component name,
 * not a record id, so the ref scan below must not read it as the `parent#frag` compact syntax. */
const SHAPE_NAME_RE = /^[A-Z][A-Za-z0-9]*Base#[a-z0-9]+(?:-[a-z0-9]+)*$/;

function collectStringReference(value,file,trail,refs){
  const text=value.trim();
  if(ID_RE.test(text)){refs.push({id:text,frag:null,file,trail});return;}
  // `parent#frag` is the compact format's way of addressing an inlined acceptance criterion -
  // the parent half must still be a well-formed record id for the ref to mean anything.
  const {id,frag}=splitRef(text);
  if(frag!==null&&frag&&ID_RE.test(id))refs.push({id,frag,file,trail});
  else if(frag!==null&&id&&!/[\s/\\:]/.test(text)&&!SHAPE_NAME_RE.test(text)){
    // `something#` or `something#with space` - someone reached for the compact-ref syntax and
    // produced a token that is neither a record id nor a resolvable fragment. Flag it rather
    // than letting it pass silently as an ordinary string. An `XBase#state` shape name is the
    // shapes model's own spelling, not a ref attempt, so it is exempt.
    refs.push({id:text,malformedRef:true,file,trail});
  }
}

function collectReferences(node,file,trail,refs){
  if(typeof node==='string')return collectStringReference(node,file,trail,refs);
  if(Array.isArray(node))return node.forEach(item=>collectReferences(item,file,trail,refs));
  if(node&&typeof node==='object'){
    for(const [key,value] of Object.entries(node))collectReferences(value,file,trail?`${trail}.${key}`:key,refs);
  }
}

/** True for an evidence manifest: proof payload owned by the adjacent record, never a Work record of its own. */
const isEvidenceManifest = (record, rel, segments) => (record.schema === 'work/evidence@1' && !rel.endsWith('/evidence.yaml'))
  || (path.basename(rel) === 'manifest.yaml' && segments.includes('evidence'));

const recordEntry = (record, file, shown) => ({
  schema: record.schema, state: record.state, change: record.change, file,
  shown, dir: path.dirname(file),
  data: record,
});

/** Record map of a tree for ref RESOLUTION only — the same membership rules the validating walk applies
 * (kernel custody roots skipped, payload schemas and evidence manifests excluded), but silent: no
 * problems, no ref collection, no per-record rules. Scoped validation (starci runtime validate <record-dir>)
 * resolves refs against the enclosing tree — a uat-flow's environment resource lives in _resources/
 * above the record dir and could never resolve otherwise. */
export const collectRecordMap = (scopeRoot, root) => {
  const map = new Map();
  const wsDoc = readWorkspace(scopeRoot);
  for (const file of walkFiles(scopeRoot).filter(f => f.endsWith('.yaml'))) {
    const rel = path.relative(scopeRoot, file).replaceAll('\\', '/');
    const record = resolvableRecordAt(file, rel, wsDoc);
    if (record && typeof record.id === 'string' && record.id) map.set(record.id, recordEntry(record, file, path.relative(root, file).replaceAll('\\', '/')));
  }
  return map;
};

/** The record a yaml file holds when it takes part in ref resolution, else null. */
function resolvableRecordAt(file, rel, wsDoc) {
  const rootSegment = rel.split('/')[0];
  if (KERNEL_CUSTODY_ROOTS.has(rootSegment) || rootSegment === '_derived') return null;
  let record;
  try { record = parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; }
  if (!record || typeof record !== 'object') return null;
  if (!isWorkRecordSchema(record.schema, wsDoc)) return null;
  if (isEvidenceManifest(record, rel, rel.split('/'))) return null;
  return rel.endsWith('/evidence.yaml') ? null : record;
}

const idTypeName = (id) => (id === null && 'null') || (Array.isArray(id) && 'array') || typeof id;

/** Records the file under its id (a non-string id is refused) and checks the id against the place the file sits in. */
function registerRecord({ problems, warnings, records }, { record, file, shown, segments }) {
  if (Object.hasOwn(record, 'id') && typeof record.id !== 'string') problems.push(`${shown}: id must be a string, not ${idTypeName(record.id)} [ID_TYPE]`);
  else if (record.id) records.set(record.id, recordEntry(record, file, shown));
  if (segments[0] === 'features' && segments.length > 2 && !EXEMPT.has(record.schema)) {
    const want = expectedId(segments);
    if (want && record.id !== want) problems.push(`${shown}: id is ${record.id}, but its place says ${want}`);
    if (!want) problems.push(`${shown}: no record family in its path; ${[...FAMILIES].join(', ')} are the families`);
    // A suspect, not a refusal (contract change work-place-depth): records already written there keep
    // the ordinary gate green while the finding names the place that satisfies both id rules.
    const shallow = want ? placeDepthFinding(shown, want) : null;
    if (shallow) warnings.push(shallow);
  }
}

/** Sorts one parsed yaml: a payload is counted and skipped, an evidence file is kept for later, a record is registered. */
function classifyRecord(ctx, { record, rel, shown, file }) {
  const { workspaceDoc, infos, evidenceFiles, plannedDesigns, refs } = ctx;
  const segments = rel.split('/');
  // The schema marker decides whether this yaml is a record at all, before any record rule sees it.
  // A foreign schema - a generation receipt, a direction check, a uat run manifest - is a tool's
  // artifact payload: counted as INFO and walked past, never id-matched to its path and never
  // ref-collected (its internals are the tool's output, not edges into this graph). A yaml with no
  // schema line stays on the record path, so deleting the marker cannot hide a malformed record.
  if (!isWorkRecordSchema(record.schema, workspaceDoc)) {
    infos.push(`${shown}: schema ${record.schema} is an artifact payload, not a work record [PAYLOAD_SKIPPED]`);
    return 'payload';
  }
  // Evidence manifests are proof payloads owned by the adjacent record, not
  // independent Work records whose id is derived from a feature family.
  // check-work-artifacts validates their evidence contract.
  if (isEvidenceManifest(record, rel, segments)) {
    infos.push(`${shown}: evidence manifest is proof payload, not a compact family record [PAYLOAD_SKIPPED]`);
    return 'payload';
  }
  if (rel.endsWith('/evidence.yaml')) {
    evidenceFiles.push({record, shown, dir: path.dirname(file)});
    return 'evidence';
  }
  registerRecord(ctx, { record, file, shown, segments });
  for (const id of plannedDesignPointers(record)) plannedDesigns.add(`${shown}|${id}`);
  collectReferences(record,shown,'',refs);
  return 'record';
}

/** Reads one yaml file of the walk; resolves 1 when it was an artifact payload, else 0. */
function visitYaml(ctx, file) {
  const { workRoot, root, problems } = ctx;
  const rel = path.relative(workRoot, file).replaceAll('\\', '/');
  const rootSegment = rel.split('/')[0];
  // Kernel custody and generated projections have their own lifetime and
  // validators.  They are explicitly outside the authored Work record walk.
  if (KERNEL_CUSTODY_ROOTS.has(rootSegment) || rootSegment === '_derived') return 0;
  const shown = path.relative(root, file).replaceAll('\\', '/');
  let record;
  try { record = parseYaml(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    // A yaml the runtime loader rejects is refused like any other malformed record - never let one
    // bad file (or a lane's half-written save) take the whole gate down with it.
    problems.push(`${shown}: does not parse under the runtime YAML loader (${String(error?.message ?? error)})`);
    return 0;
  }
  if (!record || typeof record !== 'object') return 0;
  return classifyRecord(ctx, { record, rel, shown, file }) === 'payload' ? 1 : 0;
}

/** Walks the validating tree into `ctx.records`, `ctx.refs`, `ctx.evidenceFiles` and `ctx.plannedDesigns`; returns the payload count. */
export function walkWorkRecords(ctx) {
  let payloads = 0;
  for (const file of walkFiles(ctx.workRoot).filter(f => f.endsWith('.yaml'))) payloads += visitYaml(ctx, file);
  return payloads;
}
