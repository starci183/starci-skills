import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { scaffoldApp } from '../../packages/hfs/scaffold/app.mjs';
import { scaffoldBinGaps } from '../helpers/scaffold-bins.mjs';
import { appSource, checkTargets, renderTargets } from '../../packages/hfs/sync/index.mjs';
import { checkRepository } from '../../scripts/hfs/check.mjs';
import { checkDatabase } from '../../scripts/hfs/rules/database.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const PINS = parseYaml(fs.readFileSync(path.join(ROOT, 'knowledge', 'hfs', 'canon-pins.yaml'), 'utf8')).pins;
const CREATED_AT = new Date('2026-10-02T12:34:56.000Z');
const GENERATED_TYPES = 'export type Database = { public: { Tables: Record<string, never> } };\n';
const jestPreset = createRequire(import.meta.url)('../../packages/jest-preset/index.cjs');
const PRESETS = { sonarExclusions: jestPreset.sonarExclusions() };

// Design 8.5's exact file-level output, with <ts> fixed by CREATED_AT. Empty brand/ is a directory, not a file. The web app carries the
// shared app core of both editions (owner ruling 2026-10-13): no modules/db, no Server Action and no auth callback route.
const EXPECTED_LITE_FILES = Object.freeze([
  '.dockerignore', '.editorconfig', '.gitattributes', '.github/workflows/ci.yml', '.github/workflows/db-deploy.yml',
  '.github/workflows/images.yml', '.gitignore', '.husky/pre-commit', '.husky/pre-push', '.nvmrc', '.prettierignore',
  '.prettierrc', '.sops.yaml', '.starcistacks/dev/environment.json', '.starcistacks/dev/secrets/.gitkeep',
  '.starciwork/.gitignore', '.starciwork/features/system-health/index.yaml', '.starciwork/index.yaml',
  '.starciwork/shell/index.yaml', '.starciwork/workspace.yaml', 'README.md',
  'be/apps/api/Dockerfile', 'be/apps/api/src/api.options.ts', 'be/apps/api/src/app.module.ts', 'be/apps/api/src/compose/platform.ts', 'be/apps/api/src/main.ts',
  'be/eslint.config.mjs', 'be/jest.config.js', 'be/nest-cli.json',
  'be/src/features/api/system-health/application/check-liveness.contracts.ts',
  'be/src/features/api/system-health/application/check-liveness.handler.ts',
  'be/src/features/api/system-health/application/check-liveness.query.ts',
  'be/src/features/api/system-health/index.ts', 'be/src/features/api/system-health/system-health.module.ts',
  'be/src/features/api/system-health/transport/http/live.controller.ts',
  'be/src/features/api/system-health/transport/http/system-health-http.module.ts', 'be/src/modules/domain/identity/admission.policy.spec.ts',
  'be/src/modules/domain/identity/admission.policy.ts', 'be/src/modules/domain/identity/auth.guard.spec.ts', 'be/src/modules/domain/identity/auth.guard.ts',
  'be/src/modules/domain/identity/errors/identity.error.ts', 'be/src/modules/domain/identity/identity.contracts.ts',
  'be/src/modules/domain/identity/identity.decorators.ts', 'be/src/modules/domain/identity/identity.module-definition.ts',
  'be/src/modules/domain/identity/identity.module.ts', 'be/src/modules/domain/identity/identity.options.ts',
  'be/src/modules/domain/identity/index.ts', 'be/src/modules/domain/identity/messages/identity.messages.ts',
  'be/src/modules/domain/liveness/index.ts', 'be/src/modules/domain/liveness/liveness.contracts.ts',
  'be/src/modules/domain/liveness/liveness.module-definition.ts', 'be/src/modules/domain/liveness/liveness.module.ts',
  'be/src/modules/domain/liveness/liveness.options.ts', 'be/src/modules/domain/liveness/liveness.service.spec.ts', 'be/src/modules/domain/liveness/liveness.service.ts',
  'be/src/modules/integrations/supabase/errors/supabase.error.ts', 'be/src/modules/integrations/supabase/index.ts', 'be/src/modules/integrations/supabase/supabase.client.spec.ts',
  'be/src/modules/integrations/supabase/supabase.client.ts', 'be/src/modules/integrations/supabase/supabase.config.ts',
  'be/src/modules/integrations/supabase/supabase.decorators.ts', 'be/src/modules/integrations/supabase/supabase.jwks.ts',
  'be/src/modules/integrations/supabase/supabase.options.ts',
  'be/src/modules/platform/clock/clock.decorators.ts', 'be/src/modules/platform/clock/clock.module-definition.ts',
  'be/src/modules/platform/clock/clock.module.ts', 'be/src/modules/platform/clock/clock.options.ts',
  'be/src/modules/platform/clock/clock.port.ts', 'be/src/modules/platform/clock/index.ts', 'be/src/modules/platform/clock/system-clock.service.spec.ts',
  'be/src/modules/platform/clock/system-clock.service.ts',
  'be/src/modules/platform/composition/composition.decorators.ts', 'be/src/modules/platform/composition/index.ts',
  'be/src/modules/platform/config/env-source.config.ts', 'be/src/modules/platform/config/errors/config.error.ts',
  'be/src/modules/platform/config/index.ts', 'be/src/modules/platform/config/server.config.ts',
  'be/src/modules/platform/config/server.options.ts',
  'be/src/modules/platform/cqrs/cqrs.contracts.ts', 'be/src/modules/platform/cqrs/cqrs.decorators.ts',
  'be/src/modules/platform/cqrs/cqrs.handler.ts', 'be/src/modules/platform/cqrs/cqrs.log-events.ts',
  'be/src/modules/platform/cqrs/cqrs.module-definition.ts', 'be/src/modules/platform/cqrs/cqrs.module.ts',
  'be/src/modules/platform/cqrs/cqrs.options.ts', 'be/src/modules/platform/cqrs/index.ts',
  'be/src/modules/platform/database/database.module-definition.ts',
  'be/src/modules/platform/database/database.module.ts', 'be/src/modules/platform/database/database.options.ts',
  'be/src/modules/platform/database/database.port.ts',
  'be/src/modules/platform/database/errors/database.error.ts', 'be/src/modules/platform/database/index.ts',
  'be/src/modules/platform/database/primary.config.ts', 'be/src/modules/platform/database/primary.connection.ts',
  'be/src/modules/platform/database/primary.decorators.ts',
  'be/src/modules/platform/errors/domain.error.ts', 'be/src/modules/platform/errors/errors.contracts.ts',
  'be/src/modules/platform/errors/errors.decorators.ts', 'be/src/modules/platform/errors/errors.filter.spec.ts', 'be/src/modules/platform/errors/errors.filter.ts',
  'be/src/modules/platform/errors/errors.log-events.ts', 'be/src/modules/platform/errors/errors.module-definition.ts',
  'be/src/modules/platform/errors/errors.module.ts', 'be/src/modules/platform/errors/errors.options.ts', 'be/src/modules/platform/errors/errors.service.spec.ts',
  'be/src/modules/platform/errors/errors.service.ts', 'be/src/modules/platform/errors/errors/errors.error.ts',
  'be/src/modules/platform/errors/http-status.policy.ts', 'be/src/modules/platform/errors/index.ts',
  'be/src/modules/platform/errors/messages/errors.messages.ts',
  'be/src/modules/platform/http-security/errors/http-security.error.ts', 'be/src/modules/platform/http-security/execution-request.mapper.spec.ts',
  'be/src/modules/platform/http-security/execution-request.mapper.ts',
  'be/src/modules/platform/http-security/http-security.config.ts',
  'be/src/modules/platform/http-security/http-security.decorators.ts',
  'be/src/modules/platform/http-security/http-security.module-definition.ts',
  'be/src/modules/platform/http-security/http-security.module.ts',
  'be/src/modules/platform/http-security/http-security.options.ts',
  'be/src/modules/platform/http-security/index.ts',
  'be/src/modules/platform/http-security/messages/http-security.messages.ts', 'be/src/modules/platform/http-security/origin.guard.spec.ts',
  'be/src/modules/platform/http-security/origin.guard.ts', 'be/src/modules/platform/http-security/rate-limit.guard.spec.ts', 'be/src/modules/platform/http-security/rate-limit.guard.ts', 'be/src/modules/platform/http-security/request-validation.service.spec.ts',
  'be/src/modules/platform/http-security/request-validation.service.ts', 'be/src/modules/platform/http-security/webhook-signature.service.spec.ts',
  'be/src/modules/platform/http-security/webhook-signature.service.ts', 'be/src/modules/platform/i18n/bundle-message-catalog.service.spec.ts',
  'be/src/modules/platform/i18n/bundle-message-catalog.service.ts',
  'be/src/modules/platform/i18n/i18n.contracts.ts', 'be/src/modules/platform/i18n/i18n.decorators.ts',
  'be/src/modules/platform/i18n/i18n.module-definition.ts', 'be/src/modules/platform/i18n/i18n.module.ts',
  'be/src/modules/platform/i18n/i18n.options.ts', 'be/src/modules/platform/i18n/i18n.port.ts',
  'be/src/modules/platform/i18n/index.ts', 'be/src/modules/platform/i18n/request-locale.service.spec.ts', 'be/src/modules/platform/i18n/request-locale.service.ts',
  'be/src/modules/platform/logging/index.ts', 'be/src/modules/platform/logging/json-logger.service.spec.ts', 'be/src/modules/platform/logging/json-logger.service.ts',
  'be/src/modules/platform/logging/logging.decorators.ts', 'be/src/modules/platform/logging/logging.log-events.ts',
  'be/src/modules/platform/logging/logging.module-definition.ts', 'be/src/modules/platform/logging/logging.module.ts',
  'be/src/modules/platform/logging/logging.options.ts', 'be/src/modules/platform/logging/logging.port.ts',
  'be/src/modules/platform/primitives/index.ts', 'be/src/modules/platform/primitives/outcome.contracts.ts', 'be/src/modules/platform/primitives/outcome.mapper.spec.ts',
  'be/src/modules/platform/primitives/outcome.mapper.ts', 'be/src/tests/tsconfig.json', 'be/tsconfig.build.json', 'be/tsconfig.json', 'codecov.yml',
  'fe/apps/web/next.config.ts', 'fe/apps/web/package.json', 'fe/apps/web/postcss.config.mjs',
  'fe/apps/web/src/app/[locale]/error.tsx', 'fe/apps/web/src/app/[locale]/layout.tsx',
  'fe/apps/web/src/app/[locale]/loading.tsx', 'fe/apps/web/src/app/[locale]/not-found.tsx',
  'fe/apps/web/src/app/[locale]/page.tsx', 'fe/apps/web/src/app/[locale]/providers.tsx',
  'fe/apps/web/src/app/global-error.tsx', 'fe/apps/web/src/app/globals.css',
  'fe/apps/web/src/app/health/live/route.ts',
  'fe/apps/web/src/components/blocks/SignInForm/component.tsx',
  'fe/apps/web/src/components/blocks/SignInForm/index.tsx',
  'fe/apps/web/src/components/blocks/SignOutButton/component.tsx',
  'fe/apps/web/src/components/blocks/SignOutButton/index.tsx',
  'fe/apps/web/src/components/composites/ErrorNotice/index.tsx',
  'fe/apps/web/src/components/composites/GlobalErrorNotice/index.tsx',
  'fe/apps/web/src/components/composites/LoadingNotice/index.tsx',
  'fe/apps/web/src/components/composites/NotFoundNotice/index.tsx',
  'fe/apps/web/src/components/composites/SiteShell/classNames.ts',
  'fe/apps/web/src/components/composites/SiteShell/index.tsx',
  'fe/apps/web/src/components/providers/AppProviders/index.tsx',
  'fe/apps/web/src/features/layouts/AppLayout/index.tsx',
  'fe/apps/web/src/features/pages/AppErrorPage/component.tsx',
  'fe/apps/web/src/features/pages/AppErrorPage/index.tsx',
  'fe/apps/web/src/features/pages/AppGlobalErrorPage/index.tsx',
  'fe/apps/web/src/features/pages/AppHomePage/component.tsx',
  'fe/apps/web/src/features/pages/AppHomePage/index.tsx',
  'fe/apps/web/src/features/pages/AppLoadingPage/index.tsx',
  'fe/apps/web/src/features/pages/AppNotFoundPage/index.tsx',
  'fe/apps/web/src/hooks/auth/index.ts', 'fe/apps/web/src/hooks/auth/useSession.ts',
  'fe/apps/web/src/hooks/auth/useSignIn.ts', 'fe/apps/web/src/hooks/auth/useSignOut.ts',
  'fe/apps/web/src/hooks/effects/index.ts', 'fe/apps/web/src/hooks/effects/useAuthSessionEffect.ts',
  'fe/apps/web/src/hooks/swr/SwrSideEffects.tsx', 'fe/apps/web/src/hooks/swr/index.ts',
  'fe/apps/web/src/modules/api/graphql/index.ts', 'fe/apps/web/src/modules/api/graphql/types.ts',
  'fe/apps/web/src/modules/api/index.ts',
  'fe/apps/web/src/modules/auth/client.ts', 'fe/apps/web/src/modules/auth/contracts.ts',
  'fe/apps/web/src/modules/auth/index.ts',
  'fe/apps/web/src/modules/brand/brand.css', 'fe/apps/web/src/modules/brand/index.ts',
  'fe/apps/web/src/modules/config/index.ts',
  'fe/apps/web/src/modules/i18n/index.ts', 'fe/apps/web/src/modules/i18n/messages/vi.json',
  'fe/apps/web/src/modules/i18n/request.ts', 'fe/apps/web/src/modules/i18n/routing.ts',
  'fe/apps/web/src/modules/routes/index.ts',
  'fe/apps/web/src/modules/toast/api.ts', 'fe/apps/web/src/modules/toast/hooks.ts',
  'fe/apps/web/src/modules/toast/index.ts', 'fe/apps/web/src/modules/toast/toast.tsx',
  'fe/apps/web/src/modules/types/ambient/styles.d.ts',
  'fe/apps/web/src/proxy.ts',
  'fe/apps/web/src/redux/ReduxProvider.tsx', 'fe/apps/web/src/redux/hooks.ts', 'fe/apps/web/src/redux/index.ts',
  'fe/apps/web/src/redux/slices/session.ts', 'fe/apps/web/src/redux/store.ts',
  'fe/apps/web/tsconfig.json', 'fe/eslint.config.mjs',
  'fe/stylelint.config.mjs', 'fe/tsconfig.json', 'hfs.json', 'package-lock.json', 'package.json',
  'scripts/codegen.mjs', 'sonar-project.properties', 'supabase/config.toml',
  'supabase/migrations/20261002123456_baseline.sql', 'supabase/seed.sql',
  'supabase/types/database.types.ts', 'turbo.json',
]);

