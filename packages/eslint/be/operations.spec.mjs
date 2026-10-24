/**
 * Twin tests for the operation table law (R95 `BE_OPERATION_CONTRACT`).
 *
 *   node --test operations.spec.mjs
 *
 * Typed cases over the fixture repository (`fixtures/typed`): the platform capability `operations` declares the canon types
 * (`OperationContract`, `query`, `mutation`, `defineOperations`, `OperationRequest`, `OperationReply`).
 */
// proves: BE_REST_ROUTE_UNDECLARED@lite
// proves: BE_REST_ROUTE_UNDECLARED@full
import assert from "node:assert/strict"
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester, typedTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { operationContractDecidable, operationRouteDrivenByTable, restRouteDeclared, recommended, rules } from "./operations.mjs"

const tester = typedTester()
const TABLE = at("src/features/api/plan/plan.operations.ts")
const CONTROLLER = at("src/features/api/plan/transport/http/plan-operations.controller.ts")
const CANON = at("src/modules/platform/operations/operation-bounds.ts")
const OPS = `import { defineOperations, mutation, query } from "@modules/platform/operations"\n`
const TYPES = `export interface PlanAsk { readonly planId: string }\nexport interface PlanView { readonly revision: number; readonly items: ReadonlyArray<{ readonly name: string }> }\n`

