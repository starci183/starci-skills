---
id: fe-blocks-laws-b13-closed-data-vi
title: vi.md
slug: /fe/blocks/laws/b13-closed-data/vi
sidebar_label: vi.md
sidebar_position: 1
description: Hàng rào dữ liệu đóng, và nửa còn lại của hợp đồng props mà năm khối đang phá.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `b13-closed-data` · Luật: [`INDEX.md`](./INDEX.md)

# Dữ liệu đóng

Khoảnh khắc một component nhận `ReactNode`, nó thôi là một khối. Nó thành một cái khung, và cái gì
nằm trong khung là chuyện của nơi gọi — nghĩa là không ai còn trả lời được câu hỏi "cái này hiện ra
những gì".

Phán quyết viết đúng một câu: nội dung tuỳ ý biến nó thành một branch và phá hàng rào dữ liệu đóng.

## Bảng tra

| Mã | Tình huống | Luật |
|---|---|---|
| `B13-1` | Nơi gọi muốn đưa nội dung vào | bị bác — khối nhận dữ liệu và tự vẽ |
| `B13-2` | Một chỗ cần nội dung cuối tuỳ ý | thành một trường dữ kiện đóng |
| `B13-3` | Thật sự phải truyền một phần ruột qua | chỉ shell được, và chỉ có hai shell |
| `B13-4` | Cần hai cách sắp | một discriminant đóng trong `props` |
| `B13-5` | Khối cần biết mình đang tải | tự tính và **viết xuống**; nhận vào là sai |

## Đo được

Toàn tầng block: **0** `ReactNode`, **0** prop `children` của React. Mười một chỗ có chữ `children`
đều là trường `children` của registry contract, không phải của React.

Đây là luật được tuân tuyệt đối ở vế thứ nhất.

## Vế thứ hai đang bị phá

Cùng cái tệp định nghĩa `BlockProps` viết:

> There is no `isLoading` here - a block writes the flag when it hands a tree down, and never
> receives one.

Năm khối vẫn nhận nó trong props công khai: `StarCiAiFab`, `FeedExplorer` (`isLoadingMore`),
`LearnSpine`, `SkillSnapshot`, `GlobalSearchResults`. Không rule lint nào bắt cái này.

Vì sao nó quan trọng: cờ tải là **kết luận** của việc đọc một request. Khối nào nhận nó thì đang
nhận kết luận của người khác về một request mà nó không thấy — và khi hai bên bất đồng, không ai
biết bên nào đúng.

## `B13-2` — cách thay nội dung tuỳ ý

Đề xuất ban đầu: `endComponent: ReactNode` ở cuối hàng. Bị bác ba lần trong cùng một hồ sơ. Cách
thay: một trường `endText` đóng, và contract sở hữu cách vẽ nó. Nơi gọi đưa chữ; typography không
phải chuyện của nơi gọi.
