import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { userCopyThroughCatalog } from "./user-copy.mjs"

const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const SERVICE = "D:/repo/src/modules/domain/plan/plan.service.ts"
const CONTROLLER = "D:/repo/src/features/plan/transport/http/plan.controller.ts"

test("exception, notification and response copy come from the messages catalog", () => {
    tester.run("user-copy-through-catalog", userCopyThroughCatalog, {
        valid: [
            // a key, not copy
            { filename: SERVICE, code: "throw new PlanNotFoundError('PLAN_NOT_FOUND')" },
            { filename: SERVICE, code: "throw new PlanNotFoundError('pending')" },
            // built through the catalog
            { filename: SERVICE, code: "throw new PlanNotFoundError(messages.get('plan.notFound', { id }))" },
            // a built-in error used for an internal invariant
            { filename: SERVICE, code: "throw new Error('unreachable: index out of range')" },
            { filename: SERVICE, code: "this.notifier.send({ subject: messages.get('plan.subject'), templateId: 'plan-x' })" },
            { filename: CONTROLLER, code: "return { message: messages.get('plan.updated') }" },
            { filename: CONTROLLER, code: "return { code: 'OK' }" },
            // a spec holds fixture text
            { filename: "D:/repo/src/modules/domain/plan/plan.service.spec.ts", code: "throw new PlanNotFoundError('Plan not found')" },
        ],
        invalid: [
            { filename: SERVICE, code: "throw new PlanNotFoundError('Plan not found for this account')", errors: [{ messageId: "exception" }] },
            {
                filename: SERVICE,
                code: "this.notifier.send({ subject: 'Your plan has changed', templateId: 'plan-x' })",
                errors: [{ messageId: "notification" }],
            },
            {
                filename: CONTROLLER,
                code: "return { message: 'Plan updated successfully' }",
                errors: [{ messageId: "response" }],
            },
        ],
    })
})
