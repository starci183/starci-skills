import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ALL_CHECK_CODES, checkRepo } from '../../scripts/hfs/check.mjs';
import { deployWorkflowFindings } from '../../scripts/hfs/rules/deploy-workflow.mjs';

// proves: HFS_DEPLOY_WORKFLOW@lite
// proves: HFS_DEPLOY_WORKFLOW@full
// proves: HFS_WORKFLOW_PIN@lite
// proves: HFS_WORKFLOW_PIN@full
// proves: HFS_CI_TOOL_INSTALL@lite
// proves: HFS_CI_TOOL_INSTALL@full
// proves: HFS_APP_WORKFLOW_TRIGGER@lite
// proves: HFS_APP_WORKFLOW_TRIGGER@full
const SHA = 'a'.repeat(40);
const HASH = 'b'.repeat(64);
const DEPLOY_FILE = '.github/workflows/api-deploy.yml';
const CODES = new Set(['HFS_DEPLOY_WORKFLOW', 'HFS_WORKFLOW_PIN', 'HFS_CI_TOOL_INSTALL', 'HFS_APP_WORKFLOW_TRIGGER']);
const compare = (left, right) => left.localeCompare(right);
const reference = (name) => '${{ secrets.' + name + ' }}';
const on = { push: { tags: ['v*'] }, workflow_dispatch: {} };
const workflow = () => ({
  on,
  permissions: { contents: 'read' },
  concurrency: { group: 'deploy-production', 'cancel-in-progress': false },
  jobs: {
    deploy: {
      'runs-on': 'ubuntu-latest', environment: 'production',
      steps: [{ uses: `actions/checkout@${SHA}` }, { env: { SOPS_AGE_KEY: reference('SOPS_AGE_KEY') }, run: 'starci app secret materialize production\ndocker stack deploy -c .starcistacks/production/infra/swarm/stack.yaml demo' }],
    },
  },
});
const tree = (t, files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-deploy-workflow-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content));
  }
  return root;
};
const run = (t, edition, doc, file = DEPLOY_FILE) => deployWorkflowFindings({ repoRoot: tree(t, { [file]: doc }), files: [file], repo: { kind: 'app', edition } });
const hasCode = (findings, code) => findings.some((finding) => finding.code === code);

