# Output

Only a canonical `PASS` may return `complete`. `canonicalResultRef` and
`canonicalResultFingerprint` identify the exact existing validated backend-owned `result.json`; the
reference must also appear in `artifactRefs`, its feature/flow must match its path, and its stored
outcome must match the public verdict. The public validator reads and hashes that exact file; a
well-shaped nonexistent ref or caller-supplied fingerprint is not authority. Fresh FE-owned counterevidence returns one typed
`starci-fe-process` handoff at `reapply`; ordinary `FAIL` and `BLOCKED` stop without frontend
continuation. Source and evidence fingerprints preserve the exact gate identity.
