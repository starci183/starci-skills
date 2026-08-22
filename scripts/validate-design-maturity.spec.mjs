import assert from "node:assert/strict";
import {mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {validateDesignMaturity} from "./validate-design-maturity.mjs";

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "starci-maturity-"));
  const html = [
    '<html data-functional-preview="true">',
    '<div data-stepper="provisioning-progress">',
    '<span data-step-marker data-step-state="completed"></span><i data-step-connector></i>',
    '<span data-step-marker data-step-state="current"></span><i data-step-connector></i>',
    '<span data-step-marker data-step-state="upcoming"></span><i data-step-connector></i>',
    '<span data-step-marker data-step-state="upcoming"></span>',
    '</div></html>',
  ].join("");
  writeFileSync(join(root, "preview.html"), html);
  writeFileSync(join(root, "capture.png"), "capture");
  const design = {candidates: [{
    id: "mature-console",
    regions: [{name: "provisioning-progress", brief: {items: [1, 2, 3, 4].map((value) => ({role: "step", label: String(value)}))}}],
    renderContract: {id: "mature-console-contract", pages: [{id: "app", regions: [{id: "provisioning-progress", anatomy: ["four provisioning steps"], data: {}, visual: {}}]}], renders: [{pageId: "app", stateId: "ready", viewportId: "desktop"}]},
  }]};
  const htmlIndex = {candidates: [{id: "mature-console", html: "preview.html", functional: true}]};
  const axes = Object.fromEntries(["hierarchy", "density", "chrome", "componentAnatomy", "stateClarity", "responsive", "productSpecificity"].map((axis) => [axis, {verdict: "passed", evidence: `${axis} is proven in the full viewport capture.`}]));
  const maturity = {schemaVersion: 1, candidateId: "mature-console", renderContractId: "mature-console-contract", verdict: "passed", axes, inspected: [{pageId: "app", stateId: "ready", viewportId: "desktop", capture: "capture.png", fullViewport: "passed"}], defects: []};
  return {root, design, htmlIndex, maturity};
};

test("a captured product-specific stepper passes the maturity gate", () => {
  const value = fixture();
  const verdict = validateDesignMaturity({...value, htmlRoot: value.root, captureRoot: value.root});
  assert.equal(verdict.ok, true, verdict.failures.join("\n"));
});

test("a deterministic mapped stepper passes the maturity gate", () => {
  const value = fixture();
  writeFileSync(join(value.root, "preview.html"), '<html data-functional-preview="true"><div data-stepper="provisioning-progress"></div><script>const steps=[["1","completed"],["2","current"],["3","upcoming"],["4","upcoming"]];steps.map(step=>`<div ${step[0]!=="4"?"data-step-connector":""}><span data-step-marker data-step-state="${step[1]}"></span></div>`)</script></html>');
  const verdict = validateDesignMaturity({...value, htmlRoot: value.root, captureRoot: value.root});
  assert.equal(verdict.ok, true, verdict.failures.join("\n"));
});

test("page-stage maturity uses the page contract before render authority exists", () => {
  const value = fixture();
  const candidate = value.design.candidates[0];
  candidate.pageContract = {id: "mature-console-pages", renders: [{pageId: "app", stateId: "ready", viewportId: "desktop"}]};
  delete candidate.renderContract;
  value.maturity = {...value.maturity, schemaVersion: 2, reviewStage: "pages", authorityId: "mature-console-pages"};
  delete value.maturity.renderContractId;
  const verdict = validateDesignMaturity({...value, htmlRoot: value.root, captureRoot: value.root});
  assert.equal(verdict.ok, true, verdict.failures.join("\n"));
});

test("disconnected numbers and pills are refused as sequential progress", () => {
  const value = fixture();
  writeFileSync(join(value.root, "preview.html"), '<html data-functional-preview="true"><div>1 Request Current 2 Build Upcoming 3 Deploy Upcoming 4 Manage Upcoming</div></html>');
  assert.match(validateDesignMaturity({...value, htmlRoot: value.root, captureRoot: value.root}).failures.join("\n"), /stepper owner|step markers|connectors/);
});

test("render-contract progress cannot hide behind an abbreviated brief", () => {
  const value = fixture();
  value.design.candidates[0].regions[0].brief.items = [{role: "step", label: "Request"}];
  writeFileSync(join(value.root, "preview.html"), '<html data-functional-preview="true"><div>Request · Current · Create app · Upcoming · Build · Upcoming · Manage · Upcoming</div></html>');
  assert.match(validateDesignMaturity({...value, htmlRoot: value.root, captureRoot: value.root}).failures.join("\n"), /stepper owner|step markers|connectors/);
});

test("a self-declared pass without full-viewport evidence is refused", () => {
  const value = fixture();
  value.maturity.inspected = [];
  assert.match(validateDesignMaturity({...value, htmlRoot: value.root, captureRoot: value.root}).failures.join("\n"), /missed app\/ready\/desktop/);
});
