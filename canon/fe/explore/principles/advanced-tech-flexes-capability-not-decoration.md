# Heavy technology proves capability; it is not decoration

StarCi **teaches** hardcore engineering, so its own interface has to demonstrate command of that
engineering. Three-dimensional scenes with `three.js`, node diagrams with React Flow (`@xyflow`),
real-time surfaces, interactive canvases — these carry weight in the product because they are
congruent with the claim "we can teach it because we can build it". That congruence is what buys
authority; see the persuasion rules. It is not what buys prettiness.

## The rule

- Heavy technology must **serve a real purpose** — describing an architecture, letting someone draw
  a system, illustrating a concept, walking a data flow — **and** demonstrate capability at the
  same time. Beautiful with no substance is showing off, and gets cut.
- **The one-sentence test:** *does this 3D scene or React Flow canvas prove a capability tied to
  what we teach, or is it eye candy?* If the first half cannot be answered, remove it.
- **Where it is right, in the shipped app:** the `architecture` page and the landing (showing the
  real architecture), MindMap (walking the tree of a course), the MockInterview whiteboard (drawing
  a system design), the microservices diagram. **Where it is wrong:** sparkle effects with no
  meaning, 3D added for swagger, animation nobody needed.
- **It still has to be honest.** Flex a capability that is real; do not manufacture gloss. And do
  not trade away performance or accessibility for it — honour `prefers-reduced-motion` and provide
  a fallback.
- Heavy **with a purpose** is not a violation of `design-restraint.md`. Restraint forbids the
  superfluous; it does not forbid serious technology that has a reason.

## Where it lives in the source

`features/architecture` (`ArchitectureFlow`, `ArchitectureScene`, the `three.js` `RainEffect`,
`MicroservicesDiagram` and `MicroservicesScene`); `features/learn/MindMap` (`@xyflow` React Flow);
`MockInterview/MockInterviewDiagram` (a React Flow whiteboard); `blocks/marketing/ShowcaseMockup`.

Related: `persuasion-psychology.md` (authority is capability shown, not claimed),
`design-restraint.md` (heavy but not superfluous), `accessibility.md`, and the motion foundations.
