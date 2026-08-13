# Preview steps table

| Step | Decision | Evidence | Artifact | Stop condition |
|---:|---|---|---|---|
| 0 | Is inherited context unchanged? | Workspace, git, Plan lock | Printed lock/drift plus Preview lock | Drift or ambiguity stops; never relock. |
| 1 | Is one direction explicitly selected? | Version-2 Plan record and selection evidence | Validated `caseId` and direction | Missing selection returns to Plan. |
| 2 | Can StarCi grammar express the direction? | Owners, contracts, source anchors and approved proposals | Candidate-to-target source map | An attractive but unimplementable mockup returns to Plan. |
| 3 | Does revision `1.0` run from production-shaped source? | Candidate build, imports and executable-spec reference | Running artifact-local candidate | Standalone HTML/CSS imitation blocks review. |
| 4 | Is each rendered state unambiguous? | Route, viewport, locale, theme, persona and fixture | State runtime fingerprint and fixture hash | Missing identity or mixed-state evidence blocks review. |
| 5 | Which integrated scenarios cover owner states? | State manifest and state-coverage reference | Rendered/covered/N/A matrix plus controls | Silent omission or fake skeleton blocks review. |
| 6 | Are tree, contracts, props and tokens exact? | Running candidate and semantic manifest | Inspectable owner/component tree and proposal shelf | Source/canvas or manifest/runtime divergence blocks review. |
| 7 | What changed in feedback? | Explicit element-level feedback | Minor revision `1.n`, affected-elements ledger | Do not reset unrelated regions or edit production. |
| 8 | Is one executable revision explicitly approved? | User statement naming current revision | Version-3 design record | Silence, unresolved state or proposal blocks approval. |
| 8A | If approval did not name a revision, was it named back? | One restatement and its answer | `confirmed-restated` approval holding restatement and user words apart | A bare "ok" stored as though the revision had been named stops. |
| 9 | Is approval sealed against drift? | Candidate, fixtures, screenshots, build log and semantic record | Passing `verify_design_record.mjs` seal/verify | Any changed or missing artifact invalidates approval. |
| 9A | Did the candidate actually build, and is coverage honest? | `candidate.build` exit code and hashed log; `stateCoverage` against sealed states | Passing verifier | A non-zero build, a coverage entry naming a scenario nothing rendered, or `not-applicable` with no evidence stops. |

For a batch, bounded candidate work may fan out only after the selected system, shared contracts and
scenario vocabulary are frozen. Coordinator owns integration, source map, revision history and seal.
