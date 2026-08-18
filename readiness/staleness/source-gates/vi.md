---
title: Source gates
---

# Source gates

## LOADS

None.

## Dấu hiệu stale

Command check-only format, lint, typecheck, build hoặc unit của chính repository fail, hoặc manifest không
khai báo gate surface có nghĩa. Command repository không khai báo là absent, không phải failing.

## Evidence cho stale list

Đọc manifest, list primary entrypoint đã khai báo rồi chạy local các gate check-only theo thứ tự rẻ nhất:
format check, lint, typecheck, build, unit. Cache/output ignored được phép sinh; tracked source không được
đổi. Ghi command, exit code và failure count. Thiếu prerequisite là `unmeasured`, phải nêu prerequisite và
không đủ cho `ready`. Không chạy end-to-end suite trừ khi request gọi tên.

## Inventory cho repair

Đọc manifest trước khi chạy. Không invent command. Chạy gate hiện có theo thứ tự rẻ nhất: format check,
lint, typecheck, build, unit. Không chạy end-to-end suite trừ khi request gọi tên. Ghi exact error, warning,
failing-suite và file count trước source write đầu tiên.

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

Chạy lại đúng gate ban đầu và report before/after count. Zero chỉ hợp lệ với cùng command, checkout
revision, machine và không suppression. Verdict ready phải nêu mọi local gate đã chạy cùng exit status 0.
