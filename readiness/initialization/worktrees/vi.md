---
title: Khởi tạo · worktrees
---

# Worktrees

## LOADS

None.

`<Source>/.worktrees/<project>/{businesses,debts}` là boundary linked-worktree bền vững. Business authority dùng
`codex/businesses/<project>` và accepted debt dùng `quality-debts/<project>`. Design candidate cùng preview nằm
dưới `<Source>/.sessions/<project>/<session-id>/design` và được implement trong cùng invocation.

Đo bằng `git worktree list`, rồi verify business path, lock, cleanliness, branch, Git common-directory owner và
debt worktree cùng session ignore rule. Phân loại `create`, `reuse`, hoặc `migrate-legacy`. Foreign owner hoặc branch collision sẽ
chặn boundary. Prune stale worktree qua Git, không xóa thư mục trực tiếp, và không
chạy destructive Git từ background agent.

Evidence là account worktree của Git cùng path và owner đã đo. Action chỉ create, reuse hoặc migrate an
toàn project root. Proof cho thấy business root đã lock, clean, đúng owner và branch; debt root đúng owner/branch; session được ignore; không có
design-registry worktree; và không còn state ở legacy path bị từ chối hay trong trust tree.
