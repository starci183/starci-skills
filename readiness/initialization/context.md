# Initialization registry

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@initialization-identity` | `readiness/initialization/identity/context.md` | context | machine decrypt readiness |
| `@initialization-bootstrap` | `readiness/initialization/bootstrap/context.md` | context | agent entry routing |
| `@initialization-workspaces` | `readiness/initialization/workspaces/context.md` | context | Source language and read routes |
| `@initialization-worktrees` | `readiness/initialization/worktrees/context.md` | context | project write roots |

## Registry

Load `@initialization-identity`, `@initialization-bootstrap`, `@initialization-workspaces` and
`@initialization-worktrees` in that order.

Initialization is four bounded modules, resolved in this order:

1. [identity](identity/context.md) — prove this machine can decrypt the Source before any secret-backed setup;
2. [bootstrap](bootstrap/context.md) — route both agent runtimes into the trust tree;
3. [workspaces](workspaces/context.md) — record the shared language and every declared read route;
4. [worktrees](worktrees/context.md) — install the durable and disposable write roots.

Each module owns one verdict and one write surface, expressed as evidence, action, and proof. A direct
init request authorises its bounded local action. Ask only when completing it requires an external or
destructive boundary that the request did not already grant. Identity is first because a Source with
ciphertext and the wrong identity cannot safely mint, rotate, publish or expose credentials later.
