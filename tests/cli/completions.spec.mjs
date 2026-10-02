import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../../packages/cli/src/catalog.generated.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = path.join(ROOT, 'packages', 'cli', 'bin', 'starci.mjs');
const COMPLETIONS = path.join(ROOT, 'packages', 'cli', 'completions');
const FILES = {
  bash: path.join(COMPLETIONS, 'starci.bash'),
  zsh: path.join(COMPLETIONS, '_starci'),
  fish: path.join(COMPLETIONS, 'starci.fish'),
  powershell: path.join(COMPLETIONS, 'starci.ps1'),
};

const probe = (command, args) => {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  return result.error?.code === 'ENOENT' ? null : command;
};
const bash = probe('bash', ['--version']);
const zsh = probe('zsh', ['--version']);
const fish = probe('fish', ['--version']);
const powershell = probe('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()']);

const commandGroups = Object.keys(CATALOG.groups);
const commandFlags = (group, verb) => [
  ...(CATALOG.groups[group].verbs[verb].flags ?? []),
  ...CATALOG.global,
].map((flag) => `--${flag.name}`);
const sorted = (values) => [...values].sort();
const shellQuote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
const psQuote = (value) => `'${String(value).replaceAll("'", "''")}'`;

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, ...options });
  assert.equal(result.error, undefined, result.error?.message);
  return result;
};

const bashCompletions = (words) => {
  const script = `. packages/cli/completions/starci.bash
COMP_WORDS=(${words.map(shellQuote).join(' ')})
COMP_CWORD=${words.length - 1}
_starci
for item in "\${COMPREPLY[@]}"; do printf '%s\\n' "$item"; done`;
  const result = run(bash, ['-s'], { input: script });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split(/\r?\n/).filter(Boolean);
};

const assertBalancedShellStructure = (source, label) => {
  const stack = [];
  let quote = null;
  let escaped = false;
  for (const character of source) {
    if (escaped) { escaped = false; continue; }
    if (character === '\\') { escaped = true; continue; }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') { quote = character; continue; }
    if (character === '{') stack.push(character);
    if (character === '}') assert.equal(stack.pop(), '{', `${label}: unmatched closing brace`);
  }
  assert.equal(quote, null, `${label}: unmatched ${quote} quote`);
  assert.deepEqual(stack, [], `${label}: unmatched opening brace`);
};

test('bash completion has valid syntax', { skip: bash ? false : 'bash binary is unavailable; bash syntax check skipped' }, () => {
  const result = run(bash, ['-n', 'packages/cli/completions/starci.bash']);
  assert.equal(result.status, 0, result.stderr);
});

test('zsh completion has valid syntax', { skip: zsh ? false : 'zsh binary is unavailable; zsh syntax check skipped' }, () => {
  const result = run(zsh, ['-n', 'packages/cli/completions/_starci']);
  assert.equal(result.status, 0, result.stderr);
});

test('fish completion has valid syntax', { skip: fish ? false : 'fish binary is unavailable; fish syntax check skipped' }, () => {
  const result = run(fish, ['-n', 'packages/cli/completions/starci.fish']);
  assert.equal(result.status, 0, result.stderr);
});

test('PowerShell completion parses without errors', { skip: powershell ? false : 'powershell.exe is unavailable; PowerShell parser check skipped' }, () => {
  const command = `$source = [IO.File]::ReadAllText(${psQuote(FILES.powershell)})
$tokens = $null
$errors = $null
[System.Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors) | Out-Null
if ($errors.Count -ne 0) { $errors | ForEach-Object { [Console]::Error.WriteLine($_.ToString()) }; exit 1 }`;
  const result = run(powershell, ['-NoProfile', '-NonInteractive', '-Command', command]);
  assert.equal(result.status, 0, result.stderr);
});

test('zsh and fish completions retain structural invariants without their shells', () => {
  for (const [shell, registration] of [['zsh', /^#compdef starci/m], ['fish', /^complete -c starci\b/m]]) {
    const source = fs.readFileSync(FILES[shell], 'utf8');
    assertBalancedShellStructure(source, shell);
    assert.match(source, registration, `${shell}: registration line`);
    for (const group of commandGroups) assert.match(source, new RegExp(`\\b${group}\\b`), `${shell}: group ${group}`);
  }
});

test('bash completion returns groups, verbs, command flags and a safe value result', { skip: bash ? false : 'bash binary is unavailable; bash behavior check skipped' }, () => {
  assert.deepEqual(sorted(bashCompletions(['starci', ''])), sorted([...commandGroups, 'help', 'completion']));
  assert.deepEqual(sorted(bashCompletions(['starci', 'gate', ''])), sorted(Object.keys(CATALOG.groups.gate.verbs)));
  assert.deepEqual(sorted(bashCompletions(['starci', 'kernel', 'survey', '--'])), sorted(commandFlags('kernel', 'survey')));
  assert.deepEqual(bashCompletions(['starci', 'runtime', 'check', '--only', '']), []);
});

test('PowerShell TabExpansion2 returns groups, verbs and command flags', { skip: powershell ? false : 'powershell.exe is unavailable; PowerShell behavior check skipped' }, () => {
  const command = `. ${psQuote(FILES.powershell)}
function Complete([string]$line) { @((TabExpansion2 $line $line.Length).CompletionMatches | ForEach-Object { $_.CompletionText }) }
[ordered]@{
  top = @(Complete 'starci ')
  gate = @(Complete 'starci gate ')
  surveyBare = @(Complete 'starci kernel survey --')
  survey = @(Complete 'starci kernel survey -- ')
  surveyPrefix = @(Complete 'starci kernel survey --j')
  only = @(Complete 'starci runtime check --only ')
} | ConvertTo-Json -Depth 3 -Compress`;
  const result = run(powershell, ['-NoProfile', '-NonInteractive', '-Command', command]);
  assert.equal(result.status, 0, result.stderr);
  const completed = JSON.parse(result.stdout.trim());
  assert.deepEqual(sorted(completed.top), sorted([...commandGroups, 'help', 'completion']));
  assert.deepEqual(sorted(completed.gate), sorted(Object.keys(CATALOG.groups.gate.verbs)));
  assert.ok(Array.isArray(completed.surveyBare), 'bare -- completion must not crash');
  assert.deepEqual(sorted(completed.survey), sorted(commandFlags('kernel', 'survey')));
  assert.deepEqual(completed.surveyPrefix, ['--json']);
  assert.ok(Array.isArray(completed.only), 'value completion must return a result array without crashing');
});

test('starci completion prints each generated file byte-for-byte and rejects unknown shells', () => {
  for (const [shell, file] of Object.entries(FILES)) {
    const result = run(process.execPath, [CLI, 'completion', shell], { encoding: null });
    assert.equal(result.status, 0, result.stderr.toString());
    assert.deepEqual(result.stdout, fs.readFileSync(file), `${shell} completion output`);
  }
  const unknown = run(process.execPath, [CLI, 'completion', 'nope']);
  assert.equal(unknown.status, 2, unknown.stdout + unknown.stderr);
  assert.match(unknown.stderr, /completion expects one of: bash, zsh, fish, powershell/);
});
