import { useEffect, useMemo, useState } from "react"
import { Button } from "@heroui/react/button"
import type { BlockCandidate, ChildBlockReview, ReviewContent } from "./types"

type BlockRendererProps = {
  readonly block: ChildBlockReview
  readonly content: ReviewContent
  readonly back: () => void
}

export const BlockRenderer = ({block, content, back}: BlockRendererProps) => {
  const initialCandidate = block.candidates.find((candidate) => candidate.id === block.recommendedId) ?? block.candidates[0]
  const [candidateId, setCandidateId] = useState(initialCandidate?.id)
  const candidate = useMemo(() => block.candidates.find((item) => item.id === candidateId) ?? block.candidates[0], [block.candidates, candidateId])
  const states = useMemo(() => candidate?.states ?? [], [candidate])
  const [state, setState] = useState(states[0])

  useEffect(() => setState(states[0]), [candidateId, states])

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
      {candidate ? (
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
          <h2>Block design is missing</h2>
          <p>This region still uses rough layout content. Run the block design phase under this exact parent layout hash.</p>
          <pre>{JSON.stringify({layoutId: block.layoutId, layoutHash: block.layoutHash, blockId: block.blockId}, null, 2)}</pre>
        </div>
      )}
    </section>
  )
}
