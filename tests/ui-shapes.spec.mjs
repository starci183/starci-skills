import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseYaml, stringifyYaml } from '../engine/yaml.mjs';
import { DATA_STATUS_DRAWN, DRAW_TOOL, RASTER_TOOL, SHAPE_DUPLICATE, dataStatusOf, drawingsOf, generatedDrawingsOf, recipeRenderedOf, uiShapeFindings } from '../scripts/checks/ui-shapes.mjs';
import { checkWorkTree } from '../scripts/checks/check-example-work.mjs';

// Owner model (examples/shape-slot/README.md): a ui record's state is a SHAPE - one layout, one drawing - and a
// slot's data status (loading, skeleton, empty, error, 401/403/404) renders by recipe and is never drawn.
const ROOT = path.resolve(import.meta.dirname, '..');
const MIGRATE = path.join(ROOT, 'scripts', 'work', 'migrate-ui-shapes.mjs');
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/work-ui-screen.schema.yaml'), 'utf8')));
const errors = () => (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
const example = () => parseYaml(fs.readFileSync(path.join(ROOT, 'examples/ecommerce-app-be/.starciwork/features/identity/ui/sign-in/index.yaml'), 'utf8'));
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
  for (const shape of ['decision-pending', 'handoff-submitting', 'opportunity-populated', 'oauth-refused', 'payment-failed', 'unavailable-return', 'emptyish']) {
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

test('the ui record gate carries DATA_STATUS_DRAWN: refused on a shaped record, warned on one not yet migrated', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ui-shapes-gate-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const work = path.join(base, '.starciwork');
  const put = (rel, body) => { const file = path.join(work, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
  put('index.yaml', 'schema: work/catalog@1\nid: fixture\nfeatures: []\n');
  const legacy = example();
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
  assert.equal(hits(refused).length, 1, refused.join('\n'));
  assert.match(hits(refused)[0], /sign-up\/index\.yaml/);
  assert.equal(hits(warned).length, 1, warned.join('\n'));
  assert.match(hits(warned)[0], /sign-in\/index\.yaml/);
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
      { name: 'opportunity-command-pending', trigger: 'command sent.', behavior: 'Pending.' },
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
        { screen: 'opportunity-attention', state: 'opportunity-command-pending', viewport: '1440px desktop', breakpoint: 'desktop', derivation: 'Derived.' },
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

const migrate = (repo, ...args) => {
  const r = spawnSync(process.execPath, [MIGRATE, '--repo', repo, ...args, '--json'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  return JSON.parse(r.stdout);
};

test('migrate-ui-shapes splits states into shapes and per-slot data status, retires drawings, and is idempotent', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ui-shapes-migrate-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const file = path.join(repo, '.starciwork', 'features', 'sales', 'ui', 'workbench', 'index.yaml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, stringifyYaml(salesLike()));
  const before = fs.readFileSync(file, 'utf8');
  assert.deepEqual(codes(uiShapeFindings(salesLike())), [DATA_STATUS_DRAWN, DATA_STATUS_DRAWN], 'the unmigrated record draws opportunity-loading');

  const dry = migrate(repo, '--dry-run');
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'a dry run writes nothing');
  assert.deepEqual({ ...dry.totals }, { records: 1, changed: 1, unchanged: 0, skipped: 0, states: 6, shapes: 2, dataStatusStates: 4, slots: 2, retiredAssets: 2, mapEntriesDropped: 4, nonDerivableCandidates: 2 });
  assert.deepEqual(dry.records[0].candidates.map((c) => [c.state, c.reasons.length]), [['opportunity-loading', 1], ['onboarding-empty', 1]]);

  const applied = migrate(repo, '--apply');
  assert.equal(applied.totals.changed, 1);
  const after = parseYaml(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(after.ui.shapes, [
    { base: 'OpportunityAttentionBase', state: 'opportunity-populated', viewports: ['desktop', 'mobile'] },
    { base: 'OpportunityAttentionBase', state: 'opportunity-command-pending', viewports: ['desktop'] },
  ]);
  assert.deepEqual(after.ui.dataStatus, [
    { base: 'OpportunityAttentionBase', slot: 'opportunity', statuses: ['loading', 'empty', 'forbidden'] },
    { base: 'OnboardingBase', slot: 'onboarding', statuses: ['empty'] },
  ]);
  assert.deepEqual(after.ui.states.map((s) => s.name), ['opportunity-populated', 'opportunity-command-pending']);
  assert.deepEqual(after.ui.coverage.map.map((m) => m.state), ['opportunity-populated', 'opportunity-populated', 'opportunity-command-pending']);
  const retired = [...after.assets, ...after.ui.assets].filter((a) => a.retired).map((a) => a.path);
  assert.deepEqual([...new Set(retired)].sort(), ['assets/directions/opportunity-loading--page--mobile--light.content.png', 'assets/directions/opportunity-loading--page--mobile--light.png']);
  assert.equal(after.assets.find((a) => a.role === 'prompt').retired, undefined, 'only drawings are retired');
  assert.equal(after.change.rev, 3);
  assert.equal(after.change.kind, 'clarifying');
  assert.deepEqual(uiShapeFindings(after), [], 'a migrated record draws no data status');

  const text = fs.readFileSync(file, 'utf8');
  const again = migrate(repo, '--apply');
  assert.equal(again.totals.changed, 0);
  assert.equal(again.totals.unchanged, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), text, 'a second run rewrites nothing');
});

test('migrate-ui-shapes migrates the example ui record into a schema-valid one', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ui-shapes-example-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const file = path.join(repo, '.starciwork', 'features', 'identity', 'ui', 'sign-in', 'index.yaml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const rec = example();
  rec.ui.states.push({ name: 'session-loading', trigger: 'The session read is in flight.', behavior: 'Skeleton.' });
  rec.ui.coverage.map.push({ screen: 'sign-in', state: 'session-loading', viewport: 'desktop-1536x1024', derivation: 'Derived.' });
  fs.writeFileSync(file, stringifyYaml(rec));
  migrate(repo, '--apply');
  const after = parseYaml(fs.readFileSync(file, 'utf8'));
  assert.equal(validate(after), true, errors());
  assert.deepEqual(after.ui.shapes, [{ base: 'SignInBase', state: 'filled-welcome', viewports: ['desktop', 'mobile'] }]);
  assert.deepEqual(after.ui.dataStatus, [{ base: 'SignInBase', slot: 'session', statuses: ['loading'] }]);
});

test('migrate-ui-shapes refuses a bad invocation', () => {
  const none = spawnSync(process.execPath, [MIGRATE], { encoding: 'utf8' });
  assert.equal(none.status, 2);
  const both = spawnSync(process.execPath, [MIGRATE, '--repo', ROOT, '--apply', '--dry-run'], { encoding: 'utf8' });
  assert.equal(both.status, 2);
  const missing = spawnSync(process.execPath, [MIGRATE, '--repo', path.join(os.tmpdir(), 'no-such-starci-repo')], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
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
