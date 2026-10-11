// affected-symbols.mjs - the specs a change can break, chosen by the changed SYMBOLS instead of the changed files.
//
// Owner's rule (2026-10-09): if functions A and B changed, the tests to run are the tests related to A and B. The file-level selection (affected-select.mjs)
// answers "every spec that imports a changed file"; a change to one function of a hub file selects the specs of all its other functions too. Here:
//   1. a changed `.mjs` module is compared with its version at the base (affected-diff.mjs): the changed top-level declarations, and the exported names that reach them;
//   2. each changed symbol is followed through the import graph by name (affected-walk.mjs): the specs that import it, and, through the declarations that
//      use it, the specs that import those (callers of callers, to the declared depth);
//   3. the specs that spawn the CLI verb whose handler module the symbol reaches, the spec named after each changed file, the specs that name the file's path
//      outside an import, the invariant specs and the specs that read the file as data are added;
//   4. whatever cannot be followed by name falls back to the FILE-level rule for that file, and the answer counts it: a change that is not a declaration
//      (module-level statement, `export *`, a file that is not a parseable `.mjs` source), a missing base, a depth bound, a module-level use of the symbol.
// A spec the file-level rule selects because it imports a changed file for another, unchanged symbol, or only as a sampled graph dependent, is the only spec dropped,
// and the answer is never larger than the file-level rule's (see affectedBySymbol).
import fs from 'node:fs';
import path from 'node:path';
import { affectedSelection } from './affected-select.mjs';
import { changedSymbols } from './affected-diff.mjs';
import { buildGraph, readModules } from './affected-graph.mjs';
import { walkSymbol } from './affected-walk.mjs';
import { dataRules } from './affected-data.mjs';
import { catalogVerbs, handlerOf, specsRunningVerbs } from './land-cli-specs.mjs';
import { addNamedSpecs, codeOf, needleOf, specsInvariant } from './land-specs.mjs';
import { CATALOG_DIR, loadCatalog } from '../cli/catalog.mjs';
import { indexModule } from '../lib/module-index.mjs';
import { specsDependingOn, specsReadingData } from '../lib/spec-deps.mjs';
import { byCodeUnit } from '../lib/list.mjs';

