import React from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";

export default function Home() {
  return (
    <Layout title="StarCi · Claude Canon" description="The canon an AI reads to build the design system safely.">
      <main style={{ maxWidth: 780, margin: "0 auto", padding: "4rem 1.5rem" }}>
        <h1 style={{ fontSize: "2.2rem", marginBottom: ".5rem" }}>StarCi · Claude Canon</h1>
        <p style={{ fontSize: "1.1rem", opacity: 0.8, lineHeight: 1.6 }}>
          The rules, patterns and skills an AI reads to build and extend the codebase safely. This site
          renders <code>.claude/</code> <b>in place</b> — the source of truth stays in
          <code> canon/</code> and <code>skills/</code>; Docusaurus only points at it.
        </p>
        <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", flexWrap: "wrap" }}>
          <Link className="button button--primary button--lg" to="/canon/fe/README">
            FE canon — explore vs enforce →
          </Link>
          <Link className="button button--secondary button--lg" to="/canon/be/INDEX">
            BE canon →
          </Link>
        </div>
        <p style={{ marginTop: "2.5rem", fontSize: ".95rem", opacity: 0.7 }}>
          <b>Run:</b> <code>cd .claude/docs &amp;&amp; npm install &amp;&amp; npm start</code> → <code>localhost:3030</code>.
        </p>
      </main>
    </Layout>
  );
}
