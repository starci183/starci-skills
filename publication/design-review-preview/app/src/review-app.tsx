import {useEffect, useMemo, useState} from "react"
import {LayoutRenderer} from "./layout-renderer"
import type {LayoutReview, ReviewManifest, ReviewRoute} from "./types"

type ReviewAppProps = {readonly manifest: ReviewManifest}

const parseRoute = (hash: string, fallback: string): ReviewRoute => {
  const path = (hash || fallback).replace(/^#/, "")
  const match = path.match(/^\/reviews\/([^/]+)\/([0-9a-f]{64})$/)
  if (!match) throw new Error(`Invalid session review route: ${path}`)
  return {layoutId: match[1], candidateKey: match[2]}
}

const navigate = (route: string) => {
  if (window.location.hash === route) window.dispatchEvent(new HashChangeEvent("hashchange"))
  else window.location.hash = route
}

const reviewRoute = (layoutId: string, candidateKey: string) => `#/reviews/${layoutId}/${candidateKey}`

const themeStyle = (layout: LayoutReview) => ({
  "--review-ground": layout.theme.ground?.value ?? "#f6f6f7",
  "--review-surface": layout.theme.surface?.value ?? "#ffffff",
  "--review-content": layout.theme.content?.value ?? "#202124",
  "--review-muted": layout.theme.mutedContent?.value ?? "#6f7378",
  "--review-accent": layout.theme.accent?.value ?? "#e94f99",
  "--review-separator": layout.theme.separator?.value ?? "#e6e6e8",
  "--review-radius": layout.theme.radius?.value ?? "10px",
  "--review-elevation": layout.theme.elevation?.value ?? "0 .8rem 2rem rgb(22 23 26 / 9%)"
} as React.CSSProperties)

export const ReviewApp = ({manifest}: ReviewAppProps) => {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash, manifest.entryRoute))
  const [stateId, setStateId] = useState<string>()

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, "", manifest.entryRoute)
    const update = () => setRoute(parseRoute(window.location.hash, manifest.entryRoute))
    window.addEventListener("hashchange", update)
    return () => window.removeEventListener("hashchange", update)
  }, [manifest.entryRoute])

  const layout = useMemo(() => manifest.layouts.find((item) => item.layoutId === route.layoutId) ?? manifest.layouts[0], [manifest.layouts, route.layoutId])
  const candidate = useMemo(() => layout?.candidates.find((item) => item.hash === route.candidateKey) ?? layout?.candidates.find((item) => item.id === layout.recommendedId) ?? layout?.candidates[0], [layout, route.candidateKey])
  const state = candidate?.preview.states.find((item) => item.id === stateId) ?? candidate?.preview.states[0]

  useEffect(() => setStateId(candidate?.preview.states[0]?.id), [candidate])

  if (!layout || !candidate) return <main className="fatal"><h1>Review unavailable</h1><p>The session cache does not contain this candidate.</p></main>

  return (
    <div className="review-app" style={themeStyle(layout)}>
      <header className="review-header">
        <div><span className="phase-pill">{manifest.phase}</span><strong>{manifest.project}</strong><h1>{layout.layoutId}</h1></div>
        <div className="header-actions"><details className="evidence-details"><summary>Session evidence</summary><pre>{JSON.stringify(manifest.evidence, null, 2)}</pre></details></div>
      </header>
      <aside className="review-sidebar">
        <span className="sidebar-label">Candidates</span>
        {layout.candidates.map((item) => <button className={item.hash === candidate.hash ? "active" : ""} type="button" key={item.id} onClick={() => navigate(reviewRoute(layout.layoutId, item.hash))}><strong>{item.id}</strong><small>{item.id === layout.recommendedId ? "recommended" : "alternative"}</small></button>)}
        <span className="sidebar-label">Authored states</span>
        <div className="state-switcher">{candidate.preview.states.map((item) => <button className={item.id === state?.id ? "active" : ""} type="button" key={item.id} onClick={() => setStateId(item.id)}><strong>{item.id}</strong><small>{item.viewport.width} × {item.viewport.height}</small></button>)}</div>
        <details className="candidate-detail"><summary>Candidate details</summary><pre>{JSON.stringify({id: candidate.id, cacheKey: candidate.hash, axes: candidate.axes, reason: candidate.reason, sessionId: manifest.sessionId}, null, 2)}</pre></details>
      </aside>
      <main className="review-stage">
        <div className="viewport-frame" style={state ? {width: `min(100%, ${state.viewport.width}px)`} : undefined}>
          {state ? <LayoutRenderer candidate={candidate} state={state} /> : <main className="fatal"><h1>Authored state unavailable</h1></main>}
        </div>
      </main>
    </div>
  )
}
