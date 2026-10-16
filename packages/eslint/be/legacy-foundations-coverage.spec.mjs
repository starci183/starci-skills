// proves: BE_LOGGER_REQUIRED@lite BE_LOGGER_REQUIRED@full
// proves: BE_DEFAULT_DENY@lite BE_DEFAULT_DENY@full
// proves: BE_INPUT_BOUNDED@lite BE_INPUT_BOUNDED@full
// proves: BE_CONFIG_OWNER@lite BE_CONFIG_OWNER@full
import assert from "node:assert/strict"
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { at, BE_DECLARATION, ruleTester, TYPED_ROOT } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { catchMustAccount } from "./error-handling.mjs"
import { noUntypedBody, publicNeedsReason } from "./default-deny.mjs"
import { noAuthUseGuards, noGuardInjectsGuard } from "./authorization.mjs"
import { configParsedInMain, noDirectEnvRead, secretCompareTimingSafe } from "./config-owner.mjs"
import { noErrorWordingAsLogIdentity, noFrameworkLogger, noInterpolatedLogMessage } from "./observability.mjs"
import { authDoorStrictRateTier, inputBounded, noOffsetPagination } from "./input-bounds.mjs"

const SERVICE = at("src/modules/domain/plan/plan.service.ts")
const CONTROLLER = at("src/features/api/plan/transport/http/create-plan.controller.ts")
const MAIN = at("apps/api/src/main.ts")
const ORDER = at("src/modules/domain/order/order.service.ts")
const REQUEST = at("src/features/api/plan/transport/http/dto/create-plan.request.ts")
const RESOLVER = at("src/features/api/identity/transport/graphql/sign-in.resolver.ts")
const LOGGING = [
    'import type { Logger } from "@modules/platform/logging/logging.port"',
    'import { OrderLogEvent } from "@modules/domain/order/order.log-events"',
    "declare const logger: Logger",
    "declare const cause: unknown",
    "",
].join("\n")
const PUBLIC_DOOR = [
    'import { Public, PublicReason } from "@modules/domain/identity"',
    'import { RateLimit, RateTier } from "@modules/platform/http-security"',
    "",
].join("\n")
const CONFIG = [
    'import { parsePlatformConfig } from "@modules/platform/config/platform.config"',
    'import { EnvSource } from "@modules/platform/config"',
    "declare const env: EnvSource",
    "",
].join("\n")

