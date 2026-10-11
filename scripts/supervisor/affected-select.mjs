// affected-select.mjs - the specs a change can break: the land gate's `touching` selection (land-specs.mjs, land-cli-specs.mjs, the invariant
// specs), widened by the DATA READERS of a changed data file.
//
// A yaml registry or a knowledge file is imported by nothing, so the import graph never reaches the specs that depend on it. A runtime module
// that names the changed file (its full path, or its file name together with its directory name) reads it; each such reader joins the change
// as a file whose exports are unknown to the diff (no symbol narrowing: the readers' own spec and importers count, hub importers fall to the
// smoke set), so the specs behind the reader are selected, not only the specs that name the data path themselves.
import fs from 'node:fs';
import path from 'node:path';
import { touchingSelection } from './land-specs.mjs';
import { walkFiles } from '../lib/walk.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { escapeRegExp } from '../lib/regex.mjs';

const CODE_FILE = /\.(?:[cm]?js|ts)$/i;
const SOURCE_ROOTS = ['scripts', 'engine', 'packages'];
const posix = (file) => String(file).replaceAll(path.sep, '/');
const QUOTE = /["'\x60]/.source;
const quoted = (name) => new RegExp(QUOTE + escapeRegExp(name) + QUOTE);

/** The changed files that are shared data under one of `roots` (neither code nor a spec): only a reader connects them to a spec. A root manifest such as package.json is read by half the runtime and is outside the roots. */
export const dataFilesOf = (changed, roots) => changed.map(posix).filter((file) => !CODE_FILE.test(file) && roots.some((root) => file.startsWith(`${root}/`)));

/** Whether `text` reads the data file `rel` by its path, or by its file name with its directory name as a separate segment. */
export function readsData(text, rel) {
  if (text.includes(rel)) return true;
  const parts = rel.split('/');
  return parts.length >= 2 && quoted(parts.at(-1)).test(text) && quoted(parts.at(-2)).test(text);
}

/** The runtime source files ([{file, text}] under scripts, engine, packages; no node_modules) that read one of `dataFiles`: [{file, reads:[data files]}]. */
function dataReaders({ dataFiles, sources }) {
  return sources.map(({ file, text }) => ({ file, reads: dataFiles.filter((rel) => readsData(text, rel)) })).filter((entry) => entry.reads.length);
}

/** The runtime source files of `root` with their text, for dataReaders. */
export function readSources(root) {
  return SOURCE_ROOTS.flatMap((dir) => walkFiles(path.join(root, dir), { sorted: true, filter: (name) => CODE_FILE.test(name), exclude: (name) => name === 'node_modules' }))
    .map((abs) => ({ file: posix(path.relative(root, abs)), text: readText(abs) }));
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

/**
 * The affected specs of `changed`. `specs` = [{file, text}], `sources` = [{file, text}] (readSources), `symbolsOf(file)` = the land narrowing of a
 * changed file, `exists(file)` filters deleted specs, `maxFiles` the declared bound, `smokeLimit` (the land gate's smoke bound when absent), `dataRoots` the trees whose files readers are looked up for. Returns {files, readers, narrowed, smoke, over, maxFiles}.
 */
export function affectedSelection({ root, changed, specs, sources, symbolsOf, exists, maxFiles, dataRoots, smokeLimit }) {
  const files = changed.map(posix);
  const readers = dataReaders({ dataFiles: dataFilesOf(files, dataRoots), sources }).filter((entry) => !files.includes(entry.file));
  const readerFiles = new Set(readers.map((entry) => entry.file));
  const picked = touchingSelection([...files, ...readerFiles], {
    specs, root, smokeLimit,
    symbolsOf: (file) => (readerFiles.has(file) ? { symbols: [] } : symbolsOf(file)),
  });
  const selected = [...new Set(picked.files)].filter((file) => exists(file)).sort(byCodeUnit);
  return { files: selected, readers, narrowed: picked.narrowed, smoke: picked.smoke, over: selected.length > maxFiles, maxFiles };
}
