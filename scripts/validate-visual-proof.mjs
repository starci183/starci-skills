#!/usr/bin/env node

import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

const rank = new Map([["working-tree", 0], ["verified-local", 1], ["committed", 2], ["pushed", 3], ["merged", 4]]);

export function validateVisualProof(baseline, proof) {
  const failures = [];
  if ((proof.knownDefects ?? []).length) failures.push("known visual defects remain");
  if ((rank.get(proof.actualTerminalState) ?? -1) < (rank.get(proof.requestedTerminalState) ?? 99)) failures.push(`delivery stopped at ${proof.actualTerminalState} before requested ${proof.requestedTerminalState}`);
  for (const name of ["build", "lint", "tests", "browser"]) if (proof.checks?.[name] !== "passed") failures.push(`${name} is not passed`);
  const comparisons = proof.comparisons ?? [];
  for (const reference of baseline.references ?? []) {
    const match = comparisons.find((item) => item.referenceId === reference.id && item.state === reference.state && item.viewport?.width === reference.viewport.width && item.viewport?.height === reference.viewport.height);
    if (!match) failures.push(`missing same-viewport comparison for ${reference.id}`);
    else if (match.fullViewport !== "passed" || match.targetRegion !== "passed" || match.preservedRegions !== "passed" || match.consoleClean !== true) failures.push(`comparison is incomplete for ${reference.id}`);
  }
  return {ok: failures.length === 0, failures};
}

const args = Object.fromEntries(process.argv.slice(2).flatMap((value, index, values) => value.startsWith("--") ? [[value.slice(2), values[index + 1]]] : []));
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!args.baseline || !args.proof) throw new Error("Usage: --baseline <baseline.json> --proof <visual-proof.json>");
  const verdict = validateVisualProof(JSON.parse(readFileSync(resolve(args.baseline), "utf8")), JSON.parse(readFileSync(resolve(args.proof), "utf8")));
  if (!verdict.ok) { console.error(verdict.failures.join("\n")); process.exitCode = 1; }
  else console.log("visual proof holds");
}
