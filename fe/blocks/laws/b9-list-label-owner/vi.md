---
id: fe-blocks-laws-b9-list-label-owner-vi
title: vi.md
slug: /fe/blocks/laws/b9-list-label-owner/vi
sidebar_label: vi.md
sidebar_position: 1
description: Nhãn của một danh sách thuộc về branch, và điều kiện duy nhất được phép ẩn nó.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `b9-list-label-owner` · Luật: [`INDEX.md`](./INDEX.md)

# Nhãn của list thuộc về branch

Có hai cách để một danh sách có tên. Cách đúng: branch tự in tiêu đề, khối đưa xuống chuỗi chữ. Cách
sai: khối vẽ một heading bên ngoài, rồi bảo danh sách bên trong giấu tên đi.

Cách sai trông giống hệt cách đúng trên màn hình, và đó là lý do nó tồn tại được lâu. Nó chỉ lộ ra
khi có người dùng lại cái danh sách đó ở chỗ thứ hai — chỗ không có heading ngoài — và danh sách
xuất hiện không tên.

## Bảng tra

| Mã | Tình huống | Luật |
|---|---|---|
| `B9-1` | Một list surface có tên | branch in, khối đưa dữ liệu |
| `B9-2` | Heading ngoài + ẩn nhãn trong | bị bác |
| `B9-3` | List lồng trong mặt phẳng đã vẽ **đúng cái nhãn đã resolve đó** | được ẩn, và phải nêu tên chủ ngoài |
| `B9-4` | Thành viên không phải list muốn ẩn nhãn | không có — field này chỉ dành cho list |

## Điều kiện của `B9-3`, đọc kỹ

Phán quyết dùng ba chữ quan trọng: **exact resolved label**. Nghĩa là:

- Không phải một nhãn **na ná**.
- Không phải một nhãn chỉ tồn tại làm **tên cho trình đọc màn hình**.
- Đúng cái chuỗi đó, đang **hiện trên màn hình**, do một chủ bao ngoài vẽ.

Chỗ sống đúng: `TopLearners`. `SurfaceCard` bên ngoài vẽ `input.props.label`, danh sách bên trong ẩn
đúng nhãn ấy.

Chỗ sống sai: `GlobalSearchResults`. Overlay truyền `copy.resultsLabel` xuống, khối ẩn nó, và
`resultsLabel` **không được vẽ ở bất cứ đâu** — nó chỉ tồn tại làm accessible name của
`SelectionList`. Đây là `B9-2` mặc áo `B9-3`.

## `isNested` không kéo theo `isLabelHidden`

Hai cờ, hai tuyên bố. Lồng nói về **ranh giới**; ẩn nhãn nói về **tên**. Một danh sách lồng vẫn có
thể cần tên của nó, và một danh sách không lồng vẫn có thể trùng tên với chủ ngoài.
