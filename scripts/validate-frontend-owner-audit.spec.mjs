import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateFrontendOwnerAudit } from './validate-frontend-owner-audit.mjs';
import { validateOutput } from '../skills/starci-fe-process/validate-output.mjs';

const completeOutput=(artifactRefs=[])=>({
  schemaVersion:7,
  skillId:'starci-fe-process',
  outcome:'complete',
  missionRef:'mission:owner-audit-regression',
  artifactRefs,
  handoff:null
});

test('canonical owner-audit template validates',async()=>{
  const template=(await readFile(new URL('../templates/frontend-owner-audit.md',import.meta.url),'utf8'))
    .replace('OWNER_NAME','ExamplePage')
    .replace('OWNER_KIND','page')
    .replace('SOURCE_REFS','page.tsx')
    .replace('ENTRY_CONTEXT','/example');
  assert.deepEqual(validateFrontendOwnerAudit(template,{filePath:'audit.md'}),[]);
});

test('rejects requested 9/10 without typed PASS',()=>{
  const invalid=`# Visual audit — Example\n\n## Owner\n\n- Kind: page\n- Source refs: page.tsx\n- Entry context: /example\n\n## Current snapshot\n\n- Status: FAIL\n- Score: 9/10\n- Round: 1\n- Reviewed at: now\n- Reason why: Visible defects remain in the latest raster packet.\n- Covered evidence: wide\n- Source fingerprint: sha256:x\n- Evidence fingerprint: sha256:y\n- Finding-batch fingerprint: sha256:z\n- Remaining gaps: defects\n\n## Audit axes\n\n- Business task closure: 2/2\n- UX flow and state clarity: 2/2\n- Visual hierarchy and composition: 2/2\n- Responsive interaction resilience: 1/2\n- Consistency and accessibility cues: 2/2\n\n## Immutable audit history\n\nRound 1.\n\n## Owner feedback\n\nNone.\n`;
  assert.match(validateFrontendOwnerAudit(invalid,{filePath:'audit.md'}).join('\n'),/non-PASS score cannot exceed 8\/10/);
});

test('rejects incomplete evidence with a numeric score',()=>{
  const invalid=`# Visual audit — Example\n\n## Owner\n\n- Kind: drawer\n- Source refs: component.tsx\n- Entry context: task\n\n## Current snapshot\n\n- Status: INSUFFICIENT_EVIDENCE\n- Score: 5/10\n- Round: 0\n- Reviewed at: never\n- Reason why: Drawer open and focus-return evidence is still missing.\n- Covered evidence: none\n- Source fingerprint: N/A\n- Evidence fingerprint: N/A\n- Finding-batch fingerprint: N/A\n- Remaining gaps: overlay lifecycle\n\n## Audit axes\n\nN/A\n\n## Immutable audit history\n\nNone.\n\n## Owner feedback\n\nNone.\n`;
  assert.match(validateFrontendOwnerAudit(invalid,{filePath:'audit.md'}).join('\n'),/INSUFFICIENT_EVIDENCE requires Score: N\/A/);
});

test('FE completion is blocked when its owner audit artifact is missing',()=>{
  const result=validateOutput(completeOutput());
  assert.equal(result.valid,false);
  assert.match(result.errors.join('\n'),/artifactRefs must include adjacent lowercase audit\.md/);
});

test('FE completion accepts an adjacent lowercase owner audit artifact',()=>{
  assert.deepEqual(validateOutput(completeOutput(['src/app/example/audit.md'])),{valid:true,errors:[]});
});
