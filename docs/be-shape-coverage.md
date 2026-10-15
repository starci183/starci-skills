Owner: knowledge/hfs/rules.yaml

# Back-end transport and infrastructure boundaries

## R88

`BE_TRANSPORT_SHAPE` keeps an application door in its feature transport slot. A domain, platform or integration capability never imports a feature. A door maps input, dispatches one command or query on its injected bus and returns the mapped payload. It holds no business branches, extra service calls, response envelope or free-form GraphQL JSON scalar. Database work belongs behind the dispatched handler.

The same boundaries apply to lite and full. The GraphQL resolver scaffold demonstrates bus injection and input and result mappers. The executable examples for each edition pair accepted doors with misplaced controllers, reversed imports, missing dispatches, response envelopes and JSON scalars.

## R90

`BE_INFRA_OWNER` assigns each raw infrastructure library to the capability listed in the slot manifest. Application code calls that owner's port instead of importing a second client. For example, an HTTP implementation may import axios while a domain service may not. A call through the platform HTTP `HttpClient` port belongs to the provider's integration capability; retaining its type without making a call is permitted.

Lite and full use the same import and call boundaries. The full queue scaffold constructs its BullMQ clients inside the queue owner. Lite supplies no implementation scaffold for raw clients or provider integrations. Executable examples for each edition show both permitted owner calls and refused domain calls.

## R89

`BE_SOURCE_FORM` keeps file names inside the manifest's closed role suffix vocabulary and gives exported declarations English JSDoc and stable names. Source uses named exports, plain enums and named object types. A production declaration carries no test double marker. Emoji and localized prose belong in their designated catalog or fixture slots.

`BE_PUBLIC_CONTRACT_FORM` requires a public object input or output to reference a named contract. An inline object annotation in a public service signature is refused even when TypeScript can infer the shape. Lite and full share these forms. The input scaffold illustrates a named, documented public class; the executable examples compare accepted and refused native forms, tracked source paths, source role names and public contracts in each edition.
