import type { BlockCandidate, LayoutCandidate, ReviewContent, ShellDescriptor } from "./types"

type LayoutRendererProps = {
  readonly candidate: LayoutCandidate
  readonly content: ReviewContent
  readonly shell: ShellDescriptor
  readonly openBlock: (blockId: string) => void
}

const regionEntry = (entry: Record<string, unknown>) =>
  entry.verdict === "generalize" ? `${entry.from} → ${entry.to}` : String(entry.key ?? "new entry")

const selectedBlock = (recommendedId: string | undefined, candidates: ReadonlyArray<BlockCandidate>) =>
  candidates.find((candidate) => candidate.id === recommendedId) ?? candidates[0]

export const LayoutRenderer = ({candidate, content, shell, openBlock}: LayoutRendererProps) => {
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
          {candidate.regions.map((region, index) => {
            const block = selectedBlock(region.block.renderedId, region.block.candidates)
            const rendersAcceptedBlock = region.block.status === "accepted" && block !== undefined
            return (
              <button
                type="button"
                className={`review-region block-${region.block.status}`}
                key={region.name}
                onClick={() => openBlock(region.name)}
              >
                <span className="region-label">{region.name} · {region.entry.verdict} {regionEntry(region.entry)} · {region.assembler} · {region.mount}</span>
                {rendersAcceptedBlock ? (
                  <span className="accepted-block-preview">
                    <span className="block-preview-head"><strong>{block.id}</strong><small>{block.states.join(" · ")}</small></span>
                    <span className="rough-part-run">
                      {block.parts.map((part) => <span className="rough-part" key={part.name}><strong>{part.name}</strong><small>{part.whyMatch}</small></span>)}
                    </span>
                    <span className="block-state">accepted child · {block.hash.slice(0, 12)}</span>
                  </span>
                ) : (
                  <span className="rough-block-preview">
                    <strong>{index === 0 ? content.title : content.rows[index % content.rows.length]?.title ?? region.name}</strong>
                    <small>{content.rows[index % content.rows.length]?.description ?? region.whyMatch}</small>
                    <span className="rough-lines" aria-hidden="true"><i /><i /><i /></span>
                    <span className="block-state">{region.block.status} child · rough layout content</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
