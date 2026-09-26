// ui-shapes.mjs — a ui record's state is a SHAPE (one layout, one drawing); a slot's data status (loading,
// skeleton, empty, error, 401/403/404) renders by recipe through SlotView and is never drawn.
//
// The vocabulary is the ui record schema's own ($defs.dataStatus and $defs.dataStatusAlias in
// modules/schemas/work-ui-screen.schema.yaml). A state reads as a data status when its name is a status or a
// spelling of one, or ends with `-<status>`; what precedes it names the slot. DATA_STATUS_DRAWN refuses a
// shape or a drawing (a direction or direction-content asset, or a coverage-map directionAsset) of a data
// status unless a shape of that state says why it is not derivable (`nonDerivable`).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { assetsOf, list, slash } from '../work/work-io.mjs';

export const DATA_STATUS_DRAWN = 'DATA_STATUS_DRAWN';
export const SHAPE_DUPLICATE = 'SHAPE_DUPLICATE';
export const RETIRED_DATA_STATUS = 'data-status';
export const DRAWING_ROLES = new Set(['direction', 'direction-content']);
/** The tool that token-renders a drawing (scripts/work/draw-render.mjs); a ui record's drawings name it. */
export const DRAW_TOOL = 'draw-render';
/** The image generator: it paints raster regions, and it drew the directions of a record drawn before DRAW_TOOL. */
export const RASTER_TOOL = 'image_gen.imagegen';

const schemaFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../modules/schemas/work-ui-screen.schema.yaml');
const defs = parseYaml(fs.readFileSync(schemaFile, 'utf8')).$defs;

/** The canonical data statuses, in schema order. */
export const DATA_STATUSES = Object.freeze([...defs.dataStatus.enum]);
const SPELLINGS = new Map([...DATA_STATUSES.map((s) => [s, s]), ...Object.entries(defs.dataStatusAlias.const)]);
const BY_LENGTH = [...SPELLINGS.keys()].sort((a, b) => b.length - a.length);

/** {status, slot, spelling} when `name` is a data status (slot null when the name is the status alone), else null. */
export function dataStatusOf(name) {
  const text = String(name ?? '');
  for (const spelling of BY_LENGTH) {
    if (text === spelling) return { status: SPELLINGS.get(spelling), slot: null, spelling };
    if (text.endsWith(`-${spelling}`)) return { status: SPELLINGS.get(spelling), slot: text.slice(0, -spelling.length - 1), spelling };
  }
  return null;
}

/** The asset paths a ui record retired. */
const retiredPaths = (record) => new Set(assetsOf(record).filter((a) => a.retired).map((a) => slash(a.path)));

/**
 * The state an asset draws: its composite flowState, else its `<state>--` file name, else the one coverage-map
 * entry naming it - or, where several do (derived states cite the representative drawing), the one whose state
 * its file name carries. Null when that is not decidable.
 */
export function assetStateOf(record, asset) {
  if (asset?.composite?.flowState) return String(asset.composite.flowState);
  const rel = slash(asset?.path ?? '');
  const file = rel.split('/').pop();
  if (file.includes('--')) return file.split('--')[0];
  const naming = uniqStates(list(record?.ui?.coverage?.map).filter((m) => m?.state && m?.directionAsset && slash(m.directionAsset) === rel));
  if (naming.length === 1) return naming[0];
  const stem = file.replace(/\.[^.]+$/, '');
  return naming.find((state) => stem === state || stem.endsWith(`-${state}`)) ?? null;
}
const uniqStates = (entries) => [...new Set(entries.map((m) => String(m.state)))];

/** Every live drawing a ui record carries: [{state, path, via}] - retired and unselected assets are not drawings. */
export function drawingsOf(record) {
  const retired = retiredPaths(record);
  const out = [], seen = new Set();
  const add = (state, rel, via) => {
    const key = `${state}|${rel}`;
    if (!state || seen.has(key)) return;
    seen.add(key);
    out.push({ state, path: rel, via });
  };
  for (const a of assetsOf(record)) {
    if (!DRAWING_ROLES.has(a.role) || a.retired || a.selected === false) continue;
    add(assetStateOf(record, a), slash(a.path), 'asset');
  }
  for (const m of list(record?.ui?.coverage?.map)) {
    if (!m?.directionAsset || !m?.state || retired.has(slash(m.directionAsset))) continue;
    const rel = slash(m.directionAsset);
    if (assetStateOf(record, { path: rel }) === String(m.state)) add(String(m.state), rel, 'coverage.map');
  }
  return out;
}

/** The shapes a record declares a data status non-derivable for, by state. */
const nonDerivableStates = (record) => new Set(list(record?.ui?.shapes).filter((s) => s?.nonDerivable).map((s) => String(s.state)));

/** DATA_STATUS_DRAWN and SHAPE_DUPLICATE findings for one work/ui-screen@1 record: [{code, detail}]. */
export function uiShapeFindings(record) {
  if (record?.schema !== 'work/ui-screen@1') return [];
  const findings = [];
  const exempt = nonDerivableStates(record);
  const seen = new Set();
  for (const shape of list(record?.ui?.shapes)) {
    const key = `${shape?.base}#${shape?.state}`;
    if (seen.has(key)) findings.push({ code: SHAPE_DUPLICATE, detail: `ui.shapes lists ${key} twice; each XBase#state is one drawing` });
    seen.add(key);
    const status = dataStatusOf(shape?.state);
    if (status && !shape?.nonDerivable) {
      findings.push({ code: DATA_STATUS_DRAWN, detail: `ui.shapes lists ${key}, which is the data status ${status.status}; list it under ui.dataStatus (rendered by SlotView), or give the shape a nonDerivable reason` });
    }
  }
  for (const d of drawingsOf(record)) {
    const status = dataStatusOf(d.state);
    if (!status || exempt.has(d.state)) continue;
    findings.push({ code: DATA_STATUS_DRAWN, detail: `${d.path} draws "${d.state}", which is the data status ${status.status} (${d.via}); data statuses render by recipe - retire the drawing (retired: ${RETIRED_DATA_STATUS}) or declare the shape nonDerivable with its reason` });
  }
  return findings;
}

const generatedBy = (asset, tool) => Boolean(asset && typeof asset === 'object' && !asset.retired && asset.generation
  && typeof asset.generation === 'object' && !Array.isArray(asset.generation) && asset.generation.tool === tool);

/**
 * The generated drawings among a ui record's assets (its `assets` or its `ui.assets` list) that make it drawn: the
 * DRAW_TOOL ones. A list with none is a record drawn before token rendering, and its RASTER_TOOL assets count; beside
 * a DRAW_TOOL asset a RASTER_TOOL asset is a raster region the drawing embeds, never a drawing. Retired assets never
 * count.
 */
export function generatedDrawingsOf(assets) {
  const drawn = list(assets).filter((a) => generatedBy(a, DRAW_TOOL));
  return drawn.length ? drawn : list(assets).filter((a) => generatedBy(a, RASTER_TOOL));
}
