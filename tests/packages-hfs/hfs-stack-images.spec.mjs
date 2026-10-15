// What starci app sync reads of the stack declaration to render stack-deploy.yml: the deploy images and the host variables.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { declaredPassEnv, declaredStackImages, readDeclaredStack, stackWorkflowVariables } from '../../packages/hfs/sync/stack-images.mjs';
import { appSource, renderRepo, SyncError } from '../../packages/hfs/sync/index.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const PRESETS = { sonarExclusions: [] };
const dockerfileOf = app => `side/${app}/Dockerfile`;

function appTree(t, declaration, hfs = fs.readFileSync(path.join(ROOT, 'examples', 'lite-app', 'hfs.json'), 'utf8')) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-images-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'hfs.json'), hfs);
  if (declaration !== undefined) {
    fs.mkdirSync(path.join(dir, '.starcistacks'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.starcistacks', 'application-stacks.yaml'), declaration);
  }
  return dir;
}

test('the images are the union over the environments, sorted, with build arguments when any environment has them', () => {
  const declaration = {
    environments: {
      staging: { deploy: { images: { web: { app: 'web' }, api: { app: 'api', buildArgs: { values: {} } } } } },
      production: { deploy: { images: { web: { app: 'other', buildArgs: { values: { PUBLIC_URL: 'https://x.example' } } }, worker: { app: 'worker', buildArgs: { sealed: { member: 'web', keys: ['KEY'] } } } } } },
    },
  };
  assert.deepEqual(declaredStackImages(declaration), [
    { service: 'api', app: 'api', buildArgs: false },
    { service: 'web', app: 'web', buildArgs: true },
    { service: 'worker', app: 'worker', buildArgs: true },
  ]);
});

test('malformed declarations declare no image: names are strict and shapes are mappings', () => {
  assert.deepEqual(declaredStackImages(undefined), []);
  assert.deepEqual(declaredStackImages({ environments: 'none' }), []);
  assert.deepEqual(declaredStackImages({ environments: { production: {}, dev: { deploy: { images: ['api'] } } } }), []);
  const bad = { Api: { app: 'api' }, web: { app: 'Web' }, cli: 'cli', ok: { app: 'ok', buildArgs: 'x' } };
  assert.deepEqual(declaredStackImages({ environments: { production: { deploy: { images: bad } } } }), [{ service: 'ok', app: 'ok', buildArgs: false }]);
});

test('the host variables are the union of the passEnv names, valid and sorted', () => {
  const declaration = { environments: { dev: { deploy: { passEnv: ['ZONE', 'bad name', 7] } }, production: { deploy: { passEnv: ['CONTACT', 'ZONE'] } }, other: { deploy: { passEnv: 'CONTACT' } }, none: {} } };
  assert.deepEqual(declaredPassEnv(declaration), ['CONTACT', 'ZONE']);
  assert.deepEqual(declaredPassEnv(undefined), []);
  assert.deepEqual(declaredPassEnv({ environments: 3 }), []);
});

test('the declaration is read from the app root; a missing or unreadable one declares nothing', t => {
  const none = { images: [], passEnv: [] };
  assert.deepEqual(readDeclaredStack(appTree(t, undefined)), none);
  assert.deepEqual(readDeclaredStack(appTree(t, 'a: [unclosed')), none);
  const dir = appTree(t, 'environments:\n  production:\n    deploy:\n      images:\n        api: {app: api}\n      passEnv: [CONTACT]\n');
  assert.deepEqual(readDeclaredStack(dir), { images: [{ service: 'api', app: 'api', buildArgs: false }], passEnv: ['CONTACT'] });
  assert.deepEqual(readDeclaredStack(dir, { parseYaml: () => ({}) }), none);
  assert.deepEqual(readDeclaredStack(dir, { parseYaml: () => { throw new Error('refused'); } }), none);
});

test('with no image the guard step is the only block; with images every block is placed', () => {
  const empty = stackWorkflowVariables({}, 'demo', dockerfileOf);
  assert.match(empty.stackGuard, /^\n {6}- name: require a declared image\n {8}shell: bash\n {8}run: 'echo "::error::no image is declared/);
  assert.deepEqual([empty.stackNames, empty.stackImageSteps, empty.stackImageEnv, empty.stackImageArgs, empty.stackPassEnv], ['', '', '', '', '']);
  const images = [{ service: 'api', app: 'api', buildArgs: false }, { service: 'web-ui', app: 'web', buildArgs: true }];
  const full = stackWorkflowVariables({ images, passEnv: ['CONTACT'] }, 'demo', dockerfileOf);
  assert.equal(full.stackGuard, '');
  assert.equal(full.stackNames, '\n          echo "api=ghcr.io/${owner}/demo-api" >> "$GITHUB_OUTPUT"\n          echo "web-ui=ghcr.io/${owner}/demo-web" >> "$GITHUB_OUTPUT"');
  assert.match(full.stackImageSteps, /file: side\/web\/Dockerfile/);
  assert.match(full.stackImageSteps, /id: args-web-ui[\s\S]*--app web\n/);
  assert.equal(full.stackImageEnv.split('\n').length, 3);
  assert.equal(full.stackImageArgs, '\n            --image "api=$IMAGE_API" \\\n            --image "web-ui=$IMAGE_WEB_UI" \\');
  assert.equal(full.stackPassEnv, '\n          CONTACT: ${{ vars.CONTACT }}');
});

test('sync renders the images the app declares and the source carries them for scaffold and upgrade callers', async t => {
  const dir = appTree(t, 'environments:\n  production:\n    deploy:\n      images:\n        api: {app: api}\n        web: {app: web}\n      passEnv: [CONTACT]\n');
  assert.deepEqual(appSource(dir).stack.images.map(image => image.service), ['api', 'web']);
  const { targets } = await renderRepo(dir, { presets: PRESETS });
  const doc = parseYaml(targets.find(target => target.path === '.github/workflows/stack-deploy.yml').content);
  assert.deepEqual(doc.jobs.release.steps.filter(step => step.id?.startsWith('build-')).map(step => step.with.file), ['be/apps/api/Dockerfile', 'fe/apps/web/Dockerfile']);
  assert.equal(doc.jobs.release.steps.find(step => step.name === 'deploy the release').env.CONTACT, '${{ vars.CONTACT }}');
});

test('sync refuses a deploy image whose app hfs.json does not declare', async t => {
  const dir = appTree(t, 'environments:\n  production:\n    deploy:\n      images:\n        api: {app: ghost}\n');
  await assert.rejects(renderRepo(dir, { presets: PRESETS }), error => error instanceof SyncError && /HFS_SYNC_STACK_IMAGE.*ghost/.test(error.message));
});

test('an app with no stack declaration renders the workflow with no image step', async t => {
  const { targets } = await renderRepo(appTree(t, undefined), { presets: PRESETS });
  const doc = parseYaml(targets.find(target => target.path === '.github/workflows/stack-deploy.yml').content);
  assert.equal(doc.jobs.release.steps[0].name, 'require a declared image');
});
