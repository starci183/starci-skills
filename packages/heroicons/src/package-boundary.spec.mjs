import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
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

/** The icon names a source cut exports (`export const <Name>Icon = ...`). */
const customNames = async (cut) => {
    const text = await readFile(new URL(`./${cut}/index.tsx`, import.meta.url), "utf8")
    return [...text.matchAll(/^export const (\w+Icon)\b/gm)].map((match) => match[1])
}

test("no custom cut duplicates a glyph @heroicons/react already ships (owner ruling 2026-10-13)", async () => {
    const require = createRequire(import.meta.url)
    const upstream = new Set(["24/outline", "24/solid", "20/solid", "16/solid"]
        .flatMap((cut) => Object.keys(require(`@heroicons/react/${cut}`))))
    assert.ok(upstream.has("BellIcon"), "the upstream catalogue is read")
    for (const cut of ["24/outline", "16/solid"]) {
        const names = await customNames(cut)
        assert.ok(names.length > 0, `${cut} exports custom cuts`)
        assert.deepEqual(names.filter((name) => upstream.has(name)), [],
            `${cut}: @heroicons/react is used first; @starci/heroicons holds only glyphs heroicons lacks`)
    }
})
