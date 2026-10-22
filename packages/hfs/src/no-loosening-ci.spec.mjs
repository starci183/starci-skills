// Owner ruling 2026-10-22: a loosening is red. The managed CI, the hooks and the package scripts render no escape hatch (continue-on-error, a pass-empty or
// threshold-less test flag, an upload that tolerates failure, a Sonar step that skips without its token, an `|| true`), Sonar and Codecov are required with no
// `optional` setting, and the local release gate runs every row the managed CI runs whether or not release.requireCi waits for the candidate CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTargets } from '../sync/index.mjs';
import { filledShards } from '../sync/ci-commands.mjs';
import { normalizeRelease, releaseGate } from '../release/gate.mjs';
import { qualityServices } from '../runtime/scripts/hfs/ci-declaration.mjs';
import { ciStandardFindings } from '../runtime/scripts/hfs/rules/ci-standard.mjs';
import { parseYaml } from '../runtime/engine/yaml.mjs';

const ESCAPE_HATCHES = [/continue-on-error/, /fail_ci_if_error:\s*false/, /--passWithNoTests/, /--coverageThreshold/, /\|\|\s*true/, /SONAR_TOKEN\s*!=/, /availability/, /skipped/];

const declaration = (edition) => ({ hfs: 3, kind: 'app', edition, project: 'no-loosening', sides: {
  be: { apps: [{ name: 'api', kind: 'api' }] },
  fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/'] },
} });
const rendered = (edition, file) => renderTargets(declaration(edition), {}).find((item) => item.path === file)?.content;

for (const edition of ['full', 'lite']) {
  test(`${edition} managed CI renders no escape hatch and its Sonar token check fails the job`, () => {
    const text = rendered(edition, '.github/workflows/ci.yml');
    assert.ok(text, 'the managed CI is rendered');
    for (const pattern of ESCAPE_HATCHES) assert.doesNotMatch(text, pattern, String(pattern));
    const doc = parseYaml(text);
    const token = doc.jobs.sonar.steps.find((step) => step.name === 'Sonar token');
    assert.match(token.run, /-z "\$SONAR_TOKEN"/u, 'a missing token is checked');
    assert.match(token.run, /exit 1/u, 'and refused');
    const upload = doc.jobs.coverage.steps.find((step) => step.name === 'coverage upload');
    assert.equal(upload.with.fail_ci_if_error, true);
    assert.deepEqual(ciStandardFindings({ doc, file: '.github/workflows/ci.yml', scope: 'app-ci', edition }), []);
  });

  test(`${edition} hooks and package scripts render no escape hatch`, () => {
    const pushHook = rendered(edition, '.husky/pre-push');
    assert.ok(pushHook);
    assert.doesNotMatch(pushHook, /\|\|\s*true/);
    const scripts = rendered(edition, 'package.json');
    assert.ok(scripts.length > 0);
    assert.doesNotMatch(scripts, /--passWithNoTests|--coverageThreshold|test:affected/u);
  });
}

test('an optional setting no longer exists: Sonar and Codecov normalize without it', () => {
  const quality = qualityServices({ services: { sonar: { provider: 'sonarqube', optional: true, host: { public: 'https://sonar.example.invalid' } }, codecov: { optional: true } } });
  assert.equal('optional' in quality.sonar, false);
  assert.equal('optional' in quality.codecov, false);
});

/** The specs jest gives each of `shards` shards: shard i takes the slice of size ceil(specs / shards) starting at (i - 1) * size. */
const shardSizes = (specs, shards) => {
  const size = Math.ceil(specs / shards);
  return Array.from({ length: shards }, (_, index) => Math.max(0, Math.min(specs, (index + 1) * size) - index * size));
};

test('a shard count never leaves an empty shard', () => {
  for (let specs = 1; specs <= 40; specs += 1) {
    for (const wanted of [1, 2, 3, 6, 8]) {
      const shards = filledShards(specs, wanted);
      assert.ok(shards >= 1 && shards <= wanted, `${specs} specs, wanted ${wanted}`);
      assert.equal(shardSizes(specs, shards).includes(0), false, `${specs} specs over ${shards} shards`);
    }
  }
  assert.equal(filledShards(7, 6), 4, '7 specs over 6 shards would leave the fifth and sixth empty');
  assert.equal(filledShards(100, 6), 6);
});

