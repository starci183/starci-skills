// architecture.mjs — the architecture check (docs/architecture-check.md).
//
//   node scripts/checks/architecture.mjs <repo-root> [--config <architecture.json>]
//
// Prints one starci/architecture-check@1 record. Exit 0: ok. Exit 1: violations or errors (a check that
// cannot run is an error, never a pass). Exit 2: bad arguments.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkArchitecture} from './architecture/index.mjs';

export {checkArchitecture};

const USAGE = 'usage: architecture.mjs <repo-root> [--config <architecture.json>]';

export function parseArchitectureArgs(argv) {
  let root = null, configFile;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--config') {
      configFile = argv[++index];
      if (!configFile) throw Error(`--config needs a file; ${USAGE}`);
    } else if (value.startsWith('-') || root !== null) throw Error(`unexpected argument ${value}; ${USAGE}`);
    else root = value;
  }
  if (root === null) throw Error(USAGE);
  return {root, configFile};
}

export function architectureMain(argv, {check = checkArchitecture, write = (text) => process.stdout.write(text), fail = (text) => process.stderr.write(text)} = {}) {
  let parsed;
  try { parsed = parseArchitectureArgs(argv); } catch (error) { fail(`${error.message}\n`); return 2; }
  let report;
  try { report = check({repositoryRoot: path.resolve(parsed.root), configFile: parsed.configFile}); } catch (error) {
    report = {schema: 'starci/architecture-check@1', ok: false, repository: parsed.root, kinds: [], files: 0, violations: [],
      errors: [{ruleId: 'ARCH_EXECUTION_UNAVAILABLE', message: String(error?.message ?? error)}]};
  }
  write(`${JSON.stringify(report, null, 2)}\n`);
  return report?.ok === true ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = architectureMain(process.argv.slice(2));
