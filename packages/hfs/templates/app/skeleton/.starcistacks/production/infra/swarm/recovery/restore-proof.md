# Production recovery record

Status: pending owner execution. No backup or restore has been run by scaffolding.

The production operator owns recovery of the external PostgreSQL database and both external ingress volumes, `{{project}}-production-ingress-data` and `{{project}}-production-ingress-config-data`. Provision provider recovery and thirty daily encrypted off-host database exports. Retain thirty daily encrypted off-host snapshots for both ingress volumes.

Before relying on the backup policy, restore a database backup and both volume snapshots into isolated infrastructure. Record the actual off-host destination, retention, encryption custody, backup artifact digests, restoration time and operator. Verify database connectivity and the API readiness endpoint, then verify the restored TLS and ingress configuration. Attach the dated result here without credentials.
