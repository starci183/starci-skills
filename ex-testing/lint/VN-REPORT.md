# VN-REPORT — v3-8 Vietnamese enforcement sweep + lang-exemption parity

Scope: the 4 example apps' `eslint.config.mjs` (lang-exemption block only), all source files
flagged for Vietnamese, `ex-testing/lint/**`.

## Violations found / fixed per app

| App | Vietnamese hits found | Fixed | Remaining (non-lang) |
|---|---|---|---|
| ecommerce-app-be | 0 | 0 | 0 |
| todo-app-backend | 1 file (2 letters) | 1 file | 0 |
| ecommerce-app-fe | 0 | 0 | 0 |
| todo-app-frontend | 0 | 0 | 0 |

### Files changed

- `examples/todo-app-backend/src/modules/integrations/notify-queue/resp.spec.ts`
  — spec carried `'é'` (U+00E9, inside the Vietnamese letter class) in a comment and a
  literal used to prove RESP bulk strings count UTF-8 BYTES not characters. Specs get no
  exemption, so it was rewritten: `'é'` → `'ü'` (U+00FC), still exactly 2 bytes in UTF-8,
  outside the Vietnamese class — the byte-length assertion is unchanged. Verified:
  `npx jest resp.spec.ts` → 12/12 pass; `npx eslint src` → 0 `no-vietnamese` /
  `no-non-ascii-source` hits on the file.

### `vn-ok:` usages

None. No functional Vietnamese literal needed keeping — the one flagged literal was test
data whose semantics a different 2-byte character reproduces exactly, so translation was
free. (Only `vn-ok:` matches in the tree are the pragma's own definition inside
`plugins/eslint/index.mjs`, which is rule source, not a usage.)

## Exemption parity status

All 4 apps carry the lang-file exemption block on the canon globs
(`**/messages/**`, `**/locale*/**`, `**/lang/**`, `**/*.lang.*`). No edits were required
from this lane — each setup lane landed the block itself; this lane verified each one.

| App | Block | Rules exempted | Notes |
|---|---|---|---|
| ec-be | eslint.config.mjs (final block) | `starci-be/no-non-ascii-source`, `starci-be/no-emoji`, `starci-be/no-ai-symbol` | Reference config — already correct. `no-vietnamese` exempts lang files inside the rule, no config needed. |
| todo-be | eslint.config.mjs (final block) | same 3 rules | v3-0 mirrored ec-be verbatim. Vendored `plugins/eslint/index.mjs` is byte-identical to host (717 lines) — `VIETNAMESE_LANG_FILE` exemption present. Verified against config written 12:27; `setup-todo-be.done` marker still pending at report time — no edit needed, so the gate was moot. |
| todo-fe | eslint.config.mjs | `starci-fe/no-second-language-in-source` | Added by v3-2 (lines 77-84). |
| ec-fe | eslint.config.mjs | `starci-fe/no-second-language-in-source`, `starci-fe/no-emoji-in-source` | Added by v3-3 (lines 76-87); also exempts emoji on the globs — strictly wider than the brief required, consistent with BE's 3-rule block. |

FE gap note (for the record): `starci-fe/no-second-language-in-source` already skips
content paths internally (`/messages/*.json`, `__fixtures__`, `*.test.*`, `*.spec.*`), but
NOT `locale*/`/`lang/`/`*.lang.*` — hence the config block. `starci-fe/no-emoji-in-source`
shares that same internal list; only ec-fe's block covers emoji on the 4 globs, todo-fe's
does not. If i18n lands emoji-bearing content under `locale*/`/`lang/`/`*.lang.*` in
todo-fe, `no-emoji-in-source` will flag it — flagging here since the brief scoped FE to
the language rule only.

## Verification

`npx eslint` filtered to language rules (`vietnamese|non-ascii|emoji|ai-symbol|second-language`):

- ec-be: `npx eslint src apps` → **0** language-rule hits
- todo-be: `npx eslint src` → **0** language-rule hits (977 total errors across all rules — other lanes' debt)
- todo-fe: `npx eslint src` → **0** language-rule hits
- ec-fe: `npx eslint apps types scripts` → **0** language-rule hits (984 total — other lanes' debt)

Raw sweep regex `[À-ÃÈ-ÊÌÍÒ-ÕÙÚÝà-ãè-êìíò-õùúýĂăĐđĨĩŨũƠơƯưẠ-ỿ]` over `examples/` now
matches only rule-source definitions (`plugins/eslint/index.mjs` Vietnamese-letter class
and `Tiếng Việt` endonym), non-linted work product (`.starciwork/**`), and exempted lang
content: todo-fe's `src/messages/{en,vi}.json` landed via i18n lane v3-4 — a live test the
exemption passes (`npx eslint src` → 0 problems total, vi.json's Vietnamese unflagged).

## Blockers

None. `setup-todo-be.done` was still pending at report time, but no config edit was needed
anywhere — all four blocks were already present and verified working.
