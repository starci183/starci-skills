import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { releaseTerminalCallRange, releaseTerminalConsumerRanges } from '../../scripts/checks/lib/release-terminal-shape.mjs';
import { findHostBoundaryViolations } from '../../scripts/checks/check-host-boundary.mjs';

const FILE = 'scripts/api/orca/terminal-create.mjs';
// Parser inputs are fixtures; native adapter behavior is exercised separately by its owning spec.
const ADAPTER = `import { orcaCall } from './lib.mjs';
export function createReleaseTerminal() {
  const selected = { id: 'fixture-source' };
  return orcaCall('terminal-create', { worktree: selected.id, shell: 'powershell.exe', title: '[Release] StarCi runtime' });
}`;
const CONSUMER = `import { createReleaseTerminal } from '../api/orca/terminal-create.mjs';
export function prepareReleaseTerminal() {
  let native; native = createReleaseTerminal(); return native;
}`;

test('the boundary admits only the fixture adapter fixed plain PowerShell call literal', () => {
  const range = releaseTerminalCallRange(ADAPTER, FILE);
  assert.ok(range);
  assert.equal(ADAPTER.slice(range.start, range.end), "'terminal-create'");
  assert.equal(releaseTerminalCallRange(ADAPTER, 'scripts/kernel/terminal-create.mjs'), null);
});

test('a second create, alias, destructuring, spread, arbitrary shell/command/environment or caller input gets no exemption', () => {
  const changes = [
    ADAPTER + "\norcaCall('terminal-create', {worktree:'other',shell:'powershell.exe',title:'x'});\n",
    ADAPTER.replace("import { orcaCall }", "import { orcaCall as invoke }").replace("return orcaCall(", "return invoke("),
    ADAPTER.replace("  return orcaCall(", "  const invoke = orcaCall; return invoke("),
    ADAPTER.replace("  return orcaCall(", "  const { invoke } = { invoke: orcaCall }; return invoke("),
    ADAPTER.replace("worktree: selected.id,", "...selected, worktree: selected.id,"),
    ADAPTER.replace("shell: 'powershell.exe'", "shell: 'cmd.exe'"),
    ADAPTER.replace("title: '[Release] StarCi runtime'", "title: '[Release] StarCi runtime', command: 'claude -p x'"),
    ADAPTER.replace("title: '[Release] StarCi runtime'", "title: '[Release] StarCi runtime', environment: 'other'"),
    ADAPTER.replace("function createReleaseTerminal()", "function createReleaseTerminal(input)"),
  ];
  for (const changed of changes) assert.equal(releaseTerminalCallRange(changed, FILE), null);
});

test('the factory consumer admits only its one unaliased zero-argument import/call, and another caller stays red', () => {
  const file = 'scripts/supervisor/release-terminal.mjs';
  assert.equal(releaseTerminalConsumerRanges(CONSUMER, file).length, 2);
  for (const changed of [CONSUMER + '\ncreateReleaseTerminal();\n',
    CONSUMER.replace('createReleaseTerminal();', 'createReleaseTerminal({command: "claude -p x"});'),
    CONSUMER.replace('{ createReleaseTerminal }', '{ createReleaseTerminal as invoke }').replace('createReleaseTerminal();', 'invoke();'),
    CONSUMER.replace('native = createReleaseTerminal();', 'const invoke = createReleaseTerminal; native = invoke();'),
    CONSUMER.replace('native = createReleaseTerminal();', 'const {invoke} = {invoke: createReleaseTerminal}; native = invoke();')])
    assert.deepEqual(releaseTerminalConsumerRanges(changed, file), []);
  assert.deepEqual(releaseTerminalConsumerRanges(CONSUMER, 'scripts/kernel/release-terminal.mjs'), []);
});

test('actual boundary keeps a second create on the same line, raw terminal creation and agent child spawns red', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-release-boundary-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const write = (file, body) => { const target = path.join(base, file); fs.mkdirSync(path.dirname(target), {recursive:true}); fs.writeFileSync(target, body); };
  write(FILE, ADAPTER);
  write('scripts/supervisor/release-terminal.mjs', CONSUMER);
  assert.equal(findHostBoundaryViolations({root:base}).ok, true);
  write(FILE, ADAPTER.replace("return orcaCall('terminal-create'", "orcaCall('terminal-create', {worktree:'bad',shell:'powershell.exe',title:'x'}); return orcaCall('terminal-create'"));
  assert.ok(findHostBoundaryViolations({root:base}).violations.some((v) => v.rule === 'agent-launch'));
  write(FILE, ADAPTER);
  write('scripts/kernel/bad.mjs', "import {spawnSync} from 'node:child_process'; spawnSync('claude',['-p','x']); const command='orca terminal create --shell powershell.exe';");
  const found = findHostBoundaryViolations({root:base}).violations;
  assert.ok(found.some((v) => v.rule === 'agent-launch'));
  assert.ok(found.some((v) => v.rule === 'agent-cli-spawn'));
});
