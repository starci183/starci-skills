---
title: Source gates
---

# Source gates

## Dấu hiệu stale

Command check-only format, lint, typecheck, build hoặc unit của chính repository fail, hoặc manifest không
khai báo gate surface có nghĩa. Command repository không khai báo là absent, không phải failing.

## Evidence cho stale list

Đọc manifest và chỉ list primary entrypoint đã khai báo. Đánh kết quả `unmeasured`: stale-list không chạy
project gate vì typecheck/build/test có thể ghi cache, output và incremental state.

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

Chạy lại đúng gate ban đầu và report before/after count. Zero chỉ hợp lệ với cùng command, cùng machine và
không suppression.
