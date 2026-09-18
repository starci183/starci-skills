import { SHOP_URL } from '../modules/config';

/**
 * The top bar every landing section sits under. Its only job beyond the wordmark is to route a first-time
 * visitor into the authenticated shop app, which lives on its own origin (`SHOP_URL`), so it links with a
 * real href rather than a client-side router call.
 */
export const SiteHeader = () => (
  <header className="site-header">
    <div className="container">
      <a className="brand" href="/">Northwind Supply</a>
      <nav className="nav">
        <a href="/#catalogue">Catalogue</a>
        <a href="/#about">About</a>
        <a className="button secondary" href={SHOP_URL}>Enter shop</a>
      </nav>
    </div>
  </header>
);