const fakeLock = root => {
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{"name":"demo","lockfileVersion":3,"packages":{}}\n');
  return { ok: true };
};

const scaffoldLite = into => scaffoldApp({
  name: 'demo',
  into,
  edition: 'lite',
  pins: PINS,
  lock: fakeLock,
  emitTypes: () => GENERATED_TYPES,
  now: () => CREATED_AT,
});

test('lite scaffold emits the design 8.5 tree and is structurally clean', async (t) => {
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-lite-'));
  t.after(() => fs.rmSync(into, { recursive: true, force: true }));
  const { root, files } = scaffoldLite(into);
  assert.deepEqual(files, EXPECTED_LITE_FILES);
  const declaration = JSON.parse(fs.readFileSync(path.join(root, 'hfs.json'), 'utf8'));
  assert.deepEqual(declaration.supabase, {
    enableSignup: false,
    jwtExpiry: 3600,
    siteUrl: 'http://127.0.0.1:3000',
    redirectUrls: ['http://127.0.0.1:3000/'],
  });
  assert.deepEqual(declaration.sides, {
    be: {
      apps: [{ name: 'api', kind: 'api' }],
      kinds: ['api'],
      connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'api', isolation: 'schema', provider: 'supabase' }],
      reads: ['supabase/types/'],
    },
    fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/', 'supabase/types/'] },
  });
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), [
    '@apollo/server', '@as-integrations/express5', '@nestjs/apollo', '@nestjs/common', '@nestjs/core', '@nestjs/cqrs', '@nestjs/graphql',
    '@nestjs/platform-express', '@nestjs/typeorm', '@supabase/supabase-js', 'class-transformer', 'class-validator',
    'graphql', 'jose', 'pg', 'reflect-metadata', 'rxjs', 'tslib', 'typeorm',
  ].sort());
  // R111: the GraphQL api's runtime peer (knowledge/hfs/peer-integrations.yaml) is declared at its pin, as in full.
  assert.equal(pkg.dependencies['@as-integrations/express5'], PINS['@as-integrations/express5'].version);
  // One version of each skew-prone fe-stack package across the whole install, at its canon pin, as in full.
  assert.deepEqual(pkg.overrides, Object.fromEntries(['@xyflow/react', 'dayjs', 'zod', 'zustand'].map(name => [name, PINS[name].version])));
  // The fe stack's root tools (fe-stack.yaml tier core: codegen and lint) at their canon pins, as in full.
  for (const tool of ['@graphql-codegen/cli', '@graphql-codegen/client-preset', 'eslint', 'prettier', 'typescript'])
    assert.equal(pkg.devDependencies[tool], PINS[tool].version, `${tool} is a root devDependency at its pin`);
  // Owner ruling 2026-10-12: a lite back end keeps the unit run; it runs no test world of its own and has no cli app until add cli.
  for (const unit of ['@nestjs/testing', '@starci/jest-preset', '@types/jest', 'jest', 'ts-jest']) assert.equal(typeof pkg.devDependencies[unit], 'string', `${unit} is a lite devDependency`);
  for (const forbidden of ['@starci/test-world', 'nest-commander']) {
    assert.equal(pkg.dependencies[forbidden] ?? pkg.devDependencies[forbidden], undefined, `${forbidden} is not a lite starter dependency`);
  }
  assert.deepEqual(scaffoldBinGaps(root), [], 'every bin the scaffolded scripts call is installed by a dependency');
  const web = JSON.parse(fs.readFileSync(path.join(root, 'fe', 'apps', 'web', 'package.json'), 'utf8'));
  // Every core runtime package of fe-stack.yaml at its pin (owner ruling 2026-10-13: lite = full), plus lite's Auth adapter.
  assert.deepEqual(Object.keys(web.dependencies).sort(), [
    '@apollo/client', '@heroicons/react', '@heroui/react', '@heroui/styles', '@hookform/resolvers', '@reduxjs/toolkit',
    '@starci/grammar', '@starci/heroicons', '@supabase/supabase-js', '@xyflow/react', 'axios', 'dayjs', 'graphql', 'next', 'next-intl',
    'next-themes', 'react', 'react-dom', 'react-hook-form', 'react-redux', 'server-only', 'superjson', 'swr', 'zod', 'zustand',
  ].sort());
  for (const [name, version] of Object.entries(web.dependencies)) assert.equal(version, PINS[name].version, `${name} takes its canon pin`);
  assert.match(fs.readFileSync(path.join(root, ...'fe/apps/web/src/modules/auth/client.ts'.split('/')), 'utf8'), /flowType: "pkce"/);
  assert.equal(fs.readFileSync(path.join(root, ...'supabase/types/database.types.ts'.split('/')), 'utf8'), GENERATED_TYPES);
  const baselineSql = fs.readFileSync(path.join(root, ...'supabase/migrations/20261002123456_baseline.sql'.split('/')), 'utf8');
  assert.match(baselineSql, /drop role if exists app_be;\s*create role app_be login noinherit;/);
  assert.match(baselineSql, /grant usage on schema public to app_be/);
  assert.match(baselineSql, /create function private\.set_updated_at\(\)[\s\S]*returns trigger[\s\S]*language plpgsql[\s\S]*set search_path = ''/);
  assert.doesNotMatch(baselineSql, /security definer/);
  assert.match(baselineSql, /create trigger profiles_set_updated_at[\s\S]*before update on public\.profiles[\s\S]*execute function private\.set_updated_at\(\)/);
  // The back end is the only reader and writer of a table (owner ruling 2026-10-13): app_be holds the grants, authenticated none.
  assert.match(baselineSql, /revoke all on table public\.profiles from public, anon, authenticated/);
  assert.match(baselineSql, /grant select, insert on table public\.profiles to app_be/);
  assert.match(baselineSql, /grant update \(display_name\) on table public\.profiles to app_be/);
  assert.doesNotMatch(baselineSql, /\bto authenticated\b/);
  assert.equal(fs.existsSync(path.join(root, ...'be/src/modules/platform/database/migration-runner.service.ts'.split('/'))), false);
  assert.equal(fs.existsSync(path.join(root, ...'be/src/modules/platform/database/seed-runner.service.ts'.split('/'))), false);
  assert.equal(fs.existsSync(path.join(root, ...'be/src/modules/platform/database/database.sql.ts'.split('/'))), false);
  const identityIndex = fs.readFileSync(path.join(root, ...'be/src/modules/domain/identity/index.ts'.split('/')), 'utf8');
  assert.doesNotMatch(identityIndex, /CurrentPrincipal/);
  const cqrsIndex = fs.readFileSync(path.join(root, ...'be/src/modules/platform/cqrs/index.ts'.split('/')), 'utf8');
  assert.doesNotMatch(cqrsIndex, /\bExecuteParams\b|\bInjectCommandBus\b/);
  const databaseIndex = fs.readFileSync(path.join(root, ...'be/src/modules/platform/database/index.ts'.split('/')), 'utf8');
  assert.doesNotMatch(databaseIndex, /MigrationRunnerService|SeedRunnerService|requireOwnedRow|\bsql\b|InjectPrimaryEntityManager/);
  const securityIndex = fs.readFileSync(path.join(root, ...'be/src/modules/platform/http-security/index.ts'.split('/')), 'utf8');
  assert.doesNotMatch(securityIndex, /parseWebhookProviderConfig|InjectWebhookSignature|\bRateLimit\b|\bRateTier\b|WebhookSignatureService/);
  assert.deepEqual(checkTargets(root, renderTargets(declaration, undefined, { source: appSource(root) })), renderTargets(declaration, undefined, { source: appSource(root) }).map(target => ({
    path: target.path,
    status: 'ok',
    expectedHash: target.hash,
    actualHash: target.hash,
  })), 'starci app sync is a no-op immediately after scaffold');
  execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['-c', 'core.autocrlf=false', 'add', '-A'], { cwd: root, stdio: 'ignore' });
  assert.deepEqual(await checkDatabase({ repoRoot: root, files, emitTypes: async () => GENERATED_TYPES }), []);
  const checked = checkRepository({
    repoRoot: root,
    // Architecture requires the scaffold's own TypeScript install; this no-install unit spec proves the HFS rules and tree.
    machine: () => ({ ok: true, files: 0, kinds: [], violations: [], errors: [] }),
  });
  assert.equal(declaration.edition, 'lite');
  assert.deepEqual(checked.findings, []);
});

