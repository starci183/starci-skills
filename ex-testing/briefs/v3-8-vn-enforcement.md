# v3-8 — vấn đề 1: Vietnamese enforcement sweep + lang-exemption parity
Read `briefs/v3-HEADER.md` first.
SCOPE: all 4 example apps' eslint.config.mjs (ONLY the lang-exemption block — do not touch
other blocks the setup lanes are writing), all source files flagged for Vietnamese,
`ex-testing/lint/**`. Wait for `ex-testing/lint/setup-*.done` markers before editing an app's
config (poll 30s; survey read-only meanwhile).

## Mission
1. Once each app's canon config lands, ensure the lang-file exemption block exists:
   BE apps: `starci-be/no-non-ascii-source`, `no-emoji`, `no-ai-symbol` OFF on
   `**/messages/**`, `**/locale*/**`, `**/lang/**`, `**/*.lang.*` (ec-be already has it — use as
   reference; no-vietnamese has the exemption INSIDE the rule, no config needed).
   FE apps: canon-fe's language rule (find its real name: `no-second-language-in-source`)
   OFF on the same globs.
2. Sweep all 4 apps for Vietnamese in linted source (regex:
   `[À-ÃÈ-ÊÌÍÒ-ÕÙÚÝà-ãè-êìíò-õùúýĂăĐđĨĩŨũƠơƯưẠ-ỿ]`), excluding lang-file globs:
   - specs/tests with Vietnamese → REWRITE to English (mandatory — tests are English-only)
   - non-test source with Vietnamese → rewrite to English, UNLESS functional (matched/emitted
     at runtime) → then keep + `vn-ok: <reason>` inline comment
   - report every change.
3. Verify `npx eslint` on each app shows ZERO vietnamese/language-rule errors outside lang files.
4. `ex-testing/lint/VN-REPORT.md`: files changed, vn-ok usages + reasons, exemption blocks added.
Report: violations found/fixed per app, exemption parity status.
