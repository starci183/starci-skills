/**
 * The rules that hold the fenced-job pattern (catalog R137 `BE_JOB_WRITE_OUTSIDE_OWNER`, R138 `BE_JOB_FENCE_REQUIRED`,
 * R139 `BE_JOB_RUN_KEY`, R140 `BE_JOB_SHAPE`).
 *
 * A background job is a row whose `fencingToken` the claim bumps. A worker that lost its claim (a zombie) holds a stale token, so every
 * write to the row is guarded by `expectedFencingToken` and an external effect carries an idempotency key that includes the token.
 * `platform/jobs` is the ONE owner of the row: it declares the entity, the claim and the guarded writes, and nothing else writes it.
 *
 * Everything is found by TYPE ORIGIN (the `JobClaims`, `JobStep`, `RunKey` and `FencedProcessor` declared by `platform/jobs`, the entity
 * class declared by that owner, typeorm receivers and query builders) and by the slot view (`be.jobs.steps`, `be.feature.jobs`); the
 * only names read are the contract's own members `runKey`, `jobId` and `expectedFencingToken`.
 */
import ts from "typescript"
import { walk } from "./lib/ast.mjs"
import { writtenEntityOrigins } from "./lib/entity-writes.mjs"
import { hfsOf, inTestWorld } from "./lib/hfs.mjs"
import { baseName, isOwnedType, ownerNameOf } from "./lib/ports.mjs"
import { typeOrigins, typed } from "./lib/types.mjs"

const isJobClaimsType = (context, node) => isOwnedType(context, node, { name: "JobClaims", capability: "jobs", tier: "platform" })
const isJobStepType = (context, node) => isOwnedType(context, node, { name: "JobStep", capability: "jobs", tier: "platform" })
const isFencedProcessorType = (context, node) => isOwnedType(context, node, { name: "FencedProcessor", capability: "jobs", tier: "platform" })
const isRunKeyType = (context, node) => isOwnedType(context, node, { name: "RunKey", capability: "jobs", tier: "platform" })

/** True for a file of the owner itself, and for the test composition. */
const isOwnerOrTest = (hfs, file) => {
    const tier = hfs.tierOf(file)
    if (tier === "e2e" || tier === "fixtures" || inTestWorld(hfs, file)) return true
    return tier === "platform" && ownerNameOf(hfs, file) === "jobs"
}

