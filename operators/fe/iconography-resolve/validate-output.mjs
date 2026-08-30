import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const { outcome, result, gaps } = value.output;
  const errors = [];
  if (outcome === 'resolved') {
    if (result === null) errors.push('resolved iconography requires a result');
    else {
      const roles = result.decisions.map((item) => item.roleRef);
      if (new Set(roles).size !== roles.length) errors.push('iconography decisions must resolve each role once');
      for (const item of result.decisions) {
        if (item.source === 'heroicons' && (!item.glyphRef.startsWith('heroicons://') || item.customReason !== null)) errors.push(`${item.roleRef} must bind an upstream Heroicon without a custom reason`);
        if (item.source === 'custom-svg' && (!item.glyphRef.startsWith('icon-brief://') || item.customReason === null)) errors.push(`${item.roleRef} custom SVG requires a frozen brief and reason`);
      }
    }
    if (gaps.length !== 0) errors.push('resolved iconography cannot retain gaps');
  }
  if (outcome === 'blocked' && (result !== null || gaps.length === 0)) errors.push('blocked iconography requires null result and exact gaps');
  return errors;
});
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
