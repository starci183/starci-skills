# Output

Completion, choice wait, blocker, or typed cross-domain handoff for the same mission.

Before quality/UAT handoff or completion, `artifactRefs` includes every required adjacent lowercase
`audit.md` for the audited page, layout, modal, and drawer owners. Each file validates with
`.claude/scripts/validate-frontend-owner-audit.mjs` and reflects the latest complete visual review;
missing evidence is recorded as `INSUFFICIENT_EVIDENCE`, never promoted to PASS.
