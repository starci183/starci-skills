import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  GUIDANCE_CODE, isGuidanceFile, sentencesOf, commandSpans, excusedBy, textFindings, markdownUnits, scanGuidance,
} from '../../scripts/checks/check-guidance-commands.mjs';

// Agent-facing guidance never tells an agent to run a command the command guard refuses (RT_GUIDANCE_REFUSED_COMMAND).
// The defect: supervise.yaml told the Supervisor to open "an Opus lane (git worktree add ...)" while the guard refuses
// every raw `git worktree add`. The matcher is the guard's own; these cases pin what counts as an instruction.

test('a refused command in an instruction is caught, in every command form', async () => {
  const instructions = [
    // The original supervise.yaml runtime-defect text: an unquoted command in parentheses.
    'a runtime/Source defect gate or OWED cluster: open a fix - an Opus lane (git worktree add <lanesRoot>/<name> -b lane/<name> main; land.mjs --commit <sha> --lane <name>) or ONE [Worker] job per cluster.',
    // The original chatSeat line.
    'fixes through Opus lanes: an ephemeral worktree (git worktree add <lanesRoot>/<name> -b lane/<name> main; <lanesRoot> is the owner config roots.lanes), commits there.',
    // The original claude-debug step: backticked commands.
    'Worktree under `<lanesRoot>/<lane>`: `git -C ../.claude worktree add <lanesRoot>/<lane> -b lane/<lane> origin/main`; junction `node_modules` with `cmd /c mklink /J`.',
    'Clean the scratch tree with `rm -rf <dir>` before the next run.',
    'If the tree is stuck, run taskkill /F /IM node.exe and start again.',
    'Hand the critique to a second agent: "codex exec --model gpt-5 <prompt>".',
    'Open a terminal for the worker with `orca terminal create --command <cmd>`.',
    // A clause boundary ends a runtime-actor or past-tense excuse.
    'If land.mjs fails, run `git worktree remove --force <dir>`.',
    'When the last land was red, use `Remove-Item -Recurse -Force <dir>`.',
  ];
  for (const text of instructions) {
    const found = await textFindings(text);
    assert.ok(found.length >= 1, `not caught: ${text}`);
  }
  const codes = (await textFindings(instructions[2])).map((f) => f.code);
  assert.deepEqual(codes, ['WORKTREE_NOT_OPS', 'LINK_CREATE']);
});

test('a command shown under an explicit prohibition is not a finding', async () => {
  const prohibitions = [
    'Never `git worktree remove --force` a worktree with a node_modules junction inside.',
    'Never kill processes by image name or pattern (`taskkill /IM` or `/FI`, `pkill`, `killall`, `Stop-Process -Name`): the machine is shared.',
    'Never delete a tree recursively (`rm -r`/`-rf`, `rmdir /s`, `rd /s`, `Remove-Item -Recurse` and its aliases; RECURSIVE_DELETE).',
    'no raw terminal create (RAW_TERMINAL_CREATE) and no headless agent CLI (`codex exec`, `claude -p`/`--print`, `devin -p`).',
    'Do not run `git worktree add <dir>` yourself; the runtime makes the tree.',
    'Use safeRemove instead of `rm -rf <dir>`.',
    '`git worktree add <dir>` is refused for every op (WORKTREE_NOT_OPS).',
    'Kh\u00f4ng bao gi\u1edd ch\u1ea1y `rm -rf node_modules` trong worktree.',
  ];
  for (const text of prohibitions) assert.deepEqual(await textFindings(text), [], text);
});

test('a description of what the runtime does or what happened is not a finding', async () => {
  const descriptions = [
    '3. land.mjs fast-forwards live main by compare-and-swap (git update-ref main <new> <base>) and updates the working tree.',
    '`scripts/api/git/worktree-add.mjs` is the only place the runtime runs `git worktree add` (`check-worktree-add.mjs`).',
    'createWorktree is the only `git worktree add` in the runtime scripts.',
    'A worker\'s private worktree beside todo-app-fe was removed with `git worktree remove --force`, which followed the junctions and deleted 674 live files.',
    'A `git worktree remove` ran through a node_modules junction.',
  ];
  for (const text of descriptions) assert.deepEqual(await textFindings(text), [], text);
});

