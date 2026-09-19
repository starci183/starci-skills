import {
    getMetadataArgsStorage 
} from "typeorm"
import {
    CartItemEntity 
} from "./cart-item.entity"
import {
    OrderEntity 
} from "./order.entity"
import {
    OrderLineEntity 
} from "./order-line.entity"
import {
    PaymentEntity 
} from "./payment.entity"
import {
    ProductEntity 
} from "./product.entity"

/**
 * Entity registration is decorator metadata, so the spec asserts on typeorm's metadata-args
 * storage - the same source TypeORM's DataSource builder reads at boot - rather than instantiating
 * a connection.
 */
describe("order entities - table metadata registration",
    () => {
        const storage = getMetadataArgsStorage()
        const tableName = (target: object) =>
            storage.tables.find((t) => t.target === target)?.name
        const columnsOf = (target: object) => storage.columns.filter((c) => c.target === target)
        const column = (target: object, property: string) =>
            columnsOf(target).find((c) => c.propertyName === property)
        const unique = (target: object, name: string) =>
            storage.uniques.find((u) => u.target === target && u.name === name)

        it("maps the five order-schema classes to their tables",
            () => {
                expect(tableName(ProductEntity)).toBe("product")
                expect(tableName(CartItemEntity)).toBe("cart_item")
                expect(tableName(OrderEntity)).toBe("sales_order")
                expect(tableName(OrderLineEntity)).toBe("sales_order_line")
                expect(tableName(PaymentEntity)).toBe("payment")
            })

        it("keeps catalog ids as caller-owned text, not generated uuids",
            () => {
                expect(column(ProductEntity,
                    "id")?.options).toMatchObject({
                    type: "text", primary: true 
                })
                expect(
                    storage.generations.find((g) => g.target === ProductEntity && g.propertyName === "id"),
                ).toBeUndefined()
                expect(column(ProductEntity,
                    "priceMinorUnits")?.options).toMatchObject({
                    type: "int",
                    name: "price_minor_units",
                })
            })

        it("declares one cart row per (person, product) pair",
            () => {
                expect(unique(CartItemEntity,
                    "uq_cart_item_person_product")?.columns).toEqual([
                    "personId",
                    "productId",
                ])
                expect(column(CartItemEntity,
                    "personId")?.options).toMatchObject({
                    type: "uuid", name: "person_id" 
                })
                expect(column(CartItemEntity,
                    "productId")?.options).toMatchObject({
                    type: "text", name: "product_id" 
                })
            })

        it("scopes order idempotency keys per person",
            () => {
                expect(unique(OrderEntity,
                    "uq_sales_order_idempotency")?.columns).toEqual([
                    "personId",
                    "idempotencyKey",
                ])
                expect(column(OrderEntity,
                    "status")?.options).toMatchObject({
                    type: "text", default: "confirmed" 
                })
                expect(column(OrderEntity,
                    "totalMinorUnits")?.options).toMatchObject({
                    type: "int",
                    name: "total_minor_units",
                })
                expect(column(OrderEntity,
                    "currency")?.options).toMatchObject({
                    type: "text", default: "USD" 
                })
                expect(column(OrderEntity,
                    "idempotencyKey")?.options).toMatchObject({
                    type: "text",
                    nullable: true,
                    name: "idempotency_key",
                })
            })

        it("keeps order lines in minor units against their order and product ids",
            () => {
                expect(column(OrderLineEntity,
                    "orderId")?.options).toMatchObject({
                    type: "uuid", name: "order_id" 
                })
                expect(column(OrderLineEntity,
                    "unitPriceMinorUnits")?.options).toMatchObject({
                    type: "int",
                    name: "unit_price_minor_units",
                })
            })

        it("keeps payment idempotency keys globally unique and money in minor units",
            () => {
                expect(column(PaymentEntity,
                    "idempotencyKey")?.options).toMatchObject({
                    type: "text",
                    unique: true,
                    name: "idempotency_key",
                })
                expect(column(PaymentEntity,
                    "amountMinorUnits")?.options).toMatchObject({
                    type: "int",
                    name: "amount_minor_units",
                })
                expect(column(PaymentEntity,
                    "status")?.options).toMatchObject({
                    type: "text", default: "captured" 
                })
            })
    })
