#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const defaultTrustRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(failures, condition, message) {
  if (!condition) failures.push(message);
}

function headings(text) {
  return text.split(/\r?\n/).filter((line) => /^#{2,6} /.test(line)).map((line) => line.match(/^#+/)[0].length);
}

function targetSkills(text) {
  return [...new Set([...text.matchAll(/`(starci-[a-z0-9-]+)`/g)].map((match) => match[1]))].sort();
}

function sortedObject(value) {
  return Object.fromEntries(Object.entries(value ?? {}).sort(([left], [right]) => left.localeCompare(right)));
}

function validateSchema(value, schema, location, failures) {
  if (Object.hasOwn(schema, "const")) fail(failures, value === schema.const, `${location} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum) fail(failures, schema.enum.includes(value), `${location} must be one of ${schema.enum.join(", ")}`);
  if (schema.type === "object") {
    const isObject = value && typeof value === "object" && !Array.isArray(value);
    fail(failures, isObject, `${location} must be an object`);
    if (!isObject) return;
    for (const required of schema.required ?? []) fail(failures, Object.hasOwn(value, required), `${location}.${required} is required`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) fail(failures, Object.hasOwn(schema.properties ?? {}, key), `${location}.${key} is not allowed by facade.schema.json`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) validateSchema(value[key], child, `${location}.${key}`, failures);
    }
  } else if (schema.type === "array") {
    fail(failures, Array.isArray(value), `${location} must be an array`);
    if (!Array.isArray(value)) return;
    if (schema.minItems !== undefined) fail(failures, value.length >= schema.minItems, `${location} must contain at least ${schema.minItems} item(s)`);
    if (schema.maxItems !== undefined) fail(failures, value.length <= schema.maxItems, `${location} must contain at most ${schema.maxItems} item(s)`);
    if (schema.items) value.forEach((item, index) => validateSchema(item, schema.items, `${location}[${index}]`, failures));
  } else if (schema.type === "string") {
    fail(failures, typeof value === "string", `${location} must be a string`);
    if (typeof value !== "string") return;
    if (schema.minLength !== undefined) fail(failures, value.length >= schema.minLength, `${location} must contain at least ${schema.minLength} character(s)`);
    if (schema.pattern) fail(failures, new RegExp(schema.pattern).test(value), `${location} does not match ${schema.pattern}`);
  } else if (schema.type === "integer") {
    fail(failures, Number.isInteger(value), `${location} must be an integer`);
    if (Number.isInteger(value) && schema.minimum !== undefined) fail(failures, value >= schema.minimum, `${location} must be at least ${schema.minimum}`);
  }
}

export function validateFacades(trustRoot = defaultTrustRoot) {
  const failures = [];
  const facadeRoot = path.join(trustRoot, "skill-runtime", "facades");
  const facadeSchema = JSON.parse(fs.readFileSync(path.join(facadeRoot, "facade.schema.json"), "utf8"));
  const catalogPath = path.join(trustRoot, "skill-runtime", "catalog", "catalog.json");
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const macros = new Map(catalog.macros.map((macro) => [macro.id, macro]));
  const physicalSkills = new Set(catalog.skills.map((skill) => skill.id));
  const directories = fs.readdirSync(facadeRoot, {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  fail(failures, JSON.stringify(directories) === JSON.stringify([...macros.keys()].sort()), "facade directories must exactly cover catalog macros");

  for (const directory of directories) {
    const root = path.join(facadeRoot, directory);
    const jsonPath = path.join(root, "facade.json");
    for (const file of ["facade.json", "context.md", "en.md", "vi.md"]) {
      fail(failures, fs.existsSync(path.join(root, file)), `${directory} is missing ${file}`);
    }
    fail(failures, !fs.existsSync(path.join(root, "SKILL.md")), `${directory} facade must not be a physical skill`);
    if (!fs.existsSync(jsonPath)) continue;
    const facade = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    validateSchema(facade, facadeSchema, directory, failures);
    fail(failures, facade.schemaVersion === 1, `${directory} schemaVersion must equal 1`);
    fail(failures, facade.facadeId === directory, `${directory} facadeId must match its directory`);
    fail(failures, facade.kind === "semantic-skill-facade" && facade.executable === false, `${directory} must be non-executable semantic metadata`);
    fail(failures, facade.permissions?.selectionOnly === true && facade.permissions?.writes?.length === 0 && facade.permissions?.externalMutations === false && facade.permissions?.approvalTransfer === false, `${directory} facade may select only and transfer no permission`);
    fail(failures, facade.dispatch?.loadsTargetSkill === false && facade.dispatch?.startsTargetSeparately === true && facade.dispatch?.targetOwnsApprovalAndProof === true && facade.dispatch?.requiresOwnOrchestrationProfile === false, `${directory} has an unsafe dispatch contract`);
    const routes = Object.fromEntries((facade.modes ?? []).map((mode) => [mode.id, mode.targetSkill]));
    fail(failures, Object.keys(routes).length === (facade.modes ?? []).length, `${directory} repeats a mode id`);
    fail(failures, JSON.stringify(sortedObject(routes)) === JSON.stringify(sortedObject(macros.get(directory)?.routes)), `${directory} modes must exactly match generated catalog routes`);
    for (const target of Object.values(routes)) fail(failures, physicalSkills.has(target), `${directory} routes unknown physical skill ${target}`);

    if (facade.preDispatch) {
      const command = String(facade.preDispatch.command ?? "").split(/\s+/).filter(Boolean);
      const scriptIndex = command.findIndex((part) => /\.(?:py|mjs)$/.test(part));
      const script = scriptIndex >= 0 ? command[scriptIndex] : null;
      fail(failures, facade.preDispatch.kind === "read-only-evidence", `${directory} preDispatch must be read-only evidence`);
      fail(failures, script && fs.existsSync(path.resolve(trustRoot, "..", script)), `${directory} preDispatch command points to a missing script`);
    }

    if (!["context.md", "en.md", "vi.md"].every((file) => fs.existsSync(path.join(root, file)))) continue;
    const context = fs.readFileSync(path.join(root, "context.md"), "utf8");
    const en = fs.readFileSync(path.join(root, "en.md"), "utf8");
    const vi = fs.readFileSync(path.join(root, "vi.md"), "utf8");
    fail(failures, JSON.stringify(headings(en)) === JSON.stringify(headings(vi)), `${directory} EN/VI section shape differs`);
    const expectedTargets = [...new Set(Object.values(routes))].sort();
    for (const [lane, text] of [["context", context], ["en", en], ["vi", vi]]) {
      fail(failures, JSON.stringify(targetSkills(text)) === JSON.stringify(expectedTargets), `${directory} ${lane} targets differ from facade.json`);
    }
  }
  return {ok: failures.length === 0, failures, facadeCount: directories.length, skillCount: physicalSkills.size};
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const verdict = validateFacades();
  if (!verdict.ok) {
    for (const failure of verdict.failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else console.log(`skill facades: ${verdict.facadeCount} facade(s), ${verdict.skillCount} physical skill routes, valid`);
}
