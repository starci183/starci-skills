// check-scan.mjs - the scaffolding every `scripts/checks/check-*.mjs` scan shares: the --help/--json/--root argument
// loop, the findings printer, the line of an offset, the history paths a scan never reads and the generated roots of the
// runtime manifest. One definition here; a check imports it and owns only its law.
import fs from 'node:fs';
import path from 'node:path';
import { readYamlFile } from './read-yaml.mjs';

/** 1-based line number of the character at `offset` in `text`. */
export const lineOf = (text, offset) => {
  let line = 1;
  for (let i = 0; i < offset; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
};

/** Never scanned: a benchmark finding, a changelog and a .starciwork record. */
export const isHistoryPath = (rel) => rel.startsWith('benchmark/')
  || /(^|\/)CHANGELOG[^/]*\.md$/i.test(rel) || /(^|\/)\.starciwork\//.test(rel);

/** The generated copy roots of the runtime (ruleParams.runtime.generated), each with a trailing slash. */
export const generatedRootsOf = (root) => {
  const file = path.join(root, 'knowledge', 'hfs', 'runtime-slots.yaml');
  if (!fs.existsSync(file)) return [];
  return (readYamlFile(file)?.ruleParams?.runtime?.generated ?? []).map((g) => `${String(g.root).replace(/\/$/, '')}/`);
};

/**
 * The `--help | -h`, `--json` and `--root <dir>` loop of a scan's main: `{ root, json }`, or the ready result
 * `{ exitCode, text }` for a help request or a bad argument. `name` is the check's file stem, `help` its usage text.
 */
export function parseCheckArgs(argv, { name, help, root }) {
  let json = false;
  let scanRoot = root;
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--help' || key === '-h') return { exitCode: 0, text: `${help}\n` };
    if (key === '--json') { json = true; continue; }
    if (key === '--root') {
      const value = argv[i + 1];
      i += 1;
      if (value === undefined) return { exitCode: 2, text: `${name}: --root needs a value\n` };
      scanRoot = path.resolve(value);
      continue;
    }
    return { exitCode: 2, text: `${name}: unknown argument ${key}\n${help}\n` };
  }
  return { root: scanRoot, json };
}

/**
 * Prints a findings list the way every findings check does (`--json` or one `CODE message` line each, `okMessage` when
 * clean) and returns the exit code.
 */
export function printFindings(findings, okMessage, { json = process.argv.includes('--json') } = {}) {
  if (json) console.log(JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  else {
    for (const f of findings) console.error(`${f.code} ${f.message}`);
    if (!findings.length) console.log(okMessage);
  }
  return findings.length ? 1 : 0;
}

/** A scan's scope predicate: `rel` is under `scope`, has an `ext` extension, matches no `out` pattern and is not one of the `exclude` files. */
export const scopeFilter = ({ scope, ext, out, exclude = [] }) => (rel) => scope.test(rel) && ext.test(rel) && !out.test(rel) && !exclude.includes(rel);

/** The `{ exitCode, text }` of a report-style scan main: the JSON report, the clean line, or a headline plus one row per hit. */
function reportResult(report, { json, okText, headline, rows }) {
  if (json) return { exitCode: report.ok ? 0 : 1, text: `${JSON.stringify(report, null, 2)}\n` };
  if (report.ok) return { exitCode: 0, text: `${okText}\n` };
  return { exitCode: 1, text: `${[headline, ...rows].join('\n')}\n` };
}

/**
 * The whole main of a report-style scan: parse the arguments, run `scan(root)` and render its report through
 * `describe(report)` -> { okText, headline, rows }.
 */
export function runReportMain(argv, { name, help, root, scan, describe }) {
  const parsed = parseCheckArgs(argv, { name, help, root });
  if (parsed.exitCode !== undefined) return parsed;
  const report = scan(parsed.root);
  return reportResult(report, { json: parsed.json, ...describe(report) });
}
