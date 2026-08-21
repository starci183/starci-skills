// Validate a brainstorm artifact against its schema, then against the laws a schema cannot express.
//
//   node scripts/validate-artifact.mjs --schema <schema.json> --data <artifact.json> [--vocabulary <inventory.json>] [--hash]
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
const vocabularyPath = flag("vocabulary");
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

  if (schema.anyOf) {
    const outcomes = [];
    for (const option of schema.anyOf) {
      const local = [];
      await check(option, data, at, ctx, local);
      outcomes.push(local);
    }
    if (!outcomes.some((list) => list.length === 0)) {
      const detail = outcomes.map((list, index) => `  option ${index}: ${list[0] ?? "matched"}`).join("\n");
      errors.push(`${at}: matched no anyOf option\n${detail}`);
    }
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
  const members = data.candidates ?? data.anatomies ?? data.directions;
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

  if (data.schema !== 5 && !data.envelope?.mode && members.length > 1 && !members.some((member) => member.citesPrecedent === "none")) {
    found.push("members: no candidate departs from precedent — at least one must cite `none`");
  }

  for (const [index, member] of members.entries()) {
    if (member.axes?.repetition === "repeats" && member.restingCount === undefined) {
      found.push(`members[${index}]: axes.repetition is "repeats" but no restingCount is stated`);
    }
  }

  return found;
}

