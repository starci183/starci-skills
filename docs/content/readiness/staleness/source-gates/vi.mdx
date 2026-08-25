---
title: Source gates
---

# Source gates

## LOADS

| Alias | Target | Kind | Vì sao |
|---|---|---|---|
| `@stale-debts` | `platform/readiness/staleness/debts/vi.md` | vi | debt có owner, baseline, scope và hạn |

## Dấu hiệu stale

Gate contract đã khai báo của repository absent, incomplete, fail hoặc không executable cho mọi routed role
là stale. Thứ tự bắt buộc là **format → lint → typecheck → build → unit coverage → E2E → Sonar**. Lint chỉ
pass khi đúng 0 errors và 0 warnings. Command không được khai báo là gate absent, không phải pass.

Unit coverage phải báo statements/lines (S/L), functions (F) và branches: S/L/F ≥80%, branches ≥75%, và
mỗi metric của patch/new code ≥90%. E2E phải có entrypoint đã khai báo và tồn tại, có test thật, mọi test
đều pass. `skip`, `todo`, `only`, `passWithNoTests`, run zero-test hoặc focused/check substitute đều bị reject. Sonar là
gate cuối và phải pass cho mọi routed role. Không gate nào được weaken hoặc đổi thứ tự.
Unit là coverage producer duy nhất cho Codecov và Sonar; E2E là behavioral lane độc lập, không được mutate
hay đóng góp vào coverage đó, và file E2E bị loại khỏi Sonar scanner scope. Verdict E2E và Sonar không
bao giờ suy ra hoặc đổi nhãn cho nhau.
Trên cả frontend và backend, unit file nằm cạnh production owner và dùng `.spec.`. Chỉ backend E2E được
ở cây test riêng; frontend có bucket `src/tests`/`e2e` hoặc unit file `.test.` là stale.
Unit spec phải hermetic: fixture là test data được track trong repo hoặc mock in-memory. Unit spec đọc
`.gitmounts` hay checkout external khác là stale; dependency đó thuộc lane integration/E2E được phân loại rõ.
Patch/new-code chỉ `not applicable` khi diff từ base SHA chứng minh không có authored production code
thay đổi; working-tree diff rỗng, thiếu base SHA hoặc thiếu coverage entry không phải N/A.

Record `@stale-debts` còn hạn chỉ được xếp project coverage, patch coverage hoặc Sonar thành `debt`.
Gate đo được vẫn đỏ/chưa đo và không đủ cho `ready`; chỉ delivery được đi tiếp. Lint, typecheck, build,
unit execution và E2E vẫn blocking và không được ghi nợ.

## Tách lane

Unit coverage và E2E là hai gate độc lập. Unit lane là coverage producer duy nhất: nó sinh LCOV và summary
bốn metric cho Codecov cùng Sonar. E2E lane chỉ chứng minh behavior deployed hoặc integrated; nó không được
sinh, merge, overwrite, xóa hay làm tăng unit coverage evidence, và file E2E không bao giờ nằm trong Sonar
analysis hay coverage. E2E pass không suy ra Sonar pass, Sonar pass không suy ra E2E pass, và failure của lane nào phải
được report đúng lane đó thay vì đổi nhãn sang lane kia.

## Evidence cho stale list

Đọc manifest và list primary entrypoint cho mọi routed role. Chạy mọi gate theo thứ tự bắt buộc trên; không
bỏ E2E hay Sonar vì tốn thời gian. Cache/output ignored được phép sinh; tracked source không được đổi.
Ghi command, exit code, lint error/warning, coverage metric, E2E entrypoint/test/pass count và Sonar verdict.
Thiếu prerequisite, entrypoint, test thật, coverage report hoặc evidence Sonar external là
`unmeasured`/`absent`, không đủ cho `ready`.
Đọc `.worktrees/<project>/debts/<role>.md` sau khi route hợp lệ và report finding được nhận nợ riêng.

## Inventory cho repair

Đọc manifest trước khi chạy. Không invent command. Chạy gate đã khai báo theo thứ tự bắt buộc: format, lint,
typecheck, build, unit coverage, E2E, Sonar. Ghi exact error, warning, coverage metric, failing suite/test,
entrypoint existence và Sonar status trước source write đầu tiên. Mandatory gate thiếu là finding, không phải
quyền đi tiếp.

## Apply

Classify finding trước repair:

| Class | Apply |
|---|---|
| `format` | một mechanical formatting pass do ESLint sở hữu |
| `mechanical` | safe autofix rồi đọc mọi hunk |
| `defect` | hand repair nhỏ nhất, mỗi file một owner |
| `decision` | trả owner; không weaken gate |

Formatting, mechanical change và defect là các commit riêng. Không thêm disable, hạ severity, bỏ rule,
skip test hay thêm `any` chỉ để mua màu xanh.

## Proof

Chạy lại đúng gate ban đầu, cùng thứ tự, và report before/after count cùng metric. Zero chỉ hợp lệ với cùng
command, checkout revision, machine và không suppression. Verdict ready cần format pass; lint 0 error/0
warning; typecheck/build pass; unit S/L/F ≥80%, branches ≥75%, patch/new metric ≥90%; E2E entrypoint thật
và mọi test pass; Sonar pass cuối cùng.
Verdict `debt` có thể cho delivery đi tiếp theo `@stale-debts`; nó không phải ready hay gate pass.
