import {
    Injectable 
} from "@nestjs/common"
import {
    EntityManager, MoreThanOrEqual 
} from "typeorm"
import {
    CartItemEntity 
} from "ecommerce-app-be/modules/platform/databases/postgresql/order"
import {
    OrderEntity 
} from "ecommerce-app-be/modules/platform/databases/postgresql/order"
import {
    OrderLineEntity 
} from "ecommerce-app-be/modules/platform/databases/postgresql/order"
import {
    PaymentEntity 
} from "ecommerce-app-be/modules/platform/databases/postgresql/order"
import {
    ProductEntity 
} from "ecommerce-app-be/modules/platform/databases/postgresql/order"
import {
    InjectPrimaryEntityManager 
} from "ecommerce-app-be/modules/platform/databases/postgresql/order"
import {
    CatalogService 
} from "ecommerce-app-be/modules/domain/catalog"
import {
    CartService 
} from "ecommerce-app-be/modules/domain/cart"
import {
    PaymentService 
} from "ecommerce-app-be/modules/domain/payment"
import {
    CheckoutPolicy 
} from "./checkout.policy"
import {
    CheckoutRefusalException 
} from "ecommerce-app-be/modules/platform/errors"

/** The confirmation a door answers: the order id, total, payment id and whether this was a replay. */
export interface PlaceOrderResult {
  orderId: string;
  status: "confirmed";
  totalMinorUnits: number;
  currency: "USD";
  paymentId: string;
  replayed: boolean;
}

/** The buyer-status answer contract.checkout.order-for-identity provides: does this person have orders. */
export interface BuyerStatusResult {
  personId: string;
  hasOrders: boolean;
}

@Injectable()
/**
 * The confirmation of sds.checkout.order-flow - t-stock, t-pay, t-confirm in one transaction:
 * the policy's plan consumes guarded stock, writes the order and its lines, captures the
 * internal payment and clears the cart. A refusal at any step rolls the whole thing back, so a
 * person who was refused keeps the cart and no stock moved. The idempotency key makes a replay
 * return the first answer instead of a second order.
 */
export class OrderService {
    constructor(
    @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    private readonly cart: CartService,
    private readonly catalog: CatalogService,
    private readonly payments: PaymentService,
    private readonly policy: CheckoutPolicy,
    ) {}

    async place(personId: string, idempotencyKey?: string): Promise<PlaceOrderResult> {
        if (idempotencyKey) {
            const existing = await this.entityManager.findOneBy(OrderEntity,
                {
                    personId, idempotencyKey 
                })
            if (existing) return this.snapshot(existing,
                true)
        }
        const cartLines = await this.cart.list(personId)
        const products = await this.catalog.byIds(cartLines.map((line) => line.productId))
        const evaluation = this.policy.evaluate(cartLines,
            products)
        if (!evaluation.ok) {
            throw new CheckoutRefusalException({
                ...evaluation 
            })
        }

        try {
            const orderId = await this.entityManager.transaction(async (manager) => {
                for (const line of evaluation.lines) {
                    const spent = await manager
                        .decrement(ProductEntity, {
                            id: line.productId, stock: MoreThanOrEqual(line.quantity) 
                        },
                        "stock",
                        line.quantity)
                    if (!spent.affected) {
                        throw new CheckoutRefusalException({
                            ok: false, reason: "insufficient-stock", productId: line.productId, requested: line.quantity 
                        })
                    }
                }
                const order = await manager.save(OrderEntity,
                    manager.create(OrderEntity, {
                        personId,
                        status: "confirmed",
                        totalMinorUnits: evaluation.totalMinorUnits,
                        currency: evaluation.currency,
                        idempotencyKey: idempotencyKey ?? null,
                    }),
                )
                await manager.save(OrderLineEntity,
                    evaluation.lines.map((line) =>
                        manager.create(OrderLineEntity, {
                            orderId: order.id,
                            productId: line.productId,
                            quantity: line.quantity,
                            unitPriceMinorUnits: line.unitPriceMinorUnits,
                        }),
                    ),
                )
                await this.payments.capture(manager,
                    personId,
                    order.id,
                    evaluation.totalMinorUnits)
                await manager.delete(CartItemEntity, {
                    personId 
                })
                return order.id
            })
            const order = await this.entityManager.findOneByOrFail(OrderEntity,
                {
                    id: orderId 
                })
            return this.snapshot(order,
                false)
        } catch (error) {
            // A concurrent replay of the same key surfaces as the unique violation; both answers are the same order.
            if (idempotencyKey && /uq_sales_order_idempotency|duplicate key/i.test(String((error as Error)?.message))) {
                const existing = await this.entityManager.findOneBy(OrderEntity,
                    {
                        personId, idempotencyKey 
                    })
                if (existing) return this.snapshot(existing,
                    true)
            }
            throw error
        }
    }

    /** The provider half of contract.checkout.order-for-identity: how many orders, so hasOrders. */
    async buyerStatus(personId: string): Promise<BuyerStatusResult> {
        const count = await this.entityManager.countBy(OrderEntity,
            {
                personId 
            })
        return {
            personId, hasOrders: count > 0 
        }
    }

    private async snapshot(order: OrderEntity, replayed: boolean): Promise<PlaceOrderResult> {
        const payment = await this.entityManager.findOneBy(PaymentEntity,
            {
                orderId: order.id 
            })
        return {
            orderId: order.id,
            status: order.status,
            totalMinorUnits: order.totalMinorUnits,
            currency: order.currency as "USD",
            paymentId: payment?.id ?? "",
            replayed,
        }
    }
}
