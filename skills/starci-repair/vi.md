---
title: starci-repair
---

# starci-repair

## LOADS

| Alias | Target | Kind | Vì sao |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape` | module | contract chung về phase, approval và output |
| `@staleness` | `readiness/staleness` | module | taxonomy và router duy nhất cho mọi repair module |

## NESTED SKILLS

Không có. Stale route được trả về initialization owner; skill này không tự chạy setup.

## Chạy

Đọc `@skill-shape`, rồi `@staleness`. Không restate law của category ở đây. Registry sở hữu stale
taxonomy và route sang module sở hữu list evidence, inventory, apply cùng proof.

## Chọn module

Chỉ đọc module đã chạm trong repair:

- luôn đọc `@stale-source-gates` và `@stale-lint-machine` sau khi route verify;
- đọc `@stale-strict-fix` khi request strict-fix hoặc first-party surface của nó hiện diện;
- đọc `@stale-why` khi route có contract;
- đọc `@stale-assurance` cho backend hoặc frontend rồi tuân tracked applicability declaration;
- đọc `@stale-retired-structure` cho frontend component tree;
- chỉ đọc `@stale-remnant` cho `.claude/` nested trong resolved target.

Module không chạm không tạo finding, boundary hay work.

## Invariants

Green phải kiếm được, không mua. Không `eslint-disable`, hạ severity, bỏ rule, skip test hoặc thêm `any`
để kết thúc finding. Decision được trả về. Formatting tách behavior. Consumer cài published lint rule và
không author/repair private copy.

Một repair record chỉ phủ một role của một project. Multi-project request coordinate record, baseline và
diff riêng trong một approval batch. Whole-repository gate chạy một lần mỗi checkout bởi coordinator.

## PROCESS

### 1 — Resolve route

Đọc `.workspace/<project>/<role>/config.json`. Verify checkout, git root, branch/head, manifest và frontend
contract khi declared. Dừng trước target-source read nếu route absent, invalid hoặc stale;
`@staleness` giao finding đó cho initialization owner.

### 2 — Đọc manifest và chọn module

Đọc repository manifest và gate script hiện có. Chọn module theo rule trên, rồi đọc trọn English record của
từng module trước inventory. Không chạy end-to-end suite trừ khi request gọi tên.

### 3 — Lập baseline state

Refuse target tree dirty không giải thích được. Ghi pre-change commit. Theo `@stale-lint-machine` trước khi
tin lint count, rồi theo `@stale-source-gates` để có exact before-count. Inventory module khác mà không ghi.

### 4 — Classify và review

Mọi finding dùng category từ `@staleness`. Trình count, exact path, apply action theo module, phần không
đụng và mọi external mutation. Batch approval một lần. Với assurance, tách repository path khỏi provider/
GitHub state và hiện invocation `scripts/publish-secret.mjs --plan` không có value.

`OK` chỉ approve project, role, file, service, secret name và external target đã trình. Lấy baseline sau
approval và trước write đầu tiên; nếu lint-machine installation là write đầu, baseline nằm trước nó.

### 5 — Apply các pass tách biệt

Chỉ apply module đã chọn, theo thứ tự này, mỗi pass/commit đọc được:

1. lint machine;
2. strict fix;
3. source format;
4. source mechanical fix;
5. source defect;
6. retired structure;
7. why index;
8. delivery assurance;
9. remnant removal.

Skip pass không chọn hoặc clean. Empty-directory removal có thể không có Git diff nhưng vẫn ghi absolute
path và before/after count. External credential/check unavailable làm assurance incomplete.

### 6 — Parallel defect repair

Chỉ source defect được fan out, partition theo file để hai agent không edit cùng file. Machine, strict-fix,
formatting, autofix, structure, why, assurance và remnant là single-writer. Agent chỉ chạy file-scoped lint;
coordinator sở hữu shared-state gate và remeasurement.

### 7 — Prove từng module

Chạy `Proof` của mọi selected module. Chạy lại đúng original source gate một lần và report before/after.
Inspect complete baseline diff cho boundary violation và secret material. External enforcement được prove
bằng authorized API evidence, không suy từ workflow text.

### 8 — Đóng

Nêu approved revision, baseline/applied commit, path theo pass, before/after count và external authority còn
thiếu. Tiếp tục khi còn executable action trong scope.

## Stops

- Route absent/invalid/stale → trả evidence và initialization owner.
- Target dirty không giải thích → dừng; mixed baseline không chứng minh gì.
- Gate chỉ pass bằng suppression → trả finding.
- Module boundary phải mở rộng → trả một `### NEED APPROVALS` batch.
- Credential chỉ có trong chat, stdout, command argument hoặc plaintext → trả secure publisher plan không
  value từ `@stale-assurance`; không handle value đó.
- Repository không khai báo gate có nghĩa → report source stale; không invent gate surface lúc đo.

## OUTPUT

Dùng category name từ registry. Nêu before/after evidence, material path, assurance repository/external
proof và owner decision còn lại thật gọn. Không bao gồm secret value.
