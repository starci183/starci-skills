# landing.compose evidence — 2026-09-06

## Question

Should a landing-specific operator write source beside `interface.generate`, or should it close the
visual composition contract before the existing source owner runs?

## Independent occurrences

| Product surface | Observed evidence | Repeated need |
| --- | --- | --- |
| NIVO Agentic OS public landing | `apps/landing/src/components/pages/LandingPage/index.tsx` and `apps/landing/public/images/nivo-unicorn-responsibility-v2.webp` at NIVO frontend commit `24c329027650e721d300d48f36cc6bce072b46a5` | The page needed a promise-to-section storyboard, explicit Grammar adoption, identity-preserving ImageGen art, code-native responsibility visualization, motion choreography and a reduced-motion state before implementation choices could be judged together. |
| StarCi Academy learning and subscription surfaces | `src/components/leaves/StarCiAiTeacher/index.tsx`, `src/components/blocks/commerce/ProSubscriptionBlock/component.tsx` and their canonical artwork under `public/brand/` and `public/images/pro-subscription/` in the observed StarCi Academy frontend worktree | The same separation appears independently: canonical character identity and generated artwork carry the emotional narrative, while interactive structure, semantic labels and responsive behavior remain code-native and auditable. |

## Decision

Add `landing.compose` as a read-only operator whose one primary artifact is
`landing-composition`. It owns Grammar adoption, visual sequence, asset-medium choice, motion and
reduced-motion choreography, performance budgets and the evidence contract. It has no source-write,
image-generation, preview-hosting or commit tool. `interface.generate` consumes the artifact and
remains the only source writer; `interface.audit` consumes it to prove visual storytelling, motion,
reduced motion and performance on the rendered surface.

## Enforcement

- `templates/kinds/landing-composition.contract.json` closes the seven required tables.
- `operators/landing-compose/validate.mjs` refuses missing identity, Grammar ownership, storyboard
  order, reduced-motion truth, performance budget and the three-way ownership handoff.
- `operators/landing-compose/self-test.mjs` proves one lawful contract and rejects six mutations.
- The closed routing map inserts `landing.compose` between a planned landing and
  `interface.generate`; no source-writing route or tool was added to the operator.
