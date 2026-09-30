/**
 * Twin tests for the error rules (R38, R40).
 *
 *   node --test error-handling.test.mjs
 *
 * Type-aware cases run over the fixture repository in `fixtures/typed`: `DomainError` is declared by its
 * `src/modules/platform/errors`, `Logger` by `platform/logging`, so the owner of a type is judged by the slot view.
 */
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { catchMustAccount, errorFamilyShape, errorHome, throwDomainError } from "./error-handling.mjs"

const tester = typedTester()
const SERVICE = at("src/modules/domain/plan/plan.service.ts")
const PURCHASE_ERROR = at("src/modules/domain/purchase/errors/purchase.error.ts")

const LOGGER_IMPORT = 'import type { Logger } from "@modules/platform/logging"\n'
const HEAD = `${LOGGER_IMPORT}declare const logger: Logger\ndeclare const renamed: Logger\ndeclare const other: { error(e: string): void }\ndeclare function a(): void\ndeclare function fail(k: string, e: unknown): unknown\ndeclare const p: Promise<void>\ndeclare function handle(e: unknown): void\n`

test("a catch rethrows, calls a method on a Logger receiver, or returns an outcome carrying its cause", () => {
    tester.run("catch-must-account", catchMustAccount, {
        valid: [
            { filename: SERVICE, code: `${HEAD}try { a() } catch (error) { throw new Error("x", { cause: error }) }` },
            { filename: SERVICE, code: `${HEAD}try { a() } catch (error) { logger.error("E", error) }` },
            // a renamed receiver is still a Logger by type
            { filename: SERVICE, code: `${HEAD}try { a() } catch (error) { renamed.error("E", error) }` },
            { filename: SERVICE, code: `${HEAD}try { a() } catch { logger.info("E") }` },
            { filename: SERVICE, code: `${HEAD}try { a() } catch (error) { return { kind: "refused", cause: error } }` },
            { filename: SERVICE, code: `${HEAD}try { a() } catch (e) { return fail("plan", e) }` },
            { filename: SERVICE, code: `${HEAD}p.catch((error) => logger.error("E", error))` },
            { filename: SERVICE, code: `${HEAD}p.catch(handle)` },
            { filename: SERVICE, code: `${HEAD}p.catch((error) => { throw error })` },
        ],
        invalid: [
            { filename: SERVICE, code: `${HEAD}try { a() } catch {}`, errors: [{ messageId: "empty" }] },
            { filename: SERVICE, code: `${HEAD}try { a() } catch (error) {}`, errors: [{ messageId: "empty" }] },
            { filename: SERVICE, code: `${HEAD}try { a() } catch (error) { return null }`, errors: [{ messageId: "swallowed" }] },
            // reading only `error.message` drops the cause
            { filename: SERVICE, code: `${HEAD}try { a() } catch (error) { return { message: (error as Error).message } }`, errors: [{ messageId: "swallowed" }] },
            // console is not a Logger
            { filename: SERVICE, code: `${HEAD}try { a() } catch (error) { console.error(error) }`, errors: [{ messageId: "swallowed" }] },
            // a receiver NAMED logger that is not the Logger port does not count: the type decides
            { filename: SERVICE, code: `${HEAD}const log = other\ntry { a() } catch (error) { log.error("x") }`, errors: [{ messageId: "swallowed" }] },
            // a throw inside a nested function does not account for the outer failure
            { filename: SERVICE, code: `${HEAD}try { a() } catch (error) { const f = () => { throw error }; return false }`, errors: [{ messageId: "swallowed" }] },
            { filename: SERVICE, code: `${HEAD}p.catch(() => {})`, errors: [{ messageId: "empty" }] },
            { filename: SERVICE, code: `${HEAD}p.catch(() => null)`, errors: [{ messageId: "swallowed" }] },
            // a spec is not exempt
            { filename: at("src/modules/domain/plan/plan.service.spec.ts"), code: `${HEAD}try { a() } catch {}`, errors: [{ messageId: "empty" }] },
        ],
    })
})

const ERR_HEAD = 'import { DomainError } from "@modules/platform/errors"\nenum PlanErrorCode { X = "PLAN_X" }\n'

