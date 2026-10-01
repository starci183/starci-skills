// migrate-ui-shapes.mjs — rewrite a product's ui records onto shapes + per-slot data status.
//
//   node scripts/work/migrate-ui-shapes.mjs --repo <repo> [--dry-run|--apply] [--json]
//
// For every work/ui-screen@1 record under <repo>/.starciwork: each ui.states entry that is a data status
// (scripts/work/ui/ui-shapes.mjs dataStatusOf) moves to ui.dataStatus under its base and slot, and leaves
// ui.states and ui.coverage.map; every other state becomes a ui.shapes entry {base, state, viewports}. A
// direction or direction-content asset that draws a moved state gets `retired: data-status`; no file is
// deleted. A record that already declares ui.shapes keeps its other states as they are. A moved state that was drawn, or whose text reads like an onboarding or recovery screen, is listed
// as a nonDerivable candidate for a person to review. Idempotent: a migrated record plans no change. Dry run
// is the default; --apply writes each changed record whole.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringifyYaml } from '../../engine/yaml.mjs';
import { DATA_STATUSES, DRAWING_ROLES, RETIRED_DATA_STATUS, assetStateOf, dataStatusOf, drawingsOf } from './ui/ui-shapes.mjs';
import { REQUIRED_BREAKPOINTS } from './direction-part.mjs';
import { flag, indexFilesUnder, list, readYaml, slash, writeRecordFile } from './work-io.mjs';

const CANDIDATE_TEXT = /\b(?:onboard\w*|first[- ](?:run|time|use)|welcome|get(?:ting)? started|recover\w*|reconcil\w*|call to action|CTA)\b/i;
const USAGE = 'Usage: node scripts/work/migrate-ui-shapes.mjs --repo <repo> [--dry-run|--apply] [--json]\n';

const nameOf = (s) => (typeof s === 'string' ? s : s?.name ? String(s.name) : null);
const pascal = (slug) => String(slug).split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const baseOf = (surface) => { const p = pascal(surface) || 'Screen'; return `${/^[A-Z]/.test(p) ? p : `X${p}`}Base`; };
const uniq = (xs) => [...new Set(xs)];

/** The surface a state belongs to: the coverage-map screen showing it, else the surface its name starts with. */
function surfaceResolver(record) {
  const surfaces = list(record.ui?.surfaces).map(nameOf).filter(Boolean);
  const screenOf = new Map();
  for (const m of list(record.ui?.coverage?.map)) if (m?.state && m?.screen && !screenOf.has(m.state)) screenOf.set(String(m.state), String(m.screen));
  const byLength = [...surfaces].sort((a, b) => b.length - a.length);
  const fallback = surfaces[0] ?? String(record.id ?? 'screen').split('.').pop();
  return (state) => screenOf.get(state)
    ?? byLength.find((s) => state === s || state.startsWith(`${s}-`))
    ?? byLength.find((s) => state.startsWith(`${s.split('-')[0]}-`))
    ?? fallback;
}

/** The breakpoints a state is drawn or derived at, from its coverage-map entries. */
function viewportsResolver(record) {
  const map = list(record.ui?.coverage?.map);
  const declared = list(record.ui?.coverage?.breakpoints).map(String);
  return (state) => {
    const named = uniq(map.filter((m) => m?.state === state && m?.breakpoint).map((m) => String(m.breakpoint)));
    return named.length ? named : declared.length ? declared : [...REQUIRED_BREAKPOINTS];
  };
}

