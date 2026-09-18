import { CheckoutView } from '../../components/CheckoutView';

// contract: checkout places an order against the order service for the signed-in customer. Both its
// preconditions - the session handoff (identity) and a non-empty cart (see the cart route) - are
// backend contracts still being settled, so this route proves the navigation and its honest blocked
// state without inventing a submit endpoint or a fake "order placed" success.
const CheckoutPage = () => <CheckoutView />;

export default CheckoutPage;
