# Plan steps table

| Step | Decision | References and evidence | Artifact | Stop condition |
|---:|---|---|---|---|
| 0 | Where does this run belong and what may it write? | Workspace, request, git, `CONTEXT-LOCK.md` | Printed lock plus `context-lock.plan.md/json` | Any ambiguous repo role, branch, artifact root or boundary stops. |
| 1 | Does this work need a choice? | Request, approved records, legacy and current render | Admission statement | A known bounded repair routes to Fidelity Fix. |
| 2 | What scope and owners are involved? | Page/layout/block/overlay canon and source | One case, work-item matrix, dependency graph | Batch is not an owner; overlap stops. |
| 3 | What is binding and what is unknown? | Chat, screenshot, SRS, backend behavior/tests/seeds, source anchors | Evidence ledger and capability matrix | No evidence means unknown. |
| 4 | What StarCi grammar and reuse already exist? | Canon, contract `why`, concrete locked `starci-academy-fe` source, callers/tests | Reuse/API-extension/new-owner shelf | `why` proves relationship, not business existence. |
| 5 | Which truthful states can each owner enter? | State coverage reference and API behavior | Owner-state inventory | Fake skeletons or silent omissions stop. |
| 6 | Are two to four directions materially distinct? | Thesis, CTA, hierarchy, interaction and parity baseline | Direction briefs inside one case | Colour-only or page-local variants fail. |
| 7 | Is each direction implementable in StarCi grammar? | Locked source, owner tree, contract `why`, exact API proposals | Implementation-feasibility map per direction | Unmapped key anatomy or a vague "new component" rejects the direction. |
| 8 | Does each direction survive critique? | Accessibility, ownership, evidence and legacy | Trade-offs and rejection risks | Unsupported behavior rejects the direction. |
| 9 | Can the user inspect the choices without mistaking them for Apply baselines? | Direction lab interface | One hosted case with representative HTML per direction and a persistent `DIRECTIONAL - NOT AN APPLY BASELINE` label | Prose-only, screenshot-only, missing URL or missing status label fails. |
| 10 | What did the user select? | Explicit response after inspection | One selected direction or one rendered hybrid | Stop and wait; recommendation is not selection. |
| 10A | If the answer is not one of them, was a default taken honestly? | One binary re-ask and its answer | `default-after-ambiguity` on the least-risking posture, with `defaultReason` | A default recorded as a selection, or falling to a bolder direction, stops. |
| 11 | Is Preview fully specified? | All artifacts above | `direction-selected` plan record | Unresolved product decision blocks Preview. |
| 11A | Does the plan record hold its own shape? | `verify_plan_record.mjs` | Passing verifier | Wrong direction count, `mapped` over unmapped anatomy, a lab-less direction or an unevidenced selection blocks routing. |

Independent evidence inventory and critique may fan out. The coordinator owns Context Lock, thesis,
CTA, shared layout, contracts, vocabulary, backend boundary, synthesis and selection handoff.
