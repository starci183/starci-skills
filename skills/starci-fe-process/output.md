# Output

Completion, one alternatives-only user choice wait, blocker, or typed business/backend/quality/UAT
handoff for the same mission. Passing gates are one-way: visual PASS hands off to quality, quality
PASS RETURN hands off to UAT, and only a final UAT PASS RETURN permits completion. An explicit UAT
counterevidence RETURN resumes `reapply`; it is not completion or a backward PASS-gate route. Backend
handoffs preserve the exact compile, apply, or capture-preflight resume state.

The Quality handoff carries `debtPolicy: forbidden`. It is verification-only with no write roots or
source mutation, and it cannot enter Quality repair or debt operators after blind visual PASS.

Before quality/UAT handoff or completion, `artifactRefs` includes every required adjacent lowercase
`audit.md` for the audited page, layout, modal, and drawer owners. Each file validates with
`.claude/scripts/validate-frontend-owner-audit.mjs` and reflects the latest complete visual review;
missing evidence is recorded as `INSUFFICIENT_EVIDENCE`, never promoted to PASS.
