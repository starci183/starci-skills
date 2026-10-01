import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { commandVerdict, simpleCommands } from '../scripts/guards/command-guard.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The command guard refuses, through every wrapper it opens (bash -c, cmd /c and //c, powershell -Command, chains):
// a raw git worktree add/remove (WORKTREE_NOT_OPS), a recursive delete (RECURSIVE_DELETE), a kill by image name
// (PROCESS_KILL_BY_NAME, tests/process-kill-guard.spec.mjs), `orca terminal create` (RAW_TERMINAL_CREATE) and a
// headless agent CLI (AGENT_HEADLESS_LAUNCH). Each refusal names the sanctioned API. No false positives: a plain file
// delete, `git worktree list`, a single-junction rmdir, a PID kill, worker-start, and any text that only MENTIONS a
// refused command (echo, commit message, heredoc) pass. No command below is ever run: the guard judges the text.
const cwd = os.tmpdir();
const verdict = (command, dialect = 'bash') => commandVerdict({ command, cwd, guard: { owned: [cwd] }, env: process.env, dialect });
const refusedAll = async (code, remedy, cases) => {
  for (const [command, dialect] of cases) {
    const v = await verdict(command, dialect);
    assert.equal(v?.code, code, `${command} (${dialect}) -> ${v?.code ?? 'passed'}`);
    assert.match(v.remedy, remedy, `${command}: the remedy names the sanctioned API`);
    // Every runtime file the remedy names exists: a remedy pointing at a moved or deleted file sends the agent nowhere.
    for (const named of v.remedy.match(/scripts\/[\w./-]+\.mjs/g) ?? []) assert.ok(fs.existsSync(path.join(ROOT, named)), `${command}: the remedy names ${named}, which does not exist`);
  }
};
const passedAll = async (cases) => {
  for (const [command, dialect] of cases) {
    const v = await verdict(command, dialect);
    assert.equal(v, null, `${command} (${dialect}) -> ${v?.code}`);
  }
};

