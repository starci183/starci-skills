// v8-3 scratch: hand-check a CHANGE_UNRECORDED refusal - show the moved lines and the rev on both sides.
import {spawnSync} from 'node:child_process';

const repoDir = 'D:/Repositories/starci-academy-backend/.claude';
const git = args => {
  const run = spawnSync('git', args, {cwd: repoDir, encoding: 'utf8', maxBuffer: 1 << 28});
  return run.status === 0 ? run.stdout : `(git ${args.join(' ')} failed: ${run.stderr?.trim()})`;
};

const cases = [
  ['d633b841', 'HEAD', 'examples/todo-app-backend/.starciwork/features/login/br/password/sign-in/index.yaml'],
  ['48f94491', 'bae8c18b', 'examples/todo-app-backend/.starciwork/features/login/ui/sign-in/index.yaml'],
  ['aa186d5d', 'd633b841', 'examples/todo-app-backend/.starciwork/features/login/gap/migration-not-applied/index.yaml'],
];

for (const [older, newer, file] of cases) {
  console.log(`\n##### ${older} -> ${newer}  ${file}`);
  const diff = git(['diff', '--no-color', older, newer, '--', file]);
  const changed = diff.split('\n').filter(line => /^[+-]/.test(line) && !/^[+-]{3}/.test(line));
  console.log(changed.slice(0, 14).join('\n'));
  for (const rev of [older, newer]) {
    const show = git(['show', `${rev}:${file}`]);
    const revLine = show.split('\n').find(line => /^\s+rev:/.test(line)) ?? '  (no change.rev)';
    const kindLine = show.split('\n').find(line => /^\s+kind:/.test(line)) ?? '  (no change.kind)';
    console.log(`  ${rev}: ${revLine.trim()} | ${kindLine.trim()}`);
  }
}
