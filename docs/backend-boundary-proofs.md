Owner: knowledge/hfs/rules.yaml

# Backend boundary proofs

## R84

`BE_CONNECTION_DUPLICATE` keeps each physical database behind one declared connection. Its connection constant, configuration, EntityManager injector and application registration must agree. The database capability owns connection construction; consumers use its named injector instead of opening another connection.

## R85

`BE_RAW_INJECT` requires infrastructure dependencies to use their owner's zero-argument injector over an exported unique-symbol token. The injector's declared type must match its constructor parameter. Providers use a class or an explicit injector, keep the standard parameter names, and avoid string tokens, service locators and forward references.

## R86

`BE_SQL_TABLE_OWNER` restricts SQL writes to the capability that owns the table. Reads stay within the same context and its permitted imports, and queries returning multiple rows need a bound. An entity declaration or the generated Supabase table contract establishes ownership; SQL text does not create another owner.

## R87

`BE_CQRS_SHAPE` requires typed Command or Query messages with one params value and ICQRSHandler.process handlers that return one call to an injected service. Use-case wrappers and in-process event buses are refused. `BE_READONLY_BOUNDARY` requires readonly message data and injected collaborators so callers cannot reassign either boundary.
