# Environment key roster

This roster declares names only. The two tracked .enc members are nondeployable structural SOPS examples with invalid ciphertext stand-ins. Replace their entire envelopes with real sealed members before materializing anything. Store credential values in sealed custody and materialize private KEY files outside the repository.

| Key | Consumer |
| --- | --- |
| `PORT` | API listener |
| `HTTP_SECURITY_ALLOWED_ORIGINS` | API origin allowlist |
| `PRIMARY_DB_URL` | API primary database connection; `.starcistacks/dev/secrets/primary-db-url.enc` maps to external `{{project}}-dev-primary-db-url-v1` and mounted `/run/secrets/primary-db-url` |
| `PRIMARY_DB_SCHEMA` | API primary database schema |
| `SUPABASE_URL` | API Auth and Storage integration |
| `SUPABASE_SERVICE_ROLE_KEY` | API Auth and Storage integration; `.starcistacks/dev/secrets/supabase-service-role-key.enc` maps to external `{{project}}-dev-supabase-service-role-key-v1` and mounted `/run/secrets/supabase-service-role-key` |
| `NEXT_PUBLIC_SITE_URL` | Front-end site URL |
| `NEXT_PUBLIC_GRAPHQL_URL` | Front-end GraphQL transport |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser Auth client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser Auth client public key |

Public front-end configuration is supplied at build time and stays outside sealed custody. Production database deployment consumes `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_ID` from its environment's sealed custody; the GitHub secret store carries only the age identity.
