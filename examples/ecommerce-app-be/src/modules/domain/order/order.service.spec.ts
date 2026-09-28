import {
    Test 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    EntityManager 
} from "typeorm"
import {
    CartItemEntity 
} from "@modules/platform/databases/postgresql/order/entities/cart-item.entity"
import {
    OrderEntity 
} from "@modules/platform/databases/postgresql/order/entities/order.entity"
import {
    OrderLineEntity 
} from "@modules/platform/databases/postgresql/order/entities/order-line.entity"
import {
    PaymentEntity 
} from "@modules/platform/databases/postgresql/order/entities/payment.entity"
import {
    ProductEntity 
} from "@modules/platform/databases/postgresql/order/entities/product.entity"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/order/constants/connection"
import {
    CartService 
} from "../cart/cart.service"
import {
    CatalogService 
} from "../catalog/catalog.service"
import {
    PaymentService 
} from "../payment/payment.service"
import {
    CheckoutPolicy 
} from "./checkout.policy"
import {
    CheckoutRefusalException 
} from "@modules/platform/exceptions/errors/checkout/checkout-refusal"
import {
    OrderService 
} from "./order.service"

/**
 * The confirmation of sds.checkout.order-flow with persistence mocked at the provider boundary:
 * the DataSource and its transaction are useValue mocks, so the suite proves call order, the
 * guarded decrement, rollback-on-refusal and the idempotent replay without a live Postgres.
 */
