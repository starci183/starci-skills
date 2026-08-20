import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import os from "node:os"
import { join } from "node:path"
import test from "node:test"
import { formatReport, main, scanRepository, scanText } from "./check.mjs"

test("matches exact retired path components and reports stable positions", () => {
    const findings = scanText(".mount/data\nfoo.mounting\n/.containers/compose.yaml and .claude-v3\\INDEX.md")
    assert.deepEqual(findings.map(({ legacyRoot, line, column }) => ({ legacyRoot, line, column })), [
        { legacyRoot: ".mount", line: 1, column: 1 },
        { legacyRoot: ".containers", line: 3, column: 2 },
        { legacyRoot: ".claude-v3", line: 3, column: 31 },
    ])
})

test("repository scan excludes generated trees, retired targets and own fixtures", () => {
    const root = mkdtempSync(join(os.tmpdir(), "starci-retirement-"))
    mkdirSync(join(root, ".git"), { recursive: true })
    mkdirSync(join(root, "node_modules"), { recursive: true })
    mkdirSync(join(root, ".claude", "docs"), { recursive: true })
    mkdirSync(join(root, ".claude", "machines", "retirement"), { recursive: true })
    mkdirSync(join(root, ".containers"), { recursive: true })
    writeFileSync(join(root, "live.ts"), "const path = '.mount/data'\n")
    writeFileSync(join(root, ".git", "ignored.ts"), "'.containers'\n")
    writeFileSync(join(root, "node_modules", "ignored.js"), "'.claude-v3'\n")
    writeFileSync(join(root, ".claude", "docs", "generated.md"), "'.claude_legacy'\n")
    writeFileSync(join(root, ".claude", "machines", "retirement", "fixture.txt"), "'.claude-starci-ultimate'\n")
    writeFileSync(join(root, ".containers", "compose.yaml"), "'.claude-v3'\n")

    const result = scanRepository(root)
    assert.equal(result.ok, false)
    assert.equal(result.filesScanned, 1)
    assert.deepEqual(result.findings.map(({ path, legacyRoot }) => ({ path, legacyRoot })), [
        { path: "live.ts", legacyRoot: ".mount" },
    ])
})

test("strict report is clean when no active references remain", () => {
    const result = scanRepository(mkdtempSync(join(os.tmpdir(), "starci-retirement-clean-")))
    assert.equal(result.ok, true)
    assert.match(formatReport(result), /^legacy retirement: clean \(/)
})

test("strict mode returns failure only for active references", () => {
    const root = mkdtempSync(join(os.tmpdir(), "starci-retirement-strict-"))
    writeFileSync(join(root, "live.yaml"), "mount: .containers/compose.yaml\n")
    assert.equal(main(["--strict", root]), 1)
    assert.equal(main(["--report", root]), 0)
})