for (const edition of ["lite", "full"]) {
    test(`R40 logger valid and invalid cases in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        const tester = ruleTester({ root: TYPED_ROOT, hfs })
        tester.run("catch-must-account", catchMustAccount, {
            valid: [{ filename: SERVICE, code: "try { work() } catch (error) { throw error }" }],
            invalid: [{ filename: SERVICE, code: "try { work() } catch (error) {}", errors: [{ messageId: "empty" }] }],
        })
        tester.run("no-framework-logger", noFrameworkLogger, {
            valid: [{ filename: ORDER, code: "import { Injectable } from '@nestjs/common'" }],
            invalid: [{ filename: ORDER, code: "import { Injectable, Logger } from '@nestjs/common'", errors: [{ messageId: "imported" }] }],
        })
        tester.run("no-interpolated-log-message", noInterpolatedLogMessage, {
            valid: [{ filename: ORDER, code: LOGGING + "logger.info(OrderLogEvent.CheckoutRetried, { orderId })" }],
            invalid: [{ filename: ORDER, code: LOGGING + "logger.info(`Checkout ${orderId} failed`)", errors: [{ messageId: "notEvent" }] }],
        })
        tester.run("no-error-wording-as-log-identity", noErrorWordingAsLogIdentity, {
            valid: [{ filename: ORDER, code: LOGGING + "try { run() } catch (error) { logger.error(OrderLogEvent.CheckoutFailed, error, { code: error.code, detail: error.message }) }" }],
            invalid: [{ filename: ORDER, code: LOGGING + "try { run() } catch (error) { logger.error(OrderLogEvent.CheckoutFailed, cause, { detail: error.message }) }", errors: [{ messageId: "wordingOnly" }] }],
        })
    })

    test(`R41 default deny valid and invalid cases in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        const tester = ruleTester({ root: TYPED_ROOT, hfs })
        tester.run("no-untyped-body", noUntypedBody, {
            valid: [{ filename: CONTROLLER, code: "class C { create(@Body() body: CreatePlanRequest) {} }" }],
            invalid: [{ filename: CONTROLLER, code: "class C { create(@Body() body: unknown) {} }", errors: [{ messageId: "untyped" }] }],
        })
        tester.run("public-needs-reason", publicNeedsReason, {
            valid: [{ filename: CONTROLLER, code: 'import { PublicReason } from "@modules/domain/identity"\nclass C { @Public({ reason: PublicReason.Health }) hook() {} }' }],
            invalid: [{ filename: CONTROLLER, code: "class C { @Public() hook() {} }", errors: [{ messageId: "reason" }] }],
        })
        tester.run("no-auth-use-guards", noAuthUseGuards, {
            valid: [{ filename: CONTROLLER, code: "class C { @Roles('admin') list() {} }" }],
            invalid: [{ filename: CONTROLLER, code: "class C { @UseGuards(AuthGuard) list() {} }", errors: [{ messageId: "useGuards" }] }],
        })
        tester.run("no-guard-injects-guard", noGuardInjectsGuard, {
            valid: [{ filename: CONTROLLER, code: "class AuthGuard implements CanActivate { constructor(private readonly reflector: Reflector) {} }" }],
            invalid: [{ filename: CONTROLLER, code: "class AuthGuard implements CanActivate { constructor(private readonly credentials: CredentialGuard) {} }", errors: [{ messageId: "guardInGuard" }] }],
        })
        tester.run("secret-compare-timing-safe", secretCompareTimingSafe, {
            valid: [{ filename: SERVICE, code: "if (timingSafeEqual(a, b)) {}" }],
            invalid: [{ filename: SERVICE, code: "if (token === expected) {}", errors: [{ messageId: "compare" }] }],
        })
    })

    test(`R42 bounded input valid and invalid cases in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        const tester = ruleTester({ root: TYPED_ROOT, hfs })
        tester.run("input-bounded", inputBounded, {
            valid: [{ filename: REQUEST, code: 'import { IsString, MaxLength } from "class-validator"\nexport class CreatePlanRequest { @IsString() @MaxLength(80) name!: string }' }],
            invalid: [{ filename: REQUEST, code: "export class CreatePlanRequest { name!: string }", errors: [{ messageId: "missing" }] }],
        })
        tester.run("no-offset-pagination", noOffsetPagination, {
            valid: [{ filename: REQUEST, code: "export class CreatePlanRequest { first!: number; after?: string }" }],
            invalid: [{ filename: REQUEST, code: "export class CreatePlanRequest { offset!: number }", errors: [{ messageId: "field" }] }],
        })
        tester.run("auth-door-strict-rate-tier", authDoorStrictRateTier, {
            valid: [{ filename: RESOLVER, code: PUBLIC_DOOR + "class R { @Public({ reason: PublicReason.AuthHandshake }) @RateLimit(RateTier.Strict) signIn() {} }" }],
            invalid: [{ filename: RESOLVER, code: PUBLIC_DOOR + "class R { @Public({ reason: PublicReason.AuthHandshake }) signIn() {} }", errors: [{ messageId: "strict", data: { reason: "AuthHandshake" } }] }],
        })
    })

    test(`R43 config owner valid and invalid cases in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        const tester = ruleTester({ root: TYPED_ROOT, hfs })
        tester.run("no-direct-env-read", noDirectEnvRead, {
            valid: [{ filename: MAIN, code: "const environment = process.env" }],
            invalid: [{ filename: SERVICE, code: "const environment = process.env", errors: [{ messageId: "env" }] }],
        })
        tester.run("config-parsed-in-main", configParsedInMain, {
            valid: [{ filename: MAIN, code: CONFIG + "export const options = parsePlatformConfig(env)" }],
            invalid: [{ filename: SERVICE, code: CONFIG + "export const options = parsePlatformConfig(env)", errors: [{ messageId: "parsed" }] }],
        })
    })
}