describe("OrderService - sds.checkout.order-flow t-stock, t-pay, t-confirm",
    () => {
        const cartService = {
            list: jest.fn(), clear: jest.fn() 
        }
        const catalogService = {
            byIds: jest.fn() 
        }
        const paymentService = {
            capture: jest.fn() 
        }

        const productTx = {
            decrement: jest.fn() 
        }
        const orderTx = {
            create: jest.fn((value: object) => value), save: jest.fn() 
        }
        const orderLineTx = {
            create: jest.fn((value: object) => value), save: jest.fn() 
        }
        const cartItemTx = {
            delete: jest.fn() 
        }
        const txRepositories = new Map<object, object>([
            [ProductEntity,
                productTx],
            [OrderEntity,
                orderTx],
            [OrderLineEntity,
                orderLineTx],
            [CartItemEntity,
                cartItemTx],
        ])
        const manager = {
            getRepository: jest.fn((entity: object) => txRepositories.get(entity)) 
        } as unknown as EntityManager

        const ordersRepository = {
            findOneBy: jest.fn(), findOneByOrFail: jest.fn(), countBy: jest.fn() 
        }
        const paymentsRepository = {
            findOneBy: jest.fn() 
        }
        const entityManager = {
            findOneBy: jest.fn((entity: object, criteria: unknown) => {
                if (entity === OrderEntity) return ordersRepository.findOneBy(criteria)
                if (entity === PaymentEntity) return paymentsRepository.findOneBy(criteria)
                return undefined
            }),
            findOneByOrFail: jest.fn((_entity: object, criteria: unknown) => ordersRepository.findOneByOrFail(criteria)),
            countBy: jest.fn((_entity: object, criteria: unknown) => ordersRepository.countBy(criteria)),
            transaction: jest.fn(),
        }

        let service: OrderService

        beforeEach(async () => {
            jest.clearAllMocks()
            entityManager.transaction.mockImplementation((work: (m: EntityManager) => Promise<unknown>) => work(manager))
            const moduleRef = await Test.createTestingModule({
                providers: [
                    OrderService,
                    CheckoutPolicy,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: entityManager 
                    },
                    {
                        provide: CartService, useValue: cartService 
                    },
                    {
                        provide: CatalogService, useValue: catalogService 
                    },
                    {
                        provide: PaymentService, useValue: paymentService 
                    },
                ],
            }).compile()
            service = moduleRef.get(OrderService)
        })

        function cartAndCatalog() {
            cartService.list.mockResolvedValue([{
                productId: "sku-mug", quantity: 2 
            }])
            catalogService.byIds.mockResolvedValue({
                "sku-mug": {
                    priceMinorUnits: 1299, stock: 40 
                } 
            })
            productTx.decrement.mockResolvedValue({
                affected: 1 
            })
            orderTx.save.mockResolvedValue({
                id: "order-1" 
            })
            ordersRepository.findOneByOrFail.mockResolvedValue({
                id: "order-1",
                personId: "person-1",
                status: "confirmed",
                totalMinorUnits: 2598,
                currency: "USD",
                idempotencyKey: null,
            })
            paymentsRepository.findOneBy.mockResolvedValue({
                id: "payment-1", orderId: "order-1" 
            })
            paymentService.capture.mockResolvedValue({
                paymentId: "payment-1", status: "captured", amountMinorUnits: 2598 
            })
        }

        it("fr.checkout.place-order: stock decrement, order+lines, capture and cart clear all inside one transaction",
            async () => {
                cartAndCatalog()
                const result = await service.place("person-1")

                expect(result).toEqual({
                    orderId: "order-1",
                    status: "confirmed",
                    totalMinorUnits: 2598,
                    currency: "USD",
                    paymentId: "payment-1",
                    replayed: false,
                })
                const criteria = productTx.decrement.mock.calls[0][0] as Record<string, unknown>
                expect(criteria.id).toBe("sku-mug")
                expect(criteria.stock).toBeDefined()
                expect(productTx.decrement.mock.calls[0][1]).toBe("stock")
                expect(productTx.decrement.mock.calls[0][2]).toBe(2)
                expect(orderTx.save).toHaveBeenCalledWith(
                    expect.objectContaining({
                        personId: "person-1", status: "confirmed", totalMinorUnits: 2598, currency: "USD", idempotencyKey: null 
                    }),
                )
                expect(orderLineTx.save).toHaveBeenCalledWith([
                    expect.objectContaining({
                        orderId: "order-1", productId: "sku-mug", quantity: 2, unitPriceMinorUnits: 1299 
                    }),
                ])
                expect(paymentService.capture).toHaveBeenCalledWith(manager,
                    "person-1",
                    "order-1",
                    2598)
                expect(cartItemTx.delete).toHaveBeenCalledWith({
                    personId: "person-1" 
                })
            })

        it("ac.checkout.place-order.empty-cart-is-refused: a policy refusal throws CheckoutRefusalException and never opens the transaction",
            async () => {
                cartService.list.mockResolvedValue([])
                catalogService.byIds.mockResolvedValue({
                })
                await expect(service.place("person-1")).rejects.toMatchObject({
                    response: expect.objectContaining({
                        code: "CHECKOUT_REFUSAL_EXCEPTION", reason: "cart-empty" 
                    }),
                })
                expect(entityManager.transaction).not.toHaveBeenCalled()
                expect(paymentService.capture).not.toHaveBeenCalled()
            })

        it("a cart line the catalog does not know refuses before any transaction opens",
            async () => {
                cartService.list.mockResolvedValue([{
                    productId: "sku-ghost", quantity: 1 
                }])
                catalogService.byIds.mockResolvedValue({
                })
                await expect(service.place("person-1")).rejects.toMatchObject({
                    response: expect.objectContaining({
                        code: "CHECKOUT_REFUSAL_EXCEPTION", reason: "unknown-product", productId: "sku-ghost" 
                    }),
                })
                expect(entityManager.transaction).not.toHaveBeenCalled()
                expect(paymentService.capture).not.toHaveBeenCalled()
            })

        it("ac.checkout.place-order.stock-is-checked-at-confirmation: a guarded decrement that moves no row refuses inside the transaction",
            async () => {
                cartAndCatalog()
                productTx.decrement.mockResolvedValue({
                    affected: 0 
                })
                await expect(service.place("person-1")).rejects.toBeInstanceOf(CheckoutRefusalException)
                expect(orderTx.save).not.toHaveBeenCalled()
                expect(paymentService.capture).not.toHaveBeenCalled()
                expect(cartItemTx.delete).not.toHaveBeenCalled()
            })

        it("a later line whose stock moved between evaluation and decrement refuses for that product - earlier lines never become a partial order",
            async () => {
                cartService.list.mockResolvedValue([
                    {
                        productId: "sku-mug", quantity: 1 
                    },
                    {
                        productId: "sku-thermos", quantity: 5 
                    },
                ])
                catalogService.byIds.mockResolvedValue({
                    "sku-mug": {
                        priceMinorUnits: 1299, stock: 40 
                    },
                    "sku-thermos": {
                        priceMinorUnits: 2499, stock: 5 
                    },
                })
                productTx.decrement
                    .mockResolvedValueOnce({
                        affected: 1 
                    })
                    .mockResolvedValueOnce({
                        affected: 0 
                    })
                orderTx.save.mockResolvedValue({
                    id: "order-1" 
                })

                await expect(service.place("person-1")).rejects.toMatchObject({
                    response: expect.objectContaining({
                        code: "CHECKOUT_REFUSAL_EXCEPTION",
                        reason: "insufficient-stock",
                        productId: "sku-thermos",
                        requested: 5,
                    }),
                })
                expect(productTx.decrement).toHaveBeenCalledTimes(2)
                expect(orderTx.save).not.toHaveBeenCalled()
                expect(paymentService.capture).not.toHaveBeenCalled()
                expect(cartItemTx.delete).not.toHaveBeenCalled()
            })

        it("a capture failure inside the transaction rolls the whole confirmation back - the order never lands and the cart is never cleared",
            async () => {
                cartAndCatalog()
                const failure = new Error("ledger write refused")
                paymentService.capture.mockRejectedValue(failure)

                await expect(service.place("person-1")).rejects.toBe(failure)
                expect(orderTx.save).toHaveBeenCalled()
                expect(orderLineTx.save).toHaveBeenCalled()
                expect(cartItemTx.delete).not.toHaveBeenCalled()
            })

        it("an Idempotency-Key replay returns the first answer without opening a transaction",
            async () => {
                ordersRepository.findOneBy.mockResolvedValue({
                    id: "order-1",
                    personId: "person-1",
                    status: "confirmed",
                    totalMinorUnits: 2598,
                    currency: "USD",
                    idempotencyKey: "key-1",
                })
                paymentsRepository.findOneBy.mockResolvedValue({
                    id: "payment-1", orderId: "order-1" 
                })

                const result = await service.place("person-1",
                    "key-1")

                expect(result).toEqual({
                    orderId: "order-1",
                    status: "confirmed",
                    totalMinorUnits: 2598,
                    currency: "USD",
                    paymentId: "payment-1",
                    replayed: true,
                })
                expect(ordersRepository.findOneBy).toHaveBeenCalledWith({
                    personId: "person-1", idempotencyKey: "key-1" 
                })
                expect(entityManager.transaction).not.toHaveBeenCalled()
                expect(cartService.list).not.toHaveBeenCalled()
            })

        it("a concurrent replay surfacing as the unique violation answers the same order, marked replayed",
            async () => {
                cartAndCatalog()
                entityManager.transaction.mockRejectedValue(new Error("duplicate key value violates unique constraint \"uq_sales_order_idempotency\""))
                ordersRepository.findOneBy
                    .mockResolvedValueOnce(null)
                    .mockResolvedValueOnce({
                        id: "order-1",
                        personId: "person-1",
                        status: "confirmed",
                        totalMinorUnits: 2598,
                        currency: "USD",
                        idempotencyKey: "key-1",
                    })

                const result = await service.place("person-1",
                    "key-1")

                expect(result).toMatchObject({
                    orderId: "order-1", replayed: true 
                })
            })

        it("a replayed order whose ledger row never landed still answers, with an empty paymentId",
            async () => {
                ordersRepository.findOneBy.mockResolvedValue({
                    id: "order-1",
                    personId: "person-1",
                    status: "confirmed",
                    totalMinorUnits: 2598,
                    currency: "USD",
                    idempotencyKey: "key-1",
                })
                paymentsRepository.findOneBy.mockResolvedValue(null)

                const result = await service.place("person-1",
                    "key-1")

                expect(result).toEqual({
                    orderId: "order-1",
                    status: "confirmed",
                    totalMinorUnits: 2598,
                    currency: "USD",
                    paymentId: "",
                    replayed: true,
                })
                expect(entityManager.transaction).not.toHaveBeenCalled()
            })

        it("a transaction failure that is not the idempotency violation propagates unchanged",
            async () => {
                cartAndCatalog()
                const failure = new Error("connection reset")
                entityManager.transaction.mockRejectedValue(failure)
                ordersRepository.findOneBy.mockResolvedValue(null)
                await expect(service.place("person-1",
                    "key-1")).rejects.toBe(failure)
            })

        it("contract.checkout.order-for-identity provider: buyerStatus counts confirmed orders into hasOrders",
            async () => {
                ordersRepository.countBy.mockResolvedValue(3)
                expect(await service.buyerStatus("person-1")).toEqual({
                    personId: "person-1", hasOrders: true 
                })
                expect(ordersRepository.countBy).toHaveBeenCalledWith({
                    personId: "person-1" 
                })

                ordersRepository.countBy.mockResolvedValue(0)
                expect(await service.buyerStatus("person-2")).toEqual({
                    personId: "person-2", hasOrders: false 
                })
            })
    })
