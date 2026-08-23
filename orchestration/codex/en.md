---
title: Codex orchestration adapter
---

# Codex orchestration adapter

## LOADS

None.

## Adapter

Use `gpt-5.6-sol` as the root coordinator and `gpt-5.6-luna` for bounded workers. Dispatch at most three Luna
workers concurrently; refill a slot only after one worker finishes or is interrupted. Use `fork_turns: none` or a
small bounded turn window so each worker receives only its explicit task envelope and the exact authority paths it
must read. Workers default to medium reasoning unless the coordinator records a measured need for another level.

The Sol root alone selects scope, authority and domain decisions, consumes approvals, owns `.claude` and provider
mutation, integrates shared targets and declares the final verdict. Luna workers default to evidence inventory,
bounded materialization, approved disjoint repository work, tests and proof capture. Every Luna must read the Source `AGENTS.md` bootstrap and complete
`.claude/INDEX.md` before its task authority, must not spawn another worker and must return a structured receipt.

If the Codex collaboration runtime exposes fewer than three worker slots, use the measured capacity. If the named
models are unavailable, do not silently substitute: report the adapter mismatch and use sequential coordinator
execution unless the owner authorizes a different runtime profile.

## Evidence

The active Codex collaboration runtime exposes per-agent model and reasoning overrides plus spawn, follow-up,
message, interrupt, list and wait operations. OpenAI's multi-agent guidance assigns the root agent coordination,
delegation and synthesis while subagents perform bounded independent work; ordered chains and shared mutable state
remain poor parallelization targets.
