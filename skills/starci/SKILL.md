---
name: starci
description: >-
  Interact with StarCi only through an explicit /starci request or explicit native skill selection.
  Resolve its host and project context, inspect or draft workflow goals, manage approved workflows,
  diagnose host readiness and action credentials, run assisted UAT, and complete authorized runtime releases.
disable-model-invocation: true
triggers: [user]
---

# StarCi

Treat invocation as instruction selection. It does not approve a goal, queue entry, agent launch, service startup,
release or external action. Continue only within the owner's recorded scope and the selected native contract.
A plain request containing workflow, create, start or debug follows ordinary chat context and does not enroll into
StarCi. An existing bound StarCi job follows its own role contract without invoking this public skill.

Resolve `<Source>`, the host that owns `.claude/CONTEXT.md`, then read that entry and the selected project binding
from `.workspaces/projects/<project>/work.json`. Carry these absolute locations when delegating or changing directories.
Read local config through its existing owner; never rewrite unrelated model or authority settings.

## Host status on every invocation

Before the requested action, run `starci reconciler up --check --brief` from `<Source>` (read-only, a few seconds, no
effects) and show its output as the host status: engine, harness UI, harness tunnel, ask gateway and tunnel, launcher
shim, the three Windows tasks with whether their action is current, the Supervisor seat, the core-debug seat when
`debug: true`, and the Kernel seat of every running workflow. Then continue with the requested action.

- When a no-quota service, the launcher shim or a task registration is down, run `starci reconciler up --services`,
  show each applied line, and continue. It never launches an agent seat.
- A seat shown as `not running (starts with a workflow)` is idle, not a fault. Never start an agent seat from an action
  other than start: only `starci workflow start`, `starci supervisor start` or an explicit owner request starts one.
- Orca is opened by the owner. A red row the services heal does not repair is reported with its fix.

Load only the reference needed for the requested action:

| Request | Instructions |
| --- | --- |
| Define or revise a workflow goal | `references/define-goal.md` |
| Start an approved workflow | `references/start-workflow.md` |
| Read, relay or monitor one workflow | `references/workflow-chat.md` |
| Complete a prepared assisted UAT | `references/assisted-uat.md` |
| Release or push authorized work | `references/release.md` |
| Owner chat host operations | `references/orca-cli.md` |
| Owner chat worker coordination | `references/orchestration.md` |
| Owner chat visible computer inspection | `references/computer-use.md` |
| Inspect a selected action's credential requirements | `<Source>/.claude/docs/host-secrets.md` |
| Inspect or recover host readiness | `<Source>/.claude/skills/starci/references/host-startup.md` |
| Inspect runtime maintenance | `<Source>/.claude/skills/starci/references/host-maintenance.md` |

For a new workflow, resolve missing project, goal, scope and expected outcome through a read-only context scan and
clarification. Once sufficient, run the native read-only goal planner, present the exact draft and derived operation
plan with its identity and intended actions, and obtain the owner's OK before queue or start effects. Silence and a
generic instruction to handle matters do not accept an unclear goal. Reuse approval only while the accepted goal,
plan and authority remain the same.

Workflow startup runs the full host path (the services heal, the Supervisor seat and configuration-selected maintenance)
through the native lifecycle. Follow its actual receipt; do not create an additional host loop, maintenance agent or
scheduler from this entry.
