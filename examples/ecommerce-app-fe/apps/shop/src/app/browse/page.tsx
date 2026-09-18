import { BrowseView } from '../../components/BrowseView';
import { fetchProducts } from '../../modules/api/catalog';
import { ORDER_API_URL } from '../../modules/config';

/**
 * Server-rendered on every request: the catalogue is the order service's data, not build-time
 * content, so a build must never bake it (and must never reach the network). `force-dynamic` keeps
 * `next build` from prerendering this fetch while the service is (legitimately) not up. The result
 * - payload or refusal - crosses into the client view verbatim.
 */
export const dynamic = 'force-dynamic';

const BrowsePage = async () => {
  const result = await fetchProducts();
  return <BrowseView result={result} orderApiUrl={ORDER_API_URL} />;
};

export default BrowsePage;
