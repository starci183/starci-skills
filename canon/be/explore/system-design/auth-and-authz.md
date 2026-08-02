# Authentication and authorization

Two different questions get one word in casual speech and one middleware in careless code.
Authentication establishes *who is calling*. Authorization decides *whether that caller may do this
particular thing to this particular object*. Collapsing them is not a tidiness problem: it produces
the failure that has sat at the top of the OWASP API Security Top 10 since the list existed — Broken
Object Level Authorization, where a valid token is treated as permission and the object id in the
request is trusted because the caller was logged in.

Saltzer and Schroeder set the two governing principles in 1975 (*The Protection of Information in
Computer Systems*) and neither has aged: **complete mediation**, every access to every object is
checked, and **fail-safe defaults**, the default is denial and access is granted by explicit
exception. Almost every rule below is one of those two applied to a modern stack.

## The test

**Identity is verified once at the edge; permission is decided again in the use case, per object, and
a handler that nobody explicitly opened is closed.**

## The rules

- **Two guards in sequence, never one.** The first verifies the token and attaches the subject; the
  second consults the domain — membership, ownership, plan, tenancy. In Nest this is literally
  `@UseGuards(OidcAuthGuard, ResourceGuard)`, and the ordering carries meaning: the domain guard may
  assume an authenticated subject and may assume nothing else. Keeping them apart is what stops
  "authenticated" from silently becoming "authorized" when a new resolver copies the decorator stack
  from the one above it.
- **Default deny, enforced by the framework rather than by discipline.** A new handler with no
  decorator must be unreachable, not public. Register the identity guard globally (`APP_GUARD` in
  Nest) and make exposure an explicit opt-in — a `@Public()` decorator that a reviewer can grep for —
  rather than protection being an opt-in that a reviewer must notice is missing. This is the single
  highest-value structural decision in this file, because it converts an error of omission, which is
  invisible, into an error of commission, which is visible in a diff.
- **Verify tokens; never merely decode them.** Check the signature against the issuer's JWKS with a
  cached, rotating key set, and check `iss`, `aud`, `exp` and `nbf`. Pin the expected algorithms and
  reject `alg: none` and any algorithm confusion between HMAC and RSA; never fetch a key from a URL
  named inside the token itself (RFC 8725, *JSON Web Token Best Current Practices*). Use the
  provider's library — an OIDC provider such as Keycloak, or a maintained JOSE implementation — and
  write no part of this by hand.
- **Session or token is a revocation decision.** A server-side session is revocable the instant you
  delete the row, at the cost of a lookup and a store. A bearer JWT is stateless and therefore valid
  until it expires, whatever you do afterwards. The rule that follows is the one that matters: *the
  long-lived credential must be the revocable one*. Short access tokens measured in minutes, refresh
  tokens that rotate on every use with reuse detection, and revocation applied to the refresh token
  and the session — this is the shape RFC 9700 (*OAuth 2.0 Security Best Current Practice*, 2025)
  settles on, along with authorization code plus PKCE for every client type and the retirement of the
  implicit and password grants. Session lifetime and reauthentication limits come from NIST SP
  800-63B; if you keep long-lived device sessions, they need their own list, their own
  last-seen data and a way for a user to end one.
- **Roles answer what kind of thing; attributes and relations answer which row.** RBAC (NIST INCITS
  359) is the right shape for coarse capability: may this kind of user reach this kind of operation
  at all. ABAC (NIST SP 800-162) or a relationship check is the right shape for the per-object
  question. The common design error is expressing the second as the first — a role claim of `owner`
  baked into a token cannot say *owner of what*, and the moment a second object exists that claim is
  either useless or dangerous. Coarse role in the token, fine-grained relation from the store,
  checked per request.
- **Enforce ownership in the query, not in an `if`.** `WHERE id = :id AND tenant_id = :tenant` cannot
  be forgotten by a later refactor of the surrounding method, and it cannot be bypassed by a code path
  that reaches the same repository from somewhere else. A guard that loads the object and compares
  is second best; a bare `findOne(id)` followed by a comparison two screens later is how BOLA
  actually ships. And when the check fails, return the same answer as "does not exist": a distinct
  403 confirms which ids are real.
