# shape-slot dev environment keys

This is a names-only roster for manual host development, not a declaration of a deployable stack. No sealed members are checked in. An owner introducing credentials seals them under `.starcistacks/dev/secrets/*.enc`; the age key stays only in untracked `.claude/secret.env` as `SOPS_AGE_KEY`. Never save a database credential in a tracked dotenv file.

| key                                | consumer                | requirement and source                                                                                                |
| ---------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `PORT`                             | core                    | Required integer HTTP listener port; use 3000 for local development.                                                  |
| `PRIMARY_DB_URL`                   | core, cli               | Required PostgreSQL connection for the notes database; use a mounted `PRIMARY_DB_URL_FILE` for credentials.           |
| `PRIMARY_DB_URL_FILE`              | EnvSource for core, cli | Optional mounted path; takes priority over `PRIMARY_DB_URL`, and an unreadable file fails boot.                       |
| `HTTP_SECURITY_ALLOWED_ORIGINS`    | core                    | Required comma-separated exact origins; HTTPS or local HTTP such as `http://localhost:3001`; no wildcard or URL path. |
| `HTTP_SECURITY_TRUST_PROXY`        | core                    | Optional integer hop count, 0 through 10; defaults to 0 for the direct host listener.                                 |
| `HTTP_SECURITY_RATE_WINDOW`        | core                    | Optional rate-limit duration; defaults to 60000 milliseconds.                                                         |
| `HTTP_SECURITY_RATE_DEFAULT_LIMIT` | core                    | Optional integer rate limit; defaults to 600 requests per window.                                                     |
| `HTTP_SECURITY_RATE_STRICT_LIMIT`  | core                    | Optional integer strict rate limit; defaults to 30 requests per window.                                               |
| `NEXT_PUBLIC_API_BASE_URL`         | shape-slot FE           | Required public base URL of the separate sales API; supplied at FE dev/build time, never sealed.                      |

The typed readers are `be/apps/core/src/core.env.ts` and `be/apps/cli/src/cli.env.ts`; the FE reader is `fe/apps/shape-slot/src/modules/config/index.ts`. This example has no required queue, cache, object store or identity-provider key.
