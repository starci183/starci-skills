// proves: FE_CALLBACK_SHAPE@lite FE_CALLBACK_SHAPE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { scaffoldApp, bundledPins } from '../../packages/hfs/scaffold/app.mjs';
import { addApp } from '../../packages/hfs/scaffold/add-app.mjs';
import { loadSlotManifest, readRepoDeclaration, createSlotResolver } from '../../scripts/hfs/slots.mjs';

const pins = bundledPins();
const manifest = loadSlotManifest();

function fixture(t, edition, authCallback = false) {
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-fe-callback-'));
  t.after(() => fs.rmSync(into, { recursive: true, force: true }));
  const root = scaffoldApp({ name: 'callback-demo', into, edition, authCallback: authCallback && edition === 'lite', pins,
    emitTypes: () => 'export type Database = {};\n', lock: () => ({ ok: true }) }).root;
  if (edition === 'full' && authCallback) configureFullAuth(root);
  return root;
}

/** A pre-existing full app may explicitly choose Supabase; add app must preserve that auth posture. */
function configureFullAuth(root) {
  const packageFile = path.join(root, 'fe/apps/app/package.json');
  const before = fs.readFileSync(packageFile, 'utf8');
  const sourcePackage = JSON.parse(before);
  for (const dependency of ['@supabase/ssr', '@supabase/supabase-js', 'server-only'])
    assert.equal(sourcePackage.dependencies[dependency], undefined, 'source workspace has no callback dependencies');
  const declarationFile = path.join(root, 'hfs.json');
  const declaration = JSON.parse(fs.readFileSync(declarationFile, 'utf8'));
  declaration.sides.be.connections[0].provider = 'supabase';
  declaration.sides.fe.optionalSlots.push('fe.route.callback');
  fs.writeFileSync(declarationFile, JSON.stringify(declaration));
  addApp({ root, name: 'authenticated' });
  assert.equal(fs.readFileSync(packageFile, 'utf8'), before, 'adding a callback workspace preserves its dependency source');
}

function loadTypeScript(root, relative, modules) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const compiled = ts.transpileModule(source, {
    fileName: relative, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.deepEqual(compiled.diagnostics, []);
  const module = { exports: {} };
  const require = name => {
    assert.ok(Object.hasOwn(modules, name), `unexpected callback dependency ${name}`);
    return modules[name];
  };
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, require, URL }, { filename: relative });
  return module.exports;
}

function authDouble(error = null) {
  const calls = [];
  const cookies = [{ name: 'verifier', value: 'fixture' }];
  const modules = {
    'server-only': {},
    'next/headers': { cookies: async () => ({ getAll: () => cookies, set: (...args) => calls.push(['cookie', ...args]) }) },
    '@/modules/config': { supabaseUrl: () => 'https://auth.invalid', supabaseAnonKey: () => 'fixture-anon' },
    '@supabase/ssr': { createServerClient: (url, key, settings) => {
      assert.equal(url, 'https://auth.invalid');
      assert.equal(key, 'fixture-anon');
      assert.equal(settings.cookies.getAll(), cookies);
      return { auth: { exchangeCodeForSession: async code => {
        calls.push(['exchange', code]);
        if (!error) settings.cookies.setAll([{ name: 'session', value: 'fixture-session', options: { httpOnly: true } }]);
        return { error };
      } } };
    } },
  };
  return { modules, calls };
}