test("a DomainError subclass is declared only in errors/<capability>.error.ts of its owner", () => {
    tester.run("error-home", errorHome, {
        valid: [
            { filename: at("src/modules/domain/plan/errors/plan.error.ts"), code: `${ERR_HEAD}export class PlanError extends DomainError<PlanErrorCode> {}` },
            { filename: at("src/features/checkout/errors/checkout.error.ts"), code: `${ERR_HEAD.replace("PlanErrorCode", "CheckoutErrorCode")}export class CheckoutError extends DomainError<CheckoutErrorCode> {}` },
            // the test world is a composition root with one error class at its root
            { filename: at("src/tests/world/test-world.error.ts"), code: `${ERR_HEAD}export class TestWorldError extends DomainError<PlanErrorCode> {}` },
            // the declaration of DomainError itself
            { filename: at("src/modules/platform/errors/domain-error.ts"), code: "export abstract class DomainError<C extends string> extends Error { readonly code!: C }" },
            // a class that is not an error
            { filename: SERVICE, code: "class PlanService {}" },
            // a class named ...Error that is not an Error subtype is not judged by its name
            { filename: SERVICE, code: "class PlanError { code = 1 }" },
        ],
        invalid: [
            {
                filename: SERVICE,
                code: `${ERR_HEAD}class PlanError extends DomainError<PlanErrorCode> {}`,
                errors: [{ messageId: "place" }],
            },
            // the world's home is its root file only; the same class elsewhere in the world, in a spec or in a domain file stays refused
            { filename: at("src/tests/world/kit/poll.ts"), code: `${ERR_HEAD}export class TestWorldError extends DomainError<PlanErrorCode> {}`, errors: [{ messageId: "place" }] },
            { filename: at("src/tests/world/fakes/x/test-world.error.ts"), code: `${ERR_HEAD}export class TestWorldError extends DomainError<PlanErrorCode> {}`, errors: [{ messageId: "place" }] },
            { filename: at("src/tests/e2e/flows/x.e2e-spec.ts"), code: `${ERR_HEAD}class TestWorldError extends DomainError<PlanErrorCode> {}`, errors: [{ messageId: "place" }] },
            // right folder, wrong file name for the owner
            {
                filename: at("src/modules/domain/plan/errors/other.error.ts"),
                code: `${ERR_HEAD}export class OtherError extends DomainError<PlanErrorCode> {}`,
                errors: [{ messageId: "place" }],
            },
            // a lookalike name that does not derive from DomainError but from Error
            { filename: at("src/modules/domain/plan/errors/plan.error.ts"), code: "export class PlanFailure extends Error {}", errors: [{ messageId: "mustExtendDomainError" }] },
            { filename: SERVICE, code: "class AbstractException extends Error {}\nclass PlanException extends AbstractException {}", errors: [{ messageId: "mustExtendDomainError" }, { messageId: "mustExtendDomainError" }] },
            {
                filename: SERVICE,
                code: 'import { HttpException } from "@nestjs/common"\nclass PlanHttp extends HttpException {}',
                errors: [{ messageId: "mustExtendDomainError" }],
            },
            // a spec is not exempt
            { filename: at("src/modules/domain/plan/plan.service.spec.ts"), code: "class Boom extends Error {}", errors: [{ messageId: "mustExtendDomainError" }] },
        ],
    })
})

const THROW_HEAD = `${ERR_HEAD}class PlanError extends DomainError<PlanErrorCode> {}\n`

test("a thrown value's type derives from DomainError", () => {
    tester.run("throw-domain-error", throwDomainError, {
        valid: [
            { filename: SERVICE, code: `${THROW_HEAD}function f() { throw new PlanError({ code: PlanErrorCode.X }) }` },
            // a rethrow of the caught value
            { filename: SERVICE, code: "declare function a(): void\ntry { a() } catch (error) { throw error }" },
            { filename: SERVICE, code: "declare const p: Promise<void>\np.catch((error) => { throw error })" },
            // a union of domain errors
            { filename: SERVICE, code: `${THROW_HEAD}class Other extends DomainError<PlanErrorCode> {}\nfunction f(x: boolean) { throw x ? new PlanError({ code: PlanErrorCode.X }) : new Other({ code: PlanErrorCode.X }) }` },
        ],
        invalid: [
            { filename: SERVICE, code: 'function f() { throw new Error("x") }', errors: [{ messageId: "bareError" }] },
            { filename: SERVICE, code: 'function f() { throw new TypeError("x") }', errors: [{ messageId: "bareError" }] },
            {
                filename: SERVICE,
                code: 'import { NotFoundException } from "@nestjs/common"\nfunction f() { throw new NotFoundException("x", 404) }',
                errors: [{ messageId: "framework" }],
            },
            { filename: SERVICE, code: 'function f() { throw "boom" }', errors: [{ messageId: "notDomainError" }] },
            { filename: SERVICE, code: "function f() { throw { code: 1 } }", errors: [{ messageId: "notDomainError" }] },
            // a thrown local value not caught here
            { filename: SERVICE, code: "declare const e: unknown\nfunction f() { throw e }", errors: [{ messageId: "notDomainError" }] },
            // a spec is not exempt
            { filename: at("src/modules/domain/plan/plan.service.spec.ts"), code: 'function f() { throw new Error("x") }', errors: [{ messageId: "bareError" }] },
            // a domain owner throwing a platform error outward
            {
                filename: SERVICE,
                code: 'import { ConfigError, ConfigErrorCode } from "@modules/platform/config/errors/config.error"\nfunction f() { throw new ConfigError({ code: ConfigErrorCode.KeyMissing }) }',
                errors: [{ messageId: "platformThrown" }],
            },
        ],
    })
})

