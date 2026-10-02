import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { scaffoldApp } from '../../packages/hfs/scaffold/app.mjs';
import { checkTargets, renderTargets } from '../../packages/hfs/sync/index.mjs';
import { checkRepository } from '../../scripts/hfs/check.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const PINS = parseYaml(fs.readFileSync(path.join(ROOT, 'knowledge', 'hfs', 'canon-pins.yaml'), 'utf8')).pins;
const CREATED_AT = new Date('2026-10-02T12:34:56.000Z');
const GENERATED_TYPES = 'export type Database = { public: { Tables: Record<string, never> } };\n';
const jestPreset = createRequire(import.meta.url)('../../packages/jest-preset/index.cjs');
const PRESETS = { sonarExclusions: jestPreset.sonarExclusions() };

// Design 8.5's exact file-level output, with <ts> fixed by CREATED_AT. Empty brand/ is a directory, not a file.
const EXPECTED_LITE_FILES = Object.freeze([
  '.dockerignore', '.editorconfig', '.gitattributes', '.github/workflows/ci.yml', '.github/workflows/db-deploy.yml',
  '.github/workflows/images.yml', '.gitignore', '.husky/pre-commit', '.husky/pre-push', '.nvmrc', '.prettierignore',
  '.prettierrc', '.sops.yaml', '.starcistacks/dev/environment.json', '.starcistacks/dev/secrets/.gitkeep',
  '.starciwork/.gitignore', '.starciwork/shell/index.yaml', '.starciwork/workspace.yaml', 'README.md',
  'be/apps/api/Dockerfile', 'be/apps/api/src/api.options.ts', 'be/apps/api/src/app.module.ts', 'be/apps/api/src/main.ts',
  'be/eslint.config.mjs', 'be/nest-cli.json',
  'be/src/features/api/system-health/application/check-liveness.contracts.ts',
  'be/src/features/api/system-health/application/check-liveness.handler.ts',
  'be/src/features/api/system-health/application/check-liveness.query.ts',
  'be/src/features/api/system-health/index.ts', 'be/src/features/api/system-health/system-health.module.ts',
  'be/src/features/api/system-health/transport/http/live.controller.ts',
  'be/src/features/api/system-health/transport/http/system-health-http.module.ts',
  'be/src/modules/domain/identity/admission.policy.ts', 'be/src/modules/domain/identity/auth.guard.ts',
  'be/src/modules/domain/identity/errors/identity.error.ts', 'be/src/modules/domain/identity/identity.contracts.ts',
  'be/src/modules/domain/identity/identity.decorators.ts', 'be/src/modules/domain/identity/identity.module-definition.ts',
  'be/src/modules/domain/identity/identity.module.ts', 'be/src/modules/domain/identity/identity.options.ts',
  'be/src/modules/domain/identity/index.ts', 'be/src/modules/domain/identity/messages/identity.messages.ts',
  'be/src/modules/domain/liveness/index.ts', 'be/src/modules/domain/liveness/liveness.contracts.ts',
  'be/src/modules/domain/liveness/liveness.module-definition.ts', 'be/src/modules/domain/liveness/liveness.module.ts',
  'be/src/modules/domain/liveness/liveness.options.ts', 'be/src/modules/domain/liveness/liveness.service.ts',
  'be/src/modules/integrations/supabase/errors/supabase.error.ts', 'be/src/modules/integrations/supabase/index.ts',
  'be/src/modules/integrations/supabase/supabase.client.ts', 'be/src/modules/integrations/supabase/supabase.config.ts',
  'be/src/modules/integrations/supabase/supabase.decorators.ts', 'be/src/modules/integrations/supabase/supabase.jwks.ts',
  'be/src/modules/integrations/supabase/supabase.options.ts',
  'be/src/modules/platform/clock/clock.decorators.ts', 'be/src/modules/platform/clock/clock.module-definition.ts',
  'be/src/modules/platform/clock/clock.module.ts', 'be/src/modules/platform/clock/clock.options.ts',
  'be/src/modules/platform/clock/clock.port.ts', 'be/src/modules/platform/clock/index.ts',
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
  'be/src/modules/platform/database/database.port.ts', 'be/src/modules/platform/database/database.sql.ts',
  'be/src/modules/platform/database/errors/database.error.ts', 'be/src/modules/platform/database/index.ts',
  'be/src/modules/platform/database/primary.config.ts', 'be/src/modules/platform/database/primary.connection.ts',
  'be/src/modules/platform/database/primary.decorators.ts',
  'be/src/modules/platform/errors/domain.error.ts', 'be/src/modules/platform/errors/errors.contracts.ts',
  'be/src/modules/platform/errors/errors.decorators.ts', 'be/src/modules/platform/errors/errors.filter.ts',
  'be/src/modules/platform/errors/errors.log-events.ts', 'be/src/modules/platform/errors/errors.module-definition.ts',
  'be/src/modules/platform/errors/errors.module.ts', 'be/src/modules/platform/errors/errors.options.ts',
  'be/src/modules/platform/errors/errors.service.ts', 'be/src/modules/platform/errors/errors/errors.error.ts',
  'be/src/modules/platform/errors/http-status.policy.ts', 'be/src/modules/platform/errors/index.ts',
  'be/src/modules/platform/errors/messages/errors.messages.ts',
  'be/src/modules/platform/http-security/errors/http-security.error.ts',
  'be/src/modules/platform/http-security/execution-request.mapper.ts',
  'be/src/modules/platform/http-security/http-security.config.ts',
  'be/src/modules/platform/http-security/http-security.decorators.ts',
  'be/src/modules/platform/http-security/http-security.module-definition.ts',
  'be/src/modules/platform/http-security/http-security.module.ts',
  'be/src/modules/platform/http-security/http-security.options.ts',
  'be/src/modules/platform/http-security/index.ts',
  'be/src/modules/platform/http-security/messages/http-security.messages.ts',
  'be/src/modules/platform/http-security/origin.guard.ts', 'be/src/modules/platform/http-security/rate-limit.guard.ts',
  'be/src/modules/platform/http-security/webhook-signature.service.ts',
  'be/src/modules/platform/i18n/bundle-message-catalog.service.ts',
  'be/src/modules/platform/i18n/i18n.contracts.ts', 'be/src/modules/platform/i18n/i18n.decorators.ts',
  'be/src/modules/platform/i18n/i18n.module-definition.ts', 'be/src/modules/platform/i18n/i18n.module.ts',
  'be/src/modules/platform/i18n/i18n.options.ts', 'be/src/modules/platform/i18n/i18n.port.ts',
  'be/src/modules/platform/i18n/index.ts', 'be/src/modules/platform/i18n/request-locale.service.ts',
  'be/src/modules/platform/logging/index.ts', 'be/src/modules/platform/logging/json-logger.service.ts',
  'be/src/modules/platform/logging/logging.decorators.ts', 'be/src/modules/platform/logging/logging.log-events.ts',
  'be/src/modules/platform/logging/logging.module-definition.ts', 'be/src/modules/platform/logging/logging.module.ts',
  'be/src/modules/platform/logging/logging.options.ts', 'be/src/modules/platform/logging/logging.port.ts',
  'be/src/modules/platform/primitives/index.ts', 'be/src/modules/platform/primitives/outcome.contracts.ts',
  'be/src/modules/platform/primitives/outcome.mapper.ts', 'be/tsconfig.build.json', 'be/tsconfig.json',
  'fe/apps/web/next.config.ts', 'fe/apps/web/package.json', 'fe/apps/web/postcss.config.mjs',
  'fe/apps/web/src/app/[locale]/error.tsx', 'fe/apps/web/src/app/[locale]/layout.tsx',
  'fe/apps/web/src/app/[locale]/loading.tsx', 'fe/apps/web/src/app/[locale]/not-found.tsx',
  'fe/apps/web/src/app/[locale]/page.tsx', 'fe/apps/web/src/app/[locale]/providers.tsx',
  'fe/apps/web/src/app/auth/callback/route.ts',
  'fe/apps/web/src/app/global-error.tsx', 'fe/apps/web/src/app/globals.css',
  'fe/apps/web/src/app/health/live/route.ts',
  'fe/apps/web/src/components/blocks/SignInForm/component.tsx',
  'fe/apps/web/src/components/blocks/SignInForm/index.tsx',
  'fe/apps/web/src/components/composites/ErrorNotice/index.tsx',
  'fe/apps/web/src/components/composites/GlobalErrorNotice/index.tsx',
  'fe/apps/web/src/components/composites/LoadingNotice/index.tsx',
  'fe/apps/web/src/components/composites/NotFoundNotice/index.tsx',
  'fe/apps/web/src/components/composites/SiteShell/classNames.ts',
  'fe/apps/web/src/components/composites/SiteShell/index.tsx',
  'fe/apps/web/src/features/layouts/AppLayout/index.tsx',
  'fe/apps/web/src/features/pages/AppErrorPage/component.tsx',
  'fe/apps/web/src/features/pages/AppErrorPage/index.tsx',
  'fe/apps/web/src/features/pages/AppGlobalErrorPage/index.tsx',
  'fe/apps/web/src/features/pages/AppHomePage/component.tsx',
  'fe/apps/web/src/features/pages/AppHomePage/index.tsx',
  'fe/apps/web/src/features/pages/AppLoadingPage/index.tsx',
  'fe/apps/web/src/features/pages/AppNotFoundPage/index.tsx',
  'fe/apps/web/src/features/pages/SignInPage/index.tsx',
  'fe/apps/web/src/modules/api/index.ts', 'fe/apps/web/src/modules/api/outcome.ts',
  'fe/apps/web/src/modules/brand/brand.css', 'fe/apps/web/src/modules/brand/index.ts',
  'fe/apps/web/src/modules/config/index.ts', 'fe/apps/web/src/modules/db/auth/read-session.ts',
  'fe/apps/web/src/modules/db/auth/write-sign-in.ts', 'fe/apps/web/src/modules/db/browser.ts',
  'fe/apps/web/src/modules/db/index.ts', 'fe/apps/web/src/modules/db/outcome.ts',
  'fe/apps/web/src/modules/db/principal.ts', 'fe/apps/web/src/modules/db/server.ts',
  'fe/apps/web/src/modules/i18n/index.ts', 'fe/apps/web/src/modules/i18n/messages/vi.json',
  'fe/apps/web/src/modules/i18n/request.ts', 'fe/apps/web/src/modules/routes/index.ts',
  'fe/apps/web/src/proxy.ts', 'fe/apps/web/tsconfig.json', 'fe/eslint.config.mjs',
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

test('lite scaffold emits the design 8.5 tree and is structurally clean', (t) => {
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-lite-'));
  t.after(() => fs.rmSync(into, { recursive: true, force: true }));
  const { root, files } = scaffoldLite(into);
  assert.deepEqual(files, EXPECTED_LITE_FILES);
  const declaration = JSON.parse(fs.readFileSync(path.join(root, 'hfs.json'), 'utf8'));
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
    '@nestjs/common', '@nestjs/core', '@nestjs/cqrs', '@nestjs/platform-express', '@nestjs/typeorm',
    '@supabase/supabase-js', 'class-transformer', 'class-validator', 'jose', 'pg', 'reflect-metadata',
    'rxjs', 'tslib', 'typeorm',
  ].sort());
  for (const forbidden of ['@nestjs/testing', '@starci/jest-preset', '@starci/test-world', '@types/jest', 'jest', 'nest-commander', 'ts-jest']) {
    assert.equal(pkg.dependencies[forbidden] ?? pkg.devDependencies[forbidden], undefined, `${forbidden} is full-only`);
  }
  const web = JSON.parse(fs.readFileSync(path.join(root, 'fe', 'apps', 'web', 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(web.dependencies).sort(), [
    '@heroui/react', '@heroui/styles', '@starci/grammar', '@supabase/ssr', '@supabase/supabase-js',
    'next', 'next-intl', 'react', 'react-dom', 'server-only',
  ].sort());
  assert.equal(fs.readFileSync(path.join(root, ...'supabase/types/database.types.ts'.split('/')), 'utf8'), GENERATED_TYPES);
  assert.deepEqual(checkTargets(root, renderTargets(declaration, undefined)), renderTargets(declaration, undefined).map(target => ({
    path: target.path,
    status: 'ok',
    expectedHash: target.hash,
    actualHash: target.hash,
  })), 'hfs sync is a no-op immediately after scaffold');
  execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['-c', 'core.autocrlf=false', 'add', '-A'], { cwd: root, stdio: 'ignore' });
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
