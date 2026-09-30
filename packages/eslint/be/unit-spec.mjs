/**
 * The rules that hold the FORM of a unit spec (catalog R48 `BE_SPEC_QUALITY`, the unit-test standard of 2026-09-30).
 *
 * A unit spec is `<name>.service.spec.ts` beside `<name>.service.ts` (R47). It builds the service the way Nest builds it
 * and takes every double from the one shared kit, `@starci/jest-preset`:
 *
 *   - `spec-builds-with-testing-module`: the spec calls `Test.createTestingModule(...)` from `@nestjs/testing`, awaits
 *     `.compile()` and reads the subject with `.get(...)` on the resulting `TestingModule`.
 *   - `spec-no-new-subject`: the service under test (the class of the sibling `<name>.service.ts`) is never built with `new`.
 *   - `spec-module-definition-only-providers`: the module definition has a `providers` list and nothing else: no `imports` key
 *     and no `override*` call (`overrideProvider`, `overrideGuard`, `overrideModule`, `overrideFilter`, `overridePipe`,
 *     `overrideInterceptor`).
 *   - `spec-no-module-mock`: no `jest.mock`, `jest.doMock`, `jest.unstable_mockModule`, `jest.requireMock`, `jest.setMock`, of
 *     an own module or of a third-party library: a collaborator is provided through its injection token.
 *   - `no-return-only-generic`: no helper in a spec or in the test fixtures launders a cast into a name: a type parameter that
 *     appears only in the return type (`<T>(value: unknown): T`), an `unknown`/`any` parameter handed back as a concrete type,
 *     `JSON.parse(JSON.stringify(x))`, or `Object.assign(new X(), y)` returned as another type.
 *   - `spec-infra-double-from-kit`: a provider `{ provide: TOKEN, useValue: X }` takes X from the kit double the token calls
 *     for. The table (token pattern -> double) is `ruleParams.be.specDoubles` of the slot manifest, not this file.
 *   - `spec-exact-values`: no `expect.any(String)`, `expect.any(Number)` or `expect.any(Date)` (`expect` being the jest global
 *     or the `@jest/globals` import): ids and clocks come from the kit's deterministic doubles (`fakeIds()`, `FakeClock`), so a
 *     unit spec asserts the exact value.
 *
 * Paths are asked of the slot manifest (`lib/unit-spec.mjs`), a name is judged by the import that binds it, never by its spelling.
 */
import { hfsOf } from "./lib/hfs.mjs"
import { walk } from "./lib/ast.mjs"
import { importOf } from "./lib/import-source.mjs"
import { isPackageType, typeOrigins } from "./lib/types.mjs"
import { baseOf, isServiceSpecFile, isUnitSpecFile, serviceNameOfSpec } from "./lib/unit-spec.mjs"

const TESTING_PACKAGE = "@nestjs/testing"

/** The last call in a chain `Test.createTestingModule(...).<a>().<b>()`: the `createTestingModule` call at its root, or null. */
const testingModuleRoot = (context, node) => {
    let cursor = node
    while (cursor) {
        if (cursor.type === "CallExpression") {
            const callee = cursor.callee
            if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" && callee.property.name === "createTestingModule" && callee.object.type === "Identifier") {
                const found = importOf(context, callee.object)
                return found && found.source === TESTING_PACKAGE && found.imported === "Test" ? cursor : null
            }
            cursor = callee.type === "MemberExpression" ? callee.object : null
        } else if (cursor.type === "MemberExpression") cursor = cursor.object
        else if (cursor.type === "AwaitExpression") cursor = cursor.argument
        else return null
    }
    return null
}

/** True for `Test.createTestingModule(...)` where `Test` is the import of `@nestjs/testing`. */
const isCreateTestingModule = (context, node) => node.type === "CallExpression" && testingModuleRoot(context, node) === node

// -- spec-builds-with-testing-module ---------------------------------------------------------------------------

