---
id: fe-blocks-laws-b13-closed-data-audit
title: audit.md
slug: /fe/blocks/laws/b13-closed-data/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật B13: vế một tuân tuyệt đối, vế hai không có gate.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `b13-closed-data`

## Kết luận

Chấp nhận. Vế `ReactNode` là luật được tuân tuyệt đối duy nhất trên kệ; vế `isLoading` thì không, và
khoảng cách giữa hai vế nói lên đúng một điều: cái được gate giữ thì sống, cái chỉ có lời thì trôi.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `B13-1` so với `B13-3` | Loại trừ được bằng danh sách đóng hai shell |
| `B13-2` so với `B13-1` | Loại trừ được: một trường chữ là dữ liệu, một node thì không |
| `B13-5` so với `B11` | Loại trừ được: `b11` hỏi *ai chờ*, `b13-5` hỏi *ai tính ra là đang chờ* |

## Nhận định

- Vế một được giữ bằng kiểu dữ liệu (`ComponentData` không nhận node) nên nó tự bảo vệ. Vế hai chỉ
  được nói trong một docstring của `props.ts`, và năm khối đã trôi khỏi nó.
- Chưa chạy lint hay `tsc` để chứng minh năm khối đó thực sự đi qua gate xanh. Khẳng định "không rule
  nào bắt" đọc từ nguồn rule, chưa phải bằng chứng chạy.
