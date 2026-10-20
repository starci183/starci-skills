#!/usr/bin/env node
// R247 RT_COVERAGE_MATRIX: every applicable edition has a complete chain of coverage evidence.
//   starci runtime check --only hfs-coverage -- [--json] [--witness]
// Every rule gates missing enforcers; other metadata-free legacy gaps remain warnings.
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { HfsSlotsError, loadRuleCatalog, loadSlotManifest } from '../hfs/slots.mjs';
import { isMain } from '../lib/is-main.mjs';
import { coverageSources, exampleInventory } from './lib/coverage-inventory.mjs';
import { coverageRuleFindings } from './lib/coverage-rules.mjs';
import { coverageLedgerFindings } from './lib/coverage-ledgers.mjs';
import { coverageCiteFindings } from './lib/coverage-cites.mjs';
import { runCoverageWitnesses } from './lib/coverage-witness.mjs';
import { applyCoverageRatchet } from './lib/coverage-ratchet.mjs';
import { PLUGIN_ENTRY, pluginRuleIds } from './check-hfs-rules.mjs';

export const CODE = 'RT_COVERAGE_MATRIX';
export { REPORT_ONLY_CODES } from './lib/coverage-rules.mjs';

/** One catalog-driven static pass; fixture catalogs use the same path as the real repository. */
function hfsCoverageFindings(context) {
  return applyCoverageRatchet(context, [...coverageRuleFindings(context), ...coverageLedgerFindings(context), ...coverageCiteFindings(context)]);
}

/** Read only authored, non-secret sources. Missing ledgers remain coverage findings until their batches land. */
async function loadCoverageContext(root = skillRoot) {
  const manifest = loadSlotManifest({ root });
  const catalog = loadRuleCatalog({ root, manifest });
  const files = coverageSources(root);
  const plugins = Object.fromEntries(await Promise.all(Object.keys(PLUGIN_ENTRY)
    .map(async (kind) => [kind, await pluginRuleIds(root, kind)])));
  const yaml = (file) => files.has(file) ? parseYaml(files.get(file)) : null;
  const schemas = [...files].filter(([file]) => /^modules\/schemas\/work-[^/]+\.schema\.yaml$/.test(file))
    .map(([file, text]) => ({ path: file, document: parseYaml(text) }));
  return { root, catalog, manifest, files, plugins, schemas, examples: exampleInventory(files),
    surfaces: yaml('knowledge/hfs/surfaces.yaml'), requirements: yaml('knowledge/hfs/requirements.yaml'),
    rulings: yaml('modules/kernel/owner-rulings.yaml'), hfsRulings: yaml('knowledge/hfs/rulings.yaml') };
}

function coverageReport(findings, inventory = {}) {
  const errors = findings.filter((item) => item.level !== 'warning');
  const warnings = findings.filter((item) => item.level === 'warning');
  const legacy = warnings.filter((item) => item.legacy);
  const byCode = {};
  for (const item of legacy) byCode[item.code] = (byCode[item.code] ?? 0) + 1;
  return { ok: errors.length === 0, ...inventory, errors: errors.length, warnings: warnings.length,
    legacyBacklog: { total: legacy.length, byCode }, findings };
}

async function checkHfsCoverage(root = skillRoot, { witness = false, judge } = {}) {
  let context;
  try { context = await loadCoverageContext(root); } catch (error) {
    return { ok: false, errors: 1, warnings: 0, findings: [], refusal: {
      code: error instanceof HfsSlotsError ? error.code : CODE,
      message: error instanceof HfsSlotsError ? error.message : 'The coverage inventory cannot be parsed; repair its catalog or source declarations.' } };
  }
  const findings = hfsCoverageFindings(context);
  if (witness) findings.push(...applyCoverageRatchet(context, await runCoverageWitnesses(context, judge ? { judge } : {})));
  return coverageReport(findings, { rules: context.catalog.rules.length, slots: context.manifest.slots.length,
    examples: context.examples.length, schemas: context.schemas.length, witness });
}

export function formatCoverageReport(report) {
  if (report.refusal) return `${report.refusal.code}: ${report.refusal.message}\n`;
  const lines = [`HFS coverage: ${report.ok ? 'OK' : 'FAIL'}; ${report.rules ?? 0} rules, ${report.slots ?? 0} slots, ${report.errors} errors, ${report.warnings} warnings.`];
  const backlog = report.legacyBacklog ?? { total: 0, byCode: {} };
  const counts = Object.entries(backlog.byCode).sort(([left], [right]) => left.localeCompare(right)).map(([code, count]) => `${code} ${count}`);
  lines.push(`Legacy backlog: ${backlog.total} warnings${counts.length ? '; ' + counts.join(', ') : ''}.`);
  for (const finding of report.findings) {
    const at = finding.line ? `:${finding.line}` : '';
    lines.push(`${finding.level.toUpperCase()} ${finding.code} ${finding.path}${at}: ${finding.message}`);
  }
  return `${lines.join('\n')}\n`;
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('usage: starci runtime check --only hfs-coverage -- [--json] [--witness] [--root <directory>]');
  } else {
    let root = skillRoot;
    let invalid = false;
    for (let index = 0; index < argv.length; index += 1) {
      if (argv[index] === '--json' || argv[index] === '--witness') continue;
      if (argv[index] === '--root' && argv[index + 1] && !argv[index + 1].startsWith('--')) root = path.resolve(argv[++index]);
      else invalid = true;
    }
    if (invalid) { console.error('hfs-coverage: expected --json, --witness or --root <directory>'); process.exitCode = 2; }
    else {
      const report = await checkHfsCoverage(root, { witness: argv.includes('--witness') });
      if (argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
      else process.stdout.write(formatCoverageReport(report));
      process.exitCode = report.ok ? 0 : 1;
    }
  }
}
