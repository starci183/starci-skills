#!/usr/bin/env node

import {existsSync, readFileSync, readdirSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

const json = (path) => JSON.parse(readFileSync(path, "utf8"));

export function validatePrinciples(sourceRoot) {
  const root = resolve(sourceRoot);
  const principleRoot = resolve(root, "knowledge/compilers/principles");
  const profileRoot = resolve(root, "knowledge/grammars/starci/profiles");
  const modules = readdirSync(principleRoot, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && existsSync(resolve(principleRoot, entry.name, "context.md")))
    .map((entry) => entry.name).sort();
  const schemaConcerns = [...json(resolve(profileRoot, "profile.schema.json")).$defs.Concern.enum].sort();
  const failures = [];
  if (JSON.stringify(modules) !== JSON.stringify(schemaConcerns)) failures.push(`principle concern catalog differs from real modules: schema=${schemaConcerns.join(",")} modules=${modules.join(",")}`);

  const profiles = readdirSync(profileRoot).filter((name) => name.endsWith(".json") && name !== "profile.schema.json").map((name) => json(resolve(profileRoot, name)));
  for (const profile of profiles) for (const [outcome, owner] of Object.entries(profile.owners)) {
    for (const concern of owner.principleConcerns) if (!modules.includes(concern)) failures.push(`${profile.profileId}/${outcome} references missing principle ${concern}`);
  }

  const cases = json(resolve(principleRoot, "cases.json")).cases;
  const caseIds = new Set();
  for (const item of cases) {
    if (caseIds.has(item.caseId)) failures.push(`duplicate principle case ${item.caseId}`);
    caseIds.add(item.caseId);
    if (!modules.includes(item.module)) failures.push(`${item.caseId} references missing module ${item.module}`);
    if (item.directChildren.length < 2) failures.push(`${item.caseId} has no sibling relationship to resolve`);
    const context = existsSync(resolve(principleRoot, item.module, "context.md")) ? readFileSync(resolve(principleRoot, item.module, "context.md"), "utf8") : "";
    if (!context.includes(item.expectedSituation)) failures.push(`${item.caseId} expects unknown situation ${item.expectedSituation}`);
    if (item.expectedClass !== "no flow class" && !context.includes(item.expectedClass)) failures.push(`${item.caseId} expects class absent from ${item.module}: ${item.expectedClass}`);
    if (item.maxStatusChips !== undefined && !context.includes("at most one semantic status")) failures.push(`${item.caseId} has no status-example boundary in flow law`);
  }
  return {ok: failures.length === 0, failures, modules, cases: cases.length};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = process.argv[2] ?? resolve(import.meta.dirname, "..");
  const verdict = validatePrinciples(source);
  if (!verdict.ok) { console.error(verdict.failures.join("\n")); process.exitCode = 1; }
  else console.log(JSON.stringify({principles: verdict.modules.length, cases: verdict.cases}));
}
