import {Footer, Layout, Navbar} from "nextra-theme-docs";
import {Head, Search} from "nextra/components";
import {getPageMap} from "nextra/page-map";
import "nextra-theme-docs/style.css";
import "../../.academy-src/app/globals.css";
import "./styles.css";

export const metadata = {
  title: {default: "StarCi · Trust v3", template: "%s | StarCi · Trust v3"},
  description: "The StarCi v3 trust tree: binding rules, human guides and live HeroUI previews."
};

const navbar = <Navbar logo={<strong>StarCi · Trust v3</strong>} />;
const footer = <Footer>StarCi trust v3 · Nextra + HeroUI</Footer>;
const search = (
  <Search
    placeholder="Search documentation…"
    emptyResult="No results found."
    errorText="Failed to load the search index."
    loading="Loading…"
  />
);

export default async function RootLayout({children}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head
        color={{hue: 145, saturation: 52, lightness: {light: 38, dark: 66}}}
        faviconGlyph="✦"
      >
      </Head>
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/starci183/starci-claude-skills/tree/main"
          editLink={null}
          feedback={{content: null}}
          footer={footer}
          search={search}
          sidebar={{autoCollapse: false, defaultMenuCollapseLevel: 4, defaultOpen: true}}
          navigation={{prev: true, next: true}}
          themeSwitch={{dark: "Dark", light: "Light", system: "System"}}
          toc={{backToTop: "Back to top", title: "On this page"}}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
