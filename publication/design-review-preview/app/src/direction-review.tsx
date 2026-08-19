import type { DirectionReview, ReviewContent } from "./types"

type DirectionReviewProps = {
  readonly directions: ReadonlyArray<DirectionReview>
  readonly recommendedId?: string
  readonly content: ReviewContent
}

export const DirectionComparison = ({directions, recommendedId, content}: DirectionReviewProps) => (
  <section className="direction-grid" aria-label="Visual direction comparison">
    {directions.map((direction) => (
      <article className={`direction-card ${direction.id === recommendedId ? "recommended" : ""}`} key={direction.id}>
        <header><span className="status-pill">{direction.id === recommendedId ? "recommended" : "alternative"}</span><h2>{direction.id}</h2><p>{Object.values(direction.axes).join(" · ")}</p></header>
        <div className="reference-surface">
          <span className="eyebrow">{content.eyebrow}</span>
          <h3>{content.title}</h3>
          <p>{content.description}</p>
          <label className="sample-field">Representative control</label>
          {content.rows.slice(0, 2).map((row) => <div className="sample-row" key={row.title}><strong>{row.title}</strong><small>{row.description}</small></div>)}
          <button type="button">{content.primaryAction}</button>
        </div>
        <footer><strong>{direction.personality.join(" · ")}</strong><p>{direction.reason}</p></footer>
      </article>
    ))}
  </section>
)
