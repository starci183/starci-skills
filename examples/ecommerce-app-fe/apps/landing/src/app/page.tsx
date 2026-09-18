import { LandingView } from '../components/LandingView';
import { CATALOG } from '../data/catalog';
import { SHOP_URL } from '../modules/config';

/** The teaser shows a curated slice of the catalogue rather than the whole order-service feed. */
const TEASER_COUNT = 3;

const LandingPage = () => {
  const teaser = CATALOG.slice(0, TEASER_COUNT);
  return <LandingView teaser={teaser} shopUrl={SHOP_URL} />;
};

export default LandingPage;
