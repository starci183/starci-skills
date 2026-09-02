# A4 dry run 2 — `workspace.bind` on `starci-academy/be`

Date: 2026-09-02. Portable declaration `.workspaces/projects/starci-academy/be.json`, hydrated route
`.workspaces/local/routes/starci-academy/be/config.json`, checkout `D:/Repositories/starci-academy-backend`
on `mtp` at `0b540dd2`, no runtime consumed, no hints, no cached receipt.

Both artifacts pass the operator's validators; a copy with a broken `operatorId` is rejected with
`$.operatorId: expected "workspace.bind"`: [input.json](input.json), [output.json](output.json).

## What was bound

| Binding | Value | How it was obtained |
| --- | --- | --- |
| Portable route | source, `https://github.com/starci-lab/starci-academy-backend`, `mtp` | read from `be.json`, fingerprint is the file hash |
| Hydrated route | same repository and branch, disk path and git root both the Source root, workspace root `.workspaces` under it | read from `config.json`, fingerprint is the file hash |
| Observed checkout | `mtp`, head `0b540dd2` = frozen head, origin equals the declared repository | `git rev-parse`, `git branch --show-current`, `git remote get-url origin` |
| Dirty paths | 75, of which 21 under `src/features/api/core` and 54 outside | `git status --porcelain` |
| Identity | machine `starci-academy-local-state-v1`, roster ref `.workspaces/local/credentials` (two `.key.enc` files), never read | `device-state.json` keys and a directory listing |

## Outcome

`blocked` · `CHECKOUT_DIRTY` · owning domain `source` · retryable.

The route resolves cleanly: portable and hydrated declarations agree, the observed head equals the
frozen head, the branch is the mutation branch. The checkout is not clean: 54 dirty paths lie outside
the one write root a backend mission would declare, and they are the uncommitted Pro subscription,
seeder, migration, and socket work plus four `.workspaces/projects/*` declarations. The receipt names
all 54 as subjects.

## Findings about the skills tree, not the product

1. **The failure was unreachable.** `validate-input.mjs` rejected any observation with a dirty path
   outside the write roots as invalid input, while `execute.md` step 5 and the failure table promised
   `CHECKOUT_DIRTY` for exactly that case. A dirty checkout is a condition of the world, not a
   malformed document. Fixed in `47d21798`: the observation validates and the operator answers with
   the typed failure; the self-test covers both halves.
2. **Both declarations point at v7 schemas.** `be.json` and `config.json` carry `$schema` paths under
   `.claude/readiness/initialization/workspaces/`, and the hydrated route names `source.skills` as
   `.claude/skills`. Neither path exists in the v8 tree. The files still resolve because nothing reads
   `$schema`; the drift belongs to whatever tooling writes these declarations, not to `workspace.bind`.
3. **Identity shape.** v8 binds one `credentialRosterRef` with `rosterEncrypted: true`. The workspace
   holds per-key `.key.enc` files under `.workspaces/local/credentials` and a `masterIdentity` in
   `device-state.json`; the directory was bound as the roster. Either the contract accepts a directory
   of sealed keys by name, or the workspace grows one roster file. Open.
4. **`authorityRoots` was not exercised.** The route was blocked before it was emitted, so the new
   derived `businesses` field (`6aa4d3b8`) is still proven only by the self-test. A clean checkout is
   the missing precondition.

## Facts for the product owner

- Seventy-five paths are dirty on `mtp`; fifty-four of them are outside `src/features/api/core`.
- Four `.workspaces/projects/*` declaration files are modified alongside product source.

Nothing here was changed by the dry run.
