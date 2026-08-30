import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';
const digest = (ref) => ref?.match(/[0-9a-f]{64}$/)?.[0];

export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const issues=[];
  const { outcome, handoff, artifactRefs, terminalEvidence: evidence }=value;
  const required=(label,ref)=>{ if(!ref) issues.push(`${label} is required`); };
  const bind=(label,ref)=>{ if(ref&&!artifactRefs.includes(ref)) issues.push(`${label} must be bound in artifactRefs`); };
  const operatorRefs=[evidence.directionQualityReceiptRef,evidence.visualFidelityReceiptRef,evidence.qualityReceiptRef,evidence.uatReceiptRef].filter(Boolean);
  for(const ref of operatorRefs) if(!evidence.operatorReceiptRefs.includes(ref)) issues.push(`operator receipt is not bound: ${ref}`);
  for(const [label,ref] of [
    ['directionQualityReceiptRef',evidence.directionQualityReceiptRef],
    ['representativeRasterRef',evidence.representativeRasterRef],
    ['representativeRasterArtifactRef',evidence.representativeRasterArtifactRef],
    ['visualFidelityReceiptRef',evidence.visualFidelityReceiptRef],
    ['qualityReceiptRef',evidence.qualityReceiptRef],
    ['uatReceiptRef',evidence.uatReceiptRef],
    ['buildEvidenceRef',evidence.buildEvidenceRef],
  ]) bind(label,ref);
  for(const ref of evidence.testEvidenceRefs) bind('testEvidenceRef',ref);
  if(evidence.representativeRasterRef&&evidence.representativeRasterArtifactRef&&digest(evidence.representativeRasterRef)!==digest(evidence.representativeRasterArtifactRef)) issues.push('representative raster and durable artifact must bind the same digest');

  if(outcome==='complete'){
    if(evidence.stage!=='live-complete') issues.push('complete requires live-complete terminal evidence');
    if(handoff!==null) issues.push('complete cannot claim a handoff');
    for(const [label,ref] of [['direction quality',evidence.directionQualityReceiptRef],['representative raster',evidence.representativeRasterRef],['durable raster',evidence.representativeRasterArtifactRef],['visual fidelity',evidence.visualFidelityReceiptRef],['quality',evidence.qualityReceiptRef],['UAT',evidence.uatReceiptRef],['build',evidence.buildEvidenceRef]]) required(label,ref);
    if(!evidence.testEvidenceRefs.length) issues.push('complete requires test evidence');
  }
  if(outcome==='handoff'){
    if(handoff===null) issues.push('handoff outcome requires a typed handoff');
    if(!['fixture-passed','pre-proof-handoff'].includes(evidence.stage)) issues.push('handoff requires fixture-passed or pre-proof-handoff evidence');
    if(evidence.stage==='fixture-passed'){
      for(const [label,ref] of [['direction quality',evidence.directionQualityReceiptRef],['representative raster',evidence.representativeRasterRef],['durable raster',evidence.representativeRasterArtifactRef],['visual fidelity',evidence.visualFidelityReceiptRef],['build',evidence.buildEvidenceRef]]) required(label,ref);
      if(!evidence.testEvidenceRefs.length) issues.push('fixture-passed requires test evidence');
    }
  }
  if(outcome==='waiting-choice'&&(evidence.stage!=='waiting-choice'||handoff!==null)) issues.push('waiting-choice requires waiting-choice evidence and no handoff');
  if(outcome==='blocked'&&(evidence.stage!=='blocked'||handoff!==null)) issues.push('blocked requires blocked evidence and no handoff');
  return issues;
});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
