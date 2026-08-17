// Validate a brainstorm artifact against its schema, then against the laws a schema cannot express.
//
//   node scripts/validate-artifact.mjs --schema <schema.json> --data <artifact.json> [--hash]
//
// Exits non-zero on the first failing category. A schema nobody runs is prose, so this is the thing
// that turns "no class in a candidate" and "one candidate must depart" into machine refusals.

import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {dirname, resolve} from "node:path";

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
};

const schemaPath = flag("schema");
const dataPath = flag("data");
const wantHash = args.includes("--hash");

if (!schemaPath || !dataPath) {
  console.error("usage: validate-artifact.mjs --schema <schema.json> --data <artifact.json> [--hash]");
  process.exit(2);
}

const loaded = new Map();
async function load(path) {
  const full = resolve(path);
  if (!loaded.has(full)) loaded.set(full, JSON.parse(await readFile(full, "utf8")));
  return loaded.get(full);
}

function pointer(doc, path) {
  return path
    .split("/")
    .filter(Boolean)
    .reduce((node, key) => {
      if (node === undefined) return undefined;
      return node[key.replace(/~1/g, "/").replace(/~0/g, "~")];
    }, doc);
}

// A `$ref` is either local (`#/$defs/x`) or a sibling file (`../schema.json#/$defs/candidate`).
// Cross-file refs exist so a precedent depends on the candidate shape instead of restating it.
async function deref(ref, ctx) {
  const [file, path = ""] = ref.split("#");
  if (!file) return {node: pointer(ctx.doc, path), ctx};
  const target = resolve(ctx.dir, file);
  const doc = await load(target);
  return {node: pointer(doc, path), ctx: {doc, dir: dirname(target)}};
}

async function check(schema, data, at, ctx, errors) {
  if (schema === undefined) return;

  if (schema.$ref) {
    const {node, ctx: next} = await deref(schema.$ref, ctx);
    if (!node) return errors.push(`${at}: unresolvable $ref ${schema.$ref}`);
    return check(node, data, at, next, errors);
  }

  if (schema.oneOf) {
    const outcomes = [];
    for (const option of schema.oneOf) {
      const local = [];
      await check(option, data, at, ctx, local);
      outcomes.push(local);
    }
    const passed = outcomes.filter((list) => list.length === 0).length;
    if (passed !== 1) {
      const detail = outcomes.map((list, index) => `  option ${index}: ${list[0] ?? "matched"}`).join("\n");
      errors.push(`${at}: ${passed === 0 ? "matched no oneOf option" : `matched ${passed} oneOf options`}\n${detail}`);
    }
    return;
  }

  if ("const" in schema && data !== schema.const) {
    return errors.push(`${at}: expected ${JSON.stringify(schema.const)}, got ${JSON.stringify(data)}`);
  }

  if (schema.enum && !schema.enum.includes(data)) {
    return errors.push(`${at}: ${JSON.stringify(data)} is not one of ${schema.enum.join(" | ")}`);
  }

  const kind = Array.isArray(data) ? "array" : data === null ? "null" : typeof data;
  if (schema.type) {
    const want = schema.type === "integer" ? "number" : schema.type;
    if (kind !== want) return errors.push(`${at}: expected ${schema.type}, got ${kind}`);
    if (schema.type === "integer" && !Number.isInteger(data)) return errors.push(`${at}: expected integer`);
  }

  if (kind === "string") {
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errors.push(`${at}: ${JSON.stringify(data)} does not match ${schema.pattern}`);
    }
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(`${at}: shorter than ${schema.minLength} characters`);
    }
  }

  if (kind === "number" && schema.minimum !== undefined && data < schema.minimum) {
    errors.push(`${at}: below minimum ${schema.minimum}`);
  }

  if (kind === "array") {
    if (schema.minItems !== undefined && data.length < schema.minItems) errors.push(`${at}: fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && data.length > schema.maxItems) errors.push(`${at}: more than ${schema.maxItems} items`);
    if (schema.items) {
      for (const [index, item] of data.entries()) await check(schema.items, item, `${at}[${index}]`, ctx, errors);
    }
  }

  if (kind === "object") {
    for (const key of schema.required ?? []) {
      if (!(key in data)) errors.push(`${at}: missing required "${key}"`);
    }
    // The reason every object in these schemas sets it: without it, a candidate carrying
    // "className" validates cleanly, and the class-free law becomes a reminder again.
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(data)) {
        if (!(key in schema.properties)) errors.push(`${at}: unexpected property "${key}"`);
      }
    }
    for (const [key, value] of Object.entries(data)) {
      if (schema.properties?.[key]) await check(schema.properties[key], value, `${at}.${key}`, ctx, errors);
    }
  }
}

// Laws no schema can express, because they are about the BATCH rather than about one member.
const CLASS_TOKEN = /\b(?:gap|p|px|py|pt|pb|pl|pr|m|mx|my|w|h|min-w|max-w|min-h|max-h|text|bg|border|rounded|flex|grid|shadow|ring|divide|space)-(?:\[|\d|x-|y-|xs\b|sm\b|md\b|lg\b|xl\b|foreground\b|muted\b|card\b|background\b)/;

function walkStrings(value, at, visit) {
  if (typeof value === "string") return visit(value, at);
  if (Array.isArray(value)) return value.forEach((item, index) => walkStrings(item, `${at}[${index}]`, visit));
  if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) walkStrings(inner, `${at}.${key}`, visit);
  }
}

function laws(data) {
  const found = [];
  const members = data.candidates ?? data.anatomies;
  if (!Array.isArray(members)) return found;

  walkStrings(members, "members", (text, at) => {
    if (CLASS_TOKEN.test(text)) found.push(`${at}: carries a class token (${text.match(CLASS_TOKEN)[0]}); this artifact is class-free by law`);
  });

  const axisKeys = members.map((member) => JSON.stringify(member.axes ?? {}));
  const seen = new Map();
  for (const [index, key] of axisKeys.entries()) {
    if (seen.has(key)) found.push(`members[${index}]: identical axis set to members[${seen.get(key)}] — that is one candidate, not two`);
    else seen.set(key, index);
  }

  if (members.length > 1 && !members.some((member) => member.citesPrecedent === "none")) {
    found.push("members: no candidate departs from precedent — at least one must cite `none`");
  }

  for (const [index, member] of members.entries()) {
    if (member.axes?.repetition === "repeats" && member.restingCount === undefined) {
      found.push(`members[${index}]: axes.repetition is "repeats" but no restingCount is stated`);
    }
  }

  return found;
}

// Canonical form: keys sorted at every depth, envelope excluded. Two runs of the same decision must
// produce the same hash, so nothing that varies per run may sit inside the hashed object.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const schema = await load(schemaPath);
const data = await load(dataPath);
const errors = [];
await check(schema, data, "$", {doc: schema, dir: dirname(resolve(schemaPath))}, errors);

const broken = laws(data);

if (errors.length) {
  console.error(`SCHEMA (${errors.length})`);
  for (const error of errors) console.error(`  ${error}`);
}
if (broken.length) {
  console.error(`LAWS (${broken.length})`);
  for (const error of broken) console.error(`  ${error}`);
}

if (wantHash && !errors.length) {
  for (const member of data.candidates ?? data.anatomies ?? []) {
    console.log(`${createHash("sha256").update(canonical(member)).digest("hex")}  ${member.id}`);
  }
}

if (errors.length || broken.length) process.exit(1);
console.log(`ok  ${(data.candidates ?? data.anatomies ?? []).length} members validated against ${schema.title}`);
