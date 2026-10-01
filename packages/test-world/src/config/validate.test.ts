import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, describe, test } from "node:test"
import { TestWorldError, TestWorldErrorCode } from "../errors"
import type { TestWorldConfig } from "./types"
import { validateDeclaration } from "./validate"

const roots: string[] = []

const fixture = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "tw-a3v-"))
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

const FILES = {
    ".starcistacks/dev/environment.json": "{}",
    "seeds/a.sql": "select 1",
    "realm.json": JSON.stringify({ realm: "app" }),
    "docker/api.Dockerfile": "FROM node",
}

const config = (overrides: Record<string, unknown> = {}): TestWorldConfig =>
    ({
        stack: ".starcistacks/dev",
        stacks: { postgresql: { connections: [{ name: "main", seeds: ["seeds/a.sql"] }] }, redis: {} },
        fakes: { llm: {} },
        apps: { api: {} },
        migrate: { module: () => Promise.resolve(), options: () => ({}) },
        ...overrides,
    }) as unknown as TestWorldConfig

const problemsOf = (subject: TestWorldConfig, root: string): string => {
    try {
        validateDeclaration(subject, root)
    } catch (error) {
        assert.ok(error instanceof TestWorldError)
        assert.equal(error.code, TestWorldErrorCode.ConfigInvalid)
        return error.message
    }
    return assert.fail("expected the declaration to be invalid")
}

describe("validateDeclaration", () => {
    test("a valid declaration answers the selected infra services", () => {
        const root = fixture(FILES)
        const selected = validateDeclaration(
            config({
                stacks: {
                    postgresql: { connections: [{ name: "main", seeds: ["seeds/a.sql"] }] },
                    keycloak: { realm: "realm.json" },
                    qdrant: { fakedBy: "llm", reason: "no self-hosted image" },
                },
                k3d: { enable: true, images: { api: "docker/api.Dockerfile" } },
                identity: { register: "keycloak", signIn: () => Promise.resolve({ personId: "p", sessionToken: "t" }) },
            }),
            root,
        )
        assert.deepEqual(selected, ["postgresql", "keycloak"])
    })

    test("lists every problem at once", () => {
        const root = fixture({ "realm.json": "not json" })
        const message = problemsOf(
            config({
                stack: ".starcistacks/missing",
                stacks: {
                    postgresql: { connections: [{ name: "1bad", seeds: ["seeds/none.sql"] }, { name: "dup" }, { name: "dup" }] },
                    keycloak: { realm: "realm.json" },
                    stripe: {},
                    gpu: { fakedBy: "nothing", reason: "" },
                    vision: { fakedBy: "", reason: "gpu" },
                },
                k3d: { enable: true, images: { api: "docker/none.Dockerfile" } },
                identity: { register: "keycloak" },
                apps: { "bad-name": {} },
                migrate: undefined,
            }),
            root,
        )
        for (const expected of [
            "the directory .starcistacks/missing does not exist",
            "connections[0].name",
            "seeds: seeds/none.sql does not exist",
            'connections[2].name: "dup" is declared twice',
            "not valid JSON",
            "stacks.stripe: not an infrastructure service",
            'stacks.gpu.fakedBy: "nothing" is not an entry of `fakes`',
            "stacks.gpu.reason",
            "stacks.vision.fakedBy: must name",
            "k3d.images.api",
            "apps.bad-name",
            "identity.signIn",
            "migrate: the migrate block is required",
        ]) {
            assert.ok(message.includes(expected), `missing "${expected}" in:\n${message}`)
        }
    })

    test("postgres needs connections; realm file needs a realm name and must exist", () => {
        const root = fixture({ ...FILES, "empty.json": "{}" })
        assert.match(problemsOf(config({ stacks: { postgresql: { connections: [] } } }), root), /connections: at least one/)
        assert.match(problemsOf(config({ stacks: { keycloak: { realm: "empty.json" } } }), root), /no `realm` name/)
        assert.match(problemsOf(config({ stacks: { keycloak: { realm: "nope.json" } } }), root), /nope\.json does not exist/)
    })

    test("a known service may be faked when it names a fake and a reason", () => {
        const root = fixture(FILES)
        const selected = validateDeclaration(config({ stacks: { redis: { fakedBy: "llm", reason: "stateless compute" } } }), root)
        assert.deepEqual(selected, [])
    })

    test("k3d Dockerfiles are only checked when the cluster is enabled", () => {
        const root = fixture(FILES)
        assert.doesNotThrow(() => validateDeclaration(config({ k3d: { enable: false, images: { api: "docker/none.Dockerfile" } } }), root))
    })
})
