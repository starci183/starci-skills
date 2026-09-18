import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseYaml} from '../core/yaml.mjs';
import {decodePng, checkPalette, checkEntityListInCard, checkMascotSlot, cardClassesOf} from '../checks/render.mjs';
import {readWorkspace, loadRecords} from './example-ownership.mjs';

/**
 * Grit item 55 (docs/examples/todo-app-grit.md): checks/render.mjs and checks/brand.mjs are real - a
 * capture's PNG bytes plus its kept markup are checked against the brand record, palette and component
 * anatomy both - but nothing ever ran them against this example tree, so a frontend work/implementation
 * record could reach `done` with no capture at all. This module is the mechanical wiring: for every done
 * implementation that is a frontend record (the same predicate concept 8 / IMPL_BEFORE_DIRECTION uses -
 * it proves a work/ui-screen, or its `repository` resolves to a workspace `role: fe` entry), real capture
 * artifacts must exist in the shape render.mjs reads (a PNG under the implementation node's assets/,
 * with the kept markup beside it as the same basename .html) and the render/brand checks must pass.
 *
 * The check functions are imported from checks/render.mjs itself and composed here rather than calling
 * its runRenderChecks: that wrapper reads the brand through readBrandRecord, which requires the canonical
 * `work/node@2` node shape, while this example tree authors the readable `work/brand` schema (see
 * schemas/work-layout.yaml). The brand's own `brand:` specification - the object every check actually
 * consumes - is read here with the same leniency the rest of the example toolkit applies, so the canon
 * mathematics runs unchanged on this tree's records. Anything the canon cannot run stays unproven: a
 * `skip` on one of the three core checks (palette-off-brand, primary-absent, entity-list-in-card) is
 * refused exactly as renderChecksFor's `implementation-render-proof-incomplete` refuses it, because an
 * uncheckable claim is not a pass. `mascot-slot-missing` is advisory like the canon: a fail refuses, a
 * skip (a surface the brand does not allow the mascot on) does not.
 *
 * CLI (`node scripts/example-render-proof.mjs --work <path-to-.starciwork> --record <id>`) runs the same
 * proof for one implementation record regardless of its state, printing every refusal and exiting 1 when
 * any exist - the replayable command an evidence.yaml assertion names when it binds this proof.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const walk = dir => fs.readdirSync(dir, {withFileTypes: true})
  .flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);

const slash = value => String(value ?? '').replaceAll('\\', '/');
const listOf = value => (Array.isArray(value) ? value : []).filter(item => item && typeof item === 'object');

/** The checks whose `skip` is a refusal: the canon's own core set from renderChecksFor. */
const CORE_CHECKS = new Set(['palette-off-brand', 'primary-absent', 'entity-list-in-card']);

/**
 * Whether `rec` (a work/implementation) is a frontend record - exactly the predicate check-example-work.mjs's
 * IMPL_BEFORE_DIRECTION rule uses: it names a work/ui-screen in `proves`, or its `repository` resolves to a
 * `role: fe` entry in workspace.yaml. Backend records and records proving no screen are untouched.
 */
export function isFrontendImpl(rec, records, workspaceDoc) {
  const data = rec?.data ?? {};
  const provesUi = (Array.isArray(data.proves) ? data.proves : [])
    .some(pid => records.get(pid)?.schema === 'work/ui-screen');
  const repos = Array.isArray(workspaceDoc?.repositories) ? workspaceDoc.repositories : [];
  const isFeRepo = data.repository ? repos.find(r => r?.name === data.repository)?.role === 'fe' : false;
  return provesUi || isFeRepo;
}

/**
 * The ui node directories this implementation is rendered against: the ui-screens its `proves` names, or -
 * when it proves none by id - every ui-screen its own feature owns (concept 8's fallback: a frontend
 * implementation is for some screen even when it did not name one).
 */
