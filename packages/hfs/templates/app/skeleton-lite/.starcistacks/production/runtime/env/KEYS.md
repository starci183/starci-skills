# Production environment key roster

This inventory declares names, consumers and mounted file paths. Scaffolding generates the two declared encrypted members with placeholder values encrypted to this app's own age recipient. Replace their values through `starci app secret set production` after owner provisioning and before creating external secrets. The runtime template tracks no ciphertext; its specs generate members with ephemeral identities in disposable copies. Scaffolding supplies no deployment credential or successful deployment.

| Key | Consumer |
| --- | --- |
| `PORT` | API listener |
| `HTTP_SECURITY_ALLOWED_ORIGINS` | API origin allowlist |
| `PRIMARY_DB_URL` | API least-privilege database connection; reads `PRIMARY_DB_URL_FILE` at `/run/secrets/primary-db-url` |
| `PRIMARY_DB_SCHEMA` | API primary database schema |
| `SUPABASE_URL` | API Auth and Storage integration |
| `SUPABASE_SERVICE_ROLE_KEY` | API Auth and Storage integration; reads `SUPABASE_SERVICE_ROLE_KEY_FILE` at `/run/secrets/supabase-service-role-key` |
| `NEXT_PUBLIC_SITE_URL` | Front-end site URL |
| `NEXT_PUBLIC_GRAPHQL_URL` | Front-end GraphQL transport |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser Auth client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser Auth client public key |
| `SUPABASE_ACCESS_TOKEN` | Production database deployment |
| `SUPABASE_DB_PASSWORD` | Production database deployment |
| `SUPABASE_PROJECT_ID` | Production database deployment |

Public front-end configuration is supplied at build time and stays outside sealed custody. Set real values in `.starcistacks/production/secrets/primary-db-url.enc` and `.starcistacks/production/secrets/supabase-service-role-key.enc` at the declared paths. Versioned external application secrets are `{{project}}-production-primary-db-url-v1` and `{{project}}-production-supabase-service-role-key-v1`. Seal deployment-only credentials separately under `.starcistacks/production/secrets/*.enc`; they never enter an API container.
