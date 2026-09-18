import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseYaml, stringifyYaml} from '../core/yaml.mjs';
import {walk} from './check-example-work.mjs';
import {computeDerived} from './example-derive.mjs';

/**
 * `.starciwork` can already answer "what is done, what is stale, what is blocked" (example-derive.mjs).
 * It cannot yet answer the questions a lead actually opens the tree for before approving a change: how far
 * does breaking this rule reach, which components would a refactor of this module have to renegotiate,
 * which blocked work is genuinely undecided versus genuinely unbuilt, and which "done" is a claim with
 * nothing behind it. This module computes those nine questions, mechanically, from the tree plus the
 * derivation - nothing here is authored, same discipline as example-derive.mjs, enforced by the same kind
 * of freshness gate (scripts/check-example-derived.mjs, extended below).
 *
 * It reuses example-derive.mjs's `computeDerived` (usedBy, effectiveState, blockers, tally) rather than
 * recomputing any of it, and check-example-work.mjs's `walk` for the tree read. It does not reuse
 * example-derive.mjs's internal `readTree`, because that function is not exported and this module needs
 * fields (`data`, `dir`) that computeDerived's public per-record shape does not carry - the record's own
 * authored bytes (owners, module, surface, proves, tension, staleSince...) are exactly what most sections
 * below inspect, and the derivation intentionally does not echo them back.
 */

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Every edge kind example-derive.mjs's `usedBy` classifies that a breaking business-rule change actually
 * propagates through. Deliberately excludes `blockedBy`/`conflictsWith`/`tension` (impediments, not
 * semantic dependency) and `subscribes`/`extends` (event/data families, not this lane's concern). */
const BLAST_KINDS = ['refs', 'composes', 'appliesTo', 'dependsOn', 'contractProvider', 'contractConsumer', 'provenBy'];

/** A literal, narrow match for a gap that says its subject plainly does not exist yet - the "leftover" half
 * of concept 8. Kept narrow on purpose: a loose "no ... exists" scan over free prose matched "the only task
 * code that **exists**" (an affirmative sentence) as if it were a negation. The tree's own `*.unbuilt-module`
 * naming convention (already the basis of example-derive.mjs's `unbuiltModuleGaps` tally) is the reliable
 * signal in practice; the text match below only adds gaps that literally spell out the word this concept is
 * named for, for a tree that writes it plainly instead of by convention. */
const LEFTOVER_GAP_TEXT_RE = /\bunbuilt\b|\bnot built\b/i;

/**
 * Reads every record and evidence file under `workRoot`, same filtering rules as example-derive.mjs's own
 * (private) `readTree`: `_derived/**` is never walked, non-object YAML is skipped, an evidence.yaml is kept
 * separate from records. Returns the raw `data` and `dir` per record/evidence that this module's checks need
 * and that `computeDerived`'s public shape does not expose.
 */
function readRawTree(workRoot) {
  const records = new Map(); // id -> {id, schema, state, feature, dir, file, data}
  const evidenceByDir = new Map(); // dir (posix, relative to workRoot) -> {data, file, dir}
  const derivedPrefix = '_derived/';
  for (const file of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
    const relPath = path.relative(workRoot, file).replaceAll('\\', '/');
    if (relPath === '_derived' || relPath.startsWith(derivedPrefix)) continue;
    let data;
    try { data = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (!isPlainObject(data)) continue;
    const dir = path.dirname(relPath).replaceAll('\\', '/');
    if (relPath.endsWith('/evidence.yaml') || relPath === 'evidence.yaml') {
      evidenceByDir.set(dir, {data, file, dir});
      continue;
    }
    if (typeof data.id !== 'string' || !data.id) continue;
    const segments = relPath.split('/');
    const feature = segments[0] === 'features' && segments.length > 1 ? segments[1] : null;
    records.set(data.id, {id: data.id, schema: data.schema ?? null, state: Object.hasOwn(data, 'state') ? data.state : null, feature, dir, file, data});
  }
  return {records, evidenceByDir};
}

/**
 * The workspace's declared repositories, resolved to a directory on disk. `role: be` always resolves to the
 * repository that owns `workRoot` (the layout's "one project owns one canonical .starciwork in its bound
 * source repository" rule) regardless of its declared name; every other role resolves by looking for a
 * sibling directory next to it named after the repository. A name that resolves to nothing is left absent
 * from the map rather than guessed at - callers report that as an unresolved repository, not a false path.
 */
function resolveRepositories(workRoot) {
  const backendDir = path.dirname(workRoot);
  const examplesRoot = path.dirname(backendDir);
  let workspace = null;
  try { workspace = parseYaml(fs.readFileSync(path.join(workRoot, 'workspace.yaml'), 'utf8')); } catch { workspace = null; }
  const repositories = Array.isArray(workspace?.repositories) ? workspace.repositories : [];
  const dirByName = new Map();
  for (const repo of repositories) {
    if (!isPlainObject(repo) || typeof repo.name !== 'string' || !repo.name) continue;
    if (repo.role === 'be') { dirByName.set(repo.name, backendDir); continue; }
    const candidate = path.join(examplesRoot, repo.name);
    if (fs.existsSync(candidate)) dirByName.set(repo.name, candidate);
  }
  return {dirByName, backendDir};
}

/**
 * Whether `ownerOrModulePath`, authored on `record`, resolves to something real on disk. `work/implementation`
 * names its own `repository`; `work/business-rule` names none (the layout gives it `module` but no sibling
 * `repository` field), so a rule's module is resolved against the backend repository that owns this
 * `.starciwork` tree by default - the same default the layout gives current code in general. Either way, an
 * unresolved *repository name* (declared but not found on disk) is reported distinctly from a resolved
 * repository whose path is simply missing, because the two are different failures.
 */
function resolveAnchor(repos, record, relPath) {
  const repoName = typeof record.data.repository === 'string' ? record.data.repository : null;
  const repoDir = repoName ? repos.dirByName.get(repoName) : repos.backendDir;
  if (!repoDir) return {exists: false, note: `repository "${repoName}" does not resolve to a directory on disk`};
  const abs = path.join(repoDir, relPath);
  return {exists: fs.existsSync(abs), note: null, abs};
}

/** `record.data.module`, normalized to a non-empty list of path strings; work/business-rule's own field may
 * be a bare string or a list (schemas/work-layout.yaml, concept 9). */
function modulePaths(record) {
  const m = record.data.module;
  if (typeof m === 'string' && m) return [m];
  if (Array.isArray(m)) return m.filter(x => typeof x === 'string' && x);
  return [];
}

/** `record.data.owners`, the `{role, path}` list work/implementation authors (concept 9); malformed entries
 * (missing `path`) are skipped rather than crashing a tree that already passed check-example-work.mjs. */
function ownerPaths(record) {
  const owners = Array.isArray(record.data.owners) ? record.data.owners : [];
  return owners.filter(o => isPlainObject(o) && typeof o.path === 'string' && o.path).map(o => o.path);
}

// ---------------------------------------------------------------------------------------------------------
// Section 1: blast radius per business rule
// ---------------------------------------------------------------------------------------------------------

/** Reverse edges for `proves` (work/implementation -> business-rule/sds-component/...). Not part of
 * example-derive.mjs's `usedBy` map: `proves` is not one of the layout's declared edge *kinds* there, so the
 * derivation files it under `unclassifiedEdges` rather than inventing a kind meaning it did not ask for.
 * Blast radius needs the reverse of it anyway (an implementation proving a rule is exactly the kind of thing
 * a breaking change to that rule sends back to todo), so it is built directly from the raw records here.
 */
function buildProvesUsedBy(rawRecords) {
  const provesUsedBy = new Map(); // targetId -> Set(sourceId)
  for (const rec of rawRecords.values()) {
    const targets = Array.isArray(rec.data.proves) ? rec.data.proves : [];
    for (const t of targets) {
      if (typeof t !== 'string') continue;
      if (!provesUsedBy.has(t)) provesUsedBy.set(t, new Set());
      provesUsedBy.get(t).add(rec.id);
    }
  }
  return provesUsedBy;
}

function blastRadiusOf(ruleId, derivedRecords, provesUsedBy) {
  const visited = new Set([ruleId]);
  const queue = [ruleId];
  while (queue.length) {
    const cur = queue.shift();
    const usedBy = derivedRecords.get(cur)?.usedBy ?? {};
    const neighbors = new Set();
    for (const kind of BLAST_KINDS) for (const src of (usedBy[kind] ?? [])) neighbors.add(src);
    for (const src of (provesUsedBy.get(cur) ?? [])) neighbors.add(src);
    for (const n of neighbors) if (!visited.has(n)) { visited.add(n); queue.push(n); }
  }
  visited.delete(ruleId);
  return visited;
}

function computeBlastRadiusFindings(derived, rawRecords, evidenceByDir) {
  const provesUsedBy = buildProvesUsedBy(rawRecords);
  const findings = [];
  const rules = [...derived.records.values()].filter(r => r.schema === 'work/business-rule').sort((a, b) => a.id.localeCompare(b.id));
  for (const rule of rules) {
    const affected = [...blastRadiusOf(rule.id, derived.records, provesUsedBy)].sort();
    const staledEvidence = affected.filter(id => evidenceByDir.has(rawRecords.get(id)?.dir)).length;
    const paths = new Set();
    for (const id of [rule.id, ...affected]) {
      const raw = rawRecords.get(id);
      if (!raw) continue;
      for (const p of modulePaths(raw)) paths.add(p);
      for (const p of ownerPaths(raw)) paths.add(p);
    }
    findings.push({
      id: `blast-radius:${rule.id}`,
      kind: 'blast-radius',
      severity: affected.length >= 10 ? 'critical' : affected.length >= 3 ? 'warn' : 'info',
      records: [rule.id, ...affected],
      because: `A breaking change to ${rule.id} sends ${affected.length} other record(s) back to todo, would stale ${staledEvidence} evidence file(s), and touches ${paths.size} code path(s) (${[...paths].sort().join(', ') || '(none owned yet)'}) - this is the number a reviewer wants before approving the change.`,
      radius: affected.length,
    });
  }
  findings.sort((a, b) => b.radius - a.radius || a.id.localeCompare(b.id));
  return findings.map(({radius, ...f}) => f);
}

// ---------------------------------------------------------------------------------------------------------
// Section 2: fan-in hotspots
// ---------------------------------------------------------------------------------------------------------

const fanInTotal = rec => Object.values(rec.usedBy ?? {}).reduce((sum, ids) => sum + ids.length, 0);

function computeFanInFindings(derived) {
  const withFanIn = [...derived.records.values()]
    .map(r => ({id: r.id, feature: r.feature, total: fanInTotal(r)}))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
  if (!withFanIn.length) return [];
  const decileCount = Math.max(1, Math.ceil(withFanIn.length / 10));
  const threshold = withFanIn[decileCount - 1].total;
  const hotspots = withFanIn.filter(r => r.total >= threshold);
  return hotspots.map(h => {
    const rec = derived.records.get(h.id);
    const sourceFeatures = new Set();
    for (const ids of Object.values(rec.usedBy ?? {})) for (const srcId of ids) {
      const srcFeature = derived.records.get(srcId)?.feature;
      if (srcFeature && srcFeature !== h.feature) sourceFeatures.add(srcFeature);
    }
    return {
      id: `fan-in-hotspot:${h.id}`,
      kind: 'fan-in-hotspot',
      severity: sourceFeatures.size >= 3 ? 'warn' : 'info',
      records: [h.id],
      because: `${h.id} is used ${h.total} time(s) (top decile of fan-in); it is owned by ${h.feature ?? '(no feature)'} and read by ${sourceFeatures.size} other feature(s) (${[...sourceFeatures].sort().join(', ') || 'none - fan-in is entirely within its own feature'}), so a change here is cross-feature coupling, not a local edit.`,
    };
  });
}

// ---------------------------------------------------------------------------------------------------------
// Section 3: blocker cycles
// ---------------------------------------------------------------------------------------------------------

/** Tarjan's algorithm, iterative in spirit but written recursively (these graphs are small); node and edge
 * order are both sorted first, so two runs over the same tree produce byte-identical SCCs and the same
 * chosen ring. Only edges between two nodes in `candidateIds` are considered - the cycle detector should not
 * wander into the whole tree's blockedBy graph, only the part example-derive.mjs already flagged `cyclic`. */
function stronglyConnectedComponents(candidateIds, edgesOf) {
  const ids = [...candidateIds].sort();
  const index = new Map(), lowlink = new Map(), onStack = new Set(), stack = [];
  const sccs = [];
  let counter = 0;
  function strongconnect(v) {
    index.set(v, counter); lowlink.set(v, counter); counter += 1;
    stack.push(v); onStack.add(v);
    for (const w of [...edgesOf(v)].filter(x => candidateIds.has(x)).sort()) {
      if (!index.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v), index.get(w)));
      }
    }
    if (lowlink.get(v) === index.get(v)) {
      const component = [];
      let w;
      do { w = stack.pop(); onStack.delete(w); component.push(w); } while (w !== v);
      sccs.push(component.sort());
    }
  }
  for (const v of ids) if (!index.has(v)) strongconnect(v);
  return sccs;
}

