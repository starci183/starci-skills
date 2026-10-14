import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { addAuthCallbackDependencies, applyFeTemplatePolicy, enableAuthCallback } from '../../packages/hfs/scaffold/fe-template-policy.mjs';

const HOME = [
  'import type { Metadata } from "next"',
  'import { AppHomePageBase } from "./component"',
  'export const appHomeMetadata = async (): Promise<Metadata> => ({ title: "Home" })',
  'export const AppHomePage = async () => {',
  '    const title = await Promise.resolve("Home")',
  '    return <AppHomePageBase props={{ title }} />',
  '}',
  '',
].join('\n');

const AUTH_CLIENTS = Object.fromEntries(['lite', 'full'].map(edition => {
  const skeleton = edition === 'lite' ? 'skeleton-lite' : 'skeleton';
  const content = fs.readFileSync(new URL(`../../packages/hfs/templates/fe/${skeleton}/apps/__app__/src/modules/auth/client.ts`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  return [edition, content];
}));

function feFiles(edition) {
  const app = edition === 'lite' ? 'web' : 'app';
  const root = `fe/apps/${app}/src`;
  return [
    { path: `${root}/app/auth/callback/route.ts`, content: 'import { exchangeAuthCode } from "@/modules/auth/server"\n' },
    { path: `${root}/modules/auth/server.ts`, content: 'export const exchangeAuthCode = async () => undefined\n' },
    { path: `${root}/modules/auth/client.ts`, content: AUTH_CLIENTS[edition] },
    { path: `${root}/modules/config/index.ts`, content: 'const required = (name: string, value: string | undefined): string => { if (!value) throw new Error(name); return value }\nexport const siteUrl = (): string => required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL)\n' },
    { path: `${root}/features/overlays/AppGuideOverlay/index.tsx`, content: 'export const AppGuideOverlay = () => null\n' },
    { path: `${root}/features/pages/AppHomePage/index.tsx`, content: HOME },
  ];
}

function declaration(edition, provider = 'supabase') {
  return {
    edition,
    sides: {
      be: { connections: [{ name: 'primary', provider }] },
      fe: { optionalSlots: ['fe.package.ui'] },
    },
    supabase: { siteUrl: 'http://localhost:3000', redirectUrls: ['http://localhost:3000/'] },
  };
}

for (const edition of ['lite', 'full']) {
  test(`${edition}: default FE rendering keeps browser auth and mounts the overlay while omitting the server callback`, () => {
    const files = feFiles(edition);
    const rendered = applyFeTemplatePolicy(files);
    assert.equal(rendered.some(file => file.path.includes('/auth/callback/') || file.path.endsWith('/auth/server.ts')), false);
    assert.ok(rendered.some(file => file.path.endsWith('/auth/client.ts')));
    assert.equal(rendered.find(file => file.path.endsWith('/auth/client.ts')).content, AUTH_CLIENTS[edition], 'the default browser auth owner is preserved');
    const home = rendered.find(file => file.path.endsWith('/AppHomePage/index.tsx')).content;
    assert.ok(home.includes('export const appHomeMetadata = async (): Promise<Metadata>'));
    assert.ok(home.includes('const title = await Promise.resolve("Home")'));
    assert.ok(home.includes('return <AppHomePageBase props={{ title }} />'));
    assert.ok(home.includes('export const AppHomePage = () => <><AppHomePageContent /><AppGuideOverlay /></>'));
    assert.deepEqual(applyFeTemplatePolicy(rendered), rendered, 'mounting is idempotent');
    assert.equal(files.at(-1).content, HOME, 'rendering does not modify source template records');
  });

  test(`${edition}: opting into server auth registers the slot, callback URI and matching auth owner`, () => {
    const app = declaration(edition);
    enableAuthCallback(app, true);
    enableAuthCallback(app, true);
    assert.deepEqual(app.sides.fe.optionalSlots, ['fe.package.ui', 'fe.route.callback']);
    assert.deepEqual(app.supabase.redirectUrls, ['http://localhost:3000/', 'http://localhost:3000/auth/callback']);
    const rendered = applyFeTemplatePolicy(feFiles(edition), { authCallback: true });
    assert.ok(rendered.some(file => file.path.endsWith('/auth/callback/route.ts')));
    assert.ok(rendered.some(file => file.path.endsWith('/auth/server.ts')));
    const browser = rendered.find(file => file.path.endsWith('/modules/auth/client.ts')).content;
    assert.ok(browser.includes('import { createBrowserClient } from "@supabase/ssr"'));
    assert.ok(browser.includes('createBrowserClient(supabaseUrl(), supabaseAnonKey(), {'));
    assert.ok(browser.includes('detectSessionInUrl: false'), 'the server callback owns code exchange');
    assert.ok(browser.includes('PKCE verifier and session in cookies shared with the server callback'));
    assert.equal(browser.includes('import { createClient }'), false);
    assert.equal(browser.includes('AUTH_PROVIDER_NOT_CONFIGURED'), false, 'a full callback app receives a real Supabase Auth owner');
    for (const method of ['session:', 'accessToken:', 'refreshAccessToken:', 'signInWithPassword:', 'signOut:', 'onChange:']) assert.ok(browser.includes(method), `AuthClient preserves ${method}`);
    assert.equal(browser.includes('localStorage') || browser.includes('auth.storage'), false, 'SSR manages cookie storage');
    const config = rendered.find(file => file.path.endsWith('/modules/config/index.ts')).content;
    assert.ok(config.includes('export const siteUrl'));
    assert.ok(config.includes('export const supabaseUrl = (): string => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)'));
    assert.ok(config.includes('export const supabaseAnonKey = (): string => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)'));
    assert.deepEqual(applyFeTemplatePolicy(rendered, { authCallback: true }), rendered, 'config readers and overlay mounts are idempotent');
    const pkg = { dependencies: { next: '16.0.0' } };
    const pins = { '@supabase/ssr': { version: '0.12.7' }, '@supabase/supabase-js': { version: '2.95.0' }, 'server-only': { version: '0.0.1' } };
    addAuthCallbackDependencies(pkg, pins);
    assert.deepEqual(pkg.dependencies, { next: '16.0.0' }, 'browser PKCE keeps its original dependencies');
    addAuthCallbackDependencies(pkg, pins, true);
    assert.deepEqual(pkg.dependencies, { next: '16.0.0', '@supabase/ssr': '0.12.7', '@supabase/supabase-js': '2.95.0', 'server-only': '0.0.1' });
    assert.throws(() => enableAuthCallback(declaration(edition, 'postgres'), true), { code: 'HFS_SCAFFOLD_CALLBACK_PROVIDER' });
  });
}

test('a requested callback refuses missing route or auth owner before producing a partial tree', () => {
  assert.throws(() => applyFeTemplatePolicy([], { authCallback: true }), { code: 'HFS_SCAFFOLD_CALLBACK_TEMPLATE_MISSING' });
  const files = feFiles('lite').filter(file => !file.path.endsWith('/auth/server.ts'));
  const before = structuredClone(files);
  assert.throws(() => applyFeTemplatePolicy(files, { authCallback: true }), { code: 'HFS_SCAFFOLD_CALLBACK_TEMPLATE_MISSING' });
  assert.deepEqual(files, before, 'a failed rendering keeps every supplied file unchanged');
  const missingConfig = feFiles('lite').filter(file => !file.path.endsWith('/modules/config/index.ts'));
  assert.throws(() => applyFeTemplatePolicy(missingConfig, { authCallback: true }), { code: 'HFS_SCAFFOLD_CALLBACK_TEMPLATE_MISSING' });
  const invalidConfig = feFiles('lite').map(file => file.path.endsWith('/modules/config/index.ts') ? { ...file, content: 'export const siteUrl = () => ""\n' } : file);
  assert.throws(() => applyFeTemplatePolicy(invalidConfig, { authCallback: true }), { code: 'HFS_SCAFFOLD_CALLBACK_CONFIG_INVALID' });
  const missingBrowser = feFiles('lite').filter(file => !file.path.endsWith('/modules/auth/client.ts'));
  assert.throws(() => applyFeTemplatePolicy(missingBrowser, { authCallback: true }), { code: 'HFS_SCAFFOLD_CALLBACK_TEMPLATE_MISSING' });
  const invalidBrowser = feFiles('full').map(file => file.path.endsWith('/modules/auth/client.ts') ? { ...file, content: 'export const authClient = {}\n' } : file);
  const invalidBefore = structuredClone(invalidBrowser);
  assert.throws(() => applyFeTemplatePolicy(invalidBrowser, { authCallback: true }), { code: 'HFS_SCAFFOLD_CALLBACK_CLIENT_INVALID' });
  assert.deepEqual(invalidBrowser, invalidBefore, 'an incompatible browser owner is not overwritten');
  const app = declaration('lite');
  const declared = structuredClone(app);
  assert.throws(() => enableAuthCallback(app, 'true'), { code: 'HFS_SCAFFOLD_CALLBACK_OPTION' });
  assert.deepEqual(app, declared, 'a rejected switch does not register a slot or redirect');
  assert.throws(() => applyFeTemplatePolicy(files, { authCallback: 'false' }), { code: 'HFS_SCAFFOLD_CALLBACK_OPTION' });
});

test('callbacks in multiple front-end apps each need their own auth owner', () => {
  const first = feFiles('lite');
  const second = first.map(file => ({ ...file, path: file.path.replace('/apps/web/', '/apps/admin/') }));
  const files = [...first, ...second.filter(file => !file.path.endsWith('/auth/server.ts'))];
  assert.throws(() => applyFeTemplatePolicy(files, { authCallback: true }), { code: 'HFS_SCAFFOLD_CALLBACK_TEMPLATE_MISSING' });
  const complete = applyFeTemplatePolicy([...first, ...second], { authCallback: true });
  assert.equal(complete.filter(file => file.path.endsWith('/auth/server.ts')).length, 2);
  assert.equal(complete.filter(file => file.path.endsWith('/auth/client.ts') && file.content.includes('import { createBrowserClient } from "@supabase/ssr"')).length, 2);
  assert.equal(complete.filter(file => file.path.endsWith('/AppHomePage/index.tsx') && file.content.includes('<AppGuideOverlay />')).length, 2);
});

test('missing callback dependency pins fail before changing the package', () => {
  const pkg = { dependencies: { next: '16.0.0' } };
  const before = structuredClone(pkg);
  assert.throws(() => addAuthCallbackDependencies(pkg, { '@supabase/ssr': { version: '0.12.7' } }, true), { code: 'HFS_SCAFFOLD_PIN_MISSING' });
  assert.deepEqual(pkg, before);
  assert.throws(() => addAuthCallbackDependencies(pkg, {}, 'true'), { code: 'HFS_SCAFFOLD_CALLBACK_OPTION' });
  assert.deepEqual(pkg, before);
});

test('a guide whose canonical host is absent or changed refuses instead of leaving an unreachable feature', () => {
  const missing = feFiles('full').filter(file => !file.path.endsWith('/AppHomePage/index.tsx'));
  assert.throws(() => applyFeTemplatePolicy(missing), { code: 'HFS_SCAFFOLD_OVERLAY_HOST_MISSING' });
  const invalid = feFiles('full').map(file => file.path.endsWith('/AppHomePage/index.tsx') ? { ...file, content: 'export const OtherPage = () => null\n' } : file);
  assert.throws(() => applyFeTemplatePolicy(invalid), { code: 'HFS_SCAFFOLD_OVERLAY_HOST_INVALID' });
});
