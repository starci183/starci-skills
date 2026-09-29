#!/usr/bin/env node
// check-hfs-sync.mjs - the generated files of a product repository are the ones `hfs sync` renders, and its tracked
// .starciwork / .starcistacks trees hold no agent output or plaintext secret. The op and land gates run it so a
// hand-edited husky hook, workflow, .gitignore, sonar-project.properties, codecov.yml or .starciwork/.gitignore is a
// finding, not a silent divergence (HFS v2 decision 10; packages/hfs/sync).
//
//   node scripts/checks/check-hfs-sync.mjs --repo <product repo> [--json]
//
// Findings (all catalogued in modules/kernel/failure-codes.yaml):
//   HFS_SYNC_DRIFT              a generated file differs from its template, or is missing
//   HFS_SYNC_HFS_INVALID        hfs.json is missing or invalid
//   HFS_SYNC_PRESET_MISSING     the jest/vitest preset the coverage exclusions come from is not installed
//   HFS_SYNC_SONAR_KEY          the stack declaration names two Sonar keys for the repository
//   HFS_SYNC_TEMPLATE_VARIABLE  a template names a variable sync does not provide (runtime defect)
//   HFS_SYNC_SKELETON_MISSING   `hfs sync --init` found no skeleton templates (runtime defect)
//   HFS_WORK_AGENT_DATA         a tracked .starciwork file is agent output the allowlist refuses
//   HFS_STACKS_PLAINTEXT        a tracked .starcistacks file is a plaintext secret
// Exit 0 clean, 1 findings, 2 bad arguments.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { checkTargets, loadHfs, loadPresets, renderTargets, SyncError } from '../../packages/hfs/sync/index.mjs';
import { readDeclaredSonarKey } from '../../packages/hfs/sync/sonar-key.mjs';
import { judge, trackedFiles } from '../../packages/hfs/sync/hygiene.mjs';

export const CODES = Object.freeze([
  'HFS_SYNC_DRIFT', 'HFS_SYNC_HFS_INVALID', 'HFS_SYNC_PRESET_MISSING', 'HFS_SYNC_SONAR_KEY',
  'HFS_SYNC_TEMPLATE_VARIABLE', 'HFS_SYNC_SKELETON_MISSING', 'HFS_WORK_AGENT_DATA', 'HFS_STACKS_PLAINTEXT',
]);

/** { ok, findings: [{ code, file, message }] } for the repository at `root`. */
export async function checkHfsSync(root, { presets } = {}) {
  const findings = [];
  const add = (code, file, message) => findings.push({ code, file, message });
  try {
    const hfs = loadHfs(root);
    const sonarKey = await readDeclaredSonarKey(root, { parseYaml, fail: message => { throw new SyncError('HFS_SYNC_SONAR_KEY', message); } });
    const targets = renderTargets(hfs, presets ?? await loadPresets(root, hfs.profile), { sonarKey });
    for (const result of checkTargets(root, targets).filter(item => item.status !== 'ok')) {
      const line = result.difference ? ` at line ${result.difference.line}` : '';
      add('HFS_SYNC_DRIFT', result.path, `${result.status}${line}; expected sha256 ${result.expectedHash.slice(0, 12)}; run "npx hfs sync --write"`);
    }
  } catch (error) {
    if (!(error instanceof SyncError) || !CODES.includes(error.code)) throw error;
    add(error.code, 'hfs.json', error.message);
  }
  if (fs.existsSync(path.join(root, '.git'))) {
    for (const finding of judge(root, trackedFiles(root)).findings) add(finding.code, finding.file, finding.message);
  }
  return { ok: findings.length === 0, findings };
}

async function main(argv) {
  const at = argv.indexOf('--repo');
  if (at < 0 || !argv[at + 1]) {
    process.stdout.write('usage: node scripts/checks/check-hfs-sync.mjs --repo <product repo> [--json]\n');
    return 2;
  }
  const result = await checkHfsSync(path.resolve(argv[at + 1]));
  if (argv.includes('--json')) process.stdout.write(`${JSON.stringify({ schema: 'starci/hfs-sync-check@1', ...result }, null, 2)}\n`);
  else {
    for (const finding of result.findings) process.stdout.write(`${finding.code} ${finding.file}: ${finding.message}\n`);
    process.stdout.write(`check-hfs-sync: ${result.findings.length} finding(s)\n`);
  }
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await main(process.argv.slice(2));
