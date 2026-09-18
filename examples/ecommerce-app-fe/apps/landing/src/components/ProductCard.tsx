import { formatPrice, type Product } from '../data/catalog';

type ProductCardProps = {
  readonly product: Product;
};

/**
 * One catalogue teaser tile. The glyph stands in for product photography so the skeleton ships no broken or
 * invented image URL; a later content pass replaces it with real artwork through the same slot.
 */
export const ProductCard = ({ product }: ProductCardProps) => (
  <article className="card">
    <div className="thumb" aria-hidden="true">{product.glyph}</div>
    <div className="body">
      <h3 className="name">{product.name}</h3>
      <p className="price">{formatPrice(product.priceCents, product.currency)}</p>
    </div>
  </article>
);
