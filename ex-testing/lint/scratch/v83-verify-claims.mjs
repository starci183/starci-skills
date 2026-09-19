// v8-3 scratch verifier 2: hand-check three of the check's claims.
import {spawnSync} from 'node:child_process';
import {parseYaml} from '../../../core/yaml.mjs';

const repoDir = 'D:/Repositories/starci-academy-backend/.claude';
const git = (args, input) => {
  const run = spawnSync('git', args, {cwd: repoDir, encoding: 'utf8', maxBuffer: 1 << 28, input});
  return {status: run.status, out: run.stdout ?? '', err: (run.stderr ?? '').trim()};
};

console.log('=== 1. is accb7b04 an ancestor of dfb7c74e (the REV_NOT_MONOTONIC ordering claim)? ===');
for (const [a, b] of [['accb7b04', 'dfb7c74e'], ['dfb7c74e', 'accb7b04']]) {
  const run = git(['merge-base', '--is-ancestor', a, b]);
  console.log(`  ${a} ancestor of ${b}: ${run.status === 0 ? 'YES' : 'NO'}${run.err ? ' (' + run.err + ')' : ''}`);
}
for (const sha of ['accb7b04', 'dfb7c74e']) {
  const run = git(['log', '-1', '--format=%h %ci %s', sha]);
  console.log('  ' + run.out.trim().slice(0, 140));
}
// and is accb7b04 on the first-parent mainline at all?
const fp = git(['rev-list', '--first-parent', '--max-count=400', 'HEAD']);
const mainline = new Set(fp.out.split('\n').map(line => line.slice(0, 8)));
for (const sha of ['accb7b04', 'dfb7c74e', '2aba05ab']) {
  console.log(`  ${sha} on first-parent mainline: ${mainline.has(sha) ? 'YES' : 'NO'}`);
}

console.log('\n=== 2. what actually moved in audit/fr/erasure/complete between HEAD and the worktree? ===');
const target = 'examples/todo-app-backend/.starciwork/features/audit/fr/erasure/complete/index.yaml';
const diff = git(['diff', '--no-color', 'HEAD', '--', target]);
console.log(diff.out.split('\n').filter(line => /^[+-]/.test(line) && !/^[+-]{3}/.test(line)).slice(0, 26).join('\n'));

console.log('\n=== 3. what moved in audit/gap/emitted-events between aa186d5d and e9669075 (rev stayed 1)? ===');
const gapPath = 'examples/todo-app-backend/.starciwork/features/audit/gap/emitted-events/index.yaml';
const gapDiff = git(['diff', '--no-color', 'aa186d5d', 'e9669075', '--', gapPath]);
console.log(gapDiff.out.split('\n').filter(line => /^[+-]/.test(line) && !/^[+-]{3}/.test(line)).slice(0, 24).join('\n'));
const specs = `aa186d5d:${gapPath}\ne9669075:${gapPath}\n`;
const blobs = git(['cat-file', '--batch'], specs);
for (const line of blobs.out.split('\n')) {
  if (/^\s*rev:|^\s*kind:/.test(line)) console.log('  ' + line.trim());
}
void parseYaml;
