import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const packageUrl = new URL("../package.json", import.meta.url)

test("the package exposes only the supported entry-point families", async () => {
    const packageJson = JSON.parse(await readFile(packageUrl, "utf8"))
    const exportKeys = Object.keys(packageJson.exports).sort()
    const supportedKeys = [
        "./common",
        "./common.css",
        "./common/styles.css",
        "./core",
        "./core.css",
        "./core/styles.css",
        "./heritage",
        "./heritage.css",
        "./heritage/styles.css",
        "./offset-pop",
        "./offset-pop.css",
        "./offset-pop/styles.css",
        "./package.json",
    ].sort()

    assert.deepEqual(exportKeys, supportedKeys)
    assert.equal(exportKeys.some((key) => key.includes("registry") || key.includes("tree")), false)
    assert.equal(exportKeys.some((key) => key.includes("contract") || key.includes("projection")), false)
})

test("each sibling family has paired runtime, types, and CSS exports", async () => {
    const packageJson = JSON.parse(await readFile(packageUrl, "utf8"))
    for (const family of ["heritage", "offset-pop"]) {
        assert.equal(typeof packageJson.exports[`./${family}`].import, "string")
        assert.equal(typeof packageJson.exports[`./${family}`].types, "string")
        assert.equal(packageJson.exports[`./${family}.css`], `./dist/${family}/styles.css`)
        assert.equal(packageJson.exports[`./${family}/styles.css`], `./dist/${family}/styles.css`)
    }
})

test("runtime dependencies stay at the neutral peer boundary", async () => {
    const packageJson = JSON.parse(await readFile(packageUrl, "utf8"))
    assert.deepEqual(Object.keys(packageJson.dependencies ?? {}), [])
    assert.deepEqual(Object.keys(packageJson.peerDependencies).sort(), ["@heroui/react", "react"])
})
