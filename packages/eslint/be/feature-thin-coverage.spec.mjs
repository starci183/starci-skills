// proves: BE_FEATURE_THIN@lite
// proves: BE_FEATURE_THIN@full
import test from "node:test"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { featureThin } from "./feature-thin.mjs"

const filename = at("src/features/api/checkout/application/place-order.handler.ts")
const passing = `import { OrderService } from "@modules/domain/order"
export class PlaceOrderHandler {
    constructor(private readonly orders: OrderService) {}
    handle(input: { orderId: string }): Promise<unknown> {
        return this.orders.open(input.orderId)
    }
}`
const violating = `import { OrderService } from "@modules/domain/order"
export class PlaceOrderHandler {
    constructor(private readonly orders: OrderService) {}
    handle(input: { orderId: string }): Promise<unknown> {
        if (input.orderId) return this.orders.open(input.orderId)
        return this.orders.open(input.orderId)
    }
}`

for (const edition of ["lite", "full"]) {
    test(`feature-thin accepts delegation and rejects a business branch in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        ruleTester({ root: TYPED_ROOT, hfs }).run("feature-thin", featureThin, {
            valid: [{ filename, code: passing }],
            invalid: [{ filename, code: violating, errors: [{ messageId: "branch" }, { messageId: "many" }] }],
        })
    })
}
