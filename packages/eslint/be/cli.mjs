/**
 * The rules of the one-off actions of a back end (catalog R148 `BE_CLI_BOOTSTRAP`, R149 `BE_CLI_COMMAND_SHAPE`, R150
 * `BE_CLI_OWNER`). Every one-off action (migrate, seed, sync, backup, any operator command)
 * lives in ONE app, `be/apps/cli` (slot `be.app.cli`), built on nest-commander, and its commands live in the cli feature root
 * `src/features/cli/` (slot `be.cli`):
 *
 *   - `cli-bootstrap`: the cli app boots with `CommandFactory.run(...)` of nest-commander in its `main.ts`; it never creates an HTTP
 *     application or a microservice (`NestFactory.create*` of `@nestjs/core`, `.listen()` on what it built, an HTTP platform adapter
 *     or `@nestjs/microservices`);
 *   - `cli-command-shape`: a nest-commander command class (`@Command` or `@SubCommand`, by the import that binds the decorator) is
 *     declared only in the cli feature root: a group `@Command` in `<group>/<group>.cli.ts`, a `@SubCommand` in
 *     `<group>/subs/<name>.cli.ts`, one class per file, and a sub-command extends `CommandRunner`. Its unit spec beside it
 *     (`<name>.cli.spec.ts`) is required by `hfs check` (scripts/hfs/rules/cli.mjs);
 *   - `cli-owner`: `nest-commander` is imported only by the cli app and the cli feature root; no back-end source parses the process
 *     arguments itself (`process.argv`) or imports another argument parser (commander, yargs, minimist): an action door anywhere
 *     else is refused.
 *
 * Where a file lives is asked of the slot view; what a name IS comes from the import that binds it. No path pattern is spelled here.
 */
import { hfsOf } from "./lib/hfs.mjs"
import { decoratorCallee, importOf, isImportedFrom, moduleReferences } from "./lib/import-source.mjs"

/** The slot of the cli app and of the cli feature root. */
const CLI_APP_SLOT = "be.app.cli"
const CLI_FEATURE_SLOT = "be.cli"
const COMMANDER = "nest-commander"
/** The argument parsers no back-end source imports: nest-commander (in the cli app and feature only) parses the arguments. */
const FOREIGN_PARSERS = new Set(["commander", "yargs", "yargs/yargs", "yargs/helpers", "minimist"])
/** The entry file of an app (the slot's first requirement): where the cli app boots. */
const ENTRY = "main.ts"

const relativeIn = (hfs, file) => hfs.allows(file)?.relative ?? null
const isCliApp = (hfs, file) => hfs.slotOf(file) === CLI_APP_SLOT
const isCliFeature = (hfs, file) => hfs.slotOf(file) === CLI_FEATURE_SLOT

/** The cli app boots with CommandFactory.run and never serves HTTP or a microservice. */
export const cliBootstrap = {
    meta: {
        type: "problem",
        docs: { description: "The cli app boots with `CommandFactory.run` of nest-commander and never creates an HTTP application or a microservice." },
        schema: [],
        messages: {
            missing: "The cli app's `main.ts` never calls `CommandFactory.run(AppModule, ...)` of nest-commander. The cli app is the command line of the back end: boot it with CommandFactory.run, which parses the arguments and runs the command.",
            server: "`{{name}}` makes the cli app a server. The cli app runs one command and exits: boot it with `CommandFactory.run` of nest-commander; a server is an api app.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename
        if (!isCliApp(hfs, filename)) return {}
        const entry = relativeIn(hfs, filename) === ENTRY
        let boots = false
        return {
            ...moduleReferences(({ source, value }) => {
                if (value === "@nestjs/microservices" || value.startsWith("@nestjs/platform-")) context.report({ node: source, messageId: "server", data: { name: value } })
            }),
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
                const method = callee.property.name
                if (method === "run" && isImportedFrom(context, callee.object, COMMANDER, "CommandFactory")) boots = true
                if (isImportedFrom(context, callee.object, "@nestjs/core", "NestFactory")) context.report({ node, messageId: "server", data: { name: `NestFactory.${method}` } })
                else if (method === "listen" || method === "connectMicroservice" || method === "startAllMicroservices") context.report({ node, messageId: "server", data: { name: `.${method}()` } })
            },
            "Program:exit"(program) {
                if (entry && !boots) context.report({ node: program, messageId: "missing" })
            },
        }
    },
}

/** The nest-commander decorator a class carries (Command or SubCommand), by the import that binds it. */
const commanderDecorator = (context, klass) => {
    for (const decorator of klass.decorators ?? []) {
        const callee = decoratorCallee(decorator)
        if (callee?.type !== "Identifier") continue
        const bound = importOf(context, callee)
        if (bound?.source === COMMANDER && (bound.imported === "Command" || bound.imported === "SubCommand")) return { decorator, kind: bound.imported }
    }
    return null
}

/** Where a command of each kind is declared in the cli feature root: `<group>/<group>.cli.ts` or `<group>/subs/<name>.cli.ts`. */
const placeOf = (relative) => {
    const parts = String(relative ?? "").split("/")
    if (parts.length === 2 && parts[1] === `${parts[0]}.cli.ts`) return "Command"
    if (parts.length === 3 && parts[1] === "subs" && parts[2].endsWith(".cli.ts") && !parts[2].endsWith(".spec.ts")) return "SubCommand"
    return null
}

