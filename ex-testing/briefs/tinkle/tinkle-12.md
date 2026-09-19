# tinkle-12 — scripts/route/dispatch-op.mjs — real orca spawn

Read `tinkle/_common.md`. The kernel driver spawns one shell agent per op through orca terminals. You build the packet builder + spawn call.

## Mission
`scripts/route/dispatch-op.mjs`:

```
node dispatch-op.mjs --op backend.implement --records fr.a,br.b --model qwen-agent --dry-run
node dispatch-op.mjs --op X --lease <token> --spawn        # actually creates orca terminal
```

## Build
- Packet assembly per `modules/kernel/dispatch.yaml` contract (READ IT — tinkle-9 writes it; if not landed yet, code against the brief spec in ex-testing/briefs/tinkle/tinkle-9.md and note the assumption): op id → modules/ops/ops/<id>.yaml brief path, records list, owned_paths resolved via example-ownership.mjs helpers, constraints {model, budget, lease}
- --dry-run: print the full packet + the orca command it WOULD run (`orca terminal create --worktree ... --command devin` + send text)
- --spawn: actually call `orca terminal create/send` via child_process, capture handle, print it
- Prompt text the shell agent receives: compact — op id, brief path, records, owned_paths, verdict contract path (modules/kernel/verdict-contract.yaml), "return verdict+evidence, cite suspicion"

## Verify
--dry-run for 3 ops showing complete packets. One real --spawn only if an idle test op exists — otherwise document the spawn command path in report. Report `tinkle-12-REPORT.md`. Marker `done/tinkle-12.done`.

## Boundaries
Write ONLY scripts/route/dispatch-op.mjs + report + marker. READ-ONLY modules/, .dist/.
