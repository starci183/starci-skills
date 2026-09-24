import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../engine/yaml.mjs';
import { checkStarciStacks, checkStarciStacksMain, ownerAskConflict, resolveStackService, schemaErrors, CODES } from '../scripts/checks/check-starcistacks.mjs';
import { loadContractChanges } from '../scripts/kernel/contract-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = parseYaml(fs.readFileSync(path.join(root, 'modules', 'schemas', 'application-stacks.schema.yaml'), 'utf8'));
const fixtures = path.join(root, 'examples', 'starcistacks-services');

const write = (file, body) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
const yamlOf = (value) => JSON.stringify(value, null, 2); // JSON is YAML

const baseDoc = { schema: 'starci/application-stacks@1', components: { api: { role: 'service' } },
  environments: { dev: { status: 'supported', runtime: 'docker-compose', composeFiles: ['infra/compose/compose.yaml'], components: {}, runbook: 'README.md', secrets: [] } },
  k8s: { status: 'deferred', reason: 'not selected' } };
const sonarEntry = (repo, extra = {}) => ({ provider: 'sonarqube', mode: 'local', host: { local: 'http://localhost:9010', public: 'https://sonar.example.org' },
  stack: { repository: 'src-host', root: '.stacks', environment: 'dev', compose: 'infra/compose/sonarqube.yaml' }, auth: 'token',
  projects: [{ repository: repo, key: repo }],
  credentials: [{ id: 'analysis', env: 'SONAR_TOKEN', custody: { repository: 'src-host', path: '.stacks/dev/runtime/files/sonarqube-analysis-token.txt' } }],
  ci: { wiring: 'required', secrets: [{ name: 'SONAR_TOKEN', credential: 'analysis' }], vars: [{ name: 'SONAR_HOST_URL', value: 'https://sonar.example.org' }] },
  ownerAction: 'none', ...extra });
const codecovEntry = (repo, extra = {}) => ({ provider: 'codecov', mode: 'hosted', host: { public: 'https://app.codecov.io' }, auth: 'oidc',
  projects: [{ repository: repo, key: `gh/org/${repo}` }], credentials: [], ci: { wiring: 'required', permissions: ['id-token: write'], secrets: [], vars: [] }, ownerAction: 'none', ...extra });
const CI = 'jobs:\n  ci:\n    steps:\n      - uses: codecov/codecov-action@v5\n        with: {use_oidc: true}\n      - uses: SonarSource/sonarqube-scan-action@v7\n        env:\n          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}\n          SONAR_HOST_URL: ${{ vars.SONAR_HOST_URL }}\n';

