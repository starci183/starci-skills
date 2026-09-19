// Lane probe: what does each door actually answer with the merged backend up?
const targets = [
  ['identity /health', 'http://127.0.0.1:5070/health'],
  ['order /health', 'http://127.0.0.1:6070/health'],
  ['order /products (what the fe browse page calls)', 'http://127.0.0.1:6070/products'],
  ['identity /me (what the fe account page calls)', 'http://127.0.0.1:5070/me'],
  ['order /orders (what the fe account page calls)', 'http://127.0.0.1:6070/orders'],
  ['order graphql POSTIntrospection', 'http://127.0.0.1:6070/graphql'],
  ['landing /', 'http://127.0.0.1:3069/'],
  ['shop /browse', 'http://127.0.0.1:4069/browse'],
  ['shop /en/browse', 'http://127.0.0.1:4069/en/browse'],
  ['shop /en/cart', 'http://127.0.0.1:4069/en/cart'],
  ['shop /en/checkout', 'http://127.0.0.1:4069/en/checkout'],
  ['shop /en/account', 'http://127.0.0.1:4069/en/account'],
];
for (const [label, url] of targets) {
  try {
    const res = await fetch(url, {signal: AbortSignal.timeout(9000), redirect: 'manual'});
    const text = await res.text();
    const body = text.replace(/\s+/g, ' ').slice(0, 300);
    console.log(`${label}: ${res.status} ${res.headers.get('location') ?? ''} :: ${body}`);
  } catch (error) {
    console.log(`${label}: ERROR ${String(error?.message ?? error)}`);
  }
}
