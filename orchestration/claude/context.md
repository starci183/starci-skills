# Claude orchestration adapter

## LOADS

None.

## Adapter

Use the locally supported `opus` alias for the coordinator and `sonnet` for bounded background workers. Dispatch
at most three Sonnet workers concurrently and refill completed slots. Every background task receives an explicit
agent definition or prompt envelope, allowed tools, exact working directory, model, effort and permission mode.
Use medium effort for workers by default.

The Opus coordinator alone selects journey and UI direction, consumes approvals, owns `.claude`, integrates shared
source and declares parity. Sonnet workers default to evidence inventory, cache HTML generation, approved disjoint
product code, seed execution, tests and browser captures. Workers must read the Source bootstrap and complete
`.claude/INDEX.md`, cannot create child agents and return the common structured receipt.

Use Claude Code background agents only when the installed runtime exposes the required `--agents` or `agents`
capability and named model aliases. Measure those capabilities at run start. If unavailable, use sequential
coordinator execution; never guess a model name or bypass permission policy.

## Evidence

The measured Source host runs Claude Code 2.1.207. Its CLI exposes custom agents, background agent management,
model selection with `opus` and `sonnet` aliases, effort, working-directory and permission controls. This adapter
records only those locally observed capabilities.
