# Workspace configuration

## Source layout

```text
<Source>/
├── AGENTS.md
├── CLAUDE.md
├── .claude/
│   ├── common/
│   ├── fe/
│   └── be/
├── .workflows/
└── .workspace/
    └── <project>/<role>/
        └── config.json
```

`.claude` is shared, tracked trust. `.workspace` is machine-local routing and must be ignored by the
Source git repository.

## Start protocol

Interpret `start <project> <roles...>` literally. For example,
`start starci-academy fe be fe-legacy` loads:

```text
.workspace/starci-academy/fe/config.json
.workspace/starci-academy/be/config.json
.workspace/starci-academy/fe-legacy/config.json
```

Each requested file must exist. Do not infer a role from Source, a sibling checkout name, or an old
session. A missing route returns to the `starci-setup-workspace` capability.

## Role config contract

Every `.workspace/<project>/<role>/config.json` conforms to
[`workspace.schema.json`](workspace.schema.json) and contains:

| Field | Meaning |
|---|---|
| `project`, `role` | Stable lookup identity used by `start` |
| `source.*` | Source, Trust, Skills, Workflow root and workspace root for this machine |
| `repository.diskPath` | Real checkout directory that the agent reads and writes directly |
| `repository.gitRepository` | Required `origin` Git remote identifying the repository |
| `repository.gitRoot`, `branch`, `head` | Git checkout evidence refreshed by setup |
| `context.instructions` | Target instruction files to read first |
| `context.contract` | Primary domain contract path, especially for `fe` |
| `context.contractSource` | Explicit or discovered origin of the contract route |
| `context.grammar` | Explicit grammar id for this role, or `null`; never inferred from project/repository |
| `context.manifests` | Package/workspace manifests used to choose commands |

The agent opens `repository.diskPath` directly. `.workspace` stores configuration only: it never mirrors,
mounts, links or copies a target repository.

## Privacy and writes

Never commit `.workspace/`, copy its values into `.claude/`, or print credentials found in target
configuration. The role config may contain local paths and public git metadata only. Runtime secrets,
environment values and tokens are never workspace context.

Setup refreshes role configs only. It never clones, links, copies or edits a target repository.
