#!/usr/bin/env node

import {existsSync, readFileSync} from "node:fs";
import {dirname, relative, resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {comparePng} from "./compare-png.mjs";

const rank = new Map([["working-tree", 0], ["verified-local", 1], ["committed", 2], ["pushed", 3], ["merged", 4]]);
const canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])) : value;
const canonical = (value) => JSON.stringify(canonicalize(value));
const inside = (root, file, label) => {
  const base = resolve(root);
  const target = resolve(base, file ?? "");
  const offset = relative(base, target);
  if (!file || offset.startsWith("..") || resolve(base, offset) !== target) throw new Error(`${label} escapes its evidence root`);
  return target;
};
const jsonFile = (root, file, label) => {
  const target = inside(root, file, label);
  if (!file || !existsSync(target)) throw new Error(`${label} is missing`);
  return JSON.parse(readFileSync(target, "utf8"));
};

export function validateVisualProof(baseline, proof, {baselineRoot = ".", proofRoot = "."} = {}) {
  const failures = [];
  const measurements = [];
  if (proof.schemaVersion !== 3) failures.push("visual proof schemaVersion must be 3");
  if (!/^[a-f0-9]{64}$/.test(proof.candidateAt ?? "")) failures.push("candidateAt must bind the selected candidate hash");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(proof.renderContractId ?? "")) failures.push("renderContractId must bind the selected render contract");
  if ((proof.knownDefects ?? []).length) failures.push("known visual defects remain");
  if ((rank.get(proof.actualTerminalState) ?? -1) < (rank.get(proof.requestedTerminalState) ?? 99)) failures.push(`delivery stopped at ${proof.actualTerminalState} before requested ${proof.requestedTerminalState}`);
  for (const name of ["build", "lint", "tests", "browser"]) if (proof.checks?.[name] !== "passed") failures.push(`${name} is not passed`);
  const comparisons = proof.comparisons ?? [];
  for (const reference of baseline.references ?? []) {
    const match = comparisons.find((item) => item.referenceId === reference.id && item.state === reference.state && item.viewport?.width === reference.viewport.width && item.viewport?.height === reference.viewport.height);
    if (!match) { failures.push(`missing same-viewport comparison for ${reference.id}`); continue; }
    try {
      const previewCapture = inside(proofRoot, match.previewCapture, "preview capture");
      const sourceCapture = inside(proofRoot, match.sourceCapture, "source capture");
      if (!existsSync(previewCapture) || !existsSync(sourceCapture) || previewCapture === sourceCapture) throw new Error("distinct PNG preview/source captures are required");
      const visual = comparePng(previewCapture, sourceCapture, reference.visualThresholds);
      const scale = reference.deviceScaleFactor ?? 1;
      if (visual.width !== reference.viewport.width * scale || visual.height !== reference.viewport.height * scale) throw new Error("capture pixels do not match the declared viewport and device scale");
      if (!visual.passed) throw new Error(`computed visual diff failed: changedRatio=${visual.changedRatio}, meanDelta=${visual.meanDelta}`);

      const previewDom = jsonFile(baselineRoot, reference.previewDomSnapshot, "preview DOM snapshot");
      const sourceDom = jsonFile(proofRoot, match.sourceDomSnapshot, "source DOM snapshot");
      if (canonical(previewDom) !== canonical(sourceDom)) throw new Error("computed DOM structure differs from the approved preview snapshot");

      const accessibility = jsonFile(proofRoot, match.accessibilityReport, "accessibility report");
      if (accessibility.tool !== "axe-core" || !Array.isArray(accessibility.violations) || accessibility.violations.length !== 0) throw new Error("axe-core accessibility report contains violations or has unknown provenance");

      const trace = jsonFile(proofRoot, match.interactionTrace, "interaction trace");
      if (trace.tool !== "playwright" || !Array.isArray(trace.actions) || !Array.isArray(trace.consoleErrors) || !Array.isArray(trace.failedRequests)) throw new Error("Playwright interaction trace has unknown or incomplete provenance");
      if (trace.consoleErrors.length || trace.failedRequests.length) throw new Error("interaction trace contains console or network failures");
      for (const required of reference.requiredInteractions ?? []) {
        if (!trace.actions.some((action) => action.id === required && action.status === "passed")) throw new Error(`interaction trace did not pass required action ${required}`);
      }
      measurements.push({referenceId: reference.id, visual, dom: "equal", accessibilityViolations: 0, interactionsPassed: (reference.requiredInteractions ?? []).length});
    } catch (error) {
      failures.push(`${reference.id}: ${error.message}`);
    }
  }
  return {ok: failures.length === 0, failures, measurements};
}

const args = Object.fromEntries(process.argv.slice(2).flatMap((value, index, values) => value.startsWith("--") ? [[value.slice(2), values[index + 1]]] : []));
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!args.baseline || !args.proof) throw new Error("Usage: --baseline <baseline.json> --proof <visual-proof.json>");
  const baselinePath = resolve(args.baseline);
  const proofPath = resolve(args.proof);
  const verdict = validateVisualProof(JSON.parse(readFileSync(baselinePath, "utf8")), JSON.parse(readFileSync(proofPath, "utf8")), {baselineRoot: dirname(baselinePath), proofRoot: dirname(proofPath)});
  if (!verdict.ok) { console.error(verdict.failures.join("\n")); process.exitCode = 1; }
  else console.log(JSON.stringify({status: "passed", measurements: verdict.measurements}));
}
