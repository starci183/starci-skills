import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml, stringifyYaml } from '../engine/yaml.mjs';
import { checkShellConformance, productLocaleOf, shellBindingFindings, shellConformanceMain } from '../scripts/checks/shell-conformance.mjs';
import { checkPrerequisites, prerequisiteDetail, resolveReadPath } from '../scripts/kernel/prerequisites.mjs';
import { productLocaleFor } from '../scripts/kernel/product-locale.mjs';
import { nodeById } from '../scripts/work/layout-tree.mjs';
import { encodePng, blankImage } from '../scripts/work/png.mjs';
import { drawUi, settledProduct, uiSkeleton } from './fixtures/layout-tree.mjs';

// The layout-tree redesign (owner-approved 2026-09-24): design follows the Next.js App Router layout
// architecture. The shell record is the layout tree scanned from app/, directions are generated slot content
// composited into the real layout captures, and scripts/checks/shell-conformance.mjs is STRUCTURAL - routes,
// surfaces, ancestors, revs, composites and app/ files - keeping only the product-locale prompt rule.
const ROOT = path.resolve(import.meta.dirname, '..');
const readYaml = (rel) => parseYaml(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const Ajv2020 = (() => { const loaded = createRequire(path.join(ROOT, 'package.json'))('ajv/dist/2020.js'); return loaded?.default ?? loaded; })();
const compile = (rel) => new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(readYaml(rel));
const codes = (result) => [...new Set(result.findings.filter((f) => f.level === 'refuse').map((f) => f.code))].sort();
const CONSOLE = '/[locale]/(console)';
const bound = (p) => ({ ref: 'shell', rev: p.tree.rev, layouts: [{ node: CONSOLE, rev: 1 }] });
const both = [{ breakpoint: 'desktop', theme: 'light' }, { breakpoint: 'mobile', theme: 'light' }];

/** The settled product with a reports page, a photos list page and a routed photo detail overlay drawn. */
async function drawn(t, opts = {}) {
  const p = await settledProduct(t, opts);
  const board = await drawUi(p, 'reports/ui/board', uiSkeleton('ui.reports.board', { route: `${CONSOLE}/reports`, surface: 'page', shell: bound(p) }), both);
  const list = await drawUi(p, 'photos/ui/list', uiSkeleton('ui.photos.list', { route: `${CONSOLE}/photos`, surface: 'page', shell: bound(p) }), both);
  const detailRecord = uiSkeleton('ui.photos.detail', { route: `${CONSOLE}/photos/[id]`, surface: { desktop: 'modal', mobile: 'drawer' }, direction: { mobile: 'bottom' }, routed: true, host: 'ui.photos.list', shell: bound(p) });
  const detail = await drawUi(p, 'photos/ui/detail', detailRecord, [
    ...both.map((d) => ({ ...d, presentation: 'overlay', size: [10, 10] })), ...both.map((d) => ({ ...d, presentation: 'page' })),
  ]);
  const rewrite = (entry, mutate) => { const r = structuredClone(entry.record); mutate(r); fs.writeFileSync(entry.file, stringifyYaml(r)); return entry.dir; };
  return { p, board, list, detail, rewrite };
}

test('work/layout-tree@1 and the ui-screen route/surface/overlay/composite fields compile and refuse what they should', () => {
  const ui = compile('modules/schemas/work-ui-screen.schema.yaml');
  const base = uiSkeleton('ui.photos.detail');
  const errorsAt = (record, key) => { ui(record); return (ui.errors ?? []).filter((e) => e.instancePath.startsWith(`/${key}`)); };
  assert.deepEqual(errorsAt({ ...base, route: `${CONSOLE}/photos/[id]`, surface: { desktop: 'modal', mobile: 'drawer' }, direction: { mobile: 'bottom' }, routed: true, host: 'ui.photos.list' }, 'surface'), []);
  assert.ok(errorsAt({ ...base, surface: 'sheet' }, 'surface').length, 'there is no sheet surface: a bottom sheet is a drawer from the bottom');
  assert.ok(errorsAt({ ...base, surface: { mobile: 'page' } }, 'surface').length, 'only a modal or drawer varies per breakpoint');
  assert.ok(errorsAt({ ...base, direction: 'up' }, 'direction').length);
  assert.deepEqual(errorsAt({ ...base, direction: { desktop: 'right', mobile: 'bottom' } }, 'direction'), []);
  assert.ok(errorsAt({ ...base, route: 'photos' }, 'route').length, 'a route is a layout tree node id');
  assert.ok(errorsAt({ ...base, host: 'photos list' }, 'host').length);
  assert.deepEqual(errorsAt({ ...base, shell: { ref: 'shell', rev: 2, layouts: [{ node: CONSOLE, rev: 1 }] } }, 'shell'), []);
  const example = readYaml('examples/todo-app-backend/.starciwork/features/task/ui/list/index.yaml');
  delete example.shell;
  ui(example);
  assert.deepEqual((ui.errors ?? []).filter((e) => /^\/(route|surface|shell|direction|routed|host)/.test(e.instancePath)), [], 'a historical ui record without the new fields still compiles');
});

test('a settled tree, a page and a routed overlay drawn in both presentations pass the structural check', async (t) => {
  const { p, board, detail } = await drawn(t);
  for (const dir of [board.dir, detail.dir]) {
    const result = checkShellConformance(dir);
    assert.equal(result.mode, 'ui');
    assert.deepEqual(result.refused, [], dir);
  }
  const tree = checkShellConformance(path.join(p.work, 'shell'));
  assert.equal(tree.mode, 'shell');
  assert.deepEqual(tree.refused, []);
  for (const code of ['NAV_ROUTE_MISSING', 'SHELL_NAV_LABEL_MISSING', 'ROUTE_NOT_IN_NAV']) assert.ok(tree.suspect.some((s) => s.includes(`[${code}]`)), `the frontend's nav mismatch ${code} is reported, never hidden`);
  assert.ok(tree.info.some((s) => s.includes('[NAV_ROUTE_NULL]')));
});

test('route, surface, direction, routed and host must hold together', async (t) => {
  const { detail, board, rewrite } = await drawn(t);
  const check = (dir) => codes(checkShellConformance(dir));
  assert.ok(check(rewrite(board, (r) => { r.route = `${CONSOLE}/nowhere`; })).includes('UI_ROUTE_UNKNOWN'));
  assert.ok(!check(rewrite(board, (r) => { r.route = `${CONSOLE}/reports/new`; r.routeParent = `${CONSOLE}/reports`; })).includes('UI_ROUTE_UNKNOWN'), 'a new route under an existing routeParent is declared, not unknown');
  assert.ok(check(rewrite(detail, (r) => { delete r.direction; })).includes('DRAWER_DIRECTION_MISSING'));
  assert.ok(check(rewrite(detail, (r) => { r.direction = { desktop: 'right', mobile: 'bottom' }; })).includes('DIRECTION_FORBIDDEN'), 'the desktop surface is a modal');
  assert.ok(check(rewrite(board, (r) => { r.direction = 'left'; })).includes('DIRECTION_FORBIDDEN'));
  assert.ok(check(rewrite(detail, (r) => { delete r.routed; })).includes('OVERLAY_ROUTED_MISSING'));
  assert.ok(check(rewrite(detail, (r) => { delete r.host; })).includes('OVERLAY_HOST_MISSING'));
  assert.ok(check(rewrite(detail, (r) => { r.host = 'ui.nothing.here'; })).includes('OVERLAY_HOST_UNRESOLVED'));
  assert.ok(check(rewrite(board, (r) => { r.routed = true; r.host = 'ui.photos.list'; })).includes('ROUTED_FORBIDDEN'));
  assert.ok(check(rewrite(board, (r) => { r.surface = 'sheet'; })).includes('SURFACE_INVALID'));
  assert.ok(check(rewrite(board, (r) => { r.surface = { tablet: 'modal' }; })).includes('SURFACE_BREAKPOINT_UNKNOWN'));
  assert.ok(check(rewrite(board, (r) => { r.persona = 'auditor'; })).includes('PERSONA_UNKNOWN'));
});

test('a routed overlay needs both presentations; a non-routed one has no page presentation', async (t) => {
  const { detail, rewrite } = await drawn(t);
  const overlayOnly = rewrite(detail, (r) => { r.assets = r.assets.filter((a) => a.composite?.presentation !== 'page' && !(a.role === 'direction-content' && /--page--/.test(a.path))); });
  assert.ok(codes(checkShellConformance(overlayOnly)).includes('ROUTED_OVERLAY_PRESENTATION_MISSING'));
  const pageOnly = rewrite(detail, (r) => { r.assets = r.assets.filter((a) => a.composite?.presentation !== 'overlay' && !(a.role === 'direction-content' && /--overlay--/.test(a.path))); });
  assert.ok(codes(checkShellConformance(pageOnly)).includes('ROUTED_OVERLAY_PRESENTATION_MISSING'));
  const unrouted = rewrite(detail, (r) => { r.routed = false; });
  assert.ok(codes(checkShellConformance(unrouted)).includes('OVERLAY_PAGE_FORBIDDEN'), 'a component-state overlay has no URL, so no full-page drawing');
});

test('ancestors settled and rev-current; composites on the exact current capture and reproducible', async (t) => {
  const { p, board, rewrite } = await drawn(t);
  const tree = structuredClone(p.tree);
  nodeById(tree, CONSOLE).layout.state = 'todo';
  p.save(tree);
  assert.ok(codes(checkShellConformance(board.dir)).includes('LAYOUT_ANCESTOR_UNSETTLED'));
  nodeById(tree, CONSOLE).layout.state = 'done';
  nodeById(tree, CONSOLE).layout.rev = 2;
  p.save(tree);
  assert.ok(codes(checkShellConformance(board.dir)).includes('LAYOUT_REV_STALE'), 'a re-captured layout stales what was composited into it');
  p.save(p.tree);
  assert.ok(codes(checkShellConformance(rewrite(board, (r) => { r.shell = { ref: 'shell', rev: p.tree.rev }; }))).includes('LAYOUT_BINDING_MISSING'));
  const wrongCapture = rewrite(board, (r) => { r.assets.find((a) => a.composite?.breakpoint === 'desktop').composite.layout.capture = 'shell/assets/layouts/locale-console--mobile--light.png'; });
  assert.ok(codes(checkShellConformance(wrongCapture)).includes('COMPOSITE_LAYOUT_MISMATCH'), 'a composite references the capture of its own breakpoint and theme');
  rewrite(board, () => {});
  const png = path.join(board.dir, board.record.assets.find((a) => a.composite?.breakpoint === 'desktop').path);
  fs.writeFileSync(png, encodePng(blankImage(40, 30, [0, 0, 0, 255])));
  assert.ok(codes(checkShellConformance(board.dir)).includes('COMPOSITE_NOT_REPRODUCIBLE'), 'a redrawn or edited composite is caught by its pixels');
});

test('a nested visible layout that is not settled blocks only the pages under it', async (t) => {
  const p = await settledProduct(t, { photosVisible: true });
  const board = await drawUi(p, 'reports/ui/board', uiSkeleton('ui.reports.board', { route: `${CONSOLE}/reports`, surface: 'page', shell: bound(p) }), both);
  assert.deepEqual(checkShellConformance(board.dir).refused, [], 'reports sits outside the photos layout');
  const dir = path.join(p.work, 'features', 'photos', 'ui', 'list');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.yaml'), stringifyYaml(uiSkeleton('ui.photos.list', { route: `${CONSOLE}/photos`, surface: 'page', shell: bound(p) })));
  assert.ok(codes(checkShellConformance(dir)).includes('LAYOUT_ANCESTOR_UNSETTLED'));
});

test('dispatch refuses a draw under an unsettled layout and admits a layout drawn first (reads.shell layoutChain)', async (t) => {
  const { p } = await drawn(t);
  const draw = readYaml('modules/ops/ops/interface.draw.yaml');
  const read = draw.reads.find((r) => r.id === 'shell');
  assert.equal(read.mustExist, true);
  assert.equal(read.layoutChain, true);
  const brief = { reads: draw.reads, graphPolicy: { prerequisiteState: 'never' } };
  const repo = path.dirname(p.work);
  const admit = (owned) => checkPrerequisites({ brief, repo, payload: { owned_paths: [owned] } });
  assert.deepEqual(admit('.starciwork/features/reports/ui/board').unmet, []);
  const tree = structuredClone(p.tree);
  nodeById(tree, CONSOLE).layout.state = 'todo';
  p.save(tree);
  const refused = admit('.starciwork/features/reports/ui/board').unmet;
  assert.equal(refused.length, 1);
  assert.equal(refused[0].kind, 'layout-unsettled');
  assert.equal(refused[0].layouts[0].node, CONSOLE);
  assert.match(prerequisiteDetail({ op: 'interface.draw', jobId: 'j1', unmet: refused }), /under layout\(s\) not yet settled/);
  const frame = path.join(p.work, 'features', 'console', 'ui', 'frame');
  fs.mkdirSync(frame, { recursive: true });
  fs.writeFileSync(path.join(frame, 'index.yaml'), stringifyYaml(uiSkeleton('ui.console.frame', { route: CONSOLE, surface: 'layout' })));
  assert.deepEqual(admit('.starciwork/features/console/ui/frame').unmet, [], 'a surface-layout record waits only on the layouts above its own node - layouts are drawn first');
  assert.equal(admit('.starciwork/features/new/ui/thing').unknown[0].kind, 'layout-chain-unknown', 'a record not written yet is unknown and admits');
  fs.writeFileSync(path.join(p.work, 'shell', 'index.yaml'), stringifyYaml({ schema: 'work/app-shell@1', id: 'shell' }));
  assert.match(admit('.starciwork/features/reports/ui/board').unmet[0].layouts[0].reasons[0], /not work\/layout-tree@1/);
  assert.deepEqual(resolveReadPath('.starciwork/shell/index.yaml', []), ['.starciwork/shell/index.yaml']);
});

test('interface.implement must create the app/ files the routed ui records name', async (t) => {
  const { p } = await drawn(t);
  const implDir = path.join(p.work, 'features', 'photos', 'impl', 'web', 'detail');
  fs.mkdirSync(implDir, { recursive: true });
  fs.writeFileSync(path.join(implDir, 'index.yaml'), stringifyYaml({ schema: 'work/implementation@1', id: 'impl.photos.web.detail', title: 'Photo detail', state: 'todo', repository: 'web', proves: ['ui.photos.detail', 'ui.reports.board'] }));
  assert.deepEqual(checkShellConformance(implDir).refused, [], 'the page, the reports page and the @modal/(.)photos/[id] intercept exist');
  fs.rmSync(path.join(p.appDir, '[locale]', '(console)', '@modal', '(.)photos'), { recursive: true });
  assert.deepEqual(codes(checkShellConformance(implDir)), ['IMPL_INTERCEPT_MISSING']);
  fs.rmSync(path.join(p.appDir, '[locale]', '(console)', 'reports', 'page.tsx'));
  assert.ok(codes(checkShellConformance(implDir)).includes('IMPL_ROUTE_FILE_MISSING'));
});

test('the product-locale rule is kept: every content prompt states it', async (t) => {
  const p = await settledProduct(t);
  const board = await drawUi(p, 'reports/ui/board', uiSkeleton('ui.reports.board', { route: `${CONSOLE}/reports`, surface: 'page', shell: bound(p) }), both, { prompt: 'Reports board, copy in English.' });
  assert.ok(codes(checkShellConformance(board.dir)).includes('SHELL_LOCALE_DRIFT'));
  assert.deepEqual(productLocaleOf(p.work), { locale: 'vi', source: 'shell/index.yaml productLocale.default' });
  assert.equal(productLocaleFor(path.dirname(p.work)).locale, 'vi');
  fs.rmSync(path.join(p.work, 'shell'), { recursive: true, force: true });
  fs.mkdirSync(path.join(p.work, 'brand'), { recursive: true });
  fs.writeFileSync(path.join(p.work, 'brand', 'index.yaml'), stringifyYaml({ brand: { voice: { locales: [{ locale: 'en' }, { locale: 'vi', default: true }] } } }));
  assert.equal(productLocaleOf(p.work).locale, 'vi', 'a flagged brand default outranks list order');
  assert.equal(productLocaleFor(null), null);
});

test('starci validate lists records drawn before the layout tree as suspects, and a legacy shell as a suspect', async (t) => {
  const p = await settledProduct(t);
  const legacyUi = path.join(p.work, 'features', 'old', 'ui', 'screen');
  fs.mkdirSync(legacyUi, { recursive: true });
  fs.writeFileSync(path.join(legacyUi, 'index.yaml'), stringifyYaml(uiSkeleton('ui.old.screen')));
  const findings = shellBindingFindings(p.work);
  assert.deepEqual(findings.map((f) => [f.level, f.code]).sort(), [['suspect', 'SHELL_BINDING_MISSING'], ['suspect', 'UI_ROUTE_MISSING']]);
  fs.writeFileSync(path.join(p.work, 'shell', 'index.yaml'), stringifyYaml({ schema: 'work/app-shell@1', id: 'shell', productLocale: { default: 'vi', fallback: 'vi', locales: ['vi'] } }));
  const legacy = shellBindingFindings(p.work).map((f) => [f.level, f.code]);
  assert.ok(legacy.some(([l, c]) => l === 'suspect' && c === 'SHELL_RECORD_LEGACY'));
  assert.ok(legacy.every(([l]) => l !== 'refuse'), 'nothing written before the layout tree is refused by validate');
  assert.deepEqual(codes(checkShellConformance(path.join(p.work, 'shell'))), ['SHELL_RECORD_LEGACY'], 'the op proof refuses it until converted');
  assert.match(read('scripts/checks/work-validate.mjs'), /shellBindingFindings\(root, enclosingWorkRoot\)/);
});

test('the contracts wire the layout tree: owner op, draw, implement, audit, scaffold, cut order, locale rule, catalog', () => {
  const kinds = readYaml('modules/models/kinds.yaml');
  const records = readYaml('modules/models/records.yaml');
  assert.equal(records.records.shell.schema, 'work/layout-tree@1');
  assert.ok(kinds.vocabularies.schemas.includes('work/layout-tree@1'));
  assert.ok(kinds.vocabularies.schemas.includes('work/app-shell@1'), 'the legacy family stays readable');
  for (const kind of ['interface.draw', 'interface.implement', 'interface.audit']) {
    assert.ok(kinds.kinds[kind].reads.includes('shell'), `${kind} reads shell`);
    assert.ok(kinds.kinds[kind].checks.includes('scripts/checks/shell-conformance.mjs'), `${kind} runs the check`);
  }
  assert.ok(kinds.kinds['brand.decide'].carries.includes('work/layout-tree@1'));
  assert.ok(kinds.kinds['interface.scaffold'].carries.includes('work/layout-tree@1'));
  assert.match(read('modules/models/kinds.yaml'), /LAYOUTS FIRST, ENFORCED/);
  const catalog = readYaml('modules/schemas/index.yaml').schemas;
  assert.ok(catalog.some((s) => s.id === 'work/layout-tree@1' && s.file === 'modules/schemas/work-layout-tree.schema.yaml'));
  assert.ok(catalog.some((s) => s.id === 'work/app-shell@1' && /SUPERSEDED/.test(s.governs)));

  const draw = readYaml('modules/ops/ops/interface.draw.yaml');
  for (const field of ['route', 'surface', 'direction', 'routed', 'host']) assert.ok(draw.writes.find((w) => w.id === 'node').fields.includes(field), `draw writes ${field}`);
  assert.ok(draw.blockers.some((b) => b.code === 'LAYOUT_ANCESTOR_UNSETTLED'));
  assert.match(draw.steps[1].action.en, /ImageGen never draws chrome/);
  assert.match(draw.steps[1].action.en, /compose-direction\.mjs/);
  assert.match(draw.steps[1].action.en, /both presentations/);
  assert.doesNotMatch(JSON.stringify(draw), /\bsheet\b(?! is| from)/, 'no sheet surface is offered');
  assert.equal(draw.proofs.find((p) => p.id === 'shell-conformance').check, 'scripts/checks/shell-conformance.mjs');
  const brand = readYaml('modules/ops/ops/brand.decide.yaml');
  assert.equal(brand.writes.find((w) => w.id === 'shellNode').schema, 'work/layout-tree@1');
  assert.match(brand.steps.find((s) => s.writes.includes('shellNode')).action.en, /layout-tree\.mjs scan/);
  assert.equal(readYaml('modules/ops/ops/interface.scaffold.yaml').writes.find((w) => w.id === 'shellNode').schema, 'work/layout-tree@1');
  const implement = readYaml('modules/ops/ops/interface.implement.yaml');
  assert.match(JSON.stringify(implement.steps), /@modal\/\(\.\)<segment>\/page\.tsx/);
  const audit = readYaml('modules/ops/ops/interface.audit.yaml');
  assert.equal(audit.policy.auditPolicy.layoutLens.directionDrift.route, 'interface.draw');
  assert.equal(audit.policy.auditPolicy.layoutLens.implementationDrift.route, 'interface.implement');
  assert.ok(audit.policy.findingSchema.categories.includes('layout.structure'));
  const common = readYaml('modules/ops/_common.yaml');
  assert.ok(common.sections.some((s) => /productLocale/.test(s.title) && s.blocks.some((b) => /App Router/.test(b)) && s.blocks.some((b) => /composited, never drawn/.test(b))));
  assert.match(read('modules/kernel/dispatch.yaml'), /product_locale:/);
  assert.match(read('modules/schemas/op.schema.yaml'), /layoutChain:/);
});

test('the CLI exits 2 on a bad argument', () => {
  assert.equal(shellConformanceMain([]).exitCode, 2);
  assert.equal(shellConformanceMain(['a', 'b']).exitCode, 2);
  assert.equal(shellConformanceMain([path.join(os.tmpdir(), 'no-such-starci-dir-xyz')]).exitCode, 2);
});
