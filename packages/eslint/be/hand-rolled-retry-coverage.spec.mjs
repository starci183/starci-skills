/** R81 proves retry-loop diagnostics in each HFS edition. */
// proves: BE_HAND_ROLLED_RETRY@lite
// proves: BE_HAND_ROLLED_RETRY@full
import assert from "node:assert/strict"
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { noHandRolledRetry } from "./resilience.mjs"

const SERVICE = at("src/modules/domain/order/order.service.ts")

for (const edition of ["lite", "full"]) {
    test(`R81 accepts ordinary loops and rejects hand-rolled retry in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("no-hand-rolled-retry", noHandRolledRetry, {
            valid: [
                { filename: SERVICE, code: "async function run() { for (const id of ids) { try { await perform(id) } catch (error) { report(error) } } }" },
                { filename: SERVICE, code: "async function poll() { while (!isReady()) { await new Promise((resolve) => setTimeout(resolve, 5)) } }" },
            ],
            invalid: [
                {
                    filename: SERVICE,
                    code: "async function run() { while (true) { try { return await perform() } catch (error) { await new Promise((resolve) => setTimeout(resolve, 5)) } } }",
                    errors: [{ messageId: "handRolled" }],
                },
                {
                    filename: SERVICE,
                    code: 'import { setTimeout as pause } from "node:timers/promises"; async function run() { for (let attempt = 0; attempt < 3; attempt++) { try { return await perform() } catch (error) { await pause(5) } } }',
                    errors: [{ messageId: "handRolled" }],
                },
            ],
        })
    })
}
