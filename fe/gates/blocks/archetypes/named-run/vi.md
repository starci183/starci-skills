---
id: fe-blocks-archetypes-named-run-vi
title: vi.md
slug: /gates/blocks/archetypes/named-run/vi
sidebar_label: vi.md
sidebar_position: 1
description: Archetype đông nhất của tầng khối: một tập hàng đồng hạng dưới một cái tên.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `named-run` · Luật: [`INDEX.md`](./INDEX.md)

# Bảng danh sách có nhãn

Đây là hình dạng phổ biến nhất trong sản phẩm: bảng xếp hạng, khoá đang học, gợi ý khoá, nội dung
thịnh hành, changelog, người nên theo dõi, livestream sắp tới. Mười một khối dựng hàng nghỉ từ
`restingCount` của contract.

## Nó phục vụ gì

Một tập hàng **đồng hạng** dưới một cái tên. "Đồng hạng" là điều kiện, không phải mô tả: nếu các
hàng không so sánh được với nhau thì việc dính chúng vào một khung không giúp gì, và đây là archetype
sai.

## Giải phẫu

1. Import theo tầng: branches → composites → leaves → contracts.
2. `XData` mở rộng `SurfaceListCardData`.
3. `XActions` là index signature `() => void | undefined`.
4. `XProps` gồm `state`, `props`, `on?`.
5. Một sub-view riêng bọc bằng `defineContractComponent("<list-contract>")`.
6. `_X`: nhánh rỗng/lỗi trả sớm, nhánh sẵn sàng cuối cùng.
7. `meta`.

Thứ tự này không phải sở thích. Nó là thứ tự mọi bản đang dùng, và nó làm cho khối thứ hai đọc được
bởi người đã đọc khối thứ nhất.

## Bốn thứ đến từ contract, không từ khối

- **Số hàng nghỉ.** `CONTRACTS[key].children.<slot>.restingCount`.
- **Template cột.** Một grid cố định cho mọi hàng.
- **Đường phân cách và bo góc.** Nằm trong `classes` của list contract.
- **Câu `why`.** Giải thích vì sao những con này ngồi cạnh nhau.

Khối không chạm được vào cái nào trong bốn thứ đó, và đó là lý do các danh sách trong sản phẩm nhìn
như một họ.

## Khi nào không dùng archetype này

- Dữ liệu đến từ nơi gọi chứ không từ request của chính khối → đó là `A4`.
- Các hàng không so sánh được với nhau → không phải danh sách, mà là một thẻ có nhiều phần.
- Chỉ có một hàng và nó là hình chính → đó là `A3`.
