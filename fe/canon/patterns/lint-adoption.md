# lint adoption

## Definition

Lint adoption is the effective ESLint configuration applied to a real production file, not the
presence of a plugin folder, an import, or a similarly named local rule set. The deciding question
is: does `eslint --print-config` show every StarCi FE canon rule at `error` and refuse inline config?

What holds this law is
[`sources/fe/lint-adoption.mjs`](../../../sources/fe/lint-adoption.mjs). It audits the resolved
configuration after ESLint has merged every config layer. The repository gate is
[`scripts/audit-fe-lint-adoption.mjs`](../../../scripts/audit-fe-lint-adoption.mjs).

Implementation anchors in `starci-academy-fe`: `eslint.config.mjs` and
`plugins/eslint/index.mjs`. They are evidence to inspect at the Context Lock commit, not substitutes
for the effective-config audit.

## Rules

**LINT-ADOPTION-1.** A consuming project attaches the gathered StarCi FE plugin, recommendation and
linter options as one versioned unit, because a handwritten project-local subset becomes a second
canon the moment either list changes.

**LINT-ADOPTION-2.** The project runs the canonical effective-config audit against at least one real
production source file, because loading a plugin proves only that rules exist, not that ESLint
enables them.

**LINT-ADOPTION-3.** Every rule in the canonical recommendation resolves to `error`, because a
parallel handwritten plugin or a warning-level rollout creates a second, weaker architecture.

**LINT-ADOPTION-4.** The resolved config sets `linterOptions.noInlineConfig` to `true`, because an
inline disable turns repository trust into a caller-local preference.

**LINT-ADOPTION-5.** Apply and fidelity work stop before production edits when this audit fails,
because code written under incomplete enforcement can be legal locally while violating canon.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Claim adoption because a `starci-fe` plugin is imported | The imported plugin may omit rules or never enable them | Audit `eslint --print-config` for a real production file |
| Keep a handwritten parallel subset as the project authority | Canon and the subset drift independently | Attach the gathered StarCi FE plugin, recommendation and linter options, then prove effective parity |
| Lower missing debt to warning | Warning makes an architecture boundary optional | Fix existing debt, then enable the full strict set |
| Begin Apply while adoption fails | New code is being judged by incomplete trust | Repair lint wiring within an approved boundary or stop |

## Examples

Right: run the audit against `src/components/pages/DashboardPage/component.tsx` and proceed only
after it returns `ok: true`.

Wrong: point to `plugins/eslint/index.mjs` and call the project adopted without inspecting the
resolved config. The difference is effective enforcement rather than file presence.

Right: keep every canonical rule at `error` and `noInlineConfig: true`.

Wrong: enable most rules at `error` while leaving newly added canon rules absent. The difference is
complete canon parity rather than a familiar plugin name.
