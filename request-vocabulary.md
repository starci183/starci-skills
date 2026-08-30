# Request vocabulary and scope normalization

Use this small vocabulary while analyzing the active request. It normalizes Vietnamese, English,
mixed-language shorthand and ordinary typos into a scope hypothesis; it does not replace explicit
user wording or authorize a broader task.

## Interpretation rules

1. Bind quantifiers and modifiers to the nearest explicit product noun. `toàn bộ`, `full`, `hết` or
   `all` never means the whole repository, workspace or product unless that broader noun is explicit.
2. Prefer the meaning supported by the current request and its explicitly active objective. Ambient
   browser state, the current page and legacy source are observations, not scope authority.
3. Treat an example as evidence of intended abstraction, not as the exhaustive vocabulary. Infer the
   reusable relationship the example demonstrates.
4. Distinguish a product structure from a source-control structure before resolving a target.
5. Ask one focused clarification when two plausible interpretations would change the project, role,
   product boundary, required surface set, mutation type, approval stage, external effect or completion
   criteria. State the competing interpretations briefly. Do not choose one silently.
6. Do not ask when nearby nouns and actions resolve the ambiguity without changing the boundary.

## Product scope nouns

| Wording | Normalized meaning | Boundary rule |
| --- | --- | --- |
| `hệ`, `engine tổng`, `nền tảng` | Umbrella capability coordinating multiple features or journeys | Do not reduce it to one service or class. If product capability and technical runtime are both plausible, clarify. |
| `mảng`, `miền`, `domain` | Coherent business area containing related capabilities | Name included capabilities and exclusions before delivery. |
| `tính năng`, `feature` | One customer capability with a bounded outcome | Include the minimum closed journey needed to achieve and recover that outcome. |
| `nhánh` in product or UX context | A closed family of related entry points, routes, surfaces, states and exits for one feature subjourney | Never normalize it to one current page. Inventory applicable entry, core task, pending/recovery, result, history/retry/resume and exit surfaces. A role may be absent when the feature does not need it. |
| `luồng`, `flow` | Ordered transitions for one behavior, including failure and recovery | A flow may cross several pages or remain within one surface; do not infer route count from the word alone. |
| `journey`, `hành trình` | End-to-end customer progress from trigger to meaningful outcome | Include navigation, completion, interruption, recovery and next action where applicable. |
| `trang`, `màn`, `screen`, `surface` | One user-visible interaction surface | It may be a route, modal, panel or substantial state. Do not create a route merely because it is called a page. |
| `lá`, `leaf` | The smallest concrete target under a declared parent scope | Resolve from the named parent: it can be one route, surface, state or component. Clarify when the parent tree is absent or multiple leaf types remain plausible. |
| `khối`, `block`, `section` | Bounded region or reusable product block inside a surface | Do not expand it into a complete journey unless its consumers are explicitly in scope. |
| `component` | Reusable implementation or design contract | Do not treat one component as the product outcome when the request names a journey or feature branch. |
| `case`, `trường hợp` | Scenario, state variant or test condition | It is not automatically a separate page or implementation module. |
| `scope`, `phạm vi` | Closed set of targets, affected relations and declared exclusions | Record the normalized unit and closure rule before selecting a capability. |

## Scope modifiers and relationship words

| Wording | Normalized meaning |
| --- | --- |
| `toàn bộ`, `full`, `hết`, `overall` | Complete the nearest named scope, including applicable failure and recovery, without widening to unrelated features. |
| `liên quan`, `affected` | Include the smallest closed upstream and downstream set required for the named outcome to remain coherent. |
| `quan trọng`, `key`, `critical` | Include representative decision-heavy and recovery surfaces; clarify only when the exact set changes the deliverable or approval boundary. |
| `chí ít`, `ít nhất`, `at least` | A minimum expectation, not an exhaustive definition of done. |
| `riêng`, `chỉ`, `tập trung`, `kệ phần trước` | Narrow or replace the active scope with the named target. |
| `cái khác`, `ở phần khác` | A separate target whose identity must come from explicit nearby context; clarify if more than one candidate remains. |

## Action and completion words

