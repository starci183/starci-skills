import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const asset = (name) => readFileSync(join(skillRoot, "assets", "review-lab", name), "utf8")

test("preview sample loads an executable candidate instead of carrying HTML and CSS", () => {
    const manifest = asset("cases.js")
    assert.match(manifest, /phase:\s*"preview"/)
    assert.match(manifest, /candidateUrl:/)
    assert.match(manifest, /proofUrl:/)
    assert.match(manifest, /runtimeProof:/)
    assert.doesNotMatch(manifest, /\bhtml:/)
    assert.doesNotMatch(manifest, /\bcss:/)
})

test("review chrome visibly distinguishes directional Plan from executable Preview", () => {
    const html = asset("index.html")
    const runtime = asset("review.js")
    assert.match(html, /id="review-status"/)
    assert.match(runtime, /DIRECTIONAL - NOT AN APPLY BASELINE/)
    assert.match(runtime, /EXECUTABLE CANDIDATE - SEALED STATE EVIDENCE REQUIRED/)
    assert.match(runtime, /frame\.src = state\.candidateUrl/)
    assert.match(runtime, /phase === "preview"/)
    assert.match(runtime, /runtime proof mismatch/)
    assert.match(runtime, /allow-forms allow-modals allow-popups allow-scripts/)
    assert.match(runtime, /phase === "plan"/)
})
