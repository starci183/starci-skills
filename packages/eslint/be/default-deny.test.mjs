import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { noUntypedBody, publicNeedsReason } from "./default-deny.mjs"

const tester = typedTester()
const CONTROLLER = at("src/features/plan/transport/http/create-plan.controller.ts")
const RESOLVER = at("src/features/plan/transport/graphql/create-plan.resolver.ts")

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
            { filename: at("src/features/plan/transport/http/create-plan.controller.spec.ts"), code: "class C { @Public() hook() {} }", errors: [{ messageId: "reason" }] },
        ],
    })
})
