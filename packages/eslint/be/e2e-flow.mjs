/**
 * The rules that hold `e2e-flow.md` (catalog R48 `BE_SPEC_QUALITY`, the e2e half).
 *
 * A rule earns its place by being exact: it fires on a syntactic or typed shape, never on a judgement, or it becomes
 * something authors learn to work around. What these four enforce is transport bypass (a bus or an actor called
 * directly), a sleep instead of a poll, a branch inside a step, and a testing module built inside a spec instead of
 * booted by `src/tests/e2e/setup`. They do not pretend to judge business meaning: whether a file is one flow, whether
 * its steps are named, and what the absence of an effect is proved by are read by a person.
 *
 * Receivers are identified by their TypeScript type and by the file their type is declared in, never by a variable
 * name (`lib/types.mjs`); a spec is recognised by its file name (`*.e2e-spec.ts`), which is part of the slot
 * vocabulary.
 */
import { basename } from "node:path"
import ts from "typescript"
import { hfsOf } from "./lib/hfs.mjs"
import { isPackageType, typeOrigins, typed } from "./lib/types.mjs"

/** Files this law governs. A flow is a named lane, not every file that happens to touch a database. */
const isE2eSpec = (filename) => /\.e2e-spec\.ts$/.test(basename(String(filename || "").replace(/\\/g, "/")))

/** The in-process dispatchers of `@nestjs/cqrs`: a flow enters through transport, not through them. */
const BUS_TYPES = ["CommandBus", "QueryBus", "EventBus"]

/** The role suffixes of the actors a flow never invokes itself: a handler, a consumer, a job. */
const ACTOR_FILE = /\.(?:handler|consumer|job)\.ts$/

/**
 * What a name in scope is: `{ global: true }` when nothing in the file declares it, `{ source, imported }` when it is an
 * import binding, else null (a local declaration).
 */
const bindingOf = (context, node, name) => {
    let scope = (context.sourceCode || context.getSourceCode()).getScope(node)
    while (scope) {
        const variable = scope.set.get(name)
        if (variable) {
            if (variable.defs.length === 0) return { global: true }
            const definition = variable.defs[0]
            if (definition.type !== "ImportBinding" || definition.node.type !== "ImportSpecifier") return null
            return { source: definition.parent.source.value, imported: definition.node.imported.name ?? definition.node.imported.value }
        }
        scope = scope.upper
    }
    return { global: true }
}

/** E2E enters through production transport and never invokes an internal actor directly. */
export const e2eUsesProductionTransport = {
    meta: {
        type: "problem",
        docs: { description: "Operational E2E keeps the production transport boundary in the proof." },
        schema: [],
        messages: {
            busImport: "`{{name}}` is an internal dispatcher. Enter through GraphQL, HTTP, socket, broker or scheduler.",
            direct: "Calling `.{{method}}()` on a `{{name}}` skips production routing and delivery semantics. Enter through the transport.",
            actor: "Calling `.{{method}}()` on `{{name}}`, declared in `{{file}}`, bypasses the transport and the broker that own it. Send the request or the message a client sends.",
        },
    },
    create(context) {
        if (!isE2eSpec(context.filename || context.getFilename())) return {}
        return {
            ImportDeclaration(node) {
                if (node.source.value !== "@nestjs/cqrs") return
                for (const specifier of node.specifiers) {
                    if (specifier.type !== "ImportSpecifier") continue
                    const imported = specifier.imported.name || specifier.imported.value
                    if (BUS_TYPES.includes(imported)) context.report({ node: specifier, messageId: "busImport", data: { name: imported } })
                }
            },
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
                const method = callee.property.name
                const bus = BUS_TYPES.find((name) => isPackageType(context, callee.object, name, "@nestjs/cqrs"))
                if (bus) {
                    context.report({ node: callee.property, messageId: "direct", data: { method, name: bus } })
                    return
                }
                const actor = typeOrigins(context, callee.object).find((origin) => ACTOR_FILE.test(origin.file))
                if (actor) context.report({ node: callee.property, messageId: "actor", data: { method, name: actor.name, file: basename(actor.file) } })
            },
        }
    },
}

