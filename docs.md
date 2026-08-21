---
id: starci-trust-docs
title: Tài liệu StarCi Skills
slug: /reference
sidebar_position: 1
---

# Tài liệu StarCi Skills

Tài liệu này trỏ vào frontend gates dùng chung và grammar riêng của từng project. Không còn
`fe/senses/` dùng chung: lựa chọn sản phẩm phải resolve từ grammar id khai báo trong workspace.

| Nhóm | Chứa gì | Không chứa |
|---|---|---|
| `fe/gates/principles/` | Primitive facts và principles không được phá luật | Product judgement, migration process |
| `grammars/<grammar>/` | Closed facts, deterministic outcomes, obligations và owners | Luật UI dùng chung hoặc grammar được suy luận ngầm |

Module chuẩn có **năm** record:

| File | Vai trò |
|---|---|
| `INDEX.md` | Machine-first law và semantic className |
| `vi.md` | Bảng quyết định, luật, ví dụ và ngoại lệ bằng tiếng Việt |
| `example.md` | Tình huống generic cùng UI/Code trực quan, kèm bảng ánh xạ yêu cầu sang className |
| `audit.md` | Phản biện ambiguity, hallucination và re-audit trigger |
| `changelog.md` | Lịch sử version, audit decision và verification |

Project grammar không dùng module prose năm record. Mỗi project giữ `grammar.schema.json`,
`grammar.json`, `profile.json` và các golden case có thể chạy lại không cần LLM.

## Principles · facts

| Module | Luật AI | Hướng dẫn Việt | UI/Code | Audit | Changelog |
|---|---|---|---|---|---|
| Colour | [INDEX](fe/gates/principles/colour/INDEX.md) | [vi](fe/gates/principles/colour/vi.md) | [example](fe/gates/principles/colour/example.md) | [audit](fe/gates/principles/colour/audit.md) | [changelog](fe/gates/principles/colour/changelog.md) |
| Gap | [INDEX](fe/gates/principles/gap/INDEX.md) | [vi](fe/gates/principles/gap/vi.md) | [example](fe/gates/principles/gap/example.md) | [audit](fe/gates/principles/gap/audit.md) | [changelog](fe/gates/principles/gap/changelog.md) |
| Margin | [INDEX](fe/gates/principles/margin/INDEX.md) | [vi](fe/gates/principles/margin/vi.md) | [example](fe/gates/principles/margin/example.md) | [audit](fe/gates/principles/margin/audit.md) | [changelog](fe/gates/principles/margin/changelog.md) |
| Padding | [INDEX](fe/gates/principles/padding/INDEX.md) | [vi](fe/gates/principles/padding/vi.md) | [example](fe/gates/principles/padding/example.md) | [audit](fe/gates/principles/padding/audit.md) | [changelog](fe/gates/principles/padding/changelog.md) |
| Position | [INDEX](fe/gates/principles/position/INDEX.md) | [vi](fe/gates/principles/position/vi.md) | [example](fe/gates/principles/position/example.md) | [audit](fe/gates/principles/position/audit.md) | [changelog](fe/gates/principles/position/changelog.md) |
| Responsive | [INDEX](fe/gates/principles/responsive/INDEX.md) | [vi](fe/gates/principles/responsive/vi.md) | [example](fe/gates/principles/responsive/example.md) | [audit](fe/gates/principles/responsive/audit.md) | [changelog](fe/gates/principles/responsive/changelog.md) |
| Surface in surface | [INDEX](fe/gates/principles/surface-in-surface/INDEX.md) | [vi](fe/gates/principles/surface-in-surface/vi.md) | [example](fe/gates/principles/surface-in-surface/example.md) | [audit](fe/gates/principles/surface-in-surface/audit.md) | [changelog](fe/gates/principles/surface-in-surface/changelog.md) |
| Typography | [INDEX](fe/gates/principles/typography/INDEX.md) | [vi](fe/gates/principles/typography/vi.md) | [example](fe/gates/principles/typography/example.md) | [audit](fe/gates/principles/typography/audit.md) | [changelog](fe/gates/principles/typography/changelog.md) |

## Project grammars

| Project | Luật | Owners | Golden cases |
|---|---|---|---|
| StarCi | [grammar](grammars/starci/grammar.json) | [profile](grammars/starci/profiles/starci-academy.json) | [course content map](grammars/starci/cases/course-content-map.json) |

Resolver deterministic nằm tại `scripts/resolve-fe-grammar.mjs`; Layout, Block và Execute đều giữ
receipt của đúng grammar project.