/** The migration of one ui record: {changed, next, shapes, moved, slots, retired, dropped, candidates, skipped}. */
export function planRecord(record, { now = new Date().toISOString() } = {}) {
  const ui = record?.ui;
  if (record?.schema !== 'work/ui-screen@1' || !ui || typeof ui !== 'object') return { changed: false, skipped: 'not a ui record with a ui block' };
  const surfaceOf = surfaceResolver(record);
  const viewportsOf = viewportsResolver(record);
  const existing = list(ui.shapes);
  const shapeStates = new Set(existing.map((s) => String(s?.state)));
  const drawn = new Set(drawingsOf(record).map((d) => d.state));
  const statesByName = new Map(list(ui.states).map((s) => [nameOf(s), s]).filter(([n]) => n));

  const shapes = [...existing];
  const moved = [];
  const slots = new Map(list(ui.dataStatus).map((d) => [`${d.base}|${d.slot}`, { ...d, statuses: [...list(d.statuses)] }]));
  const candidates = [];
  for (const name of statesByName.keys()) {
    if (shapeStates.has(name)) continue;
    const surface = surfaceOf(name);
    const base = baseOf(surface);
    const ds = dataStatusOf(name);
    if (!ds) {
      // A record that already declares its shapes keeps its other states as flow states: the drawer chose them.
      if (existing.length) continue;
      shapes.push({ base, state: name, viewports: viewportsOf(name) });
      shapeStates.add(name);
      continue;
    }
    moved.push(name);
    const slot = ds.slot ?? surface;
    const key = `${base}|${slot}`;
    const entry = slots.get(key) ?? { base, slot, statuses: [] };
    entry.statuses = DATA_STATUSES.filter((s) => s === ds.status || entry.statuses.includes(s));
    slots.set(key, entry);
    const s = statesByName.get(name);
    const reasons = [];
    if (drawn.has(name)) reasons.push('drawn');
    const behavior = String(s?.behavior ?? '').split(slot).join(' ').split(surface).join(' ');
    if (CANDIDATE_TEXT.test(behavior)) reasons.push('its behaviour reads like an onboarding or recovery screen');
    if (reasons.length) candidates.push({ state: name, status: ds.status, base, slot, reasons });
  }
  if (!shapes.length) return { changed: false, skipped: 'every state is a data status - no shape to keep', moved, candidates };

  const movedSet = new Set(moved);
  const retired = [];
  const retire = (assets) => (Array.isArray(assets) ? assets.map((a) => {
    if (!a || typeof a !== 'object' || a.retired || !DRAWING_ROLES.has(a.role) || !movedSet.has(assetStateOf(record, a))) return a;
    retired.push(slash(a.path));
    return { ...a, retired: RETIRED_DATA_STATUS };
  }) : assets);

  const map = list(ui.coverage?.map);
  const keptMap = map.filter((m) => !movedSet.has(String(m?.state)));
  const dropped = keptMap.length ? map.length - keptMap.length : 0;
  const nextUi = {};
  for (const [k, v] of Object.entries(ui)) {
    if (k === 'shapes' || k === 'dataStatus') continue;
    if (k === 'states') {
      nextUi.states = list(v).filter((s) => !movedSet.has(nameOf(s)));
      nextUi.shapes = shapes;
      if (slots.size) nextUi.dataStatus = [...slots.values()];
      continue;
    }
    if (k === 'coverage' && v && typeof v === 'object' && dropped) { nextUi.coverage = { ...v, map: keptMap }; continue; }
    if (k === 'assets') { nextUi.assets = retire(v); continue; }
    nextUi[k] = v;
  }
  if (!('shapes' in nextUi)) { nextUi.shapes = shapes; if (slots.size) nextUi.dataStatus = [...slots.values()]; }
  if (Array.isArray(nextUi.states) && !nextUi.states.length) delete nextUi.states;

  const next = { ...record, ui: nextUi, ...(Array.isArray(record.assets) ? { assets: retire(record.assets) } : {}) };
  const changed = JSON.stringify(next) !== JSON.stringify(record);
  if (changed && Number.isInteger(record.change?.rev)) {
    next.change = { rev: record.change.rev + 1, kind: 'clarifying', at: now, reason: `ui states split into shapes and per-slot data status (scripts/work/migrate-ui-shapes.mjs): ${moved.length} data-status state(s) moved to ui.dataStatus, ${uniq(retired).length} data-status drawing(s) retired.` };
  }
  return { changed, next, shapes: shapes.length, moved, slots: slots.size, retired: uniq(retired), dropped, candidates, skipped: null };
}

