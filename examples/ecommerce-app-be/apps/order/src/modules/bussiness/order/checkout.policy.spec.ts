import { CheckoutPolicy, CartLineParams, ProductStockParams } from './checkout.policy';

describe('CheckoutPolicy - sds.checkout.order-flow t-stock', () => {
  const policy = new CheckoutPolicy();
  const products: Record<string, ProductStockParams | undefined> = {
    'sku-mug': { priceMinorUnits: 1299, stock: 40 },
    'sku-thermos': { priceMinorUnits: 2499, stock: 2 },
  };

  it('fr.checkout.place-order plans a cart in minor units: totals and per-line unit prices', () => {
    const cart: CartLineParams[] = [
      { productId: 'sku-mug', quantity: 2 },
      { productId: 'sku-thermos', quantity: 1 },
    ];
    const plan = policy.evaluate(cart, products);
    expect(plan).toEqual({
      ok: true,
      lines: [
        { productId: 'sku-mug', quantity: 2, unitPriceMinorUnits: 1299 },
        { productId: 'sku-thermos', quantity: 1, unitPriceMinorUnits: 2499 },
      ],
      totalMinorUnits: 1299 * 2 + 2499,
      currency: 'USD',
    });
  });

  it('ac.checkout.place-order.empty-cart-is-refused', () => {
    const refusal = policy.evaluate([], products);
    expect(refusal).toEqual({ ok: false, reason: 'cart-empty', productId: '' });
  });

  it('ac.checkout.place-order.stock-is-checked-at-confirmation: the refusal names the product and the truth', () => {
    const refusal = policy.evaluate([{ productId: 'sku-thermos', quantity: 5 }], products);
    expect(refusal).toEqual({
      ok: false,
      reason: 'insufficient-stock',
      productId: 'sku-thermos',
      requested: 5,
      available: 2,
    });
  });

  it('sds.checkout.order-flow t-refuse: an unknown product is a named refusal, never a partial order', () => {
    const refusal = policy.evaluate([{ productId: 'sku-ghost', quantity: 1 }], products);
    expect(refusal).toEqual({ ok: false, reason: 'unknown-product', productId: 'sku-ghost' });
  });
});
