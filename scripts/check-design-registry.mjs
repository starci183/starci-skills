#!/usr/bin/env node

import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { functionalPreviewFailures } from "./functional-design-preview.mjs"

const HASH = /^[0-9a-f]{64}$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"))
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const sha256 = (value) => createHash("sha256").update(value).digest("hex")

export function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
    if (value && typeof value === "object") {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
    }
    return JSON.stringify(value)
}

export function revisionHash(design) {
    const { previewSha256, ...metadata } = design
    return sha256(`${canonical(metadata)}\n${previewSha256}`)
}

export function checkDesignRegistry(registryRoot) {
    const root = resolve(registryRoot)
    const failures = []
    const rootPath = join(root, "registry.json")
    const designPath = join(root, "design-registry-v2.json")
    if (!existsSync(designPath)) return { ok: false, failures: ["design-registry-v2.json is absent; run migration"] }
    const design = readJson(designPath)
    if (design.schemaVersion !== 2 || !SLUG.test(design.project ?? "")) failures.push("design registry has invalid v2 project identity")
    if (existsSync(rootPath)) {
        const registry = readJson(rootPath)
        if (registry.schemaVersion !== 2 || registry.designRegistry !== "design-registry-v2.json") failures.push("registry.json does not point at v2 identity authority")
        if (registry.project !== design.project) failures.push("legacy registry metadata disagrees with design registry identity")
    }
    const objectFile = (hash) => join(root, "objects", "sha256", `${hash}.json`)
    const revisionDir = (hash) => join(root, "revisions", hash)
    const revisions = design.revisions?.byHash ?? {}
    const objects = design.objects?.byHash ?? {}
    const currentRevisionHashes = new Set([
        ...Object.values(design.layoutHeads ?? {}).map((head) => head?.head),
        ...Object.values(design.blockHeads ?? {}).map((head) => head?.head)
    ].filter((head) => revisions[head]))
    const resolved = new Map()
    const resolveRevision = (hash) => {
        if (resolved.has(hash)) return resolved.get(hash)
        const ref = revisions[hash]
        if (!ref) return null
        const expectedPath = `revisions/${hash}`
        const designFile = join(revisionDir(hash), "design.json")
        const previewFile = join(revisionDir(hash), "preview.html")
        if (!HASH.test(hash) || ref?.hash !== hash || ref?.path !== expectedPath || !existsSync(designFile) || !existsSync(previewFile)) {
            failures.push(`${hash}: invalid or missing immutable revision bundle`)
            resolved.set(hash, null)
            return null
        }
        const bundle = readJson(designFile)
        if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
            failures.push(`${hash}: design.json must be an object`)
            resolved.set(hash, null)
            return null
        }
        const previewSource = readFileSync(previewFile, "utf8")
        const previewDigest = sha256(previewSource)
        if (bundle?.previewSha256 !== previewDigest) failures.push(`${hash}: preview.html digest differs from design.json`)
        if (revisionHash(bundle) !== hash) failures.push(`${hash}: revision digest differs from canonical design metadata and preview digest`)
        if (![1, 2].includes(bundle?.schemaVersion) || !["layout", "block"].includes(bundle?.kind) || !SLUG.test(bundle?.layoutId ?? "")) {
            failures.push(`${hash}: design.json has invalid revision identity`)
        }
        if (currentRevisionHashes.has(hash)) failures.push(...functionalPreviewFailures(bundle, previewSource, hash))
        if (!bundle?.artifact || typeof bundle.artifact !== "object" || Array.isArray(bundle.artifact)) {
            failures.push(`${hash}: design.json artifact must be an object`)
        }
        if (!Array.isArray(bundle?.states) || bundle.states.length === 0) {
            failures.push(`${hash}: design.json must declare at least one preview state`)
        } else {
            const stateIds = new Set()
            for (const state of bundle.states) {
                if (!SLUG.test(state?.id ?? "") || stateIds.has(state.id)) failures.push(`${hash}: preview state ids must be unique slugs`)
                stateIds.add(state?.id)
                if (!Number.isInteger(state?.viewport?.width) || state.viewport.width < 1 || !Number.isInteger(state?.viewport?.height) || state.viewport.height < 1) {
                    failures.push(`${hash}: every preview state must declare a positive integer viewport`)
                }
            }
        }
        if (bundle?.kind === "block" && (!SLUG.test(bundle?.blockId ?? "") || !HASH.test(bundle?.layoutHash ?? ""))) {
            failures.push(`${hash}: block revision must bind blockId and layoutHash`)
        }
        if (bundle?.kind === "layout" && (bundle?.blockId !== undefined || bundle?.layoutHash !== undefined)) {
            failures.push(`${hash}: layout revision cannot carry block identity`)
        }
        if (bundle?.kind === "layout" && Array.isArray(bundle?.artifact?.pages)) {
            const stateIds = new Set((bundle.states ?? []).map((state) => state?.id))
            const pageIds = new Set()
            const regionNames = new Set((bundle.artifact.regions ?? []).map((region) => region?.name))
            for (const page of bundle.artifact.pages) {
                if (!SLUG.test(page?.id ?? "") || pageIds.has(page.id)) failures.push(`${hash}: composed page ids must be unique slugs`)
                pageIds.add(page?.id)
                if (!SLUG.test(page?.state ?? "") || !stateIds.has(page.state)) failures.push(`${hash}: composed page ${page?.id ?? "<unknown>"} has no matching preview state`)
                for (const node of page?.nodes ?? []) {
                    if (node?.change === "existing" && (typeof node.source !== "string" || !node.source || !HASH.test(node.sourceHash ?? ""))) {
                        failures.push(`${hash}: existing composition node ${page?.id ?? "<unknown>"}/${node?.id ?? "<unknown>"} lacks source evidence`)
                    }
                }
                for (const region of page?.regions ?? []) if (!regionNames.has(region)) failures.push(`${hash}: composed page ${page?.id ?? "<unknown>"} references absent region ${region}`)
            }
        }
        resolved.set(hash, bundle)
        return bundle
    }
    const resolveArtifact = (hash) => {
        const bundle = resolveRevision(hash)
        if (bundle) return { artifact: bundle.artifact, bundle }
        return existsSync(objectFile(hash)) ? { artifact: readJson(objectFile(hash)), bundle: null } : null
    }
    for (const hash of Object.keys(revisions)) resolveRevision(hash)
    for (const [hash, ref] of Object.entries(objects)) {
        if (!HASH.test(hash) || ref?.hash !== hash || ref?.path !== `objects/sha256/${hash}.json` || !existsSync(objectFile(hash))) failures.push(`${hash}: invalid or missing immutable object reference`)
    }
    for (const [layoutId, head] of Object.entries(design.layoutHeads ?? {})) {
        const accepted = HASH.test(head?.head ?? "") ? resolveArtifact(head.head) : null
        if (!SLUG.test(layoutId) || head?.layoutId !== layoutId || !accepted) {
            failures.push(`${layoutId}: malformed layout head or missing accepted revision`)
            continue
        }
        if (accepted.bundle && (accepted.bundle.kind !== "layout" || accepted.bundle.layoutId !== layoutId)) failures.push(`${layoutId}: layout head revision identity differs from its key`)
        const layout = accepted.artifact
        const objectRegions = [...new Set((layout?.regions ?? []).map((region) => region?.name).filter((name) => typeof name === "string"))].sort()
        const declared = [...new Set(head.regions ?? [])].sort()
        if (!same(declared, objectRegions)) failures.push(`${layoutId}: declared regions differ from accepted layout object`)
    }
    for (const [scopedId, head] of Object.entries(design.blockHeads ?? {})) {
        const expected = `${head?.layoutId}/${head?.blockId}`
        const layout = design.layoutHeads?.[head?.layoutId]
        if (scopedId !== expected || !layout || !Array.isArray(layout.regions) || !layout.regions.includes(head.blockId)) failures.push(`${scopedId}: block identity is not declared by its layout`)
        if (head?.layoutHash !== layout?.head) failures.push(`${scopedId}: block was accepted under a stale layout hash`)
        const accepted = HASH.test(head?.head ?? "") ? resolveArtifact(head.head) : null
        if (!accepted) failures.push(`${scopedId}: block head revision is missing`)
        if (accepted?.bundle && (accepted.bundle.kind !== "block" || accepted.bundle.layoutId !== head.layoutId || accepted.bundle.blockId !== head.blockId || accepted.bundle.layoutHash !== head.layoutHash)) {
            failures.push(`${scopedId}: block head revision identity differs from its key or parent layout`)
        }
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
