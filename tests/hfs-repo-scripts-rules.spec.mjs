// The repository-hygiene tree checks of `hfs check` (scripts/lib/hfs-rules): R102 BE_SPEC_PLACEMENT, R103 HFS_REPO_LOCAL_CHECK,
// R104 HFS_LINT_SUPPRESSION_FILE, R105 HFS_PROOF_COMMAND_FILE_MISSING, and the slot repo.scripts that holds the root `scripts/` folder.
// Each has a violating and a passing tree; the clean repository of tests/_hfs-cli-fixture.mjs is the passing base.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkRepo } from '../scripts/lib/hfs-check.mjs';
import { BE, FE, cleanup, gitAdd, writeCleanRepo } from './_hfs-cli-fixture.mjs';

const made = [];
const repoOf = (declaration, mutate, options) => {
  const dir = writeCleanRepo(declaration, options);
  made.push(dir);
  if (mutate) mutate(dir);
  return gitAdd(dir);
};
test.after(() => cleanup(made));

const put = (dir, relative, text = 'export {};\n') => {
  const target = path.join(dir, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const only = (result, code) => result.findings.filter((f) => f.code === code);
const pathsOf = (result, code) => only(result, code).map((f) => f.path).sort();
const slotFindings = (result) => result.findings.filter((f) => f.code === 'HFS_SLOT_UNDECLARED' || f.code === 'HFS_FORBIDDEN_PRESENT');

// ------------------------------------------------------------------------------------------------ slot repo.scripts

test('repo.scripts: an empty folder holding only .gitkeep and an operational script are owned, in both profiles', () => {
  for (const declaration of [BE, FE]) {
    const result = checkRepo({ repoRoot: repoOf(declaration, (dir) => {
      put(dir, 'scripts/.gitkeep', '');
      put(dir, 'scripts/rotate-logs.mjs', 'console.log("ok");\n');
      put(dir, 'scripts/cleanup.ps1', 'Write-Output ok\n');
      put(dir, 'scripts/warm.sh', 'echo ok\n');
    }) });
    assert.deepEqual(slotFindings(result).filter((f) => f.path.startsWith('scripts/')), [], declaration.profile);
    assert.deepEqual(only(result, 'HFS_REPO_LOCAL_CHECK'), [], declaration.profile);
  }
});

test('repo.scripts: a script of another kind (.ts) and a nested folder match no slot', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => {
    put(dir, 'scripts/codemod.ts');
    put(dir, 'scripts/seed/run.mjs');
  }) });
  assert.deepEqual(pathsOf(result, 'HFS_SLOT_UNDECLARED').filter((p) => p.startsWith('scripts/')), ['scripts/codemod.ts', 'scripts/seed/run.mjs']);
});

// ------------------------------------------------------------------------------------------------ R102 BE_SPEC_PLACEMENT

test('BE_SPEC_PLACEMENT: a spec in an app, scripts/, tools/, beside a non-service file or under src/ elsewhere is refused', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => {
    put(dir, 'apps/core/src/core.composition.spec.ts');
    put(dir, 'scripts/x.spec.mjs');
    put(dir, 'scripts/probe.test.cjs');
    put(dir, 'tools/seed.spec.ts');
    put(dir, 'src/features/orders/application/place-order.spec.ts');
    put(dir, 'src/tests/misc/other.e2e-spec.ts');
  }) });
  assert.deepEqual(pathsOf(result, 'BE_SPEC_PLACEMENT'), ['apps/core/src/core.composition.spec.ts', 'scripts/probe.test.cjs', 'scripts/x.spec.mjs', 'src/features/orders/application/place-order.spec.ts', 'src/tests/misc/other.e2e-spec.ts', 'tools/seed.spec.ts']);
});

test('BE_SPEC_PLACEMENT: a service spec beside its service and the integration, e2e and contract layers are clean', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => {
    put(dir, 'src/modules/domain/billing/invoice.service.ts');
    put(dir, 'src/modules/domain/billing/invoice.service.spec.ts');
    put(dir, 'src/tests/integration/orders/claim.integration-spec.ts');
    put(dir, 'src/tests/e2e/orders/flow.e2e-spec.ts');
    put(dir, 'src/tests/contract/stripe/payments.contract-spec.ts');
    put(dir, 'scripts/rotate-logs.mjs');
  }) });
  assert.deepEqual(only(result, 'BE_SPEC_PLACEMENT'), []);
});

// ------------------------------------------------------------------------------------------------ R103 HFS_REPO_LOCAL_CHECK

test('HFS_REPO_LOCAL_CHECK: local rule sources, a check script and a script that runs a check are refused', () => {
  for (const declaration of [BE, FE]) {
    const result = checkRepo({ repoRoot: repoOf(declaration, (dir) => {
      put(dir, 'scripts/eslint-local-rules.mjs');
      put(dir, 'scripts/check-foo.mjs');
      put(dir, 'tools/check-bar.mjs');
      put(dir, 'eslint-plugin-local/index.mjs');
      put(dir, 'package.json', json({ name: 'demo', private: true, scripts: { 'lint:local': 'node scripts/check-foo.mjs', build: 'tsc' } }));
    }) });
    assert.deepEqual(pathsOf(result, 'HFS_REPO_LOCAL_CHECK'), ['eslint-plugin-local/index.mjs', 'package.json', 'scripts/check-foo.mjs', 'scripts/eslint-local-rules.mjs', 'tools/check-bar.mjs'], declaration.profile);
  }
});

