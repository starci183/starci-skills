// hfs report: the ONE way the findings of the HFS canon reach Sonar (contract change hfs-sonar-import).
//
//   hfs check --sonar <file>            writes every error-level finding of the check (repository, managed files and the whole
//                                       architecture machine) as a Sonar Generic Issue Import document (SonarQube 10.3+ format:
//                                       `{ rules, issues }`), engineId `starci-hfs`, rule id = the finding code
//   hfs report-stylelint <in> <out>     converts stylelint's `--formatter json` output (Sonar has no native stylelint import)
//                                       into the same document format, engineId `stylelint`, rule id = the stylelint rule
//   ESLint                              needs no converter: `eslint -f json -o reports/eslint.json` is read by Sonar itself
//                                       (sonar.eslint.reportPaths)
// The output is deterministic: rules sorted by id, issues by file, line, column, rule and message, so two runs over one
// tree are byte-identical. A finding of level `info` (report-only) is not exported: the gate fails on any imported issue.
import fs from 'node:fs';
import path from 'node:path';

export const HFS_ENGINE = 'starci-hfs';
export const STYLELINT_ENGINE = 'stylelint';
/** Every imported issue is a maintainability defect of the highest impact: the gate holds the count at zero. */
const IMPACT = Object.freeze([Object.freeze({ softwareQuality: 'MAINTAINABILITY', severity: 'HIGH' })]);
const CLEAN_CODE_ATTRIBUTE = 'CONVENTIONAL';
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/;

const posix = (file) => file.split(path.sep).join('/').replace(/^\.\//, '');
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const ruleOf = (id, engineId, name, description) => ({ id, name, description, engineId, cleanCodeAttribute: CLEAN_CODE_ATTRIBUTE, impacts: IMPACT.map((impact) => ({ ...impact })) });

const rangeOf = (line, endLine) => (Number.isInteger(line) && line >= 1 ? { textRange: { startLine: line, endLine: Number.isInteger(endLine) && endLine >= line ? endLine : line } } : {});

function document(rules, issues) {
  const sorted = [...issues].sort((a, b) => cmp(a.primaryLocation.filePath, b.primaryLocation.filePath)
    || (a.primaryLocation.textRange?.startLine ?? 0) - (b.primaryLocation.textRange?.startLine ?? 0)
    || cmp(a.ruleId, b.ruleId)
    || cmp(a.primaryLocation.message, b.primaryLocation.message));
  const used = new Set(sorted.map((issue) => issue.ruleId));
  return { rules: [...rules.values()].filter((rule) => used.has(rule.id)).sort((a, b) => cmp(a.id, b.id)), issues: sorted };
}

/**
 * The first source file of the repository (sorted) under one of `sourceRoots`: Sonar imports an issue only on a file it
 * indexes, and a finding about hfs.json, a workflow, a config file or a directory is not on one, so it is filed on this
 * file and its message names the real path. Null when the tracked tree has no source file.
 */
export function anchorOf(tracked, sourceRoots) {
  const roots = sourceRoots.map((root) => `${posix(root).replace(/\/$/, '')}/`);
  return [...tracked].map(posix).filter((file) => SOURCE_FILE.test(file) && roots.some((root) => file.startsWith(root))).sort(cmp)[0] ?? null;
}

/**
 * The Generic Issue Import document of a check's findings (the `findings` of checkRepository, each with the catalog's
 * `title`, `titleVi`, `whyVi` and `nextStepVi`). `sourceRoots` and `tracked` place a finding that lies outside the indexed
 * sources (see anchorOf); without them every finding keeps its own path.
 */
export function sonarReport(findings, { sourceRoots = [], tracked = [] } = {}) {
  const anchor = sourceRoots.length ? anchorOf(tracked, sourceRoots) : null;
  const roots = sourceRoots.map((root) => `${posix(root).replace(/\/$/, '')}/`);
  const trackedSet = new Set(tracked.map(posix));
  // Sonar imports an issue only on a file it indexes: a tracked source file under sonar.sources (a directory, a config file or a JSON file is not one).
  const indexed = (file) => roots.some((root) => file.startsWith(root)) && SOURCE_FILE.test(file) && (trackedSet.size === 0 || trackedSet.has(file));
  const rules = new Map();
  const issues = [];
  for (const finding of findings) {
    if (finding.level !== 'error') continue;
    if (!rules.has(finding.code)) {
      rules.set(finding.code, ruleOf(finding.code, HFS_ENGINE, finding.title ?? finding.code, `${finding.title ?? finding.code}. ${finding.titleVi}: ${finding.whyVi} Cách sửa: ${finding.nextStepVi}`));
    }
    const own = finding.path ? posix(finding.path) : null;
    const moved = anchor !== null && (own === null || !indexed(own));
    const filePath = moved ? anchor : own ?? anchor;
    if (filePath === null) continue;
    const located = moved ? {} : rangeOf(finding.line);
    issues.push({ ruleId: finding.code, effortMinutes: 5, primaryLocation: { message: moved ? `${own ?? 'repository'}: ${finding.message}` : finding.message, filePath, ...located } });
  }
  return document(rules, issues);
}

/** Text of a stylelint warning without the trailing " (rule-name)" its formatter appends. */
const stylelintText = (warning) => String(warning.text ?? '').replace(new RegExp(`\\s*\\(${String(warning.rule ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)$`), '');

/**
 * stylelint's `--formatter json` results ([{ source, warnings: [{ line, endLine, rule, text }] }]) as a Generic Issue Import
 * document. `root` is the directory paths are made relative to (the repository root, where the scan runs). A parse error or
 * an invalid option is a warning stylelint reports without a rule name; it is imported under the rule `stylelint-error`.
 */
export function stylelintReport(results, { root }) {
  const rules = new Map();
  const issues = [];
  for (const result of results) {
    const source = String(result.source ?? '');
    if (!source) continue;
    const relative = posix(path.isAbsolute(source) ? path.relative(root, source) : source);
    if (relative.startsWith('..')) continue;
    for (const warning of result.warnings ?? []) {
      const id = warning.rule || 'stylelint-error';
      if (!rules.has(id)) rules.set(id, ruleOf(id, STYLELINT_ENGINE, id, `Stylelint rule ${id} of the StarCi CSS canon (@starci/stylelint-canon, HFS R61).`));
      issues.push({ ruleId: id, effortMinutes: 5, primaryLocation: { message: stylelintText(warning) || id, filePath: relative, ...rangeOf(warning.line, warning.endLine) } });
    }
  }
  return document(rules, issues);
}

/** The `sonar.sources` roots of a sonar-project.properties text (empty when the file does not name them). */
export function sourceRootsOf(propertiesText) {
  const line = String(propertiesText).split(/\r?\n/).map((raw) => raw.trim()).find((raw) => raw.startsWith('sonar.sources='));
  return line ? line.slice('sonar.sources='.length).split(',').map((root) => root.trim()).filter(Boolean) : [];
}

/** Write a report as JSON (2-space, LF, trailing newline), creating the directory. */
export function writeReport(file, report) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
}

/** `hfs report-stylelint <in> <out> [--repo <dir>]`: convert a stylelint json report; returns the number of issues written. */
export function convertStylelintFile({ input, output, root }) {
  let results;
  try {
    results = JSON.parse(fs.readFileSync(input, 'utf8'));
  } catch (error) {
    throw new Error(`${input} is not a readable stylelint json report (${error.message})`);
  }
  if (!Array.isArray(results)) throw new Error(`${input} is not a stylelint json report: expected an array of results`);
  const report = stylelintReport(results, { root });
  writeReport(output, report);
  return report.issues.length;
}
