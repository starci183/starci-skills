import test from 'node:test';
import assert from 'node:assert/strict';
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

function feFiles(edition) {
  const app = edition === 'lite' ? 'web' : 'app';
  const root = `fe/apps/${app}/src`;
  return [
    { path: `${root}/app/auth/callback/route.ts`, content: 'import { exchangeAuthCode } from "@/modules/auth/server"\n' },
    { path: `${root}/modules/auth/server.ts`, content: 'export const exchangeAuthCode = async () => undefined\n' },
    { path: `${root}/modules/auth/client.ts`, content: 'export const authClient = {}\n' },
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
  assert.throws(() => applyFeTemplatePolicy(files, { authCallback: true }), { code: 'HFS_SCAFFOLD_CALLBACK_TEMPLATE_MISSING' });
  const missingConfig = feFiles('lite').filter(file => !file.path.endsWith('/modules/config/index.ts'));
  assert.throws(() => applyFeTemplatePolicy(missingConfig, { authCallback: true }), { code: 'HFS_SCAFFOLD_CALLBACK_TEMPLATE_MISSING' });
  const invalidConfig = feFiles('lite').map(file => file.path.endsWith('/modules/config/index.ts') ? { ...file, content: 'export const siteUrl = () => ""\n' } : file);
  assert.throws(() => applyFeTemplatePolicy(invalidConfig, { authCallback: true }), { code: 'HFS_SCAFFOLD_CALLBACK_CONFIG_INVALID' });
  assert.throws(() => enableAuthCallback(declaration('lite'), 'true'), { code: 'HFS_SCAFFOLD_CALLBACK_OPTION' });
});

test('a guide whose canonical host is absent or changed refuses instead of leaving an unreachable feature', () => {
  const missing = feFiles('full').filter(file => !file.path.endsWith('/AppHomePage/index.tsx'));
  assert.throws(() => applyFeTemplatePolicy(missing), { code: 'HFS_SCAFFOLD_OVERLAY_HOST_MISSING' });
  const invalid = feFiles('full').map(file => file.path.endsWith('/AppHomePage/index.tsx') ? { ...file, content: 'export const OtherPage = () => null\n' } : file);
  assert.throws(() => applyFeTemplatePolicy(invalid), { code: 'HFS_SCAFFOLD_OVERLAY_HOST_INVALID' });
});
