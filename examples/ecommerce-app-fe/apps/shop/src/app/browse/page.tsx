import { ProductTile } from '../../components/ProductTile';
import { StateBlock } from '../../components/StateBlock';
import { fetchProducts } from '../../modules/api/catalog';
import { ORDER_API_URL } from '../../modules/config';

/**
 * Server-rendered on every request: the catalogue is the order service's data, not build-time content, so a
 * build must never bake it (and must never reach the network). `force-dynamic` keeps `next build` from
 * prerendering this fetch while the service is (legitimately) not up.
 */
export const dynamic = 'force-dynamic';

const BrowsePage = async () => {
  const result = await fetchProducts();

  if (!result.ok) {
    return (
      <>
        <h1 className="page-title">Browse</h1>
        <p className="page-sub">Everything Northwind stocks.</p>
        <p className="notice">
          The catalogue is served by the order API at <code>{ORDER_API_URL}</code>. It is not reachable
          right now ({result.reason}), so there is nothing to list yet.
        </p>
        <StateBlock title="No products to show">
          Start the order service, or point <code>NEXT_PUBLIC_ORDER_API_URL</code> at a running one, then
          reload.
        </StateBlock>
      </>
    );
  }

  if (result.data.length === 0) {
    return (
      <>
        <h1 className="page-title">Browse</h1>
        <p className="page-sub">Everything Northwind stocks.</p>
        <StateBlock title="The catalogue is empty">
          The order service answered, but it has no products yet.
        </StateBlock>
      </>
    );
  }

  return (
    <>
      <h1 className="page-title">Browse</h1>
      <p className="page-sub">Everything Northwind stocks — {result.data.length} items.</p>
      <div className="grid">
        {result.data.map((product) => (
          <ProductTile key={product.id} product={product} />
        ))}
      </div>
    </>
  );
};

export default BrowsePage;
