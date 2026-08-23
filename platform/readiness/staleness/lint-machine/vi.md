---
title: Lint machine
---

# Lint machine

## LOADS

None.

## Dấu hiệu stale

Checkout không cài published StarCi lint canon theo package name, hoặc ESLint config import vendored rule
copy. Green count trước check này không phải evidence.

## Evidence cho stale list

Report đúng một verdict mỗi role:

- `installed`: package có mặt và config import theo package name.
- `absent`: thiếu package; không có gì có nghĩa được check.
- `vendored`: config import relative/private rule copy; kết quả nhắm vào snapshot sẽ drift.

Không chạy lint cho verdict read-only này.

## Inventory cho repair

Đọc manifest, lockfile, ESLint config và mọi relative rule import. Giữ glob và severity configuration của
repository; pass này sở hữu machine adoption, không sở hữu local policy.

## Apply

Lấy repair baseline trước installation. Dùng package manager tôn trọng lockfile, cài published canon, bỏ
vendored rule implementation và repoint import sang package. Không author hoặc patch rule trong consumer checkout.

## Proof

Manifest/lockfile cài canon, ESLint import theo package name, không còn vendored implementation reachable,
rồi source-gate count mới được đo lần đầu.
