---
id: fe-blocks-laws-b3-block-owns-its-frame-vi
title: vi.md
slug: /fe/blocks/laws/b3-block-owns-its-frame/vi
sidebar_label: vi.md
sidebar_position: 1
description: Đường phân chia giữa cái khối tự quyết và cái chỉ vùng chứa được quyết, giải thích bằng nghiệp vụ.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `b3-block-owns-its-frame` · Luật: [`INDEX.md`](./INDEX.md)

# Khối sở hữu khung của chính nó

Có một câu hỏi tách được mọi trường hợp: **khối có tự trả lời được câu này mà không cần biết trên
trang có gì khác không?**

Khoảng đệm bên trong: trả lời được. Cuộn khi nội dung dài: trả lời được. Vị trí trên trang: **không**
— muốn biết mình đứng đâu thì phải biết bên cạnh có ai. Chiều rộng: cũng không, vì chiều rộng của
một cột là quan hệ giữa cột đó và cột kia.

## Bảng tra

| Mã | Tình huống | Ai sở hữu |
|---|---|---|
| `B3-1` | Nội dung cần thở bên trong mặt phẳng | khối |
| `B3-2` | Nội dung cao hơn chỗ được cấp | khối — khung đứng yên, nội dung cuộn bên trong |
| `B3-3` | Cần nêu một giới hạn cao/rộng/lệch | khối, nhưng qua **token có tên** |
| `B3-4` | Một lựa chọn chỉ đổi cái đang hiển thị | nửa thuần của khối |
| `B3-5` | Khối đứng đâu, rộng bao nhiêu | **contract của vùng** |
| `B3-6` | Mọi thứ liên quan tới sơn | không ai ở tầng khối |

## `B3-1` — khoảng đệm là của khối

Thầy khoanh vùng đỏ và nói đúng bốn chữ: "đỏ bị mất padding". Hộp mua sát mép không phải một lựa
chọn thiết kế; nó là một khối quên mất phần nó tự quyết được.

## `B3-2` — khung đứng yên, ruột chạy

Đây là chỗ bị bác nhiều lần nhất trong bốn hồ sơ, và cả ba lần đều cùng một hình: có người muốn bọc
cả cái card bằng một lớp mờ dần, hoặc dán `overflow-y-auto` thẳng lên con của layout sticky. Thầy
nói ngắn: "nội dung được cuộn trong card".

Vì sao quan trọng: cái card là **ranh giới của một nhóm**. Nếu chính nó trôi đi hoặc mờ ở mép, ranh
giới ấy hết là ranh giới. Cuộn phải xảy ra bên trong, và ranh giới ở nguyên.

## `B3-3` — giới hạn phải có tên

`max-h-[80vh]` gõ thẳng vào khối bị bác, thay bằng một token có tên. Lý do không phải thẩm mỹ: một
con số gõ tay không trừ được chrome của trang, và trang thứ hai dùng lại nó sẽ sai mà không ai biết.

## `B3-4` — lựa chọn chỉ đổi hiển thị thì ở lại trong khối

Cột giá có một công tắc *mua* / *học thử*. Có đề xuất đẩy nó lên URL hoặc lên trang; bị bác hai
vòng. Nó không đổi route, không đổi request, nên nó không phải chuyện của trang.

Ranh giới: ngay khi một lựa chọn đổi route hoặc đổi request, nó rời khỏi khối.

## `B3-5` — vị trí và chiều rộng thuộc về vùng

Con số 288px của cột danh tính trên dashboard nằm trong contract của **vùng**, không nằm ở trang và
không nằm ở khối. Contract còn tự giải thích vì sao: rail giữ chiều đọc cố định bên cạnh một cột
chính co giãn, và xuống màn hình hẹp thì xếp chồng lên mà không biến thành card hay viewport riêng.

Hai mươi bảy trên ba mươi ba khối connected nhận **zero** props. Trang mount khối vào một slot có
tên; không có prop kiểu dáng nào đi qua ranh giới đó.

## `B3-6` — sơn không thuộc tầng khối

Toàn tầng block có **0** `className`. Không phải nhờ kỷ luật, mà nhờ cấu trúc: tập class bố cục là
một union **đóng**, nên `gap-[13px]` không bị cấm — nó **không biểu diễn được**.

## Vi phạm đang sống

Đúng một: nút AI nổi tự đặt `position: fixed`, `right: 16`, `bottom: 16`, `zIndex: 50` bằng inline
style. Một khối tự quyết chỗ đứng của mình trên **mọi** trang nó xuất hiện — và không ai trong số
những trang đó được hỏi.