test('explicit full edition is byte-for-byte identical to the default scaffold result', (t) => {
  const defaultInto = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-full-default-'));
  const explicitInto = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-full-explicit-'));
  t.after(() => {
    fs.rmSync(defaultInto, { recursive: true, force: true });
    fs.rmSync(explicitInto, { recursive: true, force: true });
  });
  const options = { name: 'demo', pins: PINS, presets: PRESETS, lock: fakeLock };
  const byDefault = scaffoldApp({ ...options, into: defaultInto });
  const explicit = scaffoldApp({ ...options, into: explicitInto, edition: 'full' });
  assert.deepEqual(explicit.files, byDefault.files);
  for (const file of byDefault.files) {
    assert.equal(
      fs.readFileSync(path.join(explicit.root, ...file.split('/')), 'utf8'),
      fs.readFileSync(path.join(byDefault.root, ...file.split('/')), 'utf8'),
      file,
    );
  }
});

test('lite scaffold removes its partial app when database type generation fails', (t) => {
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-lite-types-fail-'));
  t.after(() => fs.rmSync(into, { recursive: true, force: true }));
  assert.throws(
    () => scaffoldApp({
      name: 'demo',
      into,
      edition: 'lite',
      pins: PINS,
      lock: fakeLock,
      emitTypes: () => { throw new Error('local stack unavailable'); },
      now: () => CREATED_AT,
    }),
    error => error.code === 'HFS_SCAFFOLD_TYPES_FAILED' && error.message.includes('local stack unavailable'),
  );
  assert.equal(fs.existsSync(path.join(into, 'demo')), false);
});