/** Plan (and with apply, write) the migration of every ui record under <repo>/.starciwork. */
export function migrateRepo(repo, { apply = false, now } = {}) {
  const workRoot = path.join(path.resolve(repo), '.starciwork');
  if (!fs.existsSync(workRoot)) throw new Error(`${slash(workRoot)} does not exist - --repo names a product repository`);
  const records = [], unreadable = [];
  const totals = { records: 0, changed: 0, unchanged: 0, skipped: 0, states: 0, shapes: 0, dataStatusStates: 0, slots: 0, retiredAssets: 0, mapEntriesDropped: 0, nonDerivableCandidates: 0 };
  for (const file of indexFilesUnder(workRoot)) {
    let record;
    try { record = readYaml(file); } catch (error) { unreadable.push({ file: slash(path.relative(repo, file)), error: String(error?.message ?? error).split('\n')[0] }); continue; }
    if (record?.schema !== 'work/ui-screen@1') continue;
    const rel = slash(path.relative(repo, file));
    const plan = planRecord(record, { now });
    totals.records += 1;
    totals.states += list(record.ui?.states).length;
    if (plan.skipped) totals.skipped += 1;
    else if (plan.changed) totals.changed += 1;
    else totals.unchanged += 1;
    totals.shapes += plan.shapes ?? 0;
    totals.dataStatusStates += list(plan.moved).length;
    totals.slots += plan.slots ?? 0;
    totals.retiredAssets += list(plan.retired).length;
    totals.mapEntriesDropped += plan.dropped ?? 0;
    totals.nonDerivableCandidates += list(plan.candidates).length;
    if (apply && plan.changed && !plan.skipped) writeRecordFile(file, stringifyYaml(plan.next, { lineWidth: 110 }));
    records.push({ id: record.id ?? null, file: rel, changed: Boolean(plan.changed && !plan.skipped), skipped: plan.skipped ?? null, states: list(record.ui?.states).length, shapes: plan.shapes ?? 0, moved: list(plan.moved), slots: plan.slots ?? 0, retired: list(plan.retired), dropped: plan.dropped ?? 0, candidates: list(plan.candidates) });
  }
  return { repo: slash(path.resolve(repo)), mode: apply ? 'apply' : 'dry-run', totals, records, unreadable };
}

const render = (r) => {
  const lines = [`migrate-ui-shapes ${r.mode} ${r.repo}`];
  for (const rec of r.records) {
    const what = rec.skipped ? `skipped: ${rec.skipped}` : rec.changed ? `${r.mode === 'apply' ? 'rewrote' : 'would rewrite'}: ${rec.states} states -> ${rec.shapes} shapes + ${rec.moved.length} data statuses in ${rec.slots} slots, ${rec.retired.length} drawings retired, ${rec.dropped} map entries dropped` : 'unchanged';
    lines.push(`  ${rec.id ?? rec.file}: ${what}`);
    for (const c of rec.candidates) lines.push(`    nonDerivable candidate: ${c.state} (${c.status}, ${c.base}/${c.slot}) - ${c.reasons.join('; ')}`);
  }
  for (const u of r.unreadable) lines.push(`  UNREADABLE ${u.file}: ${u.error}`);
  const t = r.totals;
  lines.push(`totals: ${t.records} ui records, ${t.changed} to change, ${t.unchanged} unchanged, ${t.skipped} skipped; ${t.states} states -> ${t.shapes} shapes + ${t.dataStatusStates} data statuses (${t.slots} slots); ${t.retiredAssets} drawings retired; ${t.mapEntriesDropped} map entries dropped; ${t.nonDerivableCandidates} nonDerivable candidates`);
  return `${lines.join('\n')}\n`;
};

export function migrateUiShapesMain(argv = []) {
  const repo = flag(argv, '--repo');
  const apply = argv.includes('--apply');
  if (!repo || (apply && argv.includes('--dry-run'))) return { exitCode: 2, text: USAGE };
  try {
    const result = migrateRepo(repo, { apply });
    return { exitCode: result.unreadable.length ? 1 : 0, text: argv.includes('--json') ? `${JSON.stringify(result, null, 2)}\n` : render(result) };
  } catch (error) {
    return { exitCode: 1, text: `migrate-ui-shapes: ${error.message}\n` };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = migrateUiShapesMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
