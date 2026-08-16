import {Footer, Layout, Navbar} from "nextra-theme-docs";
import {Head, Search} from "nextra/components";
import {getPageMap} from "nextra/page-map";
import "nextra-theme-docs/style.css";
import "../../.academy-src/app/globals.css";
import "./styles.css";

export const metadata = {
  title: {default: "StarCi · Tài liệu kỹ năng", template: "%s | StarCi · Tài liệu kỹ năng"},
  description: "Tài liệu kỹ năng StarCi với hướng dẫn, phản biện và bản xem trước HeroUI trực tiếp."
};

const navbar = <Navbar logo={<strong>StarCi · Tài liệu kỹ năng</strong>} />;
const footer = <Footer>Hệ thống quy tắc StarCi · Nextra + HeroUI</Footer>;
const search = (
  <Search
    placeholder="Tìm kiếm tài liệu…"
    emptyResult="Không tìm thấy kết quả."
    errorText="Không thể tải chỉ mục tìm kiếm."
    loading="Đang tải…"
  />
);

export default async function RootLayout({children}) {
  return (
    <html lang="vi" dir="ltr" suppressHydrationWarning>
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
          themeSwitch={{dark: "Tối", light: "Sáng", system: "Hệ thống"}}
          toc={{backToTop: "Lên đầu trang", title: "Trong trang này"}}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
