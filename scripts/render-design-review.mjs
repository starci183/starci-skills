import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve, sep} from "node:path";
import {fileURLToPath} from "node:url";

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

function hash(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function load(path, label) {
  if (!path || !existsSync(path)) throw new Error(`${label} is missing: ${path ?? "<not supplied>"}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function optional(path) {
  return path ? load(path, "optional review input") : undefined;
}

function humanize(value) {
  return value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function defaultContent(project, identity) {
  return {
    eyebrow: project,
    title: humanize(identity),
    description: "Representative content makes layout density visible before child block design is accepted.",
    primaryAction: "Primary action",
    rows: [
      {title: "Primary evidence", description: "Rough layout content preserves measure without deciding block anatomy."},
      {title: "Secondary evidence", description: "Accepted child parts replace this representation after block approval."},
      {title: "Settled outcome", description: "A stable destination or result at the end of the reading order."}
    ]
  };
}

function defaultShell(project, identity) {
  return {
    product: humanize(project),
    activeItem: identity,
    navigation: [
      {id: "overview", label: "Overview"},
      {id: identity, label: humanize(identity)},
      {id: "related", label: "Related"}
    ]
  };
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

function registryObject(registryRoot, registry, objectHash) {
  const ref = registry.objects?.byHash?.[objectHash];
  if (!ref) throw new Error(`registry object ${objectHash} is missing`);
  return load(join(registryRoot, ref.path), `registry object ${objectHash}`);
}

function candidateStatus(candidateHash, currentHead) {
  if (!currentHead) return "proposed";
  return candidateHash === currentHead ? "accepted" : "proposed";
}

function publicationBlockCandidate(anatomy, currentHead) {
  const anatomyHash = hash(anatomy);
  return {
    id: anatomy.id,
    hash: anatomyHash,
    status: candidateStatus(anatomyHash, currentHead),
    reason: anatomy.reason,
    axes: anatomy.axes,
    states: anatomy.states,
    parts: anatomy.parts,
    ...(anatomy.restingCount ? {restingCount: anatomy.restingCount} : {})
  };
}

function currentChild(registryRoot, registry, layoutId, layoutHash, blockId) {
  const head = registry.blockHeads?.[`${layoutId}/${blockId}`];
  if (!head) return {layoutId, layoutHash, blockId, status: "missing", candidates: []};
  const anatomy = registryObject(registryRoot, registry, head.head);
  const candidate = publicationBlockCandidate(anatomy, head.head);
  if (head.layoutHash !== layoutHash) {
    return {
      layoutId,
      layoutHash,
      blockId,
      status: "stale",
      currentHead: head.head,
      recommendedId: candidate.id,
      candidates: [candidate]
    };
  }
  return {
    layoutId,
    layoutHash,
    blockId,
    status: "accepted",
    currentHead: head.head,
    recommendedId: candidate.id,
    renderedId: candidate.id,
    candidates: [candidate]
  };
}

function publicationLayoutCandidate(candidate, registryRoot, registry, layoutId, currentHead) {
  const candidateHash = hash(candidate);
  return {
    id: candidate.id,
    hash: candidateHash,
    status: candidateStatus(candidateHash, currentHead),
    reason: candidate.reason,
    axes: candidate.axes,
    regions: candidate.regions.map((region) => ({
      ...region,
      block: currentChild(registryRoot, registry, layoutId, candidateHash, region.name)
    }))
  };
}

function currentLayouts(registryRoot, registry, vocabulary, project, contentInput, shellInput) {
  return Object.entries(registry.layoutHeads ?? {}).sort(([left], [right]) => left.localeCompare(right)).map(([layoutId, head]) => {
    const candidate = registryObject(registryRoot, registry, head.head);
    return {
      layoutId,
      ...(head.routePattern ? {routePattern: head.routePattern} : {}),
      currentHead: head.head,
      recommendedId: candidate.id,
      theme: resolveTheme(candidate.direction, vocabulary),
      candidates: [publicationLayoutCandidate(candidate, registryRoot, registry, layoutId, head.head)],
      shell: shellInput ?? defaultShell(project, layoutId),
      content: contentInput ?? defaultContent(project, layoutId)
    };
  });
}

function overlayLayoutReview(layouts, options, registryRoot, registry, vocabulary, contentInput, shellInput) {
  const artifact = load(options.artifact, "layout artifact");
  if (artifact.envelope?.project !== options.project || !Array.isArray(artifact.candidates)) {
    throw new Error("layout artifact does not match the declared project");
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
    theme: resolveTheme(artifact.candidates[0]?.direction, vocabulary),
    candidates,
    ...(directionBatch?.directions ? {visualDirections: directionBatch.directions} : {}),
    ...(directionBatch?.recommended ? {visualDirectionRecommendation: directionBatch.recommended} : {}),
    shell: shellInput ?? defaultShell(options.project, layoutId),
    content: contentInput ?? defaultContent(options.project, layoutId)
  };
  const index = layouts.findIndex((layout) => layout.layoutId === layoutId);
  if (index >= 0) layouts[index] = review;
  else layouts.push(review);
  const selected = candidates.find((candidate) => candidate.id === recommendedId);
  return `#/layouts/${layoutId}/${selected.hash}`;
}

function overlayBlockReview(layouts, options, registryRoot, registry) {
  const artifact = load(options.artifact, "block artifact");
  if (artifact.envelope?.project !== options.project || !Array.isArray(artifact.anatomies)) {
    throw new Error("block artifact does not match the declared project");
  }
  const layoutId = options.layoutId;
  const blockId = options.blockId ?? artifact.envelope.region;
  const layoutHash = artifact.envelope.layoutHash;
  if (!layoutId || !blockId || registry.layoutHeads?.[layoutId]?.head !== layoutHash) {
    throw new Error("block review requires the accepted parent layoutId, layoutHash and blockId");
  }
  const layout = layouts.find((item) => item.layoutId === layoutId);
  const candidate = layout?.candidates.find((item) => item.hash === layoutHash);
  const region = candidate?.regions.find((item) => item.name === blockId);
  if (!layout || !candidate || !region) throw new Error("blockId is not declared by the accepted parent layout");

  const currentHead = registry.blockHeads?.[`${layoutId}/${blockId}`]?.head;
  const drafted = artifact.anatomies.map((anatomy) => publicationBlockCandidate(anatomy, currentHead));
  const acceptedDraft = currentHead ? drafted.find((candidate) => candidate.hash === currentHead) : undefined;
  const offered = acceptedDraft ? [acceptedDraft] : drafted;
  const existing = region.block.candidates.filter((item) => !offered.some((candidate) => candidate.hash === item.hash));
  const recommendedId = acceptedDraft?.id ?? options.recommendedId ?? offered[0]?.id;
  if (!offered.some((candidate) => candidate.id === recommendedId)) throw new Error("recommended block candidate is absent");
  region.block = {
    ...region.block,
    recommendedId,
    ...(options.content ? {content: optional(options.content)} : {}),
    candidates: [...offered, ...existing]
  };
  return `#/layouts/${layoutId}/${layoutHash}/blocks/${blockId}`;
}

function assertOutputPath(outDir, project) {
  const marker = `${sep}.worktrees${sep}${project}${sep}cache${sep}preview${sep}`;
  const normalized = `${resolve(outDir)}${sep}`;
  if (!normalized.includes(marker)) throw new Error(`preview output must stay under .worktrees/${project}/cache/preview`);
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

function buildRuntime(outDir) {
  ensureRuntime();
  runNpm(["run", "build", "--", "--outDir", outDir, "--emptyOutDir", "false"]);
}

export function buildManifest(options) {
  const registryRoot = resolve(options.registry);
  const registry = load(join(registryRoot, "design-registry-v2.json"), "design registry");
  const vocabulary = load(options.vocabulary, "visual vocabulary");
  const contentInput = optional(options.content);
  const shellInput = optional(options.shell);
  const layouts = currentLayouts(registryRoot, registry, vocabulary, options.project, contentInput, shellInput);
  if (!layouts.length) throw new Error("design registry has no accepted layout heads");

  let entryRoute;
  if (options.draftIndex) {
    const indexPath = resolve(options.draftIndex);
    const drafts = load(indexPath, "block draft index");
    if (!Array.isArray(drafts) || !drafts.length) throw new Error("block draft index must contain at least one entry");
    const root = dirname(indexPath);
    for (const draft of drafts) {
      const draftOptions = {
        ...options,
        phase: "block",
        ...draft,
        artifact: resolve(root, draft.artifact),
        ...(draft.content ? {content: resolve(root, draft.content)} : {})
      };
      const route = overlayBlockReview(layouts, draftOptions, registryRoot, registry);
      entryRoute ??= route;
    }
  } else if (options.phase === "layout") {
    entryRoute = overlayLayoutReview(layouts, options, registryRoot, registry, vocabulary, contentInput, shellInput);
  } else if (options.phase === "block") {
    entryRoute = overlayBlockReview(layouts, options, registryRoot, registry);
  } else if (options.allCurrent) {
    const first = layouts[0];
    const candidate = first.candidates.find((item) => item.id === first.recommendedId) ?? first.candidates[0];
    entryRoute = `#/layouts/${first.layoutId}/${candidate.hash}`;
  } else {
    throw new Error("supply --all-current or --phase layout|block");
  }

  return {
    schemaVersion: 2,
    project: options.project,
    entryRoute,
    layouts,
    evidence: [
      {label: "registry", value: join(registryRoot, "design-registry-v2.json")},
      {label: "vocabularyAt", value: vocabulary.digest},
      ...(options.artifact ? [{label: "reviewArtifact", value: options.artifact}] : []),
      ...(options.draftIndex ? [{label: "draftIndex", value: options.draftIndex}] : [])
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
  for (const required of ["project", "registry", "vocabulary", "out"]) {
    if (!options[required]) throw new Error(`--${required} is required`);
  }
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
