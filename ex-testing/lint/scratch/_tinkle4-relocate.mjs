import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
if (path.basename(root) !== '.claude' || !fs.existsSync(path.join(root, 'scripts/runtime-modules.txt'))) throw Error('Run from the intended .claude workspace');
const slash = value => value.replaceAll('\\', '/');
const inside = relative => {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep)) throw Error(`Outside workspace: ${relative}`);
  return absolute;
};
const moves = new Map();
for (const entry of fs.readdirSync(inside('scripts'), {withFileTypes:true})) {
  if (entry.isFile() && /^check-.*\.mjs$/.test(entry.name)) moves.set(`scripts/${entry.name}`, `scripts/checks/${entry.name}`);
}
function inventory(directory) {
  for (const entry of fs.readdirSync(inside(directory), {withFileTypes:true})) {
    const name = `${directory}/${entry.name}`;
    if (entry.isDirectory()) inventory(name);
    else moves.set(name, `scripts/${name}`);
  }
}
inventory('checks');
for (const [from,to] of moves) if (fs.existsSync(inside(to))) throw Error(`Destination exists: ${from} -> ${to}`);
const relocate = relative => moves.get(relative) ?? (relative === 'checks' || relative.startsWith('checks/') ? `scripts/${relative}` : relative);
const skipped = new Set(['.git','.dist','node_modules','ex-testing','.scannerwork','.next','dist','coverage','.turbo','runtime','worktrees']);
const candidates = [];
function collect(directory = '') {
  for (const entry of fs.readdirSync(path.join(root, directory), {withFileTypes:true})) {
    if (entry.isSymbolicLink() || skipped.has(entry.name) || entry.name === 'nul') continue;
    const name = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.isDirectory()) collect(name);
    else if (/\.(?:mjs|cjs|js|ts|tsx|md|yaml|yml|json|txt)$/.test(name) && !name.endsWith('package-lock.json')) {
      // Preserve authored example records and their historical evidence bytes.
      if (name.startsWith('examples/') && !/\.(?:mjs|md)$/.test(name)) continue;
      candidates.push(name);
    }
  }
}
collect();
const edits = [];
for (const oldName of candidates) {
  const newName = relocate(oldName);
  const before = fs.readFileSync(inside(oldName), 'utf8');
  let after = before;
  if (/\.(?:mjs|cjs|js|ts|tsx)$/.test(oldName)) {
    after = after.replace(/(['"`])(\.{1,2}\/[^'"`\r\n]+)\1/g, (whole, quote, value) => {
      const oldTarget = path.posix.normalize(path.posix.join(path.posix.dirname(oldName), value));
      const newTarget = relocate(oldTarget);
      if (newTarget === oldTarget && newName === oldName) return whole;
      if (newTarget === oldTarget && !fs.existsSync(path.join(root, oldTarget))) return whole;
      let next = path.posix.relative(path.posix.dirname(newName), newTarget);
      if (!next.startsWith('.')) next = './' + next;
      return quote + next + quote;
    });
  }
  if (moves.has(oldName) && oldName.startsWith('scripts/')) {
    after = after.replace(/(path\.resolve\(path\.dirname\(fileURLToPath\(import\.meta\.url\)\),\s*)'\.\.'(\))/g, "$1'../..'$2");
  }
  after = after.replace(/scripts\/check-/g, 'scripts/checks/check-');
  after = after.replace(/(?<!scripts\/)checks\/(?=(?:acceptance|architecture|brand|proof|render|stacks|work-change|work-layout)\.mjs|(?:architecture|code-patterns)\/|\*\*)/g, 'scripts/checks/');
  if (oldName === 'scripts/runtime-modules.txt') after = after.replace(/^checks\//gm, 'scripts/checks/');
  if (oldName === 'kernel/audit.mjs') after = after.replaceAll('scripts\\/check-', 'scripts\\/(?:checks\\/)?check-');
  if (oldName === 'INDEX.yaml') after = after.replace(/^  checks:.*\r?\n/m, '').replace('  scripts: Build tooling', '  scripts: Build tooling; scripts/checks/ owns verification and scripts/route/ owns selection');
  if (oldName === 'package.json') after = after.replace(/^    "checks\/",\r?\n/m, '');
  if (['tests/build-entry.spec.mjs','tests/application-stacks-integration.spec.mjs','tests/backend-handoff.spec.mjs'].includes(oldName)) after = after.replace(/'checks',/g, '');
  // Root-based path.join operands are not module-relative import specifiers.
  if (/\.(?:mjs|cjs|js|ts|tsx)$/.test(oldName)) {
    after = after.replace(/(['"])scripts\1,(\s*)(['"])check-/g, '$1scripts$1,$2$1checks$1,$2$3check-');
    after = after.replace(/(['"])checks\1,(\s*)(['"])(acceptance|architecture|brand|proof|render|stacks|work-change|work-layout)\.mjs\3/g, '$1scripts$1,$2$1checks$1,$2$3$4.mjs$3');
  }
  if (oldName === 'tests/stacks.spec.mjs') after = after.replaceAll("path.join(dist,'checks'", "path.join(dist,'scripts','checks'").replaceAll("path.join(payload,'.dist','checks'", "path.join(payload,'.dist','scripts','checks'");
  if (after !== before) edits.push({oldName,newName,before,after});
}
// Retain exact pre-edit source for a reviewable task-only diff in this dirty shared tree.
const backup = inside('ex-testing/lint/scratch/_tinkle4-before');
for (const edit of edits) {
  const file = path.join(backup, edit.oldName);
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, edit.before);
}
fs.mkdirSync(inside('scripts/checks'), {recursive:true});
for (const [from,to] of moves) {
  if (!from.startsWith('scripts/')) continue;
  fs.renameSync(inside(from), inside(to));
}
// Move architecture/ and code-patterns/ whole, preserving every nested file.
for (const entry of fs.readdirSync(inside('checks'))) fs.renameSync(inside(`checks/${entry}`), inside(`scripts/checks/${entry}`));
fs.rmdirSync(inside('checks'));
for (const edit of edits) fs.writeFileSync(inside(edit.newName), edit.after);
const report = {moved:[...moves].map(([from,to])=>({from,to})), edited:edits.map(({oldName,newName})=>({from:oldName,to:newName}))};
fs.writeFileSync(inside('ex-testing/lint/_tinkle4-migration.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({moved:report.moved.length,edited:report.edited.length,files:report.edited.map(e=>e.to)},null,2));
