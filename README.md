# StarCi Skills 7.0

StarCi v7 turns one product mission into a composable execution graph. One public Skill owns the
outcome, calls peer Skills across durable boundaries, and resumes from typed `RETURN` receipts. Atomic
operators do exactly one job: `(context + input) -> typed output`.

## Public Skills

| Skill | Mission boundary |
| --- | --- |
| `starci-feature-deliver` | Coordinate a cross-domain product outcome to joined proof |
| `starci-business-process` | Model, challenge, publish, or reconcile business authority |
| `starci-architecture-design` | Discover, compare, challenge, and realize architecture |
| `starci-backend-process` | Design, implement, repair, and prove backend behavior |
| `starci-fe-process` | Create, audit, repair, redesign, debug, and reconcile frontend work |
| `starci-quality-assure` | Measure and close quality, rule, or declared-debt findings |
| `starci-uat-verify` | Freeze and independently prove Behavior, UX, and UI outcomes |
| `starci-release-manage` | Deploy, monitor, recover, or roll back a release |
| `starci-platform-operate` | Operate bounded platform services and routes |
| `starci-workspace-manage` | Initialize, verify, checkpoint, or hand off workspace state |
| `starci-git-publish` | Publish exact approved source heads to Git |
| `starci-workflow-diagnose` | Diagnose a workflow without mutation |

These are mission APIs, not a forced waterfall. For example, `starci-fe-process` may call
`starci-backend-process`, consume its typed result, resume the same frontend mission, call quality and
UAT proof, then return to a parent feature mission. It asks the user only when no valid next action
dominates; a necessary visual choice visibly renders three or four directions and recommends one.

## Runtime ownership

The host Source owns `.claude` and `.workspaces`. Project and role routes resolve through
`<Source>/.workspaces/`; routed repositories do not install a second runtime. Each verified project
backend owns one flat authority container:

```text
.worktrees/
  _templates/
  businesses/
  uat/<feature>/<flow>/{snapshot.json,result.json}
  sessions/<session-id>/{session.json,calls.ndjson,receipts/}
  debts/
```

There is no `.worktrees/<project>` layer, generated coding-context, or Qdrant index. Operators use
default repository/file search against the exact routed source and bind evidence to source heads.

## Debug trace

`.claude/config.yaml` is the only runtime config. The initial release enables `debug: true`, which
renders normalized Skill and operator calls, inputs, expected/actual outputs, transitions, resume
targets, evidence, and source heads. Debug changes visibility only; receipts remain typed when it is
off. Secrets and hidden reasoning are always redacted.

## Repository shape

```text
INDEX.md                       binding bootstrap and runtime law
analyze-input.md               global mission-owner selection
skills/catalog.json            public twelve-Skill catalog
skills/starci-*/               Skill contracts and state machines
operators/<domain>/<name>/     atomic contracts with two-color icon.svg assets
runtime/                       config, trace, receipt, and topology contracts
templates/                     business, UAT, session, and debt templates
knowledge/                     business, engineering, UX, UI, and Grammar authority
migration/v6/                  recoverable retired v6 assets
sites/skills/                  generated catalog/dashboard
```

## Install and validate

Node.js 20 or newer is required.

```bash
npm ci
npm run materialize
npm test
```

The release gate validates the exact 12-Skill catalog, 148 strict atomic operators, typed nested
`CALL -> RETURN -> RESUME`, selection behavior, flat worktree topology, UAT templates, direct-search
boundary, and the generated Skills site.

See [INDEX.md](INDEX.md) for binding runtime instructions and [CONTRIBUTING.md](CONTRIBUTING.md) for
change rules.

## License

MIT © 2026 StarCi. See [LICENSE](LICENSE).
