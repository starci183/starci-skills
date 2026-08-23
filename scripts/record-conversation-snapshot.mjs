#!/usr/bin/env node

import {execFileSync} from "node:child_process";
import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {checkConversationRegistry, snapshotHash} from "./check-conversation-registry.mjs";

const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
};
const registryRoot = flag("registry");
const snapshotPath = flag("snapshot");
const project = flag("project");
const apply = args.includes("--apply");

if (!registryRoot || !snapshotPath) {
  console.error("usage: record-conversation-snapshot.mjs --registry <root> --snapshot <snapshot.json> [--project <slug>] [--apply]");
  process.exit(2);
}

const root = resolve(registryRoot);
const snapshotFile = resolve(snapshotPath);
execFileSync(process.execPath, [
  join(trustRoot, "scripts", "validate-artifact.mjs"),
  "--schema", join(trustRoot, "knowledge", "contexts", "conversations", "conversation-snapshot.schema.json"),
  "--data", snapshotFile,
], {stdio: "inherit"});
const snapshot = JSON.parse(readFileSync(snapshotFile, "utf8"));
const hash = snapshotHash(snapshot);
if (!apply) {
  console.log(`${hash}  ${snapshot.conversationId}`);
  process.exit(0);
}

let status;
try {
  status = execFileSync("git", ["-C", root, "status", "--porcelain"], {encoding: "utf8"});
} catch {
  throw new Error(`registry root is not owned by Git: ${root}`);
}
if (status.trim()) throw new Error(`registry worktree must be clean before recording:\n${status}`);

const registryPath = join(root, "conversations", "conversation-registry-v1.json");
let registry;
if (existsSync(registryPath)) {
  registry = JSON.parse(readFileSync(registryPath, "utf8"));
  if (project && registry.project !== project) throw new Error(`project mismatch: ${registry.project} != ${project}`);
} else {
  if (!project) throw new Error("--project is required when initializing a conversation registry");
  registry = {schemaVersion: 1, project, hashAlgorithm: "sha256", canonicalization: "RFC8785-JCS", conversationHeads: {}, objects: {immutable: true, byHash: {}}};
}

const current = registry.conversationHeads[snapshot.conversationId];
if (current && snapshot.previousHash !== current.head) throw new Error(`previousHash must equal current head ${current.head}`);
if (!current && snapshot.previousHash) throw new Error("first snapshot cannot name previousHash");

const relative = `conversations/objects/sha256/${hash}.json`;
const objectPath = join(root, relative);
mkdirSync(dirname(objectPath), {recursive: true});
const body = `${JSON.stringify(snapshot, null, 2)}\n`;
if (existsSync(objectPath) && readFileSync(objectPath, "utf8") !== body) throw new Error(`immutable collision at ${hash}`);
if (!existsSync(objectPath)) writeFileSync(objectPath, body, "utf8");
registry.objects.byHash[hash] = {hash, path: relative};
registry.conversationHeads[snapshot.conversationId] = {
  conversationId: snapshot.conversationId,
  provider: snapshot.provider,
  surface: snapshot.surface,
  ...(snapshot.externalThreadId ? {externalThreadId: snapshot.externalThreadId} : {}),
  head: hash,
};
mkdirSync(dirname(registryPath), {recursive: true});
const temporary = `${registryPath}.tmp`;
writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
renameSync(temporary, registryPath);

execFileSync(process.execPath, [
  join(trustRoot, "scripts", "validate-artifact.mjs"),
  "--schema", join(trustRoot, "knowledge", "contexts", "conversations", "conversation-registry.schema.json"),
  "--data", registryPath,
], {stdio: "inherit"});
const result = checkConversationRegistry(root);
if (!result.ok) throw new Error(result.failures.join("\n"));
console.log(`recorded ${snapshot.conversationId} ${hash}`);
