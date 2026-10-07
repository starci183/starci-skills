import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {parseYaml} from '../../../engine/yaml.mjs';
import {readWorkspace, indexInlineCriteria, resolveRecordRef} from '../record-ownership.mjs';
import { walkFiles } from '../../lib/walk.mjs'; import { exampleWorkRoots, exampleArtifactReadOptions } from '../../lib/example-refs.mjs';
import { isMain } from '../../lib/is-main.mjs';
import { FAMILIES } from './example-work-ids.mjs';
import { collectRecordMap, walkWorkRecords } from './example-work-walk.mjs';
import { checkEvidenceFiles, sdsProversOf } from './example-work-evidence.mjs';
import { checkInlineCriteria, checkRefsResolve } from './example-work-refs.mjs';
import { structureRules } from './example-work-rules-structure.mjs';
import { trustRules } from './example-work-rules-trust.mjs';
import { surfaceRules } from './example-work-rules-surface.mjs';
import { checkRenderProofs, checkUatFlowResources } from './example-work-resources.mjs';
import { sealedLocationProblem } from './check-work-artifacts.mjs';
import { checkBlockerGraph } from './example-work-blockers.mjs';
// The exported boundary checker delegates HFS_AGENT_DATA_TRACKED findings to this sibling module.
import { checkStarciworkBoundary } from './work-boundary-check.mjs';
export {checkStarciworkBoundary} from './work-boundary-check.mjs';
export { FAMILIES, ID_RE, MIN_ID_SEGMENTS, DEFAULT_MIN_ID_SEGMENTS, placeDepthFinding, plannedDesignPointers } from './example-work-ids.mjs';

/**
 * The layout says an id mirrors its directory while remaining the identity. That sentence is only true if
 * something checks it: renaming `impl/shop` to `impl/shop-backend` left thirteen records whose id
 * still said `shop`, and the YAML gate accepted every one of them because each file parsed. A record
 * whose id does not match its place is the mismatch the layout forbids, and a ref to an id no record owns
 * is a dangling edge that reads as a satisfied dependency.
 *
 * Both are structural, so both are checked here rather than described in prose.
 *
 * The concepts below (blocker edges, gap records, conflictsWith/tension, decision vocabulary,
 * change/staleness, done-needs-proof, appliesTo, events/data-extends/timer transitions, implementation
 * owners) came from five lanes independently hitting the same handful of places the layout had no home
 * for what they needed. Each gets one rule here, not a field bolted on per complaint.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const walk = dir => walkFiles(dir);

// ---- an identity points its secret at .starcistacks/<env>/secrets/identity-<slug>.enc (R09) ----
// <slug> is the folder the identity record sits in (_resources/identities/<slug>/resource.yaml); the path is app-relative
// and .starcistacks sits at the app root beside the Work tree, so the side form be/.starcistacks/... is refused by name.
// A provider: none identity holds no secret and carries no sealed key.
function checkIdentityCustody({ problems, records }) {
  for (const [id, rec] of records) {
    if (rec.schema !== 'work/resource@1' || rec.data?.kind !== 'identity') continue;
    const sealed = rec.data.custody?.sealed;
    if (typeof sealed !== 'string') continue;
    const slug = path.basename(rec.dir);
    const misplaced = sealedLocationProblem(sealed);
    if (misplaced || path.posix.basename(sealed.trim(), '.enc') !== `identity-${slug}`) problems.push(`${rec.shown}: identity ${id} points custody.sealed at ${sealed.trim()}${misplaced ? ' (' + misplaced + ')' : ''}; it names its secret .starcistacks/<env>/secrets/identity-${slug}.enc [HFS_IDENTITY_CUSTODY]`);
  }
}

// Every per-record rule runs for each record, in this order.
const RECORD_RULES = [...structureRules, ...trustRules, ...surfaceRules];

/**
 * Runs every check in this file against one .starciwork tree rooted at `workRoot`, appending human-readable
 * refusal strings to `problems`. Exported so the fixture test can point it at a throwaway tree instead of
 * the real example tree. `resolveRoot` optionally widens ref resolution to an ancestor tree while record
 * rules still apply only to `workRoot` — the scoped-validate case above.
 */
