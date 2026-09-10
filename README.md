# StarCi

**One complete delivery plan. Small, bounded workflows. Evidence before completion.**

StarCi is a local skill runtime and CLI for AI-assisted project delivery: business requirements, architecture, interface design, backend/frontend implementation, review and UAT. It keeps the full outcome in view while each workflow performs only its approved segment.

Turn a feature request into a traceable route from business decisions to architecture, implementation and verified user flows—without treating a short coding session as a finished product.

StarCi provides:

- **A complete Plan:** the requested outcome, dependencies, coverage, checkpoints and completion criteria stay together, even when execution spans many sessions.
- **Bounded workflows:** each segment has a concrete goal, permitted changes, expected output and verification criteria.
- **Persistent project knowledge:** requirements, specifications and evidence live beside the backend source and are shared with the frontend.
- **Evidence-backed status:** missing artifacts, changed inputs and unmet dependencies prevent stale work from being reported as done.
- **One local runtime:** host `AGENTS.md` and `CLAUDE.md` point agents to the same `SKILL.md`, workflow contracts and knowledge library.

StarCi is not a hosted agent service or an autonomous project runner. Your coding agent executes the work; the CLI supplies installation, inspection and validation. It does not call an LLM or need its own API key.

**Status:** `3.0.0-alpha.3` · **Requirements:** Node.js 20+, npm, and a coding agent with local file/shell access. This repository does not yet provide a verified public npm release of this build. Use the source or a reviewed archive below; do not assume unpinned `npx starci` installs this project.

