import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {checkConversationRegistry, snapshotHash} from "./check-conversation-registry.mjs";

const scripts = resolve(fileURLToPath(new URL(".", import.meta.url)));
const recorder = join(scripts, "record-conversation-snapshot.mjs");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "conversation-registry-"));
  execFileSync("git", ["init", "-q", root]);
  execFileSync("git", ["-C", root, "config", "user.email", "test@example.invalid"]);
  execFileSync("git", ["-C", root, "config", "user.name", "Conversation Test"]);
  writeFileSync(join(root, ".gitignore"), "snapshot.json\n");
  execFileSync("git", ["-C", root, "add", ".gitignore"]);
  execFileSync("git", ["-C", root, "commit", "-qm", "fixture"]);
  return root;
}

const snapshot = () => ({
  schemaVersion: 1,
  conversationId: "course-content-review",
  provider: "openai",
  surface: "codex",
  externalThreadId: "thread-123",
  recordedAt: "2026-08-20T12:00:00Z",
  messageCount: 8,
  redactedSummary: "Owner approved the exact content-home layout and its block boundaries.",
  transcript: {mode: "provider", providerThreadId: "thread-123"},
  decisions: [{role: "fe", kind: "layout", identity: "course-content-home", artifactHash: "a".repeat(64), messageIds: ["message-7"], reason: "The owner approved this exact layout candidate and parent boundary."}],
});

test("records a provider-neutral immutable snapshot and advances one stable head", () => {
  const root = fixture();
  try {
    const input = join(root, "snapshot.json");
    writeFileSync(input, JSON.stringify(snapshot()));
    execFileSync(process.execPath, [recorder, "--registry", root, "--snapshot", input, "--project", "starci-academy", "--apply"]);
    const registry = JSON.parse(readFileSync(join(root, "conversations", "conversation-registry-v1.json"), "utf8"));
    const hash = snapshotHash(snapshot());
    assert.equal(registry.conversationHeads["course-content-review"].head, hash);
    assert.equal(checkConversationRegistry(root).ok, true);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test("refuses raw chat keys and secret-shaped values", () => {
  const root = fixture();
  try {
    const body = snapshot();
    body.messages = [{content: "sk-secretvalue123456"}];
    const hash = snapshotHash(body);
    const relative = `conversations/objects/sha256/${hash}.json`;
    mkdirSync(join(root, "conversations", "objects", "sha256"), {recursive: true});
    writeFileSync(join(root, relative), JSON.stringify(body));
    writeFileSync(join(root, "conversations", "conversation-registry-v1.json"), JSON.stringify({
      schemaVersion: 1,
      project: "starci-academy",
      hashAlgorithm: "sha256",
      canonicalization: "RFC8785-JCS",
      conversationHeads: {"course-content-review": {conversationId: "course-content-review", provider: "openai", surface: "codex", externalThreadId: "thread-123", head: hash}},
      objects: {immutable: true, byHash: {[hash]: {hash, path: relative}}},
    }));
    const result = checkConversationRegistry(root);
    assert.equal(result.ok, false);
    assert.match(result.failures.join("\n"), /raw conversation or secret key is forbidden/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