// -- E2E-3 ----------------------------------------------------------------------------------------

/** The modules whose `setTimeout`/`setInterval` are timers. */
const TIMER_MODULES = ["timers", "node:timers", "timers/promises", "node:timers/promises"]

/** Whether a call awaits a fixed duration: a global or imported timer, or a `Promise<void>` call given one number. */
const waitsForDuration = (context, node) => {
    const callee = node.callee
    const binding = callee.type === "Identifier" ? bindingOf(context, node, callee.name) : null
    if (binding?.global && (callee.name === "setTimeout" || callee.name === "setInterval")) return true
    if (binding?.source && TIMER_MODULES.includes(binding.source) && (binding.imported === "setTimeout" || binding.imported === "setInterval")) return true
    if (node.arguments.length !== 1 || node.arguments[0].type === "SpreadElement") return false
    const { checker, toTs } = typed(context)
    const argument = checker.getTypeAtLocation(toTs(node.arguments[0]))
    if (!(argument.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral))) return false
    return checker.typeToString(checker.getTypeAtLocation(toTs(node))) === "Promise<void>"
}

/** A flow polls until the state settles; it never waits for a duration. */
export const noSleepInFlow = {
    meta: {
        type: "problem",
        docs: { description: "A flow polls for the state it needs, with a deadline. It never sleeps." },
        schema: [],
        messages: {
            sleep:
                "This call waits for a DURATION, and a duration is a guess about somebody else's machine. It is too long on the machine that passes - every run pays it - and too short on the one that matters, where it fails as a flake nobody can reproduce. Poll for the state you are actually waiting for with `waitFor`, which carries a deadline, so the test says what it wanted rather than how long it was willing to sit there.",
            timer:
                "A promise around `setTimeout` is a sleep with the name taken off. The objection is the same: nothing here says which state the flow is waiting for, so the failure message when it expires names a timeout instead of the thing that never happened. Poll the state with `waitFor`.",
        },
    },
    create(context) {
        if (!isE2eSpec(context.filename || context.getFilename())) return {}
        const insidePromise = (node) => {
            for (let current = node.parent; current; current = current.parent) {
                if (current.type === "NewExpression" && current.callee.type === "Identifier" && current.callee.name === "Promise") return current
            }
            return null
        }
        const reportedPromises = new Set()
        return {
            CallExpression(node) {
                if (!waitsForDuration(context, node)) return
                // A timer wrapped in `new Promise` is one finding, on the promise, not two on one sleep.
                const wrapper = insidePromise(node)
                if (wrapper) {
                    if (!reportedPromises.has(wrapper)) {
                        reportedPromises.add(wrapper)
                        context.report({ node: wrapper, messageId: "timer" })
                    }
                    return
                }
                context.report({ node, messageId: "sleep" })
            },
        }
    },
}

// -- E2E-7 ----------------------------------------------------------------------------------------

/** A step asserts one outcome. A branch means the test is prepared for either, which is no assertion. */
export const noBranchInFlowStep = {
    meta: {
        type: "problem",
        docs: { description: "A flow step takes no branch: it asserts the one outcome the business promises." },
        schema: [],
        messages: {
            branch:
                "A branch inside a step means this test passes down either path, so a green run stops being evidence that the business worked - it only proves the code reached the end. The flow knows which outcome it is asserting: state it. If two outcomes are both legitimate, they are two steps, or two flows.",
        },
    },
    create(context) {
        if (!isE2eSpec(context.filename || context.getFilename())) return {}

        /** True when this node sits inside the callback of an `it(...)` or `test(...)`. */
        const insideStep = (node) => {
            for (let current = node.parent; current; current = current.parent) {
                if (current.type !== "CallExpression") continue
                const callee = current.callee
                const name = callee && (callee.name || (callee.object && callee.object.name))
                if (name === "it" || name === "test") return true
            }
            return false
        }

        const report = (node) => {
            if (insideStep(node)) context.report({ node, messageId: "branch" })
        }

        return {
            IfStatement: report,
            ConditionalExpression: report,
            SwitchStatement: report,
            LogicalExpression(node) {
                // `a && b` used as a STATEMENT is a hidden if; the same operator inside an assertion is not
                if (node.parent && node.parent.type === "ExpressionStatement") report(node)
            },
        }
    },
}