for (const edition of ['lite', 'full']) {
  const app = edition === 'lite' ? 'web' : 'app';
  const prefix = `fe/apps/${app}/src`;

  test(`${edition}: callback remains opt-in and add app preserves the browser-only default`, t => {
    const root = fixture(t, edition);
    for (const name of ['app/auth/callback/route.ts', 'modules/auth/server.ts', 'modules/auth/pkce-client.ts'])
      assert.equal(fs.existsSync(path.join(root, prefix, name)), false);
    const pkg = JSON.parse(fs.readFileSync(path.join(root, `fe/apps/${app}/package.json`), 'utf8'));
    assert.equal(pkg.dependencies['@supabase/ssr'], undefined);
    addApp({ root, name: 'another' });
    assert.equal(fs.existsSync(path.join(root, 'fe/apps/another/src/app/auth/callback/route.ts')), false);
  });

  test(`${edition}: enabled callback exchanges PKCE, writes cookies and redirects only to the declared home`, async t => {
    const root = fixture(t, edition, true);
    const app = edition === 'lite' ? 'web' : 'authenticated';
    const prefix = `fe/apps/${app}/src`;
    const repo = readRepoDeclaration(manifest, root);
    assert.ok(repo.sides.fe.optionalSlots.includes('fe.route.callback'));
    const resolver = createSlotResolver(manifest, repo);
    assert.equal(resolver.slotOf(`${prefix}/app/auth/callback/route.ts`).id, 'fe.route.callback');
    const pkg = JSON.parse(fs.readFileSync(path.join(root, `fe/apps/${app}/package.json`), 'utf8'));
    assert.equal(pkg.dependencies['@supabase/ssr'], pins['@supabase/ssr'].version);
    assert.equal(pkg.dependencies['@supabase/supabase-js'], pins['@supabase/supabase-js'].version);
    assert.equal(pkg.dependencies['server-only'], pins['server-only'].version);
    const browser = fs.readFileSync(path.join(root, prefix, 'modules/auth/client.ts'), 'utf8');
    assert.match(browser, /createBrowserClient/);
    assert.match(browser, /detectSessionInUrl: false/);
    assert.match(browser, /export const authClient/);
    assert.doesNotMatch(browser, /\{\{>/);
    assert.equal(fs.existsSync(path.join(root, prefix, 'modules/auth/pkce-client.ts')), false);
    const recorded = authDouble();
    const owner = loadTypeScript(root, `${prefix}/modules/auth/server.ts`, recorded.modules);
    const route = loadTypeScript(root, `${prefix}/app/auth/callback/route.ts`, {
      'next/server': { NextResponse: { redirect: url => ({ location: url.href }) } },
      '@/modules/auth/server': owner, '@/modules/routes': { APP_ROUTES: { home: '/' } },
    });
    const response = await route.GET({ url: 'https://app.invalid/auth/callback?code=pkce&next=https://outside.invalid' });
    assert.equal(response.location, 'https://app.invalid/');
    assert.deepEqual(recorded.calls[0], ['exchange', 'pkce']);
    assert.deepEqual(recorded.calls[1].slice(0, 3), ['cookie', 'session', 'fixture-session']);
    assert.equal(recorded.calls[1][3].httpOnly, true);
    recorded.calls.length = 0;
    assert.equal((await route.GET({ url: 'https://app.invalid/auth/callback' })).location, 'https://app.invalid/');
    assert.deepEqual(recorded.calls, []);
    const failed = authDouble(new Error('fixture exchange failure'));
    const refused = loadTypeScript(root, `${prefix}/modules/auth/server.ts`, failed.modules);
    await assert.rejects(refused.exchangeAuthCode('expired'), /fixture exchange failure/);
    assert.deepEqual(failed.calls, [['exchange', 'expired']]);
    addApp({ root, name: 'another' });
    assert.match(fs.readFileSync(path.join(root, 'fe/apps/another/src/modules/auth/client.ts'), 'utf8'), /createBrowserClient/);
    assert.ok(fs.existsSync(path.join(root, 'fe/apps/another/src/app/auth/callback/route.ts')));
    if (edition === 'full') assert.equal(fs.existsSync(path.join(root, 'fe/apps/landing/src/app/auth/callback/route.ts')), false);
  });
}

test('callback option refuses a non-boolean before creating a tree', t => {
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-fe-callback-invalid-'));
  t.after(() => fs.rmSync(into, { recursive: true, force: true }));
  assert.throws(() => scaffoldApp({ name: 'demo', into, authCallback: 'yes' }), /authCallback must be a boolean/);
  assert.deepEqual(fs.readdirSync(into), []);
});

test('full starter refuses a server callback without an existing Supabase connection', t => {
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-fe-callback-provider-'));
  t.after(() => fs.rmSync(into, { recursive: true, force: true }));
  assert.throws(() => scaffoldApp({ name: 'demo', into, edition: 'full', authCallback: true }), /requires an existing Supabase connection/);
  assert.deepEqual(fs.readdirSync(into), []);
});

test('add app refuses a callback slot lacking its Supabase provider before writing', t => {
  const root = fixture(t, 'full');
  const file = path.join(root, 'hfs.json');
  const declaration = JSON.parse(fs.readFileSync(file, 'utf8'));
  declaration.sides.fe.optionalSlots.push('fe.route.callback');
  const before = JSON.stringify(declaration);
  fs.writeFileSync(file, before);
  assert.throws(() => addApp({ root, name: 'another' }), /requires an existing Supabase connection/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(fs.existsSync(path.join(root, 'fe/apps/another')), false);
});
