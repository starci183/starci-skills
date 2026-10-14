# Development recovery record

Status: pending owner execution. No backup or restore has been run by scaffolding.

The development operator owns recovery of the managed Supabase database and both external ingress volumes, `{{project}}-dev-ingress-data` and `{{project}}-dev-ingress-config-data`. Retain seven daily encrypted off-host exports or snapshots for each target.

Before relying on the backup policy, restore a database export and both volume snapshots into isolated infrastructure. Record the actual off-host destination, encryption custody, backup artifact digests, restoration time and operator. Verify database connectivity and the API readiness endpoint, then verify the restored ingress configuration and state. Attach the dated result here without credentials.
