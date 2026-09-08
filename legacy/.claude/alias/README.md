# Alias registry

An alias is a stable symbolic reference. It identifies a workspace location, a session
capability, a command or a remote resource. It does not grant permissions or prove availability.

## Namespaces

| Source | Prefix | Meaning | Examples |
| --- | --- | --- | --- |
| `workspaces.json` | `@workspaces` | Local workspace, work records and installed runtime resources | `@workspaces/inputs`, `@workspaces/schema` |
| `tools.json` | `@tools` | Capabilities invoked through the active agent session | `@tools/imagegen`, `@tools/browsercontrol` |
| `cli.json` | `@cli` | Executables and shipped script entry points invoked through a shell | `@cli/git`, `@cli/python`, `@cli/browser-walk` |
| `remote.json` | `@remote` | External resources consumed or changed by an invocation | `@remote/git`, `@remote/npm` |
| `index.json` | Registry metadata | Version, zone descriptions, shared segments and source module list | Contract version 1 |

`@tools/browsercontrol` means host browser interaction. `@cli/browser-walk` runs the shipped
Playwright script through Node.js. `@cli/git` calls Git; `@remote/git` names the target remote.
Python, Node.js and Git are installed dependencies; their CLI aliases identify how to invoke them.
A CLI alias identifies an entry point, not a preapproved command with arbitrary arguments.
A browser or connector exposed by the host stays a session tool even if its implementation uses
an executable internally. Generic HTTP/SDK access must not be mislabeled as a particular CLI.

## Resolution

`<Workspace>` is the explicitly selected project root. `<Runtime>` is the installed skill runtime
root. `<Frontend>`, `<Backend>` and `<Grammar>` are optional explicit root bindings. Resolve roots
from invocation context; do not infer missing roots from the process working directory.
`workId` selects `.works/<workId>/`. Validate it against the work schema identifier before using it.
The alias registry's symbolic roots are resolver inputs, not additional fields in a work JSON record.

Choose the longest registered alias at an exact match or slash boundary. A registered child wins
over the root. Subpaths narrow directory or checkout aliases only; reject traversal, absolute
subpaths and symlink escapes. Files cannot be narrowed. Shared friendly segments apply only to
checkout aliases. Tool, CLI and service arguments are structured invocation inputs, not appended
filesystem paths. Remote placeholders come from explicit endpoint and resource bindings.
These are resolver requirements; the build checks declarations and does not perform live resolution.

Every definition contains `kind`, `resolvesTo`, `params`, `scheme`, `bind`, `writers`, `purpose` and
`zone`. `invocation` is required for tools and CLI entries: a session capability or an executable
with its fixed argument prefix. Tool `support` describes intended adapters; the active host must
still verify availability. Empty `writers` means no writing operator is granted by this registry.
A request's write scope and host authorization are checked independently. The dependency guides
own installation instructions. Add no secrets or machine-specific absolute paths here.

## Build and validation

```sh
python scripts/build.py
python scripts/build.py --check
python scripts/test_build_alias.py
```

The two production files are `.dist/alias.json` and `.dist/schema.json`. Build aliases alone with
`python scripts/build-alias.py`. The standard-library builder produces deterministic UTF-8 JSON
with one flat `aliases` map. It rejects undeclared fields, invalid namespaces and invocation
shapes, duplicate aliases or JSON keys, missing or unlisted modules and escaping module paths.
`--check` never writes. A failed alias build retains its previous output.

These definitions establish the proposed contract. The existing execution engine has not yet
been switched to consume this bundle. Building does not relocate records or delete workspace data.
