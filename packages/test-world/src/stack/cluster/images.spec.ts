import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, it } from "node:test"
import { Docker } from "../docker"
import { computeImageHash } from "./image-hash"
import { ensureImages } from "./images"
import { createLedger } from "./ledger"
import type { RegistryClient } from "./registry"
import { scriptedExec } from "./script.test"

interface FakeRegistry extends RegistryClient {
    readonly store: Map<string, Set<string>>
    readonly deleted: Array<string>
}

const fakeRegistry = (): FakeRegistry => {
    const store = new Map<string, Set<string>>()
    const deleted: Array<string> = []
    return {
        store,
        deleted,
        tags: async (repository) => [...(store.get(repository) ?? [])],
        digest: async (repository, tag) => (store.get(repository)?.has(tag) === true ? `sha256:${tag}` : null),
        deleteManifest: async (repository, digest) => {
            deleted.push(digest)
            store.get(repository)?.delete(digest.replace("sha256:", ""))
        },
    }
}

describe("ensureImages", () => {
    let root = ""
    let home = ""
    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), "starci-img-root-"))
        home = await mkdtemp(join(tmpdir(), "starci-img-home-"))
        await writeFile(join(root, "Dockerfile"), "FROM node\nCOPY src ./src\n")
        await mkdir(join(root, "src"))
        await writeFile(join(root, "src", "a.ts"), "a")
    })
    afterEach(async () => {
        await rm(root, { recursive: true, force: true })
        await rm(home, { recursive: true, force: true })
    })

    const makeRequest = () => ({ root, kebab: "nivo-a1b2c3", images: [{ name: "api", dockerfile: "Dockerfile" }], registryHost: "localhost:5001", registryInCluster: "k3d-starci-registry:5000" })

    it("skips the build when the content-hash tag is already in the registry", async () => {
        const registry = fakeRegistry()
        const { tag } = await computeImageHash({ root, dockerfile: "Dockerfile" })
        registry.store.set("nivo-a1b2c3-api", new Set([tag]))
        const { exec, calls } = scriptedExec(() => undefined)
        const ledger = createLedger(join(home, "images.json"), join(home, "images.lock"))
        const images = await ensureImages({ docker: new Docker(exec), registry, ledger, now: () => 1 }, makeRequest())
        assert.deepEqual(images, { api: `k3d-starci-registry:5000/nivo-a1b2c3-api:${tag}` })
        assert.equal(calls.length, 0)
    })

    it("builds and pushes a missing tag, then keeps the newest 3 and deletes the rest", async () => {
        const registry = fakeRegistry()
        const repository = "nivo-a1b2c3-api"
        registry.store.set(repository, new Set(["src-old1", "src-old2", "src-old3", "src-old4", "latest"]))
        const ledger = createLedger(join(home, "images.json"), join(home, "images.lock"))
        await ledger.update((data) => {
            data[repository] = { "src-old1": 10, "src-old2": 20, "src-old3": 30, "src-old4": 40 }
        })
        const { tag } = await computeImageHash({ root, dockerfile: "Dockerfile" })
        const { exec, calls } = scriptedExec((line) => {
            if (line.startsWith("docker push")) registry.store.get(repository)?.add(tag)
            return undefined
        })
        let clock = 100
        const images = await ensureImages({ docker: new Docker(exec), registry, ledger, now: () => clock++ }, makeRequest())
        const ref = `localhost:5001/${repository}:${tag}`
        assert.equal(images.api, `k3d-starci-registry:5000/${repository}:${tag}`)
        assert.equal(calls[0]?.line, `docker build -f ${join(root, "Dockerfile")} -t ${ref} ${root}`)
        assert.equal(calls[1]?.line, `docker push ${ref}`)
        assert.deepEqual(registry.deleted.sort(), ["sha256:src-old1", "sha256:src-old2"])
        assert.deepEqual([...(registry.store.get(repository) ?? [])].sort(), ["latest", "src-old3", "src-old4", tag].sort())
        const removed = calls.filter((call) => call.line.startsWith("docker image rm")).map((call) => call.line)
        assert.deepEqual(removed.sort(), [`docker image rm localhost:5001/${repository}:src-old1`, `docker image rm localhost:5001/${repository}:src-old2`])
        assert.deepEqual(Object.keys((await ledger.read())[repository] ?? {}).sort(), [tag, "src-old3", "src-old4"].sort())
    })
})
