// proves: STACK_TOOLING_REIMPLEMENTED@lite
// proves: STACK_TOOLING_REIMPLEMENTED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../runtime/scripts/hfs/check.mjs';
import { stackToolingFindings } from '../runtime/scripts/hfs/rules/stack-tooling.mjs';
import { a15Findings } from '../runtime/scripts/hfs/rules/a15-findings.mjs';

const CODE = 'STACK_TOOLING_REIMPLEMENTED';
const RECORDS = {
  passing: (await import('./fixtures/hfs-stack-tooling/passing.mjs')).default,
  violating: (await import('./fixtures/hfs-stack-tooling/violating.mjs')).default,
};
const base = path.resolve(os.tmpdir());
const roots = [];

test.after(() => {
  for (const root of roots) {
    assert.ok(root.startsWith(base + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const asText = (content) => (typeof content === 'string' ? content : JSON.stringify(content));

/** Writes a file map into a temp directory and returns the finder context of an app of `edition`. */
function tree(edition, files, extra = {}) {
  const repoRoot = fs.mkdtempSync(path.join(base, 'stack-tooling-'));
  roots.push(repoRoot);
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(repoRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, asText(content));
  }
  return { repoRoot, files: Object.keys(files), repo: { kind: 'app', edition }, isRoot: true, ...extra };
}

const fixture = (name) => structuredClone(RECORDS[name]);
const byText = (a, b) => a.localeCompare(b);
const byPath = (a, b) => a.path.localeCompare(b.path);
const summary = (findings) => findings.map((finding) => ({ path: finding.path, verb: finding.verb })).sort(byPath);
const sorted = (entries) => [...entries].sort(byPath);
const workflow = (command) => `name: ship\non: workflow_dispatch\njobs:\n  ship:\n    runs-on: ubuntu-latest\n    steps:\n      - run: ${command}\n`;
const one = (edition, file, content) => stackToolingFindings(tree(edition, { [file]: content }));
const sourcesOf = (command) => [
  ['deploy/swarm/ops.sh', `#!/usr/bin/env bash\n${command}\n`],
  ['.github/workflows/ci.yml', workflow(command)],
  ['package.json', { scripts: { ship: command } }],
  ['scripts/ship.sh', `echo ok\n  ${command}\n`],
];

const OWNED = [
  ['docker stack deploy -c stack.yaml shop', 'deploy'],
  ['docker stack config -c stack.yaml', 'render'],
  ['docker secret create shop_token -', 'deploy'],
  ['docker config create shop_routes routes.yml', 'deploy'],
  ['docker secret rm shop_token', 'prune'],
  ['docker config rm shop_routes', 'prune'],
  ['docker service ls', 'converge'],
  ['docker service ps shop_api', 'converge'],
  ['docker service inspect shop_api', 'verify'],
  ['docker service update --image x shop_api', 'rollback'],
  ['docker swarm init', 'prepare'],
  ['docker volume create shop-data', 'prepare'],
  ['docker node ls', 'doctor'],
  ['docker --context vps stack deploy -c stack.yaml shop', 'deploy'],
  ['docker -H ssh://vps service ls', 'converge'],
];

const NOT_OWNED = [
  'docker stack rm shop', 'docker stack ls', 'docker stack ps shop', 'docker stack services shop',
  'docker compose up -d', 'docker run --rm alpine true', 'docker exec shop_api true', 'docker ps', 'docker logs shop_api',
  'docker service logs shop_api', 'docker volume ls', 'docker secret ls', 'docker network create shop',
  'starci app stack deploy --env production', 'npx starci app stack render --note "docker stack deploy"',
  'node starci.mjs app stack prepare && starci app stack doctor',
];

const VERB_FILES = ['render', 'provision', 'converge', 'verify', 'prune', 'rollback', 'release', 'backup', 'prepare', 'doctor', 'jobs', 'public'];

for (const edition of ['lite', 'full']) {
  test(`${CODE}: ${edition} rejects the violating fixture app and names the replacing verb`, () => {
    const record = fixture('violating');
    const findings = stackToolingFindings(tree(edition, record.files));
    assert.equal(findings.length, record.expect.length);
    assert.equal(findings[0].code, CODE);
    assert.ok(findings.every((finding) => finding.level === 'error'));
    assert.deepEqual(summary(findings), sorted(record.expect));
    for (const finding of findings) {
      assert.equal(finding.message, `${finding.path} re-implements deploy tooling the canon ships; call \`starci app stack ${finding.verb}\` instead`);
    }
  });

  test(`${CODE}: ${edition} accepts the passing fixture app that only calls starci verbs`, () => {
    assert.deepEqual(stackToolingFindings(tree(edition, fixture('passing').files)), []);
  });

  test(`${CODE}: ${edition} rejects every docker command a verb owns in a script, a workflow and a package script`, () => {
    for (const [command, verb] of OWNED) {
      for (const [file, content] of sourcesOf(command)) {
        const findings = one(edition, file, content);
        assert.equal(findings.length, 1, `${command} in ${file}`);
        assert.equal(findings[0].code, CODE);
        assert.equal(findings[0].verb, verb);
        assert.equal(findings[0].path, file);
      }
    }
  });

  test(`${CODE}: ${edition} rejects the argument-array form and continued shell lines`, () => {
    const spawned = one(edition, 'scripts/ship.mjs', "run('docker', ['service', 'inspect', name]);\n");
    assert.equal(spawned[0].code, CODE);
    assert.equal(spawned[0].verb, 'verify');
    const joined = one(edition, 'deploy/ops.sh', 'docker swarm \\\n  init\n');
    assert.equal(joined[0].verb, 'prepare');
  });

  test(`${CODE}: ${edition} reports one finding per replacing verb of a file`, () => {
    const findings = one(edition, 'deploy/ops.sh', 'docker swarm init\ndocker volume create a\ndocker node ls\ndocker node ls\n');
    assert.deepEqual(findings.map((finding) => finding.verb).sort(byText), ['doctor', 'prepare']);
    assert.ok(findings.every((finding) => finding.code === CODE));
  });

  test(`${CODE}: ${edition} rejects a deploy file named after a verb`, () => {
    for (const verb of VERB_FILES) {
      for (const extension of ['mjs', 'js', 'cjs', 'sh']) {
        const findings = one(edition, `deploy/swarm/${verb}.${extension}`, 'echo ok\n');
        assert.equal(findings.length, 1, `${verb}.${extension}`);
        assert.equal(findings[0].code, CODE);
        assert.equal(findings[0].verb, verb);
      }
    }
    assert.equal(one(edition, 'deploy/render.mjs', 'echo ok\n')[0].path, 'deploy/render.mjs');
  });

  test(`${CODE}: ${edition} accepts docker commands no verb owns and starci command lines`, () => {
    for (const command of NOT_OWNED) {
      for (const [file, content] of sourcesOf(command)) assert.deepEqual(one(edition, file, content), [], `${command} in ${file}`);
    }
  });

  test(`${CODE}: ${edition} accepts comments, documents, specs, credentials and the managed workflow`, () => {
    const command = 'docker stack deploy -c stack.yaml shop\n';
    const files = {
      'src/app.mjs': command, 'deploy/README.md': command, 'deploy/notes.txt': command, 'scripts/guide.md': command,
      'scripts/ship.spec.mjs': command, 'scripts/ship.test.js': command, 'deploy/secrets.env': command, 'deploy/secrets/token.enc': command,
      'deploy/.env.production': command, '.github/workflows/stack-deploy.yml': workflow('docker stack deploy -c stack.yaml shop'),
      'deploy/swarm/render.md': command, 'deploy/swarm/render.mjs.txt': command, 'deploy/swarm/prepare': 'docker stack rm shop\n',
      'deploy/swarm/comments.sh': '# docker swarm init\n  # docker volume create x\n',
      'scripts/comments.mjs': '// docker node ls\n',
      'deploy/crlf.sh': '# docker swarm init\r\n# docker node ls\r\necho ok\r\n',
    };
    assert.deepEqual(stackToolingFindings(tree(edition, files)), []);
  });
}

test(`${CODE}: unreadable, empty and invalid sources yield no finding`, () => {
  const context = tree('full', {
    'package.json': '{ not json', 'deploy/ops.sh': 'echo ok\n', 'sub/package.json': { name: 'x' },
    'other/package.json': { scripts: { ship: 7, build: 'tsc' } },
  });
  assert.deepEqual(stackToolingFindings({ ...context, files: [...context.files, 'deploy/gone.sh'] }), []);
  const binary = path.join(context.repoRoot, 'scripts', 'binary.sh');
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary, Buffer.from([0x64, 0, 0x65]));
  assert.deepEqual(stackToolingFindings({ ...context, files: [...context.files, 'scripts/binary.sh'] }), []);
});

test(`${CODE}: only an app root of the lite or full edition is judged`, () => {
  const files = { 'deploy/swarm/render.mjs': 'echo ok\n' };
  assert.equal(stackToolingFindings(tree('full', files)).length, 1);
  for (const repo of [{ kind: 'be', edition: 'full' }, { kind: 'app', edition: 'other' }, { kind: 'app' }, undefined]) {
    assert.deepEqual(stackToolingFindings({ ...tree('full', files), repo }), []);
  }
  assert.deepEqual(stackToolingFindings({ ...tree('lite', files), isRoot: false }), []);
  assert.equal(stackToolingFindings({ ...tree('lite', files), isRoot: undefined }).length, 1);
});

test(`${CODE}: a scoped check judges only the files in scope but reads the whole tracked list`, () => {
  const context = tree('lite', { 'deploy/swarm/render.mjs': 'echo ok\n', 'deploy/swarm/vps.sh': 'docker swarm init\n' });
  const scoped = stackToolingFindings({ ...context, files: ['deploy/swarm/vps.sh'], all: context.files, inScope: (file) => file === 'deploy/swarm/render.mjs' });
  assert.deepEqual(scoped.map((finding) => finding.path), ['deploy/swarm/render.mjs']);
  assert.equal(stackToolingFindings({ ...context, all: undefined }).length, 2);
});

test(`${CODE}: the app check wires the finder and ships the catalog explanation`, () => {
  const record = fixture('violating');
  for (const edition of ['lite', 'full']) {
    const context = tree(edition, record.files);
    const wired = a15Findings({ ...context, all: context.files }).filter((finding) => finding.code === CODE);
    assert.equal(wired.length, record.expect.length);
    const declaration = {
      hfs: 3, kind: 'app', project: 'shop', edition,
      sides: { be: { apps: [{ name: 'core', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } },
    };
    const result = checkRepo({ repoRoot: context.repoRoot, declaration, files: context.files, tree: false });
    const findings = result.findings.filter((finding) => finding.code === CODE);
    assert.deepEqual(summary(findings), sorted(record.expect));
    assert.ok(findings.every((finding) => finding.title && finding.titleVi && finding.whyVi && finding.nextStepVi));
  }
});
