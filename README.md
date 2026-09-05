# @starci/skills

StarCi Skills is the `.claude` runtime of a repository: one entry (`SKILL.md`), operators with explicit boundaries,
example workflows, one closed routing map and one tool registry. An agent in Claude Code or
Codex reads `.claude/INDEX.md` through a one-paragraph bootstrap and follows its load order; the tree
does the rest. Documentation: <https://harness.starci.org/docs/>. Tiếng Việt: [README.vi.md](README.vi.md).

## Install

```bash
npx @starci/skills init
```

Run it at the root of the repository that will own the runtime. It copies the tree into `./.claude`,
writes `CLAUDE.md` (read by Claude Code) and `AGENTS.md` (read by Codex) when they do not exist, and
adds `.worktrees/sessions/` to `.gitignore`, where sessions live. Commit `.claude/` with the repository:
it is source, not a cache. Requires Node 20 or newer; the CLI has no dependencies. The same CLI runs
straight from a git tag when the registry has not yet listed a version:

```bash
npx --package=github:starci183/starci-skills#v1.1.0 starci-skills init
```

| Command | What it does |
| --- | --- |
| `npx @starci/skills init [--dir <repo>] [--force] [--no-bootstrap]` | Installs the tree and the bootstraps. Refuses a populated `.claude` it did not install unless `--force`, and even then replaces only the runtime paths. |
| `npx @starci/skills update [--dir <repo>] [--force]` | Brings an installed tree to this package's version. A file changed locally is kept and listed; `--force` takes the package version. Files outside the runtime paths are never touched. |
| `npx @starci/skills doctor [--dir <repo>] [--quick]` | Runs the tree's own validators on the installed copy (routing, alias, operators, workflows, defaults, templates, knowledge citations, the operator and helper self-tests and the script specs) and reports files changed since install. |
| `npx @starci/skills version` | Prints the package version. |

The runtime paths are `INDEX.md`, `INDEX.vi.md`, `SKILL.md`, `SKILL.vi.md`, `routing.json`, `alias/`,
`helpers/`, `knowledge/`, `operators/`, `readiness/`, `resources/`, `scripts/`, `templates/`, `workflows/`. The
manifest `.claude/.starci-skills.json` records the installed version and a hash per file; `update` and
`doctor` read it.

## Claude Code and Codex

Both runtimes are entered the same way. `CLAUDE.md` and `AGENTS.md` carry the same bootstrap: read
`.claude/INDEX.md` completely and follow its load order. The processor runs each operator on the profile
its `operator.json` binds (`resources/agents/profiles/openai.json` for Codex, `claude.json` for Claude
Code, paired in `resources/orchestrator.json`), and each operator may call only the tools its
`operator.json` declares from `resources/tools.json`. The English files are the runtime authority; the
`.vi.md` siblings are for people.

## Develop

This repository is the package. `npm test` runs every validator, the operator self-tests, the script
specs and the docs check; `docs/` is the Nextra site and `sites/skills` the landing, neither ships in
the package.
