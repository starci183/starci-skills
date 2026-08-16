---
id: fe-senses-press-affordance-changelog
title: changelog.md
slug: /fe/senses/press-affordance/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản nội bộ của module press-affordance.
---

# changelog.md

> Current version: `1.02` · Module: `press-affordance` · Audit hiện hành: [`audit.md`](./audit.md)

## Quy ước version

- Version thuộc toàn module.
- Mỗi nhóm thay đổi được chấp nhận tăng `0.01`.
- Mọi record trong module hiển thị cùng version.
- Audit finding không tự tăng version.
- Không sửa lịch sử đã phát hành; correction đi vào version mới.

## 1.02 — 2026-08-16

### Added

- Implement mười một HeroUI v3 interaction demos trong registry tách riêng.
- Thêm state cho immediate route feedback, bookmark ownership, handler removal, current selection,
  drag lifecycle và reduced motion.
- Thêm Code tab riêng khớp từng UI demo.

### Changed

- Cập nhật audit thành “đã integration”; pointer/focus/touch QA sâu vẫn là browser review riêng.
- Dùng Link/Button sibling owners trong nested cases thay vì lồng interactive element sai semantics.

### Audit decisions

- Accepted: resting Card không đủ; demo phải có interaction state thật.
- Accepted: touch cue luôn hiện và handler/affordance cùng biến mất.
- Deferred: browser pointer/focus/touch QA và full Nextra build cho root sau merge.

### Verification

- Babel JSX parse.
- esbuild browser bundle riêng cho `interaction.js` và CSS module.
- Registry có đúng mười một press IDs duy nhất.

## 1.01 — 2026-08-16

### Added

- Tạo module folder gồm `INDEX.md`, `vi.md`, `example.md`, `audit.md`, `changelog.md`.
- Thêm machine decision procedure từ activation owner tới hover, press, focus, touch và nested suppression.
- Thêm hướng dẫn tiếng Việt cho naming-line/surface answer, keyboard, touch, states, drag và reduced motion.
- Thêm mười một live-demo declarations cùng ma trận mười hai situation thực tế.

### Changed

- Giữ đủ sáu ruling gốc và diễn đạt lại bằng review output compact cho AI.
- Mở rộng human guidance cho touch discovery, selected/current distinction, handler-absent và drag.
- Không đặt measurement cho drag threshold hoặc invent link token trong design law.

### Audit decisions

- Accepted: press affordance phải được verify bằng interaction, không phải resting screenshot.
- Accepted: nested control phải suppress cả visual answer lẫn activation của outer owner.
- Deferred: exact primitive, event and underline spelling chờ implementation/canon evidence.

### Verification

- Đối chiếu toàn bộ ruling, forbidden và examples của source phẳng.
- Kiểm tra coverage bắt buộc hover, press, focus, touch và inner control.
- Kiểm tra mọi live demo declaration dùng `<CodeUiTabs example="..." />`.
- Chờ Nextra registry/build và interaction QA ở publication layer.
