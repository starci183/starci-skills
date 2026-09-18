import { formatPrice } from '../modules/money';
import type { Product } from '../modules/api/catalog';

type ProductTileProps = {
  readonly product: Product;
};

/**
 * A browse catalogue tile. The initial letter stands in for product imagery so the skeleton ships no broken
 * or fabricated image URL even when the `order` service returns rows without an `imageUrl`.
 */
export const ProductTile = ({ product }: ProductTileProps) => (
  <article className="card">
    <div className="thumb" aria-hidden="true">{product.name.slice(0, 1).toUpperCase()}</div>
    <div className="body">
      <h3 className="name">{product.name}</h3>
      {product.blurb ? <p className="blurb">{product.blurb}</p> : null}
      <p className="price">{formatPrice(product.priceCents, product.currency)}</p>
    </div>
  </article>
);
