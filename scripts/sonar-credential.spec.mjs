import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const script = join(dirname(fileURLToPath(import.meta.url)),
    "sonar-credential.mjs")

test("documents the encrypted-authority and hydrated-handle boundary",
    () => {
        const result = spawnSync(process.execPath,
            [script, "--help"],
            {
                encoding: "utf8"
            })

        assert.equal(result.status,
            0)
        assert.match(result.stdout,
            /\.stacks\/dev\/runtime\/files/)
        assert.match(result.stdout,
            /\.worktrees\/credentials/)
        assert.match(result.stdout,
            /sonar-credential\.mjs status/)
        assert.match(result.stdout,
            /sonar-credential\.mjs latest/)
        assert.doesNotMatch(result.stdout,
            /SONAR_TOKEN=/)
    })

test("rejects an unsafe project identity before credential access",
    () => {
        const result = spawnSync(process.execPath,
            [script, "run", "--project", "../escape", "--role", "be"],
            {
                encoding: "utf8"
            })

        assert.equal(result.status,
            1)
        assert.match(result.stderr,
            /--project must use lowercase letters/)
    })

test("serializes local scans before they can share scannerwork",
    () => {
        const source = readFileSync(script,
            "utf8")

        assert.match(source,
            /sonar-run\.lock/)
        assert.match(source,
            /openSync\(lockPath,[\s\S]*"wx"\)/)
        assert.match(source,
            /const releaseRunLock = acquireRunLock/)
        assert.match(source,
            /sonar\.working\.directory=\$\{scannerWorkingDirectory/)
        assert.match(source,
            /"\.worktrees",[\s\S]*"credentials",[\s\S]*"scannerwork"/)
    })
