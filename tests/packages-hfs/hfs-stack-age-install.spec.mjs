import test from 'node:test';
import assert from 'node:assert/strict';
import { AGE_SHA256, installAge } from '../../packages/hfs/stack/age-install.mjs';

const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const no = (stderr = '') => ({ status: 1, stdout: '', stderr });

/** A runner with a package manager, an age that appears once installed, and the commands it saw. */
function host({ manager = '', packageInstalls = true, staticInstalls = true, present = false } = {}) {
  const state = { installed: present, commands: [] };
  const run = (command) => {
    state.commands.push(command);
    if (command === 'command -v age') return state.installed ? ok('/usr/local/bin/age') : no();
    if (command.startsWith('for m in')) return ok(manager ? `${manager}\n` : '');
    if (command.startsWith('sudo -n') && command.includes('install -y') || command.startsWith('sudo -n apk')) {
      state.installed = packageInstalls;
      return packageInstalls ? ok() : no('package not found');
    }
    if (command.includes('sha256sum -c')) {
      state.installed = staticInstalls;
      return staticInstalls ? ok() : no('checksum mismatch');
    }
    return no('unknown command');
  };
  const lines = [];
  const report = { note: (text) => lines.push(`note ${text}`), bad: (text) => lines.push(`bad ${text}`) };
  return { run, state, report, lines };
}

test('age already present: nothing is run beyond the check', () => {
  const h = host({ present: true });
  installAge(h.run, h.report);
  assert.deepEqual(h.state.commands, ['command -v age']);
  assert.deepEqual(h.lines, []);
});

test('each detected package manager installs age with its own command', () => {
  const expected = { dnf: 'sudo -n dnf install -y age', yum: 'sudo -n yum install -y age', apk: 'sudo -n apk add age', 'apt-get': 'sudo -n apt-get install -y age' };
  for (const [manager, command] of Object.entries(expected)) {
    const h = host({ manager });
    installAge(h.run, h.report);
    assert.ok(h.state.commands.includes(command), manager);
    assert.deepEqual(h.lines, [`note installed age with ${manager}`]);
  }
});

test('a package that cannot be installed falls back to the static binary with a verified checksum', () => {
  const h = host({ manager: 'dnf', packageInstalls: false });
  installAge(h.run, h.report);
  const script = h.state.commands.find((command) => command.includes('sha256sum'));
  assert.ok(script.includes(`${AGE_SHA256}  `) && script.includes('sha256sum -c -'));
  assert.ok(script.indexOf('sha256sum -c') < script.indexOf('install -m 0755'), 'verified before installed');
  assert.match(h.lines[0], /^note installed the official static age v1\.2\.1 \(sha256 verified\) into \/usr\/local\/bin; dnf could not install age: package not found$/u);
});

test('no package manager at all uses the static binary; a failing static install is reported with both reasons', () => {
  const first = host({ manager: '' });
  installAge(first.run, first.report);
  assert.match(first.lines[0], /no package manager \(dnf, yum, apk, apt-get\) found/u);
  const failing = host({ manager: '', staticInstalls: false });
  installAge(failing.run, failing.report);
  assert.match(failing.lines[0], /^bad cannot install age \(no package manager .*\); the static install failed too: checksum mismatch/u);
});

test('the pinned checksum is a sha256', () => {
  assert.match(AGE_SHA256, /^[0-9a-f]{64}$/u);
});
