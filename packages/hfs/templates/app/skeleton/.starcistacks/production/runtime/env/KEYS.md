# Production environment key roster

This inventory declares names, consumers and mounted file paths. Credential values are sealed only after owner provisioning; no sealed member or successful deployment is fabricated by scaffolding.

| Key | Consumer |
| --- | --- |
| `PORT` | Core API listener |
| `HTTP_SECURITY_ALLOWED_ORIGINS` | Core API origin allowlist |
| `PRIMARY_DB_URL` | Core API and CLI primary database connection; the API reads `PRIMARY_DB_URL_FILE` at `/run/secrets/primary-db-url` |
| `NEXT_PUBLIC_SITE_URL` | Product front-end site URL |
| `NEXT_PUBLIC_GRAPHQL_URL` | Product front-end GraphQL transport |
| `NEXT_PUBLIC_APP_URL` | Landing front-end product link |

Public front-end configuration is supplied at build time and stays outside sealed custody. Seal real private members under `.starcistacks/production/secrets/*.enc`, then add their member paths to the manifest. The versioned external database secret is `{{project}}-production-primary-db-url-v1`.
