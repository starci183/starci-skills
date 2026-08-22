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

function renderContractLaws(data) {
  const requiresExecutionAuthority = data.schema === 6 || (data.schema === 7 && data.envelope?.stage === "states");
  if (!requiresExecutionAuthority || !Array.isArray(data.candidates)) return [];
  const found = [];
  const asSet = (values) => [...new Set(values)].sort();
  const canonicalInstructions = [
    "read-exact-render-contract",
    "implement-every-page-region-state-viewport-transition-obligation",
    "touch-only-source-boundary",
    "do-not-reinterpret-preview",
    "stop-if-obligation-is-unrepresentable",
    "prove-preview-source-same-state-same-viewport-with-zero-mismatches",
  ];
  for (const [candidateIndex, candidate] of data.candidates.entries()) {
    const at = `candidates[${candidateIndex}]`;
    const contract = candidate.renderContract;
    const prompt = candidate.executionPrompt;
    if (!contract) found.push(`${at}.renderContract: ${data.schema === 7 ? "states stage" : "schema 6"} requires complete implementation authority`);
    if (!prompt) found.push(`${at}.executionPrompt: ${data.schema === 7 ? "states stage" : "schema 6"} requires the canonical execution prompt`);
    if (!contract || !prompt) continue;
    if (contract.candidateId !== candidate.id) found.push(`${at}.renderContract.candidateId: must equal candidate id ${candidate.id}`);
    if (prompt.candidateId !== candidate.id) found.push(`${at}.executionPrompt.candidateId: must equal candidate id ${candidate.id}`);
    if (prompt.renderContractId !== contract.id) found.push(`${at}.executionPrompt.renderContractId: must equal render contract id ${contract.id}`);
    if (canonical(prompt.sourceBoundary) !== canonical(contract.sourceBoundary)) found.push(`${at}.executionPrompt.sourceBoundary: must exactly equal renderContract.sourceBoundary`);
    if (canonical(prompt.instructions) !== canonical(canonicalInstructions)) found.push(`${at}.executionPrompt.instructions: must equal the canonical ordered execution instructions`);
    for (const [pathIndex, path] of (contract.sourceBoundary ?? []).entries()) {
      if (/[*?]/.test(path) || /[\\/]$/.test(path)) found.push(`${at}.renderContract.sourceBoundary[${pathIndex}]: must name one exact file, not a glob or directory`);
    }
    if (new Set(contract.sourceBoundary ?? []).size !== (contract.sourceBoundary ?? []).length) found.push(`${at}.renderContract.sourceBoundary: duplicate file path`);

    const candidatePages = new Map((candidate.pages ?? []).map((page) => [page.id, page]));
    const contractPages = new Map((contract.pages ?? []).map((page) => [page.id, page]));
    if (canonical(asSet(candidatePages.keys())) !== canonical(asSet(contractPages.keys()))) found.push(`${at}.renderContract.pages: must cover every candidate page exactly`);
    const viewportIds = (contract.viewports ?? []).map((viewport) => viewport.id);
    if (new Set(viewportIds).size !== viewportIds.length) found.push(`${at}.renderContract.viewports: duplicate viewport identity`);
    const coverageKeys = new Set();
    const selectedTargetKeys = new Set();
    const allTransitionIds = new Set();
    for (const [renderIndex, render] of (contract.renders ?? []).entries()) {
      const key = `${render.pageId}/${render.stateId}/${render.viewportId}`;
      selectedTargetKeys.add(`${render.pageId}/${render.stateId}`);
      if (coverageKeys.has(key)) found.push(`${at}.renderContract.renders[${renderIndex}]: duplicate coverage ${key}`);
      coverageKeys.add(key);
      if (!viewportIds.includes(render.viewportId)) found.push(`${at}.renderContract.renders[${renderIndex}].viewportId: unknown viewport ${render.viewportId}`);
      const page = contractPages.get(render.pageId);
      if (!page) found.push(`${at}.renderContract.renders[${renderIndex}].pageId: unknown page ${render.pageId}`);
      else {
        if (!(page.states ?? []).includes(render.stateId)) found.push(`${at}.renderContract.renders[${renderIndex}].stateId: unknown state ${render.stateId}`);
        if (canonical(asSet(render.regions ?? [])) !== canonical(asSet((page.regions ?? []).map((region) => region.id)))) found.push(`${at}.renderContract.renders[${renderIndex}].regions: must cover every region of ${render.pageId}`);
      }
    }
    if (selectedTargetKeys.size > 5) found.push(`${at}.renderContract.renders: must select no more than 5 complete-page render targets, received ${selectedTargetKeys.size}`);
    for (const page of contract.pages ?? []) {
      const candidatePage = candidatePages.get(page.id);
      if (candidatePage?.route !== page.route) found.push(`${at}.renderContract.pages.${page.id}.route: must equal candidate route`);
      if (!(page.states ?? []).includes(candidatePage?.state)) found.push(`${at}.renderContract.pages.${page.id}.states: must include candidate state ${candidatePage?.state}`);
      const unknownPageStates = (page.pageStates ?? []).filter((state) => !(page.states ?? []).includes(state));
      if (unknownPageStates.length > 0) found.push(`${at}.renderContract.pages.${page.id}.pageStates: must be an architectural subset of declared render states; unknown ${unknownPageStates.join(", ")}`);
      const candidateRegions = candidatePage?.regions ?? [];
      const renderRegions = (page.regions ?? []).map((region) => region.id);
      if (canonical(asSet(candidateRegions)) !== canonical(asSet(renderRegions))) found.push(`${at}.renderContract.pages.${page.id}.regions: must cover every candidate region exactly`);
      if (new Set(renderRegions).size !== renderRegions.length) found.push(`${at}.renderContract.pages.${page.id}.regions: duplicate region identity`);
      const regionOwnedStates = new Set();
      for (const region of page.regions ?? []) {
        const regionAt = `${at}.renderContract.pages.${page.id}.regions.${region.id}`;
        const ownership = region.sourceOwnership;
        const sourceParts = [ownership?.drawing, ownership?.connected, ownership?.compositor, ownership?.entry].filter(Boolean);
        for (const part of sourceParts) {
          if (/[*?]/.test(part.path ?? "") || /[\\\/]$/.test(part.path ?? "")) found.push(`${regionAt}.sourceOwnership.${part === ownership?.drawing ? "drawing" : part === ownership?.connected ? "connected" : part === ownership?.compositor ? "compositor" : "entry"}.path: must name one exact file, not a glob or directory`);
          if (!(contract.sourceBoundary ?? []).includes(part.path)) found.push(`${regionAt}.sourceOwnership: ${part.path} must be present in renderContract.sourceBoundary`);
        }
        if (ownership?.drawing?.path && !/component\.tsx$/.test(ownership.drawing.path)) found.push(`${regionAt}.sourceOwnership.drawing.path: ComponentBase drawing must end in component.tsx`);
        if (ownership?.compositor?.path && !/component\.tsx$/.test(ownership.compositor.path)) found.push(`${regionAt}.sourceOwnership.compositor.path: PageBase, LayoutBase or OverlayBase compositor must end in component.tsx`);
        if (ownership?.entry?.path && !/index\.tsx$/.test(ownership.entry.path)) found.push(`${regionAt}.sourceOwnership.entry.path: connected Page, Layout or Overlay entry must end in index.tsx`);
        if (ownership?.connected) {
          if (!/index\.tsx$/.test(ownership.connected.path ?? "")) found.push(`${regionAt}.sourceOwnership.connected.path: connected Component must end in index.tsx`);
          const drawingFolder = (ownership.drawing?.path ?? "").replace(/[\\\/][^\\\/]+$/, "");
          const connectedFolder = (ownership.connected.path ?? "").replace(/[\\\/][^\\\/]+$/, "");
          if (drawingFolder !== connectedFolder) found.push(`${regionAt}.sourceOwnership.connected.path: connected Component must share the ComponentBase folder`);
          if (ownership.parentUses !== "connected-component") found.push(`${regionAt}.sourceOwnership.parentUses: outer Base must compose the connected Component when one exists`);
        } else if (ownership?.parentUses !== "drawing-component") {
          found.push(`${regionAt}.sourceOwnership.parentUses: a region without a connected Component must compose its drawing ComponentBase`);
        }
        const localStates = (region.data?.states ?? []).filter((state) => !(page.pageStates ?? []).includes(state));
        if (localStates.length > 0 && ownership?.stateOwner !== "block") found.push(`${regionAt}.sourceOwnership.stateOwner: local states ${localStates.join(", ")} require a block owner`);
        if (["page", "layout", "overlay"].includes(ownership?.stateOwner) && localStates.length > 0) found.push(`${regionAt}.sourceOwnership: PageProps, LayoutProps or OverlayProps may not proxy block state or data as outer-surface state`);
        if (ownership?.stateOwner === "block" && ownership.drawing?.path === ownership.compositor?.path) found.push(`${regionAt}.sourceOwnership: block ComponentBase drawing must be distinct from its PageBase, LayoutBase or OverlayBase compositor`);
        for (const state of region.data?.states ?? []) {
          if (!(page.states ?? []).includes(state)) found.push(`${regionAt}.data.states: unknown render state ${state}`);
          regionOwnedStates.add(state);
        }
      }
      const unownedStates = (page.states ?? []).filter((state) => !regionOwnedStates.has(state));
      if (unownedStates.length > 0) found.push(`${at}.renderContract.pages.${page.id}.states: every render state needs a page or block region owner; unowned ${unownedStates.join(", ")}`);
      for (const transition of page.transitions ?? []) {
        if (allTransitionIds.has(transition.id)) found.push(`${at}.renderContract.pages.${page.id}.transitions: duplicate transition ${transition.id}`);
        allTransitionIds.add(transition.id);
        if (transition.fromPageId !== page.id) found.push(`${at}.renderContract.pages.${page.id}.transitions.${transition.id}: containing page must own the fromPageId endpoint`);
        const fromPage = contractPages.get(transition.fromPageId);
        const toPage = contractPages.get(transition.toPageId);
        if (!fromPage || !(fromPage.states ?? []).includes(transition.fromStateId)) found.push(`${at}.renderContract.pages.${page.id}.transitions.${transition.id}: from endpoint must name a declared render state`);
        if (!toPage || !(toPage.states ?? []).includes(transition.toStateId)) found.push(`${at}.renderContract.pages.${page.id}.transitions.${transition.id}: to endpoint must name a declared render state`);
      }
    }
    for (const selectedTargetKey of selectedTargetKeys) for (const viewport of viewportIds) {
      if (!coverageKeys.has(`${selectedTargetKey}/${viewport}`)) found.push(`${at}.renderContract.renders: selected target ${selectedTargetKey} must cover viewport ${viewport}`);
    }
  }
  return found;
}

