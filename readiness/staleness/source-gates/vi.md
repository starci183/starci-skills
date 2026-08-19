---
title: Source gates
---

# Source gates

## LOADS

None.

## Dấu hiệu stale

Gate contract đã khai báo của repository absent, incomplete, fail hoặc không executable cho mọi routed role
là stale. Thứ tự bắt buộc là **format → lint → typecheck → build → unit coverage → E2E → Sonar**. Lint chỉ
pass khi đúng 0 errors và 0 warnings. Command không được khai báo là gate absent, không phải pass.

Unit coverage phải báo statements/lines (S/L), functions (F) và branches: S/L/F ≥80%, branches ≥75%, và
mỗi metric của patch/new code ≥90%. E2E phải có entrypoint đã khai báo và tồn tại, có test thật, mọi test
đều pass. `skip`, `todo`, `only`, `passWithNoTests`, run zero-test hoặc focused/check substitute đều bị reject. Sonar là
gate cuối và phải pass cho mọi routed role. Không gate nào được weaken hoặc đổi thứ tự.

## Evidence cho stale list

Đọc manifest và list primary entrypoint cho mọi routed role. Chạy mọi gate theo thứ tự bắt buộc trên; không
bỏ E2E hay Sonar vì tốn thời gian. Cache/output ignored được phép sinh; tracked source không được đổi.
Ghi command, exit code, lint error/warning, coverage metric, E2E entrypoint/test/pass count và Sonar verdict.
Thiếu prerequisite, entrypoint, test thật, coverage report hoặc evidence Sonar external là
`unmeasured`/`absent`, không đủ cho `ready`.

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
