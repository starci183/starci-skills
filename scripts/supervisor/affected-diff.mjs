// affected-diff.mjs - the top-level symbols of a module that changed between two versions of its source.
//
// Both versions are read with the module index (scripts/lib/module-index.mjs) and compared declaration by declaration, by text: a declaration whose
// text differs, one that exists on one side only, and a declaration that uses an import binding that changed (another source, another name) are
// changed. A declaration that uses a changed one is changed too (closed over the file). The symbols are the EXPORTED names that lead to a changed
// declaration, in either version, plus the names whose export mapping changed. A change that is not a declaration - a module-level statement, a side-effect
// import, `export *` - cannot be followed by name: the answer is "unmapped" and the caller applies the file-level rule to the file.
import { exportsOf, usersClosure, usesLocal } from '../lib/module-index.mjs';
import { byCodeUnit } from '../lib/list.mjs';

const union = (...maps) => [...new Set(maps.flatMap((map) => [...map.keys()]))];

function changedDeclarations(base, head) {
  return union(base.decls, head.decls).filter((name) => base.decls.get(name)?.text !== head.decls.get(name)?.text);
}

const bindingOf = (index, local) => {
  const found = index.imports.get(local);
  return found ? `${found.source}\0${found.imported}` : null;
};

function changedImports(base, head) {
  return union(base.imports, head.imports).filter((local) => bindingOf(base, local) !== bindingOf(head, local));
}

const moduleLevelUse = (index, reached) => [...reached].some((name) => usesLocal(index.module, name));

const reexportKey = (entry) => `${entry.exported ?? '*'}\0${entry.source}\0${entry.imported}`;
const reexportSet = (index) => new Map(index.reexports.map((entry) => [reexportKey(entry), entry]));

function changedExportNames(base, head) {
  const names = union(base.exports, head.exports).filter((name) => base.exports.get(name) !== head.exports.get(name));
  const before = reexportSet(base);
  const after = reexportSet(head);
  const moved = [...before, ...after].filter(([key]) => !before.has(key) || !after.has(key)).map(([, entry]) => entry);
  return { names: [...names, ...moved.filter((entry) => entry.exported !== null).map((entry) => entry.exported)], star: moved.some((entry) => entry.exported === null) };
}

/**
 * The changed exported symbols between two module indexes: {symbols: [names, sorted]} or {symbols: null, why} when the change cannot be followed by
 * name (an index is missing, a module-level statement changed or uses a changed name, `export *` changed).
 */
export function changedSymbols(base, head) {
  if (!base || !head) return { symbols: null, why: base ? 'head source does not parse' : 'no base version of the file' };
  if (base.residue.join('\n') !== head.residue.join('\n')) return { symbols: null, why: 'a module-level statement changed' };
  const moved = changedExportNames(base, head);
  if (moved.star) return { symbols: null, why: 'an `export *` changed' };
  const seeds = [...changedDeclarations(base, head), ...changedImports(base, head)];
  const reached = [usersClosure(base, seeds), usersClosure(head, seeds)];
  const used = [base, head].find((index, i) => moduleLevelUse(index, reached[i]));
  if (used) return { symbols: null, why: 'a module-level statement uses a changed name' };
  const symbols = new Set([...moved.names, ...exportsOf(base, reached[0]), ...exportsOf(head, reached[1])]);
  return { symbols: [...symbols].sort(byCodeUnit) };
}
