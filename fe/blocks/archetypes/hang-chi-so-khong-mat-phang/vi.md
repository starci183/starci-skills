---
id: fe-blocks-archetypes-hang-chi-so-khong-mat-phang-vi
title: vi.md
slug: /fe/blocks/archetypes/hang-chi-so-khong-mat-phang/vi
sidebar_label: vi.md
sidebar_position: 1
description: Bốn hàng chỉ số trên rail: nhỏ nhất, độc lập nhất, và cố ý không có mặt phẳng.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `hang-chi-so-khong-mat-phang` · Luật: [`INDEX.md`](./INDEX.md)

# Hàng chỉ số không có mặt phẳng

Bốn khối: chuỗi ngày học, xu, thưởng, danh tính. Mỗi khối đúng một request, và cả bốn đều **không**
dựng surface.

## Vì sao không có mặt phẳng

Không phải vì chúng nhỏ. Vì contract của **vùng** đã khai đây là dải trần, và câu `why` của contract
nói rõ lý do: các dữ kiện danh tính tạo thành một rail 288px trần, để nhãn của chúng thẳng hàng với
nhau mà không có một mặt phẳng bao ngoài đi tranh chỗ với các card nội dung.

Một khối tự mọc card ở đây sẽ phá đúng cái nhịp mà rail đang giữ.

## Vì sao mỗi khối một request

Đây là archetype được sinh ra từ một lần sửa lỗi. Trước đó có một component đọc **ba** request và
cho chúng chung một cờ, nên cái ví trả lời trong 80ms phải chờ hạn mức AI mất 600ms.

Ba request settle ở ba thời điểm, nên chúng là ba khối. Hệ quả nhìn thấy được: ba hàng hiện ra khi
từng cái trả lời xong, thay vì cả ba cùng chờ cái chậm nhất. `IdentityRail` ghi thẳng cái đánh đổi
đó: lệch nhịp còn hơn bị giữ làm con tin.

## Giải phẫu

- Không import branch nào.
- Union rời rạc: `{state:'empty'} | {state:'pending', props:{label}} | {state:'settled', props:{label,value}}`.
- `_X` trả `null` khi `empty`, ngược lại trả đúng một `IconLabelFactRow` với `recipe: "peer"`.
- Nửa connected tự tính `hasFailed` rồi `isLoading`, và gộp lỗi vào `empty`.

## Chỗ dễ sai

Tính `isLoading` **trước** `hasFailed`. Thư viện fetch thử lại một khoá hỏng theo backoff và báo
`isLoading` mỗi lần, nên hàng sẽ shimmer vĩnh viễn. Thứ tự đúng đã được viết thành chú thích ngay
trong mã.
