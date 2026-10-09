#!/usr/bin/env node
// check-root-adhoc.mjs - RT_ROOT_ADHOC (R240; part of `npm run check`).
//   runs in the check stage (self-check root-adhoc); --json prints the findings as JSON
//
// Which directory a component reads or writes is decided in ONE module, scripts/lib/roots.mjs: the runtime tree, its state directory, the temp root, the
// invocation directory, the Work directory name, and the order in which two trees that can hold the same record are tried (the workflow tree first, then the
// product's main checkout). Four wrong-tree reads in two days came from a component resolving the directory itself. This check refuses a runtime source file
// that spells one of the two raw inputs of such a resolution more often than the tree the check landed on held it: the process working directory (`process.cwd()`) and the Work
// directory name as a string literal. A file keeps the count it had then and only loses it as it is converted; a new file starts at none.
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings, scopeFilter } from '../lib/check-scan.mjs';
import { trackedSources } from './lib/tracked-sources.mjs';
import { fileReader } from './lib/released-state.mjs';
import { log } from '../api/git/log.mjs';

export const CODE = 'RT_ROOT_ADHOC';
export const OWNER_FILE = 'scripts/lib/roots.mjs';
export const SELF_FILES = Object.freeze(['scripts/checks/check-root-adhoc.mjs']);
const inScope = scopeFilter({ scope: /^(?:scripts|engine)\//, ext: /\.(?:mjs|cjs|js)$/, out: /node_modules\/|\/dist\/|\.spec\./, exclude: [OWNER_FILE, ...SELF_FILES] });
/** Scanners that skip or recognise the Work directory by its name are not resolvers of it. */
const SCANNER = /^scripts\/(?:checks|hfs|gates)\//;
const KINDS = Object.freeze([
  { kind: 'invocation-dir', re: /\bprocess\.cwd\(\)/g, say: 'spells process.cwd(); the invocation directory is invocationDir() in scripts/lib/roots.mjs', applies: () => true },
  { kind: 'work-dir', re: /['"`]\.starciwork['"`]/g, say: 'spells the Work directory name; WORK_DIR_NAME, workDirsInOrder, workDirHolding and workRecordPath in scripts/lib/roots.mjs resolve it', applies: (rel) => !SCANNER.test(rel) },
]);
const withoutComments = (text) => String(text ?? '').replace(/^[ \t]*(?:\/\/|\/?\*).*$/gm, '');
const countOf = (kind, rel, text) => (kind.applies(rel) ? (withoutComments(text).match(kind.re) ?? []).length : 0);

/**
 * The findings over `files` ({relativePath: text}) against `released` ({relativePath: text of the landing parent, or null}): a file that spells an input
 * more often than the landing parent held it. Pure.
 */
export function rootAdhocFindings(files, released) {
  return Object.entries(files).filter(([rel]) => inScope(rel)).flatMap(([rel, text]) => KINDS.flatMap((kind) => {
    const now = countOf(kind, rel, text);
    const before = countOf(kind, rel, released[rel]);
    return now > before
      ? [{ code: CODE, path: rel, message: `${rel} ${kind.say} (${now} now, ${before} when the check landed); a path built from it outside the root module reads or writes the wrong tree when two trees hold the record` }]
      : [];
  }));
}

/** The parent of the commit that added this check: the tree whose counts a file may keep and not exceed. Null when the history does not hold it. */
function landingBase(root) {
  const added = log(['-1', '--format=%H', '--diff-filter=A', '--', SELF_FILES[0]], { cwd: root });
  const sha = added.status === 0 ? added.stdout.trim() : '';
  return sha ? `${sha}^` : null;
}

/** Run the check on the runtime at `root`: against the tree before the check landed; a history that does not hold the landing commit has no baseline and passes. */
export function checkRootAdhoc(root = skillRoot) {
  const base = landingBase(root);
  if (!base) return [];
  const files = trackedSources(root, inScope);
  const read = fileReader(root);
  // Only a file that spells an input now has a count to compare: the landing parent is read for those alone.
  const spelling = Object.keys(files).filter((rel) => KINDS.some((kind) => countOf(kind, rel, files[rel]) > 0));
  return rootAdhocFindings(files, Object.fromEntries(spelling.map((rel) => [rel, read(base, rel)])));
}

if (isMain(import.meta.url)) process.exit(printFindings(checkRootAdhoc(), 'OK: no runtime file spells a root input more often than when the check landed.'));
