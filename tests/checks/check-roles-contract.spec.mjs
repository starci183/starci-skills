import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRolesContract, contractFindings, writeRoleBlocks, CODE } from '../../scripts/checks/check-roles-contract.mjs';
import { rolesContract, renderRoleBlock, renderRoleLines } from '../../scripts/machine/roles-contract.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';

const tempTree = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-roles-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const doc = rolesContract(skillRoot);
  // The role standard reads the incident policy, the command policy, the generated table's document and the files bugSurface names.
  const standard = ['modules/kernel/op-incident-policy.yaml', 'modules/kernel/command-policy.yaml', 'modules/reconciler/edge-cases.yaml', 'docs/workflow-kernel.md', ...doc.roles.flatMap((r) => (r.bugSurface ?? []).map((b) => b.detectedBy))];
  for (const file of new Set(['modules/kernel/roles.yaml', ...standard, ...doc.roles.flatMap((r) => r.surfaces.map((s) => s.file))])) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(path.join(skillRoot, file), path.join(root, file));
  }
  return root;
};

test('the shipped surfaces match the roles contract', () => {
  assert.deepEqual(checkRolesContract().map((f) => f.message), []);
});

test('the contract chain follows reportsTo and names only known roles', () => {
  const doc = rolesContract(skillRoot);
  assert.deepEqual(contractFindings(doc), []);
  assert.equal(doc.roles.find((r) => r.id === 'op').reportsTo, 'kernel');
  assert.deepEqual(doc.roles.find((r) => r.id === 'debug').oversees, ['op', 'critic', 'kernel', 'supervisor', 'runtime']);
});

test('RT_ROLES_CONTRACT_DRIFT names a block that differs from the contract and --write repairs it', (t) => {
  const root = tempTree(t);
  const file = path.join(root, 'modules/kernel/kernel-prompt.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('Answers the judgments of its menu', 'Does everything'));
  const findings = checkRolesContract(root);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, CODE);
  assert.equal(CODE, 'RT_ROLES_CONTRACT_DRIFT');
  assert.match(findings[0].message, /kernel-prompt\.md carries a kernel block that differs/);
  writeRoleBlocks(root);
  assert.deepEqual(checkRolesContract(root), []);
});

test('RT_ROLES_CONTRACT_DRIFT refuses a surface that teaches a spelling the role forbids', (t) => {
  const root = tempTree(t);
  const file = path.join(root, 'skills/starci/references/debug-loop.md');
  fs.appendFileSync(file, '\nRelay it to the workflow\'s Kernel terminal.\n');
  const findings = checkRolesContract(root);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /debug-loop\.md:\d+ contradicts role debug/);
});

test('a cite surface that stops naming its role is a finding', (t) => {
  const root = tempTree(t);
  const file = path.join(root, 'scripts/kernel/op-prompt.mjs');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll('modules/kernel/roles.yaml#op', 'x'));
  assert.match(checkRolesContract(root)[0].message, /must cite modules\/kernel\/roles\.yaml#op/);
});

test('the op prompt lines and the Markdown block state the role from the contract', () => {
  const doc = rolesContract(skillRoot);
  const lines = renderRoleLines('op').join('\n');
  assert.match(lines, /never: grades itself/);
  assert.match(lines, /reports to: Kernel only/);
  assert.match(renderRoleBlock(doc, 'debug'), /Retires when:/);
});
