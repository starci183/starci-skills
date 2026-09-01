import { validatorFor, runValidatorCli } from '../../validation.mjs';
import { renderCaptureOutputSemantic } from '../strict-ui-validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const errors=renderCaptureOutputSemantic(value);
  const {outcome,result,gaps,evidenceRefs,handoff}=value.output;
  if(outcome==='captured'){
    if(result===null) errors.push('$.output.result: captured requires structured evidence');
    if(gaps.length!==0) errors.push('$.output.gaps: captured cannot retain gaps');
    if(evidenceRefs.length===0) errors.push('$.output.evidenceRefs: captured requires exact evidence');
    if(handoff!==null) errors.push('$.output.handoff: captured cannot emit a handoff');
    if(result&&!evidenceRefs.includes(result.preflightRef)) errors.push('$.output.evidenceRefs: missing preflightRef');
    if(result&&!evidenceRefs.includes(result.compiledRequestRef)) errors.push('$.output.evidenceRefs: missing compiledRequestRef');
    if(result&&!evidenceRefs.includes(result.sourceApplyReturnReceiptRef)) errors.push('$.output.evidenceRefs: missing sourceApplyReturnReceiptRef');
    const rasterRefs=result===null?[]:[
      result.handoffHostArtifact.imageRef,
      ...result.renderMatrix.map(({imageRef})=>imageRef),
      ...result.adversarialProbeMatrix.filter(({outcome:probeOutcome})=>probeOutcome!=='not-applicable').map(({imageRef})=>imageRef),
    ];
    for(const rasterRef of rasterRefs) if(!result.artifactRefs.includes(rasterRef)) errors.push(`$.output.result.artifactRefs: missing captured raster ${rasterRef}`);
  }
  if(outcome==='blocked'){
    if(result!==null) errors.push('$.output.result: blocked capture requires null');
    if(gaps.length===0) errors.push('$.output.gaps: blocked capture requires exact gaps');
    if(evidenceRefs.length===0) errors.push('$.output.evidenceRefs: blocked capture requires exact evidence');
    if(handoff!==null) errors.push('$.output.handoff: blocked capture cannot emit a handoff');
  }
  return errors;
});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
