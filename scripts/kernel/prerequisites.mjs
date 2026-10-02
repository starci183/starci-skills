// prerequisites.mjs — the machine-checkable half of an op's prerequisites,
// evaluated by `starci kernel dispatch` before anything is reserved or launched. Only
// data is read: a manifest read marked `mustExist` whose path the job's binding
// resolves, and - for a read marked `designDrawn` (interface.implement reads.draws) -
// that the ui record each bound implementation record proves has a settled interface.draw (the hard design gate:
// code is never built before its design). There is NO layout gate on interface.draw: a draw starts from a todo
// shell and unsettled ancestor layouts and draws them itself (scripts/kernel/shell-foundation.mjs decides which
// workflow draws the shared parents; the result is judged by scripts/work/ui/shell-conformance.mjs). Prose (route.prerequisites) is never
// parsed. Anything the data cannot decide — a placeholder the binding does not
// resolve, a layout tree that cannot be read — is unknown, and unknown is not unmet.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { loadUiRecords } from '../work/layout-tree.mjs';
import { drawingAcceptance } from '../work/direction-part.mjs';
import { isGlobSegment } from '../../engine/admission.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { ownerLanguage, translator } from '../lib/i18n.mjs';
import { DIRECTION_EXEMPT, archetypeOf, directionReadiness } from '../work/ui-archetype.mjs';

const WORK_ROOT = '.starciwork';
/** The refusal code of the design gate (unmet kind design-not-settled). */
export const DESIGN_NOT_SETTLED = 'DESIGN_NOT_SETTLED';
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

/**
 * Evaluate one job's data prerequisites against the target repository.
 * Returns {unmet:[...], unknown:[...]} — an empty `unmet` admits.
 */
export function checkPrerequisites({ brief, payload, repo }) {
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

  // The hard design gate (owner ruling 2026-09-29 "code truoc ve sau la hong"): a frontend implementation is never
  // dispatched before the interface.draw of the ui record it proves has settled pass.
  const designRead = (Array.isArray(brief?.reads) ? brief.reads : []).find((read) => read?.designDrawn === true);
  if (designRead) {
    for (const verdict of designVerdicts(repo, records)) {
      if (verdict.unsettled) unmet.push({ kind: 'design-not-settled', code: DESIGN_NOT_SETTLED, read: designRead.id, record: verdict.record, ui: verdict.ui, why: verdict.why });
    }
  }

  // An accepted brand.direction archetype before a surface is drawn under it (owner ruling 2026-09-27); the switch is
  // runtimes.yaml allocation.drawLoop.directionPrerequisite.
  const directionRead = (Array.isArray(brief?.reads) ? brief.reads : []).find((read) => read?.directionArchetype === true);
  if (directionRead && directionPrerequisiteOn()) {
    for (const verdict of directionVerdicts(repo, bindings, { workflowId: payload?.workflowId ?? payload?.workflow_id ?? null })) {
      if (verdict.unaccepted) unmet.push({ kind: 'direction-unaccepted', read: directionRead.id, record: verdict.record, archetype: verdict.archetype, derived: verdict.derived, status: verdict.status, why: verdict.why });
      else if (verdict.unknown) unknown.push({ kind: 'direction-unknown', read: directionRead.id, record: verdict.record, why: verdict.unknown });
    }
  }

  return { unmet, unknown };
}

/** The one-paragraph instruction a refused Kernel acts on. */
export function prerequisiteDetail({ op, jobId, unmet }) {
  const lines = unmet.map((item) => (item.kind === 'record-missing'
    ? `${op} reads ${item.path} (reads.${item.read}, mustExist) and it does not exist`
    : item.kind === 'design-not-settled'
      ? `${DESIGN_NOT_SETTLED}: implementation record ${item.record} proves ui record ${item.ui}, whose interface.draw has not settled pass - ${item.why} (reads.${item.read}, designDrawn). Code is never built before its design: enqueue interface.draw for ${item.ui} and dispatch this job --after it. ${translator(ownerLanguage())('Vietnamese: the drawing (interface.draw) of {ui} is not settled yet, so code must not be written; dispatch implement only once it is drawn and accepted', { ui: item.ui })}`
      : item.kind === 'direction-unaccepted'
        ? `bound ui record ${item.record} is a ${item.archetype} surface${item.derived ? ' (derived; set ui.archetype to override)' : ''} and its brand.direction archetype is not accepted by the owner - ${item.why ?? `status ${item.status ?? 'absent'}`} (reads.${item.read}, directionArchetype); enqueue brand.decide --param directionArchetype=${item.archetype} (direction mode; it asks the owner, BRAND_DIRECTION_UNACCEPTED until answered) and dispatch this job --after it`
      : `${op} has an unmet prerequisite (${item.kind})`));
  return `${lines.join('; ')}. Produce the missing record or finish the dependency through the op that owns it, then run starci kernel dispatch --job ${jobId} again; if the job binds the wrong record, enqueue a corrected job and settle this one --verdict blocked. The job stays queued and nothing was reserved or launched.`;
}

/**
 * For every bound frontend implementation record (.../.starciwork/features/<f>/impl/<repo>/<name>) whose `proves` names
 * ui records (ui.<feature>.<name>): whether each ui record exists and its interface.draw settled pass (state done and
 * the owner-accepted drawing still current, direction-part.mjs drawingAcceptance; a record rendered by recipe is done
 * with nothing to draw). A record that proves no ui record, or is not written yet, is unknown - not unmet. [{record, ui, unsettled, why}]
 */
export function designVerdicts(repo, records) {
  const verdicts = [];
  for (const binding of records) {
    const parts = segments(plainPath(binding));
    const at = parts.indexOf(WORK_ROOT);
    if (at < 0 || !parts.slice(at + 1).includes('impl')) continue;
    const file = path.join(repo, ...parts, 'index.yaml');
    if (!fs.existsSync(file)) continue;
    let impl = null;
    try { impl = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    const uiIds = [...new Set([...(Array.isArray(impl?.proves) ? impl.proves : []), ...(Array.isArray(impl?.dependsOn) ? impl.dependsOn : [])]
      .filter((id) => typeof id === 'string' && /^ui\./.test(id)))];
    if (!uiIds.length) continue;
    const uiRecords = loadUiRecords(path.join(repo, ...parts.slice(0, at + 1)));
    for (const ui of uiIds) {
      const entry = uiRecords.get(ui);
      if (!entry) { verdicts.push({ record: parts.join('/'), ui, unsettled: true, why: 'the ui record does not exist - nothing was drawn' }); continue; }
      const acceptance = drawingAcceptance(entry.record, path.dirname(entry.file));
      if (!acceptance.accepted) verdicts.push({ record: parts.join('/'), ui, unsettled: true, why: `its state is ${acceptance.reason}` });
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
export function directionVerdicts(repo, bindings, { workflowId = null } = {}) {
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
    const readiness = directionReadiness(path.join(repo, ...parts.slice(0, at + 1)), archetype, { workflowId });
    verdicts.push({ record, archetype, derived, status: readiness.status, why: readiness.why, ...(readiness.provisional ? { provisional: true } : {}), ...(readiness.ready ? {} : { unaccepted: true }) });
  }
  return verdicts;
}
