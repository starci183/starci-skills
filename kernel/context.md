# StarCi kernel router

## LOADS

None.

## Record

The kernel resolves the facts every workflow needs before it may select a standard or mutate source.
It owns routing, approval identity and evidence shape; it owns no frontend, backend or operational law.

## Routes

| Need | Runtime target |
|---|---|
| Source-wide language and verified project/role checkout | `contexts/workspaces/context.md` |
| Durable decision state or rebuildable progress | `contexts/worktrees/context.md` |
| Approval boundary, process state and user-facing reporting | `skills/skill-shape/context.md` |
| Artifact validation and canonical hashes | `scripts/validate-artifact.mjs` |

## Rules

1. Resolve the workspace route before selecting a role standard.
2. Resolve the write destination before creating state.
3. Approval binds an exact revision and path boundary; it never expands by implication.
4. Runtime state never lives under `.claude`.
5. A missing kernel fact stops the workflow before target-source reads.

## Output

```text
source: <Source root>
project: <declared project>
roles: <verified roles>
revision: <verified head>
writeBoundary: <exact paths or none>
approval: <not required | required | approved identity>
```
