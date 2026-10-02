/**
 * The rules that hold the test layout (catalog R47 `BE_TEST_TOPOLOGY`, owner test layout 2026-09-30).
 *
 * Unit specs sit beside their subject. Everything else lives under `src/tests/`, one folder per kind:
 *   - `world/`        the ONLY test infrastructure (slot `be.tests.world`): `global-setup.ts` starts (or attaches to) the stack
 *                     the repository declares in `.starcistacks/<env>` (the test-world library) - every service of it runs
 *                     REAL behind toxiproxy - and runs the migrations once over the cli app's connections; `use-test-world.ts` exports
 *                     `useTestWorld({ apps } | { modules })` -> `world.apps.<name>.api`, `world.db.<connection>`,
 *                     `world.infra.<service>` (`latency(ms)`, `cut()`, `restore()` on the real service),
 *                     `world.fake.<provider>` (network-edge fakes of external SaaS with failNext/replayWebhook/delay),
 *                     `world.waitFor`; `fakes/<provider>/` holds the fake servers and payload fixtures.
 *   - `fixtures/`     typed doubles and builders.
 *   - `integration/`  `<capability>/*.integration-spec.ts`, `useTestWorld({ modules })`, real database, no HTTP.
 *   - `e2e/`          `<area>/*.e2e-spec.ts`, `useTestWorld({ apps })`.
 *   - `contract/`     `<provider>/*.contract-spec.ts`, provider sandboxes, run only by `test:contract`.
 * Folder and suffix agree by construction: a file whose suffix does not match its folder matches no slot (R01).
 *
 * Receivers and origins are judged by type and by the slot of their declaring file, never by name.
 */
import { hfsOf } from "./lib/hfs.mjs"
import { inCli } from "./lib/persistence.mjs"
import { isPackageType, typeOrigins } from "./lib/types.mjs"

/** Every test slot under `src/tests/` except the world, where the infrastructure lives. */
const OUTSIDE_WORLD = new Set(["be.tests.fixtures", "be.tests.integration", "be.tests.e2e", "be.tests.contract"])
/** Every test slot under `src/tests/`. */
const UNDER_TESTS = new Set([...OUTSIDE_WORLD, "be.tests.world"])

const SCHEMA_CALLS = new Set(["runMigrations", "undoLastMigration", "synchronize", "dropDatabase", "createSchema", "showMigrations"])
const TYPEORM_RECEIVERS = ["DataSource", "QueryRunner", "EntityManager"]
const CONTAINER_PACKAGES = /^(?:testcontainers|@testcontainers\/[a-z0-9-]+)$/
/** `process.env` itself (the global `process`). */
const isProcessEnv = (node) => node?.type === "MemberExpression" && !node.computed && node.object.type === "Identifier" && node.object.name === "process" && node.property.name === "env"
/** A member of `process.env`. */
const isEnvMember = (node) => node?.type === "MemberExpression" && isProcessEnv(node.object)

/**
 * The world is the only infrastructure location. Refused in fixtures, integration, e2e and contract specs: importing a
 * migration (a class declared in a `be.persistence` `migrations/` file, or a value whose type is an array of them) or
 * anything the cli app declares; importing typeorm's `DataSource` or a testcontainers package; calling
 * `runMigrations`/`synchronize`/`dropDatabase`/`createSchema`... on a typeorm receiver; constructing a container; writing
 * `process.env`. Migration behaviour is tested by the e2e world.
 */
