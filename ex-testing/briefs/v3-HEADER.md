# FLEET v3 — shared rules (READ FIRST)

10-agent fleet: canon lint + i18n/theme + coverage + sonar on the example apps.
Work ONLY inside `D:/Repositories/starci-academy-backend/.claude` — absolute paths below.

## Hard rules
- NO git operations. The supervisor merges.
- Touch ONLY files in YOUR scope map. Another lane owns the rest.
- Never weaken rules: no eslint-disable, no severity drops, no widened ignores.
- `eslint --fix` first for mechanical debt, then hand-fix.
- Verify before reporting: the commands your brief lists must actually pass — do not
  claim green without running them.
- Report: files touched, per-rule fixed/remaining counts, blockers (honest).

## Canon
- Packages now live IN the trust tree: `.claude/packages/{be,fe}` = @starci/eslint-canon-{be,fe}
  (moved from the starci-eslint repo; still published to npm — install published versions).
- BE reference config: `D:/Repositories/starci-academy-backend/eslint.config.mjs`
  FE reference config: `D:/Repositories/starci-academy-fe/eslint.config.mjs`
- Working canon-be example config: `examples/ecommerce-app-be/eslint.config.mjs` (DONE —
  mirror this shape for todo-be, including the lang-file exemption block).
- Vendored local plugin (7 rules canon doesn't publish): copy from
  `D:/Repositories/starci-academy-backend/plugins/eslint/` — already updated with the
  lang-file exemption in no-vietnamese.

## Convention discovered (ec-be, enforced by rules)
- Same-capability imports stay RELATIVE; cross-capability MUST use aliases
  `@modules/* @features/* @tests/*` → `src/*` (tsconfig paths + jest moduleNameMapper +
  `tsconfig-paths/register` for runtime — all already wired in ec-be; replicate in todo-be).
- `no-self-module-alias` and `no-relative-capability-escape` are the two rules that police this.

## Vietnamese rule (vấn đề 1 — DECIDED)
- Vietnamese allowed ONLY inside lang/dictionary files: `**/messages/**`, `**/locale*/**`,
  `**/lang/**`, `**/*.lang.*`. Rule `no-vietnamese` has the exemption built in; config also
  exempts `no-non-ascii-source`/`no-emoji`/`no-ai-symbol` on those globs.
- Tests: FULL English, no exemption, ever.
