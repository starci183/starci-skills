import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual } from 'typeorm';
import {
  CartItemEntity,
  OrderEntity,
  OrderLineEntity,
  PaymentEntity,
  POSTGRESQL_PRIMARY,
  ProductEntity,
} from '../../platform/databases/postgresql/primary';
import { CatalogService } from '../catalog';
import { CartService } from '../cart';
import { PaymentService } from '../payment';
import { CheckoutPolicy } from './checkout.policy';
import { CheckoutRefusalException } from './checkout-refusal.exception';

export interface PlaceOrderResult {
  orderId: string;
  status: 'confirmed';
  totalMinorUnits: number;
  currency: 'USD';
  paymentId: string;
  replayed: boolean;
}

export interface BuyerStatusResult {
  personId: string;
  hasOrders: boolean;
}

/**
 * The confirmation of sds.checkout.order-flow - t-stock, t-pay, t-confirm in one transaction:
 * the policy's plan consumes guarded stock, writes the order and its lines, captures the
 * internal payment and clears the cart. A refusal at any step rolls the whole thing back, so a
 * person who was refused keeps the cart and no stock moved. The idempotency key makes a replay
 * return the first answer instead of a second order.
 */
@Injectable()
export class OrderService {
  constructor(
    @InjectDataSource(POSTGRESQL_PRIMARY) private readonly dataSource: DataSource,
    private readonly cart: CartService,
    private readonly catalog: CatalogService,
    private readonly payments: PaymentService,
    private readonly policy: CheckoutPolicy,
  ) {}

  async place(personId: string, idempotencyKey?: string): Promise<PlaceOrderResult> {
    if (idempotencyKey) {
      const existing = await this.orders().findOneBy({ personId, idempotencyKey });
      if (existing) return this.snapshot(existing, true);
    }
    const cartLines = await this.cart.list(personId);
    const products = await this.catalog.byIds(cartLines.map((line) => line.productId));
    const evaluation = this.policy.evaluate(cartLines, products);
    if (!evaluation.ok) throw new CheckoutRefusalException(evaluation);

    try {
      const orderId = await this.dataSource.transaction(async (manager) => {
        for (const line of evaluation.lines) {
          const spent = await manager
            .getRepository(ProductEntity)
            .decrement({ id: line.productId, stock: MoreThanOrEqual(line.quantity) }, 'stock', line.quantity);
          if (!spent.affected) {
            throw new CheckoutRefusalException({ ok: false, reason: 'insufficient-stock', productId: line.productId, requested: line.quantity });
          }
        }
        const order = await manager.getRepository(OrderEntity).save(
          manager.getRepository(OrderEntity).create({
            personId,
            status: 'confirmed',
            totalMinorUnits: evaluation.totalMinorUnits,
            currency: evaluation.currency,
            idempotencyKey: idempotencyKey ?? null,
          }),
        );
        await manager.getRepository(OrderLineEntity).save(
          evaluation.lines.map((line) =>
            manager.getRepository(OrderLineEntity).create({
              orderId: order.id,
              productId: line.productId,
              quantity: line.quantity,
              unitPriceMinorUnits: line.unitPriceMinorUnits,
            }),
          ),
        );
        await this.payments.capture(manager, personId, order.id, evaluation.totalMinorUnits);
        await manager.getRepository(CartItemEntity).delete({ personId });
        return order.id;
      });
      const order = await this.orders().findOneByOrFail({ id: orderId });
      return this.snapshot(order, false);
    } catch (error) {
      // A concurrent replay of the same key surfaces as the unique violation; both answers are the same order.
      if (idempotencyKey && /uq_sales_order_idempotency|duplicate key/i.test(String((error as Error)?.message))) {
        const existing = await this.orders().findOneBy({ personId, idempotencyKey });
        if (existing) return this.snapshot(existing, true);
      }
      throw error;
    }
  }

  /** The provider half of contract.checkout.order-for-identity: how many orders, so hasOrders. */
  async buyerStatus(personId: string): Promise<BuyerStatusResult> {
    const count = await this.orders().countBy({ personId });
    return { personId, hasOrders: count > 0 };
  }

  private orders() {
    return this.dataSource.getRepository(OrderEntity);
  }

  private async snapshot(order: OrderEntity, replayed: boolean): Promise<PlaceOrderResult> {
    const payment = await this.dataSource.getRepository(PaymentEntity).findOneBy({ orderId: order.id });
    return {
      orderId: order.id,
      status: order.status,
      totalMinorUnits: order.totalMinorUnits,
      currency: order.currency as 'USD',
      paymentId: payment?.id ?? '',
      replayed,
    };
  }
}
