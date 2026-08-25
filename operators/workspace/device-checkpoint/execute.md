# Execute workspace/device-checkpoint

## Step 1 — Validate the closed checkpoint boundary

**Read:** validate the exact route receipt, explicit external-mutation approval, touched-checkout refs, portable `.workspaces/device-state.json` ref and Source head from `payload.provided` and its exact bindings in `payload.loads.artifacts`.

**Context:** use only Git identity/status headers, contract hashes, Docker volume names and opaque credential handles. Do not load product bodies, service records, archive bytes, raw credentials or master-identity contents.

**Session write:** record a frozen checkpoint fingerprint containing the project/role route, touched checkout heads, contract hash and approval ref.

**Stop:** block on missing or stale approval, route mismatch, an undeclared checkout, absolute-path authority, plaintext secret material, or a changed fingerprint.

## Step 2 — Publish mission-owned Git heads

**Read:** inspect only the closed checkout set for root, origin, branch, upstream, porcelain status and ahead/behind counts.

**Context:** a clean checkout at remote parity is accepted; a clean ahead-only checkout may push its existing approved commits. Never infer ownership of dirty files and never create a commit from mixed or unrelated changes.

**Session write:** record sanitized before/after heads and upstream parity receipts.

**Stop:** block before data capture when any checkout is dirty, behind, diverged, detached, has no declared upstream, or needs a force push.

## Step 3 — Create the quiesced encrypted local-state backup

**Read:** run the Source-owned `checkpoint:data:push` command declared by the exact manifest. It must enumerate only the contract volumes and resolve the master identity and token through opaque local paths.

**Context:** stop every running container attached to a declared volume, stream `tar+gzip` bytes directly through age encryption, split ciphertext below the remote asset limit, checksum every chunk and restart the exact stopped containers in a `finally` boundary.

**Session write:** retain only command status, generation, volume count, checksums and sanitized restart evidence. Encrypted files live under ignored `.workspace/device-state`; no plaintext archive exists.

**Stop:** block and restart containers on any missing volume/tool, archive failure, encryption failure, size/checksum drift or restart failure. Never continue to publication with a partial generation.

## Step 4 — Publish and prove the private release

**Read:** verify the remote is the contract's private repository, upload to a draft generation, publish only after every chunk and manifest succeeds, then read the published release and manifest metadata back through the authenticated API.

**Context:** compare contract ID/hash, Source head, generation, volume set, chunk names, byte counts and checksums. Restore is a separate explicit operation and never occurs during stop-time publication.

**Session write:** emit one checkpoint receipt and immutable private release ref; purge upload observations and scratch refs at the parent terminal.

**Stop:** keep an incomplete upload draft and emit `blocked`; never label a draft, missing chunk, incompatible manifest or unverified release as published.

**Orchestration:** the coordinator owns the closed checkout join, runs Git pushes serially, runs volume capture serially while the stack is quiesced, owns the remote manifest join, validates output and purges every session intermediate at the parent terminal.
