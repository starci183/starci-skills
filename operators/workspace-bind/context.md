# Context for `workspace.bind`

## Purpose

Context is the exact material already available to bind one project and role to one verified
checkout. It answers "what may this operator read?" before any path is resolved. Context never
expands the request and never turns a resemblance into an authority.

Every reference is immutable for the invocation and bound by a `sha256:` fingerprint. Observations
that come from a checkout additionally bind the observed head.

## Context classes

| Context | Role in the decision | Authority status |
| --- | --- | --- |
| Bootstrap evidence | The entry files and agent discovery that prove this Source owns the runtime. | Required. Establishes that a route may be read at all. |
| Portable declaration | `.workspaces/projects/<project>/<role>.json`, compiled and tracked. | Required route authority. The only place a route is declared. |
| Hydrated route | `.workspaces/local/routes/<project>/<role>/config.json`, machine-local and ignored. | Required. Projects the portable declaration onto this machine's disk. |
| Machine identity | The device identity and its encrypted credential roster. | Required. Proves the machine may hold the roster; never a source of secrets. |
| Runtime owner | The registry entry, generation, health evidence, and closed endpoint binding. | Required only when the caller consumes the shared runtime. Never transferable. |
| Provenance head | The redacted conversation head for this project and role. | Evidence of continuity. Never a route decision. |
| Cached route receipt | A previous binding for the same identity tuple. | Evidence and freshness comparison only. |
| Hints | Similar names, sibling directories, the current working directory, a browser URL. | Never authority. Recorded and rejected. |

## Required context

Every invocation requires:

1. at least one bootstrap reference;
2. one portable declaration for exactly the requested project and role;
3. one hydrated route belonging to this Source;
4. one verified machine identity whose credential roster is encrypted.

A caller that consumes the shared runtime additionally requires the runtime owner binding.

## Refs

| Alias | Resolves to | Bind | Required |
| --- | --- | --- | --- |
| `@declaration/<project>/<role>` | `<Source>/.workspaces/projects/<project>/<role>.json` | fingerprint | Required: The portable route declaration; the only route authority. |
| `@route/<project>/<role>` | `<Source>/.workspaces/local/routes/<project>/<role>/config.json` | fingerprint | Required: The hydrated route this machine projects the declaration onto. |
| `@identity` | `<Source>/.workspaces/device-state.json` | fingerprint; the sealed keys under &lt;Source&gt;/.workspaces/local/credentials/*.key.enc are bound by name and never read | Required: Machine identity and the sealed roster, bound by name. |
| `@ports/<project>` | `<Source>/.workspaces/ports/<project>.json` | fingerprint | Optional: Port projection when the caller consumes the runtime. |
| `@runtime` | `<Source>/.worktrees/sessions/central-runtime/owner.json` | fingerprint + generation | Optional: Runtime owner registry, bound only when runtimeNeed is consume. |
| `@artifacts` | `input.project.artifactRootRef; convention <Source>/.worktrees/sessions/<invocationId>/artifacts/` | fingerprint per artifact; every artifact an operator writes is registered in output.artifactRefs | Required: Where the route receipt is written. |

## Route authority is the declaration, never the resemblance

A route exists because `.workspaces/projects/<project>/<role>.json` declares it and the hydrated
local route projects it onto this machine. Nothing else establishes a route.

`context.hints` exists so that the things which look like routes can be named and refused rather than
quietly consulted. A directory whose name resembles the project, a sibling checkout that happens to
sit next to the Source, the shell's current working directory, and the origin currently open in a
browser are all recorded with `authoritative: false`. There is no representable way to supply a hint
that carries authority, because a hint promoted to authority is exactly how work lands in the wrong
checkout without anyone noticing.

The two route halves must agree on project, role, Git repository, and branch. A `source` repository
kind carries a null directory and resolves to the Source root itself; a `sibling` kind carries a safe
relative directory and resolves beside the Source. The hydrated route must name this Source as its
own and `.workspaces` under it as its workspace root, or it belongs to another machine's Source and
is refused.

## Endpoint binding is a closed projection

An endpoint is never a URL somebody chose. It is the `workspace-route-port-projection` described in
`runtime/contracts/endpoint-authority.mjs` on the `v7` branch of starci-skills: the verified frontend and backend routes, the
project offset and slot step from `.workspaces/ports/`, the application slot, and the routed
backend's declared `portServices`, folded into one fingerprint. The binding carries that fingerprint,
and a stale one is refused rather than recomputed into agreement.

Only origin-only `http://localhost:<canonical-port>` values are endpoints. A free URL, `127.0.0.1`, a
remote host, an alternate application, an undeclared service, or a port that merely happens to be
listening establishes nothing.

## The caller is a consumer, never an owner

The shared local runtime belongs to exactly one delegated owner task. This operator binds the caller
to that owner's endpoints as a consumer. It does not start, stop, restart, replace, or kill a
process, and it does not claim a port, a PID, or a runtime lifecycle. A registry that is missing,
stale, or not ready yields a typed block so the caller can raise one coordination request; it never
authorises a replacement.

## Boundary

Context is read-only apart from the machine-local hydrated route state, which is ignored by Git. The
operator writes only its route receipt under `input.artifactRootRef`. It does not repair a route,
initialize a workspace, provision an account, publish anything, or record a product decision.

## Resources

This operator runs end to end on the `sonnet` profile (`claude-sonnet-5`, runtime `claude`), declared under `resources` in `operator.json` and validated by `scripts/validate-resources.mjs`. Grants it requires: none. It never searches the web, is not bound to Grammar, and generates no image. A grant absent from `requires` is unavailable even if the profile would permit it.
