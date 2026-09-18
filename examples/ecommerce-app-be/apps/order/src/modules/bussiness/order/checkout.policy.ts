import { Injectable } from '@nestjs/common';

export interface CartLineParams {
  productId: string;
  quantity: number;
}

export interface ProductStockParams {
  priceMinorUnits: number;
  stock: number;
}

export interface CheckoutLineParams {
  productId: string;
  quantity: number;
  unitPriceMinorUnits: number;
}

export interface CheckoutPlanResult {
  ok: true;
  lines: CheckoutLineParams[];
  totalMinorUnits: number;
  currency: 'USD';
}

export type CheckoutRefusalReason = 'cart-empty' | 'unknown-product' | 'insufficient-stock';

export interface CheckoutRefusalResult {
  ok: false;
  reason: CheckoutRefusalReason;
  productId: string;
  requested?: number;
  available?: number;
}

export type CheckoutEvaluationResult = CheckoutPlanResult | CheckoutRefusalResult;

/**
 * The pure decision of sds.checkout.order-flow - what a cart plus the catalog's truth yields:
 * a confirmed plan (lines priced in minor units, one total) or a named refusal. No I/O: the
 * transaction in order.service.ts consumes the plan and re-checks stock guardedly, so a race
 * between evaluation and decrement still refuses (ac.checkout.place-order's stock clause).
 */
@Injectable()
export class CheckoutPolicy {
  evaluate(cart: CartLineParams[], products: Record<string, ProductStockParams | undefined>): CheckoutEvaluationResult {
    if (cart.length === 0) {
      return { ok: false, reason: 'cart-empty', productId: '' };
    }
    const lines: CheckoutLineParams[] = [];
    let totalMinorUnits = 0;
    for (const line of cart) {
      if (line.quantity <= 0) {
        return { ok: false, reason: 'cart-empty', productId: line.productId };
      }
      const product = products[line.productId];
      if (!product) {
        return { ok: false, reason: 'unknown-product', productId: line.productId };
      }
      if (product.stock < line.quantity) {
        return {
          ok: false,
          reason: 'insufficient-stock',
          productId: line.productId,
          requested: line.quantity,
          available: product.stock,
        };
      }
      lines.push({ productId: line.productId, quantity: line.quantity, unitPriceMinorUnits: product.priceMinorUnits });
      totalMinorUnits += product.priceMinorUnits * line.quantity;
    }
    return { ok: true, lines, totalMinorUnits, currency: 'USD' };
  }
}