/** A service spec builds its subject through the Nest testing module. */
export const specBuildsWithTestingModule = {
    meta: {
        type: "problem",
        docs: { description: "A `<name>.service.spec.ts` calls `Test.createTestingModule(...)` from `@nestjs/testing`, awaits `.compile()` and reads the subject with `.get(...)`." },
        schema: [],
        messages: {
            noModule: "This service spec never calls `Test.createTestingModule(...)` from `@nestjs/testing`. Build the subject the way Nest does, so its constructor injectors are exercised: `const moduleRef = await Test.createTestingModule({ providers: [Subject, { provide: TOKEN, useValue: double }] }).compile()`.",
            noCompile: "`Test.createTestingModule(...)` is never followed by `.compile()`, so no module exists to read the subject from.",
            noGet: "The subject is never read with `moduleRef.get(Subject)` from the compiled `TestingModule`. Read it from the module, do not hold a second construction path.",
        },
    },
    create(context) {
        if (!isServiceSpecFile(hfsOf(context), context.filename || context.getFilename())) return {}
        let created = null
        let compiled = false
        let read = false
        return {
            CallExpression(node) {
                if (isCreateTestingModule(context, node)) created ??= node
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
                if (callee.property.name === "compile" && (testingModuleRoot(context, callee.object) !== null || isPackageType(context, callee.object, "TestingModuleBuilder", TESTING_PACKAGE))) compiled = true
                if (callee.property.name === "get" && isPackageType(context, callee.object, "TestingModule", TESTING_PACKAGE)) read = true
            },
            "Program:exit"(node) {
                if (created === null) context.report({ node, messageId: "noModule" })
                else if (!compiled) context.report({ node: created, messageId: "noCompile" })
                else if (!read) context.report({ node: created, messageId: "noGet" })
            },
        }
    },
}

// -- spec-no-new-subject ---------------------------------------------------------------------------------------

/** The last path segment of a module specifier, without an extension. */
const moduleStem = (specifier) => String(specifier).replace(/\\/g, "/").split("/").pop().replace(/\.[cm]?[jt]s$/, "")

/** The service under test is never constructed by hand. */
export const specNoNewSubject = {
    meta: {
        type: "problem",
        docs: { description: "A service spec never builds the service under test with `new`." },
        schema: [],
        messages: {
            construct: "`new {{name}}(...)` builds the service under test by hand, so its injectors are never exercised and a constructor change goes unnoticed. Provide it in `Test.createTestingModule({ providers: [{{name}}, ...] })` and read it with `moduleRef.get({{name}})`.",
        },
    },
    create(context) {
        const filename = context.filename || context.getFilename()
        if (!isServiceSpecFile(hfsOf(context), filename)) return {}
        const stem = `${serviceNameOfSpec(filename)}.service`
        const locals = new Set()
        const namespaces = new Set()
        return {
            ImportDeclaration(node) {
                if (moduleStem(node.source.value) !== stem) return
                for (const specifier of node.specifiers) (specifier.type === "ImportNamespaceSpecifier" ? namespaces : locals).add(specifier.local.name)
            },
            NewExpression(node) {
                const callee = node.callee
                const subject = callee.type === "Identifier" && locals.has(callee.name)
                    || callee.type === "MemberExpression" && !callee.computed && callee.object.type === "Identifier" && namespaces.has(callee.object.name)
                if (subject) context.report({ node, messageId: "construct", data: { name: context.sourceCode.getText(callee) } })
            },
        }
    },
}

// -- spec-module-definition-only-providers -----------------------------------------------------------------------

/** The `override*` members of `TestingModuleBuilder`. */
const OVERRIDES = new Set(["overrideProvider", "overrideGuard", "overrideModule", "overrideFilter", "overridePipe", "overrideInterceptor"])

/** The testing module lists providers and nothing else. */
export const specModuleDefinitionOnlyProviders = {
    meta: {
        type: "problem",
        docs: { description: "A service spec's testing module has no `imports` key and no `override*` call." },
        schema: [],
        messages: {
            imports: "`imports` pulls a real module into a unit spec, so the test runs the module's providers instead of the doubles you list. Provide exactly the service's constructor dependencies in `providers`.",
            override: "`{{method}}` swaps a provider after the module was declared. A unit spec provides its double up front: `providers: [Subject, { provide: TOKEN, useValue: double }]`.",
        },
    },
    create(context) {
        if (!isServiceSpecFile(hfsOf(context), context.filename || context.getFilename())) return {}
        return {
            CallExpression(node) {
                if (isCreateTestingModule(context, node)) {
                    const definition = node.arguments[0]
                    if (definition?.type !== "ObjectExpression") return
                    for (const property of definition.properties) {
                        const key = property.type === "Property" ? (property.key.name ?? property.key.value) : null
                        if (key === "imports") context.report({ node: property, messageId: "imports" })
                    }
                    return
                }
                const callee = node.callee
                if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" && OVERRIDES.has(callee.property.name)) {
                    context.report({ node: callee.property, messageId: "override", data: { method: callee.property.name } })
                }
            },
        }
    },
}