[Quick start](#quick-start) · [First project](#first-project) · [Execution modes](#execution-modes) · [CLI](#cli) · [Documentation](#documentation)

## Quick start

### Install from this repository

Clone the repository into a tooling directory, separate from the host you want to initialize:

```sh
git clone https://github.com/starci183/starci-skills.git
cd starci-skills
npm ci
npm run build
node bin/starci.mjs init --dir /absolute/path/to/agent-host
node bin/starci.mjs doctor --dir /absolute/path/to/agent-host --quick
```

Replace `/absolute/path/to/agent-host` with your host directory. On Windows, for example:

```powershell
node bin/starci.mjs init --dir "D:/Projects/agent-host"
node bin/starci.mjs doctor --dir "D:/Projects/agent-host" --quick
```

Start with an empty test host. The installer writes **source** into `.claude`, builds and verifies local `.dist`, then records the install manifest only after that check succeeds. It adds managed bootstrap sections to `AGENTS.md` and `CLAUDE.md`, preserves custom instructions and refuses conflicting bootstrap protocols. It does **not** install global skills, create your business requirements or change frontend source. See [runtime distribution](docs/runtime-distribution.md).

### Install an archive with npx

If you have a reviewed `starci-3.0.0-alpha.3.tgz`, run from the directory containing it:

```sh
npx --yes --package=./starci-3.0.0-alpha.3.tgz starci init --dir /absolute/path/to/host
npx --yes --package=./starci-3.0.0-alpha.3.tgz starci doctor --dir /absolute/path/to/host --quick
```

No global installation is required. `npx` executes package code: inspect the archive and choose the target deliberately. Maintainers can create an archive with `npm pack`; see [release verification](docs/releasing.md).

After this exact version is published, the equivalent registry command will be:

```sh
npx starci@3.0.0-alpha.3 init --dir /absolute/path/to/host
```

That registry command is a future release instruction, **not the current quick start**. See [installation](docs/installation.md) for update, doctor and project binding.

## One host, multiple sources

```text
host/
├── AGENTS.md               Codex bootstrap
├── CLAUDE.md               Claude Code bootstrap
├── .claude/                one shared StarCi runtime
└── .workspaces/            project → source bindings

project-backend/
├── .starciwork/            shared BE + FE requirements, specifications, evidence
│   └── _local/             excluded Plan/run/approval state, drafts and staging
│       └── plans/          one four-file bundle per full Plan
└── ...                     backend source

project-frontend/
└── ...                     frontend source only
```

The host may also be a backend when explicitly bound as one. Neither entering the frontend nor starting a frontend task creates another workspace. `.starciwork/_local` is local execution state, **not disposable while a plan is unfinished**. It is excluded from canonical Work hashes and validation, not a source of accepted evidence. The separate `.starcitemp` directory is retired; new creation there is rejected. Existing old storage needs coordinated [migration](docs/migration.md), never an installer cleanup or an approval rewrite.

## First project

Install at the host, then open your coding agent there and ask:

> Read `.claude/SKILL.md`. Bind project `demo` to the backend and frontend paths I provide. Plan the complete delivery of this feature, including business, architecture, BE, FE and UAT coverage. Show the first workflow goal and wait for my approval.

Supply actual repository paths/remotes and the desired product outcome. Binding and initialization are separate: `starci init` installs the runtime, not your business specification. [Installation](docs/installation.md#bind-a-project) includes a concrete binding shape.

For example, give the agent a product outcome and an explicit boundary:

> Plan a customer-support module that answers from approved knowledge and routes unresolved questions to a human. Include business, architecture, backend, frontend and UAT in one delivery Plan. For now, execute only Business and Architecture after I approve their goals. Do not implement or deploy anything yet.

The expected output is a full delivery Plan, followed by short workflow-sized goals—not a business-only Plan that forgets implementation. Unresolved later choices stay attached to the affected future workflow. The agent should not invent requirements just because source code is missing.

## How delivery works

```text
Complete Plan: outcome + scope + dependencies + coverage + terminal criteria
  └─ Bounded workflow: goal → authorization → execution → evidence → acceptance
       └─ Next eligible workflow in the same Plan
```

A typical new feature covers business → architecture → backend → frontend, with design and browser UAT included in the frontend workflow. An existing feature can reuse valid outputs; a design-only request does not authorize implementation. Publication and deployment require separate authority.

| Stage | What it establishes |
| --- | --- |
| Business | Readable overview plus nested SRS: actors, rules, FR/NFR, detailed happy/alternative/exception flows and acceptance. |
| Architecture | Source-independent SDS derived from accepted SRS: responsibilities, connection/data contracts and context-driven design/risk decisions; named patterns are optional. |
| Backend | Approved code changes with unit, backend E2E and API evidence before frontend handoff. |
| Frontend | Bound design creation/reuse, implementation and browser UAT; not just a screenshot or a build. |
| Review / standalone UAT | Explicit verification scope and actual results; unit tests are not browser UAT. |
| Publish / deploy | Separately authorized delivery effects, not an automatic consequence of finishing code. |

Finishing one workflow does not finish the Plan. Passing metadata validation does not prove the product works. A `done` claim must have current evidence for its selected scope, and downstream status can become stale when upstream inputs change.

See [Business overview and nested SRS](docs/business-srs.md) for the split functional, non-functional, business-rule, policy-decision, data and customer-journey section contracts. See [Architecture SDS](docs/architecture-sds.md) for the sectioned target code map. Legacy and pre-upstream compatibility specifications remain readable; new authoring uses `specifications/srs-sections.json` and `specifications/sds-map.json`, and migration requires current review.

`examples/command-receipt-srs-sds/` is retained only as a regression fixture for the pre-upstream `starci/srs@3` and `starci/sds@4` compatibility readers. Do not copy it as the current authoring template.

See [Expandable Work tree](docs/work-tree.md) for recursive Business, Architecture,
UI, BE/FE and UAT scopes, collocated images/videos, `interface.draw` ownership and
editing completed work. Screens and assets are not limited to a fixed template.

Read the [complete knowledge-document update example](docs/examples/knowledge-update-delivery.md)
for one feature across SRS, SDS, UI, backend including real backend E2E,
frontend and browser UAT. It explicitly separates planned checks from actual
results; it is not an accepted product change or a passing test report.

## Execution modes

| Mode | Use it for | Boundary |
| --- | --- | --- |
| `manual` (default) | Step-by-step work with user checkpoints. | Present the workflow goal before effects and actual results before acceptance. Planning alone does not authorize future work. |
| `auto` (explicit opt-in) | An approved sequence of eligible workflows in the full Plan. | Requires a scoped delegation, time budget and risk assessment. Stops for missing authority, unresolved choices, failed evidence or budget expiry. |
| Single workflow | Clear bounded UI, backend or other work fitting one workflow. | Goal brief and detailed goal, scope approval, implementation and verification; no Plan wrapper. |
| Small-change direct route (`flash` keyword optional) | A small, clear, cohesive, reversible and low-risk local fix. | Execute and run focused checks without Plan/workflow ceremony. Higher impact selects a bounded workflow, or a Plan when scope is large, unclear or spans workflows. |

Auto identifies the initial ASAP chain and later checkpoint. It is not limited to two workflows, does not turn a waiting stage into completion and does not create a background scheduler. No mode permits inventing approvals, silently changing business policy or granting itself publication authority.

User-facing language and execution preferences live in the installed `.claude/config.json`; defaults are Vietnamese (`vi`), inherited model and `medium` effort. Persisted Work and runtime contracts are English. Installation does not change the current agent's model or enable auto.

## CLI

Once installed, invoke the pinned local runtime without fetching npm again:

```sh
node /absolute/path/to/host/.claude/bin/starci.mjs --help
node /absolute/path/to/host/.claude/bin/starci.mjs workflows
node /absolute/path/to/host/.claude/bin/starci.mjs workflow implement-frontend
node /absolute/path/to/host/.claude/bin/starci.mjs storage /absolute/path/to/backend
node /absolute/path/to/host/.claude/bin/starci.mjs validate /absolute/path/to/backend/.starciwork
node /absolute/path/to/host/.claude/bin/starci.mjs tree /absolute/path/to/backend/.starciwork
```

Public branding and command: **StarCi / `starci`**, not `work`. Internal `work/*` schema identifiers remain versioned wire contracts; changing a directory name does not change their meaning.

`init --dir <host>` installs StarCi. `workspace init <root> --id <id>` initializes project metadata. Workflow inspection commands do not execute a Plan. See the [CLI reference](docs/cli.md) for the distinction and all commands.

## Updating and migrating

Use `starci update --dir <host>` from a reviewed build, then run `doctor`. Update rebuilds and verifies `.dist` before recording the new version; a failed build does not claim success. Do not use `--force` as a routine update strategy: review local changes and back up first. A runtime update does not migrate product data. Interrupted install recovery is in [runtime distribution](docs/runtime-distribution.md).

For older projects, `.work` becomes `.starciwork`, and `.starci` or `.starcitemp` state belongs inside `.starciwork/_local`. Stop concurrent writers, back up, preserve receipt bytes, migrate bindings and validate before resuming. Renaming a directory does not transfer an old approval to a new absolute path. Follow the [migration guide](docs/migration.md); do not delete unfinished plans as temporary junk.

## Troubleshooting

| Problem | Next step |
| --- | --- |
| The agent does not find StarCi from a frontend task | Supply the absolute host, `.claude/SKILL.md` path and selected project binding. A sibling host is not a parent directory. |
| An old instruction requests `.claude/INDEX.md` | Read the current bootstrap and run `node .claude/scripts/check-entry.mjs /absolute/host`. Do not recreate the retired file. |
| Storage reports `migration-required` or `conflict` | Inspect existing trees and coordinate migration; do not create an empty replacement workspace. |
| Validation rejects a specification or completion | Fix the named metadata/evidence defect. Do not loosen the schema or edit sealed proof just to get a pass. |
| A task pauses in auto | Check scope, authorization, dependencies, evidence and remaining time; auto does not override those gates. |

## Documentation

- [Install, update, bind and troubleshoot](docs/installation.md)
- [Source-built `.dist` install and recovery](docs/runtime-distribution.md)
- [Architecture and delivery lifecycle](docs/architecture.md)
- [Directory rename and legacy compatibility](docs/migration.md)
- [CLI reference](docs/cli.md)
- [Skill design and compatibility](docs/skill-design.md)
- [Author knowledge YAML](docs/knowledge-yaml.md)
- [Build, test, package and release](docs/releasing.md)

Agent instructions live in [SKILL.md](SKILL.md); humans do not need to preload the entire knowledge catalog. Runtime maintenance rules live in [UPDATE.json](UPDATE.json). [README.json](README.json) is a machine-readable summary, not the user guide.

## Knowledge sources versus `.dist`

Development references under `knowledge/` are authored primarily as YAML (`schema: starci/knowledge-source@1` and example manifests). Multi-file TypeScript examples live beside their `index.yaml`. The compiler writes agent-facing JSON under `.dist/knowledge/`, mapping `index.yaml` → `INDEX.json` and keeping stable public names such as `knowledge/coding-reference.json` for operator references and `SKILL.md`.

Declarative sources use YAML; duplicate JSON/YAML authority is rejected. Only explicitly allowlisted, format-required JSON remains. Do not hand-edit `.dist`. Packages exclude `.dist`; install/update and `node scripts/ensure-build.mjs` build it. Runtime CLI, contracts, knowledge and supporting documentation resolve from `.dist`. See [knowledge YAML authoring](docs/knowledge-yaml.md) and [runtime distribution](docs/runtime-distribution.md).

Browser workflows require a working browser runner, not bundled browser binaries. Follow [browser setup](docs/browser-testing.md). Business/Architecture and backend-only workflows do not require a browser installation.

## Contributing

Read [UPDATE.json](UPDATE.json) before changing runtime contracts. Update each contract and its consumers together, preserve unrelated edits and add regression tests for both valid behavior and rejected unsafe cases.

```sh
npm ci
node scripts/compile-knowledge.mjs
npm run build
npm test
node scripts/compile-knowledge.mjs --check
npm run build:check
node scripts/ensure-build.mjs
```

For documentation sites, install their build dependencies and follow [the release guide](docs/releasing.md). Verify the packaged runtime in an isolated host before distribution. Generated `.dist` files should come from the build, not manual edits. Never include project records, local configuration, credentials, `worktrees/` or site caches in a package, and never `git add -f` `.dist`.

## Limits

StarCi verifies contract shape, bound inputs, evidence bytes and completion dependencies. It does not prove that an agent's written observation is truthful, replace human acceptance, provide a security sandbox, or ship your project's tools/accounts. Browser UAT needs an available browser tool and a runnable application. Deployment and real-data changes require their own authorization. Host bootstraps are local coding-agent integration, not a claim of compatibility with every chat UI or hosted skills API.

## License

MIT. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).
