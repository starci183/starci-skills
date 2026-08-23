---
title: Adapter điều phối Codex
---

# Adapter điều phối Codex

## LOADS

None.

## Adapter

Dùng `gpt-5.6-sol` làm root coordinator và `gpt-5.6-luna` cho bounded worker. Dispatch tối đa ba Luna worker đồng
thời; chỉ refill slot sau khi một worker hoàn tất hoặc bị interrupt. Dùng `fork_turns: none` hoặc turn window nhỏ
được giới hạn để mỗi worker chỉ nhận task envelope rõ và exact authority path phải đọc. Worker mặc định reasoning
medium trừ khi coordinator ghi một nhu cầu khác đã đo được.

Chỉ Sol root chọn scope, authority và domain decision, consume approval, sở hữu `.claude` cùng provider mutation,
integrate shared target và tuyên bố final verdict. Luna worker mặc định làm evidence inventory, bounded
materialization, repository work tách rời đã duyệt, test và proof capture. Mỗi Luna phải đọc bootstrap `AGENTS.md` của Source và toàn bộ `.claude/INDEX.md` trước task
authority, không được spawn worker khác và phải trả structured receipt.

Nếu Codex collaboration runtime có ít hơn ba worker slot, dùng capacity đã đo. Nếu model đã nêu không khả dụng,
không được thay ngầm: báo adapter mismatch và chạy tuần tự bằng coordinator trừ khi owner duyệt runtime profile khác.

## Evidence

Codex collaboration runtime hiện hành có per-agent model/reasoning override cùng các operation spawn, follow-up,
message, interrupt, list và wait. Hướng dẫn multi-agent của OpenAI giao root agent việc coordination, delegation và
synthesis, còn subagent làm phần việc độc lập bounded; chuỗi tuần tự và shared mutable state không phù hợp để parallel.
