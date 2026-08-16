---
id: fe-blocks-archetypes-workbench-vi
title: vi.md
slug: /fe/blocks/archetypes/workbench/vi
sidebar_label: vi.md
sidebar_position: 1
description: Nơi người dùng làm việc chứ không chỉ đọc: máy bước, không phải thang tải.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `workbench` · Luật: [`INDEX.md`](./INDEX.md)

# Bảng thao tác nhiều bước

Năm chỗ: đăng nhập và OTP, chat AI, workspace nguồn bài học, thảo luận, editor lời giải. Đây là nhóm
duy nhất giữ state cục bộ trong nửa thuần.

## Máy bước khác thang tải

Thang tải trả lời: *dữ liệu về chưa?* Máy bước trả lời: *người dùng đang ở đâu trong việc này?*

`details | code | done` không phải ba mức tải. Chúng là ba chỗ đứng, và người dùng đi qua chúng theo
thứ tự. Mô hình hoá chúng như thang tải nghĩa là mất chỗ đứng của người dùng ngay khi có gì đó chậm.

## Mỗi nút một cờ

```tsx
<Button props={{ label: labels.rename, variant: "ghost", isPending: input.state === "renaming" }} on={{ press: input.on?.rename }} />
<Button props={{ label: labels.archive, variant: "ghost", isPending: input.state === "archiving" }} on={{ press: input.on?.archive }} />
```

Hai nút, hai bước, hai cờ. Không có `isPending` chung.

## Từ chối phải được **thông báo**

`AuthenticationPanel` mang hai trường riêng: một câu trạng thái, và một cờ nói câu đó có phải một lời
từ chối hay không. Cờ ấy tồn tại để câu từ chối được **announce** cho trình đọc màn hình, chứ không
chỉ hiện ra.

## Chạm DOM thô, có giới hạn

Đây là nhóm duy nhất chạm DOM thô, và chỉ vì ngữ nghĩa form thật: hai thẻ `<form>` trong một file.
Bốn lần chạm trong hai file trên toàn tầng. Con số đó là ngưỡng, không phải một giấy phép.
