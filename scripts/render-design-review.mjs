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
    description: "Representative content keeps density and reading order comparable without becoming product copy.",
    primaryAction: "Primary action",
    rows: [
      {title: "Primary evidence", description: "Representative supporting information for the selected candidate."},
      {title: "Secondary evidence", description: "A repeated row used consistently across candidate comparisons."},
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

function layoutCandidates(batch, registry, layoutId) {
  const currentHead = registry.layoutHeads?.[layoutId]?.head;
  return batch.candidates.map((candidate) => {
    const candidateHash = hash(candidate);
    const regions = candidate.regions.map((region) => {
      const block = registry.blockHeads?.[`${layoutId}/${region.name}`];
      return {
        ...region,
        blockStatus: !block ? "missing" : block.layoutHash === candidateHash ? "accepted" : "stale",
        ...(block?.head ? {blockHead: block.head} : {})
      };
    });
    return {
      id: candidate.id,
      hash: candidateHash,
      status: candidateStatus(candidateHash, currentHead),
      reason: candidate.reason,
      axes: candidate.axes,
      regions
    };
  });
}

function blockCandidates(batch, registry, layoutId, blockId) {
  const currentHead = registry.blockHeads?.[`${layoutId}/${blockId}`]?.head;
  return batch.anatomies.map((anatomy) => {
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
  });
}

function assertOutputPath(outDir, project) {
  const marker = `${sep}.worktrees${sep}${project}${sep}cache${sep}preview${sep}`;
  const normalized = `${resolve(outDir)}${sep}`;
  if (!normalized.includes(marker)) {
    throw new Error(`preview output must stay under .worktrees/${project}/cache/preview`);
  }
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
  const artifact = load(options.artifact, "design artifact");
  const registryRoot = resolve(options.registry);
  const registry = load(join(registryRoot, "design-registry-v2.json"), "design registry");
  const vocabulary = load(options.vocabulary, "visual vocabulary");
  const phase = options.phase;
  if (!new Set(["layout", "block"]).has(phase)) throw new Error("--phase must be layout or block");
  if (artifact.envelope?.project !== options.project) throw new Error("artifact project does not match --project");

  let layoutId;
  let blockId;
  let parentLayoutHash;
  let candidates;
  let direction;
  let currentHead;

  if (phase === "layout") {
    layoutId = options.layoutId ?? artifact.envelope?.surface;
    if (!layoutId || !Array.isArray(artifact.candidates)) throw new Error("layout artifact or layoutId is invalid");
    candidates = layoutCandidates(artifact, registry, layoutId);
    direction = artifact.candidates[0]?.direction;
    currentHead = registry.layoutHeads?.[layoutId]?.head;
  } else {
    layoutId = options.layoutId;
    blockId = options.blockId ?? artifact.envelope?.region;
    parentLayoutHash = artifact.envelope?.layoutHash;
    if (!layoutId || !blockId || !parentLayoutHash || !Array.isArray(artifact.anatomies)) {
      throw new Error("block review requires layoutId, blockId and an accepted parent layoutHash");
    }
    const acceptedHead = registry.layoutHeads?.[layoutId]?.head;
    if (acceptedHead !== parentLayoutHash) throw new Error("block artifact does not point at the accepted layout head");
    direction = registryObject(registryRoot, registry, parentLayoutHash).direction;
    candidates = blockCandidates(artifact, registry, layoutId, blockId);
    currentHead = registry.blockHeads?.[`${layoutId}/${blockId}`]?.head;
  }

  if (!direction) throw new Error("accepted visual direction cannot be resolved");
  const directionBatch = optional(options.directions);
  const recommendedId = options.recommendedId ?? candidates[0]?.id;
  if (!candidates.some((candidate) => candidate.id === recommendedId)) throw new Error("recommended candidate is absent from the batch");
  const identity = {layoutId, ...(blockId ? {blockId} : {}), ...(parentLayoutHash ? {parentLayoutHash} : {})};
  return {
    schemaVersion: 1,
    phase,
    project: options.project,
    identity,
    artifact: {source: options.artifact, ...(currentHead ? {currentHead} : {}), recommendedId},
    theme: resolveTheme(direction, vocabulary),
    candidates,
    ...(directionBatch?.directions ? {visualDirections: directionBatch.directions} : {}),
    ...(directionBatch?.recommended ? {visualDirectionRecommendation: directionBatch.recommended} : {}),
    shell: optional(options.shell) ?? defaultShell(options.project, blockId ?? layoutId),
    content: optional(options.content) ?? defaultContent(options.project, blockId ?? layoutId),
    evidence: [
      {label: "artifact", value: options.artifact},
      {label: "registry", value: join(registryRoot, "design-registry-v2.json")},
      {label: "vocabularyAt", value: vocabulary.digest}
    ]
  };
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--no-build") result.noBuild = true;
    else if (value.startsWith("--")) {
      const key = value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      result[key] = argv[index + 1];
      index += 1;
    }
  }
  return result;
}

export function renderReview(options) {
  for (const required of ["phase", "project", "artifact", "registry", "vocabulary", "out"]) {
    if (!options[required]) throw new Error(`--${required} is required`);
  }
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
    console.log(`review ${result.manifest.phase} ${result.manifest.identity.layoutId} -> ${join(result.outDir, "index.html")}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (resolve(process.argv[1] ?? "") === resolve(scriptPath)) main();
