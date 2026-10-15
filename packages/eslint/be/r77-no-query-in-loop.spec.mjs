// proves: BE_QUERY_IN_LOOP@lite
// proves: BE_QUERY_IN_LOOP@full
import assert from "node:assert/strict"
import test from "node:test"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { noQueryInLoop } from "./query-safety.mjs"

const HANDLER = at("src/features/api/checkout/application/place.handler.ts")
const HEAD = [
    'import type { EntityManager } from "typeorm"',
    "declare const manager: EntityManager",
    "declare class OrderEntity {}",
    "declare const ids: string[]",
].join("\n")
const code = (body) => HEAD + "\n" + body

for (const edition of ["lite", "full"]) {
    test(`R77 valid batch reads and invalid queries per element in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("no-query-in-loop", noQueryInLoop, {
            valid: [
                { filename: HANDLER, code: code("const rows = await manager.find(OrderEntity, { take: 50 }); for (const id of ids) { rows.find((row) => row.id === id) }") },
                { filename: HANDLER, code: code("while (true) { const row = await manager.findOne(OrderEntity, { where: {} }); if (row) break }") },
            ],
            invalid: [
                { filename: HANDLER, code: code("for (const id of ids) { await manager.findOne(OrderEntity, { where: { id } }) }"), errors: [{ messageId: "inLoop" }] },
                { filename: HANDLER, code: code("await Promise.all(ids.map((id) => manager.findOne(OrderEntity, { where: { id } })))"), errors: [{ messageId: "inLoop" }] },
            ],
        })
    })
}
