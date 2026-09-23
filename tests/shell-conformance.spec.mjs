import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml, stringifyYaml } from '../engine/yaml.mjs';
import { checkShellConformance, productLocaleOf, shellBindingFindings, shellConformanceMain } from '../scripts/checks/shell-conformance.mjs';
import { checkPrerequisites, resolveReadPath } from '../scripts/kernel/prerequisites.mjs';
import { productLocaleFor } from '../scripts/kernel/product-locale.mjs';

// wf-nivo-modules-agentos: three parallel interface.draw workers of one cut each invented their own logo,
// sidebar, UI language and tenant, and none matched the real nivo-fe shell. The shell record
// (work/app-shell@1) is the one chrome every direction is handed and every build is wrapped by, and
// scripts/checks/shell-conformance.mjs holds both to it.
const ROOT = path.resolve(import.meta.dirname, '..');
const readYaml = (rel) => parseYaml(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const Ajv2020 = (() => { const loaded = createRequire(path.join(ROOT, 'package.json'))('ajv/dist/2020.js'); return loaded?.default ?? loaded; })();
const compile = (rel) => new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(readYaml(rel));

const LAYOUT_SRC = 'export const ConsoleLayout = ({children}) => <div>{children}</div>\n';
const LOCKUP = 'lockup-png-bytes';
const CAPTURE = 'shell-png-bytes';

const shellRecord = (over = {}) => ({
  schema: 'work/app-shell@1', id: 'shell', kind: 'shell', state: 'done', rev: 2, origin: 'repository',
  app: { repository: 'web', root: 'apps/app' },
  source: {
    layout: { component: 'ConsoleLayout', path: 'apps/app/src/shell/ConsoleLayout.tsx', sha256: sha(LAYOUT_SRC) },
    files: [{ path: 'apps/app/src/shell/ConsoleLayout.tsx', role: 'layout', sha256: sha(LAYOUT_SRC) }],
  },
  topBar: { component: 'ConsoleTopBar', brand: { component: 'NivoBrand', asset: 'assets/brand-lockup.png' }, slots: [{ key: 'locale', purpose: 'switch locale' }], absent: ['search', 'notifications'] },
  nav: { component: 'Sidebar', items: [
    { key: 'chat', route: '/chat', i18nKey: 'console.nav.chat', labels: { vi: 'Trò chuyện', en: 'Chat' } },
    { key: 'modules', route: '/agentos', i18nKey: 'console.nav.modules', labels: { vi: 'Mô-đun', en: 'Modules' } },
    { key: 'settings', route: null, i18nKey: 'console.nav.settings', labels: { vi: 'Cài đặt', en: 'Settings' } },
  ] },
  productLocale: { default: 'vi', fallback: 'vi', locales: ['vi', 'en'] },
  persona: { workspace: 'Nivo Demo', user: 'Lan Nguyen', currency: 'VND', dateFormat: 'dd/MM/yyyy' },
  assets: [
    { path: 'assets/brand-lockup.png', role: 'brand-lockup', sha256: sha(LOCKUP) },
    { path: 'assets/shell-desktop.png', role: 'shell-capture', sha256: sha(CAPTURE), viewport: '1440x900', theme: 'light', locale: 'vi' },
  ],
  ...over,
});

const GOOD_PROMPT = [
  'Nivo console, modules page. Product locale: vi.',
  'Sidebar destinations verbatim: Trò chuyện, Mô-đun (selected), Cài đặt.',
  'Workspace Nivo Demo, signed in as Lan Nguyen, amounts in VND, dates dd/MM/yyyy.',
].join('\n');

const REFS = ['.starciwork/shell/assets/brand-lockup.png', '.starciwork/shell/assets/shell-desktop.png'];
const uiRecord = (over = {}) => ({
  schema: 'work/ui-screen@1', id: 'ui.modules.list', title: 'Modules', state: 'todo', brand: { rev: 1 },
  shell: { ref: 'shell', rev: 2, activeNav: 'modules' }, refs: ['fr.modules.list'],
  assets: [
    { path: 'assets/list.png', role: 'direction', sha256: sha('png'), generation: { tool: 'image_gen.imagegen', promptPath: 'assets/list.prompt.txt', referencedImages: REFS } },
    { path: 'assets/list.prompt.txt', role: 'prompt', sha256: sha('prompt') },
  ],
  ...over,
});

/** A two-repository tree: tmp/backend/.starciwork beside tmp/web (the frontend the shell was read from). */
function tree(t, { shell = shellRecord(), ui = uiRecord(), prompt = GOOD_PROMPT, layoutSrc = LAYOUT_SRC } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-shell-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const work = path.join(base, 'backend', '.starciwork');
  const put = (rel, body) => { const file = path.join(base, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
  put('backend/.starciwork/workspace.yaml', stringifyYaml({ schema: 'work/workspace@1', id: 'nivo', repositories: [{ role: 'be', name: 'backend' }, { role: 'fe', name: 'web' }] }));
  if (shell) put('backend/.starciwork/shell/index.yaml', stringifyYaml(shell));
  put('backend/.starciwork/shell/assets/brand-lockup.png', LOCKUP);
  put('backend/.starciwork/shell/assets/shell-desktop.png', CAPTURE);
  put('web/apps/app/src/shell/ConsoleLayout.tsx', layoutSrc);
  if (ui) put('backend/.starciwork/features/modules/ui/list/index.yaml', stringifyYaml(ui));
  put('backend/.starciwork/features/modules/ui/list/assets/list.prompt.txt', prompt);
  return { base, work, ui: path.join(work, 'features', 'modules', 'ui', 'list'), put };
}
const codes = (result) => result.findings.filter((f) => f.level === 'refuse').map((f) => f.code).sort();

test('work/app-shell@1: a captured shell, a planned shell and the shapes it refuses', () => {
  const validate = compile('modules/schemas/work-app-shell.schema.yaml');
  assert.equal(validate(shellRecord()), true, JSON.stringify(validate.errors));
  const planned = shellRecord({ origin: 'planned', assets: [shellRecord().assets[0]] });
  delete planned.source;
  assert.equal(validate(planned), true, 'a planned shell needs no source and no shell capture, only the lockup');
  assert.equal(validate(shellRecord({ assets: [shellRecord().assets[0]] })), false, 'origin repository without a real shell capture');
  assert.equal(validate(shellRecord({ assets: [shellRecord().assets[1]] })), false, 'no brand-lockup capture');
  const noSource = shellRecord(); delete noSource.source;
  assert.equal(validate(noSource), false, 'origin repository names its source');
  assert.equal(validate(shellRecord({ persona: { workspace: 'W', user: 'U', currency: 'dong', dateFormat: 'd' } })), false, 'currency is ISO 4217');
  assert.equal(validate(shellRecord({ id: 'shell.main' })), false, 'one shell per tree, id shell');
  const partial = { schema: 'work/app-shell@1', id: 'shell', kind: 'shell', state: 'todo', rev: 1, origin: 'repository', app: { root: '.' }, nav: shellRecord().nav, productLocale: shellRecord().productLocale, blockers: ['No lockup yet.'] };
  assert.equal(validate(partial), true, 'a todo shell may be partial and says why');
  assert.equal(validate({ ...partial, state: 'done' }), false, 'a done shell carries its top bar, persona, source and captures');
  const example = readYaml('examples/todo-app-backend/.starciwork/shell/index.yaml');
  assert.equal(validate(example), true, JSON.stringify(validate.errors));
  assert.equal(example.state, 'todo', 'the todo example is honestly unsettled');
});

test('work/ui-screen@1: shell binds by {ref, rev} or {chromeless, because}, and stays optional for records drawn before it', () => {
  const validate = compile('modules/schemas/work-ui-screen.schema.yaml');
  const shellErrors = (record) => { validate(record); return (validate.errors ?? []).filter((e) => e.instancePath.startsWith('/shell') || e.params?.missingProperty === 'shell' || e.params?.additionalProperty === 'shell'); };
  const example = readYaml('examples/todo-app-backend/.starciwork/features/task/ui/list/index.yaml');
  delete example.shell;
  assert.deepEqual(shellErrors(example), [], 'a historical ui record without a binding still compiles');
  assert.deepEqual(shellErrors({ ...example, shell: { ref: 'shell', rev: 3, activeNav: 'modules' } }), []);
  assert.deepEqual(shellErrors({ ...example, shell: { chromeless: true, because: 'The sign-in route is pre-auth.' } }), []);
  assert.ok(shellErrors({ ...example, shell: { chromeless: true } }).length, 'chromeless needs a because');
  assert.ok(shellErrors({ ...example, shell: { ref: 'brand', rev: 1 } }).length, 'the ref is the shell record');
  assert.ok(shellErrors({ ...example, shell: { ref: 'shell' } }).length, 'a binding without rev cannot go stale');
});

test('a direction drawn inside the recorded shell passes', (t) => {
  const { ui } = tree(t);
  const result = checkShellConformance(ui);
  assert.equal(result.mode, 'ui');
  assert.deepEqual(result.refused, []);
  assert.equal(result.ok, true);
});

test('prompt drift is refused: nav labels, product locale, persona, lockup and shell references', (t) => {
  assert.deepEqual(codes(checkShellConformance(tree(t, { prompt: GOOD_PROMPT.replace('Mô-đun', 'Modules') }).ui)), ['SHELL_NAV_LABEL_DRIFT']);
  assert.deepEqual(codes(checkShellConformance(tree(t, { prompt: GOOD_PROMPT.replace('Product locale: vi.', 'UI in English.') }).ui)), ['SHELL_LOCALE_DRIFT']);
  assert.deepEqual(codes(checkShellConformance(tree(t, { prompt: GOOD_PROMPT.replace('Nivo Demo', 'Acme Trading') }).ui)), ['SHELL_PERSONA_DRIFT']);
  const noLockup = uiRecord(); noLockup.assets[0].generation.referencedImages = [REFS[1]];
  assert.deepEqual(codes(checkShellConformance(tree(t, { ui: noLockup }).ui)), ['SHELL_LOCKUP_NOT_REFERENCED']);
  const noCapture = uiRecord(); noCapture.assets[0].generation.referencedImages = [REFS[0]];
  assert.deepEqual(codes(checkShellConformance(tree(t, { ui: noCapture }).ui)), ['SHELL_CAPTURE_NOT_REFERENCED']);
  assert.deepEqual(codes(checkShellConformance(tree(t, { prompt: GOOD_PROMPT.replace('Product locale: vi.', 'Product locale: vietnamese') }).ui)), ['SHELL_LOCALE_DRIFT'],
    'the locale tag must be the exact tag, not a word that starts with it');
});

test('binding and shell-state refusals: missing, stale, unresolved, unsettled, drifted, no lockup', (t) => {
  const unbound = uiRecord(); delete unbound.shell;
  assert.deepEqual(codes(checkShellConformance(tree(t, { ui: unbound }).ui)), ['SHELL_BINDING_MISSING']);
  assert.deepEqual(codes(checkShellConformance(tree(t, { ui: uiRecord({ shell: { ref: 'shell', rev: 1 } }) }).ui)), ['SHELL_REV_STALE']);
  assert.deepEqual(codes(checkShellConformance(tree(t, { shell: null }).ui)), ['SHELL_REF_UNRESOLVED']);
  assert.deepEqual(codes(checkShellConformance(tree(t, { shell: shellRecord({ state: 'todo' }) }).ui)), ['SHELL_UNSETTLED']);
  assert.deepEqual(codes(checkShellConformance(tree(t, { layoutSrc: `${LAYOUT_SRC}// edited\n` }).ui)), ['SHELL_SOURCE_DRIFT']);
  assert.deepEqual(codes(checkShellConformance(tree(t, { ui: uiRecord({ shell: { ref: 'shell', rev: 2, activeNav: 'billing' } }) }).ui)), ['SHELL_BINDING_INVALID']);
  const lockless = shellRecord({ assets: [shellRecord().assets[1]] });
  const { work } = tree(t, { shell: lockless });
  assert.ok(codes(checkShellConformance(path.join(work, 'shell'))).includes('SHELL_LOCKUP_MISSING'));
  const shellFile = checkShellConformance(path.join(work, 'shell', 'index.yaml'));
  assert.equal(shellFile.mode, 'shell', 'the record file names its directory, as the op proofs cite it');
  assert.ok(codes(shellFile).includes('SHELL_LOCKUP_MISSING'));
});

test('a chromeless screen keeps the lockup and the product locale but draws no chrome', (t) => {
  const ui = uiRecord({ shell: { chromeless: true, because: 'Sign-in is pre-auth.' } });
  ui.assets[0].generation.referencedImages = [REFS[0]];
  assert.deepEqual(codes(checkShellConformance(tree(t, { ui, prompt: 'Sign-in card. Product locale: vi. Lockup only.' }).ui)), []);
  assert.deepEqual(codes(checkShellConformance(tree(t, { ui, prompt: 'Sign-in card in English.' }).ui)), ['SHELL_LOCALE_DRIFT']);
});

test('an implementation is wrapped by the named layout component, directly or through an ancestor route layout', (t) => {
  const impl = { schema: 'work/implementation@1', id: 'impl.modules.list', title: 'Modules list', state: 'todo', repository: 'web', owners: [{ role: 'route', path: 'apps/app/src/app/(console)/modules' }] };
  const setup = (files) => {
    const env = tree(t);
    env.put('backend/.starciwork/features/modules/impl/web/list/index.yaml', stringifyYaml(impl));
    for (const [rel, body] of Object.entries(files)) env.put(`web/${rel}`, body);
    return path.join(env.work, 'features', 'modules', 'impl', 'web', 'list');
  };
  assert.deepEqual(codes(checkShellConformance(setup({ 'apps/app/src/app/(console)/modules/page.tsx': 'export default () => <main>Modules</main>\n' }))), ['SHELL_LAYOUT_UNUSED']);
  assert.deepEqual(codes(checkShellConformance(setup({
    'apps/app/src/app/(console)/modules/page.tsx': 'export default () => <main>Modules</main>\n',
    'apps/app/src/app/(console)/layout.tsx': "import { ConsoleLayout } from '@/shell/ConsoleLayout'\nexport default ({children}) => <ConsoleLayout>{children}</ConsoleLayout>\n",
  }))), [], 'the route-group layout wraps the page');
  assert.deepEqual(codes(checkShellConformance(setup({ 'apps/app/src/app/(console)/modules/page.tsx': "import { ConsoleLayout } from '@/shell/ConsoleLayout'\n" }))), []);
  assert.deepEqual(codes(checkShellConformance(setup({ 'apps/app/src/app/(console)/modules/page.tsx': 'const MyConsoleLayoutish = 1\n' }))), ['SHELL_LAYOUT_UNUSED'], 'a longer identifier is not the component');
});

test('starci validate reports a historical unbound ui record as a suspect, never a refusal', (t) => {
  const unbound = uiRecord(); delete unbound.shell;
  const { work } = tree(t, { ui: unbound });
  const findings = shellBindingFindings(work);
  assert.deepEqual(findings.map((f) => [f.level, f.code]), [['suspect', 'SHELL_BINDING_MISSING']]);
  const { work: stale } = tree(t, { ui: uiRecord({ shell: { ref: 'shell', rev: 1 } }) });
  assert.deepEqual(shellBindingFindings(stale).map((f) => [f.level, f.code]), [['suspect', 'SHELL_REV_STALE']]);
  const { work: dangling } = tree(t, { shell: null });
  assert.deepEqual(shellBindingFindings(dangling).map((f) => [f.level, f.code]), [['refuse', 'SHELL_REF_UNRESOLVED']]);
  assert.match(read('scripts/checks/work-validate.mjs'), /shellBindingFindings\(root, enclosingWorkRoot\)/);
});

test('product_locale is the shell default, else the brand voice default, never owner_language', (t) => {
  const { work, base } = tree(t);
  assert.deepEqual(productLocaleOf(work), { locale: 'vi', source: 'shell/index.yaml productLocale.default' });
  assert.equal(productLocaleFor(path.join(base, 'backend')).locale, 'vi');
  fs.rmSync(path.join(work, 'shell'), { recursive: true, force: true });
  assert.equal(productLocaleOf(work), null);
  fs.mkdirSync(path.join(work, 'brand'), { recursive: true });
  fs.writeFileSync(path.join(work, 'brand', 'index.yaml'), stringifyYaml({ brand: { voice: { locales: [{ locale: 'en' }, { locale: 'vi', default: true }] } } }));
  assert.equal(productLocaleOf(work).locale, 'vi', 'a flagged default outranks list order');
  assert.equal(productLocaleFor(null), null);
});

test('api dispatch refuses interface.draw until the shell record exists (reads.shell mustExist)', (t) => {
  const draw = readYaml('modules/ops/ops/interface.draw.yaml');
  const shellRead = draw.reads.find((r) => r.id === 'shell');
  assert.equal(shellRead.path, '.starciwork/shell/index.yaml');
  assert.equal(shellRead.mustExist, true);
  assert.deepEqual(resolveReadPath('.starciwork/shell/index.yaml', []), ['.starciwork/shell/index.yaml'], 'a fixed path resolves to itself');
  assert.deepEqual(resolveReadPath('.starciwork/features/*/ui/**', []), [], 'a glob still never resolves');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-shell-prereq-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const brief = { reads: draw.reads, graphPolicy: { prerequisiteState: 'never' } };
  assert.deepEqual(checkPrerequisites({ brief, repo, payload: { owned_paths: ['.starciwork/features/m/ui/list'] } }).unmet,
    [{ kind: 'record-missing', read: 'shell', path: '.starciwork/shell/index.yaml' }]);
  fs.mkdirSync(path.join(repo, '.starciwork', 'shell'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.starciwork', 'shell', 'index.yaml'), 'schema: work/app-shell@1\n');
  assert.deepEqual(checkPrerequisites({ brief, repo, payload: { owned_paths: ['.starciwork/features/m/ui/list'] } }).unmet, []);
});

test('the contracts wire the shell record: owner op, draw, implement, audit, cut order, locale rule, packet', () => {
  const kinds = readYaml('modules/models/kinds.yaml');
  const records = readYaml('modules/models/records.yaml');
  assert.equal(records.records.shell.schema, 'work/app-shell@1');
  assert.ok(records.records.design.reads.includes('shell'));
  assert.ok(kinds.vocabularies.schemas.includes('work/app-shell@1'));
  for (const kind of ['interface.draw', 'interface.implement', 'interface.audit']) {
    assert.ok(kinds.kinds[kind].reads.includes('shell'), `${kind} reads shell`);
    assert.ok(kinds.kinds[kind].checks.includes('scripts/checks/shell-conformance.mjs'), `${kind} runs the check`);
  }
  for (const kind of ['brand.decide', 'interface.scaffold']) {
    assert.ok(kinds.kinds[kind].writes.includes('shell'), `${kind} writes shell`);
    assert.ok(kinds.kinds[kind].carries.includes('work/app-shell@1'));
  }
  assert.match(read('modules/models/kinds.yaml'), /SHELL FIRST, ENFORCED/);
  assert.ok(readYaml('modules/schemas/index.yaml').schemas.some((s) => s.id === 'work/app-shell@1' && s.file === 'modules/schemas/work-app-shell.schema.yaml'));
  assert.equal(readYaml('modules/schemas/work-layout.yaml').shape.shell, 'shell/index.yaml');

  const draw = readYaml('modules/ops/ops/interface.draw.yaml');
  assert.ok(draw.blockers.some((b) => b.code === 'APP_SHELL_UNSETTLED'));
  assert.equal(draw.proofs.find((p) => p.id === 'shell-conformance').check, 'scripts/checks/shell-conformance.mjs');
  assert.match(draw.steps[1].action.en, /reference images/);
  assert.match(draw.steps[1].action.en, /Product locale: <default>/);
  assert.doesNotMatch(draw.steps[1].action.en, /per its actual layout components/, 'the prose-only chrome sentence is replaced by the record');
  const brand = readYaml('modules/ops/ops/brand.decide.yaml');
  assert.ok(brand.writes.some((w) => w.id === 'shellNode' && w.schema === 'work/app-shell@1'));
  assert.equal(brand.proofs.find((p) => p.id === 'shell-capture').check, 'scripts/checks/shell-conformance.mjs');
  assert.ok(readYaml('modules/ops/ops/interface.scaffold.yaml').writes.some((w) => w.id === 'shellNode'));
  assert.equal(readYaml('modules/ops/ops/interface.implement.yaml').proofs.find((p) => p.id === 'shell-layout').check, 'scripts/checks/shell-conformance.mjs');
  const audit = readYaml('modules/ops/ops/interface.audit.yaml');
  assert.equal(audit.policy.auditPolicy.shellLens.directionDrift.route, 'interface.draw');
  assert.equal(audit.policy.auditPolicy.shellLens.implementationDrift.route, 'interface.implement');
  assert.ok(audit.policy.findingSchema.categories.includes('shell.conformance'));

  const common = readYaml('modules/ops/_common.yaml');
  assert.ok(common.sections.some((s) => /Product UI copy follows the shell record's productLocale/.test(s.title) && /not owner_language/.test(s.title)));
  assert.match(read('modules/kernel/dispatch.yaml'), /product_locale:/);
  assert.match(read('scripts/kernel/api.mjs'), /product_locale: productLocale/);
});

test('the CLI exits 2 on a bad argument', () => {
  assert.equal(shellConformanceMain([]).exitCode, 2);
  assert.equal(shellConformanceMain(['a', 'b']).exitCode, 2);
  assert.equal(shellConformanceMain([path.join(os.tmpdir(), 'no-such-starci-dir-xyz')]).exitCode, 2);
});
