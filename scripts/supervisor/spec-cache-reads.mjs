// spec-cache-reads.mjs - the files a module reads as DATA, from its source text: the part of a spec's cache key that imports cannot see.
// The classes (the same the affected selector knows, scripts/supervisor/affected-select.mjs and affected-data.mjs):
//   named file      a string literal that names a tracked file (its path, or its name beside a literal of its folder: readsData), code and data alike
//   sibling folder  a literal that names a folder beside the module ('./fixtures'): every file below it
//   named folder    a repository-relative literal of two or more segments that is a folder ('modules/cli/commands'): every file below it
//   named tree      a path a test names as a tree of data (spec-deps.mjs dataRefsOf, e.g. 'examples/<app>/be'): every file below it
// A read this cannot name (a path computed at run time) is the reason a module also carries a marker (spec-cache-markers.mjs) that widens the key.
import path from 'node:path';
import { readsData } from './affected-select.mjs';
import { dataRefsOf } from '../lib/spec-deps.mjs';

const LITERAL = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
const MIN_TOKEN = 3;
const posix = (file) => String(file).replaceAll(path.sep, '/');

/** The string literals of `text` (static pieces of a template literal included), leading `./` and `../` removed. */
export function literalsOf(text) {
  const out = new Set();
  for (const match of String(text).matchAll(LITERAL)) {
    for (const piece of match[2].split(/\$\{[^}]*\}/)) {
      const token = piece.replace(/^(?:\.{1,2}\/)+/, '');
      if (token.length >= MIN_TOKEN && !/\s/.test(token)) out.add(token);
    }
  }
  return [...out];
}

/** An index of a tracked file listing: {byName: Map file name -> [rel], folders: Set of every folder that holds a file, under: (folder) -> [rel]}. */
export function fileIndex(rels) {
  const byName = new Map();
  const folders = new Set();
  const tree = new Map();
  for (const rel of rels) {
    const name = rel.slice(rel.lastIndexOf('/') + 1);
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(rel);
    for (let at = rel.lastIndexOf('/'); at > 0; at = rel.lastIndexOf('/', at - 1)) {
      const folder = rel.slice(0, at);
      folders.add(folder);
      if (!tree.has(folder)) tree.set(folder, []);
      tree.get(folder).push(rel);
    }
  }
  return { byName, folders, under: (folder) => tree.get(folder) ?? [] };
}

const nameOf = (token) => token.slice(token.lastIndexOf('/') + 1);

function namedFiles({ file, text, token, index }) {
  const hits = [];
  for (const rel of index.byName.get(nameOf(token)) ?? []) {
    if (rel !== file && (rel === token || rel.endsWith(`/${token}`) || readsData(text, rel))) hits.push(rel);
  }
  return hits;
}

function namedFolders({ file, token, index }) {
  const beside = path.posix.join(path.posix.dirname(file), token);
  const hits = [];
  if (index.folders.has(beside)) hits.push(...index.under(beside));
  if (token.includes('/') && index.folders.has(token)) hits.push(...index.under(token));
  return hits;
}

/** The tracked files that module `file` (repository-relative) reads as data, from its `text`: [rel]. `index` = fileIndex(tracked files). */
export function readsOf({ file, text, index }) {
  const found = new Set();
  for (const token of literalsOf(text)) {
    for (const rel of namedFiles({ file, text, token, index })) found.add(rel);
    for (const rel of namedFolders({ file, token, index })) found.add(rel);
  }
  for (const tree of dataRefsOf(text)) for (const rel of index.under(tree)) found.add(rel);
  return [...found].map(posix);
}
