import type { BlockCandidate, LayoutCandidate, RegionReview, ReviewContent, ShellDescriptor } from "./types"

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

const renderBrief = (region: RegionReview) => {
  const brief = region.brief
  if (!brief) return null
  return (
    <span className={`region-brief brief-${brief.kind}`}>
      <span className="brief-heading"><strong>{brief.title}</strong><small>{brief.summary}</small></span>
      <span className="brief-items">
        {brief.items.map((item, index) => (
          <span className={`brief-item brief-item-${item.role}`} key={`${item.role}-${item.label}-${index}`}>
            <span>{item.label}</span>{item.value ? <small>{item.value}</small> : null}
          </span>
        ))}
      </span>
      {brief.primaryAction || brief.secondaryAction ? (
        <span className="brief-actions">
          {brief.primaryAction ? <b>{brief.primaryAction}</b> : null}
          {brief.secondaryAction ? <small>{brief.secondaryAction}</small> : null}
        </span>
      ) : null}
    </span>
  )
}

export const LayoutRenderer = ({candidate, content, shell, openBlock}: LayoutRendererProps) => {
  const navigation = candidate.axes.navigation
  const evidenceBeside = candidate.axes.evidence === "beside"
  const centeredDoor = navigation === "none" && candidate.regions.every((region) => region.geometry?.placement === "center")
  const railRegions = candidate.regions.filter((region) => region.geometry?.placement === "rail")
  const navbarRegions = candidate.regions.filter((region) => region.geometry?.placement === "navbar")
  const footerRegions = candidate.regions.filter((region) => region.geometry?.placement === "footer")
  const bodyRegions = candidate.regions.filter((region) => !["rail", "navbar", "footer"].includes(region.geometry?.placement ?? ""))
  const hasAside = bodyRegions.some((region) => region.geometry?.placement === "aside")

  const renderRegion = (region: RegionReview, index: number) => {
    const block = selectedBlock(region.block.renderedId, region.block.candidates)
    const rendersAcceptedBlock = region.block.status === "accepted" && block !== undefined
    const geometry = region.geometry
    return (
      <button
        type="button"
        className={`review-region block-${region.block.status} placement-${geometry?.placement ?? "legacy"} width-${geometry?.width ?? "full"} height-${geometry?.height ?? "content"} align-${geometry?.align ?? "stretch"}`}
        key={region.name}
        onClick={() => openBlock(region.name)}
      >
        <span className="region-label">{region.name} · {region.entry.verdict} {regionEntry(region.entry)} · {region.assembler} · {region.mount}{geometry ? ` · ${geometry.placement}/${geometry.width}/${geometry.height}/${geometry.align}` : ""}</span>
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
            {region.brief ? renderBrief(region) : geometry?.placement === "rail" || geometry?.placement === "navbar" || geometry?.placement === "footer" ? (
              <span className="rough-navigation">{shell.navigation.map((item) => <i className={item.id === shell.activeItem ? "active" : ""} key={item.id}>{item.label}</i>)}</span>
            ) : (
              <><strong>{geometry?.placement === "center" || index === 0 ? content.title : content.rows[index % content.rows.length]?.title ?? region.name}</strong><small>{content.rows[index % content.rows.length]?.description ?? region.whyMatch}</small><span className="rough-lines" aria-hidden="true"><i /><i /><i /></span></>
            )}
            <span className="block-state">{region.block.status} child · rough layout content</span>
          </span>
        )}
      </button>
    )
  }

  return (
    <div className={`product-shell navigation-${navigation} ${centeredDoor ? "centred-door" : ""}`}>
      {!centeredDoor ? <header className={`product-header ${candidate.axes.chrome === "sticky" ? "sticky" : ""}`}>
        <strong>{shell.product}</strong><span>{candidate.axes.chrome} chrome</span>
      </header> : null}
      {navbarRegions.length ? <nav className="geometry-navbar" aria-label="Declared navigation regions">{navbarRegions.map(renderRegion)}</nav> : null}
      {railRegions.length ? <aside className="geometry-rail">{railRegions.map(renderRegion)}</aside> : navigation !== "none" ? (
        <nav className={navigation === "rail" ? "product-rail" : "product-navbar"} aria-label="Representative navigation">
          {shell.navigation.map((item) => <span className={item.id === shell.activeItem ? "active" : ""} key={item.id}>{item.label}</span>)}
        </nav>
      ) : null}
      <main className={`layout-canvas ${evidenceBeside ? "evidence-beside" : "evidence-below"} ${centeredDoor ? "canvas-centred" : ""}`}>
        {!centeredDoor ? <section className="representative-intro"><span className="eyebrow">{content.eyebrow}</span><h1>{content.title}</h1><p>{content.description}</p></section> : null}
        <div className={`region-run ${hasAside ? "geometry-beside" : ""}`}>{bodyRegions.map(renderRegion)}</div>
      </main>
      {footerRegions.length ? <footer className="geometry-footer">{footerRegions.map(renderRegion)}</footer> : null}
    </div>
  )
}
