<p align="center">
  <img src="./docs/public/brand/starci-skills-wallpaper.png" alt="StarCi Skills wallpaper" width="100%" />
</p>

<p align="center">
  <img src="./docs/public/brand/starci-logo.png" alt="StarCi logo" width="112" />
</p>

<h1 align="center">StarCi Skills</h1>

<p align="center">
  One source of truth that turns a loose product request into reviewed decisions,
  bounded source changes, and machine-checkable proof.
</p>

## Install

Clone the complete trust tree into the Source's `.claude` directory:

```bash
cd <Source>
git clone https://github.com/starci183/starci-skills.git .claude
```

The installation is intentionally kept together:

```text
<Source>/
  .claude/
    INDEX.md
    contexts/
    requests/
    grammars/
    brainstorms/
    compilers/
    gates/
    kernel/
    standards/
    workflows/
    machines/
    operations/
    publication/
    scripts/
    skills/
```

Do not copy individual skills into a second directory. A skill can depend on schemas, scripts,
grammars, compilers, gates, and records elsewhere in this tree; copying one folder creates a partial install
that can drift from its dependencies.

The original stage trees remain the detailed authorities. The v4 roots are stable process routers:

- `kernel` resolves routes, state and approval identity;
- `workflows` groups discoverable skills by lifecycle without moving their `SKILL.md` entries;
- `standards` connects role patterns, gates, rule bindings and assurance;
- `machines` exposes deterministic parity and evidence checks;
- `operations` routes deployment, MCP, readiness and runbooks without merging their laws;
- `requests` keeps source-first frontend feedback, rejected attempts and pending grammar/principle learning;
- `publication` keeps generated human documentation separate from runtime context.

The binding chain is `pattern situation → gate situation → published machine rule → executable proof`.
A rule in the machine with no gate route, or an enforced gate with no machine rule, is a broken trust
tree even when a consumer repository happens to lint green.

## Use with Codex and Claude

Keep `AGENTS.md` and `CLAUDE.md` at the Source root as thin bootstraps. Both files should contain only:

```markdown
# StarCi agent bootstrap

Before planning, reading target source, or running a skill, read
[`<Source>/.claude/INDEX.md`](.claude/INDEX.md) completely and follow its load order.

This file is only a bootstrap. Do not copy context, brainstorm, compiler, gate or skill rules into it:
the entry routes, and a rule copied here becomes a second home that nobody remembers to update.
```

- **Codex** reads `AGENTS.md`. Ask it to read the exact
  `.claude/skills/<skill>/SKILL.md` entry when invoking a StarCi skill.
- **Claude Code** reads `CLAUDE.md` and discovers project skills under `.claude/skills`; invoke them by
  name, for example `/starci-init` or `/starci-stale-list`.

StarCi deliberately keeps the authoritative implementation in `.claude`. There is no duplicate
`.agents/skills` tree: `AGENTS.md` routes Codex into the same entry that Claude uses.

## Initialize a Source

After installing the tree, run `starci-init` and explicitly name the project and roles. Project
identity is never inferred from a folder name.

With Codex:

```text
Read .claude/skills/starci-init/SKILL.md and run it for this Source.
Project: academy. Roles: fe and be.
Prepare the bootstrap, workspace routes, and worktree state.
```

With Claude Code:

```text
/starci-init setup this Source for project academy with roles fe and be
```

The skill presents four independent write boundaries for approval:

1. `AGENTS.md` and `CLAUDE.md` — entry into the trust tree.
2. `.workspaces/` — tracked portable declarations plus generated machine-local routes.
3. `.worktrees/<project>/` — local mounts of durable `businesses` and `debts` Git branches.
4. `.sessions/<project>/<session-id>/` — ignored disposable invocation evidence; never durable authority.

Review the exact paths shown by the skill and approve only the boundaries you want initialized.

## Multiple projects and roles

One Source can manage many projects, and each project can expose several roles. Every
`(project, role)` pair has one verified route:

```text
<Source>/
  .workspaces/
    config.json
    projects/
      academy/
        fe.json
        be.json
      payments/
        fe.json
        be.json
    ports/
      config.json
      academy.json
      payments.json
    local/
      routes/
        academy/
          fe/config.json
          be/config.json
  .worktrees/
    academy/
      businesses/
      debts/
    payments/
      businesses/
      debts/
  .sessions/
    academy/<session-id>/
    payments/<session-id>/
```

`.workspaces/config.json` holds only Source-wide defaults:

```json
{
  "$schema": "../.claude/contexts/workspaces/config.schema.json",
  "version": 1,
  "defaultLang": "vi"
}
```

