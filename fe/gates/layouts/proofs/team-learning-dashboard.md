---
id: fe-layouts-proof-team-learning-dashboard
title: Golden case — Team learning dashboard
description: Three complete Gate 1 candidates for a net-new team learning dashboard.
---

# Team learning dashboard

Raw prompt: `Tạo dashboard học tập cho team trên StarCi.`

```json
{
  "decisionId": "team-learning-dashboard",
  "artifactPath": ".workflows/starci-academy/fe/team-learning-dashboard/layouts/",
  "sourceContext": { "project": "starci-academy", "frontend": "C:/Repositories/starci-academy-fe", "contractRegistry": "C:/Repositories/starci-academy-fe/src/components/contracts/index.ts" },
  "candidates": [
    {
      "id": "01",
      "name": "Risk first",
      "thesis": "Lead with blocked and falling-behind learners so a team lead can intervene before reading healthy progress.",
      "tradeoffs": ["Optimizes intervention, but can make a healthy team feel problem-led."],
      "plan": {
        "business": { "rawPrompt": "Tạo dashboard học tập cho team trên StarCi.", "goal": "Help a team lead identify learning risk and decide where intervention is needed.", "actors": ["team lead", "team learner"], "outcomes": ["Identify risk", "Understand its cause", "Choose a follow-up action"], "constraints": ["Member-level data must respect team permissions"], "assumptions": ["Team membership and learning progress exist"], "openQuestions": ["Which roles may see individual learner data?"] },
        "main": {
          "id": "team-risk-main", "status": "modify", "contractDecision": "extend", "contract": "dashboard-main",
          "purpose": "Extend the existing dashboard reading column for team-level intervention decisions.",
          "distribution": "A flexible vertical main column leads with risk summaries, then evidence and healthy progress context.",
          "responsive": "Risk summaries remain first and all evidence stacks into a single narrow-screen column.",
          "cssStatus": "proposed", "proposedCss": "flex min-w-0 grow flex-col gap-6",
          "blocks": [{
            "id": "team-learning-risk", "title": "Team learning risk", "status": "new", "usage": "used-repeatedly", "contractDecision": "new-required", "contract": null,
            "businessPurpose": "Surface permission-safe evidence of who may need learning support and why.",
            "data": ["team membership", "viewer role", "learner progress", "stalled activity", "risk rule"],
            "renderBrief": "Render a prioritized run of risk summaries with cause evidence and a bounded follow-up intent.",
            "renderForm": "evidence-tile",
            "states": [{ "name": "pending", "renders": "Stable risk-summary placeholders without inferred risk.", "source": "proposed" }, { "name": "ready", "renders": "Permission-safe learner risks and supporting evidence.", "source": "business-required" }, { "name": "no-risk", "renders": "A healthy-team summary without empty warning cards.", "source": "proposed" }, { "name": "forbidden", "renders": "Permission explanation with no member-level data.", "source": "business-required" }],
            "placement": { "region": "main", "order": 0, "width": "full flexible column", "alignment": "start", "responsive": "Risk items stack and preserve priority order on narrow screens." },
            "cssStatus": "proposed", "proposedCss": "flex w-full flex-col gap-4",
            "why": { "why": "A team dashboard needs a team decision axis; individual dashboard contracts alone do not prove that block exists.", "anchorKind": "business-input", "anchor": "input.json#/raw" },
            "evidence": [{ "source": "contract-registry", "path": "src/components/contracts/index.ts", "contractKey": "dashboard-main", "finding": "The registry provides a flexible dashboard column but no claimed team-risk block." }],
            "brief": { "willRender": "Prioritized team-member risk summaries with supporting learning evidence and allowed follow-up intent.", "interaction": "Inspect a risk reason and initiate an authorized follow-up.", "dataBoundary": "Viewer role must constrain member-level progress before rendering.", "visualHierarchy": "Risk severity first, cause evidence second, follow-up action third.", "gate2Questions": ["Who computes risk?", "Which action is allowed for each viewer role?"] }
          }],
          "why": { "why": "The dashboard-main contract is close in distribution but requires an explicit team-oriented extension.", "anchorKind": "contract-registry", "anchor": "src/components/contracts/index.ts#dashboard-main" },
          "evidence": [{ "source": "contract-registry", "path": "src/components/contracts/index.ts", "contractKey": "dashboard-main", "finding": "Registry classes are flex min-w-0 grow flex-col gap-6." }]
        },
        "extends": []
      }
    },
    {
      "id": "02",
      "name": "Progress first",
      "thesis": "Lead with aggregate team progress so the lead understands direction before drilling into exceptions.",
      "tradeoffs": ["Creates balanced context, but urgent risks appear later."],
      "plan": {
        "business": { "rawPrompt": "Tạo dashboard học tập cho team trên StarCi.", "goal": "Give a team lead a trustworthy overview of team learning progress and participation.", "actors": ["team lead", "team learner"], "outcomes": ["See overall direction", "Compare learning areas", "Inspect a relevant exception"], "constraints": ["Aggregates must state their population and period"], "assumptions": ["Progress events can be aggregated by team"], "openQuestions": ["Which reporting period is the default?"] },
        "main": {
          "id": "team-progress-main", "status": "modify", "contractDecision": "extend", "contract": "dashboard-main",
          "purpose": "Extend the dashboard column for team-level aggregate progress.",
          "distribution": "A flexible vertical main column begins with aggregate direction, then learning-area comparison and member exceptions.",
          "responsive": "Aggregate figures and comparisons stack while retaining labels and reporting period.",
          "cssStatus": "proposed", "proposedCss": "flex min-w-0 grow flex-col gap-6",
          "blocks": [{
            "id": "team-progress-overview", "title": "Team progress overview", "status": "new", "usage": "used", "contractDecision": "new-required", "contract": null,
            "businessPurpose": "Summarize team learning direction without hiding the population or reporting period.",
            "data": ["team scope", "reporting period", "aggregate progress", "participation", "learning areas"],
            "renderBrief": "Render labelled aggregate direction and learning-area comparisons with explicit period and population.",
            "renderForm": "standing-figure",
            "states": [{ "name": "pending", "renders": "Stable aggregate placeholders retaining labels.", "source": "proposed" }, { "name": "ready", "renders": "Team progress figures with period and population context.", "source": "business-required" }, { "name": "insufficient-data", "renders": "An evidence limit instead of a misleading aggregate.", "source": "proposed" }, { "name": "forbidden", "renders": "Permission explanation without team metrics.", "source": "business-required" }],
            "placement": { "region": "main", "order": 0, "width": "full flexible column", "alignment": "start", "responsive": "Figures stack but keep period and population adjacent to the evidence." },
            "cssStatus": "proposed", "proposedCss": "grid w-full grid-cols-1 gap-6 lg:grid-cols-2",
            "why": { "why": "Aggregate-first is a distinct management reading order and must expose its measurement scope.", "anchorKind": "suy-luan-khong-co-neo" },
            "evidence": [{ "source": "contract-registry", "path": "src/components/contracts/index.ts", "contractKey": "dashboard-main", "finding": "The existing dashboard column can be extended but does not prove team aggregates." }],
            "brief": { "willRender": "Permission-safe aggregate progress and participation with period, population and learning-area comparison.", "interaction": "Change reporting period or open a relevant learning area.", "dataBoundary": "Aggregates must be computed for the authorized team scope before rendering.", "visualHierarchy": "Overall direction first, scope and period second, area comparison third.", "gate2Questions": ["Who owns reporting-period state?", "What minimum population avoids misleading aggregates?"] }
          }],
          "why": { "why": "Existing dashboard-main distribution is reusable only through an explicit team-data extension.", "anchorKind": "contract-registry", "anchor": "src/components/contracts/index.ts#dashboard-main" },
          "evidence": [{ "source": "contract-registry", "path": "src/components/contracts/index.ts", "contractKey": "dashboard-main", "finding": "Registry classes establish the main column and gap." }]
        },
        "extends": []
      }
    },
    {
      "id": "03",
      "name": "Action first",
      "thesis": "Lead with pending coaching and assignment actions so the dashboard behaves as a work queue rather than a report.",
      "tradeoffs": ["Speeds operations, but suppresses strategic trend context."],
      "plan": {
        "business": { "rawPrompt": "Tạo dashboard học tập cho team trên StarCi.", "goal": "Help a team lead complete authorized learning-management actions efficiently.", "actors": ["team lead", "team learner"], "outcomes": ["See pending actions", "Understand their cause", "Complete or defer work"], "constraints": ["Every action requires explicit authorization"], "assumptions": ["Team learning actions have lifecycle states"], "openQuestions": ["Which actions exist at launch?"] },
        "main": {
          "id": "team-actions-main", "status": "modify", "contractDecision": "extend", "contract": "dashboard-main",
          "purpose": "Extend the dashboard column into an authorized team learning work queue.",
          "distribution": "A flexible vertical main column prioritizes pending actions, followed by compact supporting team context.",
          "responsive": "Action items remain ordered by urgency and stack into one narrow-screen run.",
          "cssStatus": "proposed", "proposedCss": "flex min-w-0 grow flex-col gap-6",
          "blocks": [{
            "id": "team-learning-actions", "title": "Team learning actions", "status": "new", "usage": "used-repeatedly", "contractDecision": "new-required", "contract": null,
            "businessPurpose": "Give authorized team leads a bounded queue of learning interventions that need attention.",
            "data": ["viewer role", "action identity", "member scope", "cause", "status", "due time"],
            "renderBrief": "Render prioritized action summaries with cause, affected scope, authorization and completion state.",
            "renderForm": "workbench",
            "states": [{ "name": "pending", "renders": "Stable queue placeholders without fabricated actions.", "source": "proposed" }, { "name": "ready", "renders": "Authorized actions ordered by urgency.", "source": "business-required" }, { "name": "empty", "renders": "A completed-work explanation without an empty queue surface.", "source": "proposed" }, { "name": "forbidden", "renders": "Permission explanation with no protected action data.", "source": "business-required" }],
            "placement": { "region": "main", "order": 0, "width": "full flexible column", "alignment": "start", "responsive": "Actions stack and retain urgency, cause and permission context." },
            "cssStatus": "proposed", "proposedCss": "flex w-full flex-col gap-4",
            "why": { "why": "Action-first changes the dashboard from evidence reading to operational work and therefore needs its own candidate.", "anchorKind": "suy-luan-khong-co-neo" },
            "evidence": [{ "source": "business-input", "path": "input.json#/raw", "finding": "A team dashboard can support decisions, but exact actions remain unresolved." }],
            "brief": { "willRender": "Authorized learning-management actions with cause, member scope, urgency and lifecycle state.", "interaction": "Open, complete or defer an action when permission allows.", "dataBoundary": "Action data must be filtered by viewer authorization before the queue is composed.", "visualHierarchy": "Urgency first, affected learner scope second, action completion third.", "gate2Questions": ["Which launch actions are in scope?", "Who owns optimistic completion state?"] }
          }],
          "why": { "why": "The existing dashboard main is the closest distribution, but work-queue semantics require an extension.", "anchorKind": "contract-registry", "anchor": "src/components/contracts/index.ts#dashboard-main" },
          "evidence": [{ "source": "contract-registry", "path": "src/components/contracts/index.ts", "contractKey": "dashboard-main", "finding": "The registry provides the flexible repeated-section column shape." }]
        },
        "extends": []
      }
    }
  ],
  "recommendedCandidateId": "01",
  "recommendedReason": { "why": "Risk-first best turns team learning data into a specific management decision while permission questions stay explicit.", "anchorKind": "business-input", "anchor": "input.json#/raw" }
}
```
