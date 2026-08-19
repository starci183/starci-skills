#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HASH = /^[0-9a-f]{64}$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"))
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

export function checkDesignRegistry(registryRoot) {
    const root = resolve(registryRoot)
    const failures = []
    const rootPath = join(root, "registry.json")
    const designPath = join(root, "design-registry-v2.json")
    if (!existsSync(rootPath)) return { ok: false, failures: ["registry.json is absent"] }
    if (!existsSync(designPath)) return { ok: false, failures: ["design-registry-v2.json is absent; run migration"] }
    const registry = readJson(rootPath)
    const design = readJson(designPath)
    if (registry.schemaVersion !== 2 || registry.designRegistry !== "design-registry-v2.json") failures.push("registry.json does not declare v2 identity authority")
    if (design.schemaVersion !== 2 || design.project !== registry.project) failures.push("design registry identity/version disagrees with registry root")
    const objectFile = (hash) => join(root, "objects", "sha256", `${hash}.json`)
    for (const [hash, ref] of Object.entries(design.objects?.byHash ?? {})) {
        if (!HASH.test(hash) || ref?.hash !== hash || ref?.path !== `objects/sha256/${hash}.json` || !existsSync(objectFile(hash))) failures.push(`${hash}: invalid or missing immutable object reference`)
    }
    for (const [layoutId, head] of Object.entries(design.layoutHeads ?? {})) {
        if (!SLUG.test(layoutId) || head?.layoutId !== layoutId || !HASH.test(head?.head ?? "") || !existsSync(objectFile(head.head))) {
            failures.push(`${layoutId}: malformed layout head or missing object`)
            continue
        }
        const layout = readJson(objectFile(head.head))
        const objectRegions = [...new Set((layout.regions ?? []).map((region) => region?.name).filter((name) => typeof name === "string"))].sort()
        const declared = [...new Set(head.regions ?? [])].sort()
        if (!same(declared, objectRegions)) failures.push(`${layoutId}: declared regions differ from accepted layout object`)
        const projection = join(root, "layouts", "by-id", `${layoutId}.json`)
        if (!existsSync(projection) || !same(readJson(projection), head)) failures.push(`${layoutId}: layout by-id projection is missing or stale`)
    }
    for (const [scopedId, head] of Object.entries(design.blockHeads ?? {})) {
        const expected = `${head?.layoutId}/${head?.blockId}`
        const layout = design.layoutHeads?.[head?.layoutId]
        if (scopedId !== expected || !layout || !layout.regions.includes(head.blockId)) failures.push(`${scopedId}: block identity is not declared by its layout`)
        if (head?.layoutHash !== layout?.head) failures.push(`${scopedId}: block was accepted under a stale layout hash`)
        if (!HASH.test(head?.head ?? "") || !existsSync(objectFile(head.head))) failures.push(`${scopedId}: block head object is missing`)
        const projection = join(root, "blocks", "by-id", head?.layoutId ?? "", `${head?.blockId ?? ""}.json`)
        if (!existsSync(projection) || !same(readJson(projection), head)) failures.push(`${scopedId}: block by-id projection is missing or stale`)
    }
    return { ok: failures.length === 0, failures, design }
}

function main(argv) {
    if (argv.length !== 2 || argv[0] !== "--registry") {
        console.error("Usage: node .claude/scripts/check-design-registry.mjs --registry <registries>")
        return 2
    }
    try {
        const result = checkDesignRegistry(argv[1])
        if (!result.ok) {
            for (const failure of result.failures) console.error(`- ${failure}`)
            return 1
        }
        console.log(`${Object.keys(result.design.layoutHeads).length} layout id(s) and ${Object.keys(result.design.blockHeads).length} block id(s) are current`)
        return 0
    } catch (error) {
        console.error(error.message)
        return 2
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2))
