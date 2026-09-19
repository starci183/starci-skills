# Lane Q6 (qwen) — eslint setup + report

SCOPE (exclusive): NEW files `.eslintrc.*`/`eslint.config.*` + `.eslintignore` in each app root + lint script entries ARE allowed in `package.json` (scripts section only). FIXES only inside `src/features/**` of each app (no other lane owns that).

Set up eslint (typescript-eslint, nest-sensible ruleset) per app, add `lint` script, run it, write report to `ex-testing/LINT-REPORT.md` with per-app error/warning counts and the top issues. Fix straightforward issues only inside src/features; everything else goes in the report, untouched.