test("the law ships three rules, all at error", () => {
    assert.deepEqual(Object.keys(rules), ["operation-contract-decidable", "operation-route-driven-by-table", "rest-route-declared"])
    assert.deepEqual(Object.values(recommended), ["error", "error", "error"])
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

const PIPE = `import { OperationValidationService } from "@modules/platform/http-security"\nclass AskRequest { id!: string }\n`

test("operation-route-driven-by-table: a route takes OperationRequest<Table> and answers Promise<OperationReply<Table>> of one table", () => {
    tester.run("operation-route-driven-by-table", operationRouteDrivenByTable, {
        valid: [
            { filename: CONTROLLER, code: `${ROUTE_HEAD}${PIPE}@Controller("api/v1")\nexport class C { @Post("operations") async handle(@Body(new OperationValidationService(AskRequest)) request: OperationRequest<Table>): Promise<OperationReply<Table>> { return null as never } }` },
            // a route that touches no operation type is not an operation route
            { filename: CONTROLLER, code: `import { Body, Controller, Post } from "@nestjs/common"\nclass PayRequest { id!: string }\n@Controller("pay")\nexport class C { @Post() async pay(@Body() body: PayRequest): Promise<PayRequest> { return body } }` },
            // outside a transport slot nothing is judged
            { filename: TABLE, code: `${ROUTE_HEAD}export class C { @Post("operations") async handle(@Body() request: OperationRequest<Table>): Promise<{ readonly ok: boolean }> { return { ok: true } } }` },
        ],
        invalid: [
            { filename: CONTROLLER, code: `${ROUTE_HEAD}@Controller("api/v1")\nexport class C { @Post("operations") async handle(@Body() request: OperationRequest<Table>): Promise<{ readonly ok: boolean }> { return { ok: true } } }`, errors: [{ messageId: "half" }] },
            { filename: CONTROLLER, code: `${ROUTE_HEAD}class Ask { id!: string }\n@Controller("api/v1")\nexport class C { @Post("operations") async handle(@Body() request: Ask): Promise<OperationReply<Table>> { return null as never } }`, errors: [{ messageId: "half" }] },
            { filename: CONTROLLER, code: `${ROUTE_HEAD}@Controller("api/v1")\nexport class C { @Post("operations") async handle(@Body() request: OperationRequest<Table>): Promise<OperationReply<typeof OTHER>> { return null as never } }`, errors: [{ messageId: "table" }] },
            // a body no pipe validates: the alias leaves no class for the global pipe
            { filename: CONTROLLER, code: `${ROUTE_HEAD}@Controller("api/v1")\nexport class C { @Post("operations") async handle(@Body() request: OperationRequest<Table>): Promise<OperationReply<Table>> { return null as never } }`, errors: [{ messageId: "unvalidated" }] },
            // a pipe of the right name that is not the platform's proves nothing
            { filename: CONTROLLER, code: `${ROUTE_HEAD}class OperationValidationService { constructor(readonly envelope: unknown) {} }\nclass AskRequest { id!: string }\n@Controller("api/v1")\nexport class C { @Post("operations") async handle(@Body(new OperationValidationService(AskRequest)) request: OperationRequest<Table>): Promise<OperationReply<Table>> { return null as never } }`, errors: [{ messageId: "unvalidated" }] },
            // a pipe that is only mentioned, not given to the body
            { filename: CONTROLLER, code: `${ROUTE_HEAD}${PIPE}@Controller("api/v1")\nexport class C { @Post("operations") async handle(@Body(AskRequest) request: OperationRequest<Table>): Promise<OperationReply<Table>> { return null as never } }`, errors: [{ messageId: "unvalidated" }] },
        ],
    })
})

test("the message of a half-typed route names the missing side", () => {
    assert.match(operationRouteDrivenByTable.meta.messages.half, /OperationRequest<Table>/)
})

test("the message of an unvalidated body names the pipe to bind", () => {
    assert.match(operationRouteDrivenByTable.meta.messages.unvalidated, /OperationValidationService\(RequestClass\)/)
})

for (const edition of ["lite", "full"]) {
    test(`BE_REST_ROUTE_UNDECLARED: ${edition} requires actual defineOperations provenance`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", { ...BE_DECLARATION, patterns: ["webhooks"] }), edition }, TYPED_ROOT)
        const editionTester = ruleTester({ root: TYPED_ROOT, hfs })
        const head = `import { Body, Controller, Get, Post, Redirect, StreamableFile } from "@nestjs/common"\nimport { Public, PublicReason } from "@modules/domain/identity"\n`
        const contracts = `import { query } from "@modules/platform/operations"\nimport type { OperationRequest, OperationReply } from "@modules/platform/operations"\n`
        const cred = head.replace("{ Public, PublicReason }", "{ Credential, Public, PublicReason }")
        editionTester.run("rest-route-declared", restRouteDeclared, {
            valid: [
                { filename: CONTROLLER, code: `${cred}@Controller("loyalty") class C { @Credential({ kind: "api-key" }) @Post() earn() { return { ok: true } } }` },
                { filename: CONTROLLER, code: `${cred}@Credential({ kind: "run-token" }) @Controller("n8n") class C { @Post("a") a() { return 1 } @Credential({ kind: "run-token", workflow: "x" }) @Post("b") b() { return 1 } }` },
                { filename: CONTROLLER, code: `${cred}import { Credential as Door } from "@modules/domain/identity"
@Controller("tools") class C { @Door({ kind: "tool-token" }) @Post() run() { return 1 } }` },
                { filename: CONTROLLER, code: `${ROUTE_HEAD}@Controller("api/v1") class C { @Post("operations") async handle(@Body() request: OperationRequest<Table>): Promise<OperationReply<Table>> { return null as never } }` },
                { filename: CONTROLLER, code: `${head}${contracts}import { defineOperations as register } from "@modules/platform/operations"\nconst entries = { "plan.read@1": query<{ readonly id: string }, { readonly ok: boolean }>() }; const OPS = register(entries)\n@Controller("api/v1") class C { @Post("operations") async handle(@Body() request: OperationRequest<typeof OPS>): Promise<OperationReply<typeof OPS>> { return null as never } }` },
                { filename: CONTROLLER, code: `${head}@Controller("health") class C { @Public({ reason: PublicReason.Health }) @Get() live() { return { ok: true } } }` },
                { filename: CONTROLLER, code: `${head}@Controller("auth") class C { @Public({ reason: PublicReason.AuthHandshake }) @Post() auth() { return { ok: true } } }` },
                { filename: at("src/features/webhooks/payment/transport/http/payment.webhook.ts"), code: `${head}@Controller("hooks") class C { @Public({ reason: PublicReason.SignedWebhook }) @Post() hook() { return { ok: true } } }` },
                { filename: CONTROLLER, code: `${head}@Controller("files") class C { @Get() file() { return new StreamableFile(Buffer.from("")) } }` },
                { filename: CONTROLLER, code: `${head}import { createReadStream } from "node:fs"\n@Controller("files") class C { @Get() file() { return createReadStream("file.bin") } }` },
                { filename: CONTROLLER, code: `${head}@Controller("oauth") class C { @Redirect() @Get() auth() { return { url: "/" } } }` },
                { filename: CONTROLLER, code: `${head}import { UseInterceptors } from "@nestjs/common"\nimport { FileInterceptor } from "@nestjs/platform-express"\n@Controller("files") class C { @UseInterceptors(FileInterceptor("file")) @Post() upload() { return { accepted: true } } }` },
                { filename: TABLE, code: `${head}@Controller("api/v1") class C { @Get() list() { return { ok: true } } }` },
                { filename: CONTROLLER, code: `${head}class C { @Get() helper() { return { ok: true } } }` },
            ],
            invalid: [
                // unguarded route
                { filename: CONTROLLER, code: `${cred}@Controller("loyalty") class C { @Post() earn() { return { ok: true } } }`, errors: [{ messageId: "undeclared" }] },
                // a guard that is not the credential guard proves nothing
                { filename: CONTROLLER, code: `${cred}import { UseGuards } from "@nestjs/common"
class PlainGuard { canActivate() { return true } }
@Controller("loyalty") class C { @UseGuards(PlainGuard) @Post() earn() { return 1 } }`, errors: [{ messageId: "undeclared" }] },
                // a same-named local decorator is not the identity capability credential
                { filename: CONTROLLER, code: `${head}const Credential = (_o: { kind: string }): MethodDecorator => () => undefined
@Controller("loyalty") class C { @Credential({ kind: "api-key" }) @Post() earn() { return 1 } }`, errors: [{ messageId: "undeclared" }] },
                // the kind is declared as a literal, not computed
                { filename: CONTROLLER, code: `${cred}const kind = String(1)
@Controller("loyalty") class C { @Credential({ kind }) @Post() earn() { return 1 } }`, errors: [{ messageId: "undeclared" }] },
                // an anonymous route without a closed PublicReason still fails
                { filename: CONTROLLER, code: `${cred}@Controller("loyalty") class C { @Public({ reason: "ToolToken" as never }) @Get() list() { return 1 } }`, errors: [{ messageId: "undeclared" }] },
                { filename: CONTROLLER, code: `${head}@Controller("api/v1") class C { @Get("orders") list() { return { items: [] } } }`, errors: [{ messageId: "undeclared" }] },
                { filename: CONTROLLER, code: `${ROUTE_HEAD}@Controller("api/v1") class C { @Post() list(@Body() body: { id: string }) { return body } }`, errors: [{ messageId: "undeclared" }] },
                { filename: CONTROLLER, code: `${ROUTE_HEAD}@Controller("api/v1") class C { @Post() async handle(@Body() request: OperationRequest<Table>): Promise<OperationReply<typeof OTHER>> { return null as never } }`, errors: [{ messageId: "undeclared" }] },
                { filename: CONTROLLER, code: `${head}${contracts}const OPS = { "plan.read@1": query<{ readonly id: string }, { readonly ok: boolean }>() }\n@Controller("api/v1") class C { @Post() async handle(@Body() request: OperationRequest<typeof OPS>): Promise<OperationReply<typeof OPS>> { return null as never } }`, errors: [{ messageId: "undeclared" }] },
                { filename: CONTROLLER, code: `${head}${contracts}const defineOperations = <T,>(entries: T): T => entries; const OPS = defineOperations({ "plan.read@1": query<{ readonly id: string }, { readonly ok: boolean }>() })\n@Controller("api/v1") class C { @Post() async handle(@Body() request: OperationRequest<typeof OPS>): Promise<OperationReply<typeof OPS>> { return null as never } }`, errors: [{ messageId: "undeclared" }] },
                { filename: CONTROLLER, code: `${head}${contracts}import { defineOperations } from "@modules/platform/operations"\nconst OPS = defineOperations({})\n@Controller("api/v1") class C { @Post() async handle(@Body() request: OperationRequest<typeof OPS>): Promise<OperationReply<typeof OPS>> { return null as never } }`, errors: [{ messageId: "undeclared" }] },
                { filename: CONTROLLER, code: `${head}@Public({ reason: PublicReason.Health }) @Controller("api/v1") class C { @Get() list() { return { items: [] } } }`, errors: [{ messageId: "undeclared" }] },
                { filename: CONTROLLER, code: `${head}@Controller("api/v1") class C { @Get("file") file() { return new StreamableFile(Buffer.from("")) } @Get() list() { return { items: [] } } }`, errors: [{ messageId: "undeclared" }] },
            ],
        })
    })

    test(`BE_REST_ROUTE_UNDECLARED: ${edition} lets the @Sse stream of the sse slot stand without an operation table`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", { ...BE_DECLARATION, patterns: ["realtime"] }), edition }, TYPED_ROOT)
        const editionTester = ruleTester({ root: TYPED_ROOT, hfs })
        const code = `import { Controller, Sse } from "@nestjs/common"
@Controller("orders") class C { @Sse("stream") stream() { return [] as never } }`
        editionTester.run("rest-route-declared", restRouteDeclared, {
            valid: [{ filename: at("src/features/realtime/orders/transport/sse/orders.controller.ts"), code }],
            invalid: [{ filename: CONTROLLER, code, errors: [{ messageId: "undeclared" }] }],
        })
    })
}
