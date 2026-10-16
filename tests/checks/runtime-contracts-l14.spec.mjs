// proves: RT_PROSE_COMMAND_UNKNOWN@lite RT_PROSE_COMMAND_UNKNOWN@full
// proves: RT_DOCUMENTED_DEFAULT_DRIFT@lite RT_DOCUMENTED_DEFAULT_DRIFT@full
// proves: RT_ROLES_CONTRACT_DRIFT@lite RT_ROLES_CONTRACT_DRIFT@full
// proves: RT_EDGE_CASE_REGISTRY@lite RT_EDGE_CASE_REGISTRY@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { checkProseCommands } from '../../scripts/checks/check-prose-commands.mjs';
import { checkDocumentedDefaults } from '../../scripts/checks/check-documented-defaults.mjs';
import { checkRolesContract } from '../../scripts/checks/check-roles-contract.mjs';
import { checkEdgeCaseRegistry } from '../../scripts/checks/check-edge-case-registry.mjs';
import { rolesContract } from '../../scripts/machine/roles-contract.mjs';

const write = (root, file, text) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};

const copy = (root, file) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(skillRoot, file), target);
};

const tree = (t, edition) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `starci-contracts-${edition}-`));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  // These runtime contracts are shared by both editions. The fixture records which edition it represents.
  write(root, 'hfs.json', JSON.stringify({ edition }));
  return root;
};

const proseTree = (t, edition) => {
  const root = tree(t, edition);
  execFileSync('git', ['init', '--quiet', root], { windowsHide: true });
  fs.cpSync(path.join(skillRoot, 'modules/cli/commands'), path.join(root, 'modules/cli/commands'), { recursive: true });
  return root;
};

const defaultsTree = (t, edition) => {
  const root = tree(t, edition);
  execFileSync('git', ['init', '--quiet', root], { windowsHide: true });
  write(root, 'config.example.yaml', 'fixture:\n  limit: 3\n');
  return root;
};

const rolesTree = (t, edition) => {
  const root = tree(t, edition);
  const doc = rolesContract(skillRoot);
  const policy = ['modules/kernel/op-incident-policy.yaml', 'modules/kernel/command-policy.yaml',
    'modules/kernel/revision-scope.yaml', 'modules/reconciler/edge-cases.yaml', 'docs/workflow-kernel.md'];
  const detectors = doc.roles.flatMap((role) => (role.bugSurface ?? []).map((entry) => entry.detectedBy));
  const revisionFiles = doc.roles.map((role) => role.revisionAck?.file).filter(Boolean);
  const surfaces = doc.roles.flatMap((role) => role.surfaces.map((surface) => surface.file));
  for (const file of new Set(['modules/kernel/roles.yaml', ...policy, ...detectors, ...revisionFiles, ...surfaces])) copy(root, file);
  return root;
};

const edgeTree = (t, edition) => {
  const root = tree(t, edition);
  copy(root, 'modules/kernel/roles.yaml');
  write(root, 'modules/reconciler/edge-cases.yaml', [
    'families: [failure-while-running]',
    'cases:',
    '  - id: missing-reproducer',
    '    family: failure-while-running',
    '    met: {date: "2026-10-15", where: fixture, evidence: fixture-sequence}',
    '    rule: {file: scripts/fixture.mjs, anchor: fixture-rule}',
    '    spec: tests/fixture.spec.mjs',
    '    status: covered',
    '',
  ].join('\n'));
  write(root, 'scripts/fixture.mjs', '// fixture-rule\n');
  return root;
};

for (const edition of ['lite', 'full']) {
  test(`${edition} prose command checker rejects unknown verbs and flags`, (t) => {
    const root = proseTree(t, edition);
    write(root, 'docs/fixture.md', 'Run `starci kernel no-such-verb` or `starci kernel settle --no-such-flag`.\n');
    const findings = checkProseCommands(root);
    assert.deepEqual(findings.map((finding) => finding.code), ['RT_PROSE_COMMAND_UNKNOWN', 'RT_PROSE_COMMAND_UNKNOWN']);
    assert.deepEqual(findings.map((finding) => finding.path), ['docs/fixture.md', 'docs/fixture.md']);
  });

  test(`${edition} prose command checker accepts a catalogued command and its flags`, (t) => {
    const root = proseTree(t, edition);
    write(root, 'docs/fixture.md', 'Run `starci kernel settle --job fixture --verdict pass`.\n');
    assert.deepEqual(checkProseCommands(root), []);
  });

  test(`${edition} documented default checker rejects drift and unresolved keys`, (t) => {
    const root = defaultsTree(t, edition);
    write(root, 'docs/fixture.md', 'The limit (default `4` = `fixture.limit`); a missing key (default `1` = `fixture.absent`).\n');
    const findings = checkDocumentedDefaults(root);
    assert.deepEqual(findings.map((finding) => finding.code), ['RT_DOCUMENTED_DEFAULT_DRIFT', 'RT_DOCUMENTED_DEFAULT_DRIFT']);
    assert.match(findings[0].message, /the value the code reads is 3/);
    assert.match(findings[1].message, /resolves to nothing/);
  });

  test(`${edition} documented default checker accepts the value its cited key owns`, (t) => {
    const root = defaultsTree(t, edition);
    write(root, 'docs/fixture.md', 'The limit (default `3` = `fixture.limit`).\n');
    assert.deepEqual(checkDocumentedDefaults(root), []);
  });

  test(`${edition} roles contract checker rejects a missing generated role block`, (t) => {
    const root = rolesTree(t, edition);
    write(root, 'modules/kernel/kernel-prompt.md', '# Fixture prompt without its generated role block\n');
    const findings = checkRolesContract(root);
    assert.deepEqual(findings.map((finding) => finding.code), ['RT_ROLES_CONTRACT_DRIFT']);
    assert.match(findings[0].message, /lacks the generated kernel block/);
  });

  test(`${edition} roles contract checker accepts matching role surfaces and table`, (t) => {
    assert.deepEqual(checkRolesContract(rolesTree(t, edition)), []);
  });

  test(`${edition} edge case registry rejects a covered case with a missing reproducer`, (t) => {
    const findings = checkEdgeCaseRegistry(edgeTree(t, edition));
    assert.deepEqual(findings.map((finding) => finding.code), ['RT_EDGE_CASE_REGISTRY']);
    assert.match(findings[0].message, /spec file tests\/fixture\.spec\.mjs does not exist/);
  });

  test(`${edition} edge case registry accepts a covered case with existing rule and reproducer`, (t) => {
    const root = edgeTree(t, edition);
    write(root, 'tests/fixture.spec.mjs', '// Registry reproducer fixture.\n');
    assert.deepEqual(checkEdgeCaseRegistry(root), []);
  });
}
