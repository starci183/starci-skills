import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {runValidatorCli, validateDefinition} from "./validate-input.mjs";

export function validateOutput(value) {
  return validateDefinition(value, "output", (document) => {
    const errors = [];
    const {globalBlocks, pages} = document.payload.journey;
    const pageIds = pages.map((page) => page.id);
    if (new Set(pageIds).size !== pageIds.length) errors.push("$.payload.journey.pages: page ids must be unique");
    if (pages.some((page, index) => page.sequence !== index + 1)) errors.push("$.payload.journey.pages: sequence must be contiguous from 1");
    const blockIds = pages.flatMap((page) => page.blocks.map((block) => block.id));
    if (new Set(blockIds).size !== blockIds.length) errors.push("$.payload.journey.pages[].blocks: Block ids must be unique across the journey");
    if (pages.length > 1) {
      if (globalBlocks.length !== 1) errors.push("$.payload.journey.globalBlocks: multi-page journey requires exactly one global progress owner");
      const ownerId = globalBlocks[0]?.id;
      pages.forEach((page, index) => {
        if (page.journeyProgressRef !== ownerId) errors.push(`$.payload.journey.pages[${index}].journeyProgressRef: must reference global owner ${ownerId ?? "<missing>"}`);
      });
    } else if (globalBlocks.length === 0 && pages[0]?.journeyProgressRef !== null) {
      errors.push("$.payload.journey.pages[0].journeyProgressRef: must be null when no global progress owner exists");
    }
    return errors;
  });
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) await runValidatorCli("validate-output.mjs", validateOutput);
