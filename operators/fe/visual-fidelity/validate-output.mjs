import { validatorFor, runValidatorCli } from '../../validation.mjs';
import { visualFidelityOutputSemantic } from '../strict-ui-validation.mjs';
export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = visualFidelityOutputSemantic(value);
  const result = value.output.result;
  if (!result) return errors;

  const packetRasterRefs = result.packetRasterRefs;
  const inspectedRasterRefs = result.inspectionRecords.map(({ imageRef }) => imageRef);
  if (packetRasterRefs.length !== inspectedRasterRefs.length ||
      packetRasterRefs.some((imageRef, index) => imageRef !== inspectedRasterRefs[index])) {
    errors.push('$.output.result.inspectionRecords: must preserve exact packet raster order one-for-one');
  }

  const packetRasters = new Set(packetRasterRefs);
  for (const [index, probe] of result.probeRecords.entries()) {
    const at = `$.output.result.probeRecords[${index}].imageRef`;
    if (probe.verdict === 'not-applicable' && probe.imageRef !== null) {
      errors.push(`${at}: not-applicable requires null`);
    }
    if (probe.verdict !== 'not-applicable' && typeof probe.imageRef !== 'string') {
      errors.push(`${at}: survived or contradiction requires an exact packet raster ref`);
    }
    if (typeof probe.imageRef === 'string' && !packetRasters.has(probe.imageRef)) {
      errors.push(`${at}: probe raster is absent from packetRasterRefs`);
    }
  }
  return errors;
});
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
