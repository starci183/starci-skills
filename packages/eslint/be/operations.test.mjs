/**
 * Twin tests for the operation table law (R95 `BE_OPERATION_CONTRACT`).
 *
 *   node --test operations.test.mjs
 *
 * Typed cases over the fixture repository (`fixtures/typed`): the platform capability `operations` declares the canon types
 * (`OperationContract`, `query`, `mutation`, `defineOperations`, `OperationRequest`, `OperationReply`).
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { operationContractDecidable, operationRouteDrivenByTable, recommended, rules } from "./operations.mjs"

const tester = typedTester()
const TABLE = at("src/features/plan/plan.operations.ts")
const CONTROLLER = at("src/features/plan/transport/http/plan-operations.controller.ts")
const CANON = at("src/modules/platform/operations/operation-bounds.ts")
const OPS = `import { defineOperations, mutation, query } from "@modules/platform/operations"\n`
const TYPES = `export interface PlanAsk { readonly planId: string }\nexport interface PlanView { readonly revision: number; readonly items: ReadonlyArray<{ readonly name: string }> }\n`

test("the law ships two rules, both at error", () => {
    assert.deepEqual(Object.keys(rules), ["operation-contract-decidable", "operation-route-driven-by-table"])
    assert.deepEqual(Object.values(recommended), ["error", "error"])
})

test("operation-contract-decidable: an operation names closed input, output and refusal types", () => {
    tester.run("operation-contract-decidable", operationContractDecidable, {
        valid: [
            { filename: TABLE, code: `${OPS}${TYPES}export const OPERATIONS = defineOperations({ "plan.read@1": query<PlanAsk, PlanView, "DENIED" | "INVALID">(), "plan.close@1": mutation<PlanAsk, PlanView>() })` },
            // a recursive named type and an optional member are closed
            { filename: TABLE, code: `${OPS}export interface Node { readonly name: string; readonly next?: Node }\nexport const OPERATIONS = defineOperations({ "plan.walk@1": query<{ readonly id: string }, Node>() })` },
            // the canon capability declares the contract itself, with unknown and string as its bounds
            { filename: CANON, code: `export interface OperationContract<Input, Output, RefusalCode extends string> { readonly types?: { readonly input: Input; readonly output: Output; readonly refusal: RefusalCode } }\nexport type Table = Readonly<Record<string, OperationContract<unknown, unknown, string>>>` },
            // a record of a closed type is closed
            { filename: TABLE, code: `${OPS}export const OPERATIONS = defineOperations({ "plan.tags@1": query<{ readonly id: string }, { readonly tags: Readonly<Record<string, string>> }>() })` },
        ],
        invalid: [
            { filename: TABLE, code: `${OPS}export const OPERATIONS = defineOperations({ "plan.read@1": query<{ readonly body: unknown }, { readonly ok: boolean }>() })`, errors: [{ messageId: "type", data: { label: "input", why: "body: unknown" } }] },
            { filename: TABLE, code: `${OPS}export const OPERATIONS = defineOperations({ "plan.read@1": query<{ readonly id: string }, Record<string, unknown>>() })`, errors: [{ messageId: "type", data: { label: "output", why: "a record of unknown" } }] },
            { filename: TABLE, code: `${OPS}export const OPERATIONS = defineOperations({ "plan.read@1": query<{ readonly id: string }, { readonly data: any }>() })`, errors: [{ messageId: "type", data: { label: "output", why: "data: any" } }] },
            { filename: TABLE, code: `${OPS}export const OPERATIONS = defineOperations({ "plan.read@1": query<{ readonly at: Date }, { readonly ok: boolean }>() })`, errors: [{ messageId: "type", data: { label: "input", why: "at: Date, which is not a JSON value" } }] },
            { filename: TABLE, code: `${OPS}export const OPERATIONS = defineOperations({ "plan.read@1": query<{ readonly id: string }, { readonly ok: boolean }, string>() })`, errors: [{ messageId: "refusal", data: { found: "string" } }] },
            // written as an annotation
            { filename: TABLE, code: `import type { OperationContract } from "@modules/platform/operations"\nexport const CONTRACT: OperationContract<unknown, { readonly ok: boolean }, "DENIED"> = { kind: "query" }`, errors: [{ messageId: "type", data: { label: "input", why: "unknown" } }] },
        ],
    })
})

const ROUTE_HEAD = `import { Body, Controller, Post } from "@nestjs/common"\nimport { defineOperations, query } from "@modules/platform/operations"\nimport type { OperationReply, OperationRequest } from "@modules/platform/operations"\nexport const OPERATIONS = defineOperations({ "plan.read@1": query<{ readonly id: string }, { readonly ok: boolean }>() })\nexport const OTHER = defineOperations({ "plan.other@1": query<{ readonly id: string }, { readonly ok: boolean }>() })\nexport type Table = typeof OPERATIONS\n`

test("operation-route-driven-by-table: a route takes OperationRequest<Table> and answers Promise<OperationReply<Table>> of one table", () => {
    tester.run("operation-route-driven-by-table", operationRouteDrivenByTable, {
        valid: [
            { filename: CONTROLLER, code: `${ROUTE_HEAD}@Controller("api/v1")\nexport class C { @Post("operations") async handle(@Body() request: OperationRequest<Table>): Promise<OperationReply<Table>> { return null as never } }` },
            // a route that touches no operation type is not an operation route
            { filename: CONTROLLER, code: `import { Body, Controller, Post } from "@nestjs/common"\nclass PayRequest { id!: string }\n@Controller("pay")\nexport class C { @Post() async pay(@Body() body: PayRequest): Promise<PayRequest> { return body } }` },
            // outside a transport slot nothing is judged
            { filename: TABLE, code: `${ROUTE_HEAD}export class C { @Post("operations") async handle(@Body() request: OperationRequest<Table>): Promise<{ readonly ok: boolean }> { return { ok: true } } }` },
        ],
        invalid: [
            { filename: CONTROLLER, code: `${ROUTE_HEAD}@Controller("api/v1")\nexport class C { @Post("operations") async handle(@Body() request: OperationRequest<Table>): Promise<{ readonly ok: boolean }> { return { ok: true } } }`, errors: [{ messageId: "half" }] },
            { filename: CONTROLLER, code: `${ROUTE_HEAD}class Ask { id!: string }\n@Controller("api/v1")\nexport class C { @Post("operations") async handle(@Body() request: Ask): Promise<OperationReply<Table>> { return null as never } }`, errors: [{ messageId: "half" }] },
            { filename: CONTROLLER, code: `${ROUTE_HEAD}@Controller("api/v1")\nexport class C { @Post("operations") async handle(@Body() request: OperationRequest<Table>): Promise<OperationReply<typeof OTHER>> { return null as never } }`, errors: [{ messageId: "table" }] },
        ],
    })
})

test("the message of a half-typed route names the missing side", () => {
    assert.match(operationRouteDrivenByTable.meta.messages.half, /OperationRequest<Table>/)
})
