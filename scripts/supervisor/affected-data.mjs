// affected-data.mjs - the specs of a changed file that is not a followable .mjs module: data, documents, generated outputs.
//
// The file-level rule answers a changed yaml file with every importer of every module that reads it, which is hundreds of specs for one rewritten line of a
// registry. The precise rules come first (modules/supervisor/affected-tests.yaml `generated`):
//   - a GENERATED output maps to its generator: the specs named after the generator or importing it, and the specs that read the output as data;
//   - any other data or document file maps to its own checks: the specs that name or read the file as data, and the specs named after the modules that read it
//     (derived mechanically from the sources, affected-select.mjs readsData);
//   - when the change REWRITES lines (removes some), it is read by KEY: the keys and ids on the changed lines that name something (found in few specs) select the
//     specs that mention them; a key every spec mentions (value, kind) is generic and selects nothing by itself.
// A change that adds lines only cannot alter what a consumer already reads, only what the reader validates. A .mjs file never comes here.
import path from 'node:path';
import { addNamedSpecs, specsDirect } from './land-specs.mjs';
import { readsData } from './affected-select.mjs';
import { specsReadingData } from '../lib/spec-deps.mjs';

const posix = (file) => String(file).replaceAll(path.sep, '/');
const prefixed = (file, entry) => (entry.output.endsWith('/') ? file.startsWith(entry.output) : file === entry.output);
const KEY_NAME = /^[A-Za-z][\w.-]*$/;
const NAMING_KEY = /^(?:id|name|choice|kind)$/;
const PLAIN_VALUE = /^[\w.-]{4,}$/;
/** A key found in more specs than this is generic. */
const GENERIC_SPECS = 25;

/** The generator entry ({output, generator}) of a generated file, or undefined. */
export const generatorOf = (file, generated) => generated.find((entry) => prefixed(file, entry));

/** The key and the value of a yaml line (`- id: x`, `{choice: y, ...}`, `key: v`), or null when it is not a key line. */
function keyOfLine(line) {
  let text = line.trim();
  if (text.startsWith('- ')) text = text.slice(2).trim();
  if (text.startsWith('{')) text = text.slice(1).trim();
  const at = text.indexOf(':');
  if (at < 1) return null;
  const key = text.slice(0, at).trim();
  return KEY_NAME.test(key) ? { key, value: text.slice(at + 1).trim() } : null;
}

/** The names on changed lines: yaml keys, and the value of an id/name/choice/kind key. */
export function keysOf(lines) {
  const out = new Set();
  for (const line of lines) {
    const found = keyOfLine(line);
    if (!found) continue;
    if (found.key.length >= 4 || NAMING_KEY.test(found.key)) out.add(found.key);
    const value = found.value.split(',')[0].trim();
    if (NAMING_KEY.test(found.key) && PLAIN_VALUE.test(value)) out.add(value);
  }
  return [...out];
}

function generatedRows({ root, file, entry, specs, names }) {
  const rows = [];
  const direct = specsDirect([entry.generator], { specs, root, symbolsOf: () => null });
  for (const spec of direct.files) rows.push({ spec, why: 'generator-spec', by: `${file} <- ${entry.generator}` });
  for (const spec of specsReadingData(root, [file], names)) rows.push({ spec, why: 'reads-as-data', by: file });
  return rows;
}

function ownCheckRows({ root, file, specs, sources, names }) {
  const rows = [];
  for (const spec of specsReadingData(root, [file], names)) rows.push({ spec, why: 'reads-as-data', by: file });
  for (const reader of sources.filter((source) => readsData(source.text, file)).map((source) => source.file)) {
    const named = new Set();
    addNamedSpecs(reader, specs, named);
    for (const spec of named) rows.push({ spec, why: 'reader-spec', by: `${file} <- ${reader}` });
  }
  return rows;
}

function keyRows({ file, lines, specs }) {
  const rows = [];
  for (const key of keysOf(lines)) {
    const users = specs.filter((spec) => spec.text.includes(key));
    if (users.length > GENERIC_SPECS) continue;
    for (const spec of users) rows.push({ spec: spec.file, why: 'names-the-key', by: `${file}: ${key}` });
  }
  return rows;
}

/**
 * Splits the non-module changed `files`: the rows of the generated and the data files, and the `rest` that keeps the file-level rule (none today: every
 * non-module file has a precise rule). `diffOf(file)` = {added, removed}: the lines the diff adds and removes, `generated` = [{output, generator}].
 */
export function dataRules({ root, files, specs, sources, diffOf, generated }) {
  const names = specs.map((spec) => spec.file);
  const rows = [];
  for (const raw of files) {
    const file = posix(raw);
    const entry = generatorOf(file, generated);
    if (entry) { rows.push(...generatedRows({ root, file, entry, specs, names })); continue; }
    const lines = diffOf(file);
    rows.push(...ownCheckRows({ root, file, specs, sources, names }));
    if (lines.removed.length) rows.push(...keyRows({ file, lines: [...lines.removed, ...lines.added], specs }));
  }
  return { rows, rest: [] };
}
