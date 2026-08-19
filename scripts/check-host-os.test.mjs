import assert from "node:assert/strict"
import test from "node:test"
import { detectHostOs } from "./check-host-os.mjs"

test("selects PowerShell wrappers only on Windows", () => {
    const result = detectHostOs({ platform: "win32", arch: "x64" })
    assert.equal(result.family, "windows")
    assert(result.supportedExtensions.includes(".ps1"))
    assert.match(result.credentialRunner, /^powershell /)
})

test("selects portable Node and shell entrypoints on POSIX hosts", () => {
    for (const platform of ["linux", "darwin"]) {
        const result = detectHostOs({ platform, arch: "arm64" })
        assert.equal(result.family, "posix")
        assert(!result.supportedExtensions.includes(".ps1"))
        assert.equal(result.credentialRunner, "node")
    }
})

test("fails closed for an unknown host platform", () => {
    assert.equal(detectHostOs({ platform: "aix", arch: "ppc64" }).ok, false)
})
