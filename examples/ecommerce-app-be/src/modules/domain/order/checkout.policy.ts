import {
    Injectable 
} from "@nestjs/common"

/** One cart line as the policy sees it: which product, how many. */
export interface CartLineParams {
  productId: string;
  quantity: number;
}

/** The catalog truth the policy prices and guards against, per product id. */
export interface ProductStockParams {
  priceMinorUnits: number;
  stock: number;
}

/** A priced cart line - the catalog's unit price captured at evaluation time. */
export interface CheckoutLineParams {
  productId: string;
  quantity: number;
  unitPriceMinorUnits: number;
}

/** The accept half of evaluate(): every line priced, one total, USD only. */
export interface CheckoutPlanResult {
  ok: true;
  lines: Array<CheckoutLineParams>;
  totalMinorUnits: number;
  currency: "USD";
}

/** The named reason a confirmation is refused - surfaced verbatim on the wire. */
export type CheckoutRefusalReason = "cart-empty" | "unknown-product" | "insufficient-stock";

/** The refuse half of evaluate(): the reason plus the line that caused it. */
export interface CheckoutRefusalResult {
  ok: false;
  reason: CheckoutRefusalReason;
  productId: string;
  requested?: number;
  available?: number;
}

/** What evaluate() returns: either a plan the transaction can write or a refusal it throws. */
export type CheckoutEvaluationResult = CheckoutPlanResult | CheckoutRefusalResult;

@Injectable()
/**
 * The pure decision of sds.checkout.order-flow - what a cart plus the catalog's truth yields:
 * a confirmed plan (lines priced in minor units, one total) or a named refusal. No I/O: the
 * transaction in order.service.ts consumes the plan and re-checks stock guardedly, so a race
 * between evaluation and decrement still refuses (ac.checkout.place-order's stock clause).
 */
export class CheckoutPolicy {
    evaluate(cart: Array<CartLineParams>, products: Record<string, ProductStockParams | undefined>): CheckoutEvaluationResult {
        if (cart.length === 0) {
            return {
                ok: false, reason: "cart-empty", productId: "" 
            }
        }
        const lines: Array<CheckoutLineParams> = []
        let totalMinorUnits = 0
        for (const line of cart) {
            if (line.quantity <= 0) {
                return {
                    ok: false, reason: "cart-empty", productId: line.productId 
                }
            }
            const product = products[line.productId]
            if (!product) {
                return {
                    ok: false, reason: "unknown-product", productId: line.productId 
                }
            }
            if (product.stock < line.quantity) {
                return {
                    ok: false,
                    reason: "insufficient-stock",
                    productId: line.productId,
                    requested: line.quantity,
                    available: product.stock,
                }
            }
            lines.push({
                productId: line.productId, quantity: line.quantity, unitPriceMinorUnits: product.priceMinorUnits 
            })
            totalMinorUnits += product.priceMinorUnits * line.quantity
        }
        return {
            ok: true, lines, totalMinorUnits, currency: "USD" 
        }
    }
}
