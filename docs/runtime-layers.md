# Runtime layers

The runtime's own source follows the same standard as product code. Each external system has one api home. Shared
libraries are pure. The domain layers call the api for side effects and the libraries for logic.

| Layer | Directory | Holds | May start a process |
|---|---|---|---|
| api | `scripts/api/<system>/` | One file per call to an external system, plus a shared `lib.mjs` for that system | Yes, but only its own system's programs |
| lib | `scripts/lib/` | Pure helpers and shared logic | No. It imports no `child_process` |
| domain | `scripts/kernel`, `scripts/supervisor`, `scripts/reconciler`, `scripts/work`, `scripts/checks` and the other script directories | Behaviour | Only `node` children of the runtime's own scripts. Every external tool goes through `scripts/api/` |

## Systems

| System | Home | Programs |
|---|---|---|
| orca | `scripts/api/orca/` | `orca` (calls.yaml verbs, plus the worktree lifecycle in `worktree-client.mjs`, `worktree-provision.mjs` and `worktree-remove.mjs`) |
| git | `scripts/api/git/` | `git`. `lib.mjs` holds `gitSpawn`, `runGit`, `gitOutput`, `gitResult` and `gitRunner`. The worktree calls are `worktree-list`, `worktree-add` (the only `git worktree add`) and `worktree-remove`. The other calls are `rev-parse`, `merge-base`, `branch-delete`, `branch-description`, `snapshot-commit` and `preserve-work` |
| npm | `scripts/api/npm/` | `npm`, `npx` (`pack-dry-run.mjs`) |
| sonar | `scripts/api/sonar/` | `sonar-scanner` (created when the first call moves there) |
| docker | `scripts/api/docker/` | `docker`, `docker-compose` (created when the first call moves there) |
| fs | `scripts/api/fs/` | The link-safe removal primitive `cmd /d /c rmdir <link>` (`rmdir-link.mjs`). `scripts/lib/safe-remove.mjs` is its one caller |
| process | `scripts/api/process/` | Host process calls: `process-list.mjs` (the process table), `kill-tree.mjs` (`taskkill /T /F`), `process-names.mjs`, `spawn-detached.mjs`, `run-shell.mjs` and `hide-child-windows.mjs` |
| sops | `scripts/api/sops/` | `sops` decryption (`decrypt.mjs`) |
| quota | `scripts/api/quota/` | Provider quota reads |

The worktree registry is `scripts/lib/worktree-registry.mjs`. It holds the rows, kinds, settings and the collect
judgement, and it runs no tool. The GC and counts over both homes are in `scripts/lib/worktrees.mjs`, which is also
the CLI: `node scripts/lib/worktrees.mjs gc|counts|resume`.

## `node` children

A `node` child (`process.execPath`) of the runtime's own scripts is the runtime itself, not an external system. A
domain layer may start one directly. `scripts/lib` may not, because it starts nothing: its detached children go
through `scripts/api/process/spawn-detached.mjs`.

## Enforcement

`scripts/checks/check-layers.mjs` runs in `npm run check`. It reads the rule set
`modules/kernel/runtime-layers.yaml`, which lists the scan roots, the systems with their homes and programs, and
the layers with what they forbid. It reads every source file with the TypeScript AST through
`scripts/lib/spawn-calls.mjs`, which `check-host-boundary.mjs` shares. It never greps text.

To find the program a spawn starts, the reader follows these routes:

- literals, consts, conditionals and `||`/`??`;
- `process.execPath`, which reads as `node`;
- the inner program of a shell (`cmd /c git ...`);
- a command string (`exec`, `shell: true`);
- namespace and destructured imports;
- injected spawn defaults (`run = spawnSync`);
- local runners whose callers in the same file name the program (`const run = (cmd, args) => spawnSync(cmd, args)`; `run('git', ...)`).

| Code | When |
|---|---|
| `RT_LAYER_EXTERNAL_SPAWN` | A system's program is started outside its home |
| `RT_LAYER_LIB_CHILD_PROCESS` | A `scripts/lib` module imports `child_process` |
| `RT_LAYER_SPAWN_UNRESOLVED` | Outside `scripts/api/`, a spawn starts a program the AST cannot name |
| `RT_LAYER_ALLOW_STALE` | An allowlist entry matches no finding |
| `RT_LAYER_RULES_INVALID` | The rule set or an allowlist entry is malformed. An invalid entry allows nothing |

Exceptions live in one reviewed file, `modules/kernel/runtime-layers.allow.yaml`. Each entry is
`{path, code, system?, lane, reason}`:

- `lane: LAYER-2` or `lane: LAYER-3` marks a temporary entry. The owning lane deletes it in the commit that moves the call.
- `lane: reviewed` marks a permanent exception: a runner of a command its input declares, such as a UAT step, an example assertion or the cloudflared tunnel.

The rule set is data, so it can later be expressed as hfs-style slots and rules without changing the check's logic.
