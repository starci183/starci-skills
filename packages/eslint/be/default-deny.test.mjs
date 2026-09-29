import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noUntypedBody, publicNeedsReason } from "./default-deny.mjs"

const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const CONTROLLER = "D:/repo/src/features/plan/transport/http/create-plan.controller.ts"
const RESOLVER = "D:/repo/src/features/plan/transport/graphql/create-plan.resolver.ts"

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
            { filename: "D:/repo/src/modules/domain/plan/plan.service.ts", code: "switch (input.operation) { case 'a': break }" },
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

test("an open door states why it is open", () => {
    tester.run("public-needs-reason", publicNeedsReason, {
        valid: [
            { filename: CONTROLLER, code: "class C { @Public({ reason: 'signed webhook' }) hook() {} }" },
            { filename: CONTROLLER, code: "class C { @Roles('admin') list() {} }" },
        ],
        invalid: [
            { filename: CONTROLLER, code: "class C { @Public() hook() {} }", errors: [{ messageId: "reason" }] },
            { filename: CONTROLLER, code: "class C { @Public hook() {} }", errors: [{ messageId: "reason" }] },
            { filename: CONTROLLER, code: "class C { @Public({}) hook() {} }", errors: [{ messageId: "reason" }] },
            { filename: CONTROLLER, code: "class C { @Public({ reason: '' }) hook() {} }", errors: [{ messageId: "reason" }] },
            { filename: CONTROLLER, code: "class C { @Public({ reason }) hook() {} }", errors: [{ messageId: "reason" }] },
        ],
    })
})