for (const edition of ['lite', 'full']) {
  test(`HFS_DEPLOY_WORKFLOW ${edition}: refuses every missing custody/control field and dotenv/extra secret escape`, (t) => {
    const cases = [
      ['environment', (doc) => { delete doc.jobs.deploy.environment; }],
      ['empty environment name', (doc) => { doc.jobs.deploy.environment = { name: '' }; }],
      ['permissions', (doc) => { delete doc.permissions; }],
      ['concurrency', (doc) => { delete doc.concurrency; }],
      ['empty concurrency', (doc) => { doc.concurrency = {}; }],
      ['materialization', (doc) => { doc.jobs.deploy.steps[1] = { run: 'docker stack deploy -c stack.yaml demo' }; }],
      ['materialize comment', (doc) => { doc.jobs.deploy.steps[1] = { run: '# starci app secret materialize production\ndocker stack deploy -c stack.yaml demo' }; }],
      ['echoed materialize', (doc) => { doc.jobs.deploy.steps[1] = { run: 'echo "starci app secret materialize production"\ndocker stack deploy -c stack.yaml demo' }; }],
      ['age key comment', (doc) => { doc.jobs.deploy.steps[1] = { run: '# SOPS_AGE_KEY=' + reference('SOPS_AGE_KEY') + '\ndocker stack deploy -c stack.yaml demo' }; }],
      ['disabled materialization', (doc) => { doc.jobs.deploy.steps[1].if = '${{ false }}'; doc.jobs.deploy.steps.push({ run: 'docker stack deploy -c stack.yaml demo' }); }],
      ['API_ENV blob', (doc) => { doc.jobs.deploy.steps[1].env.API_ENV = reference('API_ENV'); }],
      ['bracket WEB_ENV blob', (doc) => { doc.jobs.deploy.steps[1].env.WEB_ENV = "${{ secrets['WEB_ENV'] }}"; }],
      ['dynamic secret', (doc) => { doc.jobs.deploy.steps[1].env.VALUE = '${{ secrets[inputs.secret_name] }}'; }],
      ['bulk secret', (doc) => { doc.jobs.deploy.steps[1].env.VALUE = '${{ toJSON(secrets) }}'; }],
      ['inherited secrets', (doc) => { doc.jobs.deploy.secrets = 'inherit'; }],
      ['dotenv redirect', (doc) => { doc.jobs.deploy.steps[1].run += '\nprintf "%s" "$API_ENV" > .env'; }],
      ['nested dotenv append', (doc) => { doc.jobs.deploy.steps[1].run += '\nprintf "%s" "$API_ENV" >> "deploy/api.env"'; }],
      ['tee dotenv', (doc) => { doc.jobs.deploy.steps[1].run += '\nprintenv | tee -a ./deploy/.env.production'; }],
      ['env_file', (doc) => { doc.jobs.deploy.steps[1].with = { env_file: 'API_ENV' }; }],
      ['second unprotected deploy job', (doc) => { doc.jobs['worker-deploy'] = { 'runs-on': 'ubuntu-latest', steps: [{ run: 'docker stack deploy -c stack.yaml worker' }] }; }],
      ['age key belongs to another job', (doc) => { doc.jobs.prepare = doc.jobs.deploy; doc.jobs.deploy = { 'runs-on': 'ubuntu-latest', environment: 'production', steps: [{ run: 'docker stack deploy -c stack.yaml demo' }] }; }],
    ];
    for (const [name, mutate] of cases) {
      const doc = workflow();
      mutate(doc);
      const findings = run(t, edition, doc);
      assert.equal(hasCode(findings, 'HFS_DEPLOY_WORKFLOW'), true, name);
      assert.ok(findings.every((finding) => finding.path === DEPLOY_FILE && finding.level === 'error'), name);
    }
    assert.equal(hasCode(run(t, edition, { on, jobs: {} }), 'HFS_DEPLOY_WORKFLOW'), true);
    assert.equal(hasCode(run(t, edition, 'on: [\n'), 'HFS_DEPLOY_WORKFLOW'), true);
    const custom = workflow();
    delete custom.jobs.deploy.environment;
    assert.equal(hasCode(run(t, edition, custom, '.github/workflows/release.yml'), 'HFS_DEPLOY_WORKFLOW'), true, 'content identifies a deploy job without a deploy filename');
    const remote = { on, jobs: { ship: { steps: [{ uses: `appleboy/ssh-action@${SHA}`, with: { script: 'docker stack deploy -c stack.yaml demo' } }] } } };
    assert.equal(hasCode(run(t, edition, remote, '.github/workflows/release.yml'), 'HFS_DEPLOY_WORKFLOW'), true, 'action scripts identify deployment jobs');
    assert.equal(hasCode(run(t, edition, { name: 'Deploy production', on, jobs: { ship: { steps: [{ run: 'echo done' }] } } }, '.github/workflows/release.yml'), 'HFS_DEPLOY_WORKFLOW'), true, 'workflow name identifies deployment');
  });

  test(`HFS_DEPLOY_WORKFLOW ${edition}: protected materialization and transport-only secrets pass`, (t) => {
    const doc = workflow();
    doc.jobs.deploy.environment = { name: 'production', url: 'https://demo.example' };
    doc.jobs.deploy.steps[1].env.VPS_SSH_KEY = reference('VPS_SSH_KEY');
    doc.jobs.deploy.steps[1].env.SSH_KNOWN_HOSTS = reference('SSH_KNOWN_HOSTS');
    doc.jobs.prepare = { 'runs-on': 'ubuntu-latest', steps: [{ run: 'starci app lint' }] };
    assert.deepEqual(run(t, edition, doc), []);
    const ageOnly = workflow();
    ageOnly.jobs.deploy.steps[1].run = 'docker stack deploy -c stack.yaml demo';
    assert.deepEqual(run(t, edition, ageOnly), []);
    const materializeOnly = workflow();
    delete materializeOnly.jobs.deploy.steps[1].env;
    materializeOnly.jobs.deploy.permissions = {};
    materializeOnly.jobs.deploy.concurrency = 'production';
    delete materializeOnly.permissions;
    delete materializeOnly.concurrency;
    assert.deepEqual(run(t, edition, materializeOnly), []);
    assert.deepEqual(run(t, edition, { on, jobs: { lint: { 'runs-on': 'ubuntu-latest', steps: [{ run: '# deploy is prose\nstarci app lint' }] } } }, '.github/workflows/ci.yml'), []);
    assert.deepEqual(run(t, edition, { on, jobs: { lint: { steps: [{ run: 'cat deploy/README.md\nprintf "deploy documentation"' }] } } }, '.github/workflows/ci.yml'), []);
    assert.deepEqual(run(t, edition, { on, jobs: { 'authorize-deploy-key': { steps: [{ uses: `vendor/ssh-agent@${SHA}` }] } } }, '.github/workflows/authorize-deploy-key.yml'), []);
  });

  test(`HFS_DEPLOY_WORKFLOW ${edition}: dotenv output targets preserve path and filename boundaries`, (t) => {
    for (const target of ['.env', '.env.production', 'api.env', '"deploy/api.env"', "'./deploy/.env.production'", `${'nested/'.repeat(1000)}api.env`]) {
      const doc = workflow();
      doc.jobs.deploy.steps[1].run += `\nprintf content > ${target}`;
      assert.equal(hasCode(run(t, edition, doc), 'HFS_DEPLOY_WORKFLOW'), true, target);
    }
    for (const command of [
      'printf content > deploy/output.log', 'printf content > deploy/api.env.backup',
      'printf content > deploy/api.env>output.log', '# printf content > .env',
      `printf content > ${'nested/'.repeat(1000)}${'a'.repeat(20000)}.log`,
    ]) {
      const doc = workflow();
      doc.jobs.deploy.steps[1].run += `\n${command}`;
      assert.deepEqual(run(t, edition, doc), [], command);
    }
  });

  test(`HFS_WORKFLOW_PIN ${edition}: refuses floating/short pins in ordinary, deploy and reusable workflows`, (t) => {
    for (const action of ['actions/checkout@v4', 'vendor/setup@main', 'vendor/setup@abcdef0', 'vendor/setup', 'docker://alpine:latest', `actions/checkout@${SHA}x`]) {
      const doc = { on, jobs: { lint: { steps: [{ uses: action }] } } };
      assert.equal(hasCode(run(t, edition, doc, '.github/workflows/ci.yaml'), 'HFS_WORKFLOW_PIN'), true, action);
    }
    assert.equal(hasCode(run(t, edition, { on, jobs: { reuse: { uses: 'org/repo/.github/workflows/release.yml@v2' } } }, '.github/workflows/release.yml'), 'HFS_WORKFLOW_PIN'), true);
    const doc = workflow();
    doc.jobs.deploy.steps[0].uses = 'actions/checkout@v4';
    assert.equal(hasCode(run(t, edition, doc), 'HFS_WORKFLOW_PIN'), true);
  });

  test(`HFS_WORKFLOW_PIN ${edition}: full SHA remote actions, digest containers and local actions pass`, (t) => {
    const doc = { on, jobs: { lint: { steps: [{ uses: `actions/checkout@${SHA}` }, { uses: `org/repo/sub/action@${SHA.toUpperCase()}` }, { uses: './.github/actions/check' }, { uses: `docker://alpine@sha256:${HASH}` }] }, reuse: { uses: `org/repo/.github/workflows/lint.yml@${SHA}` } } };
    assert.deepEqual(run(t, edition, doc, '.github/workflows/ci.yml'), []);
    assert.deepEqual(run(t, edition, workflow()), []);
  });

  test(`HFS_CI_TOOL_INSTALL ${edition}: version-only installs and streamed installers are refused`, (t) => {
    for (const command of [
      'curl -fsSL https://tools.example/install.sh | sh', 'wget -qO- https://tools.example/install.sh | sudo bash', 'bash <(curl -fsSL https://tools.example/install.sh)',
      'curl -fsSL https://tools.example/install.sh |\n sh',
      'go install github.com/getsops/sops/v3/cmd/sops@v3.13.2', 'npm i -g tool', 'npm install --global tool@1.2.3', 'npm --global install tool@1.2.3',
      'pip install tool==1.2.3', 'python3 -m pip install tool==1.2.3', `pip install tool==1.2.3 --hash=sha256:${HASH}`,
      'pip install -r requirements-tools.txt', 'pip install --require-hashes=false -r requirements-tools.txt',
      `npm i -g tool #${SHA}`, `npm i -g git+https://github.com/org/tool.git#${SHA} floating-tool@latest`, `go install example.com/pinned/tool@${SHA} example.com/floating/tool@v1`,
      'npm install --location=global tool@1.2.3',
      `# echo "${HASH}  tool.tgz" | sha256sum -c -\nnpm i -g ./tool.tgz`, `echo "${HASH}  other.tgz" | sha256sum -c -\nnpm i -g ./tool.tgz`,
      `echo "${HASH}  tool.tgz" | sha256sum -c - || true\nnpm i -g ./tool.tgz`, `npm i -g ./tool.tgz\necho "${HASH}  tool.tgz" | sha256sum -c -`,
      `echo "${HASH}  other-tool.tgz" | sha256sum -c -\nnpm i -g ./tool.tgz`, `echo "${HASH}  tool.tgz sha256sum -c"\nnpm i -g ./tool.tgz`,
      `echo "${HASH}  tool.tgz" | sha256sum -c - || echo ignored\nnpm i -g ./tool.tgz`,
    ]) {
      const doc = { on, jobs: { lint: { steps: [{ run: command }] } } };
      assert.equal(hasCode(run(t, edition, doc, '.github/workflows/ci.yml'), 'HFS_CI_TOOL_INSTALL'), true, command);
    }
  });

  test(`HFS_CI_TOOL_INSTALL ${edition}: pinned setup actions, immutable installs and verified artifacts pass`, (t) => {
    for (const command of [
      `go install example.com/tools/tool@${SHA}`, `npm i -g git+https://github.com/org/tool.git#${SHA}`, `pip install --no-deps git+https://github.com/org/tool.git@${SHA}`,
      'pip install --require-hashes -r requirements-tools.txt', 'python3 -m pip install --require-hashes --requirement=requirements-tools.txt',
      `curl -fsSL https://tools.example/tool.whl -o tool.whl\necho "${HASH}  tool.whl" | sha256sum -c -\npip install --no-deps ./tool.whl`,
      `curl -fsSL https://tools.example/tool.tgz -o tool.tgz\necho "${HASH}  tool.tgz" | sha256sum -c -\nnpm i -g ./tool.tgz`,
      '# npm i -g tool\n# curl https://tools.example/install.sh | sh\nnpm ci\nnpm audit --audit-level=high',
      'echo "npm i -g tool"\necho "curl https://tools.example/install.sh | sh"',
    ]) {
      const doc = { on, jobs: { lint: { steps: [{ uses: `vendor/setup-tools@${SHA}` }, { run: command }] } } };
      assert.deepEqual(run(t, edition, doc, '.github/workflows/ci.yml'), [], command);
    }
  });

  test(`HFS_APP_WORKFLOW_TRIGGER ${edition}: refuses main/branch/pull-request/schedule and unfiltered triggers`, (t) => {
    for (const trigger of [
      undefined, {}, 'push', ['workflow_dispatch', 'pull_request'], { push: { branches: ['main'] } }, { push: { tags: ['v*'], branches: ['main'] } },
      { push: {} }, { push: { tags: ['*'] } }, { push: { tags: ['v*', 'preview-*'] } }, { push: { tags: ['v*'], paths: ['be/**'] } },
      { pull_request: {} }, { schedule: [{ cron: '0 0 * * *' }] }, { workflow_call: {} }, { repository_dispatch: {} }, { push: { 'tags-ignore': ['v*'] } },
    ]) {
      const doc = { on: trigger, jobs: { lint: { steps: [{ run: 'starci app lint' }] } } };
      assert.equal(hasCode(run(t, edition, doc, '.github/workflows/ci.yml'), 'HFS_APP_WORKFLOW_TRIGGER'), true, JSON.stringify(trigger));
    }
    const doc = workflow();
    doc.on = { push: { branches: ['main'] } };
    assert.equal(hasCode(run(t, edition, doc), 'HFS_APP_WORKFLOW_TRIGGER'), true, 'deploy files obey the same app law');
    assert.equal(hasCode(run(t, edition, 'on: [\n', '.github/workflows/ci.yml'), 'HFS_APP_WORKFLOW_TRIGGER'), true);
  });

  test(`HFS_APP_WORKFLOW_TRIGGER ${edition}: release tags and/or manual dispatch pass`, (t) => {
    for (const trigger of [on, { push: { tags: ['v*'] } }, { workflow_dispatch: { inputs: { ref: { required: true } } } }, 'workflow_dispatch', ['workflow_dispatch']]) {
      assert.deepEqual(run(t, edition, { on: trigger, jobs: { lint: { steps: [{ run: 'starci app lint' }] } } }, '.github/workflows/ci.yml'), []);
    }
    const yaml = `name: Release\non:\n  push:\n    tags: ['v*']\n  workflow_dispatch:\npermissions: {}\nconcurrency: production\njobs:\n  deploy:\n    environment: production\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@${SHA}\n      - run: starci app secret materialize production\n`;
    assert.deepEqual(run(t, edition, yaml), []);
  });

  test(`R251 ${edition}: app check reports each workflow code once and preserves the tracked path`, (t) => {
    const doc = workflow();
    doc.on = { push: { branches: ['main'] } };
    delete doc.jobs.deploy.environment;
    doc.jobs.deploy.steps[0].uses = 'actions/checkout@v4';
    doc.jobs.deploy.steps[1].run += '\nnpm i -g tool';
    const root = tree(t, { [DEPLOY_FILE]: doc });
    const declaration = { hfs: 3, kind: 'app', project: 'demo', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }, { name: 'cli', kind: 'cli' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
    const findings = checkRepo({ repoRoot: root, declaration, files: [DEPLOY_FILE], tree: false }).findings.filter((finding) => CODES.has(finding.code));
    assert.deepEqual(findings.map((finding) => finding.code).sort(compare), [...CODES].sort(compare));
    assert.ok(findings.every((finding) => finding.path === DEPLOY_FILE && finding.level === 'error'));
    assert.ok(findings.every((finding) => ALL_CHECK_CODES.includes(finding.code)), 'workflow findings retain bundled catalog explanations');
  });
}

test('R251 scopes to app editions, tracked workflows and the requested paths, with all-tree root ownership', (t) => {
  const bad = { on: 'push', jobs: { lint: { steps: [{ uses: 'actions/checkout@v4' }] } } };
  const files = ['.github/workflows/ci.yml', 'be/.github/workflows/ci.yml', 'tests/fixtures/.github/workflows/ci.yml', '.github/actions/local/action.yml', 'docs/workflow.yml'];
  const context = { repoRoot: tree(t, Object.fromEntries(files.map((file) => [file, bad]))), files, repo: { kind: 'app', edition: 'lite' } };
  for (const repo of [{ kind: 'be', edition: 'lite' }, { kind: 'app', edition: 'unknown' }, { kind: 'fe', edition: 'full' }]) assert.deepEqual(deployWorkflowFindings({ ...context, repo }), []);
  assert.deepEqual(deployWorkflowFindings({ ...context, isRoot: false }), []);
  assert.deepEqual(deployWorkflowFindings({ ...context, inScope: () => false }), []);
  const findings = deployWorkflowFindings({ ...context, files: [], all: files, isRoot: true, inScope: (file) => file.startsWith('be/') });
  assert.deepEqual(findings.map((finding) => finding.path), ['be/.github/workflows/ci.yml', 'be/.github/workflows/ci.yml']);
  assert.deepEqual(deployWorkflowFindings(context).map((finding) => finding.path).sort(compare), [files[0], files[0], files[1], files[1]].sort(compare));
});