function directionLaws(data, vocabulary) {
  const found = [];
  const selected = Array.isArray(data.directions)
    ? data.directions.map((direction, index) => ({direction, at: `directions[${index}]`}))
    : Array.isArray(data.candidates)
      ? data.candidates.flatMap((candidate, index) => candidate.direction ? [{direction: candidate.direction, at: `candidates[${index}].direction`}] : [])
      : [];
  if (!selected.length) return found;
  if (Array.isArray(data.directions) && data.schema === 2) {
    if (!data.recommended) {
      found.push("recommended: schema 2 direction batches must name one evidence-backed default");
    } else if (!data.directions.some((direction) => direction.id === data.recommended.id)) {
      found.push("recommended.id: does not name a direction in this batch");
    }
  }
  if (!vocabulary) return [...found, "direction evidence: --vocabulary is required so token verdicts are evidence-backed"];

  const vocabularyByName = new Map((vocabulary.tokens ?? []).map((token) => [token.name, token]));
  const known = new Set(vocabularyByName.keys());
  const RAW_VALUE = /(?:#[0-9a-f]{3,8}\b|\b(?:rgb|hsl|oklch|lab|lch)\s*\()/i;
  for (const {direction, at: directionAt} of selected) {
    if (Array.isArray(data.directions) && direction.vocabularyAt !== data.envelope?.vocabularyAt) {
      found.push(`${directionAt}.vocabularyAt: must equal the inventory state declared by the direction batch`);
    }
    if (direction.vocabularyAt !== vocabulary.digest) {
      found.push(`${directionAt}.vocabularyAt: must equal the digest of the vocabulary supplied for validation`);
    }
    const personalities = direction.personality ?? [];
    if (new Set(personalities).size !== personalities.length) {
      found.push(`${directionAt}.personality: duplicate words do not make a stronger direction`);
    }
    const rejections = direction.rejects ?? [];
    if (new Set(rejections).size !== rejections.length) {
      found.push(`${directionAt}.rejects: duplicate boundaries do not make a second refusal`);
    }
    for (const [role, decision] of Object.entries(direction.roles ?? {})) {
      if (decision?.verdict === "reuse" && !known.has(decision.token)) {
        found.push(`${directionAt}.roles.${role}: reuses ${decision.token}, absent from the visual vocabulary`);
      }
      if (decision?.verdict === "new" && known.has(decision.token)) {
        found.push(`${directionAt}.roles.${role}: declares ${decision.token} new, but it already exists`);
      }
      const lockedValue = direction.lockedTokens?.[decision?.token];
      if (lockedValue !== undefined && decision?.verdict === "new" && decision.value !== lockedValue) {
        found.push(`${directionAt}.roles.${role}: new value for ${decision.token} differs from its grammar-locked value`);
      }
    }
    for (const [token, lockedValue] of Object.entries(direction.lockedTokens ?? {})) {
      const declarations = vocabularyByName.get(token)?.declarations ?? [];
      if (declarations.length > 0 && !declarations.some((declaration) => declaration.value === lockedValue)) {
        found.push(`${directionAt}.lockedTokens.${token}: vocabulary declarations differ from the grammar-locked value`);
      }
    }
    walkStrings(direction, directionAt, (text, at) => {
      const match = text.match(RAW_VALUE);
      if (match && !/\.roles\.[^.]+\.value$/.test(at) && !/\.lockedTokens\.[^.]+$/.test(at)) {
        found.push(`${at}: carries raw visual value ${match[0]}; only a new or grammar-locked token value may carry one`);
      }
    });

    const {axes = {}, roles = {}} = direction;
    if (axes.shape !== "square" && roles.radius?.verdict === "none") {
      found.push(`${directionAt}.roles.radius: ${axes.shape} shape requires a token decision`);
    }
    if (axes.depth !== "flat" && roles.elevation?.verdict === "none") {
      found.push(`${directionAt}.roles.elevation: ${axes.depth} depth requires a token decision`);
    }
    if (axes.motion !== "still" && (roles.duration?.verdict === "none" || roles.easing?.verdict === "none")) {
      found.push(`${directionAt}.roles: ${axes.motion} motion requires both duration and easing token decisions`);
    }
  }

  if (Array.isArray(data.directions)) {
    const signatures = new Map();
    for (const [index, {direction, at}] of selected.entries()) {
      const signature = canonical(direction.roles ?? {});
      if (signatures.has(signature)) {
        found.push(`${at}.roles: same render-affecting token decisions as directions[${signatures.get(signature)}] — different axis labels do not make a visual choice`);
      } else {
        signatures.set(signature, index);
      }
    }
  }

  if (Array.isArray(data.candidates) && selected.length > 1) {
    const first = canonical(selected[0].direction);
    for (const {direction, at} of selected.slice(1)) {
      if (canonical(direction) !== first) found.push(`${at}: layout candidates must share the one evidence-backed direction presented for combined approval`);
    }
  }
  return found;
}

function layoutRegionLaws(data) {
  if (data.schema < 2 || !Array.isArray(data.candidates)) return [];
  const found = [];
  for (const [candidateIndex, candidate] of data.candidates.entries()) {
    for (const [regionIndex, region] of (candidate.regions ?? []).entries()) {
      if (!region.geometry) found.push(`candidates[${candidateIndex}].regions[${regionIndex}].geometry: schema ${data.schema} requires hashed child bounding geometry`);
      if (data.schema >= 3 && !region.brief) found.push(`candidates[${candidateIndex}].regions[${regionIndex}].brief: schema ${data.schema} requires a hashed representative child brief`);
    }
  }
  return found;
}

function pageSetLaws(data) {
  if (data.schema < 4 || !Array.isArray(data.candidates)) return [];
  const found = [];
  const candidates = data.candidates;
  const first = candidates[0];
  if (data.schema === 5 && data.envelope?.mode === "generate" && candidates.length !== 1) found.push("candidates: generate mode requires exactly one complete long-page/full-flow result");
  else if (data.schema === 5 && data.envelope?.mode === "brainstorm" && (candidates.length < 3 || candidates.length > 4)) found.push("candidates: explicit brainstorm mode requires 3-4 targeted alternatives");
  else if (data.schema === 5 && !["generate", "brainstorm"].includes(data.envelope?.mode)) found.push("envelope.mode: schema 5 requires generate or brainstorm");
  else if (data.schema < 5 && (candidates.length < 3 || candidates.length > 4)) found.push("candidates: legacy page/flow review requires 3-4 complete page-set choices");
  if (data.schema === 5 && data.envelope?.mode === "brainstorm" && !/^[a-f0-9]{64}$/.test(data.envelope?.baselineCandidateAt ?? "")) found.push("envelope.baselineCandidateAt: brainstorm requires the reviewed generated baseline");
  if (data.schema === 5 && data.envelope?.mode === "generate" && data.envelope?.baselineCandidateAt !== undefined) found.push("envelope.baselineCandidateAt: generate mode has no earlier candidate dependency");

  const scopeSignature = canonical((first?.pages ?? []).map((page) => ({id: page.id, route: page.route, state: page.state})));
  const existing = new Map();
  for (const page of first?.pages ?? []) {
    for (const node of page.nodes ?? []) if (node.change === "existing") existing.set(`${page.id}/${node.id}`, canonical(node));
  }

  for (const [candidateIndex, candidate] of candidates.entries()) {
    if (data.schema === 5) {
      if (candidate.systemId !== "starci-master") found.push(`candidates[${candidateIndex}].systemId: schema 5 requires starci-master`);
      if (!candidate.pageOverride || !Array.isArray(candidate.pageOverride.deviations)) found.push(`candidates[${candidateIndex}].pageOverride: schema 5 requires deviations-only page override`);
      if (candidate.direction !== undefined) found.push(`candidates[${candidateIndex}].direction: schema 5 must not reselect taste outside MASTER`);
    }
    if (canonical((candidate.pages ?? []).map((page) => ({id: page.id, route: page.route, state: page.state}))) !== scopeSignature) {
      found.push(`candidates[${candidateIndex}].pages: candidate changes the approved page/route/state scope rather than its composition`);
    }
    const regionByName = new Map();
    const candidateExisting = new Set();
    for (const [regionIndex, region] of (candidate.regions ?? []).entries()) {
      if (regionByName.has(region.name)) found.push(`candidates[${candidateIndex}].regions[${regionIndex}].name: duplicate block identity ${region.name}`);
      regionByName.set(region.name, region);
    }
    const referenced = new Set();
    const pageIds = new Set();
    for (const [pageIndex, page] of (candidate.pages ?? []).entries()) {
      if (pageIds.has(page.id)) found.push(`candidates[${candidateIndex}].pages[${pageIndex}].id: duplicate page identity ${page.id}`);
      pageIds.add(page.id);
      const nodeIds = new Set();
      for (const [nodeIndex, node] of (page.nodes ?? []).entries()) {
        if (nodeIds.has(node.id)) found.push(`candidates[${candidateIndex}].pages[${pageIndex}].nodes[${nodeIndex}].id: duplicate composition node ${node.id}`);
        if (node.parentId && !nodeIds.has(node.parentId)) found.push(`candidates[${candidateIndex}].pages[${pageIndex}].nodes[${nodeIndex}].parentId: parent must precede its child`);
        nodeIds.add(node.id);
        const key = `${page.id}/${node.id}`;
        if (node.change === "existing") candidateExisting.add(key);
        if (existing.has(key) && canonical(node) !== existing.get(key)) found.push(`candidates[${candidateIndex}].pages[${pageIndex}].nodes[${nodeIndex}]: existing source-bound node differs between candidates`);
      }
      for (const [regionIndex, name] of (page.regions ?? []).entries()) {
        if (referenced.has(name)) found.push(`candidates[${candidateIndex}].pages[${pageIndex}].regions[${regionIndex}]: region ${name} is owned by more than one page`);
        referenced.add(name);
        const region = regionByName.get(name);
        if (!region) found.push(`candidates[${candidateIndex}].pages[${pageIndex}].regions[${regionIndex}]: absent region ${name}`);
        else if (region.pageId !== page.id) found.push(`candidates[${candidateIndex}].regions: ${name} binds ${region.pageId}, not page ${page.id}`);
      }
    }
    for (const name of regionByName.keys()) if (!referenced.has(name)) found.push(`candidates[${candidateIndex}].regions: ${name} is not placed on any page`);
    for (const [key] of existing) {
      const [pageId, nodeId] = key.split("/");
      const node = (candidate.pages ?? []).find((page) => page.id === pageId)?.nodes?.find((item) => item.id === nodeId);
      if (!node) found.push(`candidates[${candidateIndex}].pages: existing node ${key} disappeared from this choice`);
    }
    for (const key of candidateExisting) {
      if (!existing.has(key)) found.push(`candidates[${candidateIndex}].pages: existing node ${key} was introduced in only this choice`);
    }
  }
  return found;
}

function blockModeLaws(data) {
  if (data.schema !== 2 || !Array.isArray(data.anatomies)) return [];
  const found = [];
  if (data.envelope?.mode === "audit") {
    if (data.anatomies.length !== 1) found.push("anatomies: audit mode requires exactly one Layout-generated current anatomy");
    if (!data.audit || !["pass", "correct"].includes(data.audit.verdict)) found.push("audit: audit mode requires pass or correct verdict");
    if (data.audit?.verdict === "correct" && !data.audit.correction) found.push("audit.correction: correct verdict requires the exact correction");
  } else if (data.envelope?.mode === "brainstorm") {
    if (data.anatomies.length < 3 || data.anatomies.length > 4) found.push("anatomies: explicit block brainstorm requires 3-4 alternatives");
    if (!data.envelope.explicitRequest) found.push("envelope.explicitRequest: block brainstorm requires the owner's request");
    if (data.audit !== undefined) found.push("audit: brainstorm mode cannot masquerade as audit");
  } else found.push("envelope.mode: schema 2 block work requires audit or brainstorm");
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
const vocabulary = vocabularyPath ? await load(vocabularyPath) : undefined;
const errors = [];
await check(schema, data, "$", {doc: schema, dir: dirname(resolve(schemaPath))}, errors);

if (vocabulary && (Array.isArray(data.directions) || data.candidates?.some((candidate) => candidate.direction))) {
  const vocabularySchemaPath = resolve(
    dirname(resolve(schemaPath)),
    Array.isArray(data.directions) ? "vocabulary.schema.json" : "../directions/vocabulary.schema.json",
  );
  const vocabularySchema = await load(vocabularySchemaPath);
  await check(vocabularySchema, vocabulary, "$vocabulary", {doc: vocabularySchema, dir: dirname(vocabularySchemaPath)}, errors);
}

const broken = [...laws(data), ...directionLaws(data, vocabulary), ...layoutRegionLaws(data), ...pageSetLaws(data), ...blockModeLaws(data)];

if (errors.length) {
  console.error(`SCHEMA (${errors.length})`);
  for (const error of errors) console.error(`  ${error}`);
}
if (broken.length) {
  console.error(`LAWS (${broken.length})`);
  for (const error of broken) console.error(`  ${error}`);
}

if (wantHash && !errors.length && !broken.length) {
  for (const member of data.candidates ?? data.anatomies ?? data.directions ?? []) {
    console.log(`${createHash("sha256").update(canonical(member)).digest("hex")}  ${member.id}`);
  }
}

if (errors.length || broken.length) process.exit(1);
console.log(`ok  ${(data.candidates ?? data.anatomies ?? data.directions ?? []).length} members validated against ${schema.title}`);
