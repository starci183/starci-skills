# probe-REPORT — op `ex-test.probe`

- **op id:** `ex-test.probe`
- **lease:** `probe-20260920T064534Z`
- **model:** `qwen-agent`
- **reported:** 2026-09-20T06:50Z
- **commit policy:** `no-commit` (honoured — nothing staged or committed)

## verdict

**pass**

## evidence

| path | what it proves |
| --- | --- |
| `ex-testing/probe/probe-20260920T064534Z.txt` | The declared artifact. 130 bytes, `sha256:145de0f9ebb0917d8382ab80a0249976614f601efc20726cfa87b9476b0d0207`, mtime `2026-09-20T06:49:05Z` (this run, not a reused file). Contents: UTC timestamp `2026-09-20T06:48:57Z`, the literal `probe-ok`, one sentence naming `ex-test.probe`. |
| `ex-testing/lint/probe-REPORT.md` | This report. |
| `ex-testing/lint/done/probe.done` | 0-byte done marker, written only because the verdict is pass. |

## checks executed

**proof `artifact-exists`** — "The artifact file exists, contains 'probe-ok' and this op id."

Command (run from repo root `.claude`):

```
node -e 'const fs=require("fs"),c=require("crypto");const p="ex-testing/probe/probe-20260920T064534Z.txt";
const b=fs.readFileSync(p,"utf8");const checks=[["artifact exists + non-empty",b.length>0],
["contains probe-ok",b.includes("probe-ok")],["contains op id ex-test.probe",b.includes("ex-test.probe")],
["contains UTC timestamp",/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/m.test(b)]];
let ok=true;for(const[n,v]of checks){console.log((v?"PASS":"FAIL")+"  "+n);if(!v)ok=false;}
process.exit(ok?0:1);'
```

Exit code: **0** (raw, not wrapper-coerced). Observed output:

```
PASS  artifact exists + non-empty
PASS  contains probe-ok
PASS  contains op id ex-test.probe
PASS  contains UTC timestamp
```

**scope check** — `git status --porcelain ex-testing/ modules/`: the only new path attributable to this op is
`ex-testing/probe/` (one file). Pre-existing dirt (`ex-testing/lint/.watchdog-*`, `FLEET-STATUS.md`,
`watchdog.log`, `modules/ops/registry.yaml`, other lanes' `c*-REPORT.md`) was present at conversation start
and was not touched. `ex-testing/lint/probe-REPORT.md` and `ex-testing/lint/done/probe.done` were confirmed
absent before writing, so nothing was overwritten.

**Self-check over the three writes** (run after the marker was written, exit **0**):

```
PASS  artifact bytes match report
PASS  artifact has probe-ok + op id + UTC ts
PASS  report exists non-empty
PASS  report declares verdict pass
PASS  marker exists
PASS  marker is 0 bytes
```

No file was created or modified outside the three declared writes. Creating the empty directories
`ex-testing/probe/` and `ex-testing/lint/done/` was a prerequisite of the declared writes
(`ex-testing/probe/` did not exist); no scratch or redirect files were written anywhere, so exit codes
are recorded in this report rather than in side files.

### Correction disclosed

The first run of the self-check above exited **nonzero** on one assertion:
`/^verdict\s*\n\s*\*\*pass\*\*/m`. That was a bug in the *check*, not in the work — the pattern anchors on
`^verdict`, which cannot match a line that actually begins with the Markdown heading `## verdict`. The
report bytes were correct throughout (`## verdict\n\n**pass**`, verified by dumping the region). The
assertion was repaired to `/^## verdict$/m && /^\*\*pass\*\*$/m` and re-run; the six PASS lines quoted are
from that re-run, and the artifact digest was unchanged between both runs, so nothing under test moved.
Recorded here rather than quietly re-run because the op's business question is whether it settled honestly.

## suspicion

`writes.artifact.path` is templated as `ex-testing/probe/<run-id>.txt`, but `<run-id>` is bound to nothing
this op can see: the brief declares its own text as the whole context (`reads: [contract]`, "No other reads
are needed"), and neither the brief nor the dispatch packet supplies a run id. I derived
`probe-20260920T064534Z` from the lease token, which is the only stable identity in the packet.

This did not gate the verdict — the `artifact-exists` proof constrains only the file's *content*, and the
consumer (`ex-testing/briefs/kernel/KERNEL-TEST.md`) likewise checks bytes, not the filename. But an
improvised name is not reproducible across agents: if the kernel ever needs to resolve artifact → dispatch,
the naming rule belongs in the brief (e.g. `path: ex-testing/probe/<lease-token>.txt`) rather than in each
agent's judgement. Routing to the op-spec owner; I did not edit the brief, as it is outside this op's
write-ceiling.

## blockers

None. `WRITE_FAILED` did not trigger — the artifact path was writable on the first attempt.
