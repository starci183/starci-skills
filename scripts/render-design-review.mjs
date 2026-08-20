import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from "node:fs";
import {dirname, join, resolve, sep} from "node:path";
import {fileURLToPath} from "node:url";
import {functionalPreviewFailures} from "./functional-design-preview.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const trustRoot = dirname(dirname(scriptPath));
const appRoot = join(trustRoot, "publication", "design-review-preview", "app");

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hash(value) {
  return sha256(canonical(value));
}

function load(path, label) {
  if (!path || !existsSync(path)) throw new Error(`${label} is missing: ${path ?? "<not supplied>"}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function optional(path) {
  return path ? load(path, "optional review input") : undefined;
}

function validateViewport(viewport, label) {
  if (!viewport || !Number.isInteger(viewport.width) || viewport.width < 240 || !Number.isInteger(viewport.height) || viewport.height < 240) {
    throw new Error(`${label} requires an integer viewport width and height of at least 240`);
  }
  return {width: viewport.width, height: viewport.height};
}

function previewDocument(source, declaredStates, label) {
  if (typeof source !== "string" || !source.trim()) throw new Error(`${label} preview.html is empty`);
  if (!Array.isArray(declaredStates) || !declaredStates.length) throw new Error(`${label} declares no states`);
  const expected = new Map();
  for (const state of declaredStates) {
    if (!state?.id || expected.has(state.id)) throw new Error(`${label} has an absent or duplicate state id`);
    expected.set(state.id, validateViewport(state.viewport, `${label} state ${state.id}`));
  }

  const found = new Map();
  const templatePattern = /<template\b[^>]*\bdata-state\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/template>/gi;
  const shell = source.replace(templatePattern, (_match, doubleQuoted, singleQuoted, markup) => {
    const id = doubleQuoted ?? singleQuoted;
    if (found.has(id)) throw new Error(`${label} preview.html repeats state template ${id}`);
    found.set(id, markup);
    return "";
  });
  const expectedIds = [...expected.keys()];
  const missing = expectedIds.filter((id) => !found.has(id));
  const extra = [...found.keys()].filter((id) => !expected.has(id));
  if (missing.length || extra.length) {
    throw new Error(`${label} preview state mismatch (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`);
  }

  const bodyMatch = shell.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) throw new Error(`${label} preview.html requires one body containing only state templates`);
  if (bodyMatch[1].replace(/<!--[\s\S]*?-->/g, "").trim()) {
    throw new Error(`${label} preview.html must keep product markup inside data-state templates`);
  }
  const closingBody = shell.search(/<\/body>/i);
  const states = expectedIds.map((id) => ({
    id,
    viewport: expected.get(id),
    html: `${shell.slice(0, closingBody)}${found.get(id)}${shell.slice(closingBody)}`
  }));
  return {html: states[0].html, states};
}

function draftPreview(indexPath) {
  const index = load(indexPath, "HTML preview index");
  const candidateCount = index?.candidates?.length ?? 0;
  const validCount = candidateCount >= 3 && candidateCount <= 4;
  if (index.schema !== 2 || !["layout", "block"].includes(index.phase) || !Array.isArray(index.candidates) || !validCount) {
    throw new Error("HTML preview index requires schema 2, phase layout|block and 3-4 authored functional candidates");
  }
  const root = dirname(resolve(indexPath));
  const ids = new Set();
  return {
    ...index,
    candidates: index.candidates.map((candidate) => {
      if (!candidate?.id || !candidate.html || !Array.isArray(candidate.states) || !candidate.states.length) {
        throw new Error("each HTML preview candidate requires id, one preview.html path and at least one declared state");
      }
      if (ids.has(candidate.id)) throw new Error(`duplicate HTML preview candidate id: ${candidate.id}`);
      ids.add(candidate.id);
      const source = readFileSync(resolve(root, candidate.html), "utf8");
      const functionalFailures = functionalPreviewFailures({
        schemaVersion: 2,
        kind: index.phase,
        functional: candidate.functional,
        states: candidate.states,
        contentMatrix: candidate.contentMatrix,
        conditionInventory: candidate.conditionInventory,
        transitions: candidate.transitions
      }, source, `candidate ${candidate.id}`, {requirePrinciples: false});
      if (functionalFailures.length) throw new Error(functionalFailures.join("; "));
      return {id: candidate.id, preview: previewDocument(source, candidate.states, `candidate ${candidate.id}`)};
    })
  };
}

function revisionBundle(registryRoot, registry, revisionHash, expected) {
  const ref = registry.revisions?.byHash?.[revisionHash];
  if (!ref) return undefined;
  const bundleRoot = join(registryRoot, ref.path);
  const design = load(join(bundleRoot, "design.json"), `design revision ${revisionHash}`);
  const previewPath = join(bundleRoot, "preview.html");
  if (!existsSync(previewPath)) throw new Error(`design revision ${revisionHash} preview.html is missing`);
  const source = readFileSync(previewPath, "utf8");
  const previewSha256 = sha256(source);
  if (design.previewSha256 !== previewSha256) throw new Error(`design revision ${revisionHash} preview digest does not match preview.html`);
  const {previewSha256: _digest, ...decision} = design;
  const computed = sha256(`${canonical(decision)}\n${previewSha256}`);
  if (computed !== revisionHash || ref.hash !== revisionHash) throw new Error(`design revision ${revisionHash} hash is invalid`);
  if (design.schemaVersion !== 2 || design.kind !== expected.kind || design.layoutId !== expected.layoutId) {
    throw new Error(`design revision ${revisionHash} identity does not match ${expected.kind} ${expected.layoutId}`);
  }
  if (expected.kind === "block" && (design.blockId !== expected.blockId || design.layoutHash !== expected.layoutHash)) {
    throw new Error(`design revision ${revisionHash} parent binding does not match ${expected.layoutId}/${expected.blockId}`);
  }
  const functionalFailures = functionalPreviewFailures(design, source, `design revision ${revisionHash}`);
  if (functionalFailures.length) throw new Error(functionalFailures.join("; "));
  return {artifact: design.artifact, preview: previewDocument(source, design.states, `design revision ${revisionHash}`)};
}

function legacyObject(registryRoot, registry, objectHash) {
  const ref = registry.objects?.byHash?.[objectHash];
  if (!ref) throw new Error(`registry object or revision ${objectHash} is missing`);
  return load(join(registryRoot, ref.path), `registry object ${objectHash}`);
}

function attachPreviewCandidates(candidates, preview) {
  for (const candidate of candidates) {
    const authored = preview.candidates.find((item) => item.id === candidate.id);
    if (!authored) throw new Error(`HTML preview is missing candidate ${candidate.id}`);
    const authoredStates = new Set(authored.preview.states.map((state) => state.id));
    const missingPages = (candidate.pages ?? []).filter((page) => !authoredStates.has(page.state));
    if (missingPages.length) throw new Error(`HTML preview candidate ${candidate.id} is missing composed pages: ${missingPages.map((page) => `${page.id}:${page.state}`).join(", ")}`);
    candidate.preview = authored.preview;
  }
  const unknown = preview.candidates.filter((item) => !candidates.some((candidate) => candidate.id === item.id));
  if (unknown.length) throw new Error(`HTML preview contains candidates absent from the artifact: ${unknown.map((item) => item.id).join(", ")}`);
}

function vocabularyMap(vocabulary) {
  return new Map((vocabulary.tokens ?? []).map((token) => [token.name, token.declarations?.[0]?.value]));
}

function resolveTheme(direction, vocabulary) {
  const known = vocabularyMap(vocabulary);
  return Object.fromEntries(Object.entries(direction?.roles ?? {}).map(([role, decision]) => {
    if (decision.verdict === "none") return [role, {verdict: "none", value: null}];
    if (decision.verdict === "new") return [role, {verdict: "new", token: decision.token, value: decision.value}];
    return [role, {verdict: "reuse", token: decision.token, value: known.get(decision.token) ?? null}];
  }));
}

function candidateStatus(candidateHash, currentHead) {
  if (!currentHead) return "proposed";
  return candidateHash === currentHead ? "accepted" : "proposed";
}

function publicationBlockCandidate(anatomy, currentHead, candidateHash = hash(anatomy), preview) {
  return {
    id: anatomy.id,
    hash: candidateHash,
    status: candidateStatus(candidateHash, currentHead),
    reason: anatomy.reason,
    axes: anatomy.axes,
    states: anatomy.states,
    parts: anatomy.parts,
    ...(anatomy.restingCount ? {restingCount: anatomy.restingCount} : {}),
    ...(preview ? {preview} : {})
  };
}

function currentChild(registryRoot, registry, layoutId, layoutHash, blockId) {
  const head = registry.blockHeads?.[`${layoutId}/${blockId}`];
  if (!head) return {layoutId, layoutHash, blockId, status: "missing", candidates: []};
  const revision = revisionBundle(registryRoot, registry, head.head, {kind: "block", layoutId, blockId, layoutHash: head.layoutHash});
  const anatomy = revision?.artifact ?? legacyObject(registryRoot, registry, head.head);
  const candidate = publicationBlockCandidate(anatomy, head.head, head.head, revision?.preview);
  if (head.layoutHash !== layoutHash) {
    return {layoutId, layoutHash, blockId, status: "stale", currentHead: head.head, recommendedId: candidate.id, candidates: [candidate]};
  }
  return {layoutId, layoutHash, blockId, status: "accepted", currentHead: head.head, recommendedId: candidate.id, renderedId: candidate.id, candidates: [candidate]};
}

function publicationLayoutCandidate(candidate, registryRoot, registry, layoutId, currentHead, candidateHash = hash(candidate), preview) {
  return {
    id: candidate.id,
    hash: candidateHash,
    status: candidateStatus(candidateHash, currentHead),
    reason: candidate.reason,
    axes: candidate.axes,
    ...(candidate.pages ? {pages: candidate.pages} : {}),
    regions: candidate.regions.map((region) => ({...region, block: currentChild(registryRoot, registry, layoutId, candidateHash, region.name)})),
    ...(preview ? {preview} : {})
  };
}

function layoutCandidatePolicy(artifact) {
  return {minimum: 3, maximum: 4, reason: artifact.schema < 4 ? "legacy layout review" : "model-ranked page or flow review"};
}

function currentLayouts(registryRoot, registry, vocabulary) {
  return Object.entries(registry.layoutHeads ?? {}).sort(([left], [right]) => left.localeCompare(right)).map(([layoutId, head]) => {
    const revision = revisionBundle(registryRoot, registry, head.head, {kind: "layout", layoutId});
    const candidate = revision?.artifact ?? legacyObject(registryRoot, registry, head.head);
    return {
      layoutId,
      ...(head.routePattern ? {routePattern: head.routePattern} : {}),
      currentHead: head.head,
      recommendedId: candidate.id,
      theme: resolveTheme(candidate.direction, vocabulary),
      candidates: [publicationLayoutCandidate(candidate, registryRoot, registry, layoutId, head.head, head.head, revision?.preview)]
    };
  });
}

function overlayLayoutReview(layouts, options, registryRoot, registry, vocabulary) {
  const artifact = load(options.artifact, "layout artifact");
  const policy = layoutCandidatePolicy(artifact);
  const count = artifact.candidates?.length ?? 0;
  if (artifact.envelope?.project !== options.project || !Array.isArray(artifact.candidates) || count < policy.minimum || count > policy.maximum) {
    throw new Error(`layout artifact must match the declared project and contain ${policy.minimum === policy.maximum ? policy.minimum : `${policy.minimum}-${policy.maximum}`} candidate(s) for ${policy.reason}`);
  }
  const layoutId = options.layoutId ?? artifact.envelope.surface;
  const currentHead = registry.layoutHeads?.[layoutId]?.head;
  const candidates = artifact.candidates.map((candidate) => publicationLayoutCandidate(candidate, registryRoot, registry, layoutId, currentHead));
  const recommendedId = options.recommendedId ?? candidates[0]?.id;
  if (!candidates.some((candidate) => candidate.id === recommendedId)) throw new Error("recommended layout candidate is absent");
  const directionBatch = optional(options.directions);
  const review = {
    layoutId,
    ...(registry.layoutHeads?.[layoutId]?.routePattern ? {routePattern: registry.layoutHeads[layoutId].routePattern} : {}),
    ...(currentHead ? {currentHead} : {}),
    recommendedId,
    ...(artifact.envelope?.scope ? {scope: artifact.envelope.scope} : {}),
    theme: resolveTheme(artifact.candidates[0]?.direction, vocabulary),
    candidates,
    ...(directionBatch?.directions ? {visualDirections: directionBatch.directions} : {}),
    ...(directionBatch?.recommended ? {visualDirectionRecommendation: directionBatch.recommended} : {})
  };
  const index = layouts.findIndex((layout) => layout.layoutId === layoutId);
  if (index >= 0) layouts[index] = review;
  else layouts.push(review);
  const selected = candidates.find((candidate) => candidate.id === recommendedId);
  return `#/layouts/${layoutId}/${selected.hash}`;
}

function overlayBlockReview(layouts, options, registryRoot, registry) {
  const artifact = load(options.artifact, "block artifact");
  if (artifact.envelope?.project !== options.project || !Array.isArray(artifact.anatomies) || artifact.anatomies.length < 3 || artifact.anatomies.length > 4) {
    throw new Error("block artifact must match the declared project and contain exactly 3-4 candidates");
  }
  const layoutId = options.layoutId;
  const blockId = options.blockId ?? artifact.envelope.region;
  const layoutHash = artifact.envelope.layoutHash;
  if (!layoutId || !blockId || registry.layoutHeads?.[layoutId]?.head !== layoutHash) throw new Error("block review requires the accepted parent layoutId, layoutHash and blockId");
  const layout = layouts.find((item) => item.layoutId === layoutId);
  const candidate = layout?.candidates.find((item) => item.hash === layoutHash);
  const region = candidate?.regions.find((item) => item.name === blockId);
  if (!layout || !candidate || !region) throw new Error("blockId is not declared by the accepted parent layout");
  const currentHead = registry.blockHeads?.[`${layoutId}/${blockId}`]?.head;
  const drafted = artifact.anatomies.map((anatomy) => publicationBlockCandidate(anatomy, currentHead));
  const recommendedId = options.recommendedId ?? drafted[0]?.id;
  if (!drafted.some((item) => item.id === recommendedId)) throw new Error("recommended block candidate is absent");
  region.block = {...region.block, recommendedId, candidates: drafted};
  return `#/layouts/${layoutId}/${layoutHash}/blocks/${blockId}`;
}

function resolveLayoutFlows(flows, layouts) {
  if (flows === undefined) return [];
  if (!Array.isArray(flows)) throw new Error("layout draft flows must be an array");
  const flowIds = new Set();
  return flows.map((flow) => {
    if (!flow?.id || !flow?.label || !Array.isArray(flow.nodes) || !flow.nodes.length) throw new Error("each layout draft flow requires id, label and at least one node");
    if (flowIds.has(flow.id)) throw new Error(`duplicate layout draft flow id: ${flow.id}`);
    flowIds.add(flow.id);
    const nodeIds = new Set();
    const nodes = flow.nodes.map((node, index) => {
      if (!node?.id || !node?.label || !node?.layoutId) throw new Error(`flow ${flow.id} has an incomplete node`);
      if (nodeIds.has(node.id)) throw new Error(`flow ${flow.id} has duplicate node id: ${node.id}`);
      nodeIds.add(node.id);
      const layout = layouts.find((item) => item.layoutId === node.layoutId);
      if (!layout) throw new Error(`flow ${flow.id} references absent layout: ${node.layoutId}`);
      const candidate = layout.candidates.find((item) => item.id === layout.recommendedId) ?? layout.candidates[0];
      if (!candidate) throw new Error(`flow ${flow.id} layout has no candidate: ${node.layoutId}`);
      if (node.blockId && !candidate.regions.some((region) => region.name === node.blockId)) throw new Error(`flow ${flow.id} references absent block region: ${node.layoutId}/${node.blockId}`);
      const route = node.blockId ? `#/layouts/${node.layoutId}/${candidate.hash}/blocks/${node.blockId}` : `#/layouts/${node.layoutId}/${candidate.hash}`;
      return {...node, order: index + 1, route};
    });
    const edges = flow.edges ?? nodes.slice(1).map((node, index) => ({from: nodes[index].id, to: node.id}));
    if (!Array.isArray(edges)) throw new Error(`flow ${flow.id} edges must be an array`);
    for (const edge of edges) if (!nodeIds.has(edge?.from) || !nodeIds.has(edge?.to)) throw new Error(`flow ${flow.id} has an edge with an absent node`);
    return {id: flow.id, label: flow.label, nodes, edges};
  });
}

function attachReviewPreview(layouts, indexPath) {
  const preview = draftPreview(indexPath);
  const layout = layouts.find((item) => item.layoutId === preview.layoutId);
  if (!layout) throw new Error("HTML preview layoutId is absent from the review graph");
  if (preview.phase === "layout") {
    attachPreviewCandidates(layout.candidates, preview);
    return;
  }
  const candidate = layout.candidates.find((item) => item.hash === preview.layoutHash);
  const region = candidate?.regions.find((item) => item.name === preview.blockId);
  if (!candidate || !region) throw new Error("HTML block preview must bind the accepted layoutHash and declared blockId");
  attachPreviewCandidates(region.block.candidates, preview);
}

function validateManifestPreviews(layouts) {
  for (const layout of layouts) for (const candidate of layout.candidates) {
    // Legacy accepted objects predate immutable preview bundles. Keep them visible as
    // read-only compatibility while requiring authored HTML for every draft and every
    // revision-backed candidate. A newly accepted revision cannot reach this branch:
    // revisionBundle() already refuses a missing or mismatched preview.html.
    if (!candidate.preview?.states?.length) {
      if (candidate.status === "accepted") continue;
      throw new Error(`layout ${layout.layoutId}/${candidate.id} has no packaged HTML states`);
    }
    for (const region of candidate.regions) for (const block of region.block.candidates) {
      if (!block.preview?.states?.length) {
        if (block.status === "accepted") continue;
        throw new Error(`block ${layout.layoutId}/${region.name}/${block.id} has no packaged HTML states`);
      }
      const authored = new Set(block.preview.states.map((state) => state.id));
      const missing = (block.states ?? []).filter((state) => !authored.has(state));
      if (missing.length) throw new Error(`block ${layout.layoutId}/${region.name}/${block.id} is missing authored states: ${missing.join(", ")}`);
    }
  }
}

function assertOutputPath(outDir, project) {
  const marker = `${sep}.worktrees${sep}${project}${sep}cache${sep}preview${sep}`;
  if (!`${resolve(outDir)}${sep}`.includes(marker)) throw new Error(`preview output must stay under .worktrees/${project}/cache/preview`);
}

function runNpm(args) {
  const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npm.cmd", ...args] : args;
  execFileSync(command, commandArgs, {cwd: appRoot, stdio: "inherit"});
}

function ensureRuntime() {
  if (existsSync(join(appRoot, "node_modules", "vite", "package.json"))) return;
  runNpm(["ci", "--ignore-scripts"]);
}

function runtimeFingerprint() {
  const files = ["index.html", "package-lock.json", "package.json", "tsconfig.json", "vite.config.ts"];
  const sourceRoot = join(appRoot, "src");
  for (const name of readdirSync(sourceRoot)) if (statSync(join(sourceRoot, name)).isFile()) files.push(join("src", name));
  return sha256(files.sort().map((file) => `${file}\n${readFileSync(join(appRoot, file), "utf8")}`).join("\n"));
}

function buildRuntime(outDir) {
  ensureRuntime();
  const fingerprint = runtimeFingerprint();
  const marker = join(outDir, ".viewer-build.sha256");
  if (existsSync(join(outDir, "index.html")) && existsSync(marker) && readFileSync(marker, "utf8").trim() === fingerprint) return;
  runNpm(["run", "build", "--", "--outDir", outDir, "--emptyOutDir", "false"]);
  writeFileSync(marker, `${fingerprint}\n`, "utf8");
}

export function buildManifest(options) {
  const registryRoot = resolve(options.registry);
  const registry = load(join(registryRoot, "design-registry-v2.json"), "design registry");
  const vocabulary = load(options.vocabulary, "visual vocabulary");
  const layouts = currentLayouts(registryRoot, registry, vocabulary);
  if (!layouts.length && options.phase !== "layout" && !options.layoutDraftIndex) throw new Error("design registry has no accepted layout heads");
  let entryRoute;
  let flows = [];
  const previewIndexes = [];
  if (options.layoutDraftIndex) {
    const indexPath = resolve(options.layoutDraftIndex);
    const payload = load(indexPath, "layout draft index");
    const drafts = Array.isArray(payload) ? payload : payload.layouts;
    if (!Array.isArray(drafts) || !drafts.length) throw new Error("layout draft index must contain at least one entry");
    const root = dirname(indexPath);
    for (const draft of drafts) {
      if (!draft.htmlIndex) throw new Error(`layout draft ${draft.layoutId ?? "<unknown>"} requires htmlIndex`);
      const draftOptions = {...options, phase: "layout", ...draft, artifact: resolve(root, draft.artifact), ...(draft.directions ? {directions: resolve(root, draft.directions)} : {})};
      const route = overlayLayoutReview(layouts, draftOptions, registryRoot, registry, vocabulary);
      previewIndexes.push(resolve(root, draft.htmlIndex));
      entryRoute ??= route;
    }
    flows = resolveLayoutFlows(Array.isArray(payload) ? undefined : payload.flows, layouts);
  } else if (options.draftIndex) {
    const indexPath = resolve(options.draftIndex);
    const drafts = load(indexPath, "block draft index");
    if (!Array.isArray(drafts) || !drafts.length) throw new Error("block draft index must contain at least one entry");
    const root = dirname(indexPath);
    for (const draft of drafts) {
      if (!draft.htmlIndex) throw new Error(`block draft ${draft.blockId ?? "<unknown>"} requires htmlIndex`);
      const draftOptions = {...options, phase: "block", ...draft, artifact: resolve(root, draft.artifact)};
      const route = overlayBlockReview(layouts, draftOptions, registryRoot, registry);
      previewIndexes.push(resolve(root, draft.htmlIndex));
      entryRoute ??= route;
    }
  } else if (options.phase === "layout") {
    if (!options.htmlIndex) throw new Error("--html-index is required for layout review");
    entryRoute = overlayLayoutReview(layouts, options, registryRoot, registry, vocabulary);
    previewIndexes.push(resolve(options.htmlIndex));
  } else if (options.phase === "block") {
    if (!options.htmlIndex) throw new Error("--html-index is required for block review");
    entryRoute = overlayBlockReview(layouts, options, registryRoot, registry);
    previewIndexes.push(resolve(options.htmlIndex));
  } else if (options.allCurrent) {
    const first = layouts[0];
    const candidate = first.candidates.find((item) => item.id === first.recommendedId) ?? first.candidates[0];
    entryRoute = `#/layouts/${first.layoutId}/${candidate.hash}`;
  } else throw new Error("supply --all-current or --phase layout|block");

  for (const indexPath of previewIndexes) attachReviewPreview(layouts, indexPath);
  validateManifestPreviews(layouts);
  return {
    schemaVersion: 2,
    project: options.project,
    entryRoute,
    layouts,
    ...(flows.length ? {flows} : {}),
    evidence: [
      {label: "registry", value: join(registryRoot, "design-registry-v2.json")},
      {label: "vocabularyAt", value: vocabulary.digest},
      ...(options.artifact ? [{label: "reviewArtifact", value: options.artifact}] : []),
      ...(options.layoutDraftIndex ? [{label: "layoutDraftIndex", value: options.layoutDraftIndex}] : []),
      ...(options.draftIndex ? [{label: "draftIndex", value: options.draftIndex}] : []),
      ...previewIndexes.map((value) => ({label: "htmlPreviewIndex", value}))
    ]
  };
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--no-build") result.noBuild = true;
    else if (value === "--all-current") result.allCurrent = true;
    else if (value.startsWith("--")) {
      const key = value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      result[key] = argv[index + 1];
      index += 1;
    }
  }
  return result;
}

export function renderReview(options) {
  for (const required of ["project", "registry", "vocabulary", "out"]) if (!options[required]) throw new Error(`--${required} is required`);
  if (options.phase && !options.artifact) throw new Error("--artifact is required when --phase is supplied");
  const outDir = resolve(options.out);
  assertOutputPath(outDir, options.project);
  const manifest = buildManifest(options);
  mkdirSync(outDir, {recursive: true});
  if (!options.noBuild) buildRuntime(outDir);
  writeFileSync(join(outDir, "review-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return {outDir, manifest};
}

function main() {
  try {
    const result = renderReview(parseArgs(process.argv.slice(2)));
    console.log(`review graph ${result.manifest.project} (${result.manifest.layouts.length} layouts) -> ${join(result.outDir, "index.html")}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (resolve(process.argv[1] ?? "") === resolve(scriptPath)) main();
