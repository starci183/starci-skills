import { redirect } from 'next/navigation';

/** The bare root route; it owns no UI of its own and only sends the visitor to sign-in. */
const RootPage = () => {
  redirect('/sign-in');
};

export default RootPage;