/** One concrete simple cycle through `scc`, starting at its lexicographically smallest member and
 * preferring the smallest available neighbor at each step (deterministic). Tries a full-coverage
 * (Hamiltonian) cycle first - a ring that visits every member is the more informative report of "what is
 * actually stuck together" than the shortest possible loop through just two of them - and falls back to the
 * shortest cycle it can find if no full-coverage ring exists. `scc` is strongly connected, so at least the
 * fallback is guaranteed to succeed. */
function findRingIn(scc, edgesOf) {
  if (scc.length === 1) return [scc[0], scc[0]]; // self-loop
  const members = new Set(scc);
  const start = [...scc].sort()[0];
  const neighborsOf = node => [...edgesOf(node)].filter(n => members.has(n)).sort();

  function fullCoverageRing() {
    const path = [start];
    const visited = new Set([start]);
    function dfs(node) {
      if (path.length === scc.length) return neighborsOf(node).includes(start);
      for (const n of neighborsOf(node)) {
        if (visited.has(n)) continue;
        path.push(n); visited.add(n);
        if (dfs(n)) return true;
        path.pop(); visited.delete(n);
      }
      return false;
    }
    return dfs(start) ? [...path, start] : null;
  }

  function shortestRing() {
    const path = [start];
    const onPath = new Set([start]);
    function dfs(node) {
      const neighbors = neighborsOf(node);
      if (neighbors.includes(start) && path.length > 1) return true;
      for (const n of neighbors) {
        if (n === start || onPath.has(n)) continue;
        path.push(n); onPath.add(n);
        if (dfs(n)) return true;
        path.pop(); onPath.delete(n);
      }
      return false;
    }
    dfs(start);
    return [...path, start];
  }

  return fullCoverageRing() ?? shortestRing();
}

