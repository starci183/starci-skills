# Public Skills

The v7 public surface is exactly the twelve mission Skills declared in `catalog.json`. Global analysis
selects one outcome owner from metadata. That owner may issue typed peer `CALL`s and must consume the
matching `RETURN` and `RESUME` the recorded parent state; it does not restart global selection.

Every Skill owns one durable boundary, while several related verbs may be input intents. Thus
`starci-fe-process` handles create, audit, repair, redesign, debug, and reconcile instead of exposing a
Skill for every phase. Operators remain atomic and never call or branch.

Run:

```bash
node materialize.mjs
node validate-skills.mjs
```

The validator proves the exact catalog, v7 schemas and machines, local selection contracts, reachable
states, operator outcome routes, typed waits, executable resume targets, and fail-closed validators.

## Mission map

| Skill | Owned boundary |
| --- | --- |
| `starci-feature-deliver` | Cross-domain product outcome and joined proof |
| `starci-business-process` | Business authority |
| `starci-architecture-design` | Architecture decision and realization |
| `starci-backend-process` | Backend behavior and source proof |
| `starci-fe-process` | Frontend product surface and experience |
| `starci-quality-assure` | Measured quality and debt |
| `starci-uat-verify` | Frozen product UAT evidence |
| `starci-release-manage` | Release lifecycle |
| `starci-platform-operate` | Platform service boundary |
| `starci-workspace-manage` | Workspace routing and continuation |
| `starci-git-publish` | Exact Git publication |
| `starci-workflow-diagnose` | Read-only workflow diagnosis |

Retired v6 public Skills remain recoverable under `migration/v6/retired-skills/`; they are not part of
discovery or runtime routing.