// -- spec-no-module-mock ---------------------------------------------------------------------------------------

/** The `jest` members that replace or fetch a module for the whole file. */
const MODULE_MOCKS = new Set(["mock", "doMock", "unstable_mockModule", "requireMock", "setMock"])

/** Whether the identifier `name` is the ambient global (or, when `source` is given, that import), not a local binding: `jest` and `expect` are the jest globals or `@jest/globals` imports. */
const isAmbientOrImported = (context, node, name, source) => {
    if (node.type !== "Identifier" || node.name !== name) return false
    const imported = importOf(context, node)
    if (imported) return source !== null && imported.source === source && imported.imported === name
    for (let scope = context.sourceCode.getScope(node); scope; scope = scope.upper) {
        const variable = scope.set.get(name)
        if (variable) return variable.defs.length === 0 || scope.type === "global" || variable.defs.every((definition) => definition.node?.parent?.declare === true)
    }
    return true
}

/** A unit spec replaces no module, its own or a library's. */
export const specNoModuleMock = {
    meta: {
        type: "problem",
        docs: { description: "A unit spec never calls `jest.mock`, `jest.doMock`, `jest.unstable_mockModule` or `jest.requireMock`." },
        schema: [],
        messages: {
            moduleMock: "`jest.{{method}}(...)` replaces a whole module, so the subject runs against a stand-in the production wiring never has. Provide a collaborator through its injection token (`{ provide: TOKEN, useValue: mock<Port>() }`); a third-party library is reached through the wrapper that owns it, and the wrapper is the double.",
        },
    },
    create(context) {
        if (!isUnitSpecFile(hfsOf(context), context.filename || context.getFilename())) return {}
        return {
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier" || !MODULE_MOCKS.has(callee.property.name)) return
                if (isAmbientOrImported(context, callee.object, "jest", "@jest/globals")) context.report({ node, messageId: "moduleMock", data: { method: callee.property.name } })
            },
        }
    },
}

// -- no-return-only-generic --------------------------------------------------------------------------------------

/** Names a type reference or type query spells, anywhere below a type node. */
const typeNamesIn = (node) => {
    const names = new Set()
    walk(node, (child) => {
        if (child.type === "TSTypeReference" && child.typeName.type === "Identifier") names.add(child.typeName.name)
    })
    return names
}

/** The expressions a function returns (its expression body, or each `return` of its own body). */
const returnedExpressions = (fn) => {
    if (!fn.body) return []
    if (fn.body.type !== "BlockStatement") return [fn.body]
    const found = []
    walk(fn.body, (node) => {
        if (node.type === "ReturnStatement" && node.argument) found.push(node.argument)
    }, { intoFunctions: false })
    return found
}

/** The expression under any chain of assertions, parentheses and awaits. */
const peel = (expression) => {
    let node = expression
    while (node && (node.type === "TSAsExpression" || node.type === "TSTypeAssertion" || node.type === "TSNonNullExpression" || node.type === "TSSatisfiesExpression" || node.type === "AwaitExpression")) node = node.expression ?? node.argument
    return node
}

/** Whether a call is `Object.assign(new X(), ...)`; gives X's name. */
const assignedClassOf = (node) => {
    if (node?.type !== "CallExpression") return null
    const callee = node.callee
    if (callee.type !== "MemberExpression" || callee.computed || callee.object.type !== "Identifier" || callee.object.name !== "Object" || callee.property.name !== "assign") return null
    const target = node.arguments[0]
    return target?.type === "NewExpression" && target.callee.type === "Identifier" ? target.callee.name : null
}

