import { SHOP_URL } from '../modules/config';

/** A short closing bar: the hand-off to the shop is repeated here so it is reachable from the foot of any page. */
export const SiteFooter = () => (
  <footer className="site-footer">
    <div className="container">
      <span>Northwind Supply — everyday objects, built to be kept.</span>
      <a href={SHOP_URL}>Shop the full catalogue →</a>
    </div>
  </footer>
);
