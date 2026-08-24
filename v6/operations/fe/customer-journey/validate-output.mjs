import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {runValidatorCli, validateDefinition} from "./validate-input.mjs";

export function validateOutput(value) {
  return validateDefinition(value, "output", (document) => {
    const errors = [];
    const directions = document.payload.directions;
    const ids = directions.map((direction) => direction.id);
    if (new Set(ids).size !== ids.length) errors.push("$.payload.directions: direction ids must be unique");
    if (!ids.includes(document.payload.recommendedDirectionId)) errors.push("$.payload.recommendedDirectionId: must name a direction in this batch");
    const axes = directions.map((direction) => direction.materialAxis.trim().toLowerCase());
    if (new Set(axes).size !== axes.length) errors.push("$.payload.directions: every direction must use a materially distinct axis");
    directions.forEach((direction, directionIndex) => {
      const sequences = direction.steps.map((step) => step.sequence);
      if (sequences.some((sequence, index) => sequence !== index + 1)) errors.push(`$.payload.directions[${directionIndex}].steps: sequence must be contiguous from 1`);
      if (direction.steps.length > 1 && (direction.journeyProgress.required !== true || direction.journeyProgress.ownerScope !== "global")) {
        errors.push(`$.payload.directions[${directionIndex}].journeyProgress: multi-step journey requires one global progress owner`);
      }
      if (direction.steps.length === 1 && direction.journeyProgress.required === false && direction.journeyProgress.ownerScope !== "none") {
        errors.push(`$.payload.directions[${directionIndex}].journeyProgress.ownerScope: optional progress must use none`);
      }
    });
    return errors;
  });
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) await runValidatorCli("validate-output.mjs", validateOutput);
