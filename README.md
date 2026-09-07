# @starci/skills — Work 3.0 alpha

A selected-operation development workflow with a product-owned `.work` completion tree. No automatic chains, mandatory request/response directories or implicit provisioning.

Read [the v3 guide](v3/README.md) and [operator catalogue](v3/ops/catalog.json). Vietnamese entry: [README.vi.md](README.vi.md).

## Local candidate

This checkout is a local `3.0.0-alpha.1` candidate, not a published package. Run from this checkout:

```sh
node bin/starci-skills.mjs work help
npm test
node bin/starci-skills.mjs init --dir <new-host-repository>
node bin/starci-skills.mjs doctor --dir <host-repository> --quick
```

Do not use an unverified registry/latest command and assume it installs this candidate. Node 20+ is required; runtime code has no external package dependencies.

The installer writes `.claude` package paths and managed bootstrap text, preserves custom host instructions, and ignores only `.work/_local/`. It does not initialize a product business, resolve credentials or migrate `.worktrees`.

An installed older major requires `update --upgrade-major` after reviewing the guide. Local runtime edits are retained unless explicitly forced. Unknown/conflicting bootstrap instructions require reconciliation before mutation. `--no-bootstrap` preserves host instructions and does not claim active routing changed.

The explicit Lite profile remains available for untracked bounded maintenance; tracked business work uses the same v3 entry, never a v2 full-session handoff.

## Verification scope

`npm test` runs v3 core, operator, CLI, adversarial and installer integration checks. These are local synthetic checks, not actual product UAT. `npm run test:legacy` preserves the old suite for historical investigation. Retained v2 scripts/docs are not the active runtime contract.

No publication, production rollout, credential migration or existing evidence cleanup is performed by this refactor.
