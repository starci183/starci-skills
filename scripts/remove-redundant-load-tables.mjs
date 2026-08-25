import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const write = process.argv.includes('--write');

const excludedDirectories = new Set(['.git', '.worktrees', 'node_modules', 'worktrees']);

function markdownFiles(parent) {
  return fs.readdirSync(parent, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) return [];
    const target = path.join(parent, entry.name);
    if (entry.isDirectory()) return markdownFiles(target);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.md') ? [target] : [];
  });
}

function removeLoadsSections(source) {
  const lines = source.replaceAll('\r\n', '\n').split('\n');

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (!/^## LOADS\s*$/.test(lines[index])) continue;
    let end = index + 1;
    while (end < lines.length && !/^##\s+/.test(lines[end])) end += 1;
    let start = index;
    while (start > 0 && lines[start - 1] === '') start -= 1;
    lines.splice(start, end - start);
    if (start > 0 && start < lines.length && lines[start - 1] !== '' && lines[start] !== '') {
      lines.splice(start, 0, '');
    }
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

const files = markdownFiles(root);
const changed = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const normalized = removeLoadsSections(source);
  if (normalized === source) continue;
  changed.push(path.relative(root, file).replaceAll('\\', '/'));
  if (write) fs.writeFileSync(file, normalized);
}

if (!write && changed.length > 0) {
  throw new Error(`redundant LOADS sections remain:\n${changed.join('\n')}`);
}

console.log(`${write ? 'Removed' : 'Verified'} redundant LOADS sections across ${files.length} repository Markdown documents${write ? ` (${changed.length} changed)` : ''}.`);
