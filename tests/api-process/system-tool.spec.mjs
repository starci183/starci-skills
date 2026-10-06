import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { systemTool } from '../../scripts/api/process/system-tool.mjs';
import { gpuQuery } from '../../scripts/api/process/gpu-query.mjs';
import { portListener } from '../../scripts/api/process/port-listener.mjs';
import { processNames } from '../../scripts/api/process/process-names.mjs';
import { runPowershell } from '../../scripts/api/process/run-powershell.mjs';
import { runPowershellAsync } from '../../scripts/api/process/run-powershell-async.mjs';
import { schtasks } from '../../scripts/api/process/schtasks.mjs';
import { winPath } from '../fixtures/win-path.mjs';

const everything = () => true;
const win = { platform: 'win32', exists: everything };

test('Windows tools resolve under <SystemRoot>\\System32, PowerShell in its v1.0 folder', () => {
  const env = { SystemRoot: winPath('D', 'WinX') };
  assert.deepEqual(systemTool('powershell', { ...win, env }), { ok: true, path: winPath('D', 'WinX', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') });
  assert.equal(systemTool('schtasks', { ...win, env }).path, winPath('D', 'WinX', 'System32', 'schtasks.exe'));
  assert.equal(systemTool('netstat', { ...win, env }).path, winPath('D', 'WinX', 'System32', 'NETSTAT.EXE'));
  assert.equal(systemTool('tasklist', { ...win, env }).path, winPath('D', 'WinX', 'System32', 'tasklist.exe'));
});

test('SystemRoot is read case-insensitively, windir is its fallback, the documented default comes last', () => {
  assert.equal(systemTool('schtasks', { ...win, env: { SYSTEMROOT: winPath('E', 'W') } }).path, winPath('E', 'W', 'System32', 'schtasks.exe'));
  assert.equal(systemTool('schtasks', { ...win, env: { windir: winPath('F', 'W') } }).path, winPath('F', 'W', 'System32', 'schtasks.exe'));
  assert.equal(systemTool('schtasks', { ...win, env: {} }).path, winPath('C', 'Windows', 'System32', 'schtasks.exe'));
});

test('a tool missing from the fixed set is the typed refusal, not a PATH lookup', () => {
  const asked = [];
  const refusal = systemTool('powershell', { platform: 'win32', env: { SystemRoot: winPath('C', 'Windows') }, exists: (file) => { asked.push(file); return false; } });
  assert.deepEqual(refusal, { ok: false, code: 'SYSTEM_TOOL_UNAVAILABLE', tool: 'powershell', platform: 'win32' });
  assert.ok(asked.length > 0 && asked.every((file) => path.win32.isAbsolute(file)));
  assert.equal(systemTool('curl', win).ok, false, 'an unlisted tool is refused');
  assert.equal(systemTool('lsof', win).code, 'SYSTEM_TOOL_UNAVAILABLE', 'a POSIX tool is not a Windows tool');
});

test('nvidia-smi is looked for in System32 first, then the NVSMI folder of the system drive', () => {
  const asked = [];
  const found = systemTool('nvidia-smi', { platform: 'win32', env: { SystemRoot: winPath('C', 'Windows') }, exists: (file) => { asked.push(file); return file.includes('NVSMI'); } });
  const nvsmi = winPath('C', 'Program Files', 'NVIDIA Corporation', 'NVSMI', 'nvidia-smi.exe');
  assert.deepEqual(asked, [winPath('C', 'Windows', 'System32', 'nvidia-smi.exe'), nvsmi]);
  assert.equal(found.path, nvsmi);
});

test('POSIX tools resolve in /usr/bin, /bin, /usr/sbin, /sbin order and never in /usr/local/bin', () => {
  const asked = [];
  const none = systemTool('lsof', { platform: 'linux', exists: (file) => { asked.push(file); return false; } });
  assert.deepEqual(asked, ['/usr/bin/lsof', '/bin/lsof', '/usr/sbin/lsof', '/sbin/lsof']);
  assert.equal(none.ok, false);
  assert.equal(systemTool('lsof', { platform: 'darwin', exists: (file) => file === '/usr/sbin/lsof' || file === '/sbin/lsof' }).path, '/usr/sbin/lsof');
  assert.equal(systemTool('ps', { platform: 'linux', exists: everything }).path, '/usr/bin/ps');
  assert.equal(systemTool('netstat', { platform: 'linux', exists: everything }).ok, false);
});

const absolute = (file) => path.win32.isAbsolute(file) || path.posix.isAbsolute(file);
const okTool = (file) => () => ({ ok: true, path: file });
const noTool = (name) => ({ ok: false, code: 'SYSTEM_TOOL_UNAVAILABLE', tool: name, platform: 'test' });

test('runPowershell, schtasks and processNames spawn an absolute path and degrade when the tool is missing', async () => {
  const calls = [];
  const spawn = (file) => { calls.push(file); return { status: 0, stdout: '"a.exe","1"\n', stderr: '', error: undefined }; };
  runPowershell('Write-Output ok', { spawn, tool: okTool(winPath('C', 'Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')) });
  schtasks(['/Query'], { spawn, tool: okTool(winPath('C', 'Windows', 'System32', 'schtasks.exe')) });
  assert.deepEqual(await processNames({ platform: 'win32', spawn, tool: okTool(winPath('C', 'Windows', 'System32', 'tasklist.exe')) }), ['a.exe']);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(absolute), calls.join(', '));
  const missing = runPowershell('x', { tool: noTool, spawn });
  assert.equal(missing.status, null);
  assert.equal(missing.error.code, 'SYSTEM_TOOL_UNAVAILABLE');
  assert.equal(schtasks(['/Query'], { tool: noTool, spawn }).error.code, 'SYSTEM_TOOL_UNAVAILABLE');
  assert.equal(await processNames({ platform: 'win32', spawn, tool: noTool }), null);
  assert.equal(calls.length, 3, 'nothing is spawned for a missing tool');
});

test('gpuQuery and runPowershellAsync spawn an absolute path and answer null when the tool is missing', async () => {
  const calls = [];
  const exec = (file, args, options, done) => { calls.push(file); done(null, 'out'); };
  assert.equal(await gpuQuery(['name'], 1000, { exec, tool: okTool(path.resolve('/x/nvidia-smi')) }), 'out');
  assert.equal(await runPowershellAsync('1', 1000, { exec, tool: okTool(path.resolve('/x/powershell.exe')) }), 'out');
  assert.ok(calls.length === 2 && calls.every(absolute));
  assert.equal(await gpuQuery(['name'], 1000, { exec, tool: noTool }), null);
  assert.equal(await runPowershellAsync('1', 1000, { exec, tool: noTool }), null);
  assert.equal(calls.length, 2, 'nothing is spawned for a missing tool');
});

test('portListener spawns absolute tools on both OS families and answers null without the lister', () => {
  const calls = [];
  const netstat = 'Proto Local Foreign State PID\n  TCP    0.0.0.0:4321    0.0.0.0:0    LISTENING    77\n';
  const winTool = (name) => ({ ok: true, path: winPath('C', 'Windows', 'System32', `${name}.exe`) });
  const winSpawn = (file) => { calls.push(file); return { stdout: /netstat/i.test(file) ? netstat : 'node server.js\n' }; };
  assert.deepEqual(portListener(4321, { platform: 'win32', spawn: winSpawn, tool: winTool }), { pid: 77, commandLine: 'node server.js' });
  const posixSpawn = (file) => { calls.push(file); return { stdout: /lsof/.test(file) ? '88\n' : 'node a.js\n' }; };
  const tool = (name) => ({ ok: true, path: `/usr/bin/${name}` });
  assert.deepEqual(portListener(4321, { platform: 'linux', spawn: posixSpawn, tool }), { pid: 88, commandLine: 'node a.js' });
  assert.equal(calls.length, 4);
  assert.ok(calls.every(absolute), calls.join(', '));
  const noProc = { readFileSync: () => { throw new Error('ENOENT'); }, readdirSync: () => { throw new Error('ENOENT'); }, readlinkSync: () => { throw new Error('ENOENT'); } };
  assert.equal(portListener(4321, { platform: 'linux', spawn: posixSpawn, tool: noTool, fsx: noProc }), null);
  assert.equal(portListener(4321, { platform: 'darwin', spawn: posixSpawn, tool: noTool, fsx: noProc }), null);
  assert.deepEqual(portListener(4321, { platform: 'win32', spawn: winSpawn, tool: (name) => (name === 'powershell' ? noTool(name) : winTool(name)) }), { pid: 77, commandLine: null });
});

test('portListener without lsof finds the process holding the LISTEN socket of a port from /proc, and null for a closed or unreadable one', () => {
  const rows = (port, state, inode) => `  0: 0100007F:${port.toString(16).toUpperCase().padStart(4, '0')} 00000000:0000 ${state} 00000000:00000000 00:00000000 00000000  1000        0 ${inode} 1 0000000000000000 100 0 0 10 0`;
  const header = '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode';
  const files = {
    '/proc/net/tcp': [header, rows(4321, '0A', 555), rows(4322, '01', 777)].join('\n'),
    '/proc/42/cmdline': 'node\0server.mjs\0',
  };
  const links = { '/proc/41/fd/3': 'socket:[999]', '/proc/42/fd/7': 'socket:[555]', '/proc/42/fd/8': '/dev/null' };
  const dirs = { '/proc': ['self', '41', '42', 'net'], '/proc/41/fd': ['3'], '/proc/42/fd': ['7', '8'] };
  const miss = (what) => { throw Object.assign(new Error(`ENOENT ${what}`), { code: 'ENOENT' }); };
  const fsx = {
    readFileSync: (file) => files[file] ?? miss(file),
    readdirSync: (dir) => dirs[dir] ?? miss(dir),
    readlinkSync: (link) => links[link] ?? miss(link),
  };
  assert.deepEqual(portListener(4321, { platform: 'linux', tool: noTool, fsx }), { pid: 42, commandLine: 'node server.mjs' });
  assert.equal(portListener(4322, { platform: 'linux', tool: noTool, fsx }), null, 'an ESTABLISHED socket is not a listener');
  assert.equal(portListener(9, { platform: 'linux', tool: noTool, fsx }), null);
  assert.equal(portListener(4321, { platform: 'linux', tool: noTool, fsx: { ...fsx, readdirSync: (dir) => (dir === '/proc' ? ['42'] : miss(dir)) } }), null, 'a process whose fds are unreadable holds nothing for this user');
});