test('a raw git worktree add or remove is refused with the runtime worktree API as the remedy', async () => {
  await refusedAll('WORKTREE_NOT_OPS', /runtime worktree API \(scripts\/.*safeRemoveWorktree/, [
    ['git worktree add ../wt HEAD', 'bash'],
    ['git worktree add -b lane/x ../wt main', 'bash'],
    ['git -C D:/repo worktree add --detach D:/repo-wt HEAD', 'bash'],
    ['git worktree remove --force ../wt', 'bash'],
    ['git -C D:/repo worktree remove D:/repo-wt', 'bash'],
    ['cd D:/repo && git worktree remove ../wt', 'bash'],
    ['cmd //c git worktree add ../wt HEAD', 'bash'],
    ['powershell -NoProfile -Command "git worktree remove ../wt"', 'bash'],
    ['git worktree add ../wt HEAD; git status', 'powershell'],
  ]);
});

test('git worktree list and prune pass', async () => {
  await passedAll([['git worktree list', 'bash'], ['git worktree list --porcelain', 'powershell'], ['git -C D:/repo worktree list', 'bash']]);
});

test('a recursive delete is refused in every spelling, wrapper and shell, with safeRemoveTree as the remedy', async () => {
  await refusedAll('RECURSIVE_DELETE', /safeRemoveTree \(scripts\/lib\/safe-remove\.mjs\)/, [
    ['rm -r build', 'bash'],
    ['rm -rf node_modules', 'bash'],
    ['rm -fr dist', 'bash'],
    ['rm -Rf dist', 'bash'],
    ['rm -v -r dist', 'bash'],
    ['rm --recursive --force dist', 'bash'],
    ['npm test && rm -rf coverage', 'bash'],
    ['bash -c "rm -rf /d/wt"', 'bash'],
    ['cmd /c rmdir /s /q D:\\wt', 'bash'],
    ['cmd //c rmdir //s //q D:\\wt', 'bash'],
    ['cmd /c rd /s/q D:\\wt', 'bash'],
    ['cmd /c del /s /q D:\\wt\\*', 'bash'],
    ['cmd /c erase /S x', 'bash'],
    ['robocopy C:\\empty D:\\wt /MIR', 'bash'],
    ['robocopy C:\\empty D:\\wt //PURGE', 'bash'],
    ['Remove-Item -Recurse -Force D:\\wt', 'powershell'],
    ['Remove-Item D:\\wt -r', 'powershell'],
    ['Remove-Item D:\\wt -Recurse:$true', 'powershell'],
    ['ri D:\\wt -Recurse', 'powershell'],
    ['rm D:\\wt -Recurse -Force', 'powershell'],
    ['rm -r D:\\wt', 'powershell'],
    ['del D:\\wt -Recurse', 'powershell'],
    ['erase D:\\wt -rec', 'powershell'],
    ['rd D:\\wt -Recurse', 'powershell'],
    ['rmdir D:\\wt -Recurse -Force', 'powershell'],
    ['powershell -NoProfile -Command "Remove-Item -Recurse -Force D:\\wt"', 'bash'],
    ['pwsh -c "rm D:\\wt -Recurse"', 'bash'],
  ]);
});

test('a plain file delete and a single-junction rmdir pass', async () => {
  await passedAll([
    ['rm file.txt', 'bash'],
    ['rm -f file.txt', 'bash'],
    ['rm -- -r', 'bash'],
    ['rmdir empty-dir', 'bash'],
    ['cmd /c rmdir D:\\wt\\node_modules', 'bash'],
    ['cmd //c rmdir D:\\wt\\packages\\node_modules', 'bash'],
    ['cmd /c rmdir D:\\wt\\node_modules', 'powershell'],
    ['Remove-Item file.txt -Force', 'powershell'],
    ['Remove-Item D:\\wt -Recurse:$false', 'powershell'],
    ['rm file.txt -Force', 'powershell'],
    ['del /q file.txt', 'bash'],
    ['robocopy C:\\src D:\\dst /E', 'bash'],
    ['git rm -r --cached dist', 'bash'],
  ]);
});

test('a kill by image name is refused (taskkill /IM, pkill) and a PID kill passes', async () => {
  await refusedAll('PROCESS_KILL_BY_NAME', /PID you started/, [
    ['taskkill /F /IM node.exe', 'bash'],
    ['taskkill /IM node.exe /F', 'powershell'],
    ['cmd //c "taskkill //F //IM node.exe"', 'bash'],
    ['bash -c "pkill -f vitest"', 'bash'],
    ['pkill node', 'powershell'],
  ]);
  await passedAll([['taskkill /PID 4242', 'bash'], ['taskkill /PID 4242 /F', 'powershell'], ['cmd //c taskkill //PID 4242 //T', 'bash']]);
});

test('orca terminal create is refused with worker-start as the remedy; worker-start passes', async () => {
  await refusedAll('RAW_TERMINAL_CREATE', /orca orchestration worker-start --agent <provider>/, [
    ['orca terminal create --worktree path:D:/wt --command "codex"', 'bash'],
    ['orca.cmd terminal create --command claude', 'powershell'],
    ['cmd /c orca terminal create --command "claude"', 'bash'],
    ['cd D:/wt && orca terminal create', 'bash'],
  ]);
  await passedAll([
    ['orca orchestration worker-start --agent codex --model sol --worktree path:D:/wt --spec "do it" --task-title "sol · repo · task"', 'bash'],
    ['orca orchestration worker-show --worker w1', 'powershell'],
    ['orca terminal read --terminal t1', 'bash'],
    ['orca terminal list', 'bash'],
  ]);
});

test('a headless agent CLI is refused with worker-start as the remedy; interactive or informational calls pass', async () => {
  await refusedAll('AGENT_HEADLESS_LAUNCH', /orca orchestration worker-start --agent <provider>/, [
    ['codex exec "fix the bug"', 'bash'],
    ['codex -m gpt-5 -c model_reasoning_effort=high exec --skip-git-repo-check -', 'bash'],
    ['codex e "task"', 'bash'],
    ['codex.cmd exec "task"', 'powershell'],
    ['npx -y @openai/codex exec "task"', 'bash'],
    ['cmd /c codex exec "task"', 'bash'],
    ['claude -p "review this"', 'bash'],
    ['claude --model opus --print "task"', 'powershell'],
    ['echo task | claude -p', 'bash'],
    ['cursor-agent -p "task"', 'bash'],
    ['devin --print "task"', 'bash'],
    ['gemini -p "task"', 'bash'],
    ['opencode run "task"', 'bash'],
    ['powershell -Command "claude -p task"', 'bash'],
  ]);
  await passedAll([
    ['codex --version', 'bash'],
    ['codex login status', 'bash'],
    ['codex "explain the exec path"', 'bash'],
    ['claude --version', 'bash'],
    ['claude mcp list', 'powershell'],
    ['gemini --version', 'bash'],
    ['opencode models', 'bash'],
  ]);
});

test('text that only mentions a refused command passes: echo, commit message, heredoc', async () => {
  await passedAll([
    ['echo "never rm -rf, git worktree add, taskkill /IM node.exe, orca terminal create or codex exec"', 'bash'],
    ["git commit -m 'guard: refuse rm -rf, rmdir /s, robocopy /MIR, claude -p and orca terminal create' -- scripts/guards/command-guard.mjs", 'bash'],
    ['git commit -m "$(cat <<\'EOF\'\nguard: refuse git worktree remove and rm -rf\n\ncodex exec and claude -p go through worker-start; taskkill /IM is refused\nEOF\n)" -- scripts/guards/command-guard.mjs', 'bash'],
    ['cat > notes.md <<EOF\nrm -rf node_modules\ngit worktree add ../wt\norca terminal create\nEOF\ngit status', 'bash'],
    ['cat <<-"END" > brief.md\n\tcodex exec "task"\n\tRemove-Item -Recurse x\n\tEND', 'bash'],
    ['Write-Output "Remove-Item -Recurse and claude -p are refused"', 'powershell'],
    ["$msg = @'\nrm -rf x and taskkill /IM node.exe\n'@\ngit commit -m $msg -- a.txt", 'powershell'],
    ['grep -rn "rm -rf" scripts', 'bash'],
  ]);
});

test('a heredoc body is not commands, but the command after it is, and an unquoted body still runs its $(...)', async () => {
  assert.deepEqual(simpleCommands('cat <<EOF > f\nrm -rf x\nEOF\nls'), [['cat'], ['ls']]);
  assert.equal((await verdict('cat <<EOF > f\nsafe text\nEOF\nrm -rf x', 'bash'))?.code, 'RECURSIVE_DELETE');
  assert.equal((await verdict('cat <<EOF > f\n$(rm -rf x)\nEOF', 'bash'))?.code, 'RECURSIVE_DELETE');
  assert.equal(await verdict("cat <<'EOF' > f\n$(rm -rf x)\nEOF", 'bash'), null);
});
