import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOutput } from '../skills/starci-fe-process/validate-output.mjs';

const hash=(char)=>`sha256:${char.repeat(64)}`;
const raster=(char)=>`raster://sha256:${char.repeat(64)}`;
const rasterArtifact=(char)=>`artifact://raster/sha256:${char.repeat(64)}`;

const liveComplete=()=>{
  const refs={
    direction:'operator-result://fe/direction-quality-screen/a',
    raster:raster('a'),
    artifact:rasterArtifact('a'),
    visual:'operator-result://fe/visual-fidelity/a',
    quality:'skill-result://quality/a',
    uat:'skill-result://uat/a',
    test:'proof://tests/a',
    build:'proof://build/a',
  };
  return {
    schemaVersion:7,
    skillId:'starci-fe-process',
    outcome:'complete',
    missionRef:'mission://frontend/a',
    artifactRefs:Object.values(refs),
    handoff:null,
    runtimeFingerprint:hash('b'),
    sourceFingerprint:hash('c'),
    terminalEvidence:{
      stage:'live-complete',
      operatorReceiptRefs:[refs.direction,refs.visual,refs.quality,refs.uat],
      directionQualityReceiptRef:refs.direction,
      representativeRasterRef:refs.raster,
      representativeRasterArtifactRef:refs.artifact,
      visualFidelityReceiptRef:refs.visual,
      qualityReceiptRef:refs.quality,
      uatReceiptRef:refs.uat,
      testEvidenceRefs:[refs.test],
      buildEvidenceRef:refs.build,
    },
  };
};

test('frontend complete requires one durable evidence-bound terminal packet',()=>{
  assert.deepEqual(validateOutput(liveComplete()),{valid:true,errors:[]});
  const narrationOnly=liveComplete();
  narrationOnly.terminalEvidence.representativeRasterArtifactRef=null;
  narrationOnly.terminalEvidence.visualFidelityReceiptRef=null;
  assert.match(validateOutput(narrationOnly).errors.join('\n'),/durable raster|visual fidelity/i);
});

test('fixture-passed handoff cannot use inline screenshots or a missing blind review',()=>{
  const value=liveComplete();
  value.outcome='handoff';
  value.handoff={skillId:'starci-backend-process',inputRef:'input://backend/a',resumeSkillId:'starci-fe-process',resumeState:'capture-preflight',missionRef:value.missionRef};
  value.terminalEvidence.stage='fixture-passed';
  value.terminalEvidence.qualityReceiptRef=null;
  value.terminalEvidence.uatReceiptRef=null;
  assert.deepEqual(validateOutput(value),{valid:true,errors:[]});
  value.terminalEvidence.representativeRasterArtifactRef=null;
  assert.match(validateOutput(value).errors.join('\n'),/durable raster/i);
});