function computeBlockerCycleFindings(derived, rawRecords) {
  const candidateIds = new Set();
  for (const rec of derived.records.values()) {
    if (rec.blockers.some(b => b.cyclic)) {
      candidateIds.add(rec.id);
      for (const b of rec.blockers) if (b.cyclic) candidateIds.add(b.id);
    }
  }
  const edgesOf = id => {
    const raw = rawRecords.get(id);
    const edges = Array.isArray(raw?.data.blockedBy) ? raw.data.blockedBy : [];
    return edges.filter(e => isPlainObject(e) && typeof e.record === 'string').map(e => e.record);
  };
  const sccs = stronglyConnectedComponents(candidateIds, edgesOf).filter(c => c.length > 1);
  const findings = [];
  for (const scc of sccs.sort((a, b) => a[0].localeCompare(b[0]))) {
    const ring = findRingIn(scc, edgesOf);
    const because = [];
    for (let i = 0; i < ring.length - 1; i += 1) {
      const from = ring[i], to = ring[i + 1];
      const raw = rawRecords.get(from);
      const edge = (Array.isArray(raw?.data.blockedBy) ? raw.data.blockedBy : []).find(e => isPlainObject(e) && e.record === to);
      because.push(`${from} is blockedBy ${to}${edge?.because ? ` ("${edge.because.slice(0, 90)}${edge.because.length > 90 ? '...' : ''}")` : ''}`);
    }
    const features = new Set(scc.map(id => derived.records.get(id)?.feature).filter(Boolean));
    const candidateAnchors = [...rawRecords.values()]
      .filter(r => features.has(r.feature) && !scc.includes(r.id))
      .filter(r => r.schema === 'work/gap' || (r.schema === 'work/policy-decision' && r.data.outcome === 'open'))
      .map(r => r.id).sort();
    findings.push({
      id: `blocker-cycle:${scc[0]}`,
      kind: 'blocker-cycle',
      severity: 'critical',
      records: scc,
      because: `A blockedBy ring never reaches a gap or an open decision: ${ring.join(' → ')}. It never resolves on its own. ${candidateAnchors.length ? `Candidate anchors already in the tree for the same feature(s) that no ring member currently points at: ${candidateAnchors.join(', ')} - one of the ring's records should point outward at one of these instead of at another ring member.` : 'No gap or open decision exists yet for the same feature(s); one needs to be authored so a ring member can point outward instead of at another ring member.'} Edges: ${because.join('; ')}.`,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------------------------------------
// Section 4: done without a code anchor
// ---------------------------------------------------------------------------------------------------------

function computeDoneAnchorFindings(rawRecords, repos) {
  const findings = [];
  for (const rec of rawRecords.values()) {
    if (rec.state !== 'done') continue;
    const anchors = [...ownerPaths(rec).map(p => ({p, via: 'owners'})), ...modulePaths(rec).map(p => ({p, via: 'module'}))];
    if (!anchors.length) continue;
    const missing = [];
    for (const {p, via} of anchors) {
      const {exists, note} = resolveAnchor(repos, rec, p);
      if (!exists) missing.push(note ? `${p} (${via}; ${note})` : `${p} (${via})`);
    }
    if (missing.length) {
      findings.push({
        id: `done-without-anchor:${rec.id}`,
        kind: 'done-without-anchor',
        severity: 'critical',
        records: [rec.id],
        because: `${rec.id} is state: done but ${missing.length} of its ${anchors.length} anchor path(s) do not exist on disk: ${missing.join(', ')} - the record claims proof over code that is not there to have been proven.`,
      });
    }
    if (rec.schema === 'work/implementation' && Array.isArray(rec.data.proves)) {
      const notDone = rec.data.proves.filter(t => typeof t === 'string' && rawRecords.get(t)?.state !== 'done');
      if (notDone.length) {
        findings.push({
          id: `done-proves-not-done:${rec.id}`,
          kind: 'done-proves-not-done',
          severity: 'warn',
          records: [rec.id, ...notDone],
          because: `${rec.id} is state: done and proves ${notDone.join(', ')}, but that target is not itself done - an implementation cannot outrun the specification it claims to prove.`,
        });
      }
    }
  }
  return findings.sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------------------------------------
// Section 5: SDS not bound to a module
// ---------------------------------------------------------------------------------------------------------

function computeUnboundSdsFindings(rawRecords, repos) {
  const findings = [];
  for (const rec of rawRecords.values()) {
    if (rec.schema !== 'work/sds-component') continue;
    const owners = Array.isArray(rec.data.owners) ? rec.data.owners : null;
    if (!owners || !owners.length) {
      findings.push({
        id: `unbound-sds:${rec.id}`,
        kind: 'unbound-sds',
        severity: 'warn',
        records: [rec.id],
        because: `${rec.id} authors no owners entry, so it has no bound module and no read-scope boundary - anything could claim to implement it, and nothing narrows what a reviewer must open to check.`,
      });
      continue;
    }
    const unresolved = owners.filter(o => {
      if (!isPlainObject(o) || typeof o.path !== 'string' || !o.path) return true;
      const {exists, abs} = resolveAnchor(repos, rec, o.path);
      return !exists || !abs || !fs.existsSync(abs) || !fs.statSync(abs).isDirectory();
    });
    if (unresolved.length === owners.length) {
      findings.push({
        id: `unbound-sds:${rec.id}`,
        kind: 'unbound-sds',
        severity: 'warn',
        records: [rec.id],
        because: `${rec.id} authors owners, but none resolve to a real module directory - it is bound in name only.`,
      });
    }
  }
  return findings.sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------------------------------------
// Section 6: contracts without a typed surface
// ---------------------------------------------------------------------------------------------------------

function hasTypedSurface(data) {
  if (typeof data.sdl === 'string' && data.sdl.trim()) return true;
  if (Array.isArray(data.surface) && data.surface.length) {
    return data.surface.every(s => isPlainObject(s) && typeof s.name === 'string' && s.name && typeof s.shape === 'string' && s.shape.trim());
  }
  return false;
}

function computeUntypedContractFindings(rawRecords) {
  const findings = [];
  for (const rec of rawRecords.values()) {
    if (rec.schema !== 'work/contract') continue;
    if (!hasTypedSurface(rec.data)) {
      findings.push({
        id: `untyped-contract:${rec.id}`,
        kind: 'untyped-contract',
        severity: 'warn',
        records: [rec.id],
        because: `${rec.id}'s surface is prose only - no sdl and no {name, shape} field list - so it cannot be checked against the provider's or the consumer's actual code, only read.`,
      });
    }
  }
  return findings.sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------------------------------------
// Section 7: open decisions and what they hold
// ---------------------------------------------------------------------------------------------------------

function computeOpenDecisionFindings(derived, rawRecords) {
  const findings = [];
  for (const rec of rawRecords.values()) {
    if (rec.schema !== 'work/policy-decision' || rec.data.outcome !== 'open') continue;
    const blocks = Array.isArray(rec.data.blocks) ? rec.data.blocks : [];
    const blockedByCiters = derived.records.get(rec.id)?.usedBy?.blockedBy ?? [];
    const held = [...new Set([...blocks, ...blockedByCiters])].sort();
    findings.push({
      id: `open-decision:${rec.id}`,
      kind: 'open-decision',
      severity: 'info',
      records: [rec.id, ...held],
      because: held.length
        ? `${rec.id} is still open and holds ${held.length} record(s) (${held.join(', ')}) - none of them can move until this is decided.`
        : `${rec.id} is still open and, on the tree as it stands, holds nothing yet.`,
    });
  }
  return findings.sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------------------------------------
// Section 8: designed vs leftover todos
// ---------------------------------------------------------------------------------------------------------

function computeTodoDesignFindings(derived, rawRecords) {
  const findings = [];
  for (const rec of derived.records.values()) {
    if (rec.state !== 'todo') continue;
    const gapRoots = rec.blockers.filter(b => !b.cyclic && b.rootKind === 'gap');
    const decisionRoots = rec.blockers.filter(b => !b.cyclic && b.rootKind === 'decision');
    if (!gapRoots.length && !decisionRoots.length) continue;
    const leftoverGaps = gapRoots.filter(b => {
      const raw = rawRecords.get(b.id);
      return b.id.endsWith('.unbuilt-module') || LEFTOVER_GAP_TEXT_RE.test(raw?.data.statement ?? '');
    });
    const designedGaps = gapRoots.filter(b => !leftoverGaps.includes(b));
    if (designedGaps.length || decisionRoots.length) {
      const roots = [...designedGaps, ...decisionRoots].map(b => b.id).sort();
      findings.push({
        id: `designed-todo:${rec.id}`,
        kind: 'designed-todo',
        severity: 'info',
        records: [rec.id, ...roots],
        because: `${rec.id} is todo, blocked on ${roots.join(', ')} - a real product question, not missing code; it moves once that is settled.`,
      });
    } else if (leftoverGaps.length) {
      const roots = leftoverGaps.map(b => b.id).sort();
      findings.push({
        id: `leftover-todo:${rec.id}`,
        kind: 'leftover-todo',
        severity: 'info',
        records: [rec.id, ...roots],
        because: `${rec.id} is todo, blocked on ${roots.join(', ')} - code that simply has not been written yet; the owner wants this count at zero.`,
      });
    }
  }
  return findings.sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------------------------------------
// Section 9: stale evidence by cause
// ---------------------------------------------------------------------------------------------------------

function computeStaleEvidenceFindings(evidenceByDir) {
  const findings = [];
  for (const {data, dir} of evidenceByDir.values()) {
    if (data.stale !== true) continue;
    const recordId = typeof data.record === 'string' ? data.record : dir;
    const staleSince = isPlainObject(data.staleSince) && typeof data.staleSince.record === 'string' ? data.staleSince.record : null;
    const namesABreakingChange = staleSince !== null && staleSince !== recordId;
    if (namesABreakingChange) {
      findings.push({
        id: `stale-evidence-designed:${recordId}`,
        kind: 'stale-evidence-designed',
        severity: 'info',
        records: [recordId, staleSince],
        because: `${recordId}'s evidence carries staleSince naming ${staleSince} as the record whose change caused this - a tracked, designed staleness, not silent drift.`,
      });
    } else {
      findings.push({
        id: `stale-evidence-bulk-edit:${recordId}`,
        kind: 'stale-evidence-bulk-edit',
        severity: 'warn',
        records: [recordId],
        because: staleSince
          ? `${recordId}'s evidence is stale with staleSince naming only itself - a bare digest mismatch (the record's own bytes moved after capture), not a change in some other record it depends on.`
          : `${recordId}'s evidence is stale with no staleSince at all - a bare digest mismatch with nothing recorded about why, even where the record's own staleReason prose describes a real revision (bulk-edit-after-capture territory either way).`,
      });
    }
  }
  return findings.sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------------------------------------

const SECTIONS = [
  {kind: ['blast-radius'], title: 'Blast radius per rule'},
  {kind: ['fan-in-hotspot'], title: 'Fan-in hotspots'},
  {kind: ['blocker-cycle'], title: 'Blocker cycles'},
  {kind: ['done-without-anchor', 'done-proves-not-done'], title: 'Done without a code anchor'},
  {kind: ['unbound-sds'], title: 'SDS not bound to a module'},
  {kind: ['untyped-contract'], title: 'Contracts without a typed surface'},
  {kind: ['open-decision'], title: 'Open decisions and what they hold'},
  {kind: ['leftover-todo', 'designed-todo'], title: 'Designed vs leftover todos'},
  {kind: ['stale-evidence-bulk-edit', 'stale-evidence-designed'], title: 'Stale evidence by cause'},
];

/** The full critique over one `.starciwork` tree: a pure function of what is on disk right now, exactly like
 * example-derive.mjs's `computeDerived`, and built on top of it rather than re-walking the tree twice for the
 * same facts. */
export function computeCritique(workRoot) {
  const derived = computeDerived(workRoot);
  const {records: rawRecords, evidenceByDir} = readRawTree(workRoot);
  const repos = resolveRepositories(workRoot);

  const findings = [
    ...computeBlastRadiusFindings(derived, rawRecords, evidenceByDir),
    ...computeFanInFindings(derived),
    ...computeBlockerCycleFindings(derived, rawRecords),
    ...computeDoneAnchorFindings(rawRecords, repos),
    ...computeUnboundSdsFindings(rawRecords, repos),
    ...computeUntypedContractFindings(rawRecords),
    ...computeOpenDecisionFindings(derived, rawRecords),
    ...computeTodoDesignFindings(derived, rawRecords),
    ...computeStaleEvidenceFindings(evidenceByDir),
  ];
  return {findings};
}

export function buildCritiqueYamlDocument(critique) {
  return {
    schema: 'work/critique@1',
    findings: critique.findings.map(f => ({id: f.id, kind: f.kind, severity: f.severity, records: f.records, because: f.because})),
  };
}

export function buildCritiqueMarkdown(critique) {
  const lines = [
    '# Critique',
    '',
    'GENERATED by `node scripts/example-critique.mjs --write` - do not edit by hand.',
    '',
  ];
  for (const section of SECTIONS) {
    const items = critique.findings.filter(f => section.kind.includes(f.kind));
    lines.push(`## ${section.title}`, '', `${items.length} finding(s).`, '');
    if (!items.length) { lines.push('(none)', ''); continue; }
    for (const item of items) {
      lines.push(`- **${item.id}** [${item.severity}] (${item.records.join(', ')})`);
      lines.push(`  ${item.because}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

const CRITIQUE_MD_REL = '_derived/critique.md';
const CRITIQUE_YAML_REL = '_derived/critique.yaml';

/** Deterministic JSON, keys sorted at every level - reproduced locally exactly as example-derive.mjs's own
 * `canonicalJSON` is, for the same reason (comparing two structures without importing that module's whole
 * write path for one helper). */
function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (isPlainObject(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function runCritique(workRoot, {write} = {}) {
  const critique = computeCritique(workRoot);
  const yamlDoc = buildCritiqueYamlDocument(critique);
  const markdown = buildCritiqueMarkdown(critique);
  const yamlPath = path.join(workRoot, CRITIQUE_YAML_REL);
  const mdPath = path.join(workRoot, CRITIQUE_MD_REL);
  if (write) {
    fs.mkdirSync(path.dirname(yamlPath), {recursive: true});
    fs.writeFileSync(yamlPath, '# GENERATED by scripts/example-critique.mjs - do not edit by hand.\n' +
      '# Regenerate with: node scripts/example-critique.mjs --work <path-to-.starciwork> --write\n' + stringifyYaml(yamlDoc), 'utf8');
    fs.writeFileSync(mdPath, markdown, 'utf8');
    return {wrote: true, critique, yamlDoc, markdown};
  }
  let onDiskYaml = null;
  try { onDiskYaml = parseYaml(fs.readFileSync(yamlPath, 'utf8')); } catch { onDiskYaml = null; }
  let onDiskMd = null;
  try { onDiskMd = fs.readFileSync(mdPath, 'utf8'); } catch { onDiskMd = null; }
  const ok = onDiskYaml !== null && canonicalJSON(onDiskYaml) === canonicalJSON(yamlDoc) && onDiskMd === markdown;
  return {ok, critique, yamlDoc, markdown, onDiskYaml, onDiskMd};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const workFlagIndex = args.indexOf('--work');
  const workArg = workFlagIndex >= 0 ? args[workFlagIndex + 1] : null;
  const write = args.includes('--write');
  if (!workArg) {
    console.error('Usage: node scripts/example-critique.mjs --work <path-to-.starciwork> [--write]');
    process.exitCode = 2;
  } else {
    const workRoot = path.resolve(workArg);
    const result = runCritique(workRoot, {write});
    for (const section of SECTIONS) {
      const count = result.critique.findings.filter(f => section.kind.includes(f.kind)).length;
      console.log(`${section.title}: ${count}`);
    }
    if (write) {
      console.log(`wrote ${path.relative(workRoot, path.join(workRoot, CRITIQUE_YAML_REL))} and ${path.relative(workRoot, path.join(workRoot, CRITIQUE_MD_REL))}`);
    } else if (!result.ok) {
      console.log(`REFUSED: ${CRITIQUE_YAML_REL}/${CRITIQUE_MD_REL} missing or stale; run with --write to refresh them.`);
      process.exitCode = 1;
    }
  }
}
