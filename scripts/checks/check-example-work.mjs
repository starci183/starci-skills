import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseYaml} from '../../engine/yaml.mjs';
import {readWorkspace, resolveOwnedDirs, missingOwnedDirs, declaresOwnPaths, hashOwnedDirs, isWorkRecordSchema, indexInlineCriteria, inlineCriteriaOf, splitRef, resolveRecordRef} from '../example/example-ownership.mjs';
import {renderProofProblems} from '../example/example-render-proof.mjs';

/**
 * The layout says an id mirrors its directory while remaining the identity. That sentence is only true if
 * something checks it: renaming `impl/todo-app` to `impl/todo-app-backend` left thirteen records whose id
 * still said `todo-app`, and the YAML gate accepted every one of them because each file parsed. A record
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
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const FAMILIES = new Set(['br', 'ac', 'fr', 'nfr', 'data', 'journey', 'decision', 'sds', 'ui', 'impl', 'uat', 'contract', 'integration', 'gap', 'event']);
// `work/node@*` is the retired recursive specification envelope from the
// pre-flat business/srs and architecture/sds layouts.  Existing trees still
// carry those records during canonicalization, and engine/index.mjs keeps the
// readers that validate their identity and semantics.  Tolerate them here
// instead of forcing the flat-family contract onto a retired format; ops must
// not author new work/node records.
const EXEMPT = new Set(['work/catalog@1', 'work/workspace@1', 'work/brand@1', 'work/feature@1', 'work/disposable-accounts@1']);
const isRecursiveNodeSchema = schema => /^work\/node@\d+$/.test(schema ?? '');
const KERNEL_CUSTODY_ROOTS = new Set(['kernel-evidence', 'kernel-strays', 'kernel-approvals']);
const ID_RE = /^(br|ac|fr|nfr|data|journey|decision|sds|ui|impl|uat|contract|integration|gap|event)\.[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Schemas whose `done` is an authored claim by nature (concept 6); every other schema needs proof or a declaration. */
const AUTHORED_CLAIM_SCHEMAS = new Set(['work/data@1', 'work/brand@1', 'work/policy-decision@1']);
const CHANGE_KINDS = new Set(['initial', 'editorial', 'clarifying', 'breaking']);
const DELIVERY_GUARANTEES = new Set(['at-least-once', 'at-most-once', 'exactly-once']);
const DELIVERY_ORDERINGS = new Set(['none', 'per-key', 'total']);

export const walk = dir => fs.readdirSync(dir, {withFileTypes: true})
  .flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);

/** The id a record in this directory must carry: the innermost family, the feature, then the rest in order. */
const expectedId = segments => {
  const feature = segments[1];
  const rest = segments.slice(2, -1);
  const family = [...rest].reverse().find(segment => FAMILIES.has(segment));
  if (!family) return null;
  return [family, feature, ...rest.filter(segment => !FAMILIES.has(segment))].join('.');
};

/** sha256 of a record's own index.yaml bytes - the recordDigest the work-layout contract
 * (modules/schemas/work-layout.yaml) declares for staleness. Computed inline here. */
const sha256File = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/**
 * Runs every check in this file against one .starciwork tree rooted at `workRoot`, appending human-readable
 * refusal strings to `problems`. Exported so the fixture test can point it at a throwaway tree instead of
 * the real example tree.
 */
