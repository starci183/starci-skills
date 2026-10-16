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

import { isSopsEnvelope } from '../../scripts/lib/sops-envelope.mjs';
import { envelopeOf } from '../../scripts/hfs/secret-document.mjs';
import { ageIdentityEnv, initializeAppIdentity } from '../../scripts/hfs/secret-init.mjs';
import { defaultSops } from '../../scripts/hfs/secret-sops.mjs';
import { resolveSops } from '../../scripts/api/sops/resolve-sops.mjs';
import { resolveRealTool } from '../../scripts/api/process/resolve-real-tool.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const PINS = parseYaml(fs.readFileSync(path.join(ROOT, 'knowledge', 'hfs', 'canon-pins.yaml'), 'utf8')).pins;
const CREATED_AT = new Date('2026-10-02T12:34:56.000Z');
const GENERATED_TYPES = 'export type Database = { public: { Tables: Record<string, never> } };\n';
const jestPreset = createRequire(import.meta.url)('../../packages/jest-preset/index.cjs');
const PRESETS = { sonarExclusions: jestPreset.sonarExclusions() };

// The lite starter's exact file-level output, with <ts> fixed by CREATED_AT. It includes a starter brand record. The web app carries the
// shared app core of both editions (owner ruling 2026-10-13): no modules/db, no Server Action and no auth callback route.
const EXPECTED_LITE_FILES = Object.freeze([
  '.claude/.gitignore', '.claude/secret.env', '.dockerignore', '.editorconfig', '.gitattributes', '.github/dependabot.yml', '.github/workflows/ci.yml', '.github/workflows/db-deploy.yml',
  '.github/workflows/images.yml', '.github/workflows/stack-deploy.yml', '.gitignore', '.husky/pre-commit', '.husky/pre-push', '.nvmrc', '.prettierignore',
  '.prettierrc', '.sops.yaml', '.starcistacks/application-stacks.yaml', '.starcistacks/dev/README.md',
  '.starcistacks/dev/environment.json', '.starcistacks/dev/infra/swarm/Caddyfile', '.starcistacks/dev/infra/swarm/owner-actions.md',
  '.starcistacks/dev/infra/swarm/recovery/restore-proof.md', '.starcistacks/dev/infra/swarm/releases/current.yaml',
  '.starcistacks/dev/infra/swarm/releases/images.lock.yaml', '.starcistacks/dev/infra/swarm/releases/previous.yaml',
  '.starcistacks/dev/infra/swarm/stack.yaml',
  '.starcistacks/dev/runtime/env/KEYS.md', '.starcistacks/dev/secrets/.gitkeep',
  '.starcistacks/dev/secrets/primary-db-url.enc', '.starcistacks/dev/secrets/supabase-service-role-key.enc',
  '.starcistacks/production/README.md',
  '.starcistacks/production/environment.json', '.starcistacks/production/infra/swarm/Caddyfile',
  '.starcistacks/production/infra/swarm/owner-actions.md', '.starcistacks/production/infra/swarm/recovery/restore-proof.md',
  '.starcistacks/production/infra/swarm/releases/current.yaml', '.starcistacks/production/infra/swarm/releases/images.lock.yaml',
  '.starcistacks/production/infra/swarm/releases/previous.yaml', '.starcistacks/production/infra/swarm/stack.yaml',
  '.starcistacks/production/runtime/env/KEYS.md', '.starcistacks/production/secrets/primary-db-url.enc',
  '.starcistacks/production/secrets/supabase-service-role-key.enc', '.starciwork/.gitignore', '.starciwork/brand/index.yaml',
  '.starciwork/workspace.yaml', 'README.md', 'be/apps/api/Dockerfile', 'be/apps/api/src/api.env.ts', 'be/apps/api/src/api.options.ts',
  'be/apps/api/src/app.module.ts', 'be/apps/api/src/compose/api.ts', 'be/apps/api/src/compose/domain.ts',
  'be/apps/api/src/compose/integrations.ts', 'be/apps/api/src/compose/platform.ts', 'be/apps/api/src/compose/system.ts',
  'be/apps/api/src/compose/webhooks.ts', 'be/apps/api/src/main.ts', 'be/eslint.config.mjs', 'be/jest.config.js', 'be/nest-cli.json',
  'be/src/features/api/system-health/application/check-liveness.contracts.ts',
  'be/src/features/api/system-health/application/check-liveness.handler.ts',
  'be/src/features/api/system-health/application/check-liveness.query.ts',
  'be/src/features/api/system-health/application/check-readiness.contracts.ts',
  'be/src/features/api/system-health/application/check-readiness.handler.ts',
  'be/src/features/api/system-health/application/check-readiness.query.ts', 'be/src/features/api/system-health/index.ts',
  'be/src/features/api/system-health/system-health.module-definition.ts', 'be/src/features/api/system-health/system-health.module.ts', 'be/src/features/api/system-health/system-health.options.ts', 'be/src/features/api/system-health/transport/http/live.controller.ts',
  'be/src/features/api/system-health/transport/http/ready.controller.ts',
  'be/src/features/api/system-health/transport/http/system-health-http.module-definition.ts', 'be/src/features/api/system-health/transport/http/system-health-http.module.ts', 'be/src/features/api/system-health/transport/http/system-health-http.options.ts',
  'be/src/modules/domain/identity/admission.policy.spec.ts', 'be/src/modules/domain/identity/admission.policy.ts',
  'be/src/modules/domain/identity/auth.guard.spec.ts', 'be/src/modules/domain/identity/auth.guard.ts',
  'be/src/modules/domain/identity/credential.contracts.ts', 'be/src/modules/domain/identity/credential.guard.spec.ts',
  'be/src/modules/domain/identity/credential.guard.ts',
  'be/src/modules/domain/identity/errors/identity.error.ts', 'be/src/modules/domain/identity/identity.contracts.ts',
  'be/src/modules/domain/identity/identity.decorators.ts', 'be/src/modules/domain/identity/identity.module-definition.ts',
  'be/src/modules/domain/identity/identity.module.ts', 'be/src/modules/domain/identity/identity.options.ts',
  'be/src/modules/domain/identity/index.ts', 'be/src/modules/domain/identity/messages/identity.messages.ts',
  'be/src/modules/domain/liveness/index.ts', 'be/src/modules/domain/liveness/liveness.contracts.ts',
  'be/src/modules/domain/liveness/liveness.module-definition.ts', 'be/src/modules/domain/liveness/liveness.module.ts',
  'be/src/modules/domain/liveness/liveness.options.ts', 'be/src/modules/domain/liveness/liveness.service.spec.ts',
  'be/src/modules/domain/liveness/liveness.service.ts', 'be/src/modules/integrations/supabase/errors/supabase.error.ts',
  'be/src/modules/integrations/supabase/index.ts', 'be/src/modules/integrations/supabase/supabase.client.spec.ts',
  'be/src/modules/integrations/supabase/supabase.client.ts', 'be/src/modules/integrations/supabase/supabase.config.ts',
  'be/src/modules/integrations/supabase/supabase.decorators.ts', 'be/src/modules/integrations/supabase/supabase.jwks.ts',
  'be/src/modules/integrations/supabase/supabase.options.ts', 'be/src/modules/platform/clock/clock.decorators.ts',
  'be/src/modules/platform/clock/clock.module-definition.ts', 'be/src/modules/platform/clock/clock.module.ts',
  'be/src/modules/platform/clock/clock.options.ts', 'be/src/modules/platform/clock/clock.port.ts',
  'be/src/modules/platform/clock/index.ts', 'be/src/modules/platform/clock/system-clock.service.spec.ts',
  'be/src/modules/platform/clock/system-clock.service.ts', 'be/src/modules/platform/composition/composition.decorators.ts',
  'be/src/modules/platform/composition/index.ts', 'be/src/modules/platform/config/env-source.config.ts',
  'be/src/modules/platform/config/errors/config.error.ts', 'be/src/modules/platform/config/index.ts',
  'be/src/modules/platform/config/server.config.ts', 'be/src/modules/platform/config/server.options.ts',
  'be/src/modules/platform/cqrs/cqrs.contracts.ts', 'be/src/modules/platform/cqrs/cqrs.decorators.ts',
  'be/src/modules/platform/cqrs/cqrs.handler.ts', 'be/src/modules/platform/cqrs/cqrs.log-events.ts',
  'be/src/modules/platform/cqrs/cqrs.module-definition.ts', 'be/src/modules/platform/cqrs/cqrs.module.ts',
  'be/src/modules/platform/cqrs/cqrs.options.ts', 'be/src/modules/platform/cqrs/index.ts',
  'be/src/modules/platform/database/database-probe.service.spec.ts', 'be/src/modules/platform/database/database-probe.service.ts',
  'be/src/modules/platform/database/database.module-definition.ts', 'be/src/modules/platform/database/database.module.ts',
  'be/src/modules/platform/database/database.options.ts', 'be/src/modules/platform/database/database.port.ts',
  'be/src/modules/platform/database/errors/database.error.ts', 'be/src/modules/platform/database/index.ts',
  'be/src/modules/platform/database/primary.config.ts', 'be/src/modules/platform/database/primary.connection.ts',
  'be/src/modules/platform/database/primary.decorators.ts', 'be/src/modules/platform/errors/domain.error.ts',
  'be/src/modules/platform/errors/errors.contracts.ts', 'be/src/modules/platform/errors/errors.decorators.ts',
  'be/src/modules/platform/errors/errors.filter.spec.ts', 'be/src/modules/platform/errors/errors.filter.ts',
  'be/src/modules/platform/errors/errors.log-events.ts', 'be/src/modules/platform/errors/errors.module-definition.ts',
  'be/src/modules/platform/errors/errors.module.ts', 'be/src/modules/platform/errors/errors.options.ts',
  'be/src/modules/platform/errors/errors.service.spec.ts', 'be/src/modules/platform/errors/errors.service.ts',
  'be/src/modules/platform/errors/errors/errors.error.ts', 'be/src/modules/platform/errors/http-status.policy.ts',
  'be/src/modules/platform/errors/index.ts', 'be/src/modules/platform/errors/messages/errors.messages.ts',
  'be/src/modules/platform/http-security/edge-security.service.spec.ts', 'be/src/modules/platform/http-security/edge-security.service.ts',
  'be/src/modules/platform/http-security/errors/http-security.error.ts',
  'be/src/modules/platform/http-security/execution-request.mapper.spec.ts',
  'be/src/modules/platform/http-security/execution-request.mapper.ts', 'be/src/modules/platform/http-security/http-security.config.ts',
  'be/src/modules/platform/http-security/http-security.decorators.ts',
  'be/src/modules/platform/http-security/http-security.module-definition.ts',
  'be/src/modules/platform/http-security/http-security.module.ts', 'be/src/modules/platform/http-security/http-security.options.ts',
  'be/src/modules/platform/http-security/index.ts', 'be/src/modules/platform/http-security/messages/http-security.messages.ts',
  'be/src/modules/platform/http-security/origin.guard.spec.ts', 'be/src/modules/platform/http-security/origin.guard.ts',
  'be/src/modules/platform/http-security/rate-limit.guard.spec.ts', 'be/src/modules/platform/http-security/rate-limit.guard.ts',
  'be/src/modules/platform/http-security/readiness.contracts.ts', 'be/src/modules/platform/http-security/readiness.decorators.ts',
  'be/src/modules/platform/http-security/readiness.service.spec.ts', 'be/src/modules/platform/http-security/readiness.service.ts',
  'be/src/modules/platform/http-security/request-validation.service.spec.ts',
  'be/src/modules/platform/http-security/request-validation.service.ts',
  'be/src/modules/platform/http-security/webhook-signature.service.spec.ts',
  'be/src/modules/platform/http-security/webhook-signature.service.ts',
  'be/src/modules/platform/i18n/bundle-message-catalog.service.spec.ts', 'be/src/modules/platform/i18n/bundle-message-catalog.service.ts',
  'be/src/modules/platform/i18n/i18n.contracts.ts', 'be/src/modules/platform/i18n/i18n.decorators.ts',
  'be/src/modules/platform/i18n/i18n.module-definition.ts', 'be/src/modules/platform/i18n/i18n.module.ts',
  'be/src/modules/platform/i18n/i18n.options.ts', 'be/src/modules/platform/i18n/i18n.port.ts', 'be/src/modules/platform/i18n/index.ts',
  'be/src/modules/platform/i18n/request-locale.service.spec.ts', 'be/src/modules/platform/i18n/request-locale.service.ts',
  'be/src/modules/platform/logging/index.ts', 'be/src/modules/platform/logging/json-logger.service.spec.ts',
  'be/src/modules/platform/logging/json-logger.service.ts', 'be/src/modules/platform/logging/logging.decorators.ts',
  'be/src/modules/platform/logging/logging.log-events.ts', 'be/src/modules/platform/logging/logging.module-definition.ts',
  'be/src/modules/platform/logging/logging.module.ts', 'be/src/modules/platform/logging/logging.options.ts',
  'be/src/modules/platform/logging/logging.port.ts', 'be/src/modules/platform/primitives/index.ts',
  'be/src/modules/platform/primitives/outcome.contracts.ts', 'be/src/modules/platform/primitives/outcome.mapper.spec.ts',
  'be/src/modules/platform/primitives/outcome.mapper.ts', 'be/src/modules/platform/retry/index.ts',
  'be/src/modules/platform/retry/retry.decorators.ts', 'be/src/modules/platform/retry/retry.module-definition.ts',
  'be/src/modules/platform/retry/retry.module.ts', 'be/src/modules/platform/retry/retry.options.ts',
  'be/src/modules/platform/retry/retry.port.ts', 'be/src/modules/platform/retry/system-timer.service.spec.ts',
  'be/src/modules/platform/retry/system-timer.service.ts', 'be/src/tests/fixtures/builders/api.builder.ts', 'be/src/tests/tsconfig.json',
  'be/tsconfig.build.json', 'be/tsconfig.json', 'codecov.yml', 'fe/apps/web/next.config.ts', 'fe/apps/web/package.json',
  'fe/apps/web/postcss.config.mjs', 'fe/apps/web/src/app/[locale]/error.tsx', 'fe/apps/web/src/app/[locale]/layout.tsx',
  'fe/apps/web/src/app/[locale]/loading.tsx', 'fe/apps/web/src/app/[locale]/not-found.tsx', 'fe/apps/web/src/app/[locale]/page.tsx',
  'fe/apps/web/src/app/[locale]/providers.tsx', 'fe/apps/web/src/app/global-error.tsx', 'fe/apps/web/src/app/globals.css',
  'fe/apps/web/src/app/health/live/route.ts', 'fe/apps/web/src/components/blocks/SignInForm/component.tsx',
  'fe/apps/web/src/components/blocks/SignInForm/index.tsx', 'fe/apps/web/src/components/blocks/SignOutButton/component.tsx',
  'fe/apps/web/src/components/blocks/SignOutButton/index.tsx', 'fe/apps/web/src/components/composites/ErrorNotice/index.tsx',
  'fe/apps/web/src/components/composites/GlobalErrorNotice/index.tsx', 'fe/apps/web/src/components/composites/LoadingNotice/index.tsx',
  'fe/apps/web/src/components/composites/NotFoundNotice/index.tsx', 'fe/apps/web/src/components/composites/SiteShell/classNames.ts',
  'fe/apps/web/src/components/composites/SiteShell/index.tsx', 'fe/apps/web/src/components/leaves/Icon/index.tsx',
  'fe/apps/web/src/components/providers/AppProviders/index.tsx', 'fe/apps/web/src/features/layouts/AppLayout/index.tsx',
  'fe/apps/web/src/features/overlays/AppGuideOverlay/component.tsx', 'fe/apps/web/src/features/overlays/AppGuideOverlay/index.tsx',
  'fe/apps/web/src/features/pages/AppErrorPage/component.tsx', 'fe/apps/web/src/features/pages/AppErrorPage/index.tsx',
  'fe/apps/web/src/features/pages/AppGlobalErrorPage/index.tsx', 'fe/apps/web/src/features/pages/AppHomePage/component.tsx',
  'fe/apps/web/src/features/pages/AppHomePage/index.tsx', 'fe/apps/web/src/features/pages/AppLoadingPage/index.tsx',
  'fe/apps/web/src/features/pages/AppNotFoundPage/index.tsx', 'fe/apps/web/src/hooks/auth/index.ts',
  'fe/apps/web/src/hooks/auth/useSession.ts', 'fe/apps/web/src/hooks/auth/useSignIn.ts', 'fe/apps/web/src/hooks/auth/useSignOut.ts',
  'fe/apps/web/src/hooks/effects/index.ts', 'fe/apps/web/src/hooks/effects/useAuthSessionEffect.ts',
  'fe/apps/web/src/hooks/swr/SwrSideEffects.tsx', 'fe/apps/web/src/hooks/swr/index.ts', 'fe/apps/web/src/hooks/zustand/appGuide/index.ts',
  'fe/apps/web/src/hooks/zustand/appGuide/store.ts', 'fe/apps/web/src/modules/api/graphql/index.ts',
  'fe/apps/web/src/modules/api/graphql/types.ts', 'fe/apps/web/src/modules/api/index.ts', 'fe/apps/web/src/modules/auth/client.ts',
  'fe/apps/web/src/modules/auth/contracts.ts', 'fe/apps/web/src/modules/auth/index.ts', 'fe/apps/web/src/modules/brand/brand.css',
  'fe/apps/web/src/modules/brand/index.ts', 'fe/apps/web/src/modules/config/index.ts', 'fe/apps/web/src/modules/i18n/index.ts',
  'fe/apps/web/src/modules/i18n/messages/en.json', 'fe/apps/web/src/modules/i18n/messages/vi.json',
  'fe/apps/web/src/modules/i18n/request.ts', 'fe/apps/web/src/modules/i18n/routing.ts', 'fe/apps/web/src/modules/routes/index.ts',
  'fe/apps/web/src/modules/toast/api.ts', 'fe/apps/web/src/modules/toast/hooks.ts', 'fe/apps/web/src/modules/toast/index.ts',
  'fe/apps/web/src/modules/toast/toast.tsx', 'fe/apps/web/src/modules/types/ambient/styles.d.ts', 'fe/apps/web/src/proxy.ts',
  'fe/apps/web/src/redux/ReduxProvider.tsx', 'fe/apps/web/src/redux/hooks.ts', 'fe/apps/web/src/redux/index.ts',
  'fe/apps/web/src/redux/slices/session.ts', 'fe/apps/web/src/redux/store.ts', 'fe/apps/web/tsconfig.json', 'fe/eslint.config.mjs',
  'fe/stylelint.config.mjs', 'fe/tsconfig.json', 'hfs.json', 'package-lock.json', 'package.json', 'scripts/codegen.mjs',
  'sonar-project.properties', 'supabase/config.toml', 'supabase/migrations/20261002123456_baseline.sql', 'supabase/seed.sql',
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

function assertPublicRelease(root, environment, spec) {
  const directory = `.starcistacks/${environment}/infra/swarm/releases`;
  assert.equal(spec.release.imagesLock, `${directory}/images.lock.yaml`);
  assert.equal(spec.release.pointer, `${directory}/current.yaml`);
  assert.equal(spec.release.previous, `${directory}/previous.yaml`);
  assert.ok(spec.release.healthAssertions.length > 0);
  for (const file of [spec.release.imagesLock, spec.release.pointer, spec.release.previous]) {
    assert.ok(fs.statSync(path.join(root, file)).size > 0, `${file} is a populated public release record`);
  }
}

function assertStackRecovery(root, environment, spec) {
  assert.deepEqual(spec.backup.map(record => record.component).sort((a, b) => a.localeCompare(b)), ['ingress', 'supabase']);
  for (const record of spec.backup) {
    for (const key of ['target', 'retention', 'owner']) assert.ok(record[key]?.trim(), `${record.component} declares ${key}`);
    assert.equal(record.restoreProof, `.starcistacks/${environment}/infra/swarm/recovery/restore-proof.md`);
    assert.ok(fs.statSync(path.join(root, record.restoreProof)).size > 0);
  }
}

function assertSwarmBindings(root, environment, spec) {
  const file = path.join(root, '.starcistacks', environment, 'infra/swarm/stack.yaml');
  const model = parseYaml(fs.readFileSync(file, 'utf8'));
  assert.equal(spec.ingress.component, 'ingress');
  assert.deepEqual(Object.entries(model.services).filter(([, service]) => service.ports?.length).map(([id]) => id), ['ingress']);
  for (const port of model.services.ingress.ports) {
    assert.equal(port.mode, 'ingress');
    assert.ok([80, 443].includes(port.published));
  }
  assert.deepEqual(spec.secrets.map(secret => secret.name).sort((a, b) => a.localeCompare(b)), ['primary-db-url', 'supabase-service-role-key']);
  for (const secret of spec.secrets) {
    assert.equal(secret.runtimeName, `demo-${environment}-${secret.name}-v1`);
    assert.equal(secret.version, 1);
    assert.deepEqual(model.secrets[secret.name], { external: true, name: secret.runtimeName });
  }
}

function assertLiteStacks(root, stacks) {
  assert.deepEqual(stacks.backing, { supabase: { provider: 'supabase', managed: true } });
  assert.equal(stacks.services.sonar.provider, 'sonarqube');
  assert.equal(stacks.services.sonar.mode, 'local');
  assert.deepEqual(stacks.services.sonar.stack, { owner: 'host', root: '.claude/ext/sonar', environment: 'dev', compose: 'compose.yaml' });
  assert.deepEqual(Object.keys(stacks.components), ['api', 'web', 'ingress']);
  assert.equal(stacks.components.ingress.role, 'ingress');
  for (const environment of ['dev', 'production']) {
    const spec = stacks.environments[environment];
    assert.equal(spec.runtime, 'docker-swarm');
    assert.deepEqual(spec.composeFiles, ['infra/swarm/stack.yaml']);
    assert.equal(spec.runbook, 'README.md');
    assert.deepEqual(Object.keys(spec.components), ['api', 'web', 'ingress']);
    const directory = path.join(root, '.starcistacks', environment);
    assert.ok(fs.existsSync(path.join(directory, 'infra/swarm/Caddyfile')));
    assert.ok(fs.existsSync(path.join(directory, 'runtime/env/KEYS.md')));
    assertPublicRelease(root, environment, spec);
    assertStackRecovery(root, environment, spec);
    assertSwarmBindings(root, environment, spec);
  }
}

test('lite scaffold emits its workspace and required stack declarations and is structurally clean', async (t) => {
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-lite-'));
  t.after(() => fs.rmSync(into, { recursive: true, force: true }));
  const { root, files } = scaffoldLite(into);
  assert.deepEqual(files, EXPECTED_LITE_FILES);
  const stacks = parseYaml(fs.readFileSync(path.join(root, '.starcistacks/application-stacks.yaml'), 'utf8'));
  assertLiteStacks(root, stacks);
  const entry = fs.readFileSync(path.join(root, 'be/apps/api/src/main.ts'), 'utf8');
  const env = fs.readFileSync(path.join(root, 'be/apps/api/src/api.env.ts'), 'utf8');
  assert.match(entry, /readApiEnv\(env\)/);
  assert.equal((entry.match(/EnvSource\.fromProcess\(\)/g) ?? []).length, 1);
  assert.ok(entry.trimEnd().split('\n').length <= 80, 'the API bootstrap stays within its 80-line budget');
  assert.doesNotMatch(entry, /parse(?:Server|HttpSecurity|PrimaryDatabase|Supabase)Config/);
  assert.match(env, /export interface ApiEnv \{/);
  for (const [field, parser] of [['server', 'parseServerConfig'], ['httpSecurity', 'parseHttpSecurityConfig'], ['database', 'parsePrimaryDatabaseConfig'], ['supabase', 'parseSupabaseConfig']])
    assert.ok(env.includes(`readonly ${field}: ReturnType<typeof ${parser}>`));
  assert.doesNotMatch(env, /ApiEnv extends|from "\.\/api\.options"/);
  assert.match(env, /export const readApiEnv = \(env: EnvSource\): ApiEnv/);
  assert.ok(env.trimEnd().split('\n').length <= 150, 'the API env reader stays within its 150-line budget');
  assert.doesNotMatch(env, /parseApiEnv|localhost|127\.0\.0\.1|process\.env/);
  assert.doesNotMatch(env, /from "@features\/|\b\w+Module\b|\.(?:register|forRoot)\(/);
  assert.deepEqual(fs.readdirSync(path.join(root, '.starciwork')).sort(), ['.gitignore', 'brand', 'workspace.yaml']);
  assert.deepEqual(parseYaml(fs.readFileSync(path.join(root, '.starciwork/workspace.yaml'), 'utf8')), {
    schema: 'work/workspace@1', id: 'demo', project: 'demo',
    description: 'The Work records of demo, one StarCi app with its back end in be/ and its front end in fe/.',
    repositories: [{ role: 'be', name: 'be' }, { role: 'fe', name: 'fe' }],
  });
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
  // ruling:R212/case-1, amended by ruling:R212/case-4: the lite starter keeps the unit run without a test-world dependency and has no cli app until add cli.
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
  assert.match(baselineSql, /if not exists \(select 1 from pg_catalog\.pg_roles where rolname = 'app_be'\) then/);
  assert.match(baselineSql, /create role app_be login noinherit nosuperuser nobypassrls nocreatedb nocreaterole;/);
  assert.match(baselineSql, /alter role app_be login noinherit nocreatedb nocreaterole;/);
  assert.doesNotMatch(baselineSql, /alter role app_be[^;]*(?:nosuperuser|bypassrls)/i, 'a Supabase migration role cannot name SUPERUSER or BYPASSRLS in ALTER ROLE');
  assert.doesNotMatch(baselineSql, /drop role/i);
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
  assert.doesNotMatch(databaseIndex, /MigrationRunnerService|SeedRunnerService|requireOwnedRow|\bsql\b/);
  // The entity-manager injection and its token are exported by the first generator that consumes them (add table, add webhook): a fresh
  // lite scaffold has no consumer, and an export without a consumer is a dead export (HFS_UNUSED_EXPORT).
  assert.doesNotMatch(databaseIndex, /\bInjectPrimaryEntityManager\b|\bPRIMARY_ENTITY_MANAGER\b/);
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
  // Each scaffold draws its own age identity (the runtime repository tracks no key material): the identity file, its public recipient
  // and the sealed members differ by design. They keep their shape and each scaffold's recipient; every other file is byte-identical.
  const recipientOf = root => parseYaml(fs.readFileSync(path.join(root, '.sops.yaml'), 'utf8')).creation_rules[0].age;
  const recipients = [recipientOf(byDefault.root), recipientOf(explicit.root)];
  assert.notEqual(recipients[0], recipients[1], 'every scaffold gets its own age recipient');
  const read = (root, file) => fs.readFileSync(path.join(root, ...file.split('/')), 'utf8');
  for (const file of byDefault.files) {
    if (file === '.claude/secret.env') {
      for (const root of [byDefault.root, explicit.root]) assert.match(read(root, file), /^SOPS_AGE_KEY=AGE-SECRET-KEY-1[0-9A-Z]{58}\n$/, file);
    } else if (file.endsWith('.enc')) {
      for (const root of [byDefault.root, explicit.root]) assert.equal(isSopsEnvelope(read(root, file)), true, file);
    } else {
      const own = (root, recipient) => read(root, file).replaceAll(recipient, '<recipient>');
      assert.equal(own(explicit.root, recipients[1]), own(byDefault.root, recipients[0]), file);
    }
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


function scaffoldIdentityEnv(root) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('SOPS_')));
  return ageIdentityEnv(root, env);
}

function assertAppSealedMembers(root, recipient) {
  const members = [];
  for (const environment of ['dev', 'production']) {
    for (const slug of ['primary-db-url', 'supabase-service-role-key']) {
      const file = path.join(root, '.starcistacks', environment, 'secrets', slug + '.enc');
      const envelope = fs.readFileSync(file, 'utf8');
      assert.ok(isSopsEnvelope(envelope), 'the generated member is a sealed SOPS envelope');
      assert.deepEqual(envelopeOf(envelope).recipients, [recipient]);
      members.push(file);
    }
  }
  return members;
}

test('lite scaffold seals fresh placeholders only to its own app recipient and ignores its private key', (t) => {
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-lite-recipient-'));
  t.after(() => fs.rmSync(into, { recursive: true, force: true }));
  const first = scaffoldLite(path.join(into, 'first'));
  const second = scaffoldLite(path.join(into, 'second'));
  const config = root => parseYaml(fs.readFileSync(path.join(root, '.sops.yaml'), 'utf8'));
  const recipient = config(first.root).creation_rules[0].age;
  const otherRecipient = config(second.root).creation_rules[0].age;
  assert.notEqual(recipient, otherRecipient, 'each app receives a fresh public recipient');
  const members = assertAppSealedMembers(first.root, recipient);
  assertAppSealedMembers(second.root, otherRecipient);
  assert.throws(() => initializeAppIdentity(first.root), /already has a private age identity/);
  execFileSync('git', ['init', '-q'], { cwd: first.root, stdio: 'ignore' });
  execFileSync('git', ['check-ignore', '.claude/secret.env'], { cwd: first.root, stdio: 'ignore' });
  execFileSync('git', ['-c', 'core.autocrlf=false', 'add', '-A'], { cwd: first.root, stdio: 'ignore' });
  const tracked = execFileSync('git', ['ls-files'], { cwd: first.root, encoding: 'utf8' });
  assert.equal(tracked.includes('.claude/secret.env'), false, 'the private identity cannot enter the app index');
  const env = scaffoldIdentityEnv(first.root);
  if (!resolveSops(env) || !resolveRealTool('age', { env }) || !resolveRealTool('age-keygen', { env })) {
    t.diagnostic('native SOPS/age unavailable: verified generated envelope structure and app-specific recipient');
    return;
  }
  const own = defaultSops(env, first.root);
  for (const member of members)
    assert.ok(Object.keys(own.decrypt(member, 'dotenv')).length > 0, 'the app key decrypts its generated member');
  const other = defaultSops(scaffoldIdentityEnv(second.root), second.root);
  assert.throws(() => other.decrypt(members[0], 'dotenv'), 'another app key cannot decrypt the generated member');
});
