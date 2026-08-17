---
id: fe-layouts-proof-community-events
title: Golden case — Community events
description: Three complete Gate 1 candidates for net-new community events.
---

# Community events

Raw prompt: `Tạo trang sự kiện cộng đồng cho StarCi.`

```json
{
  "decisionId": "community-events",
  "artifactPath": ".workflows/starci-academy/fe/community-events/layouts/",
  "sourceContext": { "project": "starci-academy", "frontend": "C:/Repositories/starci-academy-fe", "contractRegistry": "C:/Repositories/starci-academy-fe/src/components/contracts/index.ts" },
  "candidates": [
    {
      "id": "01",
      "name": "Calendar first",
      "thesis": "Organize events by time so learners can answer what is happening next before exploring themes.",
      "tradeoffs": ["Makes scheduling clear, but weaker events may receive equal visual weight."],
      "plan": {
        "business": { "rawPrompt": "Tạo trang sự kiện cộng đồng cho StarCi.", "goal": "Help learners find and join a relevant upcoming community event.", "actors": ["learner", "event host"], "outcomes": ["See upcoming dates", "Open event details", "Register interest"], "constraints": ["Past and cancelled events must be distinguishable"], "assumptions": ["Events have scheduled start times"], "openQuestions": ["Does joining require approval?"] },
        "main": {
          "id": "events-calendar-main", "status": "existing", "contractDecision": "reuse", "contract": "routed-page-main",
          "purpose": "Own a chronological community-event discovery surface.",
          "distribution": "A flexible vertical page groups upcoming events by date and preserves chronological reading order.",
          "responsive": "Date groups remain sequential; event summaries become one column on narrow screens.",
          "cssStatus": "registry", "css": "flex min-w-0 grow flex-col",
          "blocks": [{
            "id": "upcoming-event-calendar", "title": "Upcoming event calendar", "status": "new", "usage": "used-repeatedly", "contractDecision": "new-required", "contract": null,
            "businessPurpose": "Make event timing and joinability visible before the learner opens details.",
            "data": ["event identity", "start time", "timezone", "status", "joinability"],
            "renderBrief": "Render chronological date groups containing concise event summaries with explicit status and timezone.",
            "renderForm": "named-run",
            "states": [{ "name": "pending", "renders": "Stable dated placeholders without fake events.", "source": "proposed" }, { "name": "ready", "renders": "Upcoming date groups and joinable event summaries.", "source": "business-required" }, { "name": "empty", "renders": "No upcoming events explanation and no invented date group.", "source": "proposed" }],
            "placement": { "region": "page", "order": 0, "width": "bounded readable measure", "alignment": "start", "responsive": "Date labels remain attached to their event run in one column." },
            "cssStatus": "proposed", "proposedCss": "mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8",
            "why": { "why": "Events are time-bound, so chronology is a defensible first candidate without claiming existing event UI.", "anchorKind": "business-input", "anchor": "input.json#/raw" },
            "evidence": [{ "source": "business-input", "path": "input.json#/raw", "finding": "The requested subject is scheduled community events." }],
            "brief": { "willRender": "Chronological event groups with identity, time, status and a visible join path.", "interaction": "Open an event or register interest from an eligible summary.", "dataBoundary": "Event schedule and viewer registration standing remain separately attributable.", "visualHierarchy": "Date first, event identity second, joinability third.", "gate2Questions": ["Which owner performs registration?", "How are cancelled events represented?"] }
          }],
          "why": { "why": "The existing routed-page-main contract already owns the flexible routed reading surface.", "anchorKind": "contract-registry", "anchor": "src/components/contracts/index.ts#routed-page-main" },
          "evidence": [{ "source": "contract-registry", "path": "src/components/contracts/index.ts", "contractKey": "routed-page-main", "finding": "Registry classes are flex min-w-0 grow flex-col." }]
        },
        "extends": []
      }
    },
    {
      "id": "02",
      "name": "Discovery first",
      "thesis": "Lead with themes and featured events so learners can browse by interest before committing to a date.",
      "tradeoffs": ["Improves exploration, but upcoming timing is less immediately scannable."],
      "plan": {
        "business": { "rawPrompt": "Tạo trang sự kiện cộng đồng cho StarCi.", "goal": "Help learners discover community events matching their interests.", "actors": ["learner", "event host"], "outcomes": ["Browse themes", "Compare relevant events", "Open a selected event"], "constraints": ["Featured status requires a real source"], "assumptions": ["Events carry topic metadata"], "openQuestions": ["Who curates featured events?"] },
        "main": {
          "id": "events-discovery-main", "status": "existing", "contractDecision": "reuse", "contract": "routed-page-main",
          "purpose": "Own a theme-led community-event discovery surface.",
          "distribution": "A vertical page places theme navigation before a repeated event discovery run ordered by relevance.",
          "responsive": "Theme controls remain reachable and event summaries collapse to one column.",
          "cssStatus": "registry", "css": "flex min-w-0 grow flex-col",
          "blocks": [{
            "id": "themed-event-discovery", "title": "Themed event discovery", "status": "new", "usage": "used-repeatedly", "contractDecision": "new-required", "contract": null,
            "businessPurpose": "Let learners find events by learning interest rather than only by schedule.",
            "data": ["event identity", "topics", "start time", "featured source", "viewer standing"],
            "renderBrief": "Render topic choices and a repeated event run with real timing and curation evidence.",
            "renderForm": "owned-item",
            "states": [{ "name": "pending", "renders": "Stable topic and event placeholders.", "source": "proposed" }, { "name": "ready", "renders": "Themes and relevant upcoming events.", "source": "business-required" }, { "name": "filtered-empty", "renders": "Selected topic with a no-matching-events explanation.", "source": "proposed" }],
            "placement": { "region": "page", "order": 0, "width": "full available measure", "alignment": "start", "responsive": "Topics remain above a single-column event run on narrow screens." },
            "cssStatus": "proposed", "proposedCss": "flex w-full flex-col gap-6 px-6 py-8",
            "why": { "why": "Interest-led discovery is a different product thesis from chronological scheduling.", "anchorKind": "suy-luan-khong-co-neo" },
            "evidence": [{ "source": "business-input", "path": "input.json#/raw", "finding": "Community events may serve different learner interests." }],
            "brief": { "willRender": "Topic choices followed by relevant event summaries with real timing and status.", "interaction": "Choose a topic, open an event and register when eligible.", "dataBoundary": "Topic filtering must query event data rather than hide an already paged subset.", "visualHierarchy": "Theme choice first, event relevance second, schedule third.", "gate2Questions": ["Does theme selection live in URL?", "Who proves featured status?"] }
          }],
          "why": { "why": "The route-level frame remains the existing flexible main while only content priority changes.", "anchorKind": "contract-registry", "anchor": "src/components/contracts/index.ts#routed-page-main" },
          "evidence": [{ "source": "contract-registry", "path": "src/components/contracts/index.ts", "contractKey": "routed-page-main", "finding": "The contract can host a theme-led vertical page." }]
        },
        "extends": []
      }
    },
    {
      "id": "03",
      "name": "Community first",
      "thesis": "Lead with hosts and attendee momentum so social confidence drives event discovery and joining.",
      "tradeoffs": ["Strengthens trust, but attendee counts can overpower event relevance."],
      "plan": {
        "business": { "rawPrompt": "Tạo trang sự kiện cộng đồng cho StarCi.", "goal": "Use real community context to help learners choose a trustworthy event.", "actors": ["learner", "event host", "attendee"], "outcomes": ["Understand who hosts", "See participation context", "Choose an event"], "constraints": ["Do not expose private attendee identity"], "assumptions": ["Host profiles and aggregate attendance exist"], "openQuestions": ["Which attendee signals are public?"] },
        "main": {
          "id": "events-community-main", "status": "existing", "contractDecision": "reuse", "contract": "routed-page-main",
          "purpose": "Own a host-and-community-led event discovery journey.",
          "distribution": "A bounded vertical run presents host credibility and aggregate participation before event commitment.",
          "responsive": "Host, participation and event details remain sequential on narrow screens.",
          "cssStatus": "registry", "css": "flex min-w-0 grow flex-col",
          "blocks": [{
            "id": "hosted-community-events", "title": "Hosted community events", "status": "new", "usage": "used-repeatedly", "contractDecision": "new-required", "contract": null,
            "businessPurpose": "Provide trustworthy host and participation context without exposing private attendees.",
            "data": ["host identity", "host standing", "aggregate attendance", "event identity", "start time"],
            "renderBrief": "Render event summaries led by verified host context and privacy-safe aggregate participation.",
            "renderForm": "evidence-tile",
            "states": [{ "name": "pending", "renders": "Stable host and event placeholders.", "source": "proposed" }, { "name": "ready", "renders": "Host context, aggregate participation and upcoming event details.", "source": "business-required" }, { "name": "private-attendance", "renders": "Event context without attendee identity or fabricated social proof.", "source": "proposed" }],
            "placement": { "region": "page", "order": 0, "width": "bounded readable measure", "alignment": "start", "responsive": "Evidence and event detail stack without moving identity outside its event." },
            "cssStatus": "proposed", "proposedCss": "mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8",
            "why": { "why": "Social confidence is a distinct decision axis, but every signal must remain privacy-safe and sourced.", "anchorKind": "suy-luan-khong-co-neo" },
            "evidence": [{ "source": "business-input", "path": "input.json#/raw", "finding": "The word community makes host and participation context relevant." }],
            "brief": { "willRender": "Host identity, privacy-safe participation evidence and the event's actionable schedule.", "interaction": "Inspect host context, open event details and join when eligible.", "dataBoundary": "Public host data and aggregate attendance must exclude private attendee identity.", "visualHierarchy": "Host trust first, event identity second, participation evidence third.", "gate2Questions": ["Which attendance aggregate is safe?", "How is host verification rendered?"] }
          }],
          "why": { "why": "The registry main contract supplies the frame without asserting a community-event component exists.", "anchorKind": "contract-registry", "anchor": "src/components/contracts/index.ts#routed-page-main" },
          "evidence": [{ "source": "contract-registry", "path": "src/components/contracts/index.ts", "contractKey": "routed-page-main", "finding": "The existing flexible main frame remains valid." }]
        },
        "extends": []
      }
    }
  ],
  "recommendedCandidateId": "01",
  "recommendedReason": { "why": "Calendar-first answers the most universal event question with the fewest unsupported product assumptions.", "anchorKind": "business-input", "anchor": "input.json#/raw" }
}
```
