import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, it } from "node:test"
import { Docker } from "../docker"
import { clusterNames, DEFAULT_K3S_IMAGE, renderRegistryConfig } from "./config"
import { createCluster } from "./index"
import { scriptedExec } from "./script.test"

const names = clusterNames(DEFAULT_K3S_IMAGE)

describe("cluster layer", () => {
    let home = ""
    beforeEach(async () => {
        home = await mkdtemp(join(tmpdir(), "starci-cluster-"))
    })
    afterEach(() => rm(home, { recursive: true, force: true }))

    const states = (map: Record<string, string>) => (line: string): { code?: number; stdout?: string } | undefined => {
        const inspect = /docker inspect --type container --format \{\{\.State\.Status\}\} (\S+)/.exec(line)
        if (inspect !== null) {
            const state = map[inspect[1] ?? ""]
            return state === undefined ? { code: 1 } : { stdout: state }
        }
        if (line.startsWith("docker network inspect")) return { code: 0 }
        if (line.startsWith("docker port")) return { stdout: "127.0.0.1:49153\n" }
        return undefined
    }

    it("names the cluster from the k3s image", () => {
        assert.match(names.cluster, /^starci-[0-9a-f]{8}$/)
        assert.equal(names.server, `k3d-${names.cluster}-server-0`)
        assert.notEqual(clusterNames("rancher/k3s:other").cluster, names.cluster)
    })

    it("creates the registries, the mirrors and the cluster when missing", async () => {
        const { exec, calls } = scriptedExec(states({}))
        await createCluster({ exec, home, pause: async () => undefined }).up()
        const lines = calls.map((call) => call.line)
        const registryRun = lines.find((line) => line.startsWith("docker run") && line.includes("--name k3d-starci-registry "))
        assert.ok(registryRun?.includes("-p 127.0.0.1::5000"))
        assert.ok(registryRun?.includes("REGISTRY_STORAGE_DELETE_ENABLED=true"))
        assert.ok(registryRun?.includes(`--network ${names.network}`))
        for (const name of ["docker", "ghcr", "quay", "k8s"]) {
            const mirrorRun = lines.find((line) => line.startsWith("docker run") && line.includes(`--name k3d-starci-mirror-${name} `))
            assert.ok(mirrorRun?.includes("REGISTRY_PROXY_REMOTEURL="), name)
        }
        const config = join(home, "cluster", "registries.yaml")
        assert.equal(
            lines.find((line) => line.startsWith("k3d cluster create")),
            `k3d cluster create ${names.cluster} --image ${DEFAULT_K3S_IMAGE} --servers 1 --agents 0 --network ${names.network} --registry-use k3d-starci-registry:5000 --registry-config ${config} --no-lb --k3s-arg --disable=traefik@server:0 --k3s-arg --disable=servicelb@server:0 --kubeconfig-update-default=false --kubeconfig-switch-context=false --wait`,
        )
        assert.equal(await readFile(config, "utf8"), renderRegistryConfig())
    })

    it("writes a registries config mirroring the four vendor registries", () => {
        const text = renderRegistryConfig()
        for (const [host, mirror] of [["docker.io", "docker"], ["ghcr.io", "ghcr"], ["quay.io", "quay"], ["registry.k8s.io", "k8s"]]) {
            assert.ok(text.includes(`"${host}":\n    endpoint:\n      - "http://k3d-starci-mirror-${mirror}:5000"`), host)
        }
    })

    it("starts a stopped cluster and does nothing when it runs", async () => {
        const running = { "k3d-starci-registry": "running", "k3d-starci-mirror-docker": "running", "k3d-starci-mirror-ghcr": "running", "k3d-starci-mirror-quay": "running", "k3d-starci-mirror-k8s": "running" }
        const stopped = scriptedExec(states({ ...running, [names.server]: "exited" }))
        await createCluster({ exec: stopped.exec, home }).up()
        assert.ok(stopped.calls.some((call) => call.line === `k3d cluster start ${names.cluster} --wait`))
        assert.ok(!stopped.calls.some((call) => call.line.startsWith("docker run")))
        const warm = scriptedExec(states({ ...running, [names.server]: "running" }))
        await createCluster({ exec: warm.exec, home }).up()
        assert.ok(!warm.calls.some((call) => call.line.startsWith("k3d cluster")))
    })

    it("explains a missing k3d", async () => {
        const { exec } = scriptedExec((line) => (line.startsWith("k3d") ? { code: 127, stderr: "not found" } : undefined))
        await assert.rejects(() => createCluster({ exec, home }).up(), /k3d version.*exited 127/)
        const throwing = async (): Promise<never> => {
            throw new Error("spawn k3d ENOENT")
        }
        await assert.rejects(() => createCluster({ exec: throwing, home }).up(), /k3d is not available on PATH/)
    })

    it("reports the containers", async () => {
        const { exec } = scriptedExec(states({ [names.server]: "running", "k3d-starci-registry": "exited" }))
        const rows = await createCluster({ docker: new Docker(exec), home }).status()
        assert.deepEqual(rows.slice(0, 2).map((row) => [row.service, row.container, row.state]), [["k3d", names.server, "running"], ["registry", "k3d-starci-registry", "exited"]])
        assert.equal(rows.length, 6)
        assert.equal(rows[2]?.state, "missing")
    })

    it("attach answers the run cluster with the in-cluster references", async () => {
        const { exec } = scriptedExec(states({}))
        const run = await createCluster({ exec, home }).attach({ namespace: { snake: "n_a", kebab: "n-a", root: home }, runId: "r", root: home, images: [] })
        assert.equal(run.registry, "localhost:49153")
        assert.equal(run.registryInCluster, "k3d-starci-registry:5000")
        assert.equal(run.namespacePrefix, "n-a-")
        assert.equal(run.serverContainer, names.server)
    })

    it("reset deletes the labelled namespaces of the repository only", async () => {
        const { exec, calls } = scriptedExec((line) => {
            const state = states({ [names.server]: "running" })(line)
            if (state !== undefined) return state
            return line.includes("get namespaces") ? { stdout: calls.some((call) => call.line.includes("delete namespace")) ? "" : "namespace/n-a-x\nnamespace/n-a\n" } : undefined
        })
        await createCluster({ exec, home, pause: async () => undefined }).reset({ namespace: { snake: "n_a", kebab: "n-a", root: home } })
        const deleted = calls.find((call) => call.line.includes("delete namespace"))
        assert.match(deleted?.line ?? "", /kubectl delete namespace n-a-x --wait=false --ignore-not-found$/)
    })

    it("down refuses while busy unless forced", async () => {
        const { exec, calls } = scriptedExec(states({ [names.server]: "running" }))
        const cluster = createCluster({ exec, home, isBusy: async () => true })
        await cluster.down()
        assert.equal(calls.length, 0)
        await cluster.down({ force: true })
        assert.ok(calls.some((call) => call.line === `k3d cluster delete ${names.cluster}`))
        assert.ok(calls.some((call) => call.line === "docker rm -f -v k3d-starci-registry"))
    })
})
