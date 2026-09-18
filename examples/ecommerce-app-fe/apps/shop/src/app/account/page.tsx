import { StateBlock } from '../../components/StateBlock';
import { fetchOrders } from '../../modules/api/orders';
import { fetchCurrentUser } from '../../modules/api/identity';
import { formatPrice } from '../../modules/money';
import { IDENTITY_API_URL, ORDER_API_URL } from '../../modules/config';

export const dynamic = 'force-dynamic';

const AccountPage = async () => {
  const [who, orders] = await Promise.all([fetchCurrentUser(), fetchOrders()]);

  const account = who.ok
    ? who.data
      ? <p className="page-sub">Signed in as <strong>{who.data.name}</strong> ({who.data.email}).</p>
      : <p className="page-sub">You are browsing anonymously.</p>
    : <p className="page-sub">The account service at <code>{IDENTITY_API_URL}</code> is not reachable ({who.reason}).</p>;

  // contract: anonymous browsing is only possible because the landing → shop session handoff is not settled
  // yet; see modules/api/identity.ts. Until it is, an authenticated viewer is not invented client-side.
  const ordersView = !orders.ok ? (
    <StateBlock title="No orders to show">
      The order service at <code>{ORDER_API_URL}</code> is not reachable ({orders.reason}).
    </StateBlock>
  ) : orders.data.length === 0 ? (
    <StateBlock title="No orders yet">
      When you place an order it will be listed here.
    </StateBlock>
  ) : (
    <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {orders.data.map((order) => (
        <li className="row" key={order.id}>
          <span>
            <strong>Order {order.id}</strong>
            <span className="muted"> · {order.lines.length} line{order.lines.length === 1 ? '' : 's'}</span>
          </span>
          <span>
            <span className="badge">{order.status}</span>{' '}
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPrice(order.totalCents, order.currency)}</strong>
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <h1 className="page-title">Account</h1>
      {account}
      <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', margin: '26px 0 12px' }}>
        Order history
      </h2>
      {ordersView}
    </>
  );
};

export default AccountPage;
