#!/usr/bin/env node

import {createHash} from "node:crypto";
import {existsSync, readFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const HASH = /^[0-9a-f]{64}$/;
const FORBIDDEN_KEYS = new Set(["messages", "content", "prompt", "completion", "apikey", "api_key", "authorization", "token", "secret", "password"]);
const SECRET_VALUE = /(?:\bBearer\s+[A-Za-z0-9._~-]+|\bsk-[A-Za-z0-9_-]{12,}|\bghp_[A-Za-z0-9]{12,}|\bgithub_pat_[A-Za-z0-9_]{12,}|\bxox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function snapshotHash(snapshot) {
  return createHash("sha256").update(canonical(snapshot)).digest("hex");
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`invalid JSON at ${path}: ${error.message}`);
  }
}

function scanPlaintext(value, at, failures) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanPlaintext(item, `${at}[${index}]`, failures));
    return;
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && SECRET_VALUE.test(value)) failures.push(`${at}: secret-shaped value is forbidden`);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) failures.push(`${at}.${key}: raw conversation or secret key is forbidden`);
    scanPlaintext(child, `${at}.${key}`, failures);
  }
}

export function checkConversationRegistry(registryRoot) {
  const root = resolve(registryRoot);
  const path = join(root, "conversations", "conversation-registry-v1.json");
  if (!existsSync(path)) return {ok: false, failures: [`missing conversation registry: ${path}`], conversations: 0};
  const registry = readJson(path);
  const failures = [];
  scanPlaintext(registry, "registry", failures);
  const objects = registry.objects?.byHash ?? {};

  for (const [hash, ref] of Object.entries(objects)) {
    if (!HASH.test(hash)) {
      failures.push(`objects.byHash.${hash}: invalid hash key`);
      continue;
    }
    if (ref?.hash !== hash) failures.push(`objects.byHash.${hash}: ref hash differs from key`);
    const expectedPath = `conversations/objects/sha256/${hash}.json`;
    if (ref?.path !== expectedPath) failures.push(`objects.byHash.${hash}: path must be ${expectedPath}`);
    const objectPath = join(root, expectedPath);
    if (!existsSync(objectPath)) {
      failures.push(`objects.byHash.${hash}: missing immutable snapshot`);
      continue;
    }
    const snapshot = readJson(objectPath);
    scanPlaintext(snapshot, `snapshot.${hash}`, failures);
    const computed = snapshotHash(snapshot);
    if (computed !== hash) failures.push(`objects.byHash.${hash}: content hash mismatch; computed ${computed}`);
    if (snapshot.previousHash && !objects[snapshot.previousHash]) failures.push(`objects.byHash.${hash}: previousHash is absent from object map`);
  }

  for (const [conversationId, head] of Object.entries(registry.conversationHeads ?? {})) {
    const ref = objects[head?.head];
    if (!ref) {
      failures.push(`conversationHeads.${conversationId}: head object is absent`);
      continue;
    }
    const snapshot = readJson(join(root, ref.path));
    if (head.conversationId !== conversationId || snapshot.conversationId !== conversationId) failures.push(`conversationHeads.${conversationId}: stable identity mismatch`);
    for (const key of ["provider", "surface", "externalThreadId"]) {
      if ((head[key] ?? undefined) !== (snapshot[key] ?? undefined)) failures.push(`conversationHeads.${conversationId}: ${key} differs from snapshot`);
    }
  }

  return {ok: failures.length === 0, failures, conversations: Object.keys(registry.conversationHeads ?? {}).length};
}

function main(argv) {
  const at = argv.indexOf("--registry");
  const registry = at === -1 ? undefined : argv[at + 1];
  if (!registry) {
    console.error("usage: check-conversation-registry.mjs --registry <project-registry-root>");
    return 2;
  }
  const result = checkConversationRegistry(registry);
  if (!result.ok) {
    console.error("conversation registry check failed");
    for (const failure of result.failures) console.error(`- ${failure}`);
    return 1;
  }
  console.log(`conversation registry holds — ${result.conversations} conversation head(s)`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
