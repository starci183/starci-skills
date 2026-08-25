# Workspace initialization

| Field | Value |
| --- | --- |
| Knowledge ID | `workspace.initialization` |
| Operators | `identity-verify, bootstrap-verify, declarations-compile, routes-hydrate, worktree-verify` |
| Search tags | `initialization, identity, bootstrap, workspace declaration, route hydration, worktree` |
| Dependencies | `workspace.routing` |

## Record

Initialization proves machine decrypt identity, minimal agent bootstrap, portable workspace declarations, generated local routes, and durable worktree ownership as separate concerns. Portable declarations contain no machine paths, observed heads, or secrets; hydration produces rebuildable local state. Worktrees prove lock, branch, Git ownership, clean boundary, and allowed role before consumers write.

Multi-device reconstruction binds the exact `workspace-multidevice-commit-boundary-v1` policy. Git carries bootstrap files, portable project-role declarations, ciphertext and value-free topology. Each trusted device supplies the same master identity out of band and regenerates hydrated routes, worktree containers, clean references, decrypted twins, private gitmounts, Qdrant, Caddy, PIDs and receipts locally. `npm run sync` resolves a gitmount credential only from the declared encrypted runtime file and passes it to Git process-locally; it never writes the token to a remote URL or Git config. A worktree may commit approved changes only through its own Git checkout; its parent Source never tracks the `.worktrees/` or `.gitmounts/` container.
