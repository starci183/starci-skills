// @ts-check
// Renders this canon repo (.claude/**) IN PLACE — no copy, no sync. `docs.path` points one level up
// at the repo root, so canon/, skills/, scripts/*.md are served straight from where the AI reads them.
const { themes } = require("prism-react-renderer");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "StarCi · Claude Canon",
  tagline: "The canon, patterns and skills an AI reads to build safely — explore vs enforce.",
  favicon: "img/favicon.ico",

  // GitHub Pages — https://<org>.github.io/<project>/
  url: "https://starci183.github.io",
  baseUrl: "/starci-claude-skills/",
  organizationName: "starci183",
  projectName: "starci-claude-skills",
  trailingSlash: false,

  // The canon uses plain relative .md links and headings not shaped for Docusaurus routing — warn,
  // do not fail the build, so the site publishes even before every link is Docusaurus-perfect.
  onBrokenLinks: "warn",
  onBrokenAnchors: "warn",
  markdown: { format: "detect", hooks: { onBrokenMarkdownLinks: "warn" } },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          // THE KEY LINE — read the markdown straight from the repo root (parent of docs/),
          // no sync. canon/, skills/, and the loose *.md land here automatically.
          path: "..",
          routeBasePath: "/",
          sidebarPath: require.resolve("./sidebars.js"),
          include: ["**/*.md", "**/*.mdx"],
          exclude: [
            "docs/**",            // this site itself
            "**/node_modules/**",
            "worktrees/**",       // throwaway git worktrees
            "_canon_tmp/**",      // legacy, retired
            "max-pro-vip/**",     // separate system
            "README.md",
          ],
        },
        blog: false,
        theme: { customCss: require.resolve("./src/css/custom.css") },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: "StarCi · Claude Canon",
        items: [{ type: "docSidebar", sidebarId: "canon", position: "left", label: "Canon" }],
      },
      footer: { style: "dark", copyright: "StarCi canon — read by AI, refined by thầy." },
      prism: { theme: themes.github, darkTheme: themes.dracula },
    }),
};

module.exports = config;
