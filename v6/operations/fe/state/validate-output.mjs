import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {runValidatorCli, validateDefinition} from "./validate-input.mjs";

export function validateOutput(value) {
  return validateDefinition(value, "output", (document) => {
    const errors = [];
    const {states, unknowns} = document.payload;
    const stateIds = states.map((state) => state.id);
    const knownStates = new Set(stateIds);
    if (knownStates.size !== stateIds.length) errors.push("$.payload.states: state ids must be unique");
    states.forEach((state, index) => {
      state.transitionTargets.forEach((target) => {
        if (!knownStates.has(target)) errors.push(`$.payload.states[${index}].transitionTargets: unknown state ${target}`);
      });
      if (state.provenance === "business" && state.evidenceRefs.length === 0) errors.push(`$.payload.states[${index}].evidenceRefs: business state requires evidence`);
      if (state.provenance === "derived-block" && state.derivedFromRefs.length === 0) errors.push(`$.payload.states[${index}].derivedFromRefs: derived state requires an owning derivation`);
    });
    unknowns.forEach((unknown, index) => {
      if (unknown.sensitivity !== null && unknown.blocking !== true) errors.push(`$.payload.unknowns[${index}].blocking: sensitive unknown must block`);
    });
    const blockingSensitive = unknowns.some((unknown) => unknown.sensitivity !== null && unknown.blocking === true);
    if (document.stage === "layout.generate" && blockingSensitive) errors.push("$.stage: layout cannot start while a sensitive unknown exists");
    if (document.stage === "state.result" && !blockingSensitive) errors.push("$.payload.unknowns: blocked result requires a sensitive unknown");
    return errors;
  });
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) await runValidatorCli("validate-output.mjs", validateOutput);
