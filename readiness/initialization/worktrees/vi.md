---
title: Khởi tạo · worktrees
---

# Worktrees

## LOADS

None.

`<Source>/.worktrees/<project>/{registries,business,cache}` là write boundary của project. Design registry
và business authority là hai linked worktree riêng đã lock trên `codex/fe-design-registry/<project>` và
`codex/business/<project>`; cache là local state dựng lại được đã ignore và draft chưa xong nằm dưới
`cache/drafts`.

Đo bằng `git worktree list`, rồi verify path, lock, cleanliness, branch, Git common-directory owner và
cache ignore rule. Phân loại `create`, `reuse`, hoặc `migrate-legacy`. Foreign owner, dirty legacy registry hay
branch collision sẽ chặn boundary. Prune stale worktree qua Git, không xóa thư mục trực tiếp, và không
chạy destructive Git từ background agent.

Evidence là account worktree của Git cùng path và owner đã đo. Action chỉ create, reuse hoặc migrate an
toàn project root. Proof cho thấy cả hai durable root đã lock, clean, đúng owner và branch; cache được
ignore; và không còn state ở legacy path bị từ chối hay trong trust tree.
