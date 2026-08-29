---
name: starci-tech-stack
description: "Discover, challenge, approve, and publish one project operational tech-stack contract. Use when a stack is missing, stale, disputed, or must define microservice runtime, communication, persistence, deployment, and ownership; do not use to implement product code or make feature architecture decisions."
---

# starci-tech-stack

Discover, challenge, approve, and publish one project operational tech-stack contract. Use when a stack is missing, stale, disputed, or must define microservice runtime, communication, persistence, deployment, and ownership; do not use to implement product code or make feature architecture decisions.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `freshness`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. An omitted `selection.mode` is `gated`: stop at waits for the exact displayed revision. With explicit `selection.mode=bypass`, bind the displayed revision to an ephemeral bypass-authorization receipt and continue only to the wait state's declared `approval.bypassTarget`. Finish only at a terminal and purge all intermediates while preserving authorized durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `freshness` | source, generator and schema hashes plus cached receipt metadata | source bodies and cached artifact body |
| `discovery` | declared manifests, lockfiles, runtime configuration and deployment descriptors | feature source and unrelated documentation |
| `model` | observed inventory plus approved business and architecture constraints | treating source conventions as target truth |
| `compatibility + publish` | exact candidate, version, deployment and approval evidence | new broad discovery and unresolved critical contradictions |
