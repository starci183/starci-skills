#!/usr/bin/env node

import {existsSync, readFileSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {pathToFileURL} from "node:url";

const AXES = ["hierarchy", "density", "chrome", "componentAnatomy", "stateClarity", "responsive", "productSpecificity"];
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const occurrences = (source, pattern) => [...source.matchAll(pattern)].length;

const countWords = new Map([["three", 3], ["four", 4], ["five", 5], ["six", 6], ["seven", 7], ["eight", 8], ["nine", 9], ["ten", 10]]);

const statedStepCount = (value) => {
  const match = String(value).toLowerCase().match(/\b(three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:[a-z-]+\s+){0,2}(?:steps?|stages?)\b/);
  if (!match) return 0;
  return countWords.get(match[1]) ?? Number(match[1]);
};

const stepRegions = (candidate) => {
  const regions = new Map();
  for (const region of candidate.regions ?? []) {
    const count = (region.brief?.items ?? []).filter((item) => item.role === "step").length;
    if (count >= 3) regions.set(region.name, count);
  }
  for (const page of candidate.renderContract?.pages ?? []) for (const region of page.regions ?? []) {
    const count = statedStepCount(JSON.stringify({anatomy: region.anatomy, data: region.data, visual: region.visual}));
    if (count >= 3) regions.set(region.id, Math.max(count, regions.get(region.id) ?? 0));
  }
  return [...regions].map(([id, count]) => ({id, count}));
};

/** Refuse complete-but-juvenile previews before they consume owner approval. */
export const validateDesignMaturity = ({design, htmlIndex, maturity, htmlRoot = ".", captureRoot = "."}) => {
  const failures = [];
  const candidates = design?.candidates ?? [];
  if (candidates.length !== 1) failures.push("maturity review requires the one generated candidate");
  const candidate = candidates[0];
  if (!candidate) return {ok: false, failures};

  if (![1, 2].includes(maturity?.schemaVersion)) failures.push("maturity review schemaVersion must be 1 or 2");
  if (maturity?.candidateId !== candidate.id) failures.push("maturity review candidateId differs from the generated candidate");
  const reviewStage = maturity?.schemaVersion === 2 ? maturity.reviewStage : "states";
  const authority = reviewStage === "pages" ? candidate.pageContract : candidate.renderContract;
  if (!authority) failures.push(`maturity ${reviewStage} review has no matching design authority`);
  if (maturity?.schemaVersion === 1 && maturity?.renderContractId !== candidate.renderContract?.id) failures.push("maturity review renderContractId differs from the generated contract");
  if (maturity?.schemaVersion === 2 && maturity?.authorityId !== authority?.id) failures.push(`maturity review authorityId differs from the generated ${reviewStage === "pages" ? "page" : "render"} contract`);
  if (maturity?.verdict !== "passed") failures.push("maturity review has not passed");
  if (!Array.isArray(maturity?.defects) || maturity.defects.length !== 0) failures.push("maturity review requires zero known defects");

  for (const axis of AXES) {
    const decision = maturity?.axes?.[axis];
    if (decision?.verdict !== "passed") failures.push(`maturity axis ${axis} has not passed`);
    if (typeof decision?.evidence !== "string" || decision.evidence.trim().length < 24) failures.push(`maturity axis ${axis} lacks concrete visual evidence`);
  }

  const requiredPairs = new Set((authority?.renders ?? []).map((render) => `${render.pageId}/${render.stateId}/${render.viewportId}`));
  const inspectedPairs = new Set();
  for (const item of maturity?.inspected ?? []) {
    const key = `${item.pageId}/${item.stateId}/${item.viewportId}`;
    inspectedPairs.add(key);
    if (item.fullViewport !== "passed") failures.push(`${key} was not inspected as a full viewport`);
    if (typeof item.capture !== "string" || !/\.(?:png|jpe?g|webp)$/i.test(item.capture) || !existsSync(resolve(captureRoot, item.capture))) {
      failures.push(`${key} lacks a real maturity capture`);
    }
  }
  for (const pair of requiredPairs) if (!inspectedPairs.has(pair)) failures.push(`maturity review missed ${pair}`);

  const previewEntry = (htmlIndex?.candidates ?? []).find((entry) => entry.id === candidate.id);
  if (!previewEntry || previewEntry.functional !== true || typeof previewEntry.html !== "string") {
    failures.push("maturity review requires the functional authored preview");
    return {ok: failures.length === 0, failures};
  }
  const previewPath = resolve(htmlRoot, previewEntry.html);
  if (!existsSync(previewPath)) {
    failures.push(`maturity preview is missing: ${previewEntry.html}`);
    return {ok: false, failures};
  }
  const preview = readFileSync(previewPath, "utf8");
  if (!/data-functional-preview=["']true["']/.test(preview)) failures.push("maturity preview is not marked functional");

  const steppers = stepRegions(candidate);
  if (steppers.length > 0) {
    const expectedMarkers = steppers.reduce((total, region) => total + region.count, 0);
    const expectedConnectors = steppers.reduce((total, region) => total + region.count - 1, 0);
    const hasExecutableMappedStepper = /\.map\([\s\S]*?data-step-marker\b[\s\S]*?data-step-state=["']\$\{/.test(preview)
      && /\.map\([\s\S]*?data-step-connector/.test(preview);
    for (const region of steppers) {
      if (!slug.test(region.id ?? "") || !new RegExp(`data-stepper=["']${region.id}["']`).test(preview)) {
        failures.push(`${region.id} is sequential progress but has no named stepper owner`);
      }
    }
    if (!hasExecutableMappedStepper && occurrences(preview, /data-step-marker\b/g) < expectedMarkers) failures.push(`sequential progress needs at least ${expectedMarkers} stable step markers`);
    if (!hasExecutableMappedStepper && occurrences(preview, /data-step-connector\b/g) < expectedConnectors) failures.push(`sequential progress needs at least ${expectedConnectors} connectors`);
    const stateCount = occurrences(preview, /data-step-state=["'](?:completed|current|upcoming)["']/g);
    if (!hasExecutableMappedStepper && stateCount < expectedMarkers) failures.push("every progress marker must expose completed, current or upcoming state");
    if (!hasExecutableMappedStepper && occurrences(preview, /data-step-state=["']current["']/g) < steppers.length) failures.push("every stepper needs one visible current step");
  }

  return {ok: failures.length === 0, failures};
};

const args = (argv) => {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) result[argv[index]?.replace(/^--/, "")] = argv[index + 1];
  return result;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = args(process.argv.slice(2));
  if (!input.design || !input.htmlIndex || !input.maturity) {
    console.error("Usage: node scripts/validate-design-maturity.mjs --design <design.json> --html-index <html-index.json> --maturity <maturity-review.json>");
    process.exitCode = 2;
  } else {
    const designPath = resolve(input.design);
    const htmlIndexPath = resolve(input.htmlIndex);
    const maturityPath = resolve(input.maturity);
    const verdict = validateDesignMaturity({
      design: JSON.parse(readFileSync(designPath, "utf8")),
      htmlIndex: JSON.parse(readFileSync(htmlIndexPath, "utf8")),
      maturity: JSON.parse(readFileSync(maturityPath, "utf8")),
      htmlRoot: dirname(htmlIndexPath),
      captureRoot: dirname(maturityPath),
    });
    if (!verdict.ok) {
      console.error(verdict.failures.join("\n"));
      process.exitCode = 1;
    } else console.log("design maturity holds");
  }
}
