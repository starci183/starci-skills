---
id: fe-blocks-archetypes-the-tong-ket-mot-chi-so-kem-hanh-dong-vi
title: vi.md
slug: /fe/blocks/archetypes/the-tong-ket-mot-chi-so-kem-hanh-dong/vi
sidebar_label: vi.md
sidebar_position: 1
description: Một thẻ, một hình chính, một hành động đổi được kết quả.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `the-tong-ket-mot-chi-so-kem-hanh-dong` · Luật: [`INDEX.md`](./INDEX.md)

# Thẻ tổng kết một chỉ số kèm hành động

Sáu chỗ dùng: vị trí trong league, thử thách tuần, độ sẵn sàng nghề, chuỗi ngày học, nhiệm vụ ngày,
lịch đóng góp.

## Cái tách nó khỏi `A1`

**Sự chi phối.** Trong `A1` không hàng nào quan trọng hơn hàng nào. Trong `A3` có một hình chính mà
mắt rơi vào trước, và mọi thứ còn lại bổ nghĩa cho nó.

## Cái tách nó khỏi một card thường

**Hành động đổi được kết quả.** Không phải một nút "xem thêm" — mà một mutation mà sau khi chạy, con
số trên thẻ khác đi.

## Chữ ký của archetype: vắng mặt, không phải disabled

Khi kết quả đã được lấy, nút **biến mất** và một badge thế chỗ. Không phải nút xám.

Vì sao: một nút xám nói "ở đây có thứ bạn không được lấy". Câu đó thường sai — thứ đó đã được lấy
rồi. Sự vắng mặt nói đúng: ở đây không còn gì cho bạn nữa.

Có một bài test khẳng định điều này: ở trạng thái chưa xong và đã nhận, container **không có** button
nào.

## Giải phẫu

1. `SurfaceCard` ngoài giữ nhãn và see-more.
2. Thân là một composite hình chính.
3. Tuỳ chọn: một `SurfaceListCard` lồng, dùng **lại** đúng nhãn ngoài.
4. Nút mang cờ pending **riêng**, để ngoài `state`.
5. Thang bốn bậc `failed → pending → empty → ready`.

## Trước khi vẽ nút, kiểm mutation có thật

`DailyQuest` có nhánh `claimable` **không đạt tới được** từ đường sống, vì toàn repo không có mutation
nhận thưởng nào. Một control không có mutation là một nhánh chết; kế hoạch phải báo thiếu backend
thay vì vẽ nút.
