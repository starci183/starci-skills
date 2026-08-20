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
    assert.match(output, /^8 route\(s\) across 4 project\(s\)/)
    assert.match(output, /host OS: win32\/[^\s]+ — windows; credential runner: powershell/)
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

test("scanner exposes the strict lint, E2E, coverage and Sonar wiring facts", () => {
    const output = staleOutput()
    assert.match(output, /lint rejects warnings/)
    assert.match(output, /full E2E command is declared|CI runs full E2E/)
    assert.match(output, /project and patch\/new four-metric thresholds declared/)
    assert.match(output, /strict Sonar proof machine is wired/)
})

test("frontend assurance accepts namespaced encrypted credentials owned by the Source", () => {
    const output = staleOutput()
    const starci = output.match(/  starci-academy\/fe\s+(?:stale|installed)([\s\S]*?)(?=\n  [\w-]+\/|\n\n)/)?.[1] ?? ""
    assert.doesNotMatch(starci, /stack-secret entrypoint exists/)
    assert.doesNotMatch(starci, /Codecov token is encrypted in stacks/)
    assert.doesNotMatch(starci, /SonarQube token is encrypted in stacks/)
})
