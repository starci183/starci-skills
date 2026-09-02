import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateOutput as validateSnapshotOutput } from './test/uat-snapshot-freeze/validate-output.mjs';
import { validateOutput as validateResultOutput } from './test/uat-result-publish/validate-output.mjs';
import { uatContentFingerprint } from './test/uat-artifact.mjs';
import { validateOutput as validateUatSkillOutput } from '../skills/starci-uat-verify/validate-output.mjs';

const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));

test('canonical UAT snapshot and result require exact existing schema-valid fingerprinted files', () => {
  const feature = `contract-fixture-${process.pid}`;
  const flow = 'happy';
  const featureRoot = path.join(sourceRoot, '.worktrees', 'uat', feature);
  const artifactRoot = path.join(featureRoot, flow);
  const snapshotRef = `.worktrees/uat/${feature}/${flow}/snapshot.json`;
  const resultRef = `.worktrees/uat/${feature}/${flow}/result.json`;
  const account={accountRef:`account://fresh/${feature}/${flow}/run-1`,provisioningMode:'control-panel-auto-create',provisioningOwnerRef:'thread://control-panel',identityRecordRef:`keycloak-user://uat/${feature}-run-1`,applicationRecordRef:`database-user://uat/${feature}-run-1`,principalFingerprint:`sha256:${'a'.repeat(64)}`,fixtureNamespace:`uat-${feature}-${flow}-run-1`,credentialCustody:'control-panel-ephemeral',state:'authenticated'};
  const snapshotDocument = { version:'7.6.0-beta.1', feature, flow, sourceHeads:['git:one'], cases:['happy'], account };
  const snapshotFingerprint = uatContentFingerprint(snapshotDocument);
  const evidenceRefs = ['evidence://behavior','evidence://ux','evidence://ui'];
  const snapshotOutput = { schemaVersion:7, operatorId:'test/uat-snapshot-freeze', output:{ outcome:'frozen', canonicalRef:snapshotRef, contentFingerprint:snapshotFingerprint, evidenceRefs:['evidence://snapshot'], gaps:[] } };
  try {
    fs.mkdirSync(artifactRoot, { recursive:true });
    const wrongSuffix = structuredClone(snapshotOutput);
    wrongSuffix.output.canonicalRef = `.worktrees/uat/${feature}/${flow}/not-snapshot.txt`;
    assert.equal(validateSnapshotOutput(wrongSuffix).valid, false);
    assert.match(validateSnapshotOutput(snapshotOutput).errors.join('\n'), /existing file/);
    fs.writeFileSync(path.join(artifactRoot, 'snapshot.json'), `${JSON.stringify(snapshotDocument)}\n`);
    assert.deepEqual(validateSnapshotOutput(snapshotOutput), { valid:true, errors:[] });
    const wrongSnapshotFingerprint = structuredClone(snapshotOutput);
    wrongSnapshotFingerprint.output.contentFingerprint = `sha256:${'f'.repeat(64)}`;
    assert.match(validateSnapshotOutput(wrongSnapshotFingerprint).errors.join('\n'), /contentFingerprint/);

    const resultDocument = { version:'7.6.0-beta.1', feature, flow, snapshotFingerprint, outcome:'passed', evidenceRefs };
    const resultFingerprint = uatContentFingerprint(resultDocument);
    const resultOutput = { schemaVersion:7, operatorId:'test/uat-result-publish', output:{ outcome:'passed', canonicalRef:resultRef, contentFingerprint:resultFingerprint, result:{ summary:'Canonical UAT passed.', artifactRefs:[resultRef], counterevidence:null }, gaps:[], evidenceRefs } };
    assert.match(validateResultOutput(resultOutput).errors.join('\n'), /existing file/);
    fs.writeFileSync(path.join(artifactRoot, 'result.json'), `${JSON.stringify(resultDocument)}\n`);
    assert.deepEqual(validateResultOutput(resultOutput), { valid:true, errors:[] });
    const genericArtifact = structuredClone(resultOutput);
    genericArtifact.output.result.artifactRefs = ['artifact://not-canonical'];
    assert.match(validateResultOutput(genericArtifact).errors.join('\n'), /must include canonicalRef/);
    const wrongResultFingerprint = structuredClone(resultOutput);
    wrongResultFingerprint.output.contentFingerprint = `sha256:${'e'.repeat(64)}`;
    assert.match(validateResultOutput(wrongResultFingerprint).errors.join('\n'), /contentFingerprint/);
    fs.writeFileSync(path.join(artifactRoot, 'result.json'), `${JSON.stringify({ ...resultDocument, snapshotFingerprint:`sha256:${'d'.repeat(64)}` })}\n`);
    assert.match(validateResultOutput(resultOutput).errors.join('\n'), /snapshotFingerprint/);
    fs.writeFileSync(path.join(artifactRoot, 'result.json'), `${JSON.stringify(resultDocument)}\n`);

    const skillOutput = { schemaVersion:7, skillId:'starci-uat-verify', outcome:'complete', verdict:'PASS', missionRef:'mission://uat-contract', sourceFingerprint:`sha256:${'1'.repeat(64)}`, evidenceFingerprint:`sha256:${'2'.repeat(64)}`, canonicalResultRef:resultRef, canonicalResultFingerprint:resultFingerprint, artifactRefs:[resultRef], handoff:null };
    assert.deepEqual(validateUatSkillOutput(skillOutput), { valid:true, errors:[] });
    const nonexistentResultRef = `.worktrees/uat/${feature}/nonexistent/result.json`;
    const nonexistentSkillOutput = { ...skillOutput, canonicalResultRef:nonexistentResultRef, canonicalResultFingerprint:`sha256:${'a'.repeat(64)}`, artifactRefs:[nonexistentResultRef] };
    assert.match(validateUatSkillOutput(nonexistentSkillOutput).errors.join('\n'), /existing file/);
    const forgedPublicFingerprint = { ...skillOutput, canonicalResultFingerprint:`sha256:${'b'.repeat(64)}` };
    assert.match(validateUatSkillOutput(forgedPublicFingerprint).errors.join('\n'), /canonicalResultFingerprint/);
    const contradictoryPublicVerdict = { ...skillOutput, outcome:'blocked', verdict:'FAIL' };
    assert.match(validateUatSkillOutput(contradictoryPublicVerdict).errors.join('\n'), /public UAT verdict/);
    const genericSkillOutput = { ...skillOutput, artifactRefs:['artifact://not-canonical'] };
    assert.match(validateUatSkillOutput(genericSkillOutput).errors.join('\n'), /canonicalResultRef/);
    assert.deepEqual(validateUatSkillOutput({ ...skillOutput, outcome:'blocked', verdict:'BLOCKED', canonicalResultRef:null, canonicalResultFingerprint:null, artifactRefs:[] }), { valid:true, errors:[] });
  } finally {
    fs.rmSync(featureRoot, { recursive:true, force:true });
  }
});
