// prerequisites.mjs — the machine-checkable half of an op's prerequisites,
// evaluated by `api dispatch` before anything is reserved or launched. Only
// data is read: a manifest read marked `mustExist` whose path the job's binding
// resolves, and the `dependsOn` of the job's bound Work records when the op's
// graphPolicy.prerequisiteState is `done`, and - for a read marked `layoutChain`
// (interface.draw reads.shell) - that every layout above a bound ui record's
// `route` in the layout tree (.starciwork/shell/index.yaml) is settled, so a
// page or overlay is never drawn before the layouts it sits inside. Prose (route.prerequisites) is never
// parsed. Anything the data cannot decide — a placeholder the binding does not
// resolve, a record outside a Work tree, a tree the Work traversal reads as
// invalid — is unknown, and unknown is not unmet.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { validateWorkspace } from '../../engine/index.mjs';
import { isLayoutTree, layoutChainOf, layoutSettlement, loadUiRecords, nodeById, readShellRecord } from '../work/layout-tree.mjs';
import { isGlobSegment } from '../../engine/admission.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { DIRECTION_EXEMPT, archetypeOf, directionReadiness } from '../work/ui-archetype.mjs';

const WORK_ROOT = '.starciwork';
const PLACEHOLDER = /^<[^<>/]+>$/;
// A real glob segment. A Next.js App Router name ([lang], [...slug], [[...opt]]) is a literal
// directory (engine/admission.mjs isGlobSegment), so an owned src/app/[lang] binds a placeholder.
const GLOB = { test: isGlobSegment };

