# `authoring/` — how a line of back-end code is spelled

Seven files, all about the text of the code rather than the design behind it: where a thing lives
and what it is called, how a failure is represented on its way out, what may accept input and how it
is guarded, which types are allowed to survive, how configuration and secrets are read, and how
imports and comments are written. Together they cover the decisions a stranger is most likely to get
wrong in the first hour — which folder this belongs in, what to do with the error they just caught,
and how the line itself is spelled.

This is the **enforce** lane, so each rule states plainly whether a machine can settle it — a
filename case rule an eslint plugin holds, a thrown literal the compiler's own rule catches, a
boundary a folder-shape check can assert — and says so at the end of the section rather than leaving
the reader to guess. What is left over, and it is the more valuable half, is the type-valid,
lint-clean, renders-fine mistake that no gate catches.

Anchors here are **public sources, not files in this tree**: Parnas on information hiding, Evans on
the bounded context, Richardson, the RFCs for the wire shape of an error. There is nothing in these
files to re-count and no path in them to go stale. The concrete examples are written in TypeScript
against a Nest-shaped application because that is the shape the rules were drawn from; the rule above
each example is what travels.

| File | Decides |
|---|---|
| [`naming-and-structure.md`](naming-and-structure.md) | that a top-level folder is a capability rather than a layer, the split between what is reusable and what wires it to a transport, one public entry per module with a deep import from another capability treated as a bug, colocation by default with promotion on the second consumer, one operation per folder behind an entry-point method with a fixed name, the suffix that names a file's role, and the expand-and-contract rule for renaming something that has already spread |
| [`error-handling.md`](error-handling.md) | that every thrown value is a typed exception carrying a stable code, that expected and unexpected failures are different species and the thrower decides which, that a driver's error is translated at its adapter and never travels past it, one error shape built in exactly one place at the API boundary, no stack or query or internal identifier crossing that boundary, one log line per error at the boundary carrying a correlation id, and retryability declared on the error rather than guessed by the retrier |

## Reading order

Open the one the task touches. If both are in play — a new capability that also has to report
failures — read `naming-and-structure.md` first, because where the module boundary falls is what
decides which layer edge the translation in `error-handling.md` §3 happens at.

The design decisions these two presuppose are on the `explore/system-design/` shelf: the module
boundary itself in `module-layering.md`, the wire contract in `api-design.md`, and what happens
around a failure rather than to it in `resilience.md` and `observability.md`.
