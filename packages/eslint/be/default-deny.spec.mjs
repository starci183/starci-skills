// proves: BE_PUBLIC_REASON_CLOSED@lite BE_PUBLIC_REASON_CLOSED@full
import assert from "node:assert/strict"
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { noUntypedBody, publicNeedsReason, publicReasonClosed, recommended, rules } from "./default-deny.mjs"

const tester = typedTester()
const CONTROLLER = at("src/features/api/plan/transport/http/create-plan.controller.ts")
const RESOLVER = at("src/features/api/plan/transport/graphql/create-plan.resolver.ts")

test("a body or argument is typed, never unknown, any or GraphQLJSON", () => {
    tester.run("no-untyped-body", noUntypedBody, {
        valid: [
            { filename: CONTROLLER, code: "class C { create(@Body() body: CreatePlanRequest) {} }" },
            { filename: CONTROLLER, code: "class C { create(@Body('id') id: string) {} }" },
            { filename: RESOLVER, code: "class R { create(@Args('input') input: CreatePlanInput) {} }" },
            { filename: CONTROLLER, code: "class C { create(@Query() query: unknown) {} }" },
            { filename: RESOLVER, code: "import GraphQLJSON from 'graphql-type-json'\nconst x = 1" },
            { filename: CONTROLLER, code: "class C { create(@Body() body: Record<string, string>) {} }" },
            { filename: CONTROLLER, code: "switch (input.kind) { case 'a': break }" },
            { filename: at("src/modules/domain/plan/plan.service.ts"), code: "switch (input.operation) { case 'a': break }" },
        ],
        invalid: [
            { filename: CONTROLLER, code: "class C { create(@Body() body: unknown) {} }", errors: [{ messageId: "untyped" }] },
            { filename: CONTROLLER, code: "class C { create(@Body() body: any) {} }", errors: [{ messageId: "untyped" }] },
            { filename: CONTROLLER, code: "class C { create(@Body() body) {} }", errors: [{ messageId: "untyped" }] },
            { filename: CONTROLLER, code: "class C { create(@Body() body: object) {} }", errors: [{ messageId: "untyped" }] },
            { filename: CONTROLLER, code: "class C { create(@Body() body: Record<string, unknown>) {} }", errors: [{ messageId: "untyped" }] },
            { filename: CONTROLLER, code: "class C { create(@Body() body: {}) {} }", errors: [{ messageId: "untyped" }] },
            { filename: RESOLVER, code: "class R { create(@Args() args: unknown) {} }", errors: [{ messageId: "untyped" }] },
            { filename: RESOLVER, code: "import { GraphQLJSON } from 'graphql-scalars'\nclass R { create(@Args('x', { type: () => GraphQLJSON }) x: Json) {} }", errors: [{ messageId: "json" }] },
            { filename: RESOLVER, code: "switch (input.operation) { case 'a': break }", errors: [{ messageId: "operationSwitch" }] },
        ],
    })
})

const REASON = 'import { PublicReason } from "@modules/domain/identity"\n'

test("an open door states why it is open, with a PublicReason member of domain/identity", () => {
    tester.run("public-needs-reason", publicNeedsReason, {
        valid: [
            { filename: CONTROLLER, code: `${REASON}class C { @Public({ reason: PublicReason.Health }) hook() {} }` },
            { filename: CONTROLLER, code: `${REASON}class C { @Public({ reason: PublicReason.AuthHandshake }) hook() {} }` },
            { filename: CONTROLLER, code: "class C { @Roles('admin') list() {} }" },
        ],
        invalid: [
            { filename: CONTROLLER, code: "class C { @Public() hook() {} }", errors: [{ messageId: "reason" }] },
            { filename: CONTROLLER, code: "class C { @Public hook() {} }", errors: [{ messageId: "reason" }] },
            { filename: CONTROLLER, code: "class C { @Public({}) hook() {} }", errors: [{ messageId: "reason" }] },
            // a string, whatever it says, is not a PublicReason
            { filename: CONTROLLER, code: "class C { @Public({ reason: 'signed webhook' }) hook() {} }", errors: [{ messageId: "reason" }] },
            { filename: CONTROLLER, code: "class C { @Public({ reason: '' }) hook() {} }", errors: [{ messageId: "reason" }] },
            { filename: CONTROLLER, code: "class C { @Public({ reason }) hook() {} }", errors: [{ messageId: "reason" }] },
            // another enum with the same member name is not the identity enum
            { filename: CONTROLLER, code: "enum PublicReason { Health = 'h' }\nclass C { @Public({ reason: PublicReason.Health }) hook() {} }", errors: [{ messageId: "reason" }] },
            { filename: CONTROLLER, code: "enum Other { Health = 'h' }\nclass C { @Public({ reason: Other.Health }) hook() {} }", errors: [{ messageId: "reason" }] },
            // a spec is not exempt
            { filename: at("src/features/api/plan/transport/http/create-plan.controller.spec.ts"), code: "class C { @Public() hook() {} }", errors: [{ messageId: "reason" }] },
        ],
    })
})

