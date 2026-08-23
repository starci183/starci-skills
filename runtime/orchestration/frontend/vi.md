---
title: Map điều phối thiết kế frontend
---

# Map điều phối thiết kế frontend

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@composition` | `knowledge/brainstorms/composition/vi.md` | vi | bind Scope, Owner, Invariant và Proof trước visual decision |
| `@directions` | `knowledge/brainstorms/directions/vi.md` | vi | giữ MASTER bypass và giới hạn visual direction |
| `@layouts` | `knowledge/brainstorms/layouts/vi.md` | vi | bind page synthesis, state, source ownership và staged approval |
| `@blocks` | `knowledge/brainstorms/blocks/vi.md` | vi | bind block state-first anatomy và complete-parent proof |
| `@frontend-quality` | `knowledge/brainstorms/frontend-quality/vi.md` | vi | bind integrated frontend review và advisory-source boundary |

## Bản ghi

Đây là phase map đầy đủ cho ba skill thiết kế frontend. “Coordinator” map sang Sol trong Codex và Opus trong
Claude; “worker” map sang Luna trong Codex và Sonnet trong Claude. Coordinator sở hữu mọi semantic decision.
Worker materialize, đo hoặc implement một decision đã freeze.

Dependency spine:

```text
request + routed truth
  -> four-lock composition baseline
  -> archetype selection + current-layout conformance audit
  -> orchestration receipt
  -> coordinator decision contract
  -> coordinator quality verdict + worker detector evidence
  -> worker cache HTML/captures
  -> coordinator approval gate
  -> complete state/source contract
  -> worker approved source/seed/test work
  -> coordinator integration and parity verdict
```

HTML trước eligible decision contract cùng quality receipt đã freeze là design chưa được phép. Product code trước source-authorizing approval
là implementation chưa được phép. Agent label không làm yếu hai boundary này.

## Skill bindings

| Skill | Exact phase map |
|---|---|
| `starci-fe-design-layout` | Map Layout |
| `starci-fe-design-block` | Map Block |
| `starci-fe-design-refactor` | Map feedback source-first |
| `starci-fe-design-resolve` | Map request learning và resolution |

## Approval execution mode

Ba frontend skill đã bind mặc định dùng `manual`. Exact `mode=auto` trong invocation bind
`phaseGates.approvalMode: auto` cùng `autoApprovalAt` với immutable envelope. Trong các bảng dưới, `OK #1` và
`OK #2` là checkpoint identity ở cả hai mode: manual trình rồi chờ; auto chỉ chọn evidence-backed recommendation
của coordinator và emit `AUTO:<autoApprovalAt>:OK #n:<boundaryAt>` sau khi cùng gate pass. Worker vẫn phụ thuộc
passed gate event. Auto không đổi decision, artifact, writer registry hay proof gate và dừng trước boundary chưa
disclose, credential, destructive action hoặc external commitment.

## Map Layout

| Step | Việc coordinator | Việc worker | Artifact | Dependency và gate |
|---|---|---|---|---|
| `evidence` | resolve route, business head, scope kind, page set và immutable envelope; nhận hoặc từ chối evidence | inventory độc lập four-lock composition, route/current/legacy source, component/contract vocabulary, visual vocabulary và state/capability fact | `baseline.json`, evidence pack, page-intent fact và source digest | mọi fact có provenance; chưa có UI decision |
| `orchestration` | chọn runtime adapter; chia task; giữ decision/shared file chỉ coordinator; publish dependency batch và writer registry | verify read/output/write boundary và stop condition được giao | orchestration receipt | một writer mỗi path; không approval; overlap không an toàn chuyển tuần tự |
| `page-synthesis` | author page map, select một reusable archetype cho mỗi page sau isolated evidence và trước Grammar, classify current layout là `conform`, `layout-drift` hoặc `needs-evidence`, author journey direction, business obligation, merge binding, UI direction, candidate anatomy cùng schema-9 `pageContract`; sở hữu mười lens decision, character signature và eligibility; recommend candidate | chạy isolated top-down/capability audit; thu bounded quality evidence cùng sáu detector-family result; chỉ sau coordinator freeze eligible JSON mới sinh complete wide/intermediate/compact HTML/interaction/capture | archetype receipt, current-layout conformance verdict, direction receipt, quality review, synthesis matrix, pages artifact, preview HTML và maturity evidence | independent receipt pass trước archetype selection và join; current implementation chứng minh fact/capability chứ không chứng minh layout đúng; binding thắng advisory; HTML project frozen eligible JSON; Sol/Opus trình `OK #1` |
| `states` | phân loại page/block ownership, chọn tối đa năm complete-page target rủi ro cao, freeze transition, grammar scope, SPLIT-6 chain, seed-owner row, exact source/seed boundary và execution prompt | inventory reachable condition/transition, source-owner chain và seed feasibility; sinh state HTML/capture chỉ sau target contract freeze; chạy artifact/grammar/maturity check | states artifact, render contract, source-owner/seed matrix và selected state review | approved page hash không đổi; phủ mọi risky/new capability; Sol/Opus trình `OK #2` |
| `implementation` | giao subset approved path tách rời, giữ shared entrypoint/contract hoặc giao mỗi cái đúng một worker, review diff và integrate | implement exact render contract, product-native idempotent seed và relevant test chỉ trong file đã giao | per-task implementation/seed receipt và integrated diff | chỉ bắt đầu sau `OK #2`; path ngoài boundary quay lại approval |
| `parity` | tái hiện key result, quyết mismatch so với approved contract, điều phối bounded repair và ra final verdict | chạy gate, start local stack đã duyệt, seed identity, operate browser, capture same-state/same-viewport và báo mismatch | green gate, seed proof và `visual-proof.json` | coordinator chỉ đóng khi `parity: passed` và zero known mismatch |