// -- E2E-8 (the per-file half: a spec builds no wiring of its own) --------------------------------

/** A flow boots through the shared setup; it does not build its own copy of the app. */
export const noWiringInFlowSpec = {
    meta: {
        type: "problem",
        docs: { description: "An e2e spec boots through the shared setup and builds no testing module of its own (E2E-8)." },
        schema: [],
        messages: {
            wiring:
                "`Test.createTestingModule(...)` builds this flow's own copy of the app. The world is stood up in one place, `src/tests/e2e/setup`, which boots the real `AppModule.register(testOptions)`; a spec file carries no wiring of its own. When the wiring changes, every flow that inlined its own module has to change with it, and two flows standing the world up slightly differently is how nobody learns where they differ. Boot through the setup and override only the integration token this flow needs.",
        },
    },
    create(context) {
        if (!isE2eSpec(context.filename || context.getFilename())) return {}
        return {
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.name !== "createTestingModule") return
                if (callee.object.type !== "Identifier") return
                const binding = bindingOf(context, node, callee.object.name)
                if (binding?.source === "@nestjs/testing" && binding.imported === "Test") context.report({ node: callee, messageId: "wiring" })
            },
        }
    },
}


/**
 * R47 (owner ruling 2026-09-30): ONE e2e world. `src/tests/e2e/world/global-setup.ts` starts the shared infrastructure
 * and runs `apps/migrate`'s exported bootstrap once; a spec (slot `be.tests.e2e` / `be.tests.e2e-live`) only uses
 * `useE2eWorld({ app })` (`world.api`, `world.db.<connection>`, `world.fake`). Refused in a spec: importing a migration
 * (a class declared in a `be.persistence` `migrations/` file, or a value whose type is an array of them), importing
 * anything the migrate app declares, importing typeorm's `DataSource` or any testcontainers package, calling
 * `runMigrations`, `undoLastMigration`, `synchronize`, `dropDatabase` or `createSchema` on a typeorm receiver,
 * constructing a container, and writing `process.env`. The world folder (slot `be.tests.e2e-world`) is the only test
 * location that does those. Migration behaviour is tested only by `apps/migrate`'s own specs.
 */
const SCHEMA_CALLS = new Set(["runMigrations", "undoLastMigration", "synchronize", "dropDatabase", "createSchema", "showMigrations"])
const TYPEORM_RECEIVERS = ["DataSource", "QueryRunner", "EntityManager"]
const CONTAINER_PACKAGES = /^(?:testcontainers|@testcontainers\/[a-z0-9-]+)$/
/** `process.env` itself (the global `process`, not a local binding named so). */
const isProcessEnv = (node) => node?.type === "MemberExpression" && !node.computed && node.object.type === "Identifier" && node.object.name === "process" && node.property.name === "env"
/** A member of `process.env`. */
const isEnvMember = (node) => node?.type === "MemberExpression" && isProcessEnv(node.object)

