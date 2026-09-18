import { CartView } from '../../components/CartView';

// contract: cart persistence is deferred to the order-service session/cart workstream. How a cart
// survives a reload (client store vs. an order-service cart resource) is settled together with the
// landing → shop sign-in handoff, so this route ships the honest empty state rather than guessing
// storage.
const CartPage = () => <CartView />;

export default CartPage;