const IDENTITY = at("src/modules/domain/identity/public-reason.ts")
const CLOSED_ENUM = "export enum PublicReason { Health = 'health', AuthHandshake = 'auth-handshake', SignedWebhook = 'signed-webhook', CatalogRead = 'catalog-read' }\n"
const EXTENDED_ENUM = "export enum PublicReason { Health = 'health', AuthHandshake = 'auth-handshake', SignedWebhook = 'signed-webhook', CatalogRead = 'catalog-read', ToolToken = 'tool-token' }\n"
const closedError = { messageId: "closed" }

test("R290 BE_PUBLIC_REASON_CLOSED publishes its own rule at error", () => {
    assert.equal(rules["public-reason-closed"], publicReasonClosed)
    assert.equal(recommended["starci-be/public-reason-closed"], "error")
})

for (const edition of ["lite", "full"]) {
    test(`R290 BE_PUBLIC_REASON_CLOSED keeps the public vocabulary closed in ${edition}`, () => {
        const declaration = { ...appDeclaration("be", { apps: [{ name: "api", kind: "api" }] }), edition }
        const settings = { starci: { hfs: hfsFromDeclaration(declaration, at("")) } }
        typedTester().run("public-reason-closed", publicReasonClosed, {
            valid: [
                { filename: IDENTITY, settings, code: CLOSED_ENUM },
                { filename: IDENTITY, settings, code: "enum PublicReason { Health = 'health', AuthHandshake = 'auth-handshake' }; enum PublicReason { SignedWebhook = 'signed-webhook', CatalogRead = 'catalog-read' }" },
                ...["Health", "AuthHandshake", "SignedWebhook", "CatalogRead"].map((name) => ({
                    filename: IDENTITY, settings, code: `${CLOSED_ENUM}class C { @Public({ reason: PublicReason.${name} }) route() {} }`,
                })),
                { filename: CONTROLLER, settings, code: `${REASON}class C { @Public({ reason: PublicReason['Health'] }) route() {} }` },
                { filename: CONTROLLER, settings, code: 'import { PublicReason as Reason } from "@modules/domain/identity"\nconst reason = Reason.Health; class C { @Public({ reason }) route() {} }' },
                { filename: CONTROLLER, settings, code: `${REASON}declare const reason: PublicReason.Health | PublicReason.SignedWebhook; class C { @Public({ reason }) route() {} }` },
                { filename: CONTROLLER, settings, code: "class C { @UseGuards(ToolTokenGuard) route() {} }" },
                { filename: CONTROLLER, settings, code: "class C { @UseGuards(ApiKeyGuard) route() {} }" },
                // The existing rule owns absent reasons, strings and enums from other owners.
                { filename: CONTROLLER, settings, code: "class C { @Public() route() {} }" },
                { filename: CONTROLLER, settings, code: "class C { @Public({ reason: 'ToolToken' }) route() {} }" },
                { filename: CONTROLLER, settings, code: "enum PublicReason { ToolToken = 'tool-token' }; class C { @Public({ reason: PublicReason.ToolToken }) route() {} }" },
            ],
            invalid: [
                { filename: IDENTITY, settings, code: EXTENDED_ENUM, errors: [closedError] },
                { filename: IDENTITY, settings, code: "enum PublicReason { Health = 'health', AuthHandshake = 'auth-handshake', SignedWebhook = 'signed-webhook' }", errors: [closedError] },
                { filename: IDENTITY, settings, code: `${EXTENDED_ENUM}class C { @Public({ reason: PublicReason.ToolToken }) route() {} }`, errors: [closedError, closedError] },
                { filename: IDENTITY, settings, code: `${EXTENDED_ENUM}const reason = PublicReason.ToolToken; class C { @Public({ reason }) route() {} }`, errors: [closedError, closedError] },
                { filename: IDENTITY, settings, code: `${EXTENDED_ENUM}declare const reason: PublicReason.Health | PublicReason.ToolToken; class C { @Public({ reason }) route() {} }`, errors: [closedError, closedError] },
                { filename: IDENTITY, settings, code: `${CLOSED_ENUM}export enum PublicReason { ToolToken = 'health' }; class C { @Public({ reason: PublicReason.ToolToken }) route() {} }`, errors: [closedError, closedError, closedError] },
                { filename: CONTROLLER, settings, code: `${REASON}class C { @Public({ reason: PublicReason.ToolToken }) route() {} }`, errors: [closedError] },
                { filename: CONTROLLER, settings, code: 'import { PublicReason as Reason } from "@modules/domain/identity"\nclass C { @Public({ reason: Reason.ToolToken }) route() {} }', errors: [closedError] },
                { filename: CONTROLLER, settings, code: `${REASON}class C { @Public({ reason: PublicReason['ToolToken'] }) route() {} }`, errors: [closedError] },
                { filename: CONTROLLER, settings, code: `${REASON}class C { @Public({ reason: PublicReason.ApiKey }) route() {} }`, errors: [closedError] },
                { filename: CONTROLLER, settings, code: `${REASON}class C { @Public({ reason: PublicReason.ToolToken as PublicReason.Health }) route() {} }`, errors: [closedError] },
            ],
        })
    })
}