Each tracked `.workspaces/projects/<project>/<role>.json` contains only credential-free GitHub identity,
expected branch and repository-relative context paths. `starci-init` hydrates it into
`.workspaces/local/routes/<project>/<role>/config.json`, which describes an existing checkout: its declared identity,
absolute paths, Git root, remote, branch, observed head, required instructions, manifests, and any
role-specific contract. Routes describe checkouts; they do not clone or copy them.

Commit only `.workspaces/config.json`, `.workspaces/projects/**/*.json` and `.workspaces/ports/*.json`.
`.workspaces/local` is ignored because it contains machine-local paths and observed Git state. Run
`starci-init` again when adding a role or project, or when a checkout or branch changes. Do not duplicate
the nearest config by hand.

StarCi frontend work resolves one compact visual system from `grammars/starci/design-system.json`. The
routed profile may override declared roles such as accent; a page/session file records deviations only.
Legacy or screenshot baseline wins inside its exact target scope, while MASTER keeps every untouched region
visually consistent. Grammar selects semantic owners and principles resolve only remaining deltas.

Conversation provenance is project-scoped and provider-neutral:

```text
.worktrees/<project>/businesses/
  conversations/
    conversation-registry-v1.json
    objects/sha256/
  businesses/
    business-registry-v1.json
.sessions/<project>/<session-id>/conversations/
  transcripts/
.workspaces/local/state/conversations/
  search-indexes/
    search.sqlite
    vectors/
```

Use `starci-conversation-record` to bind an OpenAI/ChatGPT/Codex or Anthropic/Claude exchange to exact
frontend/backend artifact hashes. Registries contain only redacted metadata and immutable references;
raw transcript content stays provider-held, cache-only, or encrypted in approved external storage.

## Multiple Sources

Give every Source its own authority and runtime state:

```text
Sources/
  product-source/
    AGENTS.md
    CLAUDE.md
    .claude/
    .workspaces/
    .worktrees/
  platform-source/
    AGENTS.md
    CLAUDE.md
    .claude/
    .workspaces/
    .worktrees/
```

A Source may route to target repositories anywhere on the machine. Start Codex or Claude from the
intended Source root so its bootstrap, routes, and decision state remain unambiguous.

## Verify the setup

Before trusting a Source that is new or has not been used recently:

```text
# Codex
Read .claude/skills/starci-stale-list/SKILL.md and list stale projects in this Source.

# Claude Code
/starci-stale-list
```

Use `starci-init` to repair a missing or stale route. Use `starci-diagnose` when a skill stops and it
is unclear whether the environment is incomplete or the skill itself is defective.

## How the tree works

StarCi separates capabilities by what each stage may return:

| Tree | Species | Returns |
| --- | --- | --- |
| `contexts` | location | verified read and write locations |
| `grammars` | product-family authority | closed facts, outcomes, owners, capsules, cases and templates selected explicitly by workspace route |
| `brainstorms` | creation | 3–4 candidates for the owner to choose from |
| `compilers` | execution | one deterministic answer from an accepted shape |
| `gates` | refusal | pass, or reject with exact evidence |

`skills` contains the capability bindings and their common reporting shape. `scripts` contains the
deterministic utilities that make schemas and approval hashes enforceable rather than decorative.

Each paired module has three records with separate audiences:

- `context.md` is the compact English runtime binding loaded by an agent;
- `en.md` is the complete English record for a human reader;
- `vi.md` is the complete Vietnamese record for a human reader.

A skill starts at its binding `SKILL.md`, then loads only the reached modules' `context.md` records.
It never combines `en.md` or `vi.md` with runtime instructions. Runtime records contain no publication
metadata; `context-manifest.json` tracks their source hashes and schema versions out of band. Run
`node scripts/compile-context.mjs --check .` after changing a paired module.

Dependency checks are lane-specific: `node scripts/check-deps.mjs --context` validates runtime,
`--en` validates English publication, and `--vi` validates Vietnamese publication. Use `--all` to run
all three without allowing one lane to cross-load another.

## Documentation site

The site is generated from the records; files under `docs/content/` are generated, not hand-authored.
Module navigation publishes only `EN` and `VI`; compact `context.md` files remain runtime-only and do
not become Nextra pages. Skill navigation additionally publishes `SKILL.md` as `Agent (EN)`.

```bash
cd docs
npm install
npm run sync
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a production check:

```bash
npm run build
```

Documentation shelves are declared in `docs/publication.mjs`. The hosting contract lives in
`netlify.toml`, including the docs base, build command, publish directory, and pinned Node version.

## Validate an artifact

```bash
node scripts/validate-artifact.mjs \
  --schema brainstorms/layouts/schema.json \
  --data <batch.json> --hash
```

## Brand assets

The text-free logo, favicon, and README wallpaper live in
[`docs/public/brand`](./docs/public/brand). Their checked-in relative paths let GitHub and the generated
documentation render the same StarCi identity without depending on a temporary local file.
