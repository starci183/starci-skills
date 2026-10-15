// The managed stack-deploy.yml workflow of both editions: rendered by starci app sync from the declared deploy images, a thin caller of the
// `starci app stack` verbs. Proves its triggers, pins, secrets, input handling and verb calls, and that the deploy scanners accept it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { byCodeUnit } from '../../packages/hfs/report/order.mjs';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { deployWorkflowFindings } from '../../scripts/hfs/rules/deploy-workflow.mjs';
import { deployScanFindings } from '../../scripts/hfs/rules/deploy-scan.mjs';
import { renderTargets, TEMPLATES_DIR } from '../../packages/hfs/sync/index.mjs';
import { ACTIONS, parseFlags } from '../../packages/hfs/stack/cli.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MANIFEST = loadSlotManifest();
const PRESETS = { sonarExclusions: [] };
const FILE = '.github/workflows/stack-deploy.yml';
const EDITIONS = { lite: 'lite-app', full: 'shape-slot' };
const ALLOWED_SECRETS = ['SOPS_AGE_KEY', 'VPS_KNOWN_HOSTS', 'VPS_SSH_KEY'];
const VERBS = ['build-args', 'connect', 'deploy', 'disconnect', 'rollback'];

const hfsOf = edition => JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', EDITIONS[edition], 'hfs.json'), 'utf8'));

/** The images a deploy block would declare for an app: the first api app (plain) and the first front end (with a public build value). */
function imagesOf(hfs) {
  const api = hfs.sides.be.apps.find(entry => entry.kind === 'api').name;
  const web = hfs.sides.fe.apps[0].name;
  return [{ service: 'api', app: api, buildArgs: false }, { service: 'web-ui', app: web, buildArgs: true }];
}

function render(edition, stack) {
  const hfs = hfsOf(edition);
  const target = renderTargets(hfs, PRESETS, { manifest: MANIFEST, source: { files: [], read: () => '', stack } }).find(item => item.path === FILE);
  assert.ok(target, `${edition} renders ${FILE}`);
  return { hfs, content: target.content, doc: parseYaml(target.content) };
}

const withImages = edition => render(edition, { images: imagesOf(hfsOf(edition)), passEnv: ['CONTACT_EMAIL'] });
const steps = (doc, job) => doc.jobs[job].steps;
const runs = doc => Object.values(doc.jobs).flatMap(job => job.steps).map(step => step.run).filter(Boolean);
const collect = (value, key, found = []) => {
  if (Array.isArray(value)) value.forEach(item => collect(item, key, found));
  else if (value && typeof value === 'object') {
    for (const [name, member] of Object.entries(value)) {
      if (name === key && typeof member === 'string') found.push(member);
      collect(member, key, found);
    }
  }
  return found;
};

