import assert from "node:assert/strict";
import test from "node:test";
import {evaluate, normalize, routePrompt} from "./evaluate-skill-routing.mjs";

const catalog = {
  skills: [
    {id: "read", description: "Inspect state without changes", intent: ["inspect state", "read only"], excludes: ["repair"], aliases: ["audit"], modes: ["inspect"]},
    {id: "repair", description: "Repair broken state", intent: ["repair broken source"], excludes: ["without changes"], aliases: ["fix"], modes: ["repair"]},
  ],
};

test("normalization preserves routing meaning across Vietnamese diacritics", () => {
  assert.equal(normalize("Triển khai và sửa lỗi"), "trien khai va sua loi");
});

test("router combines exact phrases, weighted terms, aliases, and exclusions", () => {
  assert.equal(routePrompt(catalog, "audit and inspect state without changes").winner.skill, "read");
  assert.equal(routePrompt(catalog, "fix and repair broken source").winner.skill, "repair");
});

test("router abstains on irrelevant, ambiguous, excluded, and missing-authority requests", () => {
  assert.equal(routePrompt(catalog, "What is two plus two?").stopReason, "insufficient-relevance");
  assert.equal(routePrompt(catalog, "Please improve this").verdict, "stop");
  assert.equal(routePrompt(catalog, "Repair this, but make no changes").stopReason, "permission-intent-conflict");
});

test("negated work does not outrank the requested action", () => {
  const backend = {
    skills: [
      {id: "plan", risk: "local-write", description: "Plan backend work", intent: ["create backend plan"], aliases: ["backend plan"], modes: ["plan"], excludes: ["source implementation"], read: [], write: ["brief"]},
      {id: "implement", risk: "source-write", description: "Implement approved backend brief", intent: ["implement backend brief"], aliases: ["backend implementation"], modes: ["implement"], excludes: ["planning without implementation"], read: ["approved brief"], write: ["source"]},
    ],
  };
  assert.equal(routePrompt(backend, "Do not create another plan; implement the approved backend brief").winner.skill, "implement");
});

test("evaluation reports failures without hiding them", () => {
  const report = evaluate(catalog, {cases: [
    {id: "pass", prompt: "audit state", expectedSkill: "read"},
    {id: "fail", prompt: "fix broken source", expectedSkill: "read"},
  ]});
  assert.equal(report.total, 2);
  assert.equal(report.passed, 1);
  assert.equal(report.failures[0].id, "fail");
});

test("evaluation represents expected stop verdicts", () => {
  const report = evaluate(catalog, {cases: [
    {id: "stop", prompt: "unrelated arithmetic question", expectedStop: "insufficient-relevance"},
  ]});
  assert.equal(report.schemaVersion, 2);
  assert.equal(report.passed, 1);
});
