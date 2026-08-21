---
name: starci-setup-workspace
description: Configure, update, repair, or verify StarCi Source workspace routing in one continuous skill run. Use when a user declares a project and its fe, be, fe-legacy, or other repository roles; asks to make a start command resolvable; changes checkout paths or Git repositories; or needs ignored per-project and per-role workspace config files validated without editing target repositories.
---

# StarCi Setup Workspace

Read [`../../skill-shape.md`](../../skill-shape.md) and
[`../../common/config/workspace.md`](../../common/config/workspace.md) completely before acting.
This is one skill with internal Plan → Review → Apply stages; never invoke phase-suffixed workspace
setup skills.

## CONTEXT

Present the canonical table under the exact heading `### CONTEXT` before filesystem changes.

Require a user-declared `Project` and explicit target paths. Map frontend to `fe`, backend to `be`,
legacy frontend to `fe-legacy`, and preserve any additional user-declared lowercase role. Never
infer targets from Source. Resolve Trust, Skills and Workflow root from the Source containing
`AGENTS.md`, `.claude` and `.workflows`.

Use `<Source>/.workflows/upgrade/<app>/workspace-setup.md`. `Touching` is limited to that workflow
and `<Source>/.workspace/`; never edit target repositories.

## PROCESS

### Plan

Inspect each target read-only: resolved disk path, Git root, `origin` repository, branch, HEAD,
instruction entrypoints, manifests, primary contract and any explicitly assigned grammar id. Inspect existing role configs, Source
ignore rules and filesystem collisions. Require this exact shape:

```text
<Source>/.workspace/<project>/<role>/
└── config.json
```

Reject a global `workspace.json`, config below `.claude`, unignored `.workspace`, non-Git target,
missing `origin`, repository alias, junction, mount, mirror or cloned copy. For `fe`, prefer
`src/components/contracts/index.ts`, then its contracts directory; accept an explicit contract when
the repository uses another name. Never invent a contract path.

Append the Plan evidence to the workflow. Machine paths belong only in ignored `.workspace/`; the
tracked `.claude/common/config/` contains only the path-free protocol and schema.

### Review

Verify every proposed role against disk. Freeze project, role, `repository.diskPath`, required
`repository.gitRepository`, context routes including explicit `context.grammar`, schema version and collision handling. A direct user
instruction naming the project and exact targets authorizes this local routing boundary; ask one
batched question only for missing identity, ambiguous paths, collisions or a write outside the
declared boundary. Append the reviewed revision before writing configs.

### Apply

Run the bundled deterministic script:

```powershell
node <trust-root>/skills/starci-setup-workspace/scripts/setup-workspace.mjs `
  --source <Source> `
  --project <Project> `
  --target fe=<Frontend> `
  --target be=<Backend> `
  --target fe-legacy=<LegacyFrontend> `
  --contract fe=<FrontendContract> `
  --grammar fe=<GrammarId>
```

Include only declared roles. Add `--contract <role>=<path>` when discovery does not find an approved
contract. Add `--grammar <role>=<id>` only when the user explicitly assigns that grammar to the
role; never infer it from the project or repository name. The script writes one config per role,
points directly to the real checkout, records the Git origin and context paths, removes only
verified legacy `repo` links, and never changes target source.

Then verify all local routes:

```powershell
node <trust-root>/skills/starci-setup-workspace/scripts/setup-workspace.mjs `
  --source <Source> `
  --check
```

Require no `.workspaces`, `.claude/context/workspace.json`, global workspace registry,
`.workspace/.claude`, role `repo` entry or reparse-point repository alias. Require every config path
to exist, every Git identity to match disk, and `.workspace/` to remain ignored and untracked.
Append Apply evidence and exact command results to the same workflow.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED`
and `### OWED` in that order.

### OUTPUTS

Name the active project/role routing and verification result.

### CHANGES

List every local role config, removed verified legacy link and workflow append. Do not claim target
source edits.

### NEED APPROVALS

Report unresolved identity, path, role, collision or expanded write boundary. Otherwise write
`None`.

### WARNINGS

Record unavailable repositories, missing contracts or failed privacy proof.

### REJECTED

Record refused global registries, aliases, inferred targets or tracked machine config and their
replacement.

### OWED

Name only routes or proof that remain incomplete.