export function checkWorkTree(workRoot, problems, warnings = [], infos = [], resolveRoot = workRoot, { runtimeRoot = root } = {}) {
  let blobOptions;
  try {
    blobOptions = exampleArtifactReadOptions(runtimeRoot, workRoot, { resolveRoot });
  } catch (error) {
    problems.push(`artifact read context cannot be established: ${error.message} [ASSET_ROOT]`);
    return { records: 0, refs: 0, payloads: 0 };
  }
  const ctx = {
    problems, warnings, infos, workRoot, resolveRoot, root, blobOptions,
    records: new Map(), // id -> {schema, state, change, file, shown, dir, data}
    refs: [],
    // Planned design pointers of the layout tree (see plannedDesignPointers): `${file}|${id}` keys.
    plannedDesigns: new Set(),
    evidenceFiles: [],
    // workspace.yaml is a tree-level file - in scoped mode (a record dir under the tree) it lives at
    // resolveRoot, never inside the walked subtree.
    workspaceDoc: readWorkspace(resolveRoot),
  };
  // Resolution scope is the whole enclosing tree; validation scope stays `records`.
  const resolveRecords = resolveRoot === workRoot ? null : collectRecordMap(resolveRoot, root);
  const payloads = walkWorkRecords(ctx);
  // Resolution scope: the whole enclosing tree when validate was pointed at a
  // record dir; otherwise the same map the validating walk just built.
  ctx.resolveMap = resolveRecords ?? ctx.records;
  ctx.sdsProvers = sdsProversOf(ctx.resolveMap);
  checkEvidenceFiles(ctx);
  ctx.inline = indexInlineCriteria(ctx.records);
  ctx.resolveInline = resolveRecords ? indexInlineCriteria(ctx.resolveMap) : ctx.inline;
  checkInlineCriteria(ctx);
  // Structured fields below hold record references too: `P#frag` resolves
  // to the record that carries the criterion, so a blockedBy on one criterion of a record is a wait on
  // that record, and a dangling fragment surfaces through the same "does not exist / no record owns"
  // refusal a dangling plain id gets.
  ctx.recOf = ref => {
    const rid = resolveRecordRef(ctx.resolveMap, ref, ctx.resolveInline);
    return rid ? ctx.resolveMap.get(rid) : undefined;
  };
  checkRefsResolve(ctx);
  for (const rec of ctx.records.values()) {
    for (const rule of RECORD_RULES) rule(ctx, rec);
  }
  checkRenderProofs(ctx);
  checkUatFlowResources(ctx);
  checkIdentityCustody(ctx);
  checkBlockerGraph(ctx);
  return {records: ctx.records.size, refs: ctx.refs.length, evidence: ctx.evidenceFiles.length, payloads};
}

/**
 * Concept 6 (shape truth): schemas/work-layout.yaml's `shape.families` is the schema's own claim about
 * which family folders exist; this script's `FAMILIES` set is the executable form of the same claim. The
 * two are two copies of one fact and must never independently drift - `schemaPath` is a parameter (not a
 * hardcoded read of the real file) purely so a fixture can exercise both a mismatched and a matching
 * shape.families without touching the real schema file.
 */
export function checkFamiliesDrift(problems, schemaPath = path.join(root, 'modules', 'schemas', 'work-layout.yaml')) {
  let doc;
  try {
    doc = parseYaml(fs.readFileSync(schemaPath, 'utf8'));
  } catch (error) {
    problems.push(`${schemaPath}: could not be read as YAML to check shape.families (${error.message}) [FAMILIES_DRIFT]`);
    return;
  }
  const declared = Array.isArray(doc?.shape?.families) ? doc.shape.families : null;
  if (!declared) {
    problems.push(`${schemaPath}: shape.families is missing; it must list exactly the families this script's own FAMILIES set recognizes [FAMILIES_DRIFT]`);
    return;
  }
  const declaredSet = new Set(declared);
  const missing = [...FAMILIES].filter(f => !declaredSet.has(f));
  const extra = declared.filter(f => !FAMILIES.has(f));
  if (missing.length || extra.length) {
    problems.push(`${schemaPath}: shape.families disagrees with this script's FAMILIES set - missing [${missing.join(', ')}], extra [${extra.join(', ')}] [FAMILIES_DRIFT]`);
  }
}

if (isMain(import.meta.url)) {
  const problems = [];
  const warnings = [];
  const infos = [];
  checkFamiliesDrift(problems);
  let records = 0, refs = 0, evidence = 0, payloads = 0;
  for (const workRoot of exampleWorkRoots(root)) {
    checkStarciworkBoundary(workRoot, problems, warnings);
    const counts = checkWorkTree(workRoot, problems, warnings, infos);
    records += counts.records; refs += counts.refs; evidence += counts.evidence; payloads += counts.payloads;
  }
  for (const problem of problems) console.log(`REFUSED ${problem}`);
  for (const warning of warnings) console.log(`WARN ${warning}`);
  for (const info of infos) console.log(`INFO ${info}`);
  console.log(`${records} record(s), ${refs} ref(s), ${evidence} evidence file(s), ${payloads} artifact payload(s) skipped: ${problems.length ? problems.length + ' refused' : 'every id matches its place, every ref resolves, and every new-concept rule is satisfied'}${warnings.length ? ', ' + warnings.length + ' warned' : ''}`);
  process.exitCode = problems.length ? 1 : 0;
}
