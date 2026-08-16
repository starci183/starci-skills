---
id: starci-trust-docs
title: Tài liệu StarCi Skills
slug: /reference
sidebar_position: 1
---

# Tài liệu StarCi Skills

Nextra đồng bộ ba nhóm frontend canon từ trust tree hiện hành. Shelf `fe/design/` đã bị tách làm ba
và không còn tồn tại; mọi đường dẫn dưới đây trỏ vào cây hiện tại.

| Nhóm | Chứa gì | Không chứa |
|---|---|---|
| `fe/gates/principles/` | Primitive facts và principles không được phá luật | Product judgement, migration process |
| `fe/senses/` | Quyết định cần business context như CTA, hierarchy, input | Primitive token/geometry law |
| `fe/governance/` | Exception và parity evidence | Visual design output |

Module chuẩn có **năm** record:

| File | Vai trò |
|---|---|
| `INDEX.md` | Machine-first law và semantic className |
| `vi.md` | Bảng quyết định, luật, ví dụ và ngoại lệ bằng tiếng Việt |
| `example.md` | Tình huống generic cùng UI/Code trực quan, kèm bảng ánh xạ yêu cầu sang className |
| `audit.md` | Phản biện ambiguity, hallucination và re-audit trigger |
| `changelog.md` | Lịch sử version, audit decision và verification |

Toàn bộ `fe/gates/principles/` đã **gộp `prompt.md` vào `example.md`** ở version `2.00`: bảng ánh xạ từ
yêu cầu bằng lời sang class nay nằm cùng chỗ với ví dụ mà nó phân định, nên không module principles
nào còn `prompt.md`. Ở `fe/senses/`, hai module `call-to-action` và `input` vẫn còn `prompt.md` như
record thứ sáu; ba module senses còn lại và cả hai module `fe/governance/` đều dừng ở năm record.

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

## Senses

Cột **Yêu cầu** chỉ có ở hai module còn giữ `prompt.md`; ở ba module còn lại, phần ánh xạ yêu cầu
đọc thẳng trong `example.md`.

| Module | Luật AI | Yêu cầu | Hướng dẫn Việt | UI/Code | Audit | Changelog |
|---|---|---|---|---|---|---|
| Call to action | [INDEX](fe/senses/call-to-action/INDEX.md) | [prompt](fe/senses/call-to-action/prompt.md) | [vi](fe/senses/call-to-action/vi.md) | [example](fe/senses/call-to-action/example.md) | [audit](fe/senses/call-to-action/audit.md) | [changelog](fe/senses/call-to-action/changelog.md) |
| Hierarchy | [INDEX](fe/senses/hierarchy/INDEX.md) | — | [vi](fe/senses/hierarchy/vi.md) | [example](fe/senses/hierarchy/example.md) | [audit](fe/senses/hierarchy/audit.md) | [changelog](fe/senses/hierarchy/changelog.md) |
| Input | [INDEX](fe/senses/input/INDEX.md) | [prompt](fe/senses/input/prompt.md) | [vi](fe/senses/input/vi.md) | [example](fe/senses/input/example.md) | [audit](fe/senses/input/audit.md) | [changelog](fe/senses/input/changelog.md) |
| Press affordance | [INDEX](fe/senses/press-affordance/INDEX.md) | — | [vi](fe/senses/press-affordance/vi.md) | [example](fe/senses/press-affordance/example.md) | [audit](fe/senses/press-affordance/audit.md) | [changelog](fe/senses/press-affordance/changelog.md) |
| Restraint | [INDEX](fe/senses/restraint/INDEX.md) | — | [vi](fe/senses/restraint/vi.md) | [example](fe/senses/restraint/example.md) | [audit](fe/senses/restraint/audit.md) | [changelog](fe/senses/restraint/changelog.md) |

## Governance

| Module | Luật AI | Hướng dẫn Việt | UI/Code | Audit | Changelog |
|---|---|---|---|---|---|
| Exception | [INDEX](fe/governance/exception/INDEX.md) | [vi](fe/governance/exception/vi.md) | [example](fe/governance/exception/example.md) | [audit](fe/governance/exception/audit.md) | [changelog](fe/governance/exception/changelog.md) |
| Refactor parity | [INDEX](fe/governance/refactor-parity/INDEX.md) | [vi](fe/governance/refactor-parity/vi.md) | [example](fe/governance/refactor-parity/example.md) | [audit](fe/governance/refactor-parity/audit.md) | [changelog](fe/governance/refactor-parity/changelog.md) |

Sidebar tự khám phá module đủ public records trong cả ba nhóm. Generated content nằm trong
`docs/content`; không sửa trực tiếp.