export const testsInfraOnlyInWorld = {
    meta: {
        type: "problem",
        docs: { description: "Only src/tests/world starts infrastructure, migrates, holds a DataSource or writes process.env." },
        schema: [],
        messages: {
            migration: "This test imports a migration or the cli. The schema is prepared once by `src/tests/world/global-setup.ts`, which runs the migrations over the cli app's connections; migration behaviour is tested through the e2e world.",
            call: "`{{name}}` builds or changes the schema outside `src/tests/world`. The world migrates once; a test uses `world.db.<connection>`.",
            infra: "This test imports or starts infrastructure (testcontainers, typeorm's DataSource). It belongs to `src/tests/world`; a test uses `useTestWorld(...)` and `world.db.<connection>`.",
            env: "This test writes `process.env`. The environment is set once by `src/tests/world`; a test takes the world as it is.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        if (!OUTSIDE_WORLD.has(hfs.slotOf(filename))) return {}
        const isMigrationDecl = (file) => hfs.slotOf(file) === "be.persistence" && /\/migrations\/[^/]+$/.test(hfs.relative(file))
        const fromMigrate = (file) => inCli(hfs, file)
        const migrationTyped = (node) => {
            const services = context.sourceCode.parserServices
            const checker = services.program.getTypeChecker()
            const tsNode = services.esTreeNodeToTSNodeMap.get(node)
            if (!tsNode) return false
            let type = checker.getTypeAtLocation(tsNode)
            if (checker.isArrayType?.(type) || checker.isTupleType?.(type)) type = checker.getTypeArguments(type)[0] ?? type
            const parts = type?.isUnion?.() ? type.types : [type]
            return parts.some((part) => (part?.getSymbol?.()?.getDeclarations?.() ?? []).some((d) => isMigrationDecl(String(d.getSourceFile().fileName))))
        }
        return {
            ImportDeclaration(node) {
                const source = String(node.source.value)
                if (CONTAINER_PACKAGES.test(source)) return context.report({ node, messageId: "infra" })
                if (source === "typeorm" && node.specifiers.some((s) => s.type === "ImportSpecifier" && (s.imported.name ?? s.imported.value) === "DataSource")) return context.report({ node, messageId: "infra" })
                for (const specifier of node.specifiers) {
                    const origins = typeOrigins(context, specifier.local)
                    if (origins.some((o) => isMigrationDecl(o.file) || fromMigrate(o.file)) || migrationTyped(specifier.local)) return context.report({ node: specifier, messageId: "migration" })
                }
                return undefined
            },
            CallExpression(node) {
                const callee = node.callee
                if (callee.type === "MemberExpression" && !callee.computed && callee.object.type === "Identifier" && callee.object.name === "Object" && callee.property.name === "assign") {
                    if (isProcessEnv(node.arguments[0])) context.report({ node, messageId: "env" })
                    return
                }
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
                if (!SCHEMA_CALLS.has(callee.property.name)) return
                if (TYPEORM_RECEIVERS.some((name) => isPackageType(context, callee.object, name, "typeorm"))) context.report({ node, messageId: "call", data: { name: callee.property.name } })
            },
            NewExpression(node) {
                if (typeOrigins(context, node.callee).some((o) => o.module && CONTAINER_PACKAGES.test(o.module))) context.report({ node, messageId: "infra" })
            },
            AssignmentExpression(node) {
                if (isEnvMember(node.left)) context.report({ node, messageId: "env" })
            },
            UnaryExpression(node) {
                if (node.operator === "delete" && isEnvMember(node.argument)) context.report({ node, messageId: "env" })
            },
        }
    },
}

const OVERRIDES = new Set(["overrideProvider", "overrideModule", "overrideGuard", "overrideInterceptor", "overrideFilter", "overridePipe"])

/**
 * Nothing under `src/tests/` overrides the DI container: the repository's own services run real (`world.infra.<service>`) and
 * external SaaS are network-edge fakes of the world (`world.fake.<provider>`), so our integrations' signing, parsing and retry code runs. Refused: `.override*(`, a provider
 * object with `useValue`, and `jest.mock(`.
 */
export const testsNoOverride = {
    meta: {
        type: "problem",
        docs: { description: "Nothing under src/tests overrides a provider: external services are the world's network fakes." },
        schema: [],
        messages: {
            override: "`{{what}}` replaces a provider under `src/tests`. Nothing is overridden: a service of the repository's stack runs real (`world.infra.<service>` fails it on purpose) and an external SaaS is a network fake of the world (`world.fake.<provider>`, fixtures under `src/tests/world/fakes/`), so the integration's own signing, parsing and retry code runs.",
        },
    },
    create(context) {
        if (!UNDER_TESTS.has(hfsOf(context).slotOf(context.filename || context.getFilename()))) return {}
        return {
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
                if (OVERRIDES.has(callee.property.name)) context.report({ node, messageId: "override", data: { what: callee.property.name } })
                else if (callee.object.type === "Identifier" && callee.object.name === "jest" && callee.property.name === "mock") context.report({ node, messageId: "override", data: { what: "jest.mock" } })
            },
            Property(node) {
                const key = node.key.type === "Identifier" ? node.key.name : node.key.value
                if (key !== "useValue" || node.parent.type !== "ObjectExpression") return
                if (node.parent.properties.some((p) => p.type === "Property" && (p.key.name ?? p.key.value) === "provide")) context.report({ node, messageId: "override", data: { what: "useValue" } })
            },
        }
    },
}