function uiDirsFor(rec, records, workRoot) {
  const proved = (Array.isArray(rec?.data?.proves) ? rec.data.proves : [])
    .map(pid => records.get(pid))
    .filter(entry => entry?.schema === 'work/ui-screen')
    .map(entry => entry.dir);
  if (proved.length) return [...new Set(proved)];
  const feature = slash(path.relative(workRoot, rec.dir)).split('/')[1];
  return [...new Set([...records.values()]
    .filter(entry => entry.schema === 'work/ui-screen' && slash(path.relative(workRoot, entry.dir)).split('/')[1] === feature)
    .map(entry => entry.dir))];
}

/**
 * The brand specification this tree declares, from `<workRoot>/brand/index.yaml`'s own `brand:` field.
 * Deliberately not checks/brand.mjs's readBrandRecord: that reader demands schema `work/node@2`, while the
 * example layout authors `work/brand` - the specification object itself is identical input for the checks.
 */
function readExampleBrand(workRoot) {
  const file = path.join(workRoot, 'brand', 'index.yaml');
  if (!fs.existsSync(file) || !fs.lstatSync(file).isFile()) {
    return {error: 'the Work tree carries no brand/index.yaml to check the capture against'};
  }
  let record;
  try {
    record = parseYaml(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return {error: `the brand record could not be read (${String(error.message ?? error)})`};
  }
  if (!record?.brand || typeof record.brand !== 'object' || Array.isArray(record.brand)) {
    return {error: 'the brand record carries no brand specification'};
  }
  const family = typeof record.brand.identity?.family === 'string' ? record.brand.identity.family : null;
  return {brand: record.brand, family, rev: record.rev ?? record.brand.rev ?? null, file};
}

/**
 * The capture artifacts of one implementation node, in the shape render.mjs's implementationCandidates
 * reads: every PNG under the node's assets/ (recursively), each paired with the kept markup that shares
 * its basename. A candidate with no sibling .html is still a candidate - the markup check then reports
 * its own skip, which is a refusal here rather than a pass.
 */
function captureCandidates(implDir) {
  const assets = path.join(implDir, 'assets');
  let files = [];
  try {
    if (fs.lstatSync(assets).isDirectory()) files = walk(assets).filter(file => /\.png$/i.test(file));
  } catch { return []; }
  return files.sort().map(png => {
    const markup = png.replace(/\.png$/i, '.html');
    return {png, markup: fs.existsSync(markup) && fs.lstatSync(markup).isFile() ? markup : null};
  });
}

/**
 * The render/brand proof of one work/implementation record: returns a list of refusal strings (empty when
 * the proof holds). `rec` is an entry of check-example-work.mjs's records map or example-ownership.mjs's
 * loadRecords - `{schema, data, dir}` is all that is read. The record's own `state` is not consulted here:
 * the caller decides which states the proof is required for (the gate requires it for `done`; the CLI runs
 * it for a named record so evidence can bind the actual outcome).
 */
export function renderProofProblems({rec, records, workspaceDoc, workRoot}) {
  const problems = [];
  if (rec?.schema !== 'work/implementation') return problems;
  if (!isFrontendImpl(rec, records, workspaceDoc)) return problems;

  const brand = readExampleBrand(workRoot);
  if (brand.error) {
    problems.push(`state is done but its render proof cannot run: ${brand.error} [RENDER_BRAND_MISSING]`);
    return problems;
  }
  const cards = cardClassesOf({family: brand.family});

  const uiDirs = uiDirsFor(rec, records, workRoot);
  if (!uiDirs.length) {
    problems.push('state is done but resolves no ui-screen record to compare its render against - a frontend implementation proves a drawn direction, and without one there is no surface, coverage map or artwork slot to check [RENDER_UI_INPUT_MISSING]');
    return problems;
  }

  const candidates = captureCandidates(rec.dir);
  if (!candidates.length) {
    problems.push('state is done but keeps no running-page capture under its assets/ - a frontend implementation is proven by a browser PNG plus the markup it rendered, the shape checks/render.mjs reads, and a design/direction image is not an implementation capture [RENDER_CAPTURE_MISSING]');
    return problems;
  }

  for (const candidate of candidates) {
    const rel = slash(path.relative(workRoot, candidate.png));
    let png = null, failure = null;
    try { png = decodePng(fs.readFileSync(candidate.png)); }
    catch (error) { failure = String(error.message ?? error); }
    if (!png) {
      problems.push(`capture ${rel} could not be decoded (${failure}), so its palette could not be compared against the brand - an uncheckable claim is not a pass [RENDER_PROOF_INCOMPLETE]`);
    } else {
      for (const result of checkPalette({png, brand: brand.brand})) {
        if (result.outcome === 'fail') problems.push(`capture ${rel}: ${result.id} fails - ${result.detail} [RENDER_CHECK_FAILED]`);
        else if (result.outcome === 'skip' && CORE_CHECKS.has(result.id)) problems.push(`capture ${rel}: ${result.id} could not run - ${result.detail} [RENDER_PROOF_INCOMPLETE]`);
      }
    }
    if (!candidate.markup) {
      problems.push(`capture ${rel} keeps no ${path.basename(candidate.png).replace(/\.png$/i, '.html')} beside it - the markup the browser rendered is the half of the proof the entity-list rule reads [RENDER_PROOF_INCOMPLETE]`);
    } else {
      const result = checkEntityListInCard(fs.readFileSync(candidate.markup, 'utf8'), {family: brand.family, cards: cards.classes.length ? cards.classes : null});
      if (result.outcome === 'fail') problems.push(`capture ${rel}: entity-list-in-card fails - ${result.detail} [RENDER_CHECK_FAILED]`);
      else if (result.outcome === 'skip') problems.push(`capture ${rel}: entity-list-in-card could not run - ${result.detail} [RENDER_PROOF_INCOMPLETE]`);
    }
  }

  for (const dir of uiDirs) {
    const rel = slash(path.relative(workRoot, path.join(dir, 'index.yaml')));
    let uiRecord;
    try { uiRecord = parseYaml(fs.readFileSync(path.join(dir, 'index.yaml'), 'utf8')); }
    catch (error) {
      problems.push(`the ui node at ${rel} could not be read for the mascot-slot rule (${String(error.message ?? error)}) [RENDER_PROOF_INCOMPLETE]`);
      continue;
    }
    for (const surface of listOf(uiRecord?.ui?.surfaces)) {
      const result = checkMascotSlot({record: uiRecord, brand: brand.brand, screen: surface});
      if (result.outcome === 'fail') problems.push(`${result.id} fails on ${rel}: ${result.detail} [RENDER_CHECK_FAILED]`);
    }
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 1) {
    const token = process.argv[i];
    if (token === '--work') args.work = process.argv[++i];
    else if (token === '--record') args.record = process.argv[++i];
    else { console.error(`REFUSED unrecognized argument: ${token}`); process.exit(1); }
  }
  if (!args.work || !args.record) { console.error('REFUSED --work <path-to-.starciwork> and --record <id> are both required'); process.exit(1); }
  const workRoot = path.resolve(root, args.work);
  const records = loadRecords(workRoot, walk);
  const workspaceDoc = readWorkspace(workRoot);
  const rec = records.get(args.record);
  if (!rec) { console.error(`REFUSED no record with id ${args.record} was found under ${workRoot}`); process.exit(1); }
  const problems = renderProofProblems({rec, records, workspaceDoc, workRoot});
  for (const problem of problems) console.log(`REFUSED ${slash(path.relative(workRoot, rec.dir))}: ${problem}`);
  console.log(`${args.record}: ${problems.length ? `${problems.length} refused` : 'render/brand proof holds for every capture'}`);
  process.exitCode = problems.length ? 1 : 0;
}
