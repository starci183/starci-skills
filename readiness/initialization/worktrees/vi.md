---
title: Khởi tạo · worktrees
---

# Worktrees

## LOADS

None.

`<Source>/.worktrees/<project>/{registries,sessions,cache}` là write boundary của project. Registry là
linked worktree được lock trên branch của project; sessions và cache là local state đã ignore.

Đo bằng `git worktree list`, rồi verify path, lock, cleanliness, branch, Git common-directory owner và
ignore rule. Phân loại `create`, `reuse`, hoặc `migrate-legacy`. Foreign owner, dirty legacy registry hay
branch collision sẽ chặn boundary. Prune stale worktree qua Git, không xóa thư mục trực tiếp, và không
chạy destructive Git từ background agent.

Evidence là account worktree của Git cùng path và owner đã đo. Action chỉ create, reuse hoặc migrate an
toàn project root. Proof cho thấy registry đã lock, clean, đúng owner và branch; sessions cùng cache được
ignore; và không còn state ở legacy path bị từ chối hay trong trust tree.
