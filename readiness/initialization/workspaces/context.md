# Workspaces

## LOADS

None.

## Record

`.workspace/config.json` owns one Source-wide `defaultLang`. Each declared project role owns one
`.workspace/<project>/<role>/config.json` read route. Project and roles are owner-declared, never inferred.

`.workspace/ports/config.json` owns the Source-wide slot step. Each persistent family offset and application
slot map lives only in `.workspace/ports/<project>.json`. Initialization creates or validates that project-named
record before reusing a route and never copies allocation ownership into a target repository.

Verify checkout, repository, branch/head, manifests and real contract location before classifying a route as
`create`, `reuse` or `refresh`. Record `grammar` and `grammarProfile` as both null or as one explicit pair whose
compiler package and profile exist; identity names never infer them. Route records remain machine-local and contain
no credentials or environment values.

Evidence is the shared config, port config/allocation record, every role record and each resolved checkout fact.
Proof parses every record and resolves every declared path again.
