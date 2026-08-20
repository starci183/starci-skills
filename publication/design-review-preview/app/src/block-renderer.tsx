import { useEffect, useMemo, useState } from "react"
import { Button } from "@heroui/react/button"
import type { BlockCandidate, RegionReview, ReviewContent } from "./types"

type BlockRendererProps = {
  readonly region: RegionReview
  readonly content: ReviewContent
  readonly back: () => void
}

type ReviewTab = "layout-brief" | "block-candidates" | "evidence"

export const BlockRenderer = ({region, content, back}: BlockRendererProps) => {
  const block = region.block
  const initialCandidate = block.candidates.find((candidate) => candidate.id === block.recommendedId) ?? block.candidates[0]
  const [candidateId, setCandidateId] = useState(initialCandidate?.id)
  const candidate = useMemo(() => block.candidates.find((item) => item.id === candidateId) ?? block.candidates[0], [block.candidates, candidateId])
  const states = useMemo(() => candidate?.states ?? [], [candidate])
  const [state, setState] = useState(states[0])
  const [reviewTab, setReviewTab] = useState<ReviewTab>("layout-brief")

  useEffect(() => setState(states[0]), [candidateId, states])
  useEffect(() => setReviewTab("layout-brief"), [block.blockId])

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
        <button className={reviewTab === "layout-brief" ? "active" : ""} type="button" onClick={() => setReviewTab("layout-brief")}>Layout brief</button>
        <button className={reviewTab === "block-candidates" ? "active" : ""} type="button" onClick={() => setReviewTab("block-candidates")}>Block candidates <small>{block.candidates.length}</small></button>
        <button className={reviewTab === "evidence" ? "active" : ""} type="button" onClick={() => setReviewTab("evidence")}>Evidence</button>
      </nav>
      {reviewTab === "layout-brief" ? (
        <article className={`layout-brief-panel brief-${region.brief?.kind ?? "content"}`}>
          <span className="region-label">{region.name} · {region.entry.verdict} {String(region.entry.key ?? region.entry.to ?? "new entry")} · {region.assembler} · {region.mount}</span>
          <header><span className="eyebrow">Rough child from accepted layout intent</span><h2>{region.brief?.title ?? content.title}</h2><p>{region.brief?.summary ?? region.whyMatch}</p></header>
          <div className="layout-brief-items">
            {(region.brief?.items ?? content.rows.map((row) => ({role: "text" as const, label: row.title, value: row.description}))).map((item, index) => (
              <section className={`layout-brief-item item-${item.role}`} key={`${item.role}-${item.label}-${index}`}>
                <small>{item.role}</small><strong>{item.label}</strong>{item.value ? <span>{item.value}</span> : null}
              </section>
            ))}
          </div>
          {region.brief?.primaryAction || region.brief?.secondaryAction ? <footer className="layout-brief-actions">{region.brief.primaryAction ? <b>{region.brief.primaryAction}</b> : null}{region.brief.secondaryAction ? <span>{region.brief.secondaryAction}</span> : null}</footer> : null}
          <p className="layout-brief-disclaimer">Đây là prototype cảm tính từ business truth của layout. Parts, repeats và states chỉ được khóa trong block design round.</p>
        </article>
      ) : reviewTab === "evidence" ? (
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
            <article className={`block-surface state-${state}`}>
              <header><span className="eyebrow">{content.eyebrow}</span><h2>{content.title}</h2><p>{content.description}</p></header>
              <div className="part-run">
                {candidate.parts.map((part, index) => (
                  <section className="review-part" key={part.name}>
                    <span className="part-label">{part.name}</span>
                    <strong>{content.rows[index % content.rows.length]?.title ?? part.name}</strong>
                    <small>{part.whyMatch}</small>
                    <code>{String(part.cites.verdict)} {String(part.cites.key ?? part.cites.to ?? "")}</code>
                  </section>
                ))}
              </div>
              {state === "pending" ? <div className="state-note">Pending: preserve the block measure while data resolves.</div> : null}
              {state === "empty" ? <div className="state-note">Empty: explain the settled absence and its next action.</div> : null}
              {state === "failed" ? <div className="state-note danger">Failed: retain the block owner and expose recovery.</div> : null}
              {state === "forbidden" ? <div className="state-note danger">Forbidden: keep the boundary explicit without leaking protected data.</div> : null}
            </article>
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
