---
name: starci-data-backup
description: Takes an encrypted snapshot of every datastore a project's local or remote stack is running — postgres, redis, minio, nats, qdrant, elasticsearch, whatever else is mounted — into one archive under `.dat/<stack>/`, encrypted with the machine's shared age identity so the only artefact that can reach git is ciphertext. Reach for it whenever data needs to be captured before it can be lost: "back up the database", "snapshot the stack before I wipe it", "sao lưu dữ liệu", "backup trước khi migrate", "tôi sắp chạy migration, giữ lại dữ liệu đã", "dump everything", "save the current state", "capture prod data", "chụp lại dữ liệu hiện tại". Use it also BEFORE any destructive operation — a schema migration, a `compose down -v`, a reseed, a restore — because that is the moment a snapshot is worth taking and the moment it is most often skipped. Not for restoring one (that is `starci-data-restore`), not for exporting a single table or a report (that is a query, not a snapshot), and not for source code, which git already versions.
---

# Backing up a stack's data

A snapshot is only worth what it can restore. The failure everyone meets once is a backup that
existed, was never tested, and turned out to be a torn copy of a database that had been writing
while it was read. It restores into a datastore that refuses to start, and the discovery happens
on the day the original is already gone.

So this skill has two obligations, and they matter in this order: capture **consistently**, and
capture **everything**. Speed is not on the list.

## Find the datastores; do not list them

The temptation is to write one branch per service — `pg_dump` for postgres, `--rdb` for redis, `mc
mirror` for minio. Every such list is correct on the day it is written and silently wrong the day
someone adds a service. The snapshot keeps succeeding, and the new datastore is simply not in it.

Ask the container runtime instead. Docker stamps every volume it creates for a compose project
with a label naming that project, so the set of volumes IS the set of datastores:

```sh
docker volume ls --filter label=com.docker.compose.project=<project> --format '{{.Name}}'
```

A datastore added next month appears in that list without anyone editing anything. That property
is the whole reason to prefer it — not the brevity.

If a project does not use compose, find the equivalent enumeration for its runtime. Do not fall
back to a hand-written list; fall back to asking.

## Stop the stack, or say plainly that you did not

Copying a running datastore's files gives a snapshot torn across an in-flight write. Postgres is
the usual casualty: the copy restores, the server starts, and it refuses to come up because the
WAL disagrees with the heap.

Stop the containers for the duration by default. It costs seconds on a dev box, and it is the
difference between a backup and a file that resembles one. Offer a `--hot` escape for the case
where downtime genuinely is not acceptable, but when it is used, **print a warning that names the
risk** — not a generic "may be inconsistent", but which datastore is likely to be the casualty.

Restart whatever was stopped in a `finally`, so an error mid-backup does not leave the stack down.

## Encrypt before it lands, never after

Write the encrypted artefact directly to its destination. Do not write plaintext into the repo and
encrypt it in a second step: between those two steps the entire contents of the database sit
readable in the working tree, and any crash, any `git add -A`, any editor auto-save in that window
puts it somewhere it cannot be recalled from.

Stage the plaintext in a temporary directory outside the repo, encrypt from there, and delete it in
a `finally`. The repo only ever sees ciphertext.

Encryption uses the machine's shared age identity — one key covering every project of this owner:

```
Windows  %USERPROFILE%\.starci\master.identity
POSIX    ~/.starci/master.identity
```

If it is missing, stop and say so. Never fall back to writing an unencrypted archive; a backup that
quietly downgraded its own protection is worse than none, because it is trusted.

## Layout

```
.dat/
├── dev/   data.tar.gz.enc
└── vps/   data.tar.gz.enc
```

One stack per folder, one archive per stack, a fixed name. A fixed name is deliberate: timestamped
files accumulate until someone deletes the wrong one, and each is a multi-megabyte binary blob that
git cannot delta-compress. See the cost warning below.

`.gitignore` must admit the ciphertext and refuse everything else:

```
.dat/**
!.dat/**/
!.dat/**/.gitkeep
!.dat/**/*.enc
```

Verify the rules rather than trusting them — `git check-ignore -v <path>` on both a plaintext
archive and an encrypted one. A negation that silently fails is how a database dump enters a
history, and rewriting history is the only way back out.

## Warn about what this costs

Committing snapshots puts binary blobs in git forever. Every backup adds its full size to the
repository, because encrypted data does not delta-compress — two snapshots of a database that
changed by one row are two completely different files.

Say this out loud the first time a project starts committing snapshots, and offer the alternative:
keep `.dat/` local and push the artefact to object storage instead, with only the manifest in git.
Do not decide it silently in either direction — the person who owns the repo should choose knowing
the repo will grow by the size of their database on every snapshot.

## Report what was captured

End with the volumes captured by name, the archive size, and the exact command that restores it.
A snapshot nobody knows how to restore is a snapshot nobody will restore.

Never print the contents of a datastore, a connection string, or the identity path's contents.
Names, sizes, counts.
