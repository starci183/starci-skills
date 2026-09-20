import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../core/yaml.mjs';
import {decodePng, checkPalette, checkEntityListInCard, checkMascotSlot, cardClassesOf} from '../../../scripts/checks/render.mjs';
import {defaultGrammarRoot} from '../../../scripts/checks/brand.mjs';

/**
 * Running-page render proof for the ecommerce-app-fe pair, per ui-screen record.
 *
 * `scripts/example-render-proof.mjs` is the gate's own composition of the canon checks, but it is defined
 * only for `work/implementation@1` records: it returns no problems for any other schema, and this product's
 * Work tree authors no frontend implementation node at all (its two `impl/*` records are both
 * `repository: ecommerce-app-be`, role `be`, and neither names a ui-screen in `proves`). So the ecommerce
 * captures have no gate-side proof path, and `scripts/checks/render.mjs` has to be called directly — the same thing
 * todo-app-frontend/verify-captures.mjs does for the todo pair, for the same stated reason.
 *
 * Three modes, one per claim a ui record makes about its own render:
 *
 *   custody   every `ui.assets[]` entry's recorded sha256 still matches the bytes under the node's assets/,
 *             every retained `generation.promptPath` exists, and exactly one asset carries role: direction.
 *   captures  every `ui.coverage.map` entry has a PNG + kept-markup pair in ../captures named
 *             `<screen>-<viewport>.png/.html` — the addressable shape capture.mjs writes.
 *   render    the canon checks (palette-off-brand, primary-absent, entity-list-in-card, mascot-slot-missing)
 *             run over those pairs against the Work tree's brand record, refusing a `skip` on a core check
 *             exactly as example-render-proof.mjs does, because an uncheckable claim is not a pass.
 *
 * Usage: node captures/verify-render.mjs --record <ui-screen-id> <custody|captures|render>
 * Exits 0 when the named claim holds, 1 when any part of it does not — with the reason printed.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const feRoot = path.resolve(here, '..');
const examplesRoot = path.resolve(feRoot, '..');
const capturesDir = here;
const workRoot = path.resolve(examplesRoot, 'ecommerce-app-be', '.starciwork');

const CORE_CHECKS = new Set(['palette-off-brand', 'primary-absent', 'entity-list-in-card']);
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const args = {record: null, mode: null};
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i];
  if (token === '--record') args.record = process.argv[++i];
  else if (!args.mode && ['custody', 'captures', 'render'].includes(token)) args.mode = token;
  else { console.error(`REFUSED unrecognized argument: ${token}`); process.exit(2); }
}
if (!args.record || !args.mode) {
  console.error('usage: node captures/verify-render.mjs --record <ui-screen-id> <custody|captures|render>');
  process.exit(2);
}

/** Locates the record's own index.yaml by its authored id, walking the Work tree. */
const findRecord = (dir, id) => {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findRecord(full, id);
      if (found) return found;
    } else if (entry.name === 'index.yaml') {
      let doc;
      try { doc = parseYaml(fs.readFileSync(full, 'utf8')); } catch { continue; }
      if (doc?.id === id) return {file: full, dir: path.dirname(full), doc};
    }
  }
  return null;
};

const found = findRecord(workRoot, args.record);
if (!found) { console.error(`REFUSED no record with id ${args.record} under ${workRoot}`); process.exit(1); }
const {dir: recordDir, doc} = found;
if (doc.schema !== 'work/ui-screen@1') { console.error(`REFUSED ${args.record} is ${doc.schema}, not work/ui-screen@1`); process.exit(1); }
const ui = doc.ui ?? {};

let failed = false;
/** `info` is a fact worth printing that does not decide the claim; only fail/not-run marks it failed. */
const say = (verdict, message) => { if (verdict !== 'pass' && verdict !== 'info') failed = true; console.log(`${verdict.toUpperCase()} ${message}`); };