test('HFS_REPO_LOCAL_CHECK: an operational script, an ordinary script and a script that runs no check are clean', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => {
    put(dir, 'scripts/rotate-logs.mjs');
    put(dir, 'package.json', json({ name: 'demo', private: true, scripts: { 'logs:rotate': 'node scripts/rotate-logs.mjs' } }));
  }) });
  assert.deepEqual(only(result, 'HFS_REPO_LOCAL_CHECK'), []);
});

// ------------------------------------------------------------------------------------------------ R104 HFS_LINT_SUPPRESSION_FILE

test('HFS_LINT_SUPPRESSION_FILE: a suppressions file, the lint:suppressions script, an eslint suppress flag and a suppressions config are refused', () => {
  for (const declaration of [BE, FE]) {
    const result = checkRepo({ repoRoot: repoOf(declaration, (dir) => {
      put(dir, 'eslint.suppressions.config.mjs');
      put(dir, 'eslint-suppressions.json', '{}\n');
      put(dir, 'eslint.config.mjs', "export default [{ linterOptions: { suppressions: './eslint-suppressions.json' } }];\n");
      put(dir, 'package.json', json({ name: 'demo', private: true, scripts: { 'lint:suppressions': 'node eslint.suppressions.config.mjs', lint: 'eslint --suppress-all .' } }));
    }) });
    assert.deepEqual(pathsOf(result, 'HFS_LINT_SUPPRESSION_FILE'), ['eslint-suppressions.json', 'eslint.config.mjs', 'eslint.suppressions.config.mjs', 'package.json', 'package.json'], declaration.profile);
  }
});

test('HFS_LINT_SUPPRESSION_FILE: plain eslint scripts and the standard config are clean', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => {
    put(dir, 'package.json', json({ name: 'demo', private: true, scripts: { lint: 'eslint --max-warnings=0 .', 'lint:fix': 'hfs lint --fix' } }));
  }) });
  assert.deepEqual(only(result, 'HFS_LINT_SUPPRESSION_FILE'), []);
});

// ------------------------------------------------------------------------------------------------ R105 HFS_PROOF_COMMAND_FILE_MISSING

const RECORD = (commands, repository) => `schema: work/implementation@1\nid: impl.demo.gate\nstate: todo\n${repository ? `repository: ${repository}\n` : ''}requiresProof:\n${Object.entries(commands).map(([kind, command]) => `  ${kind}:\n    required: true\n    command: ${JSON.stringify(command)}\n`).join('')}`;

test('HFS_PROOF_COMMAND_FILE_MISSING: a proof command that runs a deleted script or spec is refused, one finding per kind and path', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => {
    put(dir, '.starciwork/features/login/impl/demo/gate/index.yaml', RECORD({
      unit: 'node --test scripts/provision.spec.mjs',
      live: 'npm run test:e2e -- src/tests/e2e/login/gate.e2e-spec.ts',
    }));
  }) });
  const found = only(result, 'HFS_PROOF_COMMAND_FILE_MISSING');
  assert.deepEqual(found.map((f) => f.missing).sort(), ['scripts/provision.spec.mjs', 'src/tests/e2e/login/gate.e2e-spec.ts']);
  assert.deepEqual(found.map((f) => f.kind).sort(), ['live', 'unit']);
});

test('HFS_PROOF_COMMAND_FILE_MISSING: a command whose files exist, flags, globs, other repositories and build products are clean', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => {
    put(dir, 'src/tests/e2e/login/gate.e2e-spec.ts');
    put(dir, '.starciwork/features/login/impl/demo/gate/index.yaml', RECORD({
      e2e: 'npm run test:e2e -- src/tests/e2e/login/gate.e2e-spec.ts',
      implementation: 'node D:/Repositories/other/.claude/bin/starci.mjs validate D:/Repositories/demo/.starciwork/features/login --strict --json',
      requirements: 'docker compose -f ../infra/compose.yaml build && node dist/apps/core/main.js --config "src/**/*.json" --port=3000',
    }));
  }) });
  assert.deepEqual(only(result, 'HFS_PROOF_COMMAND_FILE_MISSING'), []);
});

test('HFS_PROOF_COMMAND_FILE_MISSING: a record of an implementation in another repository is not judged, its commands run there', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => {
    put(dir, '.starciwork/features/login/impl/other/gate/index.yaml', RECORD({ unit: 'npx vitest run apps/app/src/login.spec.ts' }, 'other-repo'));
  }) });
  assert.deepEqual(only(result, 'HFS_PROOF_COMMAND_FILE_MISSING'), []);
});
