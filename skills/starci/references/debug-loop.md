# Debug loop

Debugging a workflow is a recurring loop of the chat that started it. It is not an Orca seat, a background agent, a
subagent or a runtime process: the chat session runs the loop on its own model, and no StarCi process schedules anything.
Set it up yourself right after `starci workflow start` reports a Kernel, or whenever the owner asks to debug or watch a
workflow. Set up one loop per chat; if the chat already runs one, keep it.

When a Supervisor, Kernel, Op or Critic does wrong, it is wrong. Do not explain it away and do not patch the symptom:
fix `.claude` at once so the role cannot do it again.

The loop audits whether each role did its job (`modules/kernel/roles.yaml`: Op, Critic, Kernel, Supervisor and the runtime
floor under them). It is scaffolding for a limited stabilisation period: once the `endCondition` of the debug role holds, the
loop is not set up any more, and the digest prints the current standing against each of its criteria.

The test for every role: when it met something it could not finish, did it report up through its own channel, with a cause
and evidence, inside its bound? Yes is a correct error: the system worked as designed, nothing is flagged for that role, and
the verdict is now about how the next role handles the report. No is a departure by that role: silent, late, misclassified
or mishandled. A stuck thing belongs to the lowest role that failed the test.

A departure is a finding with exactly four parts: the role, the duty of its contract block it broke (`does`, `cleanup`,
`never`, `reportsUpWhen` or a bound), the evidence (a ledger row, an event, a terminal read or a commit), and the remedy. No
cause is recorded as "busy", "under load", "the spec was outdated" or "that is its authority"; a cause is a fact that points
at what to change. The remedy is always a change in the runtime tree that makes the role unable to repeat it (its contract
block or generated prompt, a rule of the hold policy, a gate or guard refusal, or a runtime fix, each with a spec); unblocking
the running system by hand keeps work moving, is recorded apart, and is never the remedy. The finding stays `open` in the
edge-case registry until the change is on the host. An agent report that excuses a failure ("flake", "spec assumption") is a
finding too, resolved to a cause.

Interval: `debugLoop.interval` of the owner's `config.yaml` (`<n>s`, `<n>m` or `<n>h`); an absent key means the shipped
default in `config.example.yaml` (10 minutes). Never write the config to choose it.

The loop prompt is this one fixed sentence:

```text
Run `starci debug digest`, get every departure it lists fixed at the role that owns it as `references/debug-loop.md` says, report in the owner's language only what was fixed and what truly needs the owner, and end this loop when the digest shows no running workflow or the stable criteria hold.
```

## Claude Code

```text
/loop <interval> Run `starci debug digest`, get every departure it lists fixed at the role that owns it as `references/debug-loop.md` says, report in the owner's language only what was fixed and what truly needs the owner, and end this loop when the digest shows no running workflow or the stable criteria hold.
```

`<interval>` is the config value, for example `10m`. Claude Code's `/loop` takes a leading interval and a prompt.

## Codex

The owner's decision names the form `/loop every <N> minutes "<prompt>"`. That syntax is unverified: the Codex CLI
installed here (0.160.0) carries no `/loop` slash command and its feature list has none, and public notes for 0.145 say the
same. Act in this order:

1. If the running Codex accepts `/loop`, use `/loop every <N> minutes "<the fixed sentence>"`, `<N>` the interval in minutes.
2. Otherwise, in the Codex app create a thread automation (heartbeat) on this thread with the fixed sentence and the
   configured interval.
3. Otherwise say that this Codex has no loop, and run `starci debug digest` yourself when the owner asks.

State which of the three you used. Do not claim a loop exists until the host confirmed it.

## Rules

- `starci debug digest` itself only reads. Acting on what it shows is the tick's work, in the same turn.
- The digest judges each job against the hold policy table and each seat against its role contract block, and names for every
  departure which role failed which duty, with evidence. The first departure is the problem line.