function workspace(t, { services, sourceServices, ci = CI, props = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starcistacks-'));
  t.after(() => { fs.rmSync(dir, { recursive: true, force: true }); delete process.env.STARCI_SOURCE_ROOT; });
  const host = path.join(dir, 'src-host'), product = path.join(dir, 'product');
  write(path.join(host, '.stacks', 'dev', 'infra', 'compose', 'sonarqube.yaml'), 'services: {sonarqube: {image: sonarqube}}\n');
  write(path.join(host, '.stacks', 'dev', 'runtime', 'files', 'sonarqube-analysis-token.txt.enc'), 'sops: {}\n');
  write(path.join(host, '.stacks', DECL), yamlOf({ ...baseDoc, ...(sourceServices === undefined ? { services: { sonar: sonarEntry('product') } } : sourceServices ? { services: sourceServices } : {}) }));
  write(path.join(product, '.starcistacks', DECL), yamlOf({ ...baseDoc, ...(services ? { services } : {}) }));
  write(path.join(product, '.gitignore'), '.starcistacks/**\n!.starcistacks/**/\n!.starcistacks/**/*.enc\n');
  if (ci) write(path.join(product, '.github', 'workflows', 'ci.yml'), ci);
  if (props) write(path.join(product, 'sonar-project.properties'), props);
  process.env.STARCI_SOURCE_ROOT = host;
  return { dir, host, product };
}
const DECL = 'application-stacks.yaml';
const codes = (result, level) => result.findings.filter((finding) => !level || finding.level === level).map((finding) => finding.code);

test('every ready-to-apply fixture carries a services block the schema accepts', () => {
  const files = fs.readdirSync(fixtures).filter((file) => file.endsWith('.yaml'));
  assert.ok(files.length >= 4);
  for (const file of files) {
    const doc = parseYaml(fs.readFileSync(path.join(fixtures, file), 'utf8'));
    assert.deepEqual(schemaErrors(doc.services, schema.properties.services, 'services'), [], file);
    for (const service of Object.values(doc.services)) assert.equal(service.ownerAction, 'none', file);
  }
});

test('an existing repository without a services block gets suspects and a planned follow-up, never a refusal', (t) => {
  const { product } = workspace(t);
  const result = checkStarciStacks(product);
  assert.equal(result.ok, true);
  assert.ok(codes(result, 'suspect').includes('STACKS_SERVICES_MISSING'));
  assert.ok(codes(result, 'suspect').includes('STACKS_SERVICE_UNDECLARED'), 'codecov is called by CI and declared nowhere');
  assert.ok(!codes(result).some((code) => code === 'STACKS_SERVICE_UNDECLARED' && result.findings.find((f) => f.code === code).message.includes('call sonar')), 'sonar is covered by the source host');
  assert.equal(result.followUp.op, 'workspace.manage');
});

test('a new repository (--new) is refused until it declares its services', (t) => {
  const { product } = workspace(t);
  const result = checkStarciStacks(product, { newRepo: true });
  assert.equal(result.ok, false);
  assert.ok(codes(result, 'refuse').includes('STACKS_SERVICES_MISSING'));
});

test('a complete declaration passes with nothing to report about its services', (t) => {
  const { product } = workspace(t, { services: { sonar: sonarEntry('product'), codecov: codecovEntry('product') }, props: 'sonar.projectKey=product\nsonar.host.url=https://sonar.example.org\n' });
  const result = checkStarciStacks(product, { newRepo: true });
  assert.deepEqual(result.refused, []);
  assert.deepEqual(result.suspect, []);
  assert.equal(result.services.sonar.credentials[0].present, true);
});

test('unknown, ambiguous and contradictory service declarations are refused', (t) => {
  const { product } = workspace(t, { services: {
    sonar: sonarEntry('product', { stack: undefined, host: { public: 'https://sonar.example.org' } }),
    codecov: codecovEntry('product', { mode: 'disabled', reason: 'not used' }),
    'status-page': { provider: 'x', mode: 'hosted', ci: { wiring: 'not-used' }, ownerAction: 'none' },
  } });
  const refused = codes(checkStarciStacks(product), 'refuse');
  assert.ok(refused.includes('STACKS_SERVICE_UNKNOWN'));
  assert.ok(refused.includes('STACKS_SERVICE_AMBIGUOUS'), 'a local sonar without stack or host.local');
  assert.ok(refused.includes('STACKS_CI_CONTRADICTION'), 'codecov disabled while CI calls it');
});

test('custody that is missing, or an owner action for what custody holds, is refused', (t) => {
  const { product, host } = workspace(t, { services: {
    sonar: sonarEntry('product', { ownerAction: { needed: 'a Sonar token', reason: 'asked before' } }),
    codecov: codecovEntry('product', { auth: 'token', credentials: [{ id: 'upload', env: 'CODECOV_TOKEN', custody: { repository: 'src-host', path: '.stacks/dev/runtime/files/codecov-token.key' } }] }),
  } });
  assert.ok(fs.existsSync(path.join(host, '.stacks')));
  const refused = codes(checkStarciStacks(product), 'refuse');
  assert.ok(refused.includes('STACKS_OWNER_ACTION_REDUNDANT'));
  assert.ok(refused.includes('STACKS_CUSTODY_MISSING'));
});

test('a leg admitted before the change reads the new codes as suspects', (t) => {
  const { product } = workspace(t, { services: { sonar: sonarEntry('product', { provider: 'sonarqube-x' }), codecov: codecovEntry('product') } });
  const strict = checkStarciStacks(product);
  assert.ok(codes(strict, 'refuse').includes('STACKS_PROVIDER_UNKNOWN'));
  const older = checkStarciStacks(product, { advisoryCodes: CODES });
  assert.equal(older.ok, true);
  assert.ok(older.findings.some((finding) => finding.code === 'STACKS_PROVIDER_UNKNOWN' && finding.advisory));
});

test('sonar-project.properties must name the declared project key', (t) => {
  const { product } = workspace(t, { services: { sonar: sonarEntry('product'), codecov: codecovEntry('product') }, props: 'sonar.projectKey=other\n' });
  assert.ok(codes(checkStarciStacks(product), 'refuse').includes('STACKS_PROJECT_DRIFT'));
});

test('a product with no services block still resolves Sonar through the source host declaration', (t) => {
  const { product } = workspace(t);
  const sonar = resolveStackService(product, 'sonar');
  assert.equal(sonar.sourceHost, true);
  assert.equal(sonar.projectKey, 'product');
  assert.equal(sonar.host.local, 'http://localhost:9010');
  assert.equal(sonar.credentials[0].custody.encPresent, true);
  assert.equal(resolveStackService(product, 'codecov'), null);
});

test('the owner is never asked for a declared credential or CI setting', (t) => {
  const { product } = workspace(t);
  assert.equal(ownerAskConflict({ repo: product, question: { text: 'Please provide SONAR_TOKEN and set SONAR_HOST_URL in GitHub settings' } })?.service, 'sonar');
  assert.equal(ownerAskConflict({ repo: product, question: { text: 'Which SonarQube token should CI use?' } })?.service, 'sonar');
  assert.equal(ownerAskConflict({ repo: product, question: { text: 'Should the Sonar quality gate block merges, or only warn?' } }), null);
  assert.equal(ownerAskConflict({ repo: product, question: { text: 'Provide the Stripe secret key' } }), null);
});

test('an ask is not refused when the declaration asks the owner or custody is missing', (t) => {
  const { product } = workspace(t, { sourceServices: { sonar: sonarEntry('product', { credentials: [{ id: 'analysis', env: 'SONAR_TOKEN', custody: { repository: 'src-host', path: '.stacks/dev/runtime/files/absent.key' } }], ci: { wiring: 'not-used' } }) } });
  assert.equal(ownerAskConflict({ repo: product, question: { text: 'Please provide SONAR_TOKEN' } }), null);
});

test('the CLI exits 0 on suspects, 1 on refusals, 2 on usage', async (t) => {
  const { product } = workspace(t);
  assert.equal((await checkStarciStacksMain([product])).exitCode, 0);
  assert.equal((await checkStarciStacksMain([product, '--new'])).exitCode, 1);
  assert.equal((await checkStarciStacksMain([])).exitCode, 2);
  assert.equal((await checkStarciStacksMain([product, '--admitted-at', 'nope'])).exitCode, 2);
  const json = JSON.parse((await checkStarciStacksMain([product, '--json'])).text);
  assert.equal(json.schema, 'starci/starcistacks-check@1');
});

test('the contract change registers every code the check emits', () => {
  const change = loadContractChanges(root).changes.find((item) => item.id === 'starcistacks-services');
  assert.ok(change, 'modules/kernel/contract-changes.yaml registers starcistacks-services');
  assert.deepEqual([...change.adds.codes].sort(), [...CODES].sort());
  assert.ok(change.adds.checks.includes('starci-starcistacks-check'));
});

test('api report refuses an ask for a declared credential and files any other ask', async (t) => {
  const { spawnSync } = await import('node:child_process');
  const { ledgerFileFor, openLedger, inspectLedger } = await import('../engine/ledger-db.mjs');
  const { product, host } = workspace(t);
  const env = { ...process.env, STARCI_SOURCE_ROOT: host };
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB']) delete env[key];
  const api = (...args) => spawnSync(process.execPath, [path.join(root, 'scripts', 'kernel', 'api.mjs'), ...args], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120000, env });
  const seed = (fn) => { const l = openLedger({ file: ledgerFileFor(product) }); try { return fn(l); } finally { l.close(); } };
  const wf = 'wf-starcistacks-ask', op = 'docs.author';
  seed((l) => {
    l.ensureWorkflow({ workflowId: wf, title: 'stack ask guard' });
    l.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(wf);
    l.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)').run(wf, 0, 'stack-ask', '# goal', '{}', Date.now());
  });
  const enqueued = api('enqueue', '--repo', product, '--workflow', wf, '--op', op, '--paths', 'docs/ask', '--json');
  assert.equal(enqueued.status, 0, enqueued.stderr);
  const job = JSON.parse(enqueued.stdout).job_id;
  seed((l) => {
    const row = l.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(job);
    l.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)').run(wf, op, row.attempt, 'ctx_stackask', '# contract', '{}', Date.now());
    l.db.prepare("UPDATE jobs SET status='running',worker_id='term_ask' WHERE job_id=?").run(job);
  });
  const file = path.join(product, 'report.json');
  const report = (question) => { fs.writeFileSync(file, JSON.stringify({ outcome: 'ask', summary: 'owner input needed', question })); return file; };
  const refused = api('report', '--repo', product, '--job', job, '--report', report({ text: 'Provide SONAR_TOKEN and the SONAR_HOST_URL GitHub variable', options: [] }), '--json');
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stderr, /ask-declared-in-stack/);
  const count = () => { const l = inspectLedger({ file: ledgerFileFor(product) }); try { return l.db.prepare("SELECT count(*) n FROM reports WHERE dispatch_id='ctx_stackask'").get().n; } finally { l.close(); } };
  assert.equal(count(), 0, 'nothing is filed');
  const filed = api('report', '--repo', product, '--job', job, '--report', report({ text: 'Which launch market comes first?', options: ['Vietnam', 'Singapore'] }), '--json');
  assert.equal(filed.status, 0, filed.stderr);
  assert.equal(count(), 1);
});
