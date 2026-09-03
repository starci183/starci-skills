# Evidence — a restart served a stale build cache across an install, 2026-09-03

The operator rule is product-agnostic, so the concrete occurrences behind the build-cache rule of
`platform.operate` (the "A restart is not a rebuild" paragraph, the `cache` record on the server in
`templates/kinds/delta.schema.json`, and the manifest digest in `scripts/serve-runtime.mjs`) live
here. Both occurrences were observed on one shared uat runtime in one day, by different sessions.

## What happened

The runtime was a Next.js application served from its uat integration worktree on the fixed
projected port, through `serve`/`restart`. Two sessions merged into the integration branch and had
the server restarted on the new head. Between the previously served head and the new one the lockfile
had moved: `@starci/grammar` went from `0.4.7` to `0.4.8` and `node_modules` held `0.4.8` after the
install. The framework's dev build cache (`apps/app/.next/dev`) predated that install, and a restart
alone did not rebuild the chunk it had compiled against `0.4.7`.

| # | What was observed | What it cost |
| --- | --- | --- |
| 1 | The served stylesheet was the one compiled from `@starci/grammar 0.4.7` while `node_modules` held `0.4.8`; the audit measured a token rule the published Grammar no longer had | Two audits scored the old rule and their verdicts were wrong for the head they named |
| 2 | A build on the same worktree failed with an "export * in a client boundary" error that the source at that head did not contain; only the stale cache explained it | One session lost a round to a failure that was not in its diff |

## What was true at the time

- `scripts/serve-runtime.mjs` recorded pid, port, worktree, command and time, but neither the head
  nor any digest of the manifests, so nothing could tell a restart across an install from a restart
  on the same install.
- The ladder's `reset` rung already said "clears the framework's build cache", but it was asked for
  by name only; `serve` and `restart` said nothing about the cache, and no evidence row said whether
  it had been cleared. This is question 1 of `UPDATE.md`: the concept existed and nothing enforced
  it on the rungs that actually run after an install.

## What changed

- The helper digests the manifests the route declares plus the lockfiles beside them, keeps the
  previous record when a pid file is cleared, and clears the conventional build directories when the
  digest differs, when no previous record is known, or when `--clean` asks. The decision is written
  into the server record.
- The delta's server object requires `cache` (`cleared`, `reason`, `directories`, `previousHead`), and
  the operator validator refuses a kept cache over an unknown previous head, a `reset` that kept the
  cache, a cleared flag that disagrees with its reason, and a decision made against a head other than
  the one the entry recorded.

## Same day, same script: a stop that left the listener behind

`--stop <pidfile>` killed the recorded pid, which was the launcher wrapper of the dev server, while
the process actually listening on the fixed port was its child (observed as pid 52564). The port
stayed held, the next start refused with the fixed-port conflict, and the listener had to be found by
port and its tree killed by hand. One occurrence, recorded here because the fix rides the same change:
`stop` now stops the recorded pid's whole process tree, proves by connecting that the port is free
before clearing the pid file, refuses to clear it while something answers (naming the listener pid
read from the socket table), and the record carries `listenerPid` beside the wrapper pid when the two
differ.
