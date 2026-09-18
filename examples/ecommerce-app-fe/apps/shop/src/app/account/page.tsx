import { AccountView } from '../../components/AccountView';
import { fetchOrders } from '../../modules/api/orders';
import { fetchCurrentUser } from '../../modules/api/identity';
import { IDENTITY_API_URL, ORDER_API_URL } from '../../modules/config';

export const dynamic = 'force-dynamic';

const AccountPage = async () => {
  const [who, orders] = await Promise.all([fetchCurrentUser(), fetchOrders()]);
  return (
    <AccountView
      who={who}
      orders={orders}
      identityApiUrl={IDENTITY_API_URL}
      orderApiUrl={ORDER_API_URL}
    />
  );
};

export default AccountPage;
