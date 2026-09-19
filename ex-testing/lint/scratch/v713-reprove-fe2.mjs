// v7-13 round 2: re-bind evidence for the four fe impls whose records flipped done -> todo after
// round 1 ran (recordDigest binds index.yaml bytes; the flips moved them).
import {spawnSync} from 'node:child_process';

const CLAUDE = 'D:/Repositories/starci-academy-backend/.claude';
const WORK = 'examples/todo-app-backend/.starciwork';
const FE = 'examples/todo-app-frontend';

const jobs = [
  {record: 'impl.plan.todo-app-frontend.usage', assert: [
    ['typecheck', 'npx tsc --noEmit'],
    ['unit', 'npx vitest run'],
    ['lint', 'npx eslint .'],
    ['build', 'npx next build'],
  ]},
  {record: 'impl.recur.todo-app-frontend.schedule', assert: [
    ['typecheck', 'npx tsc --noEmit'],
    ['vitest-suite-green', 'npx vitest run'],
    ['build', 'npm run build'],
  ]},
  {record: 'impl.notify.todo-app-frontend.preferences', assert: [
    ['typecheck', 'npx tsc --noEmit'],
    ['unit-tests', 'npx vitest run'],
    ['lint', 'npx eslint src/'],
    ['build', 'npm run build'],
    ['architecture', 'node ../../cli/main.mjs architecture check . --config architecture.json'],
    ['rendered-captures', `node -e "const fs=require('fs'),p='../todo-app-backend/.starciwork/features/notify/impl/todo-app-frontend/preferences/assets/';const states=['subscribed','loading','unsubscribed','refused','saving'];const vps=['desktop-1280','mobile-390'];let ok=true;for(const s of states)for(const v of vps){for(const ext of ['png','html']){const f=p+'preferences-'+s+'-'+v+'.'+ext;if(!fs.existsSync(f)||fs.statSync(f).size<1000){ok=false;console.log('missing/small',f);}}}for(const v of vps){for(const ext of ['png','html']){const f=p+'unsubscribe-link-unsubscribed-'+v+'.'+ext;if(!fs.existsSync(f)||fs.statSync(f).size<1000){ok=false;console.log('missing/small',f);}}}const refused=fs.readFileSync(p+'preferences-refused-desktop-1280.html','utf8');if(!refused.includes('We could')){ok=false;console.log('refused markup lacks refusal sentence');}if(!ok)process.exit(1);console.log('12 state captures verified');"`],
  ]},
  {record: 'impl.share.todo-app-frontend.invite-screen', assert: [
    ['typecheck', 'npx tsc --noEmit'],
    ['unit-tests', 'npx vitest run'],
    ['lint', 'npx eslint .'],
    ['architecture', 'node ../../cli/main.mjs architecture check . --config architecture.json'],
    ['scoped-lint', `node -e "require('fs').rmSync('.next',{recursive:true,force:true})" && node ../../scripts/check-scoped-lint.mjs --profile next --root . --architecture-config architecture.json --all`],
    ['captures', 'node verify-captures.mjs assets'],
    ['render-entity-list-in-card', 'node verify-captures.mjs entity-list'],
    ['render-primary-absent', 'node verify-captures.mjs primary'],
    ['render-palette-off-brand', 'node verify-captures.mjs palette'],
    ['build', 'npx next build'],
  ]},
];

for (const job of jobs) {
  const args = ['scripts/example-evidence.mjs', '--work', WORK, '--record', job.record,
    '--cwd', FE,
    ...job.assert.flatMap(([id, command]) => ['--assert', `${id}=${command}`])];
  console.log(`\n### ${job.record}`);
  const run = spawnSync('node', args, {cwd: CLAUDE, encoding: 'utf8', timeout: 1800000});
  const tail = (run.stdout || '') + (run.stderr || '');
  console.log(tail.trim().split('\n').slice(-8).join('\n'));
  console.log(`exit=${run.status} ${run.error ? run.error.message : ''}`);
}
console.log('\nDONE');
