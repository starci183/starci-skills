import { validatorFor, runValidatorCli } from '../../validation.mjs';
import { grammarCoreCompilationSemantic } from '../strict-ui-validation.mjs';
import { validateGrammarDecision } from '../../../runtime/contracts/grammar-decision.mjs';

const grammar74Semantic = (value) => {
  const errors = grammarCoreCompilationSemantic(value);
  const { outcome, result, proposalRefs } = value.output;
  if (outcome === 'converged') {
    if (proposalRefs.length > 0) errors.push('$.output.proposalRefs: converged Grammar cannot retain proposals');
    if (result?.grammarDecisionManifest) {
      for (const error of validateGrammarDecision(result.grammarDecisionManifest).errors) {
        errors.push(`$.output.result.grammarDecisionManifest: ${error}`);
      }
    }
  } else if (outcome === 'grammar-gap') {
    if (result !== null) errors.push('$.output.result: grammar-gap requires null result');
    if (proposalRefs.length === 0) errors.push('$.output.proposalRefs: grammar-gap requires an approval proposal');
    if (value.output.gaps.length === 0) errors.push('$.output.gaps: grammar-gap requires exact gaps');
  } else if (proposalRefs.length > 0) {
    errors.push('$.output.proposalRefs: refused output cannot create publication proposals');
  }
  return errors;
};

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), grammar74Semantic);
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
