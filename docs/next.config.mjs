import nextra from "nextra";

const withNextra = nextra({});

export default withNextra({
  agentRules: false,
  output: "export",
  reactStrictMode: true,
  images: {unoptimized: true},
  turbopack: {
    root: process.cwd(),
    resolveAlias: {
      "next-mdx-import-source-file": "./mdx-components.js"
    }
  }
});
