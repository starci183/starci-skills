import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';
import { addWorkCommon } from '../../scripts/lib/work-schemas.mjs';
import { DATA_STATUS_DRAWN, DRAW_TOOL, RASTER_TOOL, SHAPE_DUPLICATE, dataStatusOf, drawingsOf, generatedDrawingsOf, recipeRenderedOf, uiShapeFindings } from '../../scripts/work/ui/ui-shapes.mjs';
import { checkWorkTree } from '../../scripts/work/validate/check-example-work.mjs';
import { readAppFixtureYaml } from '../helpers/app-fixture.mjs';

// Owner model (examples/shape-slot/README.md): a ui record's state is a SHAPE - one layout, one drawing - and a
// slot's data status (loading, skeleton, empty, error, 401/403/404) renders by recipe and is never drawn.
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const validate = addWorkCommon(new Ajv2020({ strict: true, allErrors: true })).compile(parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/work-ui-screen.schema.yaml'), 'utf8')));
const errors = () => (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
const example = () => readAppFixtureYaml('.starciwork/features/identity/ui/sign-in/index.yaml');
const sha = 'a'.repeat(64);
const codes = (findings) => findings.map((f) => f.code);

test('schema: ui.shapes and per-slot ui.dataStatus are additive; states stay readable', () => {
  const legacy = example();
  assert.equal(validate(legacy), true, `a record with only ui.states stays valid: ${errors()}`);

  const shaped = example();
  shaped.ui.shapes = [{ base: 'SignInBase', state: 'filled-welcome', viewports: ['desktop', 'mobile'] }, { base: 'SignInBase', state: 'first-run-empty', viewports: ['desktop'], nonDerivable: 'First-run onboarding with its own call to action.' }];
  shaped.ui.dataStatus = [{ base: 'SignInBase', slot: 'session', statuses: ['loading', 'error', 'forbidden', 'unauthorized', 'not-found'] }];
  assert.equal(validate(shaped), true, errors());

  const shapesOnly = structuredClone(shaped);
  delete shapesOnly.ui.states;
  assert.equal(validate(shapesOnly), true, `shapes alone describe the screen: ${errors()}`);

  const neither = structuredClone(shapesOnly);
  delete neither.ui.shapes;
  assert.equal(validate(neither), false, 'a ui block with neither states nor shapes is refused');

  const badBase = structuredClone(shaped);
  badBase.ui.shapes[0].base = 'SignIn';
  assert.equal(validate(badBase), false, 'a shape names its pure half XBase');

  const noViewport = structuredClone(shaped);
  delete noViewport.ui.shapes[0].viewports;
  assert.equal(validate(noViewport), false, 'a shape names the viewports it is drawn at');

  const badStatus = structuredClone(shaped);
  badStatus.ui.dataStatus[0].statuses = ['pending'];
  assert.equal(validate(badStatus), false, 'a data status is one of $defs.dataStatus');

  const retired = example();
  retired.ui.assets = retired.ui.assets.map((a) => (a.role === 'direction' ? { ...a, retired: 'data-status' } : a));
  assert.equal(validate(retired), true, `a retired asset keeps its entry: ${errors()}`);
  retired.ui.assets = retired.ui.assets.map((a) => (a.retired ? { ...a, retired: 'obsolete' } : a));
  assert.equal(validate(retired), false, 'retired names a known reason');
});

test('dataStatusOf reads a state name through the schema vocabulary and names its slot', () => {
  assert.deepEqual(dataStatusOf('loading'), { status: 'loading', slot: null, spelling: 'loading' });
  assert.deepEqual(dataStatusOf('opportunity-loading'), { status: 'loading', slot: 'opportunity', spelling: 'loading' });
  assert.equal(dataStatusOf('decision-denied').status, 'forbidden');
  assert.deepEqual(dataStatusOf('access-denied'), { status: 'forbidden', slot: null, spelling: 'access-denied' });
  assert.equal(dataStatusOf('challenge-load-error').slot, 'challenge');
  assert.equal(dataStatusOf('sign-in-required').status, 'unauthorized');
  assert.equal(dataStatusOf('page-404').status, 'not-found');
  assert.equal(dataStatusOf('list-skeleton').status, 'skeleton');
  // Owner ruling 2026-09-27 (nivo module-ledger): a slot retrying, pending, uncertain, stale, unverified, limited or
  // holding no-<thing> is a status banner over the same layout - a data status, never a shape.
  assert.deepEqual(dataStatusOf('decision-pending'), { status: 'loading', slot: 'decision', spelling: 'pending' });
  assert.deepEqual(Object.fromEntries(['retrying', 'operation-uncertain', 'last-known', 'access-unverified', 'evidence-limited', 'no-runtime', 'ledger-no-runtime', 'operation-pending']
    .map((s) => [s, dataStatusOf(s)?.status])), { retrying: 'error', 'operation-uncertain': 'error', 'last-known': 'error', 'access-unverified': 'forbidden', 'evidence-limited': 'empty', 'no-runtime': 'empty', 'ledger-no-runtime': 'empty', 'operation-pending': 'loading' });
  assert.equal(dataStatusOf('ledger-no-runtime').slot, 'ledger');
  for (const shape of ['handoff-submitting', 'opportunity-populated', 'oauth-refused', 'payment-failed', 'unavailable-return', 'emptyish', 'installed-current', 'operation-confirmed', 'piano-notes', 'oauth-unverified-email']) {
    assert.equal(dataStatusOf(shape), null, `${shape} is a shape`);
  }
});

const record = (over = {}) => {
  const r = example();
  r.ui.shapes = [{ base: 'SignInBase', state: 'filled-welcome', viewports: ['desktop'] }];
  r.assets = [];
  return Object.assign(r, over);
};

test('DATA_STATUS_DRAWN refuses a data-status shape or drawing unless it is declared nonDerivable', () => {
  assert.deepEqual(uiShapeFindings(record()), [], 'a record that draws only shapes is clean');

  const statusShape = record();
  statusShape.ui.shapes.push({ base: 'SignInBase', state: 'session-loading', viewports: ['desktop'] });
  assert.deepEqual(codes(uiShapeFindings(statusShape)), [DATA_STATUS_DRAWN]);

  const drawn = record();
  drawn.assets.push({ path: 'assets/directions/session-empty--page--desktop--light.content.png', role: 'direction-content', sha256: sha });
  drawn.assets.push({ path: 'assets/directions/x.png', role: 'direction', sha256: sha, composite: { flowState: 'session-error' } });
  drawn.ui.coverage.map.push({ screen: 'sign-in', state: 'forbidden', viewport: 'desktop', directionAsset: 'assets/directions/forbidden.png' });
  assert.deepEqual(drawingsOf(drawn).map((d) => d.state).sort(), ['filled-welcome', 'forbidden', 'session-empty', 'session-error']);
  const found = uiShapeFindings(drawn);
  assert.deepEqual(codes(found), [DATA_STATUS_DRAWN, DATA_STATUS_DRAWN, DATA_STATUS_DRAWN]);
  assert.match(found[0].detail, /session-empty.*data status empty/);
  const cited = record();
  cited.ui.coverage.map.push({ screen: 'sign-in', state: 'empty', viewport: 'desktop', directionAsset: 'assets/sign-in.png', derivation: 'Derives from filled-welcome.' });
  assert.deepEqual(uiShapeFindings(cited), [], 'a map entry deriving from a cited drawing draws nothing itself');

  const retired = structuredClone(drawn);
  for (const a of retired.assets) if (/session-|x\.png/.test(a.path)) a.retired = 'data-status';
  retired.assets.push({ path: 'assets/directions/forbidden.png', role: 'direction', sha256: sha, retired: 'data-status' });
  assert.deepEqual(uiShapeFindings(retired), [], 'a retired drawing is not a drawing');

  const candidate = record();
  candidate.assets.push({ path: 'assets/directions/first-run-empty--page--desktop--light.content.png', role: 'direction-content', sha256: sha });
  candidate.assets.push({ path: 'assets/directions/older-empty--page--desktop--light.content.png', role: 'direction-content', sha256: sha, selected: false });
  assert.deepEqual(codes(uiShapeFindings(candidate)), [DATA_STATUS_DRAWN]);
  candidate.ui.shapes.push({ base: 'SignInBase', state: 'first-run-empty', viewports: ['desktop'], nonDerivable: 'First-run onboarding with its own call to action.' });
  assert.deepEqual(uiShapeFindings(candidate), [], 'a nonDerivable shape may be drawn');

  const twice = record();
  twice.ui.shapes.push({ ...twice.ui.shapes[0], viewports: ['mobile'] });
  assert.deepEqual(codes(uiShapeFindings(twice)), [SHAPE_DUPLICATE]);
});

test('the ui record gate carries DATA_STATUS_DRAWN: refused on every record that draws a slot data status', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ui-shapes-gate-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const work = path.join(base, '.starciwork');
  const put = (rel, body) => { const file = path.join(work, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
  put('index.yaml', 'schema: work/catalog@1\nid: fixture\nfeatures: []\n');
  const legacy = example();
  legacy.refs = []; // the example's FR records are not part of this fixture tree
  legacy.assets = [];
  legacy.assets.push({ path: 'assets/directions/loading--page--desktop--light.content.png', role: 'direction-content', sha256: sha });
  put('features/identity/ui/sign-in/index.yaml', stringifyYaml(legacy));
  const shaped = structuredClone(legacy);
  shaped.id = 'ui.identity.sign-up';
  shaped.ui.shapes = [{ base: 'SignInBase', state: 'filled-welcome', viewports: ['desktop'] }];
  put('features/identity/ui/sign-up/index.yaml', stringifyYaml(shaped));
  const refused = [], warned = [];
  checkWorkTree(work, refused, warned, []);
  const hits = (list) => list.filter((line) => line.includes(`[${DATA_STATUS_DRAWN}]`));
  // No record is "not yet migrated" any more (the migration script is retired): the shaped and the unshaped record that
  // draw the loading data status are both refused, and nothing is only warned.
  assert.equal(hits(refused).length, 2, refused.join('\n'));
  assert.ok(hits(refused).some((line) => /sign-up\/index\.yaml/.test(line)) && hits(refused).some((line) => /sign-in\/index\.yaml/.test(line)), refused.join('\n'));
  assert.equal(hits(warned).length, 0, warned.join('\n'));
  assert.deepEqual(refused.filter((line) => !line.includes(`[${DATA_STATUS_DRAWN}]`)), [], 'the fixture is otherwise clean');
});

const salesLike = () => ({
  schema: 'work/ui-screen@1', id: 'ui.sales.workbench', title: 'Sales workbench', state: 'todo', brand: { rev: 1 }, refs: [],
  change: { rev: 2, kind: 'clarifying', at: '2026-09-26T00:00:00.000Z', reason: 'Drawn.' },
  ui: {
    intent: 'Command sales work.',
    surfaces: [{ name: 'opportunity-attention', route: '/sales', purpose: 'Act.', actors: ['owner'] }, { name: 'onboarding', route: '/sales/start', purpose: 'Start.', actors: ['owner'] }],
    states: [
      { name: 'opportunity-loading', trigger: 'opportunity-attention: loading.', behavior: 'Skeletons.' },
      { name: 'opportunity-empty', trigger: 'opportunity-attention: empty.', behavior: 'One EmptyNotice.' },
      { name: 'opportunity-denied', trigger: 'opportunity-attention: denied.', behavior: 'Refusal.' },
      { name: 'opportunity-populated', trigger: 'opportunity-attention: populated.', behavior: 'Facts.' },
      { name: 'opportunity-command-submitting', trigger: 'command sent.', behavior: 'Pending.' },
      { name: 'onboarding-empty', trigger: 'first visit.', behavior: 'Welcome panel with a get started call to action.' },
    ],
    coverage: {
      scale: 'bounded', representativeScreens: ['opportunity-attention'], breakpoints: ['desktop', 'mobile'],
      map: [
        { screen: 'opportunity-attention', state: 'opportunity-loading', viewport: '390px mobile', breakpoint: 'mobile', directionAsset: 'assets/directions/opportunity-loading--page--mobile--light.png' },
        { screen: 'opportunity-attention', state: 'opportunity-empty', viewport: '1440px desktop', breakpoint: 'desktop', derivation: 'Derived.' },
        { screen: 'opportunity-attention', state: 'opportunity-denied', viewport: '1440px desktop', breakpoint: 'desktop', derivation: 'Derived.' },
        { screen: 'opportunity-attention', state: 'opportunity-populated', viewport: '1440px desktop', breakpoint: 'desktop', directionAsset: 'assets/directions/opportunity-populated--page--desktop--light.png' },
        { screen: 'opportunity-attention', state: 'opportunity-populated', viewport: '390px mobile', breakpoint: 'mobile', derivation: 'Derived.' },
        { screen: 'opportunity-attention', state: 'opportunity-command-submitting', viewport: '1440px desktop', breakpoint: 'desktop', derivation: 'Derived.' },
        { screen: 'onboarding', state: 'onboarding-empty', viewport: '1440px desktop', breakpoint: 'desktop', derivation: 'Derived.' },
      ],
    },
    accessibility: ['Labels.'], responsive: ['Reflow.'], observations: ['None.'], gaps: [],
    assets: [
      { path: 'assets/directions/opportunity-loading--page--mobile--light.content.png', role: 'direction-content', sha256: sha },
      { path: 'assets/directions/opportunity-loading--page--mobile--light.png', role: 'direction', sha256: sha, composite: { flowState: 'opportunity-loading' } },
      { path: 'assets/directions/opportunity-populated--page--desktop--light.png', role: 'direction', sha256: sha },
    ],
  },
  assets: [
    { path: 'assets/directions/opportunity-loading--page--mobile--light.content.png', role: 'direction-content', sha256: sha },
    { path: 'assets/directions/opportunity-loading--page--mobile--light.content.prompt.txt', role: 'prompt', sha256: sha },
    { path: 'assets/directions/opportunity-populated--page--desktop--light.png', role: 'direction', sha256: sha },
  ],
});

test('a record that draws a slot data status is refused', () => {
  assert.deepEqual(codes(uiShapeFindings(salesLike())), [DATA_STATUS_DRAWN, DATA_STATUS_DRAWN]);
});

test('generatedDrawingsOf: draw-render drawings make a record drawn; image_gen counts only on a record drawn before token rendering', () => {
  const gen = (path, tool, extra = {}) => ({ path, role: 'direction-content', sha256: sha, generation: { tool, promptPath: `${path}.prompt.txt` }, ...extra });
  const tokenRendered = [gen('a/default--page--desktop--light.content.png', DRAW_TOOL), gen('a/mascot.png', RASTER_TOOL, { role: 'raster-region' })];
  assert.deepEqual(generatedDrawingsOf(tokenRendered).map((a) => a.path), ['a/default--page--desktop--light.content.png'], 'a raster region is not a drawing');
  const legacy = [gen('a/legacy.png', RASTER_TOOL, { role: 'direction' })];
  assert.deepEqual(generatedDrawingsOf(legacy).map((a) => a.path), ['a/legacy.png'], 'a record drawn before token rendering keeps its image_gen directions');
  const retired = [gen('a/loading--page--desktop--light.content.png', DRAW_TOOL, { retired: 'data-status' })];
  assert.equal(generatedDrawingsOf(retired).length, 0);
});

test('recipeRenderedOf is the one rule for a record with nothing to draw', () => {
  const ui = (over) => ({ schema: 'work/ui-screen@1', ...over });
  assert.deepEqual(recipeRenderedOf(ui({ surface: 'loading' })).recipes, ['SlotView']);
  assert.deepEqual(recipeRenderedOf(ui({ surface: { desktop: 'not-found', mobile: 'not-found' } })).recipes, ['notFound()']);
  assert.deepEqual(recipeRenderedOf(ui({ surface: 'page', ui: { states: [{ name: 'list-loading' }, { name: 'list-error' }], flow: { states: ['list-not-found'] } } })).statuses, ['loading', 'error', 'not-found']);
  assert.equal(recipeRenderedOf(ui({ surface: 'page', ui: { states: [{ name: 'list-loading' }, { name: 'filled' }] } })), null, 'a record with a shape is drawn');
  assert.equal(recipeRenderedOf(ui({ surface: 'page', ui: { shapes: [{ base: 'XBase', state: 'empty', nonDerivable: 'onboarding' }] } })), null, 'a nonDerivable data status is a shape');
  assert.equal(recipeRenderedOf(ui({ surface: 'page' })), null, 'a record naming no state is not yet known to be recipe-rendered');
  assert.equal(recipeRenderedOf({ schema: 'work/implementation@1', surface: 'loading' }), null);
});
