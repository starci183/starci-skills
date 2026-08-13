(() => {
  "use strict";
  const model = window.STARCI_REVIEW;
  const root = document.querySelector("#review-root");
  if (!model || !Array.isArray(model.cases) || model.cases.length === 0) {
    root.textContent = "No review cases were supplied.";
    return;
  }

  const tabs = document.querySelector("#case-tabs");
  const phase = model.phase;
  if (phase !== "plan" && phase !== "preview") {
    root.textContent = "Review manifest must declare phase plan or preview.";
    return;
  }
  document.querySelector("#review-title").textContent = model.title;
  document.querySelector("#review-status").textContent = phase === "plan"
    ? "DIRECTIONAL - NOT AN APPLY BASELINE"
    : "EXECUTABLE CANDIDATE - SEALED STATE EVIDENCE REQUIRED";
  document.querySelector("#review-meta").textContent =
    `${model.deliveryMode || "single"} · ${model.mode} · ${model.cases.length} cases`;
  let caseIndex = 0;
  let stateIndex = 0;

  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const panel = (heading, content) => {
    const section = node("section", "evidence-panel");
    section.append(node("h3", "", heading), content);
    return section;
  };
  const cards = (items, renderItem, emptyText) => {
    const list = node("div", "card-list");
    items.forEach((item) => list.append(renderItem(item)));
    if (!list.childElementCount) list.append(node("p", "quiet", emptyText));
    return list;
  };
  const textList = (items, emptyText) => {
    const list = node("ul", "plain-list");
    (items.length ? items : [emptyText]).forEach((item) => list.append(node("li", "", item)));
    return list;
  };

  const render = () => {
    const design = model.cases[caseIndex];
    const states = design.states || [];
    const state = states[stateIndex] || { label: "Missing", html: "", covers: [] };
    tabs.querySelectorAll("button").forEach((button, index) =>
      button.setAttribute("aria-selected", String(index === caseIndex)));
    root.replaceChildren();

    const intro = node("section", "case-intro");
    intro.append(node("p", "eyebrow", design.id), node("h2", "", design.title));
    intro.append(node("p", "thesis", design.thesis), node("p", "distinction", design.distinction));

    const stateBar = node("div", "state-tabs");
    states.forEach((item, index) => {
      const button = node("button", "state-button", item.label);
      button.type = "button";
      button.setAttribute("aria-pressed", String(index === stateIndex));
      button.addEventListener("click", () => { stateIndex = index; render(); });
      stateBar.append(button);
    });

    const canvas = node("section", "canvas-panel");
    const viewport = node("div", `case-canvas${phase === "preview" ? " case-canvas--executable" : ""}`);
    if (phase === "preview") {
      if (design.css) {
        viewport.append(node("p", "quiet", "Rejected: Preview cannot inject case CSS into review chrome."));
      } else if (!state.candidateUrl || !state.proofUrl || !state.runtimeProof) {
        viewport.append(node("p", "quiet", "Missing executable URL or runtime proof. Preview cannot render an HTML facsimile."));
      } else {
        const proofStatus = node("p", "quiet", "Verifying candidate runtime provenance...");
        viewport.append(proofStatus);
        fetch(state.proofUrl, { cache: "no-store" })
          .then((response) => {
            if (!response.ok) throw new Error(`proof request returned ${response.status}`);
            return response.json();
          })
          .then((actualProof) => {
            const expectedProof = state.runtimeProof;
            const mismatched = ["candidateDigest", "stateId", "fixtureSha256", "runtimeFingerprint"]
              .find((key) => actualProof[key] !== expectedProof[key]);
            if (mismatched) throw new Error(`runtime proof mismatch: ${mismatched}`);
            const frame = node("iframe", "candidate-frame");
            frame.src = state.candidateUrl;
            frame.title = `${design.title} - ${state.label}`;
            frame.dataset.stateId = state.stateId || state.id;
            frame.setAttribute("sandbox", "allow-forms allow-modals allow-popups allow-scripts");
            viewport.replaceChildren(frame);
          })
          .catch((error) => {
            proofStatus.textContent = `Candidate blocked: ${error.message}`;
          });
      }
    } else {
      viewport.innerHTML = state.html || "";
    }
    if (phase === "plan") {
      const style = document.createElement("style");
      style.textContent = design.css || "";
      canvas.append(style);
    }
    canvas.append(stateBar, viewport,
      node("p", "quiet", `Covers: ${(state.covers || []).join(", ") || "Not supplied"}`));

    const evidence = node("div", "evidence-grid");
    evidence.append(panel("Block tree", node("pre", "tree", design.blockTree || "Not supplied")));
    evidence.append(panel("Contracts", cards(design.contracts || [], (contract) => {
      const card = node("article", "mini-card");
      card.append(node("strong", "", contract.key), node("p", "", contract.why));
      return card;
    }, "No contract supplied.")));
    evidence.append(panel("State coverage", cards(design.stateCoverage || [], (entry) => {
      const card = node("article", "mini-card");
      card.append(node("strong", "", `${entry.ownerId} · ${entry.state}`));
      card.append(node("p", "", `${entry.coverage}${entry.scenarioId ? ` · ${entry.scenarioId}` : ""}`));
      card.append(node("p", "quiet", entry.evidence || "No evidence supplied."));
      return card;
    }, "No state coverage supplied.")));
    evidence.append(panel("Proposal shelf", cards(design.proposals || [], (proposal) => {
      const card = node("article", "proposal-card");
      card.append(node("strong", "", `${proposal.decision || "new"} · ${proposal.tier}: ${proposal.name}`));
      card.append(node("pre", "", JSON.stringify(proposal, null, 2)));
      return card;
    }, "No vocabulary or public API change proposed.")));
    evidence.append(panel("Backend enablers", cards(design.backendEnablers || [], (proposal) => {
      const card = node("article", "proposal-card");
      card.append(node("strong", "", `${proposal.classification} · ${proposal.operationKind}: ${proposal.id}`));
      card.append(node("pre", "", JSON.stringify(proposal, null, 2)));
      return card;
    }, "No backend enabler proposed.")));

    const claims = node("div", "two-column");
    claims.append(panel("Assumptions", textList(design.assumptions || [], "None recorded.")));
    claims.append(panel("Unknowns", textList(design.unknowns || [], "None recorded.")));

    const source = node("section", "source-panel");
    if (phase === "preview") {
      source.append(node("h3", "", `Executable source map - ${state.label}`));
      source.append(node("pre", "source-code", JSON.stringify(design.candidateFiles || [], null, 2)));
      source.append(node("p", "quiet", "The canvas above loads the candidate runtime. This panel identifies the same candidate files; it does not maintain a second HTML/CSS implementation."));
    } else {
      source.append(node("h3", "", `Directional HTML - ${state.label}`), node("pre", "source-code", state.html || ""));
      source.append(node("h3", "", "Directional CSS"), node("pre", "source-code", design.css || ""));
    }
    root.append(intro, canvas, evidence, claims, source);
  };

  model.cases.forEach((design, index) => {
    const button = node("button", "case-button", `${design.id} · ${design.title}`);
    button.type = "button";
    button.setAttribute("role", "tab");
    button.addEventListener("click", () => { caseIndex = index; stateIndex = 0; render(); });
    tabs.append(button);
  });
  render();
})();
