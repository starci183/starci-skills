import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

const verifier = new URL("./verify_apply_materialization.mjs", import.meta.url).pathname.replace(/^\/(.:)/, "$1")

const APPROVED = "export const Profile = () => null\n"
const sha256 = (text) => createHash("sha256").update(text).digest("hex")

/**
 * A sealed record plus a target repository, both valid, so each test changes exactly one thing.
 * `landed` overrides what the target actually contains.
 */
const scene = ({ landed = APPROVED, integrationEdits, targetPath = "src/Profile.tsx", writeTarget = true } = {}) => {
    const root = mkdtempSync(join(tmpdir(), "starci-apply-"))
    const target = join(root, "target")
    mkdirSync(join(target, "src"), { recursive: true })
    if (writeTarget) writeFileSync(join(target, "src", "Profile.tsx"), landed)
    const recordPath = join(root, "design-record.json")
    writeFileSync(recordPath, JSON.stringify({
        version: 3,
        caseId: "profile",
        approvedRevision: "1.2",
        candidate: {
            root: join(root, "candidate"),
            files: [{ path: "candidate/Profile.tsx", targetPath, sha256: sha256(APPROVED) }],
        },
        ...(integrationEdits === undefined ? {} : { integrationEdits }),
    }, null, 2))
    return { recordPath, target }
}

const run = ({ recordPath, target }) =>
    spawnSync(process.execPath, [verifier, recordPath, "--target", target], { encoding: "utf8" })

test("accepts a target holding exactly what was approved", () => {
    const { recordPath, target } = scene()
    const output = execFileSync(process.execPath, [verifier, recordPath, "--target", target], { encoding: "utf8" })
    const report = JSON.parse(output)
    assert.equal(report.ok, true)
    assert.deepEqual(report.materialized, ["src/Profile.tsx"])
})

test("refuses a target file that was never written", () => {
    const result = run(scene({ writeTarget: false }))
    assert.notEqual(result.status, 0)
    assert.match(result.stdout, /"missing": \[\s*"src\/Profile\.tsx"/)
})

test("refuses content that differs from the approval with no declared reason", () => {
    const result = run(scene({ landed: "export const Profile = () => <Other />\n" }))
    assert.notEqual(result.status, 0)
    assert.match(result.stdout, /"substituted": \[\s*"src\/Profile\.tsx"/)
})

test("accepts a difference the record declares as an integration edit", () => {
    const { recordPath, target } = scene({
        landed: "import { env } from '@/env'\nexport const Profile = () => null\n",
        integrationEdits: [{ targetPath: "src/Profile.tsx", reason: "wire the app env import" }],
    })
    const output = execFileSync(process.execPath, [verifier, recordPath, "--target", target], { encoding: "utf8" })
    const report = JSON.parse(output)
    assert.equal(report.ok, true)
    assert.equal(report.integrated[0].reason, "wire the app env import")
})

test("refuses an integration edit declared without a reason", () => {
    const result = run(scene({
        landed: "changed\n",
        integrationEdits: [{ targetPath: "src/Profile.tsx", reason: "" }],
    }))
    assert.notEqual(result.status, 0)
    assert.match(result.stdout, /"substituted"/)
})

test("refuses a target path outside the confirmed boundary even when the seal accepted it", () => {
    const result = run(scene({ targetPath: "../elsewhere/Profile.tsx" }))
    assert.notEqual(result.status, 0)
    assert.match(result.stdout, /"outOfBounds"/)
})

test("refuses a candidate file carrying no sealed hash", () => {
    const { recordPath, target } = scene()
    const record = JSON.parse(execFileSync(process.execPath, ["-e", `process.stdout.write(require('fs').readFileSync(${JSON.stringify(recordPath)},'utf8'))`], { encoding: "utf8" }))
    record.candidate.files[0].sha256 = ""
    writeFileSync(recordPath, JSON.stringify(record, null, 2))
    const result = run({ recordPath, target })
    assert.notEqual(result.status, 0)
    assert.match(result.stdout, /no sealed hash/)
})
