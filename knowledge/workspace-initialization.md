# Workspace initialization

| Field | Value |
| --- | --- |
| Knowledge ID | `workspace.initialization` |
| Operators | `identity-verify, bootstrap-verify, declarations-compile, routes-hydrate, worktree-verify` |
| Search tags | `initialization, identity, bootstrap, workspace declaration, route hydration, worktree` |
| Dependencies | `workspace.routing` |

## Record

Initialization proves machine decrypt identity, minimal agent bootstrap, portable workspace declarations, generated local routes, and durable worktree ownership as separate concerns. Portable declarations contain no machine paths, observed heads, or secrets; hydration produces rebuildable local state. Worktrees prove lock, branch, Git ownership, clean boundary, and allowed role before consumers write.

Multi-device reconstruction binds the exact `workspace-multidevice-commit-boundary-v1` policy. Git carries bootstrap files, portable project-role declarations, ciphertext and value-free topology. Each trusted device supplies the same master identity out of band and regenerates hydrated routes, worktree containers, clean references, decrypted twins, private gitmounts, default search, Caddy, PIDs and receipts locally. `workspace-portable.mjs bootstrap --apply` clones absent declared sibling checkouts at their exact origin and branch before hydrating routes; it never replaces an existing path. A Source may pass a Source-relative decrypted token through `--credential-file`; the helper converts it to a process-only Git header and never persists its value or an authenticated URL. `npm run sync` applies the same boundary to private gitmounts. A worktree may commit approved changes only through its own Git checkout; its parent Source never tracks the `.worktrees/` or `.gitmounts/` container.
