import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { ORDER_ENTITY_MANAGER, PAGE_SIZE_MAX } from "@modules/platform/database"
import { OrderErrorCode } from "./errors/order.error"
import type { ListOrdersResult, OrderPage } from "./order-list.contracts"
import { OrderListService } from "./order-list.service"
import { ORDER_OPTIONS } from "./order.decorators"
import type { OrderListRow } from "./persistence/order.rows"
import { LIST_PERSON_ORDERS } from "./persistence/order.sql"

const KEY = "list-cursor-key"

const build = async (entityManager: MockEntityManager, key: string = KEY) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrderListService,
            { provide: ORDER_ENTITY_MANAGER, useValue: entityManager },
            { provide: ORDER_OPTIONS, useValue: { pageCursorKey: new Secret(key) } },
        ],
    }).compile()
    return moduleRef.get(OrderListService)
}

const listRow = (id: string, createdAt: string): OrderListRow => ({
    id,
    status: "pending",
    total_minor_units: 1250,
    currency: "USD",
    created_at: createdAt,
})

/** The page of a successful answer; any other answer fails the spec. */
const pageOfAnswer = (outcome: ListOrdersResult): OrderPage => {
    expect(outcome.kind).toBe("ok")
    return outcome.kind === "ok" ? outcome.value : { items: [], endCursor: null, hasNextPage: false }
}

const rows = [
    listRow("o-3", "2026-10-24 03:00:00.000003+00"),
    listRow("o-2", "2026-10-24 02:00:00.000002+00"),
    listRow("o-1", "2026-10-24 01:00:00.000001+00"),
]

/** The end cursor a service with `key` gives for the first two orders. */
const cursorAfterTwo = async (key: string): Promise<string> => {
    const orders = await build(mockEntityManager({ query: [LIST_PERSON_ORDERS, rows] }), key)
    return pageOfAnswer(await orders.list({ personId: "p-1", first: 2 })).endCursor ?? ""
}

const registerFirstPageTests = (): void => {
    describe("the first page", () => {
        it("reads one row more than the page and shows only the page, with a cursor and a next page", async () => {
            const em = mockEntityManager({ query: [LIST_PERSON_ORDERS, rows] })
            const orders = await build(em)

            const page = pageOfAnswer(await orders.list({ personId: "p-1", first: 2 }))

            expect(em.query).toHaveBeenCalledWith(LIST_PERSON_ORDERS, ["p-1", null, null, 3])
            expect(page.items.map((item) => item.orderId)).toEqual(["o-3", "o-2"])
            expect(page.items[0]).toEqual({
                orderId: "o-3",
                status: "pending",
                totalMinorUnits: 1250,
                currency: "USD",
                placedAt: "2026-10-24 03:00:00.000003+00",
            })
            expect(page.hasNextPage).toBe(true)
            expect(page.endCursor).not.toBeNull()
        })

        it("reads the first page when the client sends a null cursor", async () => {
            const em = mockEntityManager({ query: [LIST_PERSON_ORDERS, []] })
            const orders = await build(em)

            await orders.list({ personId: "p-1", first: 2, after: null })

            expect(em.query).toHaveBeenCalledWith(LIST_PERSON_ORDERS, ["p-1", null, null, 3])
        })

        it("says there is no next page when the read found no extra row", async () => {
            const orders = await build(mockEntityManager({ query: [LIST_PERSON_ORDERS, rows.slice(0, 2)] }))

            const page = pageOfAnswer(await orders.list({ personId: "p-1", first: 2 }))

            expect(page.hasNextPage).toBe(false)
        })

        it("answers an empty page with no cursor for a person without orders", async () => {
            const orders = await build(mockEntityManager({ query: [LIST_PERSON_ORDERS, []] }))

            expect(await orders.list({ personId: "p-9", first: 5 })).toEqual({
                kind: "ok",
                value: { items: [], endCursor: null, hasNextPage: false },
            })
        })
    })
}

const registerNextPageTests = (): void => {
    describe("the next page", () => {
        it("reads after the position the cursor of the page before names", async () => {
            const after = await cursorAfterTwo(KEY)
            const em = mockEntityManager({ query: [LIST_PERSON_ORDERS, rows.slice(2)] })
            const orders = await build(em)

            const page = pageOfAnswer(await orders.list({ personId: "p-1", first: 2, after }))

            expect(em.query).toHaveBeenCalledWith(LIST_PERSON_ORDERS, [
                "p-1",
                "2026-10-24 02:00:00.000002+00",
                "o-2",
                3,
            ])
            expect(page.items.map((item) => item.orderId)).toEqual(["o-1"])
            expect(page.hasNextPage).toBe(false)
        })

        it("refuses a cursor another key signed without reading", async () => {
            const forged = await cursorAfterTwo("another-key")
            const em = mockEntityManager()
            const orders = await build(em)

            expect(await orders.list({ personId: "p-1", first: 2, after: forged })).toBeRefused(
                OrderErrorCode.PageCursorInvalid,
            )
            expect(em.query).not.toHaveBeenCalled()
        })
    })
}

const registerPageSizeTests = (): void => {
    describe("the page size", () => {
        it.each([0, -1, 1.5, PAGE_SIZE_MAX + 1, Number.NaN])("refuses %s without reading", async (first) => {
            const em = mockEntityManager()
            const orders = await build(em)

            expect(await orders.list({ personId: "p-1", first })).toBeRefused({
                code: OrderErrorCode.PageSizeInvalid,
                params: { max: PAGE_SIZE_MAX },
            })
            expect(em.query).not.toHaveBeenCalled()
        })

        it("accepts the biggest page", async () => {
            const em = mockEntityManager({ query: [LIST_PERSON_ORDERS, []] })
            const orders = await build(em)

            await orders.list({ personId: "p-1", first: PAGE_SIZE_MAX })

            expect(em.query).toHaveBeenCalledWith(LIST_PERSON_ORDERS, ["p-1", null, null, PAGE_SIZE_MAX + 1])
        })
    })
}

describe("OrderListService", () => {
    registerFirstPageTests()
    registerNextPageTests()
    registerPageSizeTests()
})