export function checkWorkTree(workRoot, problems, warnings = [], infos = []) {
  const records = new Map(); // id -> {schema, state, change, file, shown, dir, data}
  const refs = [];
  const evidenceFiles = [];
  let payloads = 0;
  const workspaceDoc = readWorkspace(workRoot);

  const collect = (node, file, trail) => {
    if (typeof node === 'string') {
      const text = node.trim();
      if (ID_RE.test(text)) { refs.push({id: text, frag: null, file, trail}); return; }
      // `parent#frag` is the compact format's way of addressing an inlined acceptance criterion -
      // the parent half must still be a well-formed record id for the ref to mean anything.
      const {id, frag} = splitRef(text);
      if (frag !== null && frag && ID_RE.test(id)) refs.push({id, frag, file, trail});
      else if (frag !== null && id && !/[\s/\\:]/.test(text)) {
        // `something#` or `something#with space` - someone reached for the compact-ref syntax and
        // produced a token that is neither a record id nor a resolvable fragment. Flag it rather
        // than letting it pass silently as an ordinary string.
        refs.push({id: text, malformedRef: true, file, trail});
      }
      return;
    }
    if (Array.isArray(node)) return node.forEach(item => collect(item, file, trail));
    if (node && typeof node === 'object') for (const [key, value] of Object.entries(node)) collect(value, file, trail ? `${trail}.${key}` : key);
  };

  for (const file of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
    const rel = path.relative(workRoot, file).replaceAll('\\', '/');
    const rootSegment = rel.split('/')[0];
    // Kernel custody and generated projections have their own lifetime and
    // validators.  They are explicitly outside the authored Work record walk.
    if (KERNEL_CUSTODY_ROOTS.has(rootSegment) || rootSegment === '_derived') continue;
    const shown = path.relative(root, file).replaceAll('\\', '/');
    let record;
    try { record = parseYaml(fs.readFileSync(file, 'utf8')); }
    catch (error) {
      // A yaml the runtime loader rejects is refused like any other malformed record - never let one
      // bad file (or a lane's half-written save) take the whole gate down with it.
      problems.push(`${shown}: does not parse under the runtime YAML loader (${String(error?.message ?? error)})`);
      continue;
    }
    if (!record || typeof record !== 'object') continue;
    const segments = rel.split('/');

    // The schema marker decides whether this yaml is a record at all, before any record rule sees it.
    // A foreign schema - a generation receipt, a direction check, a uat run manifest - is a tool's
    // artifact payload: counted as INFO and walked past, never id-matched to its path and never
    // ref-collected (its internals are the tool's output, not edges into this graph). A yaml with no
    // schema line stays on the record path, so deleting the marker cannot hide a malformed record.
    if (!isWorkRecordSchema(record.schema, workspaceDoc)) {
      payloads += 1;
      infos.push(`${shown}: schema ${record.schema} is an artifact payload, not a work record [PAYLOAD_SKIPPED]`);
      continue;
    }

    // Evidence manifests are proof payloads owned by the adjacent record, not
    // independent Work records whose id is derived from a feature family.
    // The engine and check-work-artifacts validate their evidence contract.
    if ((record.schema === 'work/evidence@1' && !rel.endsWith('/evidence.yaml'))
      || (path.basename(rel) === 'manifest.yaml' && segments.includes('evidence'))) {
      payloads += 1;
      infos.push(`${shown}: evidence manifest is proof payload, not a compact family record [PAYLOAD_SKIPPED]`);
      continue;
    }

    if (rel.endsWith('/evidence.yaml')) {
      evidenceFiles.push({record, shown, dir: path.dirname(file)});
      continue;
    }
    const recursiveNode = isRecursiveNodeSchema(record.schema);
    if (record.id) records.set(record.id, {schema: record.schema, state: record.state, change: record.change, file, shown, dir: path.dirname(file), data: record, recursiveNode});
    if (segments[0] === 'features' && segments.length > 2 && !EXEMPT.has(record.schema) && !recursiveNode) {
      const want = expectedId(segments);
      if (want && record.id !== want) problems.push(`${shown}: id is ${record.id}, but its place says ${want}`);
      if (!want) problems.push(`${shown}: no record family in its path; ${[...FAMILIES].join(', ')} are the families`);
    }
    collect(record, shown, '');
  }

  // ---- evidence: naming + staleness (concept: change/staleness) ----
  for (const {record, shown, dir} of evidenceFiles) {
    const siblingFile = path.join(dir, 'index.yaml');
    const sibling = fs.existsSync(siblingFile) ? parseYaml(fs.readFileSync(siblingFile, 'utf8')) : null;
    if (record.record !== sibling?.id) {
      problems.push(`${shown}: evidence names ${record.record}, but the record beside it is ${sibling?.id}`);
      continue;
    }
    if (fs.existsSync(siblingFile) && record.recordDigest) {
      const current = sha256File(siblingFile);
      if (current !== record.recordDigest && record.stale !== true) {
        problems.push(`${shown}: recordDigest ${record.recordDigest} no longer matches ${sibling.id}'s current digest ${current}; refused unless it carries stale: true`);
      }
    }

    // ---- trust concept 1: codeDigest freshness ----
    // A code change should be able to stale a proof without anyone editing the record. If capture-time
    // codeDigest no longer matches what resolveOwnedDirs/hashOwnedDirs compute from the code on disk
    // right now, the evidence is refused unless it already carries stale: true (the same escape valve
    // recordDigest staleness above uses).
    if (record.codeDigest?.digest) {
      const recEntry = records.get(record.record);
      if (recEntry) {
        const dirs = resolveOwnedDirs(record.record, recEntry, records, workspaceDoc, workRoot);
        const fresh = hashOwnedDirs(dirs);
        const freshDigest = fresh?.digest ?? null;
        if (freshDigest !== record.codeDigest.digest && record.stale !== true) {
          problems.push(`${shown}: codeDigest ${record.codeDigest.digest} no longer matches the code currently under ${sibling.id}'s owners/module (now ${freshDigest ?? '(no files found)'}); refused unless it carries stale: true [CODE_DIGEST_STALE]`);
        }
      }
    }

    // ---- trust concept 2: replayable evidence ----
    // Every assertion must carry the exact `command` that was run, not only a prose `observation`, so
    // scripts/example/example-verify.mjs can re-run it later and compare outcomes. An assertion missing `command`
    // is refused as not replayable.
    for (const assertion of Array.isArray(record.assertions) ? record.assertions : []) {
      if (!assertion || typeof assertion.command !== 'string' || !assertion.command.trim()) {
        problems.push(`${shown}: assertion ${assertion?.id ?? '(unnamed)'} carries no command - evidence without a replayable command is refused [PROOF_NOT_REPLAYABLE]`);
      }
    }
  }

  // ---- inline acceptance criteria (v11 compact format) ----
  // A criterion may be carried inline on the
  // parent's `acceptance:`/`statements:` list as an entry with `id: <ac-id>`. Two rules keep the
  // collapse honest: an entry's declared id must be the id its place implies (`ac.` + the parent's id
  // minus its family segment + `.` + name), the same place-law a file under ac/ lived under; and one id
  // may not be claimed by two parents.
  const inline = indexInlineCriteria(records);
  for (const [id, rec] of records) {
    const wantPrefix = `ac.${id.split('.').slice(1).join('.')}.`;
    for (const criterion of inlineCriteriaOf(rec.data)) {
      for (const field of ['state', 'change', 'evidence', 'provenBy']) {
        if (field in criterion.entry) {
          problems.push(`${rec.shown}: inline criterion ${criterion.id ?? criterion.name ?? '(unnamed)'} carries its own ${field} - a criterion with its own lifecycle or evidence stays its own ac/ record, the compact form is for criteria that share the parent's [AC_LIFECYCLE_INLINE]`);
        }
      }
      if (!criterion.id || !ID_RE.test(criterion.id)) continue;
      if (!criterion.id.startsWith(wantPrefix)) {
        problems.push(`${rec.shown}: inline criterion carries id ${criterion.id}, but its place inside ${id} says ${wantPrefix}* - the compact form keeps the former record's own id [AC_ID_MISMATCH]`);
      }
      if (records.has(criterion.id)) {
        problems.push(`${rec.shown}: inline criterion id ${criterion.id} is also a live record's id - a collapsed criterion and a record cannot both own it [AC_ID_COLLISION]`);
      }
    }
  }
  for (const collision of inline.collisions) {
    problems.push(`inline criterion ${collision.id} is declared under both ${collision.parents.join(' and ')} [AC_ID_COLLISION]`);
  }
  // Structured fields below hold record references too: `P#frag` and collapsed bare `ac.*` ids resolve
  // to the record that carries the criterion, so a blockedBy on one criterion of a record is a wait on
  // that record, and a dangling fragment surfaces through the same "does not exist / no record owns"
  // refusal a dangling plain id gets.
  const recOf = ref => {
    const rid = resolveRecordRef(records, ref, inline);
    return rid ? records.get(rid) : undefined;
  };

  // ---- refs resolve (existing structural check, now also covers blockedBy/conflictsWith/appliesTo/subscribes/extends record ids) ----
  // Compact-format resolution: `P#frag` resolves when P is a record and frag names an inline criterion
  // P carries (full id, short name, or last id segment - or a live record id / kept-separate ac id under
  // P). A bare `ac.*` id that no record owns but some record now carries inline still resolves - it is
  // not dangling - but warns AC_UNREMAPPED_REF because `parent#ac-id` is the canonical form. The ref's
  // own declaration trail (acceptance.id / statements.id inside the entry itself) never warns.
  const DECL_TRAIL = /^(?:acceptance|statements)\.(?:.+\.)?id$/;
  for (const ref of refs) {
    if (ref.malformedRef) {
      problems.push(`${ref.file}: ${ref.trail} holds "${ref.id}", which looks like a parent#criterion ref but resolves to neither: use the record id, or \`parent.id#criterion-short-name\` for an inlined criterion [REF_MALFORMED]`);
      continue;
    }
    if (ref.frag != null) {
      if (!records.has(ref.id)) {
        problems.push(`${ref.file}: ${ref.trail} points at ${ref.id}#${ref.frag}, but no record owns ${ref.id}`);
        continue;
      }
      const resolved = inline.byParent.get(ref.id)?.has(ref.frag)
        || records.has(ref.frag)
        || inline.byAcId.get(ref.frag) === ref.id;
      if (!resolved) problems.push(`${ref.file}: ${ref.trail} points at ${ref.id}#${ref.frag}, which names no criterion ${ref.id} carries`);
      continue;
    }
    if (records.has(ref.id)) continue;
    if (inline.byAcId.has(ref.id)) {
      if (!DECL_TRAIL.test(ref.trail)) {
        warnings.push(`${ref.file}: ${ref.trail} references collapsed criterion ${ref.id} by its old ac id - the compact form is ${inline.byAcId.get(ref.id)}#${ref.id} [AC_UNREMAPPED_REF]`);
      }
      continue;
    }
    problems.push(`${ref.file}: ${ref.trail} points at ${ref.id}, which no record owns`);
  }

  for (const [id, rec] of records) {
    const data = rec.data;
    const schema = rec.schema;
    // Legacy recursive specification nodes are checked by engine/index.mjs and
    // the typed SRS/SDS readers.  The rules below are the canonical flat
    // work/* family contract and must not impose its lifecycle or identity on
    // the retired format.
    if (rec.recursiveNode) continue;

    // ---- concept 1: blocker edges ----
    if (Array.isArray(data.blockedBy)) {
      for (const entry of data.blockedBy) {
        if (typeof entry === 'string') {
          problems.push(`${rec.shown}: blockedBy carries a prose string ("${entry.slice(0, 60)}..."); every entry must be {record, rev?, because}`);
          continue;
        }
        if (!entry || typeof entry !== 'object' || !entry.record) {
          problems.push(`${rec.shown}: blockedBy entry has no record id`);
          continue;
        }
        const target = recOf(entry.record);
        if (!target) { problems.push(`${rec.shown}: blockedBy target ${entry.record} does not exist`); continue; }
        if (target.state === 'done') {
          const targetRev = target.change?.rev;
          const stale = entry.rev == null || (typeof targetRev === 'number' && targetRev >= entry.rev);
          if (stale) problems.push(`${rec.shown}: blockedBy on ${entry.record} is stale - it is done at rev ${targetRev ?? '(none)'}, cited rev was ${entry.rev ?? '(none)'}`);
        }
      }
    }

    // ---- concept 3: conflictsWith (pairwise) + tension (N-ary, policy-decision only) ----
    if (Array.isArray(data.conflictsWith)) {
      for (const entry of data.conflictsWith) {
        if (!entry || typeof entry !== 'object' || !entry.record) { problems.push(`${rec.shown}: conflictsWith entry has no record id`); continue; }
        const target = recOf(entry.record);
        if (!target) { problems.push(`${rec.shown}: conflictsWith target ${entry.record} does not exist`); continue; }
        if (entry.rev != null && target.change?.rev !== entry.rev) {
          problems.push(`${rec.shown}: conflictsWith cites ${entry.record} at rev ${entry.rev}, but it is now at rev ${target.change?.rev ?? '(none)'}`);
        }
      }
    }
    if (data.tension) {
      if (schema !== 'work/policy-decision@1') {
        problems.push(`${rec.shown}: tension is only authored on work/policy-decision@1, not ${schema}`);
      } else {
        const ids = Array.isArray(data.tension.records) ? data.tension.records : [];
        if (ids.length < 2) problems.push(`${rec.shown}: tension.records needs at least two record ids`);
        for (const tid of ids) if (!resolveRecordRef(records, tid, inline)) problems.push(`${rec.shown}: tension.records names ${tid}, which no record owns`);
      }
    }

    // ---- concept 2: gap family (closedBy is a list - a bare string is normalised to one) ----
    if (schema === 'work/gap@1') {
      if (!['todo', 'done'].includes(data.state)) problems.push(`${rec.shown}: work/gap@1 state must be todo or done`);
      if (!data.statement) problems.push(`${rec.shown}: work/gap@1 needs a statement`);
      if (data.closedBy != null) {
        const closers = typeof data.closedBy === 'string' ? [data.closedBy] : Array.isArray(data.closedBy) ? data.closedBy : null;
        if (!closers) {
          problems.push(`${rec.shown}: closedBy must be a record id or a list of record ids, not ${JSON.stringify(data.closedBy)}`);
        } else {
          const unresolved = closers.filter(c => !resolveRecordRef(records, c, inline));
          for (const c of unresolved) problems.push(`${rec.shown}: closedBy names ${c}, which no record owns`);
          if (data.state === 'done' && !unresolved.length) {
            const notDone = closers.filter(c => recOf(c)?.state !== 'done');
            for (const c of notDone) problems.push(`${rec.shown}: work/gap@1 is done but closedBy's ${c} is ${recOf(c)?.state ?? '(no state)'}, not done - a gap is closed only once every one of its closers is`);
          }
        }
      }
    }

    // ---- concept 4: decision vocabulary ----
    if (schema === 'work/policy-decision@1') {
      if (!['open', 'decided'].includes(data.outcome)) {
        problems.push(`${rec.shown}: outcome must be open or decided, not "${data.outcome}" - the chosen option's id belongs in chosen, not invented into outcome`);
      } else if (data.outcome === 'decided') {
        const optionIds = Array.isArray(data.options) ? data.options.map(o => o.id) : [];
        if (!data.chosen) problems.push(`${rec.shown}: outcome is decided but chosen is missing`);
        else if (!optionIds.includes(data.chosen)) problems.push(`${rec.shown}: chosen "${data.chosen}" is not one of options [${optionIds.join(', ')}]`);
      }
      if ('targetModule' in data) problems.push(`${rec.shown}: targetModule is not part of the decision vocabulary - a decision's implementation site belongs on the implementation record that proves it`);
    }

    // ---- concept 5: change.kind is closed ----
    if (data.change?.kind && !CHANGE_KINDS.has(data.change.kind)) {
      problems.push(`${rec.shown}: change.kind "${data.change.kind}" is not one of ${[...CHANGE_KINDS].join(', ')}`);
    }

    // ---- concept 6: done means proven or says so ----
    if (data.state === 'done' && !AUTHORED_CLAIM_SCHEMAS.has(schema)) {
      const hasEvidence = fs.existsSync(path.join(rec.dir, 'evidence.yaml'));
      const claims = data.verificationSource === 'authored-claim' && data.because;
      if (!hasEvidence && !claims) {
        problems.push(`${rec.shown}: state is done with no sibling evidence.yaml and no verificationSource: authored-claim + because`);
      }
    }

    // ---- concept 7: appliesTo is outbound, only on business-rule/sds-component ----
    if ('appliesTo' in data) {
      if (!['work/business-rule@1', 'work/sds-component@1'].includes(schema)) {
        problems.push(`${rec.shown}: appliesTo is only authored on work/business-rule@1 or work/sds-component@1, not ${schema}`);
      } else {
        for (const target of data.appliesTo) if (!resolveRecordRef(records, target, inline)) problems.push(`${rec.shown}: appliesTo names ${target}, which no record owns`);
      }
    }

    // ---- concept 8: events, data extends, timer transitions ----
    if (schema === 'work/event@1') {
      if (!data.producer || !resolveRecordRef(records, data.producer, inline)) problems.push(`${rec.shown}: event producer "${data.producer}" does not resolve to a record`);
      if (!Array.isArray(data.payload) || !data.payload.length) problems.push(`${rec.shown}: event needs a non-empty payload`);
      const guarantee = data.delivery?.guarantee, ordering = data.delivery?.ordering;
      if (!DELIVERY_GUARANTEES.has(guarantee)) problems.push(`${rec.shown}: delivery.guarantee "${guarantee}" is not one of ${[...DELIVERY_GUARANTEES].join(', ')}`);
      if (!DELIVERY_ORDERINGS.has(ordering)) problems.push(`${rec.shown}: delivery.ordering "${ordering}" is not one of ${[...DELIVERY_ORDERINGS].join(', ')}`);
    }
    if (Array.isArray(data.subscribes)) {
      for (const eid of data.subscribes) {
        const target = recOf(eid);
        if (!target) problems.push(`${rec.shown}: subscribes names ${eid}, which no record owns`);
        else if (target.schema !== 'work/event@1') problems.push(`${rec.shown}: subscribes names ${eid}, which is a ${target.schema}, not a work/event@1`);
      }
    }
    if (schema === 'work/data@1' && data.extends) {
      const base = recOf(data.extends);
      if (!base) problems.push(`${rec.shown}: extends names ${data.extends}, which no record owns`);
      else if (base.schema !== 'work/data@1') problems.push(`${rec.shown}: extends names ${data.extends}, which is a ${base.schema}, not a work/data@1`);
    }
    if (data.stateMachine?.transitions) {
      for (const t of data.stateMachine.transitions) {
        if (t.on && typeof t.on === 'object' && !('timer' in t.on)) {
          problems.push(`${rec.shown}: transition ${t.id ?? '(unnamed)'}'s on is an object but not {timer: ...}`);
        }
      }
    }

    // ---- concept 9: implementation owners ----
    if (schema === 'work/implementation@1') {
      if ('directory' in data || 'files' in data || 'targetFiles' in data) {
        problems.push(`${rec.shown}: work/implementation@1 carries directory/files/targetFiles, which are not part of the contract; use owners: [{role, path}]`);
      }
      if (data.owners) {
        for (const owner of data.owners) {
          if (!owner || !owner.role || !owner.path) problems.push(`${rec.shown}: owners entry missing role or path`);
        }
      }
    }
    if (schema === 'work/business-rule@1' && 'module' in data) {
      const m = data.module;
      const ok = typeof m === 'string' ? m.length > 0 : Array.isArray(m) && m.length > 0 && m.every(x => typeof x === 'string' && x.length > 0);
      if (!ok) problems.push(`${rec.shown}: business-rule module must be a non-empty string or a non-empty list of strings`);
    }

    // ---- trust concept 3: proves and owners are checked ----
    // A done record whose `proves` names a target that is itself not done is refused: proof cannot outrun
    // what it proves. A dangling `proves` target is already caught by the generic ref-resolution check
    // above, so only a resolving-but-not-done target is new here.
    if (Array.isArray(data.proves) && data.state === 'done') {
      for (const targetId of data.proves) {
        const target = recOf(targetId);
        if (target && target.state !== 'done') {
          problems.push(`${rec.shown}: state is done but proves ${targetId}, which is ${target.state ?? '(no state)'}, not done [PROVES_TARGET_NOT_DONE]`);
        }
      }
    }
    // `owners[].path` / `module` name module-root directories (schemas/work-layout.yaml's `impl` shape
    // entry; scripts/example/example-ownership.mjs's moduleRootOf normalises a file or `/**` glob path down
    // to that root). A done record naming one that does not exist on disk is refused; a todo one is only
    // warned, since the module a todo record targets may not have been built yet.
    if (declaresOwnPaths(data)) {
      const dirs = resolveOwnedDirs(id, rec, records, workspaceDoc, workRoot);
      const missing = missingOwnedDirs(dirs);
      if (missing.length) {
        const list = missing.map(m => m.rel).join(', ');
        const message = `${rec.shown}: owners/module names a directory that does not exist on disk: ${list} [OWNER_PATH_MISSING]`;
        if (data.state === 'done') problems.push(message); else warnings.push(message);
      }
    }

    // ---- trust concept 4: an sds-component binds to a module ----
    // A design component's read-scope boundary is a module boundary: a `done` sds-component must name at
    // least one owners[] directory (checked for existence by the OWNER_PATH_MISSING rule above, since
    // work/sds-component@1 is not exempted from declaresOwnPaths). A `todo` one with no owners at all is
    // only warned - the module a design targets may not exist yet.
    if (schema === 'work/sds-component@1') {
      const hasOwners = Array.isArray(data.owners) && data.owners.some(o => o && o.path);
      if (!hasOwners) {
        const message = `${rec.shown}: work/sds-component@1 ${data.state === 'done' ? 'is done but carries' : 'carries'} no owners naming a module directory - a design component's read-scope boundary is a module boundary, not a prose claim`;
        if (data.state === 'done') problems.push(message); else warnings.push(message);
      }
    }

    // ---- trust concept 8: implementation is held until its ui direction is drawn ----
    // docs/kinds.md's `implementation/frontend` lane is "held until the feature's ui node is done" -
    // drawing precedes implementing. A done work/implementation@1 that names a work/ui-screen@1 in its own
    // `proves`, or whose `repository` is the workspace's frontend repository, is refused
    // (IMPL_BEFORE_DIRECTION) unless every relevant ui-screen is itself done: the ones it explicitly
    // proves, or - when it proves none by id - every ui-screen its own feature owns (a frontend
    // implementation is for some screen even when it did not name one via proves).
    if (schema === 'work/implementation@1' && data.state === 'done') {
      const provesUi = (Array.isArray(data.proves) ? data.proves : []).filter(pid => recOf(pid)?.schema === 'work/ui-screen@1');
      const repos = Array.isArray(workspaceDoc?.repositories) ? workspaceDoc.repositories : [];
      const isFrontendRepo = data.repository ? repos.find(r => r?.name === data.repository)?.role === 'fe' : false;
      if (provesUi.length || isFrontendRepo) {
        let relevantUi = provesUi;
        if (!relevantUi.length) {
          const feature = path.relative(workRoot, rec.dir).replaceAll('\\', '/').split('/')[1];
          relevantUi = [...records.entries()]
            .filter(([, r]) => r.schema === 'work/ui-screen@1' && path.relative(workRoot, r.dir).replaceAll('\\', '/').split('/')[1] === feature)
            .map(([uid]) => uid);
        }
        const notDone = relevantUi.filter(uid => recOf(uid)?.state !== 'done');
        if (relevantUi.length && notDone.length) {
          problems.push(`${rec.shown}: state is done but its ui direction is not - ${notDone.join(', ')} ${notDone.length > 1 ? 'are' : 'is'} not done yet (docs/kinds.md's implementation/frontend lane is held until the feature's ui node is done) [IMPL_BEFORE_DIRECTION]`);
        }
      }
    }

    // ---- concept 10: a ui record is done only with a generated direction asset and full state coverage ----
    if (schema === 'work/ui-screen@1' && data.state === 'done') {
      const assets = Array.isArray(data.assets) ? data.assets : [];
      const hasDirection = assets.some(a => a && typeof a === 'object' && a.generation && a.generation.tool === 'image_gen.imagegen');
      if (!hasDirection) {
        problems.push(`${rec.shown}: state is done but no asset carries generation.tool: image_gen.imagegen - a ui record is done only with at least one interface.draw direction, never an authored claim`);
      }
      const uiSpec = data.ui;
      if (uiSpec) {
        const stateNames = (uiSpec.states ?? []).map(s => s?.name).filter(Boolean);
        const covered = new Set((uiSpec.coverage?.map ?? []).map(m => m?.state));
        for (const name of stateNames) {
          if (!covered.has(name)) problems.push(`${rec.shown}: ui.coverage.map names no entry for state "${name}", which ui.states lists`);
        }
      }
    }

    // ---- concept 11: a generation-carrying asset is ui-owned direction, never an implementation capture ----
    if (Array.isArray(data.assets)) {
      for (const a of data.assets) {
        if (!a || typeof a !== 'object' || !a.generation) continue;
        if (schema === 'work/implementation@1') {
          problems.push(`${rec.shown}: implementation asset ${a.path} carries generation - implementation captures are real running-page screenshots and never carry ImageGen generation provenance`);
        } else if (schema !== 'work/ui-screen@1') {
          problems.push(`${rec.shown}: asset ${a.path} carries generation but the owning record is ${schema}, not work/ui-screen@1 - a generated direction asset is ui-owned only`);
        }
      }
    }

    // ---- concept 12: a done uat-flow needs a settled run with screens, video and a passing result.md ----
    if (schema === 'work/uat-flow@1' && data.state === 'done') {
      const evidenceFile = path.join(rec.dir, 'evidence.yaml');
      if (!fs.existsSync(evidenceFile)) {
        problems.push(`${rec.shown}: state is done but there is no sibling evidence.yaml naming the run it settled on`);
      } else {
        const ev = parseYaml(fs.readFileSync(evidenceFile, 'utf8'));
        if (!ev?.run) {
          problems.push(`${rec.shown}: evidence.yaml has no run pointing at runs/<runId> - a done uat-flow must name the exact run it settled on`);
        } else {
          const runDir = path.join(rec.dir, ev.run);
          const screensDir = path.join(runDir, 'screens');
          const videosDir = path.join(runDir, 'videos');
          const resultFile = path.join(runDir, 'result.md');
          const hasFiles = dir => fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
          if (!hasFiles(screensDir)) problems.push(`${rec.shown}: run ${ev.run} has no screens/ with at least one screenshot`);
          if (!hasFiles(videosDir)) problems.push(`${rec.shown}: run ${ev.run} has no videos/ with at least one playable recording`);
          if (!fs.existsSync(resultFile)) {
            problems.push(`${rec.shown}: run ${ev.run} has no result.md`);
          } else if (!/outcome:\s*pass/i.test(fs.readFileSync(resultFile, 'utf8'))) {
            problems.push(`${rec.shown}: run ${ev.run}'s result.md does not record outcome: pass`);
          }
        }
      }
    }

    // ---- concept 13: typed _resources custody uses exactly the work/resource@1 schema ----
    if (rec.file.replaceAll('\\', '/').includes('/_resources/') && /\/resource\.yaml$/.test(rec.file.replaceAll('\\', '/'))) {
      if (schema !== 'work/resource@1') {
        problems.push(`${rec.shown}: _resources custody uses schema work/resource@1, not "${schema}"`);
      }
    }
  }

  // ---- trust concept 9: a done frontend implementation needs render/brand proof ----
  // scripts/checks/render.mjs + scripts/checks/brand.mjs are the canon for "the running page looks like the brand and the
  // grammar" - palette from the captured PNG's own bytes, card anatomy from the markup kept beside it,
  // mascot slots from the ui record's surfaces. Until now nothing ran them against this tree, so a
  // frontend work/implementation@1 could reach `done` with no capture at all (grit item 55). The rule:
  // a done implementation that is frontend (same predicate as IMPL_BEFORE_DIRECTION - proves a
  // work/ui-screen@1, or its repository resolves to a `role: fe` workspace entry) must keep real capture
  // artifacts in the shape render.mjs reads (PNG + sibling .html under its assets/) and pass the checks.
  // A `skip` on a core check is refused as RENDER_PROOF_INCOMPLETE - an uncheckable claim is not a pass.
  for (const [id, rec] of records) {
    if (rec.schema !== 'work/implementation@1' || rec.data?.state !== 'done') continue;
    for (const problem of renderProofProblems({rec, records, workspaceDoc, workRoot})) {
      problems.push(`${rec.shown}: ${problem}`);
    }
  }

  // ---- concept 13 (continued): uat-flow environment/fixtures/accounts refs resolve to a real _resources entry ----
  const resourceKind = (id) => recOf(id)?.data?.kind;
  for (const [id, rec] of records) {
    if (rec.schema !== 'work/uat-flow@1') continue;
    const data = rec.data;
    if (data.environment) {
      const target = recOf(data.environment);
      if (!target || target.schema !== 'work/resource@1') problems.push(`${rec.shown}: environment ${data.environment} does not resolve to a work/resource@1`);
      else if (resourceKind(data.environment) !== 'environment') problems.push(`${rec.shown}: environment ${data.environment} resolves to a work/resource@1 of kind "${resourceKind(data.environment)}", not environment`);
    }
    if (Array.isArray(data.fixtures)) {
      for (const fid of data.fixtures) {
        const target = recOf(fid);
        if (!target || target.schema !== 'work/resource@1') problems.push(`${rec.shown}: fixture ${fid} does not resolve to a work/resource@1`);
        else if (resourceKind(fid) !== 'fixture') problems.push(`${rec.shown}: fixture ${fid} resolves to a work/resource@1 of kind "${resourceKind(fid)}", not fixture`);
      }
    }
    if (typeof data.accounts === 'string') {
      const accountsFile = path.join(rec.dir, data.accounts);
      if (fs.existsSync(accountsFile)) {
        const accountsDoc = parseYaml(fs.readFileSync(accountsFile, 'utf8'));
        for (const account of accountsDoc?.accounts ?? []) {
          if (!account?.identity) continue;
          const target = recOf(account.identity);
          if (!target || target.schema !== 'work/resource@1') problems.push(`${rec.shown}: accounts.yaml identity ${account.identity} does not resolve to a work/resource@1`);
          else if (resourceKind(account.identity) !== 'identity') problems.push(`${rec.shown}: accounts.yaml identity ${account.identity} resolves to a work/resource@1 of kind "${resourceKind(account.identity)}", not identity`);
        }
      }
    }
  }

  // ---- trust concept 5: blockers form a DAG rooted in gaps or open decisions ----
  // `blockedBy` is meant to explain *why* work waits, and the layout says the honest root of a wait is
  // either a `work/gap@1` (a named absence) or an open `work/policy-decision@1` - never a loop back on itself.
  // A cycle is a structural impossibility (nothing can wait on something that is waiting on it) and is
  // refused (BLOCKER_CYCLE). A chain that dead-ends at an ordinary record - neither a cycle nor a gap/open-
  // decision root - is not refused: this example tree currently has roughly a dozen such chains across
  // several features (an implementation waiting on another implementation that itself has not landed,
  // with no gap ever authored for the absence), and refusing every one of them tree-wide would be a much
  // larger red surface than this lane is scoped to fix record-by-record. It is warned (BLOCKER_UNROOTED)
  // instead, naming the actual unrooted target, so the fact is visible without forcing a gap to be
  // authored for every such chain in one sweep.
  const blockedByOf = rec => Array.isArray(rec?.data?.blockedBy)
    ? rec.data.blockedBy.filter(e => e && typeof e === 'object' && typeof e.record === 'string')
      .map(e => resolveRecordRef(records, e.record, inline) ?? e.record)
    : [];

  /** DFS from `startId` looking for a path back to `startId` itself. Returns the cycle as an array of ids
   * (startId ... startId) or null. O(V*(V+E)) run once per record is fine at this tree's size (a few
   * hundred records), and keeps the algorithm obviously correct rather than a from-scratch Tarjan. */
  const cyclePathFrom = startId => {
    const visited = new Set();
    const path = [];
    const dfs = current => {
      visited.add(current);
      path.push(current);
      for (const next of blockedByOf(records.get(current))) {
        if (!records.has(next)) continue;
        if (next === startId) return [...path, next];
        if (visited.has(next)) continue;
        const found = dfs(next);
        if (found) return found;
      }
      path.pop();
      return null;
    };
    return dfs(startId);
  };

  /** Every direct or transitive `blockedBy` root reachable from `startId`, stopping at a gap, an open
   * decision, a cycle back into the walk, or a dead end with no further blockedBy of its own - the same
   * shape scripts/example/example-derive.mjs's own resolveBlockers computes, reimplemented here (not imported: this
   * module and example-derive.mjs already import from each other in the other direction, and importing
   * back would create a cycle in the module graph itself, not just the data). Returns a Map(id -> kind),
   * kind one of gap|decision|record|cyclic|missing. */
  const rootsFrom = startId => {
    const roots = new Map();
    const visitEdge = (targetId, visited) => {
      if (roots.has(targetId)) return;
      const target = records.get(targetId);
      if (!target) { roots.set(targetId, 'missing'); return; } // dangling ref already caught elsewhere
      if (visited.has(targetId)) { roots.set(targetId, 'cyclic'); return; }
      const isGap = target.schema === 'work/gap@1';
      const isOpenDecision = target.schema === 'work/policy-decision@1' && target.data?.outcome === 'open';
      const subEdges = blockedByOf(target);
      if (isGap || isOpenDecision || !subEdges.length) {
        roots.set(targetId, isGap ? 'gap' : isOpenDecision ? 'decision' : 'record');
        return;
      }
      const nextVisited = new Set(visited);
      nextVisited.add(targetId);
      for (const sub of subEdges) visitEdge(sub, nextVisited);
    };
    for (const edge of blockedByOf(records.get(startId))) visitEdge(edge, new Set([startId]));
    return roots;
  };

  const cyclicAlready = new Set();
  for (const [id, rec] of records) {
    if (!blockedByOf(rec).length || cyclicAlready.has(id)) continue;
    const cycle = cyclePathFrom(id);
    if (cycle) {
      for (const member of cycle) cyclicAlready.add(member);
      problems.push(`${rec.shown}: blockedBy forms a cycle: ${cycle.join(' -> ')} [BLOCKER_CYCLE]`);
    }
  }
  for (const [id, rec] of records) {
    if (!blockedByOf(rec).length) continue;
    for (const [rootId, kind] of rootsFrom(id)) {
      if (kind === 'record') {
        warnings.push(`${rec.shown}: blockedBy chain reaches ${rootId}, which is neither a work/gap@1 nor an open work/policy-decision@1 - the chain's real root is unnamed [BLOCKER_UNROOTED]`);
      }
    }
  }

  return {records: records.size, refs: refs.length, evidence: evidenceFiles.length, payloads};
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

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const problems = [];
  const warnings = [];
  const infos = [];
  checkFamiliesDrift(problems);
  let records = 0, refs = 0, evidence = 0, payloads = 0;
  for (const workRoot of walk(path.join(root, 'examples')).filter(file => file.endsWith(`.starciwork${path.sep}index.yaml`)).map(path.dirname)) {
    const counts = checkWorkTree(workRoot, problems, warnings, infos);
    records += counts.records; refs += counts.refs; evidence += counts.evidence; payloads += counts.payloads;
  }
  for (const problem of problems) console.log(`REFUSED ${problem}`);
  for (const warning of warnings) console.log(`WARN ${warning}`);
  for (const info of infos) console.log(`INFO ${info}`);
  console.log(`${records} record(s), ${refs} ref(s), ${evidence} evidence file(s), ${payloads} artifact payload(s) skipped: ${problems.length ? `${problems.length} refused` : 'every id matches its place, every ref resolves, and every new-concept rule is satisfied'}${warnings.length ? `, ${warnings.length} warned` : ''}`);
  process.exitCode = problems.length ? 1 : 0;
}
