# @starci/skills — Work 3.0 alpha

Prompt → named skill/mode → selected business pieces → bounded operations → real result.

[Main entry](SKILL.md) routes through [14 presets](skills/catalog.json) and real [op contracts](v3/ops/catalog.json). Across every skill/worker/retry in a prompt: max three sequential waves × three parallel invocations. No invented workflow, mandatory request/response ledger or implicit provisioning.

[Runtime/storage guide](v3/README.md) · [Vietnamese](README.vi.md)

## Development candidate

This is `3.0.0-alpha.2` source. Version edits do not publish/activate it; do not assume registry/latest or an existing host has this candidate. Node 20+, no external runtime dependencies.

```sh
npm test
node bin/starci-skills.mjs work help
node bin/starci-skills.mjs init --dir <isolated-host-repository>
node bin/starci-skills.mjs doctor --dir <isolated-host-repository> --quick
```

Installer writes declared package files into `.claude`, preserves custom host instructions and ignores only product `.work/_local/`. Init on a managed install uses update semantics. It does not create business work, resolve credentials or migrate product data.

Older majors require `update --upgrade-major`. Only unchanged manifest-owned retired runtime files are removed; modified/unowned files and personal settings remain with a review notice. Force replaces current package files, not unrelated/modified retired files. Known old bootstraps can migrate to the full router; custom conflicts stop before writes. No-bootstrap leaves host routing unchanged and cannot abandon a still-active Lite entry.

## Retired sources and proof boundary

V2 alias/routing/workflow machinery/templates/tests/generated website and Lite are absent. Historical recovery uses Git, not an executable fallback or legacy test command. Existing product `.worktrees` and Git worktrees are separate owners. Source-to-Work migration is a selected preset with preservation checks.

Tests cover local core/contracts/presets/CLI/adversarial fixtures and relocated installer behavior, not product UAT or model decision quality. Real screenshots must be captured/inspected; source SHA is not served-build proof.

Removing website source/CI does not unpublish an existing website. This refactor performs no registry publication, live rollout, account operation or product ledger migration.