/** A helper of a spec or of the fixtures is not a cast with a name. */
export const noReturnOnlyGeneric = {
    meta: {
        type: "problem",
        docs: { description: "A spec or a test fixture has no return-only generic, no `unknown`/`any` handed back as a concrete type, no `JSON.parse(JSON.stringify(x))` and no `Object.assign(new X(), y)` returned as another type." },
        schema: [],
        messages: {
            returnOnly: "`{{name}}` declares the type parameter `{{param}}` only in its return type, so the caller picks any type and nothing checks it: `<T>(value: unknown): T` is a cast with a name. Build the double with `mock<T>()`, `mockEntityManager()` or a `builder<T>(defaults)` from `@starci/jest-preset`, which fail to compile when the shape changes.",
            launder: "`{{name}}` takes `{{kind}}` and hands it back as another type: a cast with a name. It keeps compiling when the dependency's shape changes and the double stops matching. Use a typed double from `@starci/jest-preset`.",
            json: "`JSON.parse(JSON.stringify(...))` returns `any`, so it launders whatever type the receiver declares. Build the value with its own type, or clone with `structuredClone`.",
            assign: "`Object.assign(new {{klass}}(), ...)` is returned as `{{returned}}`: an object of one class typed as another. Return the class it builds, or build the other type with its own builder.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        if (!/\.(?:e2e-|integration-|contract-)?spec\.[cm]?ts$/.test(baseOf(filename)) && hfs.slotOf(filename) !== "be.tests.fixtures") return {}
        const nameOf = (fn) => fn.id?.name ?? (fn.parent?.type === "VariableDeclarator" && fn.parent.id.type === "Identifier" ? fn.parent.id.name : fn.parent?.type === "Property" || fn.parent?.type === "MethodDefinition" ? (fn.parent.key.name ?? fn.parent.key.value) : "this function")
        const check = (fn) => {
            const name = nameOf(fn)
            const declared = fn.typeParameters?.params ?? []
            let generic = false
            const returned = fn.returnType?.typeAnnotation
            if (declared.length > 0 && returned) {
                const inReturn = typeNamesIn(returned)
                const inParams = new Set()
                for (const param of fn.params) for (const spelled of typeNamesIn(param.typeAnnotation ?? param.left?.typeAnnotation)) inParams.add(spelled)
                for (const param of declared) {
                    const spelled = param.name.name
                    // a parameter that another parameter's constraint or default mentions is still driven by the caller's arguments
                    const inBounds = declared.some((other) => other !== param && (typeNamesIn(other.constraint).has(spelled) || typeNamesIn(other.default).has(spelled)))
                    if (inReturn.has(spelled) && !inParams.has(spelled) && !inBounds) {
                        generic = true
                        context.report({ node: param, messageId: "returnOnly", data: { name, param: spelled } })
                    }
                }
            }
            if (fn.body === null || fn.body === undefined) return
            const loose = new Map()
            for (const param of fn.params) {
                const target = param.type === "AssignmentPattern" ? param.left : param
                const kind = target.type === "Identifier" ? target.typeAnnotation?.typeAnnotation?.type : undefined
                if (kind === "TSUnknownKeyword" || kind === "TSAnyKeyword") loose.set(target.name, kind === "TSAnyKeyword" ? "any" : "unknown")
            }
            const concrete = returned !== undefined && returned.type !== "TSUnknownKeyword" && returned.type !== "TSAnyKeyword"
            for (const expression of returnedExpressions(fn)) {
                const value = peel(expression)
                if (!generic && value.type === "Identifier" && loose.has(value.name) && (concrete || value !== expression)) {
                    context.report({ node: expression, messageId: "launder", data: { name, kind: loose.get(value.name) } })
                    return
                }
                const klass = assignedClassOf(value)
                if (klass !== null && returned?.type === "TSTypeReference" && returned.typeName.type === "Identifier" && returned.typeName.name !== klass) {
                    context.report({ node: expression, messageId: "assign", data: { klass, returned: returned.typeName.name } })
                }
            }
        }
        return {
            FunctionDeclaration: check,
            FunctionExpression: check,
            ArrowFunctionExpression: check,
            TSDeclareFunction: check,
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.object.type !== "Identifier" || callee.object.name !== "JSON" || callee.property.name !== "parse") return
                const argument = node.arguments[0]
                if (argument?.type === "CallExpression" && argument.callee.type === "MemberExpression" && argument.callee.object.type === "Identifier" && argument.callee.object.name === "JSON" && argument.callee.property.name === "stringify") {
                    context.report({ node, messageId: "json" })
                }
            },
        }
    },
}

// -- spec-infra-double-from-kit --------------------------------------------------------------------------------

/** `EntityManager` -> `ENTITY_MANAGER`, `redis-cache` -> `REDIS_CACHE`. */
const screamingSnake = (name) => String(name).replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").toUpperCase().replace(/[^A-Z0-9]+/g, "_")

/** The name a provider token spells: an identifier, the last member of `Tokens.CLOCK`, a string, a called token factory's name. */
const tokenName = (node) => {
    if (!node) return null
    if (node.type === "Identifier") return node.name
    if (node.type === "Literal" && typeof node.value === "string") return node.value
    if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") return node.property.name
    if (node.type === "CallExpression") return tokenName(node.callee)
    return null
}