const plainPath = (value) => String(typeof value === 'string' ? value : value?.path ?? '')
  .trim().replace(/\\/g, '/').replace(/\/\*\*$/, '').replace(/\/+$/, '').replace(/^\.\//, '');
const segments = (value) => value.split('/').filter((part) => part && part !== '.');

/**
 * Where a manifest read path lands for this job. The path's placeholders must
 * all sit in a prefix that one bound record or owned path spells out in full;
 * the rest of the path is appended to it. Returns [] when nothing resolves.
 */
export function resolveReadPath(pattern, bindings) {
  const parts = segments(plainPath(pattern));
  const last = parts.map((part) => PLACEHOLDER.test(part)).lastIndexOf(true);
  if (parts.some((part) => !PLACEHOLDER.test(part) && (GLOB.test(part) || /[<>]/.test(part)))) return [];
  // A fixed path (no placeholder, no glob) is one file every job of the op needs - the product's one
  // shell record, say (interface.draw reads.shell) - and resolves to itself whatever the binding.
  if (last < 0) return parts.length && !/\s/.test(parts.join('/')) ? [parts.join('/')] : [];
  const prefix = parts.slice(0, last + 1), suffix = parts.slice(last + 1);
  const resolved = new Set();
  for (const binding of bindings) {
    const candidate = segments(plainPath(binding));
    if (candidate.length !== prefix.length) continue;
    const fits = prefix.every((part, i) => (PLACEHOLDER.test(part)
      ? !GLOB.test(candidate[i]) && !/[<>]/.test(candidate[i])
      : part === candidate[i]));
    if (fits) resolved.add([...candidate, ...suffix].join('/'));
  }
  return [...resolved];
}

/** The index.yaml files a record's effective dependsOn is drawn from: its own and every ancestor's up to the Work root. */
const declaredDependsOn = (workRoot, recordDir) => {
  const declared = [];
  for (let dir = recordDir; ; dir = path.dirname(dir)) {
    const file = path.join(dir, 'index.yaml');
    if (fs.existsSync(file)) {
      try {
        const deps = parseYaml(fs.readFileSync(file, 'utf8'))?.dependsOn;
        if (Array.isArray(deps)) declared.push(...deps.filter((dep) => typeof dep === 'string' && dep));
      } catch { /* an unreadable record declares nothing this check can read */ }
    }
    if (path.resolve(dir) === path.resolve(workRoot) || path.dirname(dir) === dir) break;
  }
  return declared;
};

/**
 * Evaluate one job's data prerequisites against the target repository.
 * Returns {unmet:[...], unknown:[...]} — an empty `unmet` admits.
 */
export function checkPrerequisites({ brief, payload, repo, validate = validateWorkspace }) {
  const unmet = [], unknown = [];
  const records = (Array.isArray(payload?.records) ? payload.records : []).map(plainPath).filter(Boolean);
  const bindings = [...(Array.isArray(payload?.owned_paths) ? payload.owned_paths : []), ...records];

  for (const read of Array.isArray(brief?.reads) ? brief.reads : []) {
    if (read?.mustExist !== true) continue;
    const resolved = resolveReadPath(read.path, bindings);
    if (!resolved.length) { unknown.push({ kind: 'read-unbound', read: read.id, path: read.path }); continue; }
    for (const rel of resolved) {
      if (!fs.existsSync(path.join(repo, rel))) unmet.push({ kind: 'record-missing', read: read.id, path: rel });
    }
  }

  const chainRead = (Array.isArray(brief?.reads) ? brief.reads : []).find((read) => read?.layoutChain === true);
  if (chainRead) {
    for (const verdict of layoutChainVerdicts(repo, bindings)) {
      if (verdict.unsettled?.length) unmet.push({ kind: 'layout-unsettled', read: chainRead.id, record: verdict.record, route: verdict.route, layouts: verdict.unsettled });
      else if (verdict.unknown) unknown.push({ kind: 'layout-chain-unknown', read: chainRead.id, record: verdict.record, why: verdict.unknown });
    }
  }

  // An accepted brand.direction archetype before a surface is drawn under it (owner ruling 2026-09-27); the switch is
  // runtimes.yaml allocation.drawLoop.directionPrerequisite.
  const directionRead = (Array.isArray(brief?.reads) ? brief.reads : []).find((read) => read?.directionArchetype === true);
  if (directionRead && directionPrerequisiteOn()) {
    for (const verdict of directionVerdicts(repo, bindings)) {
      if (verdict.unaccepted) unmet.push({ kind: 'direction-unaccepted', read: directionRead.id, record: verdict.record, archetype: verdict.archetype, derived: verdict.derived, status: verdict.status, why: verdict.why });
      else if (verdict.unknown) unknown.push({ kind: 'direction-unknown', read: directionRead.id, record: verdict.record, why: verdict.unknown });
    }
  }

  if (brief?.graphPolicy?.prerequisiteState === 'done') {
    const trees = new Map();
    for (const record of records) {
      const parts = segments(record);
      const at = parts.indexOf(WORK_ROOT);
      if (at < 0 || at === parts.length - 1) { if (at < 0) unknown.push({ kind: 'record-outside-work', record }); continue; }
      const workRoot = path.join(repo, ...parts.slice(0, at + 1));
      const nodePath = `${parts.slice(at + 1).join('/')}/index.yaml`;
      if (!declaredDependsOn(workRoot, path.join(repo, ...parts)).length) continue;
      if (!trees.has(workRoot)) trees.set(workRoot, validate(workRoot));
      const nodes = trees.get(workRoot)?.nodes ?? [];
      const node = nodes.find((n) => n.path === nodePath);
      if (!node) { unknown.push({ kind: 'record-not-a-node', record }); continue; }
      const states = new Map(nodes.map((n) => [n.id, n.effectiveState]));
      const notDone = (node.dependsOn ?? []).map((id) => ({ id, state: states.get(id) ?? 'missing' }))
        .filter(({ state }) => state !== 'done');
      const decidable = notDone.filter(({ state }) => state !== 'invalid' && state !== 'missing');
      if (decidable.length) unmet.push({ kind: 'dependency-not-done', record, dependsOn: decidable });
      if (decidable.length < notDone.length) unknown.push({ kind: 'dependency-state-unknown', record, dependsOn: notDone.filter((d) => !decidable.includes(d)) });
    }
  }
  return { unmet, unknown };
}

/** The one-paragraph instruction a refused Kernel acts on. */
export function prerequisiteDetail({ op, jobId, unmet }) {
  const lines = unmet.map((item) => (item.kind === 'record-missing'
    ? `${op} reads ${item.path} (reads.${item.read}, mustExist) and it does not exist`
    : item.kind === 'layout-unsettled'
      ? `bound ui record ${item.record} sits at ${item.route} under layout(s) not yet settled - ${item.layouts.map((l) => `${l.node}: ${l.reasons.join('; ')}`).join(' | ')} (reads.${item.read}, layoutChain); brand.decide captures a repository layout, and a planned one is drawn by its surface-layout ui record, first`
      : item.kind === 'direction-unaccepted'
        ? `bound ui record ${item.record} is a ${item.archetype} surface${item.derived ? ' (derived; set ui.archetype to override)' : ''} and its brand.direction archetype is not accepted by the owner - ${item.why ?? `status ${item.status ?? 'absent'}`} (reads.${item.read}, directionArchetype); enqueue brand.decide --param directionArchetype=${item.archetype} (direction mode; it asks the owner, BRAND_DIRECTION_UNACCEPTED until answered) and dispatch this job --after it`
      : `bound record ${item.record} depends on ${item.dependsOn.map((d) => `${d.id} (${d.state})`).join(', ')}, not done, and ${op} graphPolicy.prerequisiteState is done`));
  return `${lines.join('; ')}. Produce the missing record or finish the dependency through the op that owns it, then run api dispatch --job ${jobId} again; if the job binds the wrong record, enqueue a corrected job and settle this one --verdict blocked. The job stays queued and nothing was reserved or launched.`;
}

/**
 * For every bound path that is a ui record (.../.starciwork/features/<f>/ui/<name>) carrying a `route`, the
 * layout nodes above that route that are not settled. A record that does not exist yet, declares no route, or
 * names a route the tree does not hold and no existing routeParent is unknown - the draw proof holds those.
 */
export function layoutChainVerdicts(repo, bindings) {
  const verdicts = [];
  const seen = new Set();
  for (const binding of bindings) {
    const parts = segments(plainPath(binding));
    const at = parts.indexOf(WORK_ROOT);
    if (at < 0 || !parts.slice(at + 1).includes('ui')) continue;
    const record = parts.join('/');
    if (seen.has(record)) continue;
    seen.add(record);
    try {
      const workRoot = path.join(repo, ...parts.slice(0, at + 1));
      const file = path.join(repo, ...parts, 'index.yaml');
      if (!fs.existsSync(file)) { verdicts.push({ record, unknown: 'the ui record does not exist yet' }); continue; }
      const ui = parseYaml(fs.readFileSync(file, 'utf8'));
      if (typeof ui?.route !== 'string') { verdicts.push({ record, unknown: 'the ui record declares no route' }); continue; }
      const shell = readShellRecord(workRoot);
      if (!shell || shell.error) { verdicts.push({ record, unknown: 'no readable shell record' }); continue; }
      if (!isLayoutTree(shell.record)) { verdicts.push({ record, route: ui.route, unsettled: [{ node: '(shell)', reasons: [`the shell record is ${shell.record.schema ?? 'unknown'}, not work/layout-tree@1 - node scripts/work/layout-tree.mjs convert --work <.starciwork> --write`] }] }); continue; }
      const anchor = nodeById(shell.record, ui.route) ? ui.route : (typeof ui.routeParent === 'string' && nodeById(shell.record, ui.routeParent) ? ui.routeParent : null);
      if (!anchor) { verdicts.push({ record, unknown: `route ${ui.route} is not in the layout tree and names no existing routeParent` }); continue; }
      const drawingOwn = ui.surface === 'layout' && anchor === ui.route;
      const records = loadUiRecords(workRoot);
      const unsettled = (layoutChainOf(shell.record, anchor, { self: !drawingOwn }) ?? [])
        .map((node) => ({ node: node.id, ...layoutSettlement(shell.record, node, { shellDir: shell.dir, uiLoader: (id) => records.get(id) ?? null }) }))
        .filter((s) => !s.settled).map(({ node, reasons }) => ({ node, reasons }));
      verdicts.push({ record, route: ui.route, unsettled });
    } catch (error) {
      verdicts.push({ record, unknown: `layout chain unreadable (${String(error?.message ?? error)})` });
    }
  }
  return verdicts;
}

/** modules/models/runtimes.yaml allocation.drawLoop.directionPrerequisite: the direction gate is on. */
export function directionPrerequisiteOn() {
  try { return allocationSettings().drawLoop?.directionPrerequisite === true; } catch { return false; }
}

/**
 * For every bound ui record (.../.starciwork/features/<f>/ui/<name>): its archetype and whether the product's
 * brand.direction is ready for it - brand.mjs checkDirection evidence.ready, the owner's receipt for the current rev,
 * never `status: accepted` alone. [{record, archetype, derived, status, why, unaccepted?, unknown?}]; a layout record
 * owes no direction; a record not written yet is unknown.
 */
export function directionVerdicts(repo, bindings) {
  const verdicts = [];
  const seen = new Set();
  for (const binding of bindings) {
    const parts = segments(plainPath(binding));
    const at = parts.indexOf(WORK_ROOT);
    if (at < 0 || !parts.slice(at + 1).includes('ui')) continue;
    const record = parts.join('/');
    if (seen.has(record)) continue;
    seen.add(record);
    const file = path.join(repo, ...parts, 'index.yaml');
    if (!fs.existsSync(file)) { verdicts.push({ record, unknown: 'the ui record does not exist yet' }); continue; }
    let ui = null;
    try { ui = parseYaml(fs.readFileSync(file, 'utf8')); } catch { verdicts.push({ record, unknown: 'the ui record does not parse' }); continue; }
    const { archetype, derived } = archetypeOf(ui);
    if (DIRECTION_EXEMPT.includes(archetype)) continue;
    const readiness = directionReadiness(path.join(repo, ...parts.slice(0, at + 1)), archetype);
    verdicts.push({ record, archetype, derived, status: readiness.status, why: readiness.why, ...(readiness.ready ? {} : { unaccepted: true }) });
  }
  return verdicts;
}