| Wording | Normalized meaning |
| --- | --- |
| `phân tích`, `xem thử`, `diagnose`, `report only` | Read-only diagnosis or comparison unless mutation is separately requested. |
| `audit <frontend target>` | Route to `starci-fe-process` with `intent=audit` only after exactly one UX/UI change level is frozen; observe critically, repair inside that level, independently review, and close quality/UAT unless the request explicitly says report-only. |
| `sửa`, `làm`, `implement`, `code` | Mutate the authorized source boundary and verify proportionally. |
| `redesign` for a page | Does not determine the UX/UI change level alone. If the request authorizes structural rebuilding of an existing page, bind `reconstruct`; if layout may be locked, ask. When the direction is not already approved, render three or four materially different realistic UI directions through `visualize` before asking for selection. |
| `redesign` for a feature or `nhánh` | Does not determine the UX/UI change level alone. After `reconstruct` is authorized, rework the closed journey and applicable surface family; otherwise ask before widening beyond element-level work. An unresolved direction choice requires three or four rendered journey/surface directions, not prose-only options. |
| `redesign` for architecture, workflow or another technical boundary | Preserve approved outcomes and authority, generate three or four material alternatives, and render the decision-relevant boundaries, flows, failure/recovery and trade-offs through `visualize` before selection. |
| `render`, `vẽ`, `cho xem UI`, `in ra UX UI` | Produce an inspectable visual; prose or a contract alone is insufficient. |
| `hoàn thiện`, `đóng`, `đóng luôn`, `finish` | Carry the declared scope through its required workflow and proof gates; it does not waive gates or widen authority. |
| `tiếp tục` | Resume the latest unfinished objective unless the newest message narrows, replaces or cancels it. |
| `commit`, `tạo commit`, `chốt commit` | Before creating the commit, run the standalone static-quality-gates capability for the exact revision. Commit only after lint, typecheck and Sonar are green. |
| `chạy lint/typecheck/Sonar`, `run static gates` | Invoke the same standalone static-quality-gates capability without creating a commit. |
| `bỏ phần trên`, `kệ phần trước` | Supersede the earlier active objective; stop carrying its scope into later work. |
| `như X`, `giống X`, `theo cách X` | Use X as an outcome or quality benchmark, not as permission to copy its implementation blindly. |
| `legacy` | Observed precedent and migration evidence, not target authority unless the user explicitly requires preservation. |

## UX/UI change levels

Every frontend UX/UI request must resolve exactly one `frontend.ux-ui.change-level` scope dimension before Skill selection or target-source
inspection. The complete authority is `knowledge/ux-ui-change-levels.md`.

| Wording | Normalized level | Mutation boundary |
| --- | --- | --- |
| `refine`, `layout chốt rồi`, `giữ nguyên layout`, `chỉ sửa element` | `refine` | Preserve regions, order, flow, containers, and responsive structure; audit or repair elements only. |
| `reconstruct`, `build lại`, `dựng lại cấu trúc` | `reconstruct` | Rebuild an existing experience's UX/UI structure while preserving approved business and backend authority. |
| `new`, `tạo mới`, `trang/flow chưa có` | `new` | Create an approved target experience that does not yet exist. |

`audit`, `redesign`, `improve`, `fix UI`, `update page`, and `làm lại` are ambiguous without evidence
that excludes the other levels. Ask one focused question naming the plausible boundaries rather than
silently choosing.

## Common cross-domain ambiguities

| Term | Plausible meanings | Resolution |
| --- | --- | --- |
| `nhánh`, `branch` | Product journey branch; Git branch | Git verbs such as checkout, merge, rebase, push or commit select Git. Feature/page/journey/UX wording selects product scope. Otherwise clarify. |
| `engine` | Product capability; orchestration policy; technical runtime/service | Bind from the requested outcome. Clarify before architecture or source mutation if multiple meanings change ownership. |
| `flow` | Customer UX flow; backend process; workflow state machine | Bind from the named actor and outcome; clarify if it changes the selected capability. |
| `page` | URL route; user-visible surface; state inside a route | Preserve the requested experience first and defer route topology unless it is explicit or already approved. |
| `workspace` | StarCi logical workspace; repository checkout; Git worktree; product workbench | Use the canonical workspace vocabulary in `INDEX.md`; never select by nearby directory name. |
| `test` | Unit/integration test; E2E; product UAT; AI evaluation; workflow harness | Bind from the object being proven. Ask when the proof type materially changes cost or definition of done. |
| `AI work`, `AI chạy được` | Provider connectivity; model quality; product journey correctness; safe authority behavior | Name the proof dimensions rather than treating one successful response as completion. |

## Normalized scope record

Keep the following task-session-only facts before selecting a skill or doing unskilled work:

- `scopeUnit`: umbrella, domain, feature, branch, journey, flow, surface, block, component, state or case;
- `dimensions`: every material conditional scope dimension; for frontend UX/UI this includes `frontend.ux-ui.change-level=refine|reconstruct|new`;
- `targetSet`: exact named targets and the minimal closed related set;
- `surfaceRoles`: applicable entry, task, pending/recovery, result, history/retry/resume and exit roles;
- `exclusions`: explicit replacements, deferrals and out-of-scope areas;
- `ambiguities`: only unresolved alternatives that can materially change the work; a Skill input is forbidden until this set is empty;
- `interpretationEvidence`: the active words that selected the meaning.

When `ambiguities` is non-empty, stop before skill selection, planning or mutation and ask one focused
question. When it is empty, proceed without asking for confirmation merely because the request uses
Vietnamese shorthand, mixed language or an ordinary typo.
