# Nest callable contract and readonly boundary check

`starci architecture check` reports two independent Nest contract rules:

- `BE_PUBLIC_CONTRACT_FORM` checks callable capability APIs resolved from explicit
owner public entries and exported domain-first `*.use-case.ts` classes. Public
functions, methods, callable properties and getters are included. Parameters
and results must be explicit. Positional primitives remain valid;
  object, union and intersection boundaries use named declarations. The checker
  unwraps standard `Promise`, `Awaited`, `Readonly`, array and readonly-array
  containers and applies concrete generic arguments to inherited `execute`
  signatures. It does not require an inherited method to be redeclared. A
  member declared only in an ambient library file, such as `Error`'s static
  side in `lib.es*.d.ts`, is not part of the repository's public contract and
  is excluded from the callable walk; a member the checked repository itself
  declares is still checked.
- `BE_READONLY_BOUNDARY` checks fields that static Nest identity proves are
  injected dependencies or CQRS command/query payloads. Constructor parameter
  properties and ordinary declared fields assigned in the constructor are both
  supported. Transport DTOs are not treated as messages merely because they are
  classes; installed transformation/validation tooling may require mutable DTO
  construction.

The existing `BE_SOURCE_NAME_INVALID` result remains the separate proof for
adopted public contract names and serialized enum forms. A contract result does
not replace that rule.

## Discovery and fail-closed behavior

Every backend feature/module production source must be inside an explicitly
declared owner root before public API coverage is checked. The checker resolves
each owner's named public entry through the target TypeScript program, including
aliases and re-exports. It checks exported functions and callable public members
but excludes transport adapters and module-definition/configuration registration
helpers. A use-case `execute` contract is also selected from its actual inherited
type.

Resolved `@Injectable`, `@Controller`, `@Resolver`, `@CommandHandler` and
`@QueryHandler` classes select constructor injection. A resolved `@Inject`
parameter or property selects that dependency even without a class decorator.
The message class passed to a resolved command/query handler selects its instance
payload fields. Static string property assignments and immutable local aliases
are supported. A constructor expression that retains an injected dependency,
including through a conditional, call or immutable alias, still selects the
declared storage field. A direct primitive property projection is treated as a
value snapshot rather than dependency storage.

Missing owner declarations, uncovered feature/module sources, unresolved public
signatures, constructed framework decorators (including object aliases),
computed, Reflect, defineProperty, destructured or Object.assign dependency
storage, dynamic message identities and stateful bases outside the checked program make
the relevant coverage unavailable. In that state the corresponding rule ID is
absent from `coverage.checkedRuleIds`; a clean violation list is not a pass.

## Limits

This check establishes TypeScript declaration shape. It does not prove runtime
payload validation, serialized compatibility, Nest provider scope, token
identity, transaction behavior or safe mutation inside called dependencies.
Those properties require the target's boot, contract and behavior evidence.
Unknown public ownership and constructed runtime metadata cannot be waived by a
filename, baseline or prose assertion.
