import { ProductCard } from '../components/ProductCard';
import { CATALOG } from '../data/catalog';
import { SHOP_URL } from '../modules/config';

/** The teaser shows a curated slice of the catalogue rather than the whole order-service feed. */
const TEASER_COUNT = 3;

const LandingPage = () => {
  const teaser = CATALOG.slice(0, TEASER_COUNT);

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>Everyday objects, built to be kept.</h1>
          <p>
            Northwind Supply makes a small, opinionated catalogue: things you reach for daily and
            expect to still have in ten years. No endless scroll, no filler.
          </p>
          <div className="actions">
            <a className="button" href={SHOP_URL}>Start shopping</a>
            <a className="button secondary" href="#catalogue">See the picks</a>
          </div>
        </div>
      </section>

      <section className="section" id="catalogue">
        <div className="container">
          <h2>This season&rsquo;s picks</h2>
          <div className="grid">
            {teaser.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <p style={{ marginTop: 26 }}>
            <a href={SHOP_URL}>View the full catalogue in the shop →</a>
          </p>
        </div>
      </section>

      <section className="section" id="about">
        <div className="container">
          <h2>Why Northwind</h2>
          <div className="grid">
            <article className="card">
              <div className="body">
                <h3 className="name">Repairable by design</h3>
                <p className="price">Every item ships with the parts and the manual to fix it.</p>
              </div>
            </article>
            <article className="card">
              <div className="body">
                <h3 className="name">One price, no games</h3>
                <p className="price">The number you see is the number you pay — no timers, no dark patterns.</p>
              </div>
            </article>
            <article className="card">
              <div className="body">
                <h3 className="name">Carbon-neutral delivery</h3>
                <p className="price">Offset on every parcel, measured and reported each quarter.</p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </>
  );
};

export default LandingPage;
