// v7-3 lane helper: prove the coverage effect of the owner-path fix. For each owned fe impl record,
// hash the OLD owner dir set and the NEW one with the same code the gate uses (example-ownership.mjs)
// and report how many files the stored proof never covered.
import fs from 'node:fs';
import path from 'node:path';
import {hashOwnedDirs} from '../../../scripts/example-ownership.mjs';

const feRoot = path.resolve(import.meta.dirname, '..', '..', '..', 'examples', 'todo-app-frontend');

// {record, old: owner paths as authored before v7-3, new: owner paths after}
const RECORDS = [
  ['impl.task.todo-app-frontend.task-list',
    ['src/components/blocks/task-list', 'src/features/pages/tasks', 'src/app/tasks'],
    ['src/components/blocks/task-list', 'src/features/pages/tasks', 'src/app/[lang]/tasks']],
  ['impl.notify.todo-app-frontend.preferences',
    ['src/app/notify', 'src/components/notify'],
    ['src/app/[lang]/notify', 'src/components/notify']],
  ['impl.plan.todo-app-frontend.usage',
    ['src/app/plan', 'src/components/plan'],
    ['src/app/[lang]/plan', 'src/components/plan']],
  ['impl.recur.todo-app-frontend.schedule',
    ['src/app/recur', 'src/components/recur'],
    ['src/app/[lang]/recur', 'src/components/recur']],
  ['impl.share.todo-app-frontend.invite-screen',
    ['src/app/tasks/[taskId]/share', 'src/features/pages/share', 'src/components/blocks/share-invite',
      'src/hooks/share', 'src/modules/api', 'src/components/leaves/Link', 'src/hooks/auth'],
    ['src/app/[lang]/tasks/[taskId]/share', 'src/features/pages/share', 'src/components/blocks/share-invite',
      'src/hooks/share', 'src/modules/api', 'src/components/leaves/Link', 'src/hooks/auth']],
  ['impl.audit.todo-app-frontend.privacy',
    ['src/app/audit', 'src/components/audit'],
    ['src/app/[lang]/audit', 'src/components/audit']],
  ['impl.login.todo-app-frontend.sign-in',
    ['src/app/sign-in', 'src/components/login/sign-in'],
    ['src/app/[lang]/sign-in', 'src/app/sign-in', 'src/components/login/sign-in']],
];

const asDirs = paths => paths.map(rel => ({rel, abs: path.join(feRoot, rel)}));
let totalNewlyCovered = 0;
for (const [id, oldPaths, newPaths] of RECORDS) {
  const oldHash = hashOwnedDirs(asDirs(oldPaths));
  const newHash = hashOwnedDirs(asDirs(newPaths));
  const oldFiles = new Set((oldHash?.files ?? []).map(f => f.path));
  const gained = (newHash?.files ?? []).filter(f => !oldFiles.has(f.path));
  const lost = [...oldFiles].filter(p => !(newHash?.files ?? []).some(f => f.path === p));
  totalNewlyCovered += gained.length;
  console.log(`${id}`);
  console.log(`  old: ${oldHash ? `${oldHash.files.length} files, digest ${oldHash.digest.slice(0, 12)}` : 'null (no files)'} `);
  console.log(`  new: ${newHash ? `${newHash.files.length} files, digest ${newHash.digest.slice(0, 12)}` : 'null (no files)'}`);
  console.log(`  +${gained.length} file(s) now inside the proof, -${lost.length}`);
  for (const g of gained) console.log(`      + ${g.path}`);
}
console.log(`\ntotal files newly covered by the corrected digests: ${totalNewlyCovered}`);