- A departure is fixed where it belongs, so that the role or the runtime floor does it by itself next time:
  - a stuck or failed job, a hold past its bound, a gate nobody answered: the hold policy names the handler of the step.
    Relay the policy step through a runtime channel (`starci supervisor tell` for the Supervisor, or a durable ruling to the
    Kernel through the Supervisor's `starci supervisor notify`) and check on the next tick that it was taken. Never type into
    a seat's terminal, and never speak to an Op or a Critic.
  - a leftover (a reservation, lease, worktree record, terminal or queue item nothing stands behind): the leftover is
    evidence that its owner failed its cleanup duty (the Kernel inside a workflow, the Supervisor for the machine, the
    runtime's collectors). Trigger the existing collector to unblock (`starci machine worktrees gc`,
    `starci supervisor gc --apply`, `starci reconciler up --services`), then get the owner to do it itself next time. A
    leftover no collector takes is a runtime defect.
  - a runtime defect (the runtime did the wrong thing, or nothing cleans a leftover): the Supervisor and the runtime's
    detectors record it (`starci supervisor actions record --item runtime-defect:<cause>`, one item per cause); Debug owns
    that queue, fixes each defect in `.claude` with a spec on a fix lane it opens, and verifies the fix is on the running
    host. The Supervisor changes no runtime code.
  - a seat that is down or drifted: `starci workflow start` or `starci supervisor start` from an Orca terminal;
    `starci reconciler restart` for an engine on an old revision.
- Every edge case met is an entry of the edge-case registry (`modules/reconciler/edge-cases.yaml`), added in the same change
  that resolves it, with the rule that now handles it and the spec that reproduces it. A `covered` entry names both.
- Never edit a store, a ledger or a product repository by hand, never resolve a gate as someone else, never enter a
  credential. What only the owner can do (a login, a product decision, a publication) is the one thing reported as open,
  once, with the exact action.
- Report what was fixed and what is in progress, short. Do not ask the owner whether to fix something the rules above already
  assign.
- Show the first lines as they are: a controllers alarm is the first line of the digest.

## The role contract

<!-- roles:begin debug -->
**Debug** (modules/kernel/roles.yaml#debug): The owner's eyes: a loop of the owner's chat for a limited stabilisation period, not part of steady-state operation.
- Does:
  - Audits whether each of the four roles above and the runtime floor did its job, each tick, through the digest: per op its attempt, report, evidence and hold; per Critic that it ran, on another provider, saw only the product, and had its verdict used; per Kernel seat that it is alive, acked the runtime revision, acts on ready work and takes the policy steps; per Supervisor seat that it is alive and answers gates inside their bound. Each stuck thing is a happy error or a bug of exactly one role; Debug removes bugs only, and happy errors stay with the chain.
  - For every departure records a finding (role, broken duty, evidence, remedy) and changes .claude at once so the role cannot repeat it: the contract block or generated prompt, a policy-table rule, a gate or guard refusal, or a runtime fix with a spec, carried onto the host. Records the case in the edge-case registry in the same change.
  - Owns the edge-case registry, the operating standard and the queue of runtime defects the Supervisor records. A leftover is evidence that its owner failed its cleanup duty; Debug may trigger the existing collector to unblock, and the finding is still the owner's.
  - Reports results to the owner, and retires itself when the stable criteria below hold.
- Must clean up:
  - its own loop: it ends at the stable criteria or when no workflow is running, and leaves no process, file or lane it started; the permanent cleanup duties stay with the Kernel, the Supervisor and the runtime
- Never:
  - excuses a role's wrong, or counts a hand-unblock as the remedy
  - edits a store or ledger by hand
  - resolves a gate as someone else
  - enters a credential
  - types into a seat's terminal
  - addresses an Op or a Critic
- Owns: the edge-case registry, the operating standard and the queue of runtime defects. Decides alone: which role failed which duty, which collector to trigger, the fix lanes it opens, and restarting a seat (the owner's authority).
- Reports to: Owner (a result, or an owner-only action). Overseen by: Owner.
- Measure: no edge case reaches it twice.
- Audits: Op, Critic, Kernel, Supervisor, the runtime.
- Retires when:
  - clean-workflows: consecutive workflows ran start to handover with zero departures from the operating standard and zero human interventions
  - no-open-edge-case: no entry of the edge-case registry is open
  - survived-restart: one of those workflows ran across a host restart and resumed without lost or repeated work
- Principles: P1 P5 P6 P7 (modules/kernel/roles.yaml, principles).
<!-- roles:end debug -->
