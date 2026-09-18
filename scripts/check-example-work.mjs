import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseYaml} from '../core/yaml.mjs';

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
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAMILIES = new Set(['br', 'ac', 'fr', 'nfr', 'data', 'journey', 'decision', 'sds', 'ui', 'impl', 'uat', 'contract', 'integration', 'gap', 'event']);
const EXEMPT = new Set(['work/catalog', 'work/workspace', 'work/brand', 'work/feature', 'work/disposable-accounts', 'starci/application-stacks']);
const ID_RE = /^(br|ac|fr|nfr|data|journey|decision|sds|ui|impl|uat|contract|integration|gap|event)\.[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Schemas whose `done` is an authored claim by nature (concept 6); every other schema needs proof or a declaration. */
const AUTHORED_CLAIM_SCHEMAS = new Set(['work/data', 'work/brand', 'work/policy-decision']);
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

/** sha256 of a record's own index.yaml bytes - the same digest kernel/reconciliation.mjs's recordDigests
 * takes over the node file's bytes (see nodeFileOf/recordDigests there). Replicated inline rather than
 * imported because recordDigests expects a whole `tree` object with node.path/workRoot wiring this script
 * does not build; the byte-for-byte sha256 over the record file is the exact operation reused. */
const sha256File = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/**
 * Runs every check in this file against one .starciwork tree rooted at `workRoot`, appending human-readable
 * refusal strings to `problems`. Exported so the fixture test can point it at a throwaway tree instead of
 * the real example tree.
 */
export function checkWorkTree(workRoot, problems) {
  const records = new Map(); // id -> {schema, state, change, file, shown, dir, data}
  const refs = [];
  const evidenceFiles = [];

  const collect = (node, file, trail) => {
    if (typeof node === 'string') {
      if (ID_RE.test(node.trim())) refs.push({id: node.trim(), file, trail});
      return;
    }
    if (Array.isArray(node)) return node.forEach(item => collect(item, file, trail));
    if (node && typeof node === 'object') for (const [key, value] of Object.entries(node)) collect(value, file, trail ? `${trail}.${key}` : key);
  };

  for (const file of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
    const rel = path.relative(workRoot, file).replaceAll('\\', '/');
    const shown = path.relative(root, file).replaceAll('\\', '/');
    const record = parseYaml(fs.readFileSync(file, 'utf8'));
    if (!record || typeof record !== 'object') continue;
    const segments = rel.split('/');

    if (rel.endsWith('/evidence.yaml')) {
      evidenceFiles.push({record, shown, dir: path.dirname(file)});
      continue;
    }
    if (record.id) records.set(record.id, {schema: record.schema, state: record.state, change: record.change, file, shown, dir: path.dirname(file), data: record});
    if (segments[0] === 'features' && segments.length > 2 && !EXEMPT.has(record.schema)) {
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
  }

  // ---- refs resolve (existing structural check, now also covers blockedBy/conflictsWith/appliesTo/subscribes/extends record ids) ----
  for (const ref of refs) if (!records.has(ref.id)) problems.push(`${ref.file}: ${ref.trail} points at ${ref.id}, which no record owns`);

  for (const [id, rec] of records) {
    const data = rec.data;
    const schema = rec.schema;

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
        const target = records.get(entry.record);
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
        const target = records.get(entry.record);
        if (!target) { problems.push(`${rec.shown}: conflictsWith target ${entry.record} does not exist`); continue; }
        if (entry.rev != null && target.change?.rev !== entry.rev) {
          problems.push(`${rec.shown}: conflictsWith cites ${entry.record} at rev ${entry.rev}, but it is now at rev ${target.change?.rev ?? '(none)'}`);
        }
      }
    }
    if (data.tension) {
      if (schema !== 'work/policy-decision') {
        problems.push(`${rec.shown}: tension is only authored on work/policy-decision, not ${schema}`);
      } else {
        const ids = Array.isArray(data.tension.records) ? data.tension.records : [];
        if (ids.length < 2) problems.push(`${rec.shown}: tension.records needs at least two record ids`);
        for (const tid of ids) if (!records.has(tid)) problems.push(`${rec.shown}: tension.records names ${tid}, which no record owns`);
      }
    }

    // ---- concept 2: gap family ----
    if (schema === 'work/gap') {
      if (!['todo', 'done'].includes(data.state)) problems.push(`${rec.shown}: work/gap state must be todo or done`);
      if (!data.statement) problems.push(`${rec.shown}: work/gap needs a statement`);
      if (data.closedBy && !records.has(data.closedBy)) problems.push(`${rec.shown}: closedBy names ${data.closedBy}, which no record owns`);
    }

    // ---- concept 4: decision vocabulary ----
    if (schema === 'work/policy-decision') {
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
      if (!['work/business-rule', 'work/sds-component'].includes(schema)) {
        problems.push(`${rec.shown}: appliesTo is only authored on work/business-rule or work/sds-component, not ${schema}`);
      } else {
        for (const target of data.appliesTo) if (!records.has(target)) problems.push(`${rec.shown}: appliesTo names ${target}, which no record owns`);
      }
    }

    // ---- concept 8: events, data extends, timer transitions ----
    if (schema === 'work/event') {
      if (!data.producer || !records.has(data.producer)) problems.push(`${rec.shown}: event producer "${data.producer}" does not resolve to a record`);
      if (!Array.isArray(data.payload) || !data.payload.length) problems.push(`${rec.shown}: event needs a non-empty payload`);
      const guarantee = data.delivery?.guarantee, ordering = data.delivery?.ordering;
      if (!DELIVERY_GUARANTEES.has(guarantee)) problems.push(`${rec.shown}: delivery.guarantee "${guarantee}" is not one of ${[...DELIVERY_GUARANTEES].join(', ')}`);
      if (!DELIVERY_ORDERINGS.has(ordering)) problems.push(`${rec.shown}: delivery.ordering "${ordering}" is not one of ${[...DELIVERY_ORDERINGS].join(', ')}`);
    }
    if (Array.isArray(data.subscribes)) {
      for (const eid of data.subscribes) {
        const target = records.get(eid);
        if (!target) problems.push(`${rec.shown}: subscribes names ${eid}, which no record owns`);
        else if (target.schema !== 'work/event') problems.push(`${rec.shown}: subscribes names ${eid}, which is a ${target.schema}, not a work/event`);
      }
    }
    if (schema === 'work/data' && data.extends) {
      const base = records.get(data.extends);
      if (!base) problems.push(`${rec.shown}: extends names ${data.extends}, which no record owns`);
      else if (base.schema !== 'work/data') problems.push(`${rec.shown}: extends names ${data.extends}, which is a ${base.schema}, not a work/data`);
    }
    if (data.stateMachine?.transitions) {
      for (const t of data.stateMachine.transitions) {
        if (t.on && typeof t.on === 'object' && !('timer' in t.on)) {
          problems.push(`${rec.shown}: transition ${t.id ?? '(unnamed)'}'s on is an object but not {timer: ...}`);
        }
      }
    }

    // ---- concept 9: implementation owners ----
    if (schema === 'work/implementation') {
      if ('directory' in data || 'files' in data || 'targetFiles' in data) {
        problems.push(`${rec.shown}: work/implementation carries legacy directory/files/targetFiles; use owners: [{role, path}] instead`);
      }
      if (data.owners) {
        for (const owner of data.owners) {
          if (!owner || !owner.role || !owner.path) problems.push(`${rec.shown}: owners entry missing role or path`);
        }
      }
    }
    if (schema === 'work/business-rule' && 'module' in data) {
      const m = data.module;
      const ok = typeof m === 'string' ? m.length > 0 : Array.isArray(m) && m.length > 0 && m.every(x => typeof x === 'string' && x.length > 0);
      if (!ok) problems.push(`${rec.shown}: business-rule module must be a non-empty string or a non-empty list of strings`);
    }

    // ---- concept 10: a ui record is done only with a generated direction asset and full state coverage ----
    if (schema === 'work/ui-screen' && data.state === 'done') {
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
        if (schema === 'work/implementation') {
          problems.push(`${rec.shown}: implementation asset ${a.path} carries generation - implementation captures are real running-page screenshots and never carry ImageGen generation provenance`);
        } else if (schema !== 'work/ui-screen') {
          problems.push(`${rec.shown}: asset ${a.path} carries generation but the owning record is ${schema}, not work/ui-screen - a generated direction asset is ui-owned only`);
        }
      }
    }
  }

  return {records: records.size, refs: refs.length, evidence: evidenceFiles.length};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const problems = [];
  let records = 0, refs = 0, evidence = 0;
  for (const workRoot of walk(path.join(root, 'examples')).filter(file => file.endsWith(`.starciwork${path.sep}index.yaml`)).map(path.dirname)) {
    const counts = checkWorkTree(workRoot, problems);
    records += counts.records; refs += counts.refs; evidence += counts.evidence;
  }
  for (const problem of problems) console.log(`REFUSED ${problem}`);
  console.log(`${records} record(s), ${refs} ref(s), ${evidence} evidence file(s): ${problems.length ? `${problems.length} refused` : 'every id matches its place, every ref resolves, and every new-concept rule is satisfied'}`);
  process.exitCode = problems.length ? 1 : 0;
}
