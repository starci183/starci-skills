---
name: starci-data-restore
description: Puts an encrypted snapshot from `.dat/<stack>/` back into a project's datastores — postgres, redis, minio, nats, qdrant and whatever else the stack mounts — decrypting with the machine's shared age identity and replacing the live volumes with what the archive holds. Reach for it whenever data has to come back: "restore the database", "khôi phục dữ liệu", "phục hồi backup", "roll back, I wiped it", "put yesterday's data back", "bring prod data onto my machine", "reset my local db to the snapshot", "undo the migration, restore the dump", "lấy lại dữ liệu cũ". Use it also to VERIFY a backup — restoring into a throwaway stack is the only thing that proves a snapshot is real, and an untested backup is a belief, not a safeguard. Not for taking a snapshot (that is `starci-data-backup`), not for migrating a schema forward, and not for importing one table, which is a query rather than a restore.
---

# Restoring a stack's data

Restore is the destructive half. Backup, done wrong, wastes disk; restore, done wrong, destroys the
data someone was still using — and it usually runs at the worst moment, when something has already
gone wrong and everyone is in a hurry.

Everything below exists to slow that moment down by exactly the right amount.

## Say what will be destroyed, before doing it

A restore replaces the contents of every volume it touches. State that in the open, and state it in
terms of what is being lost, not what is being gained: not "restoring 6 volumes" but "this replaces
the contents of postgres, redis, minio, nats, qdrant, keycloak".

If the target stack is anything other than a local dev one, confirm with the person first. A local
volume can be rebuilt from a seed; a remote one usually cannot.

Where the current data might still matter, take a snapshot of it first
(`starci-data-backup`). A restore that overwrote something irreplaceable, when a snapshot would
have cost twenty seconds, is the avoidable version of this failure.

## Stop the stack first

Never write into a volume a container is reading. A datastore that has files replaced underneath it
holds stale pages in memory, writes them back over the restored ones, and ends up in a state that
matches neither the backup nor the original.

Stop the containers, restore, start again. Restart in a `finally`, so a failure part-way leaves the
stack running rather than down and undiagnosed.

## Replace, do not merge

Unpacking an archive over an existing volume leaves whatever the archive does not mention. The
result is a mixture of two points in time — the worst possible outcome, because it looks like it
worked. Clear the volume, then unpack, so the volume ends up holding exactly what the snapshot
holds and nothing else.

Take care that "clear" reaches dotfiles: postgres and keycloak both keep state in them, and a glob
that misses hidden entries produces exactly the half-restored state described above.

## Decrypt to a temporary directory, never into the repo

Decrypt into a temporary directory outside the working tree, unpack there, restore from there, and
delete it in a `finally`. Plaintext database contents must never exist inside the repo, not even
for the seconds between decrypting and unpacking — that is long enough for an editor auto-save or a
`git add -A` to capture it.

Decryption needs the shared age identity:

```
Windows  %USERPROFILE%\.starci\master.identity
POSIX    ~/.starci/master.identity
```

If decryption fails, the honest diagnosis is usually one of two things, and the message should name
both: the archive was encrypted for a different identity, or it was corrupted in transit — commonly
by a git checkout rewriting line endings in a binary file. `*.enc -text` in `.gitattributes`
prevents the second; without it, an archive that committed cleanly comes back unusable on another
machine.

## Prove it worked

A restore that printed "ok" is not evidence. Before declaring success, check that each datastore
actually came back: the containers are healthy again, and at least one is queried for something the
snapshot is known to contain — a row count, a bucket listing, a key count.

Report per volume, and report the check. "6 volumes restored, postgres healthy, 412 rows in
`users`" is a result. "Restore complete" is a hope.

## Verifying a backup is the same operation

Restoring into a throwaway stack is the only way to know a snapshot is real. Treat "test the backup"
as a first-class use of this skill rather than an afterthought: restore into a scratch project,
confirm the datastores come up healthy, tear it down.

A backup nobody has ever restored is not a backup. It is an untested assumption with a filename.

## Never print the data

Row counts, key counts, bucket names, sizes, health. Never contents, never credentials, never the
identity file.
