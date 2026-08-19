import { useMemo, useState } from "react"
import { Button } from "@heroui/react/button"
import { BlockRenderer } from "./block-renderer"
import { DirectionComparison } from "./direction-review"
import { InspectorModal } from "./inspector-modal"
import { LayoutRenderer } from "./layout-renderer"
import type { Inspector, ReviewManifest } from "./types"

type ReviewAppProps = {readonly manifest: ReviewManifest}
type Viewport = "desktop" | "tablet" | "mobile"
type ReviewView = "candidate" | "directions"

export const ReviewApp = ({manifest}: ReviewAppProps) => {
  const [candidateId, setCandidateId] = useState(manifest.artifact.recommendedId)
  const [viewport, setViewport] = useState<Viewport>("desktop")
  const [view, setView] = useState<ReviewView>("candidate")
  const [inspector, setInspector] = useState<Inspector>()
  const candidate = useMemo(() => manifest.candidates.find((item) => item.id === candidateId) ?? manifest.candidates[0], [candidateId, manifest.candidates])

  if (!candidate) return <main className="fatal"><h1>No candidates</h1><p>The manifest contains no review candidates.</p></main>

  const identity = manifest.identity.blockId ? `${manifest.identity.layoutId}/${manifest.identity.blockId}` : manifest.identity.layoutId
  return (
    <div className="review-app" style={{
      "--review-ground": manifest.theme.ground?.value ?? "#f6f6f7",
      "--review-surface": manifest.theme.surface?.value ?? "#ffffff",
      "--review-content": manifest.theme.content?.value ?? "#202124",
      "--review-muted": manifest.theme.mutedContent?.value ?? "#6f7378",
      "--review-accent": manifest.theme.accent?.value ?? "#e94f99",
      "--review-separator": manifest.theme.separator?.value ?? "#e6e6e8",
      "--review-radius": manifest.theme.radius?.value ?? "10px"
    } as React.CSSProperties}>
      <header className="review-header">
        <div><span className="phase-pill">{manifest.phase}</span><strong>{manifest.project}</strong><h1>{identity}</h1></div>
        <div className="header-actions">
          {manifest.visualDirections?.length ? <Button variant="secondary" size="sm" onPress={() => setView(view === "directions" ? "candidate" : "directions")}>{view === "directions" ? "Candidate" : "Directions"}</Button> : null}
          <Button variant="secondary" size="sm" onPress={() => setInspector({kind: "evidence", title: "Evidence", subtitle: identity, data: manifest.evidence})}>Evidence</Button>
          <Button variant="secondary" size="sm" onPress={() => setInspector({kind: "approval", title: "Approval identity", subtitle: candidate.status, data: {candidate: candidate.id, hash: candidate.hash, currentHead: manifest.artifact.currentHead}})}>Hash</Button>
        </div>
      </header>
      <aside className="review-sidebar">
        <span className="sidebar-label">Candidates</span>
        {manifest.candidates.map((item) => <button className={item.id === candidate.id ? "active" : ""} type="button" key={item.id} onClick={() => {setCandidateId(item.id); setView("candidate")}}><strong>{item.id}</strong><small>{item.status}</small></button>)}
        <span className="sidebar-label">Viewport</span>
        <div className="viewport-switcher">{(["desktop", "tablet", "mobile"] as const).map((item) => <button className={item === viewport ? "active" : ""} type="button" key={item} onClick={() => setViewport(item)}>{item}</button>)}</div>
        <button className="candidate-detail" type="button" onClick={() => setInspector({kind: "candidate", title: candidate.id, subtitle: candidate.hash, data: candidate})}>Candidate details</button>
      </aside>
      <main className="review-stage">
        <div className={`viewport-frame ${viewport}`}>
          {view === "directions" && manifest.visualDirections ? <DirectionComparison directions={manifest.visualDirections} recommendedId={manifest.visualDirectionRecommendation?.id} content={manifest.content} /> : manifest.phase === "layout" ? <LayoutRenderer candidate={candidate} content={manifest.content} shell={manifest.shell} inspect={setInspector} /> : <BlockRenderer candidate={candidate} content={manifest.content} inspect={setInspector} />}
        </div>
      </main>
      <InspectorModal inspector={inspector} onClose={() => setInspector(undefined)} />
    </div>
  )
}
