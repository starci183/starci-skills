import {
    Test 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    CartItemEntity 
} from "@modules/platform/databases/postgresql/order/entities/cart-item.entity"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/order/constants/connection"
import {
    CartService 
} from "./cart.service"

describe("CartService - sds.checkout.order-flow t-add",
    () => {
        const entityManager = {
            find: jest.fn(),
            findOneBy: jest.fn(),
            update: jest.fn(),
            insert: jest.fn(),
            delete: jest.fn(),
        }
        let service: CartService

        beforeEach(async () => {
            jest.clearAllMocks()
            const moduleRef = await Test.createTestingModule({
                providers: [
                    CartService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: entityManager 
                    },
                ],
            }).compile()
            service = moduleRef.get(CartService)
        })

        it("list answers the person's lines sorted by product id",
            async () => {
                entityManager.find.mockResolvedValue([
                    {
                        id: "row-1", personId: "person-1", productId: "sku-mug", quantity: 2 
                    },
                    {
                        id: "row-2", personId: "person-1", productId: "sku-thermos", quantity: 1 
                    },
                ])
                const items = await service.list("person-1")
                expect(entityManager.find).toHaveBeenCalledWith(CartItemEntity,
                    {
                        where: {
                            personId: "person-1" 
                        }, order: {
                            productId: "ASC" 
                        } 
                    })
                expect(items).toEqual([
                    {
                        productId: "sku-mug", quantity: 2 
                    },
                    {
                        productId: "sku-thermos", quantity: 1 
                    },
                ])
            })

        it("list of an empty cart is an empty array",
            async () => {
                entityManager.find.mockResolvedValue([])
                expect(await service.list("person-1")).toEqual([])
            })

        it("add on a fresh product inserts one row with the asked quantity",
            async () => {
                entityManager.findOneBy.mockResolvedValue(null)
                const item = await service.add("person-1",
                    "sku-mug",
                    3)
                expect(entityManager.findOneBy).toHaveBeenCalledWith(CartItemEntity,
                    {
                        personId: "person-1", productId: "sku-mug" 
                    })
                expect(entityManager.insert).toHaveBeenCalledWith(CartItemEntity,
                    {
                        personId: "person-1", productId: "sku-mug", quantity: 3 
                    })
                expect(entityManager.update).not.toHaveBeenCalled()
                expect(item).toEqual({
                    productId: "sku-mug", quantity: 3 
                })
            })

        it("add on a held product accumulates onto the existing row (upsert on person+product)",
            async () => {
                entityManager.findOneBy.mockResolvedValue({
                    id: "row-1", personId: "person-1", productId: "sku-mug", quantity: 2 
                })
                const item = await service.add("person-1",
                    "sku-mug",
                    3)
                expect(entityManager.update).toHaveBeenCalledWith(CartItemEntity,
                    {
                        id: "row-1" 
                    },
                    {
                        quantity: 5 
                    })
                expect(entityManager.insert).not.toHaveBeenCalled()
                expect(item).toEqual({
                    productId: "sku-mug", quantity: 5 
                })
            })

        it("clear removes every line the person holds",
            async () => {
                await service.clear("person-1")
                expect(entityManager.delete).toHaveBeenCalledWith(CartItemEntity,
                    {
                        personId: "person-1" 
                    })
            })

        it("two adds racing the same new product: the loser's unique refusal reaches the caller instead of a silent merge",
            async () => {
                // Both reads see no row, so both take the insert path - the unique constraint decides.
                entityManager.findOneBy.mockResolvedValue(null)
                entityManager.insert
                    .mockResolvedValueOnce(undefined)
                    .mockRejectedValueOnce(new Error("duplicate key value violates unique constraint \"cart_item_person_product_key\""))

                const [winner,
                    loser] = await Promise.allSettled([
                    service.add("person-1",
                        "sku-mug",
                        1),
                    service.add("person-1",
                        "sku-mug",
                        1),
                ])

                expect(entityManager.insert).toHaveBeenCalledTimes(2)
                expect(winner.status).toBe("fulfilled")
                expect(loser.status).toBe("rejected")
                expect((loser as PromiseRejectedResult).reason).toBeInstanceOf(Error)
                expect(((loser as PromiseRejectedResult).reason as Error).message).toContain("duplicate key")
            })

        it("a persistence refusal on the upsert read propagates instead of answering a phantom quantity",
            async () => {
                const failure = new Error("connection reset")
                entityManager.findOneBy.mockRejectedValue(failure)

                await expect(service.add("person-1",
                    "sku-mug",
                    1)).rejects.toBe(failure)
                expect(entityManager.insert).not.toHaveBeenCalled()
                expect(entityManager.update).not.toHaveBeenCalled()
            })
    })
