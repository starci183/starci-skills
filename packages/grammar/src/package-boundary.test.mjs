import assert from "node:assert/strict"
import { readdir, readFile, stat } from "node:fs/promises"
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
    for (const family of ["core", "heritage", "offset-pop"]) {
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

const packageRoot = new URL("../", import.meta.url)
const exists = async (relative) => (await stat(new URL(relative, packageRoot)).catch(() => null))?.isFile() === true

test("every export target is a built dist file", async () => {
    const packageJson = JSON.parse(await readFile(packageUrl, "utf8"))
    const targets = Object.values(packageJson.exports).flatMap((target) => typeof target === "string" ? [target] : Object.values(target))
    // Four families x (runtime, types, two CSS aliases) plus package.json.
    assert.equal(targets.length, 17)
    for (const target of targets) assert.equal(await exists(target), true, `missing ${target}`)
})

test("each family ships its runtime modules and stylesheet, and no specs", async () => {
    const shipped = {
        core: ["index.js", "index.d.ts", "dna.js", "dna.d.ts", "styles.css"],
        heritage: ["index.js", "index.d.ts", "styles.css"],
        "offset-pop": ["index.js", "index.d.ts", "dna.js", "dna.d.ts", "conformance.js", "conformance.d.ts", "styles.css"],
    }
    for (const [family, files] of Object.entries(shipped)) {
        for (const file of files) assert.equal(await exists(`dist/${family}/${file}`), true, `missing dist/${family}/${file}`)
        const names = await readdir(new URL(`dist/${family}/`, packageRoot))
        assert.deepEqual(names.filter((name) => /\.(?:spec|test)\./.test(name)), [], `${family} ships a spec`)
    }
})

/** Every file under a directory, relative to it. */
const walk = async (url, prefix = "") => (await Promise.all((await readdir(url, { withFileTypes: true })).map((entry) => entry.isDirectory()
    ? walk(new URL(`${entry.name}/`, url), `${prefix}${entry.name}/`)
    : [`${prefix}${entry.name}`]))).flat()

const specifiers = (source) => [...source.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*"([^"]+)"|@import\s+"([^"]+)"/g)].map((match) => match[1] ?? match[2])

/**
 * Sibling families meet only through Common. A family may import Common and its peers (react,
 * @heroui/react), never another family: Core, Heritage and Offset Pop each stand alone over Common.
 */
test("no family imports another family, in source or in dist", async () => {
    const families = ["core", "heritage", "offset-pop"]
    for (const family of families) {
        const others = families.filter((other) => other !== family)
        for (const root of ["src", "dist"]) {
            const directory = new URL(`${root}/${family}/`, packageRoot)
            const files = (await walk(directory)).filter((file) => /\.(?:tsx?|m?js|css)$/.test(file) && !/\.(?:spec|test)\./.test(file) && !file.endsWith(".d.ts"))
            assert.ok(files.length > 0, `${root}/${family} is empty`)
            for (const file of files) {
                const source = await readFile(new URL(file, directory), "utf8")
                for (const specifier of specifiers(source)) {
                    for (const other of others) {
                        const crosses = specifier.startsWith(".") && new RegExp(`(?:^|/)${other}(?:/|\\.css$|$)`).test(specifier)
                        assert.equal(crosses, false, `${root}/${family}/${file} imports ${specifier}`)
                    }
                }
            }
        }
    }
})

test("Offset Pop's stylesheet layers over Common alone", async () => {
    const css = await readFile(new URL("dist/offset-pop/styles.css", packageRoot), "utf8")
    const imports = [...css.matchAll(/@import\s+"([^"]+)"/g)].map((match) => match[1])
    assert.equal(imports[0], "../common/styles.css")
    assert.equal(imports.some((specifier) => /core|heritage/.test(specifier)), false)
    assert.match(css, /@layer starci-grammar-offset-pop\s*\{/)
})
