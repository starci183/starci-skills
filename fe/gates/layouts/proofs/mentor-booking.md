---
id: fe-layouts-proof-mentor-booking
title: Golden case — Mentor booking
description: Three complete Gate 1 candidates for net-new mentor booking.
---

# Mentor booking

Raw prompt: `Tạo trang đặt lịch mentor cho StarCi.`

```json
{
  "decisionId": "mentor-booking",
  "artifactPath": ".workflows/starci-academy/fe/mentor-booking/layouts/",
  "sourceContext": { "project": "starci-academy", "frontend": "C:/Repositories/starci-academy-fe", "contractRegistry": "C:/Repositories/starci-academy-fe/src/components/contracts/index.ts" },
  "candidates": [
    {
      "id": "01",
      "name": "Mentor first",
      "thesis": "Let learners choose expertise and trust signals before exposing a mentor's available times.",
      "tradeoffs": ["Builds confidence, but requires an extra choice before time selection."],
      "plan": {
        "business": {
          "rawPrompt": "Tạo trang đặt lịch mentor cho StarCi.",
          "goal": "Help a learner select a suitable mentor and request an available mentoring session.",
          "actors": ["learner", "mentor"],
          "outcomes": ["Compare mentor fit", "Choose an available time", "Submit a booking request"],
          "constraints": ["Availability must not be fabricated"],
          "assumptions": ["Mentors publish availability"],
          "openQuestions": ["Is booking confirmed immediately or reviewed by the mentor?"]
        },
        "main": {
          "id": "mentor-first-main",
          "status": "existing",
          "contractDecision": "reuse",
          "contract": "routed-page-main",
          "purpose": "Own the routed mentor discovery and booking journey.",
          "distribution": "A single flexible column begins with mentor discovery and reveals booking detail after a mentor is selected.",
          "responsive": "Mentor summaries and scheduling controls stack into one reading flow on narrow screens.",
          "cssStatus": "registry",
          "css": "flex min-w-0 grow flex-col",
          "blocks": [
            {
              "id": "mentor-discovery-booking",
              "title": "Mentor discovery and booking",
              "status": "new",
              "usage": "used",
              "contractDecision": "new-required",
              "contract": null,
              "businessPurpose": "Establish mentor fit before asking the learner to commit to a time.",
              "data": ["mentor identity", "expertise", "trust signals", "available slots"],
              "renderBrief": "Render comparable mentor summaries, then the selected mentor's honest available slots and booking intent.",
              "renderForm": "block-of-blocks",
              "states": [
                { "name": "pending", "renders": "Stable mentor summary placeholders without fake availability.", "source": "proposed" },
                { "name": "ready", "renders": "Mentor choices and selected mentor availability.", "source": "business-required" },
                { "name": "no-availability", "renders": "Selected mentor context with no available-time explanation.", "source": "proposed" }
              ],
              "placement": { "region": "page", "order": 0, "width": "full available measure", "alignment": "start", "responsive": "Comparison precedes scheduling and both become single-column." },
              "cssStatus": "proposed",
              "proposedCss": "mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8",
              "why": { "why": "The prompt requires booking but does not prove any existing mentor-booking component or contract.", "anchorKind": "business-input", "anchor": "input.json#/raw" },
              "evidence": [{ "source": "business-input", "path": "input.json#/raw", "finding": "The request explicitly joins mentor selection with scheduling." }],
              "brief": {
                "willRender": "Comparable mentor identities followed by real availability for the selected mentor.",
                "interaction": "Select a mentor, select one slot and submit booking intent.",
                "dataBoundary": "Mentor directory and availability may load separately under the page owner.",
                "visualHierarchy": "Mentor fit first, available time second, booking commitment last.",
                "gate2Questions": ["Which block owns selected mentor state?", "Does booking require authentication overlay?"]
              }
            }
          ],
          "why": { "why": "The registry's routed-page-main already supplies the required flexible route-owned main surface.", "anchorKind": "contract-registry", "anchor": "src/components/contracts/index.ts#routed-page-main" },
          "evidence": [{ "source": "contract-registry", "path": "src/components/contracts/index.ts", "contractKey": "routed-page-main", "finding": "Registry classes are flex min-w-0 grow flex-col." }]
        },
        "extends": []
      }
    },
    {
      "id": "02",
      "name": "Availability first",
      "thesis": "Let learners start from a usable time window and only compare mentors who can actually meet it.",
      "tradeoffs": ["Reduces unavailable choices, but mentor identity becomes secondary."],
      "plan": {
        "business": {
          "rawPrompt": "Tạo trang đặt lịch mentor cho StarCi.",
          "goal": "Find a mentor who matches the learner's real scheduling window.",
          "actors": ["learner", "mentor"],
          "outcomes": ["Set a time window", "See compatible mentors", "Request a session"],
          "constraints": ["Timezone must be explicit"],
          "assumptions": ["Availability can be queried by time window"],
          "openQuestions": ["What is the minimum notice period?"]
        },
        "main": {
          "id": "availability-first-main",
          "status": "existing",
          "contractDecision": "reuse",
          "contract": "routed-page-main",
          "purpose": "Own a time-first path from availability constraints to mentor choice.",
          "distribution": "A vertical flow places time-window selection before a compatible mentor run and final booking review.",
          "responsive": "Time controls remain first; compatible mentors stack below at narrow widths.",
          "cssStatus": "registry",
          "css": "flex min-w-0 grow flex-col",
          "blocks": [
            {
              "id": "availability-matched-mentors",
              "title": "Availability matched mentors",
              "status": "new",
              "usage": "conditional",
              "activationOrReason": "Mentor results appear only after the learner defines a valid time window.",
              "contractDecision": "new-required",
              "contract": null,
              "businessPurpose": "Avoid presenting mentors who cannot satisfy the learner's scheduling constraint.",
              "data": ["learner timezone", "time window", "matching mentor availability"],
              "renderBrief": "Render an explicit timezone-aware time window followed by mentors with matching real slots.",
              "renderForm": "workbench",
              "states": [
                { "name": "awaiting-window", "renders": "Time-window instructions without mentor results.", "source": "proposed" },
                { "name": "ready", "renders": "Matching mentors with their compatible slots.", "source": "business-required" },
                { "name": "no-match", "renders": "No-match explanation and a way to widen the window.", "source": "proposed" }
              ],
              "placement": { "region": "page", "order": 0, "width": "full available measure", "alignment": "start", "responsive": "Controls and result summaries stack without hiding timezone." },
              "cssStatus": "proposed",
              "proposedCss": "flex w-full flex-col gap-6 px-6 py-8",
              "why": { "why": "Time-first changes the primary decision axis and therefore is a distinct candidate, not a visual variant.", "anchorKind": "suy-luan-khong-co-neo" },
              "evidence": [{ "source": "business-input", "path": "input.json#/raw", "finding": "A booking request cannot complete without a real shared time." }],
              "brief": {
                "willRender": "Timezone-aware availability input followed by only mentors with compatible slots.",
                "interaction": "Set a window, compare matching mentors and choose a slot.",
                "dataBoundary": "Availability query depends on time window but mentor identity remains separately sourced.",
                "visualHierarchy": "Time constraint first, compatible mentors second, commitment third.",
                "gate2Questions": ["What control represents a time window?", "Who owns timezone conversion?"]
              }
            }
          ],
          "why": { "why": "Changing priority does not require inventing a new route-level main contract.", "anchorKind": "contract-registry", "anchor": "src/components/contracts/index.ts#routed-page-main" },
          "evidence": [{ "source": "contract-registry", "path": "src/components/contracts/index.ts", "contractKey": "routed-page-main", "finding": "The existing contract remains a flexible vertical route surface." }]
        },
        "extends": []
      }
    },
    {
      "id": "03",
      "name": "Goal first",
      "thesis": "Capture the learning problem first so expertise fit narrows both mentor choice and session framing.",
      "tradeoffs": ["Improves matching context, but asks for effort before showing people."],
      "plan": {
        "business": {
          "rawPrompt": "Tạo trang đặt lịch mentor cho StarCi.",
          "goal": "Match a learner's concrete learning problem to suitable mentor expertise and time.",
          "actors": ["learner", "mentor"],
          "outcomes": ["State a learning goal", "Find suitable expertise", "Request a focused session"],
          "constraints": ["Goal text may contain private project context"],
          "assumptions": ["Mentor expertise is structured enough to match"],
          "openQuestions": ["Is goal text shared before mentor acceptance?"]
        },
        "main": {
          "id": "goal-first-main",
          "status": "existing",
          "contractDecision": "reuse",
          "contract": "routed-page-main",
          "purpose": "Own the learning-goal matching and booking path.",
          "distribution": "A single column captures goal context, then exposes matched mentors and the chosen mentor's times.",
          "responsive": "Goal, matches and scheduling remain sequential at all widths.",
          "cssStatus": "registry",
          "css": "flex min-w-0 grow flex-col",
          "blocks": [
            {
              "id": "goal-matched-booking",
              "title": "Goal matched booking",
              "status": "new",
              "usage": "used",
              "contractDecision": "new-required",
              "contract": null,
              "businessPurpose": "Give mentor selection enough problem context to be relevant and focused.",
              "data": ["learning goal", "topic tags", "mentor expertise", "available slots"],
              "renderBrief": "Render a bounded goal brief, matched mentors with fit reasons, then selected availability.",
              "renderForm": "workbench",
              "states": [
                { "name": "draft", "renders": "Goal capture with no implied mentor match yet.", "source": "proposed" },
                { "name": "ready", "renders": "Matched mentors and available times after a valid goal.", "source": "business-required" },
                { "name": "no-match", "renders": "A no-match explanation preserving the learner's goal.", "source": "proposed" }
              ],
              "placement": { "region": "page", "order": 0, "width": "bounded readable measure", "alignment": "start", "responsive": "All steps stay stacked and preserve entered goal context." },
              "cssStatus": "proposed",
              "proposedCss": "mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8",
              "why": { "why": "Goal-first makes expertise matching the primary product thesis rather than generic directory browsing.", "anchorKind": "suy-luan-khong-co-neo" },
              "evidence": [{ "source": "business-input", "path": "input.json#/raw", "finding": "Mentor booking implies a subject for the requested session." }],
              "brief": {
                "willRender": "A learner goal brief, matched mentor summaries with fit reasons and selected availability.",
                "interaction": "Edit goal, choose a matched mentor and select one slot.",
                "dataBoundary": "Private goal content must have an explicit sharing boundary before booking.",
                "visualHierarchy": "Learning goal first, match rationale second, available time third.",
                "gate2Questions": ["Where is draft goal stored?", "When is private goal text shared?"]
              }
            }
          ],
          "why": { "why": "The registry main contract is sufficient for the page frame while the business block remains new.", "anchorKind": "contract-registry", "anchor": "src/components/contracts/index.ts#routed-page-main" },
          "evidence": [{ "source": "contract-registry", "path": "src/components/contracts/index.ts", "contractKey": "routed-page-main", "finding": "The existing main contract supplies the route-owned flexible column." }]
        },
        "extends": []
      }
    }
  ],
  "recommendedCandidateId": "01",
  "recommendedReason": { "why": "Mentor-first is the least assumptive response to a generic booking request and makes trust visible before commitment.", "anchorKind": "business-input", "anchor": "input.json#/raw" }
}
```
