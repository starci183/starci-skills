/**
 * The slot adapter reads what it needs from the installed `@starci/hfs` package (its runtime copy), never from the
 * product repository or a link path. These cases pin that contract: the resolution specifiers, the dependency, the
 * `exports`/`files` of the package that carries the knowledge, and the absence of a repo-relative manifest path.
 */
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(HERE, "lib", "slots.mjs"), "utf8")
const own = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8"))
const hfsDir = join(HERE, "..", "..", "hfs")
const hfs = JSON.parse(readFileSync(join(hfsDir, "package.json"), "utf8"))

test("slots.mjs resolves the manifest and the yaml reader through @starci/hfs", () => {
    assert.match(source, /@starci\/hfs\/runtime\/knowledge\/hfs\/slots\.yaml/)
    assert.match(source, /@starci\/hfs\/runtime\/engine\/yaml\.mjs/)
    assert.match(source, /import\.meta\.resolve/)
})

test("slots.mjs never builds a repo-relative or linked knowledge path", () => {
    assert.doesNotMatch(source, /join\(RUNTIME_ROOT/)
    assert.doesNotMatch(source, /"knowledge",\s*"hfs"/)
    assert.doesNotMatch(source, /engine\/yaml\.mjs", import\.meta\.url/)
    assert.doesNotMatch(source, /\.starci\/packages|STARCI_HOME/)
})

test("the canon depends on @starci/hfs at the exact version the runtime carries", () => {
    assert.equal(own.dependencies["@starci/hfs"], hfs.version)
})

test("@starci/hfs exports and ships the runtime copy the canon reads", () => {
    assert.equal(hfs.exports["./runtime/*"], "./runtime/*")
    assert.ok(hfs.files.includes("runtime/**"))
    assert.ok(existsSync(join(hfsDir, "runtime", "knowledge", "hfs", "slots.yaml")))
    assert.ok(existsSync(join(hfsDir, "runtime", "engine", "yaml.mjs")))
})

test("the published files of the canon still include lib/slots.mjs", () => {
    assert.ok(own.files.includes("lib/*.mjs"))
})
