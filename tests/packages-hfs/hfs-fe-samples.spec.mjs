// C10: both editions ship reachable local-state and overlay samples, vendor-owned glyphs and real locale catalogs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { scaffoldApp } from '../../packages/hfs/scaffold/app.mjs';
import { byCodeUnit } from '../../packages/hfs/report/order.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const ts = createRequire(import.meta.url)('typescript');
const node = (type, props) => ({ type, props });
const jsxRuntime = { jsx: node, jsxs: node, Fragment: Symbol('Fragment') };
const grammar = { Button: Symbol('Button'), Dialog: Symbol('Dialog'), Text: Symbol('Text'), Heading: Symbol('Heading') };

const read = (root, relative) => fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8');

/** The scaffold's existing seams keep this sample proof offline, without installs or a Supabase process. */
function fixture(t, edition) {
  const into = mkdtemp(t, 'hfs-fe-samples-');
  const result = scaffoldApp({
    name: 'sample', into, edition, presets: { sonarExclusions: [] },
    emitTypes: () => 'export type Database = Record<string, never>\n',
    lock: root => {
      fs.writeFileSync(path.join(root, 'package-lock.json'), '{}\n');
      return { ok: true };
    },
  });
  return { root: result.root, app: edition === 'lite' ? 'web' : 'app' };
}

const keysOf = (value, prefix = '') => Object.entries(value).flatMap(([key, entry]) => {
  const qualified = prefix ? `${prefix}.${key}` : key;
  return typeof entry === 'string' ? [qualified] : keysOf(entry, qualified);
}).sort(byCodeUnit);

/** Execute generated TypeScript with narrow recording doubles at its existing component and library boundaries. */
function load(root, relative, modules) {
  const compiled = ts.transpileModule(read(root, relative), {
    fileName: relative, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  assert.deepEqual(compiled.diagnostics, [], `${relative} has valid TypeScript syntax`);
  const module = { exports: {} };
  const require = name => {
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (!(name in modules)) throw new Error(`${relative} imports unexpected dependency ${name}`);
    return modules[name];
  };
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, require }, { filename: relative });
  return module.exports;
}

/** A recording create boundary: the sample's own initializer and actions run unchanged. */
function localState() {
  let state;
  const updates = [];
  const create = () => initializer => {
    state = initializer(next => { updates.push(next); state = { ...state, ...next }; });
    return selector => selector(state);
  };
  return { create, updates, read: () => state };
}

function sampleModules(root, source) {
  const circle = Symbol('CircleIcon');
  const icon = load(root, `${source}/components/leaves/Icon/index.tsx`, { '@starci/heroicons/24/outline': { CircleIcon: circle } });
  const local = localState();
  const store = load(root, `${source}/hooks/zustand/appGuide/store.ts`, { zustand: { create: local.create } });
  const hook = load(root, `${source}/hooks/zustand/appGuide/index.ts`, { './store': store });
  const drawing = load(root, `${source}/features/overlays/AppGuideOverlay/component.tsx`, {
    '@starci/grammar/common': grammar, '@/components/leaves/Icon': icon,
  });
  const connected = load(root, `${source}/features/overlays/AppGuideOverlay/index.tsx`, {
    'next-intl': { useTranslations: namespace => key => `${namespace}.${key}` },
    '@/hooks/zustand/appGuide': hook, './component': drawing,
  });
  return { circle, icon, local, drawing, connected };
}

