# Nest error identity check

`scripts/checks/code-patterns/nest-error-identity.mjs` is the read-only source adapter
for selected Nest error-family declarations and escaping thrown values. It uses
the target's canonical architecture configuration and TypeScript projects. The
aggregate remains responsible for binding exact production sources, package and
compiler/configuration inputs before and after the check.

## Target declaration

The target owns `package.json#starci.codePatterns.nest.errorIdentity`:

```json
{
  "schema": "starci/nest-error-identity@1",
  "profile": "capability",
  "throwRoots": ["src", "apps/api/src", "libs/account/src", "libs/domain/src"],
  "families": [{
    "id": "account",
    "path": "libs/account/src/errors/account-error.ts",
    "export": "AccountError",
    "declarationRoots": ["libs/account/src/errors"],
    "codeProperty": "code",
    "causeProperties": ["cause"]
  }]
}
```

Every selected production file must belong to one `throwRoots` entry. This is a
complete inventory, so a target cannot make unsafe throws disappear by naming a
smaller safe directory. Paths and exports are exact source identities. Every
selected family must extend the standard TypeScript `Error` identity; a local
class merely named `Error` cannot satisfy the contract.

The `capability` profile selects one or more capability-owned base families and
does not impose an application-wide folder, suffix or constructor convention.
The `academy-abstract-exception` profile selects exactly one hierarchy. Its
family also declares:

```json
{
  "academy": {
    "classSuffix": "Exception",
    "codeArgument": 1,
    "metadataArgument": 2
  }
}
```

Argument positions are zero-based. This profile fixes `classSuffix` to
`Exception`, `codeArgument` to `1`, and `metadataArgument` to `2`, matching the
selected Academy base API rather than permitting target-defined alternatives.
Academy subclasses live under the declared roots, use that suffix, declare an earlier exported
`<ClassName>Metadata` interface, take that interface through one object-binding
constructor parameter, and pass one literal unique code plus a static metadata
object through one direct top-level `super` statement. The code is the exact
upper-snake form of the owning class name. The named interface must expose the
declared cause properties, directly or through interface inheritance.

A status-only health/readiness endpoint may explicitly select protocol-native
Nest HTTP exceptions without changing the family policy:

```json
{
  "throwAllowances": [{
    "path": "apps/api/src/health.controller.ts",
    "purpose": "health-probe",
    "identities": [{
      "module": "@nestjs/common",
      "export": "ServiceUnavailableException"
    }]
  }]
}
```

The path is exact, belongs to the complete throw inventory, and has no filename
inference or glob. Each allowed constructor must be imported from the public
`@nestjs/common` entry, resolve to that installed package, and derive from its
real `HttpException`. Local lookalikes, path aliases, deep imports and custom
modules cannot satisfy the allowance. The declaration records the protocol
owner's decision; endpoint behavior tests still prove that the route is truly a
health/readiness probe and that its status semantics are correct.

## Machine rules

- `NEST_ERROR_DECLARATION_IDENTITY` resolves every selected base and subclass
  through the target TypeScript program. It checks the actual standard `Error`
  ancestry and declared roots. In the Academy profile it additionally checks
  suffix, named metadata interface, constructor/super flow and unique literal
  codes. A helper declaration that is never called cannot supply direct
  constructor or `super` evidence.
- `NEST_THROWN_ERROR_IDENTITY` inspects every `throw` in the complete production
  inventory. A selected family/subclass construction or immutable const alias is
  accepted. Rethrowing the same caught value is accepted only while the catch
  binding and its const alias have not been reassigned. Dynamic factories are
  unavailable. Other escaping values are findings. Academy construction sites
  take exactly one object-literal metadata argument. A declared health-probe
  source may additionally throw only its exact resolved Nest allowance.

The adapter inspects thrown values. Returned typed business dispositions remain
ordinary domain results and are not interpreted as failures by this rule.
Creating `Error` internally for diagnostics or normalization is allowed; an
anonymous `Error` cannot escape as a selected application failure.

## Limits

The check proves static TypeScript identity and the declared constructor form.
It does not decide which product outcomes are exceptional, whether public error
messages are safe, whether retry/redaction policy is correct, or whether a
transport sends the expected wire result. Dynamic factory throws are
unavailable rather than guessed. Run the selected behavior and transport tests
and review those semantic decisions separately.
