Owner: knowledge/hfs/rules.yaml

# Test data builders

## R98 builder home

In lite and full, BE_TEST_BUILDER_HOME identifies exported test support that creates
persisted rows through a TypeORM EntityManager, DataSource or QueryRunner. Keep that
builder in `be/src/tests/fixtures/builders/<area>.builder.ts` and its SQL text beside
it in `<area>.sql.ts`. Moving the same persistent builder into a world helper or
general fixture file is a violation. Read-only helpers and a cache with a method
named `save` do not become persistent builders.

Persistent row builders depend on the application's entities and parent chains.
The scaffold's wiring-proof builders provide configuration and infrastructure
doubles; they do not create those domain rows.

## R99 row arrangement

In both editions, BE_TEST_ROW_BY_BUILDER requires specs to arrange persistent rows
through their area's builder. A spec may read database state, but direct database
writes and raw INSERT, UPDATE or DELETE statements belong in the builder. The
database receiver is identified by its TypeORM type rather than its variable name.

A spec also avoids constructing the same persistence entity as an object literal
more than once, including through `Partial<Entity>`. Obtain additional rows from a
builder; spreading a builder result permits explicit overrides. One entity literal
and repeated literals of a plain, non-entity type do not trigger the repetition rule.
The dedicated specs exercise passing and violating arrangements for both editions.