/** The compiled table of a manifest's `specDoubles`, cached per manifest object. */
const COMPILED = new WeakMap()
const tableOf = (specDoubles) => {
    let compiled = COMPILED.get(specDoubles)
    if (!compiled) {
        compiled = { kit: specDoubles.kit, entries: specDoubles.doubles.map((entry) => ({ ...entry, pattern: new RegExp(entry.token) })), fallback: specDoubles.fallback }
        COMPILED.set(specDoubles, compiled)
    }
    return compiled
}

/** A value's form and the double it names: `{ form, name }`, or null when it is not a form the table knows. */
const formOf = (context, node, depth = 0) => {
    const value = peel(node)
    switch (value.type) {
        case "CallExpression":
            if (value.callee.type === "Identifier") return { form: "call", name: value.callee.name, node: value.callee }
            if (value.callee.type === "CallExpression" && value.callee.callee.type === "Identifier") return { form: "curried", name: value.callee.callee.name, node: value.callee.callee }
            return null
        case "NewExpression":
            return value.callee.type === "Identifier" ? { form: "new", name: value.callee.name, node: value.callee } : null
        case "ObjectExpression":
            return { form: "object" }
        case "ArrayExpression":
            return { form: "array" }
        case "Literal":
            return { form: "primitive" }
        case "TemplateLiteral":
            return value.expressions.length === 0 ? { form: "primitive" } : null
        case "Identifier": {
            if (depth >= 3) return null
            for (let scope = context.sourceCode.getScope(value); scope; scope = scope.upper) {
                const variable = scope.set.get(value.name)
                if (!variable) continue
                const definition = variable.defs[0]
                if (definition?.type === "Variable" && definition.node.id.type === "Identifier" && definition.node.init && definition.parent.kind === "const") return formOf(context, definition.node.init, depth + 1)
                return null
            }
            return null
        }
        default:
            return null
    }
}

/** The kit type each double produces, by declared name: what a parameter or a property typed so is a double of. */
const KIT_TYPES = Object.freeze({ MockEntityManager: "mockEntityManager", FakeCache: "fakeCache", FakeLock: "fakeLock", RecordingOutbox: "recordingOutbox", FakeClock: "FakeClock", FakeIds: "fakeIds", FakeTransaction: "fakeTransaction" })

/** The kit double a value's TYPE says it is (a helper parameter typed `MockEntityManager`, `tx.em` of a `fakeTransaction`), or null. */
const kitDoubleOfType = (context, node, kit) => {
    const found = typeOrigins(context, node).find((origin) => Object.hasOwn(KIT_TYPES, origin.name) && origin.module === kit)
    return found ? KIT_TYPES[found.name] : null
}

