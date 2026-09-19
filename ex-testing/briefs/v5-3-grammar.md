# Lane v5-3 — move grammar + heroicons into `.claude/packages/`, repoint consumers

SCOPE (exclusive): `.claude/packages/grammar/**`, `.claude/packages/heroicons/**` (new), `D:/Repositories/starci-academy-fe/package.json` + `packages/` removal ONLY. Do NOT touch example apps' source (they consume published `@starci/grammar@0.4.13` / `@starci/heroicons` from registry — unchanged). Do NOT touch other lanes' dirs (`packages/e2e-kit`, `packages/fe-kit`, any `examples/`).

## Context

`D:/Repositories/starci-academy-fe/packages/{grammar,heroicons}` are the sources of the published `@starci/grammar@0.4.13` and `@starci/heroicons@0.3.0`. `.claude/packages/` is now the starci lib monorepo (canon be/fe already live there). Move both packages so all publishable libs live in one place.

## Tasks

1. Copy `starci-academy-fe/packages/grammar` → `.claude/packages/grammar` and `starci-academy-fe/packages/heroicons` → `.claude/packages/heroicons` — byte-identical source, keep their package.jsons, tsconfigs, scripts/, vitest config, storybook config. Update `repository.directory` in each package.json to reflect the new home repo path.
2. In `.claude/packages/grammar`: `npm install`, then run the full `grammar:verify` equivalent — `npm run typecheck`, `npm test` (its test script runs `node --test` + vitest over ~87 spec files — all must pass), `npm run build`. Same for heroicons (check its scripts).
3. In `starci-academy-fe`: repoint `@starci/grammar` (and `@starci/heroicons` if present) from `"file:packages/grammar"` to `"file:../starci-academy-backend/.claude/packages/grammar"` (same for heroicons) — preserves the source-linked dev loop. Update the `grammar:build`/`grammar:verify`/`prepare` scripts to the new prefix. Run `npm install` there and confirm the link resolves (spot-check `node_modules/@starci/grammar` points into `.claude/packages/grammar`, e.g. `npm ls @starci/grammar`).
4. Delete `starci-academy-fe/packages/grammar` and `starci-academy-fe/packages/heroicons` ONLY after step 3 verifies. Check nothing else in academy-fe references `packages/grammar` paths (tsconfig paths, next.config transpilePackages, eslint globs, CI workflows) — repoint any found.
5. Report → `D:/Repositories/starci-academy-backend/.claude/ex-testing/lint/v5-3-REPORT.md`.

## Rules

- No version bumps, no publish — source relocation only.
- The academy-fe repo is a separate git repo: make its changes on its working tree, do not commit; note them in the report.
- If any academy-fe consumer hard-codes `packages/grammar` (storybook config, tsconfig references), fix it properly — no symlinks unless a config cannot express the path.
