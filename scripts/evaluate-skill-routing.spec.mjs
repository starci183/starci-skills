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

test("evaluation reports failures without hiding them", () => {
  const report = evaluate(catalog, {cases: [
    {id: "pass", prompt: "audit state", expectedSkill: "read"},
    {id: "fail", prompt: "fix broken source", expectedSkill: "read"},
  ]});
  assert.equal(report.total, 2);
  assert.equal(report.passed, 1);
  assert.equal(report.failures[0].id, "fail");
});
