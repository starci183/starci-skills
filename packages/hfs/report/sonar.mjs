// Sonar documents of the ONE lint entry `hfs lint` (contract changes hfs-sonar-import, hfs-lint-entry): the building blocks that turn the
// findings of the StarCi canon into a Sonar Generic Issue Import document (SonarQube 10.3+ format: `{ rules, issues }`).
//   sonarReport(findings)        the repository findings of `hfs check`, engineId `starci-hfs`, rule id = the finding code
//   linterReport(kind, results)  a linter's own json output (`eslint -f json`, `stylelint --formatter json`), engineId `eslint` / `stylelint`,
//                                rule id = the linter's rule. Sonar's own ESLint import (sonar.eslint.reportPaths) is not used: it drops an
//                                issue on a file outside sonar.sources, and a stylelint result has no native import at all.
//   mergeReports(reports)        the documents of one `hfs lint` run as ONE file (reports/lint.sonar.json, sonar.externalIssuesReportPaths)
// One placement rule for every engine: Sonar imports an issue only on a file it indexes (a tracked source or stylesheet under
// sonar.sources). A finding on any other path (hfs.json, a workflow, a package under an unindexed root, e2e/, a directory) is filed
// on the first source file of sonar.sources and its message names the real path, so no finding is dropped.
// The output is deterministic: rules sorted by id, issues by file, line, rule and message, so two runs over one tree are
// byte-identical. A finding of level `info` (report-only) is not exported: the gate fails on any imported issue.
import fs from 'node:fs';
import path from 'node:path';

export const HFS_ENGINE = 'starci-hfs';
export const ESLINT_ENGINE = 'eslint';
export const STYLELINT_ENGINE = 'stylelint';
/** Every imported issue is a maintainability defect of the highest impact: the gate holds the count at zero. */
const IMPACT = Object.freeze([Object.freeze({ softwareQuality: 'MAINTAINABILITY', severity: 'HIGH' })]);
const CLEAN_CODE_ATTRIBUTE = 'CONVENTIONAL';
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/;
/** The files Sonar indexes under sonar.sources: the source files above and the stylesheets its CSS analyzer reads. */
const INDEXED_FILE = /\.(?:[cm]?[jt]sx?|css)$/;

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