/** The double a token's provider value must come from. */
export const specInfraDoubleFromKit = {
    meta: {
        type: "problem",
        docs: { description: "In a service spec a provider `{ provide: TOKEN, useValue: X }` takes X from the `@starci/jest-preset` double the token calls for (`ruleParams.be.specDoubles`)." },
        schema: [],
        messages: {
            wrong: "`{{token}}` is provided with {{got}}, but a token of this kind takes {{want}} from `{{kit}}`. The kit double is behavioural (or, for `mock`, typed against the port), a hand-built value drifts from the thing it stands for.",
            notKit: "`{{name}}` is not imported from `{{kit}}`. A double for `{{token}}` is {{want}} of the kit, never a local helper or a lookalike of the same name.",
            unknown: "The value provided for `{{token}}` cannot be traced to a kit double. Bind it to a `const` initialised with {{want}} from `{{kit}}` (or write the call in place).",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        if (!isServiceSpecFile(hfs, context.filename || context.getFilename())) return {}
        const table = tableOf(hfs.ruleParams.specDoubles)
        const describe = (entry) => {
            const forms = entry.forms.map((form) => ({ call: `\`${entry.double}(...)\``, new: `\`new ${entry.double}(...)\``, curried: `\`${entry.double}(...)(...)\``, object: "a plain object literal of real values", primitive: "a real value", array: "an array" })[form])
            return forms.join(" or ")
        }
        return {
            Property(node) {
                if (node.parent.type !== "ObjectExpression" || (node.key.name ?? node.key.value) !== "useValue") return
                const provide = node.parent.properties.find((property) => property.type === "Property" && (property.key.name ?? property.key.value) === "provide")
                const spelled = tokenName(provide?.value)
                if (spelled === null) return
                const normalised = screamingSnake(spelled)
                const entry = table.entries.find((candidate) => candidate.pattern.test(normalised)) ?? table.fallback
                const found = formOf(context, node.value)
                const want = describe(entry)
                const data = { token: spelled, want, kit: table.kit }
                if (found === null) {
                    // not a call, a literal or a traceable const: the declared type of the value decides (a helper parameter, `tx.em`)
                    const typedAs = kitDoubleOfType(context, node.value, table.kit)
                    if (typedAs === null) return context.report({ node: node.value, messageId: "unknown", data })
                    if (typedAs !== entry.double) return context.report({ node: node.value, messageId: "wrong", data: { ...data, got: `a \`${typedAs}\` double` } })
                    return undefined
                }
                if (!entry.forms.includes(found.form)) {
                    const got = found.name ? `\`${found.form === "new" ? "new " : ""}${found.name}(...)\`` : `a ${found.form} value`
                    return context.report({ node: node.value, messageId: "wrong", data: { ...data, got } })
                }
                if (found.name === undefined) return undefined
                const imported = importOf(context, found.node)
                if (found.name !== entry.double) return context.report({ node: node.value, messageId: "wrong", data: { ...data, got: `\`${found.form === "new" ? "new " : ""}${found.name}(...)\`` } })
                if (!imported || !(imported.source === table.kit || imported.source.startsWith(`${table.kit}/`)) || imported.imported !== entry.double) return context.report({ node: node.value, messageId: "notKit", data: { ...data, name: found.name } })
                return undefined
            },
        }
    },
}

// -- spec-exact-values -----------------------------------------------------------------------------------------

/** The global constructors whose `expect.any(...)` accepts every value of a kind, so asserts nothing exact. */
const LOOSE_KINDS = new Set(["String", "Number", "Date"])

/** A unit spec asserts the exact id and the exact date, never "some string" or "some date". */
export const specExactValues = {
    meta: {
        type: "problem",
        docs: { description: "A service spec never asserts `expect.any(String)`, `expect.any(Number)` or `expect.any(Date)`: ids and clocks come from `fakeIds()` and `FakeClock`, so the exact value is asserted." },
        schema: [],
        messages: {
            loose: "`expect.any({{kind}})` accepts every {{what}}, so the assertion proves nothing about the value the service generated. The service takes its ids and its clock from tokens and the spec provides the kit's deterministic doubles: `{ provide: ID_GENERATOR, useValue: fakeIds() }` and `{ provide: CLOCK, useValue: new FakeClock(...) }` from `@starci/jest-preset`. Assert the exact value ({{exact}}).",
        },
    },
    create(context) {
        if (!isServiceSpecFile(hfsOf(context), context.filename || context.getFilename())) return {}
        return {
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier" || callee.property.name !== "any") return
                if (!isAmbientOrImported(context, callee.object, "expect", "@jest/globals")) return
                const kind = node.arguments[0]
                if (kind?.type !== "Identifier" || !LOOSE_KINDS.has(kind.name) || !isAmbientOrImported(context, kind, kind.name, null)) return
                const what = { String: "string", Number: "number", Date: "date" }[kind.name]
                const exact = kind.name === "Date" ? "the clock's date, for example `clock.now()` of the `FakeClock` the spec provides" : "the id the `fakeIds()` double hands out"
                context.report({ node, messageId: "loose", data: { kind: kind.name, what, exact } })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "spec-builds-with-testing-module": specBuildsWithTestingModule,
    "spec-no-new-subject": specNoNewSubject,
    "spec-module-definition-only-providers": specModuleDefinitionOnlyProviders,
    "spec-no-module-mock": specNoModuleMock,
    "no-return-only-generic": noReturnOnlyGeneric,
    "spec-infra-double-from-kit": specInfraDoubleFromKit,
    "spec-exact-values": specExactValues,
}

/** Every rule of this law ships at `error`. */
export const recommended = {
    "starci-be/spec-builds-with-testing-module": "error",
    "starci-be/spec-no-new-subject": "error",
    "starci-be/spec-module-definition-only-providers": "error",
    "starci-be/spec-no-module-mock": "error",
    "starci-be/no-return-only-generic": "error",
    "starci-be/spec-infra-double-from-kit": "error",
    "starci-be/spec-exact-values": "error",
}
