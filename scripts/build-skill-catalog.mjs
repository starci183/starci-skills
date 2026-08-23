#!/usr/bin/env node

import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from "node:fs";
import {resolve, relative} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const CATALOG_RELATIVE = ".claude/skill-runtime/catalog/catalog.json";
const SCHEMA_RELATIVE = ".claude/skill-runtime/catalog/schema.json";
const OVERRIDES_RELATIVE = ".claude/skill-runtime/catalog/overrides.json";
const SKILLS_RELATIVE = ".claude/skills";
const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const RISKS = new Set(["read-only", "local-write", "source-write", "external-write"]);
const CATCHALLS = new Set(["do", "do task", "fix", "fix things", "help", "manage", "task", "work"]);
const DEFAULT_SOURCE_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const normalize = (value) => value.trim().toLowerCase().replace(/\s+/g, " ");
const stableObject = (entries) => Object.fromEntries([...entries].sort(([left], [right]) => left.localeCompare(right)));
const jsonLine = (value) => `${JSON.stringify(value)}\n`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertKeys(value, allowed, label) {
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  assert(extras.length === 0, `${label} has unsupported keys: ${extras.join(", ")}`);
}

function stringArray(value, label, {allowEmpty = false} = {}) {
  assert(Array.isArray(value), `${label} must be an array`);
  assert(allowEmpty || value.length > 0, `${label} must not be empty`);
  const result = value.map((item) => {
    assert(typeof item === "string" && item.trim(), `${label} entries must be non-empty strings`);
    return item.trim();
  });
  assert(new Set(result.map(normalize)).size === result.length, `${label} contains duplicates`);
  return [...result].sort((left, right) => left.localeCompare(right));
}

function scalar(frontmatterValue) {
  const value = frontmatterValue.trim();
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new Error(`invalid quoted frontmatter value: ${error.message}`);
    }
  }
  if (value.startsWith("'")) {
    assert(value.endsWith("'"), "invalid single-quoted frontmatter value");
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

export function parseSkillFrontmatter(text, file = "SKILL.md") {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  assert(match, `${file} must start with YAML frontmatter`);
  const result = {};
  for (const [index, line] of match[1].split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.+)$/);
    assert(field, `${file} has unsupported frontmatter at line ${index + 2}`);
    assert(!(field[1] in result), `${file} repeats frontmatter key ${field[1]}`);
    result[field[1]] = scalar(field[2]);
  }
  assertKeys(result, new Set(["name", "description"]), `${file} frontmatter`);
  assert(typeof result.name === "string" && ID.test(result.name), `${file} has an invalid name`);
  assert(typeof result.description === "string" && result.description.trim(), `${file} has no description`);
  return {name: result.name, description: result.description.trim()};
}