const FAMILY = `import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes. */
export enum PurchaseErrorCode {
    /** Missing. */
    OfferNotFound = "PURCHASE_OFFER_NOT_FOUND",
}

/** Kinds. */
export const PURCHASE_ERROR_KINDS: Record<PurchaseErrorCode, ErrorKind> = {
    [PurchaseErrorCode.OfferNotFound]: "not-found",
}

/** The error. */
export class PurchaseError extends DomainError<PurchaseErrorCode> {}
`

test("errors/<c>.error.ts holds one code enum, one Record<Code, ErrorKind> table and one empty class", () => {
    tester.run("error-family-shape", errorFamilyShape, {
        valid: [
            { filename: PURCHASE_ERROR, code: FAMILY },
            // a multi-word capability
            {
                filename: at("src/modules/platform/http-security/errors/http-security.error.ts"),
                code: FAMILY.replaceAll("PurchaseError", "HttpSecurityError").replaceAll("PURCHASE_ERROR_KINDS", "HTTP_SECURITY_ERROR_KINDS").replaceAll("PurchaseErrorCode", "HttpSecurityErrorCode").replace("PURCHASE_OFFER", "HTTP_SECURITY_OFFER"),
            },
            // not an error home: not judged
            { filename: SERVICE, code: "export enum Whatever { A = 1 }" },
        ],
        invalid: [
            { filename: PURCHASE_ERROR, code: FAMILY.replace("PurchaseErrorCode {", "OtherCode {").replace("Record<PurchaseErrorCode", "Record<OtherCode").replace("[PurchaseErrorCode.OfferNotFound]", "[OtherCode.OfferNotFound]").replace("DomainError<PurchaseErrorCode>", "DomainError<OtherCode>"), errors: [{ messageId: "noCode" }, { messageId: "extra" }, { messageId: "kindsType" }, { messageId: "classShape" }] },
            { filename: PURCHASE_ERROR, code: FAMILY.replace('"PURCHASE_OFFER_NOT_FOUND"', '"OFFER_NOT_FOUND"'), errors: [{ messageId: "memberValue" }] },
            { filename: PURCHASE_ERROR, code: FAMILY.replace('"PURCHASE_OFFER_NOT_FOUND"', '"PURCHASE_OFFER_NOT_FOUND_ERROR"'), errors: [{ messageId: "memberValue" }] },
            { filename: PURCHASE_ERROR, code: FAMILY.replace('"PURCHASE_OFFER_NOT_FOUND"', '"PURCHASE_OFFER_NOT_FOUND_EXCEPTION"'), errors: [{ messageId: "memberValue" }] },
            { filename: PURCHASE_ERROR, code: FAMILY.replace('= "PURCHASE_OFFER_NOT_FOUND"', ""), errors: [{ messageId: "memberValue" }] },
            // the table is not annotated as the exhaustive Record
            { filename: PURCHASE_ERROR, code: FAMILY.replace(": Record<PurchaseErrorCode, ErrorKind>", ""), errors: [{ messageId: "kindsType" }] },
            { filename: PURCHASE_ERROR, code: FAMILY.replace("Record<PurchaseErrorCode, ErrorKind>", "Record<PurchaseErrorCode, string>"), errors: [{ messageId: "kindsType" }] },
            { filename: PURCHASE_ERROR, code: FAMILY.replace("export const PURCHASE_ERROR_KINDS", "export const KINDS"), errors: [{ messageId: "noKinds" }, { messageId: "extra" }] },
            // a class with a body
            { filename: PURCHASE_ERROR, code: FAMILY.replace("{}\n", "{ extra = 1 }\n"), errors: [{ messageId: "classShape" }] },
            // a second class in the family file
            { filename: PURCHASE_ERROR, code: `${FAMILY}export class OtherError extends DomainError<PurchaseErrorCode> {}\n`, errors: [{ messageId: "extra" }] },
            // an unrelated base
            { filename: PURCHASE_ERROR, code: FAMILY.replace("extends DomainError<PurchaseErrorCode>", "extends Error"), errors: [{ messageId: "classShape" }] },
        ],
    })
})
