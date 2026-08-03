# post/present.md

**Scope.** Every plan skill — `starci-fe-layout-plan`, `starci-fe-review-plan`,
`starci-fe-consolidate-plan`. A plan skill's work ends in a presentation, and this hook is how that
presentation is made. An apply skill presents nothing and does not run it.

**After the analysis, before it is handed over**, the finding is *presented*, not described. Three rules,
always — a plan skill that hands over a wall of prose has skipped this hook.

## 1. Draw, do not describe

When the skill would present options, a structure, or a diagnosis, it **renders a widget** (`show_widget`),
not a paragraph. A shape a person can see is argued with; a paragraph is skimmed and agreed to. Two or
more valid candidates are drawn **side by side**; exactly one is drawn alone, with the reason there is no
second written beside it. Prose is the caption on the drawing, never the substitute for it.

## 2. A large layout is a clickable prototype on :8080

When the thing being shown is a whole page, a flow, or a multi-surface layout, a static widget is not
enough. Render a **self-contained clickable HTML prototype** and serve it on **localhost:8080**, so the
person walks the flow — every surface, every state, the responsive switch — like slides, and argues with
it **before** any code is written. Start from the prototype kit, not from zero.

## 3. Offer 3-4 options to choose, not one to approve

The skill presents **three or four real candidates** and lets the person choose, rather than handing over
one finished answer for a yes/no. The person decides between drawn options; the skill's job is to make the
choice legible, not to make it for them. When only one option is defensible, say so and say why the others
were ruled out — that is still a choice shown, not a verdict delivered.
