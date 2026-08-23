import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import test from "node:test"
import { join } from "node:path"
import { inventorySonarRoutes, reconcileSonarBadgeMarkdown } from "./sonar-source-credentials.mjs"

test("inventories one distinct project-analysis identity for every routed source role", () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), "sonar-routes-"))
    try {
        const routes = [
            { project: "alpha", role: "be", key: "alpha-backend", repository: "alpha-backend" },
            { project: "beta", role: "fe", key: "beta-frontend", repository: "beta-frontend" },
        ]
        for (const route of routes) {
            const repo = join(sourceRoot, "repositories", route.repository)
            const routeRoot = join(sourceRoot, ".workspaces", "local", "routes", route.project, route.role)
            mkdirSync(repo, { recursive: true })
            mkdirSync(routeRoot, { recursive: true })
            execFileSync("git", ["init", repo], { windowsHide: true })
            execFileSync("git", ["-C", repo, "remote", "add", "origin", `https://github.com/starci-lab/${route.repository}.git`], { windowsHide: true })
            writeFileSync(join(repo, "package.json"), JSON.stringify({ scripts: {} }))
            writeFileSync(join(repo, "sonar-project.properties"), `sonar.projectKey=${route.key}\n`)
            writeFileSync(join(routeRoot, "config.json"), JSON.stringify({ repository: { diskPath: repo, gitRoot: repo } }))
        }

        const rows = inventorySonarRoutes(sourceRoot)
        assert.equal(rows.length, routes.length)
        assert.deepEqual(new Set(rows.map((row) => row.key)).size, rows.length)
        assert(rows.every((row) => row.github.startsWith("starci-lab/")))
        assert(rows.every((row) => row.record.endsWith(".key")))
    } finally {
        rmSync(sourceRoot, { recursive: true, force: true })
    }
})

test("reconciles a complete private-project Sonar badge block without touching Codecov", () => {
    const input = `# Example\n\n[![Codecov](https://codecov.io/gh/o/r/graph/badge.svg?token=codecov-read-only)](https://codecov.io/gh/o/r)\n[![Old Sonar](https://old.test/api/project_badges/measure?project=old&metric=bugs)](https://old.test/dashboard?id=old)\n\nBody\n`
    const result = reconcileSonarBadgeMarkdown(input, {
        host: "https://sonar.starci.org",
        projectKey: "example-be",
        badgeToken: "sonar-read-only",
    })
    assert.match(result, /codecov-read-only/)
    assert.equal((result.match(/api\/project_badges\/measure/g) ?? []).length, 8)
    assert.equal((result.match(/token=sonar-read-only/g) ?? []).length, 8)
    assert.doesNotMatch(result, /old\.test|project=old/)
    assert.equal(reconcileSonarBadgeMarkdown(result, {
        host: "https://sonar.starci.org",
        projectKey: "example-be",
        badgeToken: "sonar-read-only",
    }), result)
})

test("refuses to write a private Sonar badge without its separate read-only capability", () => {
    assert.throws(() => reconcileSonarBadgeMarkdown("# Example\n", {
        host: "https://sonar.starci.org",
        projectKey: "example-be",
        badgeToken: "",
    }), /project badge token is absent/)
})

test("authority probing is an explicit value-free mode", () => {
    const source = readFileSync(new URL("./sonar-source-credentials.mjs", import.meta.url), "utf8")
    assert.match(source, /--check-authority/)
    assert.match(source, /--badges-only/)
    assert.match(source, /stored-admin-valid/)
    assert.match(source, /operator-intake-required/)
})