function inventorySkills(sourceRoot) {
  const skillsRoot = resolve(sourceRoot, SKILLS_RELATIVE);
  assert(existsSync(skillsRoot), `missing skills root: ${skillsRoot}`);
  return readdirSync(skillsRoot, {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({directory: entry.name, file: resolve(skillsRoot, entry.name, "SKILL.md")}))
    .filter((entry) => existsSync(entry.file))
    .sort((left, right) => left.directory.localeCompare(right.directory))
    .map(({directory, file}) => {
      const text = readFileSync(file, "utf8");
      const frontmatter = parseSkillFrontmatter(text, relative(sourceRoot, file).replaceAll("\\", "/"));
      assert(frontmatter.name === directory, `${frontmatter.name} must live in a matching skill directory`);
      return {...frontmatter, path: relative(sourceRoot, file).replaceAll("\\", "/"), text};
    });
}

function validateMacros(rawMacros) {
  assert(Array.isArray(rawMacros) && rawMacros.length > 0, "overrides.macros must be a non-empty array");
  const ids = new Set();
  const discoveryNames = new Map();
  return rawMacros.map((raw, index) => {
    assert(raw && typeof raw === "object" && !Array.isArray(raw), `macros[${index}] must be an object`);
    assertKeys(raw, new Set(["id", "aliases"]), `macros[${index}]`);
    assert(typeof raw.id === "string" && ID.test(raw.id), `macros[${index}].id is invalid`);
    assert(!ids.has(raw.id), `duplicate macro id: ${raw.id}`);
    ids.add(raw.id);
    const aliases = stringArray(raw.aliases, `macro ${raw.id} aliases`);
    for (const name of [raw.id, ...aliases]) {
      const key = normalize(name);
      assert(!discoveryNames.has(key), `ambiguous macro discovery name: ${name}`);
      discoveryNames.set(key, raw.id);
    }
    return {id: raw.id, aliases, routes: {}};
  }).sort((left, right) => left.id.localeCompare(right.id));
}

function validateOverride(raw, skill, macroIds, discoveryNames, globalIntents) {
  const label = `override ${skill.name}`;
  assert(raw && typeof raw === "object" && !Array.isArray(raw), `${label} must be an object`);
  assertKeys(raw, new Set([
    "macro", "macroMode", "aliases", "intent", "excludes", "modes", "risk", "read", "write", "knowledge", "tools"
  ]), label);
  assert(typeof raw.macro === "string" && macroIds.has(raw.macro), `${label}.macro is unknown`);
  assert(typeof raw.macroMode === "string" && ID.test(raw.macroMode), `${label}.macroMode is invalid`);
  const aliases = stringArray(raw.aliases, `${label}.aliases`, {allowEmpty: true});
  for (const name of [skill.name, ...aliases]) {
    const key = normalize(name);
    assert(!discoveryNames.has(key), `ambiguous skill discovery name: ${name}`);
    discoveryNames.set(key, skill.name);
  }
  const intent = stringArray(raw.intent, `${label}.intent`);
  for (const phrase of intent) {
    const key = normalize(phrase);
    assert(!CATCHALLS.has(key), `${label}.intent contains catchall phrase: ${phrase}`);
    assert(key.split(" ").length >= 2, `${label}.intent is too broad: ${phrase}`);
    assert(!globalIntents.has(key), `ambiguous intent shared by ${skill.name} and ${globalIntents.get(key)}: ${phrase}`);
    globalIntents.set(key, skill.name);
  }
  const excludes = stringArray(raw.excludes, `${label}.excludes`);
  const modes = stringArray(raw.modes, `${label}.modes`);
  assert(typeof raw.risk === "string" && RISKS.has(raw.risk), `${label}.risk is invalid`);
  const read = stringArray(raw.read, `${label}.read`);
  const write = stringArray(raw.write, `${label}.write`, {allowEmpty: true});
  assert(raw.risk !== "read-only" || write.length === 0, `${label} is read-only but declares writes`);
  assert(raw.risk === "read-only" || write.length > 0, `${label} declares write risk without a write scope`);
  return {
    id: skill.name,
    path: skill.path,
    description: skill.description,
    macro: raw.macro,
    macroMode: raw.macroMode,
    aliases,
    intent,
    excludes,
    modes,
    approvalModes: ["auto", "manual"],
    risk: raw.risk,
    read,
    write,
    knowledge: stringArray(raw.knowledge, `${label}.knowledge`),
    tools: stringArray(raw.tools, `${label}.tools`)
  };
}

export function skillCatalogSchema() {
  const stringList = {type: "array", items: {type: "string", minLength: 1}, uniqueItems: true};
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "StarCi compact skill runtime catalog",
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "generatedFrom", "sourceDigest", "macros", "skills"],
    properties: {
      schemaVersion: {const: 1},
      generatedFrom: stringList,
      sourceDigest: {type: "string", pattern: "^[a-f0-9]{64}$"},
      macros: {type: "array", items: {
        type: "object", additionalProperties: false, required: ["id", "aliases", "routes"],
        properties: {id: {type: "string"}, aliases: stringList, routes: {type: "object", additionalProperties: {type: "string"}}}
      }},
      skills: {type: "array", items: {
        type: "object", additionalProperties: false,
        required: ["id", "path", "description", "macro", "macroMode", "aliases", "intent", "excludes", "modes", "approvalModes", "risk", "read", "write", "knowledge", "tools"],
        properties: {
          id: {type: "string"}, path: {type: "string"}, description: {type: "string"}, macro: {type: "string"}, macroMode: {type: "string"},
          aliases: stringList, intent: stringList, excludes: stringList, modes: stringList, approvalModes: stringList,
          risk: {enum: [...RISKS]}, read: stringList, write: stringList, knowledge: stringList, tools: stringList
        }
      }}
    }
  };
}

