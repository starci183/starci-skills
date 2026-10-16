/**
 * Twin tests for the authorization rule (R41 `no-auth-use-guards`).
 *
 *   node --test authorization.spec.mjs
 */
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { noAuthUseGuards, noGuardInjectsGuard, rules } from "./authorization.mjs"

const tester = typedTester()
const CONTROLLER = at("src/features/api/plan/transport/http/create-plan.controller.ts")

test("the law publishes exactly the guard rules", () => {
    if (Object.keys(rules).join() !== "no-auth-use-guards,no-guard-injects-guard") throw new Error("authorization law must ship the use-guards and guard-in-guard rules")
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

const GUARD = at("src/modules/domain/identity/auth.guard.ts")

test("no guard injects another guard", () => {
    tester.run("no-guard-injects-guard", noGuardInjectsGuard, {
        valid: [
            { filename: GUARD, code: "class AuthGuard implements CanActivate { constructor(private readonly reflector: Reflector) {} }" },
            { filename: GUARD, code: "class CredentialGuard implements CanActivate { constructor(@InjectReflector() private readonly reflector: Reflector, @InjectCredentialAuthenticator() private readonly authenticator: CredentialAuthenticator) {} }" },
            // a class that is not a guard may receive a guard
            { filename: GUARD, code: "class Registry { constructor(private readonly guard: AuthGuard) {} }" },
        ],
        invalid: [
            { filename: GUARD, code: "class AuthGuard implements CanActivate { constructor(private readonly credentials: CredentialGuard) {} }", errors: [{ messageId: "guardInGuard" }] },
            { filename: GUARD, code: "class AuthGuard implements CanActivate { constructor(guard: CanActivate) {} }", errors: [{ messageId: "guardInGuard" }] },
            { filename: GUARD, code: "class AuthGuard implements CanActivate { constructor(private readonly guard: Type<CanActivate>) {} }", errors: [{ messageId: "guardInGuard" }] },
            { filename: GUARD, code: "class ThrottlerLikeGuard { constructor(private readonly origin: OriginGuard) {} }", errors: [{ messageId: "guardInGuard" }] },
            { filename: GUARD, code: "class AuthGuard implements CanActivate { constructor(@Inject(CredentialGuard) private readonly guard: unknown) {} }", errors: [{ messageId: "guardInGuard" }] },
        ],
    })
})
