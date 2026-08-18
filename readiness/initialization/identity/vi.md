---
title: Khởi tạo · identity
---

# Identity

## LOADS

None.

Identity của máy nằm tại `~/.starci/master.identity`. Đây là private machine state: không commit, không
chép vào `.workspace`, không đặt trong command argument, và không in nội dung hay secret material suy ra.

Chạy `node .claude/scripts/init-identity.mjs --source <Source> --plan` trước. Preflight chứng minh `sops`,
`age`, `age-keygen` gọi được, validate identity bằng `age-keygen -y`, rồi verify một lượt decrypt thật.
Nếu Source đã có ciphertext, encrypted record đầu tiên là sample và phải import đúng identity gốc qua
hidden input hoặc `--from-file`. Tạo identity mới trong trạng thái này bị từ chối vì sẽ làm ciphertext
hiện có vĩnh viễn không thuộc máy.

Nếu chưa có ciphertext, script có thể tạo identity đầu tiên và verify bằng sample SOPS+age tạm trước khi
cài. Identity đang tồn tại chỉ được reuse, không replace. `--from-file` được đọc không echo và không bị
xóa; operator vẫn sở hữu file nguồn.

Verdict là `ready`, `import-required`, `generate`, hoặc `blocked`. Evidence gồm tool, identity, ciphertext
và sample; action reuse, import hoặc generate đúng một identity; proof validate public recipient và
decrypt sample. Action này không cho phép ghi bootstrap, route, worktree, secret, network hay product.
