import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, describe, test } from "node:test"
import type { K3dRequest, StackApi, StackImageRequest, StackStatus } from "../stack/contracts"
import { main, parseArguments } from "./main"

const roots: string[] = []

const fixture = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "tw-a3c-"))
    roots.push(root)
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true })
        writeFileSync(join(root, path), content)
    }
    return root
}

afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const COMPOSE = ".starcistacks/dev/infra/compose"

const STACK_FILES = {
    [`${COMPOSE}/postgres.yaml`]: "services:\n  postgres:\n    image: pgvector/pgvector:pg16\n",
    [`${COMPOSE}/redis.yaml`]: "services:\n  redis:\n    image: redis:7-alpine\n  app:\n    build: .\n",
}

const RUNNING: StackStatus = {
    home: "/home/.starci/test-stack",
    containers: [
        { service: "postgresql", image: "pgvector/pgvector:pg16", container: "starci-pg", state: "running", port: 5432 },
        { service: "toxiproxy", image: "shopify/toxiproxy", container: "starci-toxi", state: "running", port: null },
    ],
    leases: [],
}

const LEASED: StackStatus = { ...RUNNING, leases: [{ namespace: "nivo_backend_a1b2c3", runId: "r1", pid: 42, since: "2026-01-01T00:00:00Z" }] }

interface Calls {
    up: Array<{ services: ReadonlyArray<StackImageRequest>; k3d: (K3dRequest & { root: string }) | undefined }>
    down: Array<{ force?: boolean } | undefined>
}

const fakeStack = (status: StackStatus): { stack: StackApi; calls: Calls } => {
    const calls: Calls = { up: [], down: [] }
    const unused = (): never => {
        throw new Error("not used by the cli")
    }
    const stack: StackApi = {
        up: (services, k3d) => {
            calls.up.push({ services, k3d })
            return Promise.resolve(status)
        },
        down: (options) => {
            calls.down.push(options)
            return Promise.resolve({ ...status, containers: [], leases: [] })
        },
        status: () => Promise.resolve(status),
        attach: unused,
        detach: unused,
        reset: unused,
    }
    return { stack, calls }
}

const run = async (argv: ReadonlyArray<string>, status: StackStatus, cwd?: string): Promise<{ code: number; out: string; err: string; calls: Calls }> => {
    const { stack, calls } = fakeStack(status)
    let out = ""
    let err = ""
    const code = await main(argv, { stack, cwd, out: (text) => void (out += text), err: (text) => void (err += text) })
    return { code, out, err, calls }
}

describe("parseArguments", () => {
    test("parses options and defaults", () => {
        assert.deepEqual(parseArguments(["up"]), { command: "up", stack: ".starcistacks/dev", services: undefined, k3d: false, force: false, json: false, cwd: undefined })
        assert.deepEqual(parseArguments(["up", "--stack", "s/x", "--services", "redis,postgresql", "--k3d", "--cwd=/r"]), {
            command: "up",
            stack: "s/x",
            services: ["redis", "postgresql"],
            k3d: true,
            force: false,
            json: false,
            cwd: "/r",
        })
        assert.equal(parseArguments(["status", "-h"]), "help")
    })
    test("rejects bad command lines", () => {
        for (const argv of [[], ["restart"], ["up", "--nope"], ["up", "--stack"], ["up", "--services", "mysql"], ["up", "down"]]) {
            assert.ok("usageError" in (parseArguments(argv) as object), argv.join(" "))
        }
    })
})

describe("main", () => {
    test("help prints usage on stdout with exit 0", async () => {
        const result = await run(["--help"], RUNNING)
        assert.equal(result.code, 0)
        assert.match(result.out, /Usage: starci app stack/)
    })

    test("unknown command or flag prints usage on stderr with exit 2", async () => {
        for (const argv of [["restart"], ["up", "--nope"], []]) {
            const result = await run(argv, RUNNING)
            assert.equal(result.code, 2)
            assert.match(result.err, /Usage: starci app stack/)
            assert.equal(result.out, "")
        }
    })

    test("up reads every supported service of the definition and prints one line per container", async () => {
        const root = fixture(STACK_FILES)
        const result = await run(["up"], RUNNING, root)
        assert.equal(result.code, 0)
        assert.deepEqual(result.calls.up[0]?.services, [
            { service: "postgresql", image: "pgvector/pgvector:pg16" },
            { service: "redis", image: "redis:7-alpine" },
        ])
        assert.equal(result.calls.up[0]?.k3d, undefined)
        const lines = result.out.trimEnd().split("\n")
        assert.match(lines[0] ?? "", /^postgresql\s+pgvector\/pgvector:pg16\s+starci-pg\s+running\s+5432$/)
        assert.match(lines[1] ?? "", /^toxiproxy\s+shopify\/toxiproxy\s+starci-toxi\s+running\s+-$/)
        assert.equal(lines[2], "leases: 0")
    })

    test("up honours --services, --stack, --cwd and --k3d", async () => {
        const root = fixture({ "other/infra/compose/c.yaml": "services:\n  redis:\n    image: redis:6\n" })
        const result = await run(["up", "--stack", "other", "--services", "redis", "--k3d", "--cwd", root], RUNNING)
        assert.equal(result.code, 0)
        assert.deepEqual(result.calls.up[0]?.services, [{ service: "redis", image: "redis:6" }])
        assert.deepEqual(result.calls.up[0]?.k3d, { images: [], root })
    })

    test("up fails with exit 1 when a requested service is not in the definition or the definition is empty", async () => {
        const root = fixture(STACK_FILES)
        const missing = await run(["up", "--services", "kafka"], RUNNING, root)
        assert.equal(missing.code, 1)
        assert.match(missing.err, /has no kafka service/)
        const empty = await run(["up"], RUNNING, fixture({}))
        assert.equal(empty.code, 1)
        assert.match(empty.err, /no service this library supports/)
    })

    test("status prints the table and exits 0, or JSON with --json", async () => {
        const table = await run(["status"], LEASED)
        assert.equal(table.code, 0)
        assert.match(table.out, /leases: 1\n {2}nivo_backend_a1b2c3 run r1 pid 42/)
        const json = await run(["status", "--json"], LEASED)
        assert.equal(json.code, 0)
        assert.deepEqual(JSON.parse(json.out), LEASED)
        const empty = await run(["status"], { ...RUNNING, containers: [] })
        assert.equal(empty.code, 0)
        assert.match(empty.out, /no shared containers/)
    })

    test("down refuses with exit 2 naming the live leases, unless --force", async () => {
        const refused = await run(["down"], LEASED)
        assert.equal(refused.code, 2)
        assert.match(refused.err, /nivo_backend_a1b2c3 \(run r1, pid 42\)/)
        assert.equal(refused.calls.down.length, 0)
        const forced = await run(["down", "--force"], LEASED)
        assert.equal(forced.code, 0)
        assert.deepEqual(forced.calls.down, [{ force: true }])
        const idle = await run(["down"], RUNNING)
        assert.equal(idle.code, 0)
        assert.deepEqual(idle.calls.down, [{ force: false }])
    })

    test("a failing stack is reported on stderr with exit 1", async () => {
        const stack: StackApi = { ...fakeStack(RUNNING).stack, status: () => Promise.reject(new Error("docker is not reachable")) }
        let err = ""
        const code = await main(["status"], { stack, out: () => undefined, err: (text) => void (err += text) })
        assert.equal(code, 1)
        assert.match(err, /docker is not reachable/)
    })
})
