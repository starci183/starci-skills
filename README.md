# @starci/skills

StarCi Skills is the `.claude` runtime of a repository: one entry (`SKILL.md`), operators with explicit boundaries,
goal-derived workflows, one closed routing map and one tool registry. An agent in Claude Code or
Codex reads its installed profile's entry through a short bootstrap and follows its load order; the tree
does the rest. Documentation: <https://harness.starci.org/docs/>. Tiếng Việt: [README.vi.md](README.vi.md).

## V3 operator development

The [v3 foundation](.claude/README.md) contains modular work schemas, aliases and all operator
sources. Each operator has request, response, validation, steps and criteria modules with local
tests. Build production bundles with `python scripts/build.py`; install
`tests/requirements-schema.txt` and run `python scripts/test_foundation.py` to check them.
Generated `.dist/` bundles are tracked and shipped in the package. The existing orchestration
engine continues to use its current contracts; the new bundles define the agent execution path
and do not silently migrate existing session records.

## Install

```bash
npx @starci/skills init
```

Run it at the root of the repository that will own the runtime. New installations enter StarCi Lite, which classifies the request and routes substantial work to full StarCi. It copies the tree into `./.claude`,
writes `CLAUDE.md` (read by Claude Code) and `AGENTS.md` (read by Codex) when they do not exist, appends the
StarCi entry once to existing files while preserving their instructions, and
adds `.worktrees/sessions/` to `.gitignore`, where sessions live. Commit `.claude/` with the repository:
it is source, not a cache. Requires Node 20 or newer; the CLI has no dependencies. The same CLI runs
straight from the Git branch when the registry has not yet listed a version:

```bash
npx --package=github:starci183/starci-skills#main starci-skills init
```

The default entry for a new installation is [StarCi Lite](skills/starci-lite/SKILL.md); it owns the impact-based classification. Use `npx @starci/skills init --profile full` to select the full entry explicitly, or `update --profile lite` to switch an existing host. All full operators remain installed. Updates retain the installed profile, including legacy full installations without profile metadata. The manifest records `profile` separately from `bootstrapProfile`: `--no-bootstrap` leaves host instructions unchanged and does not claim that their entry changed. Custom full-only instructions must be reconciled explicitly; the installer never removes them. Active full sessions keep their scope, evidence and gates.

| Command | What it does |
| --- | --- |
| `npx @starci/skills init [--dir <repo>] [--profile <full-or-lite>] [--force] [--no-bootstrap]` | Installs the tree and the bootstraps. Refuses a populated `.claude` it did not install unless `--force`, and even then replaces only the runtime paths. |
| `npx @starci/skills update [--dir <repo>] [--profile <full-or-lite>] [--force] [--no-bootstrap]` | Brings an installed tree to this package's version. A file changed locally is kept and listed; `--force` takes the package version. Files outside the runtime paths are never touched. |
| `npx @starci/skills doctor [--dir <repo>] [--quick]` | Runs the tree's own validators on the installed copy (routing, alias, operators, workflows, defaults, templates, knowledge citations, the operator and helper self-tests and the script specs) and reports files changed since install. |
| `npx @starci/skills version` | Prints the package version. |

The runtime paths are `UPDATE.md`, `UPDATE.vi.md`, `INDEX.md`, `INDEX.vi.md`, `SKILL.md`, `SKILL.vi.md`, `routing.json`, `alias/`,
`helpers/`, `knowledge/`, `operators/`, `readiness/`, `resources/`, `scripts/`, `templates/`, `workflows/`. The
manifest `.claude/.starci-skills.json` records the installed version and a hash per file; `update` and
`doctor` read it.

## Claude Code and Codex

Under the full profile, both runtimes are entered the same way. `CLAUDE.md` and `AGENTS.md` carry the same bootstrap: read
`.claude/INDEX.md` completely and follow its load order. The processor runs each operator on the profile
its `operator.json` binds (`resources/agents/profiles/openai.json` for Codex, `claude.json` for Claude
Code, paired in `resources/orchestrator.json`), and each operator may call only the tools its
`operator.json` declares from `resources/tools.json`. The English files are the runtime authority; the
`.vi.md` siblings are for people.

## Sessions in 2.2

A session belongs to the Codex task/worktree or Claude host session. Child agents are workers within it.
User workflow topology is selected and gated before this session starts. Its names, demand selector,
peer limits, communication channel, tracking address and close rule have one executable home:
[workflowTopologies](resources/orchestrator.json). This layer is separate from operator execution mode.

[SKILL.md](SKILL.md) takes the prompt through a scope draft with a goal, expected results and examples;
it asks only for confirmation that is still missing. Workflows are derived from that goal and typed outcomes.

Before an operation, the runtime freezes its expected result, inputs and environment. Afterwards,
validators compare actual evidence, route mismatches to the repair owner and retain every attempt.
[orchestrator.json](resources/orchestrator.json) owns the limit of three workers and resource isolation.
Successful close retains a compact and hashed evidence bundle under `.worktrees/done/` before
removing only that session folder. Unfinished sessions remain available for resumption.

Reasoning and review use Sol/Fable; execution uses Sol/Opus. Sol has separate role contexts and
grants. [Resources](resources/INDEX.md) lists the actual assignments. UI procedures bind complete
applicable knowledge, analyze the Grammar family before changes and judge the rendered aesthetic.
`knowledge.repair` and `library.update` own the corresponding repairs.

Each accepted operator presents **Operator Result** directly in the chat. UI generation embeds the
selected rendered image; other operators show readable source/diff, diagrams, tables, documents or
measured results, with full evidence linked. A failed attempt keeps its real status and repair step.

## Develop

This repository is the package. `npm test` runs every validator, the operator self-tests, the script
specs and the docs check; `docs/` is the Nextra site and `sites/skills` the landing, neither ships in
the package.
