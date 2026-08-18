---
title: Initialization · workspaces
---

# Workspaces

## LOADS

None.

`.workspace/config.json` owns one Source-wide `defaultLang`. Each declared project role owns one
`.workspace/<project>/<role>/config.json` read route. Project and roles are owner-declared, never inferred
from directory names or a previous run.

Verify checkout, repository, branch/head, manifests, and the real contract location before classifying a
route as `create`, `reuse`, or `refresh`. A missing contract is `null` only when the repository truly has
none. Route records are machine-local descriptions: they never clone, mirror, mount, or edit a target,
and never contain credentials or environment values.

Evidence is the shared config, every role record, and each resolved checkout fact. Action writes or
refreshes only those local route records. Proof parses every record and resolves every declared path
again; print `written`, `refreshed`, or `reused` per route.