const posix = (file) => String(file).replaceAll(path.sep, '/');
const isSpecFile = (file) => /^tests\/.*\.spec\.mjs$/.test(file);
// An import or export-from statement names its module by path without using it by that path: its lines are not a mention of the file.
const STATEMENT_START = /^\s*(?:import\s*[{*\w$'"]|export\s*[{*])/;
const STATEMENT_END = /['"}]$/;
const endsStatement = (line) => STATEMENT_END.test(line.trimEnd().replace(/;$/, ''));
function withoutImportStatements(code) {
  const kept = [];
  let inside = false;
  for (const line of code.split(/\r?\n/)) {
    if (inside || STATEMENT_START.test(line)) inside = !endsStatement(line);
    else kept.push(line);
  }
  return kept.join('\n');
}
const mentionCode = (text) => withoutImportStatements(codeOf(text));

/** The change of a module the base has no version of: every export it has is new and followed by name, unless an `export *` hides some. */
function newModuleChange(file, head) {
  if (head.reexports.some((entry) => entry.exported === null)) return { why: 'a new module with `export *`' };
  return { symbols: [...head.exports.keys()].sort(byCodeUnit) };
}

/** Sorts the changed files: the specs among them, the `.mjs` modules followed by symbol ({file, symbols}), and the rest with the reason they are not ({file -> why}). */
function classify({ files, graph, baseSource }) {
  const own = [], followed = [], fallback = new Map();
  for (const file of files) {
    if (isSpecFile(file)) { own.push(file); continue; }
    const head = file.endsWith('.mjs') ? graph.byFile.get(file) : null;
    const baseText = head ? baseSource(file) : null;
    if (!head) { fallback.set(file, 'not a parseable .mjs source in the module graph'); continue; }
    const isNew = baseText === null || baseText === undefined;
    const result = isNew ? newModuleChange(file, head) : changedSymbols(indexModule(baseText), head);
    if (result.symbols) followed.push({ file, symbols: result.symbols });
    else fallback.set(file, result.why);
  }
  return { own, followed, fallback };
}

function cliContext(root, specs, declared) {
  if (!declared && !fs.existsSync(path.join(root, CATALOG_DIR))) return null;
  const verbs = (declared ?? catalogVerbs(loadCatalog(root))).map((entry) => ({ ...entry, handler: handlerOf(root, entry) }));
  return { verbs, specs: specs.map((spec) => ({ file: spec.file, code: codeOf(spec.text) })), cache: new Map() };
}

function cliSpecsFor(root, cli, touched) {
  if (!cli) return [];
  const hit = cli.verbs.filter((entry) => touched.has(entry.handler) || touched.has(entry.dispatcher));
  return specsRunningVerbs({ root, hit, specs: cli.specs, cache: cli.cache });
}

// The spec -> why entries of the rules that name a followed file rather than one of its symbols.
function fileRules({ root, files, specs, mentions }) {
  const out = [];
  const names = specs.map((spec) => spec.file);
  for (const file of files) {
    const named = new Set();
    addNamedSpecs(file, specs, named);
    for (const spec of named) out.push({ spec, why: 'named-after-file', by: file });
    for (const spec of specs) if (mentions.get(spec.file).includes(needleOf(file))) out.push({ spec: spec.file, why: 'names-the-path', by: file });
  }
  for (const spec of specsInvariant(files, { specs })) out.push({ spec, why: 'invariant', by: files.join(', ') });
  for (const spec of specsReadingData(root, files, names)) out.push({ spec, why: 'reads-as-data', by: files.join(', ') });
  return out;
}

function followSymbol({ graph, file, name, depth, cli, root }) {
  const walked = walkSymbol({ graph, isSpec: isSpecFile, file, name, maxDepth: depth });
  const rows = [...walked.specs].map(([spec, hit]) => ({ spec, why: hit.why, by: hit.via.join(' <- ') }));
  for (const spec of cliSpecsFor(root, cli, walked.touched)) if (!walked.specs.has(spec)) rows.push({ spec, why: 'cli-verb', by: `${file}#${name}` });
  return { file, symbol: name, specs: rows, fallbacks: walked.fallbacks };
}

// The files the file-level rule is applied to: the changed ones that could not be followed and the modules the walk gave up on.
function fallbackFiles({ classified, followedRuns, verbCovered = [] }) {
  const files = new Map([...classified.fallback].map(([file, why]) => [file, { file, why, derived: false }]));
  for (const run of followedRuns) {
    for (const [file, why] of run.fallbacks) if (!files.has(file) && !verbCovered.includes(file)) files.set(file, { file, why, derived: true });
  }
  return [...files.values()];
}

function fileLevelRows({ root, fallbacks, specs, sources, symbolsOf, exists, maxFiles, dataRoots, data }) {
  // A changed file keeps the whole file-level rule, smoke set included; a module the walk gave up on keeps its importers, named, spawning and reading specs
  // but not a sample of graph-only dependents, which no symbol relates to.
  const select = (entries, smokeLimit) => affectedSelection({
    root, changed: entries.map((entry) => entry.file), specs, sources, exists, maxFiles, dataRoots, smokeLimit,
    symbolsOf: (file) => (entries.find((entry) => entry.file === file)?.derived ? null : symbolsOf(file)),
  });
  const changed = select(fallbacks.filter((entry) => !entry.derived && !data.handled.has(entry.file)), undefined);
  const reached = select(fallbacks.filter((entry) => entry.derived), 0);
  const helpers = fallbacks.map((entry) => entry.file).filter((file) => file.startsWith('tests/') && !isSpecFile(file));
  const dependents = helpers.length ? specsDependingOn(root, helpers, specs.map((spec) => spec.file)) : [];
  const by = fallbacks.map((entry) => entry.file).join(', ');
  return { picked: changed, data: data.rows, rows: [...[...changed.files, ...reached.files, ...dependents].map((spec) => ({ spec, why: 'file-level-fallback', by })), ...data.rows] };
}

// The precise rules for the changed files that are not followable modules (affected-data.mjs): their rows and the files they handled.
function dataFor({ root, fallbacks, specs, sources, diffOf, generated }) {
  const files = fallbacks.filter((entry) => !entry.derived && !entry.file.endsWith('.mjs')).map((entry) => entry.file);
  const { rows, rest } = dataRules({ root, files, specs, sources, diffOf, generated });
  return { rows, handled: new Set(files.filter((file) => !rest.includes(file))) };
}

const tally = (rows) => rows.reduce((counts, row) => ({ ...counts, [row.why]: (counts[row.why] ?? 0) + 1 }), {});

// Every spec the rules select for `changed`, with its reason: [{spec, why, by}], the walk's runs and the files that fell back.
function walkChange({ root, files, specs, sources, symbolsOf, exists, maxFiles, dataRoots, depth, baseSource, modules, verbs = null, diffOf = () => ({ added: [], removed: [] }), generated = [], verbCovered = [] }) {
  const graph = buildGraph({ root, modules });
  const classified = classify({ files, graph, baseSource });
  const cli = cliContext(root, specs, verbs);
  const runs = classified.followed.flatMap(({ file, symbols }) => symbols.map((name) => followSymbol({ graph, file, name, depth, cli, root })));
  const fallbacks = fallbackFiles({ classified, followedRuns: runs, verbCovered });
  const mentions = new Map(specs.map((spec) => [spec.file, mentionCode(spec.text)]));
  const rules = [
    ...classified.own.map((spec) => ({ spec, why: 'changed-spec', by: spec })),
    ...fileRules({ root, files: classified.followed.map((entry) => entry.file), specs, mentions }),
  ];
  const data = dataFor({ root, fallbacks, specs, sources, diffOf, generated });
  const level = fileLevelRows({ root, fallbacks, specs, sources, symbolsOf, exists, maxFiles, dataRoots, data });
  return { rules, runs, fallbacks, level, rows: [...rules, ...runs.flatMap((run) => run.specs), ...level.rows] };
}

/**
 * The affected specs of `changed` by symbol. `specs` = [{file, text}], `sources` = readSources, `symbolsOf` the land narrowing of a file (used for the files that fall
 * back), `exists(file)`, `maxFiles`, `dataRoots`, `depth` (modules/supervisor/affected-tests.yaml symbolDepth), `baseSource(file)` = the file's text at the diff base or
 * null, `modules` = readModules(root) and `verbs` = [{group, verb, dispatcher}] (the CLI catalog) when absent. Returns affectedSelection's shape plus {mode: 'symbol',
 * symbols: [{file, symbol, specs: [{spec, why, by}]}], fileRules, fallbacks: [{file, why, derived}], reverted, counts}. The answer is never larger than the file-level
 * rule's: the walk may reach specs past the importers (callers of callers), and when it reaches more than that rule selects, that rule stands (`reverted`).
 */
export function affectedBySymbol(options) {
  const { root, changed, specs, sources, symbolsOf, exists, maxFiles, dataRoots } = options;
  const modules = options.modules ?? readModules(root);
  const files = changed.map(posix);
  const walked = walkChange({ ...options, files, modules });
  const selected = [...new Set(walked.rows.map((row) => row.spec))].filter((file) => exists(file)).sort(byCodeUnit);
  const byFile = affectedSelection({ root, changed: files, specs, sources, symbolsOf, exists, maxFiles, dataRoots });
  // The data rules (affected-data.mjs) are precise where the file-level rule is wide or blind, so the bound compares the walk alone and the data rows join either way.
  const dataSpecs = new Set(walked.level.data.map((row) => row.spec));
  const walkOnly = selected.filter((file) => !dataSpecs.has(file));
  const reverted = walkOnly.length > byFile.files.length;
  const chosen = reverted ? [...new Set([...byFile.files, ...[...dataSpecs].filter((file) => exists(file))])].sort(byCodeUnit) : selected;
  const reasons = Object.fromEntries([...new Set(chosen)].map((spec) => [spec, walked.rows.filter((row) => row.spec === spec).slice(0, 3).map((row) => `${row.why}: ${row.by}`)]));
  const symbols = walked.runs.map(({ file, symbol, specs: hit }) => ({ file, symbol, specs: hit }));
  const counts = {
    symbols: symbols.length, specs: chosen.length, walked: selected.length, fileLevel: byFile.files.length, fallbackFiles: walked.fallbacks.length,
    beyondFileLevel: selected.filter((file) => !byFile.files.includes(file)).length, reasons: tally(walked.rows.filter((row) => exists(row.spec))),
  };
  const picked = reverted ? byFile : walked.level.picked;
  return {
    files: chosen, readers: picked.readers, narrowed: picked.narrowed, smoke: picked.smoke, over: chosen.length > maxFiles, maxFiles,
    mode: 'symbol', symbols, fileRules: walked.rules, fallbacks: walked.fallbacks, reverted, counts, reasons,
  };
}

/** The `data` fields of a symbol-level selection (none for the file-level one): the mode, the symbols with their specs and why, the fallbacks and the counts. */
export function symbolData(picked) {
  return picked.mode === 'symbol' ? { mode: 'symbol', symbols: picked.symbols, fileRules: picked.fileRules, fallbacks: picked.fallbacks, counts: picked.counts, reverted: picked.reverted } : { mode: 'file' };
}

/** The report lines of a symbol-level selection: per changed symbol its specs by reason, then the files that fell back to the file-level rule and why. */
export function symbolLines(picked) {
  if (picked.mode !== 'symbol') return [];
  const lines = picked.symbols.map((entry) => `  symbol ${entry.file}#${entry.symbol}: ${entry.specs.length} spec(s) ${JSON.stringify(tally(entry.specs))}`);
  const fallbacks = picked.fallbacks.map((entry) => `  file-level ${entry.file}${entry.derived ? ' (reached)' : ''}: ${entry.why}`);
  const counts = picked.counts;
  const verdict = picked.reverted ? `the walk reached ${counts.walked} specs, more than the file-level rule's ${counts.fileLevel}: the file-level selection stands` : `${counts.specs} by symbol, ${counts.fileLevel} by file`;
  return [...lines, ...fallbacks, `  reasons ${JSON.stringify(counts.reasons)}`, `  ${verdict}`];
}
