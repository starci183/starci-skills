# runtime.serve

Climbs one requested rung of the runtime ladder for one bound product route: `stack-up`, `locate`, `start-role`, `serve`, `restart`, `reset` or `stop`. It preserves one fixed port, one integration branch and one detached server per route, ordered by a declared lease.

Inventory precedes every effect. A foreign port holder is a coordination finding, never permission to reclaim it. `serve` merges the session commit without rebase or force, resolves only owned rule-covered hunks, gates the merged head and attests that the served head contains the requested commit. Already-converged state uses paired read-only proof with zero mutations. Uncertain completion returns to fresh entry, process, port and head observation before any retry.

A done response includes `platform-operation-receipt`, `runtime-delta` and `runtime-checks`. The two-round feedback loop cannot authorize duplicate restart, reset, merge or stop effects.

Tests use synthetic local records only. They start no server, container or process and perform no Git mutation. Run `python .claude/operators/runtime.serve/tests/run.py`.