- **Least privilege applies to the system's own credentials, not only to users.** The database user
  the application connects as does not need `SUPERUSER`; the object-storage key that serves uploads
  does not need delete; the token a background worker holds does not need the scopes the web tier
  holds. Scope credentials per component, and make rotation possible without a code change — if
  rotating a key requires a deploy, it will not be rotated.
- **Secrets live in the environment and are read in exactly one place.** Twelve-Factor III is the
  baseline: configuration in the environment, never in a committed file. The portable strengthening
  is that `process.env` is touched by one config module which parses, validates and types every
  value, so the rest of the codebase consumes typed configuration and a missing variable fails at
  boot instead of at 3am as `undefined` in a header. Secrets never appear in a URL — query strings
  land in access logs, proxy caches and `Referer` headers — never in an exception's metadata, and
  never in a log line. Store password verifiers with a memory-hard KDF (Argon2id, or bcrypt where
  that is what you have) per the OWASP Password Storage Cheat Sheet and NIST SP 800-63B; compare
  secrets and signatures with a constant-time comparison; verify a webhook's signature over the raw
  body *before* parsing it, since parsing is already attacker-directed work.
- **Exposure is a separate gate from access.** A column existing on an entity and a field existing on
  the API are two decisions, and the ORM will happily conflate them. In a code-first GraphQL setup
  the `@Field` decorator is the gate: a sensitive column keeps its `@Column` and simply has no
  `@Field`, so it cannot be selected however the query is shaped. The equivalent in a REST layer is
  an explicit response type, never returning the entity. Reviewing this is easy if the generated
  schema is committed, because then adding a field is a visible diff rather than a property nobody
  read.

## One worked example

A single query resolver: identity, then domain, then an ownership predicate the query itself
enforces.

```ts
// features/api/graphql/queries/document/document.resolver.ts
@Resolver()
export class DocumentQueryResolver {
  constructor(
    @InjectPrimaryPostgreSQLEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  // Two guards, two questions. The first verifies the OIDC token against the
  // issuer's JWKS and attaches the subject; the second decides membership.
  // Neither implies the other, which is why they are two decorators and not one.
  @UseGuards(OidcAuthGuard, WorkspaceMemberGuard)
  @Query(() => DocumentResponse)
  public async execute(
    @CurrentUser() user: UserEntity,
    @Args("documentId", { type: () => ID }) documentId: string,
  ): Promise<DocumentResponse> {
    // The id arrived from the client, so it is a request and not a permission.
    // The membership predicate lives in the query: the database enforces it, and
    // a later refactor of this method cannot drop an `if` that is not there.
    const document = await this.entityManager.findOne(DocumentEntity, {
      where: {
        id: documentId,
        workspace: { members: { userId: user.id } },
      },
    });

    // The same exception for "absent" and "not yours". A distinct 403 would tell
    // an enumerating caller which ids exist (OWASP API1, Broken Object Level
    // Authorization) — the denial must not be more informative than the miss.
    if (!document) throw new DocumentNotFoundException({ documentId });

    return { document };
  }
}

// Wrong: the token proved who is calling, and the code then treats the id as if it
// had proved what they may reach.
// const document = await this.entityManager.findOne(DocumentEntity, {
//   where: { id: documentId },
// });
```

## What a machine can check, and what it cannot

Checkable: that no handler is reachable without a decision, by registering the identity guard as a
global `APP_GUARD` and asserting in a test that walks the generated schema that every field carries
either the guard chain or an explicit `@Public()`. That `process.env` is read in one file, via an
ESLint `no-restricted-properties` or `no-process-env` rule with a single exemption. That no secret
literal is committed, via a pre-commit secret scanner. That the exposed schema has not silently
grown, by committing the generated SDL and reading the diff.

Judgement: whether the object-level predicate actually expresses the permission the product means.
The query compiles, the tests pass, and the predicate can still be one join short of correct. The
useful review question is not "is there a check" but "name the caller for whom this returns a row it
should not" — and if a query has no subject dimension anywhere in it, that is the answer.

Related: `caching.md` (an authorization decision is the value least safe to cache, and authenticated
responses are `no-store`) and `observability.md` (the log line that would have proved an access was
denied is also the line most likely to contain a token).