/** A write to an entity that `platform/jobs` declares (the job row) is made only by `platform/jobs`. */
export const jobWriteOwner = {
    meta: {
        type: "problem",
        docs: { description: "The job entity is written only by `platform/jobs`: no `update`, `increment`, `save`, `insert`, `delete` or query-builder write on it elsewhere." },
        schema: [],
        messages: {
            foreign: "`{{call}}` writes the job row outside `platform/jobs`. The fencing token and the status of a job change only through `JobClaims` (`claim`, `advance`, `complete`, `fail`), each of which requires `expectedFencingToken`; a direct write lets a zombie worker overwrite the job a newer worker owns.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        if (isOwnerOrTest(hfs, context.filename)) return {}
        return {
            CallExpression(node) {
                const origins = writtenEntityOrigins(context, node)
                if (!origins.some((origin) => hfs.tierOf(origin.file) === "platform" && ownerNameOf(hfs, origin.file) === "jobs" && hfs.slotOf(origin.file) === "be.persistence")) return
                context.report({ node, messageId: "foreign", data: { call: context.sourceCode.getText(node.callee) } })
            },
        }
    },
}

/** The names the guarded-write contract fixes: the target job and the token the writer holds. */
const TARGET = "jobId"
const TOKEN = "expectedFencingToken"
/** The property of a claimed job that holds the token it carries. */
const CARRIED = "fencingToken"

/** A property of a TypeScript type by name, or undefined. */
const propertyOf = (type, name) => type.getProperty(name)

/** True when the property is a required `number`. */
const isRequiredNumber = (checker, property, location) => {
    if (!property || (property.flags & ts.SymbolFlags.Optional) !== 0) return false
    const type = checker.getTypeOfSymbolAtLocation(property, location)
    return (type.flags & ts.TypeFlags.Number) !== 0
}

/** Calls on the `JobClaims` port, and what a guarded write is: required token, no cast to get around it, and `JobFencedOut` is not swallowed. */
export const jobFenceRequired = {
    meta: {
        type: "problem",
        docs: { description: "Every `JobClaims` method that writes an existing job declares a required `expectedFencingToken: number`, a call never casts around it, and a `catch` around a guarded write rethrows." },
        schema: [],
        messages: {
            optionalToken: "`{{method}}` takes a job (`{{target}}`) but its parameter type does not require `{{token}}: number`. Every write to an existing job is guarded by the fencing token the caller holds: declare it required (non-optional, non-nullable) in the type.",
            cast: "This argument of `{{call}}` uses a cast or a non-null assertion. The token a guarded write carries is the one the claim returned: pass it as typed, never `as`, `!` or `any` around it.",
            swallowed: "This `catch` hides a failed guarded write: a `JobFencedOut` means a newer worker owns the job and this one must stop with no further effect. Do not catch around `JobClaims` writes in a step or processor; the `FencedProcessor` base class owns the failure path. Rethrow if you must catch.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const owner = isOwnerOrTest(hfs, context.filename)
        const { checker, toTs } = typed(context)
        const claimsCall = (node) => node.type === "CallExpression" && node.callee.type === "MemberExpression" && !node.callee.computed && isJobClaimsType(context, node.callee.object)
        return {
            // The declaration side: in the owner, each member of the port that takes a job requires the token.
            TSMethodSignature(node) {
                if (!owner || hfs.tierOf(context.filename) !== "platform" || !isJobClaimsType(context, node.parent.parent?.id ?? node.parent)) return
                const first = node.params?.[0]
                if (!first) return
                const tsNode = toTs(first)
                const type = tsNode ? checker.getTypeAtLocation(tsNode) : undefined
                // A parameter that already carries the token (the claimed job itself) is a derivation, not a write.
                if (!type || !propertyOf(type, TARGET) || propertyOf(type, CARRIED)) return
                if (!isRequiredNumber(checker, propertyOf(type, TOKEN), tsNode)) {
                    context.report({ node: first, messageId: "optionalToken", data: { method: node.key?.name ?? "this method", target: TARGET, token: TOKEN } })
                }
            },
            CallExpression(node) {
                if (owner || !claimsCall(node)) return
                for (const argument of node.arguments) {
                    walk(argument, (child) => {
                        if (child.type === "TSAsExpression" || child.type === "TSTypeAssertion" || child.type === "TSNonNullExpression") context.report({ node: child, messageId: "cast", data: { call: context.sourceCode.getText(node.callee) } })
                    })
                }
            },
            TryStatement(node) {
                if (owner || !node.handler) return
                let writes = false
                walk(node.block, (child) => { if (claimsCall(child)) writes = true })
                if (!writes) return
                let rethrows = false
                walk(node.handler.body, (child) => { if (child.type === "ThrowStatement") rethrows = true })
                if (!rethrows) context.report({ node: node.handler, messageId: "swallowed" })
            },
        }
    },
}

/** The class of an external effect of a step passes the key `JobClaims.runKey` made. */
export const jobRunKey = {
    meta: {
        type: "problem",
        docs: { description: "In a job step every call on an integration port passes a `RunKey` (made by `JobClaims.runKey`, which includes the fencing token), never a cast or a literal." },
        schema: [],
        messages: {
            missing: "`{{call}}` is an external call from a job step without a `RunKey` argument. An effect that a zombie worker may repeat must be idempotent at the provider: pass `this.claims.runKey(job, \"<step>\")` (it includes the fencing token) as the idempotency key. A read belongs in the application layer, not in a step.",
            forged: "This `RunKey` is built with a cast. Only `JobClaims.runKey(job, step)` makes one, so the key always carries the fencing token of the claim.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        if (hfs.slotOf(context.filename) !== "be.jobs.steps") return {}
        return {
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed) return
                const origins = typeOrigins(context, callee.object)
                if (!origins.some((origin) => origin.module === null && hfs.tierOf(origin.file) === "integrations")) return
                const keyArguments = node.arguments.filter((argument) => isRunKeyType(context, argument))
                if (keyArguments.length === 0) {
                    context.report({ node, messageId: "missing", data: { call: context.sourceCode.getText(callee) } })
                    return
                }
                for (const argument of keyArguments) {
                    walk(argument, (child) => { if (child.type === "TSAsExpression" || child.type === "TSTypeAssertion") context.report({ node: child, messageId: "forged" }) })
                }
            },
        }
    },
}

/** A processor extends the fenced base and is named after its job; a step implements `JobStep` in `steps/`. */
export const jobShape = {
    meta: {
        type: "problem",
        docs: { description: "`<job>.processor.ts` of `features/jobs/<job>` declares a class extending `FencedProcessor`; `steps/<step>.step.ts` declares a class implementing `JobStep`; neither role exists elsewhere." },
        schema: [],
        messages: {
            processorPlacement: "`{{name}}` is in a `.processor.ts` file outside `features/jobs/<job>/`. A job processor lives only in its job folder, so the jobs kind stays one place.",
            processorStem: "The processor of job `{{job}}` is `{{job}}.processor.ts`, but this file is `{{stem}}.processor.ts`.",
            notFenced: "`{{name}}` is a job processor that does not extend `FencedProcessor` of `platform/jobs`. The base class claims the job with a bumped fencing token and settles it through the guarded writes; a processor without it has no fence.",
            stepPlacement: "`{{name}}` implements `JobStep` outside `features/jobs/<job>/steps/<step>.step.ts`.",
            notStep: "`{{name}}` is in a step file but does not implement `JobStep` of `platform/jobs`.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const file = context.filename
        const found = hfs.classify(file)
        const base = baseName(file)
        const isProcessorFile = base.endsWith(".processor.ts")
        const isStepFile = base.endsWith(".step.ts")
        const inJob = found.slot === "be.feature.jobs"
        const inSteps = found.slot === "be.jobs.steps"
        const inPlatform = hfs.tierOf(file) === "platform" && ownerNameOf(hfs, file) === "jobs"
        const check = (node) => {
            const name = node.id?.name ?? "this class"
            const extendsFenced = node.superClass ? isFencedProcessorType(context, node.superClass) : false
            const implementsStep = (node.implements ?? []).some((entry) => isJobStepType(context, entry))
            if (isProcessorFile && !inPlatform) {
                if (!inJob) context.report({ node: node.id ?? node, messageId: "processorPlacement", data: { name } })
                else {
                    const stem = base.slice(0, -".processor.ts".length)
                    if (found.bindings?.job !== undefined && found.bindings.job !== stem) context.report({ node: node.id ?? node, messageId: "processorStem", data: { job: found.bindings.job, stem } })
                    if (!extendsFenced) context.report({ node: node.id ?? node, messageId: "notFenced", data: { name } })
                }
            }
            if (isStepFile) {
                if (!inSteps) context.report({ node: node.id ?? node, messageId: "stepPlacement", data: { name } })
                else if (!implementsStep) context.report({ node: node.id ?? node, messageId: "notStep", data: { name } })
            } else if (implementsStep && !inPlatform) context.report({ node: node.id ?? node, messageId: "stepPlacement", data: { name } })
        }
        return { ClassDeclaration: check, ClassExpression: check }
    },
}

export const rules = {
    "job-write-owner": jobWriteOwner,
    "job-fence-required": jobFenceRequired,
    "job-run-key": jobRunKey,
    "job-shape": jobShape,
}

/** The level these laws ask for: `error`, switched off nowhere. */
export const recommended = {
    "starci-be/job-write-owner": "error",
    "starci-be/job-fence-required": "error",
    "starci-be/job-run-key": "error",
    "starci-be/job-shape": "error",
}
