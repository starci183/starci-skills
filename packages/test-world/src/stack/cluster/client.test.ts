import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { RunCluster } from "../contracts"
import { createClusterClient, parsePods } from "./client"
import type { Clock } from "./poll"
import { scriptedExec } from "./script.test"

const run: RunCluster = {
    cluster: "starci-abcdef12",
    serverContainer: "k3d-starci-abcdef12-server-0",
    registry: "localhost:5001",
    registryInCluster: "k3d-starci-registry:5000",
    namespacePrefix: "nivo-a1b2c3-",
    images: {},
}

const podsJson = JSON.stringify({
    items: [
        { metadata: { name: "api-1", namespace: "nivo-a1b2c3-t" }, status: { phase: "Running", containerStatuses: [{ name: "app", ready: true }] } },
        { metadata: { name: "db-1", namespace: "nivo-a1b2c3-t" }, status: { phase: "Pending", containerStatuses: [{ name: "pg", ready: false, state: { waiting: { reason: "ImagePullBackOff" } } }] } },
        { metadata: { name: "new-1", namespace: "nivo-a1b2c3-t" }, status: { phase: "Pending" } },
    ],
})

const fakeClock = (): Clock => {
    let time = 0
    return { now: () => time, pause: async (ms) => void (time += ms) }
}

describe("parsePods", () => {
    it("maps phase and ready (all container statuses ready)", () => {
        const pods = parsePods(podsJson)
        assert.deepEqual(
            pods.map((pod) => [pod.name, pod.phase, pod.ready]),
            [["api-1", "Running", true], ["db-1", "Pending", false], ["new-1", "Pending", false]],
        )
        assert.deepEqual(pods[1]?.waiting, ["pg: ImagePullBackOff"])
    })
})

describe("cluster client", () => {
    it("runs kubectl inside the server container and prefixes logical names", async () => {
        const { exec, calls } = scriptedExec(() => undefined)
        const client = createClusterClient(run, { exec })
        assert.equal(await client.createNamespace("t"), "nivo-a1b2c3-t")
        assert.equal(calls[0]?.line, "docker exec -i k3d-starci-abcdef12-server-0 kubectl apply -f -")
        assert.match(calls[0]?.input ?? "", /name: nivo-a1b2c3-t\n {2}labels:\n {4}starci.test-world\/namespace: nivo-a1b2c3/)
        assert.equal(await client.createNamespace("nivo-a1b2c3-x"), "nivo-a1b2c3-x")
    })
    it("refuses invalid namespace names and manifests reaching outside the prefix", async () => {
        const { exec, calls } = scriptedExec((line) => (line.includes("get pods") ? { stdout: '{"items":[]}' } : undefined))
        const client = createClusterClient(run, { exec })
        await assert.rejects(() => client.pods("../kube-system"), /not a valid namespace/)
        await assert.rejects(() => client.deleteNamespace("Kube_System"), /not a valid namespace/)
        await assert.rejects(() => client.apply("kind: Namespace\nmetadata:\n  name: x", "t"), /cluster-scoped/)
        await assert.rejects(() => client.apply("kind: Pod\nmetadata:\n  namespace: kube-system", "t"), /outside the repository prefix/)
        assert.equal(calls.length, 0)
        await client.pods("other")
        assert.match(calls[0]?.line ?? "", /get pods -n nivo-a1b2c3-other -o json/)
    })
    it("lists only labelled namespaces that carry the prefix", async () => {
        const { exec } = scriptedExec((line) => (line.includes("get namespaces") ? { stdout: "namespace/nivo-a1b2c3-a\nnamespace/kube-system\n" } : undefined))
        assert.deepEqual(await createClusterClient(run, { exec }).namespaces(), ["nivo-a1b2c3-a"])
    })
    it("lists pods of every repository namespace without --all-namespaces", async () => {
        const { exec, calls } = scriptedExec((line) => (line.includes("get namespaces") ? { stdout: "namespace/nivo-a1b2c3-t\n" } : line.includes("get pods") ? { stdout: podsJson } : undefined))
        assert.equal((await createClusterClient(run, { exec }).pods()).length, 3)
        assert.ok(!calls.some((call) => call.line.includes("--all-namespaces")))
    })
    it("waitForPods fails with pod phases and waiting reasons at the deadline", async () => {
        const { exec } = scriptedExec((line) => (line.includes("get pods") ? { stdout: podsJson } : undefined))
        const client = createClusterClient(run, { exec, clock: fakeClock() })
        await assert.rejects(() => client.waitForPods("t", { timeoutMs: 3000 }), /db-1 phase=Pending ready=false waiting\[pg: ImagePullBackOff\]/)
    })
    it("waitForPods resolves when every pod is ready", async () => {
        const ready = JSON.stringify({ items: [{ metadata: { name: "a", namespace: "n" }, status: { phase: "Running", containerStatuses: [{ ready: true }] } }] })
        const { exec } = scriptedExec((line) => (line.includes("get pods") ? { stdout: ready } : undefined))
        await createClusterClient(run, { exec, clock: fakeClock() }).waitForPods("t")
    })
    it("deleteNamespace waits until the namespace is gone", async () => {
        let listed = 0
        const { exec, calls } = scriptedExec((line) => {
            if (!line.includes("get namespaces")) return undefined
            listed += 1
            return { stdout: listed < 3 ? "namespace/nivo-a1b2c3-t\n" : "" }
        })
        await createClusterClient(run, { exec, clock: fakeClock() }).deleteNamespace("t")
        assert.match(calls[0]?.line ?? "", /delete namespace nivo-a1b2c3-t --wait=false/)
        assert.equal(listed, 3)
    })
})