/** One document of several (the starci-hfs, eslint and stylelint documents of one `hfs lint` run): rules by id, issues in the one sort order. */
export function mergeReports(reports) {
  const rules = new Map(reports.flatMap((report) => report.rules).map((rule) => [rule.id, rule]));
  return document(rules, reports.flatMap((report) => report.issues));
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
 * The one placement rule of every engine. `sourceRoots` and `tracked` say which files Sonar indexes; without them every
 * finding keeps its own path. Returns `place(own, message, line, endLine)`: the `primaryLocation` of the finding (its own file,
 * or the anchor with the real path named in the message), or null when there is nowhere to file it.
 */
function placement({ sourceRoots = [], tracked = [] }) {
  const anchor = sourceRoots.length ? anchorOf(tracked, sourceRoots) : null;
  const roots = sourceRoots.map((root) => `${posix(root).replace(/\/$/, '')}/`);
  const trackedSet = new Set(tracked.map(posix));
  // Sonar imports an issue only on a file it indexes: a tracked source file or stylesheet under sonar.sources (a directory, a config file or a JSON file is not one).
  const indexed = (file) => roots.some((root) => file.startsWith(root)) && INDEXED_FILE.test(file) && (trackedSet.size === 0 || trackedSet.has(file));
  return (own, message, line, endLine) => {
    const moved = anchor !== null && (own === null || !indexed(own));
    const filePath = moved ? anchor : own ?? anchor;
    if (filePath === null) return null;
    return { message: moved ? `${own ?? 'repository'}: ${message}` : message, filePath, ...(moved ? {} : rangeOf(line, endLine)) };
  };
}

/**
 * The Generic Issue Import document of a check's findings (the `findings` of checkRepository, each with the catalog's
 * `title`, `titleVi`, `whyVi` and `nextStepVi`). `sourceRoots` and `tracked` place a finding that lies outside the indexed
 * sources (see placement); without them every finding keeps its own path.
 */
export function sonarReport(findings, { sourceRoots = [], tracked = [] } = {}) {
  const place = placement({ sourceRoots, tracked });
  const rules = new Map();
  const issues = [];
  for (const finding of findings) {
    if (finding.level !== 'error') continue;
    if (!rules.has(finding.code)) {
      rules.set(finding.code, ruleOf(finding.code, HFS_ENGINE, finding.title ?? finding.code, `${finding.title ?? finding.code}. ${finding.titleVi}: ${finding.whyVi} C\u00e1ch s\u1eeda: ${finding.nextStepVi}`));
    }
    const primaryLocation = place(finding.path ? posix(finding.path) : null, finding.message, finding.line);
    if (primaryLocation === null) continue;
    issues.push({ ruleId: finding.code, effortMinutes: 5, primaryLocation });
  }
  return document(rules, issues);
}

/** Text of a stylelint warning without the trailing " (rule-name)" its formatter appends. */
const stylelintText = (warning) => String(warning.text ?? '').replace(new RegExp(`\\s*\\(${String(warning.rule ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)$`), '');

// What differs between the two linters' json output: where the file, the findings, the rule and the text are.
const LINTERS = Object.freeze({
  eslint: {
    engine: ESLINT_ENGINE,
    errorRule: 'eslint-error',
    file: (result) => result.filePath,
    findings: (result) => result.messages,
    rule: (message) => message.ruleId,
    text: (message) => message.message,
    describe: (id) => `ESLint rule ${id} of the StarCi canon (@starci/eslint-canon-be and @starci/eslint-canon-fe) or of a plugin it composes.`,
    describeError: 'ESLint could not lint a file: a parse error or an invalid configuration.',
  },
  stylelint: {
    engine: STYLELINT_ENGINE,
    errorRule: 'stylelint-error',
    file: (result) => result.source,
    findings: (result) => result.warnings,
    rule: (warning) => warning.rule,
    text: stylelintText,
    describe: (id) => `Stylelint rule ${id} of the StarCi CSS canon (@starci/stylelint-canon, HFS R61).`,
    describeError: 'Stylelint could not read a stylesheet: a parse error or an invalid option.',
  },
});

const LINTER_KINDS = Object.freeze(Object.keys(LINTERS));

/**
 * A linter's json results (`eslint -f json`: [{ filePath, messages: [{ ruleId, line, endLine, message }] }]; `stylelint
 * --formatter json`: [{ source, warnings: [{ line, endLine, rule, text }] }]) as a Generic Issue Import document. `root` is
 * the directory paths are made relative to (the repository root, where the scan runs); a file outside it is skipped.
 * `sourceRoots` and `tracked` place a finding on a file Sonar does not index (see placement). A parse error or an invalid
 * option is a finding the linter reports without a rule name; it is imported under the rule `eslint-error` / `stylelint-error`.
 */
export function linterReport(kind, results, { root, sourceRoots = [], tracked = [] }) {
  const linter = LINTERS[kind];
  if (linter === undefined) throw new Error(`unknown linter ${kind}; expected ${LINTER_KINDS.join(' or ')}`);
  const place = placement({ sourceRoots, tracked });
  const rules = new Map();
  const issues = [];
  for (const result of results) {
    const source = String(linter.file(result) ?? '');
    if (!source) continue;
    const relative = posix(path.isAbsolute(source) ? path.relative(root, source) : source);
    if (relative.startsWith('..')) continue;
    for (const finding of linter.findings(result) ?? []) {
      const id = linter.rule(finding) || linter.errorRule;
      if (!rules.has(id)) rules.set(id, ruleOf(id, linter.engine, id, id === linter.errorRule ? linter.describeError : linter.describe(id)));
      const primaryLocation = place(relative, linter.text(finding) || id, finding.line, finding.endLine);
      if (primaryLocation !== null) issues.push({ ruleId: id, effortMinutes: 5, primaryLocation });
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
