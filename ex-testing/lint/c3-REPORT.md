# c3 lane report — triage: `providers/`, `runtime/`, `upgrades/`

## Verdicts

| Path | Verdict | Evidence |
| --- | --- | --- |
| `providers/` | **live** — stays at root | `SKILL.md:40` agent contract: "load `providers/catalog.yaml`, then the selected provider's … index, capabilities, api, recipes and validation"; shipped via `package.json` `files` (`"providers/"`); `INDEX.yaml:50` `providerCatalog: providers/catalog.yaml`; consumed by canon `scripts/route/dispatch-op.mjs` (providers/orca/calls.yaml + index.yaml managedFallback, lines 17-21, 173-184), `hosts/orca/{launch.mjs:121, calls.mjs:9,33}`, `execution/supervision.mjs:9`; read by tests `workflow-kernel.spec.mjs:37` (`../providers/orca/calls.yaml`) and `workflow-inputs.spec.mjs:397`; cross-referenced by `modules/schemas/{index,relationships}.yaml`. `providers/validate.mjs` is the "executable provider validator" SKILL.md:40 requires. |
| `runtime/` | **live** — gitignored local state, dir left in place | `.gitignore:10` `/runtime/` — entire tree is untracked (`git ls-files runtime` = empty). Contents are only `runtime/engine/builds/<sha>/.dist/` — sealed engine build cache, as the brief predicted. Deliberately excluded from the package (`MASTER.md` F2: "npm pack contains no … `runtime/`"). Nothing tracked to `git mv`; not junk — it is the live pin cache the sealed-runtime design produces. |
| `upgrades/` | **live** — stays at root | Shipped via `package.json` `files` (`"upgrades/"`). `bin/starci-skills.mjs` `upgradeNote()` (line ~453) reads `<installed>/.claude/upgrades/index.yaml` at update time and prints the version's note path. `tests/integration.spec.mjs:158-171` asserts the installed `.claude/upgrades/index.yaml` matches `schema: starci/upgrades@1`, contains a `version:` entry equal to `package.json` version (1.0.4 — present, note `upgrades/1.0.4.md` exists), and that `starci update` prints `upgrade notes: .claude/upgrades/<version>.md`. Linked from `SKILL.md:17`, `README.md:220`, `UPDATE.yaml`, `docs/workflow-kernel.md`, `docs/5-plus.md`. |

Junk: none found in scope (`providers/` = yaml contracts + validator; `runtime/` = cache only; `upgrades/` = 3 notes + index).

## Brief correction

`c3.md` guessed `upgrades/` → `legacy/upgrades`. The evidence contradicts it: the installer reads `upgrades/index.yaml` from the *installed* tree and the integration spec asserts `.claude/upgrades/<version>.md` exists after install. Moving it would break the installed-path contract, `bin/starci-skills.mjs`, and `tests/integration.spec.mjs` — a false-negative move. Kept live per the "unsure → live / don't break the runtime" rule.

## Moves

None — all three owned paths are live.

## Broken imports fixed in scope

None — nothing moved.

## needed_elsewhere (cross-scope, not touched)

- `tests/integration.spec.mjs:327` "retirement removes only unchanged owned files…" fails: actual retired list unexpectedly contains `scripts/yaml-source.mjs` (parked by lane c6 into `legacy/scripts-loose/`), `tests/code-examples.spec.mjs` and `tests/runtime-import-closure.spec.mjs`. The installer's owned-roots/retired manifest likely needs updating now that those files moved — owner is the lane that moved them / the installer lane, not c3.
- `tests/workflow-kernel.spec.mjs` has 15 pre-existing failures in kernel orchestration internals (`'blocked' !== 'done'`, `Cannot read properties of undefined (reading 'op'/'node'/'child')`, fan-out cap). No path/ENOENT errors; unrelated to `providers/`/`runtime/`/`upgrades/` — they existed before this lane ran (no files changed).

## Verification

- `node --test tests/integration.spec.mjs` → 26 tests, **25 pass / 1 fail** (pre-existing failure above). The upgrades-contract test "an update that changed the installed version names the upgrade note of what it installed" **passed** — direct proof `upgrades/` is correctly wired.
- `node --test tests/workflow-kernel.spec.mjs tests/workflow-inputs.spec.mjs` → 183 tests, **168 pass / 15 fail** (pre-existing kernel failures above; `providers/orca/calls.yaml` loaded fine — the typed-Orca-calls test passed).
- `git status` confirms this lane modified zero source files; no new `.dist/` at root; `knowledge/` untouched; no commit.
- Note: `git status` shows `M providers/orca/adapters/*.yaml` + `providers/orca/recipes.yaml` (authored `terminalFallback`/`verifiedAt` blocks) — a concurrent lane's edit that appeared mid-session, not c3's. Left untouched.
