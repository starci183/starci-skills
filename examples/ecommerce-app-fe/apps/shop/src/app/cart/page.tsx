import Link from 'next/link';
import { StateBlock } from '../../components/StateBlock';

// contract: cart persistence is deferred to the order-service session/cart workstream. How a cart survives a
// reload (client store vs. an order-service cart resource) is settled together with the landing → shop
// sign-in handoff, so this skeleton ships the route and its honest empty state rather than guessing storage.
const CartPage = () => (
  <>
    <h1 className="page-title">Cart</h1>
    <p className="page-sub">What you are about to order.</p>
    <StateBlock title="Your cart is empty">
      Items you add while browsing will appear here. <Link href="/browse">Back to browse →</Link>
    </StateBlock>
    <p className="notice" style={{ marginTop: 22 }}>
      Cart storage is not wired yet — it joins the order service in the same pass that settles sign-in.
    </p>
  </>
);

export default CartPage;
