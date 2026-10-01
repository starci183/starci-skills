import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const packageUrl = new URL("../package.json", import.meta.url)

test("the package publishes only its two Heroicons-compatible subpaths", async () => {
    const packageJson = JSON.parse(await readFile(packageUrl, "utf8"))

    assert.deepEqual(Object.keys(packageJson.exports).sort(), ["./16/solid", "./24/outline"])
    assert.deepEqual(packageJson.files.sort(), ["LICENSE", "README.md", "dist"])
    assert.equal(packageJson.exports["./16/solid"].import, "./dist/16/solid/index.js")
    assert.equal(packageJson.exports["./24/outline"].import, "./dist/24/outline/index.js")
})

test("the custom-cut package has no upstream runtime dependency", async () => {
    const packageJson = JSON.parse(await readFile(packageUrl, "utf8"))

    assert.deepEqual(Object.keys(packageJson.dependencies ?? {}), [])
    assert.deepEqual(Object.keys(packageJson.peerDependencies), ["react"])
})
