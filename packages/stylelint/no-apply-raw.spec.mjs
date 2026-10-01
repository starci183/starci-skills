import assert from "node:assert/strict"
import test from "node:test"
import { lintRule } from "./testing.mjs"

const rule = (code, options) => lintRule("no-apply-raw", code, undefined, options)

test("accepts scale utilities and token references", async () => {
  assert.deepEqual(await rule(".a { @apply p-4 text-sm bg-surface; }"), [])
  assert.deepEqual(await rule(".a { @apply bg-[var(--accent)] text-(--foreground); }"), [])
})

test("refuses an arbitrary value that is not a token reference", async () => {
  const hex = await rule(".a { @apply bg-[#fff]; }")
  assert.equal(hex.length, 1)
  assert.match(hex[0].text, /arbitrary value/)
  assert.equal((await rule(".a { @apply w-[12px] p-4; }")).length, 1)
  assert.equal((await rule(".a { @apply mt-[3rem]; }")).length, 1)
})

test("refuses a reference to a token the grammar does not publish", async () => {
  assert.equal((await rule(".a { @apply bg-[var(--nv-ink)]; }")).length, 1)
  assert.equal((await rule(".a { @apply bg-(--nv-ink); }")).length, 1)
})

test("accepts a repository's own alias token when the factory was told about it", async () => {
  assert.deepEqual(await rule(".a { @apply bg-(--page-ink); }", { appTokens: ["--page-ink"] }), [])
})

test("does not read other at-rules", async () => {
  assert.deepEqual(await rule("@source \"../[abc]\"; .a { color: var(--accent); }"), [])
})
