/**
 * Twin tests for the authorization rule (R41 `no-auth-use-guards`).
 *
 *   node --test authorization.spec.mjs
 */
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { noAuthUseGuards, rules } from "./authorization.mjs"

const tester = typedTester()
const CONTROLLER = at("src/features/api/plan/transport/http/create-plan.controller.ts")

test("the law publishes exactly the guard rule", () => {
    if (Object.keys(rules).join() !== "no-auth-use-guards") throw new Error("authorization law must ship only no-auth-use-guards")
})

test("no door picks its own guard", () => {
    tester.run("no-auth-use-guards", noAuthUseGuards, {
        valid: [
            { filename: CONTROLLER, code: "class C { @Roles('admin') list() {} }" },
            { filename: CONTROLLER, code: "class C { @Get() list(@CurrentPrincipal() principal: unknown) {} }" },
            { filename: CONTROLLER, code: "class C { @UseInterceptors(X) list() {} }" },
        ],
        invalid: [
            { filename: CONTROLLER, code: "class C { @UseGuards(AuthGuard) list() {} }", errors: [{ messageId: "useGuards" }] },
            { filename: CONTROLLER, code: "@UseGuards(AuthGuard)\nclass C {}", errors: [{ messageId: "useGuards" }] },
            { filename: CONTROLLER, code: "@UseGuards()\nclass C {}", errors: [{ messageId: "useGuards" }] },
            // an aliased import is the same decorator
            { filename: CONTROLLER, code: 'import { UseGuards as Guarded } from "@nestjs/common"\n@Guarded(X)\nclass C {}', errors: [{ messageId: "useGuards" }] },
            // a namespace import is the same decorator
            { filename: CONTROLLER, code: 'import * as common from "@nestjs/common"\n@common.UseGuards(X)\nclass C {}', errors: [{ messageId: "useGuards" }] },
            // a spec is not exempt
            { filename: at("src/features/api/plan/transport/http/create-plan.controller.spec.ts"), code: "@UseGuards(X)\nclass C {}", errors: [{ messageId: "useGuards" }] },
            // an owner outside transport is not exempt either
            { filename: at("src/modules/domain/plan/plan.service.ts"), code: "@UseGuards(X)\nclass C {}", errors: [{ messageId: "useGuards" }] },
        ],
    })
})