if (args.mode === 'custody') {
  const assets = Array.isArray(ui.assets) ? ui.assets : [];
  if (!assets.length) say('fail', 'the record declares no ui.assets[] to check custody over');
  for (const asset of assets) {
    const file = path.join(recordDir, asset.path ?? '');
    if (!fs.existsSync(file)) { say('fail', `${asset.path}: absent under the node`); continue; }
    if (asset.sha256 !== sha256(file)) { say('fail', `${asset.path}: recorded sha256 ${asset.sha256} != current ${sha256(file)}`); continue; }
    if (asset.generation && !fs.existsSync(path.join(recordDir, asset.generation.promptPath ?? ''))) {
      say('fail', `${asset.path}: generation.promptPath ${asset.generation.promptPath} is not retained beside it`);
      continue;
    }
    say('pass', `${asset.path}: bytes match the recorded digest${asset.generation ? ' and its exact prompt is retained' : ''}`);
  }
  const chosen = assets.filter(asset => asset.role === 'direction');
  if (chosen.length !== 1) say('fail', `${chosen.length} assets carry role: direction, exactly 1 is claimed`);
  else say('pass', `one selected direction: ${chosen[0].path}`);
  for (const entry of ui.coverage?.map ?? []) {
    if (entry.directionAsset !== chosen[0]?.path) say('fail', `coverage ${entry.state}: directionAsset ${entry.directionAsset} is not the selected direction`);
    else say('pass', `coverage ${entry.state}: cites the selected direction asset`);
  }
} else {
  // Both remaining modes speak about the running-page captures, which live in this repository.
  const surfaces = Array.isArray(ui.surfaces) ? ui.surfaces : [];
  const pairs = (ui.coverage?.map ?? []).map(entry => {
    const base = `${entry.screen}-${entry.viewport}`;
    return {entry, png: path.join(capturesDir, `${base}.png`), html: path.join(capturesDir, `${base}.html`)};
  });

  if (args.mode === 'captures') {
    if (!pairs.length) say('fail', 'the record declares no ui.coverage.map entries');
    for (const {entry, png, html} of pairs) {
      const missing = [png, html].filter(file => !fs.existsSync(file)).map(file => path.basename(file));
      if (missing.length) say('fail', `${entry.screen}/${entry.state} @ ${entry.viewport}: no ${missing.join(' or ')} under captures/`);
      else say('pass', `${entry.screen}/${entry.state} @ ${entry.viewport}: ${path.basename(png)} + ${path.basename(html)}`);
    }
    for (const surface of surfaces) {
      const route = String(surface.route ?? '');
      const local = route.replace(/^https?:\/\/localhost:\d+/, '') || '/';
      say('info', `surface ${surface.name} declares route ${route} — the served app mounts it at the locale-prefixed address /en${local === '/' ? '' : local}; see the report`);
    }
    process.exit(failed ? 1 : 0);
  }

  // render: the canon checks, bound to this Work tree's brand record.
  const brandFile = path.join(workRoot, 'brand', 'index.yaml');
  const brandDoc = parseYaml(fs.readFileSync(brandFile, 'utf8'));
  if (!brandDoc?.brand || typeof brandDoc.brand !== 'object' || Array.isArray(brandDoc.brand)) {
    say('fail', 'RENDER_BRAND_MISSING: the Work tree\'s brand/index.yaml carries no `brand:` specification block '
      + `(its top-level keys are ${Object.keys(brandDoc).join(', ')}), so scripts/example-render-proof.mjs's `
      + 'readExampleBrand refuses before any check runs and brandColours() reads no colour at all — the record '
      + 'authors a human-readable `colour:` map instead of the `color.tokens`/`color.scales` shape scripts/checks/render.mjs parses.');
  }
  const brandSpec = brandDoc?.brand ?? null;
  const family = typeof brandSpec?.identity?.family === 'string' ? brandSpec.identity.family : null;
  if (brandSpec && !family) say('fail', 'the brand record declares no brand.identity.family, so cardClassesOf() falls back and entity-list-in-card cannot tell a card from a section');
  if (family) {
    const cards = cardClassesOf({family, grammarRoot: defaultGrammarRoot()});
    console.log(`INFO grammar DNA for family \`${family}\`: source=${cards.source} classes=${JSON.stringify(cards.classes)} error=${cards.error}`);
  }

  for (const {entry, png, html} of pairs) {
    const label = `${entry.screen}/${entry.state} @ ${entry.viewport}`;
    if (!fs.existsSync(png) || !fs.existsSync(html)) { say('fail', `${label}: nothing to check — the declared capture pair is absent`); continue; }
    let decoded = null;
    try { decoded = decodePng(fs.readFileSync(png)); }
    catch (error) { say('fail', `${label}: ${path.basename(png)} could not be decoded (${error.message})`); continue; }
    for (const result of checkPalette({png: decoded, brand: brandSpec ?? {}})) {
      if (result.outcome === 'skip' && CORE_CHECKS.has(result.id)) say('fail', `${label}: ${result.id} RENDER_PROOF_INCOMPLETE — ${result.detail}`);
      else say(result.outcome === 'pass' ? 'pass' : result.outcome === 'skip' ? 'info' : 'fail', `${label}: ${result.id} ${result.outcome} — ${result.detail}`);
    }
    const markup = checkEntityListInCard(fs.readFileSync(html, 'utf8'), {family, cards: null});
    if (markup.outcome === 'skip' && CORE_CHECKS.has(markup.id)) say('fail', `${label}: ${markup.id} RENDER_PROOF_INCOMPLETE — ${markup.detail}`);
    else say(markup.outcome === 'pass' ? 'pass' : markup.outcome === 'skip' ? 'info' : 'fail', `${label}: ${markup.id} ${markup.outcome} — ${markup.detail}`);
  }
  for (const surface of surfaces) {
    const result = checkMascotSlot({record: doc, brand: brandSpec, screen: surface});
    if (result.outcome === 'fail') say('fail', `${result.id} fails on ${surface.name}: ${result.detail}`);
    else say('pass', `${result.id} ${result.outcome} on ${surface.name}`);
  }
}

process.exit(failed ? 1 : 0);
