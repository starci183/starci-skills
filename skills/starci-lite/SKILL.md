---
name: starci-lite
description: Answer repository questions and make bounded, low-impact code or documentation changes with focused verification. Route multi-repository features, important business flows, security, accounting, migrations, runtime and publication work to full StarCi when available.
---

# StarCi Lite

Use this entry to classify new work, answer questions directly and run a short work loop for a small change in one known repository. Preserve an explicit full selection, the installed profile and an active full session. This is a separate entry, not a reduced set of full StarCi receipts. Do not claim full workflow, audit or UAT completion from Lite evidence.

## Choose the amount of process

- For a question or explanation, answer directly. Read source only when the answer needs it. Do not create a session, plan, worker or receipt merely to answer.
- For a typo, documentation edit or isolated presentation adjustment, state the intended edit briefly, inspect the relevant files, edit and check the result. No formal session is needed when the host permits Lite.
- For a small behavior fix, identify the observable failure, affected route or API, source boundary and proof needed. Keep this in the conversation; use the existing issue or change description if durable context is useful.
- Use full StarCi for a feature spanning repositories, an important end-to-end business journey, permission or tenant isolation changes, accounting/payment behavior, destructive data changes, migration, infrastructure, runtime operation, publication or deployment. A small diff can still have a large impact.

If the request is clearly authorized and the repository and scope are known, proceed. Ask only when ambiguity changes the target, behavior, external effects or acceptance criteria. An increased scope requires reclassification before the additional writes, not an extra approval for an already authorized step.

## Work loop

1. **Locate.** Check the repository root, relevant local instructions and current changes. Identify the real source and route; do not create a replacement application or assume a nearby checkout is the target.
2. **Bound.** Describe the intended outcome and the small area to change. Reuse the user's stated acceptance criteria. Do not generate formal business/architecture documents for an obvious local fix.
3. **Change.** Make the focused edit using the project's existing patterns. Keep one agent working by default; delegate only if requested or required by applicable instructions.
4. **Verify.** Run the checks that can expose a regression in the changed behavior. For logic, reproduce the failure and check the corrected result. For visible changes, inspect the actual rendered surface at relevant viewport sizes. A text-only documentation edit needs content/diff review; it does not need browser UAT. Existing mandatory repository checks still apply.
5. **Report.** State what changed, what was checked, and anything still unproved. Link the changed files. Keep command output and duplicated plans out of the final answer unless they explain a failure.

Do not rerun successful checks without a new change, failure or unresolved concern. If a check fails, inspect its actual cause and change the method or implementation before retrying. A repeated identical failure is a specific blocker or a reason to use the appropriate full operator, not a reason to manufacture another receipt.

## Full-mode handoff

For a host installed with full StarCi, follow its existing bootstrap when full mode is required. In a packaged Lite installation this skill is at `<Source>/.claude/skills/starci-lite/SKILL.md`; the full entry is `../../INDEX.md`. In a personal installation, resolve the full entry through the target repository's bootstrap rather than assuming the current directory owns `.claude`.

Carry forward the user request, affected repositories/routes, existing diff and verification results. Do not relabel Lite work as accepted full operator evidence. Open or resume the full session under its current contract, with its own gates. If full StarCi is unavailable, explain that limitation and use the host's normal development process; do not invent an installed runtime.

A follow-up in an active full workflow stays in that workflow. Selecting Lite must not discard its frozen scope, evidence or leases. This skill does not override unrelated host instructions or tool permissions. Existing full-only bootstraps need an explicit Lite installation/profile change to remove their unconditional entry overhead.

## Public pages and cost

A public page is not automatically a trivial change. An isolated visual fix can use Lite's rendered check; a complete landing-page journey or a request for formal UAT uses the applicable full workflow. Public UAT may use anonymous access with no fixtures only when the actual journey needs neither identity nor seeded data. Never create dummy accounts or a backend just to satisfy a test process, and never count a mock preview as product UAT.

Keep context proportional: read only the instructions and source needed for the current task, reuse unchanged context already read, and avoid parallel copies of the same analysis. Treat token savings as unmeasured until comparable runs record model, actual usage, retries, elapsed time and outcome. Do not quote a savings multiplier from document size or intuition.
