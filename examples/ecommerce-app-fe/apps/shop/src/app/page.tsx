import { redirect } from 'next/navigation';

/** The bare shop route owns no UI of its own and opens on the catalogue. */
const ShopIndexPage = () => {
  redirect('/browse');
};

export default ShopIndexPage;
