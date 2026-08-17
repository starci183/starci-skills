import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { buildMemoryPack, canonicalize, hashJson, initialize, integrity, putJson, rebuildIndex, statusRefPath, updateStatusRef } from "../scripts/fe-design-registry.mjs"

const zeros = "0".repeat(64)

test("canonical JSON identity ignores whitespace and property order", () => {
  assert.equal(canonicalize({ b: 2, a: [3, 1] }), '{"a":[3,1],"b":2}')
  assert.equal(hashJson(JSON.parse('{ "b": 2, "a": [3, 1] }')), hashJson(JSON.parse('{"a":[3,1],"b":2}')))
})

test("status refs point to one immutable object and stale alterations fail", () => {
  const root = mkdtempSync(join(tmpdir(), "starci-registry-"))
  initialize(root)
  const first = putJson(root, { kind: "layout-candidate", value: 1 })
  const queued = { unitId: "page-a", objectHash: first.hash, status: "queued", sessionId: "session-a", roundId: "round-a", updatedAt: new Date().toISOString() }
  updateStatusRef(root, "layouts", "starci", "page-a", undefined, queued)
  const second = putJson(root, { kind: "layout-candidate", value: 2 })
  assert.throws(() => updateStatusRef(root, "layouts", "starci", "page-a", undefined, { ...queued, objectHash: second.hash, basedOnHash: zeros }), /stale basedOnHash/)
  assert.equal(integrity(root).ok, true)
})

test("memory pack keeps the active graph slice rather than full transcript", () => {
  const pack = buildMemoryPack({ current: { objectHash: zeros }, ancestors: [{ objectHash: "1".repeat(64) }], rejections: Array.from({ length: 12 }, (_, id) => ({ id })) })
  assert.equal(pack.relevantRejections.length, 8)
  assert.equal(pack.omitted.transcript, true)
  assert.equal("events" in pack, false)
})

test("SQLite FTS index is rebuildable from canonical objects and refs", () => {
  const root = mkdtempSync(join(tmpdir(), "starci-registry-"))
  initialize(root)
  const object = putJson(root, { kind: "block-candidate", text: "gift list" })
  const path = statusRefPath(root, "blocks", "queued", "starci", "shop", "gift-list")
  mkdirSync(join(path, ".."), { recursive: true })
  writeFileSync(path, JSON.stringify({ unitId: "gift-list", objectHash: object.hash, status: "queued", sessionId: "session-a", roundId: "round-a", updatedAt: new Date().toISOString() }))
  const counts = rebuildIndex(root, join(root, "cache", "registry.sqlite"))
  assert.deepEqual(counts, { artifacts: 1, units: 1 })
  assert.match(readFileSync(object.path, "utf8"), /gift list/)
})
