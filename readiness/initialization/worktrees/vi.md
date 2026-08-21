---
title: Khởi tạo · worktrees
---

# Worktrees

## LOADS

None.

`<Source>/.worktrees/<project>/{businesses,cache}` là write boundary của project. Business authority là linked
worktree đã lock trên `codex/businesses/<project>`; cache là local state dựng lại được đã ignore. Design candidate
và preview nằm dưới `cache/design/<session-id>` và được implement trong cùng invocation.

Đo bằng `git worktree list`, rồi verify business path, lock, cleanliness, branch, Git common-directory owner và
cache ignore rule. Phân loại `create`, `reuse`, hoặc `migrate-legacy`. Foreign owner hoặc branch collision sẽ
chặn boundary. Prune stale worktree qua Git, không xóa thư mục trực tiếp, và không
chạy destructive Git từ background agent.

Evidence là account worktree của Git cùng path và owner đã đo. Action chỉ create, reuse hoặc migrate an
toàn project root. Proof cho thấy business root đã lock, clean, đúng owner và branch; cache được ignore; không có
design-registry worktree; và không còn state ở legacy path bị từ chối hay trong trust tree.
