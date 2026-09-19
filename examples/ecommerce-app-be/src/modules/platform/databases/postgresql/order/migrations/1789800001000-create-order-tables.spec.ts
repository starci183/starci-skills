import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    QueryRunner 
} from "typeorm"
import {
    CreateOrderTables1789800001000 
} from "./1789800001000-create-order-tables"

describe("CreateOrderTables1789800001000 - the order schema bootstrap",
    () => {
        let moduleRef: TestingModule
        let migration: CreateOrderTables1789800001000
        let query: jest.Mock
        let runner: QueryRunner

        beforeEach(async () => {
            query = jest.fn().mockResolvedValue(undefined)
            runner = {
                query 
            } as unknown as QueryRunner
            moduleRef = await Test.createTestingModule({
                providers: [CreateOrderTables1789800001000],
            }).compile()
            migration = moduleRef.get(CreateOrderTables1789800001000)
        })

        afterEach(() => moduleRef.close())

        it("names itself after its timestamp for the migration ledger",
            () => {
                expect(migration.name).toBe("CreateOrderTables1789800001000")
            })

        it("up creates the five order tables idempotently then seeds the demo catalog",
            async () => {
                await migration.up(runner)

                expect(query).toHaveBeenCalledTimes(6)
                const statements = query.mock.calls.map((call) => call[0] as string)
                expect(statements[0]).toContain("CREATE TABLE IF NOT EXISTS product")
                expect(statements[1]).toContain("CREATE TABLE IF NOT EXISTS cart_item")
                expect(statements[1]).toContain("uq_cart_item_person_product")
                expect(statements[2]).toContain("CREATE TABLE IF NOT EXISTS sales_order")
                expect(statements[2]).toContain("uq_sales_order_idempotency")
                expect(statements[3]).toContain("CREATE TABLE IF NOT EXISTS sales_order_line")
                expect(statements[4]).toContain("CREATE TABLE IF NOT EXISTS payment")
                expect(statements[5]).toContain("INSERT INTO product")
                expect(statements[5]).toContain("ON CONFLICT (id) DO NOTHING")
                expect(statements[5]).toContain("sku-mug")
            })

        it("down drops the tables in foreign-key-safe order",
            async () => {
                await migration.down(runner)

                expect(query.mock.calls.map((call) => call[0] as string)).toEqual([
                    "DROP TABLE IF EXISTS payment",
                    "DROP TABLE IF EXISTS sales_order_line",
                    "DROP TABLE IF EXISTS sales_order",
                    "DROP TABLE IF EXISTS cart_item",
                    "DROP TABLE IF EXISTS product",
                ])
            })
    })