/** The name of a property key written as an identifier or a literal (`{ apps }`, `{ "apps": ... }`, `{ ["apps"]: ... }`); null for any computed expression. */
const plainKey = (property) => {
    if (property.key.type === "Literal") return String(property.key.value)
    return property.key.type === "Identifier" && !property.computed ? property.key.name : null
}

/**
 * The world an integration spec (`{ modules }`, with real peer apps beside them as `apps` when its client calls another app of
 * ours) or an e2e spec (`{ apps }`, never `modules`) asks for; every such spec asks for one; the retired name `useE2eWorld`
 * exists nowhere.
 */
export const testWorldShape = {
    meta: {
        type: "problem",
        docs: { description: "An integration spec calls useTestWorld({ modules }) (peer apps may join as `apps`); an e2e spec calls useTestWorld({ apps })." },
        schema: [],
        messages: {
            modules: "An integration spec tests capability modules with no HTTP door of ours: call `useTestWorld({ modules: [...] })`; real peer apps its client calls may join beside them as `apps`, never instead of them.",
            apps: "An e2e spec boots applications: call `useTestWorld({ apps: {...} })`, not `modules`.",
            literal: "The options of `useTestWorld(...)` must be one object literal with plain keys: a variable, a spread or a computed key hides whether the spec asks for `modules` or `apps`.",
            missing: "This spec never calls `useTestWorld(...)`: integration and e2e specs run inside the one test world.",
            retired: "`useE2eWorld` is the retired name of `useTestWorld`; there is one name, no alias.",
        },
    },
    create(context) {
        const slot = hfsOf(context).slotOf(context.filename || context.getFilename())
        const wants = slot === "be.tests.integration" ? "modules" : slot === "be.tests.e2e" ? "apps" : null
        const retired = {
            Identifier(node) {
                if (node.name === "useE2eWorld") context.report({ node, messageId: "retired" })
            },
        }
        if (!wants) return retired
        let seen = false
        return {
            ...retired,
            CallExpression(node) {
                if (node.callee.type !== "Identifier" || node.callee.name !== "useTestWorld") return
                seen = true
                const options = node.arguments[0]
                if (options?.type !== "ObjectExpression") return context.report({ node, messageId: "literal" })
                const keys = []
                for (const property of options.properties) {
                    const key = property.type === "Property" ? plainKey(property) : null
                    if (key === null) return context.report({ node: property, messageId: "literal" })
                    keys.push(key)
                }
                const refused = wants === "modules" ? !keys.includes("modules") : !keys.includes("apps") || keys.includes("modules")
                if (refused) context.report({ node, messageId: wants })
            },
            "Program:exit"(node) {
                if (!seen) context.report({ node, loc: { line: 1, column: 0 }, messageId: "missing" })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "tests-infra-only-in-world": testsInfraOnlyInWorld,
    "tests-no-override": testsNoOverride,
    "test-world-shape": testWorldShape,
}

/** Every rule of this law ships at `error`. */
export const recommended = {
    "starci-be/tests-infra-only-in-world": "error",
    "starci-be/tests-no-override": "error",
    "starci-be/test-world-shape": "error",
}
