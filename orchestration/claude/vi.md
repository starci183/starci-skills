---
title: Adapter điều phối Claude
---

# Adapter điều phối Claude

## LOADS

None.

## Adapter

Dùng alias local hỗ trợ `opus` cho coordinator và `sonnet` cho bounded background worker. Dispatch tối đa ba
Sonnet worker đồng thời và refill slot đã hoàn tất. Mỗi background task nhận agent definition hoặc prompt envelope
rõ, allowed tool, exact working directory, model, effort và permission mode. Worker mặc định dùng medium effort.

Chỉ Opus coordinator chọn journey và UI direction, consume approval, sở hữu `.claude`, integrate shared source và
tuyên bố parity. Sonnet worker mặc định làm evidence inventory, sinh cache HTML, code product tách rời đã duyệt,
chạy seed, test và browser capture. Worker phải đọc bootstrap Source và toàn bộ `.claude/INDEX.md`, không được tạo
child agent và trả common structured receipt.

Chỉ dùng Claude Code background agent khi runtime đã cài có capability `--agents` hoặc `agents` và model alias yêu
cầu. Đo các capability này lúc bắt đầu run. Nếu không có, chạy tuần tự bằng coordinator; không đoán model name hay
bypass permission policy.

## Evidence

Source host đã đo đang chạy Claude Code 2.1.207. CLI có custom agent, background agent management, model selection
với alias `opus` và `sonnet`, effort, working-directory và permission control. Adapter này chỉ ghi capability đã
quan sát tại local.