test('the sentence is the unit: a prohibition in the next sentence does not excuse an instruction', async () => {
  const text = 'Open the lane with `git worktree add <dir> -b lane/x main`. Never run `rm -rf <dir>` there.';
  const found = await textFindings(text);
  assert.equal(found.length, 1);
  assert.equal(found[0].code, 'WORKTREE_NOT_OPS');
  assert.equal(sentencesOf(text).length, 2);
});

test('allowed commands are never findings, whatever the sentence', async () => {
  for (const text of [
    'Land with `starci supervisor land --commit <sha> --lane <lane> --specs touching --json`.',
    'Remove one junction with `cmd /c rmdir <path>` and one file with `rm <file>`.',
    'Start it with `orca orchestration worker-start --agent claude --worktree path:<dir> --spec "<brief>"`.',
    'Run `node scripts/supervisor/workers.mjs stage --self --name <slug> --files <csv>`, then end only your own PID (`taskkill /PID <pid>`).',
  ]) assert.deepEqual(await textFindings(text), [], text);
});

test('command spans: backticks, quotes, parentheses and an imperative run', () => {
  const spans = commandSpans('Run git status, then `git log` and "git diff" (git show).').map((s) => s.text);
  assert.deepEqual(spans.sort(), ['git diff', 'git log', 'git show', 'git status'].sort());
  assert.equal(excusedBy('Never `rm -rf x`.', commandSpans('Never `rm -rf x`.')[0]), 'prohibition');
});

test('a clause whose subject is a runtime actor describes the runtime, whatever punctuation the clause carries', () => {
  const runtime = 'The finish marks it release-pending; the host-side controller removes it once released (link check, removal, then `git branch -d`).';
  assert.equal(excusedBy(runtime, commandSpans(runtime)[0]), 'runtime-internal');
  const instruction = 'When it is stale, clean up (link check, removal, then `git branch -d`).';
  assert.equal(excusedBy(instruction, commandSpans(instruction)[0]), null, 'an agent told to run it is still an instruction');
});

test('markdown: fenced lines stand under their lead-in sentence, table cells are their own text', async () => {
  const md = ['Never run these:', '', '```', 'rm -rf node_modules', '```', '', 'Clean up:', '', '```bash', 'rm -rf dist', '```', '',
    '| Signature | First response |', '| --- | --- |', '| x | Clean with `rm -rf out`. |'].join('\n');
  const units = markdownUnits(md);
  const found = [];
  for (const u of units) found.push(...(await textFindings(u.text)).map((f) => f.command));
  assert.deepEqual(found, ['rm -rf dist', 'rm -rf out']);
});

test('scope: module yaml and prompts and skill files; never the refusal catalog or contract-change history', () => {
  assert.ok(isGuidanceFile('modules/supervisor/supervise.yaml'));
  assert.ok(isGuidanceFile('modules/kernel/kernel-prompt.md'));
  assert.ok(isGuidanceFile('skills/claude-debug/SKILL.md'));
  assert.ok(!isGuidanceFile('modules/kernel/failure-codes.yaml'));
  assert.ok(!isGuidanceFile('modules/kernel/contract-changes/x.yaml'));
  assert.ok(!isGuidanceFile('docs/verify-proof.md'));
});

test('a tree scan reports the yaml field and the guard code; the live tree is clean', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guidance-'));
  try {
    fs.mkdirSync(path.join(dir, 'modules', 'supervisor'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'modules', 'supervisor', 'x.yaml'),
      'classes:\n  fix:\n    en: "open a lane (git worktree add <d> -b lane/x main)"\n    vi: "Kh\u00f4ng bao gi\u1edd ch\u1ea1y `git worktree add`."\n');
    const r = await scanGuidance(dir, { files: ['modules/supervisor/x.yaml'] });
    assert.equal(r.ok, false);
    assert.deepEqual(r.findings.map((f) => [f.file, f.key, f.code]), [['modules/supervisor/x.yaml', 'classes.fix.en', 'WORKTREE_NOT_OPS']]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  const live = await scanGuidance(path.resolve(import.meta.dirname, '..', '..'));
  assert.deepEqual(live.findings, []);
  assert.equal(GUIDANCE_CODE, 'RT_GUIDANCE_REFUSED_COMMAND');
});