function stagedLayoutLaws(data) {
  if (data.schema !== 7 || !Array.isArray(data.candidates)) return [];
  const found = [];
  const stage = data.envelope?.stage;
  const asSet = (values) => [...new Set(values)].sort();
  if (stage === "pages") {
    if (!["generate", "brainstorm"].includes(data.envelope?.mode)) found.push("envelope.mode: pages stage requires generate or brainstorm");
    if (data.envelope?.approvedPageAt !== undefined) found.push("envelope.approvedPageAt: pages stage cannot claim approval before the owner approves its page contract");
  } else if (stage === "states") {
    if (data.envelope?.mode !== "expand-states") found.push("envelope.mode: states stage requires expand-states");
    if (data.candidates.length !== 1) found.push("candidates: states stage expands exactly one approved page contract");
    if (!/^[a-f0-9]{64}$/.test(data.envelope?.approvedPageAt ?? "")) found.push("envelope.approvedPageAt: states stage requires the approved canonical page-contract hash");
  } else {
    found.push("envelope.stage: schema 7 requires pages or states");
  }

  for (const [candidateIndex, candidate] of data.candidates.entries()) {
    const at = `candidates[${candidateIndex}]`;
    if (stage === "pages") {
      if (candidate.renderContract !== undefined) found.push(`${at}.renderContract: pages stage stops before state expansion and source authority`);
      if (candidate.executionPrompt !== undefined) found.push(`${at}.executionPrompt: pages stage cannot carry a source-write handoff`);
    }
    const synthesis = candidate.synthesis;
    const pageContract = candidate.pageContract;
    if (!synthesis || !pageContract) continue;
    if (pageContract.candidateId !== candidate.id) found.push(`${at}.pageContract.candidateId: must equal candidate id ${candidate.id}`);
    if (stage === "states") {
      const pageHash = createHash("sha256").update(canonical(pageContract)).digest("hex");
      if (pageHash !== data.envelope?.approvedPageAt) found.push(`${at}.pageContract: drifted after page approval; return to the pages stage`);
    }

    const candidatePages = new Map((candidate.pages ?? []).map((page) => [page.id, page]));
    const candidateRegions = new Map((candidate.regions ?? []).map((region) => [region.name, region]));
    const pageIntents = new Map();
    const renderIntents = new Map();
    for (const pageIntent of synthesis.pageIntents ?? []) {
      if (pageIntents.has(pageIntent.pageId)) found.push(`${at}.synthesis.pageIntents: duplicate page intent ${pageIntent.pageId}`);
      pageIntents.set(pageIntent.pageId, pageIntent);
      const page = candidatePages.get(pageIntent.pageId);
      if (!page) found.push(`${at}.synthesis.pageIntents.${pageIntent.pageId}: unknown candidate page`);
      else if (pageIntent.route !== page.route) found.push(`${at}.synthesis.pageIntents.${pageIntent.pageId}.route: must equal candidate route`);
      for (const renderIntent of pageIntent.renderIntents ?? []) {
        if (renderIntents.has(renderIntent.id)) found.push(`${at}.synthesis.pageIntents: duplicate render intent ${renderIntent.id}`);
        renderIntents.set(renderIntent.id, {pageId: pageIntent.pageId, value: renderIntent});
      }
    }
    if (canonical(asSet(pageIntents.keys())) !== canonical(asSet(candidatePages.keys()))) found.push(`${at}.synthesis.pageIntents: must identify every candidate page exactly before track synthesis`);
    const journeySteps = new Map();
    for (const journey of synthesis.customerJourneys ?? []) {
      for (const step of journey.steps ?? []) {
        if (journeySteps.has(step.id)) found.push(`${at}.synthesis.customerJourneys: duplicate journey step ${step.id}`);
        journeySteps.set(step.id, step);
        if (!candidatePages.has(step.pageId)) found.push(`${at}.synthesis.customerJourneys.${step.id}.pageId: unknown candidate page ${step.pageId}`);
      }
    }

    const capabilities = new Map();
    for (const capability of synthesis.capabilities ?? []) {
      if (capabilities.has(capability.regionId)) found.push(`${at}.synthesis.capabilities: duplicate region capability ${capability.regionId}`);
      capabilities.set(capability.regionId, capability);
      if (!candidateRegions.has(capability.regionId)) found.push(`${at}.synthesis.capabilities.${capability.regionId}: unknown candidate region`);
    }
    if (canonical(asSet(capabilities.keys())) !== canonical(asSet(candidateRegions.keys()))) found.push(`${at}.synthesis.capabilities: must classify every candidate region exactly`);

    const intersections = new Map();
    for (const intersection of synthesis.intersections ?? []) {
      if (intersections.has(intersection.pageId)) found.push(`${at}.synthesis.intersections: duplicate page intersection ${intersection.pageId}`);
      intersections.set(intersection.pageId, intersection);
      const page = candidatePages.get(intersection.pageId);
      if (!page) found.push(`${at}.synthesis.intersections.${intersection.pageId}: unknown candidate page`);
      for (const stepId of intersection.journeyStepIds ?? []) {
        const step = journeySteps.get(stepId);
        if (!step) found.push(`${at}.synthesis.intersections.${intersection.pageId}.journeyStepIds: unknown journey step ${stepId}`);
        else if (step.pageId !== intersection.pageId) found.push(`${at}.synthesis.intersections.${intersection.pageId}.journeyStepIds: ${stepId} belongs to ${step.pageId}`);
      }
      if (page && canonical(asSet(intersection.regionIds ?? [])) !== canonical(asSet(page.regions ?? []))) found.push(`${at}.synthesis.intersections.${intersection.pageId}.regionIds: must cover every page region exactly`);
      const boundIntentIds = new Set();
      const boundStepIds = new Set();
      const boundRegionIds = new Set();
      const boundBusinessObligations = new Set();
      for (const [bindingIndex, binding] of (intersection.bindings ?? []).entries()) {
        const bindingAt = `${at}.synthesis.intersections.${intersection.pageId}.bindings[${bindingIndex}]`;
        const renderIntent = renderIntents.get(binding.renderIntentId);
        if (!renderIntent) found.push(`${bindingAt}.renderIntentId: unknown render intent ${binding.renderIntentId}`);
        else if (renderIntent.pageId !== intersection.pageId) found.push(`${bindingAt}.renderIntentId: ${binding.renderIntentId} belongs to ${renderIntent.pageId}`);
        if (boundIntentIds.has(binding.renderIntentId)) found.push(`${bindingAt}.renderIntentId: render intent must bind exactly once`);
        boundIntentIds.add(binding.renderIntentId);
        for (const stepId of binding.journeyStepIds ?? []) {
          const step = journeySteps.get(stepId);
          if (!step) found.push(`${bindingAt}.journeyStepIds: unknown journey step ${stepId}`);
          else if (step.pageId !== intersection.pageId) found.push(`${bindingAt}.journeyStepIds: ${stepId} belongs to ${step.pageId}`);
          boundStepIds.add(stepId);
        }
        for (const regionId of binding.regionIds ?? []) {
          if (!page?.regions?.includes(regionId)) found.push(`${bindingAt}.regionIds: ${regionId} is not owned by page ${intersection.pageId}`);
          if (!capabilities.has(regionId)) found.push(`${bindingAt}.regionIds: ${regionId} has no contract-first capability`);
          boundRegionIds.add(regionId);
        }
        for (const obligation of binding.businessObligations ?? []) boundBusinessObligations.add(obligation);
      }
      const expectedIntentIds = (pageIntents.get(intersection.pageId)?.renderIntents ?? []).map((intent) => intent.id);
      if (canonical(asSet(boundIntentIds)) !== canonical(asSet(expectedIntentIds))) found.push(`${at}.synthesis.intersections.${intersection.pageId}.bindings: must bind every page render intent exactly`);
      if (canonical(asSet(boundStepIds)) !== canonical(asSet(intersection.journeyStepIds ?? []))) found.push(`${at}.synthesis.intersections.${intersection.pageId}.bindings: journey rows must equal the page journey intersection`);
      if (canonical(asSet(boundRegionIds)) !== canonical(asSet(intersection.regionIds ?? []))) found.push(`${at}.synthesis.intersections.${intersection.pageId}.bindings: region rows must equal the page region intersection`);
      if (canonical(asSet(boundBusinessObligations)) !== canonical(asSet(intersection.businessObligations ?? []))) found.push(`${at}.synthesis.intersections.${intersection.pageId}.bindings: business rows must equal the page business intersection`);
    }
    if (canonical(asSet(intersections.keys())) !== canonical(asSet(candidatePages.keys()))) found.push(`${at}.synthesis.intersections: must synthesize every candidate page exactly`);

    const anatomyByPage = new Map((pageContract.pages ?? []).map((page) => [page.pageId, page]));
    const inventoryByPage = new Map((pageContract.stateInventory ?? []).map((page) => [page.pageId, page]));
    if (anatomyByPage.size !== (pageContract.pages ?? []).length) found.push(`${at}.pageContract.pages: duplicate page anatomy`);
    if (inventoryByPage.size !== (pageContract.stateInventory ?? []).length) found.push(`${at}.pageContract.stateInventory: duplicate page inventory`);
    if (canonical(asSet(anatomyByPage.keys())) !== canonical(asSet(candidatePages.keys()))) found.push(`${at}.pageContract.pages: must cover every candidate page exactly`);
    if (canonical(asSet(inventoryByPage.keys())) !== canonical(asSet(candidatePages.keys()))) found.push(`${at}.pageContract.stateInventory: must cover every candidate page exactly`);
    for (const [pageId, page] of candidatePages) {
      const anatomy = anatomyByPage.get(pageId);
      const inventory = inventoryByPage.get(pageId);
      if (!anatomy || !inventory) continue;
      if (anatomy.route !== page.route) found.push(`${at}.pageContract.pages.${pageId}.route: must equal candidate route`);
      if (anatomy.representativeState !== page.state) found.push(`${at}.pageContract.pages.${pageId}.representativeState: must equal candidate state ${page.state}`);
      if (canonical(asSet(anatomy.regions ?? [])) !== canonical(asSet(page.regions ?? []))) found.push(`${at}.pageContract.pages.${pageId}.regions: must cover every candidate region exactly`);
      if (!(inventory.states ?? []).includes(page.state)) found.push(`${at}.pageContract.stateInventory.${pageId}.states: must include representative state ${page.state}`);
      const unknownPageStates = (inventory.pageStates ?? []).filter((state) => !(inventory.states ?? []).includes(state));
      if (unknownPageStates.length > 0) found.push(`${at}.pageContract.stateInventory.${pageId}.pageStates: must be an architectural subset of declared render states; unknown ${unknownPageStates.join(", ")}`);
      const intersectionSteps = intersections.get(pageId)?.journeyStepIds ?? [];
      if (canonical(asSet(anatomy.journeyStepIds ?? [])) !== canonical(asSet(intersectionSteps))) found.push(`${at}.pageContract.pages.${pageId}.journeyStepIds: must equal the synthesized journey intersection`);
      if (stage === "states") {
        const renderPage = (candidate.renderContract?.pages ?? []).find((item) => item.id === pageId);
        if (renderPage && canonical(asSet(renderPage.states ?? [])) !== canonical(asSet(inventory.states ?? []))) found.push(`${at}.renderContract.pages.${pageId}.states: must expand the complete approved render-state inventory`);
        if (renderPage && canonical(asSet(renderPage.pageStates ?? [])) !== canonical(asSet(inventory.pageStates ?? []))) found.push(`${at}.renderContract.pages.${pageId}.pageStates: must preserve the approved architectural page-state subset`);
      }
    }

    const viewportIds = (pageContract.viewports ?? []).map((viewport) => viewport.id);
    if (new Set(viewportIds).size !== viewportIds.length) found.push(`${at}.pageContract.viewports: duplicate viewport identity`);
    const coverage = new Set();
    for (const [renderIndex, render] of (pageContract.renders ?? []).entries()) {
      const key = `${render.pageId}/${render.stateId}/${render.viewportId}`;
      if (coverage.has(key)) found.push(`${at}.pageContract.renders[${renderIndex}]: duplicate coverage ${key}`);
      coverage.add(key);
      const page = candidatePages.get(render.pageId);
      if (!page) found.push(`${at}.pageContract.renders[${renderIndex}].pageId: unknown page ${render.pageId}`);
      else {
        if (render.stateId !== page.state) found.push(`${at}.pageContract.renders[${renderIndex}].stateId: pages stage renders only representative state ${page.state}`);
        if (canonical(asSet(render.regions ?? [])) !== canonical(asSet(page.regions ?? []))) found.push(`${at}.pageContract.renders[${renderIndex}].regions: must cover every region of ${render.pageId}`);
      }
      if (!viewportIds.includes(render.viewportId)) found.push(`${at}.pageContract.renders[${renderIndex}].viewportId: unknown viewport ${render.viewportId}`);
    }
    for (const page of candidate.pages ?? []) for (const viewportId of viewportIds) {
      if (!coverage.has(`${page.id}/${page.state}/${viewportId}`)) found.push(`${at}.pageContract.renders: missing ${page.id}/${page.state}/${viewportId}`);
    }
  }
  return found;
}

