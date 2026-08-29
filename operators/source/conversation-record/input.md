# `source/conversation-record` input

The operator accepts only `context + input`.

- `context.policy`: active redaction policy, scanner version, and evidence.
- `context.writeAuthority`: exact project and role write authority.
- `context.currentHead`: current durable head for the identity, or null.
- `input.identity`: one provider, conversation id, project, and role tuple.
- `input.snapshot`: an already-redacted snapshot reference and hash.
- `input.redactionReceipt`: policy, input hash, output hash, scanner, and prohibited-category proof.
- `input.artifactRefs`: bounded immutable artifact links.
- `input.sourceRevision`: exact source revision associated with the snapshot.

Raw transcript text, prompts, secrets, workflow routing, and session lifecycle are outside this contract.
