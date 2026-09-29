import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { catchMustAccount, errorHome } from "./error-handling.mjs"

const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const SERVICE = "D:/repo/src/modules/domain/plan/plan.service.ts"

test("a catch rethrows, logs through a logger port, or returns an outcome carrying its cause", () => {
    tester.run("catch-must-account", catchMustAccount, {
        valid: [
            { filename: SERVICE, code: "try { a() } catch (error) { throw new PlanError({ cause: error }) }" },
            { filename: SERVICE, code: "try { a() } catch (error) { this.logger.error(LogId.PlanFailed, { error }) }" },
            { filename: SERVICE, code: "try { a() } catch { log.warn(LogId.PlanFailed) }" },
            { filename: SERVICE, code: "try { a() } catch (error) { return { status: 'unavailable', cause: error } }" },
            { filename: SERVICE, code: "try { a() } catch (e) { return fail('plan', e) }" },
            { filename: SERVICE, code: "p.catch((error) => logger.error(LogId.X, { error }))" },
            { filename: SERVICE, code: "p.catch(handle)" },
            { filename: SERVICE, code: "p.catch((error) => { throw error })" },
        ],
        invalid: [
            { filename: SERVICE, code: "try { a() } catch {}", errors: [{ messageId: "empty" }] },
            { filename: SERVICE, code: "try { a() } catch (error) {}", errors: [{ messageId: "empty" }] },
            { filename: SERVICE, code: "try { a() } catch (error) { /* ignored */ }", errors: [{ messageId: "empty" }] },
            { filename: SERVICE, code: "try { a() } catch (error) { return null }", errors: [{ messageId: "swallowed" }] },
            // reading only `error.message` drops the cause
            { filename: SERVICE, code: "try { a() } catch (error) { return { message: error.message } }", errors: [{ messageId: "swallowed" }] },
            // console is not a logger port
            { filename: SERVICE, code: "try { a() } catch (error) { console.error(error) }", errors: [{ messageId: "swallowed" }] },
            // a throw inside a nested function does not account for the outer failure
            { filename: SERVICE, code: "try { a() } catch (error) { const f = () => { throw error }; return false }", errors: [{ messageId: "swallowed" }] },
            { filename: SERVICE, code: "p.catch(() => {})", errors: [{ messageId: "empty" }] },
            { filename: SERVICE, code: "p.catch(() => null)", errors: [{ messageId: "swallowed" }] },
        ],
    })
})

test("an error is declared at its owner, extends DomainError, and no bare or framework error escapes", () => {
    tester.run("error-home", errorHome, {
        valid: [
            { filename: "D:/repo/src/modules/domain/plan/errors/plan.error.ts", code: "class PlanNotFoundError extends PlanError {}" },
            { filename: "D:/repo/src/modules/domain/plan/errors/plan.error.ts", code: "class PlanError extends DomainError {}" },
            { filename: "D:/repo/src/modules/integrations/sepay/errors/sepay.error.ts", code: "class SepayError extends DomainError {}" },
            { filename: "D:/repo/src/features/checkout/errors/checkout.error.ts", code: "class CheckoutError extends DomainError {}" },
            // the base itself is the one class allowed to extend the built-in
            { filename: "D:/repo/src/modules/platform/errors/domain-error.ts", code: "class DomainError extends Error {}" },
            { filename: SERVICE, code: "throw new PlanNotFoundError({ id })" },
            // a probe's status is its whole contract
            { filename: "D:/repo/apps/api/src/health/healthz.controller.ts", code: "throw new ServiceUnavailableException()" },
            // specs may throw to stop the runner
            { filename: "D:/repo/src/modules/domain/plan/plan.service.spec.ts", code: "throw new Error('fixture missing')" },
            // a domain may throw its own error even when a platform base is imported
            { filename: SERVICE, code: "import { DomainError } from '@modules/platform/errors'\nthrow new DomainError({ code: 'X' })" },
        ],
        invalid: [
            { filename: SERVICE, code: "throw new Error('nope')", errors: [{ messageId: "bareError" }] },
            { filename: SERVICE, code: "throw new NotFoundException('nope')", errors: [{ messageId: "framework" }] },
            { filename: SERVICE, code: "class PlanNotFoundError extends PlanError {}", errors: [{ messageId: "place" }] },
            { filename: "D:/repo/src/modules/domain/plan/errors/plan.error.ts", code: "class PlanError extends Error {}", errors: [{ messageId: "mustExtendDomainError" }] },
            { filename: "D:/repo/src/modules/domain/plan/errors/plan.error.ts", code: "class PlanError extends AbstractException {}", errors: [{ messageId: "retiredBase" }] },
            { filename: "D:/repo/src/modules/domain/exceptions/plan.ts", code: "export const x = 1", errors: [{ messageId: "retiredHome" }] },
            { filename: "D:/repo/src/modules/platform/exceptions/errors/x.ts", code: "export const x = 1", errors: [{ messageId: "retiredHome" }] },
            {
                filename: SERVICE,
                code: "import { PersistenceError } from '@modules/platform/database'\nthrow new PersistenceError({})",
                errors: [{ messageId: "platformThrown" }],
            },
        ],
    })
})
