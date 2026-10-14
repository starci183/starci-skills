#!/usr/bin/env node
// R274 RT_RULING_STALE_CITE: scans live prose, source comments and spec titles against the two ruling catalogs.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { isMain } from '../lib/is-main.mjs';
import { generatedRootsOf, parseCheckArgs } from '../lib/check-scan.mjs';
import { workingTreeTexts } from '../lib/tracked-text-scan.mjs';
import { CODE, RULES_FILE, OWNER_RULINGS_FILE, rulingCiteInScope, rulingCiteFindings } from './lib/ruling-cites.mjs';

export { CODE, rulingCiteFindings };
const NAME = 'check-ruling-cites';
const HELP =
  'Usage: starci runtime check --only ruling-cites -- [--root <tree>] [--json]\n\nR274: reject superseded citations, staleWhen statements and unmatched owner-ruling dates.\nExit 0 clean, 1 findings, 2 invalid arguments or catalogs.';

/** Scan tracked and unignored new instruction surfaces, excluding generated runtime copies before reading. */
export function checkRulingCites(root = skillRoot) {
  const readCatalog = (rel) => {
    const catalog = parseYaml(fs.readFileSync(path.join(root, rel), 'utf8'));
    const entries = rel === RULES_FILE ? catalog?.rules : catalog?.rulings;
    if (!Array.isArray(entries)) throw new Error(`${rel}: ruling catalog must contain a list`);
    return catalog;
  };
  const catalogs = { rules: readCatalog(RULES_FILE), ownerRulings: readCatalog(OWNER_RULINGS_FILE) };
  const generated = generatedRootsOf(root);
  const files = workingTreeTexts(
    root,
    lsFiles,
    (rel) => rulingCiteInScope(rel) && !generated.some((prefix) => rel.startsWith(prefix))
  );
  const findings = rulingCiteFindings(files, catalogs);
  return {
    schema: 'starci/ruling-cites@1',
    ok: findings.length === 0,
    filesScanned: Object.keys(files).length,
    findings,
  };
}

export function checkRulingCitesMain(argv) {
  const args = parseCheckArgs(argv, { name: NAME, help: HELP, root: skillRoot });
  if (args.exitCode !== undefined) return args;
  try {
    const report = checkRulingCites(args.root);
    if (args.json) return { exitCode: report.ok ? 0 : 1, text: `${JSON.stringify(report, null, 2)}\n` };
    const rows = report.findings.map((finding) => `${CODE} ${finding.message}`);
    rows.push(
      report.ok
        ? `${NAME}: ${report.filesScanned} files have current ruling citations`
        : `${NAME}: ${report.findings.length} finding(s) in ${report.filesScanned} files`
    );
    return { exitCode: report.ok ? 0 : 1, text: `${rows.join('\n')}\n` };
  } catch (error) {
    return { exitCode: 2, text: `${NAME}: ${error.message}\n` };
  }
}

if (isMain(import.meta.url)) {
  const result = checkRulingCitesMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
