import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { portOnceFindings, portLiteralsOf, checkPortOnce, CODE } from '../../scripts/checks/check-port-once.mjs';

const paths = (findings) => findings.map((f) => [f.code, f.path]);

test('an owned port literal restated outside its owner is RT_PORT_RESTATED', () => {
  const owned = new Map([['9010', 'scripts/gates/sonar-local.mjs DEFAULT_HOST']]);
  assert.deepEqual(paths(portOnceFindings({
    'scripts/gates/sonar-local.mjs': `const DEFAULT_HOST = 'http://localhost:9010';\nexport { DEFAULT_HOST };`,
    'ext/sonar/README.md': 'SonarQube runs at http://localhost:9010 for this project.',
    'scripts/gates/other.mjs': `const u = new URL('http://localhost:9010');`,
  }, { owned })), [
    ['RT_PORT_RESTATED', 'ext/sonar/README.md'],
    ['RT_PORT_RESTATED', 'scripts/gates/other.mjs'],
  ]);
});

test('an owned port spelled only inside its owner files is not a finding', () => {
  const owned = new Map([['4547', 'modules/models/runtimes.yaml statusApp.port (read it through ui/ports.mjs)']]);
  assert.deepEqual(portOnceFindings({
    'modules/models/runtimes.yaml': 'statusApp:\n  port: 4547\n',
    'ui/ports.mjs': '// the single reader of statusApp.port\n',
    'ui/README.md': 'The UI reads statusApp.port from modules/models/runtimes.yaml.',
  }, { owned }), []);
});

test('a port literal spelled in two source files without an owning constant is RT_PORT_RESTATED', () => {
  const findings = portOnceFindings({
    'scripts/a/run.mjs': `server.listen(8123);\n`,
    'scripts/b/run.mjs': `const u = 'http://127.0.0.1:8123/x';`,
    'docs/ports.md': 'mentions http://localhost:8123 in prose',
  });
  assert.deepEqual(paths(findings), [
    ['RT_PORT_RESTATED', 'scripts/a/run.mjs'],
    ['RT_PORT_RESTATED', 'scripts/b/run.mjs'],
  ]);
});

test('the file that exports the literal as a constant owns it; the restaters are refused', () => {
  const findings = portOnceFindings({
    'scripts/lib/ports.mjs': `export const GATEWAY_PORT = 9443;\n`,
    'scripts/x.mjs': `const u = 'https://localhost:9443/';`,
  });
  assert.deepEqual(paths(findings), [['RT_PORT_RESTATED', 'scripts/x.mjs']]);
});

test('numbers that are not in a port position do not trip the check', () => {
  assert.equal(portLiteralsOf('const TIMEOUT_MS = 8000;\nwidth: 1440; bytes = 65536;').size, 0);
  assert.equal(portLiteralsOf('port: 4547\nSONAR_PORT=9010\nhttp://localhost:7070\n.listen(8123)').size, 4);
});

test('spec files, tests, generated runtime and product stacks are outside the law', () => {
  assert.deepEqual(portOnceFindings({
    'tests/x.spec.mjs': `f(9010); 'http://localhost:9010'`,
    'scripts/x.spec.mjs': `'http://localhost:9010'`,
    'packages/p/runtime/copy.mjs': `'http://localhost:9010'`,
    'examples/starcistacks-services/s.yaml': 'port: 9010\n',
    'modules/kernel/contract-changes/old.yaml': 'port: 9010',
  }), []);
});

test('this runtime keeps every port spelled once', () => {
  assert.deepEqual(checkPortOnce(path.resolve(import.meta.dirname, '..', '..')), []);
});
