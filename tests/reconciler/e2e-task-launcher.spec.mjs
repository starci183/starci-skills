import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { starciShimPath, taskScript } from '../../scripts/reconciler/boot.mjs';
import { tunnelTaskScript } from '../../scripts/reconciler/tunnel-task.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const powershell = 'powershell.exe';
const psLiteral = (value) => String(value).replaceAll("'", "''");

const parsePowerShell = (file, env) => {
  const command = [
    '$tokens = $null',
    '$errors = $null',
    `[System.Management.Automation.Language.Parser]::ParseFile('${psLiteral(file)}', [ref]$tokens, [ref]$errors) | Out-Null`,
    'if ($errors.Count -gt 0) { $errors | ForEach-Object { [Console]::Error.WriteLine($_.Message) }; exit 1 }',
  ].join('; ');
  const encoded = Buffer.from(command, 'utf16le').toString('base64');
  return spawnSync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    encoding: 'utf8',
    env,
    timeout: 25_000,
    windowsHide: true,
  });
};

test('scheduled-task printers emit parseable actions through the per-user starci shim', { timeout: 30_000 }, (t) => {
  const available = spawnSync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (available.error?.code === 'ENOENT') return t.skip(`${powershell} is not installed`);
  assert.equal(available.status, 0, available.stderr);

  const fixture = mkdtemp(t, 'starci-task-launcher-e2e-');
  const home = path.join(fixture, 'home with spaces');
  const workdir = path.join(fixture, 'runtime with spaces');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(workdir, { recursive: true });
  const shim = starciShimPath({ home, platform: 'win32' });
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const cases = [
    { name: 'reconciler', script: taskScript({ starci: shim, workdir }), command: /reconciler start/ },
    { name: 'harness tunnel', script: tunnelTaskScript({ starci: shim, workdir }), command: /harness start --tunnel/ },
  ];

  for (const item of cases) {
    assert.match(item.script, new RegExp(`\\$starci = '${shim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
    assert.match(item.script, item.command);
    assert.match(item.script, /New-ScheduledTaskAction[^\n]+\$starci|\$argLine[^\n]+\$starci/);
    const file = path.join(fixture, `${item.name.replaceAll(' ', '-')}.ps1`);
    fs.writeFileSync(file, item.script);
    const parsed = parsePowerShell(file, env);
    assert.equal(parsed.status, 0, `${item.name} task script did not parse:\n${parsed.stderr}`);
  }
});
