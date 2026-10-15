Owner: knowledge/hfs/rules.yaml

# Back-end test data and public error contracts

These requirements apply to lite and full applications. The executable examples in
`packages/eslint/be/legacy-safety-coverage.spec.mjs` use the declared HFS edition for
each passing and violating case.

## R100

`BE_TEST_CONSTRAINTS_ON` keeps database constraints enabled throughout the test
tree. Arrange the required parent rows through a builder instead of changing
`session_replication_role`, deferring constraints, disabling triggers or dropping
foreign-key, check or unique constraints. SQL text and typed database calls are
both checked; an ordinary logging receiver is not a database connection.

## R108

`BE_ERROR_CAUSE_DROPPED` requires an escaping catch replacement to retain the
original failure. Rethrow the caught binding or pass that exact value as the
capability error's `cause`. This also applies to promise catch handlers. A handler
without a caught binding cannot create a replacement failure that preserves it.

The full CQRS handler template rethrows its caught error. The lite startup promise
handler reports the caught error and terminates without creating a replacement.

## R109

`BE_MEMBER_DOC_MISSING` reports a public member of an exported class, interface or
object type when it lacks an adjacent English JSDoc description. Describe what a
caller receives or causes; a line comment or tags alone do not supply that
description. Overloads share one member description. Constructors, private and
protected members, index signatures and properties initialized with literal or
named constants do not require a separate member description.
