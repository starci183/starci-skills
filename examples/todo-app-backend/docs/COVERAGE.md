# Selected application coverage

| Component | Role | Persistent | Secret input | Failure boundary | Proof in this kit |
| --- | --- | --- | --- | --- | --- |
| `gateway` | HTTP gateway | no | none | container/process on one Docker host | cold start and recreated connectivity |
| `app` | backend | `/var/lib/app/counter.json` in named volume | `/run/secrets/app_token` | container/process on one Docker host | authenticated mutation without argv/stdout secret |
| `app-data` | stateful storage | named Docker volume | none | local Docker volume on one host | stop, container removal, recreate, value retained |
| `prepare` | bootstrap | ciphertext plus caller-owned external age identity | generated synthetic token | local preparation command | repeatable decrypt; missing key refuses |

This manifest covers every component intentionally selected for the tiny sample. nginx and a custom Node service are sufficient for its one HTTP journey; a database, queue, cache, worker, object store, Kubernetes cluster and remote deployer are excluded because this sample does not need them. Their absence is not a recommendation for another application.

The verified journey is: prepare distinct environment custody → cold start → gateway health → authenticated counter mutation → stop/remove containers while retaining the named volume → recreate → observe the same counter → exact project/volume cleanup. Failure checks cover missing/wrong decryption keys and unauthenticated mutation. Ubuntu VPS operation, backup restore, TLS, upgrades and rollback remain checklist duties until independently exercised.
