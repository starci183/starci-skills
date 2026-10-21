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
shim, the three Windows tasks with whether their action is current, the Supervisor seat, and the Kernel seat of every running workflow. Then continue with the requested action.

- When a no-quota service, the launcher shim or a task registration is down, run `starci reconciler up --services`,
  show each applied line, and continue. It never launches an agent seat.
- A seat shown as `not running (starts with a workflow)` is idle, not a fault. Never start an agent seat from an action
  other than start: only `starci workflow start`, `starci supervisor start` or an explicit owner request starts one.
- Orca is opened by the owner. A red row the services heal does not repair is reported with its fix.

Verification of runtime changes is `starci runtime verify` (`starci runtime check`, `starci release clean-test` of the packages the change touches and `starci release scaffold-e2e` on one commit; the check line alone runs no test and is not a verdict). The runtime has no specs of its own (owner ruling `no-runtime-specs`): never write a runtime test; `RT_SPEC_PLACEMENT` refuses a spec outside the package slots, `examples/` and `e2e/`.

Who writes product code follows the app's `hfs.json` edition (owner ruling `lite-chat-full-op`): a lite app is coded directly in this chat or a chat subagent, with no op, but through its app gates (`starci gate read --root <app> --touch <files>`, code with its specs, `starci gate run --root <app> --changed <files> --tests <pattern>`, `starci app lint` and `starci app check`, the pre-commit hook); a full app is changed only through Kernel ops, never hand-coded here. See `references/code-delegation.md`.

Load only the reference needed for the requested action:

| Request | Instructions |
| --- | --- |
| Define or revise a workflow goal | `references/define-goal.md` |
| Start an approved workflow | `references/start-workflow.md` |
| Read, relay or monitor one workflow | `references/workflow-chat.md` |
| Debug running workflows: find what is stuck or left behind and get it cleaned up (the chat loop) | `references/debug-loop.md` |
| Complete a prepared assisted UAT | `references/assisted-uat.md` |
| Release or push authorized work | `references/release.md` |
| Owner chat host operations | `references/orca-cli.md` |
| Owner chat worker coordination | `references/orchestration.md` |
| Write or delegate app code (lite: chat with app gates; full: Kernel ops) | `references/code-delegation.md` |
| Owner chat visible computer inspection | `references/computer-use.md` |
| Inspect a selected action's credential requirements | `<Source>/.claude/docs/host-secrets.md` |
| Inspect or recover host readiness | `<Source>/.claude/skills/starci/references/host-startup.md` |

For a new workflow, resolve missing project, goal, scope and expected outcome through a read-only context scan and
clarification. Once sufficient, run the native read-only goal planner, present the exact draft and derived operation
plan with its identity and intended actions, and obtain the owner's OK before queue or start effects. Silence and a
generic instruction to handle matters do not accept an unclear goal. Reuse approval only while the accepted goal,
plan and authority remain the same.

Workflow startup runs the full host path (the services heal and the Supervisor seat) through the native lifecycle. Follow its
actual receipt; do not create a host loop, maintenance agent or scheduler from this entry. After a start, and whenever the
owner asks to debug, set up the debug loop of this chat as `references/debug-loop.md` says (Claude Code `/loop`, Codex per
that file); the loop runs in this chat on its own model: it reads `starci debug digest` and gets every problem it lists cleaned up by its owner.