function pageSetLaws(data) {
  if (data.schema < 4 || !Array.isArray(data.candidates)) return [];
  const found = [];
  const candidates = data.candidates;
  const first = candidates[0];
  if (data.schema === 7 && data.envelope?.stage === "states" && candidates.length !== 1) found.push("candidates: states stage requires exactly one approved complete long-page/full-flow result");
  else if (data.schema >= 5 && data.envelope?.mode === "generate" && candidates.length !== 1) found.push("candidates: generate mode requires exactly one complete long-page/full-flow result");
  else if (data.schema >= 5 && data.envelope?.mode === "brainstorm" && (candidates.length < 3 || candidates.length > 4)) found.push("candidates: explicit brainstorm mode requires 3-4 targeted alternatives");
  else if (data.schema >= 5 && !["generate", "brainstorm", ...(data.schema === 7 ? ["expand-states"] : [])].includes(data.envelope?.mode)) found.push(`envelope.mode: schema ${data.schema} requires generate, brainstorm${data.schema === 7 ? ", or expand-states" : ""}`);
  else if (data.schema < 5 && (candidates.length < 3 || candidates.length > 4)) found.push("candidates: legacy page/flow review requires 3-4 complete page-set choices");
  if (data.schema >= 5 && data.envelope?.mode === "brainstorm" && !/^[a-f0-9]{64}$/.test(data.envelope?.baselineCandidateAt ?? "")) found.push("envelope.baselineCandidateAt: brainstorm requires the reviewed generated baseline");
  if (data.schema >= 5 && data.envelope?.mode === "generate" && data.envelope?.baselineCandidateAt !== undefined) found.push("envelope.baselineCandidateAt: generate mode has no earlier candidate dependency");

  const scopeSignature = canonical((first?.pages ?? []).map((page) => ({id: page.id, route: page.route, state: page.state})));
  const existing = new Map();
  for (const page of first?.pages ?? []) {
    for (const node of page.nodes ?? []) if (node.change === "existing") existing.set(`${page.id}/${node.id}`, canonical(node));
  }

  for (const [candidateIndex, candidate] of candidates.entries()) {
    if (data.schema >= 5) {
      if (candidate.systemId !== "starci-master") found.push(`candidates[${candidateIndex}].systemId: schema ${data.schema} requires starci-master`);
      if (!candidate.pageOverride || !Array.isArray(candidate.pageOverride.deviations)) found.push(`candidates[${candidateIndex}].pageOverride: schema ${data.schema} requires deviations-only page override`);
      if (candidate.direction !== undefined) found.push(`candidates[${candidateIndex}].direction: schema ${data.schema} must not reselect taste outside MASTER`);
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

const broken = [...laws(data), ...directionLaws(data, vocabulary), ...layoutRegionLaws(data), ...pageSetLaws(data), ...stagedLayoutLaws(data), ...renderContractLaws(data), ...blockModeLaws(data)];

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
