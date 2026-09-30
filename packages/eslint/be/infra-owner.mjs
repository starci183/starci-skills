/**
 * The rule that holds BE-CONVENTION 1.10-1.14 (R90 `BE_INFRA_OWNER`).
 *
 * Every raw infrastructure library (HTTP, cache, queue, scheduler, logger, date, config, in-process events) has exactly
 * one owning platform or integration capability, and only files of that capability may import it or reach for it as a
 * global. The table lives in the slot manifest (`ruleParams.be.infraOwners`: specifier -> owners, `[]` for "nowhere"),
 * so the rule holds no library name of its own and the messages and the check read one source.
 *
 * "Owning capability" is asked of the slot view (`ownerOf(filename)`), never of a path pattern. A reference is an
 * import (static, dynamic, `require`, `export ... from`) of the specifier or of a subpath of it, or a value reference to
 * an unresolved global (`fetch`, `setTimeout`, `globalThis.setInterval`) whose name is a key of the table. Specs are
 * included: they use the fake clock and the doubles the owning capability provides.
 *
 * The test world (slot `be.tests.world`, `src/tests/world`) is an infrastructure owner like the platform capabilities: it is
 * the TEST COMPOSITION ROOT that starts docker, polls readiness, serves the network-edge fakes over `node:http` and drives the
 * apps over HTTP with a raw client, and it has no Nest container to inject a port from. It may use every library the
 * table gives an owner; a library the table owns by nobody (`[]`, `nowhere`) is still refused there. A spec does not
 * compose: specs stay refused and reach infrastructure through `useTestWorld(...)`.
 *
 * `no-framework-logger` (R40) and `no-ambient-clock` (R79) judge Nest `Logger` and `Date`; the table holds neither.
 */
import { hfsOf } from "./lib/hfs.mjs"
import { moduleReferences } from "./lib/import-source.mjs"

/** The owner id of a file: the last two segments of its owner root (`platform/http`), or null when no owner holds it. */
const ownerIdOf = (hfs, filename) => {
    const root = hfs.ownerOf(filename)
    return root === null ? null : root.split("/").slice(-2).join("/")
}

/** The table key a module specifier falls under (the specifier itself or a subpath of it, with or without `node:`), or null. */
const keyOf = (table, specifier) => {
    const variants = [specifier, specifier.startsWith("node:") ? specifier.slice(5) : `node:${specifier}`]
    let best = null
    for (const variant of variants) {
        for (const key of Object.keys(table)) {
            if ((variant === key || variant.startsWith(`${key}/`)) && (best === null || key.length > best.length)) best = key
        }
    }
    return best
}

/** A raw infrastructure library is used only inside the capability that owns it. */
export const infraImportOwner = {
    meta: {
        type: "problem",
        docs: { description: "A raw infrastructure library (HTTP, cache, queue, scheduler, logger, date, config, events) is imported or referenced only by its owning capability." },
        schema: [],
        messages: {
            foreign: "`{{name}}` is owned by {{owners}}. Use that capability's port (injected with its `Inject*()` decorator) instead of the raw library, or move this code into the owner.",
            nowhere: "`{{name}}` is not used in a back end: its job belongs to a platform port (config through the typed `<c>.config.ts`, events through the outbox, schedules through `platform/scheduling`). Remove it.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const table = hfs.ruleParams.infraOwners
        const here = ownerIdOf(hfs, context.filename)
        const isWorld = hfs.slotOf(context.filename) === "be.tests.world"
        const check = (node, name, key) => {
            const owners = table[key]
            if (owners.includes(here) || (isWorld && owners.length > 0)) return
            if (owners.length === 0) context.report({ node, messageId: "nowhere", data: { name } })
            else context.report({ node, messageId: "foreign", data: { name, owners: owners.map((owner) => `\`${owner}\``).join(", ") } })
        }
        return {
            ...moduleReferences(({ source, value }) => {
                const key = keyOf(table, value)
                if (key !== null) check(source, value, key)
            }),
            MemberExpression(node) {
                if (node.computed || node.object.type !== "Identifier" || node.object.name !== "globalThis" || node.property.type !== "Identifier") return
                if (Object.hasOwn(table, node.property.name)) check(node, `globalThis.${node.property.name}`, node.property.name)
            },
            "Program:exit"() {
                const globalScope = context.sourceCode.scopeManager.globalScope
                if (!globalScope) return
                const references = [...globalScope.through, ...globalScope.variables.filter((variable) => variable.defs.length === 0).flatMap((variable) => variable.references)]
                for (const reference of references) {
                    if (reference.isValueReference === false) continue
                    const name = reference.identifier.name
                    if (Object.hasOwn(table, name)) check(reference.identifier, name, name)
                }
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "infra-import-owner": infraImportOwner,
}

/** Every rule of this law at `error`. */
export const recommended = {
    "starci-be/infra-import-owner": "error",
}