Hai origin của Layout giữ độc lập tới coordinator join. Worker được inventory journey fact, source capability,
quality evidence và detector result, nhưng chỉ coordinator author journey direction, UI direction, binding matrix,
adopted quality decision cùng eligibility verdict.

## Map Block

| Step | Việc coordinator | Việc worker | Artifact | Dependency và gate |
|---|---|---|---|---|
| `bind` | bind đúng một Layout-generated region, current parent, business reason và four locks; quyết scope còn là Block | đo parent digest, child tree, preserved node, state/condition, contract vocabulary và current source ownership | `baseline.json`, block evidence và `parentAt` | complete current parent là authority; chưa direction |
| `orchestration` | chọn adapter, tách cache/source/proof task và giữ UI/approval/integration decision | verify bounded assignment và writer path | orchestration receipt | không recompose page; không approval |
| `direction` | verify decision đã chỉ rõ hoặc chỉ resolve direction khi còn mở; freeze schema-3 anatomy | audit feasibility và sinh complete-parent HTML/capture sau freeze | schema-3 block anatomy và quality review | phủ mọi reachable state cùng BLOCK-1…15; chưa approval |
| `state-boundary` | chọn complete-page view phủ risk và freeze exact component/test boundary | verify transition, ownership và target coverage trong complete parent | state review và exact source/test boundary | parent/journey không đổi; một `OK #1` approve decision và source boundary |
| `implement` | giao một writer mỗi approved path, review parent preservation và integrate | implement approved block state/transition và test trong path tách rời | integrated diff và tests | chỉ sau một exact approval; whole-page drift dừng |
| `parity` | quyết parent fit và final parity | chạy gate/browser interaction và capture complete-page responsive proof | `visual-proof.json` và final state view | zero known mismatch; block crop không thay được proof |

## Map Refactor

| Step | Việc coordinator | Việc worker | Artifact | Dependency và gate |
|---|---|---|---|---|
| `bind-classify` | freeze product truth/rendered scope; reproduce feedback; classify highest failed layer | audit độc lập four locks, source-owner chain, grammar/principle counterexample, impact cone và pre-existing dirt; không authority edit | correction envelope, failure-verdict evidence và owner chain | mọi observation tái hiện được; chỉ Layout/Block-rendered scope |
| `orchestration` | chọn adapter và chia authority audit, HTML, FE source, proof; giữ mọi `.claude` write và decision | verify task, dependency và writer subset tách rời | orchestration receipt | authority/product task giữ thứ tự khi phụ thuộc nhau |
| `direction` | author correcting UI direction chỉ từ fact/region đã render và journey freeze; sở hữu standalone refactor quality receipt cùng eligibility | thu bounded lens/detector evidence; sau eligible direction freeze mới sinh complete-context HTML/capture; báo feasibility mismatch mà không redesign | direction review, quality receipt và cache artifact | grammar, maturity và quality review pass; Sol/Opus trình `OK #1` |
| `authority-state-boundary` | chọn state view, quyết smallest authority layer cần evolve, freeze authority-to-write map và exact FE/proof batch | đo mọi affected authority consumer, source chain, state family và test path; render frozen state | authority map, impact cone, state review và exact batch | không nở business/backend/seed; Sol/Opus trình `OK #2` |
| `evolve-refactor` | sửa paired `.claude` authority/executable case khi cần, compile runtime context, validate dependency graph rồi integrate product change | sau authority gate pass, implement assigned disjoint FE file/test; không sửa `.claude` hay reinterpret direction | authority receipt, compiled context, bounded FE diff và green gate | authority đứng trước dependent source; authority đúng được giữ nguyên |
| `parity` | tái hiện mismatch closure và ra final verdict | execute seed sẵn có, chạy gate/browser và capture ensured state | `visual-proof.json` và tối đa năm complete-page view cuối | zero known mismatch, không bỏ consumer trong impact cone |

## Luật scheduling

1. Dùng tối đa ba worker đồng thời, nhưng chỉ khi graph có ba ready node độc lập.
2. Cache HTML chỉ bắt đầu sau candidate/direction/anatomy JSON cùng target-matched quality receipt được
   coordinator freeze và eligible.
3. Source coding chỉ bắt đầu sau `OK #2`; Refactor source phụ thuộc authority evolution phải đợi authority proof.
4. Ưu tiên một implementation worker cho page coupled chặt. Chỉ split theo file khi contract/entrypoint không overlap.
5. Test/browser worker chỉ chạy cạnh implementation độc lập khi consume stable build; nếu không thì đợi.
6. Coordinator review mọi receipt trước khi unlock dependent và sở hữu mọi quyết định re-dispatch.
7. Worker chỉ được chạy external catalogue hoặc deterministic detector như bounded evidence task; không adopt
   recommendation, đổi authority hay biến external source thành binding input.
