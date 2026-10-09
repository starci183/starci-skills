// A throwaway git repository holding the shipped revision-scope table and the few files its self-check reads, with a commit helper.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { skillRoot } from '../../engine/runtime-root.mjs';

const SHIPPED = ['modules/kernel/revision-scope.yaml', 'modules/kernel/roles.yaml', 'modules/kernel/kernel-prompt.md', 'modules/supervisor/supervisor-prompt.md',
  'modules/supervisor/supervise.yaml', 'scripts/kernel/start-workflow.mjs', 'scripts/supervisor/start-supervisor.mjs'];

/** A repository at a temp dir with `files` (the shipped table and prompts, plus the engine entry); {root, write, commit, git, base}. */
export function revisionRepo(t, { shipped = SHIPPED, files = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-rev-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', '-c', 'core.autocrlf=false', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  git('init', '-q');
  for (const file of shipped) write(file, fs.readFileSync(path.join(skillRoot, file), 'utf8'));
  write('scripts/reconciler/engine.mjs', "import { loaded } from '../lib/loaded.mjs';\nexport default loaded;\n");
  write('scripts/lib/loaded.mjs', 'export const loaded = 1;\n');
  for (const [file, text] of Object.entries(files)) write(file, text);
  const commit = (message, changes = {}) => {
    for (const [file, text] of Object.entries(changes)) {
      if (text === null) fs.rmSync(path.join(root, file), { force: true });
      else write(file, text);
    }
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  return { root, write, commit, git, base: commit('base') };
}
