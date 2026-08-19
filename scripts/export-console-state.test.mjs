import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const script = resolve(trustRoot, "scripts/export-console-state.mjs")

function staleOutput() {
    const result = spawnSync(process.execPath, [script, "--stale"], {
        cwd: resolve(trustRoot, ".."),
        encoding: "utf8",
    })
    assert.notEqual(result.status, null)
    assert.ok([0, 1].includes(result.status), result.stderr)
    return result.stdout
}

test("scanner ignores workspace cache folders and measures frontend assurance", () => {
    const output = staleOutput()
    assert.match(output, /^9 route\(s\) across 5 project\(s\)/)
    assert.doesNotMatch(output, /^cache\//m)
    assert.match(output, /delivery assurance:[\s\S]*miamia\/fe\s+stale/)
})

test("scanner proves canon config imports and accepts current deploy dependency forms", () => {
    const output = staleOutput()
    assert.match(output, /lint machine:[\s\S]*nivo\/be\s+installed\s+@starci\/eslint-canon-be/)
    const nivo = output.match(/  nivo\/be\s+stale([\s\S]*?)(?=\n  [\w-]+\/|\n\n)/)?.[1] ?? ""
    assert.doesNotMatch(nivo, /ASSURANCE-7 deployment waits for verification/)
})

test("Codecov OIDC satisfies credential identity without inventing a plaintext token", () => {
    const output = staleOutput()
    const miamia = output.match(/  miamia\/be\s+stale([\s\S]*?)(?=\n  [\w-]+\/|\n\n)/)?.[1] ?? ""
    assert.doesNotMatch(miamia, /Codecov uses a declared CI identity/)
    assert.doesNotMatch(miamia, /Codecov token is encrypted in stacks/)
})