/** A nest-commander command is declared only where the cli feature root keeps it, one per file, a sub-command a CommandRunner. */
export const cliCommandShape = {
    meta: {
        type: "problem",
        docs: { description: "A nest-commander command is a group `@Command` in `src/features/cli/<group>/<group>.cli.ts` or a `@SubCommand` extending `CommandRunner` in `src/features/cli/<group>/subs/<name>.cli.ts`, one per file." },
        schema: [],
        messages: {
            outside: "`@{{kind}}` declares a command outside the cli feature root (this file is in slot `{{slot}}`). Every one-off action is a command of `src/features/cli/`: a group in `<group>/<group>.cli.ts`, a sub-command in `<group>/subs/<name>.cli.ts`, compiled only into apps/cli.",
            misplaced: "`@{{kind}}` sits in `{{relative}}`. A group `@Command` lives in `<group>/<group>.cli.ts` and a `@SubCommand` in `<group>/subs/<name>.cli.ts` of the cli feature root.",
            second: "This file declares a second command. One command per file: move it to its own `<name>.cli.ts`.",
            runner: "`@SubCommand` class `{{name}}` does not extend `CommandRunner` of nest-commander. A sub-command is a CommandRunner whose `run(...)` performs the action.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename
        const slot = hfs.slotOf(filename)
        const place = isCliFeature(hfs, filename) ? placeOf(relativeIn(hfs, filename)) : null
        let commands = 0
        const check = (klass) => {
            const found = commanderDecorator(context, klass)
            if (!found) return
            commands += 1
            if (!isCliFeature(hfs, filename)) return context.report({ node: found.decorator, messageId: "outside", data: { kind: found.kind, slot: slot ?? "none" } })
            if (place !== found.kind) return context.report({ node: found.decorator, messageId: "misplaced", data: { kind: found.kind, relative: relativeIn(hfs, filename) ?? filename } })
            if (commands > 1) return context.report({ node: found.decorator, messageId: "second" })
            if (found.kind === "SubCommand" && !(klass.superClass && isImportedFrom(context, klass.superClass, COMMANDER, "CommandRunner"))) context.report({ node: klass.id ?? klass, messageId: "runner", data: { name: klass.id?.name ?? "anonymous" } })
        }
        return { ClassDeclaration: check, ClassExpression: check }
    },
}

/** Whether a member expression is `process.argv` of the Node global (or `globalThis.process.argv`). */
const isProcessArgv = (context, node) => {
    if (node.computed || node.property.type !== "Identifier" || node.property.name !== "argv") return false
    const object = node.object
    const isProcess = (expression) => {
        if (expression.type !== "Identifier" || expression.name !== "process") return false
        for (let scope = context.sourceCode.getScope(expression); scope; scope = scope.upper) {
            const variable = scope.set.get("process")
            if (variable) return variable.defs.length === 0
        }
        return true
    }
    if (isProcess(object)) return true
    return object.type === "MemberExpression" && !object.computed && object.object.type === "Identifier" && object.object.name === "globalThis" && object.property.type === "Identifier" && object.property.name === "process"
}

/** nest-commander belongs to the cli app and the cli feature root; nothing else parses arguments or opens an action door. */
export const cliOwner = {
    meta: {
        type: "problem",
        docs: { description: "nest-commander is imported only by the cli app and the cli feature root; no back-end source reads `process.argv` or imports another argument parser." },
        schema: [],
        messages: {
            commander: "`nest-commander` is imported outside the cli app and the cli feature root (this file is in slot `{{slot}}`). A one-off action is a command of `src/features/cli/` run by apps/cli; no other app or source opens an action door.",
            parser: "`{{name}}` parses command-line arguments. The back end has one command line, apps/cli on nest-commander: write the action as a command of `src/features/cli/<group>/subs/<name>.cli.ts`.",
            argv: "`process.argv` is read here. No back-end process parses its own arguments: a one-off action is a command of `src/features/cli/` that apps/cli runs through nest-commander.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename
        const slot = hfs.slotOf(filename)
        const owner = isCliApp(hfs, filename) || isCliFeature(hfs, filename)
        return {
            ...moduleReferences(({ source, value }) => {
                if (value === COMMANDER || value.startsWith(`${COMMANDER}/`)) {
                    if (!owner) context.report({ node: source, messageId: "commander", data: { slot: slot ?? "none" } })
                } else if (FOREIGN_PARSERS.has(value)) context.report({ node: source, messageId: "parser", data: { name: value } })
            }),
            MemberExpression(node) {
                if (isProcessArgv(context, node)) context.report({ node, messageId: "argv" })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "cli-bootstrap": cliBootstrap,
    "cli-command-shape": cliCommandShape,
    "cli-owner": cliOwner,
}

/** Every rule is an error from the start: HFS keeps no baseline. */
export const recommended = {
    "starci-be/cli-bootstrap": "error",
    "starci-be/cli-command-shape": "error",
    "starci-be/cli-owner": "error",
}
