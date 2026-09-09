# StarCi

One complete delivery plan. Small, bounded workflows. Evidence before completion.

StarCi is a local skill runtime and CLI for AI-assisted project delivery: business requirements, architecture, interface design, backend/frontend implementation, review and UAT. It keeps the full outcome in view while each workflow performs only its approved segment.

**Release status:** `3.0.0-alpha.3`, prepared locally. The `starci` npm release is not published yet. Do not assume `npx starci` on the public registry installs this build. Node.js 20+ and npm are required; an agent with local file/shell access is needed to execute workflows. The CLI itself does not call an LLM or require an API key.

## Try the release archive now

Obtain the maintainer's verified `starci-3.0.0-alpha.3.tgz`. From the directory containing it:

```sh
npx --yes --package=./starci-3.0.0-alpha.3.tgz starci init --dir /absolute/path/to/host
npx --yes --package=./starci-3.0.0-alpha.3.tgz starci doctor --dir /absolute/path/to/host --quick
```

Use an empty test host first. Quote paths containing spaces. On Windows, use a path such as `D:/Projects/agent-host`. Initialization changes that host; inspect the archive and choose the target deliberately.

After this exact version is published, the equivalent registry command will be:

```sh
npx starci@3.0.0-alpha.3 init --dir /absolute/path/to/host
```

No global installation is required. See [installation](docs/installation.md) for update, doctor and project binding.

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

Normal plans use **manual** mode. The agent presents each workflow goal, executes within approval, shows actual output and verifies evidence before recording completion. A future planned workflow is not already approved. Explicit `flash` is for small reversible local fixes; `auto` is opt-in with separate risk and authority checks, never enabled by installation. No mode permits inventing approvals, silently changing business policy or granting itself publication authority.

## CLI

Once installed, invoke the pinned local runtime without fetching npm again:

```sh
node /absolute/path/to/host/.claude/bin/starci.mjs --help
node /absolute/path/to/host/.claude/bin/starci.mjs workflows
node /absolute/path/to/host/.claude/bin/starci.mjs workflow implement-frontend
node /absolute/path/to/host/.claude/bin/starci.mjs validate /absolute/path/to/backend/.starciwork
```

Public branding and command: **StarCi / `starci`**, not `work`. Internal `work/*` schema identifiers remain versioned wire contracts; changing a directory name does not change their meaning.

## Documentation

- [Install, update, bind and troubleshoot](docs/installation.md)
- [Architecture and delivery lifecycle](docs/architecture.md)
- [Directory rename and legacy compatibility](docs/migration.md)
- [CLI reference](docs/cli.md)
- [Skill design and compatibility](docs/skill-design.md)
- [Build, test, package and release](docs/releasing.md)

Agent instructions live in [SKILL.md](SKILL.md); humans do not need to preload the entire knowledge catalog. Runtime maintenance rules live in [UPDATE.json](UPDATE.json).

## Limits

StarCi verifies contract shape, bound inputs, evidence bytes and completion dependencies. It does not prove that an agent's written observation is truthful, replace human acceptance, provide a security sandbox, or ship your project's tools/accounts. Browser UAT needs an available browser tool and a runnable application. Deployment and real-data changes require their own authorization. Host bootstraps are local coding-agent integration, not a claim of compatibility with every chat UI or hosted skills API.

MIT. See [LICENSE](LICENSE).
