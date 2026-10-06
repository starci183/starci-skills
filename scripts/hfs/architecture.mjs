// architecture.mjs — the architecture check (docs/architecture.md).
//
//   starci runtime architecture <repo-root> [--base <commit>]
//
// Prints one starci/architecture-check@1 record. Exit 0: ok. Exit 1: violations or errors (a check that
// cannot run is an error, never a pass). Exit 2: bad arguments.
import path from 'node:path';
import {checkArchitecture} from './architecture/index.mjs';
import { isMain } from '../lib/is-main.mjs';

export {checkArchitecture};

const USAGE = 'usage: starci runtime architecture <repo-root> [--base <commit>]';

function parseArchitectureArgs(argv) {
  let root = null, base;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--base') {
      base = argv[++index];
      if (!base) throw new Error(`--base needs a commit; ${USAGE}`);
    } else if (value.startsWith('-') || root !== null) throw new Error(`unexpected argument ${value}; ${USAGE}`);
    else root = value;
  }
  if (root === null) throw new Error(USAGE);
  return {root, base};
}

export function architectureMain(argv, {check = checkArchitecture, write = (text) => process.stdout.write(text), fail = (text) => process.stderr.write(text)} = {}) {
  let parsed;
  try { parsed = parseArchitectureArgs(argv); } catch (error) { fail(`${error.message}\n`); return 2; }
  let report;
  try { report = check({repositoryRoot: path.resolve(parsed.root), base: parsed.base}); } catch (error) {
    report = {schema: 'starci/architecture-check@1', ok: false, repository: parsed.root, kinds: [], files: 0, violations: [],
      errors: [{ruleId: 'ARCH_EXECUTION_UNAVAILABLE', message: String(error?.message ?? error)}]};
  }
  write(`${JSON.stringify(report, null, 2)}\n`);
  return report?.ok === true ? 0 : 1;
}

if (isMain(import.meta.url)) process.exitCode = architectureMain(process.argv.slice(2));