export function buildSkillCatalog(sourceRoot = DEFAULT_SOURCE_ROOT) {
  const root = resolve(sourceRoot);
  const overridePath = resolve(root, OVERRIDES_RELATIVE);
  assert(existsSync(overridePath), `missing skill catalog overrides: ${overridePath}`);
  const overridesText = readFileSync(overridePath, "utf8");
  const overrides = JSON.parse(overridesText);
  assertKeys(overrides, new Set(["schemaVersion", "macros", "skills"]), "overrides");
  assert(overrides.schemaVersion === 1, "overrides.schemaVersion must be 1");
  assert(overrides.skills && typeof overrides.skills === "object" && !Array.isArray(overrides.skills), "overrides.skills must be an object");

  const inventory = inventorySkills(root);
  const physicalIds = new Set(inventory.map((skill) => skill.name));
  const overrideIds = Object.keys(overrides.skills);
  const missing = [...physicalIds].filter((id) => !(id in overrides.skills));
  const orphaned = overrideIds.filter((id) => !physicalIds.has(id));
  assert(missing.length === 0, `skills missing catalog overrides: ${missing.join(", ")}`);
  assert(orphaned.length === 0, `catalog overrides without physical skills: ${orphaned.join(", ")}`);

  const macros = validateMacros(overrides.macros);
  const macroIds = new Set(macros.map((macro) => macro.id));
  const discoveryNames = new Map(macros.flatMap((macro) => [macro.id, ...macro.aliases].map((name) => [normalize(name), macro.id])));
  const globalIntents = new Map();
  const skills = inventory.map((skill) => validateOverride(overrides.skills[skill.name], skill, macroIds, discoveryNames, globalIntents));
  const macroById = new Map(macros.map((macro) => [macro.id, macro]));
  for (const skill of skills) {
    const routes = macroById.get(skill.macro).routes;
    assert(!(skill.macroMode in routes), `macro ${skill.macro} repeats route mode ${skill.macroMode}`);
    routes[skill.macroMode] = skill.id;
  }
  for (const macro of macros) {
    assert(Object.keys(macro.routes).length > 0, `macro ${macro.id} has no physical skill routes`);
    macro.routes = stableObject(Object.entries(macro.routes));
  }

  const digest = createHash("sha256");
  for (const skill of inventory) digest.update(`${skill.path}\0${skill.text}\0`);
  digest.update(`${OVERRIDES_RELATIVE}\0${overridesText}\0`);
  const catalog = {
    schemaVersion: 1,
    generatedFrom: [".claude/skills/*/SKILL.md", OVERRIDES_RELATIVE],
    sourceDigest: digest.digest("hex"),
    macros,
    skills
  };
  const schema = skillCatalogSchema();
  return {catalog, schema, catalogText: jsonLine(catalog), schemaText: jsonLine(schema)};
}

export function writeSkillCatalog(sourceRoot = DEFAULT_SOURCE_ROOT) {
  const root = resolve(sourceRoot);
  const built = buildSkillCatalog(root);
  mkdirSync(resolve(root, ".claude/skill-runtime/catalog"), {recursive: true});
  writeFileSync(resolve(root, CATALOG_RELATIVE), built.catalogText, "utf8");
  writeFileSync(resolve(root, SCHEMA_RELATIVE), built.schemaText, "utf8");
  return built;
}

export function checkSkillCatalog(sourceRoot = DEFAULT_SOURCE_ROOT) {
  const root = resolve(sourceRoot);
  const built = buildSkillCatalog(root);
  for (const [path, expected] of [[CATALOG_RELATIVE, built.catalogText], [SCHEMA_RELATIVE, built.schemaText]]) {
    const absolute = resolve(root, path);
    assert(existsSync(absolute), `missing generated skill catalog artifact: ${path}`);
    assert(readFileSync(absolute, "utf8") === expected, `generated skill catalog artifact is stale: ${path}`);
  }
  return built;
}

function cliArguments(argv) {
  let source = DEFAULT_SOURCE_ROOT;
  let check = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--check") check = true;
    else if (argv[index] === "--source") {
      assert(argv[index + 1], "--source requires a path");
      source = argv[index + 1];
      index += 1;
    } else throw new Error(`unknown argument: ${argv[index]}`);
  }
  return {source, check};
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  const {source, check} = cliArguments(process.argv.slice(2));
  const built = check ? checkSkillCatalog(source) : writeSkillCatalog(source);
  process.stdout.write(`${check ? "checked" : "wrote"} ${built.catalog.skills.length} skills across ${built.catalog.macros.length} macros\n`);
}
