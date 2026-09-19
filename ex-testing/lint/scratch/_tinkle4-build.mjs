import fs from 'node:fs';
import path from 'node:path';
import {buildFiles} from '../../../scripts/build-workflows.mjs';
import {publishDist} from '../../../scripts/runtime-compile/stage.mjs';

const root = process.cwd();
const parent = path.resolve(root, 'ex-testing/lint/scratch');
const staging = fs.mkdtempSync(path.join(parent, '_tinkle4-build-'));
if (!staging.startsWith(parent + path.sep)) throw Error('Invalid staging path');
const skip = new Set(['node_modules','.git','.next','dist','coverage','.scannerwork','nul']);
const dirs = ['approvals','bin','cli','contracts','core','docs','examples','execution','hosts','kernel','knowledge','model','models','ops','providers','schemas','scripts','specifications','workflows'];
for (const directory of dirs) fs.cpSync(path.join(root,directory), path.join(staging,directory), {
  recursive:true,
  filter: file => !path.relative(root,file).split(path.sep).some(part => skip.has(part)) && !fs.lstatSync(file).isSymbolicLink()
});
for (const file of ['package.json','config.example.yaml','INDEX.yaml','README.yaml','UPDATE.yaml','SKILL.md']) {
  if (fs.existsSync(path.join(root,file))) fs.copyFileSync(path.join(root,file),path.join(staging,file));
}
console.log(`Clean build source: ${staging}`);
const files = buildFiles(staging);
// Generated output only: all publication targets are contained in this skill root.
for (const relative of ['.dist','.dist.previous','.dist.publish-lock']) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep) || (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink())) throw Error(`Invalid publication target: ${target}`);
}
const published = publishDist(root, files);
const verified = publishDist(root, files, {check:true});
const result = {staging,published,verified,excludedDirectoryNames:[...skip]};
fs.writeFileSync(path.join(root,'ex-testing/lint/_tinkle4-build-result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
