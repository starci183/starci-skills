import type { Inspector, ReviewCandidate, ReviewContent, ShellDescriptor } from "./types"

type LayoutRendererProps = {
  readonly candidate: ReviewCandidate
  readonly content: ReviewContent
  readonly shell: ShellDescriptor
  readonly inspect: (inspector: Inspector) => void
}

const regionEntry = (entry: Record<string, unknown>) =>
  entry.verdict === "generalize" ? `${entry.from} → ${entry.to}` : String(entry.key ?? "new entry")

export const LayoutRenderer = ({candidate, content, shell, inspect}: LayoutRendererProps) => {
  const navigation = candidate.axes.navigation
  const evidenceBeside = candidate.axes.evidence === "beside"
  return (
    <div className={`product-shell navigation-${navigation}`}>
      <header className={`product-header ${candidate.axes.chrome === "sticky" ? "sticky" : ""}`}>
        <strong>{shell.product}</strong><span>{candidate.axes.chrome} chrome</span>
      </header>
      {navigation !== "none" ? (
        <nav className={navigation === "rail" ? "product-rail" : "product-navbar"} aria-label="Representative navigation">
          {shell.navigation.map((item) => <span className={item.id === shell.activeItem ? "active" : ""} key={item.id}>{item.label}</span>)}
        </nav>
      ) : null}
      <main className={`layout-canvas ${evidenceBeside ? "evidence-beside" : "evidence-below"}`}>
        <section className="representative-intro"><span className="eyebrow">{content.eyebrow}</span><h1>{content.title}</h1><p>{content.description}</p></section>
        <div className="region-run">
          {candidate.regions?.map((region, index) => (
            <button
              type="button"
              className={`review-region block-${region.blockStatus}`}
              key={region.name}
              onClick={() => inspect({kind: "region", title: region.name, subtitle: `${region.assembler} · ${region.mount}`, data: region})}
            >
              <span className="region-label">{region.name} · {region.entry.verdict} {regionEntry(region.entry)} · {region.assembler} · {region.mount}</span>
              <span className="region-body">
                <strong>{index === 0 ? content.title : content.rows[index % content.rows.length]?.title ?? region.name}</strong>
                <small>{content.rows[index % content.rows.length]?.description ?? region.whyMatch}</small>
                <span className="block-state">block {region.blockStatus}</span>
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
