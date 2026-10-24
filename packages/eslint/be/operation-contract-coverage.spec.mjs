/** Edition proofs for the typed operation table and its HTTP route (R95). */
// proves: BE_OPERATION_CONTRACT@lite
// proves: BE_OPERATION_CONTRACT@full
import assert from "node:assert/strict"
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { operationContractDecidable, operationRouteDrivenByTable } from "./operations.mjs"

const TABLE = at("src/features/api/plan/plan.operations.ts")
const CONTROLLER = at("src/features/api/plan/transport/http/plan-operations.controller.ts")
const OPERATIONS = 'import { defineOperations, query } from "@modules/platform/operations";\n'
const ROUTE = `import { Body, Controller, Post } from "@nestjs/common"
import type { OperationReply, OperationRequest } from "@modules/platform/operations"
${OPERATIONS}
export const OPERATIONS = defineOperations({ "plan.read@1": query<{ readonly id: string }, { readonly ok: boolean }>() })
export const OTHER = defineOperations({ "plan.other@1": query<{ readonly id: string }, { readonly ok: boolean }>() })
export type Table = typeof OPERATIONS
`

for (const edition of ["lite", "full"]) {
    test(`R95 accepts closed contracts and rejects undecidable contracts in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("operation-contract-decidable", operationContractDecidable, {
            valid: [
                { filename: TABLE, code: `${OPERATIONS}export const OPERATIONS = defineOperations({ "plan.read@1": query<{ readonly id: string }, { readonly ok: boolean }, "DENIED" | "INVALID">() })` },
            ],
            invalid: [
                { filename: TABLE, code: `${OPERATIONS}export const OPERATIONS = defineOperations({ "plan.read@1": query<{ readonly body: unknown }, { readonly ok: boolean }>() })`, errors: [{ messageId: "type", data: { label: "input", why: "body: unknown" } }] },
                { filename: TABLE, code: `${OPERATIONS}export const OPERATIONS = defineOperations({ "plan.read@1": query<{ readonly id: string }, Record<string, unknown>>() })`, errors: [{ messageId: "type", data: { label: "output", why: "a record of unknown" } }] },
                { filename: TABLE, code: `${OPERATIONS}export const OPERATIONS = defineOperations({ "plan.read@1": query<{ readonly id: string }, { readonly ok: boolean }, string>() })`, errors: [{ messageId: "refusal", data: { found: "string" } }] },
            ],
        })
    })

    test(`R95 accepts one route table and rejects half-typed or mismatched routes in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("operation-route-driven-by-table", operationRouteDrivenByTable, {
            valid: [
                { filename: CONTROLLER, code: `${ROUTE}import { OperationValidationService } from "@modules/platform/http-security"\nclass AskRequest { id!: string }\n@Controller("api/v1") export class C { @Post("operations") async handle(@Body(new OperationValidationService(AskRequest)) request: OperationRequest<Table>): Promise<OperationReply<Table>> { return null as never } }` },
            ],
            invalid: [
                { filename: CONTROLLER, code: `${ROUTE}@Controller("api/v1") export class C { @Post("operations") async handle(@Body() request: OperationRequest<Table>): Promise<{ readonly ok: boolean }> { return { ok: true } } }`, errors: [{ messageId: "half" }] },
                { filename: CONTROLLER, code: `${ROUTE}@Controller("api/v1") export class C { @Post("operations") async handle(@Body() request: OperationRequest<Table>): Promise<OperationReply<typeof OTHER>> { return null as never } }`, errors: [{ messageId: "table" }] },
                { filename: CONTROLLER, code: `${ROUTE}@Controller("api/v1") export class C { @Post("operations") async handle(@Body() request: OperationRequest<Table>): Promise<OperationReply<Table>> { return null as never } }`, errors: [{ messageId: "unvalidated" }] },
            ],
        })
    })
}
