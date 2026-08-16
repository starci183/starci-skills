---
id: fe-blocks-laws-b3-block-owns-its-frame-audit
title: audit.md
slug: /gates/blocks/laws/b3-block-owns-its-frame/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật B3 và một vi phạm sống chưa được gate nào bắt.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `b3-block-owns-its-frame`

## Kết luận

Chấp nhận. Đây là luật được giữ tốt nhất trên kệ, và được giữ bằng **kiểu dữ liệu** chứ không bằng
lời nhắc.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `B3-1` so với `B3-5` | Loại trừ được: khoảng đệm không cần biết hàng xóm, vị trí thì cần |
| `B3-2` so với `B3-3` | Loại trừ được: cuộn là hành vi, giới hạn là một con số phải có tên |
| `B3-4` so với chuyện của trang | Loại trừ được bằng câu hỏi "có đổi route hoặc request không" |
| `B3-6` so với mọi mã | Không cần phân định: giá trị sai không biểu diễn được |

## Repo sống đang ở đâu

**Đang tuân gần như tuyệt đối.** 0 `className`, 0 class định vị trong toàn tầng block. Vi phạm duy
nhất là `StarCiAiFab`, và nó là inline style duy nhất của cả tầng.

## Nhận định

- Vi phạm của FAB không có rule lint nào bắt: các luật hiện có nhắm vào `className`, còn đây là
  `style`. Đây là một khoảng trống đo được của gate lint, không phải một ngoại lệ của luật.
- Câu "nơi gọi chỉ cấp vị trí" mới được chứng minh từ **phía khối** (0 prop kiểu dáng nhận vào) và
  từ hai trang mẫu. Chưa quét hết `pages/` và `overlays/`, nên phía trang vẫn là suy luận có mẫu,
  không phải phép đo đầy đủ.
- Ranh giới `B3-4` sạch về lời nhưng chưa được đo: chưa đếm hết những chỗ dùng `useState` trong nửa
  connected để xác nhận không chỗ nào là lựa chọn hiển thị bị đẩy lên nhầm tầng.
