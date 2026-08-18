import {Footer, Layout, Navbar} from "nextra-theme-docs";
import {Head, Search} from "nextra/components";
import {getPageMap} from "nextra/page-map";
import "nextra-theme-docs/style.css";
import "./styles.css";

export const metadata = {
  title: {default: "StarCi Skills", template: "%s"},
  description: "StarCi skills: binding rules, human guides and live interface previews.",
  icons: {icon: "/brand/favicon.png"}
};

const navbar = (
  <Navbar
    logo={<img src="/brand/starci-logo.png" alt="StarCi" width="40" height="40" />}
  />
);
const footer = <Footer>StarCi Skills</Footer>;
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
      <Head color={{hue: 145, saturation: 52, lightness: {light: 38, dark: 66}}}>
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
