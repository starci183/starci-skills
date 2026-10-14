# Environment key roster

This roster declares names only. Store credential values in sealed custody and materialize private KEY files outside the repository.

| Key | Consumer |
| --- | --- |
| `PORT` | API listener |
| `HTTP_SECURITY_ALLOWED_ORIGINS` | API origin allowlist |
| `PRIMARY_DB_URL` | API primary database connection |
| `PRIMARY_DB_SCHEMA` | API primary database schema |
| `SUPABASE_URL` | API Auth and Storage integration |
| `SUPABASE_SERVICE_ROLE_KEY` | API Auth and Storage integration |
| `NEXT_PUBLIC_SITE_URL` | Front-end site URL |
| `NEXT_PUBLIC_GRAPHQL_URL` | Front-end GraphQL transport |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser Auth client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser Auth client public key |

Public front-end configuration is supplied at build time and stays outside sealed custody. Production database deployment consumes `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_ID` from its environment's sealed custody; the GitHub secret store carries only the age identity.
