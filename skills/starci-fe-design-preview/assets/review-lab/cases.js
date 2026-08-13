window.STARCI_REVIEW = {
  title: "Replace this sample with the current design task",
  phase: "preview",
  deliveryMode: "single",
  mode: "creative",
  workItems: [{ id: "page-example", scope: "page", target: "Replace with the real target" }],
  evidence: [{ source: "sample", claim: "This manifest is a template, not product evidence." }],
  cases: [{
    id: "case-a",
    title: "Case A",
    thesis: "Replace with one materially distinct design thesis.",
    distinction: "State the product decision that makes this case different.",
    states: [{
      id: "default",
      label: "Default",
      covers: ["page-example:populated"],
      candidateUrl: "candidate/index.html",
      proofUrl: "candidate/.well-known/starci-preview-default.json",
      runtimeProof: {
        candidateDigest: "replace-with-verified-candidate-digest",
        stateId: "page-example-populated",
        fixtureSha256: "replace-with-fixture-hash",
        runtimeFingerprint: "replace-with-runtime-fingerprint"
      }
    }],
    stateCoverage: [{
      ownerId: "page-example",
      state: "populated",
      coverage: "rendered",
      scenarioId: "default",
      evidence: "Replace with source evidence."
    }],
    blockTree: "Page\n└── Block",
    candidateFiles: [{ path: "candidate/src/Page.tsx", targetPath: "src/components/pages/Page/component.tsx", sha256: "seal this in the design record" }],
    contracts: [{ key: "example-contract", why: "Replace with the proven relationship." }],
    proposals: [],
    backendEnablers: [],
    assumptions: [],
    unknowns: ["Replace all sample content before review."]
  }]
};
