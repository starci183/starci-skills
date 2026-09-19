/**
 * Lane v7-10: what does the merged ecommerce-app-be actually serve on the wire, and what does each
 * ecommerce-app-fe page answer with? Every line is a raw observation from this run.
 */
const targets = [
  ['BE identity  GET /health', 'http://127.0.0.1:5070/health'],
  ['BE order     GET /health', 'http://127.0.0.1:6070/health'],
  ['BE order     GET /products  <- what apps/shop/src/modules/api/catalog.ts calls', 'http://127.0.0.1:6070/products'],
  ['BE identity  GET /me        <- what apps/shop/src/modules/api/identity.ts calls', 'http://127.0.0.1:5070/me'],
  ['BE order     GET /orders    <- what apps/shop/src/modules/api/orders.ts calls', 'http://127.0.0.1:6070/orders'],
  ['BE identity  GET /internal/sessions (graphql-only door check)', 'http://127.0.0.1:5070/graphql?query={__typename}'],
  ['FE landing   GET /en', 'http://127.0.0.1:3069/en'],
  ['FE shop      GET /en/browse', 'http://127.0.0.1:4069/en/browse'],
  ['FE shop      GET /en/cart', 'http://127.0.0.1:4069/en/cart'],
  ['FE shop      GET /en/checkout', 'http://127.0.0.1:4069/en/checkout'],
  ['FE shop      GET /en/account', 'http://127.0.0.1:4069/en/account'],
];
for (const [label, url] of targets) {
  try {
    const res = await fetch(url, {signal: AbortSignal.timeout(12000), redirect: 'manual'});
    const text = await res.text();
    const marker = /id="__next_error__"/.test(text) ? '  [NEXT ERROR PAGE]' : '';
    console.log(`${label}: HTTP ${res.status}${marker} ${text.replace(/\s+/g, ' ').slice(0, 170)}`);
  } catch (error) {
    console.log(`${label}: ERROR ${String(error?.message ?? error)}${error?.cause?.code ? ` (${error.cause.code})` : ''}`);
  }
}
