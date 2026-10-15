import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDeployConfig } from '../../packages/hfs/stack/config.mjs';
import { StackError } from '../../packages/hfs/stack/errors.mjs';
import { buildApp, removeApps, trackDirectory } from '../helpers/stack-app.mjs';

after(removeApps);

const VALID = {
  images: { api: { app: 'api' } },
  volumes: ['demo-data'],
  secrets: { grants: [{ service: 'api', filePointers: true, from: [{ member: 'api' }] }] },
  environment: { api: { files: ['infra/swarm/public.conf'], values: { PORT: '8787' } } },
  configs: [{ name: 'public', file: 'infra/swarm/public.conf', env: 'APP_CFG_PUBLIC' }],
};

const refusalOf = (action) => {
  try { action(); } catch (error) { return error; }
  return assert.fail('expected a refusal');
};

test('a valid deploy block loads with absolute paths, the default stack name and the sealed members', () => {
  const root = buildApp({ deploy: VALID });
  const config = loadDeployConfig({ repoRoot: root, env: 'production' });
  assert.equal(config.stack, 'demo');
  assert.equal(config.project, 'demo');
  assert.equal(config.envDir, path.join(root, '.starcistacks', 'production'));
  assert.equal(config.stackFile, path.join(config.envDir, 'infra', 'swarm', 'stack.yaml'));
  assert.deepEqual([...config.members].sort(), ['api', 'stack']);
  assert.deepEqual([...config.services].sort(), ['api', 'web']);
  assert.equal(config.images.api.app, 'api');
  assert.equal(config.remote.host, 'vps');
});

test('an app without sealed members still loads (members are unknown, not empty)', () => {
  const config = loadDeployConfig({ repoRoot: buildApp({ deploy: VALID, withSecrets: false }), env: 'production' });
  assert.equal(config.members.size, 0);
});

test('an environment name that is not a name is refused before any file is read', () => {
  const error = refusalOf(() => loadDeployConfig({ repoRoot: '/nowhere', env: '../x' }));
  assert.ok(error instanceof StackError);
  assert.equal(error.code, 'STACKS_DEPLOY_CONFIG_INVALID');
  assert.equal(error.exit, 2);
});

test('a missing or unparsable declaration is refused with its own code', () => {
  const empty = trackDirectory(fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-stack-empty-')));
  assert.equal(refusalOf(() => loadDeployConfig({ repoRoot: empty, env: 'production' })).code, 'STACKS_DEPLOY_FILE_MISSING');
  const invalid = buildApp({ declaration: 'a: [unclosed' });
  assert.equal(refusalOf(() => loadDeployConfig({ repoRoot: invalid, env: 'production' })).code, 'STACKS_DEPLOY_FILE_INVALID');
});

test('an unknown environment, a compose environment and an undeclared deploy block are each refused', () => {
  assert.equal(refusalOf(() => loadDeployConfig({ repoRoot: buildApp({ deploy: VALID }), env: 'staging' })).code, 'STACKS_DEPLOY_ENV_UNKNOWN');
  assert.equal(refusalOf(() => loadDeployConfig({ repoRoot: buildApp({ deploy: VALID, runtime: 'docker-compose' }), env: 'production' })).code, 'STACKS_DEPLOY_NOT_SWARM');
  assert.equal(refusalOf(() => loadDeployConfig({ repoRoot: buildApp({}), env: 'production' })).code, 'STACKS_DEPLOY_UNDECLARED');
});

test('an empty declaration, an empty stack source and a missing composeFiles entry are handled', () => {
  assert.equal(refusalOf(() => loadDeployConfig({ repoRoot: buildApp({ declaration: '' }), env: 'production' })).code, 'STACKS_DEPLOY_ENV_UNKNOWN');
  const config = loadDeployConfig({ repoRoot: buildApp({ deploy: { stack: 'demo' }, stack: '' }), env: 'production' });
  assert.equal(config.services.size, 0);
  const declaration = ['schema: starci/application-stacks@1', 'environments:', '  production:', '    runtime: docker-swarm', '    deploy: {stack: demo}', ''].join('\n');
  assert.equal(refusalOf(() => loadDeployConfig({ repoRoot: buildApp({ declaration }), env: 'production' })).code, 'STACKS_DEPLOY_FILE_MISSING');
});

test('an unreadable stack source is refused', () => {
  const root = buildApp({ deploy: VALID });
  fs.rmSync(path.join(root, '.starcistacks', 'production', 'infra', 'swarm', 'stack.yaml'));
  assert.equal(refusalOf(() => loadDeployConfig({ repoRoot: root, env: 'production' })).code, 'STACKS_DEPLOY_FILE_MISSING');
});

test('an invalid block lists its problems, one for the singular and a count for the plural', () => {
  const one = refusalOf(() => loadDeployConfig({ repoRoot: buildApp({ deploy: { ...VALID, volumes: ['bad volume'] } }), env: 'production' }));
  assert.match(one.message, /1 problem in environments\.production\.deploy: deploy\.volumes\[0\]/u);
  const many = refusalOf(() => loadDeployConfig({ repoRoot: buildApp({ deploy: { ...VALID, stack: 'Bad', unknown: 1, volumes: ['bad volume'] } }), env: 'production' }));
  assert.match(many.message, /3 problems in environments\.production\.deploy/u);
});

test('a service the stack source does not define is refused', () => {
  const error = refusalOf(() => loadDeployConfig({ repoRoot: buildApp({ deploy: { ...VALID, images: { worker: { app: 'worker' } } } }), env: 'production' }));
  assert.match(error.message, /worker is not a service of the stack source/u);
});
