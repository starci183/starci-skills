import fs from 'node:fs';
import path from 'node:path';

/** The argument list starting at the `(` at `openIndex`, balanced - quotes skipped so a paren inside
 * a string literal cannot fake the close. */
function readCallArgs(text, openIndex) {
  let depth = 0, quote = null;
  for (let i = openIndex; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote && text[i - 1] !== '\\') { quote = null; } continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '(') depth++;
    if (c === ')' && --depth === 0) return text.slice(openIndex, i + 1);
  }
  return text.slice(openIndex);
}

export const camelOf = kebab => kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

function appendDirectoryOps(dir, ops, skipDirs) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (!entry.isDirectory() || skipDirs.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if ((entry.name === 'queries' || entry.name === 'mutations') && path.basename(dir) === 'graphql') {
      appendOpsForKind(abs, entry.name === 'queries' ? 'query' : 'mutation', ops);
    } else {
      appendDirectoryOps(abs, ops, skipDirs);
    }
  }
}

function appendOpsForKind(abs, kind, ops) {
  const caps = fs.readdirSync(abs).filter(d => fs.statSync(path.join(abs, d)).isDirectory());
  for (const cap of caps) {
    const dirs = fs.readdirSync(path.join(abs, cap))
      .filter(d => fs.statSync(path.join(abs, cap, d)).isDirectory());
    for (const op of dirs) ops.push({kind, cap, dir: op, name: camelOf(op), file: path.join(abs, cap, op)});
  }
}

function decoratedOps(srcRoot, prodFiles) {
  const decorated = [];
  for (const file of prodFiles(srcRoot)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/@(Query|Mutation)\s*\(/g)) {
      const args = readCallArgs(text, m.index + m[0].length - 1);
      const after = text.slice(m.index + m[0].length - 1 + args.length);
      const name = /name:\s*['"](\w+)['"]/.exec(args)?.[1]
        ?? /^\s*(?:async\s+)?(\w+)\s*\(/.exec(after)?.[1];
      if (name) decorated.push({kind: m[1].toLowerCase(), cap: null, dir: null, name, file});
    }
  }
  return decorated;
}

function mergeDecoratedOps(ops, decorated) {
  // a decorated method and an op dir are the same operation when the resolver file sits inside the
  // dir (the wire `name:` wins over the dir's camel - `tasks` is the truth, `list-tasks` the folder),
  // or when kind+name already agree
  for (const item of decorated) {
    const host = ops.find(op => op.kind === item.kind && (item.file.startsWith(op.file + path.sep) || op.name === item.name));
    if (host) { host.name = item.name; host.resolver = item.file; }
    else ops.push(item);
  }
  return ops;
}

/** GraphQL directories and resolver decorators, keeping directory discovery before each root's decorated methods. */
export function gqlOps(repoRoot, {srcRootsOf, prodFiles, skipDirs}) {
  const ops = [];
  const decorated = [];
  for (const srcRoot of srcRootsOf(repoRoot)) {
    appendDirectoryOps(srcRoot, ops, skipDirs);
    decorated.push(...decoratedOps(srcRoot, prodFiles));
  }
  return mergeDecoratedOps(ops, decorated);
}
