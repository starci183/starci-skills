import { useMemo, useState } from "react"
import type { Inspector, ReviewCandidate, ReviewContent } from "./types"

type BlockRendererProps = {
  readonly candidate: ReviewCandidate
  readonly content: ReviewContent
  readonly inspect: (inspector: Inspector) => void
}

export const BlockRenderer = ({candidate, content, inspect}: BlockRendererProps) => {
  const states = useMemo(() => candidate.states ?? ["populated"], [candidate.states])
  const [state, setState] = useState(states[0])
  return (
    <section className="block-canvas">
      <header className="block-toolbar">
        <div><span className="eyebrow">Selected block state</span><h2>{state}</h2></div>
        <div className="state-switcher">{states.map((item) => <button className={item === state ? "active" : ""} type="button" key={item} onClick={() => setState(item)}>{item}</button>)}</div>
      </header>
      <div className={`block-surface state-${state}`}>
        <h1>{content.title}</h1><p>{content.description}</p>
        <div className="part-run">
          {candidate.parts?.map((part, index) => (
            <button type="button" className="review-part" key={part.name} onClick={() => inspect({kind: "part", title: part.name, subtitle: part.optional ? "optional part" : "required part", data: part})}>
              <span className="part-label">{part.name}</span>
              <strong>{content.rows[index % content.rows.length]?.title ?? part.name}</strong>
              <small>{content.rows[index % content.rows.length]?.description ?? part.whyMatch}</small>
            </button>
          ))}
        </div>
        {state === "pending" ? <div className="state-note">Representative pending treatment</div> : null}
        {state === "empty" ? <div className="state-note">Representative empty treatment</div> : null}
        {state === "failed" ? <div className="state-note danger">Representative failure treatment</div> : null}
      </div>
    </section>
  )
}
