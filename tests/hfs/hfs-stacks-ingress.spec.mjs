// proves: STACKS_INGRESS_UNDECLARED@lite STACKS_INGRESS_UNDECLARED@full
// proves: STACKS_INGRESS_UNKNOWN@lite STACKS_INGRESS_UNKNOWN@full
// proves: STACKS_SECOND_INGRESS@lite STACKS_SECOND_INGRESS@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ingressIssues, stacksIngressFindings } from '../../scripts/hfs/rules/stacks-ingress.mjs';

const DECLARATION = '.starcistacks/application-stacks.yaml';
const STACK_FILE = '.starcistacks/production/infra/swarm/stack.yaml';
const pinned = image => `${image}@sha256:${'a'.repeat(64)}`;

function fixture(edition, image = 'traefik:v3.6') {
  const spec = {
    runtime: 'docker-swarm', composeFiles: ['infra/swarm/stack.yaml'],
    components: { edge: {}, api: {} }, ingress: { component: 'edge', hosts: ['app.example.test'] },
  };
  const doc = {
    components: { edge: { role: 'ingress', image: pinned(image) }, api: { role: 'service', image: pinned('app/api:1.0.0') } },
    environments: { production: spec },
  };
  const model = { services: { edge: { image: pinned(image) }, api: { image: pinned('app/api:1.0.0') } } };
  return { doc, spec, model, environment: 'production', repo: { edition } };
}

const issuesFor = (value, code) => ingressIssues(value).filter(issue => issue.code === code);

for (const edition of ['lite', 'full']) {
  test(`STACKS_INGRESS_UNDECLARED@${edition}: inventoried, bound and deployed ingress passes`, () => {
    assert.deepEqual(issuesFor(fixture(edition), 'STACKS_INGRESS_UNDECLARED'), []);
  });

  test(`STACKS_INGRESS_UNDECLARED@${edition}: missing declaration, inventory, ingress role, binding or service fails`, () => {
    const mutations = [
      value => { delete value.spec.ingress; },
      value => { delete value.doc.components.edge; },
      value => { value.doc.components.edge.role = 'service'; },
      value => { delete value.spec.components.edge; },
      value => { delete value.model.services.edge; },
    ];
    for (const mutate of mutations) {
      const value = fixture(edition);
      mutate(value);
      assert.ok(issuesFor(value, 'STACKS_INGRESS_UNDECLARED').length > 0);
    }
  });

  test(`STACKS_INGRESS_UNKNOWN@${edition}: digest-pinned Traefik and Caddy both pass`, () => {
    for (const image of ['traefik:v3.6', 'caddy:2.10.2', 'registry.example.test:5000/vendor/caddy:2.10.2', 'lucaslorentz/caddy-docker-proxy:2.10.0'])
      assert.deepEqual(ingressIssues(fixture(edition, image)), []);
  });

  test(`STACKS_INGRESS_UNKNOWN@${edition}: unknown ingress image and tag-only image fail`, () => {
    assert.ok(issuesFor(fixture(edition, 'nginx:1.28.0'), 'STACKS_INGRESS_UNKNOWN').length > 0);
    for (const source of ['inventory', 'rendered']) {
      const value = fixture(edition);
      if (source === 'inventory') value.doc.components.edge.image = 'traefik:v3.6';
      else value.model.services.edge.image = 'traefik:v3.6';
      assert.ok(issuesFor(value, 'STACKS_INGRESS_UNKNOWN').length > 0);
    }
  });

  test(`STACKS_SECOND_INGRESS@${edition}: one declared ingress passes`, () => {
    assert.deepEqual(issuesFor(fixture(edition), 'STACKS_SECOND_INGRESS'), []);
  });

  test(`STACKS_SECOND_INGRESS@${edition}: a second rendered Caddy is refused despite its service role`, () => {
    const value = fixture(edition);
    value.doc.components.preview = { role: 'service', image: pinned('caddy:2.10.2') };
    value.spec.components.preview = {};
    value.model.services.preview = { image: pinned('caddy:2.10.2') };
    assert.equal(issuesFor(value, 'STACKS_SECOND_INGRESS').length, 1);
    assert.ok(issuesFor(value, 'STACKS_INGRESS_UNDECLARED').length > 0);
  });

  test(`STACKS_SECOND_INGRESS@${edition}: unlisted rendered ingress and second declared ingress are detected`, () => {
    const value = fixture(edition);
    value.model.services.hidden = { image: pinned('docker.io/library/caddy:2.10.2') };
    assert.equal(issuesFor(value, 'STACKS_SECOND_INGRESS').length, 1);
    delete value.model.services.hidden;
    value.doc.components.hidden = { role: 'ingress', image: pinned('nginx:1.28.0') };
    value.spec.components.hidden = {};
    value.model.services.hidden = { image: pinned('nginx:1.28.0') };
    assert.equal(issuesFor(value, 'STACKS_SECOND_INGRESS').length, 1);
    assert.ok(issuesFor(value, 'STACKS_INGRESS_UNKNOWN').length > 0);
  });
}

test('R275: non-Swarm development environment retains its existing contract', () => {
  const value = fixture('lite');
  value.spec.runtime = 'docker-compose';
  delete value.spec.ingress;
  assert.deepEqual(ingressIssues(value), []);
});

function trackedFixture(value, run) {
  const base = path.resolve(os.tmpdir());
  const repoRoot = fs.mkdtempSync(path.join(base, 'ingress-spec-'));
  try {
    for (const [file, doc] of [[DECLARATION, value.doc], [STACK_FILE, value.model]]) {
      const target = path.join(repoRoot, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify(doc));
    }
    run({ repoRoot, files: [DECLARATION, STACK_FILE], repo: value.repo });
  } finally {
    assert.ok(repoRoot.startsWith(`${base}${path.sep}`));
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('R275 HFS finder reads the tracked model and returns standard findings for both editions', () => {
  for (const edition of ['lite', 'full']) {
    const value = fixture(edition);
    delete value.spec.ingress;
    trackedFixture(value, context => {
      const findings = stacksIngressFindings(context);
      assert.ok(findings.some(finding => finding.code === 'STACKS_INGRESS_UNDECLARED'));
      for (const finding of findings) {
        assert.equal(finding.level, 'error');
        assert.equal(finding.path, STACK_FILE);
        assert.ok(finding.message.startsWith(`${STACK_FILE}: `));
      }
    });
  }
});

test('R275 HFS finder leaves unavailable rendered model evidence to R267', () => {
  trackedFixture(fixture('lite'), context => {
    context.files = [DECLARATION];
    assert.deepEqual(stacksIngressFindings(context), []);
  });
});
