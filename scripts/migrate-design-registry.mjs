// Convert the surface/region indexes used by registry schema 1 into identity-centric schema 2.
// The old maps, session files and hash-addressed objects remain untouched. By-id files are projections;
// running this command again produces the same bytes and therefore has no further work to apply.

import {existsSync, readdirSync, readFileSync} from "node:fs";
import {mkdir, writeFile} from "node:fs/promises";
import {join, relative, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const HASH = /^[0-9a-f]{64}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`invalid JSON in ${path}: ${error.message}`);
  }
}

function asSlug(value) {
  if (typeof value !== "string") return null;
  const valueSlug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return valueSlug && SLUG.test(valueSlug) ? valueSlug : null;
}

function asHash(value) {
  return typeof value === "string" && HASH.test(value) ? value : null;
}

function sessionFiles(registryRoot) {
  const decisions = join(registryRoot, "decisions");
  if (!existsSync(decisions)) return [];
  return readdirSync(decisions, {withFileTypes: true})
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => join(decisions, entry.name))
    .sort();
}

function routePattern(session) {
  for (const candidate of [session.routePattern, session.route?.pattern, session.route?.routePattern]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return undefined;
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}

function readSessions(registryRoot) {
  return sessionFiles(registryRoot).map((path) => {
    const session = readJson(path);
    if (!session || typeof session !== "object" || typeof session.surface !== "string" || !Array.isArray(session.rounds)) return null;
    return {path, session};
  }).filter(Boolean);
}

function produced(round) {
  return Array.isArray(round.produced)
    ? round.produced.flatMap((item) => {
      const id = asSlug(item?.id);
      const hash = asHash(item?.hash);
      return id && hash ? [{id, hash}] : [];
    })
    : [];
}

function review(round) {
  const result = {
    phase: round.phase === "block" ? "block" : "layout",
    round: Number.isInteger(round.number) && round.number > 0 ? round.number : 1,
    state: ["pending", "accepted", "feedback"].includes(round.verdict?.state) ? round.verdict.state : "pending",
    produced: produced(round),
  };
  if (typeof round.prompt === "string") result.prompt = round.prompt;
  const acceptedHash = asHash(round.verdict?.acceptedHash);
  if (acceptedHash) result.acceptedHash = acceptedHash;
  if (Array.isArray(round.verdict?.rejected)) {
    const rejected = round.verdict.rejected.flatMap((item) => {
      const hash = asHash(item?.hash);
      if (!hash || typeof item?.reason !== "string" || !item.reason) return [];
      const entry = {hash, reason: item.reason};
      const instead = asSlug(item.instead);
      if (instead) entry.instead = instead;
      return [entry];
    });
    if (rejected.length) result.rejected = rejected;
  }
  return result;
}

function addObject(objects, hash) {
  if (!asHash(hash)) return;
  objects[hash] = {hash, path: `objects/sha256/${hash}.json`};
}

export function buildMigration(registryRoot) {
  const root = resolve(registryRoot);
  const registry = readJson(join(root, "registry.json")) ?? {};
  const existingV2 = readJson(join(root, "design-registry-v2.json")) ?? {};
  const project = asSlug(registry.project) ?? asSlug(root.split(/[\\/]/).at(-2)) ?? "project";
  const layoutMap = readJson(join(root, "layouts", "map", "current-heads.json")) ?? {};
  const blockMap = readJson(join(root, "blocks", "map", "current-heads.json")) ?? {};
  const bySurface = readJson(join(root, "blocks", "map", "by-surface.json")) ?? {};
  const sessions = readSessions(root);
  const layoutHeads = existingV2.schemaVersion === 2 ? structuredClone(existingV2.layoutHeads ?? {}) : {};
  const blockHeads = existingV2.schemaVersion === 2 ? structuredClone(existingV2.blockHeads ?? {}) : {};
  const history = sessions.length === 0 && existingV2.schemaVersion === 2
    ? structuredClone(existingV2.reviewHistory ?? {layouts: {}, blocks: {}})
    : {layouts: {}, blocks: {}};
  const objects = existingV2.schemaVersion === 2 ? structuredClone(existingV2.objects?.byHash ?? {}) : {};
  const revisions = existingV2.schemaVersion === 2 ? structuredClone(existingV2.revisions?.byHash ?? {}) : {};

  for (const [rawId, rawHash] of Object.entries(layoutMap.heads ?? {})) {
    const layoutId = asSlug(rawId);
    const hash = asHash(rawHash);
    if (!layoutId || !hash) continue;
    layoutHeads[layoutId] ??= {layoutId, head: hash, regions: []};
    const existingPattern = existingV2.layoutHeads?.[layoutId]?.routePattern;
    if (typeof existingPattern === "string" && existingPattern.trim()) layoutHeads[layoutId].routePattern = existingPattern.trim();
    addObject(objects, hash);
  }

  // Sessions are the fallback identity source when an old map was only partially written.
  for (const {session} of sessions) {
    const layoutId = asSlug(session.surface);
    if (!layoutId) continue;
    const acceptedLayout = session.rounds.find((round) => round.phase === "layout" && asHash(round.verdict?.acceptedHash));
    if (!layoutHeads[layoutId] && acceptedLayout) {
      const hash = asHash(acceptedLayout.verdict.acceptedHash);
      layoutHeads[layoutId] = {layoutId, head: hash, regions: []};
      addObject(objects, hash);
    }
    const head = layoutHeads[layoutId];
    if (head && !head.routePattern) {
      const pattern = routePattern(session);
      if (pattern) head.routePattern = pattern;
    }
  }

  // Region identity belongs to the accepted layout object, even before any block has an accepted head.
  // Reading it here prevents the old block maps from defining which regions a layout contains.
  for (const head of Object.values(layoutHeads)) {
    const layoutObject = readJson(join(root, "objects", "sha256", `${head.head}.json`));
    for (const region of layoutObject?.regions ?? []) {
      const blockId = asSlug(region?.name);
      if (blockId && !head.regions.includes(blockId)) head.regions.push(blockId);
    }
    head.regions.sort();
  }

  const blockEntries = new Map();
  for (const [rawKey, rawHash] of Object.entries(blockMap.heads ?? {})) {
    const match = /^([0-9a-f]{64})\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(rawKey);
    const hash = asHash(rawHash);
    if (!match || !hash) continue;
    blockEntries.set(`${match[1]}/${match[2]}`, {layoutHash: match[1], blockId: match[2], head: hash});
    addObject(objects, hash);
  }
  for (const [layoutId, surface] of Object.entries(bySurface.surfaces ?? {})) {
    const id = asSlug(layoutId);
    const layoutHash = asHash(surface?.layoutHash);
    if (!id || !layoutHash) continue;
    for (const [rawBlockId, rawHash] of Object.entries(surface.regions ?? {})) {
      const blockId = asSlug(rawBlockId);
      const hash = asHash(rawHash);
      if (blockId && hash) blockEntries.set(`${layoutHash}/${blockId}`, {layoutHash, blockId, head: hash});
    }
  }

  for (const [layoutId, head] of Object.entries(layoutHeads)) {
    for (const entry of blockEntries.values()) {
      if (entry.layoutHash !== head.head) continue;
      const scoped = `${layoutId}/${entry.blockId}`;
      if (!head.regions.includes(entry.blockId)) head.regions.push(entry.blockId);
      blockHeads[scoped] ??= {layoutId, blockId: entry.blockId, layoutHash: head.head, head: entry.head};
    }
  }

  for (const {session} of sessions) {
    const layoutId = asSlug(session.surface);
    if (!layoutId) continue;
    for (const round of session.rounds) {
      const item = review(round);
      const acceptedHash = asHash(round.verdict?.acceptedHash);
      addObject(objects, acceptedHash);
      for (const itemProduced of item.produced) addObject(objects, itemProduced.hash);
      for (const rejection of item.rejected ?? []) addObject(objects, rejection.hash);
      if (round.phase === "block") {
        const blockId = asSlug(round.region);
        const layoutHash = asHash(round.layoutHash) ?? layoutHeads[layoutId]?.head;
        if (!blockId || !layoutHash) continue;
        const scoped = `${layoutId}/${blockId}`;
        (history.blocks[scoped] ??= []).push(item);
        // A block accepted under an older layout remains review history, never
        // the current head. The legacy maps may be partial, so this check is
        // the migration's guard against promoting stale work into v2 state.
        if (acceptedHash && !blockHeads[scoped] && layoutHeads[layoutId]?.head === layoutHash) {
          blockHeads[scoped] = {layoutId, blockId, layoutHash, head: acceptedHash};
          const layoutHead = (layoutHeads[layoutId] ??= {layoutId, head: layoutHash, regions: []});
          if (!layoutHead.regions.includes(blockId)) layoutHead.regions.push(blockId);
        }
      } else {
        (history.layouts[layoutId] ??= []).push(item);
      }
    }
    for (const queued of session.queue ?? []) {
      addObject(objects, queued.hash);
    }
  }

  for (const block of Object.values(blockHeads)) addObject(objects, block.head);

  // A current bundle head is resolved through revisions, never through the
  // legacy object store even when old projection maps contain the same hash.
  for (const hash of Object.keys(revisions)) delete objects[hash];

  for (const hash of Object.keys(objects)) {
    const objectPath = join(root, "objects", "sha256", `${hash}.json`);
    if (!existsSync(objectPath)) throw new Error(`design registry references missing immutable object ${hash}`);
  }

  const result = {
    schemaVersion: 2,
    project,
    hashAlgorithm: "sha256",
    canonicalization: "RFC8785-JCS",
    layoutHeads: sortObject(layoutHeads),
    blockHeads: sortObject(blockHeads),
  };
  if (Object.keys(objects).length) result.objects = {immutable: true, byHash: sortObject(objects)};
  if (Object.keys(revisions).length) result.revisions = {immutable: true, byHash: sortObject(revisions)};
  if (Object.keys(history.layouts).length || Object.keys(history.blocks).length) {
    result.reviewHistory = sortObject(history);
  }
  return result;
}

export function outputDocuments(registryRoot, result) {
  const root = resolve(registryRoot);
  const history = result.reviewHistory ?? {layouts: {}, blocks: {}};
  const documents = new Map([
    [join(root, "design-registry-v2.json"), result],
    [join(root, "layouts", "map", "by-id-heads.json"), {schemaVersion: 2, heads: result.layoutHeads}],
    [join(root, "blocks", "map", "by-id-heads.json"), {schemaVersion: 2, heads: result.blockHeads}],
    [join(root, "history", "by-id.json"), {schemaVersion: 2, history}],
  ]);
  for (const [layoutId, head] of Object.entries(result.layoutHeads)) {
    documents.set(join(root, "layouts", "by-id", `${layoutId}.json`), head);
    documents.set(join(root, "reviews", "layouts", `${layoutId}.json`), history.layouts[layoutId] ?? []);
  }
  for (const [scopedId, head] of Object.entries(result.blockHeads)) {
    const [layoutId, blockId] = scopedId.split("/");
    documents.set(join(root, "blocks", "by-id", layoutId, `${blockId}.json`), head);
    documents.set(join(root, "reviews", "blocks", layoutId, `${blockId}.json`), history.blocks[scopedId] ?? []);
  }
  return documents;
}

export function parseArgs(argv) {
  const args = [...argv];
  const index = (name) => args.indexOf(name);
  const rootFlag = ["--registry", "--root", "--registries"].find((name) => index(name) !== -1);
  const root = rootFlag ? args[index(rootFlag) + 1] : null;
  const modes = ["--apply", "--check", "--plan"].filter((mode) => args.includes(mode));
  if (modes.length > 1) throw new Error("choose exactly one of --plan, --check or --apply");
  return {root: root ? resolve(root) : null, mode: modes[0]?.slice(2) ?? "plan"};
}

export async function migrateDesignRegistry(registryRoot, mode = "plan") {
  const root = resolve(registryRoot);
  if (!existsSync(root)) throw new Error(`registry root does not exist: ${root}`);
  const result = buildMigration(root);
  const documents = outputDocuments(root, result);
  const changes = [];
  for (const [path, data] of documents) {
    const next = JSON.stringify(data, null, 2) + "\n";
    const current = existsSync(path) ? readFileSync(path, "utf8") : null;
    if (current !== next) changes.push({path, next, action: current === null ? "create" : "update"});
  }
  if (mode === "apply") {
    for (const {path, next} of changes) {
      await mkdir(resolve(path, ".."), {recursive: true});
      await writeFile(path, next, "utf8");
    }
  }
  return {result, changes, applied: mode === "apply"};
}

async function main() {
  try {
    const {root, mode} = parseArgs(process.argv.slice(2));
    const fallback = join(process.cwd(), "registries");
    const registryRoot = root ?? (existsSync(fallback) ? fallback : null);
    if (!registryRoot) throw new Error("usage: migrate-design-registry.mjs --registry <registries> [--plan|--check|--apply]");
    const outcome = await migrateDesignRegistry(registryRoot, mode);
    for (const change of outcome.changes) console.log(`${mode === "apply" ? change.action : "would-" + change.action}: ${relative(process.cwd(), change.path)}`);
    if (mode === "check" && outcome.changes.length) process.exitCode = 1;
    if (outcome.changes.length === 0) console.log("design registry v2 is up to date");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
