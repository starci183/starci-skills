---
id: fe-layouts-proof-gift-shop
title: Golden case — Gift shop
description: Three complete Gate 1 candidates for a net-new StarCi gift shop.
---

# Gift shop

Raw prompt: `Tạo trang Shop Quà cho StarCi.`

```json
{
  "decisionId": "gift-shop",
  "artifactPath": ".workflows/starci-academy/fe/gift-shop/layouts/",
  "sourceContext": {
    "project": "starci-academy",
    "frontend": "C:/Repositories/starci-academy-fe",
    "contractRegistry": "C:/Repositories/starci-academy-fe/src/components/contracts/index.ts"
  },
  "candidates": [
    {
      "id": "01",
      "name": "Discovery first",
      "thesis": "Lead with redeemable gifts so learners can immediately understand the value of earned points.",
      "tradeoffs": ["Fast browsing, but the current balance is secondary."],
      "plan": {
        "business": {
          "rawPrompt": "Tạo trang Shop Quà cho StarCi.",
          "goal": "Let learners discover and redeem rewards using points earned through learning.",
          "actors": ["learner"],
          "outcomes": ["Find an eligible gift", "Understand its point cost", "Start redemption"],
          "constraints": ["Do not claim a gift component already exists"],
          "assumptions": ["Learners have a point balance"],
          "openQuestions": ["Are physical rewards supported at launch?"]
        },
        "main": {
          "id": "gift-shop-main",
          "status": "existing",
          "contractDecision": "reuse",
          "contract": "routed-page-main",
          "purpose": "Own the routed gift-shop reading surface below shared navigation.",
          "distribution": "One flexible vertical page surface; catalog is first and account context follows within the same reading column.",
          "responsive": "The surface remains one column; the repeated gift run reduces its own column count on narrow screens.",
          "cssStatus": "registry",
          "css": "flex min-w-0 grow flex-col",
          "blocks": [
            {
              "id": "gift-catalog",
              "title": "Gift catalog",
              "status": "new",
              "usage": "used-repeatedly",
              "contractDecision": "new-required",
              "contract": null,
              "businessPurpose": "Expose available rewards and whether the learner can redeem each one now.",
              "data": ["gift id", "title", "point cost", "availability", "eligibility"],
              "renderBrief": "Render a browsable repeated run of gifts with cost and eligibility visible before opening details.",
              "renderForm": "owned-item",
              "states": [
                { "name": "pending", "renders": "Stable gift placeholders preserving the run measure.", "source": "proposed" },
                { "name": "ready", "renders": "Available and unavailable gifts with point costs.", "source": "business-required" },
                { "name": "empty", "renders": "A shop-empty explanation without an invented offer.", "source": "proposed" }
              ],
              "placement": { "region": "page", "order": 0, "width": "full available measure", "alignment": "start", "responsive": "Repeated items collapse to fewer columns while preserving reading order." },
              "cssStatus": "proposed",
              "proposedCss": "grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3",
              "why": { "why": "The raw business request names a shop, so discovery must be explicit without inventing an existing component.", "anchorKind": "business-input", "anchor": "input.json#/raw" },
              "evidence": [
                { "source": "business-input", "path": "input.json#/raw", "finding": "The prompt explicitly requests a StarCi gift shop." },
                { "source": "contract-registry", "path": "src/components/contracts/index.ts", "finding": "No gift-shop contract was claimed as an existing match." }
              ],
              "brief": {
                "willRender": "A repeatable gift summary showing identity, cost, availability and current eligibility.",
                "interaction": "Open gift details or begin redemption from an eligible item.",
                "dataBoundary": "Catalog data and learner eligibility meet at the page-owned block boundary.",
                "visualHierarchy": "Gift identity first, point cost second, redemption availability third.",
                "gate2Questions": ["Which leaf owns the redeem action?", "Who owns catalog pending state?"]
              }
            }
          ],
          "why": { "why": "The live routed-page-main contract already owns the flexible routed reading surface required here.", "anchorKind": "contract-registry", "anchor": "src/components/contracts/index.ts#routed-page-main" },
          "evidence": [{ "source": "contract-registry", "path": "src/components/contracts/index.ts", "contractKey": "routed-page-main", "finding": "Registry classes are flex min-w-0 grow flex-col." }]
        },
        "extends": [
          {
            "id": "shop-navbar",
            "kind": "navbar",
            "status": "existing",
            "usage": "used",
            "contractDecision": "reuse",
            "contract": "double-navbar",
            "owner": "route-cluster layout",
            "mount": "Above the routed page as a sibling surface.",
            "trigger": "Mounted when entering the shop route cluster.",
            "persistence": "Persists while routes in the shop cluster change.",
            "relationshipToMain": "Navigation remains above and outside the main reading surface.",
            "businessPurpose": "Keep StarCi destinations and account tools reachable from the shop.",
            "renderBrief": "Render existing primary navigation; add no second row until a shop taxonomy is approved.",
            "states": [{ "name": "ready", "renders": "Existing brand, destination and account navigation.", "source": "contract-proven" }],
            "cssStatus": "registry",
            "css": "sticky top-0 z-50 w-full border-b border-separator bg-background",
            "why": { "why": "The existing sticky navigation contract frames routed StarCi destinations without belonging to page content.", "anchorKind": "contract-registry", "anchor": "src/components/contracts/index.ts#double-navbar" },
            "evidence": [{ "source": "contract-registry", "path": "src/components/contracts/index.ts", "contractKey": "double-navbar", "finding": "The registry defines the sticky two-row-capable navigation frame." }]
          }
        ]
      }
    },
    {
      "id": "02",
      "name": "Balance first",
      "thesis": "Lead with the learner wallet so every gift is interpreted against current purchasing power.",
      "tradeoffs": ["Improves affordability context, but delays broad discovery."],
      "plan": {
        "business": {
          "rawPrompt": "Tạo trang Shop Quà cho StarCi.",
          "goal": "Turn the learner point balance into an understandable path toward a reward.",
          "actors": ["learner"],
          "outcomes": ["See available balance", "Know what is affordable", "Choose a reward"],
          "constraints": ["Balance must not imply cash value"],
          "assumptions": ["A points ledger exists"],
          "openQuestions": ["Should expiring points be shown?"]
        },
        "main": {
          "id": "gift-wallet-main",
          "status": "existing",
          "contractDecision": "reuse",
          "contract": "routed-page-main",
          "purpose": "Own a balance-led reward journey inside the routed page surface.",
          "distribution": "One vertical page where wallet context precedes a filtered reward run and explains affordability.",
          "responsive": "Wallet and reward run stack at every width; reward items reduce columns on narrow screens.",
          "cssStatus": "registry",
          "css": "flex min-w-0 grow flex-col",
          "blocks": [
            {
              "id": "reward-wallet-and-affordable-gifts",
              "title": "Wallet and affordable gifts",
              "status": "new",
              "usage": "used",
              "contractDecision": "new-required",
              "contract": null,
              "businessPurpose": "Explain the learner balance and immediately connect it to affordable rewards.",
              "data": ["point balance", "optional expiry", "affordable gift summaries"],
              "renderBrief": "Render a prominent balance summary followed by rewards ordered around current affordability.",
              "renderForm": "block-of-blocks",
              "states": [
                { "name": "pending", "renders": "Stable balance and reward placeholders.", "source": "proposed" },
                { "name": "ready", "renders": "Balance plus affordable and aspirational rewards.", "source": "business-required" },
                { "name": "zero-balance", "renders": "A zero balance explanation and earning direction.", "source": "proposed" }
              ],
              "placement": { "region": "page", "order": 0, "width": "full available measure", "alignment": "start", "responsive": "Summary remains first and reward items flow into fewer columns." },
              "cssStatus": "proposed",
              "proposedCss": "flex w-full flex-col gap-8 px-6 py-8",
              "why": { "why": "A balance-led interpretation is a materially different product path from catalog-first discovery.", "anchorKind": "suy-luan-khong-co-neo" },
              "evidence": [{ "source": "business-input", "path": "input.json#/raw", "finding": "Redeeming gifts implies a spendable learning reward balance." }],
              "brief": {
                "willRender": "A point balance summary and an ordered set of affordable or aspirational reward summaries.",
                "interaction": "Filter toward affordable rewards and open a selected gift.",
                "dataBoundary": "Wallet and catalog remain separately loadable sources composed by the page.",
                "visualHierarchy": "Balance first, affordable rewards second, aspirational rewards last.",
                "gate2Questions": ["Are wallet and catalog separate connected blocks?", "How is zero balance phrased?"]
              }
            }
          ],
          "why": { "why": "The routed page still needs the existing flexible main owner even when business priority changes.", "anchorKind": "contract-registry", "anchor": "src/components/contracts/index.ts#routed-page-main" },
          "evidence": [{ "source": "contract-registry", "path": "src/components/contracts/index.ts", "contractKey": "routed-page-main", "finding": "The registry owns the flexible routed page surface." }]
        },
        "extends": []
      }
    },
    {
      "id": "03",
      "name": "Mission first",
      "thesis": "Lead with an earning mission so learners without enough points still receive a useful shop journey.",
      "tradeoffs": ["Creates motivation, but makes direct shopping less immediate."],
      "plan": {
        "business": {
          "rawPrompt": "Tạo trang Shop Quà cho StarCi.",
          "goal": "Connect learning progress to attainable rewards rather than showing an isolated catalog.",
          "actors": ["learner"],
          "outcomes": ["Choose a target gift", "Understand points still needed", "Return to a learning mission"],
          "constraints": ["Do not invent guaranteed point awards"],
          "assumptions": ["Learning actions can award points"],
          "openQuestions": ["Which activities are eligible to award points?"]
        },
        "main": {
          "id": "gift-mission-main",
          "status": "existing",
          "contractDecision": "reuse",
          "contract": "routed-page-main",
          "purpose": "Own a target-reward and earning-mission journey in one routed surface.",
          "distribution": "One vertical page where a chosen target and progress gap lead into relevant earning actions.",
          "responsive": "Target and mission content remain sequential and full width on narrow screens.",
          "cssStatus": "registry",
          "css": "flex min-w-0 grow flex-col",
          "blocks": [
            {
              "id": "reward-target-mission",
              "title": "Reward target mission",
              "status": "new",
              "usage": "conditional",
              "activationOrReason": "Used after the learner chooses a target gift or lacks sufficient points.",
              "contractDecision": "new-required",
              "contract": null,
              "businessPurpose": "Turn an unaffordable reward into a transparent, actionable learning target.",
              "data": ["target gift", "current balance", "points gap", "eligible learning actions"],
              "renderBrief": "Render the selected reward, remaining point gap and honest learning actions that may close it.",
              "renderForm": "figure-and-offer",
              "states": [
                { "name": "ready", "renders": "Target reward, gap and eligible missions.", "source": "business-required" },
                { "name": "no-target", "renders": "A prompt to choose a reward without a fabricated mission.", "source": "proposed" }
              ],
              "placement": { "region": "page", "order": 0, "width": "full available measure", "alignment": "start", "responsive": "Reward context precedes missions in a single narrow-screen flow." },
              "cssStatus": "proposed",
              "proposedCss": "mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8",
              "why": { "why": "This candidate serves learners who cannot redeem immediately instead of treating them as a dead end.", "anchorKind": "suy-luan-khong-co-neo" },
              "evidence": [{ "source": "business-input", "path": "input.json#/raw", "finding": "A reward shop creates both attainable and currently unattainable choices." }],
              "brief": {
                "willRender": "One target reward with a points gap and a bounded list of eligible learning missions.",
                "interaction": "Choose a reward target or return to one eligible learning action.",
                "dataBoundary": "Reward eligibility and learning missions must remain separately attributable.",
                "visualHierarchy": "Target identity first, points gap second, learning actions third.",
                "gate2Questions": ["Who persists the chosen target?", "Which action surface returns to learning?"]
              }
            }
          ],
          "why": { "why": "The existing routed owner is sufficient; only the new business block needs a proposed contract.", "anchorKind": "contract-registry", "anchor": "src/components/contracts/index.ts#routed-page-main" },
          "evidence": [{ "source": "contract-registry", "path": "src/components/contracts/index.ts", "contractKey": "routed-page-main", "finding": "The registry provides the needed routed main distribution." }]
        },
        "extends": []
      }
    }
  ],
  "recommendedCandidateId": "01",
  "recommendedReason": { "why": "Discovery-first best matches the unqualified shop prompt while leaving wallet and mission concepts for later decisions.", "anchorKind": "business-input", "anchor": "input.json#/raw" }
}
```