function assertGuideState(sample) {
  assert.deepEqual(Object.keys(sample.local.read()).sort(byCodeUnit), ['isOpen', 'setOpen'], 'the local store carries UI state only');
  const closed = sample.connected.AppGuideOverlay();
  assert.equal(closed.props.props.isOpen, false);
  assert.deepEqual({ ...closed.props.props }, {
    isOpen: false, triggerLabel: 'app.guide.open', title: 'app.guide.title', description: 'app.guide.description', closeLabel: 'app.guide.close',
  }, 'every visible label comes from the guide catalog namespace');
  const dialog = sample.drawing.AppGuideOverlayBase(closed.props);
  assert.equal(dialog.type, grammar.Dialog);
  assert.equal(dialog.props.trigger.type, grammar.Button);
  assert.equal(dialog.props.trigger.props.children, 'app.guide.open');
  assert.equal(dialog.props.trigger.props.startContent.type, sample.icon.Icon);
  dialog.props.onOpenChange(true);
  const opened = sample.connected.AppGuideOverlay();
  assert.equal(opened.props.props.isOpen, true, 'the grammar trigger opens the same local store the overlay reads');
  sample.drawing.AppGuideOverlayBase(opened.props).props.onOpenChange(false);
  assert.equal(sample.connected.AppGuideOverlay().props.props.isOpen, false, 'dismissal updates the local store');
  assert.equal(sample.local.updates.length, 2);
}

async function assertMounted(root, source, overlay) {
  const home = load(root, `${source}/features/pages/AppHomePage/component.tsx`, {
    '@starci/grammar/common': grammar,
    '@/components/blocks/SignInForm': { SignInForm: Symbol('SignInForm') },
    '@/components/blocks/SignOutButton': { SignOutButton: Symbol('SignOutButton') },
  });
  const owner = load(root, `${source}/features/pages/AppHomePage/index.tsx`, {
    'next-intl/server': { getTranslations: async namespace => key => `${namespace}.${key}` },
    '@/features/overlays/AppGuideOverlay': overlay, './component': home,
  });
  const tree = await owner.AppHomePage();
  assert.ok(tree.props.children.some(child => child.type === overlay.AppGuideOverlay), 'the page mounts the overlay owner');
  assert.equal(tree.props.children[0].props.props.title, 'app.home.title');
  assert.doesNotMatch(read(root, `${source}/features/pages/AppHomePage/index.tsx`), /["']use client["']/);
  assert.doesNotMatch(read(root, `${source}/features/pages/AppHomePage/component.tsx`), /features\/overlays/);
}

for (const edition of ['lite', 'full']) {
  test(`C10 ${edition}: every served locale has matching catalogs with genuine Vietnamese and English copy`, t => {
    const { root, app } = fixture(t, edition);
    const catalogs = `fe/apps/${app}/src/modules/i18n/messages`;
    const vi = JSON.parse(read(root, `${catalogs}/vi.json`));
    const en = JSON.parse(read(root, `${catalogs}/en.json`));
    assert.deepEqual(keysOf(vi), keysOf(en));
    assert.equal(vi.app.home.title, 'Trang chủ');
    assert.equal(vi.app.signIn.title, 'Đăng nhập');
    assert.equal(vi.app.guide.close, 'Đóng');
    assert.equal(en.app.home.title, 'Home');
    assert.equal(en.app.guide.close, 'Close');
    const routing = edition === 'lite' ? `fe/apps/${app}/src/modules/i18n/routing.ts` : 'fe/packages/sample-i18n/src/routing.ts';
    assert.match(read(root, routing), /\["vi", "en"\]/);
    if (edition === 'full') {
      const landing = 'fe/apps/landing/src/modules/i18n/messages';
      assert.deepEqual(keysOf(JSON.parse(read(root, `${landing}/vi.json`))), keysOf(JSON.parse(read(root, `${landing}/en.json`))));
    }
  });

  test(`C10 ${edition}: the mounted grammar overlay opens and dismisses its local zustand state and delegates the glyph`, async t => {
    const { root, app } = fixture(t, edition);
    const source = `fe/apps/${app}/src`;
    const sample = sampleModules(root, source);
    assertGuideState(sample);
    await assertMounted(root, source, sample.connected);
    const glyph = sample.icon.Icon();
    assert.equal(glyph.type, sample.circle, 'the Icon leaf delegates drawing to @starci/heroicons');
    assert.deepEqual({ ...glyph.props }, { width: 24, height: 24, 'aria-hidden': 'true' });
    assert.doesNotMatch(read(root, `${source}/components/leaves/Icon/index.tsx`), /<(?:svg|path|circle)\b/);
  });
}
