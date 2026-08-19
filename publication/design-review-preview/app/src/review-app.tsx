import { useEffect, useMemo, useState } from "react"
import { Button } from "@heroui/react/button"
import { BlockRenderer } from "./block-renderer"
import { DirectionComparison } from "./direction-review"
import { LayoutRenderer } from "./layout-renderer"
import type { LayoutReview, ReviewManifest, ReviewRoute } from "./types"

type ReviewAppProps = {readonly manifest: ReviewManifest}
type Viewport = "desktop" | "tablet" | "mobile"
type ReviewView = "candidate" | "directions"

const parseRoute = (hash: string, fallback: string): ReviewRoute => {
  const path = (hash || fallback).replace(/^#/, "")
  const match = path.match(/^\/layouts\/([^/]+)\/([0-9a-f]{64})(?:\/blocks\/([^/]+))?$/)
  if (!match) throw new Error(`Invalid design review route: ${path}`)
  return {layoutId: match[1], layoutHash: match[2], ...(match[3] ? {blockId: match[3]} : {})}
}

const navigate = (route: string) => {
  if (window.location.hash === route) window.dispatchEvent(new HashChangeEvent("hashchange"))
  else window.location.hash = route
}

const layoutRoute = (layoutId: string, layoutHash: string) => `#/layouts/${layoutId}/${layoutHash}`
const blockRoute = (layoutId: string, layoutHash: string, blockId: string) => `${layoutRoute(layoutId, layoutHash)}/blocks/${blockId}`

const themeStyle = (layout: LayoutReview) => ({
  "--review-ground": layout.theme.ground?.value ?? "#f6f6f7",
  "--review-surface": layout.theme.surface?.value ?? "#ffffff",
  "--review-content": layout.theme.content?.value ?? "#202124",
  "--review-muted": layout.theme.mutedContent?.value ?? "#6f7378",
  "--review-accent": layout.theme.accent?.value ?? "#e94f99",
  "--review-separator": layout.theme.separator?.value ?? "#e6e6e8",
  "--review-radius": layout.theme.radius?.value ?? "10px"
} as React.CSSProperties)

export const ReviewApp = ({manifest}: ReviewAppProps) => {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash, manifest.entryRoute))
  const [viewport, setViewport] = useState<Viewport>("desktop")
  const [view, setView] = useState<ReviewView>("candidate")

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, "", manifest.entryRoute)
    const update = () => setRoute(parseRoute(window.location.hash, manifest.entryRoute))
    window.addEventListener("hashchange", update)
    return () => window.removeEventListener("hashchange", update)
  }, [manifest.entryRoute])

  const layout = useMemo(() => manifest.layouts.find((item) => item.layoutId === route.layoutId) ?? manifest.layouts[0], [manifest.layouts, route.layoutId])
  const candidate = useMemo(() => layout?.candidates.find((item) => item.hash === route.layoutHash) ?? layout?.candidates.find((item) => item.id === layout.recommendedId) ?? layout?.candidates[0], [layout, route.layoutHash])
  const region = route.blockId ? candidate?.regions.find((item) => item.name === route.blockId) : undefined

  if (!layout || !candidate) return <main className="fatal"><h1>Review route unavailable</h1><p>The manifest does not contain the requested layout version.</p></main>

  return (
    <div className="review-app" style={themeStyle(layout)}>
      <header className="review-header">
        <div><span className="phase-pill">{route.blockId ? "block" : "layout"}</span><strong>{manifest.project}</strong><h1>{route.blockId ? `${layout.layoutId} / ${route.blockId}` : layout.layoutId}</h1></div>
        <div className="header-actions">
          {!route.blockId && layout.visualDirections?.length ? <Button variant="secondary" size="sm" onPress={() => setView(view === "directions" ? "candidate" : "directions")}>{view === "directions" ? "Layout" : "Directions"}</Button> : null}
          <details className="evidence-details"><summary>Evidence</summary><pre>{JSON.stringify(manifest.evidence, null, 2)}</pre></details>
        </div>
      </header>
      <aside className="review-sidebar">
        <span className="sidebar-label">Layouts</span>
        {manifest.layouts.map((item) => {
          const selected = item.layoutId === layout.layoutId
          const target = item.candidates.find((candidate) => candidate.id === item.recommendedId) ?? item.candidates[0]
          return <button className={selected ? "active" : ""} type="button" key={item.layoutId} onClick={() => target && navigate(layoutRoute(item.layoutId, target.hash))}><strong>{item.layoutId}</strong><small>{item.currentHead ? "accepted head" : "review"}</small></button>
        })}
        {!route.blockId ? (
          <>
            <span className="sidebar-label">Candidates</span>
            {layout.candidates.map((item) => <button className={item.hash === candidate.hash ? "active" : ""} type="button" key={item.id} onClick={() => navigate(layoutRoute(layout.layoutId, item.hash))}><strong>{item.id}</strong><small>{item.status}</small></button>)}
            <span className="sidebar-label">Viewport</span>
            <div className="viewport-switcher">{(["desktop", "tablet", "mobile"] as const).map((item) => <button className={item === viewport ? "active" : ""} type="button" key={item} onClick={() => setViewport(item)}>{item}</button>)}</div>
            <details className="candidate-detail"><summary>Candidate details</summary><pre>{JSON.stringify({id: candidate.id, hash: candidate.hash, axes: candidate.axes, reason: candidate.reason}, null, 2)}</pre></details>
          </>
        ) : null}
      </aside>
      <main className="review-stage">
        <div className={`viewport-frame ${route.blockId ? "desktop" : viewport}`}>
          {route.blockId ? (
            region ? <BlockRenderer block={region.block} content={region.block.content ?? layout.content} back={() => navigate(layoutRoute(layout.layoutId, candidate.hash))} /> : <main className="fatal"><h1>Block not declared</h1><p>{route.blockId} is not a child of this layout version.</p></main>
          ) : view === "directions" && layout.visualDirections ? (
            <DirectionComparison directions={layout.visualDirections} recommendedId={layout.visualDirectionRecommendation?.id} content={layout.content} />
          ) : (
            <LayoutRenderer candidate={candidate} content={layout.content} shell={layout.shell} openBlock={(blockId) => navigate(blockRoute(layout.layoutId, candidate.hash, blockId))} />
          )}
        </div>
      </main>
    </div>
  )
}
