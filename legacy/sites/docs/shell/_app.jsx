// Nextra 3 requires a custom App. It lives here rather than in pages/ because pages/ is rebuilt from
// docs/ on every dev and build; sync-content.mjs copies this file in after the copy.
import 'nextra-theme-docs/style.css';

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
