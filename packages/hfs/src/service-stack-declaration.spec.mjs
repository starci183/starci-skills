// R165 HFS_SERVICE_STACK_DECLARATION: each api or worker app of a multi-service product is a `role: service` component, named after
// the app or mapped to it by `environments.<env>.deploy.images.<component>.app` in any environment.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serviceFindings } from '../runtime/scripts/hfs/rules/services.mjs';

const repo = { sides: { be: { apps: [{ name: 'api', kind: 'api' }, { name: 'mcp', kind: 'api' }] } } };

/** The R165 findings of a two-service app whose stack declaration is `yaml`. */
function r165(t, yaml) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-r165-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.starcistacks'));
  fs.writeFileSync(path.join(root, '.starcistacks', 'application-stacks.yaml'), yaml);
  return serviceFindings({ repoRoot: root, files: [], repo }).filter((finding) => finding.ruleId === 'HFS_SERVICE_STACK_DECLARATION' || finding.code === 'HFS_SERVICE_STACK_DECLARATION');
}

test('R165: a role service component named exactly like the app passes', (t) => {
  assert.deepEqual(r165(t, 'components:\n  api: {role: service}\n  mcp: {role: service}\n'), []);
});

test('R165: a role service component mapped to the app by deploy.images.<component>.app passes', (t) => {
  const yaml = [
    'components:',
    '  shop-api: {role: service}',
    '  shop-mcp: {role: service}',
    'environments:',
    '  dev: {}',
    '  prod:',
    '    deploy:',
    '      images:',
    '        shop-api: {app: api}',
    '        shop-mcp: {app: mcp}',
    '',
  ].join('\n');
  assert.deepEqual(r165(t, yaml), []);
});

test('R165: an app with no component of its name and none mapped to it is a finding naming the app', (t) => {
  const findings = r165(t, 'components:\n  api: {role: service}\n  shop-mcp: {role: service}\n');
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /be\/apps\/mcp/);
  assert.match(findings[0].message, /deploy\.images\.<component>\.app: mcp/);
});

test('R165: a mapped component whose role is not service is a finding naming the component', (t) => {
  const yaml = 'components:\n  api: {role: service}\n  shop-mcp: {role: dependency}\nenvironments:\n  prod:\n    deploy:\n      images:\n        shop-mcp: {app: mcp}\n';
  const findings = r165(t, yaml);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /components\.shop-mcp .*must be `role: service`, not `dependency`/);
});
