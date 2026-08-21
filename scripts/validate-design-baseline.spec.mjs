import assert from "node:assert/strict";
import test from "node:test";
import {validateDesignBaseline} from "./validate-design-baseline.mjs";

const baseline = () => ({
  schemaVersion: 1,
  project: "starci-academy",
  scope: {kind: "page", routes: ["/course"]},
  references: [{id: "desktop-ready", kind: "legacy", route: "/course", state: "ready", viewport: {width: 1440, height: 900}}],
  owner: {
    id: "course-heading",
    directChildren: ["breadcrumb", "title", "description", "metadata"],
    annotation: {x: 100, y: 80, width: 900, height: 240},
    childBounds: {
      breadcrumb: {x: 120, y: 100, width: 400, height: 24}, title: {x: 120, y: 132, width: 600, height: 48},
      description: {x: 120, y: 188, width: 700, height: 40}, metadata: {x: 120, y: 236, width: 500, height: 24}
    }
  },
  invariant: {kind: "local", statement: "The highlighted heading run is one compact ordered parent."},
  proof: [{referenceId: "desktop-ready", fullViewport: true, targetRegion: true}],
  preserve: ["course-rail", "continuation-card"],
  allowedDeltas: ["course-heading"]
});

test("highlighted heading locks all enclosed direct children to one owner", () => assert.equal(validateDesignBaseline(baseline()).ok, true));

test("a wrapper containing only breadcrumb and title is rejected", () => {
  const value = baseline();
  value.owner.directChildren = ["breadcrumb", "title"];
  const verdict = validateDesignBaseline(value);
  assert.equal(verdict.ok, false);
  assert.match(verdict.failures.join("\n"), /description is absent|metadata is absent/);
});

test("computed target proof cannot replace full viewport parity", () => {
  const value = baseline();
  value.proof[0].fullViewport = false;
  assert.match(validateDesignBaseline(value).failures.join("\n"), /full-viewport/);
});