export const e2eNoSchemaWork = {
    meta: {
        type: "problem",
        docs: { description: "An e2e spec never migrates or builds the schema: globalSetup runs apps/migrate once; specs assert through the fixture EntityManager." },
        schema: [],
        messages: {
            migration: "An e2e spec imports a migration or the migrate app. The schema is prepared once by the e2e globalSetup running the real `apps/migrate` entry; test migrations in `apps/migrate`'s own specs.",
            call: "`{{name}}` builds or changes the schema inside an e2e spec. The e2e globalSetup runs `apps/migrate` once; a spec boots the app and asserts through the fixture's EntityManager.",
            container: "An e2e spec imports or starts test infrastructure (testcontainers, typeorm's DataSource). It belongs to the e2e world in `src/tests/e2e/world`; the spec uses `useE2eWorld({ app })` and `world.db.<connection>`.",
            env: "An e2e spec writes `process.env`. The environment of the booted app is set once by the e2e world (`src/tests/e2e/world`); a spec takes the world as it is.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        const slot = hfs.slotOf(filename)
        if (slot !== "be.tests.e2e" && slot !== "be.tests.e2e-live") return {}
        const isMigrationDecl = (file) => hfs.slotOf(file) === "be.persistence" && /\/migrations\/[^/]+$/.test(hfs.relative(file))
        const fromMigrate = (file) => hfs.slotOf(file) === "be.app.migrate"
        const migrationTyped = (node) => {
            const { checker, toTs } = typed(context)
            const tsNode = toTs(node)
            if (!tsNode) return false
            let type = checker.getTypeAtLocation(tsNode)
            if (checker.isArrayType?.(type) || checker.isTupleType?.(type)) type = checker.getTypeArguments(type)[0] ?? type
            const parts = type?.isUnion?.() ? type.types : [type]
            return parts.some((part) => {
                const symbol = part?.getSymbol?.()
                return (symbol?.getDeclarations?.() ?? []).some((d) => isMigrationDecl(String(d.getSourceFile().fileName)))
            })
        }
        return {
            ImportDeclaration(node) {
                const source = String(node.source.value)
                if (CONTAINER_PACKAGES.test(source)) {
                    context.report({ node, messageId: "container" })
                    return
                }
                if (source === "typeorm" && node.specifiers.some((s) => s.type === "ImportSpecifier" && (s.imported.name ?? s.imported.value) === "DataSource")) {
                    context.report({ node, messageId: "container" })
                    return
                }
                for (const specifier of node.specifiers) {
                    const origins = typeOrigins(context, specifier.local)
                    if (origins.some((o) => isMigrationDecl(o.file) || fromMigrate(o.file)) || migrationTyped(specifier.local)) {
                        context.report({ node: specifier, messageId: "migration" })
                        return
                    }
                }
            },
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
                if (!SCHEMA_CALLS.has(callee.property.name)) return
                if (TYPEORM_RECEIVERS.some((name) => isPackageType(context, callee.object, name, "typeorm"))) context.report({ node, messageId: "call", data: { name: callee.property.name } })
            },
            NewExpression(node) {
                const origins = typeOrigins(context, node.callee)
                if (origins.some((o) => o.module && CONTAINER_PACKAGES.test(o.module))) context.report({ node, messageId: "container" })
            },
            // process.env.X = ..., process.env["X"] = ..., delete process.env.X, Object.assign(process.env, ...)
            "AssignmentExpression, UpdateExpression"(node) {
                const target = node.type === "AssignmentExpression" ? node.left : node.argument
                if (isEnvMember(target)) context.report({ node, messageId: "env" })
            },
            UnaryExpression(node) {
                if (node.operator === "delete" && isEnvMember(node.argument)) context.report({ node, messageId: "env" })
            },
            "CallExpression[callee.type='MemberExpression'][callee.object.name='Object'][callee.property.name='assign']"(node) {
                if (isProcessEnv(node.arguments[0])) context.report({ node, messageId: "env" })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "e2e-uses-production-transport": e2eUsesProductionTransport,
    "no-sleep-in-flow": noSleepInFlow,
    "no-branch-in-flow-step": noBranchInFlowStep,
    "no-wiring-in-flow-spec": noWiringInFlowSpec,
    "e2e-no-schema-work": e2eNoSchemaWork,
}

/** Every rule of this law ships at `error`. */
export const recommended = {
    "starci-be/e2e-uses-production-transport": "error",
    "starci-be/no-sleep-in-flow": "error",
    "starci-be/no-branch-in-flow-step": "error",
    "starci-be/no-wiring-in-flow-spec": "error",
    "starci-be/e2e-no-schema-work": "error",
}
