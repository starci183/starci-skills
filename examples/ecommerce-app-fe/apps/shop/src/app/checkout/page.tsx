import Link from 'next/link';
import { StateBlock } from '../../components/StateBlock';

// contract: checkout places an order against the order service for the signed-in customer. Both its
// preconditions — the session handoff (identity, 5070) and a non-empty cart (see the cart route) — are
// backend contracts still being settled, so this route proves the navigation and its honest blocked state
// without inventing a submit endpoint or a fake "order placed" success.
const CheckoutPage = () => (
  <>
    <h1 className="page-title">Checkout</h1>
    <p className="page-sub">Review and place your order.</p>
    <StateBlock title="Nothing to check out yet">
      Add items from{' '}
      <Link href="/browse">browse</Link>
      {' '}and make sure you are signed in on your{' '}
      <Link href="/account">account</Link>.
    </StateBlock>
    <p className="notice" style={{ marginTop: 22 }}>
      Order submission opens once the session handoff and cart persistence land in the order service.
    </p>
  </>
);

export default CheckoutPage;