test('the CI standard refuses continue-on-error, a probe, a secret-gated provider step and a shard flag that loosens the run', () => {
  const doc = parseYaml([
    'jobs:',
    '  test:',
    '    timeout-minutes: 5',
    '    strategy: { matrix: { shard: [1] } }',
    '    steps:',
    '      - name: unit',
    '        run: npm test -- --shard=${{ matrix.shard }}/1 --passWithNoTests',
    '        env: { STARCI_COVERAGE_SHARD: "1" }',
    '  coverage:',
    '    timeout-minutes: 5',
    '    steps:',
    '      - id: codecov-availability',
    '        run: echo probe',
    '      - name: upload',
    '        uses: codecov/codecov-action@0fb7174895f61a3b6b78fc075e0cd60383518dac',
    '        continue-on-error: true',
    "        if: ${{ secrets.CODECOV_TOKEN != '' }}",
    '  sonar:',
    '    timeout-minutes: 5',
    '    steps:',
    '      - uses: SonarSource/sonarqube-scan-action@c7ee0f9df90b7aa20e8dcf9695dcfe2e7da5b4f2',
    "        if: ${{ env.SONAR_TOKEN != '' }}",
  ].join('\n'));
  const findings = ciStandardFindings({ doc, file: 'ci.yml', scope: 'app-ci' });
  const messages = findings.map((finding) => finding.message).join('\n');
  assert.ok(findings.some((finding) => finding.item === 'required-providers'));
  assert.ok(findings.some((finding) => finding.item === 'test-sharding'));
  for (const needle of ['continue-on-error', 'codecov-availability', 'gated on a secret', 'fail_ci_if_error', 'passWithNoTests']) assert.ok(messages.includes(needle), needle);
});

const SCRIPTS = Object.fromEntries(['format:check', 'typecheck', 'build:be', 'lint', 'db:lint', 'build:fe', 'test', 'test:integration', 'test:e2e', 'test:contract', 'db:start', 'db:reset', 'db:types', 'db:stop'].map((name) => [name, 'x']));
const SERVICES = { sonar: { provider: 'sonarqube', mode: 'hosted', host: { public: 'https://sonar.example.invalid' } } };
const gateNames = (requireCi) => normalizeRelease({ requireCi }, SCRIPTS, SERVICES).config.gates.map((gate) => gate.name);

test('requireCi does not change the local gate: every CI row runs whether or not the push waits for the candidate CI', () => {
  assert.deepEqual(gateNames(false), gateNames(true));
  assert.deepEqual(gateNames(undefined), gateNames(true));
  for (const row of ['app-check', 'audit', 'format-check', 'typecheck', 'build-be', 'lint', 'db-lint', 'build-fe', 'test', 'test-integration', 'test-e2e', 'test-contract', 'db-start', 'db-reset', 'db-types', 'db-types-committed', 'db-stop']) {
    assert.ok(gateNames(false).includes(row), row);
  }
});

test('the local gate has a row for every npm script step of the managed CI', () => {
  const doc = parseYaml(rendered('lite', '.github/workflows/ci.yml'));
  const rows = new Set(normalizeRelease({}, SCRIPTS, SERVICES).config.gates.map((gate) => gate.command.join(' ')));
  const scriptSteps = Object.entries(doc.jobs).filter(([id]) => id !== 'sonar')
    .flatMap(([, job]) => job.steps ?? []).map((step) => step.run).filter((run) => typeof run === 'string')
    .map((run) => /^npm run ([a-z:]+)/u.exec(run)?.[1]).filter(Boolean);
  assert.ok(scriptSteps.length >= 8, 'the lite CI runs npm scripts');
  for (const script of new Set(scriptSteps.filter((name) => name !== 'codegen' && name !== 'lint:fix'))) assert.ok(rows.has(`npm run ${script}`), `the gate has a row for npm run ${script}`);
});

test('a lite app has no test world rows', () => {
  const { 'test:e2e': removed, 'test:contract': alsoRemoved, ...lite } = SCRIPTS;
  assert.equal(typeof removed + typeof alsoRemoved, 'stringstring');
  const names = normalizeRelease({}, lite, SERVICES).config.gates.map((gate) => gate.name);
  assert.equal(names.some((name) => /^test-(integration|e2e|contract)$/u.test(name)), false);
});

test('a declared Sonar is a row of the local gate and a missing token refuses instead of skipping', async () => {
  const config = normalizeRelease({}, SCRIPTS, SERVICES).config;
  await assert.rejects(releaseGate({ env: {}, cwd: '.' }, config, {}), (error) => error.code === 'RELEASE_SONAR_UNAVAILABLE');
});
