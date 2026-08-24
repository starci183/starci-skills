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

function kindOf(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function resolveRef(ref) {
  if (!ref.startsWith("#/$defs/")) throw new Error(`unsupported schema reference ${ref}`);
  const name = ref.slice("#/$defs/".length);
  if (!Object.hasOwn(schema.$defs, name)) throw new Error(`unresolved schema reference ${ref}`);
  return schema.$defs[name];
}

function check(rule, value, at, errors) {
  if (rule.$ref) return check(resolveRef(rule.$ref), value, at, errors);
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
    const conditionErrors = [];
    check(rule.if, value, at, conditionErrors);
    if (conditionErrors.length === 0 && rule.then) check(rule.then, value, at, errors);
  }
  if (Object.hasOwn(rule, "const") && value !== rule.const) {
    errors.push(`${at}: expected ${JSON.stringify(rule.const)}, got ${JSON.stringify(value)}`);
    return;
  }
  if (rule.enum && !rule.enum.includes(value)) {
    errors.push(`${at}: ${JSON.stringify(value)} is not one of ${rule.enum.map(JSON.stringify).join(", ")}`);
    return;
  }
  const actual = kindOf(value);
  if (rule.type) {
    const expected = rule.type === "integer" ? "number" : rule.type;
    if (actual !== expected || (rule.type === "integer" && !Number.isInteger(value))) {
      errors.push(`${at}: expected ${rule.type}, got ${actual}`);
      return;
    }
  }
  if (actual === "string") {
    if (rule.minLength !== undefined && value.length < rule.minLength) errors.push(`${at}: must have at least ${rule.minLength} characters`);
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) errors.push(`${at}: does not match ${rule.pattern}`);
  }
  if (actual === "number" && rule.minimum !== undefined && value < rule.minimum) errors.push(`${at}: must be at least ${rule.minimum}`);
  if (actual === "array") {
    if (rule.minItems !== undefined && value.length < rule.minItems) errors.push(`${at}: must contain at least ${rule.minItems} items`);
    if (rule.maxItems !== undefined && value.length > rule.maxItems) errors.push(`${at}: must contain at most ${rule.maxItems} items`);
    if (rule.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${at}: items must be unique`);
    if (rule.items) value.forEach((item, index) => check(rule.items, item, `${at}[${index}]`, errors));
    if (rule.contains) {
      const matched = value.some((item, index) => {
        const local = [];
        check(rule.contains, item, `${at}[${index}]`, local);
        return local.length === 0;
      });
      if (!matched) errors.push(`${at}: does not contain a required item`);
    }
  }
  if (actual === "object") {
    for (const key of rule.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${at}: missing required property ${JSON.stringify(key)}`);
    if (rule.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.hasOwn(rule.properties ?? {}, key)) errors.push(`${at}.${key}: unexpected property`);
    }
    for (const [key, child] of Object.entries(rule.properties ?? {})) if (Object.hasOwn(value, key)) check(child, value[key], `${at}.${key}`, errors);
  }
}

export function validateDefinition(value, definition, semantic = () => []) {
  const errors = [];
  schema = schemas[definition];
  const target = schema;
  if (!target) return {valid: false, errors: [`$: missing schema definition ${definition}`]};
  check(target, value, "$", errors);
  if (errors.length === 0) errors.push(...semantic(value));
  return {valid: errors.length === 0, errors};
}

export function validateInput(value) {
  return validateDefinition(value, "input", (document) => {
    if (document.payload.request.businessImpact === "product" && document.payload.businessEvidenceRefs.length === 0) {
      return ["$.payload.businessEvidenceRefs: product-facing requests require routed business evidence"];
    }
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
