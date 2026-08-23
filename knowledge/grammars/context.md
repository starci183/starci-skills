# Grammar authority router

## LOADS

None.

## Routes

Resolve only the grammar id and profile declared by the verified frontend workspace route. Available
product-family packages are `starci/context.md` and `tayson/context.md`. Absence is a stop; a repository,
project name or sibling package is never a fallback selector.

## Boundary

When frontend Layout is driving, consume the already selected page archetype before resolving product-family
facts. Grammar assigns semantic outcomes and profile owners inside the archetype's required regions; it may not
delete, replace or reinterpret that macro region graph or its wide/intermediate/compact interaction parity.
