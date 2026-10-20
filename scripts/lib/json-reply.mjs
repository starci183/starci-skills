// json-reply.mjs - the JSON a successful process reply printed: the parsed stdout of a reply with status 0, else null (a failed call or unparseable output).
// The GitHub reads of the release flows (release-ci-status.mjs, release-candidate.mjs) take their `gh` replies through it.

/** The parsed stdout of `reply` when it exited 0, else null. Never throws. */
export function jsonReply(reply) {
  try { return reply?.status === 0 ? JSON.parse(reply.stdout) : null; } catch { return null; }
}
