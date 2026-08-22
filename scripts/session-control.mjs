const hash = /^[a-f0-9]{64}$/;

export const isApprovalToken = (value) => typeof value === "string" && value.trim().toLowerCase() === "ok";

export function transitionSession(state, event) {
  const next = structuredClone(state);
  if (event.type === "select") {
    if (!event.candidateId) throw new Error("candidate selection requires candidateId");
    const review = event.review ?? (next.phase === "page-review" ? "pages" : next.phase === "state-review" ? "states" : "source");
    if (!['pages', 'states', 'source'].includes(review)) throw new Error(`unknown review kind ${review}`);
    if (review === "pages" && next.phase !== "page-review") throw new Error("page selection requires page-review phase");
    if (review === "states" && next.phase !== "state-review") throw new Error("state selection requires state-review phase");
    next.selectedCandidate = event.candidateId;
    next.selectedReview = review;
    next.phase = review === "pages" ? "page-selected" : review === "states" ? "state-selected" : "selected";
    return next;
  }
  if (event.type === "open-state-review") {
    if (next.phase !== "state-expansion" || next.pageApproved !== true) throw new Error("state review requires an approved page contract");
    if (event.pageContractAt !== next.pageContractAt) throw new Error("state review must bind the approved page contract");
    next.phase = "state-review";
    next.selectedCandidate = null;
    next.selectedReview = null;
    next.boundaryDisplayed = event.boundaryDisplayed === true;
    return next;
  }
  if (event.type === "approve") {
    if (!isApprovalToken(event.token)) throw new Error("approval requires a whole-message OK token, case-insensitive");
    if (event.approvalKind === "pages") {
      if (next.phase !== "page-selected" || next.selectedReview !== "pages" || next.boundaryDisplayed !== true) {
        throw new Error("page OK requires one selected page candidate and displayed cache-only boundary");
      }
      if (!hash.test(event.pageContractAt ?? "")) throw new Error("page OK requires the selected page contract hash");
      next.pageApproved = true;
      next.pageContractAt = event.pageContractAt;
      next.boundaryApproved = false;
      next.sourceAuthorized = false;
      next.selectedCandidate = null;
      next.selectedReview = null;
      next.phase = "state-expansion";
      return next;
    }
    if (!next.selectedCandidate || next.boundaryDisplayed !== true) throw new Error("OK requires one selected candidate and displayed boundary");
    if (next.pageApproved === true) {
      if (next.phase !== "state-selected" || next.selectedReview !== "states") throw new Error("source OK requires the reviewed state expansion");
      if (event.pageContractAt !== next.pageContractAt) throw new Error("source OK must bind the approved page contract");
    }
    next.boundaryApproved = true;
    next.sourceAuthorized = true;
    next.phase = "executing";
    return next;
  }
  if (event.type === "advance-step") {
    if (!isApprovalToken(event.token)) throw new Error("next step requires a whole-message OK token, case-insensitive");
    if (next.stepTableDisplayed !== true || !Array.isArray(next.steps) || next.steps.length === 0) {
      throw new Error("next step requires a displayed skill-step table");
    }
    const currentIndex = next.activeStepIndex ?? 0;
    const current = next.steps[currentIndex];
    const upcoming = next.steps[currentIndex + 1];
    if (!current || current.status !== "completed") throw new Error("current skill step must complete before advancing");
    if (!upcoming) throw new Error("skill has no next step");
    if (upcoming.status !== "waiting-for-ok") throw new Error("next skill step must be waiting for OK");
    upcoming.status = "in-progress";
    next.activeStepIndex = currentIndex + 1;
    return next;
  }
  if (event.type === "continue") {
    if (next.phase !== "executing") throw new Error("continue resumes execution only");
    return next;
  }
  if (event.type === "reject") {
    if (event.scope === "states" && next.pageApproved === true) {
      next.phase = "state-expansion";
      next.selectedCandidate = null;
      next.selectedReview = null;
      next.boundaryApproved = false;
      next.sourceAuthorized = false;
      next.stateAssumptionsValid = false;
      return next;
    }
    next.phase = "baseline-required";
    next.selectedCandidate = null;
    next.selectedReview = null;
    next.boundaryApproved = false;
    next.sourceAuthorized = false;
    next.pageApproved = false;
    next.pageContractAt = null;
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