for (const edition of Object.keys(EDITIONS)) {
  test(`${edition}: the workflow is dispatch-only, with an environment, an operation and a release input`, () => {
    const { doc } = withImages(edition);
    assert.deepEqual(Object.keys(doc.on), ['workflow_dispatch']);
    const { inputs } = doc.on.workflow_dispatch;
    assert.deepEqual(Object.keys(inputs), ['environment', 'operation', 'release']);
    assert.equal(inputs.environment.type, 'environment');
    assert.deepEqual([inputs.operation.type, inputs.operation.default, inputs.operation.options], ['choice', 'deploy', ['deploy', 'rollback']]);
    assert.equal(inputs.release.type, 'string');
  });

  test(`${edition}: permissions, concurrency and the protected environment of both jobs`, () => {
    const { doc } = withImages(edition);
    assert.deepEqual(doc.permissions, { contents: 'read' });
    assert.equal(doc.concurrency.group, 'stack-${{ inputs.environment }}');
    assert.equal(doc.concurrency['cancel-in-progress'], false);
    assert.deepEqual(Object.keys(doc.jobs), ['release', 'rollback']);
    assert.deepEqual(doc.jobs.release.permissions, { contents: 'read', packages: 'write' });
    assert.deepEqual(doc.jobs.rollback.permissions, { contents: 'read', packages: 'read' });
    for (const job of Object.values(doc.jobs)) assert.equal(job.environment, '${{ inputs.environment }}');
  });

  test(`${edition}: every uses is pinned by a 40-hex commit SHA`, () => {
    const { doc } = withImages(edition);
    const uses = collect(doc, 'uses');
    assert.ok(uses.length >= 8);
    for (const value of uses) assert.match(value, /^[\w.-]+\/[\w./-]+@[a-f\d]{40}$/, value);
  });

  test(`${edition}: the file is LF only and no dispatch input reaches a script`, () => {
    const { content, doc } = withImages(edition);
    assert.equal(content.includes('\r'), false);
    for (const script of runs(doc)) assert.doesNotMatch(script, /\$\{\{/, `a run script interpolates an expression: ${script}`);
    const rollback = steps(doc, 'rollback').find(step => step.env?.RELEASE);
    assert.equal(rollback.env.RELEASE, '${{ inputs.release }}');
    assert.match(rollback.run, /--release "\$RELEASE"/);
    for (const job of Object.values(doc.jobs)) assert.equal(job.env.STACK_ENVIRONMENT, '${{ inputs.environment }}');
  });

  test(`${edition}: the only secrets are the age identity and the two SSH transport values; no shell deploy logic`, () => {
    const { content, doc } = withImages(edition);
    const referenced = [...new Set([...content.matchAll(/secrets\.([A-Za-z_]\w*)/g)].map(match => match[1]))].sort(byCodeUnit);
    assert.deepEqual(referenced, ALLOWED_SECRETS);
    assert.doesNotMatch(content, /secrets:\s*inherit/);
    assert.deepEqual([...new Set([...content.matchAll(/vars\.([A-Z_]+)/g)].map(match => match[1]))].sort(byCodeUnit), ['CONTACT_EMAIL', 'VPS_HOST', 'VPS_USER']);
    for (const script of runs(doc)) assert.doesNotMatch(script, /\b(?:ssh|docker\s+(?:stack|secret|service|swarm)|bash\s+-s)\b/, script);
  });

  test(`${edition}: every verb call names a real action and only real flags`, () => {
    const { doc } = withImages(edition);
    const calls = runs(doc).flatMap(script => script.replaceAll('\\\n', ' ').split('\n')).filter(line => line.includes('starci app stack'));
    const verbs = calls.map(line => /starci app stack ([a-z-]+)/.exec(line)[1]);
    assert.deepEqual([...new Set(verbs)].sort(byCodeUnit), VERBS);
    for (const verb of verbs) assert.ok(ACTIONS.includes(verb), `${verb} is an action of the stack cli`);
    for (const flag of new Set(calls.flatMap(line => line.slice(line.indexOf('starci app stack')).match(/--[a-z-]+/g) ?? []))) {
      assert.doesNotThrow(() => parseFlags([flag, 'value']), `${flag} is a flag of the stack cli`);
    }
  });

  test(`${edition}: deploy builds, connects, deploys the digests and always disconnects`, () => {
    const { doc, hfs } = withImages(edition);
    const names = steps(doc, 'release').map(step => step.name ?? step.uses ?? step.run);
    const at = name => names.findIndex(candidate => candidate === name);
    assert.ok(at('build and push api') < at('build and push web-ui'));
    assert.ok(at('build and push web-ui') < at('connect to the swarm manager'));
    assert.ok(at('connect to the swarm manager') < at('deploy the release'));
    assert.ok(at('deploy the release') < at('disconnect from the swarm manager'));
    const release = steps(doc, 'release');
    const build = release.find(step => step.id === 'build-api');
    assert.deepEqual([build.with.push, build.with.provenance], [true, false]);
    assert.equal(build.with.tags, '${{ steps.names.outputs.api }}:${{ github.sha }}');
    assert.equal(build.with.file, `be/apps/${imagesOf(hfs)[0].app}/Dockerfile`);
    assert.equal(release.find(step => step.id === 'build-web-ui').with.file, `fe/apps/${imagesOf(hfs)[1].app}/Dockerfile`);
    assert.equal(release.find(step => step.id === 'build-web-ui').with['build-args'], '${{ steps.args-web-ui.outputs.args }}');
    assert.equal(build.with['build-args'], undefined);
    assert.equal(release.some(step => step.id === 'args-api'), false, 'an image with no build argument has no build-args step');
    const deploy = release.find(step => step.name === 'deploy the release');
    assert.equal(deploy.env.IMAGE_API, '${{ steps.names.outputs.api }}@${{ steps.build-api.outputs.digest }}');
    assert.equal(deploy.env.IMAGE_WEB_UI, '${{ steps.names.outputs.web-ui }}@${{ steps.build-web-ui.outputs.digest }}');
    assert.equal(deploy.env.CONTACT_EMAIL, '${{ vars.CONTACT_EMAIL }}');
    assert.match(deploy.run, /--image "api=\$IMAGE_API"[\s\S]*--image "web-ui=\$IMAGE_WEB_UI"[\s\S]*--source-sha "\$GITHUB_SHA" --execute/);
    assert.equal(release.at(-1).if, '${{ always() }}');
    assert.equal(steps(doc, 'rollback').at(-1).if, '${{ always() }}');
  });

  test(`${edition}: image repositories are lowercase, derived from the project and written to GITHUB_OUTPUT`, () => {
    const { doc, hfs } = withImages(edition);
    const names = steps(doc, 'release').find(step => step.id === 'names');
    assert.match(names.run, /owner="\$\{GITHUB_REPOSITORY_OWNER,,\}"/);
    for (const { service, app } of imagesOf(hfs)) {
      assert.ok(names.run.includes(`echo "${service}=ghcr.io/\${owner}/${hfs.project}-${app}" >> "$GITHUB_OUTPUT"`), service);
    }
  });

  test(`${edition}: an app that declares no image renders a first step that fails with the reason`, () => {
    const { doc } = render(edition, undefined);
    const [first] = steps(doc, 'release');
    assert.equal(first.name, 'require a declared image');
    assert.match(first.run, /declare environments\.<env>\.deploy \(with images\) in \.starcistacks\/application-stacks\.yaml/);
    assert.match(first.run, /exit 1/);
    assert.equal(steps(doc, 'release').some(step => step.uses?.startsWith('docker/build-push-action')), false);
    const deploy = steps(doc, 'release').find(step => step.name === 'deploy the release');
    assert.deepEqual(Object.keys(deploy.env), ['SOPS_AGE_KEY']);
  });

  test(`${edition}: the deploy workflow scanners (R250, R251) accept the rendering with and without images`, t => {
    for (const stack of [undefined, { images: imagesOf(hfsOf(edition)), passEnv: [] }]) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-stack-workflow-'));
      t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
      fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
      fs.writeFileSync(path.join(dir, FILE), render(edition, stack).content);
      const input = { repoRoot: dir, files: [FILE], all: [FILE], repo: { kind: 'app', edition }, isRoot: true };
      assert.deepEqual(deployWorkflowFindings(input), []);
      assert.deepEqual(deployScanFindings(input), []);
    }
  });
}

test('the app templates keep every shipped file LF: .gitattributes carry text=auto eol=lf and the workflow templates hold no CR', () => {
  for (const skeleton of ['skeleton', 'skeleton-lite']) {
    const attributes = fs.readFileSync(path.join(TEMPLATES_DIR, 'app', skeleton, '.gitattributes'), 'utf8');
    assert.match(attributes, /^\* text=auto eol=lf$/m, skeleton);
  }
  for (const group of ['ci-workflows', 'ci-workflows-lite']) {
    const text = fs.readFileSync(path.join(TEMPLATES_DIR, 'app', group, 'github', 'workflows', 'stack-deploy.yml'), 'utf8');
    assert.equal(text.includes('\r'), false, group);
  }
});

test('the committed examples carry exactly the rendered workflow (lite-app builds its declared images)', () => {
  const lite = fs.readFileSync(path.join(ROOT, 'examples', 'lite-app', FILE), 'utf8');
  const doc = parseYaml(lite);
  assert.deepEqual(steps(doc, 'release').filter(step => step.id?.startsWith('build-')).map(step => step.id), ['build-api', 'build-web']);
  const none = parseYaml(fs.readFileSync(path.join(ROOT, 'examples', 'shape-slot', FILE), 'utf8'));
  assert.equal(steps(none, 'release')[0].name, 'require a declared image');
});
