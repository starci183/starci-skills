import assert from "node:assert/strict";
import {test} from "node:test";
import {join} from "node:path";
import {candidateModelPath, isCandidateOnlyDirtyStatus} from "./business-worktree-status.mjs";

const root = join("C:", "source", ".worktrees", "academy", "businesses");
const candidate = join(root, "features", "study-library", "model.json");

test("recognizes only feature model candidates inside the business root", () => {
  assert.equal(candidateModelPath(root, candidate), "features/study-library/model.json");
  assert.equal(candidateModelPath(root, join(root, "business-registry-v1.json")), undefined);
  assert.equal(candidateModelPath(root, join(root, "..", "candidate.json")), undefined);
});

test("allows one modified or untracked candidate model", () => {
  assert.equal(isCandidateOnlyDirtyStatus(" M features/study-library/model.json", root, candidate), true);
  assert.equal(isCandidateOnlyDirtyStatus("?? features/study-library/model.json", root, candidate), true);
});

test("rejects staged, deleted, renamed or additional dirty paths", () => {
  assert.equal(isCandidateOnlyDirtyStatus("M  features/study-library/model.json", root, candidate), false);
  assert.equal(isCandidateOnlyDirtyStatus(" D features/study-library/model.json", root, candidate), false);
  assert.equal(isCandidateOnlyDirtyStatus("R  old.json -> features/study-library/model.json", root, candidate), false);
  assert.equal(isCandidateOnlyDirtyStatus(" M features/study-library/model.json\n?? unrelated.txt", root, candidate), false);
});
