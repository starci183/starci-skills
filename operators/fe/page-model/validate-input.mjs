import {readFile, readFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {promisify} from "node:util";

const read = promisify(readFile);
const schemas = {
  input: JSON.parse(readFileSync(new URL("./input.schema.json", import.meta.url), "utf8")),
  output: JSON.parse(readFileSync(new URL("./output.schema.json", import.meta.url), "utf8"))
};
let schema = schemas.input;

function check(rule, value, at, errors) {
  if (rule.$ref) {
    if (!rule.$ref.startsWith("#/$defs/")) return errors.push(`${at}: unsupported schema reference ${rule.$ref}`);
    const target = schema.$defs[rule.$ref.slice(8)];
    if (!target) return errors.push(`${at}: unresolved schema reference ${rule.$ref}`);
    return check(target, value, at, errors);
  }
  if (rule.oneOf) {
    const results = rule.oneOf.map((option) => {
      const local = [];
      check(option, value, at, local);
      return local;
    });
    const matches = results.filter((result) => result.length === 0).length;
    if (matches !== 1) errors.push(`${at}: expected exactly one allowed shape; matched ${matches}`);
    return;
  }
  for (const part of rule.allOf ?? []) check(part, value, at, errors);
  if (rule.if) {
    const local = [];
    check(rule.if, value, at, local);
    if (local.length === 0 && rule.then) check(rule.then, value, at, errors);
  }
  if (Object.hasOwn(rule, "const") && value !== rule.const) return errors.push(`${at}: expected ${JSON.stringify(rule.const)}, got ${JSON.stringify(value)}`);
  if (rule.enum && !rule.enum.includes(value)) return errors.push(`${at}: ${JSON.stringify(value)} is not one of ${rule.enum.map(JSON.stringify).join(", ")}`);
  const kind = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  if (rule.type) {
    const expected = rule.type === "integer" ? "number" : rule.type;
    if (kind !== expected || (rule.type === "integer" && !Number.isInteger(value))) return errors.push(`${at}: expected ${rule.type}, got ${kind}`);
  }
  if (kind === "string") {
    if (rule.minLength !== undefined && value.length < rule.minLength) errors.push(`${at}: must have at least ${rule.minLength} characters`);
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) errors.push(`${at}: does not match ${rule.pattern}`);
  }
  if (kind === "number" && rule.minimum !== undefined && value < rule.minimum) errors.push(`${at}: must be at least ${rule.minimum}`);
  if (kind === "array") {
    if (rule.minItems !== undefined && value.length < rule.minItems) errors.push(`${at}: must contain at least ${rule.minItems} items`);
    if (rule.maxItems !== undefined && value.length > rule.maxItems) errors.push(`${at}: must contain at most ${rule.maxItems} items`);
    if (rule.uniqueItems && new Set(value.map(JSON.stringify)).size !== value.length) errors.push(`${at}: items must be unique`);
    if (rule.items) value.forEach((item, index) => check(rule.items, item, `${at}[${index}]`, errors));
    if (rule.contains && !value.some((item, index) => {
      const local = [];
      check(rule.contains, item, `${at}[${index}]`, local);
      return local.length === 0;
    })) errors.push(`${at}: does not contain a required item`);
  }
  if (kind === "object") {
    for (const key of rule.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${at}: missing required property ${JSON.stringify(key)}`);
    if (rule.additionalProperties === false) for (const key of Object.keys(value)) if (!Object.hasOwn(rule.properties ?? {}, key)) errors.push(`${at}.${key}: unexpected property`);
    for (const [key, child] of Object.entries(rule.properties ?? {})) if (Object.hasOwn(value, key)) check(child, value[key], `${at}.${key}`, errors);
  }
}

export function validateDefinition(value, definition, semantic = () => []) {
  const errors = [];
  schema = schemas[definition];
  if (!schema) return {valid: false, errors: [`$: missing schema definition ${definition}`]};
  check(schema, value, "$", errors);
  if (errors.length === 0) errors.push(...semantic(value));
  return {valid: errors.length === 0, errors};
}

export function validateInput(value) {
  return validateDefinition(value, "input", (document) => {
    if (!document.facts.includes("flow-approved")) return ["$.facts: approved flow fact is required"];
    return [];
  });
}

export async function runValidatorCli(label, validator) {
  const file = process.argv[2];
  if (!file || process.argv.length !== 3) {
    console.error(`usage: node ${label} <artifact.json>`);
    process.exitCode = 2;
    return;
  }
  let value;
  try {
    value = JSON.parse(await read(resolve(file), "utf8"));
  } catch (error) {
    console.error(`${file}: cannot read valid JSON: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  const result = validator(value);
  if (!result.valid) {
    console.error(`${label}: ${result.errors.length} validation error(s)`);
    result.errors.forEach((error) => console.error(`  ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(`ok  ${file}`);
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) await runValidatorCli("validate-input.mjs", validateInput);
