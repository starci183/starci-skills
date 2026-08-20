import { useEffect, useMemo, useState } from "react"
import { Button } from "@heroui/react/button"
import type { RegionReview } from "./types"

type BlockRendererProps = {
  readonly region: RegionReview
  readonly back: () => void
}

type ReviewTab = "block-candidates" | "evidence"

export const BlockRenderer = ({region, back}: BlockRendererProps) => {
  const block = region.block
  const initialCandidate = block.candidates.find((candidate) => candidate.id === block.recommendedId) ?? block.candidates[0]
  const [candidateId, setCandidateId] = useState(initialCandidate?.id)
  const candidate = useMemo(() => block.candidates.find((item) => item.id === candidateId) ?? block.candidates[0], [block.candidates, candidateId])
  const states = useMemo(() => candidate?.states ?? [], [candidate])
  const [state, setState] = useState(states[0])
  const [reviewTab, setReviewTab] = useState<ReviewTab>("block-candidates")

  useEffect(() => setState(states[0]), [candidateId, states])
  useEffect(() => setReviewTab("block-candidates"), [block.blockId])

  const statePreview = candidate?.preview?.states.find((item) => item.id === state) ?? candidate?.preview?.states[0]

  return (
    <section className="block-detail-page">
      <header className="block-detail-header">
        <div>
          <Button variant="secondary" size="sm" onPress={back}>← Layout</Button>
          <span className="eyebrow">Child block</span>
          <h1>{block.blockId}</h1>
          <p className="parent-reference">{block.layoutId} / {block.layoutHash}</p>
        </div>
        <span className={`child-status ${block.status}`}>{block.status}</span>
      </header>
      <nav className="block-review-tabs" aria-label="Block review tabs">
        <button className={reviewTab === "block-candidates" ? "active" : ""} type="button" onClick={() => setReviewTab("block-candidates")}>Block candidates <small>{block.candidates.length}</small></button>
        <button className={reviewTab === "evidence" ? "active" : ""} type="button" onClick={() => setReviewTab("evidence")}>Evidence</button>
      </nav>
      {reviewTab === "evidence" ? (
        <article className="block-evidence-panel"><h2>Parent evidence</h2><p>{region.whyMatch}</p><pre>{JSON.stringify({layoutId: block.layoutId, layoutHash: block.layoutHash, blockId: block.blockId, entry: region.entry, geometry: region.geometry, status: block.status}, null, 2)}</pre></article>
      ) : candidate ? (
        <>
          <nav className="block-candidate-switcher" aria-label="Block candidates">
            {block.candidates.map((item) => <button className={item.id === candidate.id ? "active" : ""} type="button" key={item.id} onClick={() => setCandidateId(item.id)}><strong>{item.id}</strong><small>{item.status}</small></button>)}
          </nav>
          <div className="block-state-layout">
            <aside className="state-explanation">
              <span className="eyebrow">States</span>
              {states.map((item) => <button className={item === state ? "active" : ""} type="button" key={item} onClick={() => setState(item)}>{item}</button>)}
              <details><summary>Parent binding</summary><pre>{JSON.stringify({layoutId: block.layoutId, layoutHash: block.layoutHash, blockId: block.blockId, blockHash: candidate.hash}, null, 2)}</pre></details>
            </aside>
            {statePreview ? (
              <div className="block-canvas" style={{width: `min(100%, ${statePreview.viewport.width}px)`}}>
                <iframe className="authored-preview block-preview" style={{height: `${statePreview.viewport.height}px`}} title={`${candidate.id} ${statePreview.id} preview`} srcDoc={statePreview.html} sandbox="allow-scripts" />
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="missing-block-detail">
          <h2>Chưa có block candidate</h2>
          <p>Layout brief ở tab bên cạnh là prototype tạm. Chạy block design phase dưới đúng parent layout hash này để mở candidate, anatomy và state tabs chi tiết.</p>
          <pre>{JSON.stringify({layoutId: block.layoutId, layoutHash: block.layoutHash, blockId: block.blockId}, null, 2)}</pre>
        </div>
      )}
    </section>
  )
}
