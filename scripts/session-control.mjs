export function transitionSession(state, event) {
  const next = structuredClone(state);
  if (event.type === "select") {
    if (!event.candidateId) throw new Error("candidate selection requires candidateId");
    next.selectedCandidate = event.candidateId;
    next.phase = "selected";
    return next;
  }
  if (event.type === "approve") {
    if (!next.selectedCandidate || next.boundaryDisplayed !== true) throw new Error("OK requires one selected candidate and displayed boundary");
    next.boundaryApproved = true;
    next.phase = "executing";
    return next;
  }
  if (event.type === "continue") {
    if (next.phase !== "executing") throw new Error("continue resumes execution only");
    return next;
  }
  if (event.type === "reject") {
    next.phase = "baseline-required";
    next.selectedCandidate = null;
    next.boundaryApproved = false;
    next.assumptionsValid = false;
    next.baselineVersion = (next.baselineVersion ?? 0) + 1;
    return next;
  }
  if (event.type === "complete") {
    if (next.phase !== "executing" || event.visualProofOk !== true) throw new Error("completion requires executing state and green visual proof");
    next.phase = "complete";
    return next;
  }
  throw new Error(`unknown session event ${event.type}`);
}
