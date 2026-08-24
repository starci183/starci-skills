import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {runValidatorCli, validateDefinition} from "./validate-input.mjs";

export function validateOutput(value) {
  return validateDefinition(value, "output", (document) => {
    const roots = document.payload.writeRoots;
    return roots.some((root) => root === "." || root.includes(".."))
      ? ["$.payload.writeRoots: roots must be explicit workspace-owned paths without dot traversal"]
      : [];
  });
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) await runValidatorCli("validate-output.mjs", validateOutput);
