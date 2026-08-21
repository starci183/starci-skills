---
title: Initialization · workspaces
---

# Workspaces

## LOADS

None.

`.workspace/config.json` owns one Source-wide `defaultLang`. Each declared project role owns one
`.workspace/<project>/<role>/config.json` read route. Project and roles are owner-declared, never inferred
from directory names or a previous run.

`.workspace/ports/config.json` owns the same Source's slot step, while one
`.workspace/ports/<project>.json` owns each persistent family offset and application slot map. When a
declared project binds local services, initialization creates or validates its project-named allocation
record before the route is reusable. It never copies the offset into a target repository and never edits a target.

Verify checkout, repository, branch/head, manifests, and the real contract location before classifying a
route as `create`, `reuse`, or `refresh`. A missing contract is `null` only when the repository truly has
none. Record `grammar` and `grammarProfile` as an explicit pair: both `null`, or both resolving to the
exact grammar authority package and profile. Project and repository names never infer them. Route records are
machine-local descriptions: they never clone, mirror, mount, or edit a target,
and never contain credentials or environment values.

Evidence is the shared config, port allocation, every role record, and each resolved checkout fact. Action writes or
refreshes only those local route records. Proof parses every record and resolves every declared path
again; print `written`, `refreshed`, or `reused` per route.
